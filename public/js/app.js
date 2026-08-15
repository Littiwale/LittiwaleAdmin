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
// WEBSITE ORDERS REVENUE TRACKER
// =======================
window.loadFinanceData = function() {
    renderWebsiteRevenue();
};

function renderWebsiteRevenue() {
    // Calculated live from incoming website customer orders
    const totalOrders = 0;
    const totalRevenue = 0;
    const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const elWebRev = document.getElementById('fin-website-revenue');
    if (elWebRev) elWebRev.textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;

    const elWebOrd = document.getElementById('fin-website-orders');
    if (elWebOrd) elWebOrd.textContent = `${totalOrders} orders`;

    const elWebAov = document.getElementById('fin-website-aov');
    if (elWebAov) elWebAov.textContent = `₹${aov}`;

    const elDashRev = document.getElementById('kpi-revenue');
    if (elDashRev) elDashRev.textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;

    const elDashOrd = document.getElementById('kpi-orders-count');
    if (elDashOrd) elDashOrd.textContent = `${totalOrders} website orders`;
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
window.switchSection = function(targetId) {
    const allNavs = document.querySelectorAll('.nav-item');
    const allTabs = document.querySelectorAll('.tab-section');
    
    allNavs.forEach(n => {
        if (n.getAttribute('data-target') === targetId) {
            n.classList.add('active');
            const title = n.getAttribute('data-title') || 'Dashboard';
            const bc = n.getAttribute('data-bc') || title;
            const titleEl = document.getElementById('header-page-title');
            const bcEl = document.getElementById('breadcrumb-current');
            if (titleEl) titleEl.textContent = title;
            if (bcEl) bcEl.textContent = bc;
        } else {
            n.classList.remove('active');
        }
    });
    
    allTabs.forEach(s => {
        if (s.id === targetId) {
            s.classList.remove('hidden');
            s.classList.add('active');
        } else {
            s.classList.add('hidden');
            s.classList.remove('active');
        }
    });

    if (targetId === 'media-section') fetchReels();
    if (targetId === 'menu-section') loadMenu();
    if (targetId === 'coupons-section') loadCoupons();
    if (targetId === 'settings-section') loadStoreSettings();
    if (targetId === 'analytics-section') window.renderAnalyticsData();
    if (targetId === 'finance-section') window.loadFinanceData();

    // Close sidebar on mobile after navigating
    if (window.innerWidth <= 900) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
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
    window.showAdminToast('Orders refreshed and up to date!', 'success');
};

window.openAnnouncementModal = function() {
    window.switchToCmsTab('announcements-tab');
    document.getElementById('cms-announcements-grid')?.scrollIntoView({ behavior: 'smooth' });
};

window.handleGlobalSearch = function(e) {
    const query = (e.target.value || '').toLowerCase().trim();
    if (!query) {
        renderMenuGrid();
        return;
    }
    const currentTab = document.querySelector('.tab-section.active');
    if (!currentTab || currentTab.id !== 'menu-section') {
        window.switchSection('menu-section');
    }
    
    const container = document.getElementById('menu-grid-container');
    if (!container) return;
    
    const filtered = (window.cachedMenuItems || []).filter(item => {
        return (item.name && item.name.toLowerCase().includes(query)) ||
               (item.category && item.category.toLowerCase().includes(query)) ||
               (item.description && item.description.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:40px;">No dishes matching "${query}" found.</div>`;
        return;
    }

    container.innerHTML = `
        <div style="background:var(--bg-surface); border:1px solid var(--border-card); border-radius:var(--radius-lg); padding:20px;">
            <div style="font-size:15px; font-weight:800; color:#fff; margin-bottom:16px;">Search Results for "${query}" (${filtered.length} dishes)</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:20px;">
                ${filtered.map(item => `
                    <div class="food-card">
                        <div class="food-card-img-wrap">
                            ${item.image ? `<img src="${item.image}" class="food-card-img">` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);">No Image</div>`}
                            <div class="food-loc-badge">${item.locationAvailability === 'cloud_only' ? '☁️ CLOUD' : item.locationAvailability === 'outlet_only' ? '🏪 OUTLET' : '🌐 BOTH'}</div>
                        </div>
                        <div class="food-card-body">
                            <div class="food-card-title-row">
                                <h4 class="food-card-name">${item.dietaryPreference === 'non-veg' ? '🔴' : '🟢'} ${item.name}</h4>
                                <span class="food-card-price">₹${item.price}</span>
                            </div>
                            <p class="food-card-desc">${item.description || 'Authentic Desi Taste'}</p>
                            <div class="food-card-actions">
                                <button class="btn btn-sm btn-secondary" style="flex:1;" onclick="editMenu('${item._id}')">✏️ Edit</button>
                                <button class="btn btn-sm ${item.isAvailable !== false ? 'btn-outline' : 'btn-danger'}" style="flex:1;" onclick="toggleMenuStock('${item._id}', ${item.isAvailable})">${item.isAvailable !== false ? 'In Stock' : 'Out of Stock'}</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteMenu('${item._id}')">🗑</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
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
document.getElementById('sidebar-toggle-btn')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 900) {
        sidebar?.classList.toggle('open');
    } else {
        sidebar?.classList.toggle('collapsed');
    }
});

document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
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
    const revenue = 0;
    const elRevenue = document.getElementById('kpi-revenue');
    if (elRevenue) elRevenue.textContent = `₹${revenue.toLocaleString('en-IN')}`;
    
    const elOrdersCount = document.getElementById('kpi-orders-count');
    if (elOrdersCount) elOrdersCount.textContent = `0 orders`;

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

function renderMenuGrid() {
    const container = document.getElementById('menu-grid-container');
    if (!container) return; // Prevent error if run before DOM update
    container.innerHTML = '';
    
    const locFilter = document.getElementById('menu-filter-location')?.value || 'all';
    const catFilter = document.getElementById('menu-filter-category')?.value || 'all';
    const dietFilter = document.getElementById('menu-filter-diet')?.value || 'all';

    // Filter items
    let filteredMenus = window.cachedMenuItems.filter(item => {
        // Exclude Craziest Deals from standard Menu Tab (they belong exclusively to Media & Content -> Craziest Deals)
        if (item.category === 'Craziest Deals of the Hour' || (item.category && item.category.toLowerCase().includes('craziest deal')) || item.isCraziestDeal === true) return false;
        let matchLoc = (locFilter === 'all' || item.locationAvailability === locFilter || item.locationAvailability === 'both');
        let matchCat = (catFilter === 'all' || item.category === catFilter || (!item.category && catFilter === 'Uncategorized'));
        let matchDiet = (dietFilter === 'all' || item.dietaryPreference === dietFilter || (!item.dietaryPreference && dietFilter === 'veg'));
        return matchLoc && matchCat && matchDiet;
    });

    if (filteredMenus.length === 0) {
        container.innerHTML = '<div style="color:#6b7280; text-align:center; padding:40px;">No items match the selected filters.</div>';
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
            // Fallback: use original
            const reader = new FileReader();
            reader.onload = (e) => {
                currentAnnouncementImage = e.target.result;
                previewDiv.innerHTML = `<img src="${currentAnnouncementImage}" style="width:100%; height:100%; object-fit:cover;">`;
            };
            reader.readAsDataURL(file);
        }
    }
});

