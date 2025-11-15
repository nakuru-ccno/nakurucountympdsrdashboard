// script.js
// Full app: login, dashboard, cases, reviews, recommendations, user mgmt, reports.
// Requires supabase.js in same folder exporting `supabase` as an ES module.

import { supabase } from "./supabase.js";

/* ===========================
   Utility helpers
   =========================== */
const root = document.getElementById("root");
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const escapeHtml = (s) => (s === null || s === undefined) ? "" : String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : "";
const statusClasses = s => s === 'Pending Review' ? 'bg-yellow-100 text-yellow-800' : (s==='Audit Complete' ? 'bg-green-100 text-green-800' : (s==='Data Entry' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'));
const noop = () => {};

/* ===========================
   App state
   =========================== */
const state = {
  user: null,
  view: 'login', // login | dashboard | cases | reports | users
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
   Supabase API wrappers
   =========================== */

// Auth helpers
export async function signIn(email, password) {
  const resp = await supabase.auth.signInWithPassword({ email, password });
  if (resp.error) throw resp.error;
  return resp.data;
}
export async function signOut() {
  await supabase.auth.signOut();
  state.user = null;
}

// Facilities
export async function fetchFacilities() {
  const { data, error } = await supabase.from('facilities').select('*').eq('is_active', true).order('facility_name');
  if (error) throw error;
  state.data.facilities = data || [];
  return data;
}

// Users
export async function fetchUserProfile(user_id) {
  const { data, error } = await supabase.from('mpdsr_users').select('*, facilities(facility_name)').eq('user_id', user_id).single();
  if (error && error.code !== 'PGRST116') { /* single not found */ console.error(error); }
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

// Cases
export async function fetchCases() {
  // Apply no filter server-side by default; front-end will filter locally or call with params if desired.
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
  // update local state
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

// Reviews
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

// Recommendations
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
  // update local
  for (const rId in state.data.recommendations) {
    const idx = state.data.recommendations[rId].findIndex(x => x.recommendation_id === recommendation_id);
    if (idx >= 0) { state.data.recommendations[rId][idx] = data; break; }
  }
  return data;
}

/* ===========================
   Authentication handling + init
   =========================== */

async function initAuth() {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    state.user = data.session.user;
  } else {
    state.user = null;
  }

  // subscribe to auth changes (login/logout)
  supabase.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null;
    renderRoute();
  });
}

/* ===========================
   Router and views
   =========================== */

function navigate(view) {
  state.view = view;
  renderRoute();
}

async function renderRoute() {
  if (!state.user && state.view !== 'login') {
    renderLogin();
    return;
  }

  switch (state.view) {
    case 'login': renderLogin(); break;
    case 'dashboard': await renderDashboard(); break;
    case 'cases': await renderCases(); break;
    case 'reports': await renderReports(); break;
    case 'users': await renderUserManagement(); break;
    default: await renderDashboard();
  }
}

/* ===========================
   Login View
   =========================== */
function renderLogin(errorMessage = '') {
  renderMain(`
    <div class="h-full flex items-center justify-center bg-gray-100">
      <div class="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
        <h1 class="text-2xl font-bold text-center mb-4">MPDSR Login</h1>

        <input id="email" type="email" placeholder="Email"
          class="w-full p-3 mb-3 border rounded" />

        <input id="password" type="password" placeholder="Password"
          class="w-full p-3 mb-4 border rounded" />

        <button id="loginBtn"
          class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">Login</button>

        <p id="error" class="text-red-500 text-center mt-3">${escapeHtml(errorMessage)}</p>
      </div>
    </div>
  `);

  $('#loginBtn').onclick = async () => {
    const email = $('#email').value.trim();
    const password = $('#password').value.trim();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { renderLogin(error.message); return; }

      // update last_login in mpdsr_users if exists
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
}

/* ===========================
   Dashboard View
   =========================== */

function renderMain(html) {
  // shared layout: sidebar + main panel (sidebar used across pages)
  const sidebar = renderSidebar();
  root.innerHTML = `
    <div class="flex h-screen overflow-hidden">
      ${sidebar}
      <main class="flex-grow overflow-y-auto transition-all duration-300 bg-gray-50">
        ${html}
      </main>
    </div>
  `;
  attachShellListeners();
}

function renderSidebar() {
  const collapsed = false;
  const userEmail = state.user?.email || '';
  const navItem = (key, label) => `<button data-nav="${key}" class="flex items-center w-full p-3 my-1 rounded-lg text-indigo-200 hover:bg-indigo-700 ${state.view===key ? 'bg-indigo-600 text-white shadow-lg' : ''}">${label}</button>`;
  return `
    <div class="h-full bg-indigo-800 text-white shadow-xl w-64 flex flex-col flex-shrink-0">
      <div class="flex items-center justify-between p-4 border-b border-indigo-700">
        <h1 class="text-xl font-bold">MPDSR Nakuru</h1>
      </div>
      <nav class="flex-grow p-3 space-y-1 overflow-y-auto">
        ${navItem('dashboard', 'Dashboard')}
        ${navItem('cases', 'Case List')}
        ${navItem('reports', 'Reports')}
        ${navItem('users', 'User Management')}
      </nav>
      <div class="p-4 border-t border-indigo-700">
        <div class="text-sm font-semibold mb-2 truncate">${escapeHtml(userEmail)}</div>
        <button id="logoutBtn" class="flex items-center justify-center w-full p-2 text-sm transition duration-200 rounded-lg text-red-300 bg-indigo-700 hover:bg-red-600 hover:text-white">
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

async function renderDashboard() {
  // ensure facilities loaded
  if (!state.data.facilities.length) await fetchFacilities();
  const userProfile = await fetchUserProfile(state.user.id);

  const facilitiesHtml = state.data.facilities.map(f => `
    <div class="bg-white p-4 rounded shadow">
      <h3 class="font-bold">${escapeHtml(f.facility_name)}</h3>
      <p class="text-sm text-gray-600">${escapeHtml(f.sub_county)} Sub-County</p>
    </div>
  `).join('');

  renderMain(`
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">MPDSR Dashboard</h1>
      </div>

      <div class="bg-white p-4 rounded shadow">
        <h2 class="text-xl font-semibold mb-1">${escapeHtml(userProfile?.full_name || state.user.email)}</h2>
        <p><strong>Role:</strong> ${escapeHtml(userProfile?.user_level || '—')}</p>
        <p><strong>Facility:</strong> ${escapeHtml(userProfile?.facilities?.facility_name || 'County/Subcounty')}</p>
      </div>

      <h2 class="text-xl font-semibold mt-6 mb-2">Active Facilities</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        ${facilitiesHtml}
      </div>
    </div>
  `);
}

/* ===========================
   Cases View (list, filters, add, view/edit)
   =========================== */

async function renderCases() {
  // ensure data
  await fetchFacilities();
  await fetchCases();

  // local filtered list
  const filtered = applyFilters(state.data.cases, state.filters);

  renderMain(`
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold text-gray-800">Cases</h1>
        <div class="flex gap-2">
          <button id="printBtn" class="px-4 py-2 bg-gray-200 rounded">Print</button>
          <button id="newCaseBtn" class="px-4 py-2 bg-indigo-600 text-white rounded">New Case</button>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl shadow-md mb-6 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
        <input id="q" class="flex-grow p-2 border rounded" placeholder="Search by ID or Facility" value="${escapeHtml(state.filters.q)}"/>
        <select id="subcountyFilter" class="p-2 border rounded">
          <option value="All">All Sub-Counties</option>
          ${state.data.facilities.map(f => `<option value="${escapeHtml(f.sub_county)}">${escapeHtml(f.sub_county)}</option>`).join('')}
        </select>
        <select id="statusFilter" class="p-2 border rounded">
          <option value="All">All Statuses</option>
          <option value="Data Entry">Data Entry</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Audit Complete">Audit Complete</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      <div class="bg-white rounded-xl shadow-lg overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              ${['Case ID','Facility','Sub-County','Type','Date','Status','Actions'].map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${filtered.map(c => `
              <tr>
                <td class="px-6 py-4 text-indigo-600 font-medium">${escapeHtml(c.case_id)}</td>
                <td class="px-6 py-4">${escapeHtml(c.case_summary?.slice(0,60) || c.reporting_facility_id || '')}</td>
                <td class="px-6 py-4">${escapeHtml(c.reporting_subcounty || '')}</td>
                <td class="px-6 py-4">${escapeHtml(c.case_type)}</td>
                <td class="px-6 py-4">${fmtDate(c.death_date)}</td>
                <td class="px-6 py-4"><span class="px-2 py-1 rounded-full text-xs ${statusClasses(c.is_reviewed ? 'Audit Complete' : c.status || 'Data Entry')}">${escapeHtml(c.status || (c.is_reviewed ? 'Audit Complete' : 'Data Entry'))}</span></td>
                <td class="px-6 py-4 text-right"><button data-case="${escapeHtml(c.case_id)}" class="view-case-btn text-indigo-600">View</button></td>
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
   Case Modal: view details + reviews + recommendations
   =========================== */

async function showCaseDetails(caseId) {
  // fetch case details
  const { data: caseData, error } = await supabase.from('mpdsr_cases').select('*').eq('case_id', caseId).single();
  if (error) { alert('Error loading case'); return; }
  await fetchReviews(caseId); // state.data.reviews populated
  const reviews = state.data.reviews[caseId] || [];

  // modal HTML
  const modalHtml = `
    <div id="modalWrap" class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg w-full max-w-3xl p-6 overflow-auto max-h-[90vh]">
        <div class="flex justify-between items-start">
          <h2 class="text-2xl font-bold">${escapeHtml(caseData.case_id)} — ${escapeHtml(caseData.case_summary?.slice(0,80) || 'Case')}</h2>
          <div class="flex gap-2">
            <button id="closeModal" class="px-3 py-1 bg-gray-200 rounded">Close</button>
            <button id="editCaseBtn" class="px-3 py-1 bg-indigo-600 text-white rounded">Edit</button>
            <button id="delCaseBtn" class="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <p class="text-sm text-gray-500">Reported facility</p>
            <p class="font-medium">${escapeHtml(caseData.reporting_facility_id)}</p>

            <p class="text-sm text-gray-500 mt-3">Death date</p>
            <p class="font-medium">${fmtDate(caseData.death_date)}</p>

            <p class="text-sm text-gray-500 mt-3">Case summary</p>
            <p class="text-sm">${escapeHtml(caseData.case_summary || '')}</p>
          </div>

          <div>
            <p class="text-sm text-gray-500">Immediate cause</p>
            <p class="font-medium">${escapeHtml(caseData.immediate_cause || '')}</p>

            <p class="text-sm text-gray-500 mt-3">Underlying cause</p>
            <p class="font-medium">${escapeHtml(caseData.underlying_cause || '')}</p>

            <p class="text-sm text-gray-500 mt-3">Reviewed?</p>
            <p class="font-medium">${caseData.is_reviewed ? 'Yes' : 'No'}</p>
          </div>
        </div>

        <hr class="my-4">

        <div>
          <h3 class="text-lg font-semibold">Reviews</h3>
          <div id="reviewsList" class="space-y-3 mt-2">
            ${reviews.map(r => `
              <div class="p-3 border rounded">
                <div class="flex justify-between"><div class="font-medium">${fmtDate(r.review_date)}</div></div>
                <div class="text-sm mt-2">${escapeHtml(r.review_outcome || r.root_cause_identified || '')}</div>
                <div class="text-xs text-gray-500 mt-2">Reviewer: ${escapeHtml(r.reviewer_user_id || '')}</div>
                <div class="mt-2"><button data-review="${r.review_id}" class="view-review-btn px-3 py-1 bg-gray-100 rounded text-sm">View / Recommendations</button></div>
              </div>
            `).join('')}
          </div>

          <div class="mt-3">
            <button id="addReviewBtn" class="px-3 py-2 bg-green-600 text-white rounded">Add Review</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // insert modal into root overlay
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

  $$('.view-review-btn', overlay).forEach(btn => btn.onclick = async () => {
    const reviewId = btn.getAttribute('data-review');
    await showReviewDetails(reviewId);
    overlay.remove();
  });
}

/* ===========================
   Add/Edit Case Forms
   =========================== */

function showNewCaseModal() {
  // build modal with facilities list
  const facilityOptions = state.data.facilities.map(f => `<option value="${escapeHtml(f.facility_id)}">${escapeHtml(f.facility_name)}</option>`).join('');
  const html = `
    <div id="modalWrap" class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div class="p-6 border-b flex justify-between items-center">
          <h2 class="text-2xl font-bold">New MPDSR Case</h2>
          <button id="modalClose" class="text-gray-500">✕</button>
        </div>
        <form id="caseForm" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Reporting Facility</label>
            <select name="reporting_facility_id" required class="w-full p-3 border rounded">
              ${facilityOptions}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Case Type</label>
            <select name="case_type" required class="w-full p-3 border rounded">
              <option value="Maternal">Maternal</option>
              <option value="Perinatal">Perinatal</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Death Date</label>
            <input name="death_date" type="date" required class="w-full p-3 border rounded" value="${new Date().toISOString().substring(0,10)}"/>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Case Summary</label>
            <textarea name="case_summary" rows="3" class="w-full p-3 border rounded"></textarea>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" id="cancelCase" class="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded">Save Case</button>
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
    <div id="editWrap" class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div class="p-6 border-b flex justify-between items-center">
          <h2 class="text-2xl font-bold">Edit Case ${escapeHtml(caseData.case_id)}</h2>
          <button id="closeEdit" class="text-gray-500">✕</button>
        </div>
        <form id="editCaseForm" class="p-6 space-y-4">
          <div>
            <label class="block text-sm">Reporting Facility</label>
            <select name="reporting_facility_id" required class="w-full p-3 border rounded">${facilityOptions}</select>
          </div>
          <div>
            <label class="block text-sm">Case Type</label>
            <select name="case_type" class="w-full p-3 border rounded">
              <option value="Maternal" ${caseData.case_type==='Maternal'?'selected':''}>Maternal</option>
              <option value="Perinatal" ${caseData.case_type==='Perinatal'?'selected':''}>Perinatal</option>
            </select>
          </div>
          <div>
            <label class="block text-sm">Death Date</label>
            <input name="death_date" type="date" class="w-full p-3 border rounded" value="${caseData.death_date ? caseData.death_date.substring(0,10) : ''}" />
          </div>
          <div>
            <label class="block text-sm">Summary</label>
            <textarea name="case_summary" rows="3" class="w-full p-3 border rounded">${escapeHtml(caseData.case_summary || '')}</textarea>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" id="cancelEdit" class="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded">Update</button>
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
   Review flows
   =========================== */

function showAddReviewForm(caseId) {
  const html = `
    <div id="reviewWrap" class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div class="p-6 border-b flex justify-between items-center">
          <h2 class="text-2xl font-bold">Add Review</h2>
          <button id="closeReview" class="text-gray-500">✕</button>
        </div>
        <form id="reviewForm" class="p-6 space-y-4">
          <div>
            <label class="block text-sm">Review Date</label>
            <input name="review_date" type="date" required class="w-full p-3 border rounded" value="${new Date().toISOString().substring(0,10)}"/>
          </div>
          <div>
            <label class="block text-sm">Root Cause Identified</label>
            <textarea name="root_cause_identified" rows="3" class="w-full p-3 border rounded"></textarea>
          </div>
          <div>
            <label class="block text-sm">Review Outcome</label>
            <textarea name="review_outcome" rows="3" class="w-full p-3 border rounded"></textarea>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" id="cancelReview" class="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded">Save Review</button>
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
    <div id="reviewModal" class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-auto max-h-[90vh] p-6">
        <div class="flex justify-between items-start">
          <h2 class="text-2xl font-bold">Review ${fmtDate(data.review_date)}</h2>
          <button id="closeReviewModal" class="px-3 py-1 bg-gray-200 rounded">Close</button>
        </div>

        <div class="mt-4">
          <p class="font-medium">Root Cause:</p>
          <p class="text-sm">${escapeHtml(data.root_cause_identified || '')}</p>
        </div>

        <div class="mt-4">
          <h3 class="font-semibold">Recommendations</h3>
          <div id="recList" class="space-y-2 mt-2">
            ${recs.map(r => `
              <div class="p-3 border rounded">
                <div class="flex justify-between"><div>${escapeHtml(r.recommendation_text)}</div><div class="text-xs">${escapeHtml(r.status)}</div></div>
                <div class="text-xs text-gray-500 mt-2">Target: ${fmtDate(r.target_completion_date)} Responsible: ${escapeHtml(r.responsible_person_name || '')}</div>
              </div>
            `).join('')}
          </div>

          <div class="mt-4">
            <button id="addRecBtn" class="px-3 py-2 bg-indigo-600 text-white rounded">Add Recommendation</button>
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
   Recommendations
   =========================== */

function showAddRecommendationForm(reviewId) {
  const html = `
    <div id="recWrap" class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div class="p-6 border-b flex justify-between items-center">
          <h2 class="text-2xl font-bold">New Recommendation</h2>
          <button id="closeRec" class="text-gray-500">✕</button>
        </div>
        <form id="recForm" class="p-6 space-y-4">
          <div>
            <label class="block text-sm">Recommendation Text</label>
            <textarea name="recommendation_text" rows="3" required class="w-full p-3 border rounded"></textarea>
          </div>
          <div>
            <label class="block text-sm">Responsible Person (name)</label>
            <input name="responsible_person_name" class="w-full p-3 border rounded" />
          </div>
          <div>
            <label class="block text-sm">Target Completion Date</label>
            <input name="target_completion_date" type="date" class="w-full p-3 border rounded" />
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" id="cancelRec" class="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded">Save</button>
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
      target_completion_date: fd.get('target_completion_date'),
      status: 'pending',
      created_at: new Date().toISOString()
    };
    try {
      await createRecommendation(payload);
      wrap.remove();
      alert('Saved');
      await fetchRecommendations(reviewId);
      await showReviewDetails(reviewId);
    } catch (e) { alert('Save failed: ' + e.message); }
  };
}

/* ===========================
   User Management (admin)
   =========================== */

async function renderUserManagement() {
  // require admin? Not enforced here, developer should add RLS/policies server-side
  const users = await fetchAllUsers();
  const rows = (users||[]).map(u => `
    <tr>
      <td class="px-6 py-4">${escapeHtml(u.full_name)}</td>
      <td class="px-6 py-4">${escapeHtml(u.email)}</td>
      <td class="px-6 py-4">${escapeHtml(u.user_level)}</td>
      <td class="px-6 py-4">${escapeHtml(u.facilities?.facility_name || '')}</td>
      <td class="px-6 py-4">${u.is_active ? 'Active' : 'Inactive'}</td>
      <td class="px-6 py-4 text-right">
        <button data-user="${u.user_id}" class="toggle-user-btn px-2 py-1 bg-indigo-600 text-white rounded">Toggle Active</button>
      </td>
    </tr>
  `).join('');

  renderMain(`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">User Management</h1>
      <div class="bg-white rounded shadow overflow-x-auto">
        <table class="min-w-full">
          <thead class="bg-gray-50">
            <tr>
              ${['Name','Email','Role','Facility','Status','Actions'].map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `);

  $$('.toggle-user-btn').forEach(b => b.onclick = async () => {
    const id = b.getAttribute('data-user');
    try {
      const user = (await fetchAllUsers()).find(u => u.user_id === id);
      await updateUser(id, { is_active: !user.is_active });
      alert('Updated');
      renderUserManagement();
    } catch (e) { alert('Update failed: ' + e.message); }
  });
}

/* ===========================
   Reports View (printable)
   =========================== */

async function renderReports() {
  // simple printable summary: counts by facility/type/status
  await fetchCases();
  const byFacility = {};
  (state.data.cases || []).forEach(c => {
    const key = c.reporting_facility_id || 'Unknown';
    byFacility[key] = (byFacility[key] || 0) + 1;
  });
  const rows = Object.keys(byFacility).map(k => `<tr><td class="px-4 py-2">${escapeHtml(k)}</td><td class="px-4 py-2">${byFacility[k]}</td></tr>`).join('');

  renderMain(`
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Reports</h1>
        <div>
          <button id="printReport" class="px-4 py-2 bg-indigo-600 text-white rounded">Print Report</button>
        </div>
      </div>

      <div class="bg-white rounded shadow p-4">
        <h2 class="font-semibold mb-2">Cases per Facility</h2>
        <table class="w-full border">
          <thead class="bg-gray-50"><tr><th class="px-4 py-2 text-left">Facility</th><th class="px-4 py-2 text-left">Count</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `);

  $('#printReport').onclick = () => window.print();
}

/* ===========================
   Startup: init auth and route
   =========================== */

async function startup() {
  await initAuth();
  // load facilities/cases early for snappy UI
  try { await fetchFacilities(); } catch (e) { console.warn('facilities load failed', e); }
  try { await fetchCases(); } catch (e) { console.warn('cases load failed', e); }

  // determine initial view
  if (!state.user) {
    state.view = 'login';
    renderLogin();
  } else {
    state.view = 'dashboard';
    renderRoute();
  }
}

async function renderLogin() {
  await initAuth();
  renderLoginPage();
}
function renderLoginPage() { renderLogin(); } // wrapper to expose earlier function

// ensure functions declared earlier are reachable for login rendering
function renderLogin() { renderLoginPageBody(); }
function renderLoginPageBody() {
  renderMain(`
    <div class="h-full flex items-center justify-center bg-gray-100">
      <div class="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
        <h1 class="text-2xl font-bold text-center mb-4">MPDSR Login</h1>

        <input id="email" type="email" placeholder="Email"
          class="w-full p-3 mb-3 border rounded" />

        <input id="password" type="password" placeholder="Password"
          class="w-full p-3 mb-4 border rounded" />

        <button id="loginBtn"
          class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">Login</button>

        <p id="error" class="text-red-500 text-center mt-3"></p>
      </div>
    </div>
  `);

  $('#loginBtn').onclick = async () => {
    const email = $('#email').value.trim();
    const password = $('#password').value.trim();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { $('#error').textContent = error.message; return; }
      state.user = data.user;
      await fetchFacilities();
      await fetchCases();
      navigateAfterLogin();
    } catch (e) {
      $('#error').textContent = e.message || String(e);
    }
  };
}
function navigateAfterLogin() { state.view = 'dashboard'; renderRoute(); }

/* ===========================
   Utility: fetch wrappers used earlier
   =========================== */

async function fetchFacilities() {
  try { await supabase.from('facilities').select('*').eq('is_active', true).order('facility_name').then(r => { if (r.error) throw r.error; state.data.facilities = r.data || []; }); }
  catch (e) { console.error('fetchFacilities', e); }
}
async function fetchCases() {
  try { await supabase.from('mpdsr_cases').select('*').order('death_date', { ascending: false }).then(r => { if (r.error) throw r.error; state.data.cases = r.data || []; }); }
  catch (e) { console.error('fetchCases', e); }
}
async function fetchReviews(case_id) {
  try { await supabase.from('mpdsr_reviews').select('*').eq('case_id', case_id).order('review_date', { ascending: false }).then(r => { if (r.error) throw r.error; state.data.reviews[case_id] = r.data || []; }); }
  catch (e) { console.error('fetchReviews', e); }
}
async function fetchRecommendations(review_id) {
  try { await supabase.from('mpdsr_recommendations').select('*').eq('review_id', review_id).order('created_at', { ascending: false }).then(r => { if (r.error) throw r.error; state.data.recommendations[review_id] = r.data || []; }); }
  catch (e) { console.error('fetchRecommendations', e); }
}
async function createReview(payload) { const r = await supabase.from('mpdsr_reviews').insert([payload]).select().single(); if (r.error) throw r.error; return r.data; }
async function createRecommendation(payload) { const r = await supabase.from('mpdsr_recommendations').insert([payload]).select().single(); if (r.error) throw r.error; return r.data; }
async function createCase(payload) { const r = await supabase.from('mpdsr_cases').insert([payload]).select().single(); if (r.error) throw r.error; return r.data; }
async function updateCase(case_id, payload) { const r = await supabase.from('mpdsr_cases').update(payload).eq('case_id', case_id).select().single(); if (r.error) throw r.error; return r.data; }
async function deleteCase(case_id) { const r = await supabase.from('mpdsr_cases').delete().eq('case_id', case_id); if (r.error) throw r.error; return true; }
async function fetchAllUsers() { const r = await supabase.from('mpdsr_users').select('*, facilities(facility_name)'); if (r.error) throw r.error; return r.data || []; }
async function updateUser(user_id, payload) { const r = await supabase.from('mpdsr_users').update(payload).eq('user_id', user_id).select().single(); if (r.error) throw r.error; return r.data; }
async function fetchUserProfile(user_id) { const r = await supabase.from('mpdsr_users').select('*, facilities(facility_name)').eq('user_id', user_id).single(); if (r.error) return null; return r.data; }

/* ===========================
   Start the app
   =========================== */

startup();

