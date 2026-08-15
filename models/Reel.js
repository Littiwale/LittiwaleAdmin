const mongoose = require('mongoose');

const reelSchema = new mongoose.Schema({
    title: { type: String, default: 'Customer Review' },
    badge: { type: String, default: 'Popular' },
    image: { type: String, required: true },
    link: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Reel', reelSchema);
