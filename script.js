/* script.js - MPDSR vanilla JS single-page app
   - No React, no Babel. Uses Tailwind for styling.
   - Drop into same folder as index.html and open in browser.
*/

// ---------- Mock data & constants ----------
const mockCases = [
  { id: 'MPDSR-001', facility: 'Nakuru Referral Hospital', subcounty: 'Nakuru Town East', type: 'Maternal', status: 'Pending Review', date: '2025-10-01' },
  { id: 'MPDSR-002', facility: 'Gilgil Sub-County Hospital', subcounty: 'Gilgil', type: 'Perinatal', status: 'Audit Complete', date: '2025-09-25' },
  { id: 'MPDSR-003', facility: 'Rongai Health Centre', subcounty: 'Rongai', type: 'Maternal', status: 'Data Entry', date: '2025-10-05' },
  { id: 'MPDSR-004', facility: 'Molo County Hospital', subcounty: 'Molo', type: 'Perinatal', status: 'Pending Review', date: '2025-10-08' },
  { id: 'MPDSR-005', facility: 'Naivasha Sub-County Hospital', subcounty: 'Naivasha', type: 'Maternal', status: 'Audit Complete', date: '2025-09-15' },
  { id: 'MPDSR-006', facility: 'Ol Kalou Health Center', subcounty: 'Nakuru Town West', type: 'Perinatal', status: 'Pending Review', date: '2025-10-10' },
  { id: 'MPDSR-007', facility: 'Egerton University Clinic', subcounty: 'Njoro', type: 'Maternal', status: 'Data Entry', date: '2025-10-12' },
];

const subCounties = ['All', 'Nakuru Town East', 'Gilgil', 'Rongai', 'Molo', 'Naivasha', 'Nakuru Town West', 'Njoro'];
const caseTypes = ['Maternal', 'Perinatal'];
const caseStatuses = ['All', 'Data Entry', 'Pending Review', 'Audit Complete', 'Closed'];

const appState = {
  user: { email: 'county.admin@nakuru.go.ke', user_level: 'County' },
  view: 'dashboard', // dashboard | cases | reports | users
  sidebarCollapsed: false,
  cases: [...mockCases],
  filters: { q: '', subcounty: 'All', status: 'All' },
  modal: { visible: false, mode: 'new', caseItem: null }
};

// ---------- Utility helpers ----------
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const formatDate = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(); } catch (e) { return iso; }
};
const statusClasses = (s) => {
  if (s === 'Pending Review') return 'bg-yellow-100 text-yellow-800';
  if (s === 'Audit Complete') return 'bg-green-100 text-green-800';
  if (s === 'Data Entry') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-800';
};

