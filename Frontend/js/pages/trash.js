// ── Thùng rác - Trash Management ──────────────────────────────────

function normalizeApprovalFormName(value) {
  return String(value || '').trim().toLowerCase();
}

function removeApprovalsByForm(formRef) {
  try {
    const approvals = JSON.parse(localStorage.getItem('flic_approvals') || '[]');
    const formId = String(typeof formRef === 'object' ? formRef?.id ?? '' : formRef ?? '');
    const formName = normalizeApprovalFormName(typeof formRef === 'object' ? formRef?.name : '');
    const next = approvals.filter((a) =>
      String(a.id) !== formId &&
      String(a.form_id ?? '') !== formId &&
      String(a._dbId ?? '') !== formId &&
      (!formName || normalizeApprovalFormName(a.form) !== formName)
    );
    localStorage.setItem('flic_approvals', JSON.stringify(next));
  } catch (e) { }
}

function daysLeft(deletedAt) {
  const ms = (new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000) - Date.now();
  let days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days > 30) days = 30;
  if (days < 0) days = 0;
  return days;
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── State ────────────────────────────────────────────────────────
let trashItems = [];
let trashTab = 'forms';
let trashSearchQuery = '';
let trashDateFilter = '';
let trashCustomStartDate = '';
let trashCustomEndDate = '';
let trashCurrentPage = 1;
const trashItemsPerPage = 10;
let trashSelectedIds = new Set();
let trashSearchTimeout = null;
let isDeleteMode = false;
let trashCategoryFilter = '';

function switchTrashTab(tab) {
  trashTab = tab;
  trashSearchQuery = '';
  trashDateFilter = '';
  trashCurrentPage = 1;
  trashSelectedIds.clear();
  isDeleteMode = false;
  loadTrashData();
}

function handleTrashCategoryChange(val) {
  trashCategoryFilter = val;
  trashCurrentPage = 1;
  renderTrashTableOnly();
}

