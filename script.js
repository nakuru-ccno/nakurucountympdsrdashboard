import { supabase } from "./supabase.js";
import { renderSignUp } from "./signup.js"; // Import the signup view

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
// Status classes are now standard CSS classes defined in style.css
const statusClasses = s => s === 'Pending Review' ? 'status-pending' : (s==='Audit Complete' ? 'status-complete' : (s==='Data Entry' ? 'status-entry' : 'status-default'));
const noop = () => {};

/* ===========================
   App state (unchanged)
   =========================== */
export const state = {
  user: null,
  view: 'login', // login | dashboard | cases | reports | users | signup
  filters: { q: '', subcounty: 'All', status: 'All' },
  data: {
    facilities: [],
    cases: [],
    reviews: {},
    recommendations: {}
  },
  modal: { visible: false, mode: 'new', payload: null }
};

/* ===========================
   Supabase API wrappers (unchanged)
   =========================== */

export async function signIn(email, password) {
  const resp = await supabase.auth.signInWithPassword({ email, password });
  if (resp.error) throw resp.error;
  return resp.data;
}
export async function signOut() {
  await supabase.auth.signOut();
  state.user = null;
}
export async function fetchFacilities() {
  const { data, error } = await supabase.from('facilities').select('*').eq('is_active', true).order('facility_name');
  if (error) throw error;
  state.data.facilities = data || [];
  return data;
}
// ... (rest of API functions remain here, they are just omitted for brevity)
export async function fetchUserProfile(user_id) {
  const { data, error } = await supabase.from('mpdsr_users').select('*, facilities(facility_name)').eq('user_id', user_id).single();
  if (error && error.code !== 'PGRST116') { console.error(error); }
  return data || null;
}
export async function fetchAllUsers() {
  const { data, error } = await supabase.from('mpdsr_users').select('*, facilities(facility_name)').order('full_name');
  if (error) throw error;
  return data || [];
}
export async function updateUser(user_id, payload) {
  const { data, error } = await supabase.from('mpdsr_users').update(payload).eq('user_id', user_id).select().single();
  if (error) throw error;
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

/* ===========================
   Authentication handling + init (unchanged)
   =========================== */

async function initAuth() {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    state.user = data.session.user;
  } else {
    state.user = null;
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null;
    renderRoute();
  });
}

/* ===========================
   Router and views (unchanged)
   =========================== */

export function navigate(view) {
  state.view = view;
  renderRoute();
}

async function renderRoute() {
  // Enforce authentication for all main views
  if (!state.user && state.view !== 'login' && state.view !== 'signup') { 
    renderLogin();
    return;
  }

  switch (state.view) {
    case 'login': renderLogin(); break;
    case 'signup': renderSignUp(); break;
    case 'dashboard': await renderDashboard(); break;
    case 'cases': await renderCases(); break;
    case 'reports': await renderReports(); break;
    case 'users': await renderUserManagement(); break;
    default: await renderDashboard();
  }
}

/* ===========================
   Core Shell Layout - Converted to Standard CSS
   =========================== */

export function renderMain(html) {
  // We need to manage classes that define the flex container and screen size.
  const showSidebar = !!state.user;
  const sidebar = showSidebar ? renderSidebar() : '';

  // Standard classes for layout
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
  // Updated nav styles for better hover/active look
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
  // nav
  $$('[data-nav]').forEach(b => b.onclick = () => {
    const nav = b.getAttribute('data-nav');
    navigate(nav);
  });
  // logout
  $('#logoutBtn').onclick = async () => {
    await supabase.auth.signOut();
    state.user = null;
    navigate('login');
  };
}


/* ===========================
   Login View - Converted to Standard CSS
   =========================== */
