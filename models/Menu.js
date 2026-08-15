const mongoose = require("mongoose");

const menuSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    image: { type: String },
    isAvailable: { type: Boolean, default: true },
    dietaryPreference: { type: String, enum: ["veg", "non-veg"], default: "veg" },
    isSpicy: { type: Boolean, default: false },
    spicyLevel: { type: Number, default: 1 }, // 1: ??? Spicy, 2: ?????? Medium, 3: ????????? Extreme
    locationAvailability: { type: String, enum: ["cloud_only", "outlet_only", "both"], default: "both" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Menu", menuSchema);