// ── Render page layout ───────────────────────────────────────────
function initTrashPage() {
  document.getElementById('page-content').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h2 class="page-title">Thùng rác</h2>
        <p class="page-sub">Các biểu mẫu đã xóa sẽ tự động xóa vĩnh viễn sau 30 ngày</p>
      </div>
      <div style="display:flex;gap:12px;" id="trash-action-buttons">
        <button id="btn-delete-all" class="btn" style="background:linear-gradient(135deg, #fee2e2, #fecaca); color:#991b1b; border:1px solid #fecaca; font-weight:600; padding:8px 16px; border-radius:12px; display:inline-flex; align-items:center; gap:8px; transition:all 0.2s;" onmouseenter="this.style.boxShadow='0 4px 12px rgba(220,38,38,0.15)'" onmouseleave="this.style.boxShadow='none'" onclick="toggleDeleteMode()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          Xóa tất cả
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div style="display:flex; gap:24px; margin-bottom:20px; border-bottom:1px solid var(--gray-200);">
      <div onclick="switchTrashTab('forms')" id="tab-forms" style="padding:12px 0; cursor:pointer; font-weight:700; color:${trashTab === 'forms' ? 'var(--primary)' : 'var(--gray-500)'}; border-bottom:3px solid ${trashTab === 'forms' ? 'var(--primary)' : 'transparent'};">Biểu mẫu</div>
      <div onclick="switchTrashTab('feedbacks')" id="tab-feedbacks" style="padding:12px 0; cursor:pointer; font-weight:700; color:${trashTab === 'feedbacks' ? 'var(--primary)' : 'var(--gray-500)'}; border-bottom:3px solid ${trashTab === 'feedbacks' ? 'var(--primary)' : 'transparent'};">Phản hồi</div>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom:20px;border:1px solid var(--gray-200);${trashTab === 'feedbacks' ? 'display:none;' : ''}">
      <div class="card-body" style="padding:14px 20px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <div class="input-wrap" style="flex:1;min-width:220px">
            <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
            <input type="text" class="input" placeholder="Tìm kiếm biểu mẫu trong thùng rác..." style="background:#f8fafc" id="trash-search-input" value="${trashSearchQuery}" oninput="handleTrashSearch(this.value)">
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <select id="trash-category-filter" class="input" style="width:auto;background:#f8fafc" onchange="handleTrashCategoryChange(this.value)">
              <option value="">Tất cả danh mục</option>
              <option value="ngoại ngữ" ${trashCategoryFilter === 'ngoại ngữ' ? 'selected' : ''}>Ngoại ngữ</option>
              <option value="tin học" ${trashCategoryFilter === 'tin học' ? 'selected' : ''}>Tin học</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Table content -->
    <div style="margin-top:24px; padding:0 4px;">
      <div id="trash-count" style="font-size:14px;font-weight:600;color:var(--gray-500);margin-bottom:16px;padding-left:4px;"></div>
      <div id="trash-list-container" class="card" style="overflow:hidden; border-radius:20px; box-shadow: 0 10px 30px rgba(0,0,139,0.04); border:1px solid rgba(0,0,139,0.06);">
        <div style="text-align:center;padding:80px;color:var(--gray-400)">Đang tải...</div>
      </div>
      <div id="trash-pagination" style="background:#fff;border:1px solid rgba(0,0,139,0.08);border-radius:16px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;margin-top:20px;box-shadow:0 8px 24px rgba(0,0,139,0.03);gap:12px;flex-wrap:wrap"></div>
    </div>
  `;
}

function handleTrashSearch(val) {
  trashSearchQuery = val;
  if (trashSearchTimeout) clearTimeout(trashSearchTimeout);
  trashSearchTimeout = setTimeout(() => {
    trashCurrentPage = 1;
    loadTrashData();
  }, 400);
}

function handleTrashFilterChange(val) {
  trashDateFilter = val;
  const customDateWrap = document.getElementById('trash-custom-date');
  if (val === 'custom') {
    customDateWrap.style.display = 'flex';
  } else {
    customDateWrap.style.display = 'none';
    trashCurrentPage = 1;
    loadTrashData();
  }
}

function handleCustomDateChange() {
  trashCustomStartDate = document.getElementById('trash-start-date').value;
  trashCustomEndDate = document.getElementById('trash-end-date').value;
  trashCurrentPage = 1;
  loadTrashData();
}

// ── Data Loading ─────────────────────────────────────────────────
async function loadTrashData() {
  if (!document.getElementById('trash-list-container')) {
    initTrashPage();
  }

  try {
    let url = trashTab === 'forms' ? `${API_BASE}/forms/trash/list?` : `${API_BASE}/feedback/trash/list?`;
    const params = new URLSearchParams();
    if (trashTab === 'forms') {
      if (trashSearchQuery) params.append('search', trashSearchQuery);
      if (trashDateFilter) params.append('filter', trashDateFilter);
      if (trashDateFilter === 'custom') {
        if (trashCustomStartDate) params.append('start_date', trashCustomStartDate);
        if (trashCustomEndDate) params.append('end_date', trashCustomEndDate);
      }
    }

    const res = await fetch(url + params.toString(), { headers: authHeaders() });
    if (res.ok) {
      const dbItems = await res.json();
      if (trashTab === 'forms') {
        trashItems = dbItems.map(f => ({
          id: String(f.id),
          name: f.ten_form,
          cat: f.danh_muc || '',
          deletedBy: f.nguoi_xoa || f.nguoi_tao || 'Hệ thống',
          deletedAt: new Date(f.deleted_at || f.ngay_xoa || f.ngay_cap_nhat || Date.now()).getTime(),
          deleteReason: f.ly_do_xoa || 'Không có lý do'
        }));
      } else {
        trashItems = dbItems.map(f => ({
          id: String(f.form_id),
          name: f.ten_form || 'Biểu mẫu đã xóa',
          deletedCount: f.so_phan_hoi_xoa,
          deletedAt: new Date(f.ngay_xoa_gannhat || Date.now()).getTime(),
          deleteReason: 'Không có lý do' // Phản hồi không lưu lý do theo từng bản ghi trong thùng rác chung
        }));
      }
    } else {
      trashItems = [];
    }
  } catch (e) {
    trashItems = [];
    console.error('Failed to load trash list', e);
  }

  renderTrash();
}

// ── Render Table ──────────────────────────────────────────────────
function toggleSelectAllTrash(e) {
  if (e.target.checked) {
    trashItems.filter(f => daysLeft(f.deletedAt) > 0).forEach(f => trashSelectedIds.add(String(f.id)));
  } else {
    trashSelectedIds.clear();
  }
  updateTrashActionButtons();
  renderTrashTableOnly();
}

function toggleTrashItem(id, checked) {
  if (checked) trashSelectedIds.add(String(id));
  else trashSelectedIds.delete(String(id));
  updateTrashActionButtons();
  renderTrashTableOnly();
}

function updateTrashActionButtons() {
  const container = document.getElementById('trash-action-buttons');
  if (!container) return;
  
  if (isDeleteMode) {
    const hasSelected = trashSelectedIds.size > 0;
    container.innerHTML = `
      <button class="btn" style="background:#f8fafc; color:#475569; border:1px solid #e2e8f0; font-weight:600; padding:8px 16px; border-radius:12px; transition:all 0.2s;" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='#f8fafc'" onclick="cancelDeleteMode()">
        Hủy
      </button>
      <button id="btn-confirm-delete" class="btn" style="background:linear-gradient(135deg, #fee2e2, #fecaca); color:#991b1b; border:1px solid #fecaca; font-weight:600; padding:8px 16px; border-radius:12px; display:inline-flex; align-items:center; gap:8px; transition:all 0.2s; opacity:${hasSelected ? '1' : '0.5'}; cursor:${hasSelected ? 'pointer' : 'not-allowed'};" ${hasSelected ? '' : 'disabled'} onmouseenter="if(!this.disabled) this.style.boxShadow='0 4px 12px rgba(220,38,38,0.15)'" onmouseleave="this.style.boxShadow='none'" onclick="deleteSelected()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        Xác nhận xóa
      </button>
    `;
  } else {
    container.innerHTML = `
      <button id="btn-delete-all" class="btn" style="background:linear-gradient(135deg, #fee2e2, #fecaca); color:#991b1b; border:1px solid #fecaca; font-weight:600; padding:8px 16px; border-radius:12px; display:inline-flex; align-items:center; gap:8px; transition:all 0.2s;" onmouseenter="this.style.boxShadow='0 4px 12px rgba(220,38,38,0.15)'" onmouseleave="this.style.boxShadow='none'" onclick="toggleDeleteMode()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        Xóa tất cả
      </button>
    `;
  }
}

function toggleDeleteMode() {
  isDeleteMode = true;
  trashSelectedIds.clear();
  updateTrashActionButtons();
  renderTrashTableOnly();
}

function cancelDeleteMode() {
  isDeleteMode = false;
  trashSelectedIds.clear();
  updateTrashActionButtons();
  renderTrashTableOnly();
}

function renderTrash() {
  const listEl = document.getElementById('trash-list-container');
  const countEl = document.getElementById('trash-count');

  const valid = trashItems.filter(f => daysLeft(f.deletedAt) > 0);
  if (!valid.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:80px 20px;color:var(--gray-400)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="margin-bottom:16px;opacity:.4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4h6v2"/></svg>
        <div style="font-size:15px;font-weight:600;color:var(--gray-500);margin-bottom:6px">Thùng rác trống</div>
        <div style="font-size:13px">Không có biểu mẫu nào khớp với tìm kiếm hoặc thùng rác đã trống</div>
      </div>`;
    countEl.textContent = '';
    document.getElementById('trash-pagination').innerHTML = '';
    return;
  }

  renderTrashTableOnly();
}

