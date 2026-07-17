const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: { type: String, required: false },
    message: { type: String, required: false },
    image: { type: String, required: false }, // Base64 data URL
    expiry: { type: Date, required: false },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Announcement', announcementSchema);
