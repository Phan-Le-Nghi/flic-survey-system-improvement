// Dashboard page content
const STATS = [
  {label:'Form đã tạo',value:'248',change:'+12.5%',color:'#0ea5e9',bg:'#e0f2fe',icon:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>'},
  {label:'Tổng phản hồi',value:'12,458',change:'+8.3%',color:'#10b981',bg:'#dcfce7',icon:'<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>'},
  {label:'Người dùng',value:'1,234',change:'+23.1%',color:'#8b5cf6',bg:'#f3e8ff',icon:'<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>'},
  {label:'Tỷ lệ hoàn thành',value:'87.5%',change:'+3.2%',color:'#f97316',bg:'#ffedd5',icon:'<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'},
];
let RECENT_FORMS = [
  {id:'',name:'Đăng ký khóa học Tiếng Anh',responses:234,time:'2 giờ trước',img:'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&h=200&fit=crop'},
  {id:'',name:'Khảo sát mức độ hài lòng',responses:189,time:'5 giờ trước',img:'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=200&fit=crop'},
  {id:'',name:'Đăng ký thi chứng chỉ',responses:167,time:'1 ngày trước',img:'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=200&fit=crop'},
];
const DASHBOARD_FORM_IMAGES = [
  'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=200&fit=crop',
];
const TASKS = [
  {title:'Phê duyệt form mới',count:8,color:'#f97316',bg:'#ffedd5'},
  {title:'Phản hồi cần xử lý',count:12,color:'#0ea5e9',bg:'#e0f2fe'},
  {title:'Báo cáo chờ xem',count:3,color:'#8b5cf6',bg:'#f3e8ff'},
];

if (!document.getElementById('dashboard-polish-style')) {
document.getElementById('page-content').insertAdjacentHTML('beforebegin', `
  <style id="dashboard-polish-style">
    #page-content {
      background:
        radial-gradient(circle at 12% 4%, rgba(14, 165, 233, .12), transparent 28%),
        radial-gradient(circle at 90% 12%, rgba(16, 185, 129, .10), transparent 30%),
        linear-gradient(180deg, #f8fbff 0%, #f6f9fd 45%, #ffffff 100%);
      padding: 18px;
      border-radius: 26px;
    }

    .dash-shell {
      max-width: 1280px;
      margin: 0 auto;
    }

    .dash-shell .page-header {
      position: relative;
      overflow: hidden;
      padding: 24px 26px;
      margin-bottom: 20px;
      border: 1px solid rgba(148, 163, 184, .20);
      border-radius: 28px;
      background:
        linear-gradient(135deg, rgba(255,255,255,.96), rgba(239,246,255,.92)),
        radial-gradient(circle at 88% 22%, rgba(14,165,233,.22), transparent 26%);
      box-shadow: 0 22px 55px rgba(15, 23, 42, .08);
    }

    .dash-shell .page-header::after {
      content: "";
      position: absolute;
      inset: auto -40px -85px auto;
      width: 280px;
      height: 180px;
      border-radius: 999px;
      background: linear-gradient(135deg, rgba(37,99,235,.16), rgba(16,185,129,.13));
      filter: blur(3px);
    }

    .dash-shell .page-title {
      color: #0f172a;
      font-size: clamp(26px, 3vw, 38px);
      line-height: 1;
      letter-spacing: -.04em;
      margin-bottom: 8px;
    }

    .dash-shell .page-sub {
      color: #64748b;
      font-size: 14px;
      max-width: 620px;
    }

    .dash-top-grid,
    .dash-main-grid {
      display: grid !important;
      gap: 18px !important;
    }

    .dash-top-grid {
      grid-template-columns: repeat(2, minmax(180px, 1fr)) minmax(330px, 1.5fr) !important;
      margin-bottom: 22px !important;
    }

    .dash-main-grid {
      grid-template-columns: minmax(0, 2fr) minmax(300px, .9fr) !important;
      margin-bottom: 22px !important;
    }

    .dash-shell .card {
      border: 1px solid rgba(148, 163, 184, .22);
      border-radius: 24px;
      background: rgba(255,255,255,.90);
      box-shadow: 0 18px 40px rgba(15, 23, 42, .07);
      transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
    }

    .dash-shell .card:hover {
      transform: translateY(-2px);
      border-color: rgba(37, 99, 235, .20);
      box-shadow: 0 24px 55px rgba(15, 23, 42, .10);
    }

    .dash-shell .stat-card {
      min-height: 158px;
      padding: 20px;
      background: linear-gradient(145deg, #ffffff 0%, #f8fbff 100%);
    }

    .dash-shell .stat-label {
      color: #64748b;
      font-size: 13px;
      font-weight: 700;
    }

    .dash-shell .stat-value {
      color: #0f172a;
      font-size: 34px;
      letter-spacing: -.04em;
      margin-top: 8px;
    }

    .dash-shell .stat-icon {
      width: 52px;
      height: 52px;
      border-radius: 18px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
    }

    .dash-chart-card,
    .dash-task-card,
    .dash-recent-card {
      padding: 22px !important;
    }

    .dash-chart-wrap {
      height: 320px !important;
      padding: 10px 4px 0;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(248,250,252,.65), rgba(255,255,255,0));
    }

    .dash-shell .section-title {
      color: #0f172a;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -.02em;
    }

    .dash-shell .section-sub {
      color: #64748b;
      font-size: 12.5px;
      margin-top: 4px;
    }

    .dash-task-card .space-y > div {
      border: 1px solid #e8eef7;
      background: #f8fbff !important;
    }

    .dash-recent-card .form-card {
      border-radius: 20px;
      border: 1px solid #e6edf7;
      box-shadow: 0 14px 30px rgba(15,23,42,.06);
    }

    @media (max-width: 1080px) {
      .dash-top-grid,
      .dash-main-grid {
        grid-template-columns: 1fr !important;
      }
    }

    @media (max-width: 640px) {
      #page-content {
        padding: 12px;
        border-radius: 18px;
      }

      .dash-shell .page-header,
      .dash-chart-card,
      .dash-task-card,
      .dash-recent-card {
        padding: 18px !important;
      }
    }
  </style>
`);
}

document.getElementById('page-content').innerHTML = `
  <div class="page-header" style="display:flex;align-items:center;justify-content:space-between">
    <div>
      <h2 class="page-title">Trang chủ</h2>
      <p class="page-sub">Chào mừng trở lại! Đây là tổng quan hệ thống.</p>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 2fr;gap:16px;margin-bottom:24px">
    ${STATS.slice(0,2).map((s,i)=>`
      <div class="card stat-card">
        <div class="stat-header">
          <div><div class="stat-label">${s.label}</div><div class="stat-value" id="${i===0?'stat-tong-form':'stat-tong-phan-hoi'}">${s.value}</div></div>
          <div class="stat-icon" style="background:${s.bg}"><svg viewBox="0 0 24 24" fill="none" stroke="${s.color}" stroke-width="2" width="24" height="24">${s.icon}</svg></div>
        </div>
        <div class="stat-change up">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          <span>${s.change}</span><span style="color:var(--gray-400);font-weight:400">vs tháng trước</span>
        </div>
      </div>`).join('')}

    <!-- Thông báo mới nhất -->
    <div class="card" style="overflow:hidden;display:flex;flex-direction:column">
      <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb);padding:10px 14px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="15" height="15"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          <span style="font-size:13px;font-weight:700;color:#fff">Thông báo mới nhất</span>
          <span id="dash-unread-badge" style="display:none;background:#ef4444;color:#fff;border-radius:999px;font-size:10px;font-weight:700;padding:1px 6px"></span>
        </div>
        <a href="notifications-mgmt.html" style="font-size:11px;color:rgba(255,255,255,.9);text-decoration:none;font-weight:600;display:flex;align-items:center;gap:2px">
          Xem tất cả <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      </div>
      <div id="dash-notif-list" style="padding:8px 12px;display:flex;flex-direction:column;gap:6px;flex:1;overflow:hidden">
        <div style="text-align:center;color:var(--gray-400);font-size:12px;padding:10px 0">Đang tải...</div>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-bottom:24px">
    <div class="card card-body">
      <div class="section-header" style="margin-bottom:16px">
        <div><div class="section-title">Hoạt động trong tuần</div><div class="section-sub">Số form phát hành mới và phản hồi nhận được theo ngày</div></div>
        <button class="btn btn-outline btn-sm">7 ngày</button>
      </div>
      <div style="height:260px"><canvas id="activityChart"></canvas></div>
    </div>
    <div class="card card-body">
      <div class="section-title" style="margin-bottom:16px">Công việc cần xử lý</div>
      <div class="space-y">
        ${TASKS.map(t=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px;background:var(--gray-50);border-radius:var(--radius);cursor:pointer" onclick="window.location.href='approval.html'">
            <div style="display:flex;align-items:center">
              <div style="padding:8px;border-radius:var(--radius);background:${t.bg};margin-right:12px">
                <svg viewBox="0 0 24 24" fill="none" stroke="${t.color}" stroke-width="2" width="18" height="18"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div>
                <div style="font-weight:500;font-size:13px">${t.title}</div>
                <div style="font-size:12px;color:var(--gray-500)">${t.count} mục</div>
              </div>
            </div>
            <span style="padding:4px 10px;border-radius:999px;font-size:13px;font-weight:700;background:${t.bg};color:${t.color}">${t.count}</span>
          </div>`).join('')}
      </div>
      <a href="approval.html" class="btn btn-primary btn-full" style="margin-top:16px">Xem tất cả</a>
    </div>
  </div>

  <div class="card card-body" style="margin-bottom:24px">
    <div class="section-header" style="margin-bottom:20px">
      <div><div class="section-title">Biểu mẫu gần đây</div><div class="section-sub">Các biểu mẫu được tạo và chỉnh sửa gần nhất</div></div>
      <a href="form-management.html" class="btn btn-outline btn-sm">Xem tất cả</a>
    </div>
    <div id="recent-forms-grid" class="grid-3">${renderRecentFormsCards(RECENT_FORMS)}</div>
  </div>


