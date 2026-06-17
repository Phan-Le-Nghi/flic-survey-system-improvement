// ═══════════════════════════════════════════════════════════════
//  FLIC – Quản lý Phản hồi (Table View)
// ═══════════════════════════════════════════════════════════════

const API = API_BASE;

let allForms = [];
let allFeedbacks = [];
let currentFilteredData = [];
let currentFormPage = 1;
const ITEMS_PER_PAGE = 10;

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Setup DOM
document.getElementById('page-content').innerHTML = `
  <div id="fb-view-forms">
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
      <div>
        <h2 class="page-title">Quản lý phản hồi</h2>
        <p class="page-sub">Xem và quản lý danh sách phản hồi từ khách hàng</p>
      </div>
    </div>

    <!-- Stat bar -->
    <div id="fb-stat-bar" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:24px"></div>

    <!-- Filter bar -->
    <div class="card card-body" style="margin-bottom:20px; display:flex; gap:16px; align-items:center; flex-wrap:wrap; padding:20px">
      <div class="input-wrap" style="flex:1; min-width:200px; position:relative;">
        <div class="input-icon" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--gray-400)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <input type="text" id="filter-search" class="input" placeholder="Tìm kiếm theo tên biểu mẫu..." oninput="filterData()" style="width:100%; padding-left:40px; height:40px;">
      </div>

      <div style="display:flex; align-items:center; gap:8px;">
        <select id="filter-category" class="input" style="width:160px; padding:6px 12px; height:40px;" onchange="filterData()">
          <option value="all">Danh mục (Tất cả)</option>
        </select>
      </div>
      
      <div style="display:flex; align-items:center; gap:8px;">
        <select id="filter-status" class="input" style="width:150px; padding:6px 12px; height:40px;" onchange="filterData()">
          <option value="all">Trạng thái (Tất cả)</option>
          <option value="active">Đang hoạt động</option>
          <option value="closed">Đã đóng</option>
        </select>
      </div>

      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:12px; font-weight:700; color:var(--gray-600);">Từ:</span>
        <input type="date" id="filter-start-date" class="input" style="width:125px; padding:6px 8px; height:40px;" onchange="filterData()">
        
        <span style="font-size:12px; font-weight:700; color:var(--gray-600); margin-left:4px;">Đến:</span>
        <input type="date" id="filter-end-date" class="input" style="width:125px; padding:6px 8px; height:40px;" onchange="filterData()">
      </div>
    </div>

    <!-- Table -->
    <div class="card" style="overflow:hidden; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05)">
      <div class="table-wrap">
        <table style="width:100%; border-collapse:collapse; text-align:left; table-layout:fixed;">
          <thead>
            <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
              <th style="padding:16px 20px; font-size:12px; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; width: 25%">TÊN BIỂU MẪU</th>
              <th style="padding:16px 20px; font-size:12px; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; width: 12%">DANH MỤC</th>
              <th style="padding:16px 20px; font-size:12px; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; width: 12%">ĐỐI TƯỢNG</th>
              <th style="padding:16px 20px; font-size:12px; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; width: 10%; text-align:center">PHẢN HỒI</th>
              <th style="padding:16px 20px; font-size:12px; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; width: 15%">TRẠNG THÁI</th>
              <th style="padding:16px 20px; font-size:12px; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; width: 10%">NGÀY TẠO</th>
              <th style="padding:16px 20px; font-size:12px; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; width: 10%">NGÀY ĐÓNG</th>
              <th style="padding:16px 20px; font-size:12px; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; width: 6%; text-align:center">THAO TÁC</th>
            </tr>
          </thead>
          <tbody id="table-body">
            <tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400)">Đang tải dữ liệu...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="pagination-container" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-top:1px solid var(--gray-200); background:#fff; gap:12px; flex-wrap:wrap"></div>
    </div>
  </div>
`;

