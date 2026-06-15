// ── State & Variables ──────────────────────────────────────────────
let notifications = [];
let notifStats = { tong: 0, da_gui: 0, len_lich: 0, nhap: 0, tong_luot_doc: 0 };
let notifRealtimeTimer = null;
let notifStaffOptions = [];
let notifSuggestionHideTimer = null;
let currentEditingDraftId = null;
let isSubmitting = false;

const typeStyle = {
  info: { bg: '#00008B', color: '#fff' },
  success: { bg: '#dcfce7', color: '#16a34a' },
  warning: { bg: '#ffedd5', color: '#ea580c' },
  error: { bg: '#fee2e2', color: '#dc2626' },
};
const typeIconMap = {
  info: `<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>`,
  success: `<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  warning: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  error: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`
};
const typeMap = { 'Thông tin': 'info', 'Thành công': 'success', 'Cảnh báo': 'warning', 'Lỗi': 'error' };

const statusBadge = s => s === 'sent' ? '<span class="badge badge-green" style="width: 75px; justify-content: center;">Đã gửi</span>' : s === 'scheduled' ? '<span class="badge badge-orange" style="width: 75px; justify-content: center;">Lên lịch</span>' : '<span class="badge badge-gray" style="width: 75px; justify-content: center;">Nháp</span>';

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Layout ────────────────────────────────────────────────────────
document.getElementById('page-content').innerHTML = `
  <div style="position: sticky; top: -24px; z-index: 10; background: var(--gray-50); padding: 24px 24px 16px 24px; margin: -24px -24px 0 -24px;">
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h2 class="page-title">Quản lý thông báo</h2><p class="page-sub">Tạo và quản lý thông báo đến nhân viên</p></div>
      <button class="btn btn-primary" onclick="openNotifModal()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Tạo thông báo
      </button>
    </div>

    <!-- Stats -->
    <div class="grid-4" style="margin-bottom:24px" id="notif-stats"></div>

    <!-- Search -->
    <div class="card card-body" style="margin-bottom:0">
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="input-wrap" style="flex:1;min-width:200px">
          <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <input type="text" id="notif-search" class="input" placeholder="Tìm kiếm thông báo..." oninput="renderNotifList()">
        </div>
        <select id="notif-filter-type" class="input" style="width:auto" onchange="renderNotifList()"><option value="">Tất cả loại</option><option>Thông tin</option><option>Thành công</option><option>Cảnh báo</option><option>Lỗi</option></select>
        <select id="notif-filter-status" class="input" style="width:auto" onchange="renderNotifList()"><option value="">Tất cả trạng thái</option><option value="sent">Đã gửi</option><option value="scheduled">Lên lịch</option><option value="draft">Nháp</option></select>
      </div>
    </div>
  </div>

  <!-- Notification list -->
  <div class="space-y" id="notif-list" style="margin-top: 20px;"></div>

  <div class="modal-overlay" id="view-notif-modal" onclick="closeModal('view-notif-modal')">
    <div class="modal" style="max-width:620px;width:100%" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">Chi tiết thông báo</span>
        <button class="icon-btn close-btn" onclick="closeModal('view-notif-modal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div id="view-notif-body" class="modal-body" style="padding:24px"></div>
      <div class="modal-footer" style="display:flex;justify-content:flex-end">
        <button class="btn btn-outline" onclick="closeModal('view-notif-modal')">Đóng</button>
      </div>
    </div>
  </div>

  <!-- Create Modal -->
  <div class="modal-overlay" id="create-notif-modal">
    <div class="modal" style="max-width:560px;width:100%" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">Tạo thông báo mới</span>
        <button class="icon-btn close-btn" onclick="closeNotifModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body" style="padding:24px;display:flex;flex-direction:column;gap:20px">

        <!-- Tiêu đề -->
        <div class="form-group" style="margin:0">
          <label class="form-label">Tiêu đề thông báo <span style="color:var(--red)">*</span></label>
          <input id="notif-title" type="text" class="input" placeholder="Nhập tiêu đề thông báo...">
        </div>

        <!-- Nội dung -->
        <div class="form-group" style="margin:0">
          <label class="form-label">Nội dung thông báo <span style="color:var(--red)">*</span></label>
          <textarea id="notif-msg" class="input" rows="2" maxlength="200" style="height:auto;padding:12px;resize:none" placeholder="Nhập nội dung thông báo..." oninput="const c=this.value.length;document.getElementById('notif-char-count').textContent=c;document.getElementById('notif-char-count').style.color=c>180?'#ef4444':'var(--gray-400)'"></textarea>
          <div style="font-size:12px;color:var(--gray-400);margin-top:4px;display:flex;justify-content:space-between"><span>Tối đa 200 ký tự</span><span><span id="notif-char-count">0</span>/200</span></div>
        </div>

        <!-- Người nhận -->
        <div class="form-group" style="margin:0">
          <label class="form-label">Người nhận <span style="color:var(--red)">*</span></label>
          <div style="margin-top:6px;display:flex;flex-direction:column;gap:8px">
            <input id="notif-email-input" type="text" class="input" placeholder="Nhập tên, ID hoặc email người nhận..." onkeydown="handleEmailKey(event)" oninput="updateNotifRecipientSuggestions(this.value)" onfocus="updateNotifRecipientSuggestions(this.value)" onblur="hideNotifRecipientSuggestions()">
            <div id="notif-recipient-suggestions" style="display:none;position:relative"></div>
            <div id="notif-email-tags" style="display:flex;flex-wrap:wrap;gap:6px;min-height:0"></div>
            <div style="font-size:12px;color:var(--gray-400)">Nhấn <kbd style="background:var(--gray-100);border:1px solid var(--gray-200);border-radius:4px;padding:1px 6px;font-size:11px">Enter</kbd> để thêm người nhận</div>
          </div>
          <input type="hidden" id="notif-recip" value="">
        </div>

        <!-- Thời gian gửi -->
        <div class="form-group" style="margin:0">
          <label class="form-label">Thời gian gửi <span style="color:var(--red)">*</span></label>
          <div id="notif-now-label" style="font-size:12px;color:var(--gray-500);margin-top:2px">Hiện tại: --/--/---- --:--:--</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px">
            <div>
              <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px">Ngày gửi</div>
              <input type="date" id="notif-send-date" class="input">
            </div>
            <div>
              <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px">Giờ gửi</div>
              <input type="time" id="notif-send-time-val" class="input" value="08:00">
            </div>
          </div>
        </div>

      </div>
      <div class="modal-footer" style="display:flex;gap:12px" id="create-notif-footer">
        <button class="btn btn-outline" style="flex:1;justify-content:center" onclick="closeNotifModal()">Hủy</button>
        <button class="btn btn-primary" style="flex:1;justify-content:center;gap:8px" onclick="saveNotifAction('auto')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Gửi / Lên lịch
        </button>
      </div>
    </div>
  </div>
`;

