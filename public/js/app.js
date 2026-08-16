const API_URL = '/api';
let authPin = localStorage.getItem('adminPin') || '';
let authToken = localStorage.getItem('adminToken') || '';
var adminReelsList = [];
var adminDealsList = [];
window.cachedMenuItems = [];
window.cachedCategories = [];
window.cachedAnnouncements = [];
window.cachedCoupons = [];
window.cachedStoreSettings = [];

function loadMenu() {
    return fetchAndRenderMenu();
}

// =======================
// GLOBAL MODAL CONTROLLERS
// =======================
window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('active');
    modal.style.display = 'flex';
    
    if (modalId === 'menu-modal') {
        const title = document.getElementById('menu-modal-title');
        if (title && !document.getElementById('menu-id').value) title.textContent = 'Add Menu Item';
        if (typeof updateCategoryFilterOptions === 'function') updateCategoryFilterOptions();
        if (typeof updateLivePreview === 'function') updateLivePreview();
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('active');
    modal.style.display = 'none';
};

window.openMenuModal = function(item = null) {
    if (item) {
        window.editMenu(item._id || item);
    } else {
        const form = document.getElementById('menu-form');
        if (form) form.reset();
        document.getElementById('menu-id').value = '';
        document.getElementById('menu-modal-title').textContent = 'Add Menu Item';
        currentBase64Image = '';
        const previewDiv = document.getElementById('menu-image-preview');
        if (previewDiv) {
            previewDiv.innerHTML = '';
            previewDiv.style.display = 'none';
        }
        const imgPrev = document.getElementById('lw-preview-img');
        const placeholder = document.getElementById('lw-preview-placeholder');
        if (imgPrev) imgPrev.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        
        window.updateLivePreview();
        window.openModal('menu-modal');
    }
};

// =======================
// GLOBAL TOAST NOTIFICATIONS & CONFIRM DIALOG
// =======================
window.showAdminToast = function(message, type = 'success', title = '') {
    let container = document.getElementById('admin-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'admin-toast-container';
        document.body.appendChild(container);
    }
    
    container.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;
    
    let defaultIcon = '✅';
    let defaultTitle = 'Success';
    if (type === 'error') {
        defaultIcon = '❌';
        defaultTitle = 'Error';
    } else if (type === 'warning') {
        defaultIcon = '⚠️';
        defaultTitle = 'Notice';
    } else if (type === 'info') {
        defaultIcon = 'ℹ️';
        defaultTitle = 'Information';
    }

    toast.innerHTML = `
        <div class="toast-icon">${defaultIcon}</div>
        <div class="toast-content">
            <div class="toast-title">${title || defaultTitle}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(15px) scale(0.95)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
};

window.showConfirm = function(title, message, btnText = 'Confirm', isDanger = true) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        if (!modal) {
            return resolve(confirm(message || title));
        }
        
        document.getElementById('confirm-title').textContent = title || 'Confirm Action';
        document.getElementById('confirm-message').textContent = message || 'Are you sure you want to proceed?';
        
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');
        
        if (okBtn) {
            okBtn.textContent = btnText;
            okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
        }
        
        const cleanup = () => {
            window.closeModal('confirm-modal');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
        };
        
        okBtn.onclick = () => {
            cleanup();
            resolve(true);
        };
        
        cancelBtn.onclick = () => {
            cleanup();
            resolve(false);
        };
        
        window.openModal('confirm-modal');
    });
};


// =======================
// UNIVERSAL CLIENT-SIDE WEBP AUTO-COMPRESSOR
// =======================
window.compressImageToWebP = function(file, maxWidth = 800, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve('');
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert automatically to lightweight WebP format
                const webpDataUrl = canvas.toDataURL('image/webp', quality);
                resolve(webpDataUrl);
            };
            img.onerror = (err) => resolve(event.target.result);
            img.src = event.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const pinInput = document.getElementById('pin-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const navItems = document.querySelectorAll('.nav-item');
const tabSections = document.querySelectorAll('.tab-section');

// Initialize App
function init() {
    // Sync header profile name
    try {
        const storedUser = localStorage.getItem('adminUser');
        const nameEl = document.querySelector('.header-profile-name');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            if (nameEl) nameEl.textContent = (user.name || 'Tushar').replace(/\s*\(Super Admin\)/i, '');
        } else {
            if (nameEl) nameEl.textContent = 'Tushar';
        }
    } catch(e) {}

    if (authToken || authPin) {
        showDashboard();
        fetchData();
    } else {
        showLogin();
    }
}

// =======================
// GLOBAL SEARCH CONTROLLER
// =======================
window.handleGlobalSearch = function(e) {
    const query = (e.target.value || '').trim().toLowerCase();
    const dropdown = document.getElementById('global-search-results');
    if (!dropdown) return;

    if (!query) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        return;
    }

    const results = [];

    // 1. Search Sections / Pages
    const sections = [
        { name: 'Dashboard Overview', icon: '📊', sectionId: 'dashboard-section' },
        { name: 'Menu Catalog (151 Dishes)', icon: '🍱', sectionId: 'menu-section' },
        { name: 'Live Orders Management', icon: '🛍️', sectionId: 'orders-section' },
        { name: 'Finance & Online Revenue', icon: '💰', sectionId: 'finance-section' },
        { name: 'Analytics & Reports', icon: '📈', sectionId: 'analytics-section' },
        { name: 'Store Opening Hours & Delivery', icon: '⏰', sectionId: 'settings-section' },
        { name: 'Discount Coupons & Promos', icon: '🏷️', sectionId: 'coupons-section' },
        { name: 'Media Library Gallery', icon: '🖼️', sectionId: 'media-library-section' },
        { name: 'Website Hero Section CMS', icon: '✨', sectionId: 'media-section', tab: 'hero-tab' },
        { name: 'About Us Story CMS', icon: 'ℹ️', sectionId: 'media-section', tab: 'about-tab' },
        { name: 'Social Reels & Instagram CMS', icon: '📱', sectionId: 'media-section', tab: 'reels-tab' },
        { name: 'Craziest Deals CMS', icon: '🔥', sectionId: 'media-section', tab: 'deals-tab' },
        { name: 'Announcements Banner CMS', icon: '📢', sectionId: 'media-section', tab: 'announcements-tab' }
    ];

    sections.forEach(s => {
        if (s.name.toLowerCase().includes(query)) {
            results.push({
                type: 'Section',
                title: s.name,
                subtitle: 'Navigation Jump',
                icon: s.icon,
                action: () => {
                    window.switchSection(s.sectionId);
                    if (s.tab && typeof window.switchToCmsTab === 'function') window.switchToCmsTab(s.tab);
                    dropdown.style.display = 'none';
                    e.target.value = '';
                }
            });
        }
    });

    // 2. Search Dishes
    const dishes = window.cachedMenuItems || [];
    dishes.forEach(dish => {
        const dishName = dish.name || '';
        const category = dish.category || '';
        if (dishName.toLowerCase().includes(query) || category.toLowerCase().includes(query)) {
            results.push({
                type: 'Dish',
                title: dishName,
                subtitle: `₹${dish.price} • ${category} • ${dish.isPureVeg ? '🟢 Veg' : '🔴 Non-Veg'}`,
                icon: '🍲',
                action: () => {
                    window.switchSection('menu-section');
                    if (typeof openMenuModal === 'function') {
                        openMenuModal(dish._id);
                    }
                    dropdown.style.display = 'none';
                    e.target.value = '';
                }
            });
        }
    });

    // 3. Search Coupons
    const coupons = window.cachedCoupons || [];
    coupons.forEach(cp => {
        if ((cp.code || '').toLowerCase().includes(query)) {
            results.push({
                type: 'Coupon',
                title: cp.code,
                subtitle: `${cp.discountPercent || cp.discountAmount}% OFF Promo Code`,
                icon: '🏷️',
                action: () => {
                    window.switchSection('coupons-section');
                    dropdown.style.display = 'none';
                    e.target.value = '';
                }
            });
        }
    });

    if (results.length === 0) {
        dropdown.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-muted); font-size:12.5px;">No dishes or pages matching "${e.target.value}"</div>`;
        dropdown.style.display = 'block';
        return;
    }

    // Render results
    let html = `<div style="font-size:11px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; padding:6px 10px 8px; text-align:left;">Results (${results.length})</div>`;
    results.slice(0, 10).forEach((item, idx) => {
        html += `
            <div onclick="window._globalSearchResults[${idx}]()" style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; cursor:pointer; transition:background 0.15s; margin-bottom:2px;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">
                <span style="font-size:16px; width:24px; text-align:center;">${item.icon}</span>
                <div style="flex:1; min-width:0; text-align:left;">
                    <div style="font-size:13px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${item.subtitle}</div>
                </div>
                <span style="font-size:10px; font-weight:700; background:rgba(255,255,255,0.08); color:var(--text-dim); padding:2px 6px; border-radius:4px;">${item.type}</span>
            </div>
        `;
    });

    window._globalSearchResults = results.map(r => r.action);
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
};

// Global click outside to close search dropdown
document.addEventListener('click', (e) => {
    const searchWrapper = document.getElementById('global-search-input')?.parentElement;
    const dropdown = document.getElementById('global-search-results');
    if (dropdown && searchWrapper && !searchWrapper.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// =======================
// 2-STEP DOUBLE SECURITY AUTHENTICATION (Password -> Security PIN)
// =======================
let currentIdType = 'email';
let tempAuthToken = '';

window.switchIdType = function(type) {
    currentIdType = type;
    const emailGroup = document.getElementById('email-input-group');
    const phoneGroup = document.getElementById('phone-input-group');
    const btnEmail = document.getElementById('btn-type-email');
    const btnPhone = document.getElementById('btn-type-phone');
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.textContent = '';

    if (type === 'email') {
        if (emailGroup) emailGroup.style.display = 'block';
        if (phoneGroup) phoneGroup.style.display = 'none';
        if (btnEmail) {
            btnEmail.style.background = 'rgba(255,255,255,0.14)';
            btnEmail.style.color = '#fff';
            btnEmail.style.fontWeight = '700';
        }
        if (btnPhone) {
            btnPhone.style.background = 'transparent';
            btnPhone.style.color = 'var(--text-muted)';
            btnPhone.style.fontWeight = '600';
        }
        document.getElementById('login-email')?.focus();
    } else {
        if (emailGroup) emailGroup.style.display = 'none';
        if (phoneGroup) phoneGroup.style.display = 'block';
        if (btnPhone) {
            btnPhone.style.background = 'rgba(255,255,255,0.14)';
            btnPhone.style.color = '#fff';
            btnPhone.style.fontWeight = '700';
        }
        if (btnEmail) {
            btnEmail.style.background = 'transparent';
            btnEmail.style.color = 'var(--text-muted)';
            btnEmail.style.fontWeight = '600';
        }
        document.getElementById('login-phone')?.focus();
    }
};

window.togglePasswordVisibility = function(inputId) {
    const el = document.getElementById(inputId);
    const eyeClosed = document.getElementById('eye-icon-closed');
    const eyeOpen = document.getElementById('eye-icon-open');
    if (el) {
        if (el.type === 'password') {
            el.type = 'text';
            if (eyeClosed) eyeClosed.style.display = 'none';
            if (eyeOpen) eyeOpen.style.display = 'block';
        } else {
            el.type = 'password';
            if (eyeClosed) eyeClosed.style.display = 'block';
            if (eyeOpen) eyeOpen.style.display = 'none';
        }
    }
};

// STEP 1: Verify Password
window.handleStep1Login = async function(e) {
    if (e) e.preventDefault();
    let identifier = '';
    if (currentIdType === 'email') {
        identifier = document.getElementById('login-email')?.value.trim();
        if (!identifier) {
            const errorEl = document.getElementById('login-error');
            if (errorEl) errorEl.textContent = 'Please enter your Admin Email';
            return;
        }
    } else {
        const phone = document.getElementById('login-phone')?.value.trim();
        if (!phone || phone.length < 10) {
            const errorEl = document.getElementById('login-error');
            if (errorEl) errorEl.textContent = 'Please enter a valid 10-digit mobile number';
            return;
        }
        identifier = phone;
    }

    const password = document.getElementById('login-password')?.value;
    if (!password) {
        const errorEl = document.getElementById('login-error');
        if (errorEl) errorEl.textContent = 'Please enter your password';
        return;
    }

    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.textContent = '';
    const btn = document.getElementById('login-step1-btn');
    if (btn) btn.textContent = 'Verifying...';

    try {
        const res = await fetch(`${API_URL}/login/step1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (btn) btn.textContent = 'Verify Password →';

        if (data.success && data.requirePin) {
            tempAuthToken = data.tempToken || '';
            // Transition to Step 2 PIN
            document.getElementById('login-step1-form').style.display = 'none';
            document.getElementById('login-step2-form').style.display = 'block';
            
            const step1Badge = document.getElementById('step1-badge');
            const step2Badge = document.getElementById('step2-badge');
            if (step1Badge) {
                step1Badge.style.background = 'rgba(34,197,94,0.2)';
                step1Badge.style.color = '#4ade80';
            }
            if (step2Badge) {
                step2Badge.style.background = 'var(--brand-orange)';
                step2Badge.style.color = '#fff';
            }

            const pinInput = document.getElementById('login-step2-pin');
            if (pinInput) {
                pinInput.value = '';
                pinInput.focus();
            }
        } else {
            if (errorEl) errorEl.textContent = data.error || 'Incorrect Email/Phone or Password';
        }
    } catch(err) {
        if (btn) btn.textContent = 'Verify Password →';
        if (errorEl) errorEl.textContent = 'Server connection error. Try again.';
    }
};

// STEP 2: Verify Security PIN & Unlock Dashboard
window.handleStep2Login = async function(e) {
    if (e) e.preventDefault();
    const pin = document.getElementById('login-step2-pin')?.value.trim();
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.textContent = '';

    if (!pin || pin.length < 4) {
        if (errorEl) errorEl.textContent = 'Please enter 4-digit Security PIN';
        return;
    }

    const btn = document.getElementById('login-step2-btn');
    if (btn) btn.textContent = 'Unlocking...';

    try {
        const res = await fetch(`${API_URL}/login/step2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempToken: tempAuthToken, pin })
        });
        const data = await res.json();
        if (btn) btn.textContent = 'Unlock Dashboard 🚀';

        if (data.success) {
            authToken = data.token || '';
            authPin = data.pin || '1234';
            localStorage.setItem('adminToken', authToken);
            localStorage.setItem('adminPin', authPin);
            if (data.user) {
                localStorage.setItem('adminUser', JSON.stringify(data.user));
                const nameEl = document.querySelector('.header-profile-name');
                if (nameEl) nameEl.textContent = (data.user.name || 'Tushar').replace(/\s*\(Super Admin\)/i, '');
            }
            showDashboard();
            fetchData();
        } else {
            if (errorEl) errorEl.textContent = data.error || 'Invalid 4-Digit Security PIN';
        }
    } catch(err) {
        if (btn) btn.textContent = 'Unlock Dashboard 🚀';
        if (errorEl) errorEl.textContent = 'Server connection error. Try again.';
    }
};

window.backToStep1 = function() {
    const step2 = document.getElementById('login-step2-form');
    const step1 = document.getElementById('login-step1-form');
    if (step2) step2.style.display = 'none';
    if (step1) step1.style.display = 'block';
    
    const step1Badge = document.getElementById('step1-badge');
    const step2Badge = document.getElementById('step2-badge');
    if (step1Badge) {
        step1Badge.style.background = 'var(--brand-orange)';
        step1Badge.style.color = '#fff';
    }
    if (step2Badge) {
        step2Badge.style.background = 'rgba(255,255,255,0.06)';
        step2Badge.style.color = 'var(--text-muted)';
    }
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.textContent = '';
};

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        authPin = '';
        authToken = '';
        tempAuthToken = '';
        localStorage.removeItem('adminPin');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        window.backToStep1();
        showLogin();
    });
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    if (loginError) loginError.textContent = '';
}

function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
}

// =======================
// CUSTOM CONFIRM MODAL
// =======================
function showConfirm(title, message, okText = 'Yes', isDanger = true) {
    return new Promise((resolve) => {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        
        const okBtn = document.getElementById('confirm-ok');
        okBtn.textContent = okText;
        okBtn.style.background = isDanger ? 'var(--danger)' : 'var(--primary)';
        
        const cancelBtn = document.getElementById('confirm-cancel');
        
        // Remove old event listeners
        const newOk = okBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOk, okBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        
        newOk.onclick = () => {
            closeModal('confirm-modal');
            resolve(true);
        };
        newCancel.onclick = () => {
            closeModal('confirm-modal');
            resolve(false);
        };
        
        openModal('confirm-modal');
    });
}

// =======================
// WEBSITE ORDERS REVENUE TRACKER & LIVE ORDERS (REAL-TIME AUTO SYNC)
// =======================
window.cachedOrders = [];
window.knownOrderIds = new Set();
let isInitialOrdersLoaded = false;

function playNewOrderChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch(e) {}
}

window.fetchAndRenderOrders = async function() {
    try {
        const res = await fetch('/api/orders');
        if (res.ok) {
            const orders = await res.json();
            const orderList = Array.isArray(orders) ? orders : [];
            
            // Check for new incoming orders
            if (isInitialOrdersLoaded) {
                const newOrders = orderList.filter(o => o._id && !window.knownOrderIds.has(String(o._id)));
                if (newOrders.length > 0) {
                    playNewOrderChime();
                    const latest = newOrders[0];
                    const shortId = latest._id ? String(latest._id).slice(-6).toUpperCase() : 'LW';
                    if (typeof window.showAdminToast === 'function') {
                        window.showAdminToast(`🔔 New Order #${shortId} Received from ${latest.customerName || 'Customer'}!`, 'success');
                    }
                }
            }

            // Update known IDs
            window.knownOrderIds = new Set(orderList.map(o => String(o._id)));
            isInitialOrdersLoaded = true;

            window.cachedOrders = orderList;
            const currentSearch = document.getElementById('global-search-input')?.value?.trim() || window.currentSearchQuery || '';
            renderOrdersTable(currentSearch);
            if (typeof renderOrderNotifications === 'function') renderOrderNotifications();
            if (typeof renderWebsiteRevenue === 'function') renderWebsiteRevenue();
            if (typeof renderDynamicDashboard === 'function') renderDynamicDashboard();
        }
    } catch(e) {
        console.error('Failed to load orders:', e);
    }
};

window.renderOrderNotifications = function() {
    const orders = window.cachedOrders || [];
    // Active orders only: pending, accepted, dispatched. Delivered & cancelled automatically disappear!
    const activeOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
    const pendingOrders = activeOrders.filter(o => o.status === 'pending');

    const badgeEl = document.getElementById('header-notifications-badge');
    const countBadgeEl = document.getElementById('notif-unread-count') || document.getElementById('notif-active-count-badge');
    const listEl = document.getElementById('notif-list-container') || document.getElementById('notif-orders-list');

    if (badgeEl) {
        if (activeOrders.length > 0) {
            badgeEl.style.display = 'inline-flex';
            badgeEl.textContent = activeOrders.length;
            if (pendingOrders.length > 0) {
                badgeEl.style.background = '#ef4444'; // Red alert for pending orders
            } else {
                badgeEl.style.background = 'var(--brand-orange)';
            }
        } else {
            badgeEl.style.display = 'none';
        }
    }

    if (countBadgeEl) {
        countBadgeEl.textContent = `${activeOrders.length} New`;
        countBadgeEl.className = pendingOrders.length > 0 ? 'notif-badge' : 'notif-badge';
    }

    if (listEl) {
        if (activeOrders.length === 0) {
            listEl.innerHTML = `
                <div class="notif-empty" style="text-align:center; padding:32px 16px; color:var(--text-muted);">
                    <div style="font-size:32px; margin-bottom:8px;">🎉</div>
                    <div style="font-size:13.5px; font-weight:700; color:#fff; margin-bottom:2px;">All Caught Up!</div>
                    <div style="font-size:11.5px; color:var(--text-dim);">No pending or active orders right now.</div>
                </div>
            `;
            return;
        }

        listEl.innerHTML = activeOrders.map(ord => {
            const shortId = ord._id ? String(ord._id).slice(-6).toUpperCase() : 'LW-ORD';
            const status = (ord.status || 'pending').toLowerCase();
            const total = ord.finalTotal || ord.subtotal || 0;
            const itemsStr = (ord.items || []).map(it => `${it.quantity}x ${it.name}`).join(', ') || 'Items';
            const timeStr = ord.createdAt ? new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

            let statusPill = `<span class="badge badge-new" style="font-size:10px;">Pending</span>`;
            let actionBtn = `
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-primary" style="padding:4px 9px; font-size:11.5px; background:#25d366; color:#000; font-weight:800;" onclick="closeOrderNotifications(); openOrderConfirmModal('${ord._id}')" title="Confirm Order">✅ Confirm</button>
                    <button class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:11.5px; border-color:#ef4444; color:#ef4444;" onclick="closeOrderNotifications(); cancelOrderPrompt('${ord._id}')" title="Reject Order">✕</button>
                </div>
            `;
            
            if (status === 'accepted' || status === 'confirmed') {
                statusPill = `<span class="badge badge-active" style="font-size:10px;">Kitchen</span>`;
                actionBtn = `<button class="btn btn-sm btn-info" style="padding:4px 10px; font-size:11.5px; font-weight:700;" onclick="closeOrderNotifications(); openOrderConfirmModal('${ord._id}')">📦 Dispatch</button>`;
            } else if (status === 'dispatched') {
                statusPill = `<span class="badge badge-info" style="font-size:10px;">On Way</span>`;
                actionBtn = `<button class="btn btn-sm btn-success" style="padding:4px 10px; font-size:11.5px; font-weight:700;" onclick="closeOrderNotifications(); openOrderConfirmModal('${ord._id}')">🎉 Deliver</button>`;
            }

            return `
                <div class="notif-item ${status}" style="padding:13px 16px; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; gap:7px;">
                    <!-- Top Row: Order ID, Status, Time -->
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <strong style="font-size:12.5px; color:#fff; font-family:monospace; background:rgba(255,255,255,0.07); padding:2px 6px; border-radius:4px;">#${shortId}</strong>
                            ${statusPill}
                        </div>
                        <span style="font-size:11px; color:#94a3b8; font-weight:500;">${timeStr}</span>
                    </div>

                    <!-- Middle Row: Customer Name & Items -->
                    <div style="font-size:12px; color:#e2e8f0; line-height:1.4;">
                        <div style="font-weight:700; color:#fff; margin-bottom:2px;">${ord.customerName || 'Customer'}</div>
                        <div style="color:#94a3b8; font-size:11.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${itemsStr}</div>
                    </div>

                    <!-- Bottom Row: Price & Action -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.08);">
                        <span style="font-size:13.5px; font-weight:800; color:var(--brand-orange, #f97316);">₹${total}</span>
                        ${actionBtn}
                    </div>
                </div>
            `;
        }).join('');
    }
};