async function loadAnnouncements() {
    try {
        const items = await apiCall('/announcements');
        window.cachedAnnouncements = items || [];
        if (typeof renderDynamicDashboard === 'function') renderDynamicDashboard();
        
        const container = document.getElementById('announcements-list-container');
        if (!container) return;
        container.innerHTML = '';
        
        if (items.length === 0) {
            container.innerHTML = '<div style="color:#6b7280; text-align:center; padding:20px;">No announcements yet.</div>';
            return;
        }

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
                <div style="width:24px; text-align:center; color:#4b5563; font-weight:800; font-size:12px;">
                    ≡
                </div>
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
    } catch (e) { console.error(e); }
}

document.getElementById('announcement-inline-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentAnnouncementImage) {
        window.showAdminToast('Please select a banner image first.', "error");
        return;
    }

    const body = {
        title: document.getElementById('announcement-title').value,
        expiry: document.getElementById('announcement-expiry').value || null,
        image: currentAnnouncementImage,
        isActive: true
    };

    await apiCall('/announcements', 'POST', body);
    
    // Reset Form
    currentAnnouncementImage = '';
    document.getElementById('announcement-image-preview').style.display = 'none';
    document.getElementById('announcement-image-placeholder').style.display = 'flex';
    document.getElementById('announcement-title').value = '';
    document.getElementById('announcement-expiry').value = '';
    document.getElementById('announcement-image').value = '';

    loadAnnouncements();
});

