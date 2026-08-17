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
    spicyLevel: { type: Number, default: 1 }, // 1: Mild Spicy, 2: Medium, 3: Extreme
    locationAvailability: { type: String, enum: ["cloud_only", "outlet_only", "both"], default: "both" },
    originalPrice: { type: Number },
    note: { type: String },
    isCombo: { type: Boolean, default: false },
    isCraziestDeal: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

menuSchema.index({ category: 1, isAvailable: 1 });
menuSchema.index({ locationAvailability: 1 });
menuSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Menu", menuSchema);