// ── API & Data Logic ──────────────────────────────────────────────
async function loadNotificationsData() {
  try {
    const listRes = await fetch(`${API_BASE}/notifications`, { headers: authHeaders() });
    if (listRes.ok) {
      const data = await listRes.json();
      notifications = data.map(n => ({
        id: String(n.id),
        title: n.tieu_de,
        msg: n.noi_dung,
        type: n.loai || 'info',
        recipients: n.nguoi_nhan,
        status: n.trang_thai,
        date: n.ngay_gui ? formatDBDate(n.ngay_gui) : formatDBDate(n.ngay_tao),
        rawDate: n.ngay_gui || n.ngay_tao,
        read: n.luot_da_doc || 0,
        total: n.tong_nguoi_nhan || 0,
        sender: n.nguoi_gui
      }));
    }

    const statsRes = await fetch(`${API_BASE}/notifications/stats`, { headers: authHeaders() });
    if (statsRes.ok) {
      notifStats = await statsRes.json();
    }
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }
  
  renderNotifStats();
  renderNotifList();
}

function formatDBDate(dbDateStr) {
  if (!dbDateStr) return 'Chưa gửi';
  const d = new Date(dbDateStr);
  if (Number.isNaN(d.getTime())) return 'Chưa gửi';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ── Render helpers ────────────────────────────────────────────────
function renderNotifStats() {
  const t = notifStats;
  document.getElementById('notif-stats').innerHTML = [
    { label: 'Tổng thông báo', value: t.tong || 0, color: '#00008B', bg: '#00008B' },
    { label: 'Đã gửi', value: t.da_gui || 0, color: '#10b981', bg: '#dcfce7' },
    { label: 'Lên lịch', value: t.len_lich || 0, color: '#ea580c', bg: '#ffedd5' },
    { label: 'Nháp', value: t.nhap || 0, color: '#64748b', bg: '#f1f5f9' },
  ].map(s => `<div class="card stat-card" style="padding:20px"><div class="stat-label">${s.label}</div><div class="stat-value" style="color:${s.color}">${s.value}</div></div>`).join('');
}

function renderNotifList() {
  const q = (document.getElementById('notif-search')?.value || '').toLowerCase();
  const ft = document.getElementById('notif-filter-type')?.value || '';
  const fs = document.getElementById('notif-filter-status')?.value || '';
  const list = notifications.filter(n => {
    const matchQ = !q || n.title.toLowerCase().includes(q) || n.msg.toLowerCase().includes(q);
    const matchT = !ft || (typeMap[ft] || ft) === n.type;
    const matchS = !fs || n.status === fs;
    return matchQ && matchT && matchS;
  });
  
  const listEl = document.getElementById('notif-list');
  if (!list.length) {
    listEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray-400)">Không tìm thấy thông báo nào.</div>`;
    return;
  }
  
  listEl.innerHTML = list.map(n => {
    const ts = typeStyle[n.type] || typeStyle.info;
    const pct = n.total > 0 ? Math.round(n.read / n.total * 100) : 0;
    const formattedDate = formatDBDate(n.rawDate);
    return `
    <div class="card card-body" style="cursor:pointer; transition: background 0.2s;" onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='#fff'" onclick="openNotifDetail('${n.id}')" ondblclick="openNotifDetail('${n.id}')">
      <div style="display:flex;align-items:flex-start;gap:14px">
        <div style="width:40px;height:40px;border-radius:50%;background:${ts.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="${ts.color}" stroke-width="2" width="18" height="18">${typeIconMap[n.type] || typeIconMap.info}</svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div style="font-weight:600;font-size:14px">${n.title}</div>
            <div style="display:flex;align-items:center;gap:8px;min-width:200px;justify-content:flex-end">
              <div style="width:70px;text-align:center">${statusBadge(n.status)}</div>
              <div style="width:140px;text-align:right"><span style="font-size:12px;color:var(--gray-400)">${n.status==='draft' ? 'Chưa gửi' : formattedDate}</span></div>
            </div>
          </div>
          <div style="font-size:13px;color:var(--gray-600);margin-bottom:8px">${n.msg}</div>
          <div style="display:flex;align-items:center;gap:16px">
            <span style="font-size:12px;color:var(--gray-500)">📧 ${n.recipients}</span>
            ${n.status === 'sent' ? `
              <div style="display:flex;align-items:center;gap:8px">
                <div class="progress" style="width:80px"><div class="progress-bar" style="width:${pct}%;background:#00008B"></div></div>
                <span style="font-size:12px;color:var(--gray-500)">${n.read}/${n.total} đã đọc (${pct}%)</span>
              </div>
            ` : ''}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="icon-btn" style="color:var(--red)" onclick="event.stopPropagation(); deleteNotif('${n.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openNotifDetail(id) {
  const n = notifications.find(item => String(item.id) === String(id));
  if (!n) return;

  if (n.status === 'draft') {
    editDraftNotif(id);
    return;
  }

  const ts = typeStyle[n.type] || typeStyle.info;
  const pct = n.total > 0 ? Math.round((n.read / n.total) * 100) : 0;
  const body = document.getElementById('view-notif-body');
  if (!body) return;

  body.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:18px">
      <div style="width:44px;height:44px;border-radius:50%;background:${ts.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="${ts.color}" stroke-width="2" width="20" height="20">${typeIconMap[n.type] || typeIconMap.info}</svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:18px;font-weight:700;color:var(--gray-900);margin-bottom:8px">${n.title}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${statusBadge(n.status)}
          <span style="font-size:12px;color:var(--gray-500)">Thời gian: ${n.date}</span>
        </div>
      </div>
    </div>

    <div style="border:1px solid var(--gray-200);border-radius:12px;padding:16px;background:#fafcff;margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Nội dung</div>
      <div style="font-size:14px;line-height:1.7;color:var(--gray-800);white-space:pre-wrap">${n.msg}</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="border:1px solid var(--gray-200);border-radius:12px;padding:14px;background:#fff">
        <div style="font-size:12px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Người nhận</div>
        <div style="font-size:14px;color:var(--gray-800);word-break:break-word">${n.recipients}</div>
      </div>
      <div style="border:1px solid var(--gray-200);border-radius:12px;padding:14px;background:#fff">
        <div style="font-size:12px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Trạng thái đọc</div>
        <div style="font-size:14px;color:var(--gray-800);margin-bottom:8px">${n.read}/${n.total} đã đọc (${pct}%)</div>
        <div class="progress" style="width:100%"><div class="progress-bar" style="width:${pct}%;background:#00008B"></div></div>
      </div>
    </div>
  `;

  openModal('view-notif-modal');
}

// ── Email tag input ────────────────────────────────────────────────
let emailTags = [];
function loadNotifStaffCache() {
  try {
    const raw = localStorage.getItem('flic_notif_staff_cache');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveNotifStaffCache(list) {
  try { localStorage.setItem('flic_notif_staff_cache', JSON.stringify(list || [])); } catch (e) {}
}

async function ensureNotifStaffOptions() {
  if (notifStaffOptions.length) return notifStaffOptions;

  const cached = loadNotifStaffCache();
  if (cached.length) notifStaffOptions = cached;

  try {
    const res = await fetch(`${API_BASE}/staff`, { headers: authHeaders() });
    if (!res.ok) throw new Error('load staff failed');
    const data = await res.json();
    notifStaffOptions = (Array.isArray(data) ? data : []).map((s) => ({
      id: String(s.id || ''),
      name: s.ho_ten || s.name || '',
      email: s.email || '',
      username: s.ten_dang_nhap || '',
      dept: s.phong_ban || '',
    })).filter((s) => s.name || s.email || s.id);
    saveNotifStaffCache(notifStaffOptions);
  } catch (e) {
    if (!notifStaffOptions.length) {
      notifStaffOptions = [
        { id: '1', name: 'Nguyễn Minh Anh', email: 'anh@flic.edu.vn', username: 'anh', dept: 'Ngoại ngữ' },
        { id: '2', name: 'Trần Văn Bình', email: 'binh@flic.edu.vn', username: 'binh', dept: 'Tin học' },
      ];
    }
  }
  return notifStaffOptions;
}

function hideNotifRecipientSuggestions() {
  if (notifSuggestionHideTimer) clearTimeout(notifSuggestionHideTimer);
  notifSuggestionHideTimer = setTimeout(() => {
    const box = document.getElementById('notif-recipient-suggestions');
    if (box) box.style.display = 'none';
  }, 120);
}

function renderNotifRecipientSuggestions(list, query) {
  const box = document.getElementById('notif-recipient-suggestions');
  if (!box) return;

  if (!list.length || !query.trim()) {
    box.innerHTML = '';
    box.style.display = 'none';
    return;
  }

  box.innerHTML = `
    <div style="position:absolute;top:0;left:0;right:0;z-index:30;background:#fff;border:1px solid var(--gray-200);border-radius:10px;box-shadow:0 10px 24px rgba(15,23,42,.08);overflow:hidden">
      ${list.map((item) => `
        <button type="button"
          onmousedown="selectNotifRecipient('${String(item.name).replace(/'/g, "\\'")}', '${String(item.email).replace(/'/g, "\\'")}', '${String(item.id).replace(/'/g, "\\'")}')"
          style="width:100%;text-align:left;padding:10px 12px;border:none;background:#fff;cursor:pointer;display:flex;flex-direction:column;gap:2px"
          onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='#fff'">
          <span style="font-size:13px;font-weight:600;color:var(--gray-800)">${item.name || item.email || item.id}</span>
          <span style="font-size:11.5px;color:var(--gray-500)">${[item.id ? `ID: ${item.id}` : '', item.email || '', item.dept || ''].filter(Boolean).join(' · ')}</span>
        </button>
      `).join('')}
    </div>
  `;
  box.style.display = 'block';
}

async function updateNotifRecipientSuggestions(query = '') {
  if (notifSuggestionHideTimer) clearTimeout(notifSuggestionHideTimer);
  const list = await ensureNotifStaffOptions();
  const keyword = String(query || '').trim().toLowerCase();
  if (!keyword) {
    renderNotifRecipientSuggestions([], '');
    return;
  }

  const matches = list.filter((item) => {
    const haystack = [item.name, item.email, item.id, item.username, item.dept].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(keyword);
  }).filter((item) => !emailTags.includes(item.name)).slice(0, 6);

  renderNotifRecipientSuggestions(matches, keyword);
}

function selectNotifRecipient(name, email, id) {
  if (notifSuggestionHideTimer) clearTimeout(notifSuggestionHideTimer);
  const value = name || email || id;
  if (value && !emailTags.includes(value)) {
    emailTags.push(value);
    renderEmailTags();
    document.getElementById('notif-recip').value = emailTags.join(',');
  }
  const input = document.getElementById('notif-email-input');
  if (input) input.value = '';
  renderNotifRecipientSuggestions([], '');
}

function handleEmailKey(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.replace(/,/g, '').trim();
    if (val && !emailTags.includes(val)) {
      emailTags.push(val);
      renderEmailTags();
      document.getElementById('notif-recip').value = emailTags.join(',');
    }
    e.target.value = '';
    renderNotifRecipientSuggestions([], '');
  }
}
function removeEmailTag(email) {
  emailTags = emailTags.filter(e => e !== email);
  renderEmailTags();
  document.getElementById('notif-recip').value = emailTags.join(',');
}
function renderEmailTags() {
  const wrap = document.getElementById('notif-email-tags');
  if (!wrap) return;
  wrap.innerHTML = emailTags.map(e => `
    <span style="display:inline-flex;align-items:center;gap:5px;background:#00008B;color:#fff;border-radius:999px;padding:3px 10px 3px 12px;font-size:12px;font-weight:500">
      ${e}
      <button onclick="removeEmailTag('${e}')" style="background:none;border:none;cursor:pointer;color:#00008B;padding:0;display:flex;line-height:1" title="Xóa">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </span>`).join('');
}

function pad2(n) { return String(n).padStart(2, '0'); }

function formatNotifRealtime(now = new Date()) {
  return `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}

function setNotifRealtimeLabel() {
  const el = document.getElementById('notif-now-label');
  if (el) el.textContent = `Hiện tại: ${formatNotifRealtime(new Date())}`;
}

function setNotifCurrentDateTime() {
  const now = new Date();
  const dateEl = document.getElementById('notif-send-date');
  const timeEl = document.getElementById('notif-send-time-val');
  if (dateEl) dateEl.value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  if (timeEl) timeEl.value = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  setNotifRealtimeLabel();
}

function editDraftNotif(id) {
  const n = notifications.find(item => String(item.id) === String(id));
  if (!n) return;
  currentEditingDraftId = id;
  isSubmitting = false;

  document.getElementById('notif-title').value = n.title === 'Bản nháp không tên' ? '' : n.title;
  document.getElementById('notif-msg').value = n.msg || '';
  document.getElementById('notif-char-count').textContent = (n.msg || '').length;

  emailTags = n.recipients && n.recipients !== 'Chưa có' ? n.recipients.split(',').map(s => s.trim()).filter(Boolean) : [];
  renderEmailTags();
  document.getElementById('notif-recip').value = emailTags.join(',');

  if (n.rawDate) {
    const d = new Date(n.rawDate);
    if (!Number.isNaN(d.getTime())) {
      document.getElementById('notif-send-date').value = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      document.getElementById('notif-send-time-val').value = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    } else setNotifCurrentDateTime();
  } else setNotifCurrentDateTime();

  if (notifRealtimeTimer) clearInterval(notifRealtimeTimer);
  notifRealtimeTimer = setInterval(setNotifRealtimeLabel, 1000);
  openModal('create-notif-modal');
}

async function saveCurrentAsDraft() {
  const title = document.getElementById('notif-title').value.trim();
  const msg = document.getElementById('notif-msg').value.trim();
  const recipients = document.getElementById('notif-recip').value.trim();

  if (!title && !msg && !recipients) return;

  const sendDate = document.getElementById('notif-send-date').value;
  const sendTime = document.getElementById('notif-send-time-val').value;
  let dDate = null;
  if (sendDate && sendTime) dDate = new Date(`${sendDate}T${sendTime}`);

  const payload = {
    tieu_de: title || 'Bản nháp không tên',
    noi_dung: msg || ' ',
    loai: 'info',
    nguoi_nhan: recipients || 'Chưa có',
    trang_thai: 'draft',
    ngay_gui: dDate && !Number.isNaN(dDate.getTime()) ? dDate.toISOString() : null,
    tong_nguoi_nhan: emailTags.length,
    nhan_vien_id: JSON.parse(localStorage.getItem('flic_user')||'{}')?.id || null
  };

  try {
    if (currentEditingDraftId) {
      await fetch(`${API_BASE}/notifications/${currentEditingDraftId}`, {
        method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch(`${API_BASE}/notifications`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
  } catch (err) {
    console.error(err);
  }

  await loadNotificationsData();
}

function openNotifModal() {
  currentEditingDraftId = null;
  isSubmitting = false;
  document.getElementById('notif-title').value = '';
  document.getElementById('notif-msg').value = '';
  document.getElementById('notif-char-count').textContent = '0';
  emailTags = [];
  renderEmailTags();
  document.getElementById('notif-recip').value = '';

  setNotifCurrentDateTime();
  if (notifRealtimeTimer) clearInterval(notifRealtimeTimer);
  notifRealtimeTimer = setInterval(setNotifRealtimeLabel, 1000);
  openModal('create-notif-modal');
}

async function closeNotifModal() {
  if (notifRealtimeTimer) {
    clearInterval(notifRealtimeTimer);
    notifRealtimeTimer = null;
  }
  if (!isSubmitting) {
    await saveCurrentAsDraft();
  }
  isSubmitting = false;
  closeModal('create-notif-modal');
}

async function saveNotifAction(status) {
  const title = document.getElementById('notif-title').value.trim();
  const msg = document.getElementById('notif-msg').value.trim();
  if (!title) { showToast('Vui lòng nhập tiêu đề!', 'error'); document.getElementById('notif-title').focus(); return; }
  if (!msg) { showToast('Vui lòng nhập nội dung!', 'error'); document.getElementById('notif-msg').focus(); return; }
  const recipients = document.getElementById('notif-recip').value.trim();
  if (!recipients) { showToast('Vui lòng thêm ít nhất một người nhận!', 'error'); document.getElementById('notif-email-input').focus(); return; }

  const sendDate = document.getElementById('notif-send-date').value;
  const sendTime = document.getElementById('notif-send-time-val').value;

  if (!sendDate || !sendTime) { showToast('Vui lòng chọn ngày và giờ gửi!', 'error'); return; }
  const d = new Date(`${sendDate}T${sendTime}`);
  if (Number.isNaN(d.getTime())) { showToast('Ngày giờ gửi không hợp lệ!', 'error'); return; }

  const now = new Date();
  let finalStatus = 'sent';
  if (d.getTime() > now.getTime() + 60000) {
    finalStatus = 'scheduled';
  }

  const payload = {
    tieu_de: title,
    noi_dung: msg,
    loai: 'info',
    nguoi_nhan: recipients,
    trang_thai: finalStatus,
    ngay_gui: d.toISOString(),
    tong_nguoi_nhan: emailTags.length,
    nhan_vien_id: JSON.parse(localStorage.getItem('flic_user')||'{}')?.id || null
  };

  try {
    if (currentEditingDraftId) {
      await fetch(`${API_BASE}/notifications/${currentEditingDraftId}`, {
        method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      // If we are sending a draft right now, and backend PUT didn't change it to sent immediately 
      // (Backend PUT only updates draft. We must call PATCH /send or set it in PUT if backend allows).
      // Wait, Backend PUT only updates where trang_thai='draft'. But it sets trang_thai! Let's check backend.
      // Backend PUT updates trang_thai = ${trang_thai}. So it WILL update to 'sent'. But does it update ngay_gui?
      // Yes, ngay_gui = ${ngay_gui ? new Date(ngay_gui) : null}.
    } else {
      await fetch(`${API_BASE}/notifications`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
  } catch(e) {
    console.error(e);
  }

  isSubmitting = true;
  closeNotifModal();
  
  await loadNotificationsData();
  showToast(finalStatus === 'sent' ? 'Đã gửi thông báo ngay bây giờ!' : 'Đã lên lịch gửi thông báo!', 'success');
}

async function deleteNotif(id) {
  if (!confirm('Bạn có chắc muốn xóa thông báo này?')) return;
  try {
    await fetch(`${API_BASE}/notifications/${id}`, { method: 'DELETE', headers: authHeaders() });
  } catch(e) {}
  await loadNotificationsData();
  showToast('Đã xóa thông báo', 'error');
}

async function checkScheduledNotifs() {
  // Rather than guessing locally, just reload data occasionally to sync.
  await loadNotificationsData();
}

// Check every 15 seconds to sync stats and auto-send scheduled items if backend does it.
// If backend doesn't do it automatically, user might need a cron endpoint. For now, frontend just reloads.
setInterval(checkScheduledNotifs, 15000);

// Init
function updateNotifModalActions() {
  const overlay = document.getElementById('create-notif-modal');
  if (overlay) overlay.setAttribute('onclick', 'closeNotifModal()');
}

updateNotifModalActions();
loadNotificationsData();