// Data Loading & Filtering
async function loadFeedbackData() {
  const tbody = document.getElementById('table-body');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400)">Đang tải dữ liệu...</td></tr>';

  try {
    const resForms = await fetch(`${API}/forms`, { headers: authHeaders() });
    if (resForms.ok) {
      allForms = await resForms.json();
    } else {
      allForms = [];
    }

    const resFb = await fetch(`${API}/feedback`, { headers: authHeaders() });
    if (resFb.ok) {
      allFeedbacks = await resFb.json();
    } else {
      allFeedbacks = [];
    }
  } catch (err) {
    console.error('Failed to load feedback data:', err);
    allForms = [];
    allFeedbacks = [];
  }

  const categories = [...new Set(allForms.map(f => f.danh_muc).filter(Boolean))];
  const catSelect = document.getElementById('filter-category');
  if (catSelect) {
    catSelect.innerHTML = '<option value="all">Danh mục (Tất cả)</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  // Calculate stats
  const totalFeedback = allFeedbacks.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newToday = allFeedbacks.filter(f => {
    if (!f.ngay_gui) return false;
    const d = new Date(f.ngay_gui);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }).length;
  const activeForms = allForms.filter(f => f.trang_thai === 'active').length;

  renderStatCards(totalFeedback, newToday, activeForms);
  filterData();
}

function renderStatCards(totalFb, newToday, activeForms) {
  const container = document.getElementById('fb-stat-bar');
  if (!container) return;
  const stats = [
    { label: 'Tổng số phản hồi', value: totalFb.toLocaleString('en-US'), bg: '#e0e7ff', color: '#00008B', icon: '<path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>' },
    { label: 'Phản hồi mới hôm nay', value: newToday.toLocaleString('en-US'), bg: '#dbeafe', color: '#2563eb', icon: '<path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />' },
    { label: 'Biểu mẫu đang hoạt động', value: activeForms.toLocaleString('en-US'), bg: '#e0f2fe', color: '#0284c7', icon: '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />' }
  ];

  container.innerHTML = stats.map(s => `
    <div style="background:#fff; border-radius:12px; padding:24px; display:flex; align-items:center; gap:16px; border:1px solid var(--gray-200); box-shadow:var(--shadow-sm); border-left: 4px solid ${s.color};">
      <div style="width:52px;height:52px;border-radius:12px;background:${s.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg viewBox="0 0 24 24" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">${s.icon}</svg>
      </div>
      <div>
        <div style="font-size:13px;color:var(--gray-600);font-weight:700;margin-bottom:6px">${s.label}</div>
        <div style="font-size:26px;font-weight:800;color:var(--gray-800);line-height:1">${s.value}</div>
      </div>
    </div>
  `).join('');
}

function filterData() {
  const search = document.getElementById('filter-search').value.trim().toLowerCase();
  const startDateStr = document.getElementById('filter-start-date').value;
  const endDateStr = document.getElementById('filter-end-date').value;
  const status = document.getElementById('filter-status').value;
  const category = document.getElementById('filter-category') ? document.getElementById('filter-category').value : 'all';

  const startD = startDateStr ? new Date(startDateStr) : null;
  const endD = endDateStr ? new Date(endDateStr) : null;
  if (startD) startD.setHours(0, 0, 0, 0);
  if (endD) endD.setHours(23, 59, 59, 999);

  currentFilteredData = allForms.filter(f => {
    if (search && !(f.ten_form || '').toLowerCase().includes(search)) return false;

    if (category !== 'all' && (f.danh_muc || '') !== category) return false;

    const st = f.trang_thai === 'active' ? 'active' : 'closed';
    if (status !== 'all' && st !== status) return false;

    if (startD || endD) {
      if (!f.ngay_tao) return false;
      const d = new Date(f.ngay_tao);
      if (startD && d < startD) return false;
      if (endD && d > endD) return false;
    }

    return true;
  });

  currentFormPage = 1;
  renderTablePage();
}

