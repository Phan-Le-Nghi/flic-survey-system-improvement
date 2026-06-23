const DASHBOARD_FORM_IMAGES = [
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=640&h=360&fit=crop',
];

const DASH_ICON = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  form: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  approval: '<path d="M20 6L9 17l-5-5"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  feedback: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
  bell: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  note: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/>',
  arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
};

const TASK_TYPES = ['Biểu mẫu', 'Phê duyệt', 'Phản hồi', 'Báo cáo', 'Thông báo', 'Khác'];
const TASK_PRIORITIES = ['Thấp', 'Bình thường', 'Cao'];
const TASK_STATUSES = ['Chưa thực hiện', 'Đang thực hiện', 'Hoàn thành'];
const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

let dashForms = [];
let dashFeedback = [];
let dashNotifications = [];
let dashApprovalStats = null;
let selectedWorkDate = toDateKey(new Date());
let editingTaskId = '';

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function currentUser() {
  try { return JSON.parse(localStorage.getItem('user')) || {}; } catch { return {}; }
}

function dashboardStorageKey(name) {
  const user = currentUser();
  return `flic_dashboard_${name}_${user.id || user.email || 'guest'}`;
}

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function fmtNumber(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function toDateKey(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const tzDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return tzDate.toISOString().slice(0, 10);
}

function addDays(dateValue, amount) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + amount);
  return date;
}

function sameDate(a, b) {
  return toDateKey(a) === toDateKey(b);
}

