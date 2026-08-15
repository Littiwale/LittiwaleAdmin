const API_URL = '/api';
let authPin = localStorage.getItem('adminPin') || '';

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
    if (authPin) {
        showDashboard();
        fetchData();
    } else {
        showLogin();
    }
}

// =======================
// AUTHENTICATION
// =======================
loginBtn.addEventListener('click', async () => {
    const pin = pinInput.value;
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });
        
        const data = await res.json();
        if (data.success) {
            authPin = pin;
            localStorage.setItem('adminPin', pin);
            showDashboard();
            fetchData();
        } else {
            loginError.textContent = data.error || 'Invalid PIN';
        }
    } catch (err) {
        loginError.textContent = 'Server error. Try again.';
    }
});

logoutBtn.addEventListener('click', () => {
    authPin = '';
    localStorage.removeItem('adminPin');
    showLogin();
});

function showLogin() {
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    pinInput.value = '';
    loginError.textContent = '';
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
// NAVIGATION
// =======================
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const allNavs = document.querySelectorAll('.nav-item');
        const allTabs = document.querySelectorAll('.tab-section');
        
        allNavs.forEach(n => n.classList.remove('active'));
        allTabs.forEach(s => s.classList.add('hidden'));
        
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
            targetEl.classList.remove('hidden');
            targetEl.classList.add('active');
            if (targetId === 'media-section') fetchReels();
        }
        
        // Close sidebar on mobile after clicking a link
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('open');
        }
    });
});

document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// =======================
// DATA FETCHING
// =======================
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'x-admin-pin': authPin,
            'Content-Type': 'application/json'
        },
        cache: 'no-store'
    };
    if (body) options.body = JSON.stringify(body);
    
    const res = await fetch(`${API_URL}${endpoint}`, options);
    if (res.status === 401) {
        logoutBtn.click();
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

async function fetchData() {
    await loadCategories();
    loadMenu();
    loadAnnouncements();
    loadCoupons();
    loadStoreSettings();
}

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
    const name = document.getElementById('menu-name').value || 'Item Name';
    const price = document.getElementById('menu-price').value || '0';
    const desc = document.getElementById('menu-desc').value || 'Item description will appear here...';
    const category = document.getElementById('menu-category').value || '—';
    const diet = document.querySelector('input[name="menu-diet"]:checked').value;
    const isSpicy = document.getElementById('menu-spicy').checked;
    const isAvail = document.querySelector('input[name="menu-avail-input"]:checked').value === 'true';
    const locAvail = document.querySelector('input[name="menu-location-avail"]:checked').value;
    const prepTime = document.getElementById('menu-prep-time').value;

    document.getElementById('lw-prev-name').textContent = name;
    document.getElementById('lw-prev-price').textContent = `₹${price}`;
    document.getElementById('lw-prev-desc').textContent = desc;
    document.getElementById('lw-prev-cat').textContent = category;
    
    if (prepTime) {
        document.getElementById('lw-prev-prep').textContent = `~${prepTime} mins`;
    } else {
        document.getElementById('lw-prev-prep').textContent = '—';
    }

    if (locAvail === 'cloud_only') {
        document.getElementById('lw-prev-loc-avail').textContent = '☁️ Cloud Only';
    } else if (locAvail === 'outlet_only') {
        document.getElementById('lw-prev-loc-avail').textContent = '🏪 Outlet Only';
    } else {
        document.getElementById('lw-prev-loc-avail').textContent = '🌐 Both';
    }

    if (diet === 'non-veg') {
        document.getElementById('lw-prev-veg').textContent = '🔴 Non-Veg';
        document.getElementById('lw-prev-veg').style.background = 'rgba(239,68,68,0.1)';
        document.getElementById('lw-prev-veg').style.color = '#ef4444';
        document.getElementById('lw-prev-veg').style.borderColor = 'rgba(239,68,68,0.2)';
    } else {
        document.getElementById('lw-prev-veg').textContent = '🟢 Veg';
        document.getElementById('lw-prev-veg').style.background = 'rgba(34,197,94,0.1)';
        document.getElementById('lw-prev-veg').style.color = '#22c55e';
        document.getElementById('lw-prev-veg').style.borderColor = 'rgba(34,197,94,0.2)';
    }

    if (isSpicy) {
        document.getElementById('lw-prev-spice').textContent = '🌶️ Spicy';
        document.getElementById('lw-prev-spice').style.color = '#ef4444';
    } else {
        document.getElementById('lw-prev-spice').textContent = '—';
        document.getElementById('lw-prev-spice').style.color = '#e5e7eb';
    }

    if (isAvail) {
        document.getElementById('lw-prev-avail').textContent = 'Visible ✓';
        document.getElementById('lw-prev-avail').style.color = '#60a5fa';
    } else {
        document.getElementById('lw-prev-avail').textContent = 'Hidden 🚫';
        document.getElementById('lw-prev-avail').style.color = '#6b7280';
    }
}

