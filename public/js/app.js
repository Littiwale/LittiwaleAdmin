const API_URL = '/api';
let authPin = localStorage.getItem('adminPin') || '';
let authToken = localStorage.getItem('adminToken') || '';
var adminReelsList = [];
var adminDealsList = [];

// Instant Fast Cache Restore (0ms)
try {
    const cm = localStorage.getItem('lw_admin_menu_cache');
    window.cachedMenuItems = cm ? JSON.parse(cm) : [];
    const cc = localStorage.getItem('lw_admin_cat_cache');
    window.cachedCategories = cc ? JSON.parse(cc) : [];
} catch(e) {
    window.cachedMenuItems = [];
    window.cachedCategories = [];
}
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

function getInitialActiveSection() {
    // 1. Check URL Hash
    const hash = (window.location.hash || '').replace(/^#/, '').trim();
    if (hash) {
        if (hash.startsWith('media-')) {
            const cmsTab = hash.replace('media-', '');
            sessionStorage.setItem('lw_admin_active_cms_tab', cmsTab);
            return 'media-section';
        }
        const candidateId = hash.endsWith('-section') ? hash : `${hash}-section`;
        if (document.getElementById(candidateId)) return candidateId;
    }
    // 2. Check Session Storage
    const saved = sessionStorage.getItem('lw_admin_active_section');
    if (saved && document.getElementById(saved)) return saved;

    return 'dashboard-section';
}

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
        const startSec = getInitialActiveSection();
        window.switchSection(startSec);
        const savedCmsTab = sessionStorage.getItem('lw_admin_active_cms_tab');
        if (startSec === 'media-section' && savedCmsTab && typeof window.switchCmsSubTab === 'function') {
            window.switchCmsSubTab(savedCmsTab);
        }
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
let alarmIntervalId = null;
let isAlarmMuted = false;

// Request Web Notifications permission upon interaction
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
}
document.addEventListener('click', requestNotificationPermission, { once: true });
document.addEventListener('touchstart', requestNotificationPermission, { once: true });

function playLoudAlarmPulse() {
    if (isAlarmMuted) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        // Two-tone loud restaurant order chime
        const now = ctx.currentTime;
        
        // Tone 1 (High chime)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(659.25, now); // E5
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
        gain1.gain.setValueAtTime(0.5, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.3);

        // Tone 2 (Alert ring)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.25);
        osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.5); // D6
        gain2.gain.setValueAtTime(0.6, now + 0.25);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.25);
        osc2.stop(now + 0.65);

        // Mobile Device Vibration
        if ('vibrate' in navigator) {
            navigator.vibrate([400, 150, 400, 150, 600]);
        }
    } catch(e) {
        console.warn('Audio play error:', e);
    }
}

function startOrderAlarmLoop() {
    if (!alarmIntervalId) {
        playLoudAlarmPulse();
        alarmIntervalId = setInterval(playLoudAlarmPulse, 3200);
    }
}

function stopOrderAlarmLoop() {
    if (alarmIntervalId) {
        clearInterval(alarmIntervalId);
        alarmIntervalId = null;
    }
}

window.muteAlarmChime = function() {
    isAlarmMuted = true;
    stopOrderAlarmLoop();
    window.showAdminToast('🔇 Order sound muted for this session', 'info');
};

window.openFirstPendingOrderModal = function() {
    const orders = window.cachedOrders || [];
    const firstPending = orders.find(o => o.status === 'pending');
    if (firstPending) {
        window.openQuickOrderModal(firstPending._id || firstPending.id);
    } else if (orders.length > 0) {
        window.openQuickOrderModal(orders[0]._id || orders[0].id);
    }
};

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
                    isAlarmMuted = false;
                    const latest = newOrders[0];
                    const shortId = latest._id ? String(latest._id).slice(-6).toUpperCase() : 'LW';
                    if (typeof window.showAdminToast === 'function') {
                        window.showAdminToast(`🔔 New Order #${shortId} Received from ${latest.customerName || 'Customer'}!`, 'success');
                    }

                    // Native Web Push / Notification
                    if ('Notification' in window && Notification.permission === 'granted') {
                        try {
                            new Notification(`🔔 New Order #${shortId} Received!`, {
                                body: `${latest.customerName || 'Customer'} • ₹${latest.finalTotal || latest.total} • ${latest.orderType === 'takeaway' ? 'Takeaway' : 'Delivery'}`,
                                icon: '/images/logo.png',
                                badge: '/images/logo.png'
                            });
                        } catch(e) {}
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

    // 🚨 Manage Top Alarm Bar and Sound Loop based on pending orders
    const alarmBar = document.getElementById('pending-orders-alarm-bar');
    const alarmBarText = document.getElementById('alarm-bar-text');
    if (pendingOrders.length > 0) {
        if (alarmBar) {
            alarmBar.style.display = 'flex';
            if (alarmBarText) {
                alarmBarText.textContent = `🚨 ${pendingOrders.length} NEW PENDING ORDER${pendingOrders.length > 1 ? 'S' : ''} WAITING!`;
            }
        }
        startOrderAlarmLoop();
    } else {
        if (alarmBar) alarmBar.style.display = 'none';
        stopOrderAlarmLoop();
    }

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
                    <button class="btn btn-sm btn-primary" style="padding:4px 9px; font-size:11.5px; background:#25d366; color:#000; font-weight:800;" onclick="closeOrderNotifications(); openOrderQuickModal('${ord._id}')" title="Confirm Order">✅ Actions</button>
                    <button class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:11.5px; border-color:#ef4444; color:#ef4444;" onclick="closeOrderNotifications(); cancelOrderPrompt('${ord._id}')" title="Reject Order">✕</button>
                </div>
            `;
            
            if (status === 'accepted' || status === 'confirmed') {
                statusPill = `<span class="badge badge-active" style="font-size:10px;">Kitchen</span>`;
                actionBtn = `<button class="btn btn-sm btn-info" style="padding:4px 10px; font-size:11.5px; font-weight:700;" onclick="closeOrderNotifications(); openOrderQuickModal('${ord._id}')">📦 Dispatch →</button>`;
            } else if (status === 'dispatched') {
                statusPill = `<span class="badge badge-info" style="font-size:10px;">On Way</span>`;
                actionBtn = `<button class="btn btn-sm btn-success" style="padding:4px 10px; font-size:11.5px; font-weight:700;" onclick="closeOrderNotifications(); openOrderQuickModal('${ord._id}')">🎉 Deliver →</button>`;
            }

            return `
                <div class="notif-item ${status}" style="padding:13px 16px; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; gap:7px; cursor:pointer;" onclick="closeOrderNotifications(); openOrderQuickModal('${ord._id}')">
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
                        <div onclick="event.stopPropagation();">${actionBtn}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
};

window.toggleOrderNotificationsDropdown = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const drop = document.getElementById('order-notifications-dropdown');
    const backdrop = document.getElementById('order-notifications-backdrop');
    if (drop) {
        window.renderOrderNotifications();
        if (drop.classList.contains('show')) {
            drop.classList.remove('show');
            if (backdrop) backdrop.classList.remove('show');
        } else {
            drop.classList.add('show');
            if (backdrop) backdrop.classList.add('show');
        }
    }
};

window.closeOrderNotifications = function() {
    const drop = document.getElementById('order-notifications-dropdown');
    const backdrop = document.getElementById('order-notifications-backdrop');
    if (drop) drop.classList.remove('show');
    if (backdrop) backdrop.classList.remove('show');
};

window.openAllOrdersSection = function() {
    window.closeOrderNotifications();
    window.switchSection('orders-section');
};

// =========================================================================
// ⚡ QUICK ORDER DETAILS & 1-TAP ACTION MODAL (MOBILE FIRST)
// =========================================================================
window.openOrderQuickModal = function(orderId) {
    const orders = window.cachedOrders || [];
    const ord = orders.find(o => String(o._id) === String(orderId)) || orders.find(o => String(o.id) === String(orderId));
    if (!ord) {
        showToast('Order details not found in cache.', 'error');
        return;
    }

    window.currentQuickOrderId = ord._id || ord.id;

    const shortId = ord._id ? String(ord._id).slice(-6).toUpperCase() : 'LW-ORD';
    const status = (ord.status || 'pending').toLowerCase();
    const formattedTime = ord.createdAt ? new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const formattedDate = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
    const isTakeaway = (ord.orderType === 'takeaway');
    const orderType = (ord.orderType || 'Delivery').toUpperCase();

    // 1. Header
    const idTitle = document.getElementById('quick-order-id-title');
    if (idTitle) idTitle.textContent = `#${shortId}`;

    const badgeEl = document.getElementById('quick-order-status-badge');
    if (badgeEl) {
        badgeEl.textContent = status.toUpperCase();
        badgeEl.className = `badge ${status === 'delivered' ? 'badge-open' : (status === 'cancelled' ? 'badge-closed' : (status === 'accepted' || status === 'confirmed' ? 'badge-active' : (status === 'dispatched' ? 'badge-info' : 'badge-new')))}`;
    }

    const timeTypeEl = document.getElementById('quick-order-time-type');
    if (timeTypeEl) timeTypeEl.textContent = `${formattedDate} • ${formattedTime} • ${orderType}`;

    // 1.1 Order Type Quick Switcher Buttons Active State & Dispatch Lock
    const isDispatchedOrDone = (status === 'dispatched' || status === 'delivered' || status === 'cancelled');
    const hintEl = document.getElementById('quick-order-type-hint');
    if (hintEl) {
        hintEl.textContent = isDispatchedOrDone ? '🔒 Locked (Rider Assigned / Out for Delivery)' : '⚡ Instant Bill Recalculation';
        hintEl.style.color = isDispatchedOrDone ? '#f59e0b' : '#38bdf8';
    }

    const delBtn = document.getElementById('toggle-type-delivery-btn');
    const takeBtn = document.getElementById('toggle-type-takeaway-btn');
    if (delBtn) {
        delBtn.className = 'order-type-switch-btn' + (!isTakeaway ? ' active-delivery' : '');
        delBtn.style.opacity = isDispatchedOrDone ? '0.6' : '1';
        delBtn.style.cursor = isDispatchedOrDone ? 'not-allowed' : 'pointer';
    }
    if (takeBtn) {
        takeBtn.className = 'order-type-switch-btn' + (isTakeaway ? ' active-takeaway' : '');
        takeBtn.style.opacity = isDispatchedOrDone ? '0.6' : '1';
        takeBtn.style.cursor = isDispatchedOrDone ? 'not-allowed' : 'pointer';
    }

    // 2. Primary Workflow Action Card
    const actionCard = document.getElementById('quick-order-primary-action-card');
    if (actionCard) {
        if (status === 'pending') {
            const subtotal = Number(ord.subtotal || ord.finalTotal || 0);
            const discount = Number(ord.discount || 0);
            const isTakeaway = (ord.orderType === 'takeaway');
            const currentDelCharge = isTakeaway ? 0 : Number(ord.deliveryCharge || 0);
            const currentFinalTotal = Math.max(0, subtotal - discount + currentDelCharge);

            actionCard.innerHTML = `
                <div style="background:rgba(37,211,102,0.08); border:1.5px solid rgba(37,211,102,0.35); border-radius:14px; padding:16px;">
                    <div style="font-weight:900; font-size:13.5px; color:#25d366; margin-bottom:12px; text-align:center;">
                        ⚡ STEP 1: ${isTakeaway ? 'REVIEW & ACCEPT TAKEAWAY ORDER' : 'SET DELIVERY CHARGE & ACCEPT ORDER'}
                    </div>
                    
                    <!-- Pricing Calculation Box -->
                    <div style="background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:12.5px;">
                            <span style="color:#94a3b8;">Items Subtotal:</span>
                            <strong style="color:#fff;" id="quick-subtotal-val">₹${subtotal}</strong>
                        </div>

                        ${isTakeaway ? `
                        <!-- Takeaway: No delivery charge row, show pickup badge instead -->
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:12.5px;">
                            <span style="color:#94a3b8;">Order Type:</span>
                            <span style="background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.35); color:#38bdf8; font-weight:800; font-size:11px; padding:3px 10px; border-radius:20px;">🛍️ TAKEAWAY — No Delivery Fee</span>
                        </div>
                        ` : `
                        <!-- Delivery: Show editable delivery charge -->
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:10px;">
                            <label style="color:var(--brand-orange); font-weight:800; font-size:13px; margin:0; display:flex; align-items:center; gap:4px;">
                                <span>🛵 Delivery Charge (₹):</span>
                            </label>
                            <input type="number" id="quick-del-charge-input" class="form-control" style="width:110px; text-align:right; font-weight:900; font-size:15px; padding:6px 10px; color:#fff; background:#1e1e28; border:1.5px solid var(--brand-orange); border-radius:8px;" value="${currentDelCharge}" min="0" oninput="window.recalcQuickDelCharge('${ord._id}')">
                        </div>
                        `}

                        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1); font-size:14px;">
                            <span style="color:#fff; font-weight:800;">Grand Total Payable:</span>
                            <strong style="color:var(--brand-gold); font-size:18px;" id="quick-grand-total-val">₹${currentFinalTotal}</strong>
                        </div>
                    </div>

                    <!-- Prep Time Input -->
                    <div style="margin-bottom:14px;">
                        <label style="font-size:11.5px; font-weight:700; color:#94a3b8; margin-bottom:4px; display:block;">⏱️ Estimated ${isTakeaway ? 'Prep / Pickup' : 'Prep / Delivery'} Time</label>
                        <input type="text" id="quick-est-time-input" class="form-control" style="padding:8px 12px; font-size:13px; color:#fff; background:#1e1e28; border-radius:8px; border:1px solid rgba(255,255,255,0.1);" value="${isTakeaway ? '15-20 mins' : '25-35 mins'}" placeholder="e.g. 25-35 mins">
                    </div>

                    <div style="display:flex; gap:10px;">
                        <button type="button" class="btn btn-primary" style="flex:2; background:#25d366; color:#000; font-weight:900; font-size:14px; padding:12px; border-radius:10px; box-shadow:0 4px 15px rgba(37,211,102,0.35);" onclick="window.confirmQuickOrder('${ord._id}')">
                            ✅ Accept & Confirm Order
                        </button>
                        <button type="button" class="btn btn-outline" style="flex:1; border-color:#ef4444; color:#ef4444; font-weight:800; font-size:13px; padding:12px; border-radius:10px;" onclick="closeModal('order-quick-modal'); cancelOrderPrompt('${ord._id}');">
                            ✕ Reject
                        </button>
                    </div>
                </div>
            `;
        } else if (status === 'accepted' || status === 'confirmed') {
            const isTakeaway = (ord.orderType === 'takeaway');
            if (isTakeaway) {
                actionCard.innerHTML = `
                    <div style="background:rgba(245,158,11,0.1); border:1.5px solid rgba(245,158,11,0.35); border-radius:14px; padding:16px; text-align:center;">
                        <div style="font-weight:900; font-size:14px; color:#fbbf24; margin-bottom:12px;">⚡ STEP 2: FOOD PACKED & READY FOR PICKUP?</div>
                        <button type="button" class="btn btn-primary" style="width:100%; background:linear-gradient(135deg, #f59e0b, #d97706); color:#000; font-weight:900; font-size:14px; padding:13px; border-radius:10px; box-shadow:0 4px 15px rgba(245,158,11,0.4);" onclick="closeModal('order-quick-modal'); window.markTakeawayReady('${ord._id}');">
                            🛍️ Mark Ready for Pickup & Notify Customer →
                        </button>
                    </div>
                `;
            } else {
                actionCard.innerHTML = `
                    <div style="background:rgba(59,130,246,0.1); border:1.5px solid rgba(59,130,246,0.35); border-radius:14px; padding:16px; text-align:center;">
                        <div style="font-weight:900; font-size:14px; color:#60a5fa; margin-bottom:12px;">⚡ STEP 2: FOOD READY? ASSIGN RIDER</div>
                        <button type="button" class="btn btn-primary" style="width:100%; background:linear-gradient(135deg, #3b82f6, #2563eb); color:#fff; font-weight:900; font-size:14px; padding:13px; border-radius:10px; box-shadow:0 4px 15px rgba(59,130,246,0.4);" onclick="closeModal('order-quick-modal'); openDispatchModal('${ord._id}');">
                            📦 Assign Delivery Partner & Dispatch →
                        </button>
                    </div>
                `;
            }
        } else if (status === 'dispatched') {
            const isTakeaway = (ord.orderType === 'takeaway');
            if (isTakeaway) {
                actionCard.innerHTML = `
                    <div style="background:rgba(16,185,129,0.1); border:1.5px solid rgba(16,185,129,0.35); border-radius:14px; padding:14px 12px; text-align:center; box-sizing:border-box; overflow:hidden;">
                        <div style="font-weight:900; font-size:13px; color:#34d399; margin-bottom:4px;">⚡ STEP 3: WAITING FOR PICKUP</div>
                        <div style="font-size:11.5px; color:#cbd5e1; margin-bottom:10px;">Customer notified to collect order from Littiwale counter</div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            <button type="button" class="btn btn-primary" style="width:100%; background:#10b981; color:#000; font-weight:900; font-size:13.5px; padding:12px 10px; border-radius:10px; white-space:normal; line-height:1.2;" onclick="closeModal('order-quick-modal'); directUpdateOrderStatus('${ord._id}', 'delivered'); setTimeout(() => sendCustomerDeliveredWhatsApp('${ord._id}'), 500);">
                                ✅ Mark Picked Up & Completed
                            </button>
                            <button type="button" class="btn btn-secondary" style="width:100%; background:rgba(37,211,102,0.15); border:1px solid #25d366; color:#4ade80; font-weight:800; font-size:12.5px; padding:9px 10px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; gap:6px; white-space:normal; line-height:1.2;" onclick="sendTakeawayReadyWhatsApp('${ord._id}')">
                                <span>💬 Re-Send WhatsApp Pickup Alert</span>
                            </button>
                        </div>
                    </div>
                `;
            } else {
                const riderName = ord.assignedDeliveryBoy?.name || ord.deliveryBoyName || 'Rider';
                const riderPhone = ord.assignedDeliveryBoy?.phone || ord.deliveryBoyPhone || '';
                actionCard.innerHTML = `
                    <div style="background:rgba(16,185,129,0.1); border:1.5px solid rgba(16,185,129,0.35); border-radius:14px; padding:14px 12px; text-align:center; box-sizing:border-box; overflow:hidden;">
                        <div style="font-weight:900; font-size:13px; color:#34d399; margin-bottom:4px;">⚡ STEP 3: ORDER OUT FOR DELIVERY</div>
                        ${riderPhone ? `<div style="font-size:11.5px; color:#cbd5e1; margin-bottom:10px;">Assigned Rider: <strong>${riderName}</strong> (<a href="tel:${riderPhone}" style="color:#38bdf8; text-decoration:none;">📞 ${riderPhone}</a>)</div>` : '<div style="margin-bottom:8px;"></div>'}
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            <button type="button" class="btn btn-primary" style="width:100%; background:#10b981; color:#000; font-weight:900; font-size:13.5px; padding:12px 10px; border-radius:10px; white-space:normal; line-height:1.2;" onclick="closeModal('order-quick-modal'); directUpdateOrderStatus('${ord._id}', 'delivered'); setTimeout(() => sendCustomerDeliveredWhatsApp('${ord._id}'), 500);">
                                🎉 Mark Order Delivered (Completed)
                            </button>
                            <button type="button" class="btn btn-secondary" style="width:100%; background:rgba(37,211,102,0.15); border:1px solid #25d366; color:#4ade80; font-weight:800; font-size:12.5px; padding:9px 10px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; gap:6px; white-space:normal; line-height:1.2;" onclick="sendCustomerDeliveredWhatsApp('${ord._id}')">
                                <span>💬 Send WhatsApp Thank You Note</span>
                            </button>
                        </div>
                    </div>
                `;
            }
        } else if (status === 'delivered') {
            actionCard.innerHTML = `
                <div style="background:rgba(16,185,129,0.08); border:1.5px solid rgba(16,185,129,0.3); border-radius:14px; padding:14px 12px; text-align:center; box-sizing:border-box; overflow:hidden;">
                    <div style="color:#34d399; font-weight:800; font-size:13px; margin-bottom:8px;">🎉 Order Completed & Delivered</div>
                    <button type="button" class="btn btn-primary" style="width:100%; background:#25d366; color:#000; font-weight:900; font-size:13px; padding:11px 10px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; gap:6px; white-space:normal; line-height:1.2;" onclick="sendCustomerDeliveredWhatsApp('${ord._id}')">
                        <span>📲 Send WhatsApp Review & Thank You</span>
                    </button>
                </div>
            `;
        } else {
            actionCard.innerHTML = `
                <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:12px; padding:12px; text-align:center; color:#f87171; font-weight:800; font-size:13.5px;">
                    ✕ Order Cancelled
                </div>
            `;
        }
    }

    // 3. Customer Info
    const custName = ord.customerName || 'Customer';
    const targetPhone = ord.whatsappPhone || ord.customerPhone || '';
    const rawPhone = targetPhone.replace(/\D/g, '').slice(-10);
    const fullAddress = ord.deliveryAddress || ord.address || (ord.orderType === 'dinein' ? 'Dine-In at Restaurant' : 'Takeaway / Self-Pickup');

    const nameEl = document.getElementById('quick-cust-name');
    if (nameEl) nameEl.textContent = custName;

    const callBtn = document.getElementById('quick-cust-call-btn');
    if (callBtn) {
        if (targetPhone) {
            callBtn.href = `tel:${targetPhone}`;
            callBtn.style.display = 'inline-flex';
        } else {
            callBtn.style.display = 'none';
        }
    }

    const waBtn = document.getElementById('quick-cust-wa-btn');
    if (waBtn) {
        if (rawPhone) {
            waBtn.removeAttribute('href');
            waBtn.removeAttribute('target');
            waBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.openWhatsAppQuickModal(ord._id);
            };
            waBtn.style.display = 'inline-flex';
            waBtn.style.cursor = 'pointer';
        } else {
            waBtn.style.display = 'none';
        }
    }

    const addrEl = document.getElementById('quick-cust-address');
    if (addrEl) addrEl.textContent = fullAddress;

    // Special Instructions / Customer Notes
    const notesText = (ord.notes || ord.deliveryNotes || ord.restaurantNote || '').trim();
    const notesWrap = document.getElementById('quick-order-notes-wrap');
    const notesEl = document.getElementById('quick-order-notes-text');
    if (notesWrap && notesEl) {
        if (notesText) {
            notesWrap.style.display = 'block';
            notesEl.textContent = notesText;
        } else {
            notesWrap.style.display = 'none';
            notesEl.textContent = '';
        }
    }

    // 4. Items List
    const itemsListEl = document.getElementById('quick-order-items-list');
    if (itemsListEl) {
        const items = ord.items || [];
        if (items.length === 0) {
            itemsListEl.innerHTML = '<div style="color:var(--text-dim); font-size:12px; text-align:center;">Custom Items</div>';
        } else {
            itemsListEl.innerHTML = items.map(it => `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
                    <div>
                        <strong style="color:#fff;">${it.quantity}x</strong> 
                        <span style="color:#cbd5e1; margin-left:4px;">${it.name}</span>
                    </div>
                    <strong style="color:var(--brand-gold);">₹${it.subtotal || (it.price * it.quantity)}</strong>
                </div>
            `).join('');
        }
    }

    // 5. Bill Summary Breakdown (Subtotal + Delivery Fee + Discount = Grand Total)
    const summarySubtotalEl = document.getElementById('quick-summary-subtotal');
    const summaryDelFeeEl = document.getElementById('quick-summary-del-fee');
    const summaryDiscountEl = document.getElementById('quick-summary-discount');
    const summaryDiscountRow = document.getElementById('quick-summary-discount-row');
    const grandTotalEl = document.getElementById('quick-order-grand-total');

    const ordSubtotal = Number(ord.subtotal || 0);
    const ordDelFee = Number(ord.deliveryCharge || 0);
    const ordDiscount = Number(ord.discount || 0);
    const ordGrandTotal = Number(ord.finalTotal || ord.total || ordSubtotal + ordDelFee - ordDiscount);

    if (summarySubtotalEl) summarySubtotalEl.textContent = `₹${ordSubtotal}`;
    if (summaryDelFeeEl) {
        const isTakeawayOrder = (ord.orderType === 'takeaway');
        summaryDelFeeEl.textContent = isTakeawayOrder ? '₹0 (Takeaway)' : (ordDelFee > 0 ? `+₹${ordDelFee}` : '₹0 (Free)');
        summaryDelFeeEl.style.color = isTakeawayOrder ? '#38bdf8' : (ordDelFee > 0 ? 'var(--brand-orange)' : '#22c55e');
    }
    if (summaryDiscountRow && summaryDiscountEl) {
        if (ordDiscount > 0) {
            summaryDiscountRow.style.display = 'flex';
            summaryDiscountEl.textContent = `-₹${ordDiscount}`;
        } else {
            summaryDiscountRow.style.display = 'none';
        }
    }
    if (grandTotalEl) grandTotalEl.textContent = `₹${ordGrandTotal}`;

    // 6. Secondary Tool Buttons Setup
    const printKotBtn = document.getElementById('quick-print-kot-btn');
    if (printKotBtn) {
        printKotBtn.onclick = () => window.openThermalKotModal(ord);
    }
    const printBillBtn = document.getElementById('quick-print-bill-btn');
    if (printBillBtn) {
        printBillBtn.onclick = () => window.openA4InvoiceModal(ord);
    }

    openModal('order-quick-modal');
};

