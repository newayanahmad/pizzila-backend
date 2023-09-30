const { Schema, model } = require('mongoose')

const OrderSchema = new Schema({
    userId: String,
    items: [],
    address: { type: Object },
    orderStatus: String,
    paymentStatus: String,
    inventoryUpdated: { type: Boolean, default: false }, // new field
    subtotal: Number,
    date: {
        type: Date,
        default: Date.now
    }
})

const Order = model('Order', OrderSchema)
module.exports = Order