const renderLogin = (errorMessage = '') => { 
  renderMain(`
    <div class="login-page">
      <div class="login-card">
        <h1 class="login-title">Welcome Back</h1>
        <p class="login-subtitle">Sign in to access the MPDSR dashboard.</p>

        <input id="email" type="email" placeholder="Email Address"
          class="form-input" />

        <input id="password" type="password" placeholder="Password (min 6 characters)"
          class="form-input" />

        <button id="loginBtn" class="primary-btn full-width">Login</button>

        <p id="error" class="error-message">${escapeHtml(errorMessage)}</p>
        
        <p class="signup-link-text">
            Don't have an account? 
            <button id="goToSignUp" class="link-btn">Create Account</button>
        </p>
      </div>
    </div>
  `);

  $('#loginBtn').onclick = async () => {
    const email = $('#email').value.trim();
    const password = $('#password').value.trim();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { renderLogin(error.message); return; }

      try {
        await supabase.from('mpdsr_users').update({ last_login: new Date().toISOString() }).eq('user_id', data.user.id);
      } catch(e){ /* ignore */ }

      state.user = data.user;
      await fetchFacilities();
      navigate('dashboard');
    } catch (err) {
      renderLogin(err.message || String(err));
    }
  };
    
  $('#goToSignUp').onclick = () => {
    navigate('signup');
  };
}


/* ===========================
   Dashboard View - Converted to Standard CSS
   =========================== */

async function renderDashboard() {
  // ensure facilities loaded
  if (!state.data.facilities.length) await fetchFacilities();
  const userProfile = await fetchUserProfile(state.user.id);

  const facilitiesHtml = state.data.facilities.map(f => `
    <div class="card facility-card">
      <h3 class="card-title">${escapeHtml(f.facility_name)}</h3>
      <p class="card-subtitle">${escapeHtml(f.sub_county)} Sub-County</p>
    </div>
  `).join('');

  renderMain(`
    <div class="dashboard-page">
      <div class="page-header">
        <h1 class="page-title">Dashboard Overview</h1>
      </div>

      <div class="card welcome-card">
        <h2 class="card-title">Welcome, ${escapeHtml(userProfile?.full_name || state.user.email)}</h2>
        <p class="detail-item"><strong>Role:</strong> <span class="role-badge">${escapeHtml(userProfile?.user_level || '—')}</span></p>
        <p class="detail-item"><strong>Facility:</strong> ${escapeHtml(userProfile?.facilities?.facility_name || 'County/Subcounty')}</p>
      </div>

      <h2 class="section-title">Active Facilities</h2>
      <div class="facility-grid">
        ${facilitiesHtml}
      </div>
    </div>
  `);
}


/* ===========================
   Cases View (list, filters, add, view/edit) - Converted to Standard CSS
   =========================== */

async function renderCases() {
  await fetchFacilities();
  await fetchCases();

  const filtered = applyFilters(state.data.cases, state.filters);

  renderMain(`
    <div class="cases-page">
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
          ${state.data.facilities.map(f => `<option value="${escapeHtml(f.sub_county)}">${escapeHtml(f.sub_county)}</option>`).join('')}
        </select>
        <select id="statusFilter" class="form-select filter-select">
          <option value="All">All Statuses</option>
          <option value="Data Entry">Data Entry</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Audit Complete">Audit Complete</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      <div class="card table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${['Case ID','Facility','Sub-County','Type','Date','Status','Actions'].map(h => `<th class="table-header">${h}</th>`).join('')}
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
  $('#q').oninput = (e) => { state.filters.q = e.target.value; renderCases(); };
  $('#subcountyFilter').onchange = (e) => { state.filters.subcounty = e.target.value; renderCases(); };
  $('#statusFilter').onchange = (e) => { state.filters.status = e.target.value; renderCases(); };
  $('#newCaseBtn').onclick = () => showNewCaseModal();
  $('#printBtn').onclick = () => window.print();

  // view buttons
  $$('.view-case-btn').forEach(b => b.onclick = async () => {
    const caseId = b.getAttribute('data-case');
    await showCaseDetails(caseId);
  });
}

function applyFilters(list, filters) {
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
   Case Modal: view details + reviews + recommendations - Converted to Standard CSS
   =========================== */

async function showCaseDetails(caseId) {
  const { data: caseData, error } = await supabase.from('mpdsr_cases').select('*').eq('case_id', caseId).single();
  if (error) { alert('Error loading case'); return; }
  await fetchReviews(caseId);
  const reviews = state.data.reviews[caseId] || [];

  // modal HTML
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

        <div class="reviews-section">
          <h3 class="section-title-small">Reviews</h3>
          <div id="reviewsList" class="reviews-list">
            ${reviews.map(r => `
              <div class="review-item">
                <div class="review-header flex-spaced"><div class="review-date">${fmtDate(r.review_date)}</div></div>
                <div class="review-outcome text-sm mt-2">${escapeHtml(r.review_outcome || r.root_cause_identified || '')}</div>
                <div class="reviewer-info text-xs mt-2">Reviewer: ${escapeHtml(r.reviewer_user_id || '')}</div>
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
    if (!confirm('Delete this case?')) return;
    try {
      await deleteCase(caseId);
      overlay.remove();
      await fetchCases();
      renderCases();
      alert('Deleted');
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
    await showReviewDetails(reviewId);
    overlay.remove();
  });
}

