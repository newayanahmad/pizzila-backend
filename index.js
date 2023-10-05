const express = require("express");
const bodyParser = require("body-parser");
const sendOTP = require("./sendOTP");
const sendPasswordResetOTP = require("./sendResetPasswordOTP");
const { config } = require("dotenv");
const bcrypt = require('bcryptjs');
const User = require("./models/User")
const Pizza = require("./models/Pizza")
const Order = require("./models/Order")
const Inventory = require("./models/Inventory")
const CustomPizza = require("./models/CustomPizza")
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const notifyAdmin = require("./notifyAdmin");
const sendOrderConfirmation = require("./sendOrderConfirmation");
const http = require('http');
const socketIo = require('socket.io');

config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// Create express app

const app = express();
app.use(cors())
// Use body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set port
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO instance attached to the HTTP server
const io = socketIo(server, {
    cors: {
        origin: '*',
        credentials: true, // If needed
    },
});

// Handle new socket connections
// Mapping of emails to arrays of socket connections
const emailSockets = new Map();
io.on('connection', async (socket) => {
    const userId = socket.handshake.query.token;
    const id = jwt.decode(userId, process.env.JWT_SECRET)
    const user = await User.findOne({ "_id": id })
    const email = user?.email.toString()
    // If the email is already in the map, push the new socket to the array
    // Otherwise, add a new array with the socket
    if (emailSockets.has(email)) {
        emailSockets.get(email).push(socket);
    } else {
        emailSockets.set(email, [socket]);
    }

    socket.on('disconnect', async () => {
        // Remove the socket from the array
        const userId = socket.handshake.query.token;
        const id = jwt.decode(userId, process.env.JWT_SECRET)
        const user = await User.findOne({ "_id": id })
        const email = user?.email.toString()
        const sockets = emailSockets.get(email);
        const index = sockets.indexOf(socket);
        if (index !== -1) {
            sockets.splice(index, 1);
        }

        // If the array is empty, remove the email from the map
        if (sockets.length === 0) {
            emailSockets.delete(email);
        }
    });
});


async function main() {
    await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
}

main().catch(err => console.log(err));
async function createHash(value) {
    const salt = await bcrypt.genSalt(10);
    const hashedValue = await bcrypt.hash(value, salt);
    return hashedValue;
}

async function checkHash(value, hashedValue) {
    const isValid = await bcrypt.compare(value, hashedValue);
    return isValid;
}

async function isEmailTaken(email) {
    const user = await User.findOne({ email });
    return !!user;
}


app.get("/", (req, res) => {
    res.json({ "message": "Hello world!" })
})

app.post("/api/register", async (req, res) => {
    const { name, email, password } = req.body;
    const user = await User.findOne({ email })
    if (user) {
        res.json({ success: false, message: "Email already taken!" })
        return;
    }
    let otp = Math.floor(100000 + Math.random() * 900000)
    let hashedPassword = await createHash(password)
    let hashedOTP = await createHash(String(otp))
    const newUser = new User({ name: name.trim(), email: email.trim(), password: hashedPassword, otp: hashedOTP })
    await newUser.save()
    res.json({ success: true })
    await sendOTP(email, otp)
})

app.post("/api/verifyemail", async (req, res) => {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email });
    let hashedOTP = user.otp
    let userId = user._id.toString();
    let isValid = await checkHash(otp, hashedOTP)
    if (isValid) {
        let user = await User.updateOne({ email: email }, { "$set": { isActive: true } })
        let jwtToken = jwt.sign(userId, process.env.JWT_SECRET)
        res.json({ success: true, token: jwtToken })
    }
    else {
        res.json({ success: false, 'message': 'Invalid OTP' })
    }
})

app.post("/api/verifyuser", async (req, res) => {
    const { token } = req.headers;
    try {
        let isTokenValid = jwt.verify(token, process.env.JWT_SECRET)
        let id = jwt.decode(token, process.env.JWT_SECRET)
        let user = await User.findOne({ "_id": id })
        if (isTokenValid) {
            res.json({ userValid: true, userName: user.name })
        }
        else {
            res.json({ userValid: false })
        }
    }
    catch {
        res.json({ userValid: false })
    }
})


