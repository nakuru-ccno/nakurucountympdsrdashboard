// NOTE: Assuming window.supabase is created in index.html, 
// and the 'Inter' font and style.css are correctly linked.

/* ===========================
    Utility helpers
    =========================== */
const root = document.getElementById("root");
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
export const escapeHtml = (s) => (s === null || s === undefined) ? "" : String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : "";
// Helper for status badge CSS classes
const statusClasses = s => s === 'Pending Review' ? 'status-pending' : (s==='Audit Complete' ? 'status-complete' : (s==='Data Entry' ? 'status-entry' : (s==='Closed' ? 'closed' : 'status-default')));

/* ===========================
    App state
    =========================== */
export const state = {
    // 1. BYPASS AUTH: Set mock user and start on dashboard for development
    user: { id: 'dev-user-id', email: 'dev@nakuru.go.ke' }, 
    view: 'dashboard', 
    filters: { q: '', subcounty: 'All', status: 'All' },
    data: {
      facilities: [],
      cases: [],
      reviews: {},
      recommendations: {},
      users: [],
    },
    modal: { visible: false, mode: 'new', payload: null }
};

/* ===========================
    Supabase API wrappers (using window.supabase)
    =========================== */
const supabase = window.supabase; 

// --- Functions that will mostly be used internally, kept for structure ---
export async function signIn(email, password) { /* Bypassed */ }
export async function signOut() { 
    // This allows the Logout button to function for the mock user
    console.log("Mock user signed out.");
    state.user = null;
    renderMain('<div class="login-page"><p>Logged out. Refresh to restart development session.</p></div>');
}

// --- Facilities ---
export async function fetchFacilities() {
    const { data, error } = await supabase.from('facilities').select('*').eq('is_active', true).order('facility_name');
    if (error) throw error;
    state.data.facilities = data || [];
    return data;
}

// --- Users ---
export async function fetchUserProfile(user_id) {
    // Return mock data for the dev user if the database call fails
    const { data, error } = await supabase.from('mpdsr_users').select('*, facilities(facility_name)').eq('user_id', user_id).single();
    if (error && error.code !== 'PGRST116') { console.error("Error fetching profile:", error); }
    
    return data || { 
        full_name: 'Dev User', 
        user_level: 'County Admin',
        facilities: { facility_name: 'Nakuru County' }
    };
}
export async function fetchAllUsers() {
    const { data, error } = await supabase.from('mpdsr_users').select('*, facilities(facility_name)').order('full_name');
    if (error) throw error;
    state.data.users = data || [];
    return data;
}
export async function updateUser(user_id, payload) {
    const { data, error } = await supabase.from('mpdsr_users').update(payload).eq('user_id', user_id).select().single();
    if (error) throw error;
    return data;
}

// --- Cases ---
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

// --- Reviews ---
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

// --- Recommendations ---
export async function fetchRecommendations(review_id) {
    const { data, error } = await supabase.from('mpdsr_recommendations').select('*').eq('review_id', review_id).order('created_at', { ascending: false });
    if (error) throw error;
    state.data.recommendations[review_id] = data || [];
    return data;
}
export async function createRecommendation(payload) {
    const { data, error } = await supabase.from('mpdsr_recommendations').insert([payload]).select().single();
    if (error) throw error;
    if (!state.data.recommendations[payload.review_id]) state.data.recommendations[payload.review_id] = [];
    state.data.recommendations[payload.review_id].unshift(data);
    return data;
}
export async function updateRecommendation(recommendation_id, payload) {
    const { data, error } = await supabase.from('mpdsr_recommendations').update(payload).eq('recommendation_id', recommendation_id).select().single();
    if (error) throw error;
    for (const rId in state.data.recommendations) {
      const idx = state.data.recommendations[rId].findIndex(x => x.recommendation_id === recommendation_id);
      if (idx >= 0) { state.data.recommendations[rId][idx] = data; break; }
    }
    return data;
}

