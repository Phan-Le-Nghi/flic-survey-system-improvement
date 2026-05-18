// ── Thùng rác - Trash Management ──────────────────────────────────
const TRASH_LS_KEY = 'flic_trash_forms';

function loadTrash() {
  try { const r = localStorage.getItem(TRASH_LS_KEY); return r ? JSON.parse(r) : []; } catch(e) { return []; }
}
function saveTrash(list) {
  try { localStorage.setItem(TRASH_LS_KEY, JSON.stringify(list)); } catch(e) {}
}

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

// ── Render page ──────────────────────────────────────────────────
document.getElementById('page-content').innerHTML = `
  <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h2 class="page-title">Thùng rác</h2>
      <p class="page-sub">Các form đã xóa sẽ tự động xóa vĩnh viễn sau 30 ngày</p>
    </div>
    <button class="btn btn-outline" style="color:#ef4444;border-color:#ef4444" onclick="emptyTrash()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4h6v2"/></svg>
      Xóa tất cả vĩnh viễn
    </button>
  </div>
  <div id="trash-count" style="font-size:13px;color:var(--gray-400);margin-bottom:16px"></div>
  <div id="trash-list"><div style="text-align:center;padding:60px;color:var(--gray-400)">Đang tải...</div></div>
`;

let trashItems = [];

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loadTrashData() {
  // 1. Lấy từ DB (trang_thai = 'deleted')
  let dbItems = [];
  try {
    const res = await fetch(`${API_BASE}/forms/trash/list`, { headers: authHeaders() });
    if (res.ok) dbItems = await res.json();
  } catch(e) {}

  // 2. Merge với localStorage (form xóa cũ chưa có trong DB)
  const lsItems = loadTrash();

  // DB items ưu tiên, LS items chỉ giữ cái không có trong DB
  const dbIds = new Set(dbItems.map(f => String(f.id)));
  const lsOnly = lsItems.filter(f => !dbIds.has(String(f.id)));

  // Chuẩn hóa format
  trashItems = [
    ...dbItems.map(f => ({
      id: String(f.id),
      name: f.ten_form,
      cat: f.danh_muc || '',
      by: f.nguoi_tao || 'Admin',
      deletedAt: new Date(f.deleted_at).getTime(),
      expiresAt: new Date(f.deleted_at).getTime() + 30*24*60*60*1000,
      fromDB: true
    })),
    ...lsOnly
  ];

  renderTrash();
}

function renderTrash() {
  const countEl = document.getElementById('trash-count');
  const listEl  = document.getElementById('trash-list');
  const valid   = trashItems.filter(f => daysLeft(new Date(f.deletedAt)) > 0 || daysLeft(f.deletedAt) > 0);

  countEl.textContent = valid.length ? `${valid.length} form trong thùng rác` : '';

  if (!valid.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:80px 20px;color:var(--gray-400)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="margin-bottom:16px;opacity:.4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4h6v2"/></svg>
        <div style="font-size:15px;font-weight:600;color:var(--gray-500);margin-bottom:6px">Thùng rác trống</div>
        <div style="font-size:13px">Các form bị xóa sẽ xuất hiện ở đây</div>
      </div>`;
    return;
  }

  listEl.innerHTML = `<div class="card" style="overflow:hidden">` +
    valid.map((f, idx) => {
      const days = typeof f.deletedAt === 'number'
        ? Math.max(0, Math.ceil((f.deletedAt + 30*24*60*60*1000 - Date.now()) / (1000*60*60*24)))
        : daysLeft(f.deletedAt);
      const urgentColor = days <= 3 ? '#ef4444' : days <= 7 ? '#f59e0b' : 'var(--gray-400)';
      const isLast = idx === valid.length - 1;
      const safeId = String(f.id).replace(/'/g, '');
      const safeName = (f.name||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return `
      <div style="display:flex;align-items:center;gap:16px;padding:14px 20px;border-bottom:${isLast?'none':'1px solid var(--gray-100)'}">
        <div style="width:40px;height:40px;border-radius:8px;background:#fee2e2;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" width="20" height="20"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13.5px;color:var(--gray-800);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:2px">
            ${f.cat||''} · Xóa ngày ${formatDate(f.deletedAt)} · bởi ${f.by||'Admin'}
          </div>
        </div>
        <div style="flex-shrink:0;text-align:right">
          <div style="font-size:12px;font-weight:600;color:${urgentColor}">
            ${days === 0 ? 'Xóa hôm nay' : `Còn ${days} ngày`}
          </div>
          <div style="font-size:11px;color:var(--gray-400)">đến khi xóa vĩnh viễn</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;margin-left:8px">
          <button class="btn btn-sm btn-outline" onclick="restoreForm('${safeId}')" style="font-size:12px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 12a9 9 0 109-9M3 12V7m0 5H8"/></svg>
            Khôi phục
          </button>
          <button class="btn btn-sm" onclick="permanentDelete('${safeId}','${safeName}')" style="background:#fee2e2;color:#991b1b;border:none;font-size:12px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            Xóa vĩnh viễn
          </button>
        </div>
      </div>`;
    }).join('') + `</div>`;
}

async function restoreForm(id) {
  try {
    await fetch(`${API_BASE}/forms/${id}/restore`, { method: 'PATCH', headers: authHeaders() });
  } catch(e) {}
  try {
    await fetch(`${API_BASE}/forms/${id}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ trang_thai: 'draft' })
    });
  } catch(e) {}
  // Xóa khỏi cả DB list và localStorage
  trashItems = trashItems.filter(f => String(f.id) !== String(id));
  const ls = loadTrash().filter(f => String(f.id) !== String(id));
  saveTrash(ls);
  renderTrash();
  showToast('Đã khôi phục form về trạng thái nháp', 'success');
}

async function permanentDelete(id, name) {
  if (!confirm(`Xóa vĩnh viễn form "${name}"?\n\nHành động này không thể hoàn tác.`)) return;
  try {
    await fetch(`${API_BASE}/forms/${id}/permanent`, { method: 'DELETE', headers: authHeaders() });
  } catch(e) {}
  removeApprovalsByForm(trashItems.find(f => String(f.id) === String(id)) || { id, name });
  trashItems = trashItems.filter(f => String(f.id) !== String(id));
  const ls = loadTrash().filter(f => String(f.id) !== String(id));
  saveTrash(ls);
  renderTrash();
  showToast(`Đã xóa vĩnh viễn "${name}"`, 'error');
}

async function emptyTrash() {
  if (!trashItems.length) { showToast('Thùng rác đã trống', 'default'); return; }
  if (!confirm(`Xóa vĩnh viễn tất cả ${trashItems.length} form?\n\nHành động này không thể hoàn tác.`)) return;
  const idsToRemove = trashItems.map(f => String(f.id));
  try {
    await Promise.all(trashItems.map(f =>
      fetch(`${API_BASE}/forms/${f.id}/permanent`, { method: 'DELETE', headers: authHeaders() })
    ));
  } catch(e) {}
  trashItems.forEach(removeApprovalsByForm);
  trashItems = [];
  saveTrash([]);
  renderTrash();
  showToast('Đã xóa toàn bộ thùng rác', 'error');
}

// Init
loadTrashData();
