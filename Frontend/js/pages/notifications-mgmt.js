// ── localStorage helpers ──────────────────────────────────────────
const LS_NOTIFS = 'flic_notifications';
const DEFAULT_NOTIFICATIONS = [
  {id:'1',title:'Cập nhật hệ thống v2.0.1',msg:'Hệ thống đã được cập nhật với nhiều tính năng mới.',type:'info',recipients:'Tất cả nhân viên',status:'sent',date:'5 phút trước',read:45,total:120},
  {id:'2',title:'Nhắc nhở: Deadline báo cáo tháng 3',msg:'Vui lòng hoàn thành báo cáo trước ngày 10/03/2026.',type:'warning',recipients:'Phòng Ngoại ngữ',status:'sent',date:'2 giờ trước',read:67,total:80},
  {id:'3',title:'Form mới cần phê duyệt',msg:'Có 3 form đang chờ phê duyệt của bạn.',type:'success',recipients:'Quản lý',status:'sent',date:'5 giờ trước',read:12,total:12},
  {id:'4',title:'Bảo trì hệ thống đêm nay',msg:'Hệ thống sẽ bảo trì từ 22:00 - 24:00.',type:'error',recipients:'Tất cả nhân viên',status:'scheduled',date:'20/03/2026 22:00',read:0,total:120},
  {id:'5',title:'Chào mừng nhân viên mới',msg:'Vũ Thị F đã gia nhập Phòng Tin học.',type:'info',recipients:'Phòng Tin học',status:'draft',date:'Chưa gửi',read:0,total:35},
];
function loadNotifs() {
  try { const r = localStorage.getItem(LS_NOTIFS); return r ? JSON.parse(r) : DEFAULT_NOTIFICATIONS; } catch(e) { return DEFAULT_NOTIFICATIONS; }
}
function saveNotifs(list) {
  try { localStorage.setItem(LS_NOTIFS, JSON.stringify(list)); } catch(e) {}
}
// ─────────────────────────────────────────────────────────────────

let notifications = loadNotifs();
let notifRealtimeTimer = null;
let notifStaffOptions = [];
let notifSuggestionHideTimer = null;

const typeStyle = {
  info:{bg:'#dbeafe',color:'#2563eb'},
  success:{bg:'#dcfce7',color:'#16a34a'},
  warning:{bg:'#fef9c3',color:'#ca8a04'},
  error:{bg:'#fee2e2',color:'#dc2626'},
};
const typeMap = {'Thông tin':'info','Thành công':'success','Cảnh báo':'warning','Lỗi':'error'};
const statusBadge = s => s==='sent'?'<span class="badge badge-green">Đã gửi</span>':s==='scheduled'?'<span class="badge badge-blue">Đã lên lịch</span>':'<span class="badge badge-gray">Nháp</span>';

document.getElementById('page-content').innerHTML = `
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
  <div class="card card-body" style="margin-bottom:20px">
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div class="input-wrap" style="flex:1;min-width:200px">
        <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
        <input type="text" id="notif-search" class="input" placeholder="Tìm kiếm thông báo..." oninput="renderNotifList()">
      </div>
      <select id="notif-filter-type" class="input" style="width:auto" onchange="renderNotifList()"><option value="">Tất cả loại</option><option>Thông tin</option><option>Thành công</option><option>Cảnh báo</option><option>Lỗi</option></select>
      <select id="notif-filter-status" class="input" style="width:auto" onchange="renderNotifList()"><option value="">Tất cả trạng thái</option><option value="sent">Đã gửi</option><option value="scheduled">Lên lịch</option><option value="draft">Nháp</option></select>
    </div>
  </div>

  <!-- Notification list -->
  <div class="space-y" id="notif-list"></div>

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
      <div class="modal-footer" style="display:flex;gap:12px">
        <button class="btn btn-outline" style="flex:1;justify-content:center" onclick="closeModal('create-notif-modal')">Hủy</button>
        <button class="btn btn-primary" style="flex:1;justify-content:center;gap:8px" onclick="saveNotifAction('sent')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Gửi ngay
        </button>
      </div>
    </div>
  </div>
`;