function renderTrashTableOnly() {
  let valid = trashItems.filter(f => daysLeft(f.deletedAt) > 0);
  
  if (trashCategoryFilter) {
    valid = valid.filter(f => {
      const catStr = (f.cat || 'Chưa phân loại').toLowerCase();
      return catStr.includes(trashCategoryFilter);
    });
  }

  const countEl = document.getElementById('trash-count');
  countEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;background:#f1f5f9;padding:4px 10px;border-radius:20px;font-size:13px;color:#475569;font-weight:600;"><span style="width:6px;height:6px;border-radius:50%;background:#00008B;"></span>Tìm thấy ${valid.length} biểu mẫu trong thùng rác</span>`;

  // Pagination
  const totalPages = Math.ceil(valid.length / trashItemsPerPage) || 1;
  if (trashCurrentPage > totalPages) trashCurrentPage = totalPages;
  const startIdx = (trashCurrentPage - 1) * trashItemsPerPage;
  const pageData = valid.slice(startIdx, startIdx + trashItemsPerPage);

  const listEl = document.getElementById('trash-list-container');
  const allSelectedOnPage = pageData.length > 0 && pageData.every(f => trashSelectedIds.has(String(f.id)));

  listEl.innerHTML = `
    <div class="table-responsive" style="background:#fff;">
      <table class="table" style="width:100%;text-align:left;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid #eef2ff;background:#f8fafc;">
            ${isDeleteMode ? `<th style="padding:16px 20px;width:40px"><input type="checkbox" style="width:16px;height:16px;accent-color:#00008B;cursor:pointer" onchange="toggleSelectAllTrash(event)" ${allSelectedOnPage ? 'checked' : ''}></th>` : ''}
            <th style="padding:16px 20px;font-weight:700;color:#334155;font-size:13.5px;letter-spacing:0.3px;">TÊN BIỂU MẪU</th>
            ${trashTab === 'forms' ? `
            <th style="padding:16px 20px;font-weight:700;color:#334155;font-size:13.5px;letter-spacing:0.3px;">NGƯỜI XÓA</th>
            <th style="padding:16px 20px;font-weight:700;color:#334155;font-size:13.5px;letter-spacing:0.3px;">THỜI GIAN XÓA</th>
            <th style="padding:16px 20px;font-weight:700;color:#334155;font-size:13.5px;letter-spacing:0.3px;">THỜI HẠN</th>
            <th style="padding:16px 20px;font-weight:700;color:#334155;font-size:13.5px;letter-spacing:0.3px;">LÝ DO XÓA</th>
            ` : `
            <th style="padding:16px 20px;font-weight:700;color:#334155;font-size:13.5px;letter-spacing:0.3px;text-align:center">SỐ PHẢN HỒI XÓA</th>
            <th style="padding:16px 20px;font-weight:700;color:#334155;font-size:13.5px;letter-spacing:0.3px;">THỜI GIAN XÓA GẦN NHẤT</th>
            <th style="padding:16px 20px;font-weight:700;color:#334155;font-size:13.5px;letter-spacing:0.3px;">THỜI HẠN</th>
            `}
            <th style="padding:16px 20px;font-weight:700;color:#334155;font-size:13.5px;letter-spacing:0.3px;text-align:center">THAO TÁC</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.map(f => {
    const days = daysLeft(f.deletedAt);
    const isUrgent = days < 3;
    const safeId = String(f.id).replace(/'/g, '');
    const safeName = (f.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const isChecked = trashSelectedIds.has(safeId);
    const badgeColor = isUrgent ? '#ef4444' : '#0ea5e9';
    const badgeBg = isUrgent ? '#fef2f2' : '#f0f9ff';
    
    const categoryStr = (f.cat || 'Chưa phân loại').toLowerCase();
    let catBg = '#f1f5f9';
    let catColor = '#64748b';
    if (categoryStr.includes('ngoại ngữ')) {
      catBg = '#ffedd5';
      catColor = '#ea580c';
    } else if (categoryStr.includes('tin học')) {
      catBg = '#e0f2fe';
      catColor = '#0284c7';
    }
    
    return `
              <tr style="border-bottom:1px solid #f1f5f9;transition:all 0.2s;${isChecked ? 'background:#eff6ff' : ''}" onmouseenter="if(!${isChecked})this.style.background='#f8fafc'" onmouseleave="if(!${isChecked})this.style.background='transparent'">
                ${isDeleteMode ? `<td style="padding:16px 20px;"><input type="checkbox" style="width:16px;height:16px;accent-color:#00008B;cursor:pointer" onchange="toggleTrashItem('${safeId}', this.checked)" ${isChecked ? 'checked' : ''}></td>` : ''}
                <td style="padding:16px 20px;">
                  <div style="font-weight:700;color:${isChecked ? '#00008B' : '#0f172a'};font-size:14.5px;margin-bottom:4px;">${f.name}</div>
                  ${trashTab === 'forms' ? `<div style="display:inline-block;padding:2px 8px;border-radius:6px;background:${catBg};color:${catColor};font-size:11.5px;font-weight:600;">${f.cat || 'Chưa phân loại'}</div>` : ''}
                </td>
                ${trashTab === 'forms' ? `
                <td style="padding:16px 20px;">
                  <span style="font-weight:600;color:#475569;font-size:13.5px;">${f.deletedBy}</span>
                </td>
                <td style="padding:16px 20px;color:#64748b;font-size:13.5px;font-weight:500;">
                  ${new Date(f.deletedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </td>
                <td style="padding:16px 20px;color:${isUrgent ? '#ef4444' : '#64748b'};font-size:13.5px;font-weight:500;">
                  ${days === 0 ? 'Hôm nay' : 'Còn ' + days + ' ngày'}
                </td>
                <td style="padding:16px 20px;">
                  <div style="font-size:13px;color:#64748b;font-style:italic;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${f.deleteReason}">
                    ${f.deleteReason}
                  </div>
                </td>
                ` : `
                <td style="padding:16px 20px;text-align:center;font-weight:700;color:var(--gray-800)">
                  ${f.deletedCount}
                </td>
                <td style="padding:16px 20px;color:#64748b;font-size:13.5px;font-weight:500;">
                  ${new Date(f.deletedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </td>
                <td style="padding:16px 20px;color:${isUrgent ? '#ef4444' : '#64748b'};font-size:13.5px;font-weight:500;">
                  ${days === 0 ? 'Hôm nay' : 'Còn ' + days + ' ngày'}
                </td>
                `}
                <td style="padding:16px 20px;text-align:center;">
                  <div style="display:flex;gap:8px;justify-content:center;">
                    <button style="background:transparent; color:#00008B; border:1px solid #bfdbfe; padding:6px 12px; border-radius:8px; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px; cursor:pointer; transition:all 0.2s;" onmouseenter="this.style.background='#eff6ff'" onmouseleave="this.style.background='transparent'" title="Khôi phục" onclick="openTrashRestoreModal('${safeId}','${safeName}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg> Khôi phục
                    </button>
                    <button style="background:#fef2f2; color:#ef4444; border:1px solid #fecaca; border-radius:8px; padding:6px 10px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s;" onmouseenter="this.style.background='#fee2e2'" onmouseleave="this.style.background='#fef2f2'" title="Xóa vĩnh viễn" onclick="permanentDelete('${safeId}','${safeName}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `;
  }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Render pagination
  const pagEl = document.getElementById('trash-pagination');
  if (pagEl) {
    pagEl.style.display = 'flex';
    const startIdx = valid.length === 0 ? 0 : (trashCurrentPage - 1) * trashItemsPerPage + 1;
    const endIdx = Math.min(trashCurrentPage * trashItemsPerPage, valid.length);

    let html = `<span style="font-size:13px;color:var(--gray-500)">Hiển thị <strong>${startIdx}-${endIdx}</strong> / <strong>${valid.length}</strong> biểu mẫu</span>`;
    html += `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">`;
    html += `<button class="pag-btn" ${trashCurrentPage <= 1 ? 'disabled' : ''} onclick="trashCurrentPage--;renderTrashTableOnly();window.scrollTo({ top: 0, behavior: 'smooth' });">Trước</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="pag-btn ${i === trashCurrentPage ? 'active' : ''}" onclick="trashCurrentPage=${i};renderTrashTableOnly();window.scrollTo({ top: 0, behavior: 'smooth' });">${i}</button>`;
    }
    html += `<button class="pag-btn" ${trashCurrentPage >= totalPages ? 'disabled' : ''} onclick="trashCurrentPage++;renderTrashTableOnly();window.scrollTo({ top: 0, behavior: 'smooth' });">Sau</button>`;
    html += `</div>`;
    pagEl.innerHTML = html;
  }
}

