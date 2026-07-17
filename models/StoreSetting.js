const mongoose = require('mongoose');

const dayScheduleSchema = new mongoose.Schema({
    isOpen: { type: Boolean, default: true },
    openTime: { type: String, default: '09:00' },
    closeTime: { type: String, default: '22:00' },
    closedReason: { type: String, default: 'Closed for the day' }
}, { _id: false });

const storeSettingSchema = new mongoose.Schema({
    storeId: { type: String, required: true, unique: true }, // e.g. 'outlet' or 'cloud'
    storeName: { type: String, required: true },
    isOnline: { type: Boolean, default: true },
    autoSchedule: { type: Boolean, default: false },
    offlineReason: { type: String, default: '' },
    schedule: {
        monday: { type: dayScheduleSchema, default: () => ({}) },
        tuesday: { type: dayScheduleSchema, default: () => ({}) },
        wednesday: { type: dayScheduleSchema, default: () => ({}) },
        thursday: { type: dayScheduleSchema, default: () => ({}) },
        friday: { type: dayScheduleSchema, default: () => ({}) },
        saturday: { type: dayScheduleSchema, default: () => ({}) },
        sunday: { type: dayScheduleSchema, default: () => ({ isOpen: false, closedReason: 'Closed on Sundays' }) }
    },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StoreSetting', storeSettingSchema);
