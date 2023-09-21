const { Schema, model } = require('mongoose')

const OrderSchema = new Schema({
    userId: String,
    items: [],
    address: { type: Object },
    orderStatus: String,
    paymentStatus: String,
    subtotal: Number,
    date: {
        type: Date,
        default: Date.now()
    }
})

const Order = model('Order', OrderSchema)
module.exports = Order