`;

enhanceDashboardUI();

function enhanceDashboardUI() {
  const root = document.getElementById('page-content');
  if (!root || root.querySelector('.dash-shell')) return;

  const shell = document.createElement('div');
  shell.className = 'dash-shell';
  while (root.firstChild) shell.appendChild(root.firstChild);
  root.appendChild(shell);

  const header = shell.querySelector('.page-header');
  if (header) {
    const title = header.querySelector('.page-title');
    const sub = header.querySelector('.page-sub');
    if (title) title.textContent = 'Trang chủ';
    if (sub) sub.textContent = 'Theo dõi nhanh biểu mẫu, phản hồi và các việc cần xử lý trong hệ thống.';
  }

  const grids = Array.from(shell.children).filter(el => el.tagName === 'DIV');
  if (grids[1]) grids[1].classList.add('dash-top-grid');
  if (grids[2]) grids[2].classList.add('dash-main-grid');

  shell.querySelectorAll('.stat-card').forEach((card, index) => {
    const label = card.querySelector('.stat-label');
    if (label) label.textContent = index === 0 ? 'Tổng biểu mẫu' : 'Tổng phản hồi';
  });

  const chart = document.getElementById('activityChart');
  const chartCard = chart?.closest('.card');
  if (chartCard) {
    chartCard.classList.add('dash-chart-card');
    const title = chartCard.querySelector('.section-title');
    const sub = chartCard.querySelector('.section-sub');
    const rangeBtn = chartCard.querySelector('.btn');
    if (title) title.textContent = 'Hoạt động trong tuần';
    if (sub) sub.textContent = 'So sánh số biểu mẫu phát hành và phản hồi nhận được theo từng ngày.';
    if (rangeBtn) rangeBtn.textContent = '7 ngày';
    chart.parentElement?.classList.add('dash-chart-wrap');
  }

  const taskCard = shell.querySelector('.space-y')?.closest('.card');
  if (taskCard) {
    taskCard.classList.add('dash-task-card');
    const title = taskCard.querySelector('.section-title');
    const link = taskCard.querySelector('a.btn');
    if (title) title.textContent = 'Công việc cần xử lý';
    if (link) link.textContent = 'Xem tất cả';
  }

  const recentCard = document.getElementById('recent-forms-grid')?.closest('.card');
  if (recentCard) {
    recentCard.classList.add('dash-recent-card');
    const title = recentCard.querySelector('.section-title');
    const sub = recentCard.querySelector('.section-sub');
    const link = recentCard.querySelector('a.btn');
    if (title) title.textContent = 'Biểu mẫu gần đây';
    if (sub) sub.textContent = 'Các biểu mẫu mới hoặc vừa được chỉnh sửa gần nhất.';
    if (link) link.textContent = 'Xem tất cả';
  }
}

function renderRecentFormsCards(forms) {
  return forms.map(f => {
    const viewHref = f.id ? `form-management.html?view_form_id=${encodeURIComponent(f.id)}` : 'form-management.html';
    return `
      <div class="form-card" style="text-decoration:none" onclick="window.location.href='${viewHref}'">
        <div class="form-card-thumb">
          <img src="${f.img}" alt="${f.name}" loading="lazy">
          <div class="form-card-overlay">
            <a href="${viewHref}" onclick="event.stopPropagation()" class="btn btn-outline btn-sm" style="background:rgba(255,255,255,.9)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </a>
          </div>
        </div>
        <div class="form-card-body">
          <div class="form-card-name">${f.name}</div>
          <div class="form-card-meta">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>${f.responses}</span>
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${f.time}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function formatRelativeTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Vừa xong';
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

