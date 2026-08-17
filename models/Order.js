const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    id: { type: String },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    subtotal: { type: Number, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    deliveryAddress: { type: String, default: '' },
    landmark: { type: String, default: '' },
    deliveryLocation: { type: String, enum: ['cloud', 'outlet'], default: 'cloud' },
    orderType: { type: String, enum: ['delivery', 'takeaway'], default: 'delivery' },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    couponCode: { type: String, default: '' },
    deliveryCharge: { type: Number, default: 0 },
    finalTotal: { type: Number, required: true, default: 0 },
    paymentMethod: { type: String, enum: ['COD', 'UPI'], default: 'COD' },
    paymentMode: { type: String, default: 'full' },
    notes: { type: String, default: '' },
    orderSource: { type: String, default: 'website' },
    deliveryBoy: {
        name: { type: String, default: '' },
        phone: { type: String, default: '' }
    },
    paymentCollectedByStore: { type: Boolean, default: false },
    dispatchedAt: { type: Date },
    status: { type: String, enum: ['pending', 'accepted', 'preparing', 'dispatched', 'delivered', 'cancelled'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Order', orderSchema);
