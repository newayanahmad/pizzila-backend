const mongoose = require('mongoose')
const { Schema } = require('mongoose')

const PizzaSchema = new Schema({
    name: String,
    image: String,
    description: String,
    price: Number,
    category: String,
    ingredients: {
        base: Array,
        sauce: Array,
        cheese: Array,
        veggies: Array
    }
})

module.exports = mongoose.model("Pizzas", PizzaSchema)