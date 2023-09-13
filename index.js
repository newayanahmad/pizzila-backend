const express = require("express");
const bodyParser = require("body-parser");
const sendOTP = require("./sendOTP");
const { config } = require("dotenv");
const bcrypt = require('bcryptjs');
const User = require("./models/User")
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

config()
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
    await sendOTP(email, otp)
    res.json({ success: true })
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
        if (isTokenValid) {
            res.json({ userValid: true })
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
    const { email, password } = req.body;
    const user = await User.findOne({ email: email });
    if (!user) {
        res.json({ success: false, message: "Invalid credentials" })
        return;
    }
    let hashedPassword = user.password
    let userId = user._id.toString();
    let isValid = await checkHash(password, hashedPassword)
    if (isValid) {
        if (!user.isActive) {
            let otp = Math.floor(100000 + Math.random() * 900000)
            await sendOTP(email, otp)
            let hashedOTP = await createHash(String(otp))
            res.json(({ success: true, verified: false }))
            let user = await User.updateOne({ email: email }, { "$set": { otp: hashedOTP } })
            return;
        }
        let jwtToken = jwt.sign(userId, process.env.JWT_SECRET)
        res.json({ success: true, token: jwtToken, verified: true })
    }
    else {
        res.json({ success: false, message: 'Invalid credentials' })
    }
})


app.listen(PORT, '0.0.0.0', () => {
    console.log(`App listening on http://localhost:${PORT}`);
})