window.toggleOrderNotificationsDropdown = function(e) {
    if (e) e.stopPropagation();
    const drop = document.getElementById('order-notifications-dropdown');
    if (drop) {
        window.renderOrderNotifications();
        drop.classList.toggle('show');
    }
};

window.closeOrderNotifications = function() {
    const drop = document.getElementById('order-notifications-dropdown');
    if (drop) drop.classList.remove('show');
};

window.openAllOrdersSection = function() {
    window.closeOrderNotifications();
    window.switchSection('orders-section');
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('#order-notifications-dropdown') && !e.target.closest('.header-icon-btn')) {
        window.closeOrderNotifications();
    }
});

// Start Continuous Background Polling every 3 seconds for zero-refresh live updates
if (!window.adminOrdersLivePollInterval) {
    window.adminOrdersLivePollInterval = setInterval(() => {
        window.fetchAndRenderOrders();
        if (typeof loadStoreSettings === 'function') loadStoreSettings();
    }, 3000);
}

// Initial fetch on script execution
window.fetchAndRenderOrders();

function renderOrdersTable(filterQuery = '') {
    const tbody = document.getElementById('live-orders-tbody');
    if (!tbody) return;
    let orders = window.cachedOrders || [];
    const activeInput = document.getElementById('global-search-input');
    const rawQ = (filterQuery !== '' ? filterQuery : (activeInput ? activeInput.value : (window.currentSearchQuery || ''))).trim();

    if (rawQ) {
        const q = rawQ.toLowerCase();
        const qClean = q.replace(/^#/, '');
        const qPhone = q.replace(/\D/g, '');

        orders = orders.filter(ord => {
            const shortId = ord._id ? String(ord._id).slice(-6).toLowerCase() : '';
            const fullId = ord._id ? String(ord._id).toLowerCase() : '';
            const name = (ord.customerName || '').toLowerCase();
            const phone = (ord.customerPhone || ord.whatsappPhone || '').replace(/\D/g, '');
            const items = (ord.items || []).map(i => i.name || '').join(' ').toLowerCase();

            const matchId = shortId.includes(qClean) || fullId.includes(qClean);
            const matchName = name.includes(q);
            const matchPhone = qPhone.length >= 3 && phone.includes(qPhone);
            const matchItems = items.includes(q);

            return matchId || matchName || matchPhone || matchItems;
        });
    }

    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:48px 20px; color:var(--text-muted);">
                    <div style="font-size:36px; margin-bottom:10px;">${rawQ ? '🔍' : '🛍️'}</div>
                    <div style="font-size:15px; font-weight:700; color:#fff; margin-bottom:4px;">${rawQ ? `No Orders Matching "${rawQ}"` : 'No Active Live Orders'}</div>
                    <div style="font-size:12px; color:var(--text-dim); max-width:380px; margin:0 auto;">
                        ${rawQ ? 'Try searching with a different order ID, customer name, or phone number.' : 'Incoming customer orders placed from the website or WhatsApp checkout will appear here in real-time.'}
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = orders.map(ord => {
        const orderId = ord._id ? String(ord._id).slice(-6).toUpperCase() : 'LW-ORD';
        const itemsStr = (ord.items || []).map(it => `${it.quantity}x ${it.name}`).join(', ') || 'Custom items';
        const total = ord.finalTotal || ord.subtotal || 0;
        const delCharge = Number(ord.deliveryCharge || 0);
        const status = (ord.status || 'pending').toLowerCase();
        const statusBadge = status === 'delivered' ? 'badge-open' : (status === 'cancelled' ? 'badge-closed' : (status === 'accepted' || status === 'confirmed' ? 'badge-active' : (status === 'dispatched' ? 'badge-info' : 'badge-new')));
        const formattedDate = ord.createdAt ? new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const targetPhone = ord.whatsappPhone || ord.customerPhone || '';
        const rawPhone = targetPhone.replace(/\D/g, '').slice(-10);

        let actionBtnHtml = '';
        if (status === 'pending') {
            actionBtnHtml = `
                <button type="button" class="btn btn-sm btn-primary" style="padding:6px 12px; font-size:11.5px; font-weight:800; background:#25d366; color:#000;" onclick="openOrderConfirmModal('${ord._id}')" title="Confirm Order & Reply via WhatsApp">
                    ✅ Confirm
                </button>
                <button type="button" class="btn btn-sm btn-outline" style="padding:6px 8px; font-size:11px; border-color:#ef4444; color:#ef4444;" onclick="cancelOrderPrompt('${ord._id}')" title="Reject / Cancel Order">
                    ✕ Reject
                </button>
            `;
        } else if (status === 'accepted' || status === 'confirmed') {
            actionBtnHtml = `
                <button type="button" class="btn btn-sm btn-primary" style="padding:6px 10px; font-size:11px; font-weight:700; background:#3b82f6; color:#fff;" onclick="directUpdateOrderStatus('${ord._id}', 'dispatched')" title="Mark Out for Delivery">
                    📦 Dispatch
                </button>
                <button type="button" class="btn btn-sm btn-secondary" style="padding:6px 8px; font-size:11px;" onclick="openOrderConfirmModal('${ord._id}')" title="View Order Details">
                    👁️
                </button>
                <button type="button" class="btn btn-sm btn-outline" style="padding:6px 8px; font-size:11px; border-color:#ef4444; color:#ef4444;" onclick="cancelOrderPrompt('${ord._id}')" title="Cancel Order">
                    ✕
                </button>
            `;
        } else if (status === 'dispatched') {
            actionBtnHtml = `
                <button type="button" class="btn btn-sm btn-primary" style="padding:6px 10px; font-size:11px; font-weight:800; background:#10b981; color:#000;" onclick="directUpdateOrderStatus('${ord._id}', 'delivered')" title="Mark Order Delivered">
                    🎉 Deliver
                </button>
                <button type="button" class="btn btn-sm btn-secondary" style="padding:6px 8px; font-size:11px;" onclick="openOrderConfirmModal('${ord._id}')" title="View Order Details">
                    👁️
                </button>
            `;
        } else {
            actionBtnHtml = `
                <button type="button" class="btn btn-sm btn-secondary" style="padding:6px 10px; font-size:11px;" onclick="openOrderConfirmModal('${ord._id}')" title="View Order Details">
                    👁️ Details
                </button>
            `;
        }

        return `
            <tr>
                <td style="font-family:monospace; font-weight:800; color:var(--brand-orange);">#${orderId}</td>
                <td>
                    <div style="font-weight:700; color:#fff;">${ord.customerName || 'Customer'}</div>
                    <div style="font-size:11px; color:var(--text-dim);">${formattedDate} • <span style="text-transform:capitalize; color:var(--brand-gold);">${ord.orderType || 'delivery'}</span></div>
                </td>
                <td><a href="tel:${ord.customerPhone}" style="color:var(--text-muted); text-decoration:none; font-weight:600;">${ord.customerPhone || 'N/A'}</a></td>
                <td style="max-width:220px; font-size:12.5px;" title="${itemsStr}">${itemsStr}</td>
                <td>
                    <div style="font-weight:900; color:var(--brand-gold);">₹${total}</div>
                    <div style="font-size:10.5px; color:var(--text-dim);">Del: ₹${delCharge}</div>
                </td>
                <td><span class="badge ${statusBadge}">${status.toUpperCase()}</span></td>
                <td>
                    <div style="display:flex; gap:6px; align-items:center;">
                        ${actionBtnHtml}
                        <button type="button" class="btn btn-sm btn-secondary" style="padding:6px 8px; font-size:11px;" onclick="window.openA4InvoiceModal('${ord._id}')" title="View & Print Official Bill (A4 PDF)">
                            📄
                        </button>
                        <a href="https://wa.me/91${rawPhone}" target="_blank" class="btn btn-sm btn-secondary" style="padding:6px 8px; font-size:11px;" title="Direct WhatsApp Chat">
                            💬
                        </a>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.directUpdateOrderStatus = async function(orderId, newStatus) {
    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
            window.showAdminToast(`Order status updated to: ${newStatus.toUpperCase()}`, 'success');
            window.fetchAndRenderOrders();
        } else {
            window.showAdminToast('Failed to update order status', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error updating status', 'error');
    }
};

window.loadFinanceData = function() {
    renderWebsiteRevenue();
};

function renderWebsiteRevenue() {
    const orders = window.cachedOrders || [];
    const validOrders = orders.filter(o => o.status !== 'cancelled');
    const totalOrders = validOrders.length;
    
    let totalFoodRevenue = 0; // Pure Food Item Net Revenue (excl. delivery fee)
    let totalDeliveryFee = 0; // Total Delivery Charges (Paid to Rider)
    let totalGrandSales = 0;  // Grand total collected

    validOrders.forEach(o => {
        const itemSubtotal = Number(o.subtotal || 0);
        const discount = Number(o.discount || 0);
        const netItemTotal = Math.max(0, itemSubtotal - discount);
        
        // Fallback: if subtotal is missing, derive food amount by subtracting deliveryCharge from finalTotal
        const fallbackFood = o.finalTotal ? Math.max(0, Number(o.finalTotal) - Number(o.deliveryCharge || 0)) : 0;
        const foodAmount = netItemTotal > 0 ? netItemTotal : fallbackFood;
        const delFee = Number(o.deliveryCharge || 0);

        totalFoodRevenue += foodAmount;
        totalDeliveryFee += delFee;
        totalGrandSales += Number(o.finalTotal || (foodAmount + delFee));
    });

    const foodAov = totalOrders > 0 ? Math.round(totalFoodRevenue / totalOrders) : 0;

    const elWebRev = document.getElementById('fin-website-revenue');
    if (elWebRev) elWebRev.textContent = `₹${totalFoodRevenue.toLocaleString('en-IN')}`;

    const elWebOrd = document.getElementById('fin-website-orders');
    if (elWebOrd) elWebOrd.textContent = `${totalOrders} orders`;

    const elWebAov = document.getElementById('fin-website-aov');
    if (elWebAov) elWebAov.textContent = `₹${foodAov}`;

    const elDashRev = document.getElementById('kpi-revenue');
    if (elDashRev) elDashRev.textContent = `₹${totalFoodRevenue.toLocaleString('en-IN')}`;

    const elDashOrd = document.getElementById('kpi-orders-count');
    if (elDashOrd) elDashOrd.textContent = `${totalOrders} website orders`;

    // Render Detailed Finance Register Table
    const finTbody = document.getElementById('finance-tbody');
    if (finTbody) {
        if (orders.length === 0) {
            finTbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted);">
                        <div style="font-size:32px; margin-bottom:8px;">🛒</div>
                        <div style="font-size:14px; font-weight:700; color:#fff; margin-bottom:4px;">No Website Orders Yet</div>
                        <div style="font-size:12px; color:var(--text-dim);">When customers place orders, their food revenue and delivery fee breakdown will appear here in real-time.</div>
                    </td>
                </tr>
            `;
        } else {
            finTbody.innerHTML = orders.map(ord => {
                const orderId = ord._id ? String(ord._id).slice(-6).toUpperCase() : 'LW-ORD';
                const dateStr = ord.createdAt ? new Date(ord.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Today';
                const itemsStr = (ord.items || []).map(it => `${it.quantity}x ${it.name}`).join(', ') || 'Custom items';
                const itemSubtotal = Number(ord.subtotal || 0);
                const discount = Number(ord.discount || 0);
                const netFood = Math.max(0, itemSubtotal - discount) || (ord.finalTotal ? Math.max(0, Number(ord.finalTotal) - Number(ord.deliveryCharge || 0)) : 0);
                const delFee = Number(ord.deliveryCharge || 0);
                const grandTotal = Number(ord.finalTotal || (netFood + delFee));
                const statusBadge = ord.status === 'delivered' ? 'badge-open' : (ord.status === 'cancelled' ? 'badge-closed' : (ord.status === 'accepted' ? 'badge-active' : 'badge-new'));

                return `
                    <tr>
                        <td style="font-family:monospace; font-weight:800; color:var(--brand-orange);">#${orderId}</td>
                        <td style="font-size:11.5px; color:var(--text-dim);">${dateStr}</td>
                        <td>
                            <div style="font-weight:700; color:#fff;">${ord.customerName || 'Customer'}</div>
                            <div style="font-size:11px; color:var(--text-muted);">${ord.customerPhone || 'N/A'}</div>
                        </td>
                        <td style="max-width:200px; font-size:12px;" title="${itemsStr}">${itemsStr}</td>
                        <td style="font-weight:800; color:var(--brand-gold);">₹${netFood}</td>
                        <td style="color:var(--brand-orange); font-weight:600;">₹${delFee}</td>
                        <td style="font-weight:900; color:#fff;">₹${grandTotal}</td>
                        <td><span class="badge ${statusBadge}">${ord.status || 'pending'}</span></td>
                    </tr>
                `;
            }).join('');
        }
    }
}

// =======================
// ANALYTICS & MENU INTELLIGENCE
// =======================
window.renderAnalyticsData = function() {
    const dishes = window.cachedMenuItems || [];
    if (!dishes.length) return;

    const total = dishes.length;
    let totalPrice = 0;
    let vegCount = 0;
    let nonVegCount = 0;
    let cloudCount = 0;
    let outletCount = 0;

    let under100 = 0;
    let mid100_250 = 0;
    let above250 = 0;

    const catCounts = {};

    dishes.forEach(d => {
        const price = Number(d.price || 0);
        totalPrice += price;
        
        if (d.isVeg) vegCount++;
        else nonVegCount++;

        if (d.availableAt?.cloudKitchen !== false) cloudCount++;
        if (d.availableAt?.dineInOutlet !== false) outletCount++;

        if (price < 100) under100++;
        else if (price <= 250) mid100_250++;
        else above250++;

        const catName = (typeof d.category === 'object' ? d.category?.name : d.category) || 'General';
        catCounts[catName] = (catCounts[catName] || 0) + 1;
    });

    const avgPrice = total > 0 ? Math.round(totalPrice / total) : 0;
    const vegPct = total > 0 ? Math.round((vegCount / total) * 100) : 0;
    const nonVegPct = total > 0 ? Math.round((nonVegCount / total) * 100) : 0;

    const elTotal = document.getElementById('analytics-total-dishes');
    if (elTotal) elTotal.textContent = total;

    const elAvg = document.getElementById('analytics-avg-price');
    if (elAvg) elAvg.textContent = `₹${avgPrice}`;

    const elVeg = document.getElementById('analytics-veg-dishes');
    if (elVeg) elVeg.textContent = vegCount;
    const elVegPct = document.getElementById('analytics-veg-pct');
    if (elVegPct) elVegPct.textContent = `${vegPct}% of Menu`;

    const elNonVeg = document.getElementById('analytics-nonveg-dishes');
    if (elNonVeg) elNonVeg.textContent = nonVegCount;
    const elNonVegPct = document.getElementById('analytics-nonveg-pct');
    if (elNonVegPct) elNonVegPct.textContent = `${nonVegPct}% of Menu`;

    // Render Category volume bars
    const catBars = document.getElementById('analytics-categories-bars');
    if (catBars) {
        const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);
        catBars.innerHTML = sortedCats.map(([cat, count]) => {
            const pct = Math.round((count / total) * 100);
            return `
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
                        <span style="color:#fff; font-weight:600;">${cat}</span>
                        <span style="color:var(--text-muted);">${count} items (${pct}%)</span>
                    </div>
                    <div style="height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:var(--brand-orange); border-radius:3px;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Location breakdown
    const elLoc = document.getElementById('analytics-location-breakdown');
    if (elLoc) {
        elLoc.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:6px;">
                <span style="color:#fff;">☁️ Cloud Kitchen (Delivery)</span>
                <strong style="color:#4ade80;">${cloudCount} items</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12.5px;">
                <span style="color:#fff;">🏪 Dine-in Outlet (Physical)</span>
                <strong style="color:#60a5fa;">${outletCount} items</strong>
            </div>
        `;
    }

    // Price brackets
    const elBrackets = document.getElementById('analytics-price-brackets');
    if (elBrackets) {
        elBrackets.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:6px;">
                <span style="color:var(--text-muted);">Budget (&lt; ₹100)</span>
                <strong style="color:#fff;">${under100} dishes</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:6px;">
                <span style="color:var(--text-muted);">Standard (₹100 – ₹250)</span>
                <strong style="color:#fff;">${mid100_250} dishes</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12.5px;">
                <span style="color:var(--text-muted);">Premium (&gt; ₹250)</span>
                <strong style="color:var(--brand-gold);">${above250} dishes</strong>
            </div>
        `;
    }
};

// =======================
// NAVIGATION & UI HELPERS
// =======================
window.navigateAdminBack = function() {
    window.switchSection('dashboard-section');
};

window.switchSection = function(targetId) {
    if (!targetId) targetId = 'dashboard-section';

    // Toggle Back button visibility (Visible on all sections except home Dashboard)
    const backBtn = document.getElementById('content-back-btn') || document.getElementById('header-back-btn');
    if (backBtn) {
        if (targetId !== 'dashboard-section') {
            backBtn.style.display = 'inline-flex';
        } else {
            backBtn.style.display = 'none';
        }
    }

    const allNavs = document.querySelectorAll('.nav-item');
    const allTabs = document.querySelectorAll('.tab-section');
    
    let matchedNav = false;
    allNavs.forEach(n => {
        if (n.getAttribute('data-target') === targetId) {
            n.classList.add('active');
            matchedNav = true;
            const title = n.getAttribute('data-title') || (targetId === 'dashboard-section' ? 'Dashboard' : 'Admin Panel');
            const bc = n.getAttribute('data-bc') || title;
            const titleEl = document.getElementById('header-page-title');
            const bcEl = document.getElementById('breadcrumb-current');
            if (titleEl) titleEl.textContent = title;
            if (bcEl) bcEl.textContent = bc;
        } else {
            n.classList.remove('active');
        }
    });

    if (!matchedNav && targetId === 'dashboard-section') {
        const dashNav = document.querySelector('.nav-item[data-target="dashboard-section"]');
        if (dashNav) dashNav.classList.add('active');
        const titleEl = document.getElementById('header-page-title');
        const bcEl = document.getElementById('breadcrumb-current');
        if (titleEl) titleEl.textContent = 'Dashboard';
        if (bcEl) bcEl.textContent = 'Dashboard';
    }
    
    allTabs.forEach(s => {
        if (s.id === targetId) {
            s.classList.remove('hidden');
            s.classList.add('active');
        } else {
            s.classList.add('hidden');
            s.classList.remove('active');
        }
    });

    if (targetId === 'dashboard-section') {
        if (typeof renderDynamicDashboard === 'function') renderDynamicDashboard();
    }
    if (targetId === 'media-section') fetchReels();
    if (targetId === 'menu-section') loadMenu();
    if (targetId === 'coupons-section') loadCoupons();
    if (targetId === 'settings-section') loadStoreSettings();
    if (targetId === 'analytics-section') window.renderAnalyticsData();
    if (targetId === 'finance-section') window.loadFinanceData();
    if (targetId === 'orders-section') window.fetchAndRenderOrders();
    if (targetId === 'seo-section') window.loadSeoSettings();
    if (targetId === 'media-library-section') window.renderMediaLibrary();

    if (typeof window.updateContextualSearchPlaceholder === 'function') {
        window.updateContextualSearchPlaceholder(targetId);
    }

    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close sidebar on mobile after navigating
    if (typeof window.closeSidebarMobile === 'function') {
        window.closeSidebarMobile();
    }
};

window.toggleRestaurantGlobalStatus = async function() {
    const isCurrentlyOnline = document.getElementById('header-status-text')?.textContent.toLowerCase().includes('open');
    const newStatus = !isCurrentlyOnline;
    
    try {
        await apiCall('/settings/cloud', 'PUT', { isOnline: newStatus });
        await apiCall('/settings/outlet', 'PUT', { isOnline: newStatus });
        
        window.showAdminToast(
            newStatus ? '🟢 Restaurant is now LIVE & Accepting Orders!' : '🔴 Restaurant is now OFFLINE / Closed!',
            newStatus ? 'success' : 'warning',
            'Store Status Changed'
        );
        loadStoreSettings();
    } catch(e) {
        window.showAdminToast('Error toggling restaurant status', 'error');
    }
};

window.switchToCmsTab = function(subTabId, scrollTarget = null) {
    window.switchSection('media-section');
    if (typeof window.switchCmsSubTab === 'function') {
        window.switchCmsSubTab(subTabId);
    }

    if (scrollTarget) {
        setTimeout(() => {
            let targetEl = null;
            if (scrollTarget === 'hero') targetEl = document.getElementById('cms-hero-group');
            else if (scrollTarget === 'about') targetEl = document.getElementById('cms-about-group');
            else if (scrollTarget === 'why') targetEl = document.getElementById('cms-why-group');
            
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 150);
    }
};

window.toggleNavGroup = function(groupId) {
    const el = document.getElementById(groupId);
    if (el) el.classList.toggle('open');
};

window.quickToggleStoreModal = function() {
    if (typeof openScheduleModal === 'function') {
        openScheduleModal('cloud');
    }
};

window.showNotificationDrawer = function() {
    const isCloudOnline = document.getElementById('header-status-text')?.textContent.includes('Open');
    const menuCount = (window.cachedMenuItems || []).length;
    window.showAdminToast(`Operational Status: ${isCloudOnline ? '🟢 Cloud Kitchen is LIVE (11 AM - 10 PM)' : '🔴 Store is Offline'} • ${menuCount} dishes active`, 'info', 'System Notifications');
};

window.refreshOrders = function() {
    if (typeof window.fetchAndRenderOrders === 'function') window.fetchAndRenderOrders();
    window.showAdminToast('Orders refreshed and up to date!', 'success');
};

window.openAnnouncementModal = function() {
    window.switchToCmsTab('announcements-tab');
    document.getElementById('cms-announcements-grid')?.scrollIntoView({ behavior: 'smooth' });
};

// ==========================================
// CONTEXTUAL LIVE SEARCH CONTROLLER
// ==========================================
window.currentSearchQuery = '';

window.handleContextualSearch = function(e) {
    const query = (e.target.value || '').trim();
    window.currentSearchQuery = query;
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.style.display = query ? 'inline-block' : 'none';

    const activeTab = document.querySelector('.tab-section.active')?.id || 'dashboard-section';

    if (activeTab === 'orders-section') {
        renderOrdersTable(query);
    } else if (activeTab === 'menu-section') {
        renderMenuGrid(query);
    } else if (activeTab === 'coupons-section' && typeof renderCoupons === 'function') {
        renderCoupons(query);
    } else if (activeTab === 'announcements-section' && typeof renderAnnouncements === 'function') {
        renderAnnouncements(query);
    } else {
        renderDashboardSearchDropdown(query.toLowerCase());
    }
};

window.clearContextualSearch = function() {
    const input = document.getElementById('global-search-input');
    if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input'));
    }
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.style.display = 'none';
};

window.updateContextualSearchPlaceholder = function(targetId) {
    const input = document.getElementById('global-search-input');
    if (!input) return;
    
    // Clear search on tab switch so user has clean context
    input.value = '';
    window.currentSearchQuery = '';
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    const dropdown = document.getElementById('global-search-results');
    if (dropdown) dropdown.style.display = 'none';

    if (targetId === 'orders-section') {
        input.placeholder = 'Search orders by ID (#LW...), Customer Name, Phone...';
    } else if (targetId === 'menu-section') {
        input.placeholder = 'Search menu by Dish Name, Category, Veg/Non-Veg...';
    } else if (targetId === 'coupons-section') {
        input.placeholder = 'Search coupons by promo code...';
    } else if (targetId === 'media-section' || targetId === 'announcements-section') {
        input.placeholder = 'Search banners, announcements, deals...';
    } else if (targetId === 'settings-section') {
        input.placeholder = 'Search store timings & delivery settings...';
    } else {
        input.placeholder = 'Search dishes, categories, sections...';
    }
};

window.renderDashboardSearchDropdown = function(query) {
    const dropdown = document.getElementById('global-search-results');
    if (!dropdown) return;

    if (!query) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        return;
    }

    const results = [];

    // 1. Search Sections
    const sections = [
        { name: 'Dashboard Overview', icon: '📊', sectionId: 'dashboard-section' },
        { name: 'Menu Catalog (151 Dishes)', icon: '🍱', sectionId: 'menu-section' },
        { name: 'Live Orders Management', icon: '🛍️', sectionId: 'orders-section' },
        { name: 'Finance & Online Revenue', icon: '💰', sectionId: 'finance-section' },
        { name: 'Analytics & Reports', icon: '📈', sectionId: 'analytics-section' },
        { name: 'Store Opening Hours & Delivery', icon: '⏰', sectionId: 'settings-section' },
        { name: 'Discount Coupons & Promos', icon: '🏷️', sectionId: 'coupons-section' },
        { name: 'Media Library Gallery', icon: '🖼️', sectionId: 'media-library-section' },
        { name: 'Website Hero Section CMS', icon: '✨', sectionId: 'media-section', tab: 'hero-tab' },
        { name: 'About Us Story CMS', icon: 'ℹ️', sectionId: 'media-section', tab: 'about-tab' },
        { name: 'Social Reels & Instagram CMS', icon: '📱', sectionId: 'media-section', tab: 'reels-tab' },
        { name: 'Craziest Deals CMS', icon: '🔥', sectionId: 'media-section', tab: 'deals-tab' },
        { name: 'Announcements Banner CMS', icon: '📢', sectionId: 'media-section', tab: 'announcements-tab' }
    ];

    sections.forEach(s => {
        if (s.name.toLowerCase().includes(query)) {
            results.push({
                type: 'Section',
                title: s.name,
                subtitle: 'Navigation Jump',
                icon: s.icon,
                onClick: `window.switchSection('${s.sectionId}'); ${s.tab ? `window.switchToCmsTab('${s.tab}');` : ''} document.getElementById('global-search-results').style.display='none';`
            });
        }
    });

    // 2. Search Dishes (Strict Name & Category matching)
    (window.cachedMenuItems || []).forEach(dish => {
        const dishName = (dish.name || '').toLowerCase();
        const category = (dish.category || '').toLowerCase();
        if (dishName.includes(query) || category.includes(query)) {
            results.push({
                type: 'Dish',
                title: dish.name,
                subtitle: `₹${dish.price} • ${dish.category || 'General'}`,
                icon: '🍲',
                onClick: `window.switchSection('menu-section'); if(typeof editMenu==='function') editMenu('${dish._id}'); document.getElementById('global-search-results').style.display='none';`
            });
        }
    });

    // 3. Search Orders (Strict ID, Customer Name & Phone matching)
    const qClean = query.replace(/^#/, '').toLowerCase();
    const qPhone = query.replace(/\D/g, '');

    (window.cachedOrders || []).forEach(ord => {
        const id = String(ord._id || '');
        const shortId = id.slice(-6).toLowerCase();
        const fullId = id.toLowerCase();
        const name = (ord.customerName || '').toLowerCase();
        const phone = (ord.customerPhone || ord.whatsappPhone || '').replace(/\D/g, '');

        const matchId = shortId.includes(qClean) || fullId.includes(qClean);
        const matchName = name.includes(query);
        const matchPhone = qPhone.length >= 3 && phone.includes(qPhone);

        if (matchId || matchName || matchPhone) {
            results.push({
                type: 'Order',
                title: `Order #${id.slice(-6).toUpperCase()} - ${ord.customerName || 'Customer'}`,
                subtitle: `₹${ord.finalTotal || ord.subtotal || 0} • ${ord.status || 'pending'}`,
                icon: '🛍️',
                onClick: `window.switchSection('orders-section'); if(typeof openOrderConfirmModal==='function') openOrderConfirmModal('${ord._id}'); document.getElementById('global-search-results').style.display='none';`
            });
        }
    });

    if (results.length === 0) {
        dropdown.innerHTML = `<div style="padding:14px 16px; font-size:12.5px; color:var(--text-dim); text-align:center;">No matching results for "${query}"</div>`;
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML = results.slice(0, 8).map(r => `
        <div class="search-result-item" onclick="${r.onClick}" style="display:flex; align-items:center; gap:12px; padding:10px 14px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.2s;">
            <span style="font-size:18px;">${r.icon}</span>
            <div style="flex:1;">
                <div style="font-size:13px; font-weight:700; color:#fff;">${r.title}</div>
                <div style="font-size:11px; color:var(--text-dim);">${r.type} • ${r.subtitle}</div>
            </div>
        </div>
    `).join('');
    dropdown.style.display = 'block';
};

