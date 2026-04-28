const API_URL = 'http://localhost:5000/api';
let currentUser = null;
let token = localStorage.getItem('token');

// Elements
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegister = document.getElementById('showRegister');
const showLogin = document.getElementById('showLogin');

// Init
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        loadUser();
    }
    setupEventListeners();
});

function setupEventListeners() {
    // Auth Toggles
    showRegister.onclick = (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        document.getElementById('authSubtitle').textContent = 'Create a new account';
    };

    showLogin.onclick = (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        document.getElementById('authSubtitle').textContent = 'Sign in to manage your subscriptions';
    };

    // Auth Actions
    document.getElementById('loginBtn').onclick = login;
    document.getElementById('registerBtn').onclick = register;
    document.getElementById('logoutBtn').onclick = logout;

    // Nav Toggles
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            showView(view);
            
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        };
    });

    // Payment Actions
    document.getElementById('payNowBtn').onclick = initiatePayment;
}

// Auth Functions
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            token = data.token;
            localStorage.setItem('token', token);
            loadUser();
        } else {
            alert(data.message);
        }
    } catch (err) {
        console.error(err);
    }
}

async function register() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const phoneNumber = document.getElementById('regPhone').value;
    const password = document.getElementById('regPassword').value;

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phoneNumber, password })
        });
        const data = await res.json();
        if (res.ok) {
            token = data.token;
            localStorage.setItem('token', token);
            loadUser();
        } else {
            alert(data.message);
        }
    } catch (err) {
        console.error(err);
    }
}

function logout() {
    localStorage.removeItem('token');
    token = null;
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
}

async function loadUser() {
    try {
        const res = await fetch(`${API_URL}/auth/me`, { // Wait, I didn't create /api/auth/me yet, need to add it
            headers: { 'x-auth-token': token }
        });
        // Correcting to a dummy check if not available yet but I'll implement it
        // For now, let's assume it works or I'll go fix the backend
        if (res.ok) {
            currentUser = await res.json();
            updateUI();
            authSection.classList.add('hidden');
            appSection.classList.remove('hidden');
        } else {
            logout();
        }
    } catch (err) {
        logout();
    }
}

// UI Functions
function updateUI() {
    document.getElementById('userNameDisplay').textContent = currentUser.name;
    document.getElementById('userRoleDisplay').textContent = currentUser.role.toUpperCase();

    // Show/Hide Admin menus
    document.querySelectorAll('.admin-only').forEach(el => {
        if (currentUser.role === 'admin') el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    // Update Subscription Card
    const statusBadge = document.getElementById('subStatusBadge');
    const expiry = currentUser.subscriptionExpiry ? new Date(currentUser.subscriptionExpiry) : null;
    const now = new Date();

    if (expiry && expiry > now) {
        statusBadge.textContent = 'Active';
        statusBadge.className = 'badge badge-success';
        const diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        document.getElementById('subDaysLeft').textContent = `${diff} Days Left`;
        document.getElementById('subExpiryDate').textContent = `Expires on ${expiry.toLocaleDateString()}`;
    } else {
        statusBadge.textContent = 'Expired';
        statusBadge.className = 'badge badge-danger';
        document.getElementById('subDaysLeft').textContent = `0 Days`;
        document.getElementById('subExpiryDate').textContent = `Expired or No Subscription`;
    }

    // Default view
    showView('overview');
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`${viewId}View`).classList.remove('hidden');
    document.getElementById('viewTitle').textContent = viewId.charAt(0).toUpperCase() + viewId.slice(1);

    if (viewId === 'adminUsers') loadUsers();
    if (viewId === 'adminPayments') loadPayments();
    if (viewId === 'bots') loadBots();
}

async function loadUsers() {
    const res = await fetch(`${API_URL}/admin/users`, { headers: { 'x-auth-token': token } });
    if (res.ok) {
        const users = await res.json();
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';
        users.forEach(u => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.phoneNumber}</td>
                <td>${u.subscriptionExpiry ? new Date(u.subscriptionExpiry).toLocaleDateString() : 'None'}</td>
                <td>
                    <button onclick="extendSubscription('${u._id}')" class="btn btn-primary" style="padding: 4px 12px; font-size: 12px; width: auto;">Extend</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
}

async function loadPayments() {
    const res = await fetch(`${API_URL}/admin/payments`, { headers: { 'x-auth-token': token } });
    if (res.ok) {
        const payments = await res.json();
        const tbody = document.querySelector('#paymentsTable tbody');
        tbody.innerHTML = '';
        payments.forEach(p => {
            row = document.createElement('tr');
            row.innerHTML = `
                <td>${p.userId?.name || 'Unknown'}</td>
                <td>KES ${p.amount}</td>
                <td>${p.mpesaReceiptNumber || 'N/A'}</td>
                <td><span class="badge badge-${p.status === 'completed' ? 'success' : 'danger'}">${p.status}</span></td>
                <td>${new Date(p.createdAt).toLocaleString()}</td>
            `;
            tbody.appendChild(row);
        });
    }
}

async function loadBots() {
    const res = await fetch(`${API_URL}/admin/bots`);
    if (res.ok) {
        const bots = await res.json();
        const container = document.getElementById('botsContainer');
        container.innerHTML = '';
        bots.forEach(b => {
            container.innerHTML += `
                <div class="bot-card">
                    <div class="bot-icon">${b.name.charAt(0)}</div>
                    <div class="bot-name">${b.name}</div>
                    <div class="bot-desc">${b.description}</div>
                    <a href="${b.downloadUrl}" class="btn btn-primary" style="text-decoration: none; display: block; text-align: center;">Download v${b.version}</a>
                </div>
            `;
        });
    }
}

async function initiatePayment() {
    const phone = document.getElementById('payPhone').value;
    const status = document.getElementById('payStatus');
    
    // We need a package ID, let's fetch first package for now or assume one exists
    const pkgsRes = await fetch(`${API_URL}/admin/packages`);
    const pkgs = await pkgsRes.json();
    if (!pkgs || pkgs.length === 0) return alert('No payment packages configured by Admin.');

    status.textContent = 'Initiating STK Push... Check your phone.';
    status.className = '';

    try {
        const res = await fetch(`${API_URL}/payment/stkpush`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify({ packageId: pkgs[0]._id, phoneNumber: phone })
        });
        if (res.ok) {
            status.textContent = 'Request sent. Once paid, refresh to see changes.';
            status.className = 'text-success';
        } else {
            status.textContent = 'Error initiating payment.';
            status.className = 'text-danger';
        }
    } catch (err) {
        status.textContent = 'Network error.';
    }
}
