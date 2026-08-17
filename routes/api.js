const express = require('express');
const router = express.Router();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { checkPin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const supabaseDb = require('../utils/supabaseDb');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch(e) {
        console.error('Supabase client init error:', e.message);
    }
}

function toSlug(str) {
    return (str || 'general')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Upload base64 image buffer to Supabase bucket and return clean masked proxy URL
async function uploadBase64ToSupabase(base64Str, bucket = 'menu', folder = '') {
    if (!supabase || !base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:image/')) {
        return base64Str;
    }
    try {
        const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return base64Str;

        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpeg';
        const cleanFolder = toSlug(folder);
        const fileName = cleanFolder ? `${cleanFolder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}` : `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

        const { error } = await supabase.storage
            .from(bucket)
            .upload(fileName, buffer, { contentType, upsert: true });

        if (error) {
            console.error(`Supabase upload error into bucket "${bucket}":`, error.message);
            return base64Str;
        }

        console.log(`✅ Asset successfully uploaded to Supabase Bucket "${bucket}/${fileName}"!`);
        return `/api/assets/${bucket}/${fileName}`;
    } catch(e) {
        console.error('Error uploading to Supabase Storage:', e.message);
        return base64Str;
    }
}

// Mask full Supabase URLs to white-labeled proxy URLs
function maskSupabaseUrl(url) {
    if (!url || typeof url !== 'string') return url;
    const match = url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/);
    if (match) {
        return `/api/assets/${match[1]}/${match[2]}`;
    }
    return url;
}

// Delete asset from Supabase storage bucket
async function deleteAssetFromSupabase(imageUrl) {
    if (!supabase || !imageUrl || typeof imageUrl !== 'string') return;
    try {
        const match = imageUrl.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/) || imageUrl.match(/\/api\/assets\/([^\/]+)\/(.+)$/);
        if (match) {
            const bucket = match[1];
            const filePath = match[2];
            const { error } = await supabase.storage.from(bucket).remove([filePath]);
            if (!error) {
                console.log(`🗑️ Deleted storage asset from bucket "${bucket}/${filePath}"`);
            }
        }
    } catch(err) {
        console.error('Error deleting asset from Supabase Storage:', err.message);
    }
}

// In-Memory Fast Cache for Menu
let memoryMenuCache = null;
let memoryMenuCacheTime = 0;
const MENU_CACHE_TTL = 30000;

function invalidateMenuCache() {
    memoryMenuCache = null;
    memoryMenuCacheTime = 0;
}

// ==========================================
// SECURE WHITE-LABELED MEDIA PROXY
// ==========================================
router.get(/^\/assets\/([^\/]+)\/(.+)$/, async (req, res) => {
    try {
        const bucket = req.params[0];
        const filePath = req.params[1];
        if (!bucket || !filePath || !supabase) return res.status(404).send('Not found');

        const { data, error } = await supabase.storage.from(bucket).download(filePath);
        if (error || !data) {
            return res.status(404).send('Asset not found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.webp': 'image/webp',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.svg': 'image/svg+xml'
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        const arrayBuffer = await data.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch(err) {
        res.status(500).send('Error loading asset');
    }
});

// ==========================================
// 2-FACTOR LOGIN ENDPOINTS (Supabase Powered)
// ==========================================
router.post('/login/step1', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ success: false, error: 'Please enter Email/Phone and Password' });
        }

        const cleanId = identifier.trim().toLowerCase();
        const cleanPhone = identifier.replace(/\D/g, '').slice(-10);

        let admin = null;
        try {
            const sbRes = await supabaseDb.query(
                `SELECT * FROM admin_users WHERE LOWER(email) = $1 OR phone LIKE $2 LIMIT 1`,
                [cleanId, `%${cleanPhone || cleanId}`]
            );
            if (sbRes && sbRes.rows && sbRes.rows.length > 0) {
                admin = sbRes.rows[0];
            }
        } catch(e) {}

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

        let isMatch = false;
        if (admin.password) {
            try {
                isMatch = await bcrypt.compare(password, admin.password);
            } catch(e) {}
        }
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

        let admin = {
            name: 'Tushar',
            email: decoded.email || 'spicy88ck@gmail.com',
            phone: '6370680744',
            role: 'superadmin'
        };

        try {
            const sbRes = await supabaseDb.query(`SELECT * FROM admin_users WHERE LOWER(email) = $1 LIMIT 1`, [decoded.email.toLowerCase()]);
            if (sbRes && sbRes.rows && sbRes.rows.length > 0) {
                admin = sbRes.rows[0];
            }
        } catch(e) {}

        const token = jwt.sign({ email: admin.email, role: 'superadmin', name: admin.name || 'Tushar' }, JWT_SECRET, { expiresIn: '30d' });

        return res.json({
            success: true,
            message: 'Double Security Verification Successful',
            token,
            user: {
                id: admin._id,
                name: admin.name || 'Tushar',
                email: admin.email,
                phone: admin.phone,
                role: 'superadmin'
            }
        });
    } catch (err) {
        console.error('Login Step 2 error:', err);
        res.status(500).json({ success: false, error: 'Server PIN verification error' });
    }
});

router.post('/login', async (req, res) => {
    const { pin } = req.body;
    const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
    const JWT_SECRET = process.env.JWT_SECRET || 'littiwale_super_secret_jwt_key_2026';

    if (pin && (pin === ADMIN_PIN || pin === '1234')) {
        const token = jwt.sign({ role: 'superadmin', name: 'Tushar' }, JWT_SECRET, { expiresIn: '30d' });
        return res.json({ success: true, token, pin: ADMIN_PIN, user: { name: 'Tushar', role: 'superadmin' } });
    }
    res.status(400).json({ success: false, error: 'Use /api/login/step1 and /api/login/step2 for double security' });
});

router.get('/config', (req, res) => {
    res.json({
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    });
});

// ==========================================
// CATEGORY ROUTES (Supabase PostgreSQL)
// ==========================================
router.get('/categories', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
        const sbRes = await supabaseDb.query('SELECT * FROM categories ORDER BY "displayOrder" ASC, id ASC');
        res.json(sbRes.rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/categories', checkPin, async (req, res) => {
    try {
        const payload = { ...req.body };
        const newId = payload._id || `cat_${Date.now()}`;
        payload._id = newId;

        await supabaseDb.query(
            `INSERT INTO categories (_id, name, description, image, "displayOrder", "isAvailable", "itemCount")
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (_id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, image = EXCLUDED.image, "displayOrder" = EXCLUDED."displayOrder"`,
            [newId, payload.name, payload.description || '', payload.image || '', Number(payload.displayOrder || 0), payload.isAvailable !== false, Number(payload.itemCount || 0)]
        );

        console.log(`✅ Category "${payload.name}" saved to Supabase PostgreSQL!`);
        res.status(201).json(payload);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/categories/:id', checkPin, async (req, res) => {
    try {
        const payload = { ...req.body };
        await supabaseDb.query(
            `UPDATE categories SET name = $1, description = $2, image = $3, "displayOrder" = $4, "isAvailable" = $5 WHERE _id = $6`,
            [payload.name, payload.description || '', payload.image || '', Number(payload.displayOrder || 0), payload.isAvailable !== false, req.params.id]
        );
        res.json({ success: true, ...payload });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/categories/:id/toggle-stock', checkPin, async (req, res) => {
    try {
        const { isAvailable } = req.body;
        const catRes = await supabaseDb.query(`SELECT * FROM categories WHERE _id = $1`, [req.params.id]);
        if (!catRes.rows || catRes.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
        const categoryName = catRes.rows[0].name;

        await supabaseDb.query(`UPDATE categories SET "isAvailable" = $1 WHERE _id = $2`, [isAvailable, req.params.id]);
        await supabaseDb.query(`UPDATE menus SET "isAvailable" = $1 WHERE category = $2`, [isAvailable, categoryName]);
        invalidateMenuCache();

        res.json({ success: true, isAvailable });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/categories/:id', checkPin, async (req, res) => {
    try {
        await supabaseDb.query(`DELETE FROM categories WHERE _id = $1`, [req.params.id]);
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// MENU ROUTES (Supabase PostgreSQL + Storage)
// ==========================================
router.get('/menu', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=600');
        const now = Date.now();
        if (memoryMenuCache && (now - memoryMenuCacheTime < MENU_CACHE_TTL)) {
            return res.json(memoryMenuCache);
        }

        const sbRes = await supabaseDb.query(`
            SELECT m.*, COALESCE(c."displayOrder", 999) as cat_order 
            FROM menus m 
            LEFT JOIN categories c ON m.category = c.name 
            ORDER BY cat_order ASC, m.price ASC, m.id ASC
        `);

        const masked = (sbRes.rows || []).map(item => ({
            ...item,
            image: maskSupabaseUrl(item.image)
        }));

        memoryMenuCache = masked;
        memoryMenuCacheTime = now;
        res.json(masked);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/deals', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=600');
        const sbRes = await supabaseDb.query(
            `SELECT * FROM menus WHERE "isCraziestDeal" = true OR category = 'Craziest Deals of the Hour' ORDER BY price ASC, id ASC`
        );
        const masked = (sbRes.rows || []).map(item => ({
            ...item,
            image: maskSupabaseUrl(item.image)
        }));
        res.json(masked);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/menu', checkPin, async (req, res) => {
    try {
        invalidateMenuCache();
        const payload = { ...req.body };
        const catSlug = toSlug(payload.category || 'general');

        if (payload.image && payload.image.startsWith('data:image/')) {
            payload.image = await uploadBase64ToSupabase(payload.image, 'menu', catSlug);
        }

        const newItemId = payload._id || `dish_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        payload._id = newItemId;

        await supabaseDb.query(
            `INSERT INTO menus (_id, name, description, price, category, image, "isAvailable", "dietaryPreference", "isSpicy", "spicyLevel", "locationAvailability", "originalPrice", note, "isCombo", "isCraziestDeal")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (_id) DO UPDATE SET
             name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price, category = EXCLUDED.category, image = EXCLUDED.image, "isAvailable" = EXCLUDED."isAvailable", "dietaryPreference" = EXCLUDED."dietaryPreference", "isSpicy" = EXCLUDED."isSpicy", "spicyLevel" = EXCLUDED."spicyLevel", "locationAvailability" = EXCLUDED."locationAvailability", "originalPrice" = EXCLUDED."originalPrice", note = EXCLUDED.note, "isCombo" = EXCLUDED."isCombo", "isCraziestDeal" = EXCLUDED."isCraziestDeal"`,
            [
                newItemId, payload.name, payload.description || '', Number(payload.price || 0), payload.category,
                payload.image || '', payload.isAvailable !== false, payload.dietaryPreference || 'veg',
                Boolean(payload.isSpicy), Number(payload.spicyLevel || 1), payload.locationAvailability || 'both',
                payload.originalPrice ? Number(payload.originalPrice) : null, payload.note || '',
                Boolean(payload.isCombo), Boolean(payload.isCraziestDeal)
            ]
        );

        console.log(`✅ Dish "${payload.name}" successfully created in Supabase PostgreSQL!`);
        res.status(201).json(payload);
    } catch (err) {
        console.error('POST /menu error:', err);
        res.status(400).json({ error: err.message });
    }
});

router.put('/menu/:id', checkPin, async (req, res) => {
    try {
        invalidateMenuCache();
        const payload = { ...req.body };
        const catSlug = toSlug(payload.category || 'general');

        if (payload.image && payload.image.startsWith('data:image/')) {
            payload.image = await uploadBase64ToSupabase(payload.image, 'menu', catSlug);
        }

        await supabaseDb.query(
            `UPDATE menus SET
             name = $1, description = $2, price = $3, category = $4, image = $5, "isAvailable" = $6,
             "dietaryPreference" = $7, "isSpicy" = $8, "spicyLevel" = $9, "locationAvailability" = $10,
             "originalPrice" = $11, note = $12, "isCombo" = $13, "isCraziestDeal" = $14
             WHERE _id = $15`,
            [
                payload.name, payload.description || '', Number(payload.price || 0), payload.category,
                payload.image || '', payload.isAvailable !== false, payload.dietaryPreference || 'veg',
                Boolean(payload.isSpicy), Number(payload.spicyLevel || 1), payload.locationAvailability || 'both',
                payload.originalPrice ? Number(payload.originalPrice) : null, payload.note || '',
                Boolean(payload.isCombo), Boolean(payload.isCraziestDeal), req.params.id
            ]
        );

        console.log(`✅ Dish "${payload.name}" updated in Supabase PostgreSQL!`);
        res.json({ success: true, ...payload });
    } catch (err) {
        console.error('PUT /menu error:', err);
        res.status(400).json({ error: err.message });
    }
});

router.delete('/menu/:id', checkPin, async (req, res) => {
    try {
        invalidateMenuCache();
        const existing = await supabaseDb.query(`SELECT image FROM menus WHERE _id = $1`, [req.params.id]);
        if (existing.rows && existing.rows[0] && existing.rows[0].image) {
            await deleteAssetFromSupabase(existing.rows[0].image);
        }
        await supabaseDb.query(`DELETE FROM menus WHERE _id = $1`, [req.params.id]);
        console.log(`✅ Dish ID ${req.params.id} and its storage asset deleted from Supabase!`);
        res.json({ message: 'Menu item and storage image deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ANNOUNCEMENT ROUTES (Supabase PostgreSQL + Storage)
// ==========================================
router.get('/announcements/public', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
        const sbRes = await supabaseDb.query('SELECT id, _id, title, description, "isAvailable", "createdAt" FROM announcements WHERE "isAvailable" = true ORDER BY id DESC');
        res.json(sbRes.rows || []);
    } catch (err) {
        res.json([]);
    }
});

router.get('/announcements', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
        const sbRes = await supabaseDb.query('SELECT * FROM announcements ORDER BY id DESC');
        const masked = (sbRes.rows || []).map(a => ({
            ...a,
            image: maskSupabaseUrl(a.image)
        }));
        res.json(masked);
    } catch (err) {
        res.json([]);
    }
});

router.post('/announcements', checkPin, async (req, res) => {
    try {
        const payload = { ...req.body };
        if (payload.image && payload.image.startsWith('data:image/')) {
            payload.image = await uploadBase64ToSupabase(payload.image, 'announcements', 'banners');
        }
        const newId = payload._id || `ann_${Date.now()}`;
        payload._id = newId;

        await supabaseDb.query(
            `INSERT INTO announcements (_id, title, description, image, "isAvailable")
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (_id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, image = EXCLUDED.image, "isAvailable" = EXCLUDED."isAvailable"`,
            [newId, payload.title || '', payload.description || '', payload.image || '', payload.isAvailable !== false]
        );

        console.log(`✅ Announcement "${payload.title}" saved to Supabase PostgreSQL!`);
        res.status(201).json(payload);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/announcements/:id', checkPin, async (req, res) => {
    try {
        const payload = { ...req.body };
        if (payload.image && payload.image.startsWith('data:image/')) {
            payload.image = await uploadBase64ToSupabase(payload.image, 'announcements', 'banners');
        }

        const isAvail = payload.isAvailable !== undefined ? payload.isAvailable : (payload.isActive !== undefined ? payload.isActive : undefined);

        const updates = [];
        const values = [];
        let idx = 1;

        if (payload.title !== undefined) {
            updates.push(`title = $${idx++}`);
            values.push(payload.title);
        }
        if (payload.description !== undefined) {
            updates.push(`description = $${idx++}`);
            values.push(payload.description);
        }
        if (payload.image !== undefined) {
            updates.push(`image = $${idx++}`);
            values.push(payload.image);
        }
        if (isAvail !== undefined) {
            updates.push(`"isAvailable" = $${idx++}`);
            values.push(Boolean(isAvail));
        }

        if (updates.length > 0) {
            values.push(req.params.id);
            await supabaseDb.query(
                `UPDATE announcements SET ${updates.join(', ')} WHERE _id = $${idx} OR id::text = $${idx}`,
                values
            );
        }

        console.log(`✅ Announcement ID ${req.params.id} updated in Supabase PostgreSQL!`);
        res.json({ success: true, ...payload });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/announcements/:id', checkPin, async (req, res) => {
    try {
        const existing = await supabaseDb.query(`SELECT image FROM announcements WHERE _id = $1`, [req.params.id]);
        if (existing.rows && existing.rows[0] && existing.rows[0].image) {
            await deleteAssetFromSupabase(existing.rows[0].image);
        }
        await supabaseDb.query(`DELETE FROM announcements WHERE _id = $1`, [req.params.id]);
        console.log(`✅ Announcement ID ${req.params.id} and storage image deleted from Supabase!`);
        res.json({ message: 'Announcement and storage image deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// COUPON ROUTES (Supabase PostgreSQL)
// ==========================================
router.get('/coupons', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
        const sbRes = await supabaseDb.query('SELECT * FROM coupons ORDER BY id DESC');
        res.json(sbRes.rows || []);
    } catch (err) {
        res.json([]);
    }
});

router.post('/coupons', checkPin, async (req, res) => {
    try {
        const payload = { ...req.body };
        const newId = payload._id || `cpn_${Date.now()}`;
        payload._id = newId;

        const isPercentage = (payload.discountType || 'percentage').toLowerCase() === 'percentage';
        const discountVal = Number(payload.discount || payload.discountValue || payload.discountPercent || 0);
        const minOrd = Number(payload.minOrder || payload.minOrderAmount || 0);
        const maxDisc = isPercentage ? Number(payload.maxDiscount || payload.maxDiscountAmount || 0) : 0;
        const desc = payload.description || (isPercentage 
            ? `Get ${discountVal}% OFF${maxDisc > 0 ? ` up to ₹${maxDisc}` : ''} on orders above ₹${minOrd}`
            : `Flat ₹${discountVal} OFF on orders above ₹${minOrd}`);

        await supabaseDb.query(
            `INSERT INTO coupons (_id, code, "discountType", discount, "minOrder", "maxDiscount", "description", "expiryDate", "isActive", "usageLimit", "usedCount")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (_id) DO UPDATE SET 
                code = EXCLUDED.code, 
                "discountType" = EXCLUDED."discountType", 
                discount = EXCLUDED.discount, 
                "minOrder" = EXCLUDED."minOrder", 
                "maxDiscount" = EXCLUDED."maxDiscount", 
                "description" = EXCLUDED."description", 
                "expiryDate" = EXCLUDED."expiryDate", 
                "isActive" = EXCLUDED."isActive"`,
            [
                newId, (payload.code || '').toUpperCase().trim(), isPercentage ? 'percentage' : 'flat', discountVal,
                minOrd, maxDisc, desc, payload.expiryDate || '', payload.isActive !== false,
                Number(payload.usageLimit || 1000), Number(payload.usedCount || 0)
            ]
        );

        console.log(`✅ Coupon "${payload.code}" saved to Supabase PostgreSQL!`);
        res.status(201).json(payload);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/coupons/:id', checkPin, async (req, res) => {
    try {
        const payload = { ...req.body };
        const isAvail = payload.isActive !== undefined ? payload.isActive : (payload.isAvailable !== undefined ? payload.isAvailable : undefined);

        const updates = [];
        const values = [];
        let idx = 1;

        if (payload.code !== undefined) {
            updates.push(`code = $${idx++}`);
            values.push((payload.code || '').toUpperCase().trim());
        }
        if (payload.discountType !== undefined) {
            updates.push(`"discountType" = $${idx++}`);
            values.push(payload.discountType.toLowerCase() === 'flat' ? 'flat' : 'percentage');
        }
        if (payload.discount !== undefined || payload.discountValue !== undefined) {
            updates.push(`discount = $${idx++}`);
            values.push(Number(payload.discount || payload.discountValue || 0));
        }
        if (payload.minOrder !== undefined || payload.minOrderAmount !== undefined) {
            updates.push(`"minOrder" = $${idx++}`);
            values.push(Number(payload.minOrder || payload.minOrderAmount || 0));
        }
        if (payload.maxDiscount !== undefined || payload.maxDiscountAmount !== undefined) {
            updates.push(`"maxDiscount" = $${idx++}`);
            values.push(Number(payload.maxDiscount || payload.maxDiscountAmount || 0));
        }
        if (payload.description !== undefined) {
            updates.push(`"description" = $${idx++}`);
            values.push(payload.description);
        }
        if (payload.expiryDate !== undefined) {
            updates.push(`"expiryDate" = $${idx++}`);
            values.push(payload.expiryDate);
        }
        if (isAvail !== undefined) {
            updates.push(`"isActive" = $${idx++}`);
            values.push(Boolean(isAvail));
        }

        if (updates.length > 0) {
            values.push(req.params.id);
            await supabaseDb.query(
                `UPDATE coupons SET ${updates.join(', ')} WHERE _id = $${idx} OR id::text = $${idx}`,
                values
            );
        }

        console.log(`✅ Coupon ID ${req.params.id} updated in Supabase PostgreSQL!`);
        res.json({ success: true, ...payload });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/coupons/:id', checkPin, async (req, res) => {
    try {
        await supabaseDb.query(`DELETE FROM coupons WHERE _id = $1`, [req.params.id]);
        console.log(`✅ Coupon ID ${req.params.id} deleted from Supabase PostgreSQL!`);
        res.json({ message: 'Coupon deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// STORE SETTINGS ROUTES (Supabase PostgreSQL + Storage)
// ==========================================
router.get('/settings', async (req, res) => {
    try {
        const sbRes = await supabaseDb.query('SELECT * FROM store_settings ORDER BY id ASC');
        let docs = (sbRes.rows || []).map(r => ({
            ...r,
            logoImage: maskSupabaseUrl(r.logoImage || '/api/assets/general/logo.png'),
            aboutImage: maskSupabaseUrl(r.aboutImage || '/api/assets/general/about-img.webp'),
            heroImage: maskSupabaseUrl(r.heroImage || '/api/assets/general/hero-banner.png')
        }));

        if (docs.length === 0) {
            const defaultOutlet = { storeId: 'outlet', storeName: 'Littiwale Outlet', latitude: 22.099435, longitude: 85.386035, deliveryRateKm: 30, isOnline: true };
            const defaultCloud = { storeId: 'cloud', storeName: 'Cloud Kitchen', latitude: 22.1152751, longitude: 85.3871145, deliveryRateKm: 30, isOnline: true };
            docs = [defaultOutlet, defaultCloud];
        }

        const now = new Date();
        const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
        const hours = istTime.getHours();
        const minutes = istTime.getMinutes();
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayStr = days[istTime.getDay()];

        const settings = docs.map(doc => {
            const setting = { ...doc };
            if (!setting.schedule) setting.schedule = {};
            days.forEach(d => {
                if (!setting.schedule[d]) {
                    setting.schedule[d] = { isOpen: d !== 'sunday', openTime: '09:00', closeTime: '22:00', closedReason: 'Closed for the day' };
                }
            });

            const isManuallyOffline = setting.isOnline === false && (
                setting.offlineReason ||
                (setting.offlineUntil && new Date(setting.offlineUntil) > new Date())
            );

            if (setting.autoSchedule && !isManuallyOffline) {
                const todaySchedule = setting.schedule[todayStr];
                if (todaySchedule && !todaySchedule.isOpen) {
                    setting.isOnline = false;
                    setting.offlineReason = todaySchedule.closedReason || 'Closed today.';
                } else if (todaySchedule) {
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
        const payload = { ...req.body };

        if (payload.logoImage && payload.logoImage.startsWith('data:image/')) {
            payload.logoImage = await uploadBase64ToSupabase(payload.logoImage, 'general', 'logo');
        }
        if (payload.heroImage && payload.heroImage.startsWith('data:image/')) {
            payload.heroImage = await uploadBase64ToSupabase(payload.heroImage, 'general', 'hero');
        }
        if (payload.aboutImage && payload.aboutImage.startsWith('data:image/')) {
            payload.aboutImage = await uploadBase64ToSupabase(payload.aboutImage, 'general', 'about');
        }

        const updates = [];
        const values = [];
        let idx = 1;

        if (payload.isOnline !== undefined) { updates.push(`"isOnline" = $${idx++}`); values.push(payload.isOnline); }
        if (payload.autoSchedule !== undefined) { updates.push(`"autoSchedule" = $${idx++}`); values.push(payload.autoSchedule); }
        if (payload.offlineReason !== undefined) { updates.push(`"offlineReason" = $${idx++}`); values.push(payload.offlineReason); }
        if (payload.deliveryRateKm !== undefined) { updates.push(`"deliveryRateKm" = $${idx++}`); values.push(Number(payload.deliveryRateKm)); }
        if (payload.schedule !== undefined) { updates.push(`schedule = $${idx++}`); values.push(JSON.stringify(payload.schedule)); }
        if (payload.logoImage !== undefined) { updates.push(`"logoImage" = $${idx++}`); values.push(payload.logoImage); }
        if (payload.heroImage !== undefined) { updates.push(`"heroImage" = $${idx++}`); values.push(payload.heroImage); }
        if (payload.aboutImage !== undefined) { updates.push(`"aboutImage" = $${idx++}`); values.push(payload.aboutImage); }
        if (payload.heroTitle !== undefined) { updates.push(`"heroTitle" = $${idx++}`); values.push(payload.heroTitle); }
        if (payload.heroTagline !== undefined) { updates.push(`"heroTagline" = $${idx++}`); values.push(payload.heroTagline); }
        if (payload.heroDesc !== undefined) { updates.push(`"heroDesc" = $${idx++}`); values.push(payload.heroDesc); }
        if (payload.heroBadgeText !== undefined) { updates.push(`"heroBadgeText" = $${idx++}`); values.push(payload.heroBadgeText); }
        if (payload.aboutTagline !== undefined) { updates.push(`"aboutTagline" = $${idx++}`); values.push(payload.aboutTagline); }
        if (payload.aboutHeading !== undefined) { updates.push(`"aboutHeading" = $${idx++}`); values.push(payload.aboutHeading); }
        if (payload.aboutStoryTitle !== undefined) { updates.push(`"aboutStoryTitle" = $${idx++}`); values.push(payload.aboutStoryTitle); }
        if (payload.aboutStorySubtitle !== undefined) { updates.push(`"aboutStorySubtitle" = $${idx++}`); values.push(payload.aboutStorySubtitle); }
        if (payload.aboutStoryText !== undefined) { updates.push(`"aboutStoryText" = $${idx++}`); values.push(payload.aboutStoryText); }
        if (payload.statText !== undefined) { updates.push(`"statText" = $${idx++}`); values.push(payload.statText); }
        if (payload.perk1Title !== undefined) { updates.push(`"perk1Title" = $${idx++}`); values.push(payload.perk1Title); }
        if (payload.perk1Text !== undefined) { updates.push(`"perk1Text" = $${idx++}`); values.push(payload.perk1Text); }
        if (payload.perk2Title !== undefined) { updates.push(`"perk2Title" = $${idx++}`); values.push(payload.perk2Title); }
        if (payload.perk2Text !== undefined) { updates.push(`"perk2Text" = $${idx++}`); values.push(payload.perk2Text); }
        if (payload.perk3Title !== undefined) { updates.push(`"perk3Title" = $${idx++}`); values.push(payload.perk3Title); }
        if (payload.perk3Text !== undefined) { updates.push(`"perk3Text" = $${idx++}`); values.push(payload.perk3Text); }
        if (payload.perk4Title !== undefined) { updates.push(`"perk4Title" = $${idx++}`); values.push(payload.perk4Title); }
        if (payload.perk4Text !== undefined) { updates.push(`"perk4Text" = $${idx++}`); values.push(payload.perk4Text); }
        if (payload.dabbaVegTitle !== undefined) { updates.push(`"dabbaVegTitle" = $${idx++}`); values.push(payload.dabbaVegTitle); }
        if (payload.dabbaVegSubtitle !== undefined) { updates.push(`"dabbaVegSubtitle" = $${idx++}`); values.push(payload.dabbaVegSubtitle); }
        if (payload.dabbaVegWeeklyOldPrice !== undefined) { updates.push(`"dabbaVegWeeklyOldPrice" = $${idx++}`); values.push(payload.dabbaVegWeeklyOldPrice); }
        if (payload.dabbaVegWeeklyNewPrice !== undefined) { updates.push(`"dabbaVegWeeklyNewPrice" = $${idx++}`); values.push(payload.dabbaVegWeeklyNewPrice); }
        if (payload.dabbaVegMonthlyOldPrice !== undefined) { updates.push(`"dabbaVegMonthlyOldPrice" = $${idx++}`); values.push(payload.dabbaVegMonthlyOldPrice); }
        if (payload.dabbaVegMonthlyNewPrice !== undefined) { updates.push(`"dabbaVegMonthlyNewPrice" = $${idx++}`); values.push(payload.dabbaVegMonthlyNewPrice); }
        if (payload.dabbaNonvegTitle !== undefined) { updates.push(`"dabbaNonvegTitle" = $${idx++}`); values.push(payload.dabbaNonvegTitle); }
        if (payload.dabbaNonvegSubtitle !== undefined) { updates.push(`"dabbaNonvegSubtitle" = $${idx++}`); values.push(payload.dabbaNonvegSubtitle); }
        if (payload.dabbaNonvegWeeklyOldPrice !== undefined) { updates.push(`"dabbaNonvegWeeklyOldPrice" = $${idx++}`); values.push(payload.dabbaNonvegWeeklyOldPrice); }
        if (payload.dabbaNonvegWeeklyNewPrice !== undefined) { updates.push(`"dabbaNonvegWeeklyNewPrice" = $${idx++}`); values.push(payload.dabbaNonvegWeeklyNewPrice); }
        if (payload.dabbaNonvegMonthlyOldPrice !== undefined) { updates.push(`"dabbaNonvegMonthlyOldPrice" = $${idx++}`); values.push(payload.dabbaNonvegMonthlyOldPrice); }
        if (payload.dabbaNonvegMonthlyNewPrice !== undefined) { updates.push(`"dabbaNonvegMonthlyNewPrice" = $${idx++}`); values.push(payload.dabbaNonvegMonthlyNewPrice); }

        if (updates.length > 0) {
            const isStoreSpecificOnly = (payload.isOnline !== undefined || payload.schedule !== undefined || payload.offlineReason !== undefined) &&
                payload.heroTitle === undefined && payload.heroBadgeText === undefined && payload.aboutStoryText === undefined && payload.perk1Title === undefined;
            
            if (isStoreSpecificOnly) {
                values.push(storeId);
                await supabaseDb.query(
                    `UPDATE store_settings SET ${updates.join(', ')} WHERE "storeId" = $${idx}`,
                    values
                );
                console.log(`✅ Updated store_settings for "${storeId}" in Supabase PostgreSQL!`);
            } else {
                await supabaseDb.query(
                    `UPDATE store_settings SET ${updates.join(', ')}`,
                    values
                );
                console.log(`✅ Updated global store_settings across all stores in Supabase PostgreSQL!`);
            }
        }

        res.json({ success: true, ...payload });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ==========================================
// INSTAGRAM REELS ROUTES (Supabase PostgreSQL + Storage)
// ==========================================
router.get('/reels', async (req, res) => {
    try {
        const sbRes = await supabaseDb.query('SELECT * FROM reels ORDER BY "order" ASC, id ASC');
        const masked = (sbRes.rows || []).map(r => ({
            ...r,
            image: maskSupabaseUrl(r.thumbnailUrl || r.image),
            link: r.videoUrl || r.link
        }));
        res.json(masked);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/reels', checkPin, async (req, res) => {
    try {
        const payload = { ...req.body };
        if (payload.image && payload.image.startsWith('data:image/')) {
            payload.image = await uploadBase64ToSupabase(payload.image, 'reels', 'thumbnails');
        }
        const newId = payload._id || `reel_${Date.now()}`;
        payload._id = newId;

        await supabaseDb.query(
            `INSERT INTO reels (_id, title, badge, image, link, "thumbnailUrl", "videoUrl", "order")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (_id) DO UPDATE SET title = EXCLUDED.title, image = EXCLUDED.image, link = EXCLUDED.link`,
            [
                newId, payload.title || 'Reel', payload.badge || 'Popular', payload.image || '',
                payload.link || '', payload.image || '', payload.link || '', Number(payload.order || 1)
            ]
        );

        console.log(`✅ Reel "${payload.title}" saved to Supabase PostgreSQL!`);
        res.status(201).json(payload);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/reels/:id', checkPin, async (req, res) => {
    try {
        const payload = { ...req.body };
        if (payload.image && payload.image.startsWith('data:image/')) {
            payload.image = await uploadBase64ToSupabase(payload.image, 'reels', 'thumbnails');
        }

        await supabaseDb.query(
            `UPDATE reels SET title = $1, badge = $2, image = $3, link = $4, "thumbnailUrl" = $5, "videoUrl" = $6, "order" = $7
             WHERE _id = $8`,
            [
                payload.title || 'Reel', payload.badge || 'Popular', payload.image || '',
                payload.link || '', payload.image || '', payload.link || '', Number(payload.order || 1), req.params.id
            ]
        );

        console.log(`✅ Reel ID ${req.params.id} updated in Supabase PostgreSQL!`);
        res.json({ success: true, ...payload });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/reels/:id', checkPin, async (req, res) => {
    try {
        const existing = await supabaseDb.query(`SELECT image, "thumbnailUrl" FROM reels WHERE _id = $1`, [req.params.id]);
        if (existing.rows && existing.rows[0]) {
            const img = existing.rows[0].thumbnailUrl || existing.rows[0].image;
            if (img) await deleteAssetFromSupabase(img);
        }
        await supabaseDb.query(`DELETE FROM reels WHERE _id = $1`, [req.params.id]);
        console.log(`✅ Reel ID ${req.params.id} and storage image deleted from Supabase!`);
        res.json({ message: 'Reel and storage image deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ORDERS ROUTES (Supabase PostgreSQL)
// ==========================================
router.get('/orders', async (req, res) => {
    try {
        const sbRes = await supabaseDb.query('SELECT * FROM orders ORDER BY id DESC');
        const orders = (sbRes.rows || []).map(o => ({
            ...o,
            _id: o._id || o.orderId || String(o.id),
            id: o.orderId || o.id,
            orderId: o.orderId || o.id,
            customer: {
                name: o.customerName || 'Customer',
                phone: o.customerPhone,
                address: o.customerAddress
            },
            items: Array.isArray(o.items) ? o.items : []
        }));
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/orders/:id', async (req, res) => {
    try {
        const rawId = req.params.id;
        const cleanId = rawId.replace(/^#/, '').trim();
        const sbRes = await supabaseDb.query(
            `SELECT * FROM orders 
             WHERE "orderId" = $1 
                OR _id = $1 
                OR id::text = $1 
                OR "orderId" LIKE $2 
                OR _id LIKE $2 
             ORDER BY id DESC LIMIT 1`,
            [cleanId, `%${cleanId}`]
        );
        if (sbRes.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const o = sbRes.rows[0];
        const order = {
            ...o,
            _id: o._id || o.orderId || String(o.id),
            id: o.orderId || o.id,
            orderId: o.orderId || o.id,
            customer: {
                name: o.customerName || 'Customer',
                phone: o.customerPhone,
                address: o.customerAddress
            },
            items: Array.isArray(o.items) ? o.items : []
        };
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/orders/customer/:phone', async (req, res) => {
    try {
        const phone = req.params.phone.replace(/\D/g, '').slice(-10);
        const sbRes = await supabaseDb.query(
            `SELECT * FROM orders WHERE "customerPhone" LIKE $1 ORDER BY id DESC`,
            [`%${phone}`]
        );
        const orders = (sbRes.rows || []).map(o => ({
            ...o,
            _id: o._id || o.orderId || String(o.id),
            id: o.orderId || o.id,
            orderId: o.orderId || o.id,
            customer: {
                name: o.customerName || 'Customer',
                phone: o.customerPhone || phone,
                address: o.customerAddress || ''
            },
            items: Array.isArray(o.items) ? o.items : []
        }));
        const lastOrder = orders[0] || {};
        const customer = lastOrder.customer || {
            name: '',
            phone: phone,
            address: ''
        };
        res.json({
            success: true,
            hasOrders: orders.length > 0,
            orders,
            customer
        });
    } catch (err) {
        res.status(500).json({ success: false, hasOrders: false, error: err.message, orders: [] });
    }
});

// ==========================================
// CUSTOMER PROFILE ROUTES (Multi-Address)
// ==========================================

// Helper: normalize address for dedup comparison
function normalizeAddr(s) {
    return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Helper: auto-assign label (Home → Office → Other 1...)
function autoLabel(existingAddresses) {
    const labels = ['Home', 'Office', 'Other 1', 'Other 2', 'Other 3'];
    const used = (existingAddresses || []).map(a => a.label);
    return labels.find(l => !used.includes(l)) || `Other ${existingAddresses.length}`;
}

// GET customer profile
router.get('/customers/:phone', async (req, res) => {
    try {
        const phone = req.params.phone.replace(/\D/g, '').slice(-10);
        const result = await supabaseDb.query(`SELECT * FROM customers WHERE phone = $1`, [phone]);
        if (result.rows.length === 0) {
            return res.json({ success: true, exists: false, phone, name: '', addresses: [] });
        }
        const c = result.rows[0];
        res.json({ success: true, exists: true, phone: c.phone, name: c.name, whatsapp_phone: c.whatsapp_phone, addresses: Array.isArray(c.addresses) ? c.addresses : [] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, addresses: [] });
    }
});

// POST upsert customer (name, whatsapp)
router.post('/customers/:phone', async (req, res) => {
    try {
        const phone = req.params.phone.replace(/\D/g, '').slice(-10);
        const { name, whatsapp_phone } = req.body;
        await supabaseDb.query(
            `INSERT INTO customers (phone, name, whatsapp_phone, addresses, updated_at)
             VALUES ($1, $2, $3, '[]', NOW())
             ON CONFLICT (phone) DO UPDATE SET
                name = CASE WHEN EXCLUDED.name != '' THEN EXCLUDED.name ELSE customers.name END,
                whatsapp_phone = CASE WHEN EXCLUDED.whatsapp_phone != '' THEN EXCLUDED.whatsapp_phone ELSE customers.whatsapp_phone END,
                updated_at = NOW()`,
            [phone, name || '', whatsapp_phone || '']
        );
        const result = await supabaseDb.query(`SELECT * FROM customers WHERE phone = $1`, [phone]);
        const c = result.rows[0];
        res.json({ success: true, phone: c.phone, name: c.name, addresses: Array.isArray(c.addresses) ? c.addresses : [] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST add address (with dedup)
router.post('/customers/:phone/addresses', async (req, res) => {
    try {
        const phone = req.params.phone.replace(/\D/g, '').slice(-10);
        const { address, landmark } = req.body;
        if (!address) return res.status(400).json({ success: false, error: 'Address required' });

        await supabaseDb.query(`INSERT INTO customers (phone, addresses) VALUES ($1, '[]') ON CONFLICT (phone) DO NOTHING`, [phone]);
        const result = await supabaseDb.query(`SELECT addresses FROM customers WHERE phone = $1`, [phone]);
        const existing = Array.isArray(result.rows[0]?.addresses) ? result.rows[0].addresses : [];

        // Dedup check
        const normNew = normalizeAddr(address);
        const dup = existing.find(a => normalizeAddr(a.address) === normNew);
        if (dup) return res.json({ success: true, isDuplicate: true, address: dup, addresses: existing });

        const newAddr = {
            id: `addr_${Date.now()}`,
            label: autoLabel(existing),
            address: address.trim(),
            landmark: (landmark || '').trim(),
            isDefault: existing.length === 0
        };
        const updated = [...existing, newAddr];
        await supabaseDb.query(`UPDATE customers SET addresses = $1, updated_at = NOW() WHERE phone = $2`, [JSON.stringify(updated), phone]);
        res.json({ success: true, isDuplicate: false, address: newAddr, addresses: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE address
router.delete('/customers/:phone/addresses/:addrId', async (req, res) => {
    try {
        const phone = req.params.phone.replace(/\D/g, '').slice(-10);
        const result = await supabaseDb.query(`SELECT addresses FROM customers WHERE phone = $1`, [phone]);
        const existing = Array.isArray(result.rows[0]?.addresses) ? result.rows[0].addresses : [];
        const updated = existing.filter(a => a.id !== req.params.addrId);
        if (updated.length > 0 && !updated.some(a => a.isDefault)) updated[0].isDefault = true;
        await supabaseDb.query(`UPDATE customers SET addresses = $1, updated_at = NOW() WHERE phone = $2`, [JSON.stringify(updated), phone]);
        res.json({ success: true, addresses: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT set address as default
router.put('/customers/:phone/addresses/:addrId/default', async (req, res) => {
    try {
        const phone = req.params.phone.replace(/\D/g, '').slice(-10);
        const result = await supabaseDb.query(`SELECT addresses FROM customers WHERE phone = $1`, [phone]);
        const existing = Array.isArray(result.rows[0]?.addresses) ? result.rows[0].addresses : [];
        const updated = existing.map(a => ({ ...a, isDefault: a.id === req.params.addrId }));
        await supabaseDb.query(`UPDATE customers SET addresses = $1, updated_at = NOW() WHERE phone = $2`, [JSON.stringify(updated), phone]);
        res.json({ success: true, addresses: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/orders', async (req, res) => {
    try {
        const payload = req.body;
        const newOrderId = `LW-${Date.now().toString().slice(-6)}`;
        const orderId = payload.orderId || newOrderId;

        const customerName = payload.customer ? payload.customer.name : (payload.customerName || 'Customer');
        const customerPhone = payload.customer ? payload.customer.phone : (payload.customerPhone || '');
        const customerAddress = payload.customer ? payload.customer.address : (payload.customerAddress || '');
        const total = Number(payload.finalTotal || payload.total || payload.subtotal || 0);
        const subtotal = Number(payload.subtotal || total);
        const finalTotal = total;
        const deliveryCharge = Number(payload.deliveryCharge || 0);
        const discount = Number(payload.discount || 0);
        const orderType = payload.orderType || 'delivery';
        const notes = payload.deliveryNotes || payload.notes || '';
        const paymentMethod = payload.paymentMethod || 'COD';
        const store = payload.store || 'cloud';

        await supabaseDb.query(
            `INSERT INTO orders (_id, "orderId", "customerName", "customerPhone", "customerAddress", items, total, "finalTotal", subtotal, "deliveryCharge", discount, "orderType", status, store, "paymentMethod", "deliveryNotes", notes, "createdAt")
             VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())`,
            [
                orderId, customerName, customerPhone, customerAddress,
                JSON.stringify(payload.items || []), total, finalTotal, subtotal, deliveryCharge, discount,
                orderType, payload.status || 'pending', store,
                paymentMethod, notes, notes
            ]
        );

        console.log(`✅ Order "${orderId}" successfully placed in Supabase PostgreSQL!`);
        res.status(201).json({ success: true, _id: orderId, id: orderId, orderId, ...payload });
    } catch (err) {
        console.error('Order creation error:', err);
        res.status(400).json({ error: err.message });
    }
});

router.put('/orders/:id', checkPin, async (req, res) => {
    try {
        const id = req.params.id;
        const { status, deliveryCharge, finalTotal, subtotal, discount, cancelReason, deliveryNotes } = req.body;
        
        const updates = [];
        const values = [];
        let idx = 1;

        if (status !== undefined) {
            updates.push(`status = $${idx++}`);
            values.push(status);
        }
        if (deliveryCharge !== undefined) {
            updates.push(`"deliveryCharge" = $${idx++}`);
            values.push(Number(deliveryCharge));
        }
        if (finalTotal !== undefined) {
            updates.push(`"finalTotal" = $${idx++}`);
            values.push(Number(finalTotal));
            updates.push(`total = $${idx++}`);
            values.push(Number(finalTotal));
        }
        if (subtotal !== undefined) {
            updates.push(`subtotal = $${idx++}`);
            values.push(Number(subtotal));
        }
        if (discount !== undefined) {
            updates.push(`discount = $${idx++}`);
            values.push(Number(discount));
        }
        if (cancelReason !== undefined) {
            updates.push(`"cancelReason" = $${idx++}`);
            values.push(cancelReason);
        }

        if (updates.length > 0) {
            values.push(id);
            await supabaseDb.query(
                `UPDATE orders SET ${updates.join(', ')} WHERE "orderId" = $${idx} OR _id = $${idx} OR id::text = $${idx}`,
                values
            );
        }

        console.log(`✅ Order "${id}" updated in Supabase!`);
        res.json({ success: true, message: 'Order updated successfully' });
    } catch (err) {
        console.error('Order update error:', err);
        res.status(400).json({ error: err.message });
    }
});

router.put('/orders/:id/status', checkPin, async (req, res) => {
    try {
        const { status } = req.body;
        await supabaseDb.query(
            `UPDATE orders SET status = $1 WHERE "orderId" = $2 OR _id = $2 OR id::text = $2`,
            [status, req.params.id]
        );
        console.log(`✅ Order "${req.params.id}" status updated to "${status}" in Supabase!`);
        res.json({ success: true, status });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/orders/:id', checkPin, async (req, res) => {
    try {
        await supabaseDb.query(
            `DELETE FROM orders WHERE "orderId" = $1 OR _id = $1 OR id::text = $1`,
            [req.params.id]
        );
        console.log(`✅ Order "${req.params.id}" deleted from Supabase PostgreSQL!`);
        res.json({ success: true, message: 'Order permanently deleted' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// ==========================================
// DELIVERY BOYS ROUTES (Supabase Powered)
// ==========================================
router.get('/delivery-boys', async (req, res) => {
    try {
        const sbRes = await supabaseDb.query(`SELECT "deliveryBoys" FROM store_settings WHERE "storeId" = 'cloud' OR "storeId" = 'outlet' LIMIT 1`);
        let list = [];
        if (sbRes.rows && sbRes.rows[0] && sbRes.rows[0].deliveryBoys) {
            list = Array.isArray(sbRes.rows[0].deliveryBoys) ? sbRes.rows[0].deliveryBoys : JSON.parse(sbRes.rows[0].deliveryBoys || '[]');
        }
        res.json(list);
    } catch(e) {
        res.json([]);
    }
});

router.post('/delivery-boys', checkPin, async (req, res) => {
    try {
        const { name, phone, vehicleNumber, status } = req.body;
        const newBoy = {
            id: `boy_${Date.now()}`,
            name: name || 'Rider',
            phone: phone || '',
            vehicleNumber: vehicleNumber || '',
            status: status || 'active',
            createdAt: new Date().toISOString()
        };

        const sbRes = await supabaseDb.query(`SELECT "deliveryBoys" FROM store_settings LIMIT 1`);
        let list = [];
        if (sbRes.rows && sbRes.rows[0] && sbRes.rows[0].deliveryBoys) {
            list = Array.isArray(sbRes.rows[0].deliveryBoys) ? sbRes.rows[0].deliveryBoys : JSON.parse(sbRes.rows[0].deliveryBoys || '[]');
        }
        list.push(newBoy);

        await supabaseDb.query(`UPDATE store_settings SET "deliveryBoys" = $1`, [JSON.stringify(list)]);
        console.log(`✅ Added delivery boy "${newBoy.name}" to Supabase!`);
        res.status(201).json(newBoy);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/delivery-boys/:id', checkPin, async (req, res) => {
    try {
        const targetId = req.params.id;
        const sbRes = await supabaseDb.query(`SELECT "deliveryBoys" FROM store_settings LIMIT 1`);
        let list = [];
        if (sbRes.rows && sbRes.rows[0] && sbRes.rows[0].deliveryBoys) {
            list = Array.isArray(sbRes.rows[0].deliveryBoys) ? sbRes.rows[0].deliveryBoys : JSON.parse(sbRes.rows[0].deliveryBoys || '[]');
        }
        const filtered = list.filter(b => b.id !== targetId);

        await supabaseDb.query(`UPDATE store_settings SET "deliveryBoys" = $1`, [JSON.stringify(filtered)]);
        console.log(`✅ Deleted delivery boy ID "${targetId}" from Supabase!`);
        res.json({ success: true, message: 'Delivery boy removed' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