// --- Dashboard Metrics ---
export async function fetchDashboardMetrics() {
    // 1. Total Case Counts
    const { count: maternalCount, error: err1 } = await supabase
        .from('mpdsr_cases')
        .select('*', { count: 'exact', head: true })
        .eq('case_type', 'Maternal');
    if (err1) console.error("Error fetching maternal count:", err1);

    const { count: perinatalCount, error: err2 } = await supabase
        .from('mpdsr_cases')
        .select('*', { count: 'exact', head: true })
        .eq('case_type', 'Perinatal');
    if (err2) console.error("Error fetching perinatal count:", err2);

    // 2. Review and Recommendation Metrics
    const { count: totalCases, error: err3 } = await supabase
        .from('mpdsr_cases')
        .select('*', { count: 'exact', head: true });

    const { count: reviewedCases, error: err4 } = await supabase
        .from('mpdsr_cases')
        .select('*', { count: 'exact', head: true })
        .eq('is_reviewed', true);
    
    const { count: totalRecs, error: err5 } = await supabase
        .from('mpdsr_recommendations')
        .select('*', { count: 'exact', head: true });

    const { count: closedRecs, error: err6 } = await supabase
        .from('mpdsr_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Closed');
    
    // MOCK DATA for iMMR calculation (Ideally fetched from a 'live_births' table)
    const MOCK_LIVE_BIRTHS = 18000; 

    const metrics = {
        maternalDeaths: maternalCount || 0,
        perinatalDeaths: perinatalCount || 0,
        totalCases: totalCases || 0,
        reviewedCases: reviewedCases || 0,
        totalRecommendations: totalRecs || 0,
        closedRecommendations: closedRecs || 0,
        mockLiveBirths: MOCK_LIVE_BIRTHS, 
    };

    return metrics;
}

/* ===========================
    Authentication handling + init (DISABLED)
    =========================== */

async function initAuth() {
    // BYPASS: Simulate a successful session load for development
    console.warn("Authentication Bypassed for Development.");
    
    // Ensure core data is fetched before rendering the dashboard
    try {
        await fetchFacilities();
    } catch (e) {
        console.error("Failed to fetch initial facilities:", e);
    }
    // Skip calling supabase.auth.onAuthStateChange
    renderRoute();
}

/* ===========================
    Router and views
    =========================== */

export function navigate(view) {
    state.view = view;
    renderRoute();
}

async function renderRoute() {
    // No authentication check needed due to bypass
    
    switch (state.view) {
      case 'dashboard': await renderDashboard(); break;
      case 'cases': await renderCases(); break;
      case 'reports': await renderReports(); break;
      case 'users': await renderUserManagement(); break;
      default: await renderDashboard();
    }
}

/* ===========================
    Core Shell Layout
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
    const navItem = (key, label) => `
      <button data-nav="${key}" class="sidebar-nav-item ${state.view === key ? 'active' : ''}">
        ${label}
      </button>
    `;
    return `
      <div class="sidebar">
        <div class="sidebar-header">
          <h1 class="sidebar-title">MPDSR Nakuru</h1>
        </div>
        <nav class="sidebar-nav">
          ${navItem('dashboard', 'Dashboard')}
          ${navItem('cases', 'Case List')}
          ${navItem('reports', 'Reports')}
          ${navItem('users', 'User Management')}
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
      // Calls the mock signOut function
      await signOut(); 
      // After sign out, the screen will show the logged out message from signOut()
    };
}


/* ===========================
    Login View (REMOVED/IGNORED due to bypass)
    =========================== */
// The renderLogin function is not needed as the app routes directly to the dashboard.
// You can remove or comment out any previously existing renderLogin function.


/* ===========================
    Dashboard View
    =========================== */