window.handleHeaderStoreToggle = async function(e) {
    const toggleInput = document.getElementById('header-store-switch');
    if (!toggleInput) return;
    const isNowChecked = toggleInput.checked;

    if (!isNowChecked) {
        // User wants to turn store OFFLINE -> Revert switch momentarily until offline reason/duration is submitted
        toggleInput.checked = true;
        openOfflineStatusModal();
    } else {
        // User wants to turn store ONLINE -> Go online instantly!
        confirmGoOnline();
    }
};

function updateLiveHeaderDate() {
    const d = new Date();
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    const el = document.getElementById('live-date-text');
    if (el) el.textContent = d.toLocaleDateString('en-GB', options);
}

// Nav Click Listeners
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.getAttribute('data-target');
        if (targetId) window.switchSection(targetId);
    });
});

// Sidebar Collapsing & Mobile Toggles
window.closeSidebarMobile = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
};

window.toggleSidebarMobile = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    
    if (window.innerWidth <= 900) {
        const isOpen = sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('active', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    } else {
        sidebar.classList.toggle('collapsed');
    }
};

document.getElementById('sidebar-toggle-btn')?.addEventListener('click', window.toggleSidebarMobile);
document.getElementById('mobile-menu-btn')?.addEventListener('click', window.toggleSidebarMobile);
document.getElementById('sidebar-close-btn')?.addEventListener('click', window.closeSidebarMobile);

// Close sidebar on navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
            window.closeSidebarMobile();
        }
    });
});

// Close sidebar on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeSidebarMobile();
    }
});

updateLiveHeaderDate();


// =======================
// DATA FETCHING
// =======================
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (authPin) headers['x-admin-pin'] = authPin;
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const options = {
        method,
        headers,
        cache: 'no-store'
    };
    if (body) options.body = JSON.stringify(body);
    
    const res = await fetch(`${API_URL}${endpoint}`, options);
    if (res.status === 401) {
        if (logoutBtn) logoutBtn.click();
        throw new Error('Unauthorized');
    }
    // Handle empty responses
    const text = await res.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch(e) {
        return {};
    }
}

window.cachedAnnouncements = [];
window.cachedCoupons = [];

async function loadAppConfig() {
    try {
        const res = await fetch(`${API_URL}/config`);
        const config = await res.json();
        if (config && config.frontendUrl) {
            window.frontendUrl = config.frontendUrl;
            const linkEl = document.getElementById('live-website-link');
            if (linkEl) linkEl.href = config.frontendUrl;
        }
    } catch(e) {}
}

async function fetchData() {
    await loadAppConfig();
    await loadCategories();
    await loadMenu();
    await loadAnnouncements();
    await loadCoupons();
    await loadStoreSettings();
    if (typeof window.fetchAndRenderOrders === 'function') {
        try { await window.fetchAndRenderOrders(); } catch(e) {}
    }
    if (typeof window.loadFinanceData === 'function') {
        try { await window.loadFinanceData(); } catch(e) {}
    }
    if (typeof loadHeroCmsSettings === 'function') {
        try { await loadHeroCmsSettings(); } catch(e) {}
    }
    if (typeof fetchReels === 'function') {
        try { await fetchReels(); } catch(e) {}
    }
    renderDynamicDashboard();
}

window.renderDynamicDashboard = function() {
    const menus = window.cachedMenuItems || [];
    const categories = window.cachedCategories || [];
    const announcements = window.cachedAnnouncements || [];
    const coupons = window.cachedCoupons || [];
    const settings = (window.cachedStoreSettings && window.cachedStoreSettings[0]) ? window.cachedStoreSettings[0] : null;

    // 1. KPI Cards
    const totalMenu = menus.length;
    const totalCat = categories.length;
    const totalBanners = announcements.length;
    const totalCoupons = coupons.length;

    const elMenuKpi = document.getElementById('kpi-menu-count');
    if (elMenuKpi) elMenuKpi.textContent = totalMenu;

    const elSideCount = document.getElementById('sidebar-menu-count');
    if (elSideCount) elSideCount.textContent = totalMenu;

    const elCatKpi = document.getElementById('kpi-categories-count');
    if (elCatKpi) elCatKpi.textContent = totalCat;

    const elCatSub = document.getElementById('kpi-categories-sub');
    if (elCatSub) elCatSub.textContent = `${totalCat} Active Sections`;

    const elBannersKpi = document.getElementById('kpi-banners-count');
    if (elBannersKpi) elBannersKpi.textContent = totalBanners;

    const elCouponsKpi = document.getElementById('kpi-coupons-count');
    if (elCouponsKpi) elCouponsKpi.textContent = totalCoupons;

    // Live Revenue calculation (connected to orders database)
    const orders = window.cachedOrders || [];
    const validOrders = orders.filter(o => o.status !== 'cancelled');
    let totalFoodRevenue = 0;
    validOrders.forEach(o => {
        const itemSubtotal = Number(o.subtotal || 0);
        const discount = Number(o.discount || 0);
        const netItemTotal = Math.max(0, itemSubtotal - discount);
        const fallbackFood = o.finalTotal ? Math.max(0, Number(o.finalTotal) - Number(o.deliveryCharge || 0)) : 0;
        const foodAmount = netItemTotal > 0 ? netItemTotal : fallbackFood;
        totalFoodRevenue += foodAmount;
    });

    const elRevenue = document.getElementById('kpi-revenue');
    if (elRevenue) elRevenue.textContent = `₹${totalFoodRevenue.toLocaleString('en-IN')}`;
    
    const elOrdersCount = document.getElementById('kpi-orders-count');
    if (elOrdersCount) elOrdersCount.textContent = `${validOrders.length} website orders`;

    // 2. Modules Status
    const elModMenu = document.getElementById('module-menu-stat');
    if (elModMenu) elModMenu.textContent = `${totalMenu} Items • ${totalCat} Categories`;

    const elModBanners = document.getElementById('module-banners-stat');
    if (elModBanners) elModBanners.textContent = `${totalBanners} Live Banners`;

    const elModDeals = document.getElementById('module-deals-stat');
    const dealsCount = menus.filter(m => m.isCraziestDeal || (m.category && m.category.toLowerCase().includes('craziest deal'))).length;
    if (elModDeals) elModDeals.textContent = `${dealsCount} Hourly Combos`;

    const elModHero = document.getElementById('module-hero-stat');
    if (elModHero && settings && settings.heroTitle) {
        elModHero.textContent = `Live: "${settings.heroTitle.slice(0, 18)}..."`;
    }

    const elModAbout = document.getElementById('module-about-stat');
    if (elModAbout && settings && settings.aboutHeading) {
        elModAbout.textContent = `Live: "${settings.aboutHeading.slice(0, 18)}..."`;
    }

    const elModReels = document.getElementById('module-reels-stat');
    if (elModReels) {
        const rCount = (window.adminReelsList && window.adminReelsList.length) ? window.adminReelsList.length : 6;
        elModReels.textContent = `${rCount} Customer Reels`;
    }

    // 3. Catalog Donut Chart & Legend
    const vegCount = menus.filter(m => m.dietaryPreference === 'veg' || !m.dietaryPreference).length;
    const nonVegCount = menus.filter(m => m.dietaryPreference === 'non-veg').length;
    const vegPercent = totalMenu > 0 ? Math.round((vegCount / totalMenu) * 100) : 0;
    const nonVegPercent = totalMenu > 0 ? (100 - vegPercent) : 0;

    const donutTotal = document.getElementById('donut-total-dishes');
    if (donutTotal) donutTotal.textContent = totalMenu;

    const donutVegSlice = document.getElementById('donut-veg-slice');
    if (donutVegSlice) donutVegSlice.setAttribute('stroke-dasharray', `${vegPercent}, 100`);

    const donutNonvegSlice = document.getElementById('donut-nonveg-slice');
    if (donutNonvegSlice) {
        donutNonvegSlice.setAttribute('stroke-dasharray', `${nonVegPercent}, 100`);
        donutNonvegSlice.setAttribute('stroke-dashoffset', `-${vegPercent}`);
    }

    const donutVegCountEl = document.getElementById('donut-veg-count');
    if (donutVegCountEl) donutVegCountEl.textContent = `${vegCount} (${vegPercent}%)`;

    const donutNonvegCountEl = document.getElementById('donut-nonveg-count');
    if (donutNonvegCountEl) donutNonvegCountEl.textContent = `${nonVegCount} (${nonVegPercent}%)`;

    const donutDealsCountEl = document.getElementById('donut-deals-count');
    if (donutDealsCountEl) donutDealsCountEl.textContent = `${dealsCount} Combos`;

    const donutCatCountEl = document.getElementById('donut-categories-count');
    if (donutCatCountEl) donutCatCountEl.textContent = `${totalCat} Categories`;

    // 4. Featured Menu Highlights (Top 5 real dishes with images from DB)
    const popularContainer = document.getElementById('dashboard-popular-items');
    if (popularContainer) {
        if (menus.length === 0) {
            popularContainer.innerHTML = `<div style="color:var(--text-dim); padding:20px; text-align:center;">No dishes available in database.</div>`;
        } else {
            const top5 = menus.slice(0, 5);
            popularContainer.innerHTML = top5.map((item, idx) => `
                <div class="popular-item-row" onclick="editMenu('${item._id}')" style="cursor:pointer;" title="Click to edit dish">
                    <div class="popular-item-left">
                        <span class="rank-badge ${idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : ''}">${idx + 1}</span>
                        <img src="${item.image || 'images/logo.png'}" alt="${item.name}" class="popular-item-img" onerror="this.src='images/logo.png'">
                        <div>
                            <span class="popular-item-name" style="display:block;">${item.dietaryPreference === 'non-veg' ? '🔴' : '🟢'} ${item.name}</span>
                            <span style="font-size:11px; color:var(--text-dim);">${item.category || 'General'}</span>
                        </div>
                    </div>
                    <span class="popular-item-orders" style="color:var(--brand-gold); font-weight:800;">₹${item.price}</span>
                </div>
            `).join('');
        }
    }

    // 5. Website Hero Slides (From DB Hero settings & Announcements)
    const heroSlidesContainer = document.getElementById('dashboard-hero-slides');
    if (heroSlidesContainer) {
        const slides = [];
        if (settings) {
            slides.push({
                title: settings.heroTitle || 'Taste of Desi Swag',
                subtitle: settings.heroTagline || 'Authentic Flavours. Desi Swag.',
                thumb: settings.heroImage || 'images/hero-banner.webp',
                badge: 'Primary Hero'
            });
        }
        announcements.forEach((ann, i) => {
            slides.push({
                title: ann.title || `Announcement Banner #${i+1}`,
                subtitle: ann.isActive ? 'Active Website Banner' : 'Hidden Banner',
                thumb: ann.image || 'images/hero-banner.webp',
                badge: ann.isActive ? 'Active Banner' : 'Inactive'
            });
        });

        if (slides.length === 0) {
            heroSlidesContainer.innerHTML = `<div style="color:var(--text-dim); padding:20px; text-align:center;">No slides configured.</div>`;
        } else {
            heroSlidesContainer.innerHTML = slides.map((s, idx) => `
                <div class="hero-slide-preview-row">
                    <span style="font-weight:800; color:var(--text-dim); font-size:12px;">${idx + 1}</span>
                    <img src="${s.thumb}" class="hero-slide-thumb" alt="${s.title}" onerror="this.src='images/logo.png'">
                    <div class="hero-slide-details">
                        <div class="hero-slide-title">${s.title}</div>
                        <div class="hero-slide-subtitle">${s.subtitle}</div>
                    </div>
                    <span class="badge ${s.badge === 'Inactive' ? 'cancelled' : 'active'}">${s.badge}</span>
                    <button class="btn-sm btn-secondary" onclick="switchToCmsTab('hero-tab')">✏️</button>
                </div>
            `).join('');
        }
    }

    // 6. Operating Hours Table (7-day schedule from DB)
    const scheduleTbody = document.getElementById('dashboard-schedule-tbody');
    if (scheduleTbody && settings && settings.schedule) {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        scheduleTbody.innerHTML = days.map(day => {
            const d = settings.schedule[day] || { isOpen: true, openTime: '09:00', closeTime: '22:00' };
            const dayCap = day.charAt(0).toUpperCase() + day.slice(1);
            return `
                <tr>
                    <td><strong>${dayCap}</strong></td>
                    <td>${d.isOpen ? d.openTime : '—'}</td>
                    <td>${d.isOpen ? d.closeTime : '—'}</td>
                    <td><span class="badge ${d.isOpen ? 'active' : 'cancelled'}">${d.isOpen ? 'Open' : 'Closed'}</span></td>
                    <td><button class="btn-sm btn-secondary" onclick="openScheduleModal('cloud')">✏️</button></td>
                </tr>
            `;
        }).join('');
    }

    // 7. Manage Banners Grid (Live Announcements from DB)
    const bannersGrid = document.getElementById('dashboard-banners-grid');
    if (bannersGrid) {
        if (announcements.length === 0) {
            bannersGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:30px; background:var(--bg-surface); border-radius:var(--radius-md); border:1px dashed var(--border-card);">
                    <div style="font-size:24px; margin-bottom:8px;">📢</div>
                    <p style="color:var(--text-dim); margin-bottom:12px;">No announcement banners in database yet.</p>
                    <button class="btn btn-sm btn-primary" onclick="openAnnouncementModal()">+ Upload First Banner</button>
                </div>
            `;
        } else {
            bannersGrid.innerHTML = announcements.map(ann => `
                <div class="banner-preview-card" onclick="switchToCmsTab('announcements-tab')" title="${ann.title || 'Banner'}">
                    <img src="${ann.image || 'images/hero-banner.webp'}" class="banner-preview-img" alt="${ann.title || 'Banner'}" onerror="this.src='images/logo.png'">
                </div>
            `).join('');
        }
    }

    // 8. Recent Menu Catalog Items Table (Real items from DB)
    const recentOrdersTbody = document.getElementById('dashboard-recent-orders-tbody');
    if (recentOrdersTbody) {
        if (menus.length === 0) {
            recentOrdersTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:20px;">No menu items in database</td></tr>`;
        } else {
            const recent = menus.slice(0, 6);
            recentOrdersTbody.innerHTML = recent.map(item => `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td><span style="color:var(--text-secondary);">${item.category || 'General'}</span></td>
                    <td style="color:var(--brand-gold); font-weight:800;">₹${item.price}</td>
                    <td>${item.dietaryPreference === 'non-veg' ? '🔴 Non-Veg' : '🟢 Veg'}</td>
                    <td><span class="badge ${item.isAvailable !== false ? 'active' : 'cancelled'}">${item.isAvailable !== false ? 'In Stock' : 'Out of Stock'}</span></td>
                    <td><button class="btn-sm btn-secondary" onclick="editMenu('${item._id}')">✏️ Edit</button></td>
                </tr>
            `).join('');
        }
    }

    // 9. Real Activity Feed from DB status
    const actFeed = document.getElementById('dashboard-activity-feed');
    if (actFeed) {
        actFeed.innerHTML = `
            <div class="activity-feed-item">
                <div class="activity-icon-box">🍽️</div>
                <div class="activity-content">
                    <div class="activity-title">Menu Catalog Synced</div>
                    <div class="activity-desc">${totalMenu} dishes live across ${totalCat} categories in MongoDB.</div>
                </div>
                <span class="activity-time">Live</span>
            </div>
            <div class="activity-feed-item">
                <div class="activity-icon-box">🕒</div>
                <div class="activity-content">
                    <div class="activity-title">Store Schedule Active</div>
                    <div class="activity-desc">Cloud Kitchen 7-day schedule verified and running.</div>
                </div>
                <span class="activity-time">Synced</span>
            </div>
            <div class="activity-feed-item">
                <div class="activity-icon-box">📢</div>
                <div class="activity-content">
                    <div class="activity-title">Promotions & Banners</div>
                    <div class="activity-desc">${totalBanners} announcement banners and ${totalCoupons} promo codes live.</div>
                </div>
                <span class="activity-time">Active</span>
            </div>
            <div class="activity-feed-item">
                <div class="activity-icon-box">🌐</div>
                <div class="activity-content">
                    <div class="activity-title">Website Status Online</div>
                    <div class="activity-desc">Littiwale Desi Swag public ordering portal is live.</div>
                </div>
                <span class="activity-time">OK</span>
            </div>
        `;
    }
};