// ── Actions ───────────────────────────────────────────────────────
let trashRestoreTarget = null; // { id, name }

function openTrashRestoreModal(id, name) {
  trashRestoreTarget = { id, name };
  let modal = document.getElementById('trash-restore-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'trash-restore-modal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width:400px;border-radius:14px">
        <div class="modal-header">
          <div><div class="modal-title" style="color:#00008B">Khôi phục biểu mẫu</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Xác nhận hành động</div></div>
          <button class="icon-btn close-btn" onclick="closeTrashRestoreModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="trash-restore-msg" style="padding:20px 20px 10px 20px;font-size:14px;color:var(--gray-700);text-align:left">
        </div>
        <div style="padding:0 20px 20px 20px">
          <input type="text" id="trash-restore-reason" placeholder="Nhập lý do khôi phục (nếu có)..." style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;transition:border 0.2s">
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeTrashRestoreModal()">Hủy bỏ</button>
          <button class="btn btn-primary" onclick="confirmTrashRestore()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
            Khôi phục
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.offsetHeight; // reflow
  }
  
  document.getElementById('trash-restore-msg').innerHTML = `Bạn có chắc chắn muốn khôi phục biểu mẫu <strong>${name}</strong> không?`;
  const reasonInput = document.getElementById('trash-restore-reason');
  if (reasonInput) reasonInput.value = '';
  modal.classList.add('open');
  if (reasonInput) setTimeout(() => reasonInput.focus(), 100);
}

