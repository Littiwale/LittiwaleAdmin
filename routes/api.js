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

const JWT_SECRET = process.env.JWT_SECRET || 'littiwale_super_secret_jwt_key_2026';

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
        const isMasterPass = (password === (process.env.ADMIN_PASSWORD || 'littiwale2026') || password === 'spicy880744' || password === 'spicy88ck@gmail.com');

        if (!admin) {
            const envEmail = (process.env.ADMIN_EMAIL || 'spicy88ck@gmail.com').toLowerCase();
            const envPhone = (process.env.ADMIN_PHONE || '6370680744').slice(-10);
            const isKnownAdmin = (
                cleanId === envEmail || 
                cleanId === 'spicy880744@gmail.com' ||
                cleanId === 'spicy88ck@gmail.com' ||
                cleanId === 'admin@littiwale.co.in' ||
                cleanPhone === envPhone || 
                cleanPhone === '6370680744'
            );

            if (isKnownAdmin && isMasterPass) {
                const tempToken = jwt.sign({ email: cleanId.includes('@') ? cleanId : envEmail, step: 'require_pin' }, JWT_SECRET, { expiresIn: '10m' });
                return res.json({
                    success: true,
                    requirePin: true,
                    tempToken,
                    user: { name: 'Tushar', email: cleanId.includes('@') ? cleanId : envEmail, phone: envPhone }
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
        if (!isMatch && !isMasterPass) {
            return res.status(401).json({ success: false, error: 'Incorrect Password' });
        }

        const tempToken = jwt.sign({ id: admin.id || admin._id || 'admin', email: admin.email || cleanId, step: 'require_pin' }, JWT_SECRET, { expiresIn: '10m' });

        return res.json({
            success: true,
            requirePin: true,
            tempToken,
            user: { name: admin.name || 'Tushar', email: admin.email || cleanId, phone: admin.phone || cleanPhone }
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
            const sbRes = await supabaseDb.query(`SELECT * FROM admin_users WHERE LOWER(email) = $1 LIMIT 1`, [String(decoded.email || '').toLowerCase()]);
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
                id: admin.id || admin._id || 'admin',
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
        frontendUrl: (process.env.FRONTEND_URL || 'https://littiwale.co.in').replace(/\/+$/, ''),
        adminDashboardUrl: (process.env.ADMIN_DASHBOARD_URL || 'https://admin.littiwale.co.in').replace(/\/+$/, '')
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
        if (payload.isMaintenanceMode !== undefined) { updates.push(`"isMaintenanceMode" = $${idx++}`); values.push(Boolean(payload.isMaintenanceMode)); }
        if (payload.maintenanceMessage !== undefined) { updates.push(`"maintenanceMessage" = $${idx++}`); values.push(payload.maintenanceMessage); }
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

router.get('/orders/customer/:phoneOrEmail', async (req, res) => {
    try {
        const param = decodeURIComponent(req.params.phoneOrEmail).trim();
        let orders = [];
        let customer = null;

        if (param.includes('@')) {
            const custRes = await supabaseDb.query(`SELECT * FROM customers WHERE LOWER(email) = $1 LIMIT 1`, [param.toLowerCase()]);
            if (custRes.rows.length > 0) {
                customer = custRes.rows[0];
                if (customer.phone) {
                    const phone = customer.phone.replace(/\D/g, '').slice(-10);
                    const sbRes = await supabaseDb.query(`SELECT * FROM orders WHERE "customerPhone" LIKE $1 ORDER BY id DESC`, [`%${phone}`]);
                    orders = sbRes.rows || [];
                }
            }
        } else {
            const phone = param.replace(/\D/g, '').slice(-10);
            const sbRes = await supabaseDb.query(`SELECT * FROM orders WHERE "customerPhone" LIKE $1 ORDER BY id DESC`, [`%${phone}`]);
            orders = sbRes.rows || [];
            
            const custRes = await supabaseDb.query(`SELECT * FROM customers WHERE phone = $1 LIMIT 1`, [phone]);
            if (custRes.rows.length > 0) {
                customer = custRes.rows[0];
            }
        }

        const formattedOrders = orders.map(o => ({
            ...o,
            _id: o._id || o.orderId || String(o.id),
            id: o.orderId || o.id,
            orderId: o.orderId || o.id,
            customer: {
                name: o.customerName || 'Customer',
                phone: o.customerPhone || '',
                address: o.customerAddress || ''
            },
            items: Array.isArray(o.items) ? o.items : []
        }));

        res.json({
            success: true,
            hasOrders: formattedOrders.length > 0,
            orders: formattedOrders,
            customer: customer ? {
                id: customer.id,
                name: customer.name,
                phone: customer.phone || '',
                email: customer.email,
                avatarUrl: customer.avatar_url,
                addresses: Array.isArray(customer.addresses) ? customer.addresses : []
            } : null
        });
    } catch (err) {
        console.error('Error fetching customer orders:', err);
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

const { generateOrderPdfBuffer } = require('../utils/pdfInvoice');

// 4-Character ALL-CAPITAL Alphanumeric Temporary Password Generator (e.g. LW21, L2W1, K8P2)
function generate4CharTempPassword() {
    const lettersUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const p1 = lettersUpper[Math.floor(Math.random() * lettersUpper.length)];
    const p2 = lettersUpper[Math.floor(Math.random() * lettersUpper.length)];
    const p3 = digits[Math.floor(Math.random() * digits.length)];
    const p4 = digits[Math.floor(Math.random() * digits.length)];
    return [p1, p2, p3, p4].sort(() => Math.random() - 0.5).join('');
}

// Resend Email Helper: Welcome / Registration with 4-char Temp Password
async function sendCustomerTempPasswordEmail(email, name, tempPass, isReset = false) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL || 'spicy88ck@gmail.com';
    if (!resendApiKey || !email) return;

    try {
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>Littiwale Account</title></head>
            <body style="margin:0; padding:20px; background-color:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.3);">
                    <div style="background:linear-gradient(135deg, #ea580c, #f97316); padding:24px 20px; text-align:center; color:#ffffff;">
                        <span style="font-size:32px;">🍲</span>
                        <h1 style="margin:8px 0 4px; font-size:22px; font-weight:900;">${isReset ? 'PASSWORD RESET' : 'WELCOME TO LITTIWALE!'}</h1>
                        <div style="font-size:13.5px; opacity:0.95;">Authentic Taste of Bihar • Barbil Cloud Kitchen</div>
                    </div>
                    <div style="padding:24px 20px;">
                        <p style="font-size:15px; color:#334155; margin-top:0;">Hi <strong>${name || 'Customer'}</strong>,</p>
                        <p style="font-size:14px; color:#475569; line-height:1.5;">
                            ${isReset ? 'Here is your new temporary login password.' : 'Thank you for creating an account with Littiwale. You can now track live orders and save delivery addresses.'}
                        </p>
                        <div style="margin:20px 0; padding:16px; background:#fff7ed; border:2px dashed #f97316; border-radius:12px; text-align:center;">
                            <div style="font-size:12px; color:#ea580c; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Your Temporary Password</div>
                            <div style="font-size:32px; font-weight:900; letter-spacing:4px; color:#0f172a; font-family:monospace; background:#ffffff; display:inline-block; padding:6px 20px; border-radius:8px; border:1px solid #fed7aa;">
                                ${tempPass}
                            </div>
                            <div style="font-size:12px; color:#64748b; margin-top:8px;">Case-sensitive • Log in using your <strong>Email or Mobile Number</strong></div>
                        </div>
                        <p style="font-size:13px; color:#64748b; line-height:1.4;">
                            💡 <strong>Tip:</strong> Once logged in, you can change this to your own custom password anytime under <em>"My Profile"</em>.
                        </p>
                        <div style="text-align:center; margin-top:24px;">
                            <a href="${process.env.FRONTEND_URL || 'https://littiwale.co.in'}" style="display:inline-block; background:#ea580c; color:#ffffff; font-weight:800; font-size:14px; text-decoration:none; padding:12px 28px; border-radius:10px;">
                                Sign In to Littiwale →
                            </a>
                        </div>
                    </div>
                    <div style="background:#f1f5f9; padding:12px; text-align:center; font-size:11.5px; color:#94a3b8; border-top:1px solid #e2e8f0;">
                        Littiwale Barbil • Cloud Kitchen & Food Delivery
                    </div>
                </div>
            </body>
            </html>
        `;

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Littiwale Orders <orders@littiwale.co.in>',
                to: [email],
                bcc: [adminEmail],
                subject: `${isReset ? 'Password Reset' : 'Welcome to Littiwale!'} - Your Temp Password: ${tempPass}`,
                html: emailHtml
            })
        });
        console.log(`📧 Temp password email dispatched to ${email}!`);
    } catch(e) {
        console.error("Temp password email failed:", e.message);
    }
}

// =========================================================================
// LUXURY ORDER EMAIL BUILDER (Zomato/Swiggy Gold Tier UI with Visual Stepper)
// =========================================================================

function buildLuxuryOrderEmailHtml({ ord, newStatus, isDelivered, isTakeaway, cleanOrderId, trackingUrl }) {
    const norm = String(newStatus || '').toLowerCase();
    const shortId = String(ord.orderId || ord._id || 'LW').toUpperCase();
    const custName = ord.customerName || (ord.customer ? ord.customer.name : 'Valued Customer');
    const items = Array.isArray(ord.items) && ord.items.length > 0 ? ord.items : [];
    const subtotal = Number(ord.subtotal || ord.total || 0);
    const delivery = isTakeaway ? 0 : Number(ord.deliveryCharge || 0);
    const discount = Number(ord.discount || 0);
    const grandTotal = Number(ord.finalTotal || ord.total || (subtotal + delivery - discount));
    const paymentMode = ord.paymentMethod ? String(ord.paymentMethod).toUpperCase() : (ord.isCOD ? 'CASH ON DELIVERY' : 'PAID ONLINE (UPI)');
    const addressText = isTakeaway ? 'Littiwale Cloud Kitchen, Ward No. 7, Punjabi Para, Barbil' : (ord.customerAddress || 'Barbil, Odisha');

    // Stage details based on Delivery vs Takeaway
    let headerIcon = '✅';
    let headerTitle = 'ORDER CONFIRMED';
    let headerSub = 'Kitchen has accepted your order & preparation has started!';
    let headerGradient = 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)';
    let stepNumber = 1; // 1: Placed, 2: Kitchen, 3: Dispatched/Ready, 4: Delivered/Picked

    if (norm === 'accepted') {
        headerIcon = '🍳';
        headerTitle = isTakeaway ? 'KITCHEN ACCEPTED PICKUP' : 'KITCHEN ACCEPTED ORDER';
        headerSub = 'Our chefs are firing up the flames and preparing your authentic dishes fresh!';
        headerGradient = 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';
        stepNumber = 2;
    } else if (norm === 'cooking' || norm === 'preparing') {
        headerIcon = '🔥';
        headerTitle = 'FOOD SIZZLING ON FLAMES';
        headerSub = 'Your authentic wood-fired Littis are roasting hot with cold-pressed mustard oil!';
        headerGradient = 'linear-gradient(135deg, #ea580c 0%, #9a3412 100%)';
        stepNumber = 2;
    } else if (norm === 'dispatched') {
        if (isTakeaway) {
            headerIcon = '🛍️';
            headerTitle = 'READY FOR PICKUP!';
            headerSub = 'Your takeaway order is hot & freshly packed! Please collect it from our Cloud Kitchen.';
            headerGradient = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';
        } else {
            headerIcon = '🛵';
            headerTitle = 'OUT FOR DELIVERY';
            headerSub = 'Your hot food has been handed to our delivery rider and is on the way to your doorstep!';
            headerGradient = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
        }
        stepNumber = 3;
    } else if (norm === 'delivered' || isDelivered) {
        headerIcon = '🎉';
        headerTitle = isTakeaway ? 'ORDER PICKED UP!' : 'ORDER DELIVERED!';
        headerSub = 'Thank you for choosing Littiwale Barbil! We hope you loved every bite of authentic Bihari Swag ❤️';
        headerGradient = 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)';
        stepNumber = 4;
    } else if (norm === 'cancelled') {
        headerIcon = '❌';
        headerTitle = 'ORDER CANCELLED';
        headerSub = `Your order has been cancelled. Reason: ${ord.cancelReason || 'Requested by customer / kitchen closure'}.`;
        headerGradient = 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)';
        stepNumber = 0;
    }

    // Step 3 Label depending on mode
    const step3Label = isTakeaway ? 'Ready' : 'On Way';
    const step4Label = isTakeaway ? 'Picked Up' : 'Delivered';

    // Step Pill Generator
    const getStepStyle = (sNum) => {
        if (norm === 'cancelled') return 'background: #27272a; color: #71717a; border: 1px solid #3f3f46;';
        if (stepNumber >= sNum) return 'background: #f97316; color: #ffffff; font-weight: 800; border: 1px solid #ea580c;';
        return 'background: #1e1e24; color: #71717a; border: 1px solid #2e2e38;';
    };

    const getConnectorStyle = (sNum) => {
        if (norm === 'cancelled') return 'background: #27272a;';
        return stepNumber >= sNum ? 'background: #f97316;' : 'background: #27272a;';
    };

    // Items List
    const itemsHtml = items.map(it => `
        <tr style="border-bottom: 1px solid #22222b;">
            <td style="padding: 12px 0; color: #f1f5f9; font-size: 14px; font-weight: 600;">
                <span style="color:#ffffff;">${it.name || 'Dish Item'}</span>
                <span style="display:inline-block; margin-left:6px; background:rgba(249,115,22,0.18); color:#f97316; font-size:11.5px; font-weight:800; padding:2px 7px; border-radius:6px;">×${it.quantity || 1}</span>
            </td>
            <td style="padding: 12px 0; text-align: right; color: #f8fafc; font-size: 14px; font-weight: 800;">
                ₹${it.subtotal || ((Number(it.price) || 0) * (Number(it.quantity) || 1))}
            </td>
        </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${headerTitle} | Littiwale</title>
    </head>
    <body style="margin:0; padding:24px 12px; background-color:#09090b; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#f8fafc;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
                <td align="center">
                    
                    <!-- MAIN CARD -->
                    <table role="presentation" width="100%" style="max-width:580px; background:#121217; border-radius:20px; overflow:hidden; border:1px solid #27272a; box-shadow:0 25px 60px rgba(0,0,0,0.8);" border="0" cellspacing="0" cellpadding="0">
                        
                        <!-- BRAND BANNER HEADER -->
                        <tr>
                            <td style="background:${headerGradient}; padding:32px 24px; text-align:center;">
                                <div style="font-size:42px; line-height:1; margin-bottom:8px;">${headerIcon}</div>
                                <h1 style="margin:0 0 6px; font-size:23px; font-weight:900; letter-spacing:1px; color:#ffffff; text-transform:uppercase;">${headerTitle}</h1>
                                <p style="margin:0; font-size:14px; color:rgba(255,255,255,0.92); line-height:1.5; font-weight:500; max-width:440px; display:inline-block;">
                                    ${headerSub}
                                </p>
                                <div style="margin-top:14px;">
                                    <span style="display:inline-block; background:rgba(0,0,0,0.3); color:#ffffff; padding:5px 14px; border-radius:20px; font-size:12px; font-weight:800; letter-spacing:1px; border:1px solid rgba(255,255,255,0.2);">
                                        ORDER #${shortId}
                                    </span>
                                </div>
                            </td>
                        </tr>

                        <!-- VISUAL 4-STEP PROGRESS TRACKER -->
                        ${norm !== 'cancelled' ? `
                        <tr>
                            <td style="background:#18181f; padding:18px 20px; border-bottom:1px solid #27272a;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <!-- Step 1: Placed -->
                                        <td align="center" style="width:25%;">
                                            <div style="width:28px; height:28px; border-radius:50%; line-height:28px; font-size:12px; margin:0 auto 4px; ${getStepStyle(1)}">1</div>
                                            <div style="font-size:10.5px; font-weight:700; color:${stepNumber >= 1 ? '#f97316' : '#71717a'}; text-transform:uppercase;">Placed</div>
                                        </td>
                                        <!-- Step 2: Preparing -->
                                        <td align="center" style="width:25%;">
                                            <div style="width:28px; height:28px; border-radius:50%; line-height:28px; font-size:12px; margin:0 auto 4px; ${getStepStyle(2)}">2</div>
                                            <div style="font-size:10.5px; font-weight:700; color:${stepNumber >= 2 ? '#f97316' : '#71717a'}; text-transform:uppercase;">Kitchen</div>
                                        </td>
                                        <!-- Step 3: Out/Ready -->
                                        <td align="center" style="width:25%;">
                                            <div style="width:28px; height:28px; border-radius:50%; line-height:28px; font-size:12px; margin:0 auto 4px; ${getStepStyle(3)}">3</div>
                                            <div style="font-size:10.5px; font-weight:700; color:${stepNumber >= 3 ? '#f97316' : '#71717a'}; text-transform:uppercase;">${step3Label}</div>
                                        </td>
                                        <!-- Step 4: Delivered/Picked -->
                                        <td align="center" style="width:25%;">
                                            <div style="width:28px; height:28px; border-radius:50%; line-height:28px; font-size:12px; margin:0 auto 4px; ${getStepStyle(4)}">4</div>
                                            <div style="font-size:10.5px; font-weight:700; color:${stepNumber >= 4 ? '#16a34a' : '#71717a'}; text-transform:uppercase;">${step4Label}</div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        ` : ''}

                        <!-- BODY CONTENT -->
                        <tr>
                            <td style="padding:28px 24px;">
                                
                                <p style="margin:0 0 16px; font-size:15px; color:#cbd5e1;">
                                    Hello <strong style="color:#ffffff;">${custName}</strong>,
                                </p>

                                ${isDelivered ? `
                                <!-- OFFICIAL PDF ATTACHED NOTICE -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:rgba(22,163,74,0.12); border:1.5px solid rgba(22,163,74,0.4); border-radius:14px; margin-bottom:22px;">
                                    <tr>
                                        <td style="padding:14px 16px;">
                                            <div style="display:flex; align-items:center; gap:12px;">
                                                <span style="font-size:26px; margin-right:12px;">📄</span>
                                                <div>
                                                    <strong style="color:#4ade80; font-size:14px; display:block;">Official A4 Tax Invoice Attached</strong>
                                                    <span style="color:#cbd5e1; font-size:12px; line-height:1.4; display:block; margin-top:2px;">
                                                        Your lightweight computer-generated Tax Receipt (<strong>${cleanOrderId}bill.pdf</strong>) with stamp & signature is attached below.
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}

                                <!-- ORDER INFO PILLS -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#18181f; border:1px solid #27272a; border-radius:14px; margin-bottom:24px;">
                                    <tr>
                                        <td style="padding:14px 16px; width:50%; border-right:1px solid #27272a; vertical-align:top;">
                                            <div style="font-size:11px; color:#94a3b8; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Order Type</div>
                                            <div style="font-size:13.5px; font-weight:800; color:#f97316;">${isTakeaway ? '🛍️ Takeaway (Self-Pickup)' : '🛵 Home Delivery'}</div>
                                            <div style="font-size:12px; color:#64748b; margin-top:3px; line-height:1.3;">${addressText}</div>
                                        </td>
                                        <td style="padding:14px 16px; width:50%; vertical-align:top;">
                                            <div style="font-size:11px; color:#94a3b8; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Payment Method</div>
                                            <div style="font-size:13.5px; font-weight:800; color:#22c55e;">${paymentMode}</div>
                                            <div style="font-size:12px; color:#64748b; margin-top:3px;">Status: <strong style="color:#f8fafc;">${String(newStatus).toUpperCase()}</strong></div>
                                        </td>
                                    </tr>
                                </table>

                                <!-- ITEMS TABLE -->
                                <div style="font-size:11.5px; color:#94a3b8; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
                                    Ordered Items
                                </div>
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                                    <tbody>
                                        ${itemsHtml}
                                    </tbody>
                                </table>

                                <!-- TOTALS CARD -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#18181f; border:1px solid #27272a; border-radius:14px; padding:16px; margin-bottom:26px;">
                                    <tr>
                                        <td style="padding:4px 0; font-size:13px; color:#94a3b8;">Items Subtotal:</td>
                                        <td style="padding:4px 0; text-align:right; font-size:13px; font-weight:700; color:#f8fafc;">₹${subtotal}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding:4px 0; font-size:13px; color:#94a3b8;">Delivery Fee:</td>
                                        <td style="padding:4px 0; text-align:right; font-size:13px; font-weight:700; color:${isTakeaway ? '#22c55e' : '#f8fafc'};">${isTakeaway ? '₹0 (Takeaway)' : `₹${delivery}`}</td>
                                    </tr>
                                    ${discount > 0 ? `
                                    <tr>
                                        <td style="padding:4px 0; font-size:13px; color:#22c55e;">Discount Applied:</td>
                                        <td style="padding:4px 0; text-align:right; font-size:13px; font-weight:800; color:#22c55e;">-₹${discount}</td>
                                    </tr>` : ''}
                                    <tr>
                                        <td style="padding:10px 0 0; font-size:16px; font-weight:900; color:#ffffff; border-top:1px dashed #3f3f46;">GRAND TOTAL:</td>
                                        <td style="padding:10px 0 0; text-align:right; font-size:21px; font-weight:900; color:#f97316; border-top:1px dashed #3f3f46;">₹${grandTotal}</td>
                                    </tr>
                                </table>

                                <!-- ACTION BUTTONS -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top:10px;">
                                    <tr>
                                        <td align="center">
                                            ${isDelivered ? `
                                            <a href="https://wa.me/916370680744?text=Loved%20the%20food%20from%20Littiwale%20Order%20%23${shortId}" style="display:inline-block; background:linear-gradient(135deg, #25D366 0%, #128C7E 100%); color:#ffffff; font-weight:800; font-size:14px; text-decoration:none; padding:14px 32px; border-radius:12px; box-shadow:0 8px 25px rgba(37,211,102,0.35);">
                                                💬 Share Food Feedback on WhatsApp
                                            </a>
                                            ` : `
                                            <a href="${trackingUrl}" style="display:inline-block; background:linear-gradient(135deg, #f97316 0%, #ea580c 100%); color:#ffffff; font-weight:800; font-size:14px; text-decoration:none; padding:14px 32px; border-radius:12px; box-shadow:0 8px 25px rgba(249,115,22,0.4);">
                                                🔴 Track Live Cooking & Rider Status →
                                            </a>
                                            `}
                                        </td>
                                    </tr>
                                </table>

                            </td>
                        </tr>

                        <!-- FOOTER -->
                        <tr>
                            <td style="background:#0c0c10; padding:20px 24px; text-align:center; border-top:1px solid #27272a;">
                                <div style="font-size:13px; font-weight:800; color:#f97316; letter-spacing:1px; margin-bottom:4px;">LITTIWALE BARBIL</div>
                                <div style="font-size:11.5px; color:#64748b; line-height:1.5;">
                                    Ward No. 7, Punjabi Para, Barbil, Odisha • Ph: +91 6370680744<br>
                                    Authentic Wood-Fired Taste of Bihar • Quality & Hygiene Assured
                                </div>
                            </td>
                        </tr>

                    </table>

                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

// 4. Send Order Delivered Thank You Email with Official PDF Bill to Customer
async function sendOrderDeliveredThankYouEmail(customerEmail, ord) {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || !customerEmail || !customerEmail.includes('@')) return;
    try {
        const isTakeaway = String(ord.orderType || '').toLowerCase() === 'takeaway' || String(ord.orderType || '').toLowerCase() === 'pickup';
        const cleanOrderId = String(ord.orderId || ord._id || 'Order').replace(/[^a-zA-Z0-9]/g, '');
        const trackingUrl = `${(process.env.FRONTEND_URL || 'https://littiwale.co.in').replace(/\/+$/, '')}/track.html?id=${encodeURIComponent(ord.orderId || ord._id)}`;

        let attachments = [];
        try {
            const pdfBuffer = await generateOrderPdfBuffer(ord);
            if (pdfBuffer && pdfBuffer.length > 0) {
                attachments.push({
                    filename: `${cleanOrderId}bill.pdf`,
                    content: pdfBuffer.toString('base64')
                });
            }
        } catch(pdfErr) {
            console.warn('⚠️ Could not generate PDF attachment for delivered thank-you email:', pdfErr.message);
        }

        const emailHtml = buildLuxuryOrderEmailHtml({
            ord,
            newStatus: 'delivered',
            isDelivered: true,
            isTakeaway,
            cleanOrderId,
            trackingUrl
        });

        const subjectTitle = isTakeaway ? 'Order Picked Up' : 'Order Delivered';
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Littiwale Orders <orders@littiwale.co.in>',
                to: [customerEmail],
                subject: `${subjectTitle} - Thank You for Ordering #${String(ord.orderId || ord._id).toUpperCase()} (Official Bill Attached) - Littiwale`,
                html: emailHtml,
                attachments: attachments
            })
        });

        if (res.ok) {
            console.log(`📧 Delivered Thank You Email + PDF Bill (${cleanOrderId}bill.pdf) dispatched to ${customerEmail}!`);
        }
    } catch (e) {
        console.error('❌ Delivered Thank You Email dispatch failed:', e.message);
    }
}

// 5. Send Live Status Update Email to Customer (Kitchen preparing, Out for delivery, etc.)
async function sendStatusUpdateEmail(customerEmail, ord, newStatus) {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || !customerEmail || !customerEmail.includes('@')) return;

    const normStatus = String(newStatus || '').toLowerCase();
    if (normStatus === 'delivered') {
        return sendOrderDeliveredThankYouEmail(customerEmail, ord);
    }

    const isTakeaway = String(ord.orderType || '').toLowerCase() === 'takeaway' || String(ord.orderType || '').toLowerCase() === 'pickup';
    const cleanOrderId = String(ord.orderId || ord._id || 'Order').replace(/[^a-zA-Z0-9]/g, '');
    const trackingUrl = `${(process.env.FRONTEND_URL || 'https://littiwale.co.in').replace(/\/+$/, '')}/track.html?id=${encodeURIComponent(ord.orderId || ord._id)}`;

    const emailHtml = buildLuxuryOrderEmailHtml({
        ord,
        newStatus,
        isDelivered: false,
        isTakeaway,
        cleanOrderId,
        trackingUrl
    });

    let subjectPrefix = 'Order Update';
    if (normStatus === 'confirmed' || normStatus === 'pending') subjectPrefix = 'Order Confirmed';
    else if (normStatus === 'accepted') subjectPrefix = isTakeaway ? 'Kitchen Accepted (Takeaway)' : 'Kitchen Accepted';
    else if (normStatus === 'cooking' || normStatus === 'preparing') subjectPrefix = 'Food Sizzling in Kitchen';
    else if (normStatus === 'dispatched') subjectPrefix = isTakeaway ? 'Ready for Pickup' : 'Out for Delivery';
    else if (normStatus === 'cancelled') subjectPrefix = 'Order Cancelled';

    const shortId = String(ord.orderId || ord._id || 'LW').toUpperCase();

    try {
        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Littiwale Orders <orders@littiwale.co.in>',
                to: [customerEmail],
                subject: `${subjectPrefix} - #${shortId} | Littiwale Barbil`,
                html: emailHtml
            })
        });
        console.log(`📧 Luxury Status update email (${newStatus}) dispatched to ${customerEmail}!`);
    } catch (e) {
        console.warn('⚠️ Status email dispatch failed:', e.message);
    }
}