// =======================
// MODALS LOGIC
// =======================
function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    const form = document.getElementById(modalId).querySelector('form');
    if (form) form.reset();
    
    // Clear image preview for menu
    if (modalId === 'menu-modal') {
        document.getElementById('menu-image-preview').innerHTML = '';
        document.getElementById('menu-image-preview').style.display = 'none';
        document.getElementById('lw-preview-img').src = '';
        document.getElementById('lw-preview-img').style.display = 'none';
        document.getElementById('lw-preview-placeholder').style.display = 'flex';
        
        currentBase64Image = '';
        document.getElementById('menu-id').value = '';
        document.getElementById('menu-modal-title').textContent = 'Add Menu Item';
        document.querySelector('input[name="menu-diet"][value="veg"]').checked = true;
        document.getElementById('menu-spicy').checked = false;
        document.querySelector('input[name="menu-avail-input"][value="true"]').checked = true;
        document.querySelector('input[name="menu-location-avail"][value="both"]').checked = true;
        document.getElementById('menu-prep-time').value = '';
        document.getElementById('menu-tag-input').value = '';
        updateLivePreview();
    }
    if (modalId === 'category-modal') {
        document.getElementById('category-id').value = '';
    }
    if (modalId === 'announcement-modal') {
        document.getElementById('announcement-id').value = '';
        document.getElementById('announcement-modal-title').textContent = 'Add Announcement';
    }
    if (modalId === 'coupon-modal') {
        document.getElementById('coupon-id').value = '';
        document.getElementById('coupon-modal-title').textContent = 'Add Coupon';
    }
}

// =======================
// MENU LOGIC & LIVE PREVIEW
// =======================
let currentBase64Image = '';

function updateLivePreview() {
    try {
        const name = document.getElementById('menu-name')?.value || 'Special Ghee Litti';
        const price = document.getElementById('menu-price')?.value || '120';
        const desc = document.getElementById('menu-desc')?.value || 'Authentic roasted litti served with delicious desi accompaniments.';
        const diet = document.querySelector('input[name="menu-diet"]:checked')?.value || 'veg';
        const locAvail = document.querySelector('input[name="menu-location-avail"]:checked')?.value || 'both';

        const titleEl = document.getElementById('lw-preview-title');
        if (titleEl) {
            titleEl.innerHTML = `<span id="lw-preview-diet-icon">${diet === 'non-veg' ? '🔴' : '🟢'}</span> ${name}`;
        }
        const priceEl = document.getElementById('lw-preview-price');
        if (priceEl) priceEl.textContent = `₹${price}`;

        const descEl = document.getElementById('lw-preview-desc');
        if (descEl) descEl.textContent = desc;

        const badgeEl = document.getElementById('lw-preview-badge');
        if (badgeEl) {
            badgeEl.textContent = locAvail === 'cloud_only' ? '☁️ CLOUD' : locAvail === 'outlet_only' ? '🏪 OUTLET' : '🌐 BOTH';
        }
    } catch(e) {}
}

document.getElementById('menu-name')?.addEventListener('input', updateLivePreview);
document.getElementById('menu-price')?.addEventListener('input', updateLivePreview);
document.getElementById('menu-desc')?.addEventListener('input', updateLivePreview);
document.getElementById('menu-category')?.addEventListener('change', updateLivePreview);
document.querySelectorAll('input[name="menu-diet"]').forEach(r => r.addEventListener('change', updateLivePreview));
document.getElementById('menu-spicy')?.addEventListener('change', updateLivePreview);
document.querySelectorAll('input[name="menu-avail-input"]').forEach(r => r.addEventListener('change', updateLivePreview));
document.querySelectorAll('input[name="menu-location-avail"]').forEach(r => r.addEventListener('change', updateLivePreview));
document.getElementById('menu-prep-time')?.addEventListener('input', updateLivePreview);

document.getElementById('menu-image').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        // Show loading state
        const previewDiv = document.getElementById('menu-image-preview');
        previewDiv.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;font-size:12px;">Compressing...</div>`;
        previewDiv.style.display = 'block';

        try {
            // Compress image to max 800px width WebP
            const compressed = await compressImage(file, 800, 0.7);
            currentBase64Image = compressed;
            
            // Left Form Preview
            previewDiv.innerHTML = `<img src="${currentBase64Image}" style="width:100%; height:100%; object-fit:cover;">`;
            
            // Right Live Preview
            document.getElementById('lw-preview-img').src = currentBase64Image;
            document.getElementById('lw-preview-img').style.display = 'block';
            document.getElementById('lw-preview-placeholder').style.display = 'none';
        } catch(err) {
            // Fallback
            const reader = new FileReader();
            reader.onloadend = () => {
                currentBase64Image = reader.result;
                previewDiv.innerHTML = `<img src="${currentBase64Image}" style="width:100%; height:100%; object-fit:cover;">`;
                document.getElementById('lw-preview-img').src = currentBase64Image;
                document.getElementById('lw-preview-img').style.display = 'block';
                document.getElementById('lw-preview-placeholder').style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    }
});

window.cachedMenuItems = [];

async function fetchAndRenderMenu() {
    try {
        const menus = await apiCall('/menu');
        window.cachedMenuItems = menus || [];
        
        // Update stats across dashboard and sidebar
        const liveCount = (menus || []).filter(m => m.isAvailable !== false).length;
        const totalCount = (menus || []).length;
        
        const sideCountEl = document.getElementById('sidebar-menu-count');
        if (sideCountEl) sideCountEl.textContent = totalCount;
        
        const kpiMenuEl = document.getElementById('kpi-menu-count');
        if (kpiMenuEl) kpiMenuEl.textContent = liveCount || totalCount;
        
        const modMenuEl = document.getElementById('module-menu-stat');
        if (modMenuEl) modMenuEl.textContent = `${liveCount || totalCount} Items Active`;

        updateCategoryFilterOptions();
        renderMenuGrid();
        if (typeof renderDynamicDashboard === 'function') renderDynamicDashboard();
    } catch (e) { console.error(e); }
}

// Backwards compatibility alias
// loadMenu function defined at top

function updateCategoryFilterOptions() {
    const locFilter = document.getElementById('menu-filter-location')?.value || 'all';
    
    // Find all unique categories available in the selected location
    const availableCategories = new Set();
    const categories = window.cachedCategories || [];
    
    categories.forEach(cat => {
        if (cat.name && (cat.name === 'Craziest Deals of the Hour' || cat.name.toLowerCase().includes('craziest deal'))) return;
        if (locFilter === 'all' || cat.locationAvailability === locFilter || cat.locationAvailability === 'both' || !cat.locationAvailability) {
            availableCategories.add(cat.name);
        }
    });

    const catSelect = document.getElementById('menu-filter-category');
    if (!catSelect) return;
    
    const currentVal = catSelect.value;
    catSelect.innerHTML = '<option value="all">All Categories</option>';
    
    Array.from(availableCategories).sort().forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
    });

    // Restore previous selection if it's still available
    if (availableCategories.has(currentVal)) {
        catSelect.value = currentVal;
    } else {
        catSelect.value = 'all';
    }
}

function renderMenuGrid(searchQuery = '') {
    const container = document.getElementById('menu-grid-container');
    if (!container) return; // Prevent error if run before DOM update
    container.innerHTML = '';
    
    const locFilter = document.getElementById('menu-filter-location')?.value || 'all';
    const catFilter = document.getElementById('menu-filter-category')?.value || 'all';
    const dietFilter = document.getElementById('menu-filter-diet')?.value || 'all';
    const q = (searchQuery || '').toLowerCase().trim();

    // Filter items
    let filteredMenus = window.cachedMenuItems.filter(item => {
        // Exclude Craziest Deals from standard Menu Tab (they belong exclusively to Media & Content -> Craziest Deals)
        if (item.category === 'Craziest Deals of the Hour' || (item.category && item.category.toLowerCase().includes('craziest deal')) || item.isCraziestDeal === true) return false;
        let matchLoc = (locFilter === 'all' || item.locationAvailability === locFilter || item.locationAvailability === 'both');
        let matchCat = (catFilter === 'all' || item.category === catFilter || (!item.category && catFilter === 'Uncategorized'));
        let matchDiet = (dietFilter === 'all' || (dietFilter === 'veg' && item.isVeg) || (dietFilter === 'non-veg' && !item.isVeg));
        let matchQuery = !q || (item.name && item.name.toLowerCase().includes(q)) || (item.category && item.category.toLowerCase().includes(q));
        return matchLoc && matchCat && matchDiet && matchQuery;
    });

    if (filteredMenus.length === 0) {
        container.innerHTML = `<div style="color:#6b7280; text-align:center; padding:40px;">${q ? `No dishes matching "${q}" found.` : 'No items match the selected filters.'}</div>`;
        return;
    }

    // Group by category
    const grouped = {};
    filteredMenus.forEach(item => {
        const cat = item.category || 'Uncategorized';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });

    // Sort categories by displayOrder
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        const catA = (window.cachedCategories || []).find(c => c.name === a) || { displayOrder: 999 };
        const catB = (window.cachedCategories || []).find(c => c.name === b) || { displayOrder: 999 };
        return catA.displayOrder - catB.displayOrder;
    });

    // Render each category
    for (const category of sortedCategories) {
            const items = grouped[category];
            const section = document.createElement('div');
            
            const catObj = (window.cachedCategories || []).find(c => c.name === category);
            const orderStr = catObj ? `<span style="font-size:12px; font-weight:800; color:#9ca3af; background:#12141b; padding:4px 8px; border-radius:6px; border:1px solid #252830;">#${catObj.displayOrder}</span>` : '';

            // Category Header
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.gap = '12px';
            header.style.marginBottom = '16px';
            header.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    ${orderStr}
                    <h3 style="font-size:18px; font-weight:800; color:#fff; margin:0;">${category}</h3>
                </div>
                <span style="font-size:12px; font-weight:700; color:#9ca3af; background:#1a1c23; padding:4px 10px; border-radius:99px; border:1px solid #2e3140;">${items.length} items</span>
            `;
            section.appendChild(header);

            // Grid Container
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
            grid.style.gap = '20px';

            items.forEach(item => {
                const card = document.createElement('div');
                card.style.background = '#12141b';
                card.style.border = '1px solid #252830';
                card.style.borderRadius = '16px';
                card.style.overflow = 'hidden';
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.position = 'relative';

                let locBadge = '';
                if (item.locationAvailability === 'cloud_only') locBadge = '☁️ CLOUD ONLY';
                else if (item.locationAvailability === 'outlet_only') locBadge = '🏪 OUTLET ONLY';
                else locBadge = '🌐 BOTH LOCATIONS';

                card.innerHTML = `
                    <div style="width:100%; height:180px; background:#1a1c23; position:relative;">
                        ${item.image ? `<img src="${item.image}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#4b5563;">No Image</div>`}
                        <div style="position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.9); color:#000; font-size:9px; font-weight:900; padding:4px 8px; border-radius:6px; text-transform:uppercase; letter-spacing:1px; box-shadow:0 4px 12px rgba(0,0,0,0.2);">
                            ${locBadge}
                        </div>
                    </div>
                    <div style="padding:16px; flex:1; display:flex; flex-direction:column;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px;">
                            <h4 style="font-size:15px; font-weight:800; color:#fff; margin:0; line-height:1.3;">
                                <span style="font-size:12px; margin-right:4px;">${item.dietaryPreference === 'non-veg' ? '🔴' : '🟢'}</span>
                                ${item.name}
                            </h4>
                            <span style="font-size:16px; font-weight:900; color:#f59e0b;">₹${item.price}</span>
                        </div>
                        
                        <div style="display:flex; gap:8px; margin-top:auto; padding-top:16px; border-top:1px solid #1e2130;">
                            <button onclick="editMenu('${item._id}')" style="flex:1; background:rgba(255,255,255,0.05); border:1px solid #2e3140; color:#e5e7eb; padding:8px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">✏️ Edit</button>
                            <button onclick="toggleMenuStock('${item._id}', ${item.isAvailable})" style="flex:1; cursor:pointer; background:transparent; border:1px solid ${item.isAvailable ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}; color:${item.isAvailable ? '#22c55e' : '#ef4444'}; padding:8px; border-radius:8px; font-size:12px; font-weight:700; transition:all 0.2s;" onmouseover="this.style.background='${item.isAvailable ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}'" onmouseout="this.style.background='transparent'">${item.isAvailable ? '🟢 In Stock' : '🔴 Out of Stock'}</button>
                            <button onclick="deleteMenu('${item._id}')" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#ef4444; padding:8px 12px; border-radius:8px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.2)'" onmouseout="this.style.background='rgba(239,68,68,0.1)'">🗑</button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
            section.appendChild(grid);
            container.appendChild(section);
        }
}

document.getElementById('menu-filter-location')?.addEventListener('change', () => {
    updateCategoryFilterOptions();
    renderMenuGrid();
});

document.getElementById('menu-filter-category')?.addEventListener('change', () => {
    renderMenuGrid();
});

document.getElementById('menu-filter-diet')?.addEventListener('change', () => {
    renderMenuGrid();
});

document.getElementById('menu-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('menu-id').value;
    const body = {
        name: document.getElementById('menu-name').value,
        category: document.getElementById('menu-category').value,
        price: document.getElementById('menu-price').value,
        description: document.getElementById('menu-desc').value,
        isAvailable: document.querySelector('input[name="menu-avail-input"]:checked').value === 'true',
        dietaryPreference: document.querySelector('input[name="menu-diet"]:checked').value,
        isSpicy: document.getElementById('menu-spicy').checked,
        locationAvailability: document.querySelector('input[name="menu-location-avail"]:checked').value,
    };
    if (currentBase64Image) body.image = currentBase64Image;

    if (id) {
        await apiCall(`/menu/${id}`, 'PUT', body);
    } else {
        await apiCall('/menu', 'POST', body);
    }
    
    closeModal('menu-modal');
    loadMenu();
});

window.editMenu = async function(id) {
    if (!window.cachedMenuItems || window.cachedMenuItems.length === 0) {
        window.cachedMenuItems = await apiCall('/menu');
    }
    const item = window.cachedMenuItems.find(m => m._id === id);
    if (!item) return;

    document.getElementById('menu-modal-title').textContent = 'Edit Menu Item';
    document.getElementById('menu-id').value = item._id;
    document.getElementById('menu-name').value = item.name;
    document.getElementById('menu-category').value = item.category;
    document.getElementById('menu-price').value = item.price;
    document.getElementById('menu-desc').value = item.description || '';
    
    const isAvail = item.isAvailable !== false;
    const availRadio = document.querySelector(`input[name="menu-avail-input"][value="${isAvail}"]`);
    if (availRadio) availRadio.checked = true;
    
    const locAvail = item.locationAvailability || 'both';
    const locRadio = document.querySelector(`input[name="menu-location-avail"][value="${locAvail}"]`);
    if (locRadio) locRadio.checked = true;
    
    const dietVal = item.dietaryPreference || (item.isVeg ? 'veg' : 'non-veg') || 'veg';
    const dietRadio = document.querySelector(`input[name="menu-diet"][value="${dietVal}"]`);
    if (dietRadio) dietRadio.checked = true;
    
    document.getElementById('menu-spicy').checked = item.isSpicy || false;
    
    if (item.image) {
        currentBase64Image = item.image;
        const previewDiv = document.getElementById('menu-image-preview');
        if (previewDiv) {
            previewDiv.innerHTML = `<img src="${item.image}" style="width:100%; height:100%; object-fit:contain;">`;
            previewDiv.style.display = 'block';
        }
        
        const lwPrev = document.getElementById('lw-preview-img');
        const lwPlace = document.getElementById('lw-preview-placeholder');
        if (lwPrev) {
            lwPrev.src = item.image;
            lwPrev.style.display = 'block';
        }
        if (lwPlace) lwPlace.style.display = 'none';
    } else {
        currentBase64Image = '';
        const previewDiv = document.getElementById('menu-image-preview');
        if (previewDiv) {
            previewDiv.innerHTML = '';
            previewDiv.style.display = 'none';
        }
        
        const lwPrev = document.getElementById('lw-preview-img');
        const lwPlace = document.getElementById('lw-preview-placeholder');
        if (lwPrev) lwPrev.style.display = 'none';
        if (lwPlace) lwPlace.style.display = 'flex';
    }
    
    window.updateLivePreview();
    window.openModal('menu-modal');
};

window.editMenuItem = window.editMenu;

window.deleteMenu = async function(id) {
    if (await showConfirm('Delete Menu Item', 'Are you sure you want to permanently delete this item?')) {
        await apiCall(`/menu/${id}`, 'DELETE');
        window.showAdminToast('Menu dish deleted successfully!', 'success');
        loadMenu();
    }
};

window.toggleMenuStock = async function(id, currentStatus) {
    const isAvail = !currentStatus;
    try {
        await apiCall(`/menu/${id}`, 'PUT', { isAvailable: isAvail });
        window.showAdminToast(isAvail ? 'Dish marked as In Stock!' : 'Dish marked as Out of Stock!', 'info');
        loadMenu();
    } catch(e) {
        window.showAdminToast('Failed to update dish status', 'error');
    }
};

window.editReel = function(id) {
    const reel = (adminReelsList || []).find(r => r._id === id);
    if (reel) {
        window.openReelModal(reel);
    }
};

window.deleteReel = async function(id) {
    if (!confirm('Are you sure you want to delete this reel video?')) return;
    try {
        const res = await fetch(`${API_URL}/reels/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            }
        });
        if (res.ok) {
            window.showAdminToast('Reel deleted successfully!', 'success');
            fetchReels();
        } else {
            window.showAdminToast('Failed to delete reel', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error deleting reel', 'error');
    }
};

window.renderAnalyticsData = function() {
    const menus = window.cachedMenuItems || [];
    
    // Total dishes
    const totalDishesEl = document.getElementById('analytics-total-dishes');
    if (totalDishesEl) totalDishesEl.textContent = menus.length;
    
    // Average price
    const avgPriceEl = document.getElementById('analytics-avg-price');
    if (avgPriceEl) {
        const prices = menus.map(m => Number(m.price) || 0).filter(p => p > 0);
        const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
        avgPriceEl.textContent = `₹${avg}`;
    }
    
    // Veg vs Non-Veg
    const vegCount = menus.filter(m => m.dietaryPreference === 'veg' || (!m.dietaryPreference && !m.diet && !m.isNonVeg)).length;
    const nonVegCount = menus.length - vegCount;
    const vegPct = menus.length ? Math.round((vegCount / menus.length) * 100) : 0;
    const nonVegPct = 100 - vegPct;
    
    const vegEl = document.getElementById('analytics-veg-dishes');
    const vegPctEl = document.getElementById('analytics-veg-pct');
    if (vegEl) vegEl.textContent = `${vegCount} Items`;
    if (vegPctEl) vegPctEl.textContent = `${vegPct}% of Menu Catalog`;
    
    const nonVegEl = document.getElementById('analytics-nonveg-dishes');
    const nonVegPctEl = document.getElementById('analytics-nonveg-pct');
    if (nonVegEl) nonVegEl.textContent = `${nonVegCount} Items`;
    if (nonVegPctEl) nonVegPctEl.textContent = `${nonVegPct}% of Menu Catalog`;
    
    // Categories Distribution Bars
    const catBarsContainer = document.getElementById('analytics-categories-bars');
    if (catBarsContainer) {
        const counts = {};
        menus.forEach(m => {
            const cat = m.category || 'General Menu';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const maxVal = sorted[0] ? sorted[0][1] : 1;
        
        const colors = ['#f04e23', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];
        catBarsContainer.innerHTML = sorted.slice(0, 6).map(([cat, count], idx) => {
            const pct = Math.round((count / menus.length) * 100);
            const color = colors[idx % colors.length];
            return `
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;">
                        <span style="color:#fff; font-weight:600;">${cat}</span>
                        <strong style="color:${color};">${count} dishes (${pct}%)</strong>
                    </div>
                    <div style="width:100%; height:8px; background:var(--bg-card-inner); border-radius:4px; overflow:hidden;">
                        <div style="width:${(count / maxVal) * 100}%; height:100%; background:${color}; border-radius:4px;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Location Breakdown
    const locContainer = document.getElementById('analytics-location-breakdown');
    if (locContainer) {
        const cloudCount = menus.filter(m => m.locationAvailability === 'cloud_only').length;
        const outletCount = menus.filter(m => m.locationAvailability === 'outlet_only').length;
        const bothCount = menus.filter(m => m.locationAvailability === 'both' || !m.locationAvailability).length;
        locContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
                <span>☁️ Cloud Kitchen Only:</span> <strong style="color:#fff;">${cloudCount} items</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
                <span>🏪 Dine-in Outlet Only:</span> <strong style="color:#fff;">${outletCount} items</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
                <span>🌐 Both Locations:</span> <strong style="color:#4ade80;">${bothCount} items</strong>
            </div>
        `;
    }
    
    // Price Brackets
    const priceContainer = document.getElementById('analytics-price-brackets');
    if (priceContainer) {
        const under100 = menus.filter(m => (m.price || 0) < 100).length;
        const p100to200 = menus.filter(m => (m.price || 0) >= 100 && (m.price || 0) <= 200).length;
        const above200 = menus.filter(m => (m.price || 0) > 200).length;
        priceContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
                <span>Pocket Friendly (&lt; ₹100):</span> <strong style="color:#fff;">${under100} dishes</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
                <span>Mid Range (₹100 – ₹200):</span> <strong style="color:#fff;">${p100to200} dishes</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
                <span>Premium Platters (&gt; ₹200):</span> <strong style="color:#f59e0b;">${above200} dishes</strong>
            </div>
        `;
    }
};

// =======================
// CATEGORIES LOGIC
// =======================
window.cachedCategories = [];

async function loadCategories() {
    try {
        const items = await apiCall('/categories');
        window.cachedCategories = items;
        if (typeof renderDynamicDashboard === 'function') renderDynamicDashboard();
        
        // Populate List in Modal
        const listContainer = document.getElementById('categories-list-container');
        if (listContainer) {
            listContainer.innerHTML = '';
            if (items.length === 0) {
                listContainer.innerHTML = '<div style="color:#6b7280; font-size:12px; font-style:italic;">No categories found.</div>';
            } else {
                items.forEach(item => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.justifyContent = 'space-between';
                    row.style.background = '#1a1c23';
                    row.style.border = '1px solid #2e3140';
                    row.style.borderRadius = '8px';
                    row.style.padding = '10px 14px';
                    
                    let locBadge = '🌐 Both';
                    let locColor = '#F5A800';
                    if (item.locationAvailability === 'cloud_only') { locBadge = '☁️ Cloud'; locColor = '#60a5fa'; }
                    else if (item.locationAvailability === 'outlet_only') { locBadge = '🏪 Outlet'; locColor = '#34d399'; }

                    row.innerHTML = `
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span style="color:#9ca3af; font-size:12px; font-weight:800; background:#12141b; padding:4px 8px; border-radius:6px; border:1px solid #252830;">#${item.displayOrder}</span>
                            <strong style="color:#fff; font-size:14px;">${item.name}</strong>
                            <span style="font-size:10px; font-weight:800; text-transform:uppercase; color:${locColor}; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">${locBadge}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <label class="switch" style="transform: scale(0.7); margin: 0;" title="Toggle Stock for Entire Category">
                                <input type="checkbox" onchange="toggleCategoryStock('${item._id}', this.checked)" ${item.isAvailable !== false ? 'checked' : ''}>
                                <span class="slider round"></span>
                            </label>
                            <button onclick="editCategory('${item._id}')" style="background:rgba(255,255,255,0.05); color:#e5e7eb; border:1px solid #2e3140; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">EDIT</button>
                            <button onclick="deleteCategory('${item._id}')" style="background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); padding:6px 12px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">DEL</button>
                        </div>
                    `;
                    listContainer.appendChild(row);
                });
            }
        }

        // Populate Dropdown in Menu Form
        const select = document.getElementById('menu-category');
        if (select) {
            const currentVal = select.value;
            select.innerHTML = '<option value="">-- Select Category --</option>';
            items.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.name;
                opt.textContent = cat.name;
                select.appendChild(opt);
            });
            if (currentVal) select.value = currentVal;
        }

    } catch (e) { console.error(e); }
}