app.post("/api/login", async (req, res) => {
    const { email, password, isAdmin } = req.body;
    const user = await User.findOne({ email: email });
    if (!user) {
        res.json({ success: false, message: "Invalid credentials" })
        return;
    }
    let hashedPassword = user.password
    let userId = user._id.toString();
    let isValid = await checkHash(password, hashedPassword)
    if (isValid) {
        if (isAdmin === true) {
            if (user.isAdmin) {
                let jwtToken = jwt.sign(userId, process.env.JWT_SECRET)
                res.json({ success: true, token: jwtToken, verified: true })
                return;
            }
            else {
                res.json({ success: false, message: "Invalid credentials" })
                return;
            }
        }
        if (!user.isActive) {
            let otp = Math.floor(100000 + Math.random() * 900000)
            let hashedOTP = await createHash(String(otp))
            res.json(({ success: true, verified: false }))
            await User.updateOne({ email: email }, { "$set": { otp: hashedOTP } })
            await sendOTP(email, otp)
            return;
        }
        let jwtToken = jwt.sign(userId, process.env.JWT_SECRET)
        res.json({ success: true, token: jwtToken, verified: true })
    }
    else {
        res.json({ success: false, message: 'Invalid credentials' })
    }
})

app.post("/api/resendotp", async (req, res) => {
    const { email } = req.body
    let user = await User.findOne({ email: email })
    if (!user) {
        res.json({ success: false, message: "User not found" })
        return;
    }
    let otp = Math.floor(100000 + Math.random() * 900000)
    const hashedOTP = await createHash(String(otp))
    await User.updateOne({ email: email }, { "$set": { otp: hashedOTP } })
    res.json({ success: true, message: "OTP has been send to your email" })
    await sendOTP(email, otp)
})

app.post("/api/sendotp", async (req, res) => {
    const { email } = req.body
    let user = await User.findOne({ email: email })
    if (!user) {
        res.json({ success: false, message: "User not found" })
        return;
    }
    let otp = Math.floor(100000 + Math.random() * 900000)
    const hashedOTP = await createHash(String(otp))
    await User.updateOne({ email: email }, { "$set": { otp: hashedOTP } })
    res.json({ success: true, message: "OTP has been send to your email" })
    await sendPasswordResetOTP(email, otp, user.name.toString())
})

app.post("/api/verifyotp", async (req, res) => {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email });
    let hashedOTP = user.otp
    let isValid = await checkHash(otp, hashedOTP)
    if (isValid) {
        let user = await User.updateOne({ email: email }, { "$set": { isActive: true } })
        res.json({ success: true })
    }
    else {
        res.json({ success: false, message: 'Invalid OTP' })
    }
})

app.post("/api/reset-password", async (req, res) => {
    const { email, password } = req.body
    let user = await User.findOne({ email: email })
    if (!user) {
        res.json({ success: false, message: "Something went wrong" })
        return;
    }
    let hashedPassword = await createHash(password)
    let updatedUser = await User.updateOne({ email: email }, { "$set": { password: hashedPassword } })
    res.json({ success: true, message: "Your password has been successfully reset. \nPlease log in with your new password." })

})


app.get("/api/getpizzas", async (req, res) => {
    let pizzas = await Pizza.find({})
    res.json(pizzas)
})

app.post("/api/add-to-cart", async (req, res) => {
    const { cart } = req.body
    const { token } = req.headers
    const id = jwt.decode(token, process.env.JWT_SECRET)
    const updatedUser = await User.updateOne({ _id: id }, { "$set": { cartItems: cart } })
    res.json({ success: true })
})

app.post("/api/get-cart-items", async (req, res) => {
    let { user } = req.headers;
    let isTokenValid = jwt.verify(user.toString(), process.env.JWT_SECRET)
    if (!isTokenValid) {
        res.json({ success: false })
        return;
    }
    let id = jwt.decode(user, process.env.JWT_SECRET)
    let userData = await User.findOne({ _id: id })
    res.json({ success: true, cartItems: userData.cartItems })
})

