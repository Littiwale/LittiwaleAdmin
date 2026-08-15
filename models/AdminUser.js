const mongoose = require('mongoose');

const AdminUserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    pin: {
        type: String,
        default: '1234'
    },
    role: {
        type: String,
        enum: ['superadmin', 'manager', 'staff'],
        default: 'superadmin'
    },
    name: {
        type: String,
        default: 'Littiwale Admin'
    }
}, { timestamps: true });

module.exports = mongoose.model('AdminUser', AdminUserSchema);