document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('category-id').value;
    const body = {
        name: document.getElementById('category-name').value,
        displayOrder: document.getElementById('category-order').value || 0,
        locationAvailability: document.getElementById('category-location').value || 'both'
    };

    if (id) {
        await apiCall(`/categories/${id}`, 'PUT', body);
    } else {
        await apiCall('/categories', 'POST', body);
    }
    
    // Reset Form
    document.getElementById('category-id').value = '';
    document.getElementById('category-name').value = '';
    document.getElementById('category-order').value = '0';
    document.getElementById('category-location').value = 'both';
    document.querySelector('#category-form button[type="submit"]').textContent = 'ADD';

    // Reload list without closing modal
    loadCategories();
    // Re-render menu to update filter logic
    if (typeof updateCategoryFilterOptions === 'function') {
        updateCategoryFilterOptions();
    }
});

async function editCategory(id) {
    const items = window.cachedCategories || [];
    const item = items.find(i => i._id === id);
    if (!item) return;

    document.getElementById('category-id').value = item._id;
    document.getElementById('category-name').value = item.name;
    document.getElementById('category-order').value = item.displayOrder;
    document.getElementById('category-location').value = item.locationAvailability || 'both';
    document.querySelector('#category-form button[type="submit"]').textContent = 'UPDATE';
}

async function deleteCategory(id) {
    if (await showConfirm('Delete Category', 'Are you sure? Menu items under this category might lose their grouping.')) {
        await apiCall(`/categories/${id}`, 'DELETE');
        loadCategories();
    }
}

async function toggleCategoryStock(id, isAvailable) {
    try {
        await apiCall(`/categories/${id}/toggle-stock`, 'PUT', { isAvailable });
        loadCategories();
        loadMenu(); // Refresh the main menu grid to reflect item-level stock changes
        showToast(`Category marked ${isAvailable ? 'In Stock' : 'Out of Stock'}`, 'success');
    } catch (err) {
        console.error(err);
        showToast('Failed to toggle category stock', 'error');
        loadCategories(); // Revert toggle state
    }
}

// =======================
// ANNOUNCEMENTS LOGIC
// =======================
let currentAnnouncementImage = '';

// Compress image to WebP before uploading (reduces ~2MB to ~150KB)
function compressImage(file, maxWidth = 1200, quality = 0.72) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP with compression
                const compressed = canvas.toDataURL('image/webp', quality);
                resolve(compressed);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

document.getElementById('announcement-image').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        const previewDiv = document.getElementById('announcement-image-preview');
        previewDiv.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;font-size:12px;">Compressing...</div>`;
        previewDiv.style.display = 'block';
        document.getElementById('announcement-image-placeholder').style.display = 'none';

        try {
            const compressed = await compressImage(file);
            currentAnnouncementImage = compressed;
            previewDiv.innerHTML = `<img src="${currentAnnouncementImage}" style="width:100%; height:100%; object-fit:cover;">`;

            // Show size info
            const originalKB = Math.round(file.size / 1024);
            const compressedKB = Math.round((compressed.length * 0.75) / 1024);
            console.log(`Image compressed: ${originalKB}KB → ~${compressedKB}KB`);
        } catch(err) {
            const reader = new FileReader();
            reader.onload = (e) => {
                currentAnnouncementImage = e.target.result;
                previewDiv.innerHTML = `<img src="${currentAnnouncementImage}" style="width:100%; height:100%; object-fit:cover;">`;
            };
            reader.readAsDataURL(file);
        }
    }
});

window.renderAnnouncements = function(filterQuery = '') {
    const container = document.getElementById('announcements-list-container');
    if (!container) return;
    let items = window.cachedAnnouncements || [];
    const q = (filterQuery || '').toLowerCase().trim();
    if (q) {
        items = items.filter(a => (a.title && a.title.toLowerCase().includes(q)) || (a.content && a.content.toLowerCase().includes(q)));
    }
    if (items.length === 0) {
        container.innerHTML = `<div style="color:#6b7280; text-align:center; padding:20px;">No announcements found${q ? ` matching "${q}"` : ''}.</div>`;
        return;
    }
    container.innerHTML = '';
    items.forEach((item, index) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '16px';
        row.style.padding = '12px';
        row.style.background = '#1a1c23';
        row.style.borderRadius = '12px';
        row.style.border = '1px solid #2e3140';

        const isActive = item.isActive !== false;
        let expiryText = 'NO EXPIRY';
        if (item.expiry) {
            expiryText = new Date(item.expiry).toLocaleDateString('en-GB');
        }

        row.innerHTML = `
            <div style="width:24px; text-align:center; color:#4b5563; font-weight:800; font-size:12px;">≡</div>
            <div style="width:120px; height:68px; background:#12141b; border-radius:8px; overflow:hidden; border:1px solid #252830; flex-shrink:0;">
                ${item.image ? `<img src="${item.image}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#4b5563; font-size:10px;">NO IMAGE</div>`}
            </div>
            <div style="flex:1;">
                <h4 style="margin:0 0 6px 0; font-size:15px; font-weight:800; color:#fff;">${item.title || '(No title)'}</h4>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="background:${isActive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}; color:${isActive ? '#22c55e' : '#ef4444'}; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:800; text-transform:uppercase;">${isActive ? 'Live' : 'Hidden'}</span>
                    <span style="color:#6b7280; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">ENDS: ${expiryText}</span>
                    <span style="color:#4b5563; font-size:10px; font-weight:800;">#${items.length - index}</span>
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <button onclick="toggleAnnouncement('${item._id}', ${isActive})" style="padding:8px 16px; background:rgba(255,255,255,0.05); border:1px solid #2e3140; color:#e5e7eb; border-radius:8px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">${isActive ? 'HIDE' : 'SHOW'}</button>
                <button onclick="deleteAnnouncement('${item._id}')" style="padding:8px 16px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#ef4444; border-radius:8px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.background='rgba(239,68,68,0.2)'" onmouseout="this.style.background='rgba(239,68,68,0.1)'">DELETE</button>
            </div>
        `;
        container.appendChild(row);
    });
};

async function loadAnnouncements() {
    try {
        const items = await apiCall('/announcements');
        window.cachedAnnouncements = items || [];
        if (typeof renderDynamicDashboard === 'function') renderDynamicDashboard();
        window.renderAnnouncements(document.getElementById('global-search-input')?.value || '');
    } catch (e) { console.error(e); }
}

document.getElementById('announcement-inline-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('announcement-title').value.trim();
    const link = document.getElementById('announcement-link').value.trim();
    const expiry = document.getElementById('announcement-expiry').value;

    if (!title && !currentAnnouncementImage) {
        showToast('Please provide a title or image for the announcement', 'error');
        return;
    }

    const payload = {
        title,
        link,
        image: currentAnnouncementImage,
        expiry: expiry || null,
        isActive: true
    };

    try {
        await apiCall('/announcements', 'POST', payload);
        showToast('Announcement published successfully!', 'success');
        
        // Reset form
        document.getElementById('announcement-title').value = '';
        document.getElementById('announcement-link').value = '';
        document.getElementById('announcement-expiry').value = '';
        currentAnnouncementImage = '';
        document.getElementById('announcement-image-preview').style.display = 'none';
        document.getElementById('announcement-image-placeholder').style.display = 'block';

        loadAnnouncements();
    } catch (err) {
        console.error(err);
        showToast('Failed to save announcement', 'error');
    }
});

async function toggleAnnouncement(id, currentStatus) {
    try {
        await apiCall(`/announcements/${id}`, 'PUT', { isActive: !currentStatus });
        loadAnnouncements();
        showToast(`Announcement ${!currentStatus ? 'activated' : 'hidden'}`, 'success');
    } catch (err) {
        console.error(err);
        showToast('Failed to update announcement', 'error');
    }
}

async function deleteAnnouncement(id) {
    if (await showConfirm('Delete Announcement', 'Are you sure you want to permanently delete this announcement?')) {
        await apiCall(`/announcements/${id}`, 'DELETE');
        loadAnnouncements();
        showToast('Announcement deleted', 'success');
    }
}

// =======================
// COUPONS LOGIC
// =======================
window.renderCoupons = function(filterQuery = '') {
    const tbody = document.getElementById('coupons-tbody');
    if (!tbody) return;
    let items = window.cachedCoupons || [];
    const q = (filterQuery || '').toLowerCase().trim();
    if (q) {
        items = items.filter(c => (c.code && c.code.toLowerCase().includes(q)) || (c.discountType && c.discountType.toLowerCase().includes(q)));
    }
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">No coupons found${q ? ` matching "${q}"` : ''}.</td></tr>`;
        return;
    }
    tbody.innerHTML = items.map(item => `
        <tr>
            <td><strong>${item.code}</strong></td>
            <td>${item.discountType === 'percentage' ? '%' : 'Fixed'}</td>
            <td>${item.discountValue}</td>
            <td>₹${item.minOrderValue}</td>
            <td><span class="badge ${item.isActive ? 'active' : 'inactive'}">${item.isActive ? 'Yes' : 'No'}</span></td>
            <td>
                <button class="btn-sm btn-edit" onclick="editCoupon('${item._id}')">Edit</button>
                <button class="btn-sm btn-delete" onclick="deleteCoupon('${item._id}')">Del</button>
            </td>
        </tr>
    `).join('');
};

async function loadCoupons() {
    try {
        const items = await apiCall('/coupons');
        window.cachedCoupons = items || [];
        if (typeof renderDynamicDashboard === 'function') renderDynamicDashboard();
        window.renderCoupons(document.getElementById('global-search-input')?.value || '');
    } catch (e) { console.error(e); }
}

document.getElementById('coupon-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('coupon-id').value;
    const body = {
        code: document.getElementById('coupon-code').value.toUpperCase(),
        discountType: document.getElementById('coupon-type').value,
        discountValue: document.getElementById('coupon-value').value,
        minOrderValue: document.getElementById('coupon-min-order').value || 0,
        isActive: document.getElementById('coupon-active').checked,
    };

    if (id) {
        await apiCall(`/coupons/${id}`, 'PUT', body);
    } else {
        await apiCall('/coupons', 'POST', body);
    }
    
    closeModal('coupon-modal');
    loadCoupons();
});

async function editCoupon(id) {
    const items = await apiCall('/coupons');
    const item = items.find(i => i._id === id);
    if (!item) return;

    document.getElementById('coupon-modal-title').textContent = 'Edit Coupon';
    document.getElementById('coupon-id').value = item._id;
    document.getElementById('coupon-code').value = item.code;
    document.getElementById('coupon-type').value = item.discountType;
    document.getElementById('coupon-value').value = item.discountValue;
    document.getElementById('coupon-min-order').value = item.minOrderValue;
    document.getElementById('coupon-active').checked = item.isActive;
    
    openModal('coupon-modal');
}

async function deleteCoupon(id) {
    if (await showConfirm('Delete Coupon', 'Are you sure you want to delete this coupon?')) {
        await apiCall(`/coupons/${id}`, 'DELETE');
        loadCoupons();
    }
}

// =======================
// STORE SETTINGS & SCHEDULE LOGIC
// =======================

let cachedStoreSettings = [];

function toggleAutoSchedule(storeId) {
    const autoEl = document.getElementById(`${storeId}-auto`);
    const manualGroup = document.getElementById(`${storeId}-manual-group`);
    if (!autoEl || !manualGroup) return;
    const isAuto = autoEl.checked;
    if (isAuto) {
        manualGroup.style.display = 'none';
    } else {
        manualGroup.style.display = 'block';
        toggleReasonInput(storeId);
    }
}