function closeTrashRestoreModal() {
  const modal = document.getElementById('trash-restore-modal');
  if (modal) modal.classList.remove('open');
  trashRestoreTarget = null;
}

async function confirmTrashRestore() {
  if (!trashRestoreTarget) return;
  const target = trashRestoreTarget;
  closeTrashRestoreModal();
  
  try {
    const reasonInput = document.getElementById('trash-restore-reason');
    const reason = reasonInput ? reasonInput.value.trim() : '';
    
    const endpoint = trashTab === 'forms' ? `/forms/${target.id}/restore` : `/feedback/form/${target.id}/restore`;
    await fetch(`${API_BASE}${endpoint}`, { 
      method: 'PATCH', 
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ly_do_xoa: reason || 'Không có lý do' })
    });
    await loadTrashData();
    trashSelectedIds.delete(String(target.id));
    updateTrashActionButtons();

    // Backend now logs this, we can comment out window.logActivity or let it stay, but backend is preferred.
    // if (typeof window.logActivity === 'function') {
    //   window.logActivity('restore', target.id, target.name, 'Khôi phục biểu mẫu từ thùng rác');
    // }

    showToast('Đã khôi phục biểu mẫu', 'success');
  } catch (e) {
    showToast('Lỗi khi khôi phục biểu mẫu', 'error');
  }
}

