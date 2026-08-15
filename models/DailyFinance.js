const mongoose = require('mongoose');

const DailyFinanceSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        default: () => new Date().toISOString().split('T')[0]
    },
    channel: {
        type: String,
        enum: ['zomato', 'website', 'swiggy', 'dine_in'],
        required: true
    },
    ordersCount: {
        type: Number,
        default: 0
    },
    grossAmount: {
        type: Number,
        required: true,
        default: 0
    },
    commissionOrDeductions: {
        type: Number,
        default: 0
    },
    netPayout: {
        type: Number,
        required: true,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: ['settled', 'pending'],
        default: 'settled'
    },
    notes: {
        type: String,
        default: ''
    }
}, { timestamps: true });

module.exports = mongoose.model('DailyFinance', DailyFinanceSchema);
