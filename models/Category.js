const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    displayOrder: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    locationAvailability: { type: String, enum: ['both', 'outlet_only', 'cloud_only'], default: 'both' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Category', categorySchema);