let trashDeleteTarget = null; // { type: 'single', id, name } or { type: 'multi' }

function openTrashDeleteModal(target) {
  trashDeleteTarget = target;
  let modal = document.getElementById('trash-delete-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'trash-delete-modal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width:400px;border-radius:14px">
        <div class="modal-header">
          <div><div class="modal-title" style="color:var(--red)">Xóa biểu mẫu</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Xác nhận hành động</div></div>
          <button class="icon-btn close-btn" onclick="closeTrashDeleteModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="trash-delete-msg" style="padding:20px 20px 10px 20px;font-size:14px;color:var(--gray-700);text-align:left">
          Bạn có chắc chắn muốn xóa vĩnh viễn biểu mẫu này không? Hành động này không thể hoàn tác.
        </div>
        <div style="padding:0 20px 20px 20px">
          <input type="text" id="trash-delete-reason" placeholder="Nhập lý do xóa vĩnh viễn (nếu có)..." style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;transition:border 0.2s">
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeTrashDeleteModal()">Hủy bỏ</button>
          <button class="btn" style="background:var(--red);color:#fff" onclick="confirmTrashDelete()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Xóa vĩnh viễn
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.offsetHeight; // reflow
  }
  
  const msgEl = document.getElementById('trash-delete-msg');
  if (target.type === 'single') {
    msgEl.innerHTML = `Bạn có chắc chắn muốn xóa vĩnh viễn biểu mẫu <strong>${target.name}</strong> không? Hành động này không thể hoàn tác.`;
  } else {
    msgEl.innerHTML = `Bạn có chắc chắn muốn xóa vĩnh viễn <strong>${trashSelectedIds.size} biểu mẫu đã chọn</strong> không? Hành động này không thể hoàn tác.`;
  }
  
  const reasonInput = document.getElementById('trash-delete-reason');
  if (reasonInput) reasonInput.value = '';
  modal.classList.add('open');
  if (reasonInput) setTimeout(() => reasonInput.focus(), 100);
}

function closeTrashDeleteModal() {
  const modal = document.getElementById('trash-delete-modal');
  if (modal) modal.classList.remove('open');
  trashDeleteTarget = null;
}