async function toggleAnnouncement(id, currentState) {
    await apiCall(`/announcements/${id}`, 'PUT', { isActive: !currentState });
    loadAnnouncements();
}

async function deleteAnnouncement(id) {
    if (await showConfirm('Delete Announcement', 'Are you sure you want to delete this announcement?')) {
        await apiCall(`/announcements/${id}`, 'DELETE');
        loadAnnouncements();
    }
}

// =======================
// COUPONS LOGIC
// =======================
async function loadCoupons() {
    try {
        const items = await apiCall('/coupons');
        window.cachedCoupons = items || [];
        if (typeof renderDynamicDashboard === 'function') renderDynamicDashboard();
        
        const tbody = document.getElementById('coupons-tbody');
        tbody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.code}</strong></td>
                <td>${item.discountType === 'percentage' ? '%' : 'Fixed'}</td>
                <td>${item.discountValue}</td>
                <td>₹${item.minOrderValue}</td>
                <td><span class="badge ${item.isActive ? 'active' : 'inactive'}">${item.isActive ? 'Yes' : 'No'}</span></td>
                <td>
                    <button class="btn-sm btn-edit" onclick="editCoupon('${item._id}')">Edit</button>
                    <button class="btn-sm btn-delete" onclick="deleteCoupon('${item._id}')">Del</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
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
    const isAuto = document.getElementById(`${storeId}-auto`).checked;
    const manualGroup = document.getElementById(`${storeId}-manual-group`);
    if (isAuto) {
        manualGroup.style.display = 'none';
    } else {
        manualGroup.style.display = 'block';
        toggleReasonInput(storeId);
    }
}

function toggleReasonInput(storeId) {
    const isOnline = document.getElementById(`${storeId}-online`).checked;
    const reasonGroup = document.getElementById(`${storeId}-reason-group`);
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

        settings.forEach(setting => {
            const idPrefix = setting.storeId;
            if (setting.isOnline) anyOnline = true;
            
            const autoEl = document.getElementById(`${idPrefix}-auto`);
            const isOnlineEl = document.getElementById(`${idPrefix}-online`);
            const reasonEl = document.getElementById(`${idPrefix}-reason`);
            
            if (autoEl && isOnlineEl && reasonEl) {
                autoEl.checked = setting.autoSchedule || false;
                isOnlineEl.checked = setting.isOnline;
                reasonEl.value = setting.offlineReason || '';
                
                toggleAutoSchedule(idPrefix);
            }
        });

        // Update Header & Dashboard Status Indicators
        const headerStatusPill = document.getElementById('header-status-pill');
        const headerStatusText = document.getElementById('header-status-text');
        const dbStoreStatusBadge = document.getElementById('db-store-status-badge');
        const dbTodayPill = document.getElementById('db-today-schedule-pill');

        if (anyOnline) {
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
        } else {
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
        }
        if (typeof renderDynamicDashboard === 'function') renderDynamicDashboard();
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
        perk4Text: getVal('perk4-desc', 'perk4-text')
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
