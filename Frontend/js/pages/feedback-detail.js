// ═══════════════════════════════════════════════════════════════
//  FLIC – Danh sách phản hồi chi tiết
// ═══════════════════════════════════════════════════════════════

const API = API_BASE;
const ITEMS_PER_PAGE = 10;
let currentFeedbackPage = 1;
let allFeedbacks = [];
let currentFilteredData = [];
let formInfo = { id: null, name: '' };

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}


function getAvatarColor(str) {
  const colors = [
    { bg: '#ffffff', color: '#3b0a99' }, // Trắng
    { bg: '#ffedd5', color: '#ea580c' }, // Cam nhạt
    { bg: '#ede9fe', color: '#3b0a99' }, // Xanh logo nhạt
    { bg: '#dcfce7', color: '#16a34a' }, // Xanh lá
    { bg: '#e0f2fe', color: '#0284c7' }, // Xanh lam
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 10000;
  }
  return colors[Math.abs(hash) % colors.length];
}

function renderUI() {
  document.getElementById('page-content').innerHTML = `
    <div style="position: sticky; top: 0; z-index: 40; background: #f8fafc; padding: 24px 4px 0 4px; margin: -24px -4px 0 -4px;">
      <div style="margin-bottom:24px; display:flex; align-items:flex-start; justify-content:space-between;">
      <div>
        <div style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--gray-500); margin-bottom:8px;">
          <span style="cursor:pointer; transition:color 0.2s;" onmouseenter="this.style.color='var(--gray-800)'" onmouseleave="this.style.color='var(--gray-500)'" onclick="window.location.href='feedback.html'">Quản lý phản hồi</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"></polyline></svg>
          <span style="color:var(--gray-900)">Danh sách phản hồi</span>
        </div>
        <div style="display:flex; align-items:center; gap:16px;">
          <h2 style="font-size:28px; font-weight:800; color:var(--gray-900); margin:0;">Danh sách phản hồi</h2>
          <span style="background:#ffffff; color:#3b0a99; border:1px solid #cdd2d6; padding:6px 14px; border-radius:20px; font-size:13px; font-weight:700; display:inline-flex; align-items:center; justify-content:center;">
            <span id="total-count-badge">0</span>&nbsp;phản hồi
          </span>
        </div>
        <div style="font-size:15px; color:var(--gray-500); margin-top:8px; font-weight:500;">
          ${formInfo.name}
        </div>
      </div>
      
      <div style="display:flex; gap:12px;">
        <button onclick="exportPDF()" class="btn" style="background:#3b0a99; border:none; color:#fff; font-weight:700; display:flex; align-items:center; gap:8px; padding:10px 16px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Xuất PDF
        </button>
        <button onclick="deleteAllFeedbacks()" class="btn" style="background:#fff; border:1px solid #fecaca; color:#dc2626; font-weight:700; display:flex; align-items:center; gap:8px; padding:10px 16px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
          Xóa phản hồi
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div style="background:#fff; padding:16px 20px; border-radius:16px; border:1px solid var(--gray-200); margin-bottom:20px; display:flex; gap:16px; align-items:center;">
      <div class="input-wrap" style="flex:1; position:relative;">
        <div class="input-icon" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--gray-400)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <input type="text" id="filter-search" class="input" placeholder="Tìm kiếm người gửi..." oninput="filterData()" style="width:100%; padding-left:40px; height:42px;">
      </div>

      <div style="display:flex; align-items:center; gap:12px; margin-left:auto;">
        <select id="filter-class" class="input" style="width:140px; height:42px; font-weight:600; color:var(--gray-700);" onchange="filterData()">
          <option value="all">Lớp học</option>
        </select>
      </div>
    </div>
    </div>

    <!-- Table -->
    <div style="background:#fff; border-radius:16px; border:1px solid var(--gray-200); overflow:hidden;">
      <div style="max-height: calc(100vh - 275px); overflow-y: auto;">
        <table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead style="position: sticky; top: 0; z-index: 10; background: #f8fafc; box-shadow: 0 1px 0 var(--gray-200);">
            <tr>
            <th style="padding:16px; width:40px; text-align:center;">
              <input type="checkbox" id="check-all" style="width:16px; height:16px; cursor:pointer;" onclick="toggleCheckAll(this)">
            </th>
            <th style="padding:16px 20px; font-size:12px; font-weight:800; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px;">Người gửi</th>
            <th style="padding:16px 20px; font-size:12px; font-weight:800; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px;">Email</th>
            <th style="padding:16px 20px; font-size:12px; font-weight:800; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px;">Lớp</th>
            <th style="padding:16px 20px; font-size:12px; font-weight:800; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px;">Thời gian</th>
            <th style="padding:16px 20px; font-size:12px; font-weight:800; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; text-align:center;">Thao tác</th>
          </tr>
        </thead>
        <tbody id="table-body">
          <!-- Rows -->
        </tbody>
      </table>
      </div>
      
      <!-- Pagination -->
      <div id="pagination-container" style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-top:1px solid var(--gray-200); background:#f8fafc;">
      </div>
    </div>
  `;
}