/* ===========================
   Add/Edit Case Forms - Converted to Standard CSS
   =========================== */

function showNewCaseModal() {
  // build modal with facilities list
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
      created_at: new Date().toISOString()
    };
    try {
      await createCase(payload);
      wrap.remove();
      await fetchCases();
      renderCases();
      alert('Case created');
    } catch (e) { alert('Create failed: ' + e.message); }
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
          <div class="form-actions">
            <button type="button" id="cancelEdit" class="secondary-btn">Cancel</button>
            <button type="submit" class="primary-btn">Update</button>
          </div>
        </form>
      </div>
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
      updated_at: new Date().toISOString()
    };
    try {
      await updateCase(caseData.case_id, payload);
      wrap.remove();
      await fetchCases();
      renderCases();
      alert('Case updated');
    } catch (e) { alert('Update failed: ' + e.message); }
  };
}


/* ===========================
   Review flows - Converted to Standard CSS
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
      review_team_members: '', // could be extended
      root_cause_identified: fd.get('root_cause_identified'),
      review_outcome: fd.get('review_outcome'),
      reviewer_user_id: state.user.id,
      created_at: new Date().toISOString()
    };
    try {
      await createReview(payload);
      wrap.remove();
      await fetchReviews(caseId);
      alert('Review saved');
      await showCaseDetails(caseId);
    } catch (e) { alert('Save review failed: ' + e.message); }
  };
}

async function showReviewDetails(reviewId) {
  const { data, error } = await supabase.from('mpdsr_reviews').select('*').eq('review_id', reviewId).single();
  if (error) { alert('Could not load review'); return; }
  await fetchRecommendations(reviewId);
  const recs = state.data.recommendations[reviewId] || [];

  const html = `
    <div class="modal-overlay">
      <div class="modal-content large-modal">
        <div class="modal-header flex-spaced">
          <h2 class="modal-title">Review ${fmtDate(data.review_date)}</h2>
          <button id="closeReviewModal" class="secondary-btn small-btn">Close</button>
        </div>

        <div class="modal-body review-details-section">
          <div class="detail-group">
            <p class="detail-label">Root Cause:</p>
            <p class="detail-value text-sm">${escapeHtml(data.root_cause_identified || '')}</p>
          </div>

          <div class="mt-4">
            <h3 class="section-title-small">Recommendations</h3>
            <div id="recList" class="recommendations-list">
              ${recs.map(r => `
                <div class="rec-item">
                  <div class="rec-text flex-spaced">
                    <div>${escapeHtml(r.recommendation_text)}</div>
                    <div class="rec-status status-badge ${r.status.toLowerCase()}">${escapeHtml(r.status)}</div>
                  </div>
                  <div class="rec-meta text-xs">Target: ${fmtDate(r.target_completion_date)} Responsible: ${escapeHtml(r.responsible_person_name || '')}</div>
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
  $('#addRecBtn', wrap).onclick = () => {
    wrap.remove();
    showAddRecommendationForm(reviewId);
  };
}


/* ===========================
   Recommendations - Converted to Standard CSS
   =========================== */

function showAddRecommendationForm(reviewId) {
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
      alert('Recommendation saved');
      await showReviewDetails(reviewId);
    } catch (e) { alert('Save recommendation failed: ' + e.message); }
  };
}

/* ===========================
   Reports View (placeholder) - Converted to Standard CSS
   =========================== */

async function renderReports() {
  renderMain(`
    <div class="reports-page">
      <h1 class="page-title mb-6">Reports & Analytics</h1>
      <div class="card report-info-card">
        <p class="text-lg text-gray-600">Reports section coming soon. Will feature visual summaries, trends, and compliance metrics.</p>
        <ul class="list-bullet mt-4 space-y-1 text-sm">
          <li>Case volume by sub-county/facility</li>
          <li>Review completion rates</li>
          <li>Recommendation implementation status</li>
        </ul>
      </div>
    </div>
  `);
}