async function confirmTrashDelete() {
  if (!trashDeleteTarget) return;
  const target = trashDeleteTarget;
  closeTrashDeleteModal();
  
  if (target.type === 'single') {
    try {
      const reasonInput = document.getElementById('trash-delete-reason');
      const reason = reasonInput ? reasonInput.value.trim() : '';
      
      const endpoint = trashTab === 'forms' ? `/forms/${target.id}/permanent` : `/feedback/form/${target.id}/permanent`;
      await fetch(`${API_BASE}${endpoint}`, { 
        method: 'DELETE', 
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ly_do_xoa: reason || 'Không có lý do' })
      });
      removeApprovalsByForm(target.id);
      await loadTrashData();
      trashSelectedIds.delete(String(target.id));
      updateTrashActionButtons();

      // Backend already logs this
      // if (typeof window.logActivity === 'function') {
      //   const tItem = trashItems.find(x => String(x.id) === String(target.id));
      //   const reasonText = tItem && tItem.deleteReason && tItem.deleteReason !== 'Không có lý do' ? ` - lý do: ${tItem.deleteReason}` : '';
      //   window.logActivity('hard_delete', target.id, target.name, `Xóa vĩnh viễn${reasonText}`);
      // }

      showToast(`Đã xóa vĩnh viễn "${target.name}"`, 'error');
    } catch (e) {
      showToast('Lỗi khi xóa biểu mẫu', 'error');
    }
  } else {
    const ids = Array.from(trashSelectedIds);
    const deletedNames = ids.map(id => trashItems.find(x => String(x.id) === String(id))?.name).filter(Boolean).join(', ');
    try {
      const reasonInput = document.getElementById('trash-delete-reason');
      const reason = reasonInput ? reasonInput.value.trim() : '';
      
      const isForms = trashTab === 'forms';
      await Promise.all(ids.map(id => {
        const endpoint = isForms ? `/forms/${id}/permanent` : `/feedback/form/${id}/permanent`;
        return fetch(`${API_BASE}${endpoint}`, { 
          method: 'DELETE', 
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ ly_do_xoa: reason || 'Không có lý do' })
        });
      }));
      ids.forEach(id => removeApprovalsByForm(id));
      await loadTrashData();
      isDeleteMode = false;
      trashSelectedIds.clear();
      updateTrashActionButtons();

      if (typeof window.logActivity === 'function') {
        window.logActivity('hard_delete', null, `${ids.length} biểu mẫu`, `Xóa vĩnh viễn các biểu mẫu: ${deletedNames}`);
      }

      showToast('Đã xóa vĩnh viễn các biểu mẫu được chọn', 'error');
    } catch (e) {
      showToast('Có lỗi xảy ra', 'error');
    }
  }
}

async function permanentDelete(id, name) {
  openTrashDeleteModal({ type: 'single', id, name });
}

async function restoreSelected() {
  if (!trashSelectedIds.size) return;
  const reason = prompt(`Khôi phục ${trashSelectedIds.size} biểu mẫu đã chọn?\n\nNhập lý do khôi phục (nếu có):`);
  if (reason === null) return;
  
  const ids = Array.from(trashSelectedIds);
  const restoredNames = ids.map(id => trashItems.find(x => String(x.id) === String(id))?.name).filter(Boolean).join(', ');
  try {
    const isForms = trashTab === 'forms';
    await Promise.all(ids.map(id => {
      const endpoint = isForms ? `/forms/${id}/restore` : `/feedback/form/${id}/restore`;
      return fetch(`${API_BASE}${endpoint}`, { 
        method: 'PATCH', 
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ly_do_xoa: reason.trim() || 'Không có lý do' })
      });
    }));
    await loadTrashData();
    isDeleteMode = false;
    trashSelectedIds.clear();
    updateTrashActionButtons();

    if (typeof window.logActivity === 'function') {
      window.logActivity('restore', null, `${ids.length} biểu mẫu`, `Khôi phục các biểu mẫu: ${restoredNames}`);
    }

    showToast('Đã khôi phục các biểu mẫu được chọn', 'success');
  } catch (e) {
    showToast('Có lỗi xảy ra', 'error');
  }
}

async function deleteSelected() {
  if (!trashSelectedIds.size) return;
  openTrashDeleteModal({ type: 'multi' });
}

// Init
loadTrashData();