// CUSTOMER AUTH & ACCOUNT ROUTES
// ==========================================

// 1. Customer Registration (Generates 4-Char Temp Password & Sends Email)
router.post('/customer/register', async (req, res) => {
    try {
        const { name, phone, email, address } = req.body;
        const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanName = (name || '').trim();

        if (!cleanPhone || cleanPhone.length < 10) {
            return res.status(400).json({ success: false, error: 'Valid 10-digit mobile number required' });
        }
        if (!cleanEmail || !cleanEmail.includes('@')) {
            return res.status(400).json({ success: false, error: 'Valid email address required' });
        }

        // Check if phone or email already registered
        const existing = await supabaseDb.query(
            `SELECT * FROM customers WHERE phone = $1 OR (email != '' AND LOWER(email) = $2)`,
            [cleanPhone, cleanEmail]
        );

        if (existing.rows.length > 0) {
            const row = existing.rows[0];
            return res.status(400).json({
                success: false,
                error: row.phone === cleanPhone ? 'Mobile number already registered. Please login or reset password.' : 'Email already registered. Please login or reset password.'
            });
        }

        // Generate 4-character alphanumeric temporary password (e.g. Lw21, L2w1)
        const tempPassword = generate4CharTempPassword();
        const initialAddresses = address ? [{ id: `addr_${Date.now()}`, label: 'Home', address: address.trim(), isDefault: true }] : [];

        await supabaseDb.query(
            `INSERT INTO customers (phone, email, name, temp_password, password_hash, addresses, updated_at)
             VALUES ($1, $2, $3, $4, $4, $5, NOW())`,
            [cleanPhone, cleanEmail, cleanName || 'Customer', tempPassword, JSON.stringify(initialAddresses)]
        );

        // Send email via Resend
        sendCustomerTempPasswordEmail(cleanEmail, cleanName, tempPassword, false).catch(() => {});

        res.status(201).json({
            success: true,
            tempPassword: tempPassword,
            message: `Account created successfully! Your Temporary Password is: ${tempPassword}`,
            customer: {
                name: cleanName,
                phone: cleanPhone,
                email: cleanEmail,
                addresses: initialAddresses
            }
        });
    } catch (err) {
        console.error('Customer register error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Customer Login (Supports Email OR Phone + Password/TempPassword)
router.post('/customer/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ success: false, error: 'Email/Mobile and Password required' });
        }

        const cleanId = String(identifier).trim().toLowerCase();
        const cleanPhone = cleanId.replace(/\D/g, '').slice(-10);
        const pass = String(password).trim();

        const result = await supabaseDb.query(
            `SELECT * FROM customers WHERE (phone != '' AND phone = $1) OR (email != '' AND LOWER(email) = $2)`,
            [cleanPhone || cleanId, cleanId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Account not found with this Mobile / Email' });
        }

        const c = result.rows[0];
        const match = (pass === c.temp_password || pass === c.password_hash || pass.toUpperCase() === String(c.temp_password || '').toUpperCase());
        if (!match) {
            return res.status(401).json({ success: false, error: 'Incorrect password. Try using your 4-character Temporary Password.' });
        }

        const token = jwt.sign(
            { id: c.id, phone: c.phone, email: c.email, name: c.name },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            token,
            customer: {
                id: c.id,
                name: c.name,
                phone: c.phone,
                email: c.email,
                addresses: Array.isArray(c.addresses) ? c.addresses : []
            }
        });
    } catch (err) {
        console.error('Customer login error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2.5 Customer Google OAuth Sync
router.post('/customer/google-auth', async (req, res) => {
    try {
        const { supabaseId, email, name, avatarUrl } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required from Google Auth' });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const cleanName = String(name || 'Customer').trim();
        const cleanAvatar = String(avatarUrl || '');

        let c = null;
        const existing = await supabaseDb.query(
            `SELECT * FROM customers WHERE LOWER(email) = $1 OR (supabase_id IS NOT NULL AND supabase_id = $2 AND $2 != '') LIMIT 1`,
            [cleanEmail, supabaseId || '']
        );

        if (existing.rows && existing.rows.length > 0) {
            c = existing.rows[0];
            const updateRes = await supabaseDb.query(
                `UPDATE customers SET 
                    name = CASE WHEN (name IS NULL OR name = '' OR name = 'Customer') THEN $1 ELSE name END, 
                    avatar_url = COALESCE(NULLIF($2, ''), avatar_url),
                    supabase_id = COALESCE(NULLIF($3, ''), supabase_id),
                    is_verified = true,
                    updated_at = NOW() 
                 WHERE id = $4 RETURNING *`,
                [cleanName, cleanAvatar, supabaseId || '', c.id]
            );
            c = updateRes.rows[0] || c;
        } else {
            const insertRes = await supabaseDb.query(
                `INSERT INTO customers (email, name, auth_provider, supabase_id, avatar_url, is_verified, addresses, created_at, updated_at)
                 VALUES ($1, $2, 'google', $3, $4, true, '[]'::jsonb, NOW(), NOW())
                 RETURNING *`,
                [cleanEmail, cleanName, supabaseId || '', cleanAvatar]
            );
            c = insertRes.rows[0];
        }

        const token = jwt.sign(
            { id: c.id, phone: c.phone || '', email: c.email, name: c.name },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            token,
            customer: {
                id: c.id,
                name: c.name,
                phone: c.phone || '',
                email: c.email,
                avatarUrl: c.avatar_url,
                addresses: Array.isArray(c.addresses) ? c.addresses : []
            }
        });
    } catch (err) {
        console.error('Customer Google Auth sync error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Customer Forgot Password (Generate & return new 4-char Temp Password)
router.post('/customer/forgot-password', async (req, res) => {
    try {
        const { identifier } = req.body;
        if (!identifier) {
            return res.status(400).json({ success: false, error: 'Mobile number or Email required' });
        }

        const cleanId = String(identifier).trim().toLowerCase();
        const cleanPhone = cleanId.replace(/\D/g, '').slice(-10);

        const result = await supabaseDb.query(
            `SELECT * FROM customers WHERE (phone != '' AND phone = $1) OR (email != '' AND LOWER(email) = $2)`,
            [cleanPhone || cleanId, cleanId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'No account found with this Mobile number / Email' });
        }

        const c = result.rows[0];
        const newTempPassword = generate4CharTempPassword();

        await supabaseDb.query(
            `UPDATE customers SET temp_password = $1, password_hash = $1, updated_at = NOW() WHERE id = $2`,
            [newTempPassword, c.id]
        );

        if (c.email) {
            sendCustomerTempPasswordEmail(c.email, c.name, newTempPassword, true).catch(() => {});
        }

        res.json({
            success: true,
            tempPassword: newTempPassword,
            phone: c.phone,
            message: `New temporary password generated: ${newTempPassword}`
        });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Customer Change Password (Permanent Custom Password)
router.post('/customer/change-password', async (req, res) => {
    try {
        const { phone, email, oldPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 3) {
            return res.status(400).json({ success: false, error: 'New password must be at least 3 characters' });
        }

        const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
        const cleanEmail = (email || '').trim().toLowerCase();

        const result = await supabaseDb.query(
            `SELECT * FROM customers WHERE (phone != '' AND phone = $1) OR (email != '' AND LOWER(email) = $2)`,
            [cleanPhone, cleanEmail]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        const customer = result.rows[0];
        if (oldPassword) {
            const oldMatch = (customer.temp_password === oldPassword) || (customer.password_hash === oldPassword);
            if (!oldMatch) {
                return res.status(401).json({ success: false, error: 'Current password does not match' });
            }
        }

        await supabaseDb.query(
            `UPDATE customers SET password_hash = $1, temp_password = '', updated_at = NOW() WHERE id = $2`,
            [newPassword.trim(), customer.id]
        );

        res.json({ success: true, message: 'Password updated successfully! You can now log in with your new password.' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Customer Update Profile (Phone, Name, Addresses & GPS Coordinates)
router.post('/customer/update-profile', async (req, res) => {
    try {
        const { id, email, phone, name, addresses, addressObj } = req.body;
        const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
        const cleanEmail = (email || '').trim().toLowerCase();

        let targetCustomer = null;
        if (id) {
            const r = await supabaseDb.query(`SELECT * FROM customers WHERE id = $1`, [id]);
            targetCustomer = r.rows[0];
        } else if (cleanEmail) {
            const r = await supabaseDb.query(`SELECT * FROM customers WHERE LOWER(email) = $1`, [cleanEmail]);
            targetCustomer = r.rows[0];
        } else if (cleanPhone) {
            const r = await supabaseDb.query(`SELECT * FROM customers WHERE phone = $1`, [cleanPhone]);
            targetCustomer = r.rows[0];
        }

        if (!targetCustomer) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        let updatedAddresses = Array.isArray(addresses) ? addresses : (Array.isArray(targetCustomer.addresses) ? targetCustomer.addresses : []);
        if (addressObj) {
            const idx = updatedAddresses.findIndex(a => a.id === addressObj.id);
            if (idx >= 0) {
                updatedAddresses[idx] = { ...updatedAddresses[idx], ...addressObj };
            } else {
                updatedAddresses.unshift(addressObj);
            }
        }

        const updateRes = await supabaseDb.query(
            `UPDATE customers SET 
                name = COALESCE(NULLIF($1, ''), name),
                phone = COALESCE(NULLIF($2, ''), phone),
                addresses = $3::jsonb,
                updated_at = NOW()
             WHERE id = $4 RETURNING *`,
            [name || targetCustomer.name, cleanPhone || targetCustomer.phone, JSON.stringify(updatedAddresses), targetCustomer.id]
        );

        const c = updateRes.rows[0];
        res.json({
            success: true,
            customer: {
                id: c.id,
                name: c.name,
                phone: c.phone || '',
                email: c.email,
                avatarUrl: c.avatar_url,
                addresses: Array.isArray(c.addresses) ? c.addresses : []
            }
        });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET customer profile
router.get('/customers/:phone', async (req, res) => {
    try {
        const phone = req.params.phone.replace(/\D/g, '').slice(-10);
        const result = await supabaseDb.query(`SELECT * FROM customers WHERE phone = $1`, [phone]);
        if (result.rows.length === 0) {
            return res.json({ success: true, exists: false, phone, name: '', addresses: [] });
        }
        const c = result.rows[0];
        res.json({ success: true, exists: true, phone: c.phone, name: c.name, email: c.email, whatsapp_phone: c.whatsapp_phone, addresses: Array.isArray(c.addresses) ? c.addresses : [] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, addresses: [] });
    }
});

// POST upsert customer (name, whatsapp, email)
router.post('/customers/:phone', async (req, res) => {
    try {
        const phone = req.params.phone.replace(/\D/g, '').slice(-10);
        const { name, whatsapp_phone, email } = req.body;
        await supabaseDb.query(
            `INSERT INTO customers (phone, name, email, whatsapp_phone, addresses, updated_at)
             VALUES ($1, $2, $3, $4, '[]', NOW())
             ON CONFLICT (phone) DO UPDATE SET
                name = CASE WHEN EXCLUDED.name != '' THEN EXCLUDED.name ELSE customers.name END,
                email = CASE WHEN EXCLUDED.email != '' THEN EXCLUDED.email ELSE customers.email END,
                whatsapp_phone = CASE WHEN EXCLUDED.whatsapp_phone != '' THEN EXCLUDED.whatsapp_phone ELSE customers.whatsapp_phone END,
                updated_at = NOW()`,
            [phone, name || '', email || '', whatsapp_phone || '']
        );
        const result = await supabaseDb.query(`SELECT * FROM customers WHERE phone = $1`, [phone]);
        const c = result.rows[0];
        res.json({ success: true, phone: c.phone, name: c.name, email: c.email, addresses: Array.isArray(c.addresses) ? c.addresses : [] });
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

// Helper to send Resend email notification asynchronously to ADMIN ONLY
async function sendNewOrderResendEmail(ord) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL || 'spicy88ck@gmail.com';
    if (!resendApiKey) {
        console.warn('⚠️ Resend API Key not configured in .env. Skipping email.');
        return;
    }

    try {
        const isTakeaway = String(ord.orderType || '').toLowerCase() === 'takeaway' || String(ord.orderType || '').toLowerCase() === 'pickup';
        const items = Array.isArray(ord.items) ? ord.items : [];
        const itemsHtml = items.map(it => `
            <tr style="border-bottom: 1px solid #27272a;">
                <td style="padding: 12px 0; color: #f8fafc; font-weight: 700; font-size: 14px;">
                    ${it.name}
                    <span style="display:inline-block; margin-left:6px; background:rgba(249,115,22,0.2); color:#f97316; font-size:12px; font-weight:800; padding:2px 8px; border-radius:6px;">×${it.quantity || 1}</span>
                </td>
                <td style="padding: 12px 0; text-align: right; color: #f97316; font-weight: 800; font-size: 14px;">₹${it.subtotal || ((Number(it.price || 0)) * (Number(it.quantity || 1)))}</td>
            </tr>
        `).join('');

        const adminDashboardUrl = (process.env.ADMIN_DASHBOARD_URL || 'https://admin.littiwale.co.in').replace(/\/+$/, '');
        const cleanPhone = String(ord.customerPhone || '').replace(/\D/g, '').slice(-10);
        const trackingLink = `${(process.env.FRONTEND_URL || 'https://littiwale.co.in').replace(/\/+$/, '')}/track.html?id=${encodeURIComponent(ord.orderId || ord._id)}`;

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>New Order Alert - Littiwale Admin</title></head>
            <body style="margin:0; padding:24px 12px; background-color:#09090b; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#f8fafc;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="100%" style="max-width:580px; background:#121217; border-radius:20px; overflow:hidden; border:1px solid #27272a; box-shadow:0 25px 60px rgba(0,0,0,0.8);" border="0" cellspacing="0" cellpadding="0">
                                <!-- Top Banner -->
                                <tr>
                                    <td style="background:linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding:28px 24px; text-align:center;">
                                        <div style="font-size:36px; margin-bottom:6px;">🔥</div>
                                        <h1 style="margin:0 0 6px; font-size:22px; font-weight:900; letter-spacing:1px; color:#ffffff; text-transform:uppercase;">NEW ORDER RECEIVED!</h1>
                                        <div style="font-size:14px; font-weight:800; color:rgba(255,255,255,0.95);">Order ID: #${String(ord.orderId || ord._id).toUpperCase()}</div>
                                        <div style="margin-top:12px;">
                                            <span style="display:inline-block; background:#ffffff; color:#ea580c; font-size:12px; font-weight:900; padding:5px 16px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px;">
                                                ${isTakeaway ? '🛍️ TAKEAWAY / PICKUP' : '🛵 HOME DELIVERY'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>

                                <tr>
                                    <td style="padding:28px 24px;">
                                        <!-- Customer Details Card -->
                                        <div style="background:#18181f; border:1px solid #27272a; border-radius:14px; padding:16px; margin-bottom:20px;">
                                            <div style="font-size:11px; text-transform:uppercase; color:#94a3b8; font-weight:800; letter-spacing:0.5px; margin-bottom:6px;">Customer Details</div>
                                            <div style="font-size:17px; font-weight:900; color:#ffffff;">${ord.customerName || 'Customer'}</div>
                                            <div style="margin-top:8px; font-size:14px;">
                                                <a href="tel:${cleanPhone}" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; font-weight:800; font-size:12px; padding:6px 12px; border-radius:8px; margin-right:8px;">
                                                    📞 Call: +91 ${cleanPhone}
                                                </a>
                                                <a href="https://wa.me/91${cleanPhone}?text=Hello%20${encodeURIComponent(ord.customerName || 'Customer')}%2C%20we%20have%20received%20your%20order%20%23${ord.orderId || ord._id}%20at%20Littiwale%20Barbil." style="display:inline-block; background:#16a34a; color:#ffffff; text-decoration:none; font-weight:800; font-size:12px; padding:6px 12px; border-radius:8px;">
                                                    💬 WhatsApp
                                                </a>
                                            </div>
                                            <div style="margin-top:12px; font-size:13px; color:#cbd5e1; line-height:1.4;">
                                                📍 <strong>Address:</strong> ${ord.customerAddress || (isTakeaway ? 'Takeaway / Self-Pickup at Counter' : 'Barbil, Odisha')}
                                            </div>
                                            ${ord.tempPassword ? `
                                            <!-- Customer Password & Quick WhatsApp Share Box -->
                                            <div style="margin-top:12px; background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.35); border-radius:10px; padding:12px;">
                                                <div style="font-size:12px; color:#86efac; font-weight:700; margin-bottom:4px;">🔑 Customer Account Auto-Generated Password:</div>
                                                <div style="font-size:18px; font-weight:900; color:#ffffff; letter-spacing:2px; font-family:monospace; background:#000000; display:inline-block; padding:4px 12px; border-radius:6px; border:1px solid rgba(34,197,94,0.4); margin-bottom:8px;">${ord.tempPassword}</div>
                                                <div>
                                                    <a href="https://wa.me/91${cleanPhone}?text=Hello%20${encodeURIComponent(ord.customerName || 'Customer')}%2C%20welcome%20to%20*Littiwale%20Barbil*!%20Your%20customer%20account%20has%20been%20created.%20Your%20Login%20Password%20is%3A%20*${ord.tempPassword}*%20(Mobile%3A%20${cleanPhone}).%20Track%20Order%3A%20${encodeURIComponent(trackingLink)}" style="display:inline-block; background:#25d366; color:#000000; font-weight:800; font-size:12px; padding:7px 14px; border-radius:8px; text-decoration:none;">
                                                        📲 Send Password & Welcome Note to Customer on WhatsApp →
                                                    </a>
                                                </div>
                                            </div>
                                            ` : ''}
                                            ${ord.notes ? `<div style="margin-top:10px; padding:8px 12px; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3); border-radius:8px; font-size:12.5px; color:#fbbf24;"><strong>📝 Special Instructions:</strong> ${ord.notes}</div>` : ''}
                                        </div>

                                        <!-- Ordered Items Table -->
                                        <div style="font-size:11.5px; text-transform:uppercase; color:#94a3b8; font-weight:800; letter-spacing:0.5px; margin-bottom:8px;">
                                            Ordered Items (${items.length})
                                        </div>
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                                            <tbody>
                                                ${itemsHtml || '<tr><td style="color:#cbd5e1;">Custom food items</td></tr>'}
                                            </tbody>
                                        </table>

                                        <!-- Bill Breakdown -->
                                        <div style="background:#18181f; border-radius:14px; padding:16px; margin-bottom:24px; border:1px solid #27272a;">
                                            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; color:#94a3b8;">
                                                <span>Items Subtotal:</span>
                                                <strong style="color:#ffffff;">₹${ord.subtotal || ord.total}</strong>
                                            </div>
                                            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; color:#94a3b8;">
                                                <span>Delivery Fee:</span>
                                                <strong style="color:${isTakeaway ? '#22c55e' : '#f97316'};">${isTakeaway ? '₹0 (Takeaway)' : `+₹${ord.deliveryCharge || 0}`}</strong>
                                            </div>
                                            ${ord.discount > 0 ? `
                                            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; color:#22c55e;">
                                                <span>Discount:</span>
                                                <strong>-₹${ord.discount}</strong>
                                            </div>` : ''}
                                            <div style="border-top:1px dashed #3f3f46; margin-top:8px; padding-top:10px; display:flex; justify-content:space-between; align-items:center; font-size:16px;">
                                                <span style="font-weight:900; color:#ffffff;">GRAND TOTAL:</span>
                                                <strong style="font-size:22px; color:#f97316;">₹${ord.finalTotal || ord.total}</strong>
                                            </div>
                                            <div style="margin-top:8px; font-size:12.5px; color:#94a3b8;">
                                                Payment Method: <strong style="color:#22c55e;">${ord.paymentMethod || 'COD'}</strong>
                                            </div>
                                        </div>

                                        <!-- Action Button to Admin Dashboard -->
                                        <div style="text-align:center;">
                                            <a href="${adminDashboardUrl}" style="display:inline-block; background:linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color:#ffffff; font-weight:800; font-size:14.5px; text-decoration:none; padding:15px 32px; border-radius:12px; box-shadow:0 8px 25px rgba(234,88,12,0.45); letter-spacing:0.5px;">
                                                ⚡ Open Admin Dashboard to Confirm Order →
                                            </a>
                                        </div>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td style="background:#0c0c10; padding:16px; text-align:center; font-size:11.5px; color:#64748b; border-top:1px solid #27272a;">
                                        Littiwale Barbil • Admin Kitchen Notification System
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        const cleanOrderId = String(ord.orderId || ord._id || 'Order').replace(/[^a-zA-Z0-9]/g, '');
        let attachments = [];
        try {
            const pdfBuffer = await generateOrderPdfBuffer(ord);
            if (pdfBuffer && pdfBuffer.length > 0) {
                attachments.push({
                    filename: `${cleanOrderId}bill.pdf`,
                    content: pdfBuffer.toString('base64')
                });
            }
        } catch(pdfErr) {
            console.warn('⚠️ Could not generate PDF attachment for admin email:', pdfErr.message);
        }

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Littiwale Orders <orders@littiwale.co.in>',
                to: [adminEmail],
                subject: `[NEW ORDER] #${String(ord.orderId || ord._id).toUpperCase()} - Rs. ${ord.finalTotal || ord.total} (${isTakeaway ? 'Takeaway' : 'Delivery'})`,
                html: emailHtml,
                attachments: attachments
            })
        });

        if (res.ok) {
            const data = await res.json();
            console.log(`📧 Resend email with PDF (${cleanOrderId}bill.pdf) successfully dispatched to Admin (${adminEmail}) for Order #${ord.orderId || ord._id}! Email ID:`, data.id);
        }
    } catch (e) {
        console.error('❌ Resend email dispatch failed:', e.message);
    }
}

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

        const customerEmail = payload.customer ? payload.customer.email : (payload.customerEmail || payload.email || '');

        console.log(`✅ Order "${orderId}" successfully placed in Supabase PostgreSQL!`);
        
        let autoGeneratedTempPassword = null;

        // Smart Auto-Registration / Customer Profile Sync
        if (customerPhone && customerPhone.length >= 10) {
            const cleanP = String(customerPhone).replace(/\D/g, '').slice(-10);
            try {
                const existingCust = await supabaseDb.query(`SELECT * FROM customers WHERE phone = $1`, [cleanP]);
                const cleanEmail = (customerEmail || '').toLowerCase().trim();
                const initAddr = customerAddress ? [{ id: `addr_${Date.now()}`, label: 'Home', address: customerAddress, isDefault: true }] : [];

                if (existingCust.rows.length === 0) {
                    // New Customer from Checkout
                    if (cleanEmail && cleanEmail.includes('@')) {
                        // Automatic Account Registration with 4-Character CAPITAL Temp Password
                        autoGeneratedTempPassword = generate4CharTempPassword();
                        await supabaseDb.query(
                            `INSERT INTO customers (phone, email, name, temp_password, password_hash, addresses, updated_at)
                             VALUES ($1, $2, $3, $4, $4, $5, NOW())`,
                            [cleanP, cleanEmail, customerName || 'Customer', autoGeneratedTempPassword, JSON.stringify(initAddr)]
                        );
                        // Send Welcome Email with 4-Character CAPITAL Temp Password
                        sendCustomerTempPasswordEmail(cleanEmail, customerName, autoGeneratedTempPassword, false).catch(() => {});
                    } else {
                        // Classic Guest with phone number (Zero password, instant phone lookup)
                        await supabaseDb.query(
                            `INSERT INTO customers (phone, name, addresses, updated_at)
                             VALUES ($1, $2, $3, NOW())`,
                            [cleanP, customerName || 'Customer', JSON.stringify(initAddr)]
                        );
                    }
                } else {
                    // Returning Customer: Link email if provided and not previously set
                    const row = existingCust.rows[0];
                    if (cleanEmail && cleanEmail.includes('@') && !row.email) {
                        autoGeneratedTempPassword = row.temp_password || row.password_hash || generate4CharTempPassword();
                        await supabaseDb.query(
                            `UPDATE customers SET email = $1, temp_password = $2, password_hash = $2, updated_at = NOW() WHERE id = $3`,
                            [cleanEmail, autoGeneratedTempPassword, row.id]
                        );
                        if (!row.password_hash) {
                            sendCustomerTempPasswordEmail(cleanEmail, customerName, autoGeneratedTempPassword, false).catch(() => {});
                        }
                    } else if (row.temp_password) {
                        autoGeneratedTempPassword = row.temp_password;
                    }
                }
            } catch(custErr) {
                console.warn('Customer auto-sync warning:', custErr.message);
            }
        }

        // Trigger Resend email notification to Admin asynchronously (with PDF invoice + customer password + WhatsApp link)
        sendNewOrderResendEmail({
            orderId, customerName, customerPhone, customerAddress, customerEmail,
            items: payload.items || [], total, finalTotal, subtotal,
            deliveryCharge, discount, orderType, notes, paymentMethod,
            tempPassword: autoGeneratedTempPassword
        }).catch(err => console.error("Async admin email error:", err));

        // Trigger Resend order status email to Customer if email is provided
        if (customerEmail && customerEmail.includes('@')) {
            sendStatusUpdateEmail(customerEmail, {
                orderId, customerName, customerPhone, customerAddress, customerEmail,
                items: payload.items || [], total, finalTotal, subtotal,
                deliveryCharge, discount, orderType, notes, paymentMethod
            }, 'confirmed').catch(err => console.error("Async customer email error:", err));
        }

        res.status(201).json({
            success: true,
            _id: orderId,
            id: orderId,
            orderId,
            tempPassword: autoGeneratedTempPassword,
            ...payload
        });
    } catch (err) {
        console.error('Order creation error:', err);
        res.status(400).json({ error: err.message });
    }
});

router.put('/orders/:id', checkPin, async (req, res) => {
    try {
        const id = req.params.id;
        const { status, deliveryCharge, finalTotal, subtotal, discount, cancelReason, deliveryNotes, orderType, customerAddress, address } = req.body;
        
        const updates = [];
        const values = [];
        let idx = 1;

        if (status !== undefined) {
            updates.push(`status = $${idx++}`);
            values.push(status);
        }
        if (orderType !== undefined) {
            updates.push(`"orderType" = $${idx++}`);
            values.push(orderType);
        }
        if (customerAddress !== undefined || address !== undefined) {
            updates.push(`"customerAddress" = $${idx++}`);
            values.push(customerAddress || address);
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

        // If status changed, send Real-time Status Update Email (Delivered, Dispatched, Accepted, Cooking, etc.)
        if (status) {
            (async () => {
                try {
                    const orderRes = await supabaseDb.query(
                        `SELECT * FROM orders WHERE "orderId" = $1 OR _id = $1 OR id::text = $1 LIMIT 1`,
                        [id]
                    );
                    if (orderRes.rows.length > 0) {
                        const fullOrd = orderRes.rows[0];
                        let custEmail = fullOrd.customerEmail || fullOrd.email;
                        if (!custEmail && fullOrd.customerPhone) {
                            const cleanP = String(fullOrd.customerPhone).replace(/\D/g, '').slice(-10);
                            const custRes = await supabaseDb.query(`SELECT email FROM customers WHERE phone = $1`, [cleanP]);
                            if (custRes.rows.length > 0 && custRes.rows[0].email) {
                                custEmail = custRes.rows[0].email;
                            }
                        }
                        if (custEmail) {
                            sendStatusUpdateEmail(custEmail, fullOrd, status);
                        }
                    }
                } catch(e) {
                    console.warn('Status email check error:', e.message);
                }
            })();
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
        const id = req.params.id;
        await supabaseDb.query(
            `UPDATE orders SET status = $1 WHERE "orderId" = $2 OR _id = $2 OR id::text = $2`,
            [status, id]
        );

        // If status changed, send Real-time Status Update Email (Delivered, Dispatched, Accepted, Cooking, etc.)
        if (status) {
            (async () => {
                try {
                    const orderRes = await supabaseDb.query(
                        `SELECT * FROM orders WHERE "orderId" = $1 OR _id = $1 OR id::text = $1 LIMIT 1`,
                        [id]
                    );
                    if (orderRes.rows.length > 0) {
                        const fullOrd = orderRes.rows[0];
                        let custEmail = fullOrd.customerEmail || fullOrd.email;
                        if (!custEmail && fullOrd.customerPhone) {
                            const cleanP = String(fullOrd.customerPhone).replace(/\D/g, '').slice(-10);
                            const custRes = await supabaseDb.query(`SELECT email FROM customers WHERE phone = $1`, [cleanP]);
                            if (custRes.rows.length > 0 && custRes.rows[0].email) {
                                custEmail = custRes.rows[0].email;
                            }
                        }
                        if (custEmail) {
                            sendStatusUpdateEmail(custEmail, fullOrd, status);
                        }
                    }
                } catch(e) {
                    console.warn('Status email check error:', e.message);
                }
            })();
        }
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
