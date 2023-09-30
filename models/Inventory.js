const { Schema, model } = require('mongoose')

const InventorySchema = new Schema({
    ingredient: String,
    quantity: Number,
    price: Number,
    category: String
})

module.exports = model("Inventory", InventorySchema)
