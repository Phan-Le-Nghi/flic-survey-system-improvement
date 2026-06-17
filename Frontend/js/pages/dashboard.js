const DASHBOARD_FORM_IMAGES = [
  'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=200&fit=crop',
];

const DASHBOARD_ICONS = {
  form: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  feedback: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
  bell: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
};

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function fmtNumber(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function calcPercentChange(current, previous) {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function formatPercentChange(value) {
  const rounded = Math.abs(value).toFixed(1).replace('.0', '');
  return `${value >= 0 ? '+' : '-'}${rounded}%`;
}

function formatRelativeTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

function renderStatCard({ id, label, value, color, bg, icon }) {
  return `
    <div class="card stat-card">
      <div class="stat-header">
        <div>
          <div class="stat-label">${label}</div>
          <div class="stat-value" id="${id}">${value}</div>
        </div>
        <div class="stat-icon" style="background:${bg}">
          <svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" width="24" height="24">${icon}</svg>
        </div>
      </div>
      <div class="stat-change up" id="${id}-change">
        <span>Đang tính...</span>
        <span style="color:var(--gray-400);font-weight:400">vs tháng trước</span>
      </div>
    </div>`;
}

function updatePercentChange(id, current, previous) {
  const el = document.getElementById(`${id}-change`);
  if (!el) return;

  const change = calcPercentChange(current, previous);
  const isUp = change >= 0;
  el.className = `stat-change ${isUp ? 'up' : 'down'}`;
  el.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
      ${isUp
        ? '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'
        : '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>'}
    </svg>
    <span>${formatPercentChange(change)}</span>
    <span style="color:var(--gray-400);font-weight:400">vs tháng trước</span>`;
}

function renderRecentFormsCards(forms) {
  if (!forms.length) {
    return `
      <div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--gray-400)">
        Chưa có biểu mẫu nào.
      </div>`;
  }

  return forms.map((f, index) => {
    const viewHref = f.id ? `form-management.html?view_form_id=${encodeURIComponent(f.id)}` : 'form-management.html';
    const img = f.img || DASHBOARD_FORM_IMAGES[index % DASHBOARD_FORM_IMAGES.length];
    return `
      <div class="form-card" style="text-decoration:none" onclick="window.location.href='${viewHref}'">
        <div class="form-card-thumb">
          <img src="${img}" alt="${f.name}" loading="lazy">
          <div class="form-card-overlay">
            <a href="${viewHref}" onclick="event.stopPropagation()" class="btn btn-outline btn-sm" style="background:rgba(255,255,255,.9)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">${DASHBOARD_ICONS.eye}</svg>
            </a>
          </div>
        </div>
        <div class="form-card-body">
          <div class="form-card-name">${f.name}</div>
          <div class="form-card-meta">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">${DASHBOARD_ICONS.chart}</svg>${fmtNumber(f.responses)} phản hồi</span>
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">${DASHBOARD_ICONS.clock}</svg>${f.time}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderTaskItems(tasks) {
  return tasks.map(t => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px;background:var(--gray-50);border-radius:var(--radius);cursor:pointer" onclick="window.location.href='${t.href}'">
      <div style="display:flex;align-items:center">
        <div style="padding:8px;border-radius:var(--radius);background:${t.bg};margin-right:12px">
          <svg viewBox="0 0 24 24" fill="none" stroke="${t.color}" stroke-width="2" width="18" height="18">${DASHBOARD_ICONS.activity}</svg>
        </div>
        <div>
          <div style="font-weight:500;font-size:13px">${t.title}</div>
          <div style="font-size:12px;color:var(--gray-500)">${fmtNumber(t.count)} muc</div>
        </div>
      </div>
      <span style="padding:4px 10px;border-radius:999px;font-size:13px;font-weight:700;background:${t.bg};color:${t.color}">${fmtNumber(t.count)}</span>
    </div>`).join('');
}

function renderNotifications(list, unreadCount) {
  const visibleList = Array.isArray(list) ? list.slice(0, 4) : [];
  const badge = document.getElementById('dash-unread-badge');
  if (badge) {
    badge.textContent = unreadCount || '';
    badge.style.display = unreadCount ? 'inline-block' : 'none';
  }

  const target = document.getElementById('dash-notif-list');
  if (!target) return;

  if (!visibleList.length) {
    target.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px 0;color:var(--gray-400)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">${DASHBOARD_ICONS.bell}</svg>
        <span style="font-size:13px">Chưa có thông báo nào</span>
      </div>`;
    return;
  }

  const typeStyle = {
    info: { bg: '#eef2ff', color: '#00008B', label: 'Thông tin', icon: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>' },
    success: { bg: '#dcfce7', color: '#16a34a', label: 'Thành công', icon: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
    warning: { bg: '#ffedd5', color: '#ea580c', label: 'Cảnh báo', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
    error: { bg: '#fee2e2', color: '#dc2626', label: 'Lỗi', icon: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
  };

  target.innerHTML = visibleList.map((n, index) => {
    const ts = typeStyle[n.loai || n.type] || typeStyle.info;
    const dateText = formatRelativeTime(n.ngay_gui || n.ngay_tao);
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;background:${index % 2 === 0 ? '#f8fafc' : '#fff'};border:1px solid #f1f5f9">
        <div style="width:26px;height:26px;border-radius:6px;background:${ts.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="${ts.color}" stroke-width="2" width="13" height="13">${ts.icon}</svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--gray-800);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.tieu_de || n.title || 'Thông báo'}</div>
          <div style="font-size:10.5px;color:var(--gray-400);margin-top:1px">${dateText} · <span style="color:${ts.color}">${ts.label}</span></div>
        </div>
      </div>`;
  }).join('');
}

function ensureDashboardStyle() {
  if (document.getElementById('dashboard-polish-style')) return;
  document.getElementById('page-content').insertAdjacentHTML('beforebegin', `
    <style id="dashboard-polish-style">
      #page-content {
        background: var(--gray-50);
        padding: 18px;
        border-radius: 26px;
      }
      .dash-shell { max-width: 1280px; margin: 0 auto; }
      .dash-shell .page-header {
        padding: 24px 26px;
        margin-bottom: 20px;
        border: 1px solid var(--gray-200);
        border-radius: 28px;
        background: var(--gray-50);
        box-shadow: 0 22px 55px rgba(0,0,0,.08);
      }
      .dash-shell .page-title { color:var(--gray-900); font-size:34px; line-height:1; margin-bottom:8px; }
      .dash-shell .page-sub { color:var(--gray-500); font-size:14px; max-width:620px; }
      .dash-top-grid, .dash-main-grid { display:grid; gap:18px; }
      .dash-top-grid { grid-template-columns:repeat(2,minmax(180px,1fr)) minmax(330px,1.5fr); margin-bottom:22px; }
      .dash-main-grid { grid-template-columns:minmax(0,2fr) minmax(300px,.9fr); margin-bottom:22px; }
      .dash-shell .card {
        border:1px solid var(--gray-200);
        border-radius:24px;
        background:var(--gray-50);
        box-shadow:0 18px 40px rgba(0,0,0,.07);
      }
      .dash-shell .stat-card { min-height:132px; padding:20px; background:var(--gray-50); }
      .dash-shell .stat-label { color:var(--gray-500); font-size:13px; font-weight:700; }
      .dash-shell .stat-value { color:var(--gray-900); font-size:34px; margin-top:8px; }
      .dash-shell .stat-icon { width:52px; height:52px; border-radius:18px; display:flex; align-items:center; justify-content:center; }
      .dash-chart-card, .dash-task-card, .dash-recent-card { padding:22px !important; }
      .dash-chart-wrap { height:320px !important; padding:10px 4px 0; border-radius:18px; background:transparent; }
      .dash-shell .section-title { color:var(--gray-900); font-size:18px; font-weight:800; }
      .dash-shell .section-sub { color:var(--gray-500); font-size:12.5px; margin-top:4px; }
      @media (max-width:1080px) { .dash-top-grid, .dash-main-grid { grid-template-columns:1fr; } }
      @media (max-width:640px) {
        #page-content { padding:12px; border-radius:18px; }
        .dash-shell .page-header, .dash-chart-card, .dash-task-card, .dash-recent-card { padding:18px !important; }
      }
    </style>`);
}

function renderDashboardShell() {
  ensureDashboardStyle();
  document.getElementById('page-content').innerHTML = `
    <div class="dash-shell">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <h2 class="page-title">Trang chủ</h2>
          <p class="page-sub">Theo dõi nhanh biểu mẫu, phản hồi và các việc cần xử lý trong hệ thống.</p>
        </div>
      </div>

      <div class="dash-top-grid">
        ${renderStatCard({ id: 'stat-tong-form', label: 'Tổng biểu mẫu', value: '...', color: '#00008B', bg: '#eef2ff', icon: DASHBOARD_ICONS.form })}
        ${renderStatCard({ id: 'stat-tong-phan-hoi', label: 'Tổng phản hồi', value: '...', color: '#10b981', bg: '#dcfce7', icon: DASHBOARD_ICONS.feedback })}

        <div class="card" style="overflow:hidden;display:flex;flex-direction:column">
          <div style="background:var(--brand-color);padding:10px 14px;display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:8px">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="15" height="15">${DASHBOARD_ICONS.bell}</svg>
              <span style="font-size:13px;font-weight:700;color:#fff">Thông báo mới nhất</span>
              <span id="dash-unread-badge" style="display:none;background:#ef4444;color:#fff;border-radius:999px;font-size:10px;font-weight:700;padding:1px 6px"></span>
            </div>
            <a href="notifications-mgmt.html" style="font-size:11px;color:rgba(255,255,255,.9);text-decoration:none;font-weight:600">Xem tất cả</a>
          </div>
          <div id="dash-notif-list" style="padding:8px 12px;display:flex;flex-direction:column;gap:6px;flex:1;overflow:hidden">
            <div style="text-align:center;color:var(--gray-400);font-size:12px;padding:10px 0">Đang tải...</div>
          </div>
        </div>
      </div>

      <div class="dash-main-grid">
        <div class="card card-body dash-chart-card">
          <div class="section-header" style="margin-bottom:16px">
            <div>
              <div class="section-title">Hoạt động trong tuần</div>
              <div class="section-sub">Số biểu mẫu tạo mới và phản hồi nhận được theo ngày.</div>
            </div>
            <button class="btn btn-outline btn-sm">7 ngày</button>
          </div>
          <div class="dash-chart-wrap"><canvas id="activityChart"></canvas></div>
        </div>

        <div class="card card-body dash-task-card">
          <div class="section-title" style="margin-bottom:16px">Công việc cần xử lý</div>
          <div class="space-y" id="dash-task-list">
            ${renderTaskItems([
              { title: 'Form chờ phê duyệt', count: 0, href: 'approval.html', color: '#f97316', bg: '#ffedd5' },
              { title: 'Phản hồi cần trả lời', count: 0, href: 'feedback.html', color: '#00008B', bg: '#eef2ff' },
            ])}
          </div>
          <a href="approval.html" class="btn btn-primary btn-full" style="margin-top:16px">Xem tất cả</a>
        </div>
      </div>

      <div class="card card-body dash-recent-card" style="margin-bottom:24px">
        <div class="section-header" style="margin-bottom:20px">
          <div>
            <div class="section-title">Biểu mẫu gần đây</div>
            <div class="section-sub">Các biểu mẫu mới hoặc vừa được chỉnh sửa gần nhất.</div>
          </div>
          <a href="form-management.html" class="btn btn-outline btn-sm">Xem tất cả</a>
        </div>
        <div id="recent-forms-grid" class="grid-3">${renderRecentFormsCards([])}</div>
      </div>
    </div>`;
}
let dashboardChart = null;

function initActivityChart() {
  const ctx = document.getElementById('activityChart');
  if (!ctx || typeof Chart === 'undefined') return;

  dashboardChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
      datasets: [
        {
          label: 'Biểu mẫu tạo mới',
          data: [0, 0, 0, 0, 0, 0, 0],
          borderColor: '#00008B',
          backgroundColor: 'rgba(0,0,139,.15)',
          borderWidth: 2.5,
          fill: true,
          tension: .3,
          pointBackgroundColor: '#00008B',
          pointRadius: 5,
        },
        {
          label: 'Phản hồi nhận được',
          data: [0, 0, 0, 0, 0, 0, 0],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,.08)',
          borderWidth: 2,
          fill: false,
          tension: .4,
          pointBackgroundColor: '#10b981',
          pointRadius: 4,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { usePointStyle: true, pointStyle: 'circle', font: { size: 11.5, weight: '600' }, color: '#475569' },
        },
        tooltip: { backgroundColor: '#0f172a', titleColor: '#e2e8f0', bodyColor: '#fff', cornerRadius: 12, padding: 12 },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 12, weight: '600' } } },
        y: { type: 'linear', position: 'left', beginAtZero: true, grid: { color: '#eef2f7' }, ticks: { color: '#00008B', precision: 0 }, title: { display: true, text: 'Biểu mẫu', color: '#00008B' } },
        y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { color: '#10b981', precision: 0 }, title: { display: true, text: 'Phản hồi', color: '#10b981' } },
      },
    },
  });
}

function updateActivityChart(rows) {
  if (!dashboardChart || !Array.isArray(rows)) return;

  const dayLabels = {
    Monday: 'T2',
    Tuesday: 'T3',
    Wednesday: 'T4',
    Thursday: 'T5',
    Friday: 'T6',
    Saturday: 'T7',
    Sunday: 'CN',
  };

  dashboardChart.data.labels = rows.map(row => dayLabels[row.ten_ngay] || row.ngay || '');
  dashboardChart.data.datasets[0].data = rows.map(row => Number(row.so_form || 0));
  dashboardChart.data.datasets[1].data = rows.map(row => Number(row.so_phan_hoi || 0));
  dashboardChart.update();
}

async function loadDashboardData() {
  const headers = authHeaders();
  const requests = {
    overview: fetch(`${API_BASE}/reports/overview`, { headers }).then(r => r.ok ? r.json() : null),
    week: fetch(`${API_BASE}/reports/forms-by-week`, { headers }).then(r => r.ok ? r.json() : []),
    forms: fetch(`${API_BASE}/forms`, { headers }).then(r => r.ok ? r.json() : []),
    approvals: fetch(`${API_BASE}/approvals/stats`, { headers }).then(r => r.ok ? r.json() : null),
    feedback: fetch(`${API_BASE}/feedback`, { headers }).then(r => r.ok ? r.json() : []),
    notifications: fetch(`${API_BASE}/notifications/unread`).then(r => r.ok ? r.json() : null),
  };

  const [overview, week, forms, approvals, feedback, notifications] = await Promise.all([
    requests.overview.catch(() => null),
    requests.week.catch(() => []),
    requests.forms.catch(() => []),
    requests.approvals.catch(() => null),
    requests.feedback.catch(() => []),
    requests.notifications.catch(() => null),
  ]);

  document.getElementById('stat-tong-form').textContent = fmtNumber(overview?.tong_form);
  document.getElementById('stat-tong-phan-hoi').textContent = fmtNumber(overview?.tong_phan_hoi);
  updatePercentChange('stat-tong-form', overview?.form_thang_nay, overview?.form_thang_truoc);
  updatePercentChange('stat-tong-phan-hoi', overview?.phan_hoi_thang_nay, overview?.phan_hoi_thang_truoc);
  updateActivityChart(week);

  const recentForms = (Array.isArray(forms) ? forms : [])
    .sort((a, b) => new Date(b.ngay_cap_nhat || b.ngay_tao || 0) - new Date(a.ngay_cap_nhat || a.ngay_tao || 0))
    .slice(0, 3)
    .map((f, index) => ({
      id: String(f.id),
      name: f.ten_form || 'Biểu mẫu',
      responses: f.so_phan_hoi || 0,
      time: formatRelativeTime(f.ngay_cap_nhat || f.ngay_tao),
      img: DASHBOARD_FORM_IMAGES[index % DASHBOARD_FORM_IMAGES.length],
    }));
  document.getElementById('recent-forms-grid').innerHTML = renderRecentFormsCards(recentForms);

  const pendingFeedback = (Array.isArray(feedback) ? feedback : []).filter(f => {
    const status = f.trang_thai || f.status || '';
    return !['replied', 'archived'].includes(status);
  }).length;

  document.getElementById('dash-task-list').innerHTML = renderTaskItems([
    { title: 'Form chờ phê duyệt', count: approvals?.cho_duyet || overview?.cho_duyet || 0, href: 'approval.html', color: '#f97316', bg: '#ffedd5' },
    { title: 'Phản hồi cần trả lời', count: pendingFeedback, href: 'feedback.html', color: '#00008B', bg: '#eef2ff' },
  ]);

  renderNotifications(notifications?.danh_sach || [], notifications?.so_chua_doc || 0);
}

document.addEventListener('DOMContentLoaded', () => {
  renderDashboardShell();
  initActivityChart();
  loadDashboardData().catch(err => {
    console.warn('Không tải được dữ liệu dashboard:', err.message);
    renderNotifications([], 0);
    showToast?.('Không tải được dữ liệu trang chủ', 'error');
  });
});