app.post("/api/place-order", async (req, res) => {
    const { cart, subtotal, address } = req.body
    const { user } = req.headers
    const id = jwt.decode(user, process.env.JWT_SECRET)
    // storing the order details in order model
    const newOrder = new Order({ userId: id, items: cart, address: address, orderStatus: "Awaiting Payment", paymentStatus: "Pending", subtotal: subtotal })
    await newOrder.save()
    io.emit("AdminOrders", { order: newOrder, isUpdate: false })
    res.json({ success: true, orderId: newOrder._id.toString() })
})

app.post('/api/create-payment-intent', async (req, res) => {
    const { items, subtotal } = req.body;
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: parseInt(subtotal) * 100,
            currency: "inr",

        });
        res.send({
            clientSecret: paymentIntent.client_secret,
        });
    }
    catch {
        res.json({ success: false })
    }

});


app.post('/api/check-payment-status', async (req, res) => {
    const { intent, orderID } = req.body;
    const { user } = req.headers
    const id = jwt.decode(user, process.env.JWT_SECRET);
    await User.updateOne({ _id: id }, { "$set": { cartItems: [] } })
    const paymentIntent = await stripe.paymentIntents.retrieve(
        intent
    );
    if (paymentIntent.status === "succeeded") {
        const order = await Order.findOne({ "_id": orderID }); // Retrieve the order
        // Update the inventory
        if (!order.inventoryUpdated) {
            await Order.updateOne({ "_id": orderID }, { "$set": { paymentStatus: "Paid", orderStatus: "Order Placed", inventoryUpdated: true } })
            const newOrder = await Order.findOne({ "_id": orderID })
            io.emit("AdminOrders", { order: newOrder, isUpdate: true })
            order.items.forEach((item) => {
                Object.keys(item.ingredients).forEach((key) => {
                    item.ingredients[key].forEach(async (ingredient) => {
                        await Inventory.findOneAndUpdate({ ingredient: ingredient }, { "$inc": { quantity: -item.quantity } });
                    });
                });
            });
            const inventory = await Inventory.find({})
            io.emit('inventory', { inventory })
        }
        res.json({ status: paymentIntent.status, success: true })
        // Send order confirmation email
        const u = await User.findOne({ "_id": id })
        await sendOrderConfirmation(u.email.toString(), order);

        const inventory = await Inventory.find({ quantity: { "$lte": 20 } })
        if (inventory.length > 0) {
            await notifyAdmin(inventory)
        }
    }
    else {
        await Order.updateOne({ "_id": orderID }, { "$set": { paymentStatus: "Failed" } })
        const newOrder = await Order.findOne({ "_id": orderID })
        io.emit("AdminOrders", { order: newOrder, isUpdate: true })
        res.json({ sucess: false })
        return
    }
})

app.post("/api/get-orders", async (req, res) => {
    const { user } = req.headers
    console.log(user)
    if (!user) {
        return res.json({ success: false })

    }
    const { orderId } = req.body
    const id = jwt.decode(user, process.env.JWT_SECRET)
    if (orderId) {
        const order = await Order.findOne({ _id: orderId })
        const user = await User.findOne({ _id: id })
        res.json({ success: true, order: order, user: { name: user.name, email: user.email } })
        return;
    }
    const orders = await Order.find({ userId: id }).sort("-date")
    res.json(orders)
})


app.post("/api/get-user", async (req, res) => {
    const { user } = req.headers
    if (!user) {
        res.json({ success: false })
        return;
    }
    const id = jwt.decode(user, process.env.JWT_SECRET)
    const userData = await User.findOne({ _id: id })
    res.json({ name: userData.name, email: userData.email, date: userData.date })
})


app.post("/api/verifyadmin", async (req, res) => {
    const { token } = req.headers
    if (!token) {
        res.json({ success: false })
        return;
    }
    else {
        try {
            let isTokenValid = jwt.verify(token, process.env.JWT_SECRET)
            let id = jwt.decode(token, process.env.JWT_SECRET)
            let user = await User.findOne({ "_id": id })
            if (isTokenValid) {
                if (user.isAdmin) {
                    res.json({ success: true })
                    return;
                }
                else {
                    res.json({ success: false })
                    return;
                }
            }
            else {
                res.json({ success: false })
                return;
            }
        }
        catch {
            res.json({ success: false })
            return;
        }
    }
})

