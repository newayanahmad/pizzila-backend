const mongoose = require('mongoose');
const { Schema } = mongoose;

const CustomPizzaSchema = new Schema({
    name: { type: String, default: "Custom Pizza" },
    image: { type: String, default: "custom.jpeg" },
    description: { type: String, default: "Custom Pizza" },
    price: Number,
    category: { type: String, default: "Custom" },
    ingredients: {
        base: [String],
        sauce: [String],
        cheese: [String],
        veggies: [String]
    }
});

module.exports = mongoose.model("CustomPizza", CustomPizzaSchema);