function loadData() {
  const pending = localStorage.getItem('_pendingForm');
  if (pending) {
    try {
      formInfo = JSON.parse(pending);
    } catch(e) {}
  }
  
  if (!formInfo.id) {
    window.location.href = 'feedback.html';
    return;
  }

  renderUI();
  fetchFeedbacks();
}

function fetchFeedbacks() {
  fetch(`${API}/feedback?form_id=${formInfo.id}`, {
    headers: authHeaders()
  })
  .then(res => res.json())
  .then(data => {
    if (data.message) {
      if (typeof showToast === 'function') showToast(data.message, 'error');
      console.error('API Error:', data.message);
      document.getElementById('total-count-badge').textContent = '0';
      document.getElementById('table-body').innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--gray-400);">' + data.message + '</td></tr>';
      return;
    }
    
    if (!Array.isArray(data)) {
      data = data.data || [];
    }

    allFeedbacks = data;
    
    // Populate classes
    const classes = new Set();
    data.forEach(d => { if (d.lop && d.lop !== '--') classes.add(d.lop); });
    const classSelect = document.getElementById('filter-class');
    if (classSelect) {
      if (classes.size === 0) {
        classSelect.style.display = 'none';
      } else {
        classSelect.style.display = 'block';
        classSelect.innerHTML = '<option value="all">Lớp học</option>' + 
          Array.from(classes).sort().map(c => `<option value="${c}">${c}</option>`).join('');
      }
    }

    document.getElementById('total-count-badge').textContent = data.length;
    filterData();
  })
  .catch(err => {
    console.error('Fetch error:', err);
    if (typeof showToast === 'function') showToast('Lỗi khi tải dữ liệu phản hồi', 'error');
    document.getElementById('total-count-badge').textContent = '0';
    const tbody = document.getElementById('table-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:#dc2626; font-weight:500;">Không thể tải dữ liệu: ' + err.message + '</td></tr>';
    }
  });
}

function filterData() {
  const searchTerm = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
  const classFilter = document.getElementById('filter-class')?.value || 'all';

  currentFilteredData = allFeedbacks.filter(f => {
    const matchSearch = !searchTerm || 
                        (f.ho_ten && f.ho_ten.toLowerCase().includes(searchTerm)) || 
                        (f.email && f.email.toLowerCase().includes(searchTerm)) ||
                        (f.ma_sv && f.ma_sv.toLowerCase().includes(searchTerm));
    const matchClass = classFilter === 'all' || f.lop === classFilter;
    return matchSearch && matchClass;
  });

  currentFeedbackPage = 1;
  renderTable();
}

function getSentimentUI(sentiment) {
  if (sentiment === 'Tích cực') {
    return { 
      bg: '#dcfce7', color: '#16a34a', border: '#86efac', 
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>' 
    };
  } else if (sentiment === 'Tiêu cực') {
    return { 
      bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', 
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="12" cy="12" r="10"></circle><path d="M16 16s-1.5-2-4-2-4 2-4 2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>' 
    };
  } else {
    // Trung lập
    return { 
      bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', 
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="14" x2="16" y2="14"></line><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>' 
    };
  }
}

function renderStars(rating) {
  const r = parseInt(rating) || 0;
  let html = '<div style="display:flex; gap:2px; color:#eab308;">'; // Yellow color
  for (let i = 1; i <= 5; i++) {
    if (i <= r) {
      html += '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
    } else {
      html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
    }
  }
  html += '</div>';
  return html;
}

function formatDate(ds) {
  if (!ds) return '';
  const d = new Date(ds.replace('Z', ''));
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  
  if (currentFilteredData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--gray-400);">Không có dữ liệu phản hồi nào.</td></tr>';
    renderPagination(0);
    return;
  }

  const startIdx = (currentFeedbackPage - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const pageData = currentFilteredData.slice(startIdx, endIdx);

  tbody.innerHTML = pageData.map((f, idx) => {
    const isLast = idx === pageData.length - 1;
    const borderB = isLast ? 'none' : '1px solid #f1f5f9';
    
    const name = f.ho_ten || 'Người dùng ẩn danh';
    const email = f.email || '';
    const isAnon = name === 'Người dùng ẩn danh' || name === 'Ẩn danh';
    const initial = isAnon ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' : name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'NA';
    const avatarColor = isAnon ? {bg: '#f1f5f9', color: '#64748b'} : getAvatarColor(name);
    const hasAvatarOrEmail = !isAnon && (f.avatar || email);
    const avatarSrc = f.avatar || (email ? `https://unavatar.io/${email}?fallback=false` : null);

    return `
      <tr style="border-bottom:${borderB}; transition:background 0.2s" onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='none'">
        <td style="padding:16px; text-align:center;">
          <input type="checkbox" class="row-check" value="${f.id}" style="width:16px; height:16px; cursor:pointer;" onclick="updateCheckAllState()">
        </td>
        <td style="padding:16px 20px;">
          <div style="display:flex; align-items:center; gap:12px;">
            ${hasAvatarOrEmail ? `
              <img src="${avatarSrc}" alt="Avatar" style="width:36px; height:36px; border-radius:50%; border:2px solid #3b0a99; object-fit:cover; flex-shrink:0;" onerror="this.onerror=null; this.outerHTML='<div style=\\'width:36px; height:36px; border-radius:50%; background:${avatarColor.bg}; color:${avatarColor.color}; border:2px solid #3b0a99; -webkit-print-color-adjust: exact; print-color-adjust: exact; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px; flex-shrink:0; box-sizing:border-box;\\'>${initial}</div>'">
            ` : `
              <div style="width:36px; height:36px; border-radius:50%; background:${avatarColor.bg}; color:${avatarColor.color}; border:2px solid #3b0a99; -webkit-print-color-adjust: exact; print-color-adjust: exact; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px; flex-shrink:0; box-sizing:border-box;">
                ${initial}
              </div>
            `}
            <div>
              <div style="font-weight:700; color:var(--gray-900); font-size:14px;">${name}</div>
            </div>
          </div>
        </td>
        <td style="padding:16px 20px; color:var(--gray-600); font-size:13px;">${isAnon ? '--' : (email || '--')}</td>
        <td style="padding:16px 20px; color:var(--gray-600); font-weight:600;">${f.lop || '--'}</td>
        <td style="padding:16px 20px; color:var(--gray-600); font-size:13px;">${formatDate(f.ngay_gui)}</td>
        <td style="padding:16px 20px; text-align:center;">
          <div style="display:flex; gap:12px; justify-content:center;">
            <button onclick="viewDetail(${f.id})" style="background:none; border:none; cursor:pointer; color:var(--gray-500);" onmouseover="this.style.color='var(--gray-800)'" onmouseout="this.style.color='var(--gray-500)'" title="Xem chi tiết">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button onclick="deleteFeedback(${f.id})" style="background:none; border:none; cursor:pointer; color:var(--gray-500);" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='var(--gray-500)'" title="Xóa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(currentFilteredData.length);
}

function renderPagination(totalItems) {
  const container = document.getElementById('pagination-container');
  if (!container) return;

  if (totalItems === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.style.background = '#fff';
  container.style.border = '1px solid var(--gray-200)';
  container.style.borderRadius = 'var(--radius-lg)';
  container.style.padding = '12px 18px';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'space-between';
  container.style.marginTop = '16px';
  container.style.boxShadow = 'var(--shadow-sm)';
  container.style.gap = '12px';
  container.style.flexWrap = 'wrap';

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIdx = (currentFeedbackPage - 1) * ITEMS_PER_PAGE + 1;
  const endIdx = Math.min(currentFeedbackPage * ITEMS_PER_PAGE, totalItems);

  let html = `<span style="font-size:13px;color:var(--gray-500)">Hiển thị <strong>${startIdx}-${endIdx}</strong> / <strong>${totalItems}</strong> kết quả</span>`;
  html += `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">`;
  html += `<button class="pag-btn" ${currentFeedbackPage === 1 ? 'disabled' : ''} onclick="changePage(-1)">Trước</button>`;
  
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentFeedbackPage - 1 && i <= currentFeedbackPage + 1)) {
      html += `<button class="pag-btn ${i === currentFeedbackPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    } else if (i === 2 && currentFeedbackPage > 3) {
      html += `<span style="color:var(--gray-400); font-weight:600; padding:0 4px; display:inline-flex; align-items:center;">...</span>`;
    } else if (i === totalPages - 1 && currentFeedbackPage < totalPages - 2) {
      html += `<span style="color:var(--gray-400); font-weight:600; padding:0 4px; display:inline-flex; align-items:center;">...</span>`;
    }
  }
  
  html += `<button class="pag-btn" ${currentFeedbackPage === totalPages ? 'disabled' : ''} onclick="changePage(1)">Sau</button>`;
  html += `</div>`;

  container.innerHTML = html;
}

function changePage(delta) {
  const totalPages = Math.ceil(currentFilteredData.length / ITEMS_PER_PAGE);
  const newPage = currentFeedbackPage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    currentFeedbackPage = newPage;
    renderTable();
  }
}

function goToPage(page) {
  currentFeedbackPage = page;
  renderTable();
}

function toggleCheckAll(checkbox) {
  const checkboxes = document.querySelectorAll('.row-check');
  checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

function updateCheckAllState() {
  const checkAll = document.getElementById('check-all');
  const checkboxes = document.querySelectorAll('.row-check');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  const someChecked = Array.from(checkboxes).some(cb => cb.checked);
  
  if (checkAll) {
    checkAll.checked = allChecked;
    checkAll.indeterminate = !allChecked && someChecked;
  }
}

function viewDetail(id) {
  fetch(`${API}/feedback/${id}/chitiet`, { headers: authHeaders() })
    .then(res => res.json())
    .then(data => {
      if (data.message) {
        if (typeof showToast === 'function') showToast(data.message, 'error');
        return;
      }
      
      const f = allFeedbacks.find(fb => fb.id === id) || {};
      const container = document.getElementById('page-content');
      
      const name = f.ho_ten || 'Người dùng ẩn danh';
      const email = f.email || 'Không có email';
      const className = f.lop || 'Không có lớp';
      const sentTime = formatDate(f.ngay_gui);
      const isAnon = name === 'Người dùng ẩn danh' || name === 'Ẩn danh';
      const avatarColors = isAnon ? {bg: '#f1f5f9', color: '#64748b'} : getAvatarColor(name);
      const initials = isAnon ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' : name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'NA';
      const hasAvatarOrEmail = !isAnon && (f.avatar || email);
      const avatarSrc = f.avatar || (email ? `https://unavatar.io/${email}?fallback=false` : null);
      
      // Store current answers for PDF Export
      window.currentDetailAnswers = data || [];
      
      // Setup history so back button works
      if (!history.state || history.state.view !== 'detail' || history.state.id !== id) {
        history.pushState({ view: 'detail', id: id }, '', '?view=detail&id=' + id);
      }

      let answersHtml = '';
      if (!data || data.length === 0) {
        answersHtml = '<div style="color:var(--gray-500); text-align:center; padding:20px;">Không có dữ liệu chi tiết.</div>';
      } else {
        answersHtml = data.map((item, idx) => {
          let ans = item.noi_dung_tra_loi || item.ten_lua_chon || '';
          try {
            if (typeof ans === 'string' && ans.startsWith('{') && ans.includes('"type"')) {
              const parsed = JSON.parse(ans);
              if (parsed.type === 'grid_radio' || parsed.type === 'grid_checkbox') {
                ans = `<div style="margin-top: 4px;"><span style="font-weight:600; color:var(--gray-600);">${parsed.row}</span>: <span style="font-weight:700; color:var(--gray-900);">${parsed.col}</span></div>`;
              }
            }
          } catch(e) {}
          let isRating = false;
          if (item.diem_danh_gia !== null && item.diem_danh_gia !== undefined) {
            ans = `${item.diem_danh_gia}/5 <span style="font-size:13px; color:var(--gray-500); margin-left:8px;">${item.diem_danh_gia >= 4 ? 'Khá Hài Lòng' : (item.diem_danh_gia <= 2 ? 'Không Hài Lòng' : 'Bình Thường')}</span>`;
            isRating = true;
          }
          
          return `
            <div style="display:flex; gap:16px; margin-bottom:24px; padding-bottom:24px; border-bottom:1px solid var(--gray-100);">
              <div style="height:36px; min-width:54px; padding:0 12px; border-radius:8px; background:#f1f5f9; color:var(--gray-600); font-weight:700; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0;">
                Câu ${idx + 1}
              </div>
              <div style="flex:1;">
                <div style="font-weight:700; color:var(--gray-900); font-size:15px; margin-bottom:12px; line-height:1.5;">${item.ten_cau_hoi || ''}</div>
                ${isRating ? `
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div style="display:flex; gap:4px; color:#fbbf24;">
                      ${Array.from({length: 5}, (_, i) => `<svg width="20" height="20" fill="${i < item.diem_danh_gia ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`).join('')}
                    </div>
                    <span style="font-weight:700; font-size:16px; color:var(--gray-900); margin-left:8px;">${ans}</span>
                  </div>
                ` : `
                  <div style="background:#f8fafc; padding:16px; border-radius:8px; font-size:14px; color:var(--gray-700); line-height:1.6; border:1px solid #e2e8f0;">
                    ${ans || '<span style="color:var(--gray-400);font-style:italic;">Không trả lời</span>'}
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('');
      }

      container.innerHTML = `
        <style>
          @media print {
            .no-print { display: none !important; }
            .sidebar { display: none !important; }
            .main-content { margin-left: 0 !important; width: 100% !important; padding: 0 !important; }
            header { display: none !important; }
            #page-content > div { display: block !important; }
            .print-border-0 { border: none !important; box-shadow: none !important; }
          }
        </style>
        <!-- Breadcrumb & Header -->
        <div class="no-print" style="position: sticky; top: 0; z-index: 50; background: #f8fafc; padding: 24px 4px 16px 4px; margin: -24px -4px 24px -4px; display:flex; align-items:flex-start; justify-content:space-between;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--gray-500); margin-bottom:12px;">
              <span style="cursor:pointer; transition:color 0.2s;" onmouseenter="this.style.color='var(--gray-800)'" onmouseleave="this.style.color='var(--gray-500)'" onclick="window.location.href='feedback.html'">Quản lý phản hồi</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"></polyline></svg>
              <span style="cursor:pointer; transition:color 0.2s;" onmouseenter="this.style.color='var(--gray-800)'" onmouseleave="this.style.color='var(--gray-500)'" onclick="history.back()">Danh sách phản hồi</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"></polyline></svg>
              <span style="color:var(--gray-900)">Chi tiết phản hồi</span>
            </div>
            <h2 style="font-size:28px; font-weight:800; color:var(--gray-900); margin:0 0 8px 0;">Chi tiết phản hồi</h2>
            <div style="font-size:15px; color:var(--gray-500); font-weight:500; margin-bottom:4px;">
              ${formInfo.name}
            </div>
          </div>
          <div style="display:flex; gap:12px;">
            <button onclick="exportDetailPDF(${f.id})" style="display:flex; align-items:center; gap:8px; height:40px; padding:0 16px; background:#3b0a99; border:none; color:#fff; border-radius:8px; font-weight:700; font-size:14px; cursor:pointer;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Xuất PDF
            </button>
            <button onclick="deleteFeedback(${f.id})" style="display:flex; align-items:center; gap:8px; height:40px; padding:0 16px; background:#fff; border:1px solid #fecaca; color:#dc2626; border-radius:8px; font-weight:700; font-size:14px; cursor:pointer;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='#fff'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              Xóa phản hồi
            </button>
          </div>
        </div>

        <div id="detail-print-area" style="display:flex; gap:24px; align-items:flex-start;">
          <div style="width:340px; flex-shrink:0; display:flex; flex-direction:column; gap:24px; position:sticky; top:120px;">
            <div class="print-border-0" style="background:#fff; border-radius:12px; border:1px solid var(--gray-200); padding:24px; box-shadow:var(--shadow-sm);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                <h3 style="font-size:18px; font-weight:700; color:var(--gray-900); margin:0;">Thông tin người gửi</h3>
                ${hasAvatarOrEmail ? `
                  <img src="${avatarSrc}" alt="Avatar" style="width:40px; height:40px; border-radius:50%; border:2px solid #3b0a99; object-fit:cover; flex-shrink:0;" onerror="this.onerror=null; this.outerHTML='<div style=\\'width:40px; height:40px; border-radius:50%; background:${avatarColors.bg}; color:${avatarColors.color}; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; border:2px solid #3b0a99; -webkit-print-color-adjust:exact; print-color-adjust:exact;\\'>${initials}</div>'">
                ` : `
                  <div style="width:40px; height:40px; border-radius:50%; background:${avatarColors.bg}; color:${avatarColors.color}; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; border:2px solid #3b0a99; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
                    ${initials}
                  </div>
                `}
              </div>
              <div style="display:flex; flex-direction:column; gap:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:14px;">
                  <span style="color:var(--gray-500);">Họ và tên</span>
                  <span style="font-weight:600; color:var(--gray-900); text-align:right;">${name}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:14px;">
                  <span style="color:var(--gray-500);">Lớp / Khóa học</span>
                  <span style="font-weight:600; color:var(--gray-900); text-align:right;">${className}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:14px;">
                  <span style="color:var(--gray-500);">Thời gian gửi</span>
                  <span style="font-weight:600; color:var(--gray-900); text-align:right;">${sentTime}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="print-border-0" style="flex:1; background:#fff; border-radius:12px; border:1px solid var(--gray-200); box-shadow:var(--shadow-sm); overflow:hidden;">
            <div style="padding:20px 24px; border-bottom:1px solid var(--gray-200); display:flex; justify-content:space-between; align-items:center; background:#fafafa;">
              <h3 style="font-size:18px; font-weight:700; color:var(--gray-900); margin:0;">Nội dung khảo sát</h3>
              <span style="background:#f1f5f9; color:var(--gray-600); padding:4px 12px; border-radius:16px; font-size:13px; font-weight:700;">
                ${data ? data.length : 0} Câu hỏi
              </span>
            </div>
            <div style="padding:24px; max-height: calc(100vh - 220px); overflow-y: auto;">
              ${answersHtml}
            </div>
          </div>
        </div>
      `;
      
      window.scrollTo(0, 0);
    })
    .catch(err => {
      console.error(err);
      if (typeof showToast === 'function') showToast('Lỗi khi tải chi tiết phản hồi', 'error');
    });
}

function deleteFeedback(id) {
  openDeleteFeedbackEntryModal([id], 'Bạn có chắc chắn muốn chuyển phản hồi này vào thùng rác không?');
}

function deleteAllFeedbacks() {
  const checked = Array.from(document.querySelectorAll('.row-check:checked')).map(cb => cb.value);
  if (checked.length === 0) {
    if (typeof showToast === 'function') showToast('Vui lòng chọn phản hồi cần xóa', 'warning');
    return;
  }
  
  openDeleteFeedbackEntryModal(checked, `Bạn đang thao tác xóa <strong>${checked.length} phản hồi</strong> đã chọn.<br>Các phản hồi này sẽ được chuyển vào thùng rác.`);
}

window.openDeleteFeedbackEntryModal = function(idsToDelete, deleteText) {
  let modal = document.getElementById('fb-entry-delete-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'fb-entry-delete-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:90%;max-width:450px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);transform:scale(0.95);transition:transform 0.2s;overflow:hidden;box-sizing:border-box;">
        <div style="padding:20px 24px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;border-radius:12px;background:#fee2e2;display:flex;align-items:center;justify-content:center;color:#ef4444;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </div>
            <div>
              <div style="font-size:16px;font-weight:700;color:var(--gray-800);">Xóa phản hồi</div>
              <div style="font-size:13px;color:#64748b;margin-top:2px;">Chuyển phản hồi vào thùng rác</div>
            </div>
          </div>
          <button onclick="closeDeleteFeedbackEntryModal()" style="width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748b;" onmouseenter="this.style.background='#e2e8f0'" onmouseleave="this.style.background='#f1f5f9'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div style="padding:24px;">
          <div id="fb-entry-del-text" style="font-size:14px;color:var(--gray-700);margin-bottom:16px;line-height:1.5;"></div>
          <div>
            <label style="display:block;font-size:13px;font-weight:600;color:var(--gray-700);margin-bottom:8px;">Lý do xóa (không bắt buộc)</label>
            <input type="text" id="fb-entry-del-reason" placeholder="Nhập lý do chuyển vào thùng rác..." style="width:100%;box-sizing:border-box;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:14.5px;color:var(--gray-800);outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#ef4444'" onblur="this.style.borderColor='#cbd5e1'">
          </div>
        </div>
        <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #f1f5f9;display:flex;justify-content:flex-end;gap:12px;">
          <button onclick="closeDeleteFeedbackEntryModal()" style="padding:8px 16px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font-size:14px;font-weight:600;color:var(--gray-700);cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='#fff'">Hủy bỏ</button>
          <button id="fb-entry-confirm-del-btn" style="padding:8px 16px;border-radius:10px;border:none;background:#ef4444;font-size:14px;font-weight:600;color:#fff;cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.background='#dc2626'" onmouseleave="this.style.background='#ef4444'">Chuyển thùng rác</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('fb-entry-del-text').innerHTML = deleteText;
  document.getElementById('fb-entry-del-reason').value = '';

  document.getElementById('fb-entry-confirm-del-btn').onclick = function () {
    executeDeleteFeedbackEntries(idsToDelete);
  };

  modal.style.display = 'flex';
  modal.offsetHeight; // reflow
  modal.style.opacity = '1';
  modal.children[0].style.transform = 'scale(1)';

  setTimeout(() => document.getElementById('fb-entry-del-reason').focus(), 250);
};

window.closeDeleteFeedbackEntryModal = function () {
  const modal = document.getElementById('fb-entry-delete-modal');
  if (modal) {
    modal.style.opacity = '0';
    modal.children[0].style.transform = 'scale(0.95)';
    setTimeout(() => modal.style.display = 'none', 200);
  }
};

window.executeDeleteFeedbackEntries = function (ids) {
  let reason = document.getElementById('fb-entry-del-reason').value.trim();
  if (!reason) reason = 'Không có lý do';

  closeDeleteFeedbackEntryModal();

  Promise.all(ids.map(id => 
    fetch(`${API}/feedback/${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ly_do_xoa: reason })
    })
  )).then(() => {
    if (typeof showToast === 'function') {
      showToast(ids.length > 1 ? 'Đã chuyển các phản hồi được chọn vào thùng rác' : 'Đã chuyển phản hồi vào thùng rác', 'success');
    }
    
    // Refresh the list
    if (typeof fetchFeedbacks === 'function') {
      fetchFeedbacks();
    }
    
    // If the detail view is currently open, close it and go back to list
    const detailView = document.getElementById('feedback-detail-view');
    if (detailView && detailView.style.display !== 'none') {
      detailView.style.display = 'none';
      const mainContent = document.querySelector('.card.card-body');
      if (mainContent) mainContent.style.display = 'block';
    }
  }).catch(err => {
    console.error(err);
    if (typeof showToast === 'function') showToast('Lỗi khi xóa phản hồi', 'error');
  });
}

function exportPDF() {
  const table = document.querySelector('table');
  if (!table) {
    if (typeof showToast === 'function') showToast('Không tìm thấy dữ liệu để xuất', 'warning');
    return;
  }
  
  const tableContent = table.outerHTML;
  const formName = formInfo.name || 'Biểu mẫu';
  
  // Create a hidden iframe for printing to avoid popup blockers and black screens
  let printFrame = document.getElementById('print-frame');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'print-frame';
    printFrame.style.position = 'absolute';
    printFrame.style.top = '-9999px';
    printFrame.style.width = '1px';
    printFrame.style.height = '1px';
    document.body.appendChild(printFrame);
  }
  
  const printDoc = printFrame.contentWindow.document;
  printDoc.open();
  printDoc.write(`
    <html>
      <head>
        <title>Danh sách phản hồi - ${formName}</title>
        <style>
          body { font-family: 'Roboto', sans-serif; padding: 20px; color: #333; background: #fff; }
          h2 { text-align: center; color: #3b0a99; margin-bottom: 5px; text-transform: uppercase; }
          .form-name { text-align: center; font-size: 16px; color: #666; margin-bottom: 20px; font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
          th { background: #f8fafc; color: #475569; font-weight: 600; text-align: left; padding: 12px; border: 1px solid #e2e8f0; }
          td { padding: 12px; border: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f9fafb; }
          /* Hide checkbox column and action column */
          th:first-child, td:first-child { display: none; }
          th:last-child, td:last-child { display: none; }
          
          @media print {
            body { padding: 0; }
            @page { margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        <h2>DANH SÁCH PHẢN HỒI</h2>
        <div class="form-name">${formName}</div>
        ${tableContent}
      </body>
    </html>
  `);
  printDoc.close();
  
  setTimeout(() => {
    printFrame.contentWindow.focus();
    printFrame.contentWindow.print();
  }, 250);
}

// Global popstate handler to fix browser back button
window.addEventListener('popstate', (e) => {
  if (e.state && e.state.view === 'detail') {
    viewDetail(e.state.id);
  } else {
    renderUI();
    filterData();
  }
});

window.exportDetailPDF = function(id) {
  const f = allFeedbacks.find(fb => fb.id === id) || {};
  const formName = formInfo.name || 'Biểu mẫu';
  
  const name = f.ho_ten || 'Người dùng ẩn danh';
  const className = f.lop || 'Không có lớp';
  const sentTime = formatDate(f.ngay_gui);
  
  let answersListHtml = (window.currentDetailAnswers || []).map((item, idx) => {
    let ans = item.noi_dung_tra_loi || item.ten_lua_chon || '<span style="color:#94a3b8; font-style:italic;">Không trả lời</span>';
    try {
      if (typeof ans === 'string' && ans.startsWith('{') && ans.includes('"type"')) {
        const parsed = JSON.parse(ans);
        if (parsed.type === 'grid_radio' || parsed.type === 'grid_checkbox') {
          ans = `<strong>${parsed.row}</strong>: ${parsed.col}`;
        }
      }
    } catch(e) {}
    if (item.diem_danh_gia !== null && item.diem_danh_gia !== undefined) {
      ans = `${item.diem_danh_gia}/5 - ${item.diem_danh_gia >= 4 ? 'Khá Hài Lòng' : (item.diem_danh_gia <= 2 ? 'Không Hài Lòng' : 'Bình Thường')}`;
    }
    return `
      <div class="q-block">
        <div class="q-title"><strong>Câu ${idx + 1}:</strong> ${item.ten_cau_hoi || ''}</div>
        <div class="q-ans">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" style="margin-right: 8px; margin-top: 4px; color: #94a3b8; flex-shrink: 0;"><polyline points="15 10 20 15 15 20"></polyline><path d="M4 4v7a4 4 0 0 0 4 4h12"></path></svg>
          <div style="flex:1;">${ans}</div>
        </div>
      </div>
    `;
  }).join('');
  
  if (!answersListHtml) answersListHtml = '<p>Không có dữ liệu chi tiết.</p>';

  const content = `
    <table class="info-table">
      <tr><th style="width:150px;">Họ và tên:</th><td>${name}</td></tr>
      <tr><th>Lớp / Khóa học:</th><td>${className}</td></tr>
      <tr><th>Thời gian gửi:</th><td>${sentTime}</td></tr>
    </table>
    <div class="answers-section">
      <h3>NỘI DUNG KHẢO SÁT</h3>
      ${answersListHtml}
    </div>
  `;
  
  let printFrame = document.getElementById('print-frame');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'print-frame';
    printFrame.style.position = 'absolute';
    printFrame.style.top = '-9999px';
    printFrame.style.width = '1px';
    printFrame.style.height = '1px';
    document.body.appendChild(printFrame);
  }
  
  const printDoc = printFrame.contentWindow.document;
  printDoc.open();
  printDoc.write(`
    <html>
      <head>
        <title>Chi tiết phản hồi - ${f.ho_ten || 'Ẩn danh'}</title>
        <style>
          body { font-family: 'Roboto', sans-serif; padding: 30px; color: #1e293b; background: #fff; line-height: 1.6; }
          h2 { text-align: center; color: #000; margin-bottom: 5px; text-transform: uppercase; font-size: 24px; }
          .form-name { text-align: center; font-size: 14px; color: #64748b; margin-bottom: 30px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .info-table th { text-align: left; padding: 8px 0; color: #475569; font-weight: bold; border-bottom: 1px solid #e2e8f0; }
          .info-table td { padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; }
          .answers-section h3 { font-size: 16px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 20px; color: #000; }
          .q-block { margin-bottom: 20px; }
          .q-title { font-weight: bold; margin-bottom: 6px; color: #0f172a; }
          .q-ans { padding-left: 10px; color: #334155; display: flex; align-items: flex-start; }
          @media print {
            body { padding: 0; }
            @page { margin: 2cm; }
          }
        </style>
      </head>
      <body>
        <h2>CHI TIẾT PHẢN HỒI</h2>
        <div class="form-name">${formName}</div>
        ${content}
      </body>
    </html>
  `);
  printDoc.close();
  
  setTimeout(() => {
    printFrame.contentWindow.focus();
    printFrame.contentWindow.print();
  }, 250);
};

document.addEventListener('DOMContentLoaded', loadData);