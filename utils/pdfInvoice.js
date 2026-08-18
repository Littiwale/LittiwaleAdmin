const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Generates an A4 PDF Tax Invoice buffer matching the official Littiwale receipt format 1:1.
 * Includes official logo image, restaurant details, customer details, itemized table, and authorized signatory.
 * @param {Object} ord Order data
 * @returns {Promise<Buffer>} PDF Buffer
 */
function generateOrderPdfBuffer(ord) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 36,
                compress: true,
                info: {
                    Title: `Official Bill #${ord.orderId || ord._id || 'Order'}`,
                    Author: 'Littiwale Barbil'
                }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const isTakeaway = String(ord.orderType || '').toLowerCase() === 'takeaway' || String(ord.orderType || '').toLowerCase() === 'pickup';
            const shortId = ord.orderId ? String(ord.orderId).toUpperCase() : (ord._id ? String(ord._id).slice(-6).toUpperCase() : 'LW-ORDER');
            const dateStr = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            const custName = ord.customerName || (ord.customer ? ord.customer.name : 'Valued Customer');
            const custPhone = ord.customerPhone || (ord.customer ? ord.customer.phone : 'N/A');
            const custAddress = isTakeaway ? 'Pickup Location: Littiwale Cloud Kitchen, Ward No. 7, Punjabi Para, Barbil' : (ord.customerAddress || ord.deliveryAddress || ord.address || (ord.customer ? ord.customer.address : 'Barbil, Odisha'));
            const landmark = ord.landmark ? ` (Landmark: ${ord.landmark})` : '';
            const paymentMode = ord.paymentMethod ? String(ord.paymentMethod).toUpperCase() : (ord.isCOD ? 'CASH ON DELIVERY (COD)' : 'PAID ONLINE (UPI / NETBANKING)');

            const subtotal = Number(ord.subtotal || ord.total || 0);
            const delivery = isTakeaway ? 0 : Number(ord.deliveryCharge || ord.deliveryFee || 0);
            const discount = Number(ord.discount || ord.couponDiscount || 0);
            const grandTotal = Number(ord.finalTotal || ord.total || (subtotal + delivery - discount));

            // Outer Card / Border
            doc.roundedRect(36, 36, 523, 770, 8).strokeColor('#e2e8f0').lineWidth(1).stroke();

            // HEADER SECTION: Official Ultra-Compressed Logo Image
            let logoLoaded = false;
            const possibleLogoPaths = [
                path.join(__dirname, '..', 'public', 'images', 'logo-email.png'),
                path.join(__dirname, '..', 'public', 'images', 'logo-email.jpg'),
                path.join(__dirname, '..', 'public', 'images', 'logo.png'),
                path.join(__dirname, '..', '..', 'frontend', 'images', 'logo.png'),
                path.join(process.cwd(), 'public', 'images', 'logo-email.png'),
                path.join(process.cwd(), 'public', 'images', 'logo.png')
            ];

            for (const p of possibleLogoPaths) {
                if (fs.existsSync(p)) {
                    try {
                        doc.image(p, 52, 48, { width: 56, height: 56 });
                        logoLoaded = true;
                        break;
                    } catch(e) {}
                }
            }

            if (!logoLoaded) {
                // Vector fallback badge if image file not on disk
                doc.save();
                doc.circle(80, 76, 26).fill('#ea580c');
                doc.circle(80, 76, 23).strokeColor('#fde047').lineWidth(1.5).stroke();
                doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text('LW', 68, 70, { width: 24, align: 'center' });
                doc.restore();
            }

            // Brand Header Text
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(22).text('LITTIWALE', 120, 48);
            doc.fillColor('#d97706').font('Helvetica-Bold').fontSize(9.5).text('TASTE OF DESI SWAG', 120, 72, { characterSpacing: 1 });
            doc.fillColor('#64748b').font('Helvetica').fontSize(9).text('Ward No. 7, Punjabi Para, Barbil, Odisha 758035 • Ph: +91 63706 80744', 120, 86, { characterSpacing: 0 });

            // Top Right Badge & Invoice Details
            doc.roundedRect(390, 48, 150, 20, 4).fill('#fef3c7');
            doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(8.5).text('OFFICIAL BILL / RECEIPT', 390, 53, { width: 150, align: 'center', characterSpacing: 0.5 });
            
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(15).text(`#${shortId}`, 360, 74, { align: 'right', width: 180 });
            doc.fillColor('#64748b').font('Helvetica').fontSize(9).text(`Date: ${dateStr}`, 360, 92, { align: 'right', width: 180 });

            // Header Divider
            doc.moveTo(52, 114).lineTo(540, 114).strokeColor('#f1f5f9').lineWidth(2).stroke();

            // BILLED TO & PAYMENT STATUS BOX (2 COLUMNS)
            doc.roundedRect(52, 124, 488, 82, 6).fill('#f8fafc');

            // Left Col: Billed To
            doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(8.5).text('BILLED TO (CUSTOMER)', 66, 134, { characterSpacing: 0.5 });
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11.5).text(custName, 66, 147, { characterSpacing: 0 });
            doc.fillColor('#475569').font('Helvetica').fontSize(9).text(`Mobile: +91 ${custPhone}`, 66, 162);
            doc.text(`${custAddress}${landmark}`, 66, 175, { width: 230, ellipsis: true });

            // Right Col: Payment & Order Status
            doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(8.5).text('PAYMENT & ORDER STATUS', 310, 134, { align: 'right', width: 215, characterSpacing: 0.5 });
            doc.fillColor('#475569').font('Helvetica').fontSize(9).text(`Payment: ${paymentMode}`, 310, 147, { align: 'right', width: 215, characterSpacing: 0 });
            doc.fillColor('#475569').font('Helvetica').fontSize(9).text(`Order Type: ${isTakeaway ? 'Takeaway (Self Pickup)' : 'Home Delivery'}`, 310, 161, { align: 'right', width: 215 });
            doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(9).text('[ Verified & Delivered ]', 310, 175, { align: 'right', width: 215 });

            // ITEMS TABLE
            const tableTop = 220;
            doc.rect(52, tableTop, 488, 22).fill('#0f172a');
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
            doc.text('#', 62, tableTop + 6, { width: 20, align: 'center' });
            doc.text('ITEM DESCRIPTION', 90, tableTop + 6);
            doc.text('QTY', 340, tableTop + 6, { width: 35, align: 'center' });
            doc.text('RATE', 390, tableTop + 6, { width: 55, align: 'right' });
            doc.text('AMOUNT', 465, tableTop + 6, { width: 60, align: 'right' });

            // Table Rows
            let y = tableTop + 24;
            const items = Array.isArray(ord.items) && ord.items.length > 0 ? ord.items : [
                { name: 'Authentic Bihari Meal Package', quantity: 1, price: subtotal, subtotal: subtotal }
            ];

            doc.font('Helvetica').fontSize(9.5);
            items.forEach((it, idx) => {
                const qty = Number(it.quantity) || 1;
                const price = Number(it.price) || 0;
                const rowTotal = it.subtotal || (qty * price);

                if (idx % 2 === 1) {
                    doc.rect(52, y, 488, 20).fill('#fafafa');
                }

                doc.fillColor('#64748b').text(String(idx + 1), 62, y + 5, { width: 20, align: 'center' });
                doc.fillColor('#0f172a').font('Helvetica-Bold').text(it.name || 'Dish Item', 90, y + 5, { width: 240 });
                doc.fillColor('#475569').font('Helvetica').text(String(qty), 340, y + 5, { width: 35, align: 'center' });
                doc.text(`Rs. ${price}`, 390, y + 5, { width: 55, align: 'right' });
                doc.fillColor('#0f172a').font('Helvetica-Bold').text(`Rs. ${rowTotal}`, 465, y + 5, { width: 60, align: 'right' });

                doc.moveTo(52, y + 20).lineTo(540, y + 20).strokeColor('#f1f5f9').lineWidth(1).stroke();
                y += 20;
            });

            // TOTALS SECTION
            y += 8;
            const sumX = 330;
            const valX = 445;
            const valW = 80;

            doc.fontSize(9.5).font('Helvetica').fillColor('#475569');
            doc.text('Food Subtotal:', sumX, y);
            doc.fillColor('#0f172a').font('Helvetica-Bold').text(`Rs. ${subtotal}`, valX, y, { width: valW, align: 'right' });
            y += 16;

            doc.font('Helvetica').fillColor('#475569').text('Delivery Fee:', sumX, y);
            doc.fillColor('#0f172a').font('Helvetica-Bold').text(isTakeaway ? 'Rs. 0 (Takeaway)' : (delivery > 0 ? `Rs. ${delivery}` : 'FREE (Rs. 0)'), valX, y, { width: valW, align: 'right' });
            y += 16;

            if (discount > 0) {
                doc.fillColor('#059669').font('Helvetica').text('Coupon Discount:', sumX, y);
                doc.font('Helvetica-Bold').text(`-Rs. ${discount}`, valX, y, { width: valW, align: 'right' });
                y += 16;
            }

            // Grand Total
            doc.moveTo(sumX, y).lineTo(540, y).strokeColor('#0f172a').lineWidth(1.5).stroke();
            y += 6;
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text('GRAND TOTAL:', sumX, y + 2);
            doc.fillColor('#d97706').font('Helvetica-Bold').fontSize(13).text(`Rs. ${grandTotal}`, valX - 10, y + 2, { width: valW + 10, align: 'right' });

            // TERMS & OFFICIAL SIGNATURE STAMP SECTION
            const bottomY = 675;
            doc.moveTo(52, bottomY).lineTo(540, bottomY).strokeColor('#cbd5e1').dash(3, { space: 3 }).stroke();
            doc.undash();

            // Terms (Left)
            doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8.5).text('Terms & Food Assurance:', 52, bottomY + 12);
            doc.font('Helvetica').fontSize(8).fillColor('#64748b');
            doc.text('1. Made fresh with authentic spices, cold-pressed mustard oil & wood-fired heat in Barbil.', 52, bottomY + 26, { width: 310 });
            doc.text('2. 100% Quality & Hygiene Assured. Official restaurant computer-generated tax receipt.', 52, bottomY + 40, { width: 310 });

            // Stamp & Authorized Signature (Right)
            const sigX = 385;
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9.5).text('For LITTIWALE RESTAURANT', sigX, bottomY + 12, { align: 'center', width: 150 });

            // Vector Signature Curve
            doc.save();
            doc.strokeColor('#0f172a').lineWidth(2);
            doc.moveTo(sigX + 20, bottomY + 44)
               .bezierCurveTo(sigX + 35, bottomY + 24, sigX + 50, bottomY + 20, sigX + 65, bottomY + 40)
               .bezierCurveTo(sigX + 80, bottomY + 28, sigX + 95, bottomY + 22, sigX + 110, bottomY + 42)
               .bezierCurveTo(sigX + 120, bottomY + 32, sigX + 130, bottomY + 26, sigX + 140, bottomY + 40)
               .stroke();
            doc.restore();

            // Signature line
            doc.moveTo(sigX + 15, bottomY + 54).lineTo(sigX + 145, bottomY + 54).strokeColor('#cbd5e1').lineWidth(1).stroke();
            doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text('Authorized Signatory', sigX, bottomY + 58, { align: 'center', width: 150 });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generateOrderPdfBuffer };