// ---------- SVG icons as strings ----------
const Icons = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  list: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="m3 16 2 2 4-4"/><path d="M12 6h8"/><path d="M12 12h8"/><path d="M12 18h8"/><path d="M3 6l2 2 4-4"/></svg>`,
  shield: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  users: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  menu: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="18" y2="18"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
};

// ---------- DOM roots ----------
const root = document.getElementById('root');

// ---------- Render functions ----------
function render() {
  root.innerHTML = `
    <div class="flex h-screen overflow-hidden">
      ${renderSidebar()}
      <main class="flex-grow overflow-y-auto transition-all duration-300 bg-gray-50" id="main-content">
        ${renderContent()}
      </main>
    </div>
    ${renderModal()}
  `;
  attachListeners();
}

function renderSidebar() {
  const collapsed = appState.sidebarCollapsed;
  return `
    <div class="h-full bg-indigo-800 text-white shadow-xl transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'} flex flex-col flex-shrink-0">
      <div class="flex items-center justify-between p-4 border-b border-indigo-700">
        ${collapsed ? `<div class="text-lg font-bold">MP</div>` : `<h1 class="text-xl font-bold text-white tracking-wider">MPDSR Nakuru</h1>`}
        <button id="toggle-sidebar" class="p-2 rounded-full hover:bg-indigo-700 text-indigo-200" aria-label="Toggle Sidebar">${Icons.menu}</button>
      </div>

      <nav class="flex-grow p-3 space-y-1 overflow-y-auto" id="nav-list">
        ${renderNavItem('dashboard', 'Dashboard', Icons.home, collapsed)}
        ${renderNavItem('cases', 'Case List', Icons.list, collapsed)}
        ${renderNavItem('reports', 'Reports', Icons.shield, collapsed)}
        ${renderNavItem('users', 'User Management', Icons.users, collapsed, true)}
      </nav>

      <div class="p-4 border-t border-indigo-700 ${collapsed ? 'text-center' : ''}">
        ${collapsed ? '' : `<div class="text-sm font-semibold mb-2 truncate">${escapeHtml(appState.user.email)}</div>`}
        ${collapsed ? '' : `<div class="text-xs text-indigo-300 mb-3">Level: <span class="font-bold text-indigo-100">${escapeHtml(appState.user.user_level)}</span></div>`}
        <button id="logout-btn" class="flex items-center justify-center w-full p-2 text-sm transition duration-200 rounded-lg text-red-300 bg-indigo-700 hover:bg-red-600 hover:text-white ${collapsed ? 'px-1' : ''}">
          ${Icons.x} ${collapsed ? '' : '<span class="ml-2">Logout</span>'}
        </button>
      </div>
    </div>
  `;
}

function renderNavItem(view, title, icon, collapsed, requiresAdmin = false) {
  // if requiresAdmin and not national, hide
  if (requiresAdmin && appState.user.user_level !== 'National') return '';
  const active = appState.view === view;
  const activeClass = active ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-200 hover:bg-indigo-700';
  return `
    <button data-view="${view}" class="flex items-center w-full p-3 my-1 transition duration-200 rounded-lg ${activeClass}">
      ${icon}
      ${collapsed ? '' : `<span class="ml-3 font-medium">${title}</span>`}
    </button>
  `;
}

function renderContent() {
  switch (appState.view) {
    case 'dashboard': return renderDashboard();
    case 'cases': return renderCaseList();
    case 'reports': return renderReports();
    case 'users': return renderUsers();
    default: return renderDashboard();
  }
}

function renderDashboard() {
  return `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-gray-800 mb-6">MPDSR Overview</h1>
      <div class="bg-white p-6 rounded-xl shadow-lg border-l-4 border-indigo-500">
        <p class="text-gray-600">Welcome, <strong>${escapeHtml(appState.user.user_level)}</strong> User (${escapeHtml(appState.user.email)}).</p>
        <p class="mt-2 text-gray-700 font-medium">This view is restricted to show data only for your assigned jurisdiction based on RLS. Current access: <strong>Nakuru County</strong> (Simulated).</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        ${['Maternal Deaths', 'Perinatal Deaths', 'Case Audits', 'Facilities'].map((title, i) => `
          <div class="bg-white p-5 rounded-xl shadow-md transition hover:shadow-xl">
            <p class="text-sm text-indigo-500 font-semibold">${title}</p>
            <p class="text-3xl font-extrabold text-gray-900 mt-1">${i * 25 + 10}</p>
            <p class="text-xs text-gray-500 mt-1">Total count for this period</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCaseList() {
  // apply current filters to cases for display
  const filtered = applyFilters(appState.cases, appState.filters);
  return `
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold text-gray-800">Maternal & Perinatal Case Listing</h1>
        <button id="add-case-btn" class="flex items-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150">
          ${Icons.plus} <span class="ml-2">Add New Case</span>
        </button>
      </div>

      <div class="bg-white p-4 rounded-xl shadow-md mb-6 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
        <input id="q-input" type="text" placeholder="Search by Case ID or Facility..." class="flex-grow p-2 border border-gray-300 rounded-lg" value="${escapeHtml(appState.filters.q)}" />
        <select id="sub-select" class="p-2 border border-gray-300 rounded-lg">
          ${subCounties.map(s => `<option value="${escapeHtml(s)}" ${s===appState.filters.subcounty ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
        <select id="status-select" class="p-2 border border-gray-300 rounded-lg">
          ${caseStatuses.map(s => `<option value="${escapeHtml(s)}" ${s===appState.filters.status ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
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
              <tr class="hover:bg-indigo-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">${escapeHtml(c.id)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(c.facility)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(c.subcounty)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(c.type)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(c.date)}</td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses(c.status)}">${escapeHtml(c.status)}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button data-id="${escapeHtml(c.id)}" class="view-btn text-indigo-600 hover:text-indigo-900 font-semibold">View</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="p-4 bg-gray-50 border-t border-gray-200 text-sm text-red-500 font-medium rounded-b-xl">
          <strong>RLS Protection in Effect:</strong> The above list is filtered to Nakuru County (Simulated).
        </div>
      </div>
    </div>
  `;
}

function renderReports() {
  return `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-gray-800 mb-6">Interactive Reports & Visualizations</h1>
      <div class="bg-white p-6 rounded-xl shadow-lg">
        <p class="text-gray-600">Charts and data analytics will be placed here.</p>
        <p class="mt-2 text-sm text-blue-500">Charts will aggregate and display data according to RLS constraints (County level data).</p>
      </div>
    </div>
  `;
}

function renderUsers() {
  return `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-gray-800 mb-6">User and Role Administration</h1>
      <div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded-xl shadow-lg">
        <p class="font-bold">Access Warning:</p>
        <p class="text-sm">This module is typically restricted to 'National' or 'Admin' level users via RLS policies on the user_profiles table.</p>
      </div>
    </div>
  `;
}

function renderModal() {
  if (!appState.modal.visible) return '';
  if (appState.modal.mode === 'view' && appState.modal.caseItem) {
    const c = appState.modal.caseItem;
    return `
      <div id="modal-root" class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg w-full max-w-2xl p-6" id="modal-card">
          <div class="flex justify-between items-start">
            <h2 class="text-2xl font-bold">${escapeHtml(c.id)} — ${escapeHtml(c.facility)}</h2>
            <button id="modal-close" class="text-gray-500">${Icons.x}</button>
          </div>
          <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-gray-500">Sub-County</p>
              <p class="font-medium">${escapeHtml(c.subcounty)}</p>
              <p class="text-sm text-gray-500 mt-3">Type</p>
              <p class="font-medium">${escapeHtml(c.type)}</p>
              <p class="text-sm text-gray-500 mt-3">Date</p>
              <p class="font-medium">${escapeHtml(c.date)}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Status</p>
              <p class="font-medium">${escapeHtml(c.status)}</p>
              <p class="text-sm text-gray-500 mt-3">Details</p>
              <p class="text-sm leading-relaxed">${escapeHtml(c.details || '—')}</p>
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button id="modal-close-2" class="px-4 py-2 bg-gray-200 rounded">Close</button>
            <button id="modal-action" class="px-4 py-2 bg-indigo-600 text-white rounded">Take Action</button>
          </div>
        </div>
      </div>
    `;
  }

  // New case modal
  return `
    <div id="modal-root" class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" id="modal-card">
        <div class="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 class="text-2xl font-bold text-gray-800">New MPDSR Case Registration</h2>
          <button id="modal-close" class="text-gray-400 hover:text-gray-700">${Icons.x}</button>
        </div>
        <form id="new-case-form" class="p-6 space-y-4">
          <p class="text-sm text-gray-500">Please enter the initial details for the maternal or perinatal death.</p>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Facility Name</label>
            <input name="facility" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Sub-County</label>
              <select name="subcounty" class="w-full p-3 border border-gray-300 rounded-lg">
                ${subCounties.filter(s=>s!=='All').map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Case Type</label>
              <select name="type" class="w-full p-3 border border-gray-300 rounded-lg">
                ${caseTypes.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date of Event</label>
            <input name="date" type="date" value="${new Date().toISOString().substring(0,10)}" class="w-full p-3 border border-gray-300 rounded-lg" />
          </div>

          <div class="pt-4 flex justify-end space-x-3">
            <button type="button" id="modal-cancel" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg">Cancel</button>
            <button type="submit" class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg">Register Case</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// ---------- State & actions ----------
function applyFilters(list, { q, subcounty, status }) {
  const term = (q || '').trim().toLowerCase();
  return list.filter(c => {
    if (subcounty && subcounty !== 'All' && c.subcounty !== subcounty) return false;
    if (status && status !== 'All' && c.status !== status) return false;
    if (!term) return true;
    return (c.id && c.id.toLowerCase().includes(term)) || (c.facility && c.facility.toLowerCase().includes(term));
  });
}

function showView(view) {
  appState.view = view;
  render();
  // scroll top
  const main = document.getElementById('main-content');
  if (main) main.scrollTop = 0;
}

function toggleSidebar() {
  appState.sidebarCollapsed = !appState.sidebarCollapsed;
  render();
}

function openNewCaseModal() {
  appState.modal = { visible: true, mode: 'new', caseItem: null };
  document.documentElement.classList.add('no-scroll'); // lock scroll
  render();
}

function openViewModal(caseId) {
  const c = appState.cases.find(x => x.id === caseId);
  if (!c) return;
  appState.modal = { visible: true, mode: 'view', caseItem: c };
  document.documentElement.classList.add('no-scroll');
  render();
}

function closeModal() {
  appState.modal = { visible: false, mode: 'new', caseItem: null };
  document.documentElement.classList.remove('no-scroll');
  render();
}

function addNewCaseFromForm(form) {
  const formData = new FormData(form);
  const facility = (formData.get('facility') || '').toString().trim();
  if (!facility) return alert('Facility name required');
  const subcounty = formData.get('subcounty')?.toString() || subCounties[1];
  const type = formData.get('type')?.toString() || caseTypes[0];
  const date = formData.get('date')?.toString() || new Date().toISOString().substring(0,10);
  const newId = `MPDSR-${String(appState.cases.length + 1).padStart(3, '0')}`;
  const newCase = { id: newId, facility, subcounty, type, status: 'Data Entry', date };
  appState.cases.unshift(newCase);
  closeModal();
  // ensure we stay on cases view and re-render
  appState.view = 'cases';
  render();
}

// ---------- Event listeners ----------
function attachListeners() {
  // Sidebar toggle
  const toggle = $('#toggle-sidebar');
  if (toggle) toggle.onclick = toggleSidebar;

  // Nav items
  $$('#nav-list button[data-view]').forEach(btn => {
    btn.onclick = (ev) => {
      const v = btn.getAttribute('data-view');
      if (v) showView(v);
    };
  });

  // logout (mock)
  const logoutBtn = $('#logout-btn');
  if (logoutBtn) logoutBtn.onclick = () => alert('Mock logout - replace with real auth.');

  // Cases view controls
  const addBtn = $('#add-case-btn');
  if (addBtn) addBtn.onclick = openNewCaseModal;

  const qInput = $('#q-input');
  if (qInput) {
    qInput.oninput = (e) => {
      appState.filters.q = e.target.value;
      // debounce quick simple
      setTimeout(() => {
        render();
      }, 150);
    };
  }

  const subSelect = $('#sub-select');
  if (subSelect) subSelect.onchange = (e) => { appState.filters.subcounty = e.target.value; render(); };

  const statusSelect = $('#status-select');
  if (statusSelect) statusSelect.onchange = (e) => { appState.filters.status = e.target.value; render(); };

  // table view buttons (view case)
  $$('.view-btn').forEach(b => {
    b.onclick = (ev) => {
      const id = b.getAttribute('data-id');
      if (id) openViewModal(id);
    };
  });

  // Modal listeners
  const modalClose = $('#modal-close');
  if (modalClose) modalClose.onclick = closeModal;

  const modalClose2 = $('#modal-close-2');
  if (modalClose2) modalClose2.onclick = closeModal;

  const modalCancel = $('#modal-cancel');
  if (modalCancel) modalCancel.onclick = closeModal;

  const modalRoot = $('#modal-root');
  if (modalRoot) {
    modalRoot.onclick = (ev) => {
      if (ev.target === modalRoot) closeModal();
    };
  }

  const newCaseForm = $('#new-case-form');
  if (newCaseForm) {
    newCaseForm.onsubmit = (ev) => {
      ev.preventDefault();
      addNewCaseFromForm(newCaseForm);
    };
  }

  // modal action (in view)
  const modalAction = $('#modal-action');
  if (modalAction) modalAction.onclick = () => alert('Action clicked (stub)');

  // keep keyboard accessible: Esc closes modal
  document.onkeydown = (ev) => {
    if (ev.key === 'Escape' && appState.modal.visible) closeModal();
  };
}

// ---------- small helper ----------
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------- initial render ----------
document.addEventListener('DOMContentLoaded', () => {
  render();
});
