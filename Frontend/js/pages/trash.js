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
  } catch (e) {}
}

function daysLeft(deletedAt) {
  const ms = (new Date(deletedAt).getTime() + 30*24*60*60*1000) - Date.now();
  let days = Math.ceil(ms / (1000*60*60*24));
  if (days > 30) days = 30;
  if (days < 0) days = 0;
  return days;
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── State ────────────────────────────────────────────────────────
let trashItems = [];
let trashSearchQuery = '';
let trashDateFilter = '';
let trashCustomStartDate = '';
let trashCustomEndDate = '';
let trashCurrentPage = 1;
const trashItemsPerPage = 10;
let trashSelectedIds = new Set();
let trashSearchTimeout = null;

// ── Render page layout ───────────────────────────────────────────
function initTrashPage() {
  document.getElementById('page-content').innerHTML = `
    <div style="position: sticky; top: -24px; z-index: 10; background: var(--gray-50); padding: 24px 24px 16px 24px; margin: -24px -24px 0 -24px;">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div>
          <h2 class="page-title">Thùng rác</h2>
          <p class="page-sub">Các biểu mẫu đã xóa sẽ tự động xóa vĩnh viễn sau 30 ngày</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button id="btn-restore-selected" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;" disabled onclick="restoreSelected()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
            Khôi phục đã chọn
          </button>
          <button id="btn-delete-selected" class="btn" style="background:#f97316; color:#fff; border:none; display:inline-flex; align-items:center; gap:6px;" disabled onclick="deleteSelected()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            Xóa vĩnh viễn
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="card card-body" style="margin-bottom:0; padding:16px;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
          <div class="input-wrap" style="flex:1;min-width:200px">
            <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
            <input type="text" class="input" placeholder="Tìm kiếm biểu mẫu..." id="trash-search-input" oninput="handleTrashSearch(this.value)">
          </div>

        </div>
      </div>
    </div>

    <!-- Table content -->
    <div style="margin-top:20px;">
      <div id="trash-count" style="font-size:13px;color:var(--gray-500);margin-bottom:12px;"></div>
      <div id="trash-list-container" class="card" style="overflow:hidden">
        <div style="text-align:center;padding:60px;color:var(--gray-400)">Đang tải...</div>
      </div>
      <div id="trash-pagination" style="background:#fff;border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;margin-top:16px;box-shadow:var(--shadow-sm);gap:12px;flex-wrap:wrap"></div>
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
    let url = `${API_BASE}/forms/trash/list?`;
    const params = new URLSearchParams();
    if (trashSearchQuery) params.append('search', trashSearchQuery);
    if (trashDateFilter) params.append('filter', trashDateFilter);
    if (trashDateFilter === 'custom') {
      if (trashCustomStartDate) params.append('start_date', trashCustomStartDate);
      if (trashCustomEndDate) params.append('end_date', trashCustomEndDate);
    }
    
    const res = await fetch(url + params.toString(), { headers: authHeaders() });
    if (res.ok) {
      const dbItems = await res.json();
      trashItems = dbItems.map(f => ({
        id: String(f.id),
        name: f.ten_form,
        cat: f.danh_muc || '',
        deletedBy: f.nguoi_xoa || 'Hệ thống',
        deletedAt: new Date(f.ngay_xoa).getTime(),
        deleteReason: f.ly_do_xoa || 'Không có lý do'
      }));
    } else {
      trashItems = [];
    }
  } catch(e) {
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
  const hasSelected = trashSelectedIds.size > 0;
  document.getElementById('btn-restore-selected').disabled = !hasSelected;
  document.getElementById('btn-delete-selected').disabled = !hasSelected;
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
  const valid = trashItems.filter(f => daysLeft(f.deletedAt) > 0);
  const countEl = document.getElementById('trash-count');
  countEl.textContent = `Tìm thấy ${valid.length} biểu mẫu trong thùng rác`;

  // Pagination
  const totalPages = Math.ceil(valid.length / trashItemsPerPage) || 1;
  if (trashCurrentPage > totalPages) trashCurrentPage = totalPages;
  const startIdx = (trashCurrentPage - 1) * trashItemsPerPage;
  const pageData = valid.slice(startIdx, startIdx + trashItemsPerPage);

  const listEl = document.getElementById('trash-list-container');
  const allSelectedOnPage = pageData.length > 0 && pageData.every(f => trashSelectedIds.has(String(f.id)));

  listEl.innerHTML = `
    <div class="table-responsive">
      <table class="table" style="width:100%;text-align:left;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid var(--gray-200);background:var(--gray-50);">
            <th style="padding:12px 16px;width:40px"><input type="checkbox" onchange="toggleSelectAllTrash(event)" ${allSelectedOnPage ? 'checked' : ''}></th>
            <th style="padding:12px 16px;font-weight:600;color:var(--gray-600);font-size:13px">Tên biểu mẫu</th>
            <th style="padding:12px 16px;font-weight:600;color:var(--gray-600);font-size:13px">Người xóa</th>
            <th style="padding:12px 16px;font-weight:600;color:var(--gray-600);font-size:13px">Thời gian xóa</th>
            <th style="padding:12px 16px;font-weight:600;color:var(--gray-600);font-size:13px">Thời hạn còn lại</th>
            <th style="padding:12px 16px;font-weight:600;color:var(--gray-600);font-size:13px">Lý do xóa</th>
            <th style="padding:12px 16px;font-weight:600;color:var(--gray-600);font-size:13px;text-align:center">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.map(f => {
            const days = daysLeft(f.deletedAt);
            const isUrgent = days < 3;
            const safeId = String(f.id).replace(/'/g, '');
            const safeName = (f.name||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            const isChecked = trashSelectedIds.has(safeId);
            return `
              <tr style="border-bottom:1px solid var(--gray-100);transition:background 0.2s;${isChecked ? 'background:#eef2ff' : ''}" onmouseenter="if(!${isChecked})this.style.background='var(--gray-50)'" onmouseleave="if(!${isChecked})this.style.background='transparent'">
                <td style="padding:12px 16px;"><input type="checkbox" onchange="toggleTrashItem('${safeId}', this.checked)" ${isChecked ? 'checked' : ''}></td>
                <td style="padding:12px 16px;">
                  <div style="font-weight:600;color:${isChecked ? '#00008B' : 'var(--gray-800)'};font-size:13.5px;">${f.name}</div>
                  <div style="font-size:12px;color:var(--gray-400);margin-top:2px;">${f.cat || 'Chưa phân loại'}</div>
                </td>
                <td style="padding:12px 16px;color:var(--gray-700);font-size:13px;">${f.deletedBy}</td>
                <td style="padding:12px 16px;color:var(--gray-700);font-size:13px;">${new Date(f.deletedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td style="padding:12px 16px;" class="${isUrgent ? 'text-danger' : ''}">
                  <div style="font-size:13px;font-weight:600;">${days === 0 ? 'Hôm nay' : 'Còn ' + days + ' ngày'}</div>
                </td>
                <td style="padding:12px 16px;color:var(--gray-700);font-size:13px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${f.deleteReason}">
                  ${f.deleteReason}
                </td>
                <td style="padding:12px 16px;text-align:center;">
                  <div style="display:flex;gap:4px;justify-content:center;">
                    <button class="btn btn-outline btn-sm" style="color:#00008B; border-color:#00008B; padding:4px 8px; border-radius:4px; font-size:12px; height:auto; margin-right:4px;" title="Khôi phục" onclick="restoreForm('${safeId}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="margin-right:4px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg> Khôi phục
                    </button>
                    <button class="icon-btn" style="color:#ef4444; border:1px solid #fee2e2; border-radius:4px; padding:4px; height:auto; background:#fef2f2;" title="Xóa vĩnh viễn" onclick="permanentDelete('${safeId}','${safeName}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
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
async function restoreForm(id) {
  const item = trashItems.find(x => String(x.id) === String(id));
  const itemName = item ? item.name : 'Biểu mẫu';
  try { 
    await fetch(`${API_BASE}/forms/${id}/restore`, { method: 'PATCH', headers: authHeaders() });
    await loadTrashData();
    trashSelectedIds.delete(String(id));
    updateTrashActionButtons();
    
    if (typeof logActivityAction === 'function') {
      logActivityAction('restore', 'Khôi phục', itemName, 'Khôi phục biểu mẫu từ thùng rác', id);
    }
    
    showToast('Đã khôi phục biểu mẫu', 'success');
  } catch(e) {
    showToast('Lỗi khi khôi phục biểu mẫu', 'error');
  }
}

async function permanentDelete(id, name) {
  if (!confirm(`Xóa vĩnh viễn biểu mẫu "${name}"?\nHành động này không thể hoàn tác.`)) return;
  try { 
    await fetch(`${API_BASE}/forms/${id}/permanent`, { method: 'DELETE', headers: authHeaders() }); 
    removeApprovalsByForm(id);
    await loadTrashData();
    trashSelectedIds.delete(String(id));
    updateTrashActionButtons();
    
    if (typeof logActivityAction === 'function') {
      logActivityAction('delete', 'Xóa vĩnh viễn', name, 'Xóa vĩnh viễn biểu mẫu khỏi hệ thống', id);
    }
    
    showToast(`Đã xóa vĩnh viễn "${name}"`, 'error');
  } catch(e) {
    showToast('Lỗi khi xóa biểu mẫu', 'error');
  }
}

async function restoreSelected() {
  if (!trashSelectedIds.size) return;
  if (!confirm(`Khôi phục ${trashSelectedIds.size} biểu mẫu đã chọn?`)) return;
  const ids = Array.from(trashSelectedIds);
  const restoredNames = ids.map(id => trashItems.find(x => String(x.id) === String(id))?.name).filter(Boolean).join(', ');
  try {
    await Promise.all(ids.map(id => fetch(`${API_BASE}/forms/${id}/restore`, { method: 'PATCH', headers: authHeaders() })));
    await loadTrashData();
    trashSelectedIds.clear();
    updateTrashActionButtons();
    
    if (typeof logActivityAction === 'function') {
      logActivityAction('restore', 'Khôi phục', `${ids.length} biểu mẫu`, `Khôi phục các biểu mẫu: ${restoredNames}`);
    }
    
    showToast('Đã khôi phục các biểu mẫu được chọn', 'success');
  } catch(e) {
    showToast('Có lỗi xảy ra', 'error');
  }
}

async function deleteSelected() {
  if (!trashSelectedIds.size) return;
  if (!confirm(`Xóa vĩnh viễn ${trashSelectedIds.size} biểu mẫu đã chọn?\nHành động này không thể hoàn tác.`)) return;
  const ids = Array.from(trashSelectedIds);
  const deletedNames = ids.map(id => trashItems.find(x => String(x.id) === String(id))?.name).filter(Boolean).join(', ');
  try {
    await Promise.all(ids.map(id => fetch(`${API_BASE}/forms/${id}/permanent`, { method: 'DELETE', headers: authHeaders() })));
    ids.forEach(id => removeApprovalsByForm(id));
    await loadTrashData();
    trashSelectedIds.clear();
    updateTrashActionButtons();
    
    if (typeof logActivityAction === 'function') {
      logActivityAction('delete', 'Xóa vĩnh viễn', `${ids.length} biểu mẫu`, `Xóa vĩnh viễn các biểu mẫu: ${deletedNames}`);
    }
    
    showToast('Đã xóa vĩnh viễn các biểu mẫu được chọn', 'error');
  } catch(e) {
    showToast('Có lỗi xảy ra', 'error');
  }
}

// Init
loadTrashData();