// ── Render helpers ────────────────────────────────────────────────
function renderNotifStats() {
  const total = notifications.length;
  const sent = notifications.filter(n=>n.status==='sent').length;
  const scheduled = notifications.filter(n=>n.status==='scheduled').length;
  const draft = notifications.filter(n=>n.status==='draft').length;
  document.getElementById('notif-stats').innerHTML = [
    {label:'Tổng thông báo',value:total,color:'#0ea5e9',bg:'#e0f2fe'},
    {label:'Đã gửi',value:sent,color:'#10b981',bg:'#dcfce7'},
    {label:'Lên lịch',value:scheduled,color:'#8b5cf6',bg:'#f3e8ff'},
    {label:'Nháp',value:draft,color:'#f59e0b',bg:'#fef9c3'},
  ].map(s=>`<div class="card stat-card" style="padding:20px"><div class="stat-label">${s.label}</div><div class="stat-value" style="color:${s.color}">${s.value}</div></div>`).join('');
}

function renderNotifList() {
  const q = (document.getElementById('notif-search')?.value||'').toLowerCase();
  const ft = document.getElementById('notif-filter-type')?.value||'';
  const fs = document.getElementById('notif-filter-status')?.value||'';
  const list = notifications.filter(n => {
    const matchQ = !q || n.title.toLowerCase().includes(q) || n.msg.toLowerCase().includes(q);
    const matchT = !ft || (typeMap[ft]||ft) === n.type;
    const matchS = !fs || n.status === fs;
    return matchQ && matchT && matchS;
  });
  document.getElementById('notif-list').innerHTML = list.map(n => {
    const ts = typeStyle[n.type];
    const pct = n.total > 0 ? Math.round(n.read/n.total*100) : 0;
    return `
    <div class="card card-body">
      <div style="display:flex;align-items:flex-start;gap:14px">
        <div style="width:40px;height:40px;border-radius:50%;background:${ts.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="${ts.color}" stroke-width="2" width="18" height="18"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div style="font-weight:600;font-size:14px">${n.title}</div>
            <div style="display:flex;align-items:center;gap:8px">
              ${statusBadge(n.status)}
              <span style="font-size:12px;color:var(--gray-400)">${n.date}</span>
            </div>
          </div>
          <div style="font-size:13px;color:var(--gray-600);margin-bottom:8px">${n.msg}</div>
          <div style="display:flex;align-items:center;gap:16px">
            <span style="font-size:12px;color:var(--gray-500)">📧 ${n.recipients}</span>
            ${n.status==='sent'?`
              <div style="display:flex;align-items:center;gap:8px">
                <div class="progress" style="width:80px"><div class="progress-bar" style="width:${pct}%;background:#0ea5e9"></div></div>
                <span style="font-size:12px;color:var(--gray-500)">${n.read}/${n.total} đã đọc (${pct}%)</span>
              </div>
            `:''}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="icon-btn" onclick="openNotifDetail('${n.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="icon-btn" style="color:var(--red)" onclick="deleteNotif('${n.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openNotifDetail(id) {
  const n = notifications.find(item => String(item.id) === String(id));
  if (!n) return;
  const ts = typeStyle[n.type] || typeStyle.info;
  const pct = n.total > 0 ? Math.round((n.read / n.total) * 100) : 0;
  const body = document.getElementById('view-notif-body');
  if (!body) return;

  body.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:18px">
      <div style="width:44px;height:44px;border-radius:50%;background:${ts.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="${ts.color}" stroke-width="2" width="20" height="20"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:18px;font-weight:700;color:var(--gray-900);margin-bottom:8px">${n.title}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${statusBadge(n.status)}
          <span style="font-size:12px;color:var(--gray-500)">Thời gian gửi: ${n.date}</span>
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
        <div class="progress" style="width:100%"><div class="progress-bar" style="width:${pct}%;background:#0ea5e9"></div></div>
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
  } catch (e) {
    return [];
  }
}

function saveNotifStaffCache(list) {
  try {
    localStorage.setItem('flic_notif_staff_cache', JSON.stringify(list || []));
  } catch (e) {}
}

async function ensureNotifStaffOptions() {
  if (notifStaffOptions.length) return notifStaffOptions;

  const cached = loadNotifStaffCache();
  if (cached.length) notifStaffOptions = cached;

  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/staff`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
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
        { id: '3', name: 'Lê Thị Cúc', email: 'cuc@flic.edu.vn', username: 'cuc', dept: 'Hành chính' },
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
    const haystack = [item.name, item.email, item.id, item.username, item.dept]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
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
    const val = e.target.value.replace(/,/g,'').trim();
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
    <span style="display:inline-flex;align-items:center;gap:5px;background:#e0f2fe;color:#0284c7;border-radius:999px;padding:3px 10px 3px 12px;font-size:12px;font-weight:500">
      ${e}
      <button onclick="removeEmailTag('${e}')" style="background:none;border:none;cursor:pointer;color:#0284c7;padding:0;display:flex;line-height:1" title="Xóa">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </span>`).join('');
}

function pad2(n) {
  return String(n).padStart(2,'0');
}

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

function openNotifModal() {
  setNotifCurrentDateTime();
  ensureNotifStaffOptions();
  if (notifRealtimeTimer) clearInterval(notifRealtimeTimer);
  notifRealtimeTimer = setInterval(setNotifRealtimeLabel, 1000);
  openModal('create-notif-modal');
}

function closeNotifModal() {
  if (notifRealtimeTimer) {
    clearInterval(notifRealtimeTimer);
    notifRealtimeTimer = null;
  }
  renderNotifRecipientSuggestions([], '');
  closeModal('create-notif-modal');
}

function saveNotifAction(status) {
  const title = document.getElementById('notif-title').value.trim();
  const msg = document.getElementById('notif-msg').value.trim();
  if (!title) { showToast('Vui lòng nhập tiêu đề!', 'error'); document.getElementById('notif-title').focus(); return; }
  if (!msg) { showToast('Vui lòng nhập nội dung!', 'error'); document.getElementById('notif-msg').focus(); return; }
  const recipients = document.getElementById('notif-recip').value.trim();
  if (!recipients) { showToast('Vui lòng thêm ít nhất một người nhận!', 'error'); document.getElementById('notif-email-input').focus(); return; }
  const sendDate = document.getElementById('notif-send-date').value;
  syncNotifTime();
  const sendTime = document.getElementById('notif-send-time-val').value;
  if (!sendDate || !sendTime) { showToast('Vui lòng chọn ngày và giờ gửi!', 'error'); return; }
  const d = new Date(`${sendDate}T${sendTime}`);
  const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const newNotif = {
    id: 'n-' + Date.now(),
    title, msg, type: 'info', recipients,
    status: 'scheduled',
    date: dateStr,
    read: 0,
    total: emailTags.length,
    _bellNew: true,
  };
  notifications.unshift(newNotif);
  saveNotifs(notifications);
  closeModal('create-notif-modal');
  document.getElementById('notif-title').value = '';
  document.getElementById('notif-msg').value = '';
  document.getElementById('notif-char-count').textContent = '0';
  document.getElementById('notif-send-date').value = '';
  document.getElementById('notif-send-time-val').value = '08:00';
  if(document.getElementById('notif-hour')) document.getElementById('notif-hour').value='08';
  if(document.getElementById('notif-minute')) document.getElementById('notif-minute').value='00';
  if(document.getElementById('notif-ampm')) document.getElementById('notif-ampm').value='PM';
  emailTags = [];
  renderEmailTags();
  document.getElementById('notif-recip').value = '';
  renderNotifStats();
  renderNotifList();
  showToast('Đã lên lịch gửi thông báo!', 'success');
}

function deleteNotif(id) {
  if (!confirm('Bạn có chắc muốn xóa thông báo này?')) return;
  notifications = notifications.filter(n => n.id !== id);
  saveNotifs(notifications);
  renderNotifStats();
  renderNotifList();
  showToast('Đã xóa thông báo', 'error');
}

function updateNotifModalActions() {
  const openBtn = document.querySelector(`button[onclick="openModal('create-notif-modal')"]`);
  if (openBtn) openBtn.setAttribute('onclick', 'openNotifModal()');

  const closeBtn = document.querySelector(`#create-notif-modal .close-btn`);
  if (closeBtn) closeBtn.setAttribute('onclick', 'closeNotifModal()');

  const footer = document.querySelector('#create-notif-modal .modal-footer');
  if (!footer) return;
  footer.innerHTML = `
    <button class="btn btn-outline" style="flex:1;justify-content:center" onclick="closeNotifModal()">Hủy</button>
    <button class="btn btn-primary" style="flex:1;justify-content:center;gap:8px" onclick="saveNotifAction('sent')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      Gửi bây giờ
    </button>
  `;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

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

function openNotifModal() {
  setNotifCurrentDateTime();
  if (notifRealtimeTimer) clearInterval(notifRealtimeTimer);
  notifRealtimeTimer = setInterval(setNotifRealtimeLabel, 1000);
  openModal('create-notif-modal');
}

function closeNotifModal() {
  if (notifRealtimeTimer) {
    clearInterval(notifRealtimeTimer);
    notifRealtimeTimer = null;
  }
  closeModal('create-notif-modal');
}

function saveNotifAction(status) {
  const title = document.getElementById('notif-title').value.trim();
  const msg = document.getElementById('notif-msg').value.trim();
  if (!title) { showToast('Vui lòng nhập tiêu đề!', 'error'); document.getElementById('notif-title').focus(); return; }
  if (!msg) { showToast('Vui lòng nhập nội dung!', 'error'); document.getElementById('notif-msg').focus(); return; }
  const recipients = document.getElementById('notif-recip').value.trim();
  if (!recipients) { showToast('Vui lòng thêm ít nhất một người nhận!', 'error'); document.getElementById('notif-email-input').focus(); return; }

  const now = new Date();
  const sendDate = status === 'sent'
    ? `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
    : document.getElementById('notif-send-date').value;
  const sendTime = status === 'sent'
    ? `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
    : document.getElementById('notif-send-time-val').value;

  if (!sendDate || !sendTime) { showToast('Vui lòng chọn ngày và giờ gửi!', 'error'); return; }
  const d = new Date(`${sendDate}T${sendTime}`);
  if (Number.isNaN(d.getTime())) { showToast('Ngày giờ gửi không hợp lệ!', 'error'); return; }

  const dateStr = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const newNotif = {
    id: 'n-' + Date.now(),
    title,
    msg,
    type: 'info',
    recipients,
    status,
    date: dateStr,
    read: 0,
    total: emailTags.length,
    _bellNew: true,
  };

  notifications.unshift(newNotif);
  saveNotifs(notifications);
  closeNotifModal();
  document.getElementById('notif-title').value = '';
  document.getElementById('notif-msg').value = '';
  document.getElementById('notif-char-count').textContent = '0';
  setNotifCurrentDateTime();
  emailTags = [];
  renderEmailTags();
  document.getElementById('notif-recip').value = '';
  renderNotifStats();
  renderNotifList();
  showToast(status === 'sent' ? 'Đã gửi thông báo ngay bây giờ!' : 'Đã lên lịch gửi thông báo!', 'success');
}

// Init
updateNotifModalActions();
renderNotifStats();
renderNotifList();