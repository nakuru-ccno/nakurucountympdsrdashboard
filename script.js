// script.js (Complete SPA with Supabase Auth)

// Import Supabase Client
import { supabase } from "./supabase.js";

// Import renderSignUp for seamless routing
import { renderSignUp } from "./signup.js";  // adjust relative path as needed

/* ===========================
    Utility helpers and Globals
   =========================== */
const root = document.getElementById("root");
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
export const escapeHtml = (s) => (s === null || s === undefined) ? "" : String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : "";
const statusClasses = s => s === 'Pending Review' ? 'status-pending' : (s==='Audit Complete' ? 'status-complete' : (s==='Data Entry' ? 'status-entry' : (s==='Closed' ? 'closed' : 'status-default')));

/* ===========================
    Supabase API wrappers and State
   =========================== */
export const state = {
    user: null,
    view: 'login',
    filters: { q: '', subcounty: 'All', status: 'All' },
    data: {
      facilities: [],
      cases: [],
      reviews: {},
      recommendations: {},
      users: [],
      profile: null,
    },
    modal: { visible: false, mode: 'new', payload: null }
};

/* ===========================
    Supabase API wrappers (All CRUD/Fetch Logic)
   =========================== */

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Sign out error:", error);
    state.user = null;
    state.data.profile = null;
    navigate('login');
}

export async function fetchFacilities() {
    const { data, error } = await supabase.from('facilities').select('*').eq('is_active', true).order('facility_name');
    if (error) throw error;
    state.data.facilities = data || [];
    return data;
}

export async function fetchUserProfile(user_id) {
    const { data, error } = await supabase.from('mpdsr_users').select('*, facilities(facility_name)').eq('user_id', user_id).single();
    if (error) console.error("Error fetching profile:", error);
    // fallback profile if missing
    return data || { full_name: 'New User', user_level: 'Data Entry', facilities: { facility_name: 'N/A' } };
}

export async function fetchAllUsers() {
    const { data, error } = await supabase.from('mpdsr_users').select('*, facilities(facility_name)').order('full_name');
    if (error) throw error;
    state.data.users = data || [];
    return data;
}

export async function fetchCases() {
    const { data, error } = await supabase.from('mpdsr_cases').select('*').order('death_date', { ascending: false });
    if (error) throw error;
    state.data.cases = data || [];
    return data;
}

export async function createCase(payload) {
    const { data, error } = await supabase.from('mpdsr_cases').insert([payload]).select().single();
    if (error) throw error;
    state.data.cases.unshift(data);
    return data;
}

export async function updateCase(case_id, payload) {
    const { data, error } = await supabase.from('mpdsr_cases').update(payload).eq('case_id', case_id).select().single();
    if (error) throw error;
    const idx = state.data.cases.findIndex(c => c.case_id === case_id);
    if (idx >= 0) state.data.cases[idx] = data;
    return data;
}

export async function deleteCase(case_id) {
    const { error } = await supabase.from('mpdsr_cases').delete().eq('case_id', case_id);
    if (error) throw error;
    state.data.cases = state.data.cases.filter(c => c.case_id !== case_id);
    return true;
}

export async function fetchReviews(case_id) {
    const { data, error } = await supabase.from('mpdsr_reviews').select('*').eq('case_id', case_id).order('review_date', { ascending: false });
    if (error) throw error;
    state.data.reviews[case_id] = data || [];
    return data;
}

export async function createReview(payload) {
    const { data, error } = await supabase.from('mpdsr_reviews').insert([payload]).select().single();
    if (error) throw error;
    if (!state.data.reviews[payload.case_id]) state.data.reviews[payload.case_id] = [];
    state.data.reviews[payload.case_id].unshift(data);
    return data;
}

export async function fetchRecommendations(review_id) {
    const { data, error } = await supabase.from('mpdsr_recommendations').select('*').eq('review_id', review_id).order('created_at', { ascending: false });
    if (error) throw error;
    state.data.recommendations[review_id] = data || [];
    return data;
}

export async function updateRecommendation(recommendation_id, payload) {
    const { data, error } = await supabase.from('mpdsr_recommendations').update(payload).eq('recommendation_id', recommendation_id).select().single();
    if (error) throw error;
    for (const rId in state.data.recommendations) {
        const idx = state.data.recommendations[rId].findIndex(x => x.recommendation_id === recommendation_id);
        if (idx >= 0) {
            state.data.recommendations[rId][idx] = data;
            break;
        }
    }
    return data;
}

export async function fetchDashboardMetrics() {
    const MOCK_LIVE_BIRTHS = 18000;
    const { count: maternalCount } = await supabase.from('mpdsr_cases').select('*', { count: 'exact', head: true }).eq('case_type', 'Maternal');
    const { count: perinatalCount } = await supabase.from('mpdsr_cases').select('*', { count: 'exact', head: true }).eq('case_type', 'Perinatal');
    const { count: totalCases } = await supabase.from('mpdsr_cases').select('*', { count: 'exact', head: true });
    const { count: reviewedCases } = await supabase.from('mpdsr_cases').select('*', { count: 'exact', head: true }).eq('is_reviewed', true);
    const { count: totalRecs } = await supabase.from('mpdsr_recommendations').select('*', { count: 'exact', head: true });
    const { count: closedRecs } = await supabase.from('mpdsr_recommendations').select('*', { count: 'exact', head: true }).eq('status', 'Closed');
    return {
        maternalDeaths: maternalCount || 0,
        perinatalDeaths: perinatalCount || 0,
        totalCases: totalCases || 0,
        reviewedCases: reviewedCases || 0,
        totalRecommendations: totalRecs || 0,
        closedRecommendations: closedRecs || 0,
        mockLiveBirths: MOCK_LIVE_BIRTHS,
    };
}

