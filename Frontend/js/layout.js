// ===== PERMISSION HELPERS =====
const getUser  = () => { try { return JSON.parse(localStorage.getItem('user'))  || null; } catch { return null; } };
const getQuyen = () => { try { return JSON.parse(localStorage.getItem('quyen')) || {};   } catch { return {}; } };
const isAdmin  = () => { const r = getUser()?.vai_tro; return r === 'admin' || r === 'manager'; };
const hasPermission    = key      => isAdmin() || !!getQuyen()[key];
const hasAnyPermission = (keys=[]) => isAdmin() || keys.some(k => !!getQuyen()[k]);

const MENU_PERMS = {
  'form-management':         q => q.view_form||q.add_form||q.edit_form||q.delete_form,
  'approval-management':     q => q.view_approval||q.approve||q.share_form,
  'reports-statistics':      q => q.view_report||q.export_data,
  'staff-management':        q => q.view_staff||q.manage_staff,
  'notification-management': q => q.view_notif||q.send_notif,
};
const canViewMenu = code => isAdmin() || code === 'dashboard' || !!(MENU_PERMS[code]?.(getQuyen()));

function requireMenuAccess(menuCode) {
  if (!canViewMenu(menuCode)) { alert('Bạn không có quyền truy cập chức năng này'); window.location.href='dashboard.html'; return false; }
  return true;
}
function requirePagePermission(keys=[]) {
  if (!hasAnyPermission(keys)) { alert('Bạn không có quyền truy cập chức năng này'); window.location.href='dashboard.html'; return false; }
  return true;
}
function applyPageQuyen(rules) {
  if (isAdmin()) return;
  const q = getQuyen();
  Object.entries(rules).forEach(([key, sel]) => {
    if (!q[key]) document.querySelectorAll(sel).forEach(el => el.style.display='none');
  });
}

