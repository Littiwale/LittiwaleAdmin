/**
 * LITTIWALE 3D THERMAL RECEIPT PRINTER & INVOICE CONTROLLER (ADMIN PANEL)
 * Features: 3D Paper Rollout Animation, Web Audio Thermal Printer Sound FX & Instant Printing
 */

(function() {
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Synthesize realistic thermal printer rolling sound
  function playThermalPrinterSound(durationMs = 2400) {
    try {
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      const duration = durationMs / 1000;

      // 1. Motor hum noise
      const bufferSize = Math.floor(audioCtx.sampleRate * duration);
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(650, now);
      filter.Q.setValueAtTime(4.0, now);

      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.06, now + 0.08);
      gainNode.gain.setValueAtTime(0.06, now + duration - 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      whiteNoise.start(now);
      whiteNoise.stop(now + duration);

      // 2. High-pitch thermal head stepper pulses
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);

      oscGain.gain.setValueAtTime(0.001, now);
      oscGain.gain.linearRampToValueAtTime(0.025, now + 0.05);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(oscGain);
      oscGain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch(e) {
      console.warn('Audio FX not supported:', e);
    }
  }

  // Synthesize paper cutter slice sound
  function playCutterSound() {
    try {
      initAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2400, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.18);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch(e) {}
  }

  // Ensure Receipt Modal is created in DOM
  function ensureReceiptModal() {
    if (document.getElementById('receipt-printer-modal')) return;

    const modalHtml = `
      <div id="receipt-printer-modal" class="receipt-printer-modal" onclick="if(event.target===this) window.closeReceiptPrinterModal()">
        <div class="receipt-printer-modal-content">
          <button type="button" class="receipt-modal-close-btn" onclick="window.closeReceiptPrinterModal()" title="Close">✕</button>

          <!-- 3D Dispenser Stage -->
          <div class="receipt-printer-stage">
            <div class="receipt-machine-unit">
              <!-- Top Hood -->
              <div class="receipt-machine-hood-top">
                <div class="receipt-hood-highlight"></div>
              </div>

              <!-- Slit mouth -->
              <div class="receipt-machine-slit"></div>

              <!-- Cutter Blade Flash -->
              <div id="receipt-cutter-flash" class="receipt-cutter-flash"></div>

              <!-- Bottom Lip -->
              <div class="receipt-machine-hood-bottom"></div>

              <!-- Paper Viewport (Emerges from Slit) -->
              <div class="receipt-paper-viewport">
                <div id="receipt-paper-box" class="receipt-paper-box retracted">
                  <div class="receipt-inner-content" id="receipt-dynamic-content">
                    <!-- Populated dynamically -->
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="receipt-actions-strip" style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; width:100%;">
            <button type="button" class="receipt-btn-primary" onclick="window.openA4InvoiceModal(window.currentAdminPrintedOrderData)" style="background:linear-gradient(135deg, #10b981, #059669); color:#fff; border-color:#059669;" title="Download clean A4 Tax Invoice PDF">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="12" y2="18"></line>
                <line x1="15" y1="15" x2="12" y2="18"></line>
              </svg>
              <span>Download A4 PDF</span>
            </button>

            <button type="button" class="receipt-btn-primary" onclick="window.printReceiptDirectly()" title="Print thermal receipt roll">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              <span>Print Slip</span>
            </button>

            <button type="button" class="receipt-btn-secondary" id="receipt-tear-btn" onclick="window.tearReceiptAction()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
              </svg>
              <span>Tear Slip</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  // Open & Animate Receipt Printer Modal with Order Data
  window.openReceiptPrinterModal = function(orderData) {
    ensureReceiptModal();

    if (typeof orderData === 'string') {
      // Look up by ID from cachedOrders
      const found = (window.cachedOrders || []).find(o => o._id === orderData);
      if (found) orderData = found;
    }

    window.currentAdminPrintedOrderData = orderData;

    if (!orderData) {
      if (typeof window.showAdminToast === 'function') {
        window.showAdminToast('Order details not found.', 'error', 'Invoice Error');
      } else {
        alert('Order details not found.');
      }
      return;
    }

    if (orderData.status === 'pending') {
      if (typeof window.showAdminToast === 'function') {
        window.showAdminToast('Order is still Pending! Please confirm the order first before generating the official bill.', 'warning', 'Order Pending');
      } else {
        alert('Order is still Pending! Please confirm the order first before generating the official bill.');
      }
      return;
    }

    if (orderData.status === 'cancelled') {
      if (typeof window.showAdminToast === 'function') {
        window.showAdminToast('This order was cancelled. Official invoice is not available.', 'error', 'Order Cancelled');
      } else {
        alert('This order was cancelled. Invoice is not available.');
      }
      return;
    }

    const modal = document.getElementById('receipt-printer-modal');
    const paper = document.getElementById('receipt-paper-box');
    const content = document.getElementById('receipt-dynamic-content');
    const tearBtn = document.getElementById('receipt-tear-btn');

    if (!modal || !paper || !content) return;

    // Reset animations
    paper.className = 'receipt-paper-box retracted';
    if (tearBtn) tearBtn.style.display = 'inline-flex';
    const shortId = orderData._id ? String(orderData._id).slice(-6).toUpperCase() : (orderData.shortId || 'LW');
    const isTakeaway = (orderData.orderType === 'takeaway');
    const dateStr = orderData.createdAt ? new Date(orderData.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const custName = orderData.customerName || 'Valued Customer';
    const custPhone = orderData.customerPhone || orderData.whatsappPhone || 'N/A';
    const custAddress = isTakeaway ? '🛍️ Pickup Location: Littiwale Cloud Kitchen, Ward No. 7, Punjabi Para, Barbil' : (orderData.deliveryAddress || orderData.address || 'Barbil');
    const landmark = orderData.landmark ? `<div style="font-size:10px; color:#6b7280;">Landmark: ${orderData.landmark}</div>` : '';
    const paymentMode = orderData.paymentMethod ? String(orderData.paymentMethod).toUpperCase() : (orderData.isCOD ? 'CASH ON DELIVERY (COD)' : 'PAID ONLINE (UPI)');

    const items = orderData.items || [];
    const itemsRows = items.length > 0 ? items.map(item => `
      <tr>
        <td>${item.quantity || 1}x ${item.name || 'Dish Item'}</td>
        <td>₹${Number(item.price || 0) * (item.quantity || 1)}</td>
      </tr>
    `).join('') : `
      <tr>
        <td>1x Authentic Bihari Meal</td>
        <td>₹${orderData.subtotal || orderData.finalTotal || 0}</td>
      </tr>
    `;

    const subtotal = orderData.subtotal || orderData.finalTotal || 0;
    const delivery = isTakeaway ? 0 : Number(orderData.deliveryCharge || orderData.deliveryFee || 0);
    const discount = Number(orderData.discount || orderData.couponDiscount || 0);
    const grandTotal = orderData.finalTotal || (subtotal + delivery - discount);

    // Build Receipt HTML
    content.innerHTML = `
      <!-- Shop Header -->
      <div class="receipt-shop-header">
        <img src="images/logo.png" onerror="this.src='/images/logo.png'" alt="Littiwale" class="receipt-shop-logo-img">
        <div class="receipt-shop-name">LITTIWALE</div>
        <div class="receipt-shop-tagline">Taste of Desi Swag • Cloud Kitchen & Restaurant</div>
        <div class="receipt-shop-address">
          Ward No. 7, Punjabi Para, Barbil, Odisha 758035<br>
          Phone: +91 63706 80744 | support@littiwale.com
        </div>
      </div>

      <!-- Order Meta Grid -->
      <div class="receipt-meta-grid">
        <div class="receipt-meta-label">ORDER ID:</div>
        <div class="receipt-meta-val">#${shortId}</div>

        <div class="receipt-meta-label">DATE & TIME:</div>
        <div class="receipt-meta-val">${dateStr}</div>

        <div class="receipt-meta-label">PAYMENT:</div>
        <div class="receipt-meta-val">${paymentMode}</div>

        <div class="receipt-meta-label">ORDER TYPE:</div>
        <div class="receipt-meta-val">${isTakeaway ? 'TAKEAWAY (SELF PICKUP)' : 'HOME DELIVERY / KOT'}</div>
      </div>

      <!-- Customer Details Box -->
      <div class="receipt-cust-box">
        <div style="font-weight:800; color:#000; margin-bottom:2px;">CUSTOMER: ${custName} (${custPhone})</div>
        <div style="color:#4b5563; font-size:10.5px;">${custAddress}</div>
        ${landmark}
      </div>

      <!-- Ordered Items Table -->
      <table class="receipt-items-table">
        <thead>
          <tr>
            <th>ITEM & QTY</th>
            <th>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <!-- Totals Summary -->
      <div class="receipt-totals-box">
        <div class="receipt-total-row">
          <span>Subtotal</span>
          <span>₹${subtotal}</span>
        </div>
        <div class="receipt-total-row">
          <span>Delivery Charges</span>
          <span>${isTakeaway ? '<strong style="color:#16a34a;">₹0 (Self Pickup)</strong>' : (delivery > 0 ? `₹${delivery}` : '<strong style="color:#16a34a;">FREE</strong>')}</span>
        </div>
        ${discount > 0 ? `
          <div class="receipt-total-row" style="color:#16a34a;">
            <span>Coupon Discount</span>
            <span>-₹${discount}</span>
          </div>
        ` : ''}
        <div class="receipt-grand-total-row">
          <span>TOTAL AMOUNT</span>
          <span>₹${grandTotal}</span>
        </div>
      </div>

      <!-- Footer Greeting & Barcode -->
      <div class="receipt-bottom-footer">
        <div class="receipt-footer-thanks">Swag se banaya, pyaar se khilaya!</div>
        <div style="font-size:10px; color:#6b7280; margin-bottom:8px;">Thank you for ordering with Littiwale Barbil</div>
        <div class="receipt-barcode-wrap">
          <div class="receipt-barcode-bars"></div>
          <div class="receipt-barcode-code">LW-ORD-${shortId}</div>
        </div>
      </div>
    `;

    // Open Modal
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Play Sound & Rollout Animation
    playThermalPrinterSound(2400);
    paper.classList.remove('retracted');
    paper.classList.add('printing-anim');

    setTimeout(() => {
      paper.classList.remove('printing-anim');
      paper.classList.add('printed');
    }, 2400);
  };

  // Close Modal
  window.closeReceiptPrinterModal = function() {
    const modal = document.getElementById('receipt-printer-modal');
    const paper = document.getElementById('receipt-paper-box');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
    if (paper) {
      paper.className = 'receipt-paper-box retracted';
    }
  };

  // 1-Click Print Thermal Receipt
  window.printReceiptDirectly = function() {
    window.print();
  };

  // Dedicated Professional A4 Tax Invoice / PDF Bill Generator for Admin
  window.openA4InvoiceModal = function(orderData) {
    if (typeof orderData === 'string') {
      const found = (window.cachedOrders || []).find(o => o._id === orderData);
      if (found) orderData = found;
    }
    if (!orderData) {
      if (typeof window.showAdminToast === 'function') {
        window.showAdminToast('Order details not found.', 'error', 'Invoice Error');
      } else {
        alert('Order details not found.');
      }
      return;
    }

    if (orderData.status === 'pending') {
      if (typeof window.showAdminToast === 'function') {
        window.showAdminToast('Order is still Pending! Please confirm the order first before generating the official bill.', 'warning', 'Order Pending');
      } else {
        alert('Order is still Pending! Please confirm the order first before generating the official bill.');
      }
      return;
    }

    const shortId = orderData._id ? String(orderData._id).slice(-6).toUpperCase() : (orderData.shortId || 'LW');
    const dateStr = orderData.createdAt ? new Date(orderData.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const custName = orderData.customerName || 'Valued Customer';
    const custPhone = orderData.customerPhone || orderData.whatsappPhone || 'N/A';
    const custAddress = orderData.deliveryAddress || orderData.address || 'Barbil, Odisha';
    const landmark = orderData.landmark ? `<br><span style="font-size:12px; color:#6b7280;">Landmark: ${orderData.landmark}</span>` : '';
    const paymentMode = orderData.paymentMethod ? String(orderData.paymentMethod).toUpperCase() : (orderData.isCOD ? 'CASH ON DELIVERY (COD)' : 'PAID ONLINE (UPI / NETBANKING)');

    const items = orderData.items || [];
    const subtotal = Number(orderData.subtotal || orderData.finalTotal || 0);
    const delivery = Number(orderData.deliveryCharge || orderData.deliveryFee || 0);
    const discount = Number(orderData.discount || orderData.couponDiscount || 0);
    const grandTotal = Number(orderData.finalTotal || (subtotal + delivery - discount));

    const rowsHtml = items.length > 0 ? items.map((it, idx) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 12px; text-align: center; color: #4b5563; font-size: 13px;">${idx + 1}</td>
        <td style="padding: 10px 12px; font-size: 13.5px; font-weight: 600; color: #111827;">
          ${it.name || 'Dish Item'}
          ${it.note ? `<div style="font-size: 11.5px; color: #d97706; font-weight: 500;">${it.note}</div>` : ''}
        </td>
        <td style="padding: 10px 12px; text-align: center; color: #374151; font-size: 13.5px;">${it.quantity || 1}</td>
        <td style="padding: 10px 12px; text-align: right; color: #374151; font-size: 13.5px;">₹${Number(it.price || 0)}</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #111827; font-size: 13.5px;">₹${Number(it.price || 0) * (it.quantity || 1)}</td>
      </tr>
    `).join('') : `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 12px; text-align: center;">1</td>
        <td style="padding: 10px 12px;">Authentic Bihari Meal Package</td>
        <td style="padding: 10px 12px; text-align: center;">1</td>
        <td style="padding: 10px 12px; text-align: right;">₹${subtotal}</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 700;">₹${subtotal}</td>
      </tr>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) {
      alert('Popup blocker prevented invoice from opening. Please allow popups.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Official Bill - #${shortId} - Littiwale</title>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background: #f8fafc;
            color: #1e293b;
            padding: 24px;
            font-size: 13.5px;
            line-height: 1.5;
          }
          .invoice-card {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.06);
            border: 1px solid #e2e8f0;
            padding: 40px;
          }
          .btn-bar {
            max-width: 800px;
            margin: 0 auto 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .btn-print {
            background: #f59e0b;
            color: #000;
            font-weight: 800;
            padding: 10px 24px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-size: 14px;
          }
          .btn-close {
            background: #e2e8f0;
            color: #334155;
            font-weight: 700;
            padding: 10px 18px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
          }
          @media print {
            body { background: #fff; padding: 0; }
            .btn-bar { display: none !important; }
            .invoice-card { border: none !important; box-shadow: none !important; padding: 0 !important; }
          }
        </style>
      </head>
      <body>
        <div class="btn-bar">
          <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
          <button class="btn-close" onclick="window.close()">Close ✕</button>
        </div>

        <div class="invoice-card">
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #f1f5f9; padding-bottom:24px; margin-bottom:24px;">
            <div style="display:flex; align-items:center; gap:16px;">
              <img src="/images/logo.png" onerror="this.src='images/logo.png'" alt="Littiwale" style="width:72px; height:72px; object-fit:contain; border-radius:12px; background:#fff; border:1px solid #fed7aa; padding:4px;">
              <div>
                <h1 style="font-size:24px; font-weight:800; color:#0f172a; letter-spacing:-0.5px; margin-bottom:2px;">LITTIWALE</h1>
                <div style="font-size:12.5px; font-weight:700; color:#d97706; text-transform:uppercase; letter-spacing:1px;">Taste of Desi Swag</div>
                <div style="font-size:12px; color:#64748b; margin-top:3px;">Ward No. 7, Punjabi Para, Barbil, Odisha 758035<br>Phone: +91 63706 80744</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="display:inline-block; background:#fef3c7; color:#92400e; font-weight:800; font-size:12px; padding:4px 12px; border-radius:6px; letter-spacing:1px; margin-bottom:8px;">OFFICIAL BILL / RECEIPT</div>
              <div style="font-size:18px; font-weight:800; color:#0f172a; font-family:monospace;">#${shortId}</div>
              <div style="font-size:12px; color:#64748b; margin-top:2px;">Date: ${dateStr}</div>
            </div>
          </div>

          <!-- Billed To & Order Details -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; background:#f8fafc; border-radius:10px; padding:18px 20px; margin-bottom:24px; border:1px solid #edf2f7;">
            <div>
              <div style="font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:6px;">BILLED TO (CUSTOMER)</div>
              <div style="font-size:14px; font-weight:800; color:#0f172a;">${custName}</div>
              <div style="font-size:12.5px; color:#475569; margin-top:2px;">Mobile: <strong>+91 ${custPhone}</strong></div>
              <div style="font-size:12.5px; color:#475569; margin-top:2px;">${custAddress}${landmark}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:6px;">PAYMENT & ORDER STATUS</div>
              <div style="font-size:13px; font-weight:700; color:#0f172a;">Mode: <span style="color:#059669;">${paymentMode}</span></div>
              <div style="font-size:12.5px; color:#475569; margin-top:2px;">Type: <strong>Delivery</strong></div>
              <div style="font-size:12.5px; color:#059669; font-weight:700; margin-top:4px;">● Order Confirmed by Kitchen</div>
            </div>
          </div>

          <!-- Items Table -->
          <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
            <thead>
              <tr style="background:#0f172a; color:#fff;">
                <th style="padding:12px; text-align:center; font-size:12px; width:40px; border-radius:6px 0 0 6px;">#</th>
                <th style="padding:12px; text-align:left; font-size:12px;">ITEM DESCRIPTION</th>
                <th style="padding:12px; text-align:center; font-size:12px; width:70px;">QTY</th>
                <th style="padding:12px; text-align:right; font-size:12px; width:100px;">RATE</th>
                <th style="padding:12px; text-align:right; font-size:12px; width:110px; border-radius:0 6px 6px 0;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- Financial Breakdown -->
          <div style="display:flex; justify-content:flex-end; margin-bottom:30px;">
            <div style="width:300px;">
              <div style="display:flex; justify-content:space-between; padding:6px 0; color:#475569; font-size:13px;">
                <span>Food Subtotal:</span>
                <span style="font-weight:600; color:#0f172a;">₹${subtotal}</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding:6px 0; color:#475569; font-size:13px;">
                <span>Delivery & Handling:</span>
                <span style="font-weight:600; color:#0f172a;">${delivery > 0 ? `₹${delivery}` : 'FREE (₹0)'}</span>
              </div>
              ${discount > 0 ? `
              <div style="display:flex; justify-content:space-between; padding:6px 0; color:#059669; font-size:13px;">
                <span>Promo Discount:</span>
                <span style="font-weight:700;">-₹${discount}</span>
              </div>` : ''}
              <div style="display:flex; justify-content:space-between; padding:12px 0 8px; border-top:2px solid #0f172a; margin-top:8px; font-size:16px; font-weight:800; color:#0f172a;">
                <span>GRAND TOTAL:</span>
                <span style="color:#d97706;">₹${grandTotal}</span>
              </div>
            </div>
          </div>

          <!-- Official Stamp & Terms -->
          <div style="border-top:1px dashed #cbd5e1; padding-top:20px; display:flex; justify-content:space-between; align-items:flex-end;">
            <div style="font-size:11.5px; color:#64748b; max-width:440px;">
              <strong>Terms & Food Assurance:</strong><br>
              1. Made fresh with authentic spices, cold-pressed mustard oil, and wood-fired heat in Barbil.<br>
              2. 100% Quality & Hygiene Assured. Official restaurant receipt.
            </div>
            <div style="text-align:center; min-width:180px;">
              <div style="font-weight:800; font-size:12px; color:#0f172a; margin-bottom:4px;">For LITTIWALE RESTAURANT</div>
              <div style="display:flex; justify-content:center; align-items:center; height:44px; margin-bottom:2px;">
                <svg width="130" height="42" viewBox="0 0 160 52" fill="none">
                  <path d="M12 28 C 22 10, 36 6, 52 8 C 40 18, 32 36, 30 46 M 22 24 C 34 20, 56 16, 75 22 M 72 32 C 78 24, 86 20, 92 30 C 95 35, 98 42, 102 34 C 106 26, 114 22, 120 30 C 122 36, 126 44, 134 32 C 142 20, 150 14, 158 10 M 80 44 C 104 42, 136 38, 154 36" stroke="#0f172a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div style="font-size:11px; color:#64748b; font-weight:700; border-top:1.5px solid #cbd5e1; padding-top:4px;">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Tear Receipt Physical Animation
  window.tearReceiptAction = function() {
    const paper = document.getElementById('receipt-paper-box');
    const flash = document.getElementById('receipt-cutter-flash');
    const tearBtn = document.getElementById('receipt-tear-btn');

    if (!paper) return;

    playCutterSound();

    if (flash) {
      flash.classList.remove('active');
      void flash.offsetWidth; // trigger reflow
      flash.classList.add('active');
    }

    paper.classList.remove('printed');
    paper.classList.add('torn-anim');

    if (tearBtn) tearBtn.style.display = 'none';

    setTimeout(() => {
      window.closeReceiptPrinterModal();
    }, 900);
  };

})();