/* ===========================
    Authentication handling + init
   =========================== */

async function initAuth() {
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            state.user = session.user;
            try {
                state.data.profile = await fetchUserProfile(state.user.id);
                await fetchFacilities();
            } catch (e) {
                console.error("Failed to fetch initial data for user:", e);
            }
            navigate('dashboard');
        } else {
            state.user = null;
            state.data.profile = null;
            navigate('login');
        }
    });
}

/* ===========================
    Router and views (SPA Core)
   =========================== */

export function navigate(view) {
    state.view = view;
    renderRoute();
}

async function renderRoute() {
    const isLoggedIn = !!state.user;

    if (!isLoggedIn) {
        if (state.view === 'signup') {
            renderSignUp();
        } else {
            renderLogin();
        }
        return;
    }

    switch (state.view) {
        case 'dashboard': await renderDashboard(); break;
        case 'cases': await renderCases(); break;
        case 'reports': await renderReports(); break;
        case 'users': await renderUserManagement(); break;
        case 'login':
        case 'signup':
        default:
            navigate('dashboard');
    }
}

/* ===========================
    Core Shell Layout (Sidebar)
   =========================== */

export function renderMain(html) {
    const showSidebar = !!state.user;
    const sidebar = showSidebar ? renderSidebar() : '';

    const containerClass = showSidebar ? 'app-container has-sidebar' : 'app-container no-sidebar';
    const mainClass = 'main-content';

    root.innerHTML = `
      <div class="${containerClass}">
        ${sidebar} 
        <main class="${mainClass}">
          ${html}
        </main>
      </div>
    `;

    if (showSidebar) {
        attachShellListeners();
    }
}

function renderSidebar() {
    const userEmail = state.user?.email || '';
    const userLevel = state.data.profile?.user_level || 'Data Entry';

    const tabs = [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'cases', label: 'Case List' },
        { key: 'reports', label: 'Reports' },
        { key: 'users', label: 'User Management', restricted: true }
    ];

    const navItems = tabs
        .filter(tab => !tab.restricted || userLevel === 'County Admin')
        .map(tab => `
            <button data-nav="${tab.key}" class="sidebar-nav-item ${state.view === tab.key ? 'active' : ''}">
              ${tab.label}
            </button>
        `).join('');

    return `
      <div class="sidebar">
        <div class="sidebar-header">
          <h1 class="sidebar-title">MPDSR Nakuru</h1>
        </div>
        <nav class="sidebar-nav">
          ${navItems}
        </nav>
        <div class="sidebar-footer">
          <div class="user-email">${escapeHtml(userEmail)}</div>
          <button id="logoutBtn" class="logout-btn">
            Logout
          </button>
        </div>
      </div>
    `;
}

function attachShellListeners() {
    $$('[data-nav]').forEach(b => b.onclick = () => {
        const nav = b.getAttribute('data-nav');
        navigate(nav);
    });
    $('#logoutBtn').onclick = async () => {
        await signOut();
    };
}

/* ===========================
    Login View 
   =========================== */

export const renderLogin = (errorMessage = '') => {
    renderMain(`
        <div class="h-full flex items-center justify-center bg-gray-100">
            <div class="bg-white p-6 rounded-xl shadow-md w-full max-w-md login-card">
                <h1 class="text-2xl font-bold text-center mb-4 login-title">MPDSR Login</h1>

                <input id="email" type="email" placeholder="Email"
                    class="w-full p-3 mb-3 border rounded form-input" />
                    
                <input id="password" type="password" placeholder="Password"
                    class="w-full p-3 mb-4 border rounded form-input" />
                    
                <button id="loginBtn"
                    class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 primary-btn">Log In</button>

                <p id="error" class="text-red-500 text-center mt-3">${escapeHtml(errorMessage)}</p>
                
                <p class="text-center text-sm mt-4">
                    Don't have an account? 
                    <button id="goToSignup" class="text-blue-600 hover:underline font-medium link-btn">Sign Up</button>
                </p>
            </div>
        </div>
    `);

    $('#goToSignup').onclick = () => { navigate('signup'); };

    $('#loginBtn').onclick = async () => {
        const email = $('#email').value.trim();
        const password = $('#password').value.trim();
        try {
            await signIn(email, password);
        } catch (err) {
            renderLogin(err.message || String(err));
        }
    };
};

/* ===========================
    Signup View Placeholder
   =========================== */