/* ===========================
   User Management View - Converted to Standard CSS
   =========================== */

async function renderUserManagement() {
  const users = await fetchAllUsers();
  if (!state.data.facilities.length) await fetchFacilities();

  renderMain(`
    <div class="user-management-page">
      <div class="page-header flex-spaced">
        <h1 class="page-title">User Management</h1>
        <button id="newUserBtn" class="primary-btn">New User</button>
      </div>

      <div class="card table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${['Name','Email','Role','Facility','Last Login','Actions'].map(h => `<th class="table-header">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td class="table-cell font-medium">${escapeHtml(u.full_name || '—')}</td>
                <td class="table-cell">${escapeHtml(u.email || '—')}</td>
                <td class="table-cell">${escapeHtml(u.user_level || '—')}</td>
                <td class="table-cell">${escapeHtml(u.facilities?.facility_name || '—')}</td>
                <td class="table-cell text-sm">${fmtDate(u.last_login)}</td>
                <td class="table-cell action-cell"><button data-user="${escapeHtml(u.user_id)}" class="edit-user-btn link-btn">Edit</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);

  // listeners
  $$('.edit-user-btn').forEach(b => b.onclick = async () => {
    const userId = b.getAttribute('data-user');
    const user = users.find(u => u.user_id === userId);
    if (user) showEditUserForm(user);
  });
  $('#newUserBtn').onclick = () => showEditUserForm(null);
}

function showEditUserForm(userData) {
  const isNew = userData === null;
  const facilityOptions = state.data.facilities.map(f => `<option value="${escapeHtml(f.facility_id)}" ${!isNew && f.facility_id===userData.facility_id ? 'selected' : ''}>${escapeHtml(f.facility_name)}</option>`).join('');
  const roleOptions = ['Admin', 'Subcounty Coordinator', 'Facility User'].map(r => `<option value="${r}" ${!isNew && r===userData.user_level ? 'selected' : ''}>${r}</option>`).join('');

  const html = `
    <div class="modal-overlay">
      <div class="modal-content medium-modal">
        <div class="modal-header flex-spaced">
          <h2 class="modal-title">${isNew ? 'New User' : 'Edit User: ' + escapeHtml(userData.full_name || '—')}</h2>
          <button id="closeUser" class="close-btn">✕</button>
        </div>
        <form id="userForm" class="modal-form">
          ${isNew ? `
            <div class="form-group">
              <label class="form-label">Email (Used for Login)</label>
              <input name="email" type="email" required class="form-input" value=""/>
            </div>
          ` : ''}
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input name="full_name" required class="form-input" value="${isNew ? '' : escapeHtml(userData.full_name || '')}"/>
          </div>
          <div class="form-group">
            <label class="form-label">User Role</label>
            <select name="user_level" required class="form-select">${roleOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Assigned Facility</label>
            <select name="facility_id" class="form-select">
              <option value="">None (County/Subcounty)</option>
              ${facilityOptions}
            </select>
          </div>
          <div class="form-actions">
            <button type="button" id="cancelUser" class="secondary-btn">Cancel</button>
            <button type="submit" class="primary-btn">${isNew ? 'Create User' : 'Update User'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  document.body.appendChild(wrap);

  $('#closeUser', wrap).onclick = () => wrap.remove();
  $('#cancelUser', wrap).onclick = () => wrap.remove();

  $('#userForm', wrap).onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const payload = {
      full_name: fd.get('full_name'),
      user_level: fd.get('user_level'),
      facility_id: fd.get('facility_id') || null,
      updated_at: new Date().toISOString()
    };

    try {
      if (isNew) {
        alert("User creation is not fully implemented in this demo (requires separate Supabase sign up call).");
        return;
      } else {
        await updateUser(userData.user_id, payload);
        wrap.remove();
        await renderUserManagement();
        alert('User updated');
      }
    } catch (e) { alert('Operation failed: ' + e.message); }
  };
}


/* ===========================
   Initialization (unchanged)
   =========================== */

window.onload = async () => {
  await initAuth(); 
  if (state.user) {
    try {
      await fetchFacilities();
      navigate('dashboard');
    } catch (e) {
      console.error("Error fetching facilities on init:", e);
      navigate('login');
    }
  } else {
    navigate('login');
  }
};
