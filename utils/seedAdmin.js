const bcrypt = require('bcryptjs');
const AdminUser = require('../models/AdminUser');

async function seedAdminUser() {
    try {
        const email = (process.env.ADMIN_EMAIL || 'spicy88ck@gmail.com').toLowerCase().trim();
        const phone = (process.env.ADMIN_PHONE || '6370680744').replace(/\D/g, '').slice(-10);
        const rawPassword = process.env.ADMIN_PASSWORD || 'littiwale2026';
        const pin = process.env.ADMIN_PIN || '1234';

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(rawPassword, salt);

        let admin = await AdminUser.findOne({ $or: [{ email }, { phone }] });
        if (!admin) {
            admin = new AdminUser({
                email,
                phone,
                password: hashedPassword,
                pin,
                role: 'superadmin',
                name: 'Tushar'
            });
            await admin.save();
            console.log(`✅ Super Admin seeded: ${email} / +91${phone}`);
        } else {
            admin.email = email;
            admin.phone = phone;
            admin.password = hashedPassword;
            admin.pin = pin;
            admin.role = 'superadmin';
            admin.name = 'Tushar';
            await admin.save();
            console.log(`✅ Super Admin credentials verified: ${email} / +91${phone}`);
        }
    } catch(err) {
        console.error('Error seeding admin user:', err.message);
    }
}

module.exports = { seedAdminUser };