function toggleReasonInput(storeId) {
    const onlineEl = document.getElementById(`${storeId}-online`);
    const reasonGroup = document.getElementById(`${storeId}-reason-group`);
    if (!onlineEl || !reasonGroup) return;
    const isOnline = onlineEl.checked;
    if (isOnline) {
        reasonGroup.style.display = 'none';
    } else {
        reasonGroup.style.display = 'block';
    }
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function openScheduleModal(storeId) {
    const store = cachedStoreSettings.find(s => s.storeId === storeId);
    if (!store) return;
    
    document.getElementById('schedule-store-id').value = storeId;
    document.getElementById('schedule-modal-title').textContent = `Weekly Schedule: ${store.storeName}`;
    
    const container = document.getElementById('schedule-days-container');
    container.innerHTML = '';
    
    const schedule = store.schedule || {};
    
    DAYS_OF_WEEK.forEach(day => {
        const dayData = schedule[day] || { isOpen: day !== 'sunday', openTime: '09:00', closeTime: '22:00', closedReason: 'Closed for the day' };
        
        const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
        
        const rowHTML = `
            <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <span style="font-weight:700; color:#fff;">${dayLabel}</span>
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                        <input type="checkbox" id="sched-open-${day}" ${dayData.isOpen ? 'checked' : ''} onchange="toggleDayInputs('${day}')">
                        <span style="font-size:13px; color:var(--text-secondary);">Open</span>
                    </label>
                </div>
                
                <div id="sched-time-group-${day}" style="display:flex; gap:12px; align-items:center; ${dayData.isOpen ? '' : 'display:none;'}">
                    <div style="flex:1;">
                        <label style="font-size:11px; color:var(--text-secondary);">Open Time</label>
                        <input type="time" id="sched-opentime-${day}" value="${dayData.openTime}" style="width:100%; padding:8px; border-radius:6px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff;">
                    </div>
                    <span style="color:var(--text-secondary);">to</span>
                    <div style="flex:1;">
                        <label style="font-size:11px; color:var(--text-secondary);">Close Time</label>
                        <input type="time" id="sched-closetime-${day}" value="${dayData.closeTime}" style="width:100%; padding:8px; border-radius:6px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff;">
                    </div>
                </div>
                
                <div id="sched-reason-group-${day}" style="margin-top:8px; ${!dayData.isOpen ? '' : 'display:none;'}">
                    <label style="font-size:11px; color:var(--text-secondary);">Closed Reason Message (Shown on Website)</label>
                    <input type="text" id="sched-reason-${day}" value="${dayData.closedReason}" placeholder="e.g. Closed on Sundays" style="width:100%; padding:8px; border-radius:6px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff;">
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHTML);
    });
    
    openModal('schedule-modal');
}

window.toggleDayInputs = function(day) {
    const isOpen = document.getElementById(`sched-open-${day}`).checked;
    document.getElementById(`sched-time-group-${day}`).style.display = isOpen ? 'flex' : 'none';
    document.getElementById(`sched-reason-group-${day}`).style.display = !isOpen ? 'block' : 'none';
}

document.getElementById('schedule-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const storeId = document.getElementById('schedule-store-id').value;
    
    const newSchedule = {};
    DAYS_OF_WEEK.forEach(day => {
        newSchedule[day] = {
            isOpen: document.getElementById(`sched-open-${day}`).checked,
            openTime: document.getElementById(`sched-opentime-${day}`).value,
            closeTime: document.getElementById(`sched-closetime-${day}`).value,
            closedReason: document.getElementById(`sched-reason-${day}`).value
        };
    });
    
    try {
        await apiCall(`/settings/${storeId}`, 'PUT', { schedule: newSchedule });
        closeModal('schedule-modal');
        window.showAdminToast('Weekly Schedule Saved & Synced!', "success");
        loadStoreSettings();
    } catch (err) {
        window.showAdminToast('Error saving schedule', "error");
    }
});

async function loadStoreSettings() {
    try {
        const settings = await apiCall('/settings');
        cachedStoreSettings = settings;
        
        let anyOnline = false;

        // Primary signal: cloud kitchen online status drives the header pill.
        // If cloud is explicitly offline (isOnline===false), the whole ordering is paused.
        const cloudDoc  = settings.find(s => s.storeId === 'cloud');
        const outletDoc = settings.find(s => s.storeId === 'outlet');
        if (cloudDoc) {
            // Cloud kitchen is the master — use its value
            anyOnline = cloudDoc.isOnline !== false;
        } else {
            // Fallback: any store online
            settings.forEach(s => { if (s.isOnline) anyOnline = true; });
        }
            
        // Populate each store's toggle controls
        settings.forEach(setting => {
            const idPrefix = setting.storeId;
            const autoEl    = document.getElementById(`${idPrefix}-auto`);
            const isOnlineEl = document.getElementById(`${idPrefix}-online`);
            const reasonEl  = document.getElementById(`${idPrefix}-reason`);
            if (autoEl && isOnlineEl && reasonEl) {
                autoEl.checked    = setting.autoSchedule || false;
                isOnlineEl.checked = setting.isOnline;
                reasonEl.value    = setting.offlineReason || '';
                toggleAutoSchedule(idPrefix);
            }
        });

        // Populate Distance Delivery Pricing
        const cloudSetting = settings.find(s => s.storeId === 'cloud') || settings[0];
        if (cloudSetting) {
            const rateEl = document.getElementById('setting-delivery-rate-km');
            const timeEl = document.getElementById('setting-delivery-est-time');
            if (rateEl) {
                const rate = cloudSetting.deliveryRateKm !== undefined ? cloudSetting.deliveryRateKm : (cloudSetting.deliveryRate || 30);
                rateEl.value = rate;
            }
            if (timeEl && cloudSetting.deliveryEstTime) timeEl.value = cloudSetting.deliveryEstTime;
        }

        // Update Header Switch & Dashboard Status Indicators
        const headerSwitch = document.getElementById('header-store-switch');
        const storeIndicator = document.getElementById('store-status-indicator');
        const storeStatusLabel = document.getElementById('store-status-label');
        const headerStatusPill = document.getElementById('header-status-pill');
        const headerStatusText = document.getElementById('header-status-text');
        const dbStoreStatusBadge = document.getElementById('db-store-status-badge');
        const dbTodayPill = document.getElementById('db-today-schedule-pill');
        const dbOrderingStatus = document.getElementById('db-ordering-status');
        const dbDeliveryStatus = document.getElementById('db-delivery-status');

        if (anyOnline) {
            if (headerSwitch) headerSwitch.checked = true;
            if (storeIndicator) storeIndicator.classList.remove('offline');
            if (storeStatusLabel) storeStatusLabel.textContent = 'Restaurant Open';
            if (headerStatusPill) headerStatusPill.classList.remove('offline');
            if (headerStatusText) headerStatusText.textContent = 'Restaurant Open';
            if (dbStoreStatusBadge) {
                dbStoreStatusBadge.className = 'badge active';
                dbStoreStatusBadge.textContent = '● Open';
            }
            if (dbTodayPill) {
                dbTodayPill.className = 'status-badge-pill active';
                dbTodayPill.textContent = 'Open';
            }
            if (dbOrderingStatus) {
                dbOrderingStatus.className = 'status-badge-pill active';
                dbOrderingStatus.textContent = 'Enabled';
            }
            if (dbDeliveryStatus) {
                dbDeliveryStatus.className = 'status-badge-pill active';
                dbDeliveryStatus.textContent = 'Enabled';
            }
        } else {
            if (headerSwitch) headerSwitch.checked = false;
            if (storeIndicator) storeIndicator.classList.add('offline');
            if (storeStatusLabel) storeStatusLabel.textContent = 'Restaurant Closed';
            if (headerStatusPill) headerStatusPill.classList.add('offline');
            if (headerStatusText) headerStatusText.textContent = 'Restaurant Closed';
            if (dbStoreStatusBadge) {
                dbStoreStatusBadge.className = 'badge cancelled';
                dbStoreStatusBadge.textContent = '● Closed';
            }
            if (dbTodayPill) {
                dbTodayPill.className = 'status-badge-pill danger';
                dbTodayPill.textContent = 'Closed';
            }
            if (dbOrderingStatus) {
                dbOrderingStatus.className = 'status-badge-pill danger';
                dbOrderingStatus.textContent = 'Paused (Offline)';
            }
            if (dbDeliveryStatus) {
                dbDeliveryStatus.className = 'status-badge-pill danger';
                dbDeliveryStatus.textContent = 'Paused (Offline)';
            }
        }
        if (typeof renderDynamicDashboard === 'function') renderDynamicDashboard();

        // Auto-reopen if offlineUntil timer has expired
        autoReopenIfTimePassed();
    } catch (e) { console.error(e); }
}

async function saveStoreSetting(storeId) {
    const autoSchedule = document.getElementById(`${storeId}-auto`).checked;
    const isOnline = document.getElementById(`${storeId}-online`).checked;
    const offlineReason = document.getElementById(`${storeId}-reason`).value;
    
    try {
        await apiCall(`/settings/${storeId}`, 'PUT', { autoSchedule, isOnline, offlineReason });
        window.showAdminToast(`${storeId.toUpperCase()} settings saved!`, 'success');
        loadStoreSettings();
    } catch (e) {
        window.showAdminToast(`Error saving ${storeId} settings`, "error");
    }
}

// ==========================================
// ZOMATO/SWIGGY-STYLE OFFLINE / STATUS FLOW CONTROLLER
// ==========================================
let currentOfflineMode = 'now';

window.openOfflineStatusModal = async function() {
    const modal = document.getElementById('offline-status-modal');
    if (!modal) return;

    // Refresh live store state
    try {
        const settings = await apiCall('/settings');
        cachedStoreSettings = settings;
    } catch(e) {}

    const settings = cachedStoreSettings || [];
    const cloudDoc = settings.find(s => s.storeId === 'cloud');
    const isOnline = cloudDoc ? (cloudDoc.isOnline !== false) : settings.some(s => s.isOnline !== false);
    const store = cloudDoc || settings[0] || {};

    const badgeEl = document.getElementById('offline-modal-current-badge');
    const quickOnlineBtn = document.getElementById('offline-modal-quick-online-btn');

    if (isOnline) {
        if (badgeEl) {
            badgeEl.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e;"></span><span style="color:#4ade80; font-weight:700;">Receiving orders (Online)</span>`;
        }
        if (quickOnlineBtn) quickOnlineBtn.style.display = 'none';
        goToOfflineStep(1);
    } else {
        const reason = store.offlineReason || 'Kitchen is offline';
        const dur = store.offlineDuration || 'Until turned back on';
        if (badgeEl) {
            badgeEl.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444;"></span><span style="color:#f87171; font-weight:700;">Offline (${reason})</span>`;
        }
        if (quickOnlineBtn) quickOnlineBtn.style.display = 'inline-block';
        goToOfflineStep(1);
    }

    modal.classList.remove('hidden');
    modal.classList.add('show');
};

window.quickToggleStoreModal = window.openOfflineStatusModal;

window.goToOfflineStep = function(stepNum, mode = null) {
    if (mode) currentOfflineMode = mode;
    if (mode === 'schedule') {
        closeModal('offline-status-modal');
        openScheduleModal('cloud');
        return;
    }

    document.getElementById('offline-step-1').style.display = stepNum === 1 ? 'block' : 'none';
    document.getElementById('offline-step-2').style.display = stepNum === 2 ? 'block' : 'none';
    document.getElementById('offline-step-3').style.display = stepNum === 3 ? 'block' : 'none';
};

window.confirmGoOffline = async function() {
    const reasonRadio = document.querySelector('input[name="offline-reason-radio"]:checked')?.value || 'Temporarily closed';
    const customReason = document.getElementById('offline-custom-reason-input')?.value?.trim();
    const finalReason = customReason || reasonRadio;

    const duration = document.querySelector('input[name="offline-duration-radio"]:checked')?.value || '30 minutes';

    // Optimistic UI Update (Immediate visual feedback)
    const headerSwitch = document.getElementById('header-store-switch');
    const storeIndicator = document.getElementById('store-status-indicator');
    const storeStatusLabel = document.getElementById('store-status-label');
    const dbStoreStatusBadge = document.getElementById('db-store-status-badge');
    const dbTodayPill = document.getElementById('db-today-schedule-pill');
    const dbOrderingStatus = document.getElementById('db-ordering-status');
    const dbDeliveryStatus = document.getElementById('db-delivery-status');

    if (headerSwitch) headerSwitch.checked = false;
    if (storeIndicator) storeIndicator.classList.add('offline');
    if (storeStatusLabel) storeStatusLabel.textContent = 'Restaurant Closed';
    if (dbStoreStatusBadge) { dbStoreStatusBadge.className = 'badge cancelled'; dbStoreStatusBadge.textContent = '● Closed'; }
    if (dbTodayPill) { dbTodayPill.className = 'status-badge-pill danger'; dbTodayPill.textContent = 'Closed'; }
    if (dbOrderingStatus) { dbOrderingStatus.className = 'status-badge-pill danger'; dbOrderingStatus.textContent = 'Paused (Offline)'; }
    if (dbDeliveryStatus) { dbDeliveryStatus.className = 'status-badge-pill danger'; dbDeliveryStatus.textContent = 'Paused (Offline)'; }

    // Calculate offlineUntil ISO date
    const now = new Date();
    let untilDate = new Date(now);
    if (duration === '30 minutes') {
        untilDate = new Date(now.getTime() + 30 * 60 * 1000);
    } else if (duration === '2 hours') {
        untilDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    } else if (duration === 'Tomorrow, opening time') {
        untilDate.setDate(untilDate.getDate() + 1);
        untilDate.setHours(9, 0, 0, 0);
    } else {
        untilDate = null;
    }

    const payload = {
        isOnline: false,
        autoSchedule: false,
        offlineReason: finalReason,
        offlineDuration: duration,
        offlineUntil: untilDate ? untilDate.toISOString() : '',
        offlineType: currentOfflineMode
    };

    try {
        await apiCall('/settings/cloud', 'PUT', payload);
        await apiCall('/settings/outlet', 'PUT', payload);

        window.showAdminToast(`🔴 Restaurant is now OFFLINE (${finalReason})`, 'warning', 'Restaurant Closed');
        closeModal('offline-status-modal');
        loadStoreSettings();
    } catch(e) {
        console.error(e);
        window.showAdminToast('Failed to update restaurant status', 'error');
        loadStoreSettings();
    }
};

window.confirmGoOnline = async function() {
    // Optimistic UI Update (Immediate visual feedback)
    const headerSwitch = document.getElementById('header-store-switch');
    const storeIndicator = document.getElementById('store-status-indicator');
    const storeStatusLabel = document.getElementById('store-status-label');
    const dbStoreStatusBadge = document.getElementById('db-store-status-badge');
    const dbTodayPill = document.getElementById('db-today-schedule-pill');
    const dbOrderingStatus = document.getElementById('db-ordering-status');
    const dbDeliveryStatus = document.getElementById('db-delivery-status');

    if (headerSwitch) headerSwitch.checked = true;
    if (storeIndicator) storeIndicator.classList.remove('offline');
    if (storeStatusLabel) storeStatusLabel.textContent = 'Restaurant Open';
    if (dbStoreStatusBadge) { dbStoreStatusBadge.className = 'badge active'; dbStoreStatusBadge.textContent = '● Open'; }
    if (dbTodayPill) { dbTodayPill.className = 'status-badge-pill active'; dbTodayPill.textContent = 'Open'; }
    if (dbOrderingStatus) { dbOrderingStatus.className = 'status-badge-pill active'; dbOrderingStatus.textContent = 'Enabled'; }
    if (dbDeliveryStatus) { dbDeliveryStatus.className = 'status-badge-pill active'; dbDeliveryStatus.textContent = 'Enabled'; }

    const payload = {
        isOnline: true,
        offlineReason: '',
        offlineDuration: '',
        offlineUntil: '',
        autoSchedule: false
    };

    try {
        await apiCall('/settings/cloud', 'PUT', payload);
        await apiCall('/settings/outlet', 'PUT', payload);

        window.showAdminToast(`🟢 Restaurant is now ONLINE & Receiving Orders!`, 'success', 'Restaurant Open');
        closeModal('offline-status-modal');
        loadStoreSettings();
    } catch(e) {
        console.error(e);
        window.showAdminToast('Failed to update restaurant status', 'error');
        loadStoreSettings();
    }
};

// ---------------------------------------------------------------
// AUTO-REOPEN: If offlineUntil has passed, automatically go online
// Called every time store settings are refreshed.
// ---------------------------------------------------------------
async function autoReopenIfTimePassed() {
    if (!cachedStoreSettings || !cachedStoreSettings.length) return;

    const offlineStore = cachedStoreSettings.find(s => s.isOnline === false && s.offlineUntil);
    if (!offlineStore) return;

    const untilDate = new Date(offlineStore.offlineUntil);
    if (isNaN(untilDate.getTime())) return;
    if (untilDate > new Date()) return; // still in the future — wait

    // Time has passed — auto go online
    console.log('[LittiWale Admin] offlineUntil has passed — auto going online');
    try {
        const payload = { isOnline: true, offlineReason: '', offlineDuration: '', offlineUntil: '', autoSchedule: false };
        await apiCall('/settings/cloud', 'PUT', payload);
        await apiCall('/settings/outlet', 'PUT', payload);
        window.showAdminToast('🟢 Restaurant auto-reopened (timer expired)', 'success', 'Back Online!');
        loadStoreSettings();
    } catch(e) {
        console.error('[AutoReopen]', e);
    }
}

// Start
init();








// ==========================================
// UNIFIED 4-SUB-TAB CMS MANAGEMENT SYSTEM (V4)
// ==========================================

// Sub-Tab Switcher
window.switchCmsSubTab = function(subTabId) {
    const tabBtns = document.querySelectorAll('.cms-sub-tab-btn, .cms-tab-btn');
    const tabContents = document.querySelectorAll('.cms-sub-content, .cms-tab-content');

    tabBtns.forEach(btn => {
        const target = btn.getAttribute('data-cms-tab') || btn.getAttribute('data-subtab');
        if (target === subTabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    tabContents.forEach(content => {
        if (content.id === subTabId) {
            content.classList.remove('hidden');
            content.classList.add('active');
        } else {
            content.classList.add('hidden');
            content.classList.remove('active');
        }
    });

    if (subTabId === 'reels-tab') fetchReels();
    if (subTabId === 'announcements-tab') {
        if (typeof fetchCmsAnnouncements === 'function') fetchCmsAnnouncements();
        else if (typeof loadAnnouncements === 'function') loadAnnouncements();
    }
    if (subTabId === 'deals-tab') fetchCmsDeals();
    if (subTabId === 'hero-tab') loadHeroCmsSettings();
};

// --- SUB-TAB 1: SOCIAL PRESENCE (INSTAGRAM REELS) ---
async function fetchReels() {
    const cached = sessionStorage.getItem('adminCachedReels');
    if (cached) {
        try {
            adminReelsList = JSON.parse(cached);
            renderAdminReels();
        } catch(e) {}
    }
    try {
        const res = await fetch(`${API_URL}/reels`);
        const data = await res.json();
        if (data && Array.isArray(data)) {
            adminReelsList = data;
            sessionStorage.setItem('adminCachedReels', JSON.stringify(data));
            renderAdminReels();
        }
    } catch (err) {
        console.error('Error fetching reels:', err);
    }
}

function renderAdminReels() {
    const container = document.getElementById('cms-reels-grid') || document.getElementById('media-grid-container');
    if (!container) return;

    if (!adminReelsList || adminReelsList.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1; padding:30px; text-align:center;">No Social Presence reels added yet. Click "+ Add Instagram Reel" to create one.</div>';
        return;
    }

    container.innerHTML = adminReelsList.map(reel => {
        return `
            <div class="card" style="background:#18181c; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.1); display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <div style="position:relative; aspect-ratio:4/3; width:100%; overflow:hidden; background:#0c0c0e;">
                    <img src="${reel.image || 'images/logo.png'}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.onerror=null; this.src='images/logo.png'">
                    <span style="position:absolute; top:12px; left:12px; background:${reel.badge === 'Loved' ? '#ec4899' : '#f97316'}; color:#fff; font-size:0.75rem; font-weight:bold; padding:4px 12px; border-radius:20px; box-shadow:0 4px 10px rgba(0,0,0,0.4);">${reel.badge || 'Popular'}</span>
                </div>
                <div style="padding:16px;">
                    <h4 style="font-size:1rem; color:#fff; font-weight:700; margin-bottom:6px;">${reel.title || 'Customer Review'}</h4>
                    <a href="${reel.link}" target="_blank" style="font-size:0.78rem; color:#60a5fa; text-decoration:none; word-break:break-all; display:block; margin-bottom:14px;">🔗 ${reel.link}</a>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-outline" style="flex:1; padding:8px; font-size:0.85rem; border-radius:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; cursor:pointer;" onclick="window.editReel('${reel._id}')">Edit</button>
                        <a href="${reel.image}" download="reel_thumbnail.png" target="_blank" class="btn btn-outline" style="padding:8px 12px; font-size:0.85rem; border-radius:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#4ade80; text-decoration:none; text-align:center;" title="Download Base64 Image">📥</a>
                        <button class="btn btn-danger" style="padding:8px 14px; font-size:0.85rem; border-radius:8px; background:#ef4444; color:#fff; border:none; cursor:pointer;" onclick="window.deleteReel('${reel._id}')">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

let currentReelImageBase64 = '';

window.openReelModal = function(reel = null) {
    const modal = document.getElementById('reel-modal');
    if (!modal) return;
    
    document.getElementById('reel-modal-title').textContent = reel ? 'Edit Instagram Reel' : 'Add New Instagram Reel';
    document.getElementById('reel-id').value = reel ? reel._id : '';
    document.getElementById('reel-title').value = reel ? (reel.title || '') : '';
    document.getElementById('reel-badge').value = reel ? (reel.badge || 'Popular') : 'Popular';
    document.getElementById('reel-link').value = reel ? (reel.link || '') : '';
    
    currentReelImageBase64 = (reel && reel.image) ? reel.image : '';
    const fileInput = document.getElementById('reel-image-file');
    if (fileInput) fileInput.value = '';
    
    const previewContainer = document.getElementById('reel-thumb-preview');
    if (previewContainer) {
        if (currentReelImageBase64) {
            previewContainer.innerHTML = `<img src="${currentReelImageBase64}" style="width:100%; height:100%; object-fit:contain;">`;
            previewContainer.style.display = 'block';
        } else {
            previewContainer.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-dim); font-size:12px;">No image uploaded yet</div>';
            previewContainer.style.display = 'block';
        }
    }

    modal.classList.add('active');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

window.closeReelModal = function() {
    window.closeModal('reel-modal');
};

document.getElementById('reel-image-file')?.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        currentReelImageBase64 = await window.compressImageToWebP(file, 800, 0.85);
        const previewContainer = document.getElementById('reel-thumb-preview');
        if (previewContainer) {
            previewContainer.innerHTML = `<img src="${currentReelImageBase64}" style="width:100%; height:100%; object-fit:contain;">`;
            previewContainer.style.display = 'block';
        }
    } catch(err) {
        console.error('Error compressing reel image:', err);
    }
});

window.editReel = function(id) {
    const reel = (adminReelsList || []).find(r => r._id === id);
    if (reel) window.openReelModal(reel);
};

window.saveReelCms = async function(event) {
    event.preventDefault();
    const id = document.getElementById('reel-id').value;
    const title = document.getElementById('reel-title').value;
    const badge = document.getElementById('reel-badge').value;
    const link = document.getElementById('reel-link').value;
    const image = currentReelImageBase64;

    const payload = { title, badge, link, image };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/reels/${id}` : `${API_URL}/reels`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            window.showAdminToast(id ? 'Reel updated successfully!' : 'New Reel added!', 'success');
            window.closeModal('reel-modal');
            fetchReels();
        } else {
            window.showAdminToast('Failed to save reel. Invalid PIN.', 'error');
        }
    } catch(err) {
        window.showAdminToast('Error saving reel', 'error');
    }
};

window.deleteReel = async function(id) {
    if (!confirm('Are you sure you want to delete this Instagram reel?')) return;
    try {
        const res = await fetch(`${API_URL}/reels/${id}`, {
            method: 'DELETE',
            headers: {
                'x-admin-pin': authPin,
                'x-pin': authPin
            }
        });
        if (res.ok) {
            window.showAdminToast('Reel deleted successfully!', 'success');
            fetchReels();
        } else {
            window.showAdminToast('Failed to delete reel', 'error');
        }
    } catch (err) {
        window.showAdminToast('Error deleting reel', 'error');
    }
};

// --- SUB-TAB 2: ANNOUNCEMENTS ---
async function fetchCmsAnnouncements() {
    const container = document.getElementById('cms-announcements-grid');
    if (!container) return;

    const render = (announcements) => {
        if (!announcements || announcements.length === 0) {
            container.innerHTML = '<div style="color:#aaa; grid-column:1/-1;">No announcements uploaded yet. Click "+ Add Announcement Banner" to create one.</div>';
            return;
        }
        container.innerHTML = announcements.map(a => `
            <div class="card" style="background:#18181c; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.1); padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <div style="aspect-ratio:16/9; width:100%; border-radius:12px; overflow:hidden; background:#000; margin-bottom:12px;">
                        <img src="${a.image || 'images/logo.png'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='images/logo.png'">
                    </div>
                    <div style="font-weight:bold; color:#fff; font-size:1rem; margin-bottom:6px;">${a.title || 'Announcement Banner'}</div>
                    <div style="font-size:0.85rem; color:${a.isActive !== false ? '#4ade80' : '#ef4444'}; font-weight:600; margin-bottom:14px;">
                        ${a.isActive !== false ? '🟢 Status: Active (Live on Website)' : '🔴 Status: Hidden (Inactive)'}
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-outline" style="flex:1; padding:8px; font-size:0.85rem; border-radius:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; cursor:pointer;" onclick="window.toggleAnnouncementActive('${a._id}', ${a.isActive !== false})">
                        ${a.isActive !== false ? '👁️ Hide' : '👁️ Show (Activate)'}
                    </button>
                    <button class="btn btn-danger" style="padding:8px 14px; font-size:0.85rem; border-radius:8px; background:#ef4444; color:#fff; border:none; cursor:pointer;" onclick="window.deleteAnnouncementCms('${a._id}')">🗑️ Delete</button>
                </div>
            </div>
        `).join('');
    };

    const cached = sessionStorage.getItem('adminCachedAnnouncements');
    if (cached) {
        try { render(JSON.parse(cached)); } catch(e) {}
    }

    try {
        const res = await fetch(`${API_URL}/announcements`);
        const announcements = await res.json();
        if (announcements && Array.isArray(announcements)) {
            sessionStorage.setItem('adminCachedAnnouncements', JSON.stringify(announcements));
            render(announcements);
        }
    } catch(e) {
        if (!cached) container.innerHTML = '<div style="color:#ef4444;">Failed to load announcements.</div>';
    }
}

window.toggleAnnouncementActive = async function(id, currentActive) {
    try {
        const res = await fetch(`${API_URL}/announcements/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            },
            body: JSON.stringify({ isActive: !currentActive })
        });
        if (res.ok) {
            window.showAdminToast(currentActive ? 'Announcement hidden from website' : 'Announcement activated live!', 'success');
            fetchCmsAnnouncements();
        } else {
            window.showAdminToast('Failed to update announcement status', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error updating announcement', 'error');
    }
};

window.deleteAnnouncementCms = async function(id) {
    if (!confirm('Are you sure you want to delete this announcement banner?')) return;
    try {
        const res = await fetch(`${API_URL}/announcements/${id}`, {
            method: 'DELETE',
            headers: {
                'x-admin-pin': authPin,
                'x-pin': authPin
            }
        });
        if (res.ok) {
            window.showAdminToast('Announcement deleted successfully!', 'success');
            fetchCmsAnnouncements();
        } else {
            window.showAdminToast('Failed to delete announcement', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error deleting announcement', 'error');
    }
};

// --- SUB-TAB 3: CRAZIEST DEALS OF THE HOUR ---
window.regularMenuItems = [];

function populateDealItemDropdowns(selectedName1 = '', selectedName2 = '') {
    const sel1 = document.getElementById('deal-item1-select');
    const sel2 = document.getElementById('deal-item2-select');
    if (!sel1 || !sel2) return;

    // Filter out deals, combos, thalis
    const items = (window.regularMenuItems || []).filter(item => {
        const cat = (item.category || '').toLowerCase();
        const n = (item.name || '').toLowerCase();
        return !cat.includes('craziest') && !cat.includes('deal') && !n.includes('khila') && !n.includes('diet') && !n.includes('bhook');
    }).sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''));

    // Group by category
    const categories = {};
    items.forEach(item => {
        const cat = item.category || 'Dishes';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);
    });

    let optionsHtml = '<option value="">-- Choose a Dish --</option>';
    for (const cat in categories) {
        optionsHtml += `<optgroup label="${cat}">`;
        categories[cat].forEach(item => {
            const price = item.price || item.full || item.half || 0;
            optionsHtml += `<option value="${item._id || item.id}" data-name="${item.name.replace(/"/g, '&quot;')}" data-price="${price}">${item.name} — ₹${price}</option>`;
        });
        optionsHtml += `</optgroup>`;
    }

    sel1.innerHTML = optionsHtml;
    sel2.innerHTML = optionsHtml;

    // Try to auto-select matching dishes if note contains item names
    if (selectedName1) {
        for (let i = 0; i < sel1.options.length; i++) {
            const opt = sel1.options[i];
            const optName = (opt.getAttribute('data-name') || '').toLowerCase();
            if (optName && (selectedName1.toLowerCase().includes(optName) || optName.includes(selectedName1.toLowerCase()))) {
                sel1.selectedIndex = i;
                break;
            }
        }
    }

    if (selectedName2) {
        for (let i = 0; i < sel2.options.length; i++) {
            const opt = sel2.options[i];
            const optName = (opt.getAttribute('data-name') || '').toLowerCase();
            if (optName && (selectedName2.toLowerCase().includes(optName) || optName.includes(selectedName2.toLowerCase()))) {
                sel2.selectedIndex = i;
                break;
            }
        }
    }
}

window.recalculateDealPrices = function(updateInputs = true) {
    const sel1 = document.getElementById('deal-item1-select');
    const sel2 = document.getElementById('deal-item2-select');
    if (!sel1 || !sel2) return;

    const opt1 = sel1.options[sel1.selectedIndex];
    const opt2 = sel2.options[sel2.selectedIndex];

    const price1 = Number(opt1 ? (opt1.getAttribute('data-price') || 0) : 0);
    const price2 = Number(opt2 ? (opt2.getAttribute('data-price') || 0) : 0);
    const name1 = opt1 ? (opt1.getAttribute('data-name') || '') : '';
    const name2 = opt2 ? (opt2.getAttribute('data-name') || '') : '';

    const origTotal = price1 + price2;

    const breakdownEl = document.getElementById('deal-calc-breakdown');
    if (breakdownEl) {
        if (price1 > 0 && price2 > 0) {
            breakdownEl.innerHTML = `Value: ₹${price1} + ₹${price2} = <strong>₹${origTotal}</strong>`;
        } else if (price1 > 0) {
            breakdownEl.innerHTML = `Value: <strong>₹${price1}</strong>`;
        } else {
            breakdownEl.innerHTML = '';
        }
    }

    if (updateInputs && (name1 || name2)) {
        if (name1 && name2) {
            document.getElementById('deal-note-input').value = `Includes: ${name1} + ${name2}`;
        } else if (name1) {
            document.getElementById('deal-note-input').value = `Includes: ${name1}`;
        } else if (name2) {
            document.getElementById('deal-note-input').value = `Includes: ${name2}`;
        }

        if (origTotal > 0) {
            // Formula requested: Clean round figure ending in 0 (e.g. Total 240 -> Deal Price 250, Strikethrough 300)
            const finalPrice = Math.ceil((origTotal * 1.04) / 10) * 10;
            const fakePrice = Math.ceil((origTotal * 1.25) / 10) * 10;

            document.getElementById('deal-price-input').value = finalPrice;
            document.getElementById('deal-origprice-input').value = fakePrice;
        }
    }
};

async function fetchCmsDeals() {
    const container = document.getElementById('cms-deals-grid');
    if (!container) return;
    try {
        const res = await fetch(`${API_URL}/menu`);
        const menuItems = await res.json();
        
        window.regularMenuItems = menuItems || [];

        // Strict filter: ONLY real Craziest Deals
        adminDealsList = (menuItems || []).filter(item => {
            const cat = (item.category || '').toLowerCase();
            return cat === 'craziest deals of the hour' || cat.includes('craziest deal') || item.isCraziestDeal === true;
        });
        
        if (adminDealsList.length === 0) {
            container.innerHTML = `
                <div style="color:#94a3b8; grid-column:1/-1; background:#18181c; padding:32px; border-radius:16px; border:1px dashed rgba(255,255,255,0.15); text-align:center;">
                    <div style="font-size:2rem; margin-bottom:8px;">🔥</div>
                    <div style="font-size:1.1rem; font-weight:600; color:#fff; margin-bottom:6px;">No Craziest Deals active right now</div>
                    <div style="font-size:0.85rem; color:#64748b; margin-bottom:16px;">Click the button above to add custom hourly deals.</div>
                    <button class="btn btn-primary" onclick="openNewDealModal()" style="padding:8px 20px; border-radius:8px;">+ Add First Deal</button>
                </div>
            `;
            return;
        }

        container.innerHTML = adminDealsList.map(deal => `
            <div class="card" style="background:#18181c; border-radius:16px; overflow:hidden; border:1px solid rgba(249,115,22,0.25); padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <div>
                    <div style="position:relative; width:100%; aspect-ratio:16/9; margin-bottom:12px; border-radius:12px; overflow:hidden; background:#121215;">
                        <img src="${deal.image || 'images/logo.png'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='images/logo.png'">
                        <div style="position:absolute; top:8px; left:8px; background:rgba(239,68,68,0.9); color:#fff; font-size:0.75rem; font-weight:800; padding:3px 8px; border-radius:6px; text-transform:uppercase;">
                            🔥 Live Deal
                        </div>
                    </div>
                    <h4 style="color:#fff; font-size:1.15rem; font-weight:700; margin-bottom:6px;">${deal.name}</h4>
                    <div style="color:#fb923c; font-size:0.85rem; line-height:1.4; margin-bottom:10px;">${deal.note || deal.description || 'Special Promotional Combo'}</div>
                    <div style="font-weight:bold; color:#4ade80; font-size:1.3rem; margin-bottom:14px;">
                        ₹${deal.price} ${deal.originalPrice ? `<span style="color:#64748b; text-decoration:line-through; font-size:0.95rem; margin-left:6px;">₹${deal.originalPrice}</span>` : ''}
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-primary" style="flex:1; padding:9px; font-weight:700; border-radius:8px; cursor:pointer;" onclick="window.openDealModal('${deal._id}')">✏️ Configure Deal</button>
                    <button class="btn btn-danger" style="padding:9px 14px; background:#ef4444; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:bold;" onclick="window.deleteDealCms('${deal._id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch(e) {
        container.innerHTML = '<div style="color:#ef4444; padding:20px;">Failed to load deals from database.</div>';
    }
}

window.openNewDealModal = function() {
    const modal = document.getElementById('deal-modal');
    if (!modal) return;

    document.getElementById('deal-modal-title').textContent = '➕ Add Custom Craziest Deal';
    const nameBadge = document.getElementById('deal-name-badge');
    if (nameBadge) nameBadge.textContent = 'Custom Deal Combo';

    document.getElementById('deal-id').value = '';
    document.getElementById('deal-title-input').value = 'Custom Craziest Deal 🔥';
    document.getElementById('deal-note-input').value = '';
    document.getElementById('deal-price-input').value = '';
    document.getElementById('deal-origprice-input').value = '';
    document.getElementById('deal-image-input').value = '';
    document.getElementById('deal-file-input').value = '';

    populateDealItemDropdowns('', '');

    const preview = document.getElementById('deal-image-preview');
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }

    modal.classList.add('active');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

window.openDealModal = function(dealId) {
    const deal = adminDealsList.find(d => d._id === dealId);
    if (!deal) return;

    const modal = document.getElementById('deal-modal');
    if (!modal) return;

    document.getElementById('deal-modal-title').textContent = '🔥 Configure Deal Combo';
    const nameBadge = document.getElementById('deal-name-badge');
    if (nameBadge) nameBadge.textContent = deal.name;

    document.getElementById('deal-id').value = deal._id;
    document.getElementById('deal-title-input').value = deal.name;
    document.getElementById('deal-note-input').value = deal.note || deal.description || '';
    document.getElementById('deal-price-input').value = deal.price;
    document.getElementById('deal-origprice-input').value = deal.originalPrice || '';
    document.getElementById('deal-image-input').value = deal.image || '';
    document.getElementById('deal-file-input').value = '';

    const preview = document.getElementById('deal-image-preview');
    if (preview && deal.image) {
        preview.src = deal.image;
        preview.style.display = 'block';
    }

    // Split note if it contains "Includes: A + B"
    let part1 = '', part2 = '';
    const note = deal.note || deal.description || '';
    const cleanNote = note.replace(/^Includes:\s*/i, '');
    if (cleanNote.includes('+')) {
        const parts = cleanNote.split('+');
        part1 = parts[0].trim();
        part2 = parts[1].trim();
    }

    populateDealItemDropdowns(part1, part2);
    
    // Trigger price calculation display
    window.recalculateDealPrices(false);

    modal.classList.add('active');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

window.closeDealModal = function() {
    const modal = document.getElementById('deal-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
};

window.handleDealImageUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const webpData = await window.compressImageToWebP(file, 800, 0.82);
        document.getElementById('deal-image-input').value = webpData;
        const preview = document.getElementById('deal-image-preview');
        if (preview) {
            preview.src = webpData;
            preview.style.display = 'block';
        }
    } catch(e) {
        console.error('Error compressing image to WebP:', e);
    }
};

window.saveDealCms = async function(event) {
    event.preventDefault();
    const id = document.getElementById('deal-id').value;
    const name = document.getElementById('deal-title-input').value;
    const note = document.getElementById('deal-note-input').value;
    const price = Number(document.getElementById('deal-price-input').value);
    const originalPrice = Number(document.getElementById('deal-origprice-input').value) || undefined;
    const image = document.getElementById('deal-image-input').value;

    const payload = {
        name,
        category: 'Craziest Deals of the Hour',
        isCombo: true,
        note,
        description: note,
        price,
        originalPrice,
        image: image || 'images/logo.png',
        isAvailable: true
    };

    try {
        let res;
        if (id) {
            res = await fetch(`${API_URL}/menu/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-pin': authPin,
                    'x-pin': authPin
                },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch(`${API_URL}/menu`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-pin': authPin,
                    'x-pin': authPin
                },
                body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            window.showAdminToast(id ? 'Deal combo saved successfully!' : 'New Deal added successfully!', 'success');
            window.closeDealModal();
            fetchCmsDeals();
        } else {
            window.showAdminToast('Failed to save deal. Invalid PIN.', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error saving deal', 'error');
    }
};

window.deleteDealCms = async function(dealId) {
    if (!confirm('Are you sure you want to remove this deal from Craziest Deals?')) return;
    try {
        const res = await fetch(`${API_URL}/menu/${dealId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            }
        });
        if (res.ok) {
            window.showAdminToast('Deal removed successfully', 'success');
            fetchCmsDeals();
        } else {
            window.showAdminToast('Failed to delete deal', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error deleting deal', 'error');
    }
};

// ==========================================
// INTERACTIVE IMAGE PREVIEW CARD (NO-CROP, DOWNLOAD, CHANGE, REMOVE)
// ==========================================
window.renderImagePreviewCard = function(containerId, imageUrl, uploadInputId, removeCallbackName, filename = 'image.png') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (imageUrl && imageUrl.trim() !== '') {
        container.innerHTML = `
            <div class="interactive-image-preview-card">
                <div class="preview-img-box">
                    <img src="${imageUrl}" class="preview-natural-img" alt="Preview Image" onerror="this.onerror=null; this.src='images/logo.png'">
                </div>
                <div class="preview-actions-bar">
                    <a href="${imageUrl}" download="${filename}" class="btn btn-xs btn-outline" target="_blank" title="Download Full Quality Image">
                        📥 Download
                    </a>
                    <button type="button" class="btn btn-xs btn-secondary" onclick="document.getElementById('${uploadInputId}').click()">
                        🔄 Change / Upload
                    </button>
                    <button type="button" class="btn btn-xs btn-danger" onclick="window.${removeCallbackName}()">
                        🗑️ Remove
                    </button>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="empty-image-upload-box" onclick="document.getElementById('${uploadInputId}').click()">
                <div style="font-size:28px; margin-bottom:6px;">🖼️</div>
                <div style="font-size:13px; font-weight:700; color:#fff;">Click to Upload Image</div>
                <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">Auto-compressed to clean WebP</div>
            </div>
        `;
    }
};

let currentHeroImageBase64 = '';
let currentAboutImageBase64 = '';

window.handleHeroImageChange = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const webp = await compressImage(file, 1200, 0.85);
        currentHeroImageBase64 = webp;
        window.renderImagePreviewCard('hero-image-preview', webp, 'hero-image-file', 'removeHeroImage', 'hero_banner.webp');
        window.showAdminToast('Hero banner image updated! Click Save to apply.', 'info');
    } catch(e) {
        console.error('Error compressing hero image:', e);
    }
};

window.removeHeroImage = function() {
    currentHeroImageBase64 = '';
    const fileInput = document.getElementById('hero-image-file');
    if (fileInput) fileInput.value = '';
    window.renderImagePreviewCard('hero-image-preview', '', 'hero-image-file', 'removeHeroImage', 'hero_banner.webp');
    window.showAdminToast('Hero image removed. Click Save to apply.', 'warning');
};

window.handleAboutImageChange = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const webp = await compressImage(file, 1000, 0.85);
        currentAboutImageBase64 = webp;
        window.renderImagePreviewCard('about-image-preview', webp, 'about-image-file', 'removeAboutImage', 'about_photo.webp');
        window.showAdminToast('About Us photo updated! Click Save to apply.', 'info');
    } catch(e) {
        console.error('Error compressing about image:', e);
    }
};

window.removeAboutImage = function() {
    currentAboutImageBase64 = '';
    const fileInput = document.getElementById('about-image-file');
    if (fileInput) fileInput.value = '';
    window.renderImagePreviewCard('about-image-preview', '', 'about-image-file', 'removeAboutImage', 'about_photo.webp');
    window.showAdminToast('About photo removed. Click Save to apply.', 'warning');
};

window.loadHeroCmsSettings = async function() {
    try {
        const res = await fetch(`${API_URL}/settings`);
        const settings = await res.json();
        if (settings && settings.length > 0) {
            const s = settings[0];
            const setVal = (ids, val) => {
                if (val === undefined || val === null) return;
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = val;
                });
            };

            // Hero fields
            setVal(['hero-tagline', 'cms-hero-tagline'], s.heroTagline || "Good Food, Good Mood ♡");
            setVal(['hero-title', 'cms-hero-title'], s.heroTitle || "Delicious Food Made with Love ♡");
            setVal(['hero-desc', 'cms-hero-desc'], s.heroDesc || "Experience the perfect blend of authentic taste, premium quality, and happiness in every single bite.");
            setVal(['hero-badge', 'hero-badge-text', 'cms-hero-badge-text'], s.heroBadgeText || "Taste of Desi Swag • Barbil");
            setVal(['hero-whatsapp', 'hero-btn2-link', 'cms-hero-btn2-link'], s.heroBtn2Link || "https://wa.me/916370680744");

            currentHeroImageBase64 = s.heroImage || '';
            window.renderImagePreviewCard('hero-image-preview', s.heroImage || '', 'hero-image-file', 'removeHeroImage', 'hero_banner.webp');

            // About Us fields
            setVal(['about-badge', 'about-tagline', 'cms-about-tagline'], s.aboutTagline || "OUR AUTHENTIC STORY");
            setVal(['about-heading', 'cms-about-heading'], s.aboutHeading || "Born from Passion, Perfected with Pure Ghee");
            setVal(['about-p1', 'about-story-text', 'cms-about-story-text'], s.aboutStoryText || "Our journey began with a simple craving for genuine, slow-cooked Bihari Litti Chokha...");
            setVal(['about-p2', 'about-story-subtitle', 'cms-about-story-subtitle'], s.aboutStorySubtitle || "Every single dish is prepared daily using cold-pressed mustard oil, pure desi ghee, and roasted sattu...");
            setVal(['about-experience', 'stat-text', 'cms-stat-text'], s.statText || "100% Authentic Coal Roasted");

            currentAboutImageBase64 = s.aboutImage || '';
            window.renderImagePreviewCard('about-image-preview', s.aboutImage || '', 'about-image-file', 'removeAboutImage', 'about_photo.webp');

            // Perks fields
            setVal(['perk1-title', 'cms-perk1-title'], s.perk1Title || "100% Coal Roasted");
            setVal(['perk1-desc', 'perk1-text', 'cms-perk1-text'], s.perk1Text || "Cooked over authentic clay charcoal for deep smoky taste.");
            setVal(['perk2-title', 'cms-perk2-title'], s.perk2Title || "Pure Desi Ghee");
            setVal(['perk2-desc', 'perk2-text', 'cms-perk2-text'], s.perk2Text || "Dipped in pure aromatic desi ghee for unforgettable indulgence.");
            setVal(['perk3-title', 'cms-perk3-title'], s.perk3Title || "Super Fast Delivery");
            setVal(['perk3-desc', 'perk3-text', 'cms-perk3-text'], s.perk3Text || "Dispatched steaming hot straight from our Barbil kitchen.");
            setVal(['perk4-title', 'cms-perk4-title'], s.perk4Title || "Hygiene First");
            setVal(['perk4-desc', 'perk4-text', 'cms-perk4-text'], s.perk4Text || "Prepared with strict FSSAI certified sanitary standards.");

            // Dabba Subscription fields
            setVal(['dabba-veg-title'], s.dabbaVegTitle || "Desi Veg Dabba");
            setVal(['dabba-veg-sub'], s.dabbaVegSubtitle || "Pure vegetarian. Best value for daily regulars.");
            setVal(['dabba-veg-weekly-old'], s.dabbaVegWeeklyOldPrice || "₹1,500");
            setVal(['dabba-veg-weekly-new'], s.dabbaVegWeeklyNewPrice || "₹1,200");
            setVal(['dabba-veg-monthly-old'], s.dabbaVegMonthlyOldPrice || "₹6,000");
            setVal(['dabba-veg-monthly-new'], s.dabbaVegMonthlyNewPrice || "₹5,500");

            setVal(['dabba-nonveg-title'], s.dabbaNonvegTitle || "Desi Feast Dabba");
            setVal(['dabba-nonveg-sub'], s.dabbaNonvegSubtitle || "4 days veg + 3 days non-veg (Wed, Fri, Sun).");
            setVal(['dabba-nonveg-weekly-old'], s.dabbaNonvegWeeklyOldPrice || "₹2,000");
            setVal(['dabba-nonveg-weekly-new'], s.dabbaNonvegWeeklyNewPrice || "₹1,500");
            setVal(['dabba-nonveg-monthly-old'], s.dabbaNonvegMonthlyOldPrice || "₹7,500");
            setVal(['dabba-nonveg-monthly-new'], s.dabbaNonvegMonthlyNewPrice || "₹6,500");
        }
    } catch(e) {}
};

window.saveHeroCms = async function(event) {
    if (event && event.preventDefault) event.preventDefault();
    
    const getVal = (...ids) => {
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el && el.value) return el.value;
        }
        return '';
    };

    const payload = {
        heroBadgeText: getVal('hero-badge', 'cms-hero-badge-text'),
        heroTitle: getVal('hero-title', 'cms-hero-title'),
        heroDesc: getVal('hero-desc', 'cms-hero-desc'),
        heroBtn2Link: getVal('hero-whatsapp', 'cms-hero-btn2-link'),
        heroImage: currentHeroImageBase64 || 'images/logo.png',
        aboutTagline: getVal('about-badge', 'cms-about-tagline'),
        aboutHeading: getVal('about-heading', 'cms-about-heading'),
        aboutStoryText: getVal('about-p1', 'cms-about-story-text'),
        aboutStorySubtitle: getVal('about-p2', 'cms-about-story-subtitle'),
        statText: getVal('about-experience', 'cms-stat-text'),
        aboutImage: currentAboutImageBase64 || 'images/menu-litti.jpg',
        perk1Title: getVal('perk1-title', 'cms-perk1-title'),
        perk1Text: getVal('perk1-desc', 'perk1-text'),
        perk2Title: getVal('perk2-title', 'cms-perk2-title'),
        perk2Text: getVal('perk2-desc', 'perk2-text'),
        perk3Title: getVal('perk3-title', 'cms-perk3-title'),
        perk3Text: getVal('perk3-desc', 'perk3-text'),
        perk4Title: getVal('perk4-title', 'cms-perk4-title'),
        perk4Text: getVal('perk4-desc', 'perk4-text'),
        dabbaVegTitle: getVal('dabba-veg-title'),
        dabbaVegSubtitle: getVal('dabba-veg-sub'),
        dabbaVegWeeklyOldPrice: getVal('dabba-veg-weekly-old'),
        dabbaVegWeeklyNewPrice: getVal('dabba-veg-weekly-new'),
        dabbaVegMonthlyOldPrice: getVal('dabba-veg-monthly-old'),
        dabbaVegMonthlyNewPrice: getVal('dabba-veg-monthly-new'),
        dabbaNonvegTitle: getVal('dabba-nonveg-title'),
        dabbaNonvegSubtitle: getVal('dabba-nonveg-sub'),
        dabbaNonvegWeeklyOldPrice: getVal('dabba-nonveg-weekly-old'),
        dabbaNonvegWeeklyNewPrice: getVal('dabba-nonveg-weekly-new'),
        dabbaNonvegMonthlyOldPrice: getVal('dabba-nonveg-monthly-old'),
        dabbaNonvegMonthlyNewPrice: getVal('dabba-nonveg-monthly-new')
    };

    try {
        const res = await fetch(`${API_URL}/settings/cloud`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            window.showAdminToast('Website CMS Content & Images saved successfully!', 'success');
            if (typeof loadStoreSettings === 'function') loadStoreSettings();
        } else {
            window.showAdminToast('Failed to save settings. Please check PIN.', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error saving settings', 'error');
    }
};

// ==========================================================================
// MEDIA ASSET LIBRARY (24 Core Assets)
// ==========================================================================
window.allMediaAssets = [
    { name: "Brand Logo (Official)", path: "images/logo.png", category: "gallery", desc: "Main brand badge & header icon" },
    { name: "Hero Showcase Banner", path: "images/hero-banner.png", category: "banner", desc: "Customer hero graphic plate" },
    { name: "Hero Dark Background", path: "images/hero-bg.jpg", category: "banner", desc: "Atmospheric hero backdrop" },
    { name: "Litti Chokha Dish", path: "images/menu-litti.jpg", category: "menu", desc: "Signature wood-fired litti plate" },
    { name: "Special Biryani Handi", path: "images/menu-biryani.jpg", category: "menu", desc: "Aromatic Hyderabadi biryani" },
    { name: "Special Indian Thali", path: "images/menu-thali.jpg", category: "menu", desc: "Grand North & South Indian thali" },
    { name: "Wood-Fired Pizza", path: "images/menu-pizza.jpg", category: "menu", desc: "Loaded cheesy pizza special" },
    { name: "About Story Showcase", path: "images/about-img.jpg", category: "gallery", desc: "Authentic cloud kitchen story" },
    { name: "Announcement Banner 1", path: "images/current-offer1.png", category: "banner", desc: "LPG Operational notice banner" },
    { name: "Announcement Banner 2", path: "images/current-offer2.png", category: "banner", desc: "Pure Veg & Non-Veg meal plans" },
    { name: "Announcement Banner 3", path: "images/current-offer3.png", category: "banner", desc: "Special festival combo offer" },
    { name: "Announcement Banner 4", path: "images/current-offer4.png", category: "banner", desc: "Bulk & party order discount" },
    { name: "Announcement Banner 5", path: "images/current-offer5.png", category: "banner", desc: "Weekend special food festival" },
    { name: "Instagram Reel Cover 1", path: "images/reel1.png", category: "social", desc: "Customer tasting review reel" },
    { name: "Instagram Reel Cover 2", path: "images/reel2.png", category: "social", desc: "Kitchen making of litti chokha" },
    { name: "Instagram Reel Cover 3", path: "images/reel3.png", category: "social", desc: "Barbil foodies meetup reel" },
    { name: "Instagram Reel Cover 4", path: "images/reel4.png", category: "social", desc: "Packaging & cloud dispatch reel" },
    { name: "Instagram Reel Cover 5", path: "images/reel5.png", category: "social", desc: "Happy customer smiles reel" },
    { name: "Instagram Reel Cover 6", path: "images/reel6.png", category: "social", desc: "Weekend family feast reel" },
    { name: "Dining Gallery 1", path: "images/gallery-1.jpg", category: "gallery", desc: "Fresh hot served dishes" },
    { name: "Dining Gallery 2", path: "images/gallery-2.jpg", category: "gallery", desc: "Spiced condiments & chutney" },
    { name: "Dining Gallery 3", path: "images/gallery-3.jpg", category: "gallery", desc: "Clay oven roasting showcase" },
    { name: "Dining Gallery 4", path: "images/gallery-4.jpg", category: "gallery", desc: "Cloud kitchen packing station" },
    { name: "UPI QR Payment Code", path: "images/upi-qr.jpeg", category: "gallery", desc: "Direct payment QR code" }
];

window.currentMediaFilter = 'all';

window.renderMediaLibrary = function(filterCategory = 'all') {
    const grid = document.getElementById('media-library-grid');
    if (!grid) return;

    window.currentMediaFilter = filterCategory;
    const items = filterCategory === 'all' 
        ? window.allMediaAssets 
        : window.allMediaAssets.filter(item => item.category === filterCategory);

    const statEl = document.getElementById('module-media-stat');
    if (statEl) statEl.textContent = `${window.allMediaAssets.length} Media Assets`;

    grid.innerHTML = items.map(item => `
        <div class="banner-preview-card" style="background:var(--bg-surface); border:1px solid var(--border-card); border-radius:var(--radius-md); padding:12px; display:flex; flex-direction:column; gap:10px; transition:all 0.2s;">
            <div style="position:relative; width:100%; height:140px; border-radius:var(--radius-sm); overflow:hidden; background:#0b0d11; display:flex; align-items:center; justify-content:center;">
                <img src="${item.path}" alt="${item.name}" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.src='images/logo.png'">
                <span style="position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.75); backdrop-filter:blur(4px); color:#fff; font-size:10px; font-weight:700; padding:2px 8px; border-radius:12px; text-transform:uppercase;">
                    ${item.category}
                </span>
            </div>
            <div>
                <div style="font-size:13px; font-weight:800; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.name}">${item.name}</div>
                <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">${item.desc}</div>
                <div style="font-size:11px; color:var(--brand-gold); font-family:monospace; margin-top:4px;">${item.path}</div>
            </div>
            <div style="display:flex; gap:8px; margin-top:auto;">
                <button type="button" class="btn btn-sm btn-secondary" style="flex:1; font-size:11.5px; padding:6px 8px;" onclick="copyMediaPath('${item.path}')">
                    📋 Copy Path
                </button>
                <a href="${item.path}" target="_blank" class="btn btn-sm btn-outline" style="font-size:11.5px; padding:6px 10px;" title="View Full Image">
                    👁️
                </a>
            </div>
        </div>
    `).join('');
};

window.filterMediaLibrary = function(cat, btn) {
    document.querySelectorAll('#media-category-filters .media-filter-btn').forEach(b => {
        b.classList.remove('btn-primary', 'active');
        b.classList.add('btn-secondary');
    });
    if (btn) {
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary', 'active');
    }
    window.renderMediaLibrary(cat);
};

window.copyMediaPath = function(path) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(path).then(() => {
            window.showAdminToast(`Copied "${path}" to clipboard!`, 'success', 'Path Copied');
        }).catch(() => {
            prompt('Copy image path:', path);
        });
    } else {
        prompt('Copy image path:', path);
    }
};

window.saveDeliveryPricing = async function() {
    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';
    const rate = Number(document.getElementById('setting-delivery-rate-km')?.value) || 30;
    const estTime = document.getElementById('setting-delivery-est-time')?.value || '25-35 mins';

    try {
        const res = await fetch(`${API_URL}/settings/cloud`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            },
            body: JSON.stringify({ 
                deliveryRateKm: rate, 
                deliveryRate: rate, 
                deliveryEstTime: estTime 
            })
        });

        if (res.ok) {
            window.showAdminToast(`✅ Delivery rate saved: ₹${rate} / KM`, 'success', 'Delivery Pricing Updated');
            loadStoreSettings();
        } else {
            window.showAdminToast('Failed to save delivery pricing. Please check PIN.', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error saving delivery pricing', 'error');
    }
};

// ==========================================================================
// SEO & GOOGLE SEARCH META TAGS CONTROLLER
// ==========================================================================
window.loadSeoSettings = async function() {
    try {
        const settings = await apiCall('/settings');
        if (!settings || !Array.isArray(settings) || settings.length === 0) return;
        const cloud = settings.find(s => s.storeId === 'cloud') || settings[0];
        
        const titleEl = document.getElementById('seo-input-title');
        const descEl = document.getElementById('seo-input-desc');
        const keywordsEl = document.getElementById('seo-input-keywords');
        
        if (titleEl) titleEl.value = cloud.seoTitle || "Littiwale Barbil | Authentic Litti Chokha, Thalis & Best Cloud Kitchen in Barbil";
        if (descEl) descEl.value = cloud.seoDescription || "Order authentic wood-fired Litti Chokha, North & South Indian Thalis, Veg & Non-Veg meals online from Littiwale - Barbil's premier cloud kitchen. Fast delivery in Barbil.";
        if (keywordsEl) keywordsEl.value = cloud.seoKeywords || "littiwale barbil, best restaurant in barbil, litti chokha barbil, online food delivery barbil, cloud kitchen barbil, thali barbil, veg nonveg food barbil, food delivery near me barbil";

        window.updateSeoPreview();
    } catch(e) {
        console.error('Error loading SEO settings:', e);
    }
};

window.updateSeoPreview = function() {
    const titleVal = document.getElementById('seo-input-title')?.value || "Littiwale Barbil | Authentic Litti Chokha, Thalis & Best Cloud Kitchen in Barbil";
    const descVal = document.getElementById('seo-input-desc')?.value || "Order authentic wood-fired Litti Chokha, North & South Indian Thalis, Veg & Non-Veg meals online from Littiwale - Barbil's premier cloud kitchen. Fast delivery in Barbil.";

    const previewTitle = document.getElementById('seo-preview-title');
    const previewDesc = document.getElementById('seo-preview-desc');
    const titleCount = document.getElementById('seo-title-count');
    const descCount = document.getElementById('seo-desc-count');

    if (previewTitle) previewTitle.textContent = titleVal;
    if (previewDesc) previewDesc.textContent = descVal;
    if (titleCount) titleCount.textContent = `${titleVal.length} / 75 chars`;
    if (descCount) descCount.textContent = `${descVal.length} / 200 chars`;
};

window.saveSeoSettings = async function(event) {
    if (event && event.preventDefault) event.preventDefault();

    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';
    const payload = {
        seoTitle: document.getElementById('seo-input-title')?.value,
        seoDescription: document.getElementById('seo-input-desc')?.value,
        seoKeywords: document.getElementById('seo-input-keywords')?.value
    };

    try {
        const res = await fetch(`${API_URL}/settings/cloud`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            window.showAdminToast('✅ SEO Meta Tags saved & live on Google crawler endpoint!', 'success');
            window.loadSeoSettings();
        } else {
            window.showAdminToast('Failed to save SEO settings. Please check PIN.', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error saving SEO settings', 'error');
    }
};

window.resetSeoDefaults = function() {
    if (document.getElementById('seo-input-title')) document.getElementById('seo-input-title').value = "Littiwale Barbil | Authentic Litti Chokha, Thalis & Best Cloud Kitchen in Barbil";
    if (document.getElementById('seo-input-desc')) document.getElementById('seo-input-desc').value = "Order authentic wood-fired Litti Chokha, North & South Indian Thalis, Veg & Non-Veg meals online from Littiwale - Barbil's premier cloud kitchen. Fast delivery in Barbil.";
    if (document.getElementById('seo-input-keywords')) document.getElementById('seo-input-keywords').value = "littiwale barbil, best restaurant in barbil, litti chokha barbil, online food delivery barbil, cloud kitchen barbil, thali barbil, veg nonveg food barbil, food delivery near me barbil";
    window.updateSeoPreview();
    window.showAdminToast('SEO fields reset to recommended high-ranking defaults.', 'info');
};

// ==========================================================================
// ORDER CONFIRMATION & WHATSAPP CUSTOMER MESSAGING
// ==========================================================================
window.openOrderConfirmModal = function(orderId) {
    const order = (window.cachedOrders || []).find(o => String(o._id) === String(orderId) || String(o._id).slice(-6).toUpperCase() === String(orderId).toUpperCase());
    if (!order) {
        window.showAdminToast('Order not found', 'error');
        return;
    }

    window.currentSelectedOrder = order;

    const shortId = order._id ? String(order._id).slice(-6).toUpperCase() : 'LW-ORD';
    const modalTitle = document.getElementById('order-modal-title');
    if (modalTitle) modalTitle.innerHTML = `<span>🛍️</span> <span>Order #${shortId} Confirmation</span>`;

    const custNameEl = document.getElementById('ord-modal-cust-name');
    const custPhoneEl = document.getElementById('ord-modal-cust-phone');
    const custWhatsappWrap = document.getElementById('ord-modal-whatsapp-wrap');
    const custWhatsappEl = document.getElementById('ord-modal-cust-whatsapp');
    const custAddrEl = document.getElementById('ord-modal-cust-address');
    const ordTypeEl = document.getElementById('ord-modal-order-type');
    const statusBadgeEl = document.getElementById('ord-modal-status-badge');
    const delChargeEl = document.getElementById('ord-modal-del-charge');
    const delLockBadge = document.getElementById('ord-modal-del-lock-badge');
    const dispatchBtn = document.getElementById('ord-modal-btn-dispatch');
    const estLabel = document.getElementById('ord-modal-est-label');
    const estTimeEl = document.getElementById('ord-modal-est-time');

    if (custNameEl) custNameEl.textContent = order.customerName || 'Customer';
    if (custPhoneEl) custPhoneEl.textContent = order.customerPhone || 'N/A';
    
    // WhatsApp Phone Indicator
    if (order.whatsappPhone && order.whatsappPhone !== order.customerPhone) {
        if (custWhatsappWrap) custWhatsappWrap.style.display = 'block';
        if (custWhatsappEl) custWhatsappEl.textContent = order.whatsappPhone;
    } else {
        if (custWhatsappWrap) custWhatsappWrap.style.display = 'none';
    }

    const isTakeaway = (order.orderType === 'takeaway');
    if (custAddrEl) custAddrEl.textContent = isTakeaway ? '🛍️ Self Pickup: Littiwale Cloud Kitchen, Barbil' : (order.deliveryAddress || 'Not Provided');
    if (ordTypeEl) ordTypeEl.textContent = isTakeaway ? '🛍️ Takeaway (Self Pickup)' : '🛵 Home Delivery';
    
    if (statusBadgeEl) {
        statusBadgeEl.className = `badge ${order.status === 'delivered' ? 'badge-open' : (order.status === 'cancelled' ? 'badge-closed' : 'badge-new')}`;
        statusBadgeEl.textContent = order.status || 'pending';
    }

    const isPending = (order.status || 'pending').toLowerCase() === 'pending';

    // Handle Takeaway Delivery Charge Lock & Confirmed Status Locking
    if (delChargeEl) {
        if (isTakeaway) {
            delChargeEl.value = 0;
            delChargeEl.disabled = true;
            delChargeEl.style.opacity = '0.6';
            delChargeEl.style.cursor = 'not-allowed';
            if (delLockBadge) {
                delLockBadge.style.display = 'inline-block';
                delLockBadge.textContent = 'Takeaway Free';
            }
            if (dispatchBtn) dispatchBtn.innerHTML = '🛍️ Ready for Pickup';
            if (estLabel) estLabel.textContent = 'Estimated Prep / Pickup Time';
            if (estTimeEl) {
                estTimeEl.value = order.estimatedTime || '15-20 mins';
                estTimeEl.disabled = !isPending;
            }
        } else {
            const currentDel = order.deliveryCharge !== undefined ? order.deliveryCharge : 30;
            delChargeEl.value = currentDel;
            delChargeEl.disabled = !isPending;
            delChargeEl.style.opacity = isPending ? '1' : '0.7';
            delChargeEl.style.cursor = isPending ? 'text' : 'not-allowed';
            if (delLockBadge) {
                delLockBadge.style.display = isPending ? 'none' : 'inline-block';
                delLockBadge.textContent = 'Confirmed (Locked)';
            }
            if (dispatchBtn) dispatchBtn.innerHTML = '📦 Out for Delivery';
            if (estLabel) estLabel.textContent = 'Estimated Delivery Time';
            if (estTimeEl) {
                estTimeEl.value = order.estimatedTime || '25-35 mins';
                estTimeEl.disabled = !isPending;
            }
        }
    }

    // Render items list
    const itemsListEl = document.getElementById('ord-modal-items-list');
    const itemsCountEl = document.getElementById('ord-modal-items-count');
    const items = order.items || [];
    if (itemsCountEl) itemsCountEl.textContent = `${items.length} items`;
    if (itemsListEl) {
        if (items.length === 0) {
            itemsListEl.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">Custom Order Items</div>';
        } else {
            itemsListEl.innerHTML = items.map(it => `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
                    <div>
                        <span style="font-weight:700; color:#fff;">${it.quantity}x</span> 
                        <span style="color:var(--text-main); margin-left:4px;">${it.name}</span>
                    </div>
                    <div style="font-weight:700; color:var(--brand-gold);">₹${it.subtotal || (it.price * it.quantity)}</div>
                </div>
            `).join('');
        }
    }

    // Render Dynamic Action Buttons Based on Status
    const actionBtnsContainer = document.getElementById('ord-modal-action-buttons');
    if (actionBtnsContainer) {
        const rawPhone = (order.customerPhone || '').replace(/\D/g, '').slice(-10);
        const status = (order.status || 'pending').toLowerCase();
        
        let buttonsHtml = `
            <button type="button" class="btn btn-secondary" style="background:rgba(16, 185, 129, 0.15); border:1.5px solid rgba(16, 185, 129, 0.4); color:#10b981; font-weight:800; font-size:13px; padding:10px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="window.openA4InvoiceModal(window.currentSelectedOrder)">
                <span>📄 View & Print Official Bill (A4 PDF)</span>
            </button>
        `;

        if (status === 'pending') {
            buttonsHtml += `
                <button type="button" class="btn btn-primary" style="background:#25d366; color:#000; font-weight:900; font-size:14px; padding:12px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="confirmOrderAndWhatsApp()">
                    <span>💬 Confirm Order & Send WhatsApp Reply</span>
                </button>
                <button type="button" class="btn btn-outline" style="border-color:#ef4444; color:#ef4444; font-size:12.5px; padding:10px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="cancelOrderPrompt()">
                    <span>✕ Reject / Cancel Order</span>
                </button>
            `;
        } else if (status === 'accepted' || status === 'confirmed') {
            buttonsHtml += `
                <button type="button" class="btn btn-primary" style="background:linear-gradient(135deg, #3b82f6, #2563eb); color:#fff; font-weight:900; font-size:14px; padding:12px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="quickUpdateOrderStatus('dispatched')">
                    <span>📦 Mark Out for Delivery (Dispatch)</span>
                </button>
                <div style="display:flex; gap:10px;">
                    <a href="https://wa.me/91${rawPhone}" target="_blank" class="btn btn-secondary" style="flex:1; background:#25d366; color:#000; font-weight:700; font-size:12px; display:flex; align-items:center; justify-content:center; gap:6px; text-decoration:none;">
                        <span>💬 WhatsApp Customer</span>
                    </a>
                    <button type="button" class="btn btn-outline" style="flex:1; border-color:#ef4444; color:#ef4444; font-size:12px; font-weight:700;" onclick="cancelOrderPrompt()">
                        <span>✕ Cancel Order</span>
                    </button>
                </div>
            `;
        } else if (status === 'dispatched') {
            buttonsHtml += `
                <button type="button" class="btn btn-primary" style="background:linear-gradient(135deg, #10b981, #059669); color:#fff; font-weight:900; font-size:14px; padding:12px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="quickUpdateOrderStatus('delivered')">
                    <span>🎉 Mark Order as Delivered</span>
                </button>
                <div style="display:flex; gap:10px;">
                    <a href="https://wa.me/91${rawPhone}" target="_blank" class="btn btn-secondary" style="flex:1; background:#25d366; color:#000; font-weight:700; font-size:12px; display:flex; align-items:center; justify-content:center; gap:6px; text-decoration:none;">
                        <span>💬 WhatsApp Customer</span>
                    </a>
                    <button type="button" class="btn btn-outline" style="flex:1; border-color:#ef4444; color:#ef4444; font-size:12px; font-weight:700;" onclick="cancelOrderPrompt()">
                        <span>✕ Cancel Order</span>
                    </button>
                </div>
            `;
        } else if (status === 'delivered') {
            buttonsHtml += `
                <div style="background:rgba(16, 185, 129, 0.1); border:1.5px solid #10b981; border-radius:10px; padding:12px; text-align:center; color:#34d399; font-weight:800; font-size:13.5px;">
                    ✅ Order Successfully Delivered & Completed
                </div>
                <a href="https://wa.me/91${rawPhone}" target="_blank" class="btn btn-secondary" style="background:#25d366; color:#000; font-weight:700; font-size:12.5px; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; text-decoration:none;">
                    <span>💬 WhatsApp Customer</span>
                </a>
            `;
        } else {
            buttonsHtml += `
                <div style="background:rgba(239, 68, 68, 0.1); border:1.5px solid #ef4444; border-radius:10px; padding:12px; text-align:center; color:#f87171; font-weight:800; font-size:13.5px;">
                    ✕ This Order Was Cancelled
                </div>
            `;
        }

        actionBtnsContainer.innerHTML = buttonsHtml;
    }

    // Set Subtotal, Delivery Charge & Grand Total
    const subtotal = Number(order.subtotal || order.finalTotal || 0);
    const subtotalEl = document.getElementById('ord-modal-subtotal');
    if (subtotalEl) subtotalEl.textContent = `₹${subtotal}`;

    window.recalcOrderModalTotal();
    openModal('order-confirm-modal');
};

window.recalcOrderModalTotal = function() {
    const order = window.currentSelectedOrder;
    if (!order) return;

    const subtotal = Number(order.subtotal || order.finalTotal || 0);
    const discount = Number(order.discount || 0);
    const isTakeaway = (order.orderType === 'takeaway');
    const delCharge = isTakeaway ? 0 : (Number(document.getElementById('ord-modal-del-charge')?.value) || 0);
    const finalTotal = Math.max(0, subtotal - discount + delCharge);

    const finalTotalEl = document.getElementById('ord-modal-final-total');
    if (finalTotalEl) finalTotalEl.textContent = `₹${finalTotal}`;
};

window.confirmOrderAndWhatsApp = async function() {
    const order = window.currentSelectedOrder;
    if (!order || !order._id) return;

    const isTakeaway = (order.orderType === 'takeaway');
    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';
    const delCharge = isTakeaway ? 0 : (Number(document.getElementById('ord-modal-del-charge')?.value) || 0);
    const subtotal = Number(order.subtotal || order.finalTotal || 0);
    const discount = Number(order.discount || 0);
    const finalTotal = Math.max(0, subtotal - discount + delCharge);
    const estTime = document.getElementById('ord-modal-est-time')?.value || (isTakeaway ? '15-20 mins' : '25-35 mins');

    try {
        const res = await fetch(`${API_URL}/orders/${order._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            },
            body: JSON.stringify({
                status: 'accepted',
                deliveryCharge: delCharge,
                finalTotal: finalTotal
            })
        });

        if (res.ok) {
            window.showAdminToast(`✅ Order #${String(order._id).slice(-6).toUpperCase()} Confirmed!`, 'success');
            closeModal('order-confirm-modal');
            window.fetchAndRenderOrders();

            // Build formatted WhatsApp confirmation message
            const shortId = String(order._id).slice(-6).toUpperCase();
            const itemsList = (order.items || []).map(it => `• ${it.quantity}x ${it.name} (₹${it.subtotal || (it.price * it.quantity)})`).join('\n') || '• Order Items';
            
            // Send to customer's WhatsApp phone (or calling phone as fallback)
            const targetPhone = order.whatsappPhone || order.customerPhone || '';
            const rawPhone = String(targetPhone).replace(/\D/g, '');
            const cleanPhone = rawPhone.length > 10 ? rawPhone.slice(-10) : rawPhone;

            const orderTypeHeader = isTakeaway ? '*🛍️ TAKEAWAY ORDER CONFIRMED — LITTIWALE BARBIL*' : '*✅ ORDER CONFIRMED — LITTIWALE BARBIL*';
            const locationInfo = isTakeaway ? `*📍 Pickup Location:* Littiwale Cloud Kitchen, Barbil\n*⏱️ Ready for Pickup in:* ${estTime}` : `*📍 Delivery Address:* ${order.deliveryAddress || 'Barbil'}\n*⏱️ Estimated Delivery:* ${estTime}`;

            const msg = `${orderTypeHeader}\n\n` +
                        `Hi *${order.customerName || 'Customer'}*,\n` +
                        `Your order *#${shortId}* has been accepted and is now being prepared fresh! 👨‍🍳🔥\n\n` +
                        `*📋 Order Items:*\n${itemsList}\n\n` +
                        `*Items Total:* ₹${subtotal}\n` +
                        (isTakeaway ? `*Delivery Fee:* ₹0 (Self Pickup)\n` : `*Delivery Fee:* ₹${delCharge}\n`) +
                        `*Grand Total Payable:* ₹${finalTotal} (${order.paymentMethod || 'COD'})\n\n` +
                        `${locationInfo}\n\n` +
                        `*🧾 Live Status & Download Bill:* https://littiwale.com/track.html?id=${order._id}\n\n` +
                        (isTakeaway ? `We look forward to serving you at our kitchen counter. Thank you for choosing *Littiwale*! ❤️` : `Your hot delicious food is on the way. Thank you for ordering from *Littiwale*! ❤️`);

            const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`;
            window.open(whatsappUrl, '_blank');
        } else {
            window.showAdminToast('Failed to confirm order. Please verify Admin PIN.', 'error');
        }
    } catch(e) {
        console.error('Confirm order error:', e);
        window.showAdminToast('Error confirming order', 'error');
    }
};

window.cancelOrderPrompt = async function(orderId = null) {
    let order = null;
    if (orderId) {
        order = (window.cachedOrders || []).find(o => String(o._id) === String(orderId) || String(o._id).slice(-6).toUpperCase() === String(orderId).toUpperCase());
    } else {
        order = window.currentSelectedOrder;
    }

    if (!order || !order._id) {
        window.showAdminToast('Order not found', 'error');
        return;
    }

    const shortId = String(order._id).slice(-6).toUpperCase();
    const reason = prompt(`Reason for Rejecting / Cancelling Order #${shortId} (e.g. Kitchen overloaded / Item out of stock / Location unserviceable):`, 'Kitchen at maximum capacity / Item out of stock');
    if (reason === null) return; // User pressed Cancel in prompt

    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';

    try {
        const res = await fetch(`${API_URL}/orders/${order._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            },
            body: JSON.stringify({ 
                status: 'cancelled',
                cancelReason: reason.trim() || 'Kitchen at maximum capacity'
            })
        });

        if (res.ok) {
            window.showAdminToast(`❌ Order #${shortId} Cancelled`, 'warning', 'Order Rejected');
            closeModal('order-confirm-modal');
            window.fetchAndRenderOrders();

            // Send polite cancellation notice to customer via WhatsApp
            const targetPhone = order.whatsappPhone || order.customerPhone || '';
            const rawPhone = String(targetPhone).replace(/\D/g, '');
            const cleanPhone = rawPhone.length > 10 ? rawPhone.slice(-10) : rawPhone;

            if (cleanPhone) {
                const cancelMsg = `*❌ ORDER CANCELLATION UPDATE — LITTIWALE BARBIL*\n\n` +
                                  `Dear *${order.customerName || 'Customer'}*,\n` +
                                  `We regret to inform you that your order *#${shortId}* could not be fulfilled at this time.\n\n` +
                                  `*Reason:* ${reason.trim() || 'Kitchen temporarily overloaded / Item out of stock'}\n\n` +
                                  `We sincerely apologize for the inconvenience caused. If you have already completed an online payment, our team will initiate your refund.\n\n` +
                                  `For any queries or direct assistance, please reply to this WhatsApp message. Thank you for your understanding! 🙏`;

                const notifyWa = confirm(`Order #${shortId} has been marked CANCELLED in database.\n\nWould you like to send a cancellation update to the customer on WhatsApp?`);
                if (notifyWa) {
                    const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(cancelMsg)}`;
                    window.open(waUrl, '_blank');
                }
            }
        } else {
            window.showAdminToast('Failed to cancel order. Please verify Admin PIN.', 'error');
        }
    } catch(e) {
        console.error('Cancel order error:', e);
        window.showAdminToast('Error cancelling order', 'error');
    }
};

window.quickUpdateOrderStatus = async function(newStatus) {
    const order = window.currentSelectedOrder;
    if (!order || !order._id) return;

    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';

    try {
        const res = await fetch(`${API_URL}/orders/${order._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (res.ok) {
            window.showAdminToast(`Order status updated to: ${newStatus.toUpperCase()}`, 'success');
            closeModal('order-confirm-modal');
            window.fetchAndRenderOrders();
        } else {
            window.showAdminToast('Failed to update status', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error updating status', 'error');
    }
};
