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
    // Hero Section Settings
    heroTagline: { type: String, default: "Good Food, Good Mood ♡" },
    heroTitle: { type: String, default: "Delicious Food Made with Love ♡" },
    heroDesc: { type: String, default: "Experience the perfect blend of authentic taste, premium quality, and happiness in every single bite." },
    heroBtn1Text: { type: String, default: "Explore Menu" },
    heroBtn1Link: { type: String, default: "/menu#menu-section" },
    heroBtn2Text: { type: String, default: "WhatsApp Order" },
    heroBtn2Link: { type: String, default: "https://wa.me/916370680744" },
    heroBtn3Text: { type: String, default: "Zomato Partner" },
    heroTrust1Text: { type: String, default: "100% Fresh & Healthy" },
    heroTrust2Text: { type: String, default: "Fast Cloud Delivery" },
    heroBadgeText: { type: String, default: "#1 Food" },
    heroBadgeSubtext: { type: String, default: "in Barbil" },
    heroImage: { type: String, default: "images/logo.png" },
    autoShuffleDeals: { type: Boolean, default: true },

    // About Us Section Settings
    aboutTagline: { type: String, default: "About Us" },
    aboutHeading: { type: String, default: "We Serve Happiness" },
    aboutStorySubtitle: { type: String, default: "Authentic Taste" },
    aboutStoryTitle: { type: String, default: "Barbil's Premier Cloud Kitchen" },
    aboutStoryText: { type: String, default: "Operating from Ward No. 7, Punjabi Para, Littiwale Barbil brings authentic wood-fired Litti Chokha, North/South Indian Thalis, Combos, Snacks & Beverages straight to your doorstep across Barbil with fast delivery." },
    aboutStoryCtaText: { type: String, default: "Contact Us on WhatsApp" },
    aboutStoryCtaLink: { type: String, default: "https://wa.me/916370680744?text=Hi,%20I'd%20like%20to%20know%20more%20about%20Littiwale%20Barbil." },
    aboutImage: { type: String, default: "images/menu-litti.jpg" },
    statNum: { type: String, default: "#1" },
    statText: { type: String, default: "Premier Cloud Kitchen in Barbil" },
    
    // 4 Perks Feature Grid
    perk1Title: { type: String, default: "Pure & Fresh" },
    perk1Text: { type: String, default: "100% Quality Ingredients" },
    perk2Title: { type: String, default: "Flame-Grilled" },
    perk2Text: { type: String, default: "Handmade Fresh Daily" },
    perk3Title: { type: String, default: "Fast Delivery" },
    perk3Text: { type: String, default: "25-35 Mins In Barbil" },
    perk4Title: { type: String, default: "5-Star Rated" },
    perk4Text: { type: String, default: "Barbil's Most Loved" },

    // Bulk Order Banner
    bulkBannerTitle: { type: String, default: "🎉 Planning a Special Event, Office Lunch or Party?" },
    bulkBannerSub: { type: String, default: "Get customized bulk menu & exclusive discounts!" },
    bulkBannerCtaText: { type: String, default: "Contact Us on WhatsApp" },
    bulkBannerCtaLink: { type: String, default: "https://wa.me/916370680744?text=Hi%20Littiwale,%20I'd%20like%20to%20inquire%20about%20a%20bulk%20party%20/%20office%20lunch%20/%20event%20order." },

    // Dabba Meal Subscription CMS
    dabbaVegTitle: { type: String, default: "Desi Veg Dabba" },
    dabbaVegSubtitle: { type: String, default: "Pure vegetarian. Best value for daily regulars." },
    dabbaVegWeeklyOldPrice: { type: String, default: "₹1,500" },
    dabbaVegWeeklyNewPrice: { type: String, default: "₹1,200" },
    dabbaVegMonthlyOldPrice: { type: String, default: "₹6,000" },
    dabbaVegMonthlyNewPrice: { type: String, default: "₹5,500" },
    dabbaNonvegTitle: { type: String, default: "Desi Feast Dabba" },
    dabbaNonvegSubtitle: { type: String, default: "4 days veg + 3 days non-veg (Wed, Fri, Sun)." },
    dabbaNonvegWeeklyOldPrice: { type: String, default: "₹2,000" },
    dabbaNonvegWeeklyNewPrice: { type: String, default: "₹1,500" },
    dabbaNonvegMonthlyOldPrice: { type: String, default: "₹7,500" },
    // SEO & Google Search Meta Settings
    seoTitle: { type: String, default: "Littiwale Barbil | Authentic Litti Chokha, Thalis & Best Cloud Kitchen in Barbil" },
    seoDescription: { type: String, default: "Order authentic wood-fired Litti Chokha, North & South Indian Thalis, Veg & Non-Veg meals online from Littiwale - Barbil's premier cloud kitchen. Fast delivery in Barbil." },
    seoKeywords: { type: String, default: "littiwale barbil, best restaurant in barbil, litti chokha barbil, online food delivery barbil, cloud kitchen barbil, thali barbil, veg nonveg food barbil, food delivery near me barbil" },
    seoOgImage: { type: String, default: "images/logo.png" },
    googleVerificationTag: { type: String, default: "" },
    canonicalUrl: { type: String, default: "https://littiwale-barbil.vercel.app" },
    deliveryBoys: [{
        id: { type: String },
        name: { type: String, required: true },
        phone: { type: String, required: true },
        isActive: { type: Boolean, default: true }
    }],

    updatedAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('StoreSetting', storeSettingSchema);