document.getElementById('menu-name').addEventListener('input', updateLivePreview);
document.getElementById('menu-price').addEventListener('input', updateLivePreview);
document.getElementById('menu-desc').addEventListener('input', updateLivePreview);
document.getElementById('menu-category').addEventListener('change', updateLivePreview);
document.querySelectorAll('input[name="menu-diet"]').forEach(r => r.addEventListener('change', updateLivePreview));
document.getElementById('menu-spicy').addEventListener('change', updateLivePreview);
document.querySelectorAll('input[name="menu-avail-input"]').forEach(r => r.addEventListener('change', updateLivePreview));
document.querySelectorAll('input[name="menu-location-avail"]').forEach(r => r.addEventListener('change', updateLivePreview));
document.getElementById('menu-prep-time').addEventListener('input', updateLivePreview);

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
        window.cachedMenuItems = menus;
        updateCategoryFilterOptions();
        renderMenuGrid();
    } catch (e) { console.error(e); }
}

// Aliasing loadMenu to fetchAndRenderMenu for backwards compatibility
const loadMenu = fetchAndRenderMenu;

function updateCategoryFilterOptions() {
    const locFilter = document.getElementById('menu-filter-location')?.value || 'all';
    
    // Find all unique categories available in the selected location
    const availableCategories = new Set();
    const categories = window.cachedCategories || [];
    
    categories.forEach(cat => {
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

async function editMenu(id) {
    if (!window.cachedMenuItems || window.cachedMenuItems.length === 0) {
        // Fallback just in case
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
    document.querySelector(`input[name="menu-avail-input"][value="${isAvail}"]`).checked = true;
    
    const locAvail = item.locationAvailability || 'both';
    document.querySelector(`input[name="menu-location-avail"][value="${locAvail}"]`).checked = true;
    
    const dietVal = item.dietaryPreference || 'veg';
    document.querySelector(`input[name="menu-diet"][value="${dietVal}"]`).checked = true;
    document.getElementById('menu-spicy').checked = item.isSpicy || false;
    
    if (item.image) {
        currentBase64Image = item.image;
        const previewDiv = document.getElementById('menu-image-preview');
        previewDiv.innerHTML = `<img src="${item.image}" style="width:100%; height:100%; object-fit:cover;">`;
        previewDiv.style.display = 'block';
        
        document.getElementById('lw-preview-img').src = item.image;
        document.getElementById('lw-preview-img').style.display = 'block';
        document.getElementById('lw-preview-placeholder').style.display = 'none';
    } else {
        const previewDiv = document.getElementById('menu-image-preview');
        previewDiv.innerHTML = '';
        previewDiv.style.display = 'none';
        
        document.getElementById('lw-preview-img').src = '';
        document.getElementById('lw-preview-img').style.display = 'none';
        document.getElementById('lw-preview-placeholder').style.display = 'flex';
    }
    
    updateLivePreview();
    openModal('menu-modal');
}

async function deleteMenu(id) {
    if (await showConfirm('Delete Menu Item', 'Are you sure you want to permanently delete this item?')) {
        await apiCall(`/menu/${id}`, 'DELETE');
        loadMenu();
    }
}

async function toggleMenuStock(id, currentStatus) {
    const isAvail = !currentStatus;
    const action = isAvail ? 'Mark as In Stock?' : 'Mark as Out of Stock?';
    const message = isAvail ? 'This item will be visible to customers again.' : 'This item will be hidden from the customer menu.';
    const btnText = isAvail ? 'Yes, In Stock' : 'Yes, Out of Stock';
    
    if (await showConfirm(action, message, btnText, !isAvail)) {
        await apiCall(`/menu/${id}`, 'PUT', { isAvailable: isAvail });
        loadMenu();
    }
}

// =======================
// CATEGORIES LOGIC
// =======================
window.cachedCategories = [];

async function loadCategories() {
    try {
        const items = await apiCall('/categories');
        window.cachedCategories = items;
        
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
        window.showAdminToast('Weekly Schedule Saved!', "error");
        loadStoreSettings();
    } catch (err) {
        window.showAdminToast('Error saving schedule', "error");
    }
});

async function loadStoreSettings() {
    try {
        const settings = await apiCall('/settings');
        cachedStoreSettings = settings;
        
        settings.forEach(setting => {
            const idPrefix = setting.storeId;
            
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
    } catch (e) { console.error(e); }
}

async function saveStoreSetting(storeId) {
    const autoSchedule = document.getElementById(`${storeId}-auto`).checked;
    const isOnline = document.getElementById(`${storeId}-online`).checked;
    const offlineReason = document.getElementById(`${storeId}-reason`).value;
    
    try {
        await apiCall(`/settings/${storeId}`, 'PUT', { autoSchedule, isOnline, offlineReason });
        window.showAdminToast(`${storeId.toUpperCase(, "error")} settings saved!`);
        loadStoreSettings();
    } catch (e) {
        window.showAdminToast(`Error saving ${storeId} settings`, "error");
    }
}

// Start
init();






// ==========================================
// UNIFIED 4-SUB-TAB CMS MANAGEMENT SYSTEM (V3)
// ==========================================
let adminReelsList = [];
let adminDealsList = [];

// Sub-Tab Switcher
window.switchCmsSubTab = function(subTabId) {
    const tabBtns = document.querySelectorAll('.cms-tab-btn');
    const tabContents = document.querySelectorAll('.cms-tab-content');

    tabBtns.forEach(btn => {
        if (btn.getAttribute('data-subtab') === subTabId) {
            btn.classList.add('active');
            btn.style.background = '#f97316';
            btn.style.color = '#fff';
            btn.style.border = 'none';
        } else {
            btn.classList.remove('active');
            btn.style.background = 'rgba(255,255,255,0.05)';
            btn.style.color = '#aaa';
            btn.style.border = '1px solid rgba(255,255,255,0.1)';
        }
    });

    tabContents.forEach(content => {
        if (content.id === subTabId) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });

    if (subTabId === 'reels-tab') fetchReels();
    if (subTabId === 'announcements-tab') fetchCmsAnnouncements();
    if (subTabId === 'deals-tab') fetchCmsDeals();
    if (subTabId === 'hero-tab') loadHeroCmsSettings();
};

// --- SUB-TAB 1: INSTAGRAM REELS ---
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
    const container = document.getElementById('media-grid-container');
    if (!container) return;

    if (!adminReelsList || adminReelsList.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1;">No Instagram reels added yet. Click "+ Add Instagram Reel" to create one.</div>';
        return;
    }

    container.innerHTML = adminReelsList.map(reel => {
        return `
            <div class="card" style="background:#18181c; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.1); display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <div style="position:relative; aspect-ratio:4/3; width:100%; overflow:hidden; background:#0c0c0e;">
                    <img src="${reel.image || 'images/logo.png'}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.src='images/logo.png'">
                    <span style="position:absolute; top:12px; left:12px; background:${reel.badge === 'Loved' ? '#ec4899' : '#f97316'}; color:#fff; font-size:0.75rem; font-weight:bold; padding:4px 12px; border-radius:20px; box-shadow:0 4px 10px rgba(0,0,0,0.4);">${reel.badge || 'Popular'}</span>
                </div>
                <div style="padding:16px;">
                    <h4 style="font-size:1rem; color:#fff; font-weight:700; margin-bottom:6px;">${reel.title || 'Customer Review'}</h4>
                    <a href="${reel.link}" target="_blank" style="font-size:0.78rem; color:#60a5fa; text-decoration:none; word-break:break-all; display:block; margin-bottom:14px;">🔗 ${reel.link}</a>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-outline" style="flex:1; padding:8px; font-size:0.85rem; border-radius:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; cursor:pointer;" onclick="window.editReel('${reel._id}')">Edit</button>
                        <a href="${reel.image}" download="reel_thumbnail.png" target="_blank" class="btn btn-outline" style="padding:8px 12px; font-size:0.85rem; border-radius:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#4ade80; text-decoration:none; text-align:center;" title="Download Base64 Image">📥</a>
                        <button class="btn btn-danger" style="padding:8px 12px; font-size:0.85rem; border-radius:8px; background:#ef4444; color:#fff; border:none; cursor:pointer;" onclick="window.deleteReel('${reel._id}')">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.openReelModal = function(reel = null) {
    const modal = document.getElementById('reel-modal');
    if (!modal) return;
    
    document.getElementById('reel-modal-title').textContent = reel ? 'Edit Instagram Reel' : 'Add New Instagram Reel';
    document.getElementById('reel-id').value = reel ? reel._id : '';
    document.getElementById('reel-title-input').value = reel ? reel.title : '';
    document.getElementById('reel-badge-input').value = reel ? reel.badge : 'Popular';
    document.getElementById('reel-link-input').value = reel ? reel.link : '';
    document.getElementById('reel-image-input').value = reel ? reel.image : '';
    
    const preview = document.getElementById('reel-image-preview');
    if (reel && reel.image) {
        preview.src = reel.image;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }

    modal.classList.add('active');
    modal.classList.remove('hidden');
};

window.closeReelModal = function() {
    const modal = document.getElementById('reel-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.add('hidden');
    }
};

window.handleReelImageUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('reel-image-input').value = e.target.result;
        const preview = document.getElementById('reel-image-preview');
        preview.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
};

window.editReel = function(id) {
    const reel = adminReelsList.find(r => r._id === id);
    if (reel) window.openReelModal(reel);
};

window.deleteReel = async function(id) {
    if (!confirm('Are you sure you want to delete this Instagram reel?')) return;
    try {
        const res = await fetch(`${API_URL}/reels/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-pin': authPin, 'x-pin': authPin }
        });
        if (res.ok) {
            fetchReels();
        } else {
            window.showAdminToast('Failed to delete reel', "error");
        }
    } catch (err) {
        window.showAdminToast('Error deleting reel', "error");
    }
};

// --- SUB-TAB 2: ANNOUNCEMENTS (WITH HIDE & DELETE BUTTONS) ---
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
                        <img src="${a.image || 'images/logo.png'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='images/logo.png'">
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
                'x-admin-pin': authPin, 'x-pin': authPin
            },
            body: JSON.stringify({ isActive: !currentActive })
        });
        if (res.ok) {
            fetchCmsAnnouncements();
        } else {
            window.showAdminToast('Failed to update announcement status', "error");
        }
    } catch(e) {
        window.showAdminToast('Error updating announcement', "error");
    }
};