function formatDateVi(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

function formatRelativeTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function normalizeStatus(value) {
  const raw = String(value || '').toLowerCase();
  if (['active', 'hoat_dong', 'hoạt động', 'published', 'approved'].includes(raw)) return 'active';
  if (['pending', 'cho_duyet', 'chờ duyệt', 'waiting'].includes(raw)) return 'pending';
  if (['draft', 'nhap', 'nháp'].includes(raw)) return 'draft';
  if (['closed', 'da_dong', 'đã đóng', 'inactive'].includes(raw)) return 'closed';
  return raw || 'draft';
}

function statusLabel(status) {
  return {
    active: 'Hoạt động',
    pending: 'Chờ duyệt',
    draft: 'Nháp',
    closed: 'Đã đóng',
  }[normalizeStatus(status)] || 'Nháp';
}

function statusClass(status) {
  return {
    active: 'is-active',
    pending: 'is-pending',
    draft: 'is-draft',
    closed: 'is-closed',
  }[normalizeStatus(status)] || 'is-draft';
}

function allowsResponses(form) {
  const value = form.cho_phep_nhan_phan_hoi ?? form.allow_responses ?? form.nhan_phan_hoi;
  return value === undefined || value === true || value === 1 || value === '1';
}

function formCloseDate(form) {
  return form.ngay_dong || form.close_date || form.han_dong || form.den_ngay || '';
}

function formUpdatedAt(form) {
  return form.ngay_cap_nhat || form.updated_at || form.ngay_tao || form.created_at || '';
}

function formName(form) {
  return form.ten_form || form.tieu_de || form.title || form.name || 'Biểu mẫu không có tiêu đề';
}

function formCategory(form) {
  return form.bo_mon || form.danh_muc || form.category || 'Chưa phân loại';
}

function formSurveyType(form) {
  return form.loai_khao_sat || form.survey_type || form.loai || 'Khảo sát';
}

function formTarget(form) {
  return form.doi_tuong || form.target || 'Tất cả';
}

function formResponses(form) {
  return Number(form.so_phan_hoi || form.tong_phan_hoi || form.responses || 0);
}

function formImage(form, index) {
  return form.anh_bia || form.cover_url || form.image_url || form.hinh_anh_url || DASHBOARD_FORM_IMAGES[index % DASHBOARD_FORM_IMAGES.length];
}

function formCoverImage(form) {
  return String(form.anh_bia || form.cover_url || form.image_url || form.hinh_anh_url || form.theme?.headerImage || '').trim();
}

function formThemeColor(form) {
  const raw = String(form.mau_chu_de || form.theme_color || form.theme?.color || '').trim();
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw;
  const category = String(formCategory(form)).toLowerCase();
  return category.includes('tin') ? '#00008B' : '#f97316';
}

function formThemeBackground(form) {
  const raw = String(form.mau_nen || form.theme?.background || '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(raw) ? raw : '#f8fafc';
}

function renderRecentThumb(form) {
  const coverImage = formCoverImage(form);
  const themeColor = formThemeColor(form);
  const background = formThemeBackground(form);
  const status = normalizeStatus(form.trang_thai || form.status);
  const media = coverImage
    ? `<img src="${escapeHtml(coverImage)}" alt="${escapeHtml(formName(form))}" loading="lazy">`
    : `<div style="width:100%;height:100%;background:${background};display:flex;align-items:center;justify-content:center;padding:18px 24px;box-sizing:border-box">
        <div style="width:128px;height:74px;border-radius:6px;background:#fff;border:1px solid rgba(148,163,184,.55);box-shadow:0 3px 8px rgba(15,23,42,.10);overflow:hidden">
          <div style="height:13px;background:${themeColor}"></div>
          <div style="padding:10px 14px">
            <div style="height:5px;width:78%;border-radius:999px;background:#cbd5e1;margin-bottom:8px"></div>
            <div style="height:5px;width:58%;border-radius:999px;background:#e2e8f0;margin-bottom:8px"></div>
            <div style="height:5px;width:68%;border-radius:999px;background:#e2e8f0"></div>
          </div>
        </div>
      </div>`;
  return `
    <div class="recent-thumb" style="background:${background}">
      ${media}
      <span class="status-badge recent-status ${statusClass(status)}">${statusLabel(status)}</span>
      <div style="position:absolute;left:0;right:0;bottom:0;height:3px;background:${themeColor};z-index:2"></div>
    </div>`;
}

function iconSvg(path, size = 18) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="${size}" height="${size}">${path}</svg>`;
}

function getWeekDays(anchor = new Date()) {
  const today = new Date(anchor);
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(today, diffToMonday);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

function loadTasks() {
  return loadJson(dashboardStorageKey('tasks'), seedTasks());
}

function saveTasks(tasks) {
  saveJson(dashboardStorageKey('tasks'), tasks);
}

function loadNotes() {
  return loadJson(dashboardStorageKey('notes'), []);
}

function saveNotes(notes) {
  saveJson(dashboardStorageKey('notes'), notes);
}

function seedTasks() {
  const today = new Date();
  return [
    {
      id: `task-${Date.now()}-1`,
      title: 'Kiểm tra biểu mẫu khảo sát MOS',
      date: toDateKey(today),
      time: '09:00',
      type: 'Biểu mẫu',
      priority: 'Bình thường',
      status: 'Chưa thực hiện',
      note: 'Rà lại mô tả và câu hỏi bắt buộc.',
    },
    {
      id: `task-${Date.now()}-2`,
      title: 'Duyệt biểu mẫu TOEIC',
      date: toDateKey(today),
      time: '14:00',
      type: 'Phê duyệt',
      priority: 'Cao',
      status: 'Đang thực hiện',
      note: '',
    },
    {
      id: `task-${Date.now()}-3`,
      title: 'Bổ sung câu hỏi mẫu Python',
      date: toDateKey(addDays(today, 1)),
      time: '',
      type: 'Khác',
      priority: 'Thấp',
      status: 'Chưa thực hiện',
      note: '',
    },
  ];
}

function priorityClass(priority) {
  return priority === 'Cao' ? 'is-high' : priority === 'Thấp' ? 'is-low' : 'is-normal';
}

function taskStatusClass(status) {
  if (status === 'Hoàn thành') return 'is-done';
  if (status === 'Đang thực hiện') return 'is-doing';
  return 'is-todo';
}

function ensureDashboardStyle() {
  if (document.getElementById('dashboard-home-style')) return;
  document.getElementById('page-content').insertAdjacentHTML('beforebegin', `
    <style id="dashboard-home-style">
      #page-content { background:#f5f8fc; padding:14px 22px 22px; min-height:calc(100vh - 76px); }
      .home-shell { max-width:1360px; margin:0 auto; color:#102033; }
      .home-hero {
        padding:0 0 18px; margin-bottom:0;
      }
      .home-eyebrow { font-size:13px; font-weight:800; color:#00008B; margin-bottom:8px; }
      .home-hero h1 { margin:0; font-size:26px; line-height:1.2; letter-spacing:0; color:#0f172a; }
      .home-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:22px; }
      .home-btn { height:42px; padding:0 16px; border-radius:10px; border:1px solid transparent; font-weight:800; font-size:13px; display:inline-flex; align-items:center; gap:8px; text-decoration:none; cursor:pointer; }
      .home-btn.primary { background:#00008B; color:#fff; box-shadow:0 10px 24px rgba(0,0,139,.22); }
      .home-btn.secondary { background:#fff; color:#00008B; border-color:#c7d2fe; }
      .home-kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-bottom:18px; }
      .home-kpi { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:17px; box-shadow:0 10px 28px rgba(15,23,42,.05); min-height:154px; display:flex; flex-direction:column; }
      .home-kpi-top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
      .home-kpi-label { font-size:13px; color:#42526b; font-weight:800; }
      .home-kpi-value { font-size:34px; line-height:1; margin-top:10px; font-weight:900; color:#0f172a; }
      .home-kpi-desc { color:#64748b; font-size:12.5px; line-height:1.45; margin-top:10px; flex:1; }
      .home-kpi-link { margin-top:12px; color:#00008B; font-size:12.5px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:5px; }
      .home-kpi-icon { width:42px; height:42px; border-radius:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .home-main-grid { display:grid; grid-template-columns:minmax(0,1.85fr) minmax(310px,1fr); gap:18px; margin-bottom:18px; align-items:stretch; }
      .home-main-grid > div { display:flex; min-width:0; }
      .home-panel { width:100%; background:#fff; border:1px solid #e2e8f0; border-radius:18px; box-shadow:0 12px 30px rgba(15,23,42,.05); }
      .home-panel-header { padding:20px 22px 12px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
      .home-panel-title { font-size:18px; font-weight:900; color:#0f172a; }
      .home-panel-sub { font-size:12.5px; color:#64748b; margin-top:5px; line-height:1.45; }
      .week-strip { display:grid; grid-template-columns:repeat(7,minmax(76px,1fr)); gap:8px; padding:8px 22px 18px; overflow-x:auto; }
      .week-day { border:1px solid #e2e8f0; background:#f8fafc; border-radius:13px; min-height:88px; padding:10px; text-align:left; cursor:pointer; color:#334155; }
      .week-day.is-today { border-color:#00008B; background:#eef2ff; }
      .week-day.is-selected { background:#00008B; color:#fff; border-color:#00008B; box-shadow:0 12px 24px rgba(0,0,139,.2); }
      .week-label { font-size:12px; font-weight:900; opacity:.78; }
      .week-number { margin-top:5px; font-size:22px; font-weight:900; }
      .week-meta { margin-top:8px; font-size:11px; font-weight:800; min-height:16px; display:flex; align-items:center; gap:5px; }
      .work-list { padding:0 22px 20px; }
      .work-day-title { font-size:14px; font-weight:900; color:#0f172a; margin-bottom:10px; }
      #task-list { min-height:302px; max-height:302px; overflow-y:auto; padding-right:4px; }
      #task-list::-webkit-scrollbar { width:6px; }
      #task-list::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:999px; }
      #task-list::-webkit-scrollbar-track { background:transparent; }
      .task-item { display:grid; grid-template-columns:72px minmax(0,1fr) auto; gap:12px; align-items:center; padding:12px; border:1px solid #e2e8f0; border-radius:13px; background:#fbfdff; margin-bottom:8px; cursor:pointer; transition:box-shadow .15s,border-color .15s,background .2s; }
      .task-item:hover { border-color:#00008B; box-shadow:0 4px 16px rgba(0,0,139,.1); background:#f5f8ff; }
      .task-item.is-done-item { background:#f0fdf4; border-color:#bbf7d0; }
      .task-item.is-done-item:hover { background:#dcfce7; border-color:#86efac; box-shadow:0 4px 16px rgba(21,128,61,.1); }
      .task-time { color:#00008B; font-weight:900; font-size:12.5px; }
      .task-title { font-size:13.5px; color:#0f172a; font-weight:800; word-break:break-word; }
      .task-meta { display:flex; flex-wrap:wrap; gap:6px; margin-top:7px; }
      .pill { border-radius:999px; padding:3px 11px; font-size:11.5px; font-weight:700; display:inline-flex; align-items:center; gap:4px; border:1px solid transparent; }
      .pill.is-todo { background:#f1f5f9; color:#475569; border-color:#cbd5e1; }
      .pill.is-doing { background:#dbeafe; color:#1d4ed8; border-color:#93c5fd; }
      .pill.is-done { background:#dcfce7; color:#15803d; border-color:#86efac; }
      .pill.is-high { background:#fee2e2; color:#dc2626; border-color:#fecaca; }
      .pill.is-normal { background:#e0e7ff; color:#00008B; border-color:#a5b4fc; }
      .pill.is-low { background:#ecfdf5; color:#047857; border-color:#a7f3d0; }
      .task-actions { display:flex; gap:5px; }
      .icon-action { width:31px; height:31px; border-radius:9px; border:1px solid #e2e8f0; background:#fff; color:#64748b; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
      .home-input, .home-select, .home-textarea { border:1px solid #cbd5e1; border-radius:10px; padding:10px 12px; font:inherit; font-size:13px; outline:none; background:#fff; width:100%; }
      .home-input:focus, .home-select:focus, .home-textarea:focus { border-color:#00008B; box-shadow:0 0 0 3px rgba(0,0,139,.08); }
      .notif-list { padding:0 18px 18px; display:flex; flex-direction:column; gap:12px; min-height:428px; }
      .notif-list .notif-item + .notif-item, .notif-list .dashboard-placeholder-row + .dashboard-placeholder-row { margin-top: 0; }
      .notif-item { min-height:86px; display:grid; grid-template-columns:38px minmax(0,1fr); gap:14px; align-items:center; padding:14px 16px; border:1px solid #e2e8f0; border-radius:14px; background:#fbfdff; overflow:hidden; }
      .notif-list .dashboard-placeholder-row { height:86px; min-height:86px; margin-top: 0; }
      .dashboard-placeholder-row { min-height:86px; border:1px dashed #e2e8f0; border-radius:13px; background:rgba(248,250,252,.58); }
      .notif-dot { width:34px; height:34px; border-radius:12px; display:flex; align-items:center; justify-content:center; }
      .notif-title { font-weight:900; color:#0f172a; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .notif-body { margin-top:4px; color:#64748b; font-size:12.3px; line-height:1.35; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .notif-time { margin-top:6px; color:#94a3b8; font-size:11.5px; font-weight:700; }
      .recent-section { padding:20px 22px 22px; }
      .recent-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-top:16px; }
      .recent-card { border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; background:#fff; box-shadow:0 10px 24px rgba(15,23,42,.045); display:flex; flex-direction:column; min-width:0; }
      .recent-thumb { height:152px; background:#f8fafc; position:relative; overflow:hidden; }
      .recent-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
      .recent-body { padding:13px; display:flex; flex-direction:column; flex:1; }
      .recent-name { font-weight:900; color:#0f172a; line-height:1.35; min-height:38px; }
      .recent-meta { color:#64748b; font-size:12px; margin-top:8px; line-height:1.55; }
      .recent-topline { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; }
      .recent-category { display:inline-flex; align-items:center; border-radius:999px; padding:3px 11px; background:#f1f5f9; color:#475569; font-size:11px; font-weight:700; border:1px solid #cbd5e1; white-space:nowrap; }
      .recent-date { color:#64748b; font-size:12px; white-space:nowrap; }
      .status-badge { display:inline-flex; align-items:center; width:max-content; border-radius:999px; padding:3px 11px; font-size:11.5px; font-weight:700; border:1px solid transparent; margin-top:10px; }
      .status-badge.recent-status { position:absolute; top:10px; left:10px; z-index:3; margin-top:0; }
      .status-badge.is-active { background:#dcfce7; color:#166534; border-color:#86efac; }
      .status-badge.is-pending { background:#fef3c7; color:#92400e; border-color:#fde68a; }
      .status-badge.is-draft { background:#ffedd5; color:#c2410c; border-color:#fdba74; }
      .status-badge.is-closed { background:#e2e8f0; color:#334155; border-color:#cbd5e1; }
      .recent-actions { display:flex; gap:8px; margin-top:13px; flex-wrap:wrap; }
      .mini-btn { height:32px; padding:0 10px; border-radius:9px; border:1px solid #dbe3ef; background:#fff; color:#00008B; font-weight:900; font-size:12px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
      .mini-btn.primary { background:#00008B; color:#fff; border-color:#00008B; }
      .empty-state { padding:24px; text-align:center; color:#64748b; font-size:13px; border:1px dashed #cbd5e1; border-radius:14px; background:#f8fafc; }
      @keyframes wm-in { from { opacity:0; transform:translateY(10px) scale(.98); } to { opacity:1; transform:translateY(0) scale(1); } }
      @keyframes wm-backdrop-in { from { opacity:0; } to { opacity:1; } }
      .work-modal-backdrop { position:fixed; inset:0; background:rgba(10,18,35,.45); z-index:9998; display:flex; align-items:center; justify-content:center; padding:18px; animation:wm-backdrop-in .18s ease; }
      .work-modal { width:min(520px,100%); background:#fff; border-radius:16px; border:1px solid rgba(0,0,0,.08); box-shadow:0 32px 80px rgba(10,18,35,.22),0 4px 16px rgba(10,18,35,.08); overflow:hidden; animation:wm-in .2s cubic-bezier(.22,.68,0,1.2); }
      .work-modal-head { padding:20px 24px 18px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; }
      .work-modal-head-title { font-size:16px; font-weight:800; color:#0f172a; letter-spacing:-.01em; }
      .work-modal-head-sub { font-size:12px; color:#94a3b8; margin-top:2px; font-weight:500; }
      .work-modal-close { width:32px; height:32px; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; color:#64748b; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:18px; line-height:1; transition:background .15s,color .15s; }
      .work-modal-close:hover { background:#fee2e2; color:#dc2626; border-color:#fecaca; }
      .work-modal-body { padding:20px 24px 24px; display:grid; gap:16px; }
      .form-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
      .field-label { display:block; font-size:11.5px; font-weight:700; color:#64748b; margin-bottom:6px; letter-spacing:.04em; text-transform:uppercase; }
      .work-modal-footer { display:flex; justify-content:flex-end; gap:10px; padding-top:8px; border-top:1px solid #f1f5f9; margin-top:4px; }
      .wm-btn { height:38px; padding:0 18px; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; border:1px solid transparent; transition:all .15s; display:inline-flex; align-items:center; gap:7px; }
      .wm-btn.ghost { background:#fff; color:#475569; border-color:#e2e8f0; }
      .wm-btn.ghost:hover { background:#f8fafc; border-color:#cbd5e1; }
      .wm-btn.solid { background:#0f172a; color:#fff; border-color:#0f172a; }
      .wm-btn.solid:hover { background:#1e293b; }
      .wm-btn.danger { background:#fff; color:#dc2626; border-color:#fecaca; }
      .wm-btn.danger:hover { background:#fee2e2; }
      .confirm-modal { width:min(380px,100%); background:#fff; border-radius:14px; border:1px solid rgba(0,0,0,.08); box-shadow:0 24px 60px rgba(10,18,35,.2); overflow:hidden; animation:wm-in .18s cubic-bezier(.22,.68,0,1.2); padding:28px 28px 22px; text-align:center; }
      .confirm-icon { width:52px; height:52px; border-radius:14px; background:#fee2e2; color:#dc2626; display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px; }
      .confirm-title { font-size:16px; font-weight:800; color:#0f172a; margin-bottom:8px; }
      .confirm-desc { font-size:13px; color:#64748b; line-height:1.6; margin-bottom:22px; }
      .confirm-actions { display:flex; gap:10px; justify-content:center; }
      @media (max-width:1180px) {
        .home-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .home-main-grid { grid-template-columns:1fr; }
        .recent-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      }
      @media (max-width:760px) {
        #page-content { padding:10px 14px 14px; }
        .home-hero { padding:0 0 14px; }
        .home-hero h1 { font-size:23px; }
        .home-kpis { grid-template-columns:1fr; }
        .week-strip { grid-template-columns:repeat(7,86px); }
        .task-item { grid-template-columns:1fr; }
        .task-actions { justify-content:flex-start; }
        .home-panel-header { flex-direction:column; align-items:stretch; }
        .recent-grid, .form-grid-2 { grid-template-columns:1fr; }
      }
    </style>`);
}

function renderHero() {
  const user = currentUser();
  const name = user.ho_ten || user.full_name || user.name || 'Người dùng FLIC';
  return `
    <section class="home-hero">
      <div class="home-hero-content">
        <div class="home-eyebrow">${getGreeting()}, ${escapeHtml(name)}</div>
        <h1>Quản lý thông tin và công việc</h1>
      </div>
    </section>`;
}

function renderKpiCard({ label, value, desc, href, action, icon, color, bg }) {
  return `
    <article class="home-kpi" style="border-left: 4px solid ${color};">
      <div class="home-kpi-top">
        <div>
          <div class="home-kpi-label">${label}</div>
          <div class="home-kpi-value">${fmtNumber(value)}</div>
        </div>
        <div class="home-kpi-icon" style="background:${bg};color:${color}">${iconSvg(icon, 21)}</div>
      </div>
      <div class="home-kpi-desc">${desc}</div>
      <a class="home-kpi-link" href="${href}">${action} ${iconSvg(DASH_ICON.arrow, 13)}</a>
    </article>`;
}

function getFeedbackFormId(item, index) {
  return String(
    item.form_id
    ?? item.id_form
    ?? item.bieu_mau_id
    ?? item.formId
    ?? item.ma_form
    ?? item.form?.id
    ?? item.form?.form_id
    ?? item.bieu_mau?.id
    ?? item.ten_form
    ?? item.form_name
    ?? `feedback-${index}`
  );
}

function getFeedbackDate(item) {
  return item.ngay_tao
    || item.created_at
    || item.ngay_gui
    || item.submitted_at
    || item.thoi_gian_gui
    || item.submittedAt
    || item.timestamp
    || item.date
    || '';
}

function getNumericField(item, fields) {
  for (const field of fields) {
    const value = Number(item[field]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function getRecentFeedbackCount(item, startDate, now) {
  const aggregate7Days = getNumericField(item, [
    'so_phan_hoi_7_ngay',
    'tong_phan_hoi_7_ngay',
    'responses_7_days',
    'recent_responses',
    'count_7_days',
    'so_luot_7_ngay',
  ]);
  if (aggregate7Days !== null) return Math.max(0, aggregate7Days);

  const sentAt = new Date(getFeedbackDate(item));
  if (Number.isNaN(sentAt.getTime()) || sentAt < startDate || sentAt > now) return 0;

  const rowCount = getNumericField(item, ['so_luong', 'count', 'total', 'tong_luot', 'so_phan_hoi']);
  return Math.max(1, rowCount || 1);
}

function computeRecentFeedbackKpi() {
  const now = new Date();
  const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const formIds = new Set();
  let total = 0;

  dashFeedback.forEach((item, index) => {
    const count = getRecentFeedbackCount(item, startDate, now);
    if (count <= 0) return;
    formIds.add(getFeedbackFormId(item, index));
    total += count;
  });

  return {
    formsWithRecentFeedback: formIds.size,
    recentFeedbackTotal: total,
  };
}

function computeKpis() {
  const today = new Date();
  const inThreeDays = addDays(today, 3);
  const active = dashForms.filter(f => {
    const rawStatus = String(f.trang_thai || f.status || '').toLowerCase();
    if (rawStatus !== 'active') return false;
    // Loại trừ form đã qua ngày đóng (giống resolveFormStatus ở form-management)
    const closeDate = formCloseDate(f);
    if (closeDate) {
      const d = new Date(closeDate);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        if (d < today) return false;
      }
    }
    return true;
  }).length;
  const pending = dashForms.filter(f => normalizeStatus(f.trang_thai || f.status) === 'pending').length;
  const closingSoon = dashForms.filter(f => {
    const close = formCloseDate(f);
    if (!close || normalizeStatus(f.trang_thai || f.status) !== 'active') return false;
    const closeDate = new Date(close);
    return !Number.isNaN(closeDate.getTime()) && closeDate >= today && closeDate <= inThreeDays;
  }).length;
  return {
    active,
    pending: Math.max(pending, Number(dashApprovalStats?.cho_duyet || dashApprovalStats?.pending || 0)),
    closingSoon,
    ...computeRecentFeedbackKpi(),
  };
}

function renderKpis() {
  const kpi = computeKpis();
  return `
    <section class="home-kpis">
      ${renderKpiCard({
        label: 'Biểu mẫu đang hoạt động',
        value: kpi.active,
        desc: 'Các biểu mẫu đang mở và nhận phản hồi.',
        href: 'form-management.html?status=active',
        action: 'Xem biểu mẫu',
        icon: DASH_ICON.form,
        color: '#00008B',
        bg: '#eef2ff',
      })}
      ${renderKpiCard({
        label: 'Chờ phê duyệt',
        value: kpi.pending,
        desc: 'Biểu mẫu đang cần được xem xét.',
        href: 'approval.html',
        action: 'Xử lý ngay',
        icon: DASH_ICON.approval,
        color: '#ea580c',
        bg: '#ffedd5',
      })}
      ${renderKpiCard({
        label: 'Biểu mẫu sắp đóng',
        value: kpi.closingSoon,
        desc: 'Sẽ kết thúc trong 3 ngày tới.',
        href: 'form-management.html?closing=soon',
        action: 'Xem chi tiết',
        icon: DASH_ICON.clock,
        color: '#7c3aed',
        bg: '#f3e8ff',
      })}
      ${renderKpiCard({
        label: 'Số phản hồi mới',
        value: kpi.recentFeedbackTotal,
        desc: `Trong ${fmtNumber(kpi.formsWithRecentFeedback)} biểu mẫu được ghi nhận 7 ngày qua.`,
        href: 'feedback.html',
        action: 'Xem danh sách',
        icon: DASH_ICON.feedback,
        color: '#16a34a',
        bg: '#dcfce7',
      })}
    </section>`;
}

function renderWeekStrip() {
  const tasks = loadTasks();
  return getWeekDays().map(date => {
    const key = toDateKey(date);
    const dayTasks = tasks.filter(task => task.date === key);
    const classes = [
      'week-day',
      sameDate(date, new Date()) ? 'is-today' : '',
      key === selectedWorkDate ? 'is-selected' : '',
    ].filter(Boolean).join(' ');
    return `
      <button class="${classes}" onclick="selectWorkDate('${key}')">
        <div class="week-label">${WEEKDAY_LABELS[date.getDay()]}</div>
        <div class="week-number">${date.getDate()}</div>
        <div class="week-meta">${dayTasks.length ? `<span>●</span><span>${dayTasks.length} việc</span>` : ''}</div>
      </button>`;
  }).join('');
}

function renderTaskList() {
  const PRIORITY_ORDER = { 'Cao': 0, 'Bình thường': 1, 'Thấp': 2 };
  const tasks = loadTasks()
    .filter(task => task.date === selectedWorkDate)
    .sort((a, b) => {
      // Hoàn thành → xuống cuối
      const aDone = a.status === 'Hoàn thành' ? 1 : 0;
      const bDone = b.status === 'Hoàn thành' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      // Ưu tiên cao hơn → lên trước
      const aPrio = PRIORITY_ORDER[a.priority] ?? 1;
      const bPrio = PRIORITY_ORDER[b.priority] ?? 1;
      if (aPrio !== bPrio) return aPrio - bPrio;
      // Cùng ưu tiên: có giờ → sort theo giờ sớm hơn lên trước; không giờ → tạo sau lên trên
      const aHasTime = !!a.time;
      const bHasTime = !!b.time;
      if (aHasTime && bHasTime) return String(a.time).localeCompare(String(b.time));
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

  if (!tasks.length) {
    return `<div class="empty-state">Chưa có công việc nào trong ngày này.</div>`;
  }

  const taskRows = tasks.map(task => {
    const isDone = task.status === 'Hoàn thành';
    return `
    <div class="task-item${isDone ? ' is-done-item' : ''}" onclick="openTaskModal('${task.id}')">
      <div class="task-time">${task.time ? escapeHtml(task.time) : 'Cả ngày'}</div>
      <div>
        <div class="task-title" style="${isDone ? 'text-decoration:line-through;color:#94a3b8' : ''}">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          <span class="pill is-normal">Loại: ${escapeHtml(task.type || 'Khác')}</span>
          <span class="pill ${priorityClass(task.priority)}">Ưu tiên: ${escapeHtml(task.priority || 'Bình thường')}</span>
        </div>
      </div>
      <div class="task-actions">
        ${!isDone ? `<button class="icon-action" title="Đánh dấu hoàn thành" onclick="event.stopPropagation();toggleTaskDone('${task.id}')">${iconSvg(DASH_ICON.check, 15)}</button>` : ''}
        <button class="icon-action" title="Xóa" onclick="event.stopPropagation();deleteTask('${task.id}')">${iconSvg(DASH_ICON.trash, 15)}</button>
      </div>
    </div>`;
  }).join('');
  const placeholders = Array.from({ length: Math.max(0, 4 - tasks.length) }, () => '<div class="dashboard-placeholder-row"></div>').join('');
  return taskRows + placeholders;
}

function renderNotes() {
  const notes = loadNotes();
  if (!notes.length) return '';
  return `
    <div class="note-list">
      ${notes.slice(0, 5).map(note => `
        <div class="note-item ${note.done ? 'is-done' : ''}">
          <input type="checkbox" ${note.done ? 'checked' : ''} onchange="toggleNote('${note.id}', this.checked)" style="width:16px;height:16px;accent-color:#00008B">
          <span style="flex:1;font-size:13px">${escapeHtml(note.text)}</span>
          <button class="icon-action" title="Xóa ghi chú" onclick="deleteNote('${note.id}')">${iconSvg(DASH_ICON.trash, 14)}</button>
        </div>`).join('')}
    </div>`;
}

function renderWorkPanel() {
  return `
    <section class="home-panel">
      <div class="home-panel-header">
        <div>
          <div class="home-panel-title">Lịch công việc tuần này</div>
          <div class="home-panel-sub">Theo dõi các việc cần thực hiện và các mốc thời gian quan trọng.</div>
        </div>
        <button class="home-btn primary" onclick="openTaskModal()">${iconSvg(DASH_ICON.plus, 15)}Thêm công việc</button>
      </div>
      <div class="week-strip" id="week-strip">${renderWeekStrip()}</div>
      <div class="work-list">
        <div class="work-day-title">Công việc ngày ${formatDateVi(selectedWorkDate)}</div>
        <div id="task-list">${renderTaskList()}</div>
      </div>
    </section>`;
}

function notificationTypeStyle(item) {
  const raw = String(item.loai || item.type || '').toLowerCase();
  if (['success', 'approved', 'phe_duyet', 'phê duyệt'].includes(raw)) return { cls: 'success', bg: '#dcfce7', color: '#16a34a', icon: DASH_ICON.check };
  if (['warning', 'warn', 'canh_bao', 'cảnh báo'].includes(raw)) return { cls: 'warning', bg: '#ffedd5', color: '#ea580c', icon: DASH_ICON.clock };
  if (['error', 'reject', 'rejected', 'tu_choi', 'từ chối'].includes(raw)) return { cls: 'error', bg: '#fee2e2', color: '#dc2626', icon: DASH_ICON.bell };
  return { cls: 'info', bg: '#dbeafe', color: '#2563eb', icon: DASH_ICON.bell };
}

function renderNotifications() {
  const items = dashNotifications.slice(0, 5);
  if (!items.length) {
    return `<div class="empty-state">Chưa có thông báo mới.</div>`;
  }
  const rows = items.map(item => {
    const style = notificationTypeStyle(item);
    return `
      <article class="notif-item">
        <div class="notif-dot" style="background:${style.bg};color:${style.color}">${iconSvg(style.icon, 16)}</div>
        <div>
          <div class="notif-title">${escapeHtml(item.tieu_de || item.title || 'Thông báo')}</div>
          <div class="notif-body">${escapeHtml(item.noi_dung || item.mo_ta || item.message || 'Có cập nhật mới trong hệ thống.')}</div>
          <div class="notif-time">${formatRelativeTime(item.ngay_gui || item.ngay_tao || item.created_at) || 'Mới cập nhật'}</div>
        </div>
      </article>`;
  }).join('');
  const placeholders = Array.from({ length: Math.max(0, 5 - items.length) }, () => '<div class="dashboard-placeholder-row"></div>').join('');
  return rows + placeholders;
}

function renderNotificationPanel() {
  return `
    <aside class="home-panel">
      <div class="home-panel-header">
        <div>
          <div class="home-panel-title">Thông báo mới nhất</div>
          <div class="home-panel-sub">Các cập nhật quan trọng gần đây.</div>
        </div>
        <a class="mini-btn" href="notifications-mgmt.html">Xem tất cả</a>
      </div>
      <div class="notif-list" id="dashboard-notifications">${renderNotifications()}</div>
    </aside>`;
}

function recentFormAction(form) {
  const status = normalizeStatus(form.trang_thai || form.status);
  if (status === 'draft') return { label: 'Tiếp tục chỉnh sửa', href: `form-management.html?edit_form_id=${encodeURIComponent(form.id)}` };
  if (status === 'pending') return { label: 'Xem trạng thái', href: 'approval.html' };
  if (status === 'closed') return { label: 'Xem báo cáo', href: 'reports.html' };
  return { label: 'Xem form', href: `form-management.html?view_form_id=${encodeURIComponent(form.id)}` };
}

function renderRecentForms() {
  const forms = [...dashForms]
    .sort((a, b) => new Date(formUpdatedAt(b) || 0) - new Date(formUpdatedAt(a) || 0))
    .slice(0, 4);

  if (!forms.length) {
    return `<div class="empty-state" style="margin-top:16px">Chưa có biểu mẫu gần đây.</div>`;
  }

  return `
    <div class="recent-grid">
      ${forms.map((form, index) => {
        const status = normalizeStatus(form.trang_thai || form.status);
        const action = recentFormAction(form);
        return `
          <article class="recent-card">
            ${renderRecentThumb(form)}
            <div class="recent-body">
              <div class="recent-topline">
                <span class="recent-category">${escapeHtml(formCategory(form))}</span>
                <span class="recent-date">${formatDateVi(formUpdatedAt(form)) || ''}</span>
              </div>
              <div class="recent-name">${escapeHtml(formName(form))}</div>
              <div class="recent-meta">
                ${escapeHtml(formCategory(form))} · ${escapeHtml(formSurveyType(form))}<br>
                Đối tượng: ${escapeHtml(formTarget(form))}
              </div>
              <div class="recent-meta">${fmtNumber(formResponses(form))} lượt gửi<br>Cập nhật ${formatRelativeTime(formUpdatedAt(form)) || 'gần đây'}</div>
              <div class="recent-actions">
                <a class="mini-btn primary" href="${action.href}">${action.label}</a>
                ${status === 'active' ? `<a class="mini-btn" href="feedback.html">Xem phản hồi</a>` : ''}
              </div>
            </div>
          </article>`;
      }).join('')}
    </div>`;
}

function renderRecentSection() {
  return `
    <section class="home-panel recent-section">
      <div class="home-panel-header" style="padding:0">
        <div>
          <div class="home-panel-title">Biểu mẫu gần đây</div>
          <div class="home-panel-sub">Các biểu mẫu bạn vừa tạo hoặc chỉnh sửa gần nhất.</div>
        </div>
        <a class="mini-btn" href="form-management.html">Xem tất cả biểu mẫu</a>
      </div>
      <div id="recent-forms-wrap">${renderRecentForms()}</div>
    </section>`;
}

function renderDashboardShell() {
  ensureDashboardStyle();
  document.getElementById('page-content').innerHTML = `
    <main class="home-shell">
      ${renderHero()}
      <div id="kpi-wrap">${renderKpis()}</div>
      <div class="home-main-grid">
        <div id="work-panel-wrap">${renderWorkPanel()}</div>
        <div id="notif-panel-wrap">${renderNotificationPanel()}</div>
      </div>
      <div id="recent-section-wrap">${renderRecentSection()}</div>
    </main>
    <div id="task-modal-root"></div>`;
}

function refreshWorkPanel() {
  const wrap = document.getElementById('work-panel-wrap');
  if (wrap) wrap.innerHTML = renderWorkPanel();
}

function refreshDataPanels() {
  const kpiWrap = document.getElementById('kpi-wrap');
  const notifWrap = document.getElementById('notif-panel-wrap');
  const recentWrap = document.getElementById('recent-section-wrap');
  if (kpiWrap) kpiWrap.innerHTML = renderKpis();
  if (notifWrap) notifWrap.innerHTML = renderNotificationPanel();
  if (recentWrap) recentWrap.innerHTML = renderRecentSection();
}

function selectWorkDate(dateKey) {
  selectedWorkDate = dateKey;
  refreshWorkPanel();
}

function openTaskModal(taskId = '') {
  editingTaskId = taskId;
  const task = loadTasks().find(item => item.id === taskId) || {
    title: '',
    date: selectedWorkDate,
    time: '',
    type: 'Biểu mẫu',
    priority: 'Bình thường',
    status: 'Chưa thực hiện',
    note: '',
  };
  const title = taskId ? 'Chỉnh sửa công việc' : 'Thêm công việc';
  document.getElementById('task-modal-root').innerHTML = `
    <div class="work-modal-backdrop" onclick="closeTaskModal(event)">
      <div class="work-modal" onclick="event.stopPropagation()">
        <div class="work-modal-head">
          <div>
            <div class="work-modal-head-title">${title}</div>
            <div class="work-modal-head-sub">${taskId ? 'Chỉnh sửa thông tin công việc bên dưới' : 'Điền thông tin để tạo công việc mới'}</div>
          </div>
          <button class="work-modal-close" onclick="closeTaskModal()">×</button>
        </div>
        <div class="work-modal-body">
          <div>
            <label class="field-label">Tên công việc</label>
            <input id="task-title" class="home-input" value="${escapeHtml(task.title)}" placeholder="Nhập tên công việc…">
          </div>
          <div class="form-grid-2">
            <div>
              <label class="field-label">Ngày thực hiện</label>
              <input id="task-date" type="date" class="home-input" value="${escapeHtml(task.date)}">
            </div>
            <div>
              <label class="field-label">Thời gian</label>
              <input id="task-time" type="time" class="home-input" value="${escapeHtml(task.time || '')}">
            </div>
          </div>
          <div class="form-grid-2">
            <div>
              <label class="field-label">Loại công việc</label>
              <select id="task-type" class="home-select">${TASK_TYPES.map(type => `<option ${type === task.type ? 'selected' : ''}>${type}</option>`).join('')}</select>
            </div>
            <div>
              <label class="field-label">Mức độ ưu tiên</label>
              <select id="task-priority" class="home-select">${TASK_PRIORITIES.map(priority => `<option ${priority === task.priority ? 'selected' : ''}>${priority}</option>`).join('')}</select>
            </div>
          </div>
          <div>
            <label class="field-label">Trạng thái</label>
            <select id="task-status" class="home-select">${TASK_STATUSES.map(status => `<option ${status === task.status ? 'selected' : ''}>${status}</option>`).join('')}</select>
          </div>
          <div>
            <label class="field-label">Ghi chú</label>
            <textarea id="task-note" class="home-textarea" rows="3" placeholder="Ghi chú thêm nếu cần…">${escapeHtml(task.note || '')}</textarea>
          </div>
          <div class="work-modal-footer">
            ${taskId ? `<button class="wm-btn danger" onclick="event.stopPropagation();closeTaskModal();deleteTask('${taskId}',true)">${iconSvg(DASH_ICON.trash,14)} Xóa</button><span style="flex:1"></span>` : ''}
            <button class="wm-btn ghost" onclick="closeTaskModal()">Hủy</button>
            <button class="wm-btn solid" onclick="saveTaskFromModal()">${taskId ? 'Lưu thay đổi' : 'Thêm công việc'}</button>
          </div>
        </div>
      </div>
    </div>`;
  setTimeout(() => document.getElementById('task-title')?.focus(), 0);
}

function closeTaskModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const root = document.getElementById('task-modal-root');
  if (root) root.innerHTML = '';
  editingTaskId = '';
}

function saveTaskFromModal() {
  const title = document.getElementById('task-title')?.value.trim();
  const date = document.getElementById('task-date')?.value || selectedWorkDate;
  if (!title) {
    showToast?.('Vui lòng nhập tên công việc', 'error');
    return;
  }
  const tasks = loadTasks();
  const payload = {
    title,
    date,
    time: document.getElementById('task-time')?.value || '',
    type: document.getElementById('task-type')?.value || 'Khác',
    priority: document.getElementById('task-priority')?.value || 'Bình thường',
    status: document.getElementById('task-status')?.value || 'Chưa thực hiện',
    note: document.getElementById('task-note')?.value.trim() || '',
  };
  const wasEditing = !!editingTaskId;
  if (editingTaskId) {
    const idx = tasks.findIndex(task => task.id === editingTaskId);
    if (idx >= 0) tasks[idx] = { ...tasks[idx], ...payload };
  } else {
    tasks.push({ id: `task-${Date.now()}`, createdAt: new Date().toISOString(), ...payload });
  }
  selectedWorkDate = date;
  saveTasks(tasks);
  closeTaskModal();
  refreshWorkPanel();
  showToast?.(wasEditing ? 'Đã cập nhật công việc' : 'Đã thêm công việc', 'success');
}

function toggleTaskDone(taskId) {
  const tasks = loadTasks().map(task => task.id === taskId
    ? { ...task, status: task.status === 'Hoàn thành' ? 'Chưa thực hiện' : 'Hoàn thành' }
    : task);
  saveTasks(tasks);
  refreshWorkPanel();
}

function deleteTask(taskId, skipConfirm = false) {
  if (!skipConfirm) {
    const task = loadTasks().find(t => t.id === taskId);
    const name = task ? escapeHtml(task.title) : 'công việc này';
    document.getElementById('task-modal-root').innerHTML = `
      <div class="work-modal-backdrop" onclick="closeTaskModal(event)">
        <div class="confirm-modal" onclick="event.stopPropagation()">
          <div class="confirm-icon">${iconSvg(DASH_ICON.trash, 24)}</div>
          <div class="confirm-title">Xóa công việc?</div>
          <div class="confirm-desc">Hành động này không thể hoàn tác.</div>
          <div class="confirm-actions" style="justify-content:space-between">
            <button class="wm-btn ghost" onclick="closeTaskModal()">Hủy</button>
            <button class="wm-btn solid" style="background:#dc2626;border-color:#dc2626" onclick="closeTaskModal();_doDeleteTask('${taskId}')">Xóa ngay</button>
          </div>
        </div>
      </div>`;
    return;
  }
  _doDeleteTask(taskId);
}

function _doDeleteTask(taskId) {
  saveTasks(loadTasks().filter(task => task.id !== taskId));
  refreshWorkPanel();
  showToast?.('Đã xóa công việc', 'success');
}

function addQuickNote() {
  const input = document.getElementById('quick-note-input');
  const text = input?.value.trim();
  if (!text) return;
  const notes = loadNotes();
  notes.unshift({ id: `note-${Date.now()}`, text, done: false, createdAt: new Date().toISOString() });
  saveNotes(notes);
  if (input) input.value = '';
  refreshWorkPanel();
}

function toggleNote(noteId, done) {
  saveNotes(loadNotes().map(note => note.id === noteId ? { ...note, done: !!done } : note));
  refreshWorkPanel();
}

function deleteNote(noteId) {
  saveNotes(loadNotes().filter(note => note.id !== noteId));
  refreshWorkPanel();
}

async function fetchJson(url, fallback) {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

function normalizeFormsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.danh_sach)) return payload.danh_sach;
  return [];
}

function normalizeFeedbackPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.danh_sach)) return payload.danh_sach;
  return [];
}

function normalizeNotificationsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.danh_sach)) return payload.danh_sach;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getNotificationDateValue(item) {
  return item.ngay_gui || item.ngay_tao || item.created_at || item.rawDate || item.date || '';
}

function sortNotificationsNewest(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(getNotificationDateValue(a)).getTime() || 0;
    const dateB = new Date(getNotificationDateValue(b)).getTime() || 0;
    return dateB - dateA;
  });
}

function fallbackNotifications() {
  return [
    { type: 'error', title: 'Biểu mẫu TOEIC bị từ chối', message: 'Lý do: Thiếu mô tả biểu mẫu', created_at: new Date(Date.now() - 10 * 60000).toISOString() },
    { type: 'success', title: 'Biểu mẫu MOS đã được phê duyệt', message: 'Có thể chia sẻ đến học viên', created_at: new Date(Date.now() - 60 * 60000).toISOString() },
    { type: 'warning', title: 'Biểu mẫu Python sắp đóng', message: 'Còn 2 ngày', created_at: new Date(Date.now() - 3 * 3600000).toISOString() },
    { type: 'info', title: 'Có phản hồi mới', message: 'Form khảo sát VSTEP vừa nhận lượt gửi mới', created_at: new Date(Date.now() - 5 * 3600000).toISOString() },
    { type: 'info', title: 'Nhắc lịch kiểm tra biểu mẫu', message: 'Có công việc cần xử lý trong hôm nay', created_at: new Date(Date.now() - 7 * 3600000).toISOString() },
  ];
}

async function loadDashboardData() {
  const [formsPayload, feedbackPayload, approvalPayload, notificationsPayload, unreadNotificationsPayload] = await Promise.all([
    fetchJson(`${API_BASE}/forms`, []),
    fetchJson(`${API_BASE}/feedback`, []),
    fetchJson(`${API_BASE}/approvals/stats`, null),
    fetchJson(`${API_BASE}/notifications?type=info`, null),
    fetchJson(`${API_BASE}/notifications/unread`, null),
  ]);

  dashForms = normalizeFormsPayload(formsPayload);
  dashFeedback = normalizeFeedbackPayload(feedbackPayload);
  dashApprovalStats = approvalPayload;
  dashNotifications = sortNotificationsNewest(
    normalizeNotificationsPayload(notificationsPayload).length
      ? normalizeNotificationsPayload(notificationsPayload)
      : normalizeNotificationsPayload(unreadNotificationsPayload)
  );

  if (!dashNotifications.length) dashNotifications = fallbackNotifications();
  refreshDataPanels();
}

document.addEventListener('DOMContentLoaded', () => {
  renderDashboardShell();
  loadDashboardData().catch(err => {
    console.warn('Không tải được dữ liệu trang chủ:', err.message);
    dashNotifications = fallbackNotifications();
    refreshDataPanels();
    showToast?.('Không tải được dữ liệu trang chủ', 'error');
  });
});
