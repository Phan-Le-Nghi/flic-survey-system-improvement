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
  return Math.max(0, Math.ceil(ms / (1000*60*60*24)));
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
        </div>
      </div>

      <!-- Filters -->
      <div class="card card-body" style="margin-bottom:0; padding:16px;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
          <div class="input-wrap" style="flex:1;min-width:200px">
            <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
            <input type="text" class="input" placeholder="Tìm kiếm biểu mẫu..." id="trash-search-input" oninput="handleTrashSearch(this.value)">
          </div>
          
          <select class="input" style="width:160px" onchange="handleTrashFilterChange(this.value)">
            <option value="">Thời gian xóa</option>
            <option value="7days">7 ngày qua</option>
            <option value="30days">30 ngày qua</option>
            <option value="custom">Tùy chỉnh</option>
          </select>
          
          <div id="trash-custom-date" style="display:none; align-items:center; gap:8px;">
            <input type="date" id="trash-start-date" class="input" style="width:140px; padding:6px 12px" onchange="handleCustomDateChange()">
            <span style="color:var(--gray-500);font-size:14px;">-</span>
            <input type="date" id="trash-end-date" class="input" style="width:140px; padding:6px 12px" onchange="handleCustomDateChange()">
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
      <div id="trash-pagination" style="display:flex;justify-content:center;margin-top:20px;gap:8px"></div>
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
            <th style="padding:12px 16px;font-weight:600;color:var(--gray-600);font-size:13px">Tên biểu mẫu</th>
            <th style="padding:12px 16px;font-weight:600;color:var(--gray-600);font-size:13px">Người xóa</th>
            <th style="padding:12px 16px;font-weight:600;color:var(--gray-600);font-size:13px">Thời gian xóa</th>
            <th style="padding:12px 16px;font-weight:600;color:var(--gray-600);font-size:13px">Thời hạn còn lại</th>
            <th style="padding:12px 16px;font-weight:600;color:var(--gray-600);font-size:13px">Lý do xóa</th>
            <th style="padding:12px 16px;font-weight:600;color:var(--gray-600);font-size:13px;text-align:right">Thao tác</th>
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
                <td style="padding:12px 16px;">
                  <div style="font-weight:600;color:${isChecked ? '#00008B' : 'var(--gray-800)'};font-size:13.5px;">${f.name}</div>
                  <div style="font-size:12px;color:var(--gray-400);margin-top:2px;">${f.cat || 'Chưa phân loại'}</div>
                </td>
                <td style="padding:12px 16px;color:var(--gray-700);font-size:13px;">${f.deletedBy}</td>
                <td style="padding:12px 16px;color:var(--gray-700);font-size:13px;">${formatDate(f.deletedAt)}</td>
                <td style="padding:12px 16px;" class="${isUrgent ? 'text-danger' : ''}">
                  <div style="font-size:13px;font-weight:600;">${days === 0 ? 'Hôm nay' : 'Còn ' + days + ' ngày'}</div>
                </td>
                <td style="padding:12px 16px;color:var(--gray-700);font-size:13px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${f.deleteReason}">
                  ${f.deleteReason}
                </td>
                <td style="padding:12px 16px;text-align:right;">
                  <div style="display:flex;gap:4px;justify-content:flex-end;">
                    <button class="icon-btn" style="color:#00008B" title="Khôi phục" onclick="restoreForm('${safeId}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M3 12a9 9 0 109-9M3 12V7m0 5H8"/></svg>
                    </button>
                    <button class="icon-btn" style="color:#ef4444" title="Xóa vĩnh viễn" onclick="permanentDelete('${safeId}','${safeName}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
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
  if (totalPages > 1) {
    let html = '';
    html += `<button class="btn btn-outline btn-sm" ${trashCurrentPage===1?'disabled':''} onclick="trashCurrentPage--;renderTrashTableOnly()">Trước</button>`;
    for(let i=1; i<=totalPages; i++) {
      if (i===1 || i===totalPages || (i >= trashCurrentPage-1 && i <= trashCurrentPage+1)) {
        if (i===trashCurrentPage) {
           html += `<button class="btn btn-sm" style="background:#00008B;color:#fff;border:none" onclick="trashCurrentPage=${i};renderTrashTableOnly()">${i}</button>`;
        } else {
           html += `<button class="btn btn-outline btn-sm" onclick="trashCurrentPage=${i};renderTrashTableOnly()">${i}</button>`;
        }
      } else if (i === trashCurrentPage - 2 || i === trashCurrentPage + 2) {
        html += `<span style="padding:0 4px;color:var(--gray-400)">...</span>`;
      }
    }
    html += `<button class="btn btn-outline btn-sm" ${trashCurrentPage===totalPages?'disabled':''} onclick="trashCurrentPage++;renderTrashTableOnly()">Sau</button>`;
    pagEl.innerHTML = html;
  } else {
    pagEl.innerHTML = '';
  }
}

// ── Actions ───────────────────────────────────────────────────────
async function restoreForm(id) {
  try { 
    await fetch(`${API_BASE}/forms/${id}/restore`, { method: 'PATCH', headers: authHeaders() });
    await loadTrashData();
    trashSelectedIds.delete(String(id));
    updateTrashActionButtons();
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
    showToast(`Đã xóa vĩnh viễn "${name}"`, 'error');
  } catch(e) {
    showToast('Lỗi khi xóa biểu mẫu', 'error');
  }
}

async function restoreSelected() {
  if (!trashSelectedIds.size) return;
  if (!confirm(`Khôi phục ${trashSelectedIds.size} biểu mẫu đã chọn?`)) return;
  const ids = Array.from(trashSelectedIds);
  try {
    await Promise.all(ids.map(id => fetch(`${API_BASE}/forms/${id}/restore`, { method: 'PATCH', headers: authHeaders() })));
    await loadTrashData();
    trashSelectedIds.clear();
    updateTrashActionButtons();
    showToast('Đã khôi phục các biểu mẫu được chọn', 'success');
  } catch(e) {
    showToast('Có lỗi xảy ra', 'error');
  }
}

async function deleteSelected() {
  if (!trashSelectedIds.size) return;
  if (!confirm(`Xóa vĩnh viễn ${trashSelectedIds.size} biểu mẫu đã chọn?\nHành động này không thể hoàn tác.`)) return;
  const ids = Array.from(trashSelectedIds);
  try {
    await Promise.all(ids.map(id => fetch(`${API_BASE}/forms/${id}/permanent`, { method: 'DELETE', headers: authHeaders() })));
    ids.forEach(id => removeApprovalsByForm(id));
    await loadTrashData();
    trashSelectedIds.clear();
    updateTrashActionButtons();
    showToast('Đã xóa vĩnh viễn các biểu mẫu được chọn', 'error');
  } catch(e) {
    showToast('Có lỗi xảy ra', 'error');
  }
}

// Init
loadTrashData();
