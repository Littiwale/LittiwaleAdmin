const express = require('express');
const router = express.Router();
const { checkPin } = require('../middleware/auth');
const Menu = require('../models/Menu');
const Announcement = require('../models/Announcement');
const Coupon = require('../models/Coupon');
const StoreSetting = require('../models/StoreSetting');
const Category = require('../models/Category');

// Apply PIN auth to all routes except a login check
router.post('/login', (req, res) => {
    const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
    if (req.body.pin === ADMIN_PIN) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, error: 'Invalid PIN' });
    }
});

// =======================
// CATEGORY ROUTES
// =======================
router.get('/categories', async (req, res) => {
    try {
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
        const menu = await Menu.find().sort({ createdAt: -1 });
        res.json(menu);
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
        const announcements = await Announcement.find().sort({ createdAt: -1 });
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
        const coupons = await Coupon.find().sort({ createdAt: -1 });
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
            const defaultOutlet = new StoreSetting({ storeId: 'outlet', storeName: 'Littiwale Outlet' });
            const defaultCloud = new StoreSetting({ storeId: 'cloud', storeName: 'Cloud Kitchen' });
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

            if (setting.autoSchedule) {
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
                        // Determine next open day to show a better message
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
        res.json(updatedSetting);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


// =======================
// INSTAGRAM REELS ROUTES
// =======================
const Reel = require('../models/Reel');

router.get('/reels', async (req, res) => {
    try {
        let reels = await Reel.find().sort({ order: 1, createdAt: -1 });
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

module.exports = router;