window.recalcQuickDelCharge = function(orderId) {
    const orders = window.cachedOrders || [];
    const ord = orders.find(o => String(o._id) === String(orderId)) || orders.find(o => String(o.id) === String(orderId));
    if (!ord) return;

    const subtotal = Number(ord.subtotal || ord.finalTotal || 0);
    const discount = Number(ord.discount || 0);
    const isTakeaway = (ord.orderType === 'takeaway');
    const delCharge = isTakeaway ? 0 : (Number(document.getElementById('quick-del-charge-input')?.value) || 0);
    const finalTotal = Math.max(0, subtotal - discount + delCharge);

    // Update the top action card total
    const grandTotalEl = document.getElementById('quick-grand-total-val');
    if (grandTotalEl) grandTotalEl.textContent = `₹${finalTotal}`;

    // Also update the bottom summary breakdown
    const summaryDelFeeEl = document.getElementById('quick-summary-del-fee');
    if (summaryDelFeeEl) {
        summaryDelFeeEl.textContent = isTakeaway ? '₹0 (Takeaway)' : (delCharge > 0 ? `+₹${delCharge}` : '₹0 (Free)');
        summaryDelFeeEl.style.color = delCharge > 0 ? 'var(--brand-orange)' : '#22c55e';
    }
    const mainTotalEl = document.getElementById('quick-order-grand-total');
    if (mainTotalEl) mainTotalEl.textContent = `₹${finalTotal}`;
};