document.addEventListener('DOMContentLoaded', () => {
  const ctx = document.getElementById('activityChart');
  if (ctx) {
    const dashboardChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['T2','T3','T4','T5','T6','T7','CN'],
        datasets: [
          {
            label: 'Form phát hành',
            data: [0, 1, 0, 1, 1, 0, 0],
            borderColor: '#0ea5e9',
            backgroundColor: 'rgba(14,165,233,.15)',
            borderWidth: 2.5, fill: true, tension: .3,
            pointBackgroundColor: '#0ea5e9', pointRadius: 5, pointHoverRadius: 7,
          },
          {
            label: 'Phản hồi nhận',
            data: [34, 52, 41, 67, 58, 28, 19],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,.08)',
            borderWidth: 2, fill: false, tension: .4,
            pointBackgroundColor: '#10b981', pointRadius: 4, pointHoverRadius: 6,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#f1f5f9' } },
          y: {
            type: 'linear', position: 'left',
            grid: { color: '#f1f5f9' }, beginAtZero: true,
            min: 0, max: 3,
            title: { display: true, text: 'Form', font: { size: 11 }, color: '#0ea5e9' },
            ticks: { color: '#0ea5e9', stepSize: 1 }
          },
          y1: {
            type: 'linear', position: 'right',
            grid: { drawOnChartArea: false }, beginAtZero: true,
            title: { display: true, text: 'Phản hồi', font: { size: 11 }, color: '#10b981' },
            ticks: { color: '#10b981' }
          }
        }
      }
    });
    dashboardChart.data.datasets[0].label = 'Biểu mẫu phát hành';
    dashboardChart.data.datasets[1].label = 'Phản hồi nhận được';
    dashboardChart.options.plugins = {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 11.5, weight: '600' },
          color: '#475569',
          boxWidth: 7,
          padding: 14,
          generateLabels: chart => chart.data.datasets.map((ds, i) => ({
            text: ds.label,
            fillStyle: ds.borderColor || ds.backgroundColor,
            strokeStyle: ds.borderColor,
            lineWidth: 2,
            pointStyle: 'circle',
            datasetIndex: i,
            hidden: !chart.isDatasetVisible(i),
          }))
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#e2e8f0',
        bodyColor: '#ffffff',
        cornerRadius: 12,
        padding: 12,
        displayColors: true
      }
    };
    dashboardChart.options.scales.x.grid.display = false;
    dashboardChart.options.scales.x.ticks = { color: '#64748b', font: { size: 12, weight: '600' } };
    dashboardChart.options.scales.y.grid.color = '#eef2f7';
    dashboardChart.options.scales.y.ticks.padding = 8;
    dashboardChart.options.scales.y1.title.text = 'Phản hồi';
    dashboardChart.options.scales.y1.ticks.padding = 8;
    dashboardChart.update();
  }

  // Load recent notifications from localStorage (shared with notifications-mgmt)
  const dashNotifList = document.getElementById('dash-notif-list');
  if (dashNotifList) {
    const typeStyle = {
      info:    {bg:'#dbeafe',color:'#2563eb',label:'Thông tin'},
      success: {bg:'#dcfce7',color:'#16a34a',label:'Thành công'},
      warning: {bg:'#fef9c3',color:'#ca8a04',label:'Cảnh báo'},
      error:   {bg:'#fee2e2',color:'#dc2626',label:'Lỗi'},
    };
    let notifs = [];
    try {
      const stored = localStorage.getItem('flic_notifications');
      notifs = stored ? JSON.parse(stored) : [];
    } catch(e) {}
    const DEFAULT_NOTIFS = [
      {id:'1',title:'Cập nhật hệ thống v2.0.1',msg:'Hệ thống đã được cập nhật với nhiều tính năng mới.',type:'info',date:'5 phút trước',status:'sent'},
      {id:'2',title:'Nhắc nhở: Deadline báo cáo tháng 3',msg:'Vui lòng hoàn thành báo cáo trước ngày 10/03.',type:'warning',date:'2 giờ trước',status:'sent'},
      {id:'3',title:'Form mới cần phê duyệt',msg:'Có 3 form đang chờ phê duyệt của bạn.',type:'success',date:'5 giờ trước',status:'sent'},
      {id:'4',title:'Bảo trì hệ thống đêm nay',msg:'Hệ thống sẽ bảo trì từ 22:00 - 24:00.',type:'error',date:'10 giờ trước',status:'scheduled'},
    ];
    const list = (notifs.length ? notifs : DEFAULT_NOTIFS).slice(0, 4);
    const unreadCount = list.filter(n => n.status !== 'draft').length;
    const badge = document.getElementById('dash-unread-badge');
    if (badge && unreadCount > 0) { badge.textContent = unreadCount; badge.style.display = 'inline-block'; }
    const typeIcons = {
      info:    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
      success: '<polyline points="20 6 9 17 4 12"/>',
      warning: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      error:   '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    };
    if (list.length === 0) {
      dashNotifList.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px 0;color:var(--gray-400)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        <span style="font-size:13px">Chưa có thông báo nào</span>
      </div>`;
    } else {
      dashNotifList.innerHTML = list.map((n,idx) => {
        const ts = typeStyle[n.type] || typeStyle.info;
        const ico = typeIcons[n.type] || typeIcons.info;
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;background:${idx%2===0?'#f8fafc':'#fff'};border:1px solid #f1f5f9"
          onmouseenter="this.style.background='${ts.bg}20';this.style.borderColor='${ts.color}30'"
          onmouseleave="this.style.background='${idx%2===0?'#f8fafc':'#fff'}';this.style.borderColor='#f1f5f9'">
          <div style="width:26px;height:26px;border-radius:6px;background:${ts.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" fill="none" stroke="${ts.color}" stroke-width="2" width="13" height="13">${ico}</svg>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--gray-800);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.title}</div>
            <div style="font-size:10.5px;color:var(--gray-400);margin-top:1px">${n.date} · <span style="color:${ts.color}">${ts.label}</span></div>
          </div>
        </div>`;
      }).join('');
    }
  }
});