app.post("/api/get-inventory", async (req, res) => {
    // fetch inventory from database
    const inventory = await Inventory.find({});
    res.json(inventory);
})


app.post("/api/getorders", async (req, res) => {
    const { user } = req.headers
    if (!user) {
        res.json({ success: false })
        return;
    } console.log(user)
    const id = jwt.decode(user, process.env.JWT_SECRET)
    const u = await User.findOne({ "_id": id })
    console.log(u)
    if (!u && !u.isAdmin) {
        res.json({ success: false })
        return;
    }
    const orders = await Order.find({}).sort("-date")
    res.json({ success: true, orders })
})


app.post("/api/update-order-status", async (req, res) => {
    const { orderId, newStatus } = req.body;
    try {
        // Update the order status in the database (e.g., using Mongoose)
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { orderStatus: newStatus },
            { new: true }
        );

        const u = await User.findOne({ "_id": updatedOrder.userId })
        const sockets = emailSockets.get(u.email);
        if (sockets) {
            sockets.forEach(socket => {
                socket.emit('orders', { order: updatedOrder });
            });
        }
        res.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error updating order status' });
    }
});


// Define a POST route to handle custom pizza data
app.post('/api/custom-pizza', async (req, res) => {
    try {
        // Check if the custom pizza with the same ingredients already exists
        const existingPizza = await CustomPizza.findOne({
            'ingredients.base': req.body.ingredients.base,
            'ingredients.sauce': req.body.ingredients.sauce,
            'ingredients.cheese': req.body.ingredients.cheese,
            'ingredients.veggies': { $all: req.body.ingredients.veggies },
        });

        if (existingPizza) {
            // If the same pizza already exists, return it
            return res.status(200).json({ pizza: existingPizza, success: true });
        }
        const base = await Inventory.findOne({ ingredient: req.body.ingredients.base, category: "base" })
        const basePrice = base.price
        const sauce = await Inventory.findOne({ ingredient: req.body.ingredients.sauce, category: "sauce" })
        const saucePrice = sauce.price
        const cheese = await Inventory.findOne({ ingredient: req.body.ingredients.cheese, category: "cheese" })
        const cheesePrice = cheese.price
        const veggies = req.body.ingredients.veggies
        let veggiesPrice = 0
        veggies.forEach(async (veggie) => {
            const veg = await Inventory.findOne({ ingredient: veggie, category: "veggies" })
            veggiesPrice += veg.price
        })
        const price = basePrice + saucePrice + cheesePrice + veggiesPrice


        // Convert base, sauce, and cheese strings into arrays
        const baseArray = [req.body.ingredients.base];
        const sauceArray = [req.body.ingredients.sauce];
        const cheeseArray = [req.body.ingredients.cheese];

        // Create a new custom pizza document with arrays
        const newPizza = new CustomPizza({
            price: price * 1.18,
            ingredients: {
                base: baseArray,
                sauce: sauceArray,
                cheese: cheeseArray,
                veggies: req.body.ingredients.veggies || [], // Use existing veggies or an empty array
            },
        });

        // Save the new pizza to the database
        const savedPizza = await newPizza.save();

        // Return the saved pizza as JSON
        res.status(201).json({ pizza: savedPizza, success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error', success: false });
    }
});

app.post("/api/create-pizza", async (req, res) => {
    const { token } = req.headers
    const { pizza } = req.body
    const id = jwt.decode(token, process.env.JWT_SECRET)
    const user = await User.findOne({ "_id": id })
    if (!user && !user.isAdmin) return res.json({ success: false })
    const newPizza = await Pizza(pizza)
    await newPizza.save()
    res.json({ success: true })
})

app.post("/api/remove-pizza", async (req, res) => {

    const { token } = req.headers
    const { pizzaID } = req.body
    const id = jwt.decode(token, process.env.JWT_SECRET)
    const user = await User.findOne({ "_id": id })
    if (!user && !user.isAdmin) return res.json({ success: false })
    await Pizza.deleteOne({ "_id": pizzaID })
    res.json({ success: true })
}
)

server.listen(PORT, '0.0.0.0', () => {
    console.log(`App listening on http://localhost:${PORT}`);
})