window.deleteAnnouncementCms = async function(id) {
    if (!confirm('Are you sure you want to delete this announcement banner?')) return;
    try {
        const res = await fetch(`${API_URL}/announcements/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-pin': authPin, 'x-pin': authPin }
        });
        if (res.ok) {
            fetchCmsAnnouncements();
        } else {
            window.showAdminToast('Failed to delete announcement', "error");
        }
    } catch(e) {
        window.showAdminToast('Error deleting announcement', "error");
    }
};

// --- SUB-TAB 3: CRAZIEST DEALS OF THE HOUR ---
const defaultCraziestDeals = [
    { _id: 'deal-1', name: 'Pet Bhar Combo 💀', note: 'Includes: Red Sauce Pasta (Full) + Masterchef Special Thecha Chowmein (Half)', price: 279, originalPrice: 325, image: 'images/menu/Craziest Deal Menu/pet-bhar-combo.png' },
    { _id: 'deal-2', name: 'Tera Jo Mann Wo Khila De 🥴', note: 'Includes: Veg Manchurian (Full) + Dhokla', price: 209, originalPrice: 228, image: 'images/menu/Craziest Deal Menu/tera-jo-mann-wo-khila-de.png' },
    { _id: 'deal-3', name: 'Kuch Bhi Khila De 😭', note: 'Includes: Mushroom Masala (Half) + Veg Fried Rice (Half)', price: 209, originalPrice: 228, image: 'images/menu/Craziest Deal Menu/kuch-bhi-khila-de.png' }
];

async function fetchCmsDeals() {
    const container = document.getElementById('cms-deals-grid');
    if (!container) return;
    
    adminDealsList = defaultCraziestDeals;

    container.innerHTML = adminDealsList.map(deal => `
        <div class="card" style="background:#18181c; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.1); padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
            <div>
                <img src="${deal.image || 'images/logo.png'}" style="width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:12px; margin-bottom:12px;" onerror="this.src='images/logo.png'">
                <h4 style="color:#fff; font-size:1.1rem; font-weight:700; margin-bottom:6px;">${deal.name}</h4>
                <div style="color:#f97316; font-size:0.85rem; line-height:1.4; margin-bottom:10px;">${deal.note || deal.description}</div>
                <div style="font-weight:bold; color:#4ade80; font-size:1.2rem; margin-bottom:14px;">
                    ₹${deal.price} ${deal.originalPrice ? `<span style="color:#64748b; text-decoration:line-through; font-size:0.9rem; margin-left:6px;">₹${deal.originalPrice}</span>` : ''}
                </div>
            </div>
            <button class="btn btn-primary" style="width:100%; padding:10px; font-weight:bold; border-radius:8px;" onclick="window.openDealModal('${deal._id}')">✏️ Edit Deal Details & Banner</button>
        </div>
    `).join('');
}

window.openDealModal = function(dealId) {
    const deal = adminDealsList.find(d => d._id === dealId);
    if (!deal) return;

    const modal = document.getElementById('deal-modal');
    if (!modal) return;

    document.getElementById('deal-id').value = deal._id;
    document.getElementById('deal-title-input').value = deal.name;
    document.getElementById('deal-note-input').value = deal.note || '';
    document.getElementById('deal-price-input').value = deal.price;
    document.getElementById('deal-origprice-input').value = deal.originalPrice || '';
    document.getElementById('deal-image-input').value = deal.image || '';

    const preview = document.getElementById('deal-image-preview');
    if (preview && deal.image) {
        preview.src = deal.image;
        preview.style.display = 'block';
    }

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

window.handleDealImageUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('deal-image-input').value = e.target.result;
        const preview = document.getElementById('deal-image-preview');
        if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
};

window.saveDealCms = function(event) {
    event.preventDefault();
    const id = document.getElementById('deal-id').value;
    const deal = adminDealsList.find(d => d._id === id);
    if (deal) {
        deal.name = document.getElementById('deal-title-input').value;
        deal.note = document.getElementById('deal-note-input').value;
        deal.price = Number(document.getElementById('deal-price-input').value);
        deal.originalPrice = Number(document.getElementById('deal-origprice-input').value);
        deal.image = document.getElementById('deal-image-input').value;
        
        window.showAdminToast('Deal updated successfully!', "error");
        window.closeDealModal();
        fetchCmsDeals();
    }
};

// --- SUB-TAB 4: HERO & ABOUT US ---
window.handleAboutImageUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('cms-about-img').value = e.target.result;
        const preview = document.getElementById('cms-about-preview');
        if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
};

window.loadHeroCmsSettings = async function() {
    try {
        const res = await fetch(`${API_URL}/settings`);
        const settings = await res.json();
        if (settings && settings.length > 0) {
            const s = settings[0];
            if (s.statNum) document.getElementById('cms-stat-num').value = s.statNum;
            if (s.statText) document.getElementById('cms-stat-text').value = s.statText;
            if (s.aboutHeading) document.getElementById('cms-about-heading').value = s.aboutHeading;
            if (s.aboutStoryTitle) document.getElementById('cms-about-story-title').value = s.aboutStoryTitle;
            if (s.heroTagline) document.getElementById('cms-hero-tagline').value = s.heroTagline;
            if (s.heroTitle) document.getElementById('cms-hero-title').value = s.heroTitle;
            if (s.heroDesc) document.getElementById('cms-hero-desc').value = s.heroDesc;
            if (s.aboutImage) {
                document.getElementById('cms-about-img').value = s.aboutImage;
                const preview = document.getElementById('cms-about-preview');
                if (preview) preview.src = s.aboutImage;
            }
        }
    } catch(e) {}
};

window.saveHeroCms = async function(event) {
    event.preventDefault();
    const payload = {
        statNum: document.getElementById('cms-stat-num')?.value,
        statText: document.getElementById('cms-stat-text')?.value,
        aboutHeading: document.getElementById('cms-about-heading')?.value,
        aboutStoryTitle: document.getElementById('cms-about-story-title')?.value,
        heroTagline: document.getElementById('cms-hero-tagline')?.value,
        heroTitle: document.getElementById('cms-hero-title')?.value,
        heroDesc: document.getElementById('cms-hero-desc')?.value,
        aboutImage: document.getElementById('cms-about-img')?.value
    };

    try {
        const res = await fetch(`${API_URL}/settings/cloud`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': authPin, 'x-pin': authPin
            },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            window.showAdminToast('Hero & About Us Settings saved successfully!', "error");
        } else {
            window.showAdminToast('Failed to save settings. Check Admin PIN.', "error");
        }
    } catch(e) {
        window.showAdminToast('Error saving settings', "error");
    }
};

// Custom Admin Toast Notification (Replaces Browser native alert)
window.showAdminToast = function(message, type = 'success') {
    const container = document.getElementById('admin-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    
    toast.style.cssText = `
        background: ${isSuccess ? '#166534' : '#991b1b'};
        color: #ffffff;
        border: 1px solid ${isSuccess ? '#22c55e' : '#ef4444'};
        padding: 14px 22px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.95rem;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 280px;
        transform: translateY(20px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    toast.innerHTML = `
        <span>${isSuccess ? '✅' : '❌'}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        toast.style.transform = 'translateY(20px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
};