window.handleOrderTypeToggleClick = async function(targetType) {
    const orderId = window.currentQuickOrderId;
    if (!orderId) return;

    const orders = window.cachedOrders || [];
    const ord = orders.find(o => String(o._id) === String(orderId)) || orders.find(o => String(o.id) === String(orderId));
    if (!ord) return;

    const currentStatus = (ord.status || 'pending').toLowerCase();
    if (currentStatus === 'dispatched' || currentStatus === 'delivered' || currentStatus === 'cancelled') {
        window.showAdminToast('⚠️ Order is already out for delivery or completed. Cannot switch order type.', 'warning');
        return;
    }

    if (ord.orderType === targetType) return; // Already current type

    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';
    const isNowTakeaway = (targetType === 'takeaway');
    const subtotal = Number(ord.subtotal || ord.finalTotal || 0);
    const discount = Number(ord.discount || 0);
    
    let newDelCharge = 0;
    if (!isNowTakeaway) {
        // Restore default delivery fee or previous value
        newDelCharge = Number(window.cachedStoreSettings && window.cachedStoreSettings[0]?.defaultDeliveryFee) || 30;
    }
    const newFinalTotal = Math.max(0, subtotal - discount + newDelCharge);
    const newAddress = isNowTakeaway ? 'Takeaway / Self-Pickup' : (ord.deliveryAddress && ord.deliveryAddress !== 'Takeaway / Self-Pickup' ? ord.deliveryAddress : 'Barbil');

    // Update in memory first
    ord.orderType = targetType;
    ord.deliveryCharge = newDelCharge;
    ord.finalTotal = newFinalTotal;
    ord.total = newFinalTotal;
    ord.deliveryAddress = newAddress;
    ord.customerAddress = newAddress;

    try {
        const res = await fetch(`${API_URL}/orders/${ord._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            },
            body: JSON.stringify({
                orderType: targetType,
                deliveryCharge: newDelCharge,
                finalTotal: newFinalTotal,
                customerAddress: newAddress
            })
        });

        if (res.ok) {
            window.showAdminToast(isNowTakeaway ? '🛍️ Switched to Takeaway! Delivery fee removed.' : '🛵 Switched to Delivery! Delivery fee added.', 'success');
            // Re-render modal to instantly reflect changes
            window.openOrderQuickModal(ord._id);
            // Re-render orders table
            const currentSearch = document.getElementById('global-search-input')?.value?.trim() || window.currentSearchQuery || '';
            if (typeof renderOrdersTable === 'function') renderOrdersTable(currentSearch);
        } else {
            window.showAdminToast('Failed to switch order type. Check Admin PIN.', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error updating order type', 'error');
    }
};

window.confirmQuickOrder = async function(orderId) {
    const orders = window.cachedOrders || [];
    const order = orders.find(o => String(o._id) === String(orderId)) || orders.find(o => String(o.id) === String(orderId));
    if (!order || !order._id) return;

    const isTakeaway = (order.orderType === 'takeaway');
    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';
    const delCharge = isTakeaway ? 0 : (Number(document.getElementById('quick-del-charge-input')?.value) || 0);
    const subtotal = Number(order.subtotal || order.finalTotal || 0);
    const discount = Number(order.discount || 0);
    const finalTotal = Math.max(0, subtotal - discount + delCharge);
    const estTime = document.getElementById('quick-est-time-input')?.value || (isTakeaway ? '15-20 mins' : '25-35 mins');

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
            closeModal('order-quick-modal');
            window.fetchAndRenderOrders();

            // Open WhatsApp Confirmation note to customer
            const targetPhone = order.whatsappPhone || order.customerPhone || '';
            const rawPhone = String(targetPhone).replace(/\D/g, '').slice(-10);
            const shortId = String(order._id).slice(-6).toUpperCase();
            const itemsList = (order.items || []).map(it => `• ${it.quantity}x ${it.name} (₹${it.subtotal || (it.price * it.quantity)})`).join('\n') || '• Order Items';

            const baseUrl = typeof window.getFrontendBaseUrl === 'function' ? window.getFrontendBaseUrl() : ((window.cachedStoreSettings && window.cachedStoreSettings[0]?.canonicalUrl) ? window.cachedStoreSettings[0].canonicalUrl.replace(/\/+$/, '') : 'https://littiwale.co.in');
            const trackingLink = `${baseUrl}/track.html?id=${order._id}`;

            const orderTypeHeader = isTakeaway ? '*🛍️ TAKEAWAY ORDER CONFIRMED — LITTIWALE BARBIL*' : '*✅ ORDER CONFIRMED — LITTIWALE BARBIL*';
            const locationInfo = isTakeaway 
                ? `*📍 Pickup Location:* Littiwale Cloud Kitchen, Ward No. 7, Punjabi Para, Barbil\n*⏱️ Ready for Pickup in:* ${estTime}` 
                : `*📍 Delivery Address:* ${order.deliveryAddress || 'Barbil'}\n*⏱️ Estimated Delivery:* ${estTime}`;

            const paymentNote = (order.paymentMethod === 'UPI' || order.paymentCollectedByStore) ? 'Prepaid Online ✅' : 'Cash on Delivery (COD)';

            const msg = `${orderTypeHeader}\n\n` +
                        `Hi *${order.customerName || 'Customer'}*,\n` +
                        `Thank you! Your order *#${shortId}* has been accepted and is now cooking fresh in our kitchen! 👨‍🍳🔥\n\n` +
                        `${locationInfo}\n\n` +
                        `*📋 Order Items:*\n${itemsList}\n\n` +
                        `*💰 Bill Breakdown:*\n` +
                        `• Food Items Subtotal: ₹${subtotal}\n` +
                        (discount > 0 ? `• Discount: -₹${discount}\n` : '') +
                        (isTakeaway ? `• Delivery Charge: ₹0 (Self Pickup)\n` : `• Delivery Charge: ₹${delCharge}\n`) +
                        `*👉 Grand Total: ₹${finalTotal} (${paymentNote})*\n\n` +
                        `*🔴 Live Order Tracking & Bill:* ${trackingLink}\n\n` +
                        (isTakeaway ? `We look forward to serving you at our counter. See you shortly! ❤️\n*— Team Littiwale Barbil*` : `We will notify you the moment your food is out for delivery! ❤️\n*— Team Littiwale Barbil*`);

            if (rawPhone) {
                const waUrl = `https://wa.me/91${rawPhone}?text=${encodeURIComponent(msg)}`;
                window.open(waUrl, '_blank');
            }
        } else {
            window.showAdminToast('Failed to confirm order. Please check PIN.', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error confirming order', 'error');
    }
};

// Start Continuous Background Polling every 3 seconds for zero-refresh live updates
if (!window.adminOrdersLivePollInterval) {
    window.adminOrdersLivePollInterval = setInterval(() => {
        window.fetchAndRenderOrders();
        if (typeof loadStoreSettings === 'function') loadStoreSettings();
    }, 3000);
}

// Initial fetch on script execution
window.fetchAndRenderOrders();

window.ordersCurrentPage = 1;
window.ordersPerPage = 10;
window.ordersStatusFilter = 'all';
window.ordersSearchQuery = '';

window.handleOrdersSearch = function(q) {
    window.ordersSearchQuery = (q || '').trim();
    window.ordersCurrentPage = 1;
    renderOrdersTable();
};

window.setOrdersStatusFilter = function(status, btnEl) {
    window.ordersStatusFilter = status || 'all';
    window.ordersCurrentPage = 1;
    document.querySelectorAll('.order-filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    renderOrdersTable();
};

window.setOrdersPage = function(page) {
    window.ordersCurrentPage = page;
    renderOrdersTable();
    const sec = document.getElementById('orders-section');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function renderOrdersTable(filterQuery = '') {
    const tbody = document.getElementById('live-orders-tbody');
    const mobileCardsContainer = document.getElementById('mobile-orders-cards-container');
    const paginationInfo = document.getElementById('orders-pagination-info');
    const paginationControls = document.getElementById('orders-pagination-controls');

    if (!tbody && !mobileCardsContainer) return;

    let orders = window.cachedOrders || [];

    // 1. Status Filter across all orders
    const curStatus = (window.ordersStatusFilter || 'all').toLowerCase();
    if (curStatus !== 'all') {
        orders = orders.filter(ord => {
            const s = (ord.status || 'pending').toLowerCase();
            if (curStatus === 'pending') return s === 'pending';
            if (curStatus === 'accepted') return s === 'accepted' || s === 'confirmed' || s === 'cooking' || s === 'preparing';
            if (curStatus === 'dispatched') return s === 'dispatched';
            if (curStatus === 'delivered') return s === 'delivered';
            if (curStatus === 'cancelled') return s === 'cancelled';
            return s === curStatus;
        });
    }

    // 2. Universal Search Across ALL Orders (Not Just Page-wise)
    const activeInput = document.getElementById('orders-table-search-input') || document.getElementById('global-search-input');
    const rawQ = (filterQuery !== '' ? filterQuery : (window.ordersSearchQuery || (activeInput ? activeInput.value : ''))).trim();

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

    const totalMatching = orders.length;
    const pageSize = window.ordersPerPage || 10;
    const totalPages = Math.ceil(totalMatching / pageSize) || 1;

    if (window.ordersCurrentPage > totalPages) window.ordersCurrentPage = totalPages;
    if (window.ordersCurrentPage < 1) window.ordersCurrentPage = 1;

    const startIdx = (window.ordersCurrentPage - 1) * pageSize;
    const paginatedOrders = orders.slice(startIdx, startIdx + pageSize);

    // Empty State
    if (totalMatching === 0) {
        const emptyHtml = `
            <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                <div style="font-size:36px; margin-bottom:10px;">${rawQ ? '🔍' : '🛍️'}</div>
                <div style="font-size:15px; font-weight:700; color:#fff; margin-bottom:4px;">${rawQ ? `No Orders Matching "${rawQ}"` : 'No Orders Found'}</div>
                <div style="font-size:12px; color:var(--text-dim); max-width:380px; margin:0 auto;">
                    ${rawQ ? 'Try searching with a different order ID, customer name, or phone number.' : 'Orders placed from the website or WhatsApp will appear here.'}
                </div>
            </div>
        `;
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="padding:0;">${emptyHtml}</td></tr>`;
        }
        if (mobileCardsContainer) {
            mobileCardsContainer.innerHTML = emptyHtml;
        }
        if (paginationInfo) paginationInfo.textContent = 'Showing 0 orders';
        if (paginationControls) paginationControls.innerHTML = '';
        return;
    }

    // A. Render Desktop Table (10 Orders on Current Page)
    if (tbody) {
        tbody.innerHTML = paginatedOrders.map(ord => {
            const orderId = ord._id ? String(ord._id).slice(-6).toUpperCase() : 'LW-ORD';
            const itemsStr = (ord.items || []).map(it => `${it.quantity}x ${it.name}`).join(', ') || 'Custom items';
            const total = ord.finalTotal || ord.subtotal || 0;
            const delCharge = Number(ord.deliveryCharge || 0);
            const status = (ord.status || 'pending').toLowerCase();
            const statusBadge = status === 'delivered' ? 'badge-open' : (status === 'cancelled' ? 'badge-closed' : (status === 'accepted' || status === 'confirmed' ? 'badge-active' : (status === 'dispatched' ? 'badge-info' : 'badge-new')));
            const formattedDate = ord.createdAt ? new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const isTakeaway = (ord.orderType === 'takeaway');

            return `
                <tr onclick="window.openOrderQuickModal('${ord._id}')" style="cursor:pointer;" title="Tap to view full order details & actions">
                    <td style="font-family:monospace; font-weight:900; color:var(--brand-orange);" onclick="event.stopPropagation(); window.openOrderQuickModal('${ord._id}')">
                        #${orderId}
                    </td>
                    <td onclick="event.stopPropagation(); window.openOrderQuickModal('${ord._id}')">
                        <div style="font-weight:700; color:#fff;">${ord.customerName || 'Customer'}</div>
                        <div style="font-size:11px; color:var(--text-dim);">${formattedDate} • <span style="text-transform:capitalize; color:var(--brand-gold);">${ord.orderType || 'delivery'}</span></div>
                    </td>
                    <td onclick="event.stopPropagation();"><a href="tel:${ord.customerPhone}" style="color:var(--text-muted); text-decoration:none; font-weight:600;">${ord.customerPhone || 'N/A'}</a></td>
                    <td style="max-width:220px; font-size:12.5px;" title="${itemsStr}">${itemsStr}</td>
                    <td>
                        <div style="font-weight:900; color:var(--brand-gold);">₹${total}</div>
                        <div style="font-size:10.5px; color:var(--text-dim);">${isTakeaway ? 'Takeaway' : 'Del: ₹' + delCharge}</div>
                    </td>
                    <td><span class="badge ${statusBadge}">${status.toUpperCase()}</span></td>
                    <td onclick="event.stopPropagation();">
                        <div style="display:flex; gap:6px; align-items:center;">
                            <button type="button" class="btn btn-sm btn-primary" style="padding:6px 12px; font-size:11.5px; font-weight:800; background:var(--brand-orange); color:#000;" onclick="window.openOrderQuickModal('${ord._id}')" title="Open Order Details">
                                <span>👁️ Manage</span>
                            </button>
                            <button type="button" class="btn btn-sm btn-secondary" style="padding:6px 8px; font-size:11px;" onclick="window.openA4InvoiceModal('${ord._id}')" title="View & Print Official Bill (A4 PDF)">
                                📄
                            </button>
                            <button type="button" class="btn btn-sm btn-secondary" style="padding:6px 8px; font-size:11px; background:rgba(37,211,102,0.12); border-color:rgba(37,211,102,0.3); color:#4ade80;" onclick="window.openWhatsAppQuickModal('${ord._id}')" title="WhatsApp Customer">
                                💬
                            </button>
                            <button type="button" class="btn btn-sm btn-outline" style="padding:6px 8px; font-size:11px; border-color:rgba(239,68,68,0.35); color:#f87171;" onclick="window.confirmDeleteOrder('${ord._id}', '#${orderId}')" title="Delete Order">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // B. Render Mobile Cards (Card System, 10 on Current Page)
    if (mobileCardsContainer) {
        mobileCardsContainer.innerHTML = paginatedOrders.map(ord => {
            const orderId = ord._id ? String(ord._id).slice(-6).toUpperCase() : 'LW-ORD';
            const itemsStr = (ord.items || []).map(it => `${it.quantity}x ${it.name}`).join(', ') || 'Custom items';
            const total = ord.finalTotal || ord.subtotal || 0;
            const delCharge = Number(ord.deliveryCharge || 0);
            const status = (ord.status || 'pending').toLowerCase();
            const statusBadge = status === 'delivered' ? 'badge-open' : (status === 'cancelled' ? 'badge-closed' : (status === 'accepted' || status === 'confirmed' ? 'badge-active' : (status === 'dispatched' ? 'badge-info' : 'badge-new')));
            const formattedDate = ord.createdAt ? new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const targetPhone = ord.whatsappPhone || ord.customerPhone || '';
            const rawPhone = targetPhone.replace(/\D/g, '').slice(-10);
            const isTakeaway = (ord.orderType === 'takeaway');

            return `
                <div class="mobile-order-card" onclick="window.openOrderQuickModal('${ord._id}')">
                    <!-- Top Row: Order ID + Time + Status Pill -->
                    <div class="mobile-order-card-header">
                        <div>
                            <span class="mobile-order-id">#${orderId}</span>
                            <span style="font-size:11px; color:var(--text-dim); margin-left:6px;">${formattedDate}</span>
                        </div>
                        <span class="badge ${statusBadge}">${status.toUpperCase()}</span>
                    </div>

                    <!-- Middle Meta: Customer Info & Call / WA shortcuts -->
                    <div class="mobile-order-card-meta">
                        <div>
                            <div class="mobile-order-cust-name">${ord.customerName || 'Customer'}</div>
                            <div class="mobile-order-cust-type">
                                <span style="color:var(--brand-gold); font-weight:700;">${isTakeaway ? '🛍️ Takeaway' : '🛵 Home Delivery'}</span>
                                ${rawPhone ? `• +91 ${rawPhone}` : ''}
                            </div>
                        </div>
                        <div class="mobile-order-phone-actions" onclick="event.stopPropagation();">
                            ${rawPhone ? `
                                <a href="tel:${rawPhone}" class="mobile-phone-btn call" title="Call Customer">📞</a>
                                <a href="javascript:void(0)" onclick="window.openWhatsAppQuickModal('${ord._id}')" class="mobile-phone-btn wa" title="WhatsApp Customer">💬</a>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Items Summary Box -->
                    <div class="mobile-order-items-box">
                        <div style="font-weight:700; color:#fff; margin-bottom:2px;">🛒 Items:</div>
                        <div>${itemsStr}</div>
                    </div>

                    <!-- Footer: Total Amount + Actions -->
                    <div class="mobile-order-card-footer" onclick="event.stopPropagation();">
                        <div class="mobile-order-total-block">
                            <span class="mobile-order-total-amount">₹${total}</span>
                            <span class="mobile-order-total-type">${isTakeaway ? 'Takeaway' : 'Delivery: ₹' + delCharge}</span>
                        </div>
                        <div class="mobile-order-actions-group">
                            <button type="button" class="btn btn-sm btn-primary" style="padding:7px 14px; font-size:12px; font-weight:800; background:var(--brand-orange); color:#000;" onclick="window.openOrderQuickModal('${ord._id}')">
                                👁️ Manage
                            </button>
                            <button type="button" class="btn btn-sm btn-secondary" style="padding:7px 9px; font-size:12px;" onclick="window.openA4InvoiceModal('${ord._id}')" title="Print Bill">
                                📄
                            </button>
                            <button type="button" class="btn btn-sm btn-outline" style="padding:7px 9px; font-size:12px; border-color:rgba(239,68,68,0.35); color:#f87171;" onclick="window.confirmDeleteOrder('${ord._id}', '#${orderId}')" title="Delete">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // C. Render Pagination Bar
    if (paginationInfo) {
        const endIdx = Math.min(startIdx + pageSize, totalMatching);
        paginationInfo.textContent = `Showing ${startIdx + 1}–${endIdx} of ${totalMatching} orders (Page ${window.ordersCurrentPage} of ${totalPages})`;
    }

    if (paginationControls) {
        let controlsHtml = '';
        if (totalPages > 1) {
            controlsHtml += `
                <button type="button" class="page-nav-btn" onclick="window.setOrdersPage(${window.ordersCurrentPage - 1})" ${window.ordersCurrentPage === 1 ? 'disabled' : ''}>
                    ◀ Prev
                </button>
            `;

            // Max 5 page numbers around current
            let startP = Math.max(1, window.ordersCurrentPage - 2);
            let endP = Math.min(totalPages, startP + 4);
            if (endP - startP < 4) startP = Math.max(1, endP - 4);

            for (let p = startP; p <= endP; p++) {
                controlsHtml += `
                    <button type="button" class="page-number-pill ${p === window.ordersCurrentPage ? 'active' : ''}" onclick="window.setOrdersPage(${p})">
                        ${p}
                    </button>
                `;
            }

            controlsHtml += `
                <button type="button" class="page-nav-btn" onclick="window.setOrdersPage(${window.ordersCurrentPage + 1})" ${window.ordersCurrentPage >= totalPages ? 'disabled' : ''}>
                    Next ▶
                </button>
            `;
        }
        paginationControls.innerHTML = controlsHtml;
    }
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

window.currentRevenueTimeframe = 'daily';
window.customRevenueFromDate = null;
window.customRevenueToDate = null;

window.setRevenueTimeframe = function(timeframe) {
    window.currentRevenueTimeframe = timeframe;

    // Update active tab buttons styling
    const tabs = ['daily', 'weekly', 'monthly', 'yearly', 'all', 'custom'];
    tabs.forEach(t => {
        const btn = document.getElementById(`rev-tab-${t}`);
        if (btn) {
            if (t === timeframe) {
                btn.style.background = 'var(--brand-orange)';
                btn.style.color = '#fff';
                btn.style.fontWeight = '800';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = '#cbd5e1';
                btn.style.fontWeight = '700';
            }
        }
    });

    const customDateWrap = document.getElementById('rev-custom-date-container');
    if (customDateWrap) {
        customDateWrap.style.display = (timeframe === 'custom') ? 'flex' : 'none';
    }

    if (timeframe !== 'custom') {
        renderWebsiteRevenue();
    }
};

window.applyCustomRevenueFilter = function() {
    const fromInput = document.getElementById('rev-custom-from-date');
    const toInput = document.getElementById('rev-custom-to-date');
    const fromVal = fromInput ? fromInput.value : '';
    const toVal = toInput ? toInput.value : '';

    if (!fromVal || !toVal) {
        window.showAdminToast('Please select both From and To dates', 'warning');
        return;
    }

    window.customRevenueFromDate = new Date(fromVal);
    window.customRevenueFromDate.setHours(0, 0, 0, 0);

    window.customRevenueToDate = new Date(toVal);
    window.customRevenueToDate.setHours(23, 59, 59, 999);

    if (window.customRevenueFromDate > window.customRevenueToDate) {
        window.showAdminToast('From Date cannot be after To Date', 'error');
        return;
    }

    const badge = document.getElementById('rev-custom-range-badge');
    if (badge) {
        badge.textContent = `(${new Date(fromVal).toLocaleDateString([], { month: 'short', day: 'numeric' })} — ${new Date(toVal).toLocaleDateString([], { month: 'short', day: 'numeric' })})`;
    }

    renderWebsiteRevenue();
};

window.loadFinanceData = function() {
    renderWebsiteRevenue();
};

function renderWebsiteRevenue() {
    const allOrders = window.cachedOrders || [];
    const now = new Date();
    const timeframe = window.currentRevenueTimeframe || 'daily';

    let activePeriodLabel = 'Today';
    let filteredOrders = allOrders;

    if (timeframe === 'daily') {
        const todayStr = now.toDateString();
        filteredOrders = allOrders.filter(o => o.createdAt && new Date(o.createdAt).toDateString() === todayStr);
        activePeriodLabel = `Today (${now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })})`;
    } else if (timeframe === 'weekly') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredOrders = allOrders.filter(o => o.createdAt && new Date(o.createdAt) >= sevenDaysAgo);
        activePeriodLabel = `Last 7 Days (${sevenDaysAgo.toLocaleDateString([], { month: 'short', day: 'numeric' })} — ${now.toLocaleDateString([], { month: 'short', day: 'numeric' })})`;
    } else if (timeframe === 'monthly') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredOrders = allOrders.filter(o => o.createdAt && new Date(o.createdAt) >= thirtyDaysAgo);
        activePeriodLabel = `This Month (${now.toLocaleDateString([], { month: 'long', year: 'numeric' })})`;
    } else if (timeframe === 'yearly') {
        const currentYear = now.getFullYear();
        filteredOrders = allOrders.filter(o => o.createdAt && new Date(o.createdAt).getFullYear() === currentYear);
        activePeriodLabel = `Year ${currentYear} (All Months)`;
    } else if (timeframe === 'all') {
        filteredOrders = allOrders;
        activePeriodLabel = `All Time (Lifetime Orders)`;
    } else if (timeframe === 'custom' && window.customRevenueFromDate && window.customRevenueToDate) {
        filteredOrders = allOrders.filter(o => {
            if (!o.createdAt) return false;
            const oDate = new Date(o.createdAt);
            return oDate >= window.customRevenueFromDate && oDate <= window.customRevenueToDate;
        });
        activePeriodLabel = `Custom: ${window.customRevenueFromDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} — ${window.customRevenueToDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    }

    // Only count DELIVERED orders towards revenue & completed orders count
    const deliveredOrders = filteredOrders.filter(o => o.status === 'delivered');
    const totalDeliveredOrders = deliveredOrders.length;
    
    let totalFoodRevenue = 0; // Pure Food Item Net Revenue (excl. delivery fee)
    let totalDeliveryFee = 0; // Total Delivery Charges (Paid to Rider)
    let totalGrandSales = 0;  // Grand total collected

    deliveredOrders.forEach(o => {
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

    const foodAov = totalDeliveredOrders > 0 ? Math.round(totalFoodRevenue / totalDeliveredOrders) : 0;

    // Update Period Labels
    const periodLabelEl = document.getElementById('rev-active-period-label');
    if (periodLabelEl) periodLabelEl.textContent = activePeriodLabel;

    const countLabelEl = document.getElementById('rev-filtered-count-label');
    if (countLabelEl) countLabelEl.textContent = `${totalDeliveredOrders} Delivered Orders (${filteredOrders.length} Total)`;

    // Update KPI Cards
    const elWebRev = document.getElementById('fin-website-revenue');
    if (elWebRev) elWebRev.textContent = `₹${totalFoodRevenue.toLocaleString('en-IN')}`;

    const elWebOrd = document.getElementById('fin-website-orders');
    if (elWebOrd) elWebOrd.textContent = `${totalDeliveredOrders}`;

    const elWebAov = document.getElementById('fin-website-aov');
    if (elWebAov) elWebAov.textContent = `₹${foodAov}`;

    const elWebGross = document.getElementById('fin-website-gross');
    if (elWebGross) elWebGross.textContent = `₹${totalGrandSales.toLocaleString('en-IN')}`;

    const elWebDelFee = document.getElementById('fin-website-del-fee');
    if (elWebDelFee) elWebDelFee.textContent = `Rider Fees: ₹${totalDeliveryFee.toLocaleString('en-IN')}`;

    // Overall Dashboard Total KPI update (shows Today's or Lifetime)
    const elDashRev = document.getElementById('kpi-revenue');
    if (elDashRev) {
        // Compute today's revenue for top dashboard card
        const todayDelivered = allOrders.filter(o => o.status === 'delivered' && o.createdAt && new Date(o.createdAt).toDateString() === now.toDateString());
        let todayFood = 0;
        todayDelivered.forEach(o => {
            const net = Math.max(0, Number(o.subtotal || 0) - Number(o.discount || 0)) || (o.finalTotal ? Math.max(0, Number(o.finalTotal) - Number(o.deliveryCharge || 0)) : 0);
            todayFood += net;
        });
        elDashRev.textContent = `₹${todayFood.toLocaleString('en-IN')}`;
    }

    const elDashOrd = document.getElementById('kpi-orders-count');
    if (elDashOrd) elDashOrd.textContent = `${allOrders.filter(o => o.status === 'delivered').length} total delivered`;

    // Render Detailed Finance Register Table for Filtered Orders
    const finTbody = document.getElementById('finance-tbody');
    if (finTbody) {
        if (filteredOrders.length === 0) {
            finTbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted);">
                        <div style="font-size:32px; margin-bottom:8px;">🛒</div>
                        <div style="font-size:14px; font-weight:700; color:#fff; margin-bottom:4px;">No Orders in ${activePeriodLabel}</div>
                        <div style="font-size:12px; color:var(--text-dim);">No customer orders were placed in this selected timeframe. Try choosing another timeframe tab.</div>
                    </td>
                </tr>
            `;
        } else {
            finTbody.innerHTML = filteredOrders.map(ord => {
                const orderId = ord._id ? String(ord._id).slice(-6).toUpperCase() : 'LW-ORD';
                const dateStr = ord.createdAt ? new Date(ord.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Today';
                const itemsStr = (ord.items || []).map(it => `${it.quantity}x ${it.name}`).join(', ') || 'Custom items';
                const itemSubtotal = Number(ord.subtotal || 0);
                const discount = Number(ord.discount || 0);
                const netFood = Math.max(0, itemSubtotal - discount) || (ord.finalTotal ? Math.max(0, Number(ord.finalTotal) - Number(ord.deliveryCharge || 0)) : 0);
                const delFee = Number(ord.deliveryCharge || 0);
                const grandTotal = Number(ord.finalTotal || (netFood + delFee));
                const status = (ord.status || 'pending').toLowerCase();
                const statusBadge = status === 'delivered' ? 'badge-open' : (status === 'cancelled' ? 'badge-closed' : (status === 'accepted' || status === 'confirmed' ? 'badge-active' : (status === 'dispatched' ? 'badge-info' : 'badge-new')));

                return `
                    <tr onclick="window.openOrderQuickModal('${ord._id}')" style="cursor:pointer;" title="Click to view order details">
                        <td style="font-family:monospace; font-weight:800; color:var(--brand-orange);">#${orderId}</td>
                        <td style="font-size:11.5px; color:var(--text-dim);">${dateStr}</td>
                        <td>
                            <div style="font-weight:700; color:#fff;">${ord.customerName || 'Customer'}</div>
                            <div style="font-size:11px; color:var(--text-muted);">${ord.customerPhone || 'N/A'} • <span style="color:var(--brand-gold); text-transform:capitalize;">${ord.orderType || 'delivery'}</span></div>
                        </td>
                        <td style="max-width:200px; font-size:12px;" title="${itemsStr}">${itemsStr}</td>
                        <td style="font-weight:800; color:var(--brand-gold);">₹${netFood}</td>
                        <td style="color:var(--brand-orange); font-weight:600;">₹${delFee}</td>
                        <td style="font-weight:900; color:#fff;">₹${grandTotal}</td>
                        <td><span class="badge ${statusBadge}">${status.toUpperCase()}</span></td>
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

    // Persist current active section across page refreshes
    try {
        sessionStorage.setItem('lw_admin_active_section', targetId);
        const cleanHash = targetId.replace('-section', '');
        history.replaceState(null, null, '#' + cleanHash);
    } catch(e) {}

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

    // Scroll to top of page and main content view
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const mainContentEl = document.querySelector('.main-content') || document.querySelector('.dashboard-main') || document.getElementById('dashboard-screen');
    if (mainContentEl) mainContentEl.scrollTop = 0;

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
    try {
        sessionStorage.setItem('lw_admin_active_cms_tab', subTabId);
        history.replaceState(null, null, '#media-' + subTabId);
    } catch(e) {}

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
        window.ordersSearchQuery = query;
        window.ordersCurrentPage = 1;
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

window.getFrontendBaseUrl = function() {
    return (window.frontendUrl || (window.cachedStoreSettings && window.cachedStoreSettings[0]?.canonicalUrl) || 'https://littiwale.co.in').replace(/\/+$/, '');
};

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
    // 1. Instant 0ms render from cache immediately
    if (typeof renderDynamicDashboard === 'function') {
        renderDynamicDashboard();
    }

    // 2. Parallel Fast Async Fetching across all endpoints
    await Promise.allSettled([
        loadAppConfig(),
        loadCategories(),
        loadMenu(),
        loadAnnouncements(),
        loadCoupons(),
        loadStoreSettings(),
        (typeof window.fetchAndRenderOrders === 'function') ? window.fetchAndRenderOrders() : Promise.resolve(),
        (typeof window.loadFinanceData === 'function') ? window.loadFinanceData() : Promise.resolve(),
        (typeof loadHeroCmsSettings === 'function') ? loadHeroCmsSettings() : Promise.resolve(),
        (typeof fetchReels === 'function') ? fetchReels() : Promise.resolve()
    ]);

    // 3. Final fresh render
    if (typeof renderDynamicDashboard === 'function') {
        renderDynamicDashboard();
    }
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
    if (elMenuKpi) elMenuKpi.textContent = (totalMenu === 0 && !window.isMenuFetchDone) ? 'Syncing...' : totalMenu;

    const elSideCount = document.getElementById('sidebar-menu-count');
    if (elSideCount) elSideCount.textContent = (totalMenu === 0 && !window.isMenuFetchDone) ? '...' : totalMenu;

    const elCatKpi = document.getElementById('kpi-categories-count');
    if (elCatKpi) elCatKpi.textContent = totalCat;

    const elCatSub = document.getElementById('kpi-categories-sub');
    if (elCatSub) elCatSub.textContent = `${totalCat} Active Sections`;

    const elBannersKpi = document.getElementById('kpi-banners-count');
    if (elBannersKpi) elBannersKpi.textContent = totalBanners;

    const elCouponsKpi = document.getElementById('kpi-coupons-count');
    if (elCouponsKpi) elCouponsKpi.textContent = totalCoupons;

    // Live Revenue calculation (connected to orders database - DELIVERED orders only)
    const orders = window.cachedOrders || [];
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    let totalFoodRevenue = 0;
    deliveredOrders.forEach(o => {
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
    if (elOrdersCount) elOrdersCount.textContent = `${deliveredOrders.length} delivered orders`;

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

    // 4. Most Ordered Bestselling Dishes (Calculated from Real Orders DB)
    const popularContainer = document.getElementById('dashboard-popular-items');
    if (popularContainer) {
        // Aggregate quantities sold per dish from cached orders
        const itemSalesMap = {};
        (window.cachedOrders || []).forEach(ord => {
            (ord.items || []).forEach(it => {
                const name = (it.name || '').trim();
                if (!name) return;
                const qty = Number(it.quantity || 1);
                const price = Number(it.price || (it.subtotal ? it.subtotal / qty : 0));
                if (!itemSalesMap[name]) {
                    itemSalesMap[name] = {
                        name: name,
                        qtySold: 0,
                        totalRevenue: 0,
                        price: price,
                        category: '',
                        image: '',
                        dietaryPreference: 'veg'
                    };
                }
                itemSalesMap[name].qtySold += qty;
                itemSalesMap[name].totalRevenue += (Number(it.subtotal) || (price * qty));
            });
        });

        // Enrich with catalog metadata
        menus.forEach(m => {
            const mName = (m.name || '').trim();
            if (itemSalesMap[mName]) {
                itemSalesMap[mName].image = m.image || '';
                itemSalesMap[mName].category = m.category || '';
                itemSalesMap[mName].dietaryPreference = m.dietaryPreference || 'veg';
                itemSalesMap[mName]._id = m._id;
                if (!itemSalesMap[mName].price) itemSalesMap[mName].price = m.price;
            }
        });

        const sortedSales = Object.values(itemSalesMap).sort((a, b) => b.qtySold - a.qtySold || b.totalRevenue - a.totalRevenue);

        let displayItems = [];
        let isRealSales = false;

        if (sortedSales.length > 0) {
            displayItems = sortedSales.slice(0, 5);
            isRealSales = true;
        } else if (menus.length > 0) {
            displayItems = menus.slice(0, 5).map(m => ({
                name: m.name,
                qtySold: 0,
                price: m.price,
                category: m.category || 'Specialty',
                image: m.image,
                dietaryPreference: m.dietaryPreference || 'veg',
                _id: m._id
            }));
        }

        if (displayItems.length === 0) {
            popularContainer.innerHTML = `<div style="color:var(--text-dim); padding:20px; text-align:center;">No dishes available in database.</div>`;
        } else {
            popularContainer.innerHTML = displayItems.map((item, idx) => {
                const rankClass = idx === 0 ? 'top-1' : (idx === 1 ? 'top-2' : (idx === 2 ? 'top-3' : ''));
                const salesBadge = isRealSales 
                    ? `<span class="badge" style="background:rgba(240,78,35,0.14); color:var(--brand-orange); font-size:10px; font-weight:800; border:1px solid rgba(240,78,35,0.3);">🔥 ${item.qtySold} Sold</span>`
                    : `<span class="badge" style="background:rgba(255,255,255,0.06); color:var(--text-muted); font-size:10px;">Catalog</span>`;

                return `
                    <div class="popular-item-row" onclick="${item._id ? `editMenu('${item._id}')` : ''}" style="cursor:pointer;" title="View & edit dish details">
                        <div class="popular-item-left">
                            <span class="rank-badge ${rankClass}">${idx + 1}</span>
                            <img src="${item.image || 'images/logo.png'}" alt="${item.name}" class="popular-item-img" onerror="this.src='images/logo.png'">
                            <div>
                                <span class="popular-item-name" style="display:flex; align-items:center; gap:6px;">
                                    <span>${item.dietaryPreference === 'non-veg' ? '🔴' : '🟢'}</span>
                                    <strong style="color:#fff;">${item.name}</strong>
                                    ${salesBadge}
                                </span>
                                <span style="font-size:11px; color:var(--text-dim);">${item.category || 'Food'}</span>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div class="popular-item-orders" style="color:var(--brand-gold); font-weight:900;">₹${item.price}</div>
                            ${isRealSales ? `<div style="font-size:10.5px; color:#22c55e; font-weight:700;">₹${item.totalRevenue} Total</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // 5. Top Loyal Customers Widget (Aggregated from Orders DB by Phone)
    const topCustTbody = document.getElementById('dashboard-top-customers-tbody');
    if (topCustTbody) {
        const customerMap = {};
        (window.cachedOrders || []).forEach(ord => {
            const rawPhone = (ord.customerPhone || ord.whatsappPhone || '').replace(/\D/g, '').slice(-10);
            if (!rawPhone) return;
            if (!customerMap[rawPhone]) {
                customerMap[rawPhone] = {
                    phone: rawPhone,
                    displayPhone: ord.customerPhone || ord.whatsappPhone || rawPhone,
                    name: ord.customerName || 'Customer',
                    orderCount: 0,
                    totalSpend: 0,
                    lastItems: '',
                    latestOrderId: ord._id || ''
                };
            }
            customerMap[rawPhone].orderCount += 1;
            const orderTotal = Number(ord.finalTotal || ord.total || ord.subtotal || 0);
            customerMap[rawPhone].totalSpend += orderTotal;
            if (ord.customerName && (!customerMap[rawPhone].name || customerMap[rawPhone].name === 'Customer')) {
                customerMap[rawPhone].name = ord.customerName;
            }
            if (ord.items && ord.items.length > 0 && !customerMap[rawPhone].lastItems) {
                customerMap[rawPhone].lastItems = ord.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
            }
        });

        const sortedCustomers = Object.values(customerMap)
            .sort((a, b) => b.orderCount - a.orderCount || b.totalSpend - a.totalSpend);

        const topCustCards = document.getElementById('dashboard-top-customers-cards');

        if (sortedCustomers.length === 0) {
            topCustTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-dim); padding:24px;">No customer order history yet</td></tr>`;
            if (topCustCards) topCustCards.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:16px;">No customer order history yet</div>`;
        } else {
            const topList = sortedCustomers.slice(0, 7);
            
            // Desktop Table
            topCustTbody.innerHTML = topList.map((c, idx) => {
                const rankBadge = idx === 0 ? '🥇 1' : (idx === 1 ? '🥈 2' : (idx === 2 ? '🥉 3' : `#${idx + 1}`));
                const rankColor = idx === 0 ? 'var(--brand-gold)' : (idx === 1 ? '#e2e8f0' : (idx === 2 ? '#f59e0b' : 'var(--text-dim)'));
                return `
                    <tr>
                        <td style="font-weight:900; color:${rankColor}; font-size:12px;">${rankBadge}</td>
                        <td>
                            <div style="font-weight:800; color:#fff; font-size:13px;">${c.name}</div>
                            <div style="font-size:11px; color:var(--text-dim); font-family:monospace;">+91 ${c.displayPhone}</div>
                            ${c.lastItems ? `<div style="font-size:11px; color:var(--brand-gold); max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;" title="Recent Items: ${c.lastItems}">🛍️ ${c.lastItems}</div>` : ''}
                        </td>
                        <td>
                            <span class="badge" style="background:rgba(240,78,35,0.12); color:var(--brand-orange); border:1px solid rgba(240,78,35,0.25); font-weight:800;">
                                🔥 ${c.orderCount} ${c.orderCount === 1 ? 'Order' : 'Orders'}
                            </span>
                        </td>
                        <td style="color:var(--brand-gold); font-weight:800; font-size:13px;">
                            ₹${c.totalSpend.toLocaleString('en-IN')}
                        </td>
                        <td>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <a href="tel:${c.phone}" class="btn btn-sm btn-secondary" style="padding:4px 8px; font-size:11px; text-decoration:none;" title="Call Customer">
                                    📞
                                </a>
                                <a href="https://wa.me/91${c.phone}" target="_blank" class="btn btn-sm btn-secondary" style="padding:4px 8px; font-size:11px; background:rgba(37,211,102,0.12); border-color:rgba(37,211,102,0.3); color:#4ade80; text-decoration:none;" title="WhatsApp Customer">
                                    💬
                                </a>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Mobile Cards (Clean & Compact)
            if (topCustCards) {
                topCustCards.innerHTML = topList.map((c, idx) => {
                    const rankBadge = idx === 0 ? '🥇 1' : (idx === 1 ? '🥈 2' : (idx === 2 ? '🥉 3' : `#${idx + 1}`));
                    return `
                        <div class="mobile-loyal-customer-card">
                            <div class="mobile-loyal-cust-header">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="font-weight:900; font-size:13px;">${rankBadge}</span>
                                    <div>
                                        <div style="font-weight:700; color:#fff; font-size:13.5px;">${c.name}</div>
                                        <div style="font-size:11px; color:var(--text-dim);">+91 ${c.displayPhone}</div>
                                    </div>
                                </div>
                                <span class="badge" style="background:rgba(240,78,35,0.12); color:var(--brand-orange); border:1px solid rgba(240,78,35,0.25); font-weight:800; font-size:10.5px;">
                                    🔥 ${c.orderCount} ${c.orderCount === 1 ? 'Order' : 'Orders'}
                                </span>
                            </div>
                            ${c.lastItems ? `<div style="font-size:11.5px; color:var(--brand-gold); background:rgba(0,0,0,0.25); padding:5px 8px; border-radius:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🛍️ ${c.lastItems}</div>` : ''}
                            <div class="mobile-loyal-cust-actions">
                                <span style="color:var(--brand-gold); font-weight:800; font-size:13px;">Total Spend: ₹${c.totalSpend.toLocaleString('en-IN')}</span>
                                <div style="display:flex; gap:6px;">
                                    <a href="tel:${c.phone}" class="mobile-phone-btn call" style="width:28px; height:28px; font-size:11px;">📞</a>
                                    <a href="https://wa.me/91${c.phone}" target="_blank" class="mobile-phone-btn wa" style="width:28px; height:28px; font-size:11px;">💬</a>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
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

    // 8. Recent Live Website Orders Table (Real orders from DB)
    const recentOrdersTbody = document.getElementById('dashboard-recent-orders-tbody');
    const recentOrdersCards = document.getElementById('dashboard-recent-orders-cards');

    if (recentOrdersTbody || recentOrdersCards) {
        const orders = window.cachedOrders || [];
        if (orders.length === 0) {
            if (recentOrdersTbody) recentOrdersTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:24px;">No live website orders received yet</td></tr>`;
            if (recentOrdersCards) recentOrdersCards.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:16px;">No live website orders received yet</div>`;
        } else {
            const recent = orders.slice(0, 5);

            // Desktop Table
            if (recentOrdersTbody) {
                recentOrdersTbody.innerHTML = recent.map(ord => {
                    const shortId = ord._id ? String(ord._id).slice(-6).toUpperCase() : 'LW-ORD';
                    const itemsStr = (ord.items || []).map(it => `${it.quantity}x ${it.name}`).join(', ') || 'Items';
                    const total = ord.finalTotal || ord.subtotal || 0;
                    const status = (ord.status || 'pending').toLowerCase();
                    const statusBadge = status === 'delivered' ? 'badge-open' : (status === 'cancelled' ? 'badge-closed' : (status === 'accepted' || status === 'confirmed' ? 'badge-active' : (status === 'dispatched' ? 'badge-info' : 'badge-new')));

                    return `
                        <tr onclick="window.openOrderQuickModal('${ord._id}')" style="cursor:pointer;" title="Click to view & manage order">
                            <td style="font-family:monospace; font-weight:900; color:var(--brand-orange);">#${shortId}</td>
                            <td>
                                <div style="font-weight:700; color:#fff;">${ord.customerName || 'Customer'}</div>
                                <div style="font-size:11px; color:var(--text-dim);">${ord.customerPhone || ''}</div>
                            </td>
                            <td style="max-width:180px; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${itemsStr}">${itemsStr}</td>
                            <td style="font-weight:900; color:var(--brand-gold);">₹${total}</td>
                            <td><span class="badge ${statusBadge}">${status.toUpperCase()}</span></td>
                            <td onclick="event.stopPropagation();">
                                <button type="button" class="btn btn-sm btn-primary" style="padding:4px 10px; font-size:11px; font-weight:700; background:var(--brand-orange); color:#000;" onclick="window.openOrderQuickModal('${ord._id}')">
                                    👁️ Manage
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            // Mobile Cards (Zero horizontal scroll)
            if (recentOrdersCards) {
                recentOrdersCards.innerHTML = recent.map(ord => {
                    const shortId = ord._id ? String(ord._id).slice(-6).toUpperCase() : 'LW-ORD';
                    const itemsStr = (ord.items || []).map(it => `${it.quantity}x ${it.name}`).join(', ') || 'Items';
                    const total = ord.finalTotal || ord.subtotal || 0;
                    const status = (ord.status || 'pending').toLowerCase();
                    const statusBadge = status === 'delivered' ? 'badge-open' : (status === 'cancelled' ? 'badge-closed' : (status === 'accepted' || status === 'confirmed' ? 'badge-active' : (status === 'dispatched' ? 'badge-info' : 'badge-new')));

                    return `
                        <div class="mobile-dashboard-order-card" onclick="window.openOrderQuickModal('${ord._id}')">
                            <div class="mobile-dashboard-order-header">
                                <span style="font-family:var(--font-mono); font-weight:800; color:var(--brand-orange); font-size:13.5px;">#${shortId}</span>
                                <span class="badge ${statusBadge}" style="font-size:10px;">${status.toUpperCase()}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="font-weight:700; color:#fff; font-size:13.5px;">${ord.customerName || 'Customer'}</div>
                                <span style="font-weight:800; color:var(--brand-gold); font-size:14px;">₹${total}</span>
                            </div>
                            <div style="font-size:12px; color:var(--text-dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🛒 ${itemsStr}</div>
                            <div class="mobile-dashboard-order-footer" onclick="event.stopPropagation();">
                                <span style="font-size:11px; color:var(--text-muted);">${ord.customerPhone || ''}</span>
                                <button type="button" class="btn btn-sm btn-primary" style="padding:4px 10px; font-size:11px; font-weight:700; background:var(--brand-orange); color:#000;" onclick="window.openOrderQuickModal('${ord._id}')">
                                    👁️ Manage
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
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

async function fetchAndRenderMenu() {
    const t0 = Date.now();
    try {
        const menus = await apiCall('/menu');
        window.cachedMenuItems = menus || [];
        window.isMenuFetchDone = true;
        try {
            localStorage.setItem('lw_admin_menu_cache', JSON.stringify(menus || []));
        } catch(e) {}
        
        console.log(`%c⚡ [LITTIWALE ADMIN] Menu loaded in ${Date.now() - t0}ms (${(menus || []).length} items)`, 'color:#10b981; font-weight:bold;');
        
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
            const items = (grouped[category] || []).sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
            const section = document.createElement('div');
            
            const catObj = (window.cachedCategories || []).find(c => c.name === category);
            const orderStr = (catObj && catObj.displayOrder !== undefined && catObj.displayOrder !== null) ? `<span style="font-size:12px; font-weight:800; color:#9ca3af; background:#12141b; padding:4px 8px; border-radius:6px; border:1px solid #252830;">#${catObj.displayOrder}</span>` : '';

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
        try {
            localStorage.setItem('lw_admin_cat_cache', JSON.stringify(items || []));
        } catch(e) {}
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

        const isActive = item.isAvailable !== false && item.isActive !== false;
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
                <button onclick="window.toggleAnnouncement('${item._id || item.id}', ${isActive})" style="padding:8px 16px; background:${isActive ? 'rgba(255,255,255,0.05)' : 'rgba(34,197,94,0.15)'}; border:1px solid ${isActive ? '#2e3140' : '#22c55e'}; color:${isActive ? '#e5e7eb' : '#4ade80'}; border-radius:8px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; cursor:pointer; transition:all 0.15s;">${isActive ? 'HIDE' : 'SHOW'}</button>
                <button onclick="window.deleteAnnouncement('${item._id || item.id}')" style="padding:8px 16px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#ef4444; border-radius:8px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; cursor:pointer; transition:all 0.15s;">DELETE</button>
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
        window.showAdminToast('Please provide a title or image for the announcement', 'error');
        return;
    }

    const payload = {
        title,
        link,
        image: currentAnnouncementImage,
        expiry: expiry || null,
        isAvailable: true,
        isActive: true
    };

    try {
        await apiCall('/announcements', 'POST', payload);
        window.showAdminToast('Announcement published successfully!', 'success');
        
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
        window.showAdminToast('Failed to save announcement', 'error');
    }
});

window.toggleAnnouncement = async function(id, currentStatus) {
    try {
        const newStatus = !currentStatus;
        await apiCall(`/announcements/${id}`, 'PUT', { isAvailable: newStatus, isActive: newStatus });
        await loadAnnouncements();
        window.showAdminToast(`Announcement ${newStatus ? 'is now LIVE' : 'is now HIDDEN'}`, newStatus ? 'success' : 'info');
    } catch (err) {
        console.error(err);
        window.showAdminToast('Failed to update announcement status', 'error');
    }
};

window.deleteAnnouncement = async function(id) {
    if (await showConfirm('Delete Announcement', 'Are you sure you want to permanently delete this announcement?')) {
        await apiCall(`/announcements/${id}`, 'DELETE');
        await loadAnnouncements();
        window.showAdminToast('Announcement deleted', 'success');
    }
};

// =======================
// COUPONS LOGIC (Percentage & Flat Multi-type System)
// =======================
window.switchCouponType = function(type) {
    const isPercentage = (type === 'percentage');
    const labelPct = document.getElementById('label-type-percentage');
    const labelFlat = document.getElementById('label-type-flat');
    const valLabel = document.getElementById('coupon-value-label');
    const maxWrap = document.getElementById('coupon-max-discount-wrap');
    const valInput = document.getElementById('coupon-value');

    if (labelPct && labelFlat) {
        if (isPercentage) {
            labelPct.style.borderColor = 'var(--brand-orange)';
            labelFlat.style.borderColor = 'rgba(255,255,255,0.1)';
        } else {
            labelFlat.style.borderColor = 'var(--brand-orange)';
            labelPct.style.borderColor = 'rgba(255,255,255,0.1)';
        }
    }

    if (valLabel) valLabel.textContent = isPercentage ? 'Discount (% Off) *' : 'Flat Discount Amount (₹) *';
    if (valInput) valInput.placeholder = isPercentage ? 'e.g. 30' : 'e.g. 50';
    if (maxWrap) maxWrap.style.display = isPercentage ? 'block' : 'none';

    window.updateCouponDescriptionPreview();
};

window.updateCouponDescriptionPreview = function() {
    const radios = document.getElementsByName('couponTypeRadio');
    let type = 'percentage';
    radios.forEach(r => { if (r.checked) type = r.value; });

    const val = Number(document.getElementById('coupon-value')?.value || 0);
    const minOrd = Number(document.getElementById('coupon-min-order')?.value || 0);
    const descInput = document.getElementById('coupon-description');

    if (descInput && !descInput.dataset.manuallyEdited) {
        if (type === 'percentage') {
            descInput.value = val > 0 ? `Get upto ${val}% OFF on orders above ₹${minOrd}` : '';
        } else {
            descInput.value = val > 0 ? `Flat ₹${val} OFF on orders above ₹${minOrd}` : '';
        }
    }
};

window.openNewCouponModal = function() {
    const form = document.getElementById('coupon-form');
    if (form) form.reset();
    document.getElementById('coupon-id').value = '';
    document.getElementById('coupon-modal-title').textContent = 'Create Promo Coupon';
    
    const descInput = document.getElementById('coupon-description');
    if (descInput) delete descInput.dataset.manuallyEdited;

    const rPct = document.querySelector('input[name="couponTypeRadio"][value="percentage"]');
    if (rPct) rPct.checked = true;
    window.switchCouponType('percentage');

    openModal('coupon-modal');
};

window.editCoupon = function(id) {
    const items = window.cachedCoupons || [];
    const item = items.find(i => String(i._id) === String(id) || String(i.id) === String(id));
    if (!item) return;

    document.getElementById('coupon-modal-title').textContent = 'Edit Promo Coupon';
    document.getElementById('coupon-id').value = item._id || item.id;
    document.getElementById('coupon-code').value = item.code || '';
    
    const isPct = (item.discountType || 'percentage').toLowerCase() === 'percentage';
    const rType = document.querySelector(`input[name="couponTypeRadio"][value="${isPct ? 'percentage' : 'flat'}"]`);
    if (rType) rType.checked = true;
    window.switchCouponType(isPct ? 'percentage' : 'flat');

    document.getElementById('coupon-value').value = item.discount || item.discountValue || 0;
    document.getElementById('coupon-min-order').value = item.minOrder || item.minOrderValue || 0;
    document.getElementById('coupon-max-discount').value = item.maxDiscount || item.maxDiscountAmount || 0;
    
    const descInput = document.getElementById('coupon-description');
    if (descInput) {
        descInput.value = item.description || '';
        descInput.dataset.manuallyEdited = 'true';
    }

    const chkActive = document.getElementById('coupon-active');
    if (chkActive) chkActive.checked = (item.isActive !== false && item.isAvailable !== false);

    openModal('coupon-modal');
};

window.handleSaveCoupon = async function(e) {
    if (e) e.preventDefault();

    const id = document.getElementById('coupon-id').value;
    const radios = document.getElementsByName('couponTypeRadio');
    let discountType = 'percentage';
    radios.forEach(r => { if (r.checked) discountType = r.value; });

    const code = (document.getElementById('coupon-code').value || '').trim().toUpperCase();
    const discount = Number(document.getElementById('coupon-value').value || 0);
    const minOrder = Number(document.getElementById('coupon-min-order').value || 0);
    const maxDiscount = discountType === 'percentage' ? Number(document.getElementById('coupon-max-discount').value || 0) : 0;
    const description = (document.getElementById('coupon-description').value || '').trim() || (discountType === 'percentage' ? `Get upto ${discount}% OFF on orders above ₹${minOrder}` : `Flat ₹${discount} OFF on orders above ₹${minOrder}`);
    const isActive = document.getElementById('coupon-active').checked;

    if (!code) {
        window.showAdminToast('Please enter a coupon code', 'error');
        return;
    }
    if (discount <= 0) {
        window.showAdminToast('Please enter a valid discount amount', 'error');
        return;
    }

    const payload = {
        code,
        discountType,
        discount,
        minOrder,
        maxDiscount,
        description,
        isActive
    };

    try {
        if (id) {
            await apiCall(`/coupons/${id}`, 'PUT', payload);
            window.showAdminToast(`Coupon "${code}" updated successfully!`, 'success');
        } else {
            await apiCall('/coupons', 'POST', payload);
            window.showAdminToast(`Coupon "${code}" created successfully!`, 'success');
        }
        
        closeModal('coupon-modal');
        await loadCoupons();
    } catch(err) {
        console.error(err);
        window.showAdminToast('Failed to save coupon', 'error');
    }
};

window.renderCoupons = function(filterQuery = '') {
    const tbody = document.getElementById('coupons-tbody');
    if (!tbody) return;
    let items = window.cachedCoupons || [];
    const q = (filterQuery || '').toLowerCase().trim();
    if (q) {
        items = items.filter(c => (c.code && c.code.toLowerCase().includes(q)) || (c.description && c.description.toLowerCase().includes(q)));
    }
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No coupons found${q ? ` matching "${q}"` : ''}.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const isPct = (item.discountType || 'percentage').toLowerCase() === 'percentage';
        const isActive = (item.isActive !== false && item.isAvailable !== false);
        const discVal = Number(item.discount || item.discountValue || 0);
        const minOrd = Number(item.minOrder || item.minOrderValue || 0);
        const maxCap = Number(item.maxDiscount || item.maxDiscountAmount || 0);

        const typeBadge = isPct 
            ? `<span class="badge" style="background:rgba(240,78,35,0.12); color:var(--brand-orange); border:1px solid rgba(240,78,35,0.3); font-weight:800;">% ${discVal}% OFF${maxCap > 0 ? ` (Max ₹${maxCap})` : ''}</span>`
            : `<span class="badge" style="background:rgba(34,197,94,0.12); color:#4ade80; border:1px solid rgba(34,197,94,0.3); font-weight:800;">₹ Flat ₹${discVal} OFF</span>`;

        const desc = item.description || (isPct ? `Get upto ${discVal}% OFF on orders above ₹${minOrd}` : `Flat ₹${discVal} OFF on orders above ₹${minOrd}`);

        return `
            <tr>
                <td style="font-family:monospace; font-weight:900; color:var(--brand-gold); font-size:14px; letter-spacing:0.5px;">
                    ${item.code}
                </td>
                <td>${typeBadge}</td>
                <td style="font-weight:700; color:#fff;">₹${minOrd}</td>
                <td style="font-size:12.5px; color:#cbd5e1; max-width:250px;">${desc}</td>
                <td>
                    <span class="badge ${isActive ? 'badge-active' : 'badge-closed'}">
                        ${isActive ? 'Live' : 'Hidden'}
                    </span>
                </td>
                <td>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button type="button" class="btn btn-sm btn-secondary" style="padding:5px 10px; font-size:11.5px;" onclick="window.editCoupon('${item._id || item.id}')" title="Edit Coupon">
                            ✏️ Edit
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary" style="padding:5px 10px; font-size:11px; background:${isActive ? 'rgba(255,255,255,0.05)' : 'rgba(34,197,94,0.12)'}; color:${isActive ? '#e2e8f0' : '#4ade80'};" onclick="window.toggleCoupon('${item._id || item.id}', ${isActive})">
                            ${isActive ? 'Hide' : 'Show'}
                        </button>
                        <button type="button" class="btn btn-sm btn-danger" style="padding:5px 8px; font-size:11px;" onclick="window.deleteCoupon('${item._id || item.id}')" title="Delete Coupon">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

async function loadCoupons() {
    try {
        const items = await apiCall('/coupons');
        window.cachedCoupons = items || [];
        if (typeof renderDynamicDashboard === 'function') renderDynamicDashboard();
        window.renderCoupons(document.getElementById('global-search-input')?.value || '');
    } catch (e) { console.error(e); }
}

window.toggleCoupon = async function(id, currentStatus) {
    try {
        const newStatus = !currentStatus;
        await apiCall(`/coupons/${id}`, 'PUT', { isActive: newStatus, isAvailable: newStatus });
        await loadCoupons();
        window.showAdminToast(`Coupon ${newStatus ? 'is now LIVE' : 'is now HIDDEN'}`, newStatus ? 'success' : 'info');
    } catch (err) {
        console.error(err);
        window.showAdminToast('Failed to update coupon status', 'error');
    }
};

window.deleteCoupon = async function(id) {
    if (await showConfirm('Delete Coupon', 'Are you sure you want to delete this coupon?')) {
        await apiCall(`/coupons/${id}`, 'DELETE');
        await loadCoupons();
        window.showAdminToast('Coupon deleted', 'success');
    }
};

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
        if (!Array.isArray(settings)) return;
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

        // Populate Maintenance Mode UI Controls
        const maintenanceToggle = document.getElementById('global-maintenance-toggle');
        const maintenanceInput = document.getElementById('maintenance-message-input');
        const maintenanceBadge = document.getElementById('maintenance-status-badge');
        
        const isMaintenance = settings.some(s => s.isMaintenanceMode === true);
        const maintMsg = (settings.find(s => s.maintenanceMessage) || {}).maintenanceMessage || '';

        if (maintenanceToggle) maintenanceToggle.checked = isMaintenance;
        if (maintenanceInput && maintMsg) maintenanceInput.value = maintMsg;
        if (maintenanceBadge) {
            if (isMaintenance) {
                maintenanceBadge.style.background = 'rgba(239, 68, 68, 0.15)';
                maintenanceBadge.style.color = '#f87171';
                maintenanceBadge.style.border = '1px solid rgba(239, 68, 68, 0.4)';
                maintenanceBadge.innerHTML = '🚨 UNDER MAINTENANCE (Customers Blocked)';
            } else {
                maintenanceBadge.style.background = 'rgba(34, 197, 94, 0.15)';
                maintenanceBadge.style.color = '#4ade80';
                maintenanceBadge.style.border = '1px solid rgba(34, 197, 94, 0.3)';
                maintenanceBadge.innerHTML = '🟢 LIVE (Website Active)';
            }
        }

        // Auto-reopen if offlineUntil timer has expired
        autoReopenIfTimePassed();

        if (typeof window.loadDeliveryBoys === 'function') window.loadDeliveryBoys();
    } catch (e) { console.error(e); }
}

window.toggleMaintenanceMode = async function(isMaintenance) {
    try {
        const msg = document.getElementById('maintenance-message-input')?.value || 'We are currently upgrading our website to serve you better! In the meantime, our kitchen is open — please place your order directly via Call, WhatsApp, or Zomato below.';
        await apiCall('/settings/cloud', 'PUT', { isMaintenanceMode: isMaintenance, maintenanceMessage: msg });
        
        const badge = document.getElementById('maintenance-status-badge');
        if (badge) {
            if (isMaintenance) {
                badge.style.background = 'rgba(239, 68, 68, 0.15)';
                badge.style.color = '#f87171';
                badge.style.border = '1px solid rgba(239, 68, 68, 0.4)';
                badge.innerHTML = '🚨 UNDER MAINTENANCE (Customers Blocked)';
                window.showAdminToast('🛠️ Website is now in Maintenance Mode!', 'warning');
            } else {
                badge.style.background = 'rgba(34, 197, 94, 0.15)';
                badge.style.color = '#4ade80';
                badge.style.border = '1px solid rgba(34, 197, 94, 0.3)';
                badge.innerHTML = '🟢 LIVE (Website Active)';
                window.showAdminToast('✅ Website is now LIVE for all customers!', 'success');
            }
        }
        loadStoreSettings();
    } catch(e) {
        window.showAdminToast('Error updating maintenance mode', 'error');
    }
};

window.saveMaintenanceMessage = async function() {
    const isMaintenance = document.getElementById('global-maintenance-toggle')?.checked || false;
    const msg = document.getElementById('maintenance-message-input')?.value || '';
    try {
        await apiCall('/settings/cloud', 'PUT', { isMaintenanceMode: isMaintenance, maintenanceMessage: msg });
        window.showAdminToast('Maintenance notice saved!', 'success');
    } catch(e) {
        window.showAdminToast('Error saving maintenance notice', 'error');
    }
};

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
function populateDealItemDropdowns(selectedName1, selectedName2) {
    const sel1 = document.getElementById('deal-item-1') || document.getElementById('deal-item1-select');
    const sel2 = document.getElementById('deal-item-2') || document.getElementById('deal-item2-select');
    if (!sel1 || !sel2) return;

    // Filter out existing craziest deals from item choices
    const items = (window.regularMenuItems || []).filter(item => {
        const cat = (item.category || '').toLowerCase();
        const n = (item.name || '').toLowerCase();
        return !cat.includes('craziest') && !item.isCraziestDeal;
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
            const price = Number(item.price || item.full || item.half || 0);
            optionsHtml += `<option value="${item._id || item.id}" data-name="${item.name.replace(/"/g, '&quot;')}" data-price="${price}">${item.name} — ₹${price}</option>`;
        });
        optionsHtml += `</optgroup>`;
    }

    sel1.innerHTML = optionsHtml;
    sel2.innerHTML = optionsHtml;

    // Smart auto-select matching dishes from note with Exact & Best Longest Substring Match
    function matchOption(selectEl, query) {
        if (!query || !query.trim()) return;
        const q = query.toLowerCase().replace(/[\(\)]/g, ' ').replace(/\s+/g, ' ').trim();
        
        let bestIndex = -1;
        let bestScore = 0;

        for (let i = 1; i < selectEl.options.length; i++) {
            const opt = selectEl.options[i];
            const rawOptName = (opt.getAttribute('data-name') || '').toLowerCase();
            const optName = rawOptName.replace(/[\(\)]/g, ' ').replace(/\s+/g, ' ').trim();
            if (!optName) continue;

            // 1. Exact match (highest priority)
            if (optName === q) {
                selectEl.selectedIndex = i;
                return;
            }

            // 2. Score by common words and length (prefer longer match: "veg fried rice" over "rice")
            let score = 0;
            if (q.includes(optName)) {
                score = optName.length * 10;
            } else if (optName.includes(q)) {
                score = q.length * 8;
            } else {
                const qWords = q.split(' ').filter(w => w.length > 2);
                const optWords = optName.split(' ').filter(w => w.length > 2);
                const common = qWords.filter(w => optWords.includes(w));
                if (common.length > 0) {
                    score = common.length * 5;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        if (bestIndex > 0) {
            selectEl.selectedIndex = bestIndex;
        }
    }

    matchOption(sel1, selectedName1);
    matchOption(sel2, selectedName2);
}

window.updateDealPricePreviewBadge = function() {
    const origInput = document.getElementById('deal-orig-price');
    const priceInput = document.getElementById('deal-price');
    const origVal = Number(origInput?.value || 0);
    const priceVal = Number(priceInput?.value || 0);

    const sel1 = document.getElementById('deal-item-1') || document.getElementById('deal-item1-select');
    const sel2 = document.getElementById('deal-item-2') || document.getElementById('deal-item2-select');
    const opt1 = sel1 ? sel1.options[sel1.selectedIndex] : null;
    const opt2 = sel2 ? sel2.options[sel2.selectedIndex] : null;
    const price1 = Number(opt1 ? (opt1.getAttribute('data-price') || 0) : 0);
    const price2 = Number(opt2 ? (opt2.getAttribute('data-price') || 0) : 0);
    const baseFoodCost = price1 + price2;

    const baseEl = document.getElementById('deal-base-locked-price');
    if (baseEl) baseEl.textContent = `₹${baseFoodCost}`;

    const prevPriceEl = document.getElementById('preview-deal-price');
    const prevOrigEl = document.getElementById('preview-orig-price');
    const prevTagEl = document.getElementById('preview-discount-tag');
    const marginEl = document.getElementById('preview-margin-val');

    if (prevPriceEl) prevPriceEl.textContent = `₹${priceVal}`;
    if (prevOrigEl) {
        if (origVal > 0 && origVal > priceVal) {
            prevOrigEl.textContent = `₹${origVal}`;
            prevOrigEl.style.display = 'inline';
        } else {
            prevOrigEl.textContent = '';
            prevOrigEl.style.display = 'none';
        }
    }
    if (prevTagEl) {
        if (origVal > priceVal && origVal > 0) {
            const pct = Math.round(((origVal - priceVal) / origVal) * 100);
            prevTagEl.textContent = `${pct}% OFF`;
            prevTagEl.style.display = 'inline-block';
        } else {
            prevTagEl.style.display = 'none';
        }
    }
    if (marginEl) {
        const margin = priceVal - baseFoodCost;
        if (baseFoodCost > 0) {
            marginEl.textContent = `${margin >= 0 ? '+' : ''}₹${margin}`;
            marginEl.style.color = margin >= 0 ? '#38bdf8' : '#f87171';
        } else {
            marginEl.textContent = `₹0`;
            marginEl.style.color = '#94a3b8';
        }
    }
};

window.recalculateDealPrices = function(updateInputs = true) {
    const sel1 = document.getElementById('deal-item-1') || document.getElementById('deal-item1-select');
    const sel2 = document.getElementById('deal-item-2') || document.getElementById('deal-item2-select');
    if (!sel1 || !sel2) return;

    const opt1 = sel1.options[sel1.selectedIndex];
    const opt2 = sel2.options[sel2.selectedIndex];

    const price1 = Number(opt1 ? (opt1.getAttribute('data-price') || 0) : 0);
    const price2 = Number(opt2 ? (opt2.getAttribute('data-price') || 0) : 0);
    const name1 = opt1 ? (opt1.getAttribute('data-name') || '') : '';
    const name2 = opt2 ? (opt2.getAttribute('data-name') || '') : '';

    const baseFoodCost = price1 + price2;

    const baseEl = document.getElementById('deal-base-locked-price');
    if (baseEl) baseEl.textContent = `₹${baseFoodCost}`;

    // Suggested Profit Pricing
    const suggestedMRP = baseFoodCost > 0 ? Math.round((baseFoodCost * 1.30) / 10) * 10 : 0;
    const suggestedDealPrice = baseFoodCost > 0 ? Math.round((baseFoodCost * 1.10) / 10) * 10 : 0;

    const breakdownEl = document.getElementById('deal-calc-breakdown');
    const origPriceInput = document.getElementById('deal-orig-price');
    const priceInput = document.getElementById('deal-price');
    
    if (baseFoodCost > 0 && updateInputs) {
        if (origPriceInput && !origPriceInput.value) origPriceInput.value = suggestedMRP;
        if (priceInput && !priceInput.value) priceInput.value = suggestedDealPrice;
    }

    if (breakdownEl) {
        if (price1 > 0 && price2 > 0) {
            breakdownEl.innerHTML = `
                <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); line-height:1.5;">
                    <div>🍽️ <strong>Items:</strong> ${name1} (<span style="color:#fb923c;">₹${price1}</span>) + ${name2} (<span style="color:#fb923c;">₹${price2}</span>) = Base Value: <strong style="color:#fbbf24;">₹${baseFoodCost}</strong> (Locked)</div>
                    <div style="font-size:10.5px; color:#94a3b8; margin-top:2px;">
                        💡 Set custom <strong>Strikethrough MRP</strong> (e.g. ₹400) and <strong>Deal Price</strong> (e.g. ₹320) above.
                    </div>
                </div>
            `;
        } else if (price1 > 0) {
            breakdownEl.innerHTML = `<span style="color:#fb923c;">Dish 1:</span> ${name1} (₹${price1})`;
        } else if (price2 > 0) {
            breakdownEl.innerHTML = `<span style="color:#fb923c;">Dish 2:</span> ${name2} (₹${price2})`;
        } else {
            breakdownEl.innerHTML = '';
        }
    }

    if (updateInputs && (name1 || name2)) {
        const noteInput = document.getElementById('deal-note') || document.getElementById('deal-note-input');
        if (noteInput) {
            if (name1 && name2) {
                noteInput.value = `Includes: ${name1} + ${name2}`;
            } else if (name1) {
                noteInput.value = `Includes: ${name1}`;
            } else if (name2) {
                noteInput.value = `Includes: ${name2}`;
            }
        }
    }

    window.updateDealPricePreviewBadge();
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
                    <div style="font-weight:bold; color:#4ade80; font-size:1.3rem; margin-bottom:14px; display:flex; align-items:center; gap:8px;">
                        <span>₹${deal.price}</span>
                        ${deal.originalPrice ? `<span style="color:#64748b; text-decoration:line-through; font-size:0.95rem;">₹${deal.originalPrice}</span>` : ''}
                        ${deal.originalPrice && deal.originalPrice > deal.price ? `<span style="background:rgba(34,197,94,0.15); color:#4ade80; font-size:11px; padding:2px 6px; border-radius:4px;">${Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100)}% OFF</span>` : ''}
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

    const titleEl = document.getElementById('deal-modal-title');
    if (titleEl) titleEl.textContent = '➕ Add Custom Craziest Deal';

    const idEl = document.getElementById('deal-id');
    if (idEl) idEl.value = '';

    const nameEl = document.getElementById('deal-name') || document.getElementById('deal-title-input');
    if (nameEl) nameEl.value = 'Custom Craziest Deal 🔥';

    const noteEl = document.getElementById('deal-note') || document.getElementById('deal-note-input');
    if (noteEl) noteEl.value = '';

    const priceEl = document.getElementById('deal-price');
    if (priceEl) priceEl.value = '';

    const origPriceEl = document.getElementById('deal-orig-price');
    if (origPriceEl) origPriceEl.value = '';

    const imgUrlEl = document.getElementById('deal-image-url') || document.getElementById('deal-image-input');
    if (imgUrlEl) imgUrlEl.value = '';

    const imgFileEl = document.getElementById('deal-image-file');
    if (imgFileEl) imgFileEl.value = '';

    populateDealItemDropdowns('', '');

    const preview = document.getElementById('deal-image-preview');
    if (preview) {
        preview.src = 'images/logo.png';
        preview.style.display = 'block';
    }

    window.updateDealPricePreviewBadge();

    modal.classList.add('active');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

window.openDealModal = async function(dealId) {
    let deal = adminDealsList.find(d => String(d._id) === String(dealId));
    if (!deal) return;

    const modal = document.getElementById('deal-modal');
    if (!modal) return;

    // Ensure menu items are loaded
    if (!window.regularMenuItems || window.regularMenuItems.length === 0) {
        try {
            const res = await fetch(`${API_URL}/menu`);
            window.regularMenuItems = await res.json();
        } catch(e) {}
    }

    const titleEl = document.getElementById('deal-modal-title');
    if (titleEl) titleEl.textContent = `🔥 Configure: ${deal.name}`;

    const idEl = document.getElementById('deal-id');
    if (idEl) idEl.value = deal._id;

    const nameEl = document.getElementById('deal-name') || document.getElementById('deal-title-input');
    if (nameEl) nameEl.value = deal.name;

    const noteEl = document.getElementById('deal-note') || document.getElementById('deal-note-input');
    if (noteEl) noteEl.value = deal.note || deal.description || '';

    const priceEl = document.getElementById('deal-price');
    if (priceEl) priceEl.value = deal.price;

    const origPriceEl = document.getElementById('deal-orig-price');
    if (origPriceEl) {
        origPriceEl.value = deal.originalPrice || '';
    }

    const imgUrlEl = document.getElementById('deal-image-url') || document.getElementById('deal-image-input');
    if (imgUrlEl) imgUrlEl.value = deal.image || '';

    const preview = document.getElementById('deal-image-preview');
    if (preview) {
        preview.src = deal.image || 'images/logo.png';
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
    window.recalculateDealPrices(false);

    if (deal.originalPrice) {
        const origPriceEl = document.getElementById('deal-orig-price');
        if (origPriceEl) origPriceEl.value = deal.originalPrice;
    }
    if (deal.price) {
        const priceEl = document.getElementById('deal-price');
        if (priceEl) priceEl.value = deal.price;
    }
    window.updateDealPricePreviewBadge();

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
        const urlEl = document.getElementById('deal-image-url') || document.getElementById('deal-image-input');
        if (urlEl) urlEl.value = webpData;
        const preview = document.getElementById('deal-image-preview');
        if (preview) {
            preview.src = webpData;
            preview.style.display = 'block';
        }
    } catch(e) {
        console.error('Error compressing image to WebP:', e);
    }
};

window.isAutoShuffleDealsActive = true;

window.toggleAutoShuffleDeals = async function() {
    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';
    window.isAutoShuffleDealsActive = !window.isAutoShuffleDealsActive;
    updateAutoShuffleButtonUI();

    try {
        const res = await fetch(`${API_URL}/settings/cloud`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            },
            body: JSON.stringify({ autoShuffleDeals: window.isAutoShuffleDealsActive })
        });
        if (res.ok) {
            window.showAdminToast(
                window.isAutoShuffleDealsActive ? 'Auto-Shuffle Activated (ON) 🔄' : 'Auto-Shuffle Paused (OFF) ⏸️',
                'success'
            );
        } else {
            window.showAdminToast('Failed to update Auto-Shuffle setting', 'error');
        }
    } catch(e) {
        console.error('Error toggling auto shuffle:', e);
        window.showAdminToast('Error toggling Auto-Shuffle', 'error');
    }
};

function updateAutoShuffleButtonUI() {
    const btnText = document.getElementById('deal-shuffle-btn-text');
    const btn = btnText?.closest('button');
    if (!btnText) return;

    if (window.isAutoShuffleDealsActive) {
        btnText.innerHTML = '🔄 Auto-Shuffle: ON';
        if (btn) {
            btn.style.background = 'rgba(34, 197, 94, 0.15)';
            btn.style.borderColor = '#22c55e';
            btn.style.color = '#4ade80';
        }
    } else {
        btnText.innerHTML = '⏸️ Auto-Shuffle: OFF';
        if (btn) {
            btn.style.background = 'rgba(239, 68, 68, 0.15)';
            btn.style.borderColor = '#ef4444';
            btn.style.color = '#f87171';
        }
    }
}

window.saveDealCms = async function(event) {
    if (event) event.preventDefault();
    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';
    const id = document.getElementById('deal-id')?.value || '';
    const name = (document.getElementById('deal-name') || document.getElementById('deal-title-input'))?.value || '';
    const note = (document.getElementById('deal-note') || document.getElementById('deal-note-input'))?.value || '';
    const price = Number((document.getElementById('deal-price') || document.getElementById('deal-price-input'))?.value) || 0;
    const origPriceInput = document.getElementById('deal-orig-price') || document.getElementById('deal-origprice-input');
    const originalPrice = origPriceInput ? (Number(origPriceInput.value || origPriceInput.textContent?.replace(/[^\d]/g, '')) || undefined) : undefined;
    const image = (document.getElementById('deal-image-url') || document.getElementById('deal-image-input'))?.value || 'images/logo.png';

    const payload = {
        name,
        category: 'Craziest Deals of the Hour',
        isCombo: true,
        isCraziestDeal: true,
        note,
        description: note,
        price,
        originalPrice,
        image,
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
    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';
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

let currentLogoImageBase64 = '';
let currentHeroImageBase64 = '';
let currentAboutImageBase64 = '';

window.handleLogoImageChange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        currentLogoImageBase64 = await window.compressImageToWebP(file, 400, 0.9);
        const img = document.getElementById('logo-preview-img');
        if (img) img.src = currentLogoImageBase64;
    } catch(err) {
        console.error('Error compressing logo:', err);
    }
};

window.handleHeroImageChange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        currentHeroImageBase64 = await window.compressImageToWebP(file, 1000, 0.85);
        const img = document.getElementById('hero-preview-img');
        if (img) img.src = currentHeroImageBase64;
    } catch(err) {
        console.error('Error compressing hero image:', err);
    }
};

window.handleAboutImageChange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        currentAboutImageBase64 = await window.compressImageToWebP(file, 1000, 0.85);
        const img = document.getElementById('about-image-preview');
        if (img) img.innerHTML = `<img src="${currentAboutImageBase64}" style="max-height:80px; max-width:100%; object-fit:contain;">`;
    } catch(err) {
        console.error('Error compressing about image:', err);
    }
};

window.loadHeroCmsSettings = async function() {
    try {
        const res = await fetch(`${API_URL}/settings`);
        if (!res.ok) return;
        const docs = await res.json();
        const doc = (Array.isArray(docs) ? (docs.find(d => d.storeId === 'cloud') || docs[0]) : docs) || {};

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined && val !== null) el.value = val;
        };

        setVal('hero-badge', doc.heroBadgeText !== undefined ? doc.heroBadgeText : (doc.heroTagline || '#1 Food'));
        setVal('hero-title', doc.heroTitle !== undefined ? doc.heroTitle : 'Delicious Food Made with Love ♡');
        setVal('hero-desc', doc.heroDesc !== undefined ? doc.heroDesc : '');
        setVal('about-badge', doc.aboutTagline !== undefined ? doc.aboutTagline : 'About Us');
        setVal('about-heading', doc.aboutHeading !== undefined ? doc.aboutHeading : 'We Serve Happiness');
        setVal('about-p1', doc.aboutStoryText !== undefined ? doc.aboutStoryText : '');
        setVal('about-p2', doc.aboutStorySubtitle !== undefined ? doc.aboutStorySubtitle : '');
        setVal('about-experience', doc.statText !== undefined ? doc.statText : '');

        // Perks
        setVal('perk1-title', doc.perk1Title !== undefined ? doc.perk1Title : '100% Coal Roasted');
        setVal('perk1-desc', doc.perk1Text !== undefined ? doc.perk1Text : '');
        setVal('perk2-title', doc.perk2Title || 'Pure Desi Ghee');
        setVal('perk2-desc', doc.perk2Text || 'Dipped in pure aromatic desi ghee for unforgettable indulgence.');
        setVal('perk3-title', doc.perk3Title || 'Super Fast Delivery');
        setVal('perk3-desc', doc.perk3Text || 'Dispatched steaming hot straight from our Barbil kitchen.');
        setVal('perk4-title', doc.perk4Title || 'Hygiene First');
        setVal('perk4-desc', doc.perk4Text || 'Prepared with strict FSSAI certified sanitary standards.');

        // Dabba Meal Subscription
        setVal('dabba-veg-title', doc.dabbaVegTitle || 'Desi Veg Dabba');
        setVal('dabba-veg-sub', doc.dabbaVegSubtitle || 'Pure vegetarian. Best value for daily regulars.');
        setVal('dabba-veg-weekly-old', doc.dabbaVegWeeklyOldPrice || '₹1,500');
        setVal('dabba-veg-weekly-new', doc.dabbaVegWeeklyNewPrice || '₹1,200');
        setVal('dabba-veg-monthly-old', doc.dabbaVegMonthlyOldPrice || '₹6,000');
        setVal('dabba-veg-monthly-new', doc.dabbaVegMonthlyNewPrice || '₹5,500');

        setVal('dabba-nonveg-title', doc.dabbaNonvegTitle || 'Desi Feast Dabba');
        setVal('dabba-nonveg-sub', doc.dabbaNonvegSubtitle || '4 days veg + 3 days non-veg (Wed, Fri, Sun).');
        setVal('dabba-nonveg-weekly-old', doc.dabbaNonvegWeeklyOldPrice || '₹2,000');
        setVal('dabba-nonveg-weekly-new', doc.dabbaNonvegWeeklyNewPrice || '₹1,500');
        setVal('dabba-nonveg-monthly-old', doc.dabbaNonvegMonthlyOldPrice || '₹7,500');
        setVal('dabba-nonveg-monthly-new', doc.dabbaNonvegMonthlyNewPrice || '₹6,500');

        if (doc.logoImage && document.getElementById('logo-preview-img')) {
            document.getElementById('logo-preview-img').src = doc.logoImage;
        }
        if (doc.heroImage && document.getElementById('hero-preview-img')) {
            document.getElementById('hero-preview-img').src = doc.heroImage;
        }
        if (doc.aboutImage && document.getElementById('about-preview-img')) {
            document.getElementById('about-preview-img').src = doc.aboutImage;
        }
    } catch(e) {
        console.warn('Error loading hero cms settings:', e);
    }
};

window.saveHeroCms = async function(event) {
    if (event && event.preventDefault) event.preventDefault();
    const getVal = (id) => document.getElementById(id)?.value || '';

    const payload = {
        heroBadgeText: getVal('hero-badge'),
        heroTitle: getVal('hero-title'),
        heroDesc: getVal('hero-desc'),
        aboutTagline: getVal('about-badge'),
        aboutHeading: getVal('about-heading'),
        aboutStoryText: getVal('about-p1'),
        aboutStorySubtitle: getVal('about-p2'),
        statText: getVal('about-experience'),
        perk1Title: getVal('perk1-title'),
        perk1Text: getVal('perk1-desc'),
        perk2Title: getVal('perk2-title'),
        perk2Text: getVal('perk2-desc'),
        perk3Title: getVal('perk3-title'),
        perk3Text: getVal('perk3-desc'),
        perk4Title: getVal('perk4-title'),
        perk4Text: getVal('perk4-desc'),
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

    if (currentLogoImageBase64) payload.logoImage = currentLogoImageBase64;
    if (currentHeroImageBase64) payload.heroImage = currentHeroImageBase64;
    if (currentAboutImageBase64) payload.aboutImage = currentAboutImageBase64;

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
            window.showAdminToast('Website CMS Content, Dabba Plans & Images saved successfully!', 'success');
            currentLogoImageBase64 = '';
            currentHeroImageBase64 = '';
            currentAboutImageBase64 = '';
            loadHeroCmsSettings();
        } else {
            window.showAdminToast('Failed to save Hero CMS settings.', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error saving Hero CMS settings', 'error');
    }
};

// ==========================================================================
// MEDIA ASSET LIBRARY (Live Supabase Assets)
// ==========================================================================
window.allMediaAssets = [
    // Brand & General
    { name: "Brand Logo (Official)", path: "/api/assets/general/logo.png", category: "gallery", desc: "Main brand badge & header icon" },
    { name: "Hero Showcase Banner", path: "/api/assets/general/hero-banner.png", category: "banner", desc: "Customer hero graphic plate" },
    { name: "Hero Dark Background", path: "/api/assets/general/hero-bg.jpg", category: "banner", desc: "Atmospheric hero backdrop" },
    { name: "About Story Showcase", path: "/api/assets/general/about-img.webp", category: "gallery", desc: "Authentic cloud kitchen story" },
    { name: "UPI QR Payment Code", path: "/api/assets/general/upi-qr.jpeg", category: "gallery", desc: "Direct payment QR code" },
    { name: "Favicon Badge", path: "/api/assets/general/favicon.png", category: "gallery", desc: "Browser tab icon" },

    // Announcements
    { name: "Grand Outlet Opening Banner", path: "/api/assets/announcements/banners/special-offer-5.webp", category: "banner", desc: "100% Pure Veg Outlet Banner" },
    { name: "Special Offer Banner 1", path: "/api/assets/announcements/banners/special-offer-1.webp", category: "banner", desc: "Special offer promotional banner" },
    { name: "Special Offer Banner 2", path: "/api/assets/announcements/banners/special-offer-2.webp", category: "banner", desc: "Combo meals promotional banner" },

    // Social Presence Reels
    { name: "Instagram Reel Cover 1", path: "/api/assets/reels/thumbnails/reel1.png", category: "social", desc: "Customer tasting review reel" },
    { name: "Instagram Reel Cover 2", path: "/api/assets/reels/thumbnails/reel2.png", category: "social", desc: "Kitchen making of litti chokha" },
    { name: "Instagram Reel Cover 3", path: "/api/assets/reels/thumbnails/reel3.png", category: "social", desc: "Barbil foodies meetup reel" },
    { name: "Instagram Reel Cover 4", path: "/api/assets/reels/thumbnails/reel4.png", category: "social", desc: "Packaging & cloud dispatch reel" },
    { name: "Instagram Reel Cover 5", path: "/api/assets/reels/thumbnails/reel5.png", category: "social", desc: "Happy customer smiles reel" },
    { name: "Instagram Reel Cover 6", path: "/api/assets/reels/thumbnails/reel6.png", category: "social", desc: "Weekend family feast reel" },

    // Star Specials & Dishes
    { name: "Authentic Bihari Litti Chokha", path: "/api/assets/menu/star-special/authentic-bihari-litti-chokha.webp", category: "menu", desc: "Signature wood-fired litti plate" },
    { name: "A1 Swag Combo Veg", path: "/api/assets/menu/star-special/a1-swag-combo-veg.webp", category: "menu", desc: "Special veg combo plate" },
    { name: "A1 Swag Combo Non-Veg", path: "/api/assets/menu/star-special/a1-swag-combo-non-veg.webp", category: "menu", desc: "Special non-veg combo plate" },
    { name: "Desi Delight Chick-a-Litti", path: "/api/assets/menu/star-special/desi-delight-chick-a-litti.webp", category: "menu", desc: "Chicken curry with wood-fired litti" },
    { name: "Thecha Chowmein", path: "/api/assets/menu/star-special/masterchef-special-thecha-chowmein-full.webp", category: "menu", desc: "Spicy thecha tossed chowmein" },
    { name: "Mumbai Street Vada Pav", path: "/api/assets/menu/star-special/mumbai-street-vada-pav.webp", category: "menu", desc: "Authentic Mumbai style vada pav" },

    // Dining Gallery
    { name: "Dining Gallery 1", path: "/api/assets/general/gallery-1.jpg", category: "gallery", desc: "Fresh hot served dishes" },
    { name: "Dining Gallery 2", path: "/api/assets/general/gallery-2.webp", category: "gallery", desc: "Spiced condiments & chutney" },
    { name: "Dining Gallery 3", path: "/api/assets/general/gallery-3.jpg", category: "gallery", desc: "Clay oven roasting showcase" },
    { name: "Dining Gallery 4", path: "/api/assets/general/gallery-4.jpg", category: "gallery", desc: "Cloud kitchen packing station" },
    { name: "Dining Gallery 5", path: "/api/assets/general/gallery-5.webp", category: "gallery", desc: "Crispy snack delights" }
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
                <button type="button" class="btn btn-primary" style="background:linear-gradient(135deg, #3b82f6, #2563eb); color:#fff; font-weight:900; font-size:14px; padding:12px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="openDispatchModal()">
                    <span>📦 Mark Out for Delivery (Dispatch)</span>
                </button>
                <div style="display:flex; gap:10px;">
                    <button type="button" class="btn btn-secondary" style="flex:1; background:#25d366; color:#000; font-weight:800; font-size:12px; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="openWhatsAppQuickModal('${order._id}')">
                        <span>💬 WhatsApp Customer</span>
                    </button>
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
                    <button type="button" class="btn btn-secondary" style="flex:1; background:#25d366; color:#000; font-weight:800; font-size:12px; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="openWhatsAppQuickModal('${order._id}')">
                        <span>💬 WhatsApp Customer</span>
                    </button>
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
                <button type="button" class="btn btn-secondary" style="background:#25d366; color:#000; font-weight:800; font-size:12.5px; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; width:100%;" onclick="openWhatsAppQuickModal('${order._id}')">
                    <span>💬 WhatsApp Customer (Review & Notes)</span>
                </button>
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

            // Build formatted WhatsApp confirmation message in clean English
            const shortId = String(order._id).slice(-6).toUpperCase();
            const itemsList = (order.items || []).map(it => `• ${it.quantity}x ${it.name} (₹${it.subtotal || (it.price * it.quantity)})`).join('\n') || '• Order Items';
            
            const targetPhone = order.whatsappPhone || order.customerPhone || '';
            const rawPhone = String(targetPhone).replace(/\D/g, '');
            const cleanPhone = rawPhone.length > 10 ? rawPhone.slice(-10) : rawPhone;

            const orderTypeHeader = isTakeaway ? '*🛍️ TAKEAWAY ORDER CONFIRMED — LITTIWALE BARBIL*' : '*✅ ORDER CONFIRMED — LITTIWALE BARBIL*';
            const locationInfo = isTakeaway 
                ? `*📍 Pickup Counter:* Littiwale Counter, Near Barbil Court, Rabisons Mall\n*⏱️ Ready for Pickup in:* ${estTime}` 
                : `*📍 Delivery Address:* ${order.deliveryAddress || 'Barbil'}\n*⏱️ Estimated Delivery:* ${estTime}`;

            const baseUrl = typeof window.getFrontendBaseUrl === 'function' ? window.getFrontendBaseUrl() : 'https://littiwale.co.in';
            const trackingLink = `${baseUrl}/track.html?id=${order._id}`;

            const paymentNote = (order.paymentMethod === 'UPI' || order.paymentCollectedByStore) ? 'Prepaid Online ✅' : 'Cash on Delivery (COD)';

            const msg = `${orderTypeHeader}\n\n` +
                        `Hi *${order.customerName || 'Customer'}*,\n` +
                        `Thank you! Your order *#${shortId}* has been accepted and is now cooking fresh in our kitchen! 👨‍🍳🔥\n\n` +
                        `${locationInfo}\n\n` +
                        `*📋 Order Items:*\n${itemsList}\n\n` +
                        `*💰 Bill Breakdown:*\n` +
                        `• Food Items Subtotal: ₹${subtotal}\n` +
                        (discount > 0 ? `• Discount: -₹${discount}\n` : '') +
                        (isTakeaway ? `• Delivery Charge: ₹0 (Self Pickup)\n` : `• Delivery Charge: ₹${delCharge}\n`) +
                        `*👉 Grand Total: ₹${finalTotal} (${paymentNote})*\n\n` +
                        `*🔴 Live Order Tracking & Bill:* ${trackingLink}\n\n` +
                        (isTakeaway ? `We look forward to serving you at our counter. See you shortly! ❤️\n*— Team Littiwale Barbil*` : `We will notify you the moment your food is out for delivery! ❤️\n*— Team Littiwale Barbil*`);

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

// ==========================================================================
// DELIVERY BOY FLEET MANAGEMENT & ORDER DISPATCH FLOW
// ==========================================================================
window.cachedDeliveryBoys = [];
window.currentDispatchOrder = null;

window.loadDeliveryBoys = async function() {
    try {
        const res = await fetch(`${API_URL}/delivery-boys`);
        if (res.ok) {
            window.cachedDeliveryBoys = await res.json();
            window.renderDeliveryBoysList();
        }
    } catch(e) {
        console.warn('Error loading delivery boys:', e);
    }
};

window.renderDeliveryBoysList = function() {
    const container = document.getElementById('delivery-boys-list-container');
    if (!container) return;

    if (!window.cachedDeliveryBoys || window.cachedDeliveryBoys.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1; padding:20px; text-align:center; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.1); border-radius:10px; color:#94a3b8; font-size:12.5px;">
                🛵 No delivery boys added yet. Click "+ Add Delivery Boy" above to add riders to your fleet.
            </div>
        `;
        return;
    }

    container.innerHTML = window.cachedDeliveryBoys.map(boy => `
        <div style="background:var(--bg-card-inner); border:1px solid var(--border-card); border-radius:10px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:800; color:#fff; font-size:13.5px; display:flex; align-items:center; gap:6px;">
                    <span>🛵</span> <span>${boy.name}</span>
                </div>
                <div style="font-size:11.5px; color:#38bdf8; font-weight:600; margin-top:2px;">
                    📞 +91 ${boy.phone}
                </div>
            </div>
            <div style="display:flex; gap:6px;">
                <a href="https://wa.me/91${boy.phone}" target="_blank" class="btn btn-sm" style="padding:5px 8px; font-size:11px; background:#25d366; color:#000; font-weight:700; text-decoration:none; border-radius:6px;" title="Chat with Rider">
                    💬
                </a>
                <button type="button" class="btn btn-sm btn-outline" style="padding:5px 8px; font-size:11px; border-color:#ef4444; color:#ef4444; border-radius:6px;" onclick="window.deleteDeliveryBoy('${boy.id}')" title="Remove Rider">
                    ✕
                </button>
            </div>
        </div>
    `).join('');
};

window.openAddDeliveryBoyModal = function() {
    const nameInput = document.getElementById('new-rider-name');
    const phoneInput = document.getElementById('new-rider-phone');
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    openModal('add-delivery-boy-modal');
};

window.handleSaveNewDeliveryBoy = async function(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('new-rider-name')?.value?.trim();
    const phone = document.getElementById('new-rider-phone')?.value?.trim();
    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';

    if (!name || !phone) {
        window.showAdminToast('Please enter both Rider Name and Phone number', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/delivery-boys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            },
            body: JSON.stringify({ name, phone })
        });

        if (res.ok) {
            window.showAdminToast(`🛵 Rider "${name}" added to Fleet!`, 'success');
            closeModal('add-delivery-boy-modal');
            await window.loadDeliveryBoys();
            // Also refresh dispatch dropdown if open
            if (window.currentDispatchOrder) {
                window.populateDispatchRidersDropdown();
            }
        } else {
            window.showAdminToast('Failed to add delivery boy', 'error');
        }
    } catch(err) {
        window.showAdminToast('Error adding delivery boy', 'error');
    }
};

// Universal Sleek Modal Confirmation (Replaces native browser confirm())
window.showAdminConfirm = function(message, opts = {}) {
    return new Promise(resolve => {
        const msgEl = document.getElementById('admin-confirm-message');
        const titleEl = document.getElementById('admin-confirm-title');
        const iconEl = document.getElementById('admin-confirm-icon');
        const okBtn = document.getElementById('admin-confirm-btn-ok');
        const cancelBtn = document.getElementById('admin-confirm-btn-cancel');

        if (msgEl) msgEl.textContent = message || 'Are you sure you want to proceed?';
        if (titleEl) titleEl.textContent = opts.title || 'Confirm Action';
        if (iconEl) iconEl.textContent = opts.icon || '⚠️';
        if (okBtn) {
            okBtn.textContent = opts.okText || 'Yes, Proceed';
            okBtn.style.background = opts.okColor || '#ef4444';
        }
        if (cancelBtn) cancelBtn.textContent = opts.cancelText || 'Cancel';

        const handleOk = () => {
            cleanup();
            resolve(true);
        };
        const handleCancel = () => {
            cleanup();
            resolve(false);
        };
        const cleanup = () => {
            closeModal('admin-action-confirm-modal');
            okBtn?.removeEventListener('click', handleOk);
            cancelBtn?.removeEventListener('click', handleCancel);
        };

        okBtn?.addEventListener('click', handleOk);
        cancelBtn?.addEventListener('click', handleCancel);
        openModal('admin-action-confirm-modal');
    });
};

window.deleteDeliveryBoy = async function(id) {
    if (!id) return;
    const confirmed = await window.showAdminConfirm('Are you sure you want to remove this delivery boy from fleet?', {
        title: 'Remove Delivery Partner',
        icon: '🛵',
        okText: 'Yes, Remove Rider',
        okColor: '#ef4444'
    });
    if (!confirmed) return;

    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';

    try {
        const res = await fetch(`${API_URL}/delivery-boys/${id}`, {
            method: 'DELETE',
            headers: {
                'x-admin-pin': authPin,
                'x-pin': authPin
            }
        });

        if (res.ok) {
            window.showAdminToast('Rider removed from fleet', 'warning');
            await window.loadDeliveryBoys();
        } else {
            window.showAdminToast('Failed to remove rider', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error removing rider', 'error');
    }
};

window.populateDispatchRidersDropdown = function() {
    const selectEl = document.getElementById('dispatch-delivery-boy-select');
    if (!selectEl) return;

    const boys = window.cachedDeliveryBoys || [];
    let optionsHtml = '';

    if (boys.length === 0) {
        optionsHtml = `
            <option value="default_1" data-name="Littiwale Rider" data-phone="6370680744">🛵 Littiwale Barbil Delivery Partner (+91 6370680744)</option>
            <option value="__custom__">➕ Enter Other / Third-Party Rider...</option>
        `;
    } else {
        optionsHtml = boys.map((b, idx) => `
            <option value="${b.id}" data-name="${b.name}" data-phone="${b.phone}" ${idx === 0 ? 'selected' : ''}>
                🛵 ${b.name} (+91 ${b.phone})
            </option>
        `).join('') + `<option value="__custom__">➕ Enter Custom / Third-Party Rider...</option>`;
    }

    selectEl.innerHTML = optionsHtml;
    window.onDispatchRiderSelected();
};

window.onDispatchRiderSelected = function() {
    const selectEl = document.getElementById('dispatch-delivery-boy-select');
    const customFields = document.getElementById('dispatch-custom-rider-fields');
    if (!selectEl || !customFields) return;

    if (selectEl.value === '__custom__') {
        customFields.style.display = 'grid';
    } else {
        customFields.style.display = 'none';
    }
};

window.openDispatchModal = async function(orderId = null) {
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

    window.currentDispatchOrder = order;
    const shortId = String(order._id).slice(-6).toUpperCase();

    // Populate Modal Details
    const titleEl = document.getElementById('dispatch-modal-title');
    if (titleEl) titleEl.textContent = `Dispatch Order #${shortId}`;

    const custNameEl = document.getElementById('dispatch-cust-name');
    if (custNameEl) custNameEl.textContent = order.customerName || 'Customer';

    const custPhoneEl = document.getElementById('dispatch-cust-phone');
    if (custPhoneEl) custPhoneEl.textContent = `+91 ${order.customerPhone || 'N/A'}`;

    const custAddrEl = document.getElementById('dispatch-cust-address');
    if (custAddrEl) custAddrEl.textContent = order.deliveryAddress || (order.orderType === 'takeaway' ? 'Self Pickup at Kitchen' : 'Barbil');

    const totalVal = Number(order.finalTotal || order.subtotal || 0);
    const totalEl = document.getElementById('dispatch-order-total');
    if (totalEl) totalEl.textContent = `Total: ₹${totalVal} (${order.paymentMethod || 'COD'})`;

    const collectLabel = document.getElementById('dispatch-collect-cash-label');
    if (collectLabel) {
        collectLabel.textContent = `💵 Collect Cash from Customer (₹${totalVal})`;
    }

    // Default payment choice: if order.paymentMethod === 'UPI' or paymentCollectedByStore, default to prepaid
    const payCollectRadio = document.getElementById('dispatch-pay-collect');
    const payPrepaidRadio = document.getElementById('dispatch-pay-prepaid');
    if (order.paymentCollectedByStore || (order.paymentMethod === 'UPI' && order.paymentMode === 'full')) {
        if (payPrepaidRadio) payPrepaidRadio.checked = true;
    } else {
        if (payCollectRadio) payCollectRadio.checked = true;
    }

    // Ensure delivery boys are loaded
    if (!window.cachedDeliveryBoys || window.cachedDeliveryBoys.length === 0) {
        await window.loadDeliveryBoys();
    }
    window.populateDispatchRidersDropdown();

    openModal('order-dispatch-modal');
};

window.getSelectedDispatchRider = function() {
    const selectEl = document.getElementById('dispatch-delivery-boy-select');
    if (!selectEl) return { name: 'Littiwale Direct Delivery', phone: '6370680744' };

    if (selectEl.value === '__custom__') {
        const customName = document.getElementById('dispatch-custom-rider-name')?.value?.trim() || 'Littiwale Direct Delivery';
        const customPhone = (document.getElementById('dispatch-custom-rider-phone')?.value || '6370680744').replace(/\D/g, '').slice(-10);
        return { name: customName, phone: customPhone || '6370680744' };
    }

    const opt = selectEl.options[selectEl.selectedIndex];
    const name = opt ? (opt.getAttribute('data-name') || opt.text) : 'Littiwale Direct Delivery';
    const phone = opt ? (opt.getAttribute('data-phone') || '6370680744') : '6370680744';
    return { name, phone };
};

window.sendDeliveryBoyDispatchWhatsApp = function() {
    const order = window.currentDispatchOrder;
    if (!order || !order._id) {
        window.showAdminToast('No active order selected', 'error');
        return;
    }

    const rider = window.getSelectedDispatchRider();
    const shortId = String(order._id).slice(-6).toUpperCase();
    const itemsList = (order.items || []).map(it => `• ${it.quantity}x ${it.name} (₹${it.subtotal || (it.price * it.quantity)})`).join('\n') || '• Food Items';
    
    const isPrepaid = document.getElementById('dispatch-pay-prepaid')?.checked || false;
    const subtotal = Number(order.subtotal || order.finalTotal || 0);
    const delCharge = Number(order.deliveryCharge || 0);
    const discount = Number(order.discount || 0);
    const finalTotal = Number(order.finalTotal || (subtotal - discount + delCharge));

    const paymentInstruction = isPrepaid 
        ? `👉 *[ ₹0 — ALREADY PAID ONLINE ✅ DO NOT COLLECT CASH ]*`
        : `👉 *[ COLLECT ₹${finalTotal} CASH FROM CUSTOMER ]* 💵\n(Total includes Food ₹${subtotal} + Delivery ₹${delCharge})`;

    const gpsLine = order.gpsLink ? `\n*📍 Google Maps:* ${order.gpsLink}` : '';

    const slip = `📦 *NEW DELIVERY TASK — LITTIWALE BARBIL*\n\n` +
                 `*Order ID:* *#${shortId}*\n` +
                 `*Customer Name:* *${order.customerName || 'Customer'}*\n` +
                 `*Customer Phone:* +91 ${order.customerPhone || 'N/A'}\n` +
                 `*Delivery Address:* ${order.deliveryAddress || 'Barbil'}${order.landmark ? ` (Landmark: ${order.landmark})` : ''}${gpsLine}\n\n` +
                 `*📋 Order Items:*\n${itemsList}\n\n` +
                 `*💰 BILL BREAKDOWN:*\n` +
                 `• Food Items: ₹${subtotal}\n` +
                 `• Delivery Charge: ₹${delCharge}\n` +
                 (discount > 0 ? `• Discount: -₹${discount}\n` : '') +
                 `• Total Order Value: ₹${finalTotal}\n\n` +
                 `*💳 PAYMENT INSTRUCTION:*\n${paymentInstruction}\n\n` +
                 `⚠️ *Please deliver steaming hot, safely & verify customer phone before handover!* 🚀`;

    const cleanRiderPhone = String(rider.phone).replace(/\D/g, '').slice(-10);
    const waUrl = `https://wa.me/91${cleanRiderPhone}?text=${encodeURIComponent(slip)}`;
    window.open(waUrl, '_blank');
    window.showAdminToast(`📲 Dispatch slip opened for ${rider.name}!`, 'success');
};

window.sendCustomerDispatchWhatsApp = function() {
    const order = window.currentDispatchOrder;
    if (!order || !order._id) {
        window.showAdminToast('No active order selected', 'error');
        return;
    }

    const rider = window.getSelectedDispatchRider();
    const shortId = String(order._id).slice(-6).toUpperCase();
    const targetPhone = order.whatsappPhone || order.customerPhone || '';
    const cleanCustPhone = String(targetPhone).replace(/\D/g, '').slice(-10);

    const isPrepaid = document.getElementById('dispatch-pay-prepaid')?.checked || false;
    const finalTotal = Number(order.finalTotal || order.subtotal || 0);
    const paymentStatusText = isPrepaid ? `₹0 (Already Paid Online ✅)` : `₹${finalTotal} (Cash on Delivery 💵)`;

    const baseUrl = typeof window.getFrontendBaseUrl === 'function' ? window.getFrontendBaseUrl() : 'https://littiwale.co.in';
    const trackingLink = `${baseUrl}/track.html?id=${order._id}`;

    const msg = `🛵 *YOUR FOOD IS ON THE WAY! — LITTIWALE BARBIL*\n\n` +
                `Hi *${order.customerName || 'Customer'}*,\n` +
                `Great news! Your order *#${shortId}* is freshly packed and has left the kitchen! 💨\n\n` +
                `*🛵 Delivery Partner:* *${rider.name}*\n` +
                `*📞 Rider Contact:* +91 ${rider.phone}\n\n` +
                `*📍 Delivery Address:* ${order.deliveryAddress || 'Barbil'}\n` +
                `*💰 Amount to Pay:* ${paymentStatusText}\n\n` +
                `*🔴 Live Track Your Order:* ${trackingLink}\n\n` +
                `For any delivery assistance, feel free to call our rider directly. Enjoy your meal! ❤️\n` +
                `*— Team Littiwale Barbil*`;

    if (cleanCustPhone) {
        const waUrl = `https://wa.me/91${cleanCustPhone}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
        window.showAdminToast(`💬 "Out for Delivery" note opened for Customer!`, 'success');
    } else {
        window.showAdminToast('Customer phone number unavailable', 'warning');
    }
};

window.markTakeawayReady = async function(orderId) {
    const orders = window.cachedOrders || [];
    const order = (orderId ? (orders.find(o => String(o._id) === String(orderId)) || orders.find(o => String(o.id) === String(orderId))) : null) || window.currentSelectedOrder;
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
            body: JSON.stringify({
                status: 'dispatched',
                dispatchedAt: new Date()
            })
        });
        if (res.ok) {
            window.showAdminToast(`🛍️ Order #${String(order._id).slice(-6).toUpperCase()} marked Ready for Pickup!`, 'success');
            closeModal('order-confirm-modal');
            closeModal('order-quick-modal');
            window.fetchAndRenderOrders();
            window.sendTakeawayReadyWhatsApp(order._id);
        } else {
            window.showAdminToast('Failed to update status. Verify Admin PIN.', 'error');
        }
    } catch(e) {
        console.error('Mark takeaway ready error:', e);
        window.showAdminToast('Error marking order ready', 'error');
    }
};

window.sendTakeawayReadyWhatsApp = function(orderId) {
    const orders = window.cachedOrders || [];
    const order = (orderId ? (orders.find(o => String(o._id) === String(orderId)) || orders.find(o => String(o.id) === String(orderId))) : null) || window.currentSelectedOrder;
    if (!order || !order._id) return;

    const shortId = String(order._id).slice(-6).toUpperCase();
    const targetPhone = order.whatsappPhone || order.customerPhone || '';
    const cleanCustPhone = String(targetPhone).replace(/\D/g, '').slice(-10);
    const custName = order.customerName || 'Customer';
    const finalTotal = Number(order.finalTotal || order.subtotal || 0);
    const isPrepaid = order.paymentCollectedByStore || (order.paymentMethod === 'UPI' && order.paymentMode === 'full');
    const paymentText = isPrepaid ? `₹0 (Already Paid Online ✅)` : `₹${finalTotal} (Pay at Counter 💵)`;

    const baseUrl = typeof window.getFrontendBaseUrl === 'function' ? window.getFrontendBaseUrl() : 'https://littiwale.co.in';
    const trackingLink = `${baseUrl}/track.html?id=${order._id}`;

    const msg = `🛍️ *YOUR ORDER IS READY FOR PICKUP! — LITTIWALE BARBIL*\n\n` +
                `Hi *${custName}*,\n` +
                `Your order *#${shortId}* has been freshly packed, hot and ready for collection! 🍱🔥\n\n` +
                `*📍 Pickup Location:* Littiwale Cloud Kitchen, Ward No. 7, Punjabi Para, Barbil\n` +
                `*💰 Amount to Pay at Counter:* ${paymentText}\n\n` +
                `*🔴 View Order Slip:* ${trackingLink}\n\n` +
                `Please visit our cloud kitchen and share your Order ID (*#${shortId}*) to collect your hot meal. Thank you! ❤️\n` +
                `*— Team Littiwale Barbil*`;

    if (cleanCustPhone) {
        const waUrl = `https://wa.me/91${cleanCustPhone}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
        window.showAdminToast(`💬 "Ready for Pickup" alert opened for ${custName}!`, 'success');
    } else {
        window.showAdminToast('Customer phone number unavailable', 'warning');
    }
};

window.sendCustomerDeliveredWhatsApp = function(orderId) {
    const orders = window.cachedOrders || [];
    const order = (orderId ? (orders.find(o => String(o._id) === String(orderId)) || orders.find(o => String(o.id) === String(orderId))) : null) || window.currentDispatchOrder;
    if (!order || !order._id) {
        window.showAdminToast('Order details not found', 'error');
        return;
    }

    const shortId = order._id ? String(order._id).slice(-6).toUpperCase() : 'LW-ORD';
    const targetPhone = order.whatsappPhone || order.customerPhone || '';
    const cleanCustPhone = String(targetPhone).replace(/\D/g, '').slice(-10);
    const custName = order.customerName || 'Foodie';

    const baseUrl = typeof window.getFrontendBaseUrl === 'function' ? window.getFrontendBaseUrl() : 'https://littiwale.co.in';

    const msg = `🎉 *ORDER DELIVERED — THANK YOU FOR CHOOSING LITTIWALE!* ❤️\n\n` +
                `Dear *${custName}*,\n` +
                `Your steaming hot meal from *Littiwale* (Order *#${shortId}*) has been completed! 🍽️\n\n` +
                `We hope you enjoyed every authentic bite of our traditional litti! 🔥\n\n` +
                `⭐ *Rate Your Experience:*\n` +
                `Loved our food & service? Please take 10 seconds to give Littiwale a 5-star Google review:\n` +
                `👉 https://g.page/r/CYlrxD6jO24cEAE/review\n\n` +
                `🍴 *Order Again:*\n` +
                `🌐 ${baseUrl}\n\n` +
                `Thank you once again & see you soon!\n` +
                `*— Team Littiwale Barbil*`;

    if (cleanCustPhone) {
        const waUrl = `https://wa.me/91${cleanCustPhone}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
        window.showAdminToast(`📲 "Thank You & Review" note opened for ${custName}!`, 'success');
    } else {
        window.showAdminToast('Customer phone number unavailable', 'warning');
    }
};

// ==========================================================================
// 💬 UNIVERSAL WHATSAPP ACTION SHEET & TEMPLATE MESSAGING SYSTEM
// ==========================================================================
window.currentWhatsAppOrder = null;

window.openWhatsAppQuickModal = function(orderId = null) {
    let order = null;
    if (orderId) {
        order = (window.cachedOrders || []).find(o => String(o._id) === String(orderId) || String(o._id).slice(-6).toUpperCase() === String(orderId).toUpperCase());
    }
    if (!order) {
        order = window.currentSelectedOrder || window.currentDispatchOrder;
    }

    if (!order || !order._id) {
        window.showAdminToast('Order details not found', 'error');
        return;
    }

    window.currentWhatsAppOrder = order;
    const shortId = String(order._id).slice(-6).toUpperCase();
    const custName = order.customerName || 'Customer';
    const targetPhone = order.whatsappPhone || order.customerPhone || '';
    const cleanPhone = String(targetPhone).replace(/\D/g, '').slice(-10);
    const status = (order.status || 'pending').toLowerCase();

    // Populate Header Info
    const titleEl = document.getElementById('wa-modal-order-title');
    if (titleEl) titleEl.textContent = `Order #${shortId}`;

    const custInfoEl = document.getElementById('wa-modal-cust-info');
    if (custInfoEl) custInfoEl.textContent = `${custName} • +91 ${cleanPhone || 'N/A'}`;

    const statusBadgeEl = document.getElementById('wa-modal-status-badge');
    if (statusBadgeEl) {
        statusBadgeEl.textContent = status.toUpperCase();
        statusBadgeEl.className = `badge ${status === 'delivered' ? 'badge-open' : (status === 'cancelled' ? 'badge-closed' : (status === 'accepted' || status === 'confirmed' ? 'badge-active' : (status === 'dispatched' ? 'badge-info' : 'badge-new')))}`;
    }

    openModal('order-whatsapp-action-modal');
};

window.executeWhatsAppAction = function(actionType) {
    const order = window.currentWhatsAppOrder || window.currentSelectedOrder || window.currentDispatchOrder;
    if (!order || !order._id) {
        window.showAdminToast('No order selected', 'error');
        return;
    }

    const shortId = String(order._id).slice(-6).toUpperCase();
    const custName = order.customerName || 'Customer';
    const targetPhone = order.whatsappPhone || order.customerPhone || '';
    const cleanPhone = String(targetPhone).replace(/\D/g, '').slice(-10);

    if (!cleanPhone) {
        window.showAdminToast('Customer WhatsApp/phone number unavailable', 'warning');
        return;
    }

    const isTakeaway = (order.orderType === 'takeaway');
    const itemsList = (order.items || []).map(it => `• ${it.quantity}x ${it.name} (₹${it.subtotal || (it.price * (it.quantity || 1))})`).join('\n') || '• Order Items';
    const subtotal = Number(order.subtotal || order.finalTotal || 0);
    const delCharge = Number(order.deliveryCharge || 0);
    const discount = Number(order.discount || 0);
    const finalTotal = Number(order.finalTotal || order.subtotal || 0);
    const estTime = order.estimatedTime || (isTakeaway ? '15-20 mins' : '25-35 mins');

    const baseUrl = typeof window.getFrontendBaseUrl === 'function' ? window.getFrontendBaseUrl() : 'https://littiwale.co.in';
    const trackingLink = `${baseUrl}/track.html?id=${order._id}`;

    let msg = '';

    if (actionType === 'direct') {
        window.open(`https://wa.me/91${cleanPhone}`, '_blank');
        closeModal('order-whatsapp-action-modal');
        window.showAdminToast(`💬 Direct WhatsApp chat opened for ${custName}!`, 'success');
        return;
    }

    if (actionType === 'confirmed') {
        const orderTypeHeader = isTakeaway ? '*🛍️ TAKEAWAY ORDER CONFIRMED — LITTIWALE BARBIL*' : '*✅ ORDER CONFIRMED — LITTIWALE BARBIL*';
        const locationInfo = isTakeaway 
            ? `*📍 Pickup Location:* Littiwale Cloud Kitchen, Ward No. 7, Punjabi Para, Barbil\n*⏱️ Ready for Pickup in:* ${estTime}` 
            : `*📍 Delivery Address:* ${order.deliveryAddress || 'Barbil'}\n*⏱️ Estimated Delivery:* ${estTime}`;

        const paymentNote = (order.paymentMethod === 'UPI' || order.paymentCollectedByStore) ? 'Prepaid Online ✅' : 'Cash on Delivery (COD)';

        msg = `${orderTypeHeader}\n\n` +
              `Hi *${custName}*,\n` +
              `Thank you! Your order *#${shortId}* has been accepted and is now cooking fresh in our kitchen! 👨‍🍳🔥\n\n` +
              `${locationInfo}\n\n` +
              `*📋 Order Items:*\n${itemsList}\n\n` +
              `*💰 Bill Breakdown:*\n` +
              `• Food Items Subtotal: ₹${subtotal}\n` +
              (discount > 0 ? `• Discount: -₹${discount}\n` : '') +
              (isTakeaway ? `• Delivery Charge: ₹0 (Self Pickup)\n` : `• Delivery Charge: ₹${delCharge}\n`) +
              `*👉 Grand Total Payable: ₹${finalTotal} (${paymentNote})*\n\n` +
              `*🔴 Live Tracking Link:* ${trackingLink}\n\n` +
              (isTakeaway ? `We look forward to serving you at our counter. See you shortly! ❤️\n*— Team Littiwale Barbil*` : `We will notify you the moment your food is out for delivery! ❤️\n*— Team Littiwale Barbil*`);
    } else if (actionType === 'dispatch') {
        if (isTakeaway) {
            window.sendTakeawayReadyWhatsApp(order._id);
            closeModal('order-whatsapp-action-modal');
            return;
        }
        const riderName = order.deliveryBoy?.name || order.assignedDeliveryBoy?.name || order.deliveryBoyName || 'Littiwale Direct Delivery';
        const rawRiderPhone = order.deliveryBoy?.phone || order.assignedDeliveryBoy?.phone || order.deliveryBoyPhone || '6370680744';
        const riderPhone = String(rawRiderPhone).replace(/\D/g, '').slice(-10) || '6370680744';

        const isPrepaid = order.paymentCollectedByStore || (order.paymentMethod === 'UPI' && order.paymentMode === 'full');
        const paymentStatusText = isPrepaid ? `₹0 (Already Paid Online ✅)` : `₹${finalTotal} (${order.paymentMethod || 'Cash on Delivery'} 💵)`;

        msg = `🛵 *YOUR FOOD IS ON THE WAY! — LITTIWALE BARBIL*\n\n` +
              `Hi *${custName}*,\n` +
              `Great news! Your order *#${shortId}* has been freshly packed and is out for delivery! 💨\n\n` +
              `*🛵 Delivery Contact:* *${riderName}*\n` +
              `*📞 Phone Number:* +91 ${riderPhone}\n\n` +
              `*📍 Delivery Address:* ${order.deliveryAddress || 'Barbil'}\n` +
              `*💰 Amount to Pay:* ${paymentStatusText}\n\n` +
              `*🔴 Live Track Your Order:* ${trackingLink}\n\n` +
              `For any delivery assistance, please feel free to call our delivery contact directly. Thank you for choosing *Littiwale*! ❤️\n` +
              `*— Team Littiwale Barbil*`;
    } else if (actionType === 'delivered') {
        msg = `🎉 *ORDER DELIVERED — THANK YOU FOR CHOOSING LITTIWALE!* ❤️\n\n` +
              `Dear *${custName}*,\n` +
              `Your steaming hot meal from *Littiwale* (Order *#${shortId}*) has been completed! 🍽️\n\n` +
              `We hope you enjoyed every authentic bite of our traditional litti! 🔥\n\n` +
              `⭐ *Rate Your Experience:*\n` +
              `If you loved the taste & service, please take 10 seconds to give Littiwale a 5-star Google review:\n` +
              `👉 https://g.page/r/CYlrxD6jO24cEAE/review\n\n` +
              `🍴 *Order Again:*\n` +
              `🌐 ${baseUrl}\n\n` +
              `Thank you once again & see you soon!\n` +
              `*— Team Littiwale Barbil*`;
    } else if (actionType === 'cancelled') {
        const cancelReason = order.cancelReason || 'Kitchen temporarily overloaded / Item out of stock';
        msg = `*❌ ORDER CANCELLATION UPDATE — LITTIWALE BARBIL*\n\n` +
              `Dear *${custName}*,\n` +
              `We regret to inform you that your order *#${shortId}* could not be processed at this time.\n\n` +
              `*Reason:* ${cancelReason}\n\n` +
              `We sincerely apologize for the inconvenience caused. If you have already completed an online payment, our team will initiate your refund promptly.\n\n` +
              `For any queries or direct assistance, please reply to this WhatsApp message. Thank you for your understanding! 🙏\n` +
              `*— Team Littiwale Barbil*`;
    }

    if (msg) {
        const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
        closeModal('order-whatsapp-action-modal');
        window.showAdminToast(`📲 WhatsApp message opened for ${custName}!`, 'success');
    }
};

window.executeDispatchOrder = async function() {
    const order = window.currentDispatchOrder;
    if (!order || !order._id) return;

    const rider = window.getSelectedDispatchRider();
    const isPrepaid = document.getElementById('dispatch-pay-prepaid')?.checked || false;
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
                status: 'dispatched',
                deliveryBoy: {
                    name: rider.name,
                    phone: rider.phone
                },
                paymentCollectedByStore: isPrepaid,
                dispatchedAt: new Date()
            })
        });

        if (res.ok) {
            const shortId = String(order._id).slice(-6).toUpperCase();
            window.showAdminToast(`🚀 Order #${shortId} Dispatched with ${rider.name}!`, 'success');
            closeModal('order-dispatch-modal');
            closeModal('order-confirm-modal');
            window.fetchAndRenderOrders();
        } else {
            window.showAdminToast('Failed to dispatch order. Please verify Admin PIN.', 'error');
        }
    } catch(e) {
        console.error('Dispatch error:', e);
        window.showAdminToast('Error marking order dispatched', 'error');
    }
};

window.selectRejectReason = function(reasonText, btnEl) {
    const input = document.getElementById('ord-reject-reason-input');
    if (input) input.value = reasonText;
    
    // Update active style on chips
    const chips = document.querySelectorAll('#reject-reason-chips .chip-btn');
    chips.forEach(c => {
        c.style.background = 'rgba(255,255,255,0.05)';
        c.style.color = '#cbd5e1';
        c.style.borderColor = 'rgba(255,255,255,0.1)';
    });
    if (btnEl) {
        btnEl.style.background = 'rgba(239,68,68,0.15)';
        btnEl.style.color = '#fca5a5';
        btnEl.style.borderColor = 'rgba(239,68,68,0.3)';
    }
};

window.cancelOrderPrompt = function(orderId = null) {
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

    window.currentRejectOrder = order;
    const shortId = String(order._id).slice(-6).toUpperCase();
    
    const titleEl = document.getElementById('ord-reject-modal-title');
    if (titleEl) titleEl.textContent = `Reject / Cancel Order #${shortId}`;
    
    const subEl = document.getElementById('ord-reject-modal-subtitle');
    if (subEl) subEl.textContent = `Customer: ${order.customerName || 'Guest'} (${order.customerPhone || 'N/A'})`;

    const idInput = document.getElementById('ord-reject-order-id');
    if (idInput) idInput.value = order._id;

    // Reset default reason
    const reasonInput = document.getElementById('ord-reject-reason-input');
    if (reasonInput) reasonInput.value = '🍳 Kitchen at maximum capacity / heavy rush';

    openModal('order-reject-modal');
};

window.executeOrderCancellation = async function() {
    const order = window.currentRejectOrder;
    if (!order || !order._id) {
        window.showAdminToast('No order selected', 'error');
        return;
    }

    const shortId = String(order._id).slice(-6).toUpperCase();
    const reasonInput = document.getElementById('ord-reject-reason-input');
    const reason = (reasonInput?.value || 'Kitchen at maximum capacity').trim();
    const notifyWa = document.getElementById('ord-reject-notify-wa')?.checked || false;

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
                cancelReason: reason
            })
        });

        if (res.ok) {
            closeModal('order-reject-modal');
            closeModal('order-confirm-modal');
            window.showAdminToast(`❌ Order #${shortId} Rejected`, 'warning', 'Order Cancelled');
            window.fetchAndRenderOrders();

            // Send polite cancellation notice to customer via WhatsApp if checked
            if (notifyWa) {
                const targetPhone = order.whatsappPhone || order.customerPhone || '';
                const rawPhone = String(targetPhone).replace(/\D/g, '');
                const cleanPhone = rawPhone.length > 10 ? rawPhone.slice(-10) : rawPhone;

                if (cleanPhone) {
                    const cancelMsg = `*❌ ORDER CANCELLATION UPDATE — LITTIWALE BARBIL*\n\n` +
                                      `Dear *${order.customerName || 'Customer'}*,\n` +
                                      `We regret to inform you that your order *#${shortId}* could not be accepted at this time.\n\n` +
                                      `*Reason:* ${reason}\n\n` +
                                      `We sincerely apologize for the inconvenience caused. If you have already completed an online payment, our team will initiate your refund promptly.\n\n` +
                                      `For any queries or direct assistance, please reply to this WhatsApp message. Thank you for your understanding! 🙏`;

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

window.confirmDeleteOrder = function(orderId, orderShortId) {
    if (!orderId) return;
    const modal = document.getElementById('order-delete-confirm-modal');
    if (modal) {
        const idInput = document.getElementById('delete-order-target-id');
        const labelEl = document.getElementById('delete-order-target-label');
        if (idInput) idInput.value = orderId;
        if (labelEl) labelEl.textContent = `Order ${orderShortId || ''}`;
        modal.classList.add('active');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    } else {
        if (confirm(`Permanently delete order ${orderShortId || ''} from database?`)) {
            window.deleteOrderPermanently(orderId);
        }
    }
};

window.executePermanentDelete = function() {
    const id = document.getElementById('delete-order-target-id')?.value;
    if (id) {
        window.deleteOrderPermanently(id);
        closeModal('order-delete-confirm-modal');
    }
};

window.deleteOrderPermanently = async function(orderId) {
    if (!orderId) return;
    const authPin = sessionStorage.getItem('adminPin') || localStorage.getItem('adminPin') || '1234';
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin,
                'x-pin': authPin
            }
        });
        if (res.ok) {
            window.showAdminToast('Order permanently deleted from database', 'info');
            closeModal('order-confirm-modal');
            closeModal('order-reject-modal');
            closeModal('order-delete-confirm-modal');
            window.fetchAndRenderOrders();
        } else {
            window.showAdminToast('Failed to delete order', 'error');
        }
    } catch(e) {
        window.showAdminToast('Error deleting order', 'error');
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

// ==========================================================================
// PROGRESSIVE WEB APP (PWA) SERVICE WORKER & INSTALLATION CONTROLLER
// ==========================================================================
let deferredPwaPrompt = null;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('✅ Littiwale Admin PWA Service Worker Registered:', reg.scope))
            .catch(err => console.warn('PWA SW Register warning:', err));
    });
}

function triggerAdminPwaInstall() {
    if (deferredPwaPrompt) {
        deferredPwaPrompt.prompt();
        deferredPwaPrompt.userChoice.then(({ outcome }) => {
            if (outcome === 'accepted') {
                window.showAdminToast('Admin App Installed Successfully! 📲', 'success');
            }
            deferredPwaPrompt = null;
        });
    } else {
        if (typeof window.showAdminToast === 'function') {
            window.showAdminToast('Tap Menu (⋮) in Chrome and select "Install App" or "Add to Home Screen"', 'info');
        } else {
            alert('Tap Menu (⋮) in Chrome and select "Install App" or "Add to Home Screen"');
        }
    }
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    const stripBtn = document.getElementById('pwa-strip-install-btn');
    if (stripBtn) stripBtn.onclick = triggerAdminPwaInstall;
    const sidebarBtn = document.getElementById('pwa-install-btn');
    if (sidebarBtn) sidebarBtn.onclick = triggerAdminPwaInstall;
});

document.addEventListener('DOMContentLoaded', () => {
    const stripBtn = document.getElementById('pwa-strip-install-btn');
    if (stripBtn) stripBtn.addEventListener('click', triggerAdminPwaInstall);
    const sidebarBtn = document.getElementById('pwa-install-btn');
    if (sidebarBtn) sidebarBtn.addEventListener('click', triggerAdminPwaInstall);

    if (typeof window.loadHeroCmsSettings === 'function') {
        window.loadHeroCmsSettings();
    }
});

window.addEventListener('appinstalled', () => {
    console.log('✅ Littiwale Admin PWA Installed Successfully');
    window.showAdminToast('Admin App Installed on Device! 📲', 'success');
});