// ===== SHARED LAYOUT GENERATOR =====
function renderLayout(pageId, pageTitle, contentHTML) {
  const logo = '../src/assets/bb21610d5fa0b1d8a65b7ce9827d83c61bf7a2c5.png';
  const user  = getUser() || {};
  const q     = getQuyen();
  const isAdm = user.vai_tro === 'admin' || user.vai_tro === 'manager';
  const displayName = user.ho_ten || 'User';
  const roleLabel   = (user.vai_tro==='admin' || user.vai_tro==='manager') ? 'Quản lý' : 'Nhân viên';

  const navItems = [
    { id:'home',      label:'Trang chủ',           href:'dashboard.html', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
    { id:'favorites', label:'Danh sách yêu thích', href:'favorites.html', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>' },
  ];
  const mgmtItems = [
    { id:'form-management',         label:'Quản lý biểu mẫu',  href:'form-management.html',   show:()=>q.view_form||q.add_form||q.edit_form||q.delete_form, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
    { id:'library',                 label:'Thư viện câu hỏi',   href:'library.html',           show:()=>q.view_form||q.add_form||isAdm, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>' },
    { id:'approval-management',     label:'Quản lý phê duyệt', href:'approval.html',          show:()=>q.view_approval||q.approve, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>' },
    { id:'reports-statistics',      label:'Báo cáo - thống kê',href:'reports.html',           show:()=>q.view_report||q.export_data, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
    { id:'feedback-management',     label:'Quản lý phản hồi',  href:'feedback.html',          show:()=>q.view_feedback||q.delete_feedback, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' },
    { id:'staff-management',        label:'Quản lý nhân viên', href:'staff.html',             show:()=>q.view_staff||q.manage_staff, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>' },
    { id:'notification-management', label:'Quản lý thông báo', href:'notifications-mgmt.html',show:()=>q.view_notif||q.send_notif, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>' },
    { id:'trash',                   label:'Thùng rác',          href:'trash.html',             show:()=>q.delete_form||isAdm, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4h6v2"/></svg>' },
  ];

  const visibleMgmt = mgmtItems.filter(i => isAdm || i.show());
  const ni = i => `<a href="${i.href}" class="sidebar-item${i.id===pageId?' active':''}" data-page="${i.id}">${i.icon}<span>${i.label}</span></a>`;

  return `
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-logo">
        <img src="${logo}" alt="FLIC Logo" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <div style="display:none;font-size:20px;font-weight:700;color:#38bdf8">FLIC</div>
        <div class="sidebar-tagline">TT Ngoại ngữ - Tin học (FLIC)</div>
      </div>
      <nav class="sidebar-nav">
        ${navItems.map(ni).join('')}
        ${visibleMgmt.length?'<div class="sidebar-section-label">Quản lý</div>':''}
        ${visibleMgmt.map(ni).join('')}
      </nav>
      <div class="sidebar-bottom">
        <a href="settings.html" class="sidebar-item${pageId==='settings'?' active':''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          <span>Cài đặt</span>
        </a>
        <button onclick="logout()" class="sidebar-item logout" style="width:100%">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
    <div class="main-content">
      <header class="header">
        <div style="display:flex;align-items:center;gap:12px">
          <button onclick="window.location.href='dashboard.html'" style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;cursor:pointer;background:transparent;border:none;transition:background .15s;color:var(--gray-600)" onmouseenter="this.style.background='var(--gray-100)'" onmouseleave="this.style.background='transparent'" title="Về trang chủ">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
        </div>
        <div class="header-actions" style="position:relative">
          <button class="icon-btn" onclick="openPanel('notif-panel')" id="bell-btn" style="position:relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            <span id="bell-badge" style="display:none;position:absolute;top:2px;right:2px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;border-radius:999px;min-width:16px;height:16px;line-height:16px;text-align:center;padding:0 3px"></span>
          </button>
          <div class="user-chip" onclick="toggleUserDropdown(event)" style="cursor:pointer;position:relative;user-select:none">
            <div class="user-avatar"><img src="${logo}" alt="FLIC Logo" class="user-avatar-logo" onerror="this.style.display='none';this.parentElement.textContent='F'"></div>
            <span class="user-name">${displayName}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-left:4px;opacity:0.6"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div id="user-dropdown" style="display:none;position:absolute;top:calc(100% + 8px);right:0;background:#fff;border:1px solid var(--gray-200);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:200px;z-index:9999;overflow:hidden">
            <div style="padding:14px 16px;border-bottom:1px solid var(--gray-100);background:var(--gray-50)">
              <div style="font-weight:700;font-size:13.5px;color:var(--gray-800)">${displayName}</div>
              <div style="font-size:12px;color:var(--gray-400);margin-top:2px">${roleLabel}</div>
            </div>
            <div style="padding:6px">
              <button onclick="goToSettingsTab('account')" style="width:100%;display:flex;align-items:center;gap:10px;padding:9px 12px;border:none;background:none;cursor:pointer;border-radius:8px;font-size:13px;color:var(--gray-700)" onmouseenter="this.style.background='var(--gray-50)'" onmouseleave="this.style.background='none'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Hồ sơ cá nhân
              </button>
              <button onclick="goToSettingsTab('security')" style="width:100%;display:flex;align-items:center;gap:10px;padding:9px 12px;border:none;background:none;cursor:pointer;border-radius:8px;font-size:13px;color:var(--gray-700)" onmouseenter="this.style.background='var(--gray-50)'" onmouseleave="this.style.background='none'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Đổi mật khẩu
              </button>
              <div style="height:1px;background:var(--gray-100);margin:4px 0"></div>
              <button onclick="logout()" style="width:100%;display:flex;align-items:center;gap:10px;padding:9px 12px;border:none;background:none;cursor:pointer;border-radius:8px;font-size:13px;color:#ef4444" onmouseenter="this.style.background='#fff1f2'" onmouseleave="this.style.background='none'">
                <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" width="16" height="16"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </header>
      <main class="page-body">${contentHTML}</main>
    </div>
  </div>
  <div class="panel-overlay" id="notif-panel" onclick="closePanel('notif-panel')">
    <div class="panel" onclick="event.stopPropagation()">
      <div class="panel-header">
        <span class="panel-title">Thông báo</span>
        <button class="icon-btn close-btn" onclick="closePanel('notif-panel')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="panel-body" id="notif-panel-body"></div>
      <div style="padding:16px;border-top:1px solid var(--gray-200)">
        <a href="notifications-mgmt.html" class="btn btn-outline btn-full">Xem tất cả thông báo</a>
      </div>
    </div>
  </div>
  <div id="toast-container"></div>`;
}

// ===== USER DROPDOWN =====
function toggleUserDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('user-dropdown');
  if (!dd) return;
  const vis = dd.style.display === 'block';
  dd.style.display = vis ? 'none' : 'block';
  if (!vis) setTimeout(() => document.addEventListener('click', () => { if(dd) dd.style.display='none'; }, { once: true }), 0);
}
function goToSettingsTab(tab) {
  document.getElementById('user-dropdown').style.display = 'none';
  if (window.location.pathname.endsWith('settings.html')) {
    if (typeof switchTab === 'function') { switchTab(tab); return; }
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.toggle('active', el.dataset.tabContent===tab));
  } else {
    window.location.href = 'settings.html?tab=' + tab;
  }
}
function logout() {
  ['token','user','quyen'].forEach(k => localStorage.removeItem(k));
  window.location.href = '../index.html';
}

// ===== BELL NOTIFICATIONS =====
const BELL_LS_NOTIFS = 'flic_notifications';
const BELL_READ_KEY  = 'flic_bell_read_count';
const _bellIcon = {
  info:    `<svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" width="18" height="18"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  error:   `<svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};
const _bellBg = { info:'#dbeafe', success:'#dcfce7', warning:'#fef9c3', error:'#fee2e2' };
const getBellNotifs = () => { try { return JSON.parse(localStorage.getItem(BELL_LS_NOTIFS))||[]; } catch { return []; } };

function updateBellBadge() {
  const badge = document.getElementById('bell-badge');
  if (!badge) return;
  const unread = Math.max(0, getBellNotifs().length - parseInt(localStorage.getItem(BELL_READ_KEY)||'0', 10));
  badge.textContent = unread > 99 ? '99+' : unread;
  badge.style.display = unread > 0 ? 'inline-block' : 'none';
}
function renderBellNotifs() {
  const body = document.getElementById('notif-panel-body');
  if (!body) return;
  const notifs = getBellNotifs().slice(0, 10);
  body.innerHTML = notifs.length
    ? notifs.map(n => {
        const t = n.type || 'info';
        return `<div class="notif-item${n._bellNew?' unread':''}">
          <div class="notif-icon" style="background:${_bellBg[t]||'#dbeafe'}">${_bellIcon[t]||_bellIcon.info}</div>
          <div><div class="notif-title">${n.title||''}</div><div class="notif-msg">${n.msg||''}</div><div class="notif-time">${n.date||''}</div></div>
        </div>`;
      }).join('')
    : '<div style="text-align:center;padding:32px;color:var(--gray-400);font-size:13px">Chưa có thông báo nào</div>';
  updateBellBadge();
}
function markBellRead() { localStorage.setItem(BELL_READ_KEY, String(getBellNotifs().length)); updateBellBadge(); }

const _origOpenPanel = window.openPanel;
window.openPanel = function(id) {
  _origOpenPanel?.(id);
  if (id === 'notif-panel') { renderBellNotifs(); markBellRead(); }
};
window.addEventListener('storage', e => { if (e.key===BELL_LS_NOTIFS) { renderBellNotifs(); updateBellBadge(); } });
setInterval(updateBellBadge, 3000);
renderBellNotifs();
updateBellBadge();