async function renderDashboard() {
    const userProfile = await fetchUserProfile(state.user.id);
    const metrics = await fetchDashboardMetrics();

    // 2. Calculate KPIs
    const reviewRate = metrics.totalCases > 0 ? ((metrics.reviewedCases / metrics.totalCases) * 100).toFixed(1) : 0;
    const implementationRate = metrics.totalRecommendations > 0 ? ((metrics.closedRecommendations / metrics.totalRecommendations) * 100).toFixed(1) : 0;
    
    // iMMR: (Maternal Deaths / Live Births) * 100,000
    const iMMR = metrics.mockLiveBirths > 0 ? ((metrics.maternalDeaths / metrics.mockLiveBirths) * 100000).toFixed(0) : 'N/A';
    
    // Helper for Metric Cards
    const metricCard = (title, value, unit = '', color = 'var(--color-primary)') => `
        <div class="card" style="border-left: 5px solid ${color};">
            <p class="card-subtitle text-lg">${title}</p>
            <h3 class="text-4xl font-bold mt-2" style="color: ${color};">${value} <span class="text-lg font-normal">${unit}</span></h3>
        </div>
    `;

    const facilitiesHtml = state.data.facilities.map(f => `
      <div class="card facility-card">
        <h3 class="card-title">${escapeHtml(f.facility_name)}</h3>
        <p class="card-subtitle">${escapeHtml(f.sub_county)} Sub-County</p>
      </div>
    `).join('');

    // 3. Render
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
        <div class="facility-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            ${metricCard('Total Maternal Deaths', metrics.maternalDeaths, 'cases', 'var(--color-danger)')}
            ${metricCard('Total Perinatal Deaths', metrics.perinatalDeaths, 'cases', 'var(--color-danger)')}
            ${metricCard('iMMR', iMMR, '/100k Live Births', 'var(--color-danger)')}
            ${metricCard('Review Completion Rate', reviewRate, '%', reviewRate >= 80 ? 'var(--color-success)' : 'var(--color-primary)')}
            ${metricCard('Action Implementation Rate', implementationRate, '%', implementationRate >= 75 ? 'var(--color-success)' : 'var(--color-primary)')}
        </div>

        <h2 class="section-title">System Status & Summary</h2>
        <div class="facility-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="card">
                <h3 class="card-title">Surveillance Volume</h3>
                <p class="card-subtitle">Total Cases Logged: <strong>${metrics.totalCases}</strong></p>
                <p class="card-subtitle">Total Reviews Conducted: <strong>${metrics.reviewedCases}</strong></p>
            </div>
            <div class="card">
                <h3 class="card-title">Response Activity</h3>
                <p class="card-subtitle">Total Recommendations: <strong>${metrics.totalRecommendations}</strong></p>
                <p class="card-subtitle">Recommendations Closed: <strong>${metrics.closedRecommendations}</strong></p>
            </div>
        </div>

        <h2 class="section-title">Active Facilities</h2>
        <div class="facility-grid">
          ${facilitiesHtml}
        </div>
      </div>
    `);
}


/* ===========================
    Cases View
    =========================== */

async function renderCases() {
    await fetchCases();

    const filtered = applyFilters(state.data.cases, state.filters);

    renderMain(`
      <div class="content-page">
        <div class="page-header flex-spaced">
          <h1 class="page-title">Case List</h1>
          <div class="action-buttons-group">
            <button id="printBtn" class="secondary-btn">Print</button>
            <button id="newCaseBtn" class="primary-btn">New Case</button>
          </div>
        </div>

        <div class="card filter-card">
          <input id="q" class="form-input filter-input" placeholder="Search by ID or Facility" value="${escapeHtml(state.filters.q)}"/>
          <select id="subcountyFilter" class="form-select filter-select">
            <option value="All">All Sub-Counties</option>
            ${state.data.facilities.map(f => `<option value="${escapeHtml(f.sub_county)}" ${state.filters.subcounty === f.sub_county ? 'selected' : ''}>${escapeHtml(f.sub_county)}</option>`).join('')}
          </select>
          <select id="statusFilter" class="form-select filter-select">
            <option value="All">All Statuses</option>
            ${['Data Entry', 'Pending Review', 'Audit Complete', 'Closed'].map(s => `<option value="${s}" ${state.filters.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>

        <div class="card table-container">
          <table class="data-table">
            <thead>
              <tr>
                ${['Case ID','Summary/Facility','Sub-County','Type','Date','Status','Actions'].map(h => `<th class="table-header">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${filtered.map(c => `
                <tr>
                  <td class="table-cell case-id-cell">${escapeHtml(c.case_id)}</td>
                  <td class="table-cell">${escapeHtml(c.case_summary?.slice(0,60) || c.reporting_facility_id || '')}</td>
                  <td class="table-cell">${escapeHtml(c.reporting_subcounty || '')}</td>
                  <td class="table-cell">${escapeHtml(c.case_type)}</td>
                  <td class="table-cell">${fmtDate(c.death_date)}</td>
                  <td class="table-cell"><span class="status-badge ${statusClasses(c.is_reviewed ? 'Audit Complete' : c.status || 'Data Entry')}">${escapeHtml(c.status || (c.is_reviewed ? 'Audit Complete' : 'Data Entry'))}</span></td>
                  <td class="table-cell action-cell"><button data-case="${escapeHtml(c.case_id)}" class="view-case-btn link-btn">View</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `);

    // attach listeners
    $('#q').oninput = () => { state.filters.q = $('#q').value; renderCases(); };
    $('#subcountyFilter').onchange = () => { state.filters.subcounty = $('#subcountyFilter').value; renderCases(); };
    $('#statusFilter').onchange = () => { state.filters.status = $('#statusFilter').value; renderCases(); };
    $('#newCaseBtn').onclick = () => showNewCaseModal();
    $('#printBtn').onclick = () => window.print();

    // view buttons
    $$('.view-case-btn').forEach(b => b.onclick = async () => {
      const caseId = b.getAttribute('data-case');
      await showCaseDetails(caseId);
    });
}

function applyFilters(list, filters) {
    // Note: The reporting_subcounty is assumed to be part of the case data 
    // or resolved from the reporting_facility_id in the database query.
    return (list || []).filter(c => {
      if (filters.subcounty && filters.subcounty !== 'All' && (c.reporting_subcounty || '') !== filters.subcounty) return false;
      if (filters.status && filters.status !== 'All' && (c.status || '') !== filters.status) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        return (c.case_id && c.case_id.toLowerCase().includes(q)) || (c.case_summary && c.case_summary.toLowerCase().includes(q));
      }
      return true;
    });
}


/* ===========================
    Case Modal: view details + reviews + recommendations
    =========================== */

async function showCaseDetails(caseId) {
    const { data: caseData, error } = await supabase.from('mpdsr_cases').select('*').eq('case_id', caseId).single();
    if (error) { alert('Error loading case'); return; }
    await fetchReviews(caseId);
    const reviews = state.data.reviews[caseId] || [];

    // modal HTML setup (Truncated for brevity, assuming the full HTML structure)
    const modalHtml = `
      <div class="modal-overlay">
        <div class="modal-content large-modal">
          <div class="modal-header flex-spaced">
            <h2 class="modal-title">${escapeHtml(caseData.case_id)} — ${escapeHtml(caseData.case_summary?.slice(0,80) || 'Case')}</h2>
            <div class="action-buttons-group">
              <button id="closeModal" class="secondary-btn small-btn">Close</button>
              <button id="editCaseBtn" class="primary-btn small-btn">Edit</button>
              <button id="delCaseBtn" class="danger-btn small-btn">Delete</button>
            </div>
          </div>

          <div class="modal-body case-details-grid">
            <div class="detail-group">
              <p class="detail-label">Reported facility</p>
              <p class="detail-value">${escapeHtml(caseData.reporting_facility_id)}</p>

              <p class="detail-label mt-3">Death date</p>
              <p class="detail-value">${fmtDate(caseData.death_date)}</p>

              <p class="detail-label mt-3">Case summary</p>
              <p class="detail-value text-sm">${escapeHtml(caseData.case_summary || '')}</p>
            </div>

            <div class="detail-group">
              <p class="detail-label">Immediate cause</p>
              <p class="detail-value">${escapeHtml(caseData.immediate_cause || '')}</p>

              <p class="detail-label mt-3">Underlying cause</p>
              <p class="detail-value">${escapeHtml(caseData.underlying_cause || '')}</p>

              <p class="detail-label mt-3">Reviewed?</p>
              <p class="detail-value">${caseData.is_reviewed ? 'Yes' : 'No'}</p>
            </div>
          </div>

          <hr class="divider">

          <div class="modal-body reviews-section">
            <h3 class="section-title-small">Reviews</h3>
            <div id="reviewsList" class="reviews-list">
              ${reviews.map(r => `
                <div class="review-item">
                  <div class="review-header flex-spaced"><div class="review-date">${fmtDate(r.review_date)}</div></div>
                  <div class="review-outcome text-sm mt-2">${escapeHtml(r.review_outcome || r.root_cause_identified || '')}</div>
                  <div class="reviewer-info text-xs mt-2">Reviewer ID: ${escapeHtml(r.reviewer_user_id || 'N/A')}</div>
                  <div class="mt-2"><button data-review="${r.review_id}" class="view-review-btn secondary-btn small-btn">View / Recommendations</button></div>
                </div>
              `).join('')}
            </div>

            <div class="mt-3">
              <button id="addReviewBtn" class="success-btn">Add Review</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.innerHTML = modalHtml;
    document.body.appendChild(overlay);

    // listeners
    $('#closeModal', overlay).onclick = () => overlay.remove();
    $('#editCaseBtn', overlay).onclick = () => {
      overlay.remove();
      showEditCaseForm(caseData);
    };
    $('#delCaseBtn', overlay).onclick = async () => {
      if (!confirm('Are you sure you want to permanently delete this case?')) return;
      try {
        await deleteCase(caseId);
        overlay.remove();
        await fetchCases();
        renderCases();
        alert('Case deleted successfully.');
      } catch (e) {
        alert('Delete failed: ' + e.message);
      }
    };
    $('#addReviewBtn', overlay).onclick = () => {
      overlay.remove();
      showAddReviewForm(caseData.case_id);
    };

    $$('.view-review-btn').forEach(btn => btn.onclick = async () => {
      const reviewId = btn.getAttribute('data-review');
      // Pass the case ID back to allow navigation back to case details if needed
      await showReviewDetails(reviewId, caseData.case_id); 
      overlay.remove();
    });
}

/* ===========================
    Add/Edit Case Forms 
    =========================== */

function showNewCaseModal() {
    const facilityOptions = state.data.facilities.map(f => `<option value="${escapeHtml(f.facility_id)}">${escapeHtml(f.facility_name)}</option>`).join('');
    const html = `
      <div class="modal-overlay">
        <div class="modal-content medium-modal">
          <div class="modal-header flex-spaced">
            <h2 class="modal-title">New MPDSR Case</h2>
            <button id="modalClose" class="close-btn">✕</button>
          </div>
          <form id="caseForm" class="modal-form">
            <div class="form-group">
              <label class="form-label">Reporting Facility</label>
              <select name="reporting_facility_id" required class="form-select">
                ${facilityOptions}
              </select>
              </div>
            <div class="form-group">
              <label class="form-label">Case Type</label>
              <select name="case_type" required class="form-select">
                <option value="Maternal">Maternal</option>
                <option value="Perinatal">Perinatal</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Death Date</label>
              <input name="death_date" type="date" required class="form-input" value="${new Date().toISOString().substring(0,10)}"/>
            </div>
            <div class="form-group">
              <label class="form-label">Case Summary</label>
              <textarea name="case_summary" rows="3" class="form-textarea"></textarea>
            </div>
            <div class="form-actions">
              <button type="button" id="cancelCase" class="secondary-btn">Cancel</button>
              <button type="submit" class="primary-btn">Save Case</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    $('#modalClose', wrap).onclick = () => wrap.remove();
    $('#cancelCase', wrap).onclick = () => wrap.remove();

    $('#caseForm', wrap).onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const payload = {
        reporting_facility_id: fd.get('reporting_facility_id'),
        case_type: fd.get('case_type'),
        death_date: fd.get('death_date'),
        case_summary: fd.get('case_summary'),
        is_reviewed: false,
        status: 'Data Entry',
        created_at: new Date().toISOString()
      };
      try {
        await createCase(payload);
        wrap.remove();
        await fetchCases();
        renderCases();
        alert('Case created successfully.');
      } catch (e) { alert('Case creation failed: ' + e.message); }
    };
}

function showEditCaseForm(caseData) {
    const facilityOptions = state.data.facilities.map(f => `<option value="${escapeHtml(f.facility_id)}" ${f.facility_id===caseData.reporting_facility_id ? 'selected' : ''}>${escapeHtml(f.facility_name)}</option>`).join('');
    const html = `
      <div class="modal-overlay">
        <div class="modal-content medium-modal">
          <div class="modal-header flex-spaced">
            <h2 class="modal-title">Edit Case ${escapeHtml(caseData.case_id)}</h2>
            <button id="closeEdit" class="close-btn">✕</button>
          </div>
          <form id="editCaseForm" class="modal-form">
            <div class="form-group">
              <label class="form-label">Reporting Facility</label>
              <select name="reporting_facility_id" required class="form-select">${facilityOptions}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Case Type</label>
              <select name="case_type" class="form-select">
                <option value="Maternal" ${caseData.case_type==='Maternal'?'selected':''}>Maternal</option>
                <option value="Perinatal" ${caseData.case_type==='Perinatal'?'selected':''}>Perinatal</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Death Date</label>
              <input name="death_date" type="date" class="form-input" value="${caseData.death_date ? caseData.death_date.substring(0,10) : ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Summary</label>
              <textarea name="case_summary" rows="3" class="form-textarea">${escapeHtml(caseData.case_summary || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select name="status" class="form-select">
                ${['Data Entry', 'Pending Review', 'Audit Complete', 'Closed'].map(s => `<option value="${s}" ${caseData.status===s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="form-actions">
              <button type="button" id="cancelEdit" class="secondary-btn">Cancel</button>
              <button type="submit" class="primary-btn">Update</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    $('#closeEdit', wrap).onclick = () => wrap.remove();
    $('#cancelEdit', wrap).onclick = () => wrap.remove();

    $('#editCaseForm', wrap).onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const payload = {
        reporting_facility_id: fd.get('reporting_facility_id'),
        case_type: fd.get('case_type'),
        death_date: fd.get('death_date'),
        case_summary: fd.get('case_summary'),
        status: fd.get('status'), 
        updated_at: new Date().toISOString()
      };
      try {
        await updateCase(caseData.case_id, payload);
        wrap.remove();
        await fetchCases();
        renderCases();
        alert('Case updated successfully.');
      } catch (e) { alert('Update failed: ' + e.message); }
    };
}


/* ===========================
    Review flows 
    =========================== */

function showAddReviewForm(caseId) {
    const html = `
      <div class="modal-overlay">
        <div class="modal-content medium-modal">
          <div class="modal-header flex-spaced">
            <h2 class="modal-title">Add Review</h2>
            <button id="closeReview" class="close-btn">✕</button>
          </div>
          <form id="reviewForm" class="modal-form">
            <div class="form-group">
              <label class="form-label">Review Date</label>
              <input name="review_date" type="date" required class="form-input" value="${new Date().toISOString().substring(0,10)}"/>
            </div>
            <div class="form-group">
              <label class="form-label">Root Cause Identified</label>
              <textarea name="root_cause_identified" rows="3" class="form-textarea"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Review Outcome</label>
              <textarea name="review_outcome" rows="3" class="form-textarea"></textarea>
            </div>
            <div class="form-actions">
              <button type="button" id="cancelReview" class="secondary-btn">Cancel</button>
              <button type="submit" class="success-btn">Save Review</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    $('#closeReview', wrap).onclick = () => wrap.remove();
    $('#cancelReview', wrap).onclick = () => wrap.remove();
    $('#reviewForm', wrap).onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const payload = {
        case_id: caseId,
        review_date: fd.get('review_date'),
        review_team_members: '', 
        root_cause_identified: fd.get('root_cause_identified'),
        review_outcome: fd.get('review_outcome'),
        reviewer_user_id: state.user.id,
        created_at: new Date().toISOString()
      };
      try {
        await createReview(payload);
        // Update the case status
        await updateCase(caseId, { status: 'Audit Complete', is_reviewed: true }); 
        wrap.remove();
        await fetchReviews(caseId);
        alert('Review saved successfully.');
        // Re-open case details to show the new review
        await showCaseDetails(caseId); 
      } catch (e) { alert('Save review failed: ' + e.message); }
    };
}

async function showReviewDetails(reviewId, caseId) {
    const { data, error } = await supabase.from('mpdsr_reviews').select('*').eq('review_id', reviewId).single();
    if (error) { alert('Could not load review'); return; }
    await fetchRecommendations(reviewId);
    const recs = state.data.recommendations[reviewId] || [];

    const html = `
      <div class="modal-overlay">
        <div class="modal-content large-modal">
          <div class="modal-header flex-spaced">
            <h2 class="modal-title">Review Details (${fmtDate(data.review_date)})</h2>
            <div class="action-buttons-group">
                <button id="closeReviewModal" class="secondary-btn small-btn">Close</button>
                <button id="backToCaseBtn" data-case-id="${caseId}" class="secondary-btn small-btn">Back to Case</button>
            </div>
          </div>

          <div class="modal-body review-details-section">
            <div class="detail-group">
              <p class="detail-label">Review Outcome Summary:</p>
              <p class="detail-value text-sm">${escapeHtml(data.review_outcome || '')}</p>
            </div>
            <div class="detail-group mt-4">
              <p class="detail-label">Root Cause Identified:</p>
              <p class="detail-value text-sm">${escapeHtml(data.root_cause_identified || '')}</p>
            </div>

            <hr class="divider">

            <div class="mt-4">
              <h3 class="section-title-small">Recommendations (${recs.length})</h3>
              <div id="recList" class="recommendations-list">
                ${recs.map(r => `
                  <div class="rec-item">
                    <div class="rec-text flex-spaced">
                      <div>${escapeHtml(r.recommendation_text)}</div>
                      <div class="rec-status status-badge ${statusClasses(r.status)}">${escapeHtml(r.status)}</div>
                    </div>
                    <div class="rec-meta text-xs">
                        Target: ${fmtDate(r.target_completion_date)} | Responsible: ${escapeHtml(r.responsible_person_name || 'N/A')}
                        <button data-rec-id="${r.recommendation_id}" class="update-rec-btn link-btn small-btn">Update Status</button>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div class="mt-4">
                <button id="addRecBtn" class="primary-btn">Add Recommendation</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    $('#closeReviewModal', wrap).onclick = () => wrap.remove();
    $('#backToCaseBtn', wrap).onclick = async () => {
        wrap.remove();
        await showCaseDetails(caseId);
    };
    $('#addRecBtn', wrap).onclick = () => {
      wrap.remove();
      showAddRecommendationForm(reviewId, caseId);
    };
    $$('.update-rec-btn', wrap).forEach(btn => btn.onclick = () => {
        const recId = btn.getAttribute('data-rec-id');
        showUpdateRecommendationStatus(recId, reviewId, caseId);
        wrap.remove();
    });
}


/* ===========================
    Recommendations 
    =========================== */

function showAddRecommendationForm(reviewId, caseId) {
    const html = `
      <div class="modal-overlay">
        <div class="modal-content medium-modal">
          <div class="modal-header flex-spaced">
            <h2 class="modal-title">New Recommendation</h2>
            <button id="closeRec" class="close-btn">✕</button>
          </div>
          <form id="recForm" class="modal-form">
            <div class="form-group">
              <label class="form-label">Recommendation Text</label>
              <textarea name="recommendation_text" rows="3" required class="form-textarea"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Responsible Person (name)</label>
              <input name="responsible_person_name" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Target Completion Date</label>
              <input name="target_completion_date" type="date" class="form-input" />
            </div>
            <div class="form-actions">
              <button type="button" id="cancelRec" class="secondary-btn">Cancel</button>
              <button type="submit" class="primary-btn">Save Recommendation</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    $('#closeRec', wrap).onclick = () => wrap.remove();
    $('#cancelRec', wrap).onclick = () => wrap.remove();

    $('#recForm', wrap).onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const payload = {
        review_id: reviewId,
        recommendation_text: fd.get('recommendation_text'),
        responsible_person_name: fd.get('responsible_person_name'),
        target_completion_date: fd.get('target_completion_date') || null,
        status: 'Pending',
        created_by_user_id: state.user.id,
        created_at: new Date().toISOString()
      };
      try {
        await createRecommendation(payload);
        wrap.remove();
        await fetchRecommendations(reviewId);
        alert('Recommendation saved.');
        // Go back to the review details screen
        await showReviewDetails(reviewId, caseId); 
      } catch (e) { alert('Save recommendation failed: ' + e.message); }
    };
}

function showUpdateRecommendationStatus(recId, reviewId, caseId) {
    // Find the current recommendation data
    const recData = state.data.recommendations[reviewId].find(r => r.recommendation_id === recId);
    if (!recData) return;

    const html = `
        <div class="modal-overlay">
            <div class="modal-content medium-modal">
                <div class="modal-header">
                    <h2 class="modal-title">Update Recommendation Status</h2>
                    <button id="closeStatusModal" class="close-btn">✕</button>
                </div>
                <form id="statusForm" class="modal-form">
                    <div class="form-group">
                        <label class="form-label">Recommendation</label>
                        <p class="detail-value text-sm">${escapeHtml(recData.recommendation_text)}</p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Current Status: <strong>${escapeHtml(recData.status)}</strong></label>
                        <select name="status" class="form-select" required>
                            <option value="Pending" ${recData.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="In Progress" ${recData.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Closed" ${recData.status === 'Closed' ? 'selected' : ''}>Closed (Implemented)</option>
                            <option value="Overdue" ${recData.status === 'Overdue' ? 'selected' : ''}>Overdue</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" id="cancelStatus" class="secondary-btn">Cancel</button>
                        <button type="submit" class="primary-btn">Save Status</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    $('#closeStatusModal', wrap).onclick = () => wrap.remove();
    $('#cancelStatus', wrap).onclick = () => wrap.remove();

    $('#statusForm', wrap).onsubmit = async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const newStatus = fd.get('status');
        
        try {
            await updateRecommendation(recId, { status: newStatus, updated_at: new Date().toISOString() });
            wrap.remove();
            await fetchRecommendations(reviewId);
            alert('Recommendation status updated.');
            // Go back to the review details screen
            await showReviewDetails(reviewId, caseId); 
        } catch (e) { 
            alert('Status update failed: ' + e.message); 
        }
    };
}


/* ===========================
    Reports View (placeholder)
    =========================== */

async function renderReports() {
    renderMain(`
      <div class="content-page">
        <h1 class="page-title mb-6">Reports & Analytics</h1>
        <div class="card report-info-card">
          <h3 class="card-title">MPDSR Reporting Summary</h3>
          <p class="text-lg text-gray-600 mt-2">
            This section will contain **Weekly Trend Charts**, **Recommendation Completion Rate**
            visualizations, and the **Downloadable Reports** (PDF/CSV) as outlined.
          </p>
          <div class="mt-4">
            <button class="secondary-btn">Download Weekly PDF</button>
            <button class="secondary-btn">Export Raw Data (CSV)</button>
          </div>
        </div>

        <h2 class="section-title">Case Volume Trend (Placeholder)</h2>
        <div class="chart-container">
            <p class="text-center text-gray-500 mt-4">Chart implementation using Chart.js or similar will go here.</p>
        </div>
      </div>
    `);
}

/* ===========================
    User Management View
    =========================== */

async function renderUserManagement() {
  await fetchAllUsers();

  const userListHtml = (state.data.users || []).map(u => `
    <tr>
      <td class="table-cell font-medium">${escapeHtml(u.full_name || 'N/A')}</td>
      <td class="table-cell">${escapeHtml(u.email)}</td>
      <td class="table-cell">${escapeHtml(u.user_level)}</td>
      <td class="table-cell">${escapeHtml(u.facilities?.facility_name || 'County')}</td>
      <td class="table-cell action-cell">
        <button data-user="${u.user_id}" class="link-btn small-btn">Edit</button>
      </td>
    </tr>
  `).join('');
  
  renderMain(`
    <div class="content-page">
      <div class="page-header flex-spaced">
        <h1 class="page-title">User Management</h1>
        <button id="newUserBtn" class="primary-btn">Add User (TBA)</button>
      </div>
      
      <div class="card table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${['Name', 'Email', 'Role', 'Facility', 'Actions'].map(h => `<th class="table-header">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${userListHtml}
          </tbody>
        </table>
      </div>
    </div>
  `);
  
  // NOTE: User editing modal logic would be attached here if implemented.
  $('#newUserBtn').onclick = () => alert("User creation function requires Supabase Admin integration (RLS/Functions) and is placeholder for now.");
}

// Kick off the application
initAuth();
