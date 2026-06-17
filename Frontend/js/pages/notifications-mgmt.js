// ── State & Variables ──────────────────────────────────────────────
let notifications = [];
let notifStats = { tong: 0, da_gui: 0, len_lich: 0, nhap: 0, tong_luot_doc: 0 };
let notifRealtimeTimer = null;
let notifStaffOptions = [];
let notifSuggestionHideTimer = null;
let currentEditingDraftId = null;
let isSubmitting = false;
let notifCurrentPage = 1;

const typeStyle = {
  info: { bg: '#eff6ff', color: '#00008B', border: '#00008B' },
  success: { bg: '#f0fdf4', color: '#16a34a', border: '#22c55e' },
  error: { bg: '#fef2f2', color: '#dc2626', border: '#ef4444' },
};
const typeLabel = { info: 'Thông báo', success: 'Phê duyệt', error: 'Từ chối' };
const typeIconMap = {
  info: `<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>`,
  success: `<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  error: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`
};
const typeMap = { 'Thông báo': 'info', 'Phê duyệt': 'success', 'Từ chối': 'error' };

const statusBadge = s => s === 'sent'
  ? '<span class="badge" style="background:#e0f2fe;color:#0284c7;font-weight:600;border:1px solid #bae6fd;display:inline-flex;justify-content:center;width:88px;box-sizing:border-box">✓ Đã gửi</span>'
  : s === 'scheduled'
    ? '<span class="badge" style="background:#dbeafe;color:#2563eb;font-weight:600;border:1px solid #bfdbfe;display:inline-flex;justify-content:center;width:88px;box-sizing:border-box">⏰ Lên lịch</span>'
    : '<span class="badge" style="background:#f1f5f9;color:#64748b;font-weight:600;border:1px solid #e2e8f0;display:inline-flex;justify-content:center;width:88px;box-sizing:border-box">✎ Nháp</span>';

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Layout ────────────────────────────────────────────────────────
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

  <!-- Search & Filter Bar -->
  <div class="card" style="margin-bottom:20px;border:1px solid var(--gray-200)">
    <div class="card-body" style="padding:14px 20px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <div class="input-wrap" style="flex:1;min-width:220px">
          <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <input type="text" id="notif-search" class="input" placeholder="Tìm kiếm theo tiêu đề hoặc nội dung..." oninput="renderNotifList(true)" style="background:#f8fafc">
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <div style="position:relative">
            <select id="notif-filter-type" class="input" style="width:auto" onchange="renderNotifList(true)">
              <option value="">Tất cả loại</option>
              <option>Thông báo</option>
              <option>Phê duyệt</option>
              <option>Từ chối</option>
            </select>
          </div>
          <div style="position:relative">
            <select id="notif-filter-status" class="input" style="width:auto" onchange="renderNotifList(true)">
              <option value="">Tất cả trạng thái</option>
              <option value="sent">Đã gửi</option>
              <option value="scheduled">Lên lịch</option>
              <option value="draft">Nháp</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Notification list -->
  <div id="notif-list" style="display:flex;flex-direction:column;gap:10px"></div>
  
  <div id="notif-pagination" style="display:none;background:#fff;border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:12px 18px;align-items:center;justify-content:space-between;margin-top:16px;box-shadow:var(--shadow-sm);gap:12px;flex-wrap:wrap">
    <span id="notif-page-info" style="font-size:13px;color:var(--gray-500)"></span>
    <div id="notif-page-buttons" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"></div>
  </div>

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
      notifications = data.map(n => {
        let currentStatus = n.trang_thai;
        if (currentStatus === 'scheduled' && n.ngay_gui) {
          const d = new Date(n.ngay_gui);
          if (!Number.isNaN(d.getTime()) && d.getTime() <= Date.now()) {
            currentStatus = 'sent';
          }
        }
        return {
          id: String(n.id),
          title: n.tieu_de,
          msg: n.noi_dung,
          type: n.loai || 'info',
          recipients: n.nguoi_nhan,
          status: currentStatus,
          date: n.ngay_gui ? formatDBDate(n.ngay_gui) : formatDBDate(n.ngay_tao),
          rawDate: n.ngay_gui || n.ngay_tao,
          read: n.luot_da_doc || 0,
          total: n.tong_nguoi_nhan || 0,
          sender: n.nguoi_gui
        };
      });
    }

    const statsRes = await fetch(`${API_BASE}/notifications/stats`, { headers: authHeaders() });
    if (statsRes.ok) {
      notifStats = await statsRes.json();
      notifStats.da_gui = notifications.filter(n => n.status === 'sent').length;
      notifStats.len_lich = notifications.filter(n => n.status === 'scheduled').length;
    }
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }

  renderNotifStats();
  renderNotifList();
  
  const params = new URLSearchParams(window.location.search);
  const viewId = params.get('view');
  if (viewId) {
    // wait a tiny bit to ensure UI is ready
    setTimeout(() => {
      openNotifDetail(viewId);
      // clean up url
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 100);
  }
}

