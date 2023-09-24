const express = require("express");
const bodyParser = require("body-parser");
const sendOTP = require("./sendOTP");
const sendPasswordResetOTP = require("./sendResetPasswordOTP");
const { config } = require("dotenv");
const bcrypt = require('bcryptjs');
const User = require("./models/User")
const Pizza = require("./models/Pizza")
const Order = require("./models/Order")
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');


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
        const newOrder = await Order.updateOne({ "_id": orderID }, { "$set": { paymentStatus: "Paid", orderStatus: "Order Placed" } })
    }
    else {
        await Order.updateOne({ "_id": orderID }, { "$set": { paymentStatus: "Failed" } })
    }
    res.json({ status: paymentIntent.status, success: true })
})

app.post("/api/get-orders", async (req, res) => {
    const { user } = req.headers
    const { orderId } = req.body
    const id = jwt.decode(user, process.env.JWT_SECRET)
    if (orderId) {
        const order = await Order.findOne({ _id: orderId, userId: id })
        res.json({ success: true, order: order })
        return;
    }
    const orders = await Order.find({ userId: id }).sort("-date")
    res.json(orders)
})


app.post("/api/get-user", async (req, res) => {
    const { user } = req.headers
    const id = jwt.decode(user, process.env.JWT_SECRET)
    const userData = await User.findOne({ _id: id })
    res.json({ name: userData.name, email: userData.email, date: userData.date })
})


app.listen(PORT, '0.0.0.0', () => {
    console.log(`App listening on http://localhost:${PORT}`);
})