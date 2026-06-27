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
      <option value="delete">Xóa</option>
      <option value="restore">Khôi phục</option>
      <option value="approve">Phê duyệt</option>
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
      <table style="width:100%;text-align:center;border-collapse:collapse;table-layout:fixed; min-width: 900px;">
        <thead>
          <tr>
            <th class="sticky-col-left" style="width: 12%; text-align:center;">Thời gian</th>
            <th style="width: 18%; text-align:center;">Người thực hiện</th>
            <th style="width: 12%; text-align:center;">Hành động</th>
            <th style="width: 28%; text-align:center;">Biểu mẫu tác động</th>
            <th class="sticky-col-right" style="width: 30%; text-align:center;">Chi tiết</th>
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

// (logActivity has been moved to main.js)

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
  let borderColor = '#d1d5db';
  let label = type || 'Không xác định';
  let badgeStyle = 'gap:4px; padding:4px 11px; border-radius:999px; font-size:12.5px; font-weight:600; width:120px; text-align:center;';

  const t = (type || '').toLowerCase();

  if (t === 'create' || t.includes('tạo')) {
    bgColor = '#e0e7ff'; color = '#0250AD'; borderColor = '#a5b4fc'; label = '+ Tạo mới';
  } else if (t === 'edit' || t === 'update' || t.includes('sửa') || t.includes('trả lời')) {
    bgColor = '#fff7ed'; color = '#FA7413'; borderColor = '#fed7aa';
    if (t === 'edit' || t === 'update') label = '✎ Chỉnh sửa';
  } else if (t === 'delete' || t === 'hard_delete' || t.includes('xóa')) {
    bgColor = '#fef2f2'; color = '#dc2626'; borderColor = '#ef4444';
    label = '🗑 Xóa';
  } else if (t === 'restore' || t.includes('khôi phục')) {
    bgColor = '#eff6ff'; color = '#1e40af'; borderColor = '#93c5fd';
    label = '↺ Khôi phục';
  } else if (t === 'approve' || t.includes('duyệt')) {
    bgColor = '#dcfce7'; color = '#166534'; borderColor = '#86efac';
    label = '✓ Phê duyệt';
  } else if (t === 'reject' || t.includes('từ chối')) {
    bgColor = '#fef08a'; color = '#FA7413'; borderColor = '#fde047';
    label = '✗ Từ chối';
  } else if (t === 'login' || t.includes('đăng nhập')) {
    bgColor = '#e0f2fe'; color = '#0369a1'; borderColor = '#7dd3fc';
    label = 'Đăng nhập';
  } else if (t === 'export' || t.includes('xuất')) {
    bgColor = '#fef08a'; color = '#FA7413'; borderColor = '#fde047';
    label = '⬇ Xuất dữ liệu';
  } else if (t === 'close' || t.includes('đóng')) {
    bgColor = '#f1f5f9'; color = '#475569'; borderColor = '#cbd5e1';
    if (t === 'close') label = 'Đóng biểu mẫu';
  } else if (t.includes('lưu trữ')) {
    bgColor = '#f3e8ff'; color = '#7e22ce'; borderColor = '#d8b4fe';
  }

  return `<span style="display:inline-flex; align-items:center; justify-content:center; ${badgeStyle} background-color:${bgColor}; color:${color}; border:1px solid ${borderColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${label.replace(/"/g, '&quot;')}">${label}</span>`;
}

// Global click listener for view log form links to avoid inline onclick syntax errors
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.view-log-form-btn');
  if (btn) {
    viewLogForm(btn.dataset.formid, btn.dataset.formname, btn.dataset.action, btn.dataset.detail);
  }
});

function viewLogForm(formId, formName, actionType, detailStr) {
  if (formName === 'Biểu mẫu đã xóa' || formName === 'Phản hồi từ biểu mẫu đã xóa' || formName === 'Nhiều biểu mẫu' || formName === 'Hệ thống' || formName === 'Thư viện câu hỏi') {
    if (typeof showToast === 'function') {
      showToast('Không thể mở liên kết này!', 'error');
    } else {
      alert('Không thể mở liên kết này!');
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

    let displayDetail = log.detail || '';
    if (displayDetail.includes(' - lý do: ')) {
      displayDetail = displayDetail.replace(' - lý do: ', ' (Lý do: ') + ')';
    }

    const tAct = (log.actionType || '').toLowerCase();
    if (tAct === 'approve' || tAct.includes('duyệt')) {
      displayDetail = 'Chuyển từ trạng thái chờ duyệt sang trạng thái phê duyệt';
    } else if (tAct === 'reject' || tAct.includes('từ chối')) {
      if (!displayDetail.includes('Chuyển từ trạng thái chờ duyệt sang trạng thái từ chối')) {
        let reasonMatch = displayDetail.match(/lý do:\s*(.*)/i);
        let reason = reasonMatch ? reasonMatch[1].replace(/\)$/, '').trim() : '';
        displayDetail = `Chuyển từ trạng thái chờ duyệt sang trạng thái từ chối${reason ? ` (Lý do: ${reason})` : ''}`;
      }
    }

    const formNameSafe = (log.formName || '').replace(/"/g, '&quot;');
    const detailSafe = (log.detail || '').replace(/"/g, '&quot;');
    const formLinkHtml = `<a href="javascript:void(0)" class="view-log-form-btn" data-formid="${log.formId || ''}" data-formname="${formNameSafe}" data-action="${log.actionType}" data-detail="${detailSafe}" style="color:#0250AD; text-decoration:none; font-size:14.5px; font-weight:600;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${log.formName}</a>`;

    return `
        <tr>
          <td style="padding:16px;">
            <div style="font-weight:600; color:var(--gray-800); margin-bottom:2px;">${timeStr}</div>
            <div style="font-size:12px; color:var(--gray-500);">${dateStr}</div>
          </td>
          <td style="padding:16px;">
            <div style="font-weight:600; color:var(--gray-800); margin-bottom:2px;">${log.user}</div>
            <div style="font-size:12px; color:var(--gray-500);">${log.role === 'admin' || log.role === 'manager' ? 'Quản lý' : log.role === 'staff' ? 'Nhân viên' : log.role}</div>
          </td>
          <td style="padding:16px;">
            ${getActionBadge(log.actionType)}
          </td>
          <td style="padding: 16px 16px 16px 70px; text-align:left;">
            ${formLinkHtml}
          </td>
          <td style="padding: 16px 16px 16px 110px; text-align:left; color:var(--gray-600); line-height:1.5;">
            ${displayDetail}
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
    if (totalPages <= 7) {
      html += `<button class="pag-btn ${i === currentAuditPage ? 'active' : ''}" onclick="goToAuditPage(${i});window.scrollTo({ top: 0, behavior: 'smooth' });">${i}</button>`;
    } else {
      if (i === 1 || i === totalPages || (i >= currentAuditPage - 2 && i <= currentAuditPage + 2)) {
        html += `<button class="pag-btn ${i === currentAuditPage ? 'active' : ''}" onclick="goToAuditPage(${i});window.scrollTo({ top: 0, behavior: 'smooth' });">${i}</button>`;
      } else if (i === currentAuditPage - 3 || i === currentAuditPage + 3) {
        html += `<span style="color:var(--gray-400)">...</span>`;
      }
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