export function renderSignUp() {
    renderMain(`
        <div class="h-full flex items-center justify-center bg-gray-100">
            <div class="bg-white p-6 rounded-xl shadow-md w-full max-w-md signup-card">
                <h1 class="text-2xl font-bold text-center mb-4">Sign Up (TBA)</h1>
                <p class="text-center">Signup flow will be implemented here.</p>
                <p class="text-center mt-6">
                    <button id="backToLogin" class="text-blue-600 hover:underline link-btn">Back to Login</button>
                </p>
            </div>
        </div>
    `);

    $('#backToLogin').onclick = () => navigate('login');
}

/* ===========================
    Dashboard View 
   =========================== */

async function renderDashboard() {
    const userProfile = state.data.profile;
    const metrics = await fetchDashboardMetrics();

    const reviewRate = metrics.totalCases > 0 ? ((metrics.reviewedCases / metrics.totalCases) * 100).toFixed(1) : 0;
    const implementationRate = metrics.totalRecommendations > 0 ? ((metrics.closedRecommendations / metrics.totalRecommendations) * 100).toFixed(1) : 0;
    const iMMR = metrics.mockLiveBirths > 0 ? ((metrics.maternalDeaths / metrics.mockLiveBirths) * 100000).toFixed(0) : 'N/A';

    renderMain(`
      <div class="content-page">
        <div class="page-header">
          <h1 class="page-title">Dashboard Overview</h1>
        </div>
        <div class="card welcome-card">
          <h2 class="card-title">Welcome, ${escapeHtml(userProfile?.full_name || state.user.email)}</h2>
          <p class="detail-item"><strong>Role:</strong> <span class="role-badge">${escapeHtml(userProfile?.user_level || '—')}</span></p>
          <p class="detail-item"><strong>Facility:</strong> ${escapeHtml(userProfile?.facilities?.facility_name || 'County/Subcounty')}</p>
        </div>
        <h2 class="section-title">Key MPDSR Performance Indicators</h2>
        <div class="facility-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div class="card">
              <h3>Maternal Deaths</h3>
              <p class="large-number">${metrics.maternalDeaths}</p>
            </div>
            <div class="card">
              <h3>iMMR (per 100,000 live births)</h3>
              <p class="large-number">${iMMR}</p>
            </div>
            <div class="card">
              <h3>Review Rate (%)</h3>
              <p class="large-number">${reviewRate}</p>
            </div>
            <div class="card">
              <h3>Implementation Rate (%)</h3>
              <p class="large-number">${implementationRate}</p>
            </div>
        </div>
        <h2 class="section-title">Active Facilities</h2>
        <div class="facility-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          ${state.data.facilities.map(f => `<div class="card facility-card">${escapeHtml(f.facility_name)}</div>`).join('')}
        </div>
      </div>
    `);
}

/* ===========================
    Cases View
   =========================== */

async function renderCases() {
    await fetchCases();
    const filtered = (state.data.cases || []).filter(c => true); // simple filter placeholder

    renderMain(`
      <div class="content-page">
        <div class="page-header flex-spaced">
          <h1 class="page-title">Case List</h1>
          <div class="action-buttons-group">
            <button id="newCaseBtn" class="primary-btn">New Case</button>
          </div>
        </div>
        <div class="card table-container">
          <table class="data-table">
            <thead><tr><th>Case ID</th><th>Summary</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${filtered.map(c => `
                <tr>
                  <td>${escapeHtml(c.case_id)}</td>
                  <td>${escapeHtml((c.case_summary || '').slice(0, 40))}</td>
                  <td><span class="status-badge ${statusClasses(c.status || 'Data Entry')}">${escapeHtml(c.status || 'Data Entry')}</span></td>
                  <td class="action-cell"><button data-case="${escapeHtml(c.case_id)}" class="view-case-btn link-btn">View</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `);

    $('#newCaseBtn').onclick = () => showNewCaseModal();
    $$('.view-case-btn').forEach(b => b.onclick = async () => {
        const caseId = b.getAttribute('data-case');
        await showCaseDetails(caseId);
    });
}

/* ===========================
    Reports View (Placeholder)
   =========================== */

async function renderReports() {
    renderMain(`
      <div class="content-page">
        <h1 class="page-title mb-6">Reports & Analytics</h1>
        <p>Reports feature coming soon.</p>
      </div>
    `);
}

/* ===========================
    User Management View
   =========================== */

async function renderUserManagement() {
    await fetchAllUsers();

    renderMain(`
      <div class="content-page">
        <h1 class="page-title mb-6">User Management</h1>
        <table class="data-table full-width">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Facility</th>
            </tr>
          </thead>
          <tbody>
            ${state.data.users.map(u => `
              <tr>
                <td>${escapeHtml(u.full_name)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${escapeHtml(u.user_level)}</td>
                <td>${escapeHtml(u.facilities?.facility_name || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `);
}

/* ===========================
    Modal / Case Details (Basic placeholders)
   =========================== */

function showNewCaseModal() {
    alert("New Case modal placeholder - implement your form here.");
}

async function showCaseDetails(caseId) {
    alert(`Case Details modal placeholder for Case ID: ${caseId}`);
}

/* ===========================
    Kickoff Application
   =========================== */

initAuth();

