// Thiết lập giao diện tĩnh cho trang (Header, Bộ lọc, Bảng)
document.getElementById("page-content").innerHTML = `
  <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between">
    <div>
      <h2 class="page-title">Nhật ký hoạt động</h2>
      <p class="page-sub">Theo dõi lịch sử các thao tác liên quan đến biểu mẫu trên hệ thống</p>
    </div>
  </div>

  <div class="card card-body" style="margin-bottom:20px; display:flex; gap:12px; flex-wrap:wrap;">
    <div class="input-wrap" style="flex:1; min-width:260px;">
      <div class="input-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
      <input type="text" id="filter-search" class="input" placeholder="Tìm kiếm tên nhân viên hoặc tên biểu mẫu..." oninput="filterLogs()">
    </div>
    
    <select id="filter-action" class="input" style="width:220px;" onchange="filterLogs()">
      <option value="all">Tất cả hành động</option>
      <option value="create">Tạo mới</option>
      <option value="edit">Chỉnh sửa</option>
      <option value="delete">Xóa / Thùng rác</option>
      <option value="restore">Khôi phục</option>
      <option value="approve">Phê duyệt / Đổi trạng thái</option>
      <option value="reject">Từ chối</option>
    </select>

    <div id="filter-date-range" style="display:flex; align-items:center; gap:8px;">
      <span style="font-size:13px; font-weight:700; color:var(--gray-600); text-transform:uppercase;">TỪ:</span>
      <input type="date" id="filter-start-date" class="input" style="width:140px; padding:6px 12px" onchange="filterLogs()">
      <span style="font-size:13px; font-weight:700; color:var(--gray-600); text-transform:uppercase; margin-left:8px;">ĐẾN:</span>
      <input type="date" id="filter-end-date" class="input" style="width:140px; padding:6px 12px" onchange="filterLogs()">
    </div>
  </div>

  <div class="card">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width: 15%">Thời gian</th>
            <th style="width: 20%">Người thực hiện</th>
            <th style="width: 15%">Hành động</th>
            <th style="width: 25%">Biểu mẫu tác động</th>
            <th style="width: 25%">Chi tiết</th>
          </tr>
        </thead>
        <tbody id="log-table-body">
          <tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400)">Đang tải dữ liệu...</td></tr>
        </tbody>
      </table>
    </div>
    <div id="pagination-container" style="display:flex; justify-content:space-between; align-items:center; padding:16px; border-top:1px solid var(--gray-200); background:#fff; border-bottom-left-radius:12px; border-bottom-right-radius:12px;"></div>
  </div>
`;

// ── DATA LOADING ──────────────────────────────────────────────────
let auditLogsData = [];
const ITEMS_PER_PAGE = 10;

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loadAuditLogs() {
  const tbody = document.getElementById('log-table-body');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400)">Đang tải dữ liệu...</td></tr>';

  try {
    const search = document.getElementById('filter-search').value.trim();
    const action = document.getElementById('filter-action').value;
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (action && action !== 'all') params.append('action', action);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    // Call the real backend API
    const res = await fetch(`${API_BASE}/audit-logs?${params.toString()}`, {
      headers: authHeaders()
    });

    if (res.ok) {
      auditLogsData = await res.json();
    } else {
      auditLogsData = [];
    }
  } catch (err) {
    console.error('Failed to load audit logs:', err);
    auditLogsData = [];
  }

  currentFilteredData = auditLogsData;
  currentAuditPage = 1;
  renderLogsPage();
}

// Hàm logActivity dùng để gọi từ các file khác khi có thay đổi (POST api)
window.logActivity = async function (actionType, formId, formName, detail) {
  try {
    await fetch(`${API_BASE}/audit-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({ actionType, formId, formName, detail })
    });
  } catch (err) {
    console.error('Failed to log activity', err);
  }
};

let filterTimeout = null;
function handleFilterChange() {
  if (filterTimeout) clearTimeout(filterTimeout);
  filterTimeout = setTimeout(() => {
    loadAuditLogs();
  }, 300);
}

// Bind events to filter inputs
document.getElementById('filter-search').addEventListener('input', handleFilterChange);
document.getElementById('filter-action').addEventListener('change', handleFilterChange);
document.getElementById('filter-start-date').addEventListener('change', handleFilterChange);
document.getElementById('filter-end-date').addEventListener('change', handleFilterChange);

function getActionBadge(type) {
  let bgColor = '#e5e7eb';
  let color = '#374151';
  let label = type || 'Không xác định';

  const t = (type || '').toLowerCase();

  if (t === 'create' || t.includes('tạo')) {
    bgColor = '#e0e7ff'; color = '#00008B'; label = 'Tạo mới';
  } else if (t === 'edit' || t.includes('sửa') || t.includes('trả lời')) {
    bgColor = '#ffedd5'; color = '#c2410c'; 
    if(t === 'edit') label = 'Chỉnh sửa';
  } else if (t === 'delete' || t.includes('xóa')) {
    bgColor = '#fee2e2'; color = '#b91c1c';
    if(t === 'delete') label = 'Xóa';
  } else if (t === 'restore' || t.includes('khôi phục')) {
    bgColor = '#e0e7ff'; color = '#00008B';
    if(t === 'restore') label = 'Khôi phục';
  } else if (t === 'approve' || t.includes('duyệt')) {
    bgColor = '#dcfce7'; color = '#166534';
    if(t === 'approve') label = 'Phê duyệt';
  } else if (t === 'reject' || t.includes('từ chối')) {
    bgColor = '#fee2e2'; color = '#991b1b';
    if(t === 'reject') label = 'Từ chối';
  } else if (t === 'close' || t.includes('đóng')) {
    bgColor = '#f1f5f9'; color = '#475569';
    if(t === 'close') label = 'Đóng biểu mẫu';
  } else if (t.includes('lưu trữ')) {
    bgColor = '#f3e8ff'; color = '#7e22ce';
  }

  return `<span style="display:inline-block; padding:5px 10px; border-radius:6px; background-color:${bgColor}; color:${color}; font-size:13px; font-weight:600; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;" title="${label}">${label}</span>`;
}

function viewLogForm(formId, formName, actionType, detailStr) {
  if (detailStr && detailStr.toLowerCase().includes('vĩnh viễn')) {
    if (typeof showToast === 'function') {
      showToast('Biểu mẫu này đã bị xóa vĩnh viễn và không thể xem!', 'error');
    } else {
      alert('Biểu mẫu này đã bị xóa vĩnh viễn và không thể xem!');
    }
    return;
  }

  if (!formId || formId === 'undefined' || formId === 'null') {
    const forms = JSON.parse(localStorage.getItem('flic_forms') || '[]');
    const approvals = JSON.parse(localStorage.getItem('flic_approvals') || '[]');

    let found = forms.find(f => f.name === formName);
    if (!found) found = approvals.find(f => f.form === formName);

    if (found) formId = found.id || found.form_id || found._dbId;
  }

  if (formId && formId !== 'undefined' && formId !== 'null') {
    window.open('form-builder.html?form_id=' + formId, '_blank');
  } else {
    // Generate a dummy form so it doesn't show an error for mock data
    const newForm = {
      id: 'mock_form_' + Date.now(),
      name: formName,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responses: 0
    };
    const forms = JSON.parse(localStorage.getItem('flic_forms') || '[]');
    forms.push(newForm);
    localStorage.setItem('flic_forms', JSON.stringify(forms));
    window.open('form-builder.html?form_id=' + newForm.id, '_blank');
  }
}

// Render dữ liệu ra bảng
function renderLogs(data) {
  const tbody = document.getElementById('log-table-body');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400)">Không tìm thấy lịch sử hoạt động nào phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(log => {
    const dateObj = new Date(typeof log.time === 'string' ? log.time.replace('Z', '') : log.time);
    const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const formLinkHtml = `<a href="javascript:void(0)" onclick="viewLogForm('${log.formId || ''}', '${log.formName}', '${log.actionType}', '${log.detail.replace(/'/g, "\\'")}')" style="color:#00008B; text-decoration:none; font-weight:600;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${log.formName}</a>`;

    return `
        <tr>
          <td style="padding:16px;">
            <div style="font-weight:600; color:var(--gray-800); margin-bottom:2px;">${timeStr}</div>
            <div style="font-size:12px; color:var(--gray-500);">${dateStr}</div>
          </td>
          <td style="padding:16px;">
            <div style="font-weight:600; color:var(--gray-800); margin-bottom:2px;">${log.user}</div>
            <div style="font-size:12px; color:var(--gray-500);">${log.role}</div>
          </td>
          <td style="padding:16px;">
            ${getActionBadge(log.actionType)}
          </td>
          <td style="padding:16px;">
            ${formLinkHtml}
          </td>
          <td style="padding:16px; color:var(--gray-600); line-height:1.5;">
            ${log.detail}
          </td>
        </tr>
      `;
  }).join('');
}

function renderLogsPage() {
  const startIdx = (currentAuditPage - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const pageData = currentFilteredData.slice(startIdx, endIdx);

  renderLogs(pageData);
  renderAuditPagination(currentFilteredData.length);
}

function renderAuditPagination(totalItems) {
  const container = document.getElementById('pagination-container');
  if (!container) return;

  if (totalItems === 0) {
    container.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIdx = (currentAuditPage - 1) * ITEMS_PER_PAGE + 1;
  const endIdx = Math.min(currentAuditPage * ITEMS_PER_PAGE, totalItems);

  let html = `<span style="font-size:13px;color:var(--gray-500)">Hiển thị <strong>${startIdx}-${endIdx}</strong> / <strong>${totalItems}</strong> nhật ký</span>`;

  html += `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">`;
  html += `<button class="pag-btn" ${currentAuditPage <= 1 ? 'disabled' : ''} onclick="changeAuditPage(-1);window.scrollTo({ top: 0, behavior: 'smooth' });">Trước</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentAuditPage - 1 && i <= currentAuditPage + 1)) {
      html += `<button class="pag-btn ${i === currentAuditPage ? 'active' : ''}" onclick="goToAuditPage(${i});window.scrollTo({ top: 0, behavior: 'smooth' });">${i}</button>`;
    } else if (i === currentAuditPage - 2 || i === currentAuditPage + 2) {
      html += `<span style="color:var(--gray-400)">...</span>`;
    }
  }

  html += `<button class="pag-btn" ${currentAuditPage >= totalPages ? 'disabled' : ''} onclick="changeAuditPage(1);window.scrollTo({ top: 0, behavior: 'smooth' });">Sau</button>`;
  html += `</div>`;

  container.innerHTML = html;
}

window.changeAuditPage = function (dir) {
  const totalPages = Math.ceil(currentFilteredData.length / ITEMS_PER_PAGE);
  const newPage = currentAuditPage + dir;
  if (newPage >= 1 && newPage <= totalPages) {
    currentAuditPage = newPage;
    renderLogsPage();
  }
};

window.goToAuditPage = function (page) {
  currentAuditPage = page;
  renderLogsPage();
};

// Khởi chạy khi load trang
document.addEventListener('DOMContentLoaded', () => {
  loadAuditLogs().catch(console.error);
});