function formatDBDate(dbDateStr) {
  if (!dbDateStr) return 'Chưa gửi';
  const d = new Date(dbDateStr);
  if (Number.isNaN(d.getTime())) return 'Chưa gửi';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatRelativeTime(dbDateStr) {
  if (!dbDateStr) return 'Chưa gửi';
  const d = new Date(dbDateStr);
  if (Number.isNaN(d.getTime())) return 'Chưa gửi';

  const now = new Date();
  const diffMs = now - d;

  if (diffMs < 0) return formatDBDate(dbDateStr);

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;

  if (now.getMonth() === d.getMonth() && now.getFullYear() === d.getFullYear()) {
    return `${diffDays} ngày trước`;
  }

  return formatDBDate(dbDateStr);
}

// ── Render helpers ────────────────────────────────────────────────
function renderNotifStats() {
  const t = notifStats;
  document.getElementById('notif-stats').innerHTML = [
    statCard("Tổng thông báo", `<span style="color:#00008B">${t.tong || 0}</span>`, "#00008B", "#eff6ff", '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>'),
    statCard("Đã gửi", `<span style="color:#0284c7">${t.da_gui || 0}</span>`, "#0284c7", "#e0f2fe", '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
    statCard("Lên lịch", `<span style="color:#2563eb">${t.len_lich || 0}</span>`, "#2563eb", "#dbeafe", '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    statCard("Nháp", `<span style="color:#64748b">${t.nhap || 0}</span>`, "#64748b", "#f1f5f9", '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>')
  ].join('');
}

function renderNotifList(resetPage = false) {
  if (resetPage) notifCurrentPage = 1;
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
  const pagEl = document.getElementById('notif-pagination');
  if (!list.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:60px 20px;background:#fff;border:1px solid var(--gray-200);border-radius:var(--radius-lg)">
        <div style="width:60px;height:60px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" width="28" height="28"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        </div>
        <div style="font-size:15px;font-weight:600;color:var(--gray-600);margin-bottom:6px">Không tìm thấy thông báo</div>
        <div style="font-size:13px;color:var(--gray-400)">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</div>
      </div>`;
    if (pagEl) pagEl.style.display = 'none';
    return;
  }

  const itemsPerPage = 10;
  const totalPages = Math.ceil(list.length / itemsPerPage);
  if (notifCurrentPage > totalPages) notifCurrentPage = totalPages;
  if (notifCurrentPage < 1) notifCurrentPage = 1;

  const startIndex = (notifCurrentPage - 1) * itemsPerPage;
  const paginatedList = list.slice(startIndex, startIndex + itemsPerPage);

  listEl.innerHTML = paginatedList.map(n => {
    const ts = typeStyle[n.type] || typeStyle.info;
    const pct = n.total > 0 ? Math.round(n.read / n.total * 100) : 0;
    const formattedDate = formatRelativeTime(n.rawDate);
    const tLabel = typeLabel[n.type] || 'Thông tin';
    return `
    <div style="
      background:#fff;
      border:1px solid var(--gray-200);
      border-radius:14px;
      border-left:4px solid ${ts.border};
      box-shadow:0 1px 4px rgba(0,0,0,0.05);
      cursor:pointer;
      transition:box-shadow 0.18s, transform 0.18s;
      overflow:hidden;
    " onmouseenter="this.style.boxShadow='0 6px 20px rgba(0,0,0,0.1)';this.style.transform='translateY(-1px)'" onmouseleave="this.style.boxShadow='0 1px 4px rgba(0,0,0,0.05)';this.style.transform='translateY(0)'" onclick="openNotifDetail('${n.id}')">
      <div style="padding:16px 18px;display:flex;align-items:center;gap:14px">
        
        <!-- Icon -->
        <div style="width:44px;height:44px;border-radius:12px;background:${ts.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid ${ts.border}22">
          <svg viewBox="0 0 24 24" fill="none" stroke="${ts.color}" stroke-width="2" width="20" height="20">${typeIconMap[n.type] || typeIconMap.info}</svg>
        </div>
        
        <!-- Main content -->
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:5px">
            <div style="min-width:0">
              <div style="font-weight:700;font-size:14px;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.title}</div>
              <div style="font-size:12px;color:${ts.color};font-weight:500;margin-top:1px">${tLabel}</div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
              <div style="width:88px;display:flex;justify-content:flex-end">
                ${statusBadge(n.status)}
              </div>
              <div style="width:120px;text-align:right">
                <span style="font-size:12px;color:var(--gray-400);white-space:nowrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="display:inline;vertical-align:middle;margin-right:3px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  ${n.status === 'draft' ? 'Chưa gửi' : formattedDate}
                </span>
              </div>
            </div>
          </div>
          <div style="font-size:13px;color:var(--gray-500);margin-bottom:8px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden">${n.msg}</div>
          <div style="display:flex;align-items:center;gap:16px">
            <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--gray-500);background:var(--gray-50);padding:3px 10px;border-radius:999px;border:1px solid var(--gray-200)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              ${n.recipients}
            </span>
            ${n.status === 'sent' && n.total > 0 ? `
              <span style="display:inline-flex;align-items:center;gap:8px">
                <div style="width:80px;height:5px;background:var(--gray-100);border-radius:999px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#00008B,#0284c7);border-radius:999px;transition:width 0.4s"></div>
                </div>
                <span style="font-size:12px;color:var(--gray-500)">${n.read}/${n.total} đã đọc (${pct}%)</span>
              </span>
            ` : ''}
          </div>
        </div>
        
        <!-- Delete button -->
        <div style="flex-shrink:0">
          <button class="icon-btn" style="color:var(--gray-400);border-radius:8px" onclick="event.stopPropagation(); deleteNotif('${n.id}')" onmouseenter="this.style.color='#dc2626';this.style.background='#fef2f2'" onmouseleave="this.style.color='var(--gray-400)';this.style.background='transparent'" title="Xóa thông báo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  if (pagEl) {
    if (totalPages <= 1) {
      pagEl.style.display = 'none';
    } else {
      pagEl.style.display = 'flex';
      const startIdx = (notifCurrentPage - 1) * itemsPerPage + 1;
      const endIdx = Math.min(notifCurrentPage * itemsPerPage, list.length);
      document.getElementById('notif-page-info').innerHTML = `Hiển thị <strong>${startIdx}-${endIdx}</strong> / <strong>${list.length}</strong> thông báo`;

      let html = `<button class="pag-btn" ${notifCurrentPage === 1 ? 'disabled' : ''} onclick="changeNotifPage(${notifCurrentPage - 1})">Trước</button>`;
      for (let i = 1; i <= totalPages; i++) {
        html += `<button class="pag-btn ${i === notifCurrentPage ? 'active' : ''}" onclick="changeNotifPage(${i})">${i}</button>`;
      }
      html += `<button class="pag-btn" ${notifCurrentPage === totalPages ? 'disabled' : ''} onclick="changeNotifPage(${notifCurrentPage + 1})">Sau</button>`;
      document.getElementById('notif-page-buttons').innerHTML = html;
    }
  }
}

function changeNotifPage(page) {
  notifCurrentPage = page;
  renderNotifList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  try { localStorage.setItem('flic_notif_staff_cache', JSON.stringify(list || [])); } catch (e) { }
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
    nhan_vien_id: JSON.parse(localStorage.getItem('flic_user') || '{}')?.id || null
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
    nhan_vien_id: JSON.parse(localStorage.getItem('flic_user') || '{}')?.id || null
  };

  try {
    let realId = currentEditingDraftId;
    if (currentEditingDraftId) {
      await fetch(`${API_BASE}/notifications/${currentEditingDraftId}`, {
        method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      const res = await fetch(`${API_BASE}/notifications`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        realId = data.id;
      }
    }

    if ((finalStatus === 'sent' || finalStatus === 'scheduled') && realId) {
      try {
        const raw = localStorage.getItem('flic_notifications');
        const notifs = raw ? JSON.parse(raw) : [];
        notifs.unshift({
          id: realId,
          title: title,
          msg: msg,
          type: 'info',
          recipients: recipients,
          status: finalStatus,
          date: formatDBDate(d.toISOString()),
          read: 0,
          total: emailTags.length,
          _bellNew: true,
        });
        localStorage.setItem('flic_notifications', JSON.stringify(notifs));
        window.dispatchEvent(new Event("storage"));
      } catch (e) { }
    }
  } catch (e) {
    console.error(e);
  }

  isSubmitting = true;
  closeNotifModal();

  await loadNotificationsData();
  showToast(finalStatus === 'sent' ? 'Đã gửi thông báo ngay bây giờ!' : 'Đã lên lịch gửi thông báo!', 'success');
}

let notifToDelete = null;

function deleteNotif(id) {
  notifToDelete = id;
  let modal = document.getElementById('delete-notif-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'delete-notif-modal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width:400px;border-radius:14px">
        <div class="modal-header">
          <div><div class="modal-title" style="color:var(--red)">Xóa thông báo</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Xác nhận hành động</div></div>
          <button class="icon-btn close-btn" onclick="closeDeleteNotifModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style="padding:20px;font-size:14px;color:var(--gray-700);text-align:left">
          Bạn có chắc chắn muốn xóa thông báo này không? Hành động này không thể hoàn tác.
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeDeleteNotifModal()">Hủy bỏ</button>
          <button class="btn" style="background:var(--red);color:#fff" onclick="confirmDeleteNotif()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Xóa thông báo
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    // Force a reflow so the transition works on first append
    modal.offsetHeight;
  }
  modal.classList.add('open');
}

function closeDeleteNotifModal() {
  const modal = document.getElementById('delete-notif-modal');
  if (modal) {
    modal.classList.remove('open');
  }
  notifToDelete = null;
}

async function confirmDeleteNotif() {
  if (!notifToDelete) return;
  const id = notifToDelete;
  closeDeleteNotifModal();
  try {
    await fetch(`${API_BASE}/notifications/${id}`, { method: 'DELETE', headers: authHeaders() });
  } catch (e) { }
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