function renderTablePage() {
  const startIdx = (currentFormPage - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const pageData = currentFilteredData.slice(startIdx, endIdx);

  renderTable(pageData);
  renderPagination(currentFilteredData.length);
}

function renderTable(data) {
  const tbody = document.getElementById('table-body');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400)">Không tìm thấy biểu mẫu nào phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((f, idx) => {
    const isAct = f.trang_thai === 'active';
    const statusHtml = isAct
      ? '<span style="display:inline-flex;justify-content:center;align-items:center;width:115px;padding:4px 0;background:#f0fdf4;color:#16a34a;border:1px solid #22c55e;border-radius:20px;font-size:12px;font-weight:700">Đang hoạt động</span>'
      : '<span style="display:inline-flex;justify-content:center;align-items:center;width:115px;padding:4px 0;background:#fef2f2;color:#dc2626;border:1px solid #ef4444;border-radius:20px;font-size:12px;font-weight:700">Đã đóng</span>';

    const isLast = idx === data.length - 1;
    const borderB = isLast ? 'none' : '1px solid #f1f5f9';

    return `
      <tr style="border-bottom:${borderB}; transition:background 0.2s" onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='none'">
        <td style="padding:16px 20px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:700; color:var(--gray-900); cursor:pointer;" onmouseover="this.style.color='#00008B'" onmouseout="this.style.color='var(--gray-900)'" onclick="viewFormFeedbacks(${f.id}, '${(f.ten_form || '').replace(/'/g, "\\'")}')">
          ${f.ten_form || ''}
        </td>
        <td style="padding:16px 20px;color:var(--gray-600);font-weight:500">${f.danh_muc || ''}</td>
        <td style="padding:16px 20px;color:var(--gray-600)">${f.doi_tuong || 'Tất cả'}</td>
        <td style="padding:16px 20px;font-weight:700;color:var(--gray-800);text-align:center">${f.so_phan_hoi || 0}</td>
        <td style="padding:16px 20px">${statusHtml}</td>
        <td style="padding:16px 20px;color:var(--gray-600);font-size:13.5px">${formatDate(f.ngay_tao)}</td>
        <td style="padding:16px 20px;color:var(--gray-600);font-size:13.5px">${formatDate(f.ngay_dong)}</td>
        <td style="padding:16px 20px;">
          <div style="display:flex;gap:12px;align-items:center;justify-content:center">
            <button onclick="viewFormFeedbacks(${f.id}, '${(f.ten_form || '').replace(/'/g, "\\'")}')" style="background:none;border:none;cursor:pointer;color:var(--gray-500)" title="Xem phản hồi" onmouseover="this.style.color='var(--gray-800)'" onmouseout="this.style.color='var(--gray-500)'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button onclick="deleteFormFeedback(${f.id}, '${(f.ten_form || '').replace(/'/g, "\\'")}')" style="background:none;border:none;cursor:pointer;color:var(--gray-500)" title="Xóa biểu mẫu" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='var(--gray-500)'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination(totalItems) {
  const container = document.getElementById('pagination-container');
  if (!container) return;

  if (totalItems === 0) {
    container.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIdx = (currentFormPage - 1) * ITEMS_PER_PAGE + 1;
  const endIdx = Math.min(currentFormPage * ITEMS_PER_PAGE, totalItems);

  container.innerHTML = `
    <span style="font-size:13px;color:var(--gray-500)">Hiển thị <strong>${startIdx}-${endIdx}</strong> / <strong>${totalItems}</strong> biểu mẫu</span>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
      <button class="pag-btn" ${currentFormPage === 1 ? 'disabled' : ''} onclick="changePage(-1)">Trước</button>
      ${Array.from({ length: totalPages }, (_, i) => {
    const page = i + 1;
    return '<button class="pag-btn ' + (page === currentFormPage ? 'active' : '') + '" onclick="goToPage(' + page + ')">' + page + '</button>';
  }).join('')}
      <button class="pag-btn" ${currentFormPage === totalPages ? 'disabled' : ''} onclick="changePage(1)">Sau</button>
    </div>
  `;
}

function changePage(delta) {
  const totalPages = Math.ceil(currentFilteredData.length / ITEMS_PER_PAGE);
  const newPage = currentFormPage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    currentFormPage = newPage;
    renderTablePage();
  }
}

function goToPage(page) {
  currentFormPage = page;
  renderTablePage();
}

// Action handlers
function viewFormFeedbacks(formId, formName) {
  localStorage.setItem('_pendingForm', JSON.stringify({ id: formId, name: formName }));
  window.location.href = 'feedback-detail.html';
}

function deleteFormFeedback(formId, formName) {
  window.openDeleteFeedbackModal(formId, formName);
}

window.openDeleteFeedbackModal = function(formId, formName) {
  let modal = document.getElementById('fb-delete-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'fb-delete-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:90%;max-width:450px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);transform:scale(0.95);transition:transform 0.2s;overflow:hidden;box-sizing:border-box;">
        <div style="padding:20px 24px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;border-radius:10px;background:#fef2f2;display:flex;align-items:center;justify-content:center;color:#ef4444">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </div>
            <div>
              <div style="font-size:18px;font-weight:800;color:var(--gray-900);">Xóa biểu mẫu</div>
              <div style="font-size:13px;color:#64748b;margin-top:2px;">Chuyển biểu mẫu vào thùng rác</div>
            </div>
          </div>
          <button onclick="closeDeleteFeedbackModal()" style="width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748b;" onmouseenter="this.style.background='#e2e8f0'" onmouseleave="this.style.background='#f1f5f9'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div style="padding:24px;">
          <p style="font-size:14px;color:var(--gray-700);margin:0 0 16px 0;line-height:1.5">Bạn có chắc chắn muốn xóa biểu mẫu <strong id="fb-del-name" style="color:var(--gray-900)"></strong>? Biểu mẫu sẽ tự động xóa vĩnh viễn sau 30 ngày.</p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label style="font-size:13px;font-weight:700;color:var(--gray-700)">Lý do xóa</label>
            <input type="text" id="fb-del-reason" placeholder="Vui lòng nhập lý do xóa..." style="width:100%;box-sizing:border-box;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#94a3b8'" onblur="this.style.borderColor='#cbd5e1'">
          </div>
        </div>
        <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #f1f5f9;display:flex;justify-content:flex-end;gap:12px;">
          <button onclick="closeDeleteFeedbackModal()" style="padding:8px 16px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font-size:14px;font-weight:600;color:var(--gray-700);cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='#fff'">Hủy bỏ</button>
          <button id="fb-confirm-del-btn" style="padding:8px 16px;border-radius:10px;border:none;background:#ef4444;font-size:14px;font-weight:600;color:#fff;cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.background='#dc2626'" onmouseleave="this.style.background='#ef4444'">Xóa biểu mẫu</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('fb-del-name').textContent = formName;
  document.getElementById('fb-del-reason').value = '';
  document.getElementById('fb-del-reason').style.borderColor = '#cbd5e1';
  document.getElementById('fb-confirm-del-btn').onclick = function() {
    executeDeleteFeedback(formId);
  };
  
  modal.style.display = 'flex';
  modal.offsetHeight; // reflow
  modal.style.opacity = '1';
  modal.children[0].style.transform = 'scale(1)';
  
  setTimeout(() => document.getElementById('fb-del-reason').focus(), 250);
};

window.closeDeleteFeedbackModal = function() {
  const modal = document.getElementById('fb-delete-modal');
  if (modal) {
    modal.style.opacity = '0';
    modal.children[0].style.transform = 'scale(0.95)';
    setTimeout(() => modal.style.display = 'none', 200);
  }
};

window.executeDeleteFeedback = function(formId) {
  let reason = document.getElementById('fb-del-reason').value.trim();
  if (!reason) {
    reason = 'Không có lý do';
  }
  
  closeDeleteFeedbackModal();
  
  fetch(`${API}/forms/${formId}`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ly_do_xoa: reason })
  }).then(res => {
    if (res.ok) {
      if (typeof showToast === 'function') showToast('Đã chuyển biểu mẫu vào thùng rác', 'success');
      loadFeedbackData();
    } else {
      if (typeof showToast === 'function') showToast('Xóa biểu mẫu thất bại', 'error');
    }
  }).catch(err => console.error(err));
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadFeedbackData();
});