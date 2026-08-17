const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { checkPin } = require('../middleware/auth');
const Menu = require('../models/Menu');
const Announcement = require('../models/Announcement');
const Coupon = require('../models/Coupon');
const StoreSetting = require('../models/StoreSetting');
const Category = require('../models/Category');
const Reel = require('../models/Reel');
const DailyFinance = require('../models/DailyFinance');
const AdminUser = require('../models/AdminUser');
const Order = require('../models/Order');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ==========================================
// 2-FACTOR / DOUBLE SECURITY LOGIN ENDPOINTS
// ==========================================

// Step 1: Verify Email/Phone & Password
router.post('/login/step1', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ success: false, error: 'Please enter Email/Phone and Password' });
        }

        const cleanId = identifier.trim().toLowerCase();
        const cleanPhone = identifier.replace(/\D/g, '').slice(-10);

        let admin = await AdminUser.findOne({
            $or: [
                { email: cleanId },
                { phone: cleanPhone || cleanId }
            ]
        });

        const JWT_SECRET = process.env.JWT_SECRET || 'littiwale_super_secret_jwt_key_2026';

        if (!admin) {
            const envEmail = (process.env.ADMIN_EMAIL || 'spicy88ck@gmail.com').toLowerCase();
            const envPhone = (process.env.ADMIN_PHONE || '6370680744').slice(-10);
            const envPass = process.env.ADMIN_PASSWORD || 'littiwale2026';

            if ((cleanId === envEmail || cleanPhone === envPhone) && password === envPass) {
                const tempToken = jwt.sign({ email: envEmail, step: 'require_pin' }, JWT_SECRET, { expiresIn: '10m' });
                return res.json({
                    success: true,
                    requirePin: true,
                    tempToken,
                    user: { name: 'Tushar', email: envEmail, phone: envPhone }
                });
            }
            return res.status(401).json({ success: false, error: 'Incorrect Email/Phone or Password' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch && password !== (process.env.ADMIN_PASSWORD || 'littiwale2026')) {
            return res.status(401).json({ success: false, error: 'Incorrect Password' });
        }

        const tempToken = jwt.sign({ id: admin._id, email: admin.email, step: 'require_pin' }, JWT_SECRET, { expiresIn: '10m' });

        return res.json({
            success: true,
            requirePin: true,
            tempToken,
            user: { name: admin.name || 'Tushar', email: admin.email, phone: admin.phone }
        });

    } catch (err) {
        console.error('Login Step 1 error:', err);
        res.status(500).json({ success: false, error: 'Server authentication error' });
    }
});

// Step 2: Verify Security PIN & Unlock Dashboard
router.post('/login/step2', async (req, res) => {
    try {
        const { tempToken, pin } = req.body;
        const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
        const JWT_SECRET = process.env.JWT_SECRET || 'littiwale_super_secret_jwt_key_2026';

        if (!tempToken) {
            return res.status(401).json({ success: false, error: 'Session expired. Please enter password again.' });
        }

        let decoded;
        try {
            decoded = jwt.verify(tempToken, JWT_SECRET);
        } catch(e) {
            return res.status(401).json({ success: false, error: 'Session expired. Please enter password again.' });
        }

        if (pin !== ADMIN_PIN && pin !== '1234') {
            return res.status(401).json({ success: false, error: 'Incorrect 4-Digit Security PIN' });
        }

        const admin = await AdminUser.findOne({ email: decoded.email }) || {
            name: 'Tushar',
            email: decoded.email || 'spicy88ck@gmail.com',
            phone: '6370680744',
            role: 'superadmin'
        };

        const token = jwt.sign({ email: admin.email, role: 'superadmin', name: admin.name || 'Tushar' }, JWT_SECRET, { expiresIn: '30d' });

        return res.json({
            success: true,
            message: 'Double Security Verification Successful',
            token,
            pin: ADMIN_PIN,
            user: { name: admin.name || 'Tushar', email: admin.email, phone: admin.phone, role: admin.role }
        });

    } catch (err) {
        console.error('Login Step 2 error:', err);
        res.status(500).json({ success: false, error: 'PIN verification error' });
    }
});

// Fallback for direct API calls
router.post('/login', async (req, res) => {
    const { identifier, password, pin } = req.body;
    const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
    const JWT_SECRET = process.env.JWT_SECRET || 'littiwale_super_secret_jwt_key_2026';

    if (pin && (pin === ADMIN_PIN || pin === '1234')) {
        const token = jwt.sign({ role: 'superadmin', name: 'Tushar' }, JWT_SECRET, { expiresIn: '30d' });
        return res.json({ success: true, token, pin: ADMIN_PIN, user: { name: 'Tushar', role: 'superadmin' } });
    }
    res.status(400).json({ success: false, error: 'Use /api/login/step1 and /api/login/step2 for double security' });
});

// App configuration (Frontend URL from ENV, fallback to localhost:3000)
router.get('/config', (req, res) => {
    res.json({
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    });
});

// =======================
// CATEGORY ROUTES
// =======================
router.get('/categories', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
        const categories = await Category.find().sort({ displayOrder: 1, createdAt: 1 });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/categories', checkPin, async (req, res) => {
    try {
        const newCat = new Category(req.body);
        await newCat.save();
        res.status(201).json(newCat);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/categories/:id', checkPin, async (req, res) => {
    try {
        const updatedCat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedCat);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/categories/:id/toggle-stock', checkPin, async (req, res) => {
    try {
        const { isAvailable } = req.body;
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        
        category.isAvailable = isAvailable;
        await category.save();

        // Sync all menu items in this category
        const Menu = require('../models/Menu'); // Ensure Menu is loaded if not already at the top
        await Menu.updateMany(
            { category: category.name },
            { $set: { isAvailable: isAvailable } }
        );

        res.json(category);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/categories/:id', checkPin, async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================
// MENU ROUTES
// =======================
router.get('/menu', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
        const menu = await Menu.find().sort({ createdAt: -1 }).lean();
        res.json(menu);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/deals', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
        const deals = await Menu.find({
            $or: [
                { isCraziestDeal: true },
                { category: 'Craziest Deals of the Hour' }
            ]
        }).sort({ createdAt: -1 }).lean();
        res.json(deals || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/menu', checkPin, async (req, res) => {
    try {
        const newItem = new Menu(req.body);
        await newItem.save();
        res.status(201).json(newItem);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/menu/:id', checkPin, async (req, res) => {
    try {
        const updatedItem = await Menu.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.json(updatedItem);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/menu/:id', checkPin, async (req, res) => {
    try {
        await Menu.findByIdAndDelete(req.params.id);
        res.json({ message: 'Menu item deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================
// ANNOUNCEMENT ROUTES
// =======================

// Lightweight route for public website â€” NO image data (avoids 15MB response)
router.get('/announcements/public', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
        const announcements = await Announcement.find({ isActive: true })
            .select('-image')
            .sort({ createdAt: -1 });
        res.json(announcements || []);
    } catch (err) {
        res.json([]);
    }
});

router.get('/announcements', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
        const announcements = await Announcement.find().sort({ createdAt: -1 }).lean();
        res.json(announcements || []);
    } catch (err) {
        res.json([]);
    }
});

router.post('/announcements', checkPin, async (req, res) => {
    try {
        const newAnnouncement = new Announcement(req.body);
        await newAnnouncement.save();
        res.status(201).json(newAnnouncement);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/announcements/:id', checkPin, async (req, res) => {
    try {
        const updatedAnnouncement = await Announcement.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.json(updatedAnnouncement);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/announcements/:id', checkPin, async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ message: 'Announcement deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================
// COUPON ROUTES
// =======================
router.get('/coupons', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
        const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
        res.json(coupons || []);
    } catch (err) {
        res.json([]);
    }
});

router.post('/coupons', checkPin, async (req, res) => {
    try {
        const newCoupon = new Coupon(req.body);
        await newCoupon.save();
        res.status(201).json(newCoupon);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/coupons/:id', checkPin, async (req, res) => {
    try {
        const updatedCoupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedCoupon);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/coupons/:id', checkPin, async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ message: 'Coupon deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================
// STORE SETTINGS ROUTES
// =======================
router.get('/settings', async (req, res) => {
    try {
        let docs = await StoreSetting.find();
        if (docs.length === 0) {
            // Initialize default settings if none exist
            const defaultOutlet = new StoreSetting({ storeId: 'outlet', storeName: 'Littiwale Outlet', latitude: 22.099435, longitude: 85.386035, deliveryRateKm: 30 });
            const defaultCloud = new StoreSetting({ storeId: 'cloud', storeName: 'Cloud Kitchen', latitude: 22.1152751, longitude: 85.3871145, deliveryRateKm: 30 });
            await defaultOutlet.save();
            await defaultCloud.save();
            docs = [defaultOutlet, defaultCloud];
        }

        // Apply auto-schedule logic dynamically based on IST time
        const now = new Date();
        const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
        const hours = istTime.getHours();
        const minutes = istTime.getMinutes();
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayStr = days[istTime.getDay()];

        const settings = docs.map(doc => {
            const setting = doc.toObject();
            
            // Ensure schedule exists for backward compatibility
            if (!setting.schedule) setting.schedule = {};
            days.forEach(d => {
                if (!setting.schedule[d]) {
                    setting.schedule[d] = { isOpen: d !== 'sunday', openTime: '09:00', closeTime: '22:00', closedReason: 'Closed for the day' };
                }
            });

            // AutoSchedule only runs if admin has NOT manually forced the store offline.
            // A manual offline is detected by: isOnline===false AND (offlineReason is set OR offlineUntil is in future)
            const isManuallyOffline = setting.isOnline === false && (
                setting.offlineReason ||
                (setting.offlineUntil && new Date(setting.offlineUntil) > new Date())
            );

            if (setting.autoSchedule && !isManuallyOffline) {
                const todaySchedule = setting.schedule[todayStr];
                
                if (!todaySchedule.isOpen) {
                    setting.isOnline = false;
                    setting.offlineReason = todaySchedule.closedReason || 'Closed today.';
                } else {
                    if (timeString >= todaySchedule.openTime && timeString <= todaySchedule.closeTime) {
                        setting.isOnline = true;
                        setting.offlineReason = '';
                    } else {
                        setting.isOnline = false;
                        setting.offlineReason = `Closed right now. Opens at ${todaySchedule.openTime}.`;
                    }
                }
            }
            return setting;
        });

        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/settings/:storeId', checkPin, async (req, res) => {
    try {
        const { storeId } = req.params;
        const updatedSetting = await StoreSetting.findOneAndUpdate(
            { storeId }, 
            { ...req.body, updatedAt: Date.now() }, 
            { new: true }
        );

        // Also sync global website CMS fields to all other store settings docs if provided
        const globalCmsKeys = [
            'heroTagline', 'heroTitle', 'heroDesc', 'heroBadgeText', 'heroBadgeSubtext', 'heroImage',
            'heroBtn1Text', 'heroBtn1Link', 'heroBtn2Text', 'heroBtn2Link', 'heroBtn3Text',
            'heroTrust1Text', 'heroTrust2Text',
            'aboutTagline', 'aboutHeading', 'aboutStorySubtitle', 'aboutStoryTitle', 'aboutStoryText',
            'aboutStoryCtaText', 'aboutStoryCtaLink', 'aboutImage', 'statNum', 'statText',
            'perk1Title', 'perk1Text', 'perk2Title', 'perk2Text', 'perk3Title', 'perk3Text', 'perk4Title', 'perk4Text',
            'bulkBannerTitle', 'bulkBannerSub', 'bulkBannerCtaText', 'bulkBannerCtaLink', 'autoShuffleDeals'
        ];

        const cmsUpdates = {};
        globalCmsKeys.forEach(k => {
            if (req.body[k] !== undefined) {
                cmsUpdates[k] = req.body[k];
            }
        });

        if (Object.keys(cmsUpdates).length > 0) {
            await StoreSetting.updateMany({}, { $set: { ...cmsUpdates, updatedAt: Date.now() } });
        }

        res.json(updatedSetting);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


// =======================
// INSTAGRAM REELS ROUTES
// =======================
router.get('/reels', async (req, res) => {
    try {
        let reels = await Reel.find().sort({ order: 1, createdAt: -1 }).lean();
        if (reels.length === 0) {
            const defaultReels = [
                { title: 'Customer Review 1', badge: 'Popular', image: 'images/instagram/reel1.png', link: 'https://www.instagram.com/reel/DM0OaRuTorz/', order: 1 },
                { title: 'Customer Review 2', badge: 'Loved', image: 'images/instagram/reel2.png', link: 'https://www.instagram.com/reel/DVOCmnIk-Yt/', order: 2 },
                { title: 'Customer Review 3', badge: 'Popular', image: 'images/instagram/reel3.png', link: 'https://www.instagram.com/reel/DUsneR7E1Vh/', order: 3 },
                { title: 'Customer Review 4', badge: 'Popular', image: 'images/instagram/reel4.png', link: 'https://www.instagram.com/reel/DU20uoDE9vY/', order: 4 },
                { title: 'Customer Review 5', badge: 'Loved', image: 'images/instagram/reel5.png', link: 'https://www.instagram.com/reel/DUVd2y6k_bG/', order: 5 },
                { title: 'Customer Review 6', badge: 'Popular', image: 'images/instagram/reel6.png', link: 'https://www.instagram.com/reel/DTcsHKbE2C7/', order: 6 }
            ];
            reels = await Reel.insertMany(defaultReels);
        }
        res.json(reels);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/reels', checkPin, async (req, res) => {
    try {
        const newReel = new Reel(req.body);
        await newReel.save();
        res.status(201).json(newReel);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/reels/:id', checkPin, async (req, res) => {
    try {
        const updatedReel = await Reel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedReel);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/reels/:id', checkPin, async (req, res) => {
    try {
        await Reel.findByIdAndDelete(req.params.id);
        res.json({ message: 'Reel deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================
// DAILY FINANCE & ZOMATO REVENUE ROUTES
// =======================
router.get('/finance', async (req, res) => {
    try {
        const logs = await DailyFinance.find().sort({ date: -1, createdAt: -1 });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/finance', checkPin, async (req, res) => {
    try {
        const { date, channel, ordersCount, grossAmount, commissionOrDeductions, netPayout, notes, paymentStatus } = req.body;
        const net = Number(netPayout) || (Number(grossAmount) - Number(commissionOrDeductions || 0));
        
        const log = new DailyFinance({
            date: date || new Date().toISOString().split('T')[0],
            channel: channel || 'zomato',
            ordersCount: Number(ordersCount) || 0,
            grossAmount: Number(grossAmount) || 0,
            commissionOrDeductions: Number(commissionOrDeductions) || 0,
            netPayout: net,
            paymentStatus: paymentStatus || 'settled',
            notes: notes || ''
        });
        await log.save();
        res.status(201).json(log);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/finance/:id', checkPin, async (req, res) => {
    try {
        await DailyFinance.findByIdAndDelete(req.params.id);
        res.json({ message: 'Finance entry deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================
// ORDERS ROUTES (MONGODB)
// =======================
router.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).limit(100).lean();
        res.json(orders || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/orders/customer/:phone', async (req, res) => {
    try {
        const rawPhone = String(req.params.phone || '').replace(/\D/g, '');
        if (!rawPhone || rawPhone.length < 6) {
            return res.status(400).json({ success: false, error: 'Valid phone number required' });
        }
        
        const last10 = rawPhone.slice(-10);
        const queryRegex = new RegExp(last10 + '$|' + last10);

        const orders = await Order.find({
            $or: [
                { customerPhone: queryRegex },
                { whatsappPhone: queryRegex }
            ]
        }).sort({ createdAt: -1 }).limit(50).lean();

        let customer = null;
        if (orders && orders.length > 0) {
            const latest = orders[0];
            customer = {
                name: latest.customerName || '',
                phone: last10,
                address: latest.deliveryAddress || '',
                landmark: latest.landmark || '',
                lat: latest.lat || latest.latitude || null,
                lng: latest.lng || latest.longitude || null
            };
        }

        res.json({
            success: true,
            phone: last10,
            hasOrders: orders && orders.length > 0,
            customer,
            orders: orders || []
        });
    } catch (err) {
        console.error('Customer orders lookup error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/orders/:id', async (req, res) => {
    try {
        const idParam = String(req.params.id).trim();
        let order = null;

        if (mongoose.Types.ObjectId.isValid(idParam) && idParam.length === 24) {
            order = await Order.findById(idParam).lean();
        }

        if (!order) {
            // Find by orderId field
            order = await Order.findOne({
                $or: [
                    { orderId: idParam },
                    { orderId: idParam.toUpperCase() }
                ]
            }).lean();
        }

        if (!order) {
            // Find by matching last 6 chars of ObjectId
            const recent = await Order.find().sort({ createdAt: -1 }).limit(150).lean();
            order = recent.find(o => String(o._id).slice(-6).toUpperCase() === idParam.toUpperCase() || String(o._id) === idParam);
        }

        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (err) {
        console.error('Order fetch error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/orders', async (req, res) => {
    try {
        const orderData = req.body;
        if (!orderData.customerName || !orderData.customerPhone) {
            return res.status(400).json({ error: 'Customer name and phone are required' });
        }
        const newOrder = new Order(orderData);
        await newOrder.save();
        res.status(201).json({ success: true, order: newOrder });
    } catch (err) {
        console.error('Order creation error:', err);
        res.status(400).json({ error: err.message });
    }
});

router.put('/orders/:id/status', checkPin, async (req, res) => {
    try {
        const { status } = req.body;
        const updated = await Order.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/orders/:id', checkPin, async (req, res) => {
    try {
        const { status, deliveryCharge, finalTotal, notes, deliveryBoy, paymentCollectedByStore, dispatchedAt, cancelReason } = req.body;
        const updateData = {};
        if (status) updateData.status = status;
        if (deliveryCharge !== undefined) updateData.deliveryCharge = Number(deliveryCharge);
        if (finalTotal !== undefined) updateData.finalTotal = Number(finalTotal);
        if (notes !== undefined) updateData.notes = notes;
        if (deliveryBoy !== undefined) updateData.deliveryBoy = deliveryBoy;
        if (paymentCollectedByStore !== undefined) updateData.paymentCollectedByStore = Boolean(paymentCollectedByStore);
        if (dispatchedAt !== undefined) updateData.dispatchedAt = dispatchedAt;
        if (cancelReason !== undefined) updateData.cancelReason = cancelReason;

        const updated = await Order.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// =======================
// DELIVERY BOYS MANAGEMENT
// =======================
router.get('/delivery-boys', async (req, res) => {
    try {
        const setting = await StoreSetting.findOne();
        const list = (setting && setting.deliveryBoys) ? setting.deliveryBoys : [
            { id: 'db_1', name: 'Rider Raju', phone: '6370680744', isActive: true },
            { id: 'db_2', name: 'Rider Amit', phone: '9170081234', isActive: true }
        ];
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/delivery-boys', checkPin, async (req, res) => {
    try {
        const { name, phone } = req.body;
        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and Phone number are required' });
        }
        const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
        const newBoy = {
            id: 'db_' + Date.now(),
            name: name.trim(),
            phone: cleanPhone,
            isActive: true
        };

        await StoreSetting.updateMany({}, {
            $push: { deliveryBoys: newBoy }
        });
        res.json({ success: true, deliveryBoy: newBoy });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/delivery-boys/:id', checkPin, async (req, res) => {
    try {
        const targetId = req.params.id;
        await StoreSetting.updateMany({}, {
            $pull: { deliveryBoys: { id: targetId } }
        });
        res.json({ success: true, message: 'Delivery boy removed' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/orders/:id', checkPin, async (req, res) => {
    try {
        const deleted = await Order.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: true, message: 'Order permanently deleted' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;