// ── Load stats thật từ API ────────────────────────────────────
(async function loadDashboardStats() {
  try {
    const token = localStorage.getItem('token') || '';
    const headers = token ? { Authorization: 'Bearer ' + token } : {};

    // Song song: lấy stats form + stats phản hồi
    const [resForm, resFeedback] = await Promise.all([
      fetch(`${API_BASE}/forms/stats`, { headers }),
      fetch(`${API_BASE}/feedback/stats`, { headers }),
    ]);

    if (resForm.ok) {
      const d = await resForm.json();
      const elForm = document.getElementById('stat-tong-form');
      if (elForm) elForm.textContent = (d.tong_form || 0).toLocaleString('vi-VN');
    }

    if (resFeedback.ok) {
      const d = await resFeedback.json();
      const elFb = document.getElementById('stat-tong-phan-hoi');
      if (elFb) elFb.textContent = (d.tong || 0).toLocaleString('vi-VN');
    }
  } catch(e) {
    console.warn('Không load được stats:', e.message);
  }
})();

(async function loadRecentForms() {
  try {
    const token = localStorage.getItem('token') || '';
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    const res = await fetch(`${API_BASE}/forms`, { headers });
    if (!res.ok) throw new Error('Không tải được danh sách form');
    const data = await res.json();
    RECENT_FORMS = (Array.isArray(data) ? data : [])
      .sort((a, b) => new Date(b.ngay_tao || 0) - new Date(a.ngay_tao || 0))
      .slice(0, 3)
      .map((f, i) => ({
        id: String(f.id),
        name: f.ten_form || 'Biểu mẫu',
        responses: f.so_phan_hoi || 0,
        time: formatRelativeTime(f.ngay_tao),
        img: DASHBOARD_FORM_IMAGES[i % DASHBOARD_FORM_IMAGES.length],
      }));

    const grid = document.getElementById('recent-forms-grid');
    if (grid && RECENT_FORMS.length) grid.innerHTML = renderRecentFormsCards(RECENT_FORMS);
  } catch (e) {
    console.warn('Không tải được biểu mẫu gần đây:', e.message);
  }
})();