// ═══════════════════════════════════════════════════════════════
//  FLIC – Báo cáo & Thống kê  (Dashboard style)
// ═══════════════════════════════════════════════════════════════

const API = API_BASE;
const BLUE='#00008B', RED='#ef4444', PALETTE=['#00008B', '#ea580c', '#06b6d4', '#facc15', '#3b82f6', '#ef4444', '#0f766e', '#fdba74', '#6366f1', '#b45309', '#10b981', '#db2777', '#8b5cf6', '#84cc16', '#1e3a8a', '#f97316', '#14b8a6', '#f43f5e', '#8b1c62', '#059669'];

// ── State ─────────────────────────────────────────────────────
let currentFormId = null;
let analysisData  = null;
let rawRows       = [];   // raw feedback rows để filter
let activeReportRows = [];
let baseAnalysisData = null;
let csvData       = null;
let charts        = {};

// Danh sách biểu mẫu đã import từ Excel (lưu local để hiển thị bên trái)
let importedForms = [];

let activeSource  = null;
let activeFilters = {};
let buildState    = { visType:'bar', aggFn:'count', colX:null, colY:null, activeSlot:null };
let allFields     = [];
let dashboardItems = [];

// ── Helpers ───────────────────────────────────────────────────
const esc      = v => String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escJs    = v => String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ');
const fmt      = (n,d=1) => n==null||isNaN(n) ? '—' : Number(n).toFixed(d);
const fmtDate  = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
const fmtShortDate = d => d ? new Date(d).toLocaleDateString('vi-VN',{ day:'2-digit', month:'2-digit' }) : '—';
const destroyChart = id => { if(charts[id]){ charts[id].destroy(); delete charts[id]; }};
// Đăng ký plugin datalabels nếu có
if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
function polishReportChartConfig(id, cfg) {
  cfg.options = cfg.options || {};
  cfg.options.plugins = cfg.options.plugins || {};
  cfg.options.plugins.tooltip = {
    backgroundColor: '#0f172a',
    titleColor: '#e2e8f0',
    bodyColor: '#ffffff',
    cornerRadius: 12,
    padding: 12,
    displayColors: true,
    ...(cfg.options.plugins.tooltip || {})
  };

  cfg.options.layout = {
    padding: { top: 8, right: 10, bottom: 4, left: 4 },
    ...(cfg.options.layout || {})
  };

  if (cfg.options.scales?.x) {
    cfg.options.scales.x.grid = { display: false, ...(cfg.options.scales.x.grid || {}) };
    cfg.options.scales.x.ticks = {
      color: '#64748b',
      font: { size: 11, weight: '600' },
      padding: 10,
      ...(cfg.options.scales.x.ticks || {})
    };
  }

  if (cfg.options.scales?.y) {
    cfg.options.scales.y.grid = {
      color: '#eaf0f7',
      lineWidth: 1,
      ...(cfg.options.scales.y.grid || {})
    };
    cfg.options.scales.y.ticks = {
      color: '#64748b',
      font: { size: 11, weight: '600' },
      padding: 8,
      ...(cfg.options.scales.y.ticks || {})
    };
  }

  if (id === 'c-timeline' && cfg.data?.datasets?.[0]) {
    cfg.data.datasets[0].borderWidth = 2.8;
    cfg.data.datasets[0].pointBorderWidth = 2;
    cfg.data.datasets[0].pointBorderColor = '#ffffff';
    cfg.data.datasets[0].pointHitRadius = 12;
  }

  // Bar charts standard styling
  if (cfg.type === 'bar' && cfg.data?.datasets) {
    cfg.data.datasets.forEach(ds => {
      // User wants perfectly rectangular bars
      ds.borderRadius = 0;
      if (ds.maxBarThickness === undefined) {
        ds.maxBarThickness = cfg.options?.indexAxis === 'y' ? 32 : 80; 
      }
    });
  }

  return cfg;
}
const mkChart  = (id,cfg) => { destroyChart(id); const el=document.getElementById(id); if(el) charts[id]=new Chart(el,polishReportChartConfig(id,cfg)); };
const rAF      = { responsive:true, maintainAspectRatio:false };
const noGrid   = { grid:{display:false}, border:{display:false} };
const softGrid = { grid:{color:'#f1f5f9'}, border:{display:false} };
const noLegend = { legend:{display:false} };

function buildTimelineStats(items, dateKey='ngay', valueKey='so_luong') {
  const total = items.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);
  const activeItems = items.filter(item => (Number(item[valueKey]) || 0) > 0);
  const peakItem = items.reduce((best, item) => {
    const current = Number(item[valueKey]) || 0;
    const bestValue = Number(best?.[valueKey]) || -1;
    return current > bestValue ? item : best;
  }, null);

  // Tính cao nhất / tuần + ngày từ-đến
  const weekMap = {};
  items.forEach(item => {
    const d = new Date(item[dateKey]);
    if (isNaN(d)) return;
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const mon = new Date(d); mon.setDate(d.getDate() + diff);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const wKey = mon.toISOString().slice(0,10);
    if (!weekMap[wKey]) weekMap[wKey] = { count: 0, from: mon, to: sun };
    weekMap[wKey].count += (Number(item[valueKey]) || 0);
  });
  let peakWeek = 0, peakWeekLabel = '';
  Object.values(weekMap).forEach(w => {
    if (w.count > peakWeek) {
      peakWeek = w.count;
      const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      peakWeekLabel = `${fmt(w.from)} – ${fmt(w.to)}`;
    }
  });

  return {
    total,
    activeDays: activeItems.length,
    peakValue: Number(peakItem?.[valueKey]) || 0,
    peakDate: peakItem?.[dateKey] || '',
    peakWeek,
    peakWeekLabel
  };
}

function renderTimelineSummary(cardId, stats, canvasId) {
  const wrap = document.querySelector(`#slot-${cardId} .card-inner`);
  if (!wrap) return;

  wrap.style.height = 'auto';
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:16px">
      <div style="display:inline-flex;align-items:center;gap:16px;padding:8px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px">
        <div style="display:flex;align-items:baseline;gap:6px">
          <span style="font-size:12px;color:#64748b;font-weight:600">Cao nhất / tuần:</span>
          <span style="font-size:15px;font-weight:800;color:var(--gray-900)">${stats.peakWeek}</span>
          <span style="font-size:11px;color:#94a3b8">(${stats.peakWeekLabel || '--'})</span>
        </div>
        <div style="width:1px;height:14px;background:#cbd5e1"></div>
        <div style="display:flex;align-items:baseline;gap:6px">
          <span style="font-size:12px;color:#64748b;font-weight:600">Cao nhất / ngày:</span>
          <span style="font-size:15px;font-weight:800;color:var(--gray-900)">${stats.peakValue}</span>
          <span style="font-size:11px;color:#94a3b8">(${stats.peakDate ? fmtDate(stats.peakDate) : '--'})</span>
        </div>
      </div>
    </div>
    <div style="height:220px">
      <canvas id="${canvasId}"></canvas>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
//  HTML
// ─────────────────────────────────────────────────────────────
document.getElementById('page-content').innerHTML = `
<style>
  .dash-card {
    background:var(--gray-50); border-radius:16px; border:1px solid #e8edf5;
    box-shadow:0 1px 4px rgba(0,0,0,.04); overflow:hidden; transition:box-shadow .2s;
  }
  .dash-card:hover { box-shadow:0 4px 20px rgba(0,0,0,.08); }
  .dash-card-header { padding:18px 20px 0; display:flex; align-items:flex-start; justify-content:space-between; }
  .dash-card-title  { font-size:14px; font-weight:700; color:var(--gray-900); }
  .dash-card-sub    { font-size:12px; color:#94a3b8; margin-top:2px; }
  .dash-card-body   { padding:14px 20px 20px; }
  .chart-type-btn {
    width:34px; height:34px; border-radius:8px; border:1.5px solid #e2e8f0;
    background:var(--gray-50); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s;
  }
  .chart-type-btn:hover  { border-color:var(--brand-color); background:#00008B; color:#fff; }
  .chart-type-btn.active { border-color:var(--brand-color); background:#00008B; color:#fff; }
  .chart-type-btn.active svg { stroke:#fff !important; }
  .field-row {
    display:flex; align-items:center; gap:8px; padding:7px 12px;
    border-radius:8px; cursor:pointer; transition:background .12s; font-size:12.5px;
  }
  .field-row:hover { background:#f8fafc; }
  .agg-btn {
    flex:1; padding:5px 3px; font-size:10px; font-weight:700; border-radius:6px;
    border:1.5px solid #e2e8f0; background:var(--gray-50); color:#94a3b8; cursor:pointer; transition:all .15s;
  }
  .agg-btn.active { border-color:var(--brand-color); background:#00008B; color:#fff; }
  .remove-btn {
    width:26px; height:26px; border-radius:6px; border:1px solid #fecaca;
    background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center;
    opacity:0; transition:opacity .15s;
  }
  .dash-card:hover .remove-btn { opacity:1; }
  .panel-label {
    font-size:10px; font-weight:700; color:#94a3b8; letter-spacing:.8px;
    text-transform:uppercase; margin-bottom:6px; display:block;
  }
  /* AI Analysis */
  .ai-section { margin-bottom:20px; }
  .ai-section-title { font-size:13px; font-weight:700; color:var(--gray-900); margin-bottom:8px; display:flex; align-items:center; gap:6px; }
  .ai-tag {
    display:inline-block; padding:3px 10px; border-radius:20px; font-size:11.5px; font-weight:600; margin:3px 3px 0 0;
  }
  .ai-typing::after { content:'▋'; animation:blink .7s infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  .ai-score-ring { position:relative; display:inline-flex; align-items:center; justify-content:center; }
  .ai-key-input { border:1.5px solid #e2e8f0; border-radius:9px; padding:8px 12px; font-size:12px; width:100%; box-sizing:border-box; outline:none; transition:border .15s; }
  .ai-key-input:focus { border-color:var(--brand-color); }
  .report-topbar { display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px; }
  .report-actions { display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end; }
  .report-filter-bar {
    margin:0 0 16px;padding:14px 16px;
    display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;
    background:var(--gray-50);
    border:1px solid #dbe8ff;border-radius:12px;box-shadow:none;
  }
  .report-filter-field { display:flex;flex-direction:column;gap:5px;min-width:160px; max-width: 320px; flex: 1; }
  .report-filter-field.primary { flex:1;min-width:260px; max-width: none; }
  .report-filter-field.keyword { flex:1;min-width:230px; max-width: none; }
  #sf-dynamic-filters { display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;width:100%; }
  .report-form-info-grid { display:grid;grid-template-columns:repeat(6,minmax(0,1fr)); }
  .report-filter-field label { font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; width:100%; cursor:help; }
  .report-filter-field select,
  .report-filter-field input {
    height:38px;border:1.5px solid #d6e2f0;border-radius:10px;background:var(--gray-50);
    padding:0 11px;font-size:13px;color:var(--gray-900);outline:none;font-family:inherit;
  }
  .report-filter-field select:focus,
  .report-filter-field input:focus { border-color:var(--brand-color);box-shadow:0 0 0 3px rgba(0,0,139,.08); }
  .report-section-title { display:flex;align-items:center;justify-content:space-between;gap:10px;margin:20px 0 10px; }
  .report-section-title h3 { margin:0;font-size:16px;font-weight:850;color:var(--gray-900);letter-spacing:0; }
  .report-section-title span { font-size:12px;color:#64748b;font-weight:600; }
  .report-ai-summary {
    border:1px solid #c7d2fe;border-radius:16px;padding:18px 20px;
    background:linear-gradient(135deg,#f8fbff 0%,#eef5ff 100%);
    box-shadow:0 10px 28px rgba(30,64,175,.08);
  }
  .report-two-col { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin-top:12px; }
  .report-three-col { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px; }
  .word-cloud { min-height:230px;display:flex;align-content:center;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:18px; }
  .word-cloud span { display:inline-flex;padding:5px 9px;border-radius:999px;background:#f1f5f9;color:var(--gray-900);font-weight:800;line-height:1; }
  @media (max-width:1100px) {
    .report-two-col,.report-three-col { grid-template-columns:1fr; }
    .report-topbar { flex-direction:column; }
    .report-actions { justify-content:flex-start; }
    .report-form-info-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  }
</style>

<!-- HEADER -->
<div id="rpt-main-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
  <div style="display:flex;align-items:center;gap:12px">
    <div>
      <h2 style="font-size:22px;font-weight:800;color:var(--gray-900);margin:0">Báo cáo & Thống kê</h2>
      <p style="font-size:13px;color:#94a3b8;margin:3px 0 0">Phân tích dữ liệu trực quan từ form khảo sát</p>
    </div>
  </div>
  <div style="display:flex;gap:8px">
    <input type="file" id="rpt-csv-input" accept=".xlsx,.xls" style="display:none" onchange="handleExcelImport(this)">
    <button id="btn-ai-analyze" onclick="openAIAnalysis()" style="display:none;gap:6px;border-radius:10px;padding:0 16px;height:38px;border:1.5px solid #00008B;background:linear-gradient(135deg,#00008B,#00008B);color:#fff;font-size:13px;font-weight:600;cursor:pointer;align-items:center;transition:opacity .2s"
      onmouseenter="this.style.opacity='.85'" onmouseleave="this.style.opacity='1'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:5px"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
      Phân tích AI
    </button>
    <button class="btn btn-outline" onclick="document.getElementById('rpt-csv-input').click()" style="gap:6px;border-radius:10px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Import Excel
    </button>
    <div style="position:relative" id="rpt-exp-wrap">
      <button class="btn btn-primary" onclick="document.getElementById('rpt-exp-menu').classList.toggle('open')" style="gap:6px;border-radius:10px;background:#00008B;border-color:#fff">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg>
        Xuất<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11" style="margin-left:2px"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="export-drop-menu" id="rpt-exp-menu">
        <div class="export-drop-item" onclick="doExportReport('Excel');document.getElementById('rpt-exp-menu').classList.remove('open')">📊 Xuất Excel</div>
        <div class="export-drop-item" onclick="doExportReport('CSV');document.getElementById('rpt-exp-menu').classList.remove('open')">📄 Xuất CSV</div>
        <div class="export-drop-item" onclick="doExportReport('PDF');document.getElementById('rpt-exp-menu').classList.remove('open')">📑 Xuất PDF</div>
      </div>
    </div>
  </div>
</div>

<!-- PICKER -->
<div id="rpt-picker">
  <!-- GLOBAL DASHBOARD (From requested design) -->
  <div id="rpt-global-dashboard" style="margin-bottom:32px;">
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;margin-bottom:16px;">
      <!-- Card 1 -->
      <div class="dash-card" style="padding:20px;border-radius:16px;position:relative;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,0.05);background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:14px;font-weight:700;color:#64748b;margin-bottom:4px;">Tổng biểu mẫu</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;font-weight:500;">Số lượng biểu mẫu đang hoạt động</div>
            <div id="rpt-total-forms-value" style="font-size:32px;font-weight:800;color:var(--gray-900);line-height:1;margin-bottom:16px;">8</div>
          </div>
          <div style="width:42px;height:42px;border-radius:12px;background:#f5f7ff;display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#00008B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          </div>
        </div>
        <div id="rpt-total-forms-trend" style="font-size:13px;font-weight:600;color:#10b981;display:flex;align-items:center;gap:4px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          +100% <span style="color:#94a3b8;font-weight:500;">so với tháng trước</span>
        </div>
      </div>
      <!-- Card 2 -->
      <div class="dash-card" style="padding:20px;border-radius:16px;position:relative;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,0.05);background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:14px;font-weight:700;color:#64748b;margin-bottom:4px;">Tổng phản hồi</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;font-weight:500;">Số lượt người dùng nộp biểu mẫu</div>
            <div id="rpt-total-responses-value" style="font-size:32px;font-weight:800;color:var(--gray-900);line-height:1;margin-bottom:16px;">32</div>
          </div>
          <div style="width:42px;height:42px;border-radius:12px;background:#fff7ed;display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          </div>
        </div>
        <div id="rpt-total-responses-trend" style="font-size:13px;font-weight:600;color:#ef4444;display:flex;align-items:center;gap:4px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>
          -20% <span style="color:#94a3b8;font-weight:500;">so với tháng trước</span>
        </div>
      </div>
      <!-- Card 3: Biểu mẫu đang hoạt động -->
      <div class="dash-card" style="padding:20px;border-radius:16px;position:relative;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,0.05);background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="width:100%">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <div style="font-size:14px;font-weight:700;color:#64748b;">Biểu mẫu đang hoạt động</div>
              <div style="width:36px;height:36px;border-radius:10px;background:#f5f7ff;display:flex;align-items:center;justify-content:center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="#00008B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              </div>
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:16px;font-weight:500;">Tỉ lệ form đang thu thập phản hồi</div>
            <div style="display:flex;align-items:baseline;gap:8px;">
              <div id="rpt-active-forms-value" style="font-size:32px;font-weight:800;color:var(--gray-900);line-height:1;">0</div>
              <div style="font-size:14px;color:#64748b;font-weight:600;">/ <span id="rpt-active-forms-total">0</span> form</div>
            </div>
            <!-- Progress Bar -->
            <div style="width:100%;background:#f1f5f9;height:8px;border-radius:4px;margin-top:16px;overflow:hidden;">
              <div id="rpt-active-rate-bar" style="width:0%;background:#00008B;height:100%;border-radius:4px;transition:width 1s ease-out;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Second Row: Chart + Form List -->
    <div style="display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;">
      
      <!-- Chart Card -->
      <div class="dash-card" style="padding:24px;border-radius:16px;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,0.05);background:#fff;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>
            <div style="font-size:18px;font-weight:800;color:var(--gray-900);margin-bottom:4px;">Thống kê hoạt động</div>
            <div style="font-size:13px;color:#64748b;">Số biểu mẫu tạo mới và phản hồi nhận được theo thời gian.</div>
          </div>
          <div style="display:flex;gap:4px;background:#f1f5f9;padding:4px;border-radius:8px;border:1px solid #e2e8f0;">
            <button class="rpt-range-btn" onclick="setActivityRange('7', this)" style="padding:6px 12px;border-radius:6px;border:none;background:#fff;font-size:12px;font-weight:600;color:var(--gray-900);cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.05);">7 ngày</button>
            <button class="rpt-range-btn" onclick="setActivityRange('this_month', this)" style="padding:6px 12px;border-radius:6px;border:none;background:transparent;font-size:12px;font-weight:600;color:#64748b;cursor:pointer;box-shadow:none;">Tháng này</button>
            <button class="rpt-range-btn" onclick="setActivityRange('90', this)" style="padding:6px 12px;border-radius:6px;border:none;background:transparent;font-size:12px;font-weight:600;color:#64748b;cursor:pointer;box-shadow:none;">3 tháng</button>
          </div>
        </div>
        <div style="flex:1;position:relative;min-height:260px;">
          <canvas id="rpt-global-chart"></canvas>
        </div>
      </div>

      <!-- Form trong hệ thống Card -->
      <div class="dash-card" style="border-radius:16px;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,0.05);background:#fff;display:flex;flex-direction:column;max-height:420px;">
        <div class="dash-card-header" style="align-items: center; border-bottom: 1px solid #f8fafc; padding-bottom: 12px;">
          <div>
            <div class="dash-card-title">Form trong hệ thống</div>
            <div class="dash-card-sub">Chỉ hiện biểu mẫu đã có phản hồi</div>
          </div>
          <div style="display:flex; gap: 8px; align-items:center;">
            <input type="hidden" id="rpt-form-category-filter" value="">
            <button class="rpt-cat-pill" onclick="setRptCategory('Ngoại ngữ', this)" style="padding: 6px 14px; border-radius: 20px; border: 1px solid #e2e8f0; background: #fff; color: #64748b; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .2s;">Ngoại ngữ</button>
            <button class="rpt-cat-pill" onclick="setRptCategory('Tin học', this)" style="padding: 6px 14px; border-radius: 20px; border: 1px solid #e2e8f0; background: #fff; color: #64748b; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .2s;">Tin học</button>
            <input type="file" id="rpt-import-file" style="display:none" accept=".xlsx,.xls,.csv" onchange="handleImportExcel(event)">
          </div>
        </div>
        <!-- Thanh tìm kiếm -->
        <div style="padding: 16px 16px 0; display:flex;">
          <div style="flex:1; position:relative;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" width="14" height="14" style="position:absolute; left:12px; top:50%; transform:translateY(-50%);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="rpt-form-search-filter" oninput="renderFormListWithImports()" placeholder="Tìm kiếm biểu mẫu..." style="width:100%; padding: 8px 12px 8px 34px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px; color: var(--gray-900); background: #f8fafc; outline: none; transition: all .2s; box-sizing:border-box;">
          </div>
        </div>
        <div class="dash-card-body" style="padding-top:16px;flex:1;display:flex;flex-direction:column;min-height:0;">
          <div id="rpt-form-list" style="display:flex;flex-direction:column;gap:5px;flex:1;overflow-y:auto;padding-right:4px;">
            <div style="text-align:center;padding:28px;color:#94a3b8;font-size:13px">Đang tải...</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</div>

<!-- DASHBOARD -->
<div id="rpt-dashboard" style="display:none">
  <!-- Breadcrumb -->
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
    <button onclick="navigateBackToPicker()" style="display:flex;align-items:center;gap:5px;padding:7px 14px;border-radius:9px;border:1.5px solid #e2e8f0;background:#f8fafc;font-size:12.5px;color:var(--brand-color);cursor:pointer;font-weight:700;transition:all .15s"
      onmouseenter="this.style.background='var(--gray-100)'"
      onmouseleave="this.style.background='var(--gray-100)'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="15 18 9 12 15 6"/></svg>
      Chọn nguồn khác
    </button>
    <svg viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2" width="13" height="13"><polyline points="9 18 15 12 9 6"/></svg>
    <span id="rpt-dash-title" onclick="viewFormFromReport()" title="Xem chi tiết biểu mẫu" style="font-size:14.5px;font-weight:700;color:var(--brand-color);cursor:pointer;transition:color .15s" onmouseenter="this.style.color='#0000cd'" onmouseleave="this.style.color='var(--brand-color)'"></span>
    <span id="rpt-dash-badge" style="padding:4px 10px;border-radius:6px;background:#eef2ff;color:var(--brand-color);font-size:12.5px;font-weight:700"></span>
  </div>
  <!-- 1. KPIs Row (Top) -->
  <div id="rpt-kpi-row" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:24px"></div>

  <!-- 2. Sleek Filter Bar -->
  <div class="dash-card" style="margin-bottom:24px;padding:16px 20px;border-radius:12px;background:var(--gray-50);border:1.5px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,.05)">
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:20px">



      <!-- Thời gian -->
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Từ:</span>
        <input type="date" id="sf-tungay" onchange="onSmartSearch()" style="padding:6px 12px;border-radius:8px;border:1.5px solid #e2e8f0;font-size:13px;outline:none;background:var(--gray-50)">
        <span style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Đến:</span>
        <input type="date" id="sf-denngay" onchange="onSmartSearch()" style="padding:6px 12px;border-radius:8px;border:1.5px solid #e2e8f0;font-size:13px;outline:none;background:var(--gray-50)">
      </div>
      <!-- Tìm kiếm từ khóa -->
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:200px">
        <input type="search" id="sf-keyword-input" placeholder="Tìm từ khóa..." oninput="onSmartSearch()" style="width:100%;padding:7px 12px;border-radius:8px;border:1.5px solid #e2e8f0;font-size:13px;outline:none;background:var(--gray-50)">
      </div>
      <!-- Xóa bộ lọc -->
      <button onclick="resetSmartSearch()" style="padding:8px 16px;border-radius:8px;border:1px solid #fed7aa;background:#fff7ed;color:#ea580c;font-size:12.5px;font-weight:700;cursor:pointer;transition:all .15s" onmouseenter="this.style.background='#ffedd5'" onmouseleave="this.style.background='#fff7ed'">Đặt lại</button>
    </div>
    
    <!-- Nơi render thêm filter động (nếu có) -->
    <div id="sf-dynamic-filters" style="display:flex;align-items:center;flex-wrap:wrap;gap:16px;margin-top:16px"></div>
    
    <div id="sf-result-bar" style="display:none;margin-top:16px;padding:10px 16px;border-radius:8px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:13px;font-weight:600;align-items:center;justify-content:space-between">
      <span id="sf-result-label"></span>
      <button onclick="resetSmartSearch()" style="font-size:12px;font-weight:700;color:#dc2626;background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:6px;transition:all .15s" onmouseenter="this.style.background='#fef2f2'" onmouseleave="this.style.background='none'">✕ Xóa lọc</button>
    </div>
  </div>

  <!-- 3. AI Insights -->
  <div id="rpt-ai-title" class="report-section-title" style="margin-top:8px"><h3>Phân tích AI</h3><span>Tóm tắt thông minh từ dữ liệu khảo sát</span></div>
  <div id="rpt-ai-summary" class="report-ai-summary" style="margin-bottom:24px"></div>

  <!-- 4. Overview Charts (2 Col) -->
  <div id="rpt-ai-grid" class="report-two-col" style="margin-bottom:24px">
    <div class="dash-card">
      <div class="dash-card-header"><div class="dash-card-title">Biểu đồ cảm xúc</div></div>
      <div class="dash-card-body" style="height:280px"><canvas id="rpt-ai-sentiment"></canvas></div>
    </div>
    <div class="dash-card">
      <div class="dash-card-header"><div class="dash-card-title">Đám mây từ khóa</div></div>
      <div id="rpt-word-cloud" class="word-cloud" style="height:280px;align-content:center;justify-content:center"></div>
    </div>
  </div>

  <!-- 5. Participant Stats (3 Col) -->
  <div id="rpt-participant-title" class="report-section-title"><h3>Thống kê đối tượng tham gia</h3><span>Chân dung người phản hồi</span></div>
  <div id="rpt-participant-grid" class="report-three-col" style="margin-bottom:24px">
    <div class="dash-card">
      <div class="dash-card-header"><div class="dash-card-title">Tỷ lệ đối tượng</div></div>
      <div class="dash-card-body" style="height:250px"><canvas id="rpt-participant-donut"></canvas></div>
    </div>
    <div class="dash-card">
      <div class="dash-card-header"><div class="dash-card-title">Top Khoa / Lớp</div></div>
      <div class="dash-card-body" style="height:250px"><canvas id="rpt-top-dept"></canvas></div>
    </div>
    <div class="dash-card">
      <div class="dash-card-header"><div class="dash-card-title">Top Giảng viên được đánh giá</div></div>
      <div id="rpt-teacher-leaderboard" class="dash-card-body" style="height:250px;overflow-y:auto"></div>
    </div>
  </div>

  <!-- 6. Questions Charts -->
  <div id="rpt-charts-grid" style="display:grid;grid-template-columns:1fr;gap:24px"></div>

  <div style="display:flex;justify-content:center;margin-top:32px;margin-bottom:16px">
    <button onclick="addCustomChartSlot()" style="padding:10px 24px;border-radius:10px;border:1.5px dashed #00008B;background:#f8fafc;color:var(--brand-color);font-size:13.5px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .2s" onmouseenter="this.style.background='#eef2ff';this.style.transform='translateY(-1px)'" onmouseleave="this.style.background='var(--gray-100)';this.style.transform='none'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Thêm biểu đồ tùy chỉnh
    </button>
  </div>
</div>
`;

outsideClick('rpt-exp-wrap','rpt-exp-menu');
// ─────────────────────────────────────────────────────────────
//  TEACHER SEARCH
// ─────────────────────────────────────────────────────────────
// Populate dropdown giáo viên từ rawRows hoặc API
async function populateTeacherDropdown() {
  const sel = document.getElementById('sf-giaovien-input');
  if (!sel) return;
  const currentValue = sel.value || '';
  const selectedDepartment = (document.getElementById('sf-khoa-input')?.value || '').trim().toLowerCase();
  // Lấy từ rawRows trước (nhanh hơn)
  let names = [];
  if (rawRows && rawRows.length) {
    names = [...new Set(
      rawRows
        .filter(r => !selectedDepartment || String(r.khoa || '').trim().toLowerCase() === selectedDepartment)
        .map(r => (r.giao_vien||'').trim())
        .filter(Boolean)
    )].sort();
  }
  // Nếu không có trong rawRows thì gọi API
  if (!names.length) {
    try {
      const tkn = localStorage.getItem('token') || '';
      const res = await fetch(`${API}/reports/teachers-list`, {
        headers: tkn ? { Authorization: `Bearer ${tkn}` } : {}
      });
      const data = await res.json();
      names = data.teachers || [];
    } catch(e) {}
  }
  // Rebuild options
  sel.innerHTML = '<option value="">-- Chọn giáo viên --</option>';
  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  if (currentValue && names.includes(currentValue)) {
    sel.value = currentValue;
  }
  // Reset kết quả
  document.getElementById('sf-giaovien-result').innerHTML = '';
}

function populateDepartmentDropdown() {
  const sel = document.getElementById('sf-khoa-input');
  if (!sel) return;
  const departments = [...new Set((rawRows || []).map(r => String(r.khoa || '').trim()).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">-- Chọn khoa --</option>';
  departments.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name.toLowerCase();
    opt.textContent = name;
    sel.appendChild(opt);
  });
  populateLopDropdown();
}

function populateLopDropdown() {
  const sel = document.getElementById('sf-lop-input');
  if (!sel) return;
  const sfKhoa    = (document.getElementById('sf-khoa-input')?.value || '').trim().toLowerCase();
  const sfKhoaHoc = (document.getElementById('sf-khoa-hoc-input')?.value || '').trim().toLowerCase();
  const sfGv      = (document.getElementById('sf-giaovien-input')?.value || '').trim().toLowerCase();
  const lops = [...new Set(
    (rawRows || [])
      .filter(r => !sfKhoa    || (r.khoa||'').toLowerCase() === sfKhoa)
      .filter(r => !sfKhoaHoc || (r.lop||'').toLowerCase().startsWith(sfKhoaHoc))
      .filter(r => !sfGv      || (r.giao_vien||'').toLowerCase() === sfGv)
      .map(r => (r.lop||'').trim())
      .filter(Boolean)
  )].sort();
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- Chọn lớp --</option>';
  lops.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name.toLowerCase();
    opt.textContent = name;
    if (name.toLowerCase() === cur) opt.selected = true;
    sel.appendChild(opt);
  });
}

function normalizeVietnameseKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isClassQuestionText(value) {
  const key = normalizeVietnameseKey(value);
  return key === 'lop' || key === 'ten lop' || key === 'lop hoc' || key === 'ma lop' || key.startsWith('lop ');
}

async function enrichRowsWithClassQuestion(formId, rows) {
  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API}/reports/export/${formId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) return rows;
    const data = await res.json();
    const classQuestion = (data.questions || []).find(q => isClassQuestionText(q.noi_dung));
    if (!classQuestion) return rows;
    const classKey = 'q_' + classQuestion.id;
    const exportRows = Array.isArray(data.rows) ? data.rows : [];
    if (!exportRows.length) return rows;

    const byId = new Map(exportRows.map(r => [String(r.id), r]));
    return (rows || []).map((row, idx) => {
      const extra = byId.get(String(row.id)) || exportRows[idx] || {};
      const classAnswer = String(extra[classKey] || '').trim();
      return { ...extra, ...row, lop: String(row.lop || '').trim() || classAnswer };
    });
  } catch (e) {
    return rows;
  }
}

function onDepartmentChange() {
  populateTeacherDropdown();
  populateLopDropdown();
  onSmartSearch();
}

function onTeacherSearch(val) {
  const sideBox = document.getElementById('sf-giaovien-result');
  const q = (val || '').trim();
  const khoaSel = document.getElementById('sf-khoa-input');
  if (!q) {
    sideBox.innerHTML = '';
    // Restore normal dashboard if we were in teacher mode
    if (window._teacherMode) {
      window._teacherMode = false;
      renderKPIs();
      renderDefaultCharts();
    }
    onSmartSearch();
    return;
  }
  const matchedDepartments = [...new Set(
    (rawRows || [])
      .filter(r => String(r.giao_vien || '').trim() === q)
      .map(r => String(r.khoa || '').trim())
      .filter(Boolean)
  )];
  if (khoaSel && matchedDepartments.length) {
    khoaSel.value = matchedDepartments[0].toLowerCase();
    populateTeacherDropdown();
    const teacherSel = document.getElementById('sf-giaovien-input');
    if (teacherSel) teacherSel.value = q;
  }
  onSmartSearch();
  sideBox.innerHTML = '<div style="font-size:11.5px;color:#94a3b8;padding:6px 2px">Đang tải...</div>';
  (async () => {
    try {
      const tkn = localStorage.getItem('token') || '';
      const res  = await fetch(`${API}/reports/teacher-search?q=${encodeURIComponent(q)}`, {
        headers: tkn ? { Authorization: `Bearer ${tkn}` } : {}
      });
      const data = await res.json();
      renderTeacherResult(data, q);
    } catch(e) {
      sideBox.innerHTML = '<div style="font-size:11.5px;color:#ef4444;padding:6px 2px">⚠️ Không kết nối được server</div>';
    }
  })();
}

function renderTeacherResult(data, q) {
  const sideBox = document.getElementById('sf-giaovien-result');

  if (!data || !data.teachers || !data.teachers.length) {
    sideBox.innerHTML = `<div style="font-size:11.5px;color:#94a3b8;padding:8px 4px">Không tìm thấy giáo viên <b>"${esc(q)}"</b></div>`;
    return;
  }

  sideBox.innerHTML = `<div style="font-size:11px;color:#16a34a;font-weight:600;padding:4px 2px">✅ Đã hiển thị bên dashboard</div>`;
  window._teacherMode = true;

  // ── Lấy giáo viên đầu tiên (hoặc duy nhất) ──────────────
  const tv = data.teachers[0];
  const svList = tv.students || [];
  const pos  = tv.tich_cuc || 0;
  const neg  = tv.tieu_cuc || 0;
  const neu  = (tv.so_phan_hoi || 0) - pos - neg;
  const lopList = tv.lop_list ? tv.lop_list.replace(/,\s*$/, '').split(',').map(l=>l.trim()).filter(Boolean) : [];

  // ── Star distribution từ students ────────────────────────
  const starDist = {1:0,2:0,3:0,4:0,5:0};
  svList.forEach(sv => { const s = parseInt(sv.danh_gia); if (s>=1&&s<=5) starDist[s]++; });

  // ── Helpers ───────────────────────────────────────────────
  const camBadge = cx => {
    if (cx==='positive') return '<span style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700">😊 Tích cực</span>';
    if (cx==='negative') return '<span style="background:#fff1f2;color:#dc2626;border:1px solid #fecaca;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700">😞 Tiêu cực</span>';
    return '<span style="background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700">😐 Trung tính</span>';
  };

  const lopHtml = lopList.length
    ? lopList.map(l=>`<span style="display:inline-block;padding:3px 10px;background:#00008B;color:#fff;border-radius:20px;font-size:11.5px;font-weight:600;margin:2px 3px 0 0">${esc(l)}</span>`).join('')
    : '<span style="color:#94a3b8;font-size:12px">Chưa có thông tin lớp</span>';

  // ── KPI ───────────────────────────────────────────────────
  const kpiGrid = document.getElementById('rpt-kpi-row');
  const posR = Math.round(pos / ((tv.so_phan_hoi||1)) * 100);
  const negR = Math.round(neg / ((tv.so_phan_hoi||1)) * 100);
  kpiGrid.innerHTML = [
    {label:'Tổng phản hồi',   value: tv.so_phan_hoi||0,              sub: `${tv.so_form||0} form · ${tv.so_lop||0} lớp`, icon:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z', color:'#fff', bg:'#00008B'},
    {label:'Điểm hài lòng',   value: tv.diem_tb ? parseFloat(tv.diem_tb).toFixed(1)+'★' : '—', sub:'<span style="color:#f59e0b">★★★★★</span>', icon:'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', color:'#d97706', bg:'#fffbeb'},
    {label:'Tích cực',        value: posR+'%',                        sub: pos+' người', icon:'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01', color:'#059669', bg:'#f0fdf4'},
    {label:'Tiêu cực',        value: negR+'%',                        sub: neg+' người', icon:'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01', color:'#dc2626', bg:'#fff1f2'},
  ].map(k => `
    <div class="dash-card" style="padding:16px 18px;display:flex;align-items:center;gap:12px;border-left:3px solid ${k.color}">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-bottom:4px">${k.label}</div>
        <div style="font-size:26px;font-weight:800;color:var(--gray-900);line-height:1">${k.value}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:3px">${k.sub}</div>
      </div>
      <div style="width:40px;height:40px;border-radius:12px;background:${k.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="${k.color}" stroke-width="2" width="20" height="20"><path d="${k.icon}"/></svg>
      </div>
    </div>`).join('');


  // ── Charts grid ───────────────────────────────────────────
  ['tv-rating','tv-sentiment'].forEach(id => { destroyChart(id); });
  const chartsGrid = document.getElementById('rpt-charts-grid');
  chartsGrid.innerHTML = `
  <!-- Header giáo viên -->
  <div class="dash-card" style="grid-column:1/-1;padding:0;overflow:hidden">
    <div style="background:linear-gradient(135deg,#00008B 0%,#00008B 60%,#00008B 100%);padding:18px 22px;display:flex;align-items:center;gap:14px;border-bottom:1.5px solid #00008B">
      <div style="width:44px;height:44px;border-radius:50%;background:#00008B1a;border:1.5px solid #00008B;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="#00008B" stroke-width="2" width="22" height="22"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:17px;font-weight:800;color:var(--brand-color)">${esc(tv.giao_vien)}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">🏫 Lớp giảng dạy: ${lopHtml}</div>
      </div>
      <button onclick="window._teacherMode=false;document.getElementById('sf-giaovien-input').value='';document.getElementById('sf-giaovien-result').innerHTML='';renderKPIs();renderDefaultCharts();"
        style="padding:7px 16px;border-radius:9px;border:1.5px solid #00008B;background:var(--gray-50);color:var(--brand-color);font-size:12px;font-weight:700;cursor:pointer;transition:all .15s"
        onmouseenter="this.style.background='#00008B';this.style.borderColor='#fff'"
        onmouseleave="this.style.background='var(--gray-50)';this.style.borderColor='var(--brand-color)'">
        ✕ Đóng
      </button>
    </div>
  </div>`;

  // Thêm 2 chart card đúng chuẩn như addChartCard gốc
  addChartCard('tv-rating',    'Phân bổ đánh giá', 'half', 210);
  addChartCard('tv-sentiment', 'Tỷ lệ cảm xúc',   'half', 210);

  // Card danh sách sinh viên (full width)
  const svCard = document.createElement('div');
  svCard.className = 'dash-card'; svCard.id = 'slot-tv-students';
  svCard.style.gridColumn = '1/-1';
  svCard.innerHTML = `
    <div class="dash-card-header">
      <div class="dash-card-title">👨‍🎓 Phản hồi từ sinh viên</div>
      <span class="dash-card-sub" style="font-size:12px;color:#94a3b8;margin-left:8px">${svList.length} sinh viên</span>
    </div>
    <div class="dash-card-body" style="padding-top:8px">
      <div id="tv-student-list" style="display:flex;flex-direction:column;max-height:420px;overflow-y:auto">
        ${svList.length ? svList.map((sv,i) => `
          <div style="padding:12px 4px;border-bottom:1px solid #f1f5f9;display:${i<10?'block':'none'}" class="tv-sv-row">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px">
              <div style="font-size:13px;font-weight:700;color:var(--gray-900)">${esc(sv.ho_ten||'Ẩn danh')}</div>
              <div style="display:flex;gap:1px;flex-shrink:0">
                ${[1,2,3,4,5].map(s=>`<span style="font-size:14px;color:${s<=parseInt(sv.danh_gia)?'#f59e0b':'#e2e8f0'}">★</span>`).join('')}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">
              ${sv.lop  ? `<span style="font-size:11px;background:#f1f5f9;color:var(--gray-600);padding:2px 8px;border-radius:5px">${esc(sv.lop)}</span>` : ''}
              ${sv.khoa ? `<span style="font-size:11px;background:#f1f5f9;color:var(--gray-600);padding:2px 8px;border-radius:5px">${esc(sv.khoa)}</span>` : ''}
              ${camBadge(sv.cam_xuc)}
            </div>
            ${sv.noi_dung && sv.noi_dung.trim() ? `
            <div style="font-size:12px;color:var(--gray-600);font-style:italic;line-height:1.6;padding:8px 12px;background:#f8fafc;border-left:3px solid #00008B;border-radius:0 8px 8px 0">
              "${esc(sv.noi_dung.length>200 ? sv.noi_dung.slice(0,200)+'…' : sv.noi_dung)}"
            </div>` : ''}
          </div>`).join('') + (svList.length > 10 ? `
          <div id="tv-more-wrap" style="text-align:center;padding:10px 0">
            <button onclick="document.querySelectorAll('.tv-sv-row').forEach(el=>el.style.display='block');document.getElementById('tv-more-wrap').style.display='none'"
              style="padding:7px 20px;border-radius:8px;border:1.5px solid #00008B;background:#00008B;color:#fff;font-size:12px;font-weight:700;cursor:pointer">
              ▼ Xem thêm ${svList.length - 10} sinh viên
            </button>
          </div>` : '')
        : '<div style="color:#94a3b8;font-size:13px;padding:16px 0;text-align:center">Chưa có phản hồi nào</div>'}
      </div>
    </div>`;
  document.getElementById('rpt-charts-grid').appendChild(svCard);

  // ── Vẽ chart — dùng mkChart như gốc ──────────────────────
  // Helper hiện modal danh sách người lọc theo giáo viên này
  function _tvPeopleModal(title, filterFn) {
    const people = svList.filter(filterFn);
    _showPeopleModal(title, ` · ${esc(tv.giao_vien)}`, people);
  }

  setTimeout(() => {
    // Biểu đồ cột sao — click để xem ai đánh giá sao đó
    const starData  = [starDist[1],starDist[2],starDist[3],starDist[4],starDist[5]];
    const starTotal = starData.reduce((s,v)=>s+v,0) || 1;
    const ratingEl  = document.getElementById('tv-rating');
    if (ratingEl) {
      ratingEl.style.cursor = 'pointer';
      ratingEl.title = 'Bấm vào cột để xem danh sách người đánh giá';
    }
    mkChart('tv-rating', {
      type: 'bar',
      data: {
        labels: ['1★','2★','3★','4★','5★'],
        datasets: [{
          data: starData,
          backgroundColor: [1,2,3,4,5].map((s=>['#ef4444','#fb923c','#00008B','#00008B','#00008B'][s-1]||'#94a3b8')),
          borderRadius:0,
          borderSkipped: false,
        }]
      },
      options: { ...rAF,
        plugins: {
          ...noLegend,
          tooltip: { callbacks: { label: ctx => `${ctx.raw} người (${Math.round(ctx.raw/starTotal*100)}%) — Bấm để xem` } }
        },
        scales: { x: { ...noGrid, ticks: { font: { size: 12 } } }, y: { ...softGrid, beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } } },
        onClick(_, elements) {
          if (!elements.length) return;
          const sao = elements[0].index + 1;
          _tvPeopleModal(`Người đánh giá ${sao}★`, r => parseInt(r.danh_gia) === sao);
        },
      }
    });

    // Biểu đồ donut cảm xúc — click để xem ai tích cực / tiêu cực
    const sentTotal = tv.so_phan_hoi || 1;
    const sentEl = document.getElementById('tv-sentiment');
    if (sentEl) {
      sentEl.style.cursor = 'pointer';
      sentEl.title = 'Bấm vào phần để xem danh sách người';
    }
    mkChart('tv-sentiment', {
      type: 'doughnut',
      data: {
        labels: ['Tích cực','Tiêu cực'],
        datasets: [{
          data: [pos, neg],
          backgroundColor: [BLUE, RED],
          borderWidth: 3, borderColor: '#fff', hoverOffset: 6,
        }]
      },
      options: { ...rAF, cutout: '65%', plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10, padding: 10,
          generateLabels: chart => chart.data.labels.map((l,i) => ({
            text: `${l}  ${Math.round([pos,neg][i]/sentTotal*100)}%`,
            fillStyle: [BLUE,RED][i], strokeStyle: 'transparent', index: i,
          }))
        }},
        tooltip: { callbacks: { label: ctx => `${ctx.raw} người (${Math.round(ctx.raw/sentTotal*100)}%) — Bấm để xem` } }
      },
      onClick(_, elements) {
        if (!elements.length) return;
        const idx = elements[0].index; // 0=tích cực, 1=tiêu cực
        const label = ['Tích cực','Tiêu cực'][idx];
        const cx    = ['positive','negative'][idx];
        _tvPeopleModal(`${label}`, r => r.cam_xuc === cx);
      }},
      plugins: [{
        id: 'tv-center',
        afterDraw(chart) {
          const { ctx: c, chartArea: { width, height, left, top } } = chart;
          c.save();
          const cx = left + width/2, cy = top + height/2 - 12;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.font = 'bold 26px sans-serif'; c.fillStyle = '#0f172a'; c.fillText(sentTotal, cx, cy);
          c.font = '11px sans-serif'; c.fillStyle = '#94a3b8'; c.fillText('phản hồi', cx, cy + 20);
          c.restore();
        }
      }]
    });

    // Gắn hint "có thể click" vào tiêu đề card
    ['tv-rating','tv-sentiment'].forEach(id => {
      const slot = document.getElementById('slot-' + id);
      if (!slot) return;
      const titleEl = slot.querySelector('.dash-card-title');
      if (titleEl && !titleEl.querySelector('.click-hint')) {
        const hint = document.createElement('span');
        hint.className = 'click-hint';
        hint.style.cssText = 'font-size:10px;font-weight:500;color:#94a3b8;margin-left:6px;vertical-align:middle';
        hint.textContent = '(bấm để xem)';
        titleEl.appendChild(hint);
      }
    });
  }, 100);
}

// ─────────────────────────────────────────────────────────────
//  RENDER FORM LIST (DB forms + Excel imports)
// ─────────────────────────────────────────────────────────────
function renderFormListWithImports(dbForms) {
  const el = document.getElementById('rpt-form-list');
  if (!el) return;

  // Nếu không truyền dbForms, dùng cache
  if (dbForms !== undefined) window._cachedDbForms = dbForms;
  let db = Array.isArray(window._cachedDbForms) ? window._cachedDbForms : [];

  const categoryFilter = document.getElementById('rpt-form-category-filter')?.value;
  if (categoryFilter) {
    db = db.filter(f => f.danh_muc === categoryFilter);
  }

  const searchFilter = document.getElementById('rpt-form-search-filter')?.value.toLowerCase().trim();
  if (searchFilter) {
    db = db.filter(f => (f.ten_form || f.name || '').toLowerCase().includes(searchFilter));
  }

  const catColor = { 'Ngoại ngữ': '#f97316', 'Tin học': '#00008B' };

  if (db.length === 0 && importedForms.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:28px;color:#94a3b8;font-size:13px">Không tìm thấy biểu mẫu nào</div>';
    return;
  }

  // Phần DB forms
  const dbHtml = db.map(f => {
    const formId = Number(f.id) || 0;
    const formName = f.ten_form || f.name || 'Chưa có tên';
    const category = f.danh_muc || 'Chưa phân loại';
    const questionCount = f.so_cau_hoi ?? f.tong_cau_hoi ?? '-';
    const feedbackCount = Number(f.so_phan_hoi ?? f.feedback_count ?? 0);
    const c = catColor[category] || '#64748b';
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1.5px solid transparent;transition:all .15s;cursor:pointer;margin-bottom:4px;"
      onmouseenter="this.style.background='var(--gray-100)';this.style.borderColor='var(--gray-200)';this.querySelector('.rpt-del-btn').style.opacity='1'"
      onmouseleave="this.style.background='';this.style.borderColor='transparent';this.querySelector('.rpt-del-btn').style.opacity='0'"
      onclick="loadFormAnalysis(${formId},'${escJs(formName)}')">
      <div style="width:38px;height:38px;border-radius:10px;background:${c}15;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" width="17" height="17"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(formName)}</div>
        <div style="font-size:11.5px;color:#94a3b8;margin-top:2px">${esc(category)} · ${questionCount} câu hỏi</div>
      </div>
      <div style="text-align:right;flex-shrink:0;margin-right:4px">
        <div style="font-size:20px;font-weight:800;color:${c};line-height:1">${feedbackCount}</div>
        <div style="font-size:10px;color:#94a3b8">phản hồi</div>
      </div>
      <button class="rpt-del-btn" onclick="event.stopPropagation();rptDeleteForm(${formId},'${escJs(formName)}')"
        title="Chuyển vào thùng rác"
        style="opacity:0;width:30px;height:30px;border:1px solid #fecaca;border-radius:8px;background:var(--gray-50);cursor:pointer;color:#ef4444;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s"
        onmouseenter="this.style.background='#fef2f2';this.style.borderColor='#f87171'"
        onmouseleave="this.style.background='var(--gray-50)';this.style.borderColor='#fecaca'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>`;
  }).join('');

  // Phần Excel imports
  const importHtml = importedForms.map(f => {
    return `
    <div onclick="loadImportedExcel('${f.id}')"
      style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;border:1.5px solid transparent;transition:all .15s;position:relative"
      onmouseenter="this.style.background='#f0fdf4';this.style.borderColor='#bbf7d0'"
      onmouseleave="this.style.background='';this.style.borderColor='transparent'">
      <div style="width:38px;height:38px;border-radius:10px;background:#dcfce7;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" width="17" height="17"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:5px">
          <div style="font-size:13px;font-weight:600;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.tenForm)}</div>
          <span style="flex-shrink:0;font-size:9px;font-weight:700;background:#dcfce7;color:#059669;border:1px solid #bbf7d0;border-radius:4px;padding:1px 5px">EXCEL</span>
        </div>
        <div style="font-size:11.5px;color:#94a3b8;margin-top:2px">${f.headers.length} cột dữ liệu</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:20px;font-weight:800;color:#059669;line-height:1">${f.soRow}</div>
        <div style="font-size:10px;color:#94a3b8">phản hồi</div>
      </div>
      <button onclick="event.stopPropagation();removeImportedForm('${f.id}')"
        style="position:absolute;top:6px;right:6px;width:20px;height:20px;border-radius:5px;border:none;background:transparent;cursor:pointer;color:#94a3b8;font-size:13px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s"
        onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#94a3b8'"
        class="import-remove-btn">✕</button>
    </div>`;
  }).join('');

  // Separator nếu có cả 2
  let separator = '';
  if (db.length && importedForms.length) {
    separator = `<div style="margin:4px 0;height:1px;background:#f1f5f9"></div>
    <div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:.7px;text-transform:uppercase;padding:2px 12px 4px">📂 File đã import</div>`;
  } else if (!db.length && importedForms.length) {
    separator = `<div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:.7px;text-transform:uppercase;padding:2px 12px 6px">📂 File đã import</div>`;
  }

  el.innerHTML = dbHtml + separator + importHtml;

  // Hover show remove btn
  el.querySelectorAll('[class*="import-remove-btn"]').forEach(btn => {
    const row = btn.closest('[onclick^="loadImportedExcel"]');
    if (row) {
      row.addEventListener('mouseenter', () => btn.style.opacity = '1');
      row.addEventListener('mouseleave', () => btn.style.opacity = '0');
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  MODAL XEM TẤT CẢ FORMS
// ─────────────────────────────────────────────────────────────
window.openAllFormsModal = function() {
  let modal = document.getElementById('rpt-all-forms-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rpt-all-forms-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:90%;max-width:550px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);transform:scale(0.95);transition:transform 0.2s;">
        <div style="padding:20px 24px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:18px;font-weight:800;color:var(--gray-900);">Tất cả biểu mẫu</div>
            <div style="font-size:13px;color:#64748b;margin-top:2px;">Quản lý và lọc tìm biểu mẫu</div>
          </div>
          <button onclick="document.getElementById('rpt-all-forms-modal').style.opacity='0';document.getElementById('rpt-all-forms-modal').children[0].style.transform='scale(0.95)';setTimeout(()=>document.getElementById('rpt-all-forms-modal').style.display='none',200)" style="width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748b;" onmouseenter="this.style.background='#e2e8f0'" onmouseleave="this.style.background='#f1f5f9'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div style="padding:16px 24px;background:#f8fafc;border-bottom:1px solid #f1f5f9;display:flex;gap:12px;">
          <input type="text" id="rpt-modal-search" oninput="window.renderModalFormList()" placeholder="Tìm kiếm biểu mẫu..." style="flex:1;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:14px;outline:none;">
          <select id="rpt-modal-category" onchange="window.renderModalFormList()" style="padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:14px;outline:none;background:#fff;cursor:pointer;">
            <option value="">Tất cả danh mục</option>
            <option value="Tin học">Tin học</option>
            <option value="Ngoại ngữ">Ngoại ngữ</option>
          </select>
        </div>
        <div id="rpt-modal-form-list" style="flex:1;overflow-y:auto;padding:16px 24px;display:flex;flex-direction:column;gap:8px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('rpt-modal-search').value = '';
  document.getElementById('rpt-modal-category').value = '';
  window.renderModalFormList();
  
  modal.style.display = 'flex';
  // Trigger reflow
  modal.offsetHeight;
  modal.style.opacity = '1';
  modal.children[0].style.transform = 'scale(1)';
};

window.renderModalFormList = function() {
  const el = document.getElementById('rpt-modal-form-list');
  if (!el) return;
  
  let db = Array.isArray(window._cachedDbForms) ? window._cachedDbForms : [];
  const searchFilter = document.getElementById('rpt-modal-search').value.toLowerCase().trim();
  const categoryFilter = document.getElementById('rpt-modal-category').value;
  
  if (categoryFilter) db = db.filter(f => f.danh_muc === categoryFilter);
  if (searchFilter) db = db.filter(f => (f.ten_form || f.name || '').toLowerCase().includes(searchFilter));
  
  if (db.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:14px;">Không tìm thấy biểu mẫu nào khớp với tìm kiếm của bạn.</div>';
    return;
  }
  
  const catColor = { 'Ngoại ngữ': '#f97316', 'Tin học': '#00008B' };
  
  const html = db.map(f => {
    const formId = Number(f.id) || 0;
    const formName = f.ten_form || f.name || 'Chưa có tên';
    const category = f.danh_muc || 'Chưa phân loại';
    const questionCount = f.so_cau_hoi ?? f.tong_cau_hoi ?? '-';
    const feedbackCount = Number(f.so_phan_hoi ?? f.feedback_count ?? 0);
    const c = catColor[category] || '#64748b';
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;transition:all .15s;cursor:pointer;"
      onmouseenter="this.style.background='#f8fafc';this.style.borderColor='#cbd5e1';this.querySelector('.rpt-del-btn').style.opacity='1'"
      onmouseleave="this.style.background='#fff';this.style.borderColor='#e2e8f0';this.querySelector('.rpt-del-btn').style.opacity='0'"
      onclick="document.getElementById('rpt-all-forms-modal').style.display='none';loadFormAnalysis(${formId},'${escJs(formName)}')">
      <div style="width:42px;height:42px;border-radius:10px;background:${c}15;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" width="20" height="20"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(formName)}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">${esc(category)} · ${questionCount} câu hỏi</div>
      </div>
      <div style="text-align:right;flex-shrink:0;margin-right:8px">
        <div style="font-size:20px;font-weight:800;color:${c};line-height:1">${feedbackCount}</div>
        <div style="font-size:11px;color:#94a3b8">phản hồi</div>
      </div>
      <button class="rpt-del-btn" onclick="event.stopPropagation();rptDeleteForm(${formId},'${escJs(formName)}')"
        title="Chuyển vào thùng rác"
        style="opacity:0;width:32px;height:32px;border:1px solid #fecaca;border-radius:8px;background:#fef2f2;cursor:pointer;color:#ef4444;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s"
        onmouseenter="this.style.background='#fee2e2';this.style.borderColor='#f87171'"
        onmouseleave="this.style.background='#fef2f2';this.style.borderColor='#fecaca'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>`;
  }).join('');
  el.innerHTML = html;
};

window.setRptCategory = function(cat, btn) {
  const input = document.getElementById('rpt-form-category-filter');
  
  // Nếu click vào nhãn đang active -> Hủy chọn (hiển thị tất cả)
  if (input.value === cat) {
    input.value = '';
    btn.style.background = '#fff';
    btn.style.color = '#64748b';
    btn.style.borderColor = '#e2e8f0';
    btn.style.fontWeight = '600';
    renderFormListWithImports();
    return;
  }
  
  // Set value mới
  input.value = cat;
  
  // Reset all pills
  document.querySelectorAll('.rpt-cat-pill').forEach(el => {
    el.style.background = '#fff';
    el.style.color = '#64748b';
    el.style.borderColor = '#e2e8f0';
    el.style.fontWeight = '600';
  });
  
  // Set active pill (Soft Badge Style)
  if (cat === 'Tin học') {
    btn.style.background = '#eff6ff';
    btn.style.color = '#00008B';
    btn.style.borderColor = '#bfdbfe';
  } else if (cat === 'Ngoại ngữ') {
    btn.style.background = '#fff7ed';
    btn.style.color = '#ea580c';
    btn.style.borderColor = '#fed7aa';
  }
  btn.style.fontWeight = '700';
  
  // Trigger filter
  renderFormListWithImports();
};

function loadImportedExcel(id) {
  const f = importedForms.find(x => x.id === id);
  if (!f) return;
  csvData       = f.csvDataSnapshot;
  analysisData  = null;
  activeSource  = 'csv';
  currentFormId = null;
  showDashboard(f.tenForm, `${f.soRow} phản hồi`);
  renderKPIsFromCSV();
  renderDefaultChartsCSV();
}

function setReportBadge(text) {
  const oldBadge = document.getElementById('rpt-dash-badge');
  const topBadge = document.getElementById('rpt-dash-badge-top');
  if (oldBadge) oldBadge.textContent = text || '';
  if (topBadge) topBadge.textContent = text || '';
}

function renderReportFormFilterOptions() {
  const select = document.getElementById('rpt-form-filter');
  if (!select) return;
  const db = Array.isArray(window._cachedDbForms) ? window._cachedDbForms : [];
  const dbOptions = db.map(f => {
    const id = f.id ?? f.form_id;
    const name = f.ten_form || f.name || f.tenForm || 'Biểu mẫu';
    return `<option value="form:${esc(id)}">${esc(name)}</option>`;
  }).join('');
  const importOptions = importedForms.map(f =>
    `<option value="import:${esc(f.id)}">${esc(f.tenForm)} (Excel)</option>`
  ).join('');
  const importGroup = importOptions ? `<option disabled>──── File Excel đã import ────</option>${importOptions}` : '';
  select.innerHTML = `<option value="">Biểu mẫu hiện tại</option>${dbOptions}${importGroup}`;
  if (activeSource === 'form' && currentFormId != null) select.value = `form:${currentFormId}`;
  const activeImport = activeSource === 'csv' && csvData
    ? importedForms.find(f => f.csvDataSnapshot === csvData)
    : null;
  if (activeImport) select.value = `import:${activeImport.id}`;
}

function switchReportFormFromFilter(value) {
  if (!value) return;
  if (value.startsWith('import:')) {
    loadImportedExcel(value.slice(7));
    return;
  }
  if (value.startsWith('form:')) {
    const id = value.slice(5);
    const form = (window._cachedDbForms || []).find(f => String(f.id ?? f.form_id) === String(id));
    loadFormAnalysis(id, form?.ten_form || form?.name || form?.tenForm || 'Biểu mẫu');
  }
}

function removeImportedForm(id) {
  importedForms = importedForms.filter(f => f.id !== id);
  renderFormListWithImports();
  renderReportFormFilterOptions();
}

async function fetchReportJson(url, token) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  let data = null;
  try { data = await res.json(); } catch(e) {}
  if (!res.ok) {
    const detail = data?.error ? `${data.message || `HTTP ${res.status}`}: ${data.error}` : (data?.message || `HTTP ${res.status}`);
    throw new Error(detail);
  }
  return data;
}

async function loadReportFormListFallback(token) {
  const forms = await fetchReportJson(`${API}/forms`, token);
  return (Array.isArray(forms) ? forms : [])
    .filter(f => Number(f.so_phan_hoi || 0) > 0)
    .map(f => ({
      id: f.id,
      ten_form: f.ten_form || f.name,
      danh_muc: f.danh_muc,
      trang_thai: f.trang_thai,
      so_phan_hoi: Number(f.so_phan_hoi || 0),
      so_cau_hoi: f.so_cau_hoi ?? f.tong_cau_hoi ?? '-',
      diem_tb: f.diem_tb ?? null,
      phan_hoi_moi_nhat: f.phan_hoi_moi_nhat || null
    }))
    .sort((a, b) => Number(b.so_phan_hoi || 0) - Number(a.so_phan_hoi || 0));
}

function renderReportListError(message) {
  const el = document.getElementById('rpt-form-list');
  if (!el) return;
  el.innerHTML = `
    <div style="text-align:center;padding:24px;color:#64748b;font-size:12.5px;line-height:1.6">
      <div style="font-weight:700;color:var(--gray-900);margin-bottom:4px">Chưa tải được dữ liệu báo cáo</div>
      <div>${esc(message || 'Kiểm tra backend và quyền xem báo cáo của tài khoản hiện tại.')}</div>
    </div>`;
}

function reportDateKey(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function avgNumber(values) {
  const nums = (values || []).map(Number).filter(v => !Number.isNaN(v));
  return nums.length ? nums.reduce((sum, v) => sum + v, 0) / nums.length : null;
}

function reportQuestionType(type) {
  const t = String(type || '').toLowerCase();
  if (['multiple_choice', 'single_choice', 'radio', 'trac_nghiem'].includes(t)) return 'choice';
  if (['star_rating', 'stars', 'rate'].includes(t)) return 'rating';
  if (['linear_scale', 'thang_diem'].includes(t)) return 'scale';
  if (['file_upload', 'upload_file'].includes(t)) return 'upload';
  if (['short_text', 'textarea', 'long_text'].includes(t)) return t === 'textarea' || t === 'long_text' ? 'paragraph' : 'text';
  return t || 'text';
}

async function fetchFeedbackDetailsForReport(feedbacks, token) {
  const rows = await Promise.all((feedbacks || []).map(async fb => {
    try {
      const details = await fetchReportJson(`${API}/feedback/${fb.id}/chitiet`, token);
      return (Array.isArray(details) ? details : []).map(detail => ({ ...detail, _feedback: fb }));
    } catch(e) {
      return [];
    }
  }));
  return rows.flat();
}

function buildReportAnalysisFallback(form, feedbacks, details) {
  const questions = (form.cau_hoi || form.questions || [])
    .filter(q => q && q.id && reportQuestionType(q.loai || q.type) !== 'section')
    .map((q, idx) => ({
      id: q.id,
      noi_dung: q.noi_dung || q.title || q.question || '',
      loai: reportQuestionType(q.loai || q.type),
      thu_tu: q.thu_tu || idx + 1,
      bat_buoc: q.bat_buoc || q.required || false,
      lua_chon: q.lua_chon || q.options || [],
      hang_grid: q.hang_grid || q.hang,
      cot_grid: q.cot_grid || q.cot
    }));

  const feedbackList = Array.isArray(feedbacks) ? feedbacks : [];
  const cachedForm = (window._cachedDbForms || []).find(item => Number(item.id) === Number(form.id)) || {};
  const fallbackFeedbackCount = Number(form.so_phan_hoi ?? cachedForm.so_phan_hoi ?? cachedForm.feedback_count ?? 0);
  const totalFeedbackCount = feedbackList.length || fallbackFeedbackCount;
  const ratings = feedbackList.map(r => Number(r.danh_gia)).filter(v => !Number.isNaN(v));
  const dates = feedbackList.map(r => reportDateKey(r.ngay_gui)).filter(Boolean).sort();
  const countMap = (items, keyFn) => {
    const map = {};
    items.forEach(item => {
      const key = keyFn(item);
      if (key !== null && key !== undefined && String(key) !== '') map[key] = (map[key] || 0) + 1;
    });
    return map;
  };

  const ratingMap = countMap(feedbackList, r => {
    const n = Number(r.danh_gia);
    return Number.isNaN(n) ? '' : n;
  });
  const timelineMap = countMap(feedbackList, r => reportDateKey(r.ngay_gui));
  const statusMap = countMap(feedbackList, r => r.trang_thai || 'new');

  const detailList = Array.isArray(details) ? details : [];
  const choiceStats = [];
  questions
    .filter(q => ['choice', 'checkbox', 'dropdown'].includes(q.loai))
    .forEach(q => {
      const optionNames = (q.lua_chon || [])
        .map(opt => typeof opt === 'string' ? opt : opt?.noi_dung)
        .filter(Boolean);
      const optionMap = {};
      optionNames.forEach(name => { optionMap[name] = 0; });
      detailList
        .filter(d => Number(d.cau_hoi_id) === Number(q.id) && (d.ten_lua_chon || d.lua_chon_text))
        .forEach(d => {
          const name = d.ten_lua_chon || d.lua_chon_text;
          optionMap[name] = (optionMap[name] || 0) + 1;
        });
      Object.entries(optionMap).forEach(([lua_chon, so_chon]) => {
        choiceStats.push({ cau_hoi_id: q.id, lua_chon, so_chon });
      });
    });

  const ratingDistByQ = [];
  const ratingStats = questions.filter(q => q.loai === 'rating').map(q => {
    const vals = detailList
      .filter(d => Number(d.cau_hoi_id) === Number(q.id) && d.diem_danh_gia != null)
      .map(d => Number(d.diem_danh_gia))
      .filter(v => !Number.isNaN(v));
    [1,2,3,4,5].forEach(sao => {
      const so_luong = vals.filter(v => v === sao).length;
      if (so_luong) ratingDistByQ.push({ cau_hoi_id: q.id, sao, so_luong });
    });
    return {
      cau_hoi_id: q.id,
      diem_tb: avgNumber(vals),
      so_tra_loi: vals.length,
      min_diem: vals.length ? Math.min(...vals) : null,
      max_diem: vals.length ? Math.max(...vals) : null
    };
  }).filter(r => r.so_tra_loi > 0);

  const textStats = detailList
    .filter(d => (d.noi_dung_tra_loi || d.noi_dung || '').trim().length > 2)
    .map(d => ({
      cau_hoi_id: d.cau_hoi_id,
      noi_dung: d.noi_dung_tra_loi || d.noi_dung || '',
      ho_ten: d._feedback?.ho_ten || '',
      lop: d._feedback?.lop || '',
      khoa: d._feedback?.khoa || '',
      giao_vien: d._feedback?.giao_vien || '',
      danh_gia: d._feedback?.danh_gia || null,
      cam_xuc: d._feedback?.cam_xuc || ''
    }));

  return {
    form: {
      id: form.id,
      ten_form: form.ten_form || form.name || '',
      danh_muc: form.danh_muc || '',
      mo_ta: form.mo_ta || '',
      trang_thai: form.trang_thai || '',
      luot_xem: form.luot_xem || 0,
      so_phan_hoi: totalFeedbackCount,
      diem_tb: avgNumber(ratings),
      ngay_dau: dates[0] || null,
      ngay_cuoi: dates[dates.length - 1] || null,
      tich_cuc: feedbackList.filter(r => r.cam_xuc === 'positive').length,
      trung_tinh: feedbackList.filter(r => r.cam_xuc === 'neutral').length,
      tieu_cuc: feedbackList.filter(r => r.cam_xuc === 'negative').length
    },
    rating_dist: Object.entries(ratingMap).map(([sao, so_luong]) => ({ sao: Number(sao), so_luong })).sort((a,b) => a.sao - b.sao),
    rating_dist_by_q: ratingDistByQ,
    timeline: Object.entries(timelineMap).map(([ngay, so_luong]) => ({ ngay, so_luong })).sort((a,b) => a.ngay.localeCompare(b.ngay)),
    questions,
    choice_stats: choiceStats,
    rating_stats: ratingStats,
    status_dist: Object.entries(statusMap).map(([trang_thai, so_luong]) => ({ trang_thai, so_luong })),
    text_stats: textStats
  };
}

async function loadFormAnalysisFallback(formId, token) {
  const form = await fetchReportJson(`${API}/forms/${formId}`, token);
  let feedbackList = [];
  try {
    const feedbacks = await fetchReportJson(`${API}/feedback?form_id=${formId}`, token);
    feedbackList = Array.isArray(feedbacks) ? feedbacks : [];
  } catch(e) {
    feedbackList = [];
  }
  const details = feedbackList.length ? await fetchFeedbackDetailsForReport(feedbackList, token) : [];
  return {
    data: buildReportAnalysisFallback(form, feedbackList, details),
    rows: await enrichRowsWithClassQuestion(formId, feedbackList)
  };
}

function activateReportAnalysis(formId, formName, data, rows) {
  if (!history.state || history.state.view !== 'detail') {
    history.pushState({ view: 'detail', formId: formId }, '', '#detail');
  }
  analysisData = data;
  csvData = null;
  activeSource = 'form';
  currentFormId = formId;
  activeFilters = {};
  allFields = buildFieldsFromForm(data);
  data._origChoiceStats = JSON.parse(JSON.stringify(data.choice_stats || []));
  data._origRatingStats = JSON.parse(JSON.stringify(data.rating_stats || []));
  showDashboard(formName, `${data.form.so_phan_hoi} phản hồi`);
  rawRows = rows && rows.length ? rows : buildRawRowsFromAnalysis(data);
  activeReportRows = rawRows.slice();
  baseAnalysisData = JSON.parse(JSON.stringify({
    form: data.form || {},
    questions: data.questions || [],
    choice_stats: data.choice_stats || [],
    rating_stats: data.rating_stats || [],
    rating_dist: data.rating_dist || [],
    rating_dist_by_q: data.rating_dist_by_q || [],
    timeline: data.timeline || [],
    status_dist: data.status_dist || [],
    text_stats: data.text_stats || []
  }));
  renderReportFormContext();
  renderDynamicReportFilters();
  renderKPIs();
  renderDefaultCharts();
  populateTeacherDropdown();
  populateDepartmentDropdown();
}

// ─────────────────────────────────────────────────────────────
//  LOAD FORM LIST
// ─────────────────────────────────────────────────────────────
async function loadFormList() {
  const token = localStorage.getItem('token') || '';
  try {
    const list = await fetchReportJson(`${API}/reports/forms-with-data`, token);
    if (!Array.isArray(list)) throw new Error(list?.message || 'Dữ liệu báo cáo không hợp lệ');
    renderFormListWithImports(list);
  } catch(e) {
    try {
      const fallbackList = await loadReportFormListFallback(token);
      renderFormListWithImports(fallbackList);
      if (fallbackList.length && typeof showToast === 'function') {
        showToast('Đã tải danh sách form bằng dữ liệu dự phòng', 'default');
      }
    } catch(fallbackError) {
      if (importedForms.length) {
        renderFormListWithImports([]);
      } else {
        renderReportListError(fallbackError.message || e.message);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  LOAD FORM ANALYSIS
// ─────────────────────────────────────────────────────────────
async function loadFormAnalysis(formId, formName) {
  showToast('Đang tải dữ liệu...','default');
  const token = localStorage.getItem('token') || '';
  try {
    const data = await fetchReportJson(`${API}/reports/form-analysis/${formId}`, token);
    if(!data.form) throw new Error(data?.message || 'Không tìm thấy dữ liệu');
    // Ưu tiên rows thô trả từ API phân tích để lọc đúng theo từng câu hỏi.
    let rows = Array.isArray(data.responses) ? data.responses : [];
    try {
      if (!rows.length) {
        rows = await fetchReportJson(`${API}/feedback?form_id=${formId}`, token);
        rows = await enrichRowsWithClassQuestion(formId, rows);
      }
    } catch(e) {
      rows = buildRawRowsFromAnalysis(data);
    }
    activateReportAnalysis(formId, formName, data, rows);
    showToast('Tải xong ✅','success');
  } catch(e) {
    try {
      const fallback = await loadFormAnalysisFallback(formId, token);
      activateReportAnalysis(formId, formName, fallback.data, fallback.rows);
      showToast('Đã tải báo cáo bằng dữ liệu dự phòng','success');
    } catch(fallbackError) {
      showToast('Lỗi: ' + (fallbackError.message || e.message), 'error');
    }
  }
}

function buildFieldsFromForm(data) {
  const f=[
    {key:'ngay_gui',label:'Ngày gửi',type:'date'},
    {key:'ho_ten',label:'Họ tên',type:'text'},
    {key:'email',label:'Email',type:'text'},
    {key:'danh_gia',label:'Đánh giá ★',type:'rating'},
    {key:'cam_xuc',label:'Cảm xúc',type:'choice'},
    {key:'trang_thai',label:'Trạng thái',type:'choice'},
  ];
  data.questions.forEach(q=>f.push({key:`q_${q.id}`,label:q.noi_dung.length>45?q.noi_dung.slice(0,43)+'…':q.noi_dung,type:q.loai,qId:q.id}));
  return f;
}

function normalizeReportDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function normalizeReportText(value) {
  return String(value ?? '').trim();
}

function getReportQuestionOptions(q) {
  return (q?.lua_chon || q?.opts || [])
    .map(opt => typeof opt === 'string' ? opt : (opt?.noi_dung || opt?.label || opt?.text || ''))
    .map(normalizeReportText)
    .filter(Boolean);
}

function splitReportAnswer(value) {
  const text = normalizeReportText(value);
  if (!text) return [];
  return text.split(/\s*;\s*|\s*,\s*|\n+/).map(v => v.trim()).filter(Boolean);
}

function getReportRowAnswer(row, q) {
  return row?.['q_' + q.id] ?? row?.[q.id] ?? row?.[q.noi_dung] ?? '';
}

function inferReportFilterLabel(q) {
  if (!q?.noi_dung) return null;
  const text = String(q.noi_dung).toLowerCase();
  
  // Phân loại nhóm đánh giá / mức độ hài lòng
  if (text.includes('hài lòng') || text.includes('đánh giá') || text.includes('chất lượng') || text.includes('dễ hiểu') || text.includes('nhiệt tình')) {
    if (text.includes('giảng viên') || text.includes('thầy') || text.includes('cô')) return 'Đánh giá giảng viên';
    if (text.includes('cơ sở') || text.includes('phòng') || text.includes('nhiệt độ')) return 'Đánh giá CSVC';
    if (text.includes('khóa') || text.includes('môn')) return 'Đánh giá khóa học';
    return 'Độ hài lòng / Đánh giá';
  }
  
  // Phân loại nhóm thực thể (Entity)
  if (text.includes('giảng viên') || text.includes('giao vien') || text.includes('thầy') || text.includes('cô ')) return 'Giảng viên';
  if (text.includes('cơ sở vật chất') || text.includes('phòng học') || text.includes('thiết bị')) return 'CSVC / Phòng học';
  if (text.includes('khóa học') || text.includes('khoa hoc') || text.includes('môn ')) return 'Khóa học / Môn học';
  if (/(^|\s)(khoa|ngành|nganh)(\s|$)/.test(text)) return 'Khoa / Ngành';
  if (/(^|\s)(lớp|lop)(\s|$)/.test(text)) return 'Lớp';
  if (text.includes('trình độ') || text.includes('level')) return 'Trình độ';
  
  // Nếu câu hỏi ngắn (dưới 25 ký tự), có thể giữ nguyên làm label
  if (q.noi_dung.length <= 25) return q.noi_dung;

  return null; // Không phải câu hỏi quan trọng để lọc
}

function isReportQuestionFilterable(q) {
  // Chỉ hiện những câu hỏi "quan trọng" đã được rút gọn label
  const label = inferReportFilterLabel(q);
  if (!label) return false;

  const type = reportQuestionType(q?.loai || q?.type);
  const options = getReportQuestionOptions(q);
  if (['choice', 'dropdown', 'checkbox'].includes(type)) return options.length > 0 && options.length <= 20;
  if (['rating', 'scale', 'star_rating'].includes(type)) return true;
  return false;
}

function renderReportFormContext() {
  const el = document.getElementById('rpt-form-info-card');
  if (el) el.innerHTML = '';
}

function formStatusLabel(status) {
  return ({ draft:'Nháp', pending:'Chờ phê duyệt', active:'Hoạt động', rejected:'Bị từ chối', closed:'Đã đóng', deleted:'Đã xóa' })[status] || status || 'Chưa rõ';
}

function renderDynamicReportFilters() {
  const statusSel = document.getElementById('sf-status-select');
  if (statusSel) {
    const statuses = [...new Set((rawRows || []).map(r => normalizeReportText(r.trang_thai)).filter(Boolean))];
    statusSel.innerHTML = '<option value="">Tất cả</option>' + statuses.map(s => `<option value="${esc(s)}">${esc(responseStatusLabel(s))}</option>`).join('');
  }
  const wrap = document.getElementById('sf-dynamic-filters');
  if (!wrap) return;
  const filters = (analysisData?.questions || []).filter(isReportQuestionFilterable).slice(0, 8);
  wrap.innerHTML = filters.map(q => {
    const type = reportQuestionType(q.loai || q.type);
    const label = inferReportFilterLabel(q);
    const id = 'sf-dyn-' + q.id;
    if (['rating', 'scale', 'star_rating'].includes(type)) {
      return `<div class="report-filter-field"><label title="${esc(label)}">${esc(label)}</label><select id="${id}" data-qid="${esc(q.id)}" data-filter-type="rating" onchange="onSmartSearch()"><option value="">Tất cả điểm</option>${[1,2,3,4,5].map(n => `<option value="${n}">${n} điểm</option>`).join('')}</select></div>`;
    }
    if (['upload', 'file'].includes(type)) {
      return `<div class="report-filter-field"><label title="${esc(label)}">${esc(label)}</label><select id="${id}" data-qid="${esc(q.id)}" data-filter-type="file" onchange="onSmartSearch()"><option value="">Tất cả</option><option value="has">Có file</option><option value="empty">Chưa có file</option></select></div>`;
    }
    const opts = getReportQuestionOptions(q);
    const multiple = type === 'checkbox' ? ' multiple size="1"' : '';
    return `<div class="report-filter-field"><label title="${esc(label)}">${esc(label)}</label><select id="${id}" data-qid="${esc(q.id)}" data-filter-type="${esc(type)}" onchange="onSmartSearch()"${multiple}><option value="">Tất cả</option>${opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select></div>`;
  }).join('');
}

function responseStatusLabel(status) {
  return ({ active:'Hoạt động', deleted:'Đã xóa', new:'Mới', viewed:'Đã xem', archived:'Lưu trữ' })[status] || status || 'Tất cả';
}

// Xây rawRows tổng hợp từ analysisData để smart search lọc được
function buildRawRowsFromAnalysis(data) {
  if (!data) return [];
  if (Array.isArray(data.responses) && data.responses.length) return data.responses;
  const total = data.form.so_phan_hoi || 0;
  const sentiments = [
    ...Array(data.form.tich_cuc   || 0).fill('positive'),
    ...Array(data.form.trung_tinh || 0).fill('neutral'),
    ...Array(data.form.tieu_cuc   || 0).fill('negative'),
  ];
  const ratings = [];
  (data.rating_dist || []).forEach(r => { for (let i=0;i<r.so_luong;i++) ratings.push(r.sao); });
  const dates = [];
  (data.timeline || []).forEach(t => { for (let i=0;i<t.so_luong;i++) dates.push(t.ngay); });
  const rows = [];
  for (let i = 0; i < total; i++) {
    rows.push({
      ho_ten:     '',
      email:      '',
      cam_xuc:    sentiments[i] || 'neutral',
      danh_gia:   ratings[i]    || null,
      ngay_gui:   dates[i]      || new Date().toISOString().slice(0,10),
      trang_thai: 'new',
    });
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  EXCEL IMPORT → chuyển sang Quản lý biểu mẫu
// ─────────────────────────────────────────────────────────────
async function _isRealExcel(file) {
  const buf = await file.slice(0, 4).arrayBuffer();
  const b = new Uint8Array(buf);
  const isPK   = b[0]===0x50 && b[1]===0x4B && b[2]===0x03 && b[3]===0x04; // xlsx
  const isCFBF = b[0]===0xD0 && b[1]===0xCF && b[2]===0x11 && b[3]===0xE0; // xls
  return isPK || isCFBF;
}

async function handleExcelImport(input) {
  const file = input.files[0]; if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls'].includes(ext)) {
    showToast('Chỉ hỗ trợ file .xlsx hoặc .xls','error'); input.value=''; return;
  }
  if (!await _isRealExcel(file)) {
    showToast('File không hợp lệ — vui lòng chọn đúng file Excel','error'); input.value=''; return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('File vượt quá 10 MB','error'); input.value=''; return;
  }

  const badge = document.getElementById('rpt-csv-badge');
  badge.style.display = 'block';
  badge.textContent = '⏳ Đang đọc file...';
  badge.style.cssText += ';background:#00008B;border-color:var(--brand-color);color:#fff';

  try {
    const tenForm = file.name.replace(/\.[^/.]+$/, '').trim() || 'Form import';

    // ── 1. Parse file ở frontend → render biểu đồ ngay ──────────
    badge.textContent = '⏳ Đang đọc file...';
    const buf = await file.arrayBuffer();
    const XLSX_lib = window.XLSX || await _loadSheetJS();
    const wb  = XLSX_lib.read(buf, { type: 'array' });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX_lib.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const rawHeaders = raw[0]?.map(h => String(h || '').trim()).filter(Boolean);
    const rawRows    = raw.slice(1).filter(r => r.some(v => String(v).trim() !== ''));
    if (!rawHeaders?.length || !rawRows.length) {
      showToast('File cần ít nhất 1 dòng tiêu đề + 1 dòng dữ liệu', 'error');
      badge.style.display = 'none'; input.value = ''; return;
    }

    const colTypes = rawHeaders.map((_, ci) => {
      const vals = rawRows.map(r => String(r[ci] ?? '').trim()).filter(Boolean);
      const nums = vals.filter(v => !isNaN(v) && v !== '');
      if (vals.length && nums.length / vals.length > 0.8)
        return Math.max(...nums.map(Number)) <= 10 ? 'rating' : 'number';
      if (vals.length) {
        const commaVals = vals.filter(v => v.includes(','));
        if (commaVals.length > 0) {
          const allOptions = [];
          vals.forEach(v => v.split(',').map(s => s.trim()).filter(Boolean).forEach(opt => allOptions.push(opt)));
          const uniqOptions = new Set(allOptions);
          if (uniqOptions.size <= 30 && uniqOptions.size < vals.length * 1.5) return 'checkbox';
        }
      }
      
      const uniq = new Set(vals);
      if (vals.length && uniq.size <= 15 && uniq.size < vals.length * 0.6) return 'choice';
      
      if (vals.some(v => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(v))) return 'date';
      return 'text';
    });

    csvData      = { headers: rawHeaders, rows: rawRows, colTypes };
    analysisData = null;
    activeSource = 'csv';
    currentFormId = null;

    // ── Thêm form import vào danh sách bên trái ──────────────────
    const importId = 'excel_' + Date.now();
    importedForms = importedForms.filter(f => f.tenForm !== tenForm); // tránh trùng tên
    importedForms.unshift({
      id: importId,
      tenForm,
      soRow: rawRows.length,
      headers: rawHeaders,
      csvDataSnapshot: { headers: rawHeaders, rows: rawRows, colTypes }
    });
    renderFormListWithImports();

    showDashboard(tenForm, `${rawRows.length} phản hồi`);
    renderKPIsFromCSV();
    renderDefaultChartsCSV();

    badge.textContent = `✅ ${tenForm} · ${rawRows.length} phản hồi`;
    badge.style.cssText += ';background:#f0fdf4;border-color:#bbf7d0;color:#16a34a';
    showToast(`Đã tải ${rawRows.length} phản hồi`, 'success');

    // ── 2. Lưu Form + CauHoi vào DB ở background ─────────────────
    const fd    = new FormData();
    fd.append('file', file);
    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/reports/import-excel`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd
    }).then(r => r.json()).then(result => {
      if (result.form_id) {
        currentFormId = result.form_id;
        loadFormList(); // cập nhật danh sách form bên trái
      }
    }).catch(() => {});

  } catch (err) {
    showToast('Lỗi đọc file: ' + err.message, 'error');
    badge.style.display = 'none';
  }
  input.value = '';
}

function _loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload  = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('Không tải được SheetJS'));
    document.head.appendChild(s);
  });
}

// ─────────────────────────────────────────────────────────────
//  SHOW / HIDE DASHBOARD
// ─────────────────────────────────────────────────────────────
function showDashboard(title,badge) {
  document.getElementById('rpt-picker').style.display='none';
  document.getElementById('rpt-dashboard').style.display='block';
  document.getElementById('rpt-dash-title').textContent=title;
  setReportBadge(badge);
  document.getElementById('rpt-charts-grid').innerHTML='';
  document.getElementById('rpt-kpi-row').innerHTML='';
  // Hiện nút AI khi vào dashboard
  const aiBtn = document.getElementById('btn-ai-analyze');
  if (aiBtn) aiBtn.style.display = 'flex';
  renderReportFormFilterOptions();
}

async function viewFormFromReport() {
  const title = document.getElementById('rpt-dash-title')?.textContent || 'Biểu mẫu';
  const formInfo = analysisData?.form || {};
  const cat = formInfo.danh_muc || '';
  const created = formInfo.ngay_tao ? new Date(formInfo.ngay_tao).toLocaleDateString('vi-VN') : '';

  // helpers
  const rEsc = v => String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const rNorm = t => { if(t==='text'||t==='short_text'||t==='long_text') return 'paragraph'; if(t==='star_rating') return 'rating'; return t||'choice'; };
  const rLabel = t => ({choice:'Trắc nghiệm',checkbox:'Hộp kiểm',dropdown:'Thả xuống',paragraph:'Đoạn văn',rating:'Xếp hạng',scale:'Tuyến tính',grid_radio:'Lưới trắc nghiệm',grid_checkbox:'Lưới hộp kiểm'}[rNorm(t)] || t || 'Khác');
  const rOpts = (opts, kind) => `<div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:var(--gray-50)">
    ${opts.map(o=>`<label style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:var(--gray-700);cursor:default">
      <span style="width:16px;height:16px;border:1.8px solid #9ca3af;border-radius:${kind==='checkbox'?'4px':'50%'};display:inline-block;flex-shrink:0;background:var(--gray-50)"></span>
      ${rEsc(o)}</label>`).join('')}</div>`;
  const rQ = (q, idx) => {
    const n = rNorm(q.type||q.loai);
    const opts = Array.isArray(q.opts) ? q.opts : Array.isArray(q.lua_chon) ? q.lua_chon.map(o=>typeof o==='string'?o:(o.noi_dung||'')) : [];
    const req = q.required || q.bat_buoc;
    let ans = '';
    if (n==='paragraph') ans = `<textarea disabled rows="3" placeholder="Nhập câu trả lời..." style="width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#94a3b8;background:#f8fafc;resize:none;outline:none;box-sizing:border-box;margin-top:10px"></textarea>`;
    else if (n==='dropdown') ans = `<select disabled style="margin-top:10px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#64748b;background:#f8fafc;outline:none;min-width:220px"><option>Chọn một mục...</option>${opts.map(o=>`<option>${rEsc(o)}</option>`).join('')}</select>`;
    else if (opts.length) ans = rOpts(opts, n==='checkbox'?'checkbox':'radio');
    return `<div style="border:1px solid #00008B;border-radius:18px;padding:18px 20px;background:rgba(255,255,255,.95);box-shadow:0 6px 18px rgba(0,0,139,.07)">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="width:34px;height:34px;border-radius:50%;background:#00008B;color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">${idx+1}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <span style="padding:5px 10px;border-radius:999px;background:#00008B;color:#fff;font-size:11.5px;font-weight:700">${rLabel(q.type||q.loai)}</span>
            ${req?'<span style="padding:5px 10px;border-radius:999px;background:#fee2e2;color:#dc2626;font-size:11.5px;font-weight:700">Bắt buộc</span>':'<span style="padding:5px 10px;border-radius:999px;background:#f8fafc;color:#64748b;font-size:11.5px;font-weight:700">Không bắt buộc</span>'}
          </div>
          <div style="font-size:18px;font-weight:700;color:var(--gray-900);margin-bottom:2px;line-height:1.4">${rEsc(q.noi_dung||q.text||'')}</div>
          ${ans}
        </div>
      </div>
    </div>`;
  };

  // Xóa modal cũ
  document.getElementById('rpt-view-form-modal')?.remove();

  // Tạo modal khung
  const modal = document.createElement('div');
  modal.id = 'rpt-view-form-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.5);display:flex;align-items:center;justify-content:center;padding:22px;backdrop-filter:blur(3px)';
  modal.innerHTML = `
    <div onclick="event.stopPropagation()" style="background:var(--gray-50);border-radius:20px;width:min(720px,96vw);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(15,23,42,.22);overflow:hidden;border:1px solid #00008B">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 22px;background:linear-gradient(135deg,#00008B,#00008B);border-bottom:1px solid #00008B;flex-shrink:0">
        <div style="min-width:0">
          <div style="font-size:16px;font-weight:800;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${rEsc(title)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:3px">${rEsc(cat)}${cat&&created?' · ':''}${created?'Ngày tạo: '+created:''}</div>
        </div>
        <button onclick="document.getElementById('rpt-view-form-modal').remove()" style="flex-shrink:0;margin-left:12px;width:32px;height:32px;border:1px solid #00008B;background:#00008B;border-radius:8px;cursor:pointer;color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center">×</button>
      </div>
      <div id="rpt-vfm-body" style="flex:1;overflow-y:auto;background:#f1f5f9;padding:20px 22px">
        <div style="text-align:center;padding:40px;color:#94a3b8">Đang tải câu hỏi...</div>
      </div>
      <div style="padding:14px 22px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;flex-shrink:0;background:var(--gray-50)">
        <button onclick="document.getElementById('rpt-view-form-modal').remove()" style="padding:8px 22px;border:1.5px solid #e2e8f0;border-radius:9px;background:var(--gray-50);color:var(--gray-700);font-size:13px;font-weight:600;cursor:pointer">Đóng</button>
      </div>
    </div>`;
  modal.addEventListener('click', () => modal.remove());
  document.body.appendChild(modal);

  // Fetch câu hỏi từ API
  let qs = [];
  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API}/forms/${currentFormId}`, { headers: token ? { Authorization: 'Bearer '+token } : {} });
    if (res.ok) {
      const data = await res.json();
      qs = (data.cau_hoi || []).map(q => ({
        noi_dung: q.noi_dung, loai: q.loai, bat_buoc: q.bat_buoc,
        lua_chon: (q.lua_chon || []).map(o => typeof o==='string'?o:(o.noi_dung||''))
      }));
    }
  } catch(e) {
    // fallback: dùng analysisData.questions
    if (analysisData?.questions) qs = analysisData.questions;
  }

  const body = document.getElementById('rpt-vfm-body');
  if (!body) return;
  if (!qs.length) { body.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Không có câu hỏi nào</div>'; return; }

  body.innerHTML = `
    <div style="background:linear-gradient(135deg,#00008B 0%,#00008B 52%,#00008B 100%);border-radius:20px;padding:22px 24px;margin-bottom:18px;color:var(--brand-color);box-shadow:0 16px 36px rgba(0,0,139,.13)">
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        ${cat?`<span style="font-size:12px;background:rgba(255,255,255,.55);padding:5px 12px;border-radius:999px;font-weight:700">${rEsc(cat)}</span>`:''}
        <span style="font-size:12px;background:rgba(255,255,255,.55);padding:5px 12px;border-radius:999px;font-weight:700">Tổng ${qs.length} câu hỏi</span>
      </div>
      <div style="font-size:30px;font-weight:800;line-height:1.1;letter-spacing:-0.01em">${rEsc(title)}</div>
      ${created?`<div style="font-size:13px;margin-top:8px;opacity:.85">Ngày tạo: <strong>${created}</strong></div>`:''}
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${qs.map((q,i) => rQ(q,i)).join('')}
    </div>
    <div style="padding:20px 0 4px;text-align:center">
      <button disabled style="padding:11px 32px;background:#00008B;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:not-allowed;opacity:.75">Gửi phản hồi</button>
    </div>`;
}

let rptDeleteTarget = null;

function openRptDeleteModal(id, name) {
  rptDeleteTarget = { id, name };
  let modal = document.getElementById('rpt-delete-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rpt-delete-modal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width:400px;border-radius:14px">
        <div class="modal-header">
          <div><div class="modal-title" style="color:var(--red)">Xóa biểu mẫu</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Xác nhận hành động</div></div>
          <button class="icon-btn close-btn" onclick="closeRptDeleteModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="rpt-delete-msg" style="padding:20px;font-size:14px;color:var(--gray-700);text-align:left">
          Chuyển biểu mẫu này vào thùng rác? Biểu mẫu sẽ tự động xóa vĩnh viễn sau 30 ngày.
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeRptDeleteModal()">Hủy bỏ</button>
          <button class="btn" style="background:var(--red);color:#fff" onclick="confirmRptDelete()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Xóa biểu mẫu
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.offsetHeight; // reflow
  }
  
  document.getElementById('rpt-delete-msg').innerHTML = `Chuyển biểu mẫu <strong>${name}</strong> vào thùng rác?<br>Biểu mẫu sẽ tự động xóa vĩnh viễn sau 30 ngày.`;
  modal.classList.add('open');
}

function closeRptDeleteModal() {
  const modal = document.getElementById('rpt-delete-modal');
  if (modal) modal.classList.remove('open');
  rptDeleteTarget = null;
}

async function confirmRptDelete() {
  if (!rptDeleteTarget) return;
  const { id, name } = rptDeleteTarget;
  closeRptDeleteModal();
  
  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API}/forms/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    });
    if (!res.ok) throw new Error('Không xóa được form');
    showToast('Đã chuyển biểu mẫu vào thùng rác', 'success');
    // Reload picker list
    window._cachedDbForms = (window._cachedDbForms || []).filter(f => f.id !== id);
    renderFormListWithImports(undefined);
  } catch(e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
}

async function rptDeleteForm(id, name) {
  openRptDeleteModal(id, name);
}

window.addEventListener('popstate', (e) => {
  if (!e.state || e.state.view !== 'detail') {
    backToPicker();
  }
});

function navigateBackToPicker() {
  if (history.state && history.state.view === 'detail') {
    history.back();
  } else {
    backToPicker();
  }
}

function backToPicker() {
  document.getElementById('rpt-dashboard').style.display='none';
  document.getElementById('rpt-picker').style.display='block';
  Object.values(charts).forEach(c=>c.destroy()); charts={}; dashboardItems=[];
  // Ẩn nút AI khi về picker
  const aiBtn = document.getElementById('btn-ai-analyze');
  if (aiBtn) aiBtn.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────
//  KPI
// ─────────────────────────────────────────────────────────────
function renderKPIs() {
  const d=analysisData;
  if (!d?.form) return;
  const rows = activeReportRows && activeReportRows.length ? activeReportRows : rawRows || [];
  const responses = rows.length;
  
  // Phản hồi trong ngày
  const todayDate = new Date();
  const todayStr = todayDate.getFullYear() + '-' + String(todayDate.getMonth() + 1).padStart(2, '0') + '-' + String(todayDate.getDate()).padStart(2, '0');
  const todayResp = rows.filter(r => r.ngay_gui && String(r.ngay_gui).startsWith(todayStr)).length;
  
  // Số câu hỏi
  const numQuestions = (analysisData?.questions || []).length;
  
  // Ngày gần nhất
  const dates = rows.map(r => new Date(r.ngay_gui)).filter(d => !isNaN(d.getTime())).sort((a,b)=>b-a);
  const latestDateStr = dates.length ? fmtDate(dates[0].toISOString().slice(0,10)) : 'Chưa có';

  const kpis = [
    {label:'Tổng phản hồi', value:responses, sub:'Số lượt điền khảo sát', icon:'M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z', iconColor:'#00008B', bg:'#e0e7ff', borderColor:'#00008B'},
    {label:'Hôm nay', value:todayResp, sub:'Phản hồi mới trong ngày', icon:'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', iconColor:'#2563eb', bg:'#dbeafe', borderColor:'#2563eb'},
    {label:'Số câu hỏi', value:numQuestions, sub:'Có trong biểu mẫu', icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', iconColor:'#0284c7', bg:'#e0f2fe', borderColor:'#0284c7'},
    {label:'Ngày gần nhất', value:latestDateStr, sub:'Phản hồi mới nhất', icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', iconColor:'#06b6d4', bg:'#cffafe', borderColor:'#06b6d4'},
  ];
  renderKPIHtml(kpis);
}

function getTopReportChoice() {
  const stats = (analysisData?.choice_stats || []).filter(s => normalizeReportText(s.lua_chon) && Number(s.so_chon || 0) > 0);
  if (!stats.length) return null;
  return stats.sort((a,b) => Number(b.so_chon || 0) - Number(a.so_chon || 0))[0];
}

function starBar(rating) {
  if(!rating) return '—';
  const n=Math.round(parseFloat(rating));
  return `<div style="display:flex;gap:2px;margin-top:3px">${Array.from({length:5},(_,i)=>`<svg viewBox="0 0 24 24" fill="${i<n?'#fbbf24':'#e2e8f0'}" width="12" height="12"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('')}</div>`;
}

function renderKPIsFromCSV() {
  setFormDetailOverviewVisibility(false);
  const {rows,colTypes,headers}=csvData;
  
  // Phản hồi trong ngày
  const todayDate = new Date();
  const todayStr = todayDate.getFullYear() + '-' + String(todayDate.getMonth() + 1).padStart(2, '0') + '-' + String(todayDate.getDate()).padStart(2, '0');
  let dateKey = headers.find(h => h.toLowerCase().includes('time') || h.toLowerCase().includes('ngày') || h.toLowerCase().includes('date')) || 'ngay_gui';
  const todayResp = rows.filter(r => r[dateKey] && String(r[dateKey]).includes(todayStr)).length;
  
  // Số câu hỏi (số cột không đếm cột thời gian)
  const numQuestions = Math.max(0, headers.length - 1);
  
  // Ngày gần nhất
  const dates = rows.map(r => new Date(r[dateKey])).filter(d => !isNaN(d.getTime())).sort((a,b)=>b-a);
  const latestDateStr = dates.length ? fmtDate(dates[0].toISOString().slice(0,10)) : 'Chưa có';

  const kpis = [
    {label:'Tổng phản hồi', value:rows.length, sub:'Số lượt điền khảo sát', icon:'M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z', iconColor:'#00008B', bg:'#e0e7ff', borderColor:'#00008B'},
    {label:'Hôm nay', value:todayResp, sub:'Phản hồi mới trong ngày', icon:'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', iconColor:'#2563eb', bg:'#dbeafe', borderColor:'#2563eb'},
    {label:'Số câu hỏi', value:numQuestions, sub:'Cột dữ liệu', icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', iconColor:'#0284c7', bg:'#e0f2fe', borderColor:'#0284c7'},
    {label:'Ngày gần nhất', value:latestDateStr, sub:'Phản hồi mới nhất', icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', iconColor:'#06b6d4', bg:'#cffafe', borderColor:'#06b6d4'},
  ];
  renderKPIHtml(kpis);
}

function renderKPIHtml(kpis) {
  const row = document.getElementById('rpt-kpi-row');
  if (!row) return;
  row.style.gridTemplateColumns = 'repeat(auto-fit,minmax(190px,1fr))';
  row.innerHTML=kpis.map(k=>`
    <div class="dash-card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;height:120px;border-left:3px solid ${k.borderColor};border-radius:12px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-size:13px;font-weight:700;color:#64748b">${k.label}</div>
        <div style="font-size:28px;font-weight:800;color:var(--gray-900);line-height:1;margin-top:2px">${k.value}</div>
        <div style="font-size:12px;color:#94a3b8;font-weight:500;margin-top:2px">${k.sub}</div>
      </div>
      <div style="width:48px;height:48px;border-radius:12px;background:${k.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="${k.iconColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="${k.icon}"/></svg>
      </div>
    </div>`).join('');
}

function classifyReportAudience(row) {
  const text = [
    row?.doi_tuong, row?.loai_doi_tuong, row?.nghe_nghiep, row?.vai_tro,
    row?.lop, row?.khoa
  ].map(v => String(v || '').toLowerCase()).join(' ');
  if (text.includes('người đi làm') || text.includes('di lam') || text.includes('đi làm') || text.includes('worker')) return 'Người đi làm';
  if (text.includes('sinh viên') || text.includes('sinh vien') || text.includes('student') || row?.lop || row?.khoa) return 'Sinh viên';
  return 'Khác';
}

function countReportValues(items, getter, limit = 8) {
  const map = {};
  (items || []).forEach(item => {
    const key = String(getter(item) || '').trim();
    if (!key) return;
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, limit);
}

function collectReportText(rows) {
  const texts = [];
  (analysisData?.text_stats || []).forEach(t => texts.push(t.noi_dung || ''));
  (analysisData?.questions || []).forEach(q => texts.push(q.noi_dung || ''));
  (rows || []).forEach(r => {
    Object.entries(r || {}).forEach(([k,v]) => {
      if (/q_|noi_dung|ghi_chu|comment|nhan_xet|tra_loi/i.test(k) && String(v || '').length > 3) texts.push(v);
    });
  });
  if (csvData?.rows?.length) {
    const textCols = csvData.colTypes.map((t,i) => t === 'text' ? i : -1).filter(i => i >= 0);
    csvData.rows.slice(0, 80).forEach(row => textCols.forEach(i => texts.push(row[i] || '')));
  }
  return texts.join(' ');
}

function extractTopKeywords(text, limit = 24) {
  const stop = new Set('và của cho với trong là có được các một những này đó tại từ để khi về như hơn rất bạn chúng tôi trung tâm biểu mẫu khảo sát chất lượng dịch vụ phản hồi đánh giá'.split(' '));
  const words = String(text || '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !stop.has(w));
  const map = {};
  words.forEach(w => { map[w] = (map[w] || 0) + 1; });
  return Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, limit);
}

function renderDashboardOverviewSections() {
  const rows = activeSource === 'form' ? (rawRows || []) : [];
  const total = analysisData?.form?.so_phan_hoi || csvData?.rows?.length || rows.length || 0;
  const pos = analysisData?.form?.tich_cuc || 0;
  const neu = analysisData?.form?.trung_tinh || 0;
  const neg = analysisData?.form?.tieu_cuc || 0;
  const rating = analysisData?.form?.diem_tb;
  const posRate = total ? Math.round(pos / total * 100) : 0;
  const summary = document.getElementById('rpt-ai-summary');
  if (summary) {
    summary.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="width:42px;height:42px;border-radius:12px;background:#00008B;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:900">AI</div>
        <div>
          <div style="font-size:13px;font-weight:900;color:var(--brand-color);margin-bottom:4px">AI Tóm tắt báo cáo</div>
          <div style="font-size:15px;font-weight:750;color:var(--gray-900);line-height:1.55">
            Biểu mẫu hiện có <b>${total}</b> phản hồi${rating ? `, điểm hài lòng trung bình <b>${fmt(rating)}</b>/5` : ''}.
            ${analysisData ? `Tỷ lệ phản hồi tích cực đạt <b>${posRate}%</b>, gồm ${pos} tích cực, ${neu} trung lập và ${neg} tiêu cực.` : 'Dữ liệu Excel đã sẵn sàng để xem thống kê theo từng cột.'}
          </div>
        </div>
      </div>`;
  }

  const sentimentVals = analysisData ? [pos, neu, neg] : [0, csvData?.rows?.length || 0, 0];
  mkChart('rpt-ai-sentiment', {
    type:'doughnut',
    data:{labels:['Tích cực','Trung lập','Tiêu cực'],datasets:[{data:sentimentVals,backgroundColor:['#16a34a','#f59e0b','#ef4444'],borderWidth:0,hoverOffset:6}]},
    options:{...rAF,cutout:'68%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,font:{size:11,weight:'700'}}},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw} phản hồi`}}}}
  });

  const keywords = extractTopKeywords(collectReportText(rows));
  const cloud = document.getElementById('rpt-word-cloud');
  if (cloud) {
    cloud.innerHTML = keywords.length
      ? keywords.map(([word,count],idx) => `<span style="font-size:${Math.max(12, 26 - idx)}px;opacity:${Math.max(.55, 1 - idx*.025)}">${esc(word)} <small style="font-size:10px;color:#64748b;margin-left:3px">${count}</small></span>`).join('')
      : '<div style="color:#94a3b8;font-size:13px;font-weight:700">Chưa đủ dữ liệu văn bản để tạo word cloud</div>';
  }

  const audienceRows = rows.length ? rows : buildRawRowsFromAnalysis(analysisData);
  const audience = countReportValues(audienceRows, classifyReportAudience, 4);
  mkChart('rpt-participant-donut', {
    type:'doughnut',
    data:{labels:audience.map(x=>x[0]),datasets:[{data:audience.map(x=>x[1]),backgroundColor:['#00008B','#16a34a','#f59e0b','#94a3b8'],borderWidth:0}]},
    options:{...rAF,cutout:'62%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,font:{size:11,weight:'700'}}}}}
  });

  const dept = countReportValues(audienceRows, r => r.khoa || r.lop, 6);
  mkChart('rpt-top-dept', {
    type:'bar',
    data:{labels:dept.map(x=>x[0]),datasets:[{data:dept.map(x=>x[1]),backgroundColor:'#00008B',borderRadius:8,borderSkipped:false}]},
    options:{...rAF,indexAxis:'y',plugins:{...noLegend},scales:{x:{...softGrid,beginAtZero:true,ticks:{precision:0}},y:{...noGrid,ticks:{font:{size:11,weight:'700'}}}}}
  });

  const teachers = countReportValues(audienceRows, r => r.giao_vien || r.giang_vien || r.teacher, 5);
  const board = document.getElementById('rpt-teacher-leaderboard');
  if (board) {
    board.innerHTML = teachers.length
      ? teachers.map(([name,count],i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9">
          <div style="width:28px;height:28px;border-radius:9px;background:${i===0?'#00008B':'#eef2ff'};color:${i===0?'#fff':'#00008B'};display:flex;align-items:center;justify-content:center;font-weight:900">${i+1}</div>
          <div style="flex:1;min-width:0;font-size:13px;font-weight:800;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
          <div style="font-size:12px;font-weight:900;color:#64748b">${count}</div>
        </div>`).join('')
      : '<div style="padding:34px 0;text-align:center;color:#94a3b8;font-size:13px;font-weight:700">Chưa có dữ liệu giảng viên</div>';
  }
}

// ─────────────────────────────────────────────────────────────
//  DEFAULT CHARTS – FORM
// ─────────────────────────────────────────────────────────────
function renderDefaultCharts() {
  const d=analysisData;
  document.getElementById('rpt-charts-grid').innerHTML='';

  // 1. Timeline — tự phát hiện 1 đợt hay 2 đợt
  if(d.timeline&&d.timeline.length) {
    const sorted = [...d.timeline].sort((a,b)=>a.ngay.localeCompare(b.ngay));
    // Tìm gap lớn nhất giữa các ngày liên tiếp
    let maxGap = 0, splitIdx = -1;
    for(let i=1;i<sorted.length;i++){
      const gap = (new Date(sorted[i].ngay)-new Date(sorted[i-1].ngay))/(1000*60*60*24);
      if(gap>maxGap){ maxGap=gap; splitIdx=i; }
    }
    const hasTwoPerids = maxGap >= 30 && splitIdx > 0 && splitIdx < sorted.length-1;

    if(!hasTwoPerids) {
      // ── 1 đợt: biểu đồ đường ──
      addChartCard('c-timeline','Phản hồi theo thời gian','full',380);
      // Add So sánh button inline with title
      setTimeout(()=>{
        const titleEl = document.querySelector('#slot-c-timeline .dash-card-title');
        if(titleEl && !titleEl.querySelector('.cmp-toggle-btn')){
          titleEl.insertAdjacentHTML('afterend',`
            <button class="cmp-toggle-btn" onclick="document.getElementById('rpt-compare-section')?.scrollIntoView({behavior:'smooth'})" style="margin-left:10px;padding:5px 14px;border-radius:8px;border:1.5px solid #e2e8f0;background:var(--gray-50);color:#64748b;font-size:11.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .15s" onmouseenter="this.style.borderColor='var(--brand-color)';this.style.color='var(--brand-color)'" onmouseleave="this.style.borderColor='var(--gray-200)';this.style.color='#64748b'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              So sánh
            </button>`);
        }
      },0);
      setTimeout(()=>{
        const timelineStats = buildTimelineStats(sorted);
        renderTimelineSummary('c-timeline', timelineStats, 'c-timeline');
        const vals = sorted.map(t=>t.so_luong);
        const totalPoints = sorted.length;
        mkChart('c-timeline',{
          type:'line',
          data:{labels:sorted.map(t=>fmtDate(t.ngay)),datasets:[{
            data:vals,
            fill:true,
            backgroundColor:(ctx)=>{
              const g=ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height);
              g.addColorStop(0,'rgba(59,130,246,0.08)');
              g.addColorStop(1,'rgba(59,130,246,0.005)');
              return g;
            },
            borderColor:'#3b82f6',borderWidth:1.5,borderDash:[4,3],
            pointBackgroundColor:vals.map(v=>v===timelineStats.peakValue?'#2563eb':'#3b82f6'),
            pointBorderColor:'#fff',pointBorderWidth:1.5,
            pointRadius:vals.map(v=>v===timelineStats.peakValue?5:0),
            pointHoverRadius:5,pointHoverBackgroundColor:'#2563eb',
            tension:0.35,
          }]},
          options:{...rAF,interaction:{mode:'index',intersect:false},
            plugins:{...noLegend,tooltip:{backgroundColor:'#0f172a',padding:10,cornerRadius:8,
              titleFont:{size:11},bodyFont:{size:13,weight:'bold'},
              callbacks:{title:i=>`📅 ${i[0].label}`,label:i=>`${i.raw} phản hồi`}}},
            scales:{
              x:{...noGrid,ticks:{font:{size:10,weight:'500'},color:'#94a3b8',maxRotation:0,autoSkip:false,
                callback(value,index){
                  const every=Math.max(1,Math.ceil(totalPoints/7));
                  return index%every===0?fmtShortDate(sorted[index]?.ngay):'';
                }}},
              y:{...softGrid,beginAtZero:true,ticks:{stepSize:1,precision:0,font:{size:10},color:'#94a3b8'},
                title:{display:true,text:'Số phản hồi',color:'#94a3b8',font:{size:10,weight:'500'}}}
            }}
        });
      },100);
    } else {
      // ── 2 đợt phát hiện: mặc định hiện biểu đồ cột, có nút toggle so sánh ──
      const dot1 = sorted.slice(0, splitIdx);
      const dot2 = sorted.slice(splitIdx);
      const s1 = buildTimelineStats(dot1), s2 = buildTimelineStats(dot2);

      const periodLabel = items => {
        const dd = new Date(items[0].ngay);
        return isNaN(dd) ? '' : `Tháng ${dd.getMonth()+1}/${dd.getFullYear()}`;
      };
      const lbl1 = periodLabel(dot1), lbl2 = periodLabel(dot2);
      const avgRating = parseFloat(d.form?.diem_tb) || 0;
      const total1 = s1.total, total2 = s2.total;
      const totalMax = Math.max(total1, total2, 1);
      const formTotal = d.form?.so_phan_hoi || 1;
      const ratio1 = total1/formTotal, ratio2 = total2/formTotal;
      const pos1 = Math.round((d.form?.tich_cuc||0)*ratio1), pos2 = Math.round((d.form?.tich_cuc||0)*ratio2);
      const neg1 = Math.round((d.form?.tieu_cuc||0)*ratio1), neg2 = Math.round((d.form?.tieu_cuc||0)*ratio2);
      const posMax = Math.max(pos1,pos2,1), negMax = Math.max(neg1,neg2,1);

      const diffBadge = v => {
        if(v===0) return `<span style="color:#64748b;font-size:12px;font-weight:700">— không đổi</span>`;
        const c=v>0?'#059669':'#ef4444', icon=v>0?'▲':'▼';
        return `<span style="color:${c};font-size:12px;font-weight:700">${icon} ${v>0?'+':''}${v}</span>`;
      };
      const barRow = (label,v1,v2,max) => `
        <div style="padding:14px 16px;border:1px solid #f1f5f9;border-radius:12px;background:var(--gray-50);margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span style="font-size:13px;font-weight:600;color:var(--gray-900)">${label}</span>
            ${diffBadge(v2-v1)}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:11px;color:var(--brand-color);font-weight:600;min-width:54px">Đợt 1: ${v1}</span>
            <div style="flex:1;height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden">
              <div style="height:100%;width:${Math.round(v1/max*100)}%;background:#00008B;border-radius:5px"></div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;color:#059669;font-weight:600;min-width:54px">Đợt 2: ${v2}</span>
            <div style="flex:1;height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden">
              <div style="height:100%;width:${Math.round(v2/max*100)}%;background:#059669;border-radius:5px"></div>
            </div>
          </div>
        </div>`;

      const compareHTML = `<div id="cmp-view" style="display:none"></div>`;

      addChartCard('c-timeline','Phản hồi theo thời gian','full',320);
      // Ghi đè title card + thêm nút toggle
      const slot = document.getElementById('slot-c-timeline');
      if(slot){
        const titleEl = slot.querySelector('.dash-card-title');
        if(titleEl) titleEl.innerHTML = `Phản hồi theo thời gian
          <button id="btn-toggle-cmp" onclick="window._toggleCmpView()"
            style="margin-left:12px;padding:4px 12px;border-radius:7px;border:1.5px solid #00008B;background:#00008B;color:#fff;font-size:11px;font-weight:700;cursor:pointer;transition:all .15s;vertical-align:middle"
            onmouseenter="this.style.background='#00008B';this.style.color='#fff'"
            onmouseleave="if(!window._cmpActive){this.style.background='#00008B';this.style.color='#fff'}else{this.style.background='#00008B';this.style.color='#fff'}">
            ⇄ So sánh
          </button>`;
      }

      window._cmpActive = false;

      setTimeout(()=>{
        const timelineStats = buildTimelineStats(sorted);
        const wrap = document.querySelector('#slot-c-timeline .card-inner');
        if(!wrap) return;
        wrap.style.height = 'auto';
        // Build stat boxes + bar view + compare view tất cả cùng lúc
        wrap.innerHTML = `
          <div id="tl-stat-boxes" style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:16px">
            <div style="display:inline-flex;align-items:center;gap:16px;padding:8px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px">
              <div style="display:flex;align-items:baseline;gap:6px">
                <span style="font-size:12px;color:#64748b;font-weight:600">Cao nhất / tuần:</span>
                <span style="font-size:15px;font-weight:800;color:var(--gray-900)">${timelineStats.peakWeek}</span>
                <span style="font-size:11px;color:#94a3b8">(${timelineStats.peakWeekLabel||'--'})</span>
              </div>
              <div style="width:1px;height:14px;background:#cbd5e1"></div>
              <div style="display:flex;align-items:baseline;gap:6px">
                <span style="font-size:12px;color:#64748b;font-weight:600">Cao nhất / ngày:</span>
                <span style="font-size:15px;font-weight:800;color:var(--gray-900)">${timelineStats.peakValue}</span>
                <span style="font-size:11px;color:#94a3b8">(${timelineStats.peakDate?fmtDate(timelineStats.peakDate):'--'})</span>
              </div>
            </div>
          </div>
          <div id="tl-bar-view"><div style="height:220px"><canvas id="c-timeline"></canvas></div></div>
          ${compareHTML}`;
        const CMP_BLUE = '#00008B';
        const CMP_ORANGE = '#f59e0b';
        const defaultStartDate1 = (() => {
          const d0 = new Date(dot1[0]?.ngay || '');
          return isNaN(d0) ? '' : (dot1[0]?.ngay || '').slice(0,10);
        })();
        const defaultEndDate1 = (() => {
          const d0 = new Date(dot1[dot1.length - 1]?.ngay || '');
          return isNaN(d0) ? '' : (dot1[dot1.length - 1]?.ngay || '').slice(0,10);
        })();
        const defaultStartDate2 = (() => {
          const d0 = new Date(dot2[0]?.ngay || '');
          return isNaN(d0) ? '' : (dot2[0]?.ngay || '').slice(0,10);
        })();
        const defaultEndDate2 = (() => {
          const d0 = new Date(dot2[dot2.length - 1]?.ngay || '');
          return isNaN(d0) ? '' : (dot2[dot2.length - 1]?.ngay || '').slice(0,10);
        })();
        const formatDateLabel = value => {
          if (!value) return 'Chưa chọn';
          const d0 = new Date(value);
          return isNaN(d0) ? value : d0.toLocaleDateString('vi-VN');
        };
        const formatRangeLabel = (start, end) => {
          if (!start && !end) return 'Chưa chọn';
          if (start && end) return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
          return start ? `Từ ${formatDateLabel(start)}` : `Đến ${formatDateLabel(end)}`;
        };
        const getRowsByRange = (start, end) => {
          const startTime = start ? new Date(`${start}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
          const endTime = end ? new Date(`${end}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
          return (rawRows || []).filter(r => {
            const sentAt = new Date(r.ngay_gui || '').getTime();
            return !Number.isNaN(sentAt) && sentAt >= startTime && sentAt <= endTime;
          });
        };
        const buildCompareStats = rows => {
          const ratings = rows.map(r => parseFloat(r.danh_gia)).filter(v => !isNaN(v));
          return {
            rows,
            total: rows.length,
            pos: rows.filter(r => r.cam_xuc === 'positive').length,
            neg: rows.filter(r => r.cam_xuc === 'negative').length,
            avg: ratings.length ? ratings.reduce((a,b)=>a+b,0) / ratings.length : 0,
          };
        };
        const TREND_UP = '#00008B';
        const TREND_DOWN = '#f59e0b';
        const TREND_NEUTRAL = '#64748b';
        const formatPercent = (value, total) => total ? `${Math.round((value / total) * 100)}%` : '0%';
        const formatMetricChange = (diff, unit, digits = 0) => {
          if (Math.abs(diff) < 0.0001) {
            return {
              color: TREND_NEUTRAL,
              arrow: '→',
              text: `Không thay đổi ${unit}`,
            };
          }
          const isUp = diff > 0;
          const amount = digits ? Math.abs(diff).toFixed(digits) : Math.abs(Math.round(diff));
          return {
            color: isUp ? TREND_UP : TREND_DOWN,
            arrow: isUp ? '↑' : '↓',
            text: `${isUp ? 'Tăng' : 'Giảm'} ${amount} ${unit}`,
          };
        };
        // renderCompareCard replaced by grouped bar chart below
        let _cmpBarChartInstance = null;
        window._openCompareDatePicker = id => {
          const input = document.getElementById(id);
          if (!input) return;
          if (typeof input.showPicker === 'function') {
            input.showPicker();
            return;
          }
          input.focus();
          input.click();
        };
        window._renderTimelineCompare = () => {
          const cmpView = document.getElementById('cmp-view');
          if (!cmpView) return;
          const start1 = document.getElementById('cmp-start-date-1')?.value || defaultStartDate1;
          const end1 = document.getElementById('cmp-end-date-1')?.value || defaultEndDate1;
          const start2 = document.getElementById('cmp-start-date-2')?.value || defaultStartDate2;
          const end2 = document.getElementById('cmp-end-date-2')?.value || defaultEndDate2;
          const stats1 = buildCompareStats(getRowsByRange(start1, end1));
          const stats2 = buildCompareStats(getRowsByRange(start2, end2));
          const lbl1 = formatRangeLabel(start1, end1);
          const lbl2 = formatRangeLabel(start2, end2);
          const totalChange = formatMetricChange(stats2.total - stats1.total, 'phản hồi');
          const posRate1 = stats1.total ? (stats1.pos / stats1.total) * 100 : 0;
          const posRate2 = stats2.total ? (stats2.pos / stats2.total) * 100 : 0;
          const posRateChange = formatMetricChange(posRate2 - posRate1, 'điểm %', 1);
          const avgChange = formatMetricChange((stats2.avg || 0) - (stats1.avg || 0), 'điểm', 1);
          cmpView.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
              <!-- Đợt 1 pill -->
              <div style="display:flex;align-items:center;gap:8px;background:#00008B;border:1.5px solid #00008B;border-radius:12px;padding:7px 14px">
                <div style="width:10px;height:10px;border-radius:50%;background:${CMP_BLUE};flex-shrink:0"></div>
                <span style="font-size:13px;font-weight:700;color:${CMP_BLUE}">Đợt 1</span>
                <div style="position:relative">
                  <button type="button" onclick="window._openCompareDatePicker('cmp-start-date-1')" style="background:none;border:none;font-size:13px;color:var(--brand-color);font-weight:600;cursor:pointer;padding:0;text-decoration:none">${formatDateLabel(start1)}</button>
                  <input id="cmp-start-date-1" type="date" value="${start1}" onchange="window._renderTimelineCompare()" style="position:absolute;inset:0;opacity:0;pointer-events:none">
                </div>
                <span style="color:var(--brand-color);font-size:13px">→</span>
                <div style="position:relative">
                  <button type="button" onclick="window._openCompareDatePicker('cmp-end-date-1')" style="background:none;border:none;font-size:13px;color:var(--brand-color);font-weight:600;cursor:pointer;padding:0;text-decoration:none">${formatDateLabel(end1)}</button>
                  <input id="cmp-end-date-1" type="date" value="${end1}" onchange="window._renderTimelineCompare()" style="position:absolute;inset:0;opacity:0;pointer-events:none">
                </div>
                <span style="font-size:14px;color:${CMP_BLUE}">📅</span>
              </div>
              <!-- Đợt 2 pill -->
              <div style="display:flex;align-items:center;gap:8px;background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:7px 14px">
                <div style="width:10px;height:10px;border-radius:50%;background:${CMP_ORANGE};flex-shrink:0"></div>
                <span style="font-size:13px;font-weight:700;color:${CMP_ORANGE}">Đợt 2</span>
                <div style="position:relative">
                  <button type="button" onclick="window._openCompareDatePicker('cmp-start-date-2')" style="background:none;border:none;font-size:13px;color:#9a3412;font-weight:600;cursor:pointer;padding:0;text-decoration:none">${formatDateLabel(start2)}</button>
                  <input id="cmp-start-date-2" type="date" value="${start2}" onchange="window._renderTimelineCompare()" style="position:absolute;inset:0;opacity:0;pointer-events:none">
                </div>
                <span style="color:#fdba74;font-size:13px">→</span>
                <div style="position:relative">
                  <button type="button" onclick="window._openCompareDatePicker('cmp-end-date-2')" style="background:none;border:none;font-size:13px;color:#9a3412;font-weight:600;cursor:pointer;padding:0;text-decoration:none">${formatDateLabel(end2)}</button>
                  <input id="cmp-end-date-2" type="date" value="${end2}" onchange="window._renderTimelineCompare()" style="position:absolute;inset:0;opacity:0;pointer-events:none">
                </div>
                <span style="font-size:14px;color:${CMP_ORANGE}">📅</span>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:4px">
              <!-- Card 1: Tổng phản hồi -->
              <div style="background:var(--gray-50);border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px;box-shadow:0 2px 12px rgba(15,23,42,0.06)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
                  <span style="font-size:15px">📊</span>
                  <span style="font-size:11px;font-weight:700;color:var(--gray-600);text-transform:uppercase;letter-spacing:.07em">Tổng phản hồi</span>
                </div>
                <div style="height:140px"><canvas id="cmp-chart-total"></canvas></div>
                <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:10px;background:${totalChange.color===TREND_UP?'#00008B':totalChange.color===TREND_DOWN?'#fff7ed':'#f8fafc'};border:1px solid ${totalChange.color===TREND_UP?'#00008B':totalChange.color===TREND_DOWN?'#fed7aa':'#e2e8f0'}">
                  <div>
                    <div style="font-size:13px;font-weight:800;color:${totalChange.color}">${totalChange.arrow} ${totalChange.text}</div>
                    <div style="font-size:10px;color:#64748b;margin-top:2px">${stats2.total > stats1.total ? 'Đợt 2 nhận nhiều hơn đợt 1' : stats2.total < stats1.total ? 'Đợt 2 nhận ít hơn đợt 1' : 'Hai đợt bằng nhau'}</div>
                  </div>
                  <div style="font-size:11px;color:#94a3b8;text-align:right">
                    <span style="color:${CMP_BLUE};font-weight:700">${stats1.total}</span> → <span style="color:${CMP_ORANGE};font-weight:700">${stats2.total}</span>
                  </div>
                </div>
              </div>
              <!-- Card 2: Cảm xúc tích cực -->
              <div style="background:var(--gray-50);border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px;box-shadow:0 2px 12px rgba(15,23,42,0.06)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
                  <span style="font-size:15px">😊</span>
                  <span style="font-size:11px;font-weight:700;color:var(--gray-600);text-transform:uppercase;letter-spacing:.07em">Cảm xúc tích cực</span>
                </div>
                <div style="height:140px"><canvas id="cmp-chart-pos"></canvas></div>
                <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:10px;background:${posRateChange.color===TREND_UP?'#f0fdf4':posRateChange.color===TREND_DOWN?'#fff7ed':'#f8fafc'};border:1px solid ${posRateChange.color===TREND_UP?'#bbf7d0':posRateChange.color===TREND_DOWN?'#fed7aa':'#e2e8f0'}">
                  <div>
                    <div style="font-size:13px;font-weight:800;color:${posRateChange.color}">${posRateChange.arrow} ${posRateChange.text}</div>
                    <div style="font-size:10px;color:#64748b;margin-top:2px">${posRate2 > posRate1 ? 'Tỷ lệ tích cực tốt hơn' : posRate2 < posRate1 ? 'Tỷ lệ tích cực thấp hơn' : 'Không thay đổi'}</div>
                  </div>
                  <div style="font-size:11px;text-align:right">
                    <span style="color:${CMP_BLUE};font-weight:700">${stats1.pos} người (${Math.round(posRate1)}%)</span><br>
                    <span style="color:${CMP_ORANGE};font-weight:700">${stats2.pos} người (${Math.round(posRate2)}%)</span>
                  </div>
                </div>
              </div>
              <!-- Card 3: Điểm hài lòng -->
              <div style="background:var(--gray-50);border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px;box-shadow:0 2px 12px rgba(15,23,42,0.06)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
                  <span style="font-size:15px">⭐</span>
                  <span style="font-size:11px;font-weight:700;color:var(--gray-600);text-transform:uppercase;letter-spacing:.07em">Điểm hài lòng</span>
                </div>
                <div style="height:140px"><canvas id="cmp-chart-avg"></canvas></div>
                <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:10px;background:${avgChange.color===TREND_UP?'#fffbeb':avgChange.color===TREND_DOWN?'#fef2f2':'#f8fafc'};border:1px solid ${avgChange.color===TREND_UP?'#fde68a':avgChange.color===TREND_DOWN?'#fecaca':'#e2e8f0'}">
                  <div>
                    <div style="font-size:13px;font-weight:800;color:${avgChange.color}">${avgChange.arrow} ${avgChange.text}</div>
                    <div style="font-size:10px;color:#64748b;margin-top:2px">${(stats2.avg||0) > (stats1.avg||0) ? 'Hài lòng hơn trong đợt 2' : (stats2.avg||0) < (stats1.avg||0) ? 'Kém hài lòng hơn đợt 1' : 'Không thay đổi'}</div>
                  </div>
                  <div style="font-size:11px;text-align:right">
                    <span style="color:${CMP_BLUE};font-weight:700">${stats1.avg?stats1.avg.toFixed(1):'0.0'} / 5</span><br>
                    <span style="color:${CMP_ORANGE};font-weight:700">${stats2.avg?stats2.avg.toFixed(1):'0.0'} / 5</span>
                  </div>
                </div>
              </div>
            </div>`;
          // Destroy old charts
          if (_cmpBarChartInstance) {
            (_cmpBarChartInstance.forEach ? _cmpBarChartInstance : [_cmpBarChartInstance]).forEach(c => c && c.destroy());
            _cmpBarChartInstance = null;
          }
          const posRate1Disp = Math.round(posRate1);
          const posRate2Disp = Math.round(posRate2);
          const avg1 = stats1.avg ? parseFloat(stats1.avg.toFixed(2)) : 0;
          const avg2 = stats2.avg ? parseFloat(stats2.avg.toFixed(2)) : 0;
          const lbl1Short = lbl1.length > 22 ? lbl1.slice(0,22)+'…' : lbl1;
          const lbl2Short = lbl2.length > 22 ? lbl2.slice(0,22)+'…' : lbl2;
          const miniBarOpts = (unit, maxVal, val1, val2) => ({
            type: 'bar',
            options: {
              responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: '#0f172a', padding: 8, cornerRadius: 7,
                  callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}${unit}` }
                }
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: {
                    color: (ctx) => ctx.index === 0 ? '#00008B' : '#f59e0b',
                    font: (ctx) => ({ size: ctx.index === 0 ? 10 : 10, weight: '700' }),
                    callback: function(val, index) {
                      const labels = ['Đợt 1', 'Đợt 2'];
                      const vals2 = [val1 + unit, val2 + unit];
                      return [labels[index], vals2[index]];
                    }
                  }
                },
                y: { beginAtZero: true, max: maxVal, grid: { color: 'rgba(148,163,184,0.12)' },
                  ticks: { font: { size: 9 }, color: '#94a3b8', maxTicksLimit: 4 } }
              }
            }
          });
          const makeDataset = (val1, val2) => ({
            labels: ['Đợt 1', 'Đợt 2'],
            datasets: [
              { label: 'Đợt 1', data: [val1, val2],
                backgroundColor: ['rgba(0,0,139,0.85)', 'rgba(245,158,11,0.85)'],
                borderColor: ['#00008B', '#f59e0b'],
                borderWidth: 1.5, borderRadius: 0, borderSkipped: false },
            ]
          });
          const charts = [];
          const maxTotal = Math.max(stats1.total, stats2.total, 1);
          const c1 = document.getElementById('cmp-chart-total');
          if (c1) {
            const cfg = miniBarOpts(' phản hồi', Math.ceil(maxTotal * 1.2), stats1.total, stats2.total);
            cfg.data = makeDataset(stats1.total, stats2.total);
            charts.push(new Chart(c1, cfg));
          }
          const c2 = document.getElementById('cmp-chart-pos');
          if (c2) {
            const cfg = miniBarOpts('%', 100, posRate1Disp, posRate2Disp);
            cfg.data = makeDataset(posRate1Disp, posRate2Disp);
            charts.push(new Chart(c2, cfg));
          }
          const c3 = document.getElementById('cmp-chart-avg');
          if (c3) {
            const cfg = miniBarOpts('/5', 5, avg1, avg2);
            cfg.data = makeDataset(avg1, avg2);
            charts.push(new Chart(c3, cfg));
          }
          _cmpBarChartInstance = charts;
        };

        window._cmpActive = false;
        window._toggleCmpView = () => {
          window._cmpActive = !window._cmpActive;
          const statBoxes = document.getElementById('tl-stat-boxes');
          const barView  = document.getElementById('tl-bar-view');
          const cmpView  = document.getElementById('cmp-view');
          const btn      = document.getElementById('btn-toggle-cmp');
          if(!barView||!cmpView) return;
          if(statBoxes) statBoxes.style.display = window._cmpActive ? 'none' : 'grid';
          barView.style.display  = window._cmpActive ? 'none' : 'block';
          cmpView.style.display  = window._cmpActive ? 'block' : 'none';
          if(btn){
            btn.style.background = window._cmpActive ? CMP_BLUE : '#00008B';
            btn.style.color      = window._cmpActive ? '#fff' : CMP_BLUE;
          }
          if (window._cmpActive) window._renderTimelineCompare();
        };
        const vals = sorted.map(t=>t.so_luong);
        const totalPoints = sorted.length;
        mkChart('c-timeline',{
          type:'line',
          data:{labels:sorted.map(t=>fmtDate(t.ngay)),datasets:[{
            data:vals,
            fill:true,
            backgroundColor:(ctx)=>{
              const g=ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height);
              g.addColorStop(0,'rgba(0,0,139,0.18)');
              g.addColorStop(1,'rgba(0,0,139,0.01)');
              return g;
            },
            borderColor:'#00008B',borderWidth:2,
            pointBackgroundColor:vals.map(v=>v===timelineStats.peakValue?'#00008B':'rgba(0,0,139,0.5)'),
            pointRadius:vals.map(v=>v===timelineStats.peakValue?5:2),
            pointHoverRadius:6,tension:0.4,
          }]},
          options:{...rAF,interaction:{mode:'index',intersect:false},
            plugins:{...noLegend,tooltip:{backgroundColor:'#0f172a',padding:10,cornerRadius:8,
              titleFont:{size:11},bodyFont:{size:13,weight:'bold'},
              callbacks:{title:i=>`📅 ${i[0].label}`,label:i=>`${i.raw} phản hồi`}}},
            scales:{
              x:{...noGrid,ticks:{font:{size:10},color:'#94a3b8',maxRotation:0,autoSkip:false,
                callback(value,index){
                  const every=Math.max(1,Math.ceil(totalPoints/7));
                  return index%every===0?fmtShortDate(sorted[index]?.ngay):'';
                }}},
              y:{...softGrid,beginAtZero:true,ticks:{stepSize:1,precision:0,font:{size:10},color:'#94a3b8'},
                title:{display:true,text:'Số phản hồi',color:'#64748b',font:{size:11,weight:'600'}}}
            }}
        });
      },100);
    }
  }

  // 2. Rating dist — bar chart giữ nguyên, click cột để xem danh sách người
  if(d.rating_dist&&d.rating_dist.length) {
    addChartCard('c-rating','Phân bổ đánh giá','half',210);
    setTimeout(()=>{
      const total=d.rating_dist.reduce((s,r)=>s+r.so_luong,0)||1;
      mkChart('c-rating',{
        type:'bar',
        data:{labels:d.rating_dist.map(r=>`${r.sao}★`),datasets:[{
          data:d.rating_dist.map(r=>r.so_luong),
          backgroundColor:d.rating_dist.map(r=>['#ea580c', '#f97316', '#60a5fa', '#2563eb', '#00008B'][r.sao-1]||'#94a3b8'),
          borderRadius:0,borderSkipped:false,
        }]},
        options:{...rAF,
          plugins:{...noLegend,tooltip:{callbacks:{label:ctx=>`${ctx.raw} người (${Math.round(ctx.raw/total*100)}%)`}}},
          scales:{x:{...noGrid,ticks:{font:{size:12}}},y:{...softGrid,beginAtZero:true,ticks:{stepSize:1,font:{size:10}}}},
          onClick:(e,els)=>{
            if(!els.length) return;
            const sao=d.rating_dist[els[0].index]?.sao;
            if(sao) showRatingPeopleOverall(sao);
          }
        }
      });
      const el=document.getElementById('c-rating');
      if(el) el.style.cursor='pointer';
    },100);
  }

  // 3. Cảm xúc — click vào phần để xem danh sách người
  if((d.form.tich_cuc||0)+(d.form.tieu_cuc||0)>0) {
    addChartCard('c-sentiment','Tỷ lệ cảm xúc','half',210);
    setTimeout(()=>{
      const pos=d.form.tich_cuc||0, neg=d.form.tieu_cuc||0;
      const total=d.form.so_phan_hoi||1;
      mkChart('c-sentiment',{
        type:'doughnut',
        data:{labels:['Tích cực','Tiêu cực'],datasets:[{
          data:[pos,neg],backgroundColor:[BLUE,RED],
          borderWidth:3,borderColor:'#fff',hoverOffset:6,
        }]},
        options:{...rAF,cutout:'65%',plugins:{
          legend:{position:'bottom',labels:{font:{size:11},boxWidth:10,padding:10,
            generateLabels:chart=>chart.data.labels.map((l,i)=>({
              text:`${l}  ${Math.round([pos,neg][i]/total*100)}%`,
              fillStyle:[BLUE,RED][i],strokeStyle:'transparent',index:i,
            }))}},
          tooltip:{callbacks:{label:ctx=>`${ctx.raw} người (${Math.round(ctx.raw/total*100)}%)`}}},
          onClick:(e,els)=>{
            if(!els.length) return;
            const camXuc = els[0].index===0 ? 'positive' : 'negative';
            const label  = camXuc==='positive' ? 'Tích cực 😊' : 'Tiêu cực 😞';
            const people = (rawRows||[]).filter(r=>r.cam_xuc===camXuc && r.ho_ten);
            _showPeopleModal(label, '', people);
          }
        },
        plugins:[{id:'center',afterDraw(chart){
          const{ctx:c,chartArea:{width,height,left,top}}=chart;
          c.save(); const cx=left+width/2,cy=top+height/2-12;
          c.textAlign='center';c.textBaseline='middle';
          c.font='bold 26px sans-serif';c.fillStyle='#0f172a';c.fillText(total,cx,cy);
          c.font='11px sans-serif';c.fillStyle='#94a3b8';c.fillText('phản hồi',cx,cy+20);
          c.restore();
        }}]
      });
      const el=document.getElementById('c-sentiment');
      if(el) el.style.cursor='pointer';
    },100);
  }

  // 4. So sánh điểm rating các câu hỏi — line chart đa màu
  const ratingQs = d.questions.filter(q => q.loai === 'rating');
  const choiceQs = d.questions.filter(q => q.loai === 'choice');

  // Tổng quan câu hỏi — 1 dropdown chung cho tất cả loại câu hỏi
  const allQs = d.questions;
  if (allQs.length) {
    addChartCard('c-question', 'Tổng quan câu hỏi', 'full', 340);
    setTimeout(() => {
      const wrap = document.querySelector('#slot-c-question .card-inner');
      if (!wrap) return;
      wrap.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">' +
          '<select id="q-all-selector" class="input" style="flex:1;height:36px;font-size:13px;border-radius:9px" onchange="renderOverviewChart()">' +
            allQs.map(q => {
              const icon = q.loai==='rating'?'⭐':q.loai==='choice'?'📊':'💬';
              return '<option value="' + q.id + '" data-loai="' + q.loai + '">' + icon + ' ' + esc(q.noi_dung) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div id="q-overview-body" style="min-height:200px"></div>' +
        '<div style="display:none"><canvas id="c-q-detail"></canvas><div id="q-stats-table"></div><div id="q-rating-bars"></div><canvas id="c-q-line"></canvas></div>';
      renderOverviewChart();
    }, 120);
  }
}

function renderOverviewChart() {
  const sel  = document.getElementById('q-all-selector');
  if (!sel) return;
  const qId  = parseInt(sel.value);
  const loai = sel.options[sel.selectedIndex]?.getAttribute('data-loai');
  const body = document.getElementById('q-overview-body');
  if (!body) return;
  body.innerHTML = '';

  const d = analysisData;

  if (loai === 'choice' || loai === 'checkbox' || loai === 'dropdown') {
    const stats = d.choice_stats.filter(s => s.cau_hoi_id === qId);
    if (!stats.length) { body.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:24px">Chưa có dữ liệu</div>'; return; }
    // Dùng renderDonutChoice nhưng target body trực tiếp
    const total = stats.reduce((s,x)=>s+x.so_chon,0)||1;
    const donutId = 'c-overview-donut';
    const tableId = 'c-overview-table';
    body.innerHTML =
      '<div style="display:grid;grid-template-columns:200px 1fr;gap:20px;align-items:center;min-height:200px">' +
        '<div style="position:relative;height:200px"><canvas id="'+donutId+'"></canvas></div>' +
        '<div id="'+tableId+'" style="display:flex;flex-direction:column;gap:10px"></div>' +
      '</div>';
    setTimeout(() => {
      destroyChart(donutId);
      mkChart(donutId, {
        type: 'doughnut',
        data: { labels: stats.map(s=>s.lua_chon), datasets:[{
          data: stats.map(s=>s.so_chon),
          backgroundColor: PALETTE.slice(0,stats.length).map(c=>c+'dd'),
          borderWidth: 3, borderColor: '#fff', hoverOffset: 6,
        }]},
        options: { ...rAF, cutout:'62%', plugins:{ legend:{display:false},
          tooltip:{ callbacks:{ label:ctx=>ctx.raw+' người ('+Math.round(ctx.raw/total*100)+'%)' }}}}
      });
      document.getElementById(tableId).innerHTML = stats.map((s,i) => {
        const pct = Math.round(s.so_chon/total*100);
        return '<div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">' +
            '<span style="font-size:12px;color:var(--gray-700);font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(s.lua_chon)+'</span>' +
            '<span style="font-size:12px;font-weight:700;color:'+PALETTE[i%PALETTE.length]+';margin-left:8px;white-space:nowrap">'+s.so_chon+' người ('+pct+'%)</span>' +
          '</div>' +
          '<div style="height:7px;background:#f1f5f9;border-radius:4px">' +
            '<div style="height:100%;width:'+pct+'%;background:'+PALETTE[i%PALETTE.length]+';border-radius:4px;transition:width .5s"></div>' +
          '</div></div>';
      }).join('');
    }, 60);

  } else if (loai === 'rating') {
    const rs = d.rating_stats.find(s=>s.cau_hoi_id===qId);
    if (!rs) { body.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:24px">Chưa có dữ liệu</div>'; return; }
    body.innerHTML = renderRatingHTML(rs, qId);

  } else if (loai === 'text' || loai === 'paragraph') {
    const textStats = (analysisData?.text_stats || []);
    const answers = textStats.filter(r => r.cau_hoi_id === qId && (r.noi_dung||'').trim().length > 2);
    if (!answers.length) {
      body.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:24px;font-size:13px">Chưa có câu trả lời cho câu hỏi này</div>';
      return;
    }
    body.innerHTML = renderAnswerList(answers);
  }
}

// Render danh sách câu trả lời kèm tên SV + điểm đánh giá
function renderAnswerList(answers) {
  return '<div style="font-size:12px;color:#94a3b8;margin-bottom:10px">' + answers.length + ' câu trả lời</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;max-height:240px;overflow-y:auto">' +
    answers.map((r,i) => {
      const colors = [BLUE, '#ea580c', '#2563eb', '#f97316', '#00008B', '#fb923c'];
      const color = colors[i % colors.length];
      return '<div style="padding:10px 14px;background:#f8fafc;border-left:3px solid '+color+';border-radius:0 10px 10px 0">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
          '<div style="font-size:11.5px;font-weight:700;color:'+color+'">' + esc(r.ho_ten||'Học viên') +
            (r.lop ? ' <span style="font-size:10.5px;color:#94a3b8;font-weight:400">· '+esc(r.lop)+'</span>' : '') +
          '</div>' +
        '</div>' +
        '<div style="font-size:12.5px;color:var(--gray-700);line-height:1.5">' + esc(r.noi_dung) + '</div>' +
      '</div>';
    }).join('') +
    '</div>';
}

// ── Rating chart dùng chung — dùng rating_dist_by_q per câu hỏi ──
function renderRatingHTML(rs, qId) {
  const avg = parseFloat(rs.diem_tb)||0;
  const color = avg>=4?BLUE:avg>=3?'#f59e0b':RED;
  const stars = Array.from({length:5},(_,i)=>
    '<svg viewBox="0 0 24 24" fill="'+(i<Math.round(avg)?'#fbbf24':'#e2e8f0')+'" width="20" height="20"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
  ).join('');
  const byQ = (analysisData.rating_dist_by_q||[]).filter(r=>r.cau_hoi_id===qId);
  const distData = [1,2,3,4,5].map(s => {
    const f = byQ.length ? byQ.find(r=>r.sao===s) : (analysisData.rating_dist||[]).find(r=>r.sao===s);
    return f ? f.so_luong : 0;
  });
  const distTotal = distData.reduce((a,b)=>a+b,0)||1;
  const starBars = [5,4,3,2,1].map(s => {
    const n = distData[s-1];
    const pct = Math.round(n/distTotal*100);
    const c = ['#ea580c', '#f97316', '#60a5fa', '#2563eb', '#00008B'][s-1]||'#94a3b8';
    return '<div onclick="showRatingPeople('+qId+','+s+')" style="display:flex;align-items:center;gap:8px;cursor:pointer;border-radius:8px;padding:3px 6px;transition:background .15s" onmouseenter="this.style.background=\'#f8fafc\'" onmouseleave="this.style.background=\'transparent\'">' +
      '<span style="font-size:12px;font-weight:700;color:'+c+';min-width:22px;text-align:right">'+s+'★</span>' +
      '<div style="flex:1;height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden">' +
        '<div style="height:100%;width:'+pct+'%;background:'+c+';border-radius:5px;transition:width .5s"></div>' +
      '</div>' +
      '<span style="font-size:12px;color:#94a3b8;min-width:80px">'+n+' người ('+pct+'%)</span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2" width="12" height="12"><polyline points="9 18 15 12 9 6"/></svg>' +
    '</div>';
  }).join('');
  return '<div style="display:flex;align-items:stretch;gap:20px;width:100%">' +
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:130px;border-right:1px solid #f1f5f9;padding-right:24px">' +
      '<div style="font-size:56px;font-weight:800;color:'+color+';letter-spacing:-2px;line-height:1">'+avg.toFixed(1)+'</div>' +
      '<div style="font-size:12px;color:#94a3b8;margin:5px 0">/ 5 sao</div>' +
      '<div style="display:flex;gap:2px;margin-bottom:6px">'+stars+'</div>' +
      '<div style="font-size:12px;color:#94a3b8">'+rs.so_tra_loi+' câu trả lời</div>' +
    '</div>' +
    '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:4px">'+starBars+'</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;justify-content:center;min-width:90px">' +
      '<div style="background:#f0fdf4;border-radius:10px;padding:12px 16px;text-align:center">' +
        '<div style="font-size:22px;font-weight:800;color:#059669">'+rs.max_diem+'★</div>' +
        '<div style="font-size:11px;color:#16a34a;margin-top:2px">Cao nhất</div>' +
      '</div>' +
      '<div style="background:#fff1f2;border-radius:10px;padding:12px 16px;text-align:center">' +
        '<div style="font-size:22px;font-weight:800;color:#dc2626">'+rs.min_diem+'★</div>' +
        '<div style="font-size:11px;color:#dc2626;margin-top:2px">Thấp nhất</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function showRatingPeople(qId, sao) {
  const c = ['#ea580c', '#f97316', '#60a5fa', '#2563eb', '#00008B'][sao-1]||'#94a3b8';
  const old = document.getElementById('rating-people-modal'); if(old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'rating-people-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)';
  modal.innerHTML =
    '<div style="background:var(--gray-50);border-radius:20px;padding:24px;width:520px;max-width:94vw;max-height:80vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.18)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
        '<div>' +
          '<div style="font-size:16px;font-weight:800;color:var(--gray-900)">Người đánh giá '+sao+'★</div>' +
          '<div id="rpm-sub" style="font-size:12px;color:#94a3b8;margin-top:2px">Đang tải...</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'rating-people-modal\').remove()" style="width:32px;height:32px;border-radius:9px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;font-size:18px;color:#94a3b8">✕</button>' +
      '</div>' +
      '<div id="rpm-body" style="display:flex;flex-direction:column;gap:8px">' +
        '<div style="text-align:center;padding:24px;color:#94a3b8">⏳ Đang tải dữ liệu...</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });

  const rpmToken = localStorage.getItem('token') || '';
  fetch(API+'/reports/rating-people/'+currentFormId+'/'+qId+'/'+sao, {
    headers: rpmToken ? { Authorization: `Bearer ${rpmToken}` } : {}
  })
    .then(r=>r.json()).then(people => {
      document.getElementById('rpm-sub').textContent = people.length + ' người';
      const body = document.getElementById('rpm-body');
      if (!body) return;
      if (!people.length) {
        body.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">Không có ai đánh giá '+sao+'★ cho câu hỏi này.</div>';
        return;
      }
      const colors = [BLUE, '#ea580c', '#2563eb', '#f97316', '#00008B', '#fb923c'];
      body.innerHTML = people.map((r,i) =>
        '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:#f8fafc;border-left:3px solid '+colors[i%colors.length]+';border-radius:0 10px 10px 0">' +
          '<div style="flex:1">' +
            '<div style="font-size:13px;font-weight:700;color:'+colors[i%colors.length]+'">'+esc(r.ho_ten||'Học viên')+'</div>' +
            '<div style="font-size:11px;color:#94a3b8;margin-top:1px">'+(r.lop?esc(r.lop):'')+(r.khoa?' · '+esc(r.khoa):'')+'</div>' +
          '</div>' +
          (r.giao_vien?'<div style="font-size:11.5px;color:#64748b">'+esc(r.giao_vien)+'</div>':'') +
        '</div>'
      ).join('');
    }).catch(()=>{
      const body = document.getElementById('rpm-body');
      if(body) body.innerHTML = '<div style="text-align:center;padding:24px;color:#ef4444;font-size:13px">Không tải được dữ liệu.</div>';
    });
}


// ── Hiện modal danh sách người — dùng rawRows local, không cần API ──
function _showPeopleModal(title, sub, people) {
  const old = document.getElementById('rating-people-modal'); if(old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'rating-people-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)';
  const colors = ['#00008B', '#ea580c', '#06b6d4', '#facc15', '#3b82f6', '#ef4444', '#0f766e', '#fdba74', '#6366f1', '#b45309', '#10b981', '#db2777', '#8b5cf6', '#84cc16', '#1e3a8a', '#f97316', '#14b8a6', '#f43f5e', '#8b1c62', '#059669'];
  const rows = people.length
    ? people.map((r,i)=>
        '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:#f8fafc;border-left:3px solid '+colors[i%colors.length]+';border-radius:0 10px 10px 0">' +
          '<div style="flex:1">' +
            '<div style="font-size:13px;font-weight:700;color:'+colors[i%colors.length]+'">'+esc(r.ho_ten||'Học viên')+'</div>' +
            '<div style="font-size:11px;color:#94a3b8;margin-top:1px">'+(r.lop?esc(r.lop):'')+(r.khoa?' · '+esc(r.khoa):'')+'</div>' +
          '</div>' +
          (r.giao_vien?'<div style="font-size:11.5px;color:#64748b">'+esc(r.giao_vien)+'</div>':'') +
        '</div>'
      ).join('')
    : '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">Không có dữ liệu.</div>';
  modal.innerHTML =
    '<div style="background:var(--gray-50);border-radius:20px;padding:24px;width:520px;max-width:94vw;max-height:80vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.18)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
        '<div>' +
          '<div style="font-size:16px;font-weight:800;color:var(--gray-900)">'+esc(title)+'</div>' +
          '<div style="font-size:12px;color:#94a3b8;margin-top:2px">'+people.length+' người'+esc(sub)+'</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'rating-people-modal\').remove()" style="width:32px;height:32px;border-radius:9px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;font-size:18px;color:#94a3b8">✕</button>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">'+rows+'</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

// Phân bổ đánh giá tổng (c-rating mặc định) — lọc rawRows theo danh_gia
function showRatingPeopleOverall(sao) {
  const people = (rawRows||[]).filter(r=>parseInt(r.danh_gia)===sao && r.ho_ten);
  _showPeopleModal('Người đánh giá '+sao+'★', '', people);
}




function renderDonutChoice(cid, stats) {
  stats.sort((a,b) => b.so_chon - a.so_chon);
  const total = stats.reduce((s,x)=>s+x.so_chon,0)||1;
  const donutId = 'donut-' + cid;
  const tableId = 'table-' + cid;
  const wrap = document.querySelector('#slot-'+cid+' .card-inner');
  if (!wrap) return;
  wrap.innerHTML =
    '<div style="display:grid;grid-template-columns:200px 1fr;gap:20px;align-items:center;min-height:200px">' +
      '<div style="position:relative;height:200px"><canvas id="'+donutId+'"></canvas></div>' +
      '<div id="'+tableId+'" style="display:flex;flex-direction:column;gap:10px;max-height:240px;overflow-y:auto;padding-right:8px"></div>' +
    '</div>';
  setTimeout(() => {
    destroyChart(donutId);
    mkChart(donutId, {
      type: 'doughnut',
      data: { labels: stats.map(s=>s.lua_chon), datasets:[{
        data: stats.map(s=>s.so_chon),
        backgroundColor: PALETTE.slice(0,stats.length).map(c=>c+'dd'),
        borderWidth: 3, borderColor: '#fff', hoverOffset: 6,
      }]},
      options: { ...rAF, cutout:'62%', plugins:{ legend:{display:false},
        tooltip:{ callbacks:{ label:ctx=>ctx.raw+' người ('+Math.round(ctx.raw/total*100)+'%)' }}},
        // Hiển thị số người ở giữa donut khi hover
      }
    });
    document.getElementById(tableId).innerHTML = stats.map((s,i) => {
      const pct = Math.round(s.so_chon/total*100);
      return '<div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">' +
          '<span style="font-size:12px;color:var(--gray-700);font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(s.lua_chon)+'</span>' +
          '<span style="font-size:12px;font-weight:700;color:'+PALETTE[i%PALETTE.length]+';margin-left:8px;white-space:nowrap">'+s.so_chon+' người ('+pct+'%)</span>' +
        '</div>' +
        '<div style="height:7px;background:#f1f5f9;border-radius:4px">' +
          '<div style="height:100%;width:'+pct+'%;background:'+PALETTE[i%PALETTE.length]+';border-radius:4px;transition:width .5s"></div>' +
        '</div></div>';
    }).join('');
  }, 60);
}

function switchOverviewTab(tab) {
  const isChart = tab === 'chart';
  const cp = document.getElementById('ovpanel-chart');
  const tp = document.getElementById('ovpanel-text');
  if (cp) cp.style.display = isChart ? 'block' : 'none';
  if (tp) tp.style.display = isChart ? 'none'  : 'block';
  const bc = document.getElementById('ovtab-chart');
  const bt = document.getElementById('ovtab-text');
  if (bc) { bc.style.background = isChart ? '#00008B' : '#fff'; bc.style.color = isChart ? '#fff' : '#64748b'; bc.style.border = isChart ? 'none' : '1.5px solid #e2e8f0'; }
  if (bt) { bt.style.background = isChart ? '#fff' : '#00008B'; bt.style.color = isChart ? '#64748b' : '#fff'; bt.style.border = isChart ? '1.5px solid #e2e8f0' : 'none'; }
  if (!isChart) renderTextAnswers();
}

function renderTextAnswers() {
  const sel  = document.getElementById('q-text-selector');
  const body = document.getElementById('q-text-body');
  if (!sel || !body) return;
  const qId = parseInt(sel.value);
  body.innerHTML = '';

  // Lấy câu trả lời từ text_stats (ChiTietPhanHoi.noi_dung_tra_loi)
  const textStats = (analysisData?.text_stats || []);
  const answers = textStats
    .filter(r => r.cau_hoi_id === qId && (r.noi_dung||'').trim().length > 2);

  if (!answers.length) {
    body.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:24px;font-size:13px">Chưa có câu trả lời cho câu hỏi này</div>';
    return;
  }
  body.innerHTML = renderAnswerList(answers);
}

function switchQTab(tab) {
  const isRating = tab === 'rating';
  document.getElementById('qtab-rating-panel').style.display = isRating ? 'block' : 'none';
  const cp = document.getElementById('qtab-choice-panel');
  if (cp) cp.style.display = isRating ? 'none' : 'block';
  const br = document.getElementById('qtab-rating');
  const bc = document.getElementById('qtab-choice');
  if (br) { br.style.background = isRating ? '#00008B' : '#fff'; br.style.color = isRating ? '#fff' : '#64748b'; br.style.border = isRating ? 'none' : '1.5px solid #e2e8f0'; }
  if (bc) { bc.style.background = isRating ? '#fff' : '#00008B'; bc.style.color = isRating ? '#64748b' : '#fff'; bc.style.border = isRating ? '1.5px solid #e2e8f0' : 'none'; }
  if (!isRating) renderQuestionChart();
}

function renderQuestionChart() {
  const qId=parseInt(document.getElementById('q-selector')?.value);
  const d=analysisData;
  const q=d.questions.find(x=>x.id===qId); if(!q) return;

  if(q.loai==='choice') {
    const stats=d.choice_stats.filter(s=>s.cau_hoi_id===qId);
    const total=stats.reduce((s,x)=>s+x.so_chon,0)||1;
    destroyChart('c-q-detail');
    mkChart('c-q-detail',{
      type:'bar',
      data:{labels:stats.map(s=>s.lua_chon),datasets:[{
        data:stats.map(s=>s.so_chon),
        backgroundColor:'#00008B',
        borderRadius:0,borderSkipped:false,
      }]},
      options:{...rAF,indexAxis:'y',
        plugins:{...noLegend,tooltip:{callbacks:{label:ctx=>`${ctx.raw} người (${Math.round(ctx.raw/total*100)}%)`}}},
        scales:{x:{...softGrid,beginAtZero:true,ticks:{font:{size:10}}},y:{...noGrid,ticks:{font:{size:11}}}}}
    });
    document.getElementById('q-stats-table').innerHTML=`
      <div style="display:flex;flex-direction:column;gap:10px">
        ${stats.map((s,i)=>{const pct=Math.round(s.so_chon/total*100);return `
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:12px;color:var(--gray-700);font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.lua_chon)}</span>
            <span style="font-size:12px;font-weight:700;color:${PALETTE[i%PALETTE.length]};margin-left:8px">${pct}%</span>
          </div>
          <div style="height:7px;background:#f1f5f9;border-radius:4px">
            <div style="height:100%;width:${pct}%;background:${PALETTE[i%PALETTE.length]};border-radius:4px;transition:width .5s ease"></div>
          </div>
        </div>`}).join('')}
      </div>`;

  } else if(q.loai==='rating') {
    const rs = d.rating_stats.find(s=>s.cau_hoi_id===qId); if(!rs) return;
    const avg = parseFloat(rs.diem_tb)||0;
    const dist = [1,2,3,4,5].map(s => { const f=(d.rating_dist||[]).find(r=>r.sao===s); return f?f.so_luong:0; });
    const tot = dist.reduce((a,b)=>a+b,0)||1;
    destroyChart('c-q-detail');
    mkChart('c-q-detail',{
      type:'bar',
      data:{labels:['1★','2★','3★','4★','5★'],datasets:[{
        data:dist,
        backgroundColor:[1,2,3,4,5].map(s=>['#ea580c', '#f97316', '#60a5fa', '#2563eb', '#00008B'][s-1]),
        borderRadius:0, borderSkipped:false,
      }]},
      options:{...rAF,
        plugins:{...noLegend,tooltip:{callbacks:{label:ctx=>ctx.raw+' người ('+Math.round(ctx.raw/tot*100)+'%)'}}},
        scales:{x:{...noGrid,ticks:{font:{size:12}}},y:{...softGrid,beginAtZero:true,ticks:{stepSize:1}}}}
    });
    const color = avg>=4?'#059669':avg>=3?'#d97706':'#ef4444';
    document.getElementById('q-stats-table').innerHTML =
      '<div style="display:flex;flex-direction:column;gap:10px">' +
        '<div style="text-align:center;padding:14px;background:#f8fafc;border-radius:12px">' +
          '<div style="font-size:36px;font-weight:800;color:'+color+'">'+avg.toFixed(1)+'★</div>' +
          '<div style="font-size:11px;color:#94a3b8;margin-top:2px">Điểm trung bình</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          '<div style="background:#f0fdf4;border-radius:10px;padding:12px;text-align:center">' +
            '<div style="font-size:22px;font-weight:800;color:#059669">'+rs.max_diem+'★</div>' +
            '<div style="font-size:10px;color:#16a34a;margin-top:2px">Cao nhất</div></div>' +
          '<div style="background:#fff1f2;border-radius:10px;padding:12px;text-align:center">' +
            '<div style="font-size:22px;font-weight:800;color:#dc2626">'+rs.min_diem+'★</div>' +
            '<div style="font-size:10px;color:#dc2626;margin-top:2px">Thấp nhất</div></div>' +
        '</div>' +
        '<div style="text-align:center"><div style="font-size:20px;font-weight:800;color:var(--brand-color)">'+rs.so_tra_loi+'</div>' +
        '<div style="font-size:10px;color:#64748b">câu trả lời</div></div>' +
      '</div>';
  }
}

function getActiveReportFormMeta() {
  const forms = Array.isArray(window._cachedDbForms) ? window._cachedDbForms : [];
  return forms.find(f => String(f.id ?? f.form_id) === String(currentFormId)) || {};
}

function setFormDetailOverviewVisibility(show) {
  ['rpt-ai-title','rpt-ai-summary','rpt-ai-grid','rpt-participant-title','rpt-participant-grid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  });
}

function sameReportQuestionId(a, b) {
  return String(a) === String(b) || Number(a) === Number(b);
}

function reportQuestionLabel(type) {
  return ({
    choice:'Trắc nghiệm 1 lựa chọn',
    checkbox:'Checkbox nhiều lựa chọn',
    dropdown:'Dropdown',
    rating:'Thang điểm / đánh giá sao',
    scale:'Thang điểm',
    text:'Văn bản ngắn',
    paragraph:'Đoạn văn',
    date:'Ngày',
    time:'Thời gian',
    upload:'Upload file',
    file:'Upload file',
    grid_radio:'Ma trận',
    grid_checkbox:'Ma trận'
  })[reportQuestionType(type)] || 'Câu hỏi';
}

function getQuestionChoiceStats(q) {
  const qId = q.id;
  const options = (q.lua_chon || q.opts || [])
    .map(opt => typeof opt === 'string' ? opt : (opt?.noi_dung || opt?.label || ''))
    .filter(Boolean);
  const stats = (analysisData.choice_stats || [])
    .filter(s => sameReportQuestionId(s.cau_hoi_id, qId))
    .map(s => ({ lua_chon: s.lua_chon || s.noi_dung || '', so_chon: Number(s.so_chon || s.count || 0) }));
  const map = {};
  options.forEach(o => { map[o] = 0; });
  stats.forEach(s => { if (s.lua_chon) map[s.lua_chon] = (map[s.lua_chon] || 0) + s.so_chon; });
  const merged = Object.entries(map).map(([lua_chon, so_chon]) => ({ lua_chon, so_chon }));
  return merged.length ? merged : stats;
}

function getQuestionRatingDistribution(q) {
  const qId = q.id;
  const byQ = (analysisData.rating_dist_by_q || []).filter(r => sameReportQuestionId(r.cau_hoi_id, qId));
  const vals = [1,2,3,4,5].map(sao => {
    const found = byQ.find(r => Number(r.sao) === sao);
    return found ? Number(found.so_luong || 0) : 0;
  });
  if (vals.some(Boolean)) return vals;
  const fromRows = (rawRows || [])
    .map(r => Number(r['q_' + qId] || r[qId] || r[q.noi_dung]))
    .filter(v => v >= 1 && v <= 5);
  return [1,2,3,4,5].map(sao => fromRows.filter(v => v === sao).length);
}

function getQuestionTextAnswers(q) {
  const qId = q.id;
  const fromStats = (analysisData.text_stats || [])
    .filter(r => sameReportQuestionId(r.cau_hoi_id, qId) && String(r.noi_dung || '').trim())
    .map(r => ({
      text: String(r.noi_dung || '').trim(),
      name: r.ho_ten || 'Ẩn danh',
      meta: [r.lop, r.khoa, r.giao_vien].filter(Boolean).join(' - '),
      sentiment: r.cam_xuc || ''
    }));
  if (fromStats.length) return fromStats;
  return (rawRows || [])
    .map(r => String(r['q_' + qId] || r[qId] || r[q.noi_dung] || '').trim())
    .filter(Boolean)
    .map(text => ({ text, name:'Ẩn danh', meta:'', sentiment:'' }));
}

function renderReportTextAnswers(qId, keyword = '') {
  const q = (analysisData?.questions || []).find(item => sameReportQuestionId(item.id, qId));
  if (!q) return '';
  const kw = String(keyword || '').trim().toLowerCase();
  const answers = getQuestionTextAnswers(q).filter(a => !kw || a.text.toLowerCase().includes(kw));
  if (!answers.length) return '<div style="padding:22px;text-align:center;color:#94a3b8;font-size:13px;font-weight:700">Chưa có câu trả lời phù hợp</div>';
  const sentimentMap = {
    positive: ['Tích cực', '#dcfce7', '#166534'],
    neutral: ['Trung lập', '#f1f5f9', '#475569'],
    negative: ['Tiêu cực', '#fee2e2', '#991b1b']
  };
  const colors = ['#00008B', '#ea580c', '#06b6d4', '#facc15', '#3b82f6', '#ef4444', '#0f766e', '#fdba74', '#6366f1', '#b45309', '#10b981', '#db2777', '#8b5cf6', '#84cc16', '#1e3a8a', '#f97316', '#14b8a6', '#f43f5e', '#8b1c62', '#059669'];
  return answers.map((a, i) => {
    const s = sentimentMap[a.sentiment] || null;
    const color = colors[i % colors.length];
    
    let textHtml = esc(a.text);
    if (a.text.includes('http')) {
      textHtml = textHtml.replace(/(https?:\/\/[^\s,<]+)/g, url => `<a href="${url}" target="_blank" style="color:#2563eb;text-decoration:none;display:inline-flex;align-items:center;gap:4px;background:#eff6ff;padding:2px 8px;border-radius:6px;font-weight:600;margin-right:4px;margin-top:2px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>Tệp đính kèm</a>`);
    }

    return `
      <div style="padding:12px 0;border-bottom:1px solid #f1f5f9">
        <div style="padding-left:12px;border-left:3px solid ${color}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px">
            <div style="font-size:12px;font-weight:800;color:${color}">${esc(a.name)}${a.meta ? `<span style="color:#94a3b8;font-weight:500;margin-left:6px">· ${esc(a.meta)}</span>` : ''}</div>
            ${s ? `<span style="flex-shrink:0;padding:3px 8px;border-radius:999px;background:${s[1]};color:${s[2]};font-size:10px;font-weight:800">${s[0]}</span>` : ''}
          </div>
          <div style="font-size:13px;color:var(--gray-900);line-height:1.5;word-break:break-word">${textHtml}</div>
        </div>
      </div>`;
  }).join('');
}

function filterReportTextAnswers(qId, keyword) {
  const body = document.getElementById('rpt-text-answers-' + qId);
  if (body) body.innerHTML = renderReportTextAnswers(qId, keyword);
}

function renderDetailTimeline(range = 'all') {
  const timeline = [...(analysisData?.timeline || [])].sort((a,b) => String(a.ngay).localeCompare(String(b.ngay)));
  const body = document.getElementById('rpt-detail-timeline-body');
  if (!body) return;
  const buttons = document.querySelectorAll('[data-rpt-range]');
  buttons.forEach(btn => {
    const active = btn.dataset.rptRange === range;
    btn.style.background = active ? '#00008B' : '#fff';
    btn.style.color = active ? '#fff' : '#475569';
    btn.style.borderColor = active ? '#00008B' : '#dbe5f0';
  });
  let items = timeline;
  if (range !== 'all' && timeline.length) {
    const days = Number(range);
    const maxDate = timeline.reduce((best, item) => new Date(item.ngay) > new Date(best.ngay) ? item : best, timeline[0]);
    const from = new Date(maxDate.ngay);
    from.setDate(from.getDate() - days + 1);
    items = timeline.filter(item => new Date(item.ngay) >= from);
  }
  if (!items.length) {
    destroyChart('rpt-detail-timeline');
    body.innerHTML = '<div style="height:220px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;font-weight:700">Chưa có dữ liệu thời gian</div>';
    return;
  }
  let compareHtml = '';
  // Build stats for the stat cards
  const statsItems = items.map(t => ({ngay: t.ngay, so_luong: Number(t.so_luong || 0)}));
  const tlStats = buildTimelineStats(statsItems);

  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:16px">
      <div style="display:inline-flex;align-items:center;gap:16px;padding:8px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px">
        <div style="display:flex;align-items:baseline;gap:6px">
          <span style="font-size:12px;color:#64748b;font-weight:600">Cao nhất / tuần:</span>
          <span style="font-size:15px;font-weight:800;color:var(--gray-900)">${tlStats.peakWeek}</span>
          <span style="font-size:11px;color:#94a3b8">(${tlStats.peakWeekLabel || '--'})</span>
        </div>
        <div style="width:1px;height:14px;background:#cbd5e1"></div>
        <div style="display:flex;align-items:baseline;gap:6px">
          <span style="font-size:12px;color:#64748b;font-weight:600">Cao nhất / ngày:</span>
          <span style="font-size:15px;font-weight:800;color:var(--gray-900)">${tlStats.peakValue}</span>
          <span style="font-size:11px;color:#94a3b8">(${tlStats.peakDate ? fmtDate(tlStats.peakDate) : '--'})</span>
        </div>
      </div>
    </div>
    <div style="height:220px"><canvas id="rpt-detail-timeline"></canvas></div>${compareHtml}`;
  const vals = items.map(t => Number(t.so_luong || 0));
  const totalPoints = items.length;
  mkChart('rpt-detail-timeline', {
    type:'line',
    data:{labels:items.map(t=>fmtDate(t.ngay)),datasets:[{
      data:vals,
      fill:true,
      backgroundColor:ctx => {
        const g = ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height);
        g.addColorStop(0,'rgba(59,130,246,0.08)');
        g.addColorStop(1,'rgba(59,130,246,0.005)');
        return g;
      },
      borderColor:'#3b82f6',
      borderWidth:1.5,
      borderDash:[4,3],
      pointRadius:vals.map(v => v === tlStats.peakValue ? 5 : 0),
      pointBackgroundColor:vals.map(v => v === tlStats.peakValue ? '#2563eb' : '#3b82f6'),
      pointBorderColor:'#fff',
      pointBorderWidth:1.5,
      pointHoverRadius:5,
      pointHoverBackgroundColor:'#2563eb',
      tension:.35
    }]},
    options:{...rAF,interaction:{mode:'index',intersect:false},
      plugins:{...noLegend,tooltip:{backgroundColor:'#0f172a',padding:10,cornerRadius:8,titleFont:{size:11},bodyFont:{size:13,weight:'bold'},callbacks:{title:i=>`📅 ${i[0].label}`,label:ctx=>ctx.raw + ' phản hồi'}}},
      scales:{
        x:{...noGrid,ticks:{font:{size:10,weight:'500'},color:'#94a3b8',maxRotation:0,autoSkip:false,
          callback(value,index){
            const every = Math.max(1, Math.ceil(totalPoints / 7));
            return index % every === 0 ? fmtShortDate(items[index]?.ngay) : '';
          }}},
        y:{...softGrid,beginAtZero:true,ticks:{stepSize:1,precision:0,font:{size:10},color:'#94a3b8'},
          title:{display:true,text:'Số phản hồi',color:'#94a3b8',font:{size:10,weight:'500'}}}
      }}
  });
}

function renderQuestionDetailCard(q, index) {
  const type = reportQuestionType(q.loai || q.type);
  const title = q.noi_dung || q.text || ('Câu hỏi ' + (index + 1));
  const qId = q.id;
  const chartId = 'rpt-q-chart-' + qId;
  const supportsChoice = ['choice','checkbox','dropdown'].includes(type);
  const supportsRating = ['rating','star_rating','scale'].includes(type);
  const supportsText = ['text','paragraph','short_text','long_text'].includes(type);
  const supportsGrid = ['grid_radio','grid_checkbox'].includes(type);
  let body = '';
  if (supportsText) {
    body = `
      <div style="margin-bottom:12px">
        <input class="input" placeholder="Tìm kiếm câu trả lời..." oninput="filterReportTextAnswers('${qId}', this.value)" style="height:38px;border-radius:10px;font-size:13px">
      </div>
      <div id="rpt-text-answers-${qId}" style="max-height:310px;overflow-y:auto;padding-right:4px">${renderReportTextAnswers(qId)}</div>`;
  } else if (supportsChoice) {
    body = `
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px;align-items:center">
        <div style="height:260px"><canvas id="${chartId}"></canvas></div>
        <div id="rpt-q-side-${qId}"></div>
      </div>`;
  } else if (supportsRating) {
    body = `<div id="rpt-q-rating-container-${qId}"></div>`;
  } else if (supportsGrid) {
    body = `
      <div style="display:flex;flex-direction:column;gap:18px">
        <div style="min-height:300px;width:100%"><canvas id="${chartId}"></canvas></div>
        <div id="rpt-q-side-${qId}"></div>
      </div>`;
  } else {
    const answers = getQuestionTextAnswers(q);
    body = answers.length
      ? `<div style="max-height:280px;overflow-y:auto">${renderReportTextAnswers(qId)}</div>`
      : '<div style="padding:28px;text-align:center;color:#94a3b8;font-size:13px;font-weight:700">Loại câu hỏi này hiện chưa có dữ liệu tổng hợp phù hợp</div>';
  }
  return `
    <div class="dash-card report-question-card" data-question-id="${esc(qId)}" data-question-type="${esc(type)}">
      <div class="dash-card-header" style="padding-bottom:12px;border-bottom:1px solid #f1f5f9">
        <div style="display:flex;gap:12px;align-items:flex-start;min-width:0">
          <div style="width:34px;height:34px;border-radius:50%;background:#00008B;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0">${index + 1}</div>
          <div style="min-width:0">
            <div class="dash-card-title" style="font-size:16px;line-height:1.35">${esc(title)}</div>
            <div class="dash-card-sub" style="margin-top:4px">${reportQuestionLabel(type)}</div>
          </div>
        </div>
      </div>
      <div class="dash-card-body">${body}</div>
    </div>`;
}

function renderReportResponseTable() {
  const rows = (activeReportRows && activeReportRows.length ? activeReportRows : rawRows || []).slice(0, 50);
  const questions = (analysisData?.questions || []).slice(0, 4);
  const headers = ['Người gửi', 'Email', 'Ngày gửi', 'Trạng thái', ...questions.map(q => q.noi_dung || 'Câu hỏi')];
  const body = rows.length
    ? rows.map(r => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:var(--gray-900);font-weight:700">${esc(r.ho_ten || 'Ẩn danh')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:var(--gray-600)">${esc(r.email || '-')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:var(--gray-600)">${esc(fmtDate(r.ngay_gui))}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:var(--gray-600)">${esc(responseStatusLabel(r.trang_thai || 'active'))}</td>
        ${questions.map(q => `<td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:var(--gray-600)">${esc(shortReportCell(r['q_' + q.id]))}</td>`).join('')}
      </tr>`).join('')
    : `<tr><td colspan="${headers.length}" style="text-align:center;color:#94a3b8;font-weight:700;padding:24px">Chưa có dữ liệu phản hồi</td></tr>`;
  return `
    <div class="dash-card report-chart-card" style="grid-column:1/-1">
      <div class="dash-card-header" style="padding-bottom:12px;border-bottom:1px solid #f1f5f9">
        <div>
          <div class="dash-card-title">Dữ liệu phản hồi</div>
          <div class="dash-card-sub">Hiển thị tối đa 50 phản hồi theo bộ lọc hiện tại</div>
        </div>
      </div>
      <div class="dash-card-body" style="overflow:auto">
        <table style="width:100%;border-collapse:collapse;min-width:760px;font-size:13px">
          <thead>
            <tr>${headers.map(h => `<th style="text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11px;text-transform:uppercase">${esc(h)}</th>`).join('')}</tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
}

function shortReportCell(value) {
  const text = normalizeReportText(value);
  if (!text) return '-';
  return text.length > 90 ? text.slice(0, 87) + '...' : text;
}

function drawQuestionDetailCharts() {
  (analysisData?.questions || []).forEach(q => {
    try {
      const type = reportQuestionType(q.loai || q.type);
      const qId = q.id;
      const chartId = 'rpt-q-chart-' + qId;
      const side = document.getElementById('rpt-q-side-' + qId);
      
      if (['choice','checkbox','dropdown'].includes(type)) {
        const stats = getQuestionChoiceStats(q).filter(s => String(s.lua_chon || '').trim());
        const total = stats.reduce((sum,s) => sum + Number(s.so_chon || 0), 0) || 1;
        if (!stats.length) {
          if (side) side.innerHTML = '<div style="color:#94a3b8;font-size:13px;font-weight:700">Chưa có lựa chọn nào được chọn</div>';
          return;
        }
        mkChart(chartId, {
          type: type === 'choice' ? 'doughnut' : 'bar',
          data:{labels:stats.map(s=>s.lua_chon),datasets:[{data:stats.map(s=>s.so_chon),backgroundColor:stats.map((_,i)=>PALETTE[i%PALETTE.length]),borderWidth:0,borderRadius:type==='choice'?0:8,borderSkipped:false}]},
          options: type === 'choice'
            ? {...rAF,cutout:'62%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,font:{size:11,weight:'700'}}},tooltip:{callbacks:{label:ctx=>ctx.raw+' phản hồi ('+Math.round(ctx.raw/total*100)+'%)'}}}}
            : {...rAF,indexAxis:'y',plugins:{...noLegend,tooltip:{callbacks:{label:ctx=>ctx.raw+' phản hồi ('+Math.round(ctx.raw/total*100)+'%)'}}},scales:{x:{...softGrid,beginAtZero:true,ticks:{precision:0}},y:{...noGrid,ticks:{font:{size:11,weight:'700'}}}}}
        });
        if (side) side.innerHTML = stats.map((s,i) => {
          const pct = Math.round(Number(s.so_chon || 0) / total * 100);
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">
              <span style="font-size:12.5px;color:var(--gray-700);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.lua_chon)}</span>
              <span style="font-size:12px;font-weight:900;color:${PALETTE[i%PALETTE.length]}">${pct}%</span>
            </div>
            <div style="height:8px;background:#f1f5f9;border-radius:999px"><div style="height:100%;width:${pct}%;background:${PALETTE[i%PALETTE.length]};border-radius:999px"></div></div>
            <div style="font-size:11px;color:#94a3b8;margin-top:3px">${s.so_chon} lượt chọn</div>
          </div>`;
        }).join('');
      } else if (['rating','star_rating','scale'].includes(type)) {
        const rs = (analysisData.rating_stats || []).find(s => sameReportQuestionId(s.cau_hoi_id, qId));
        const dist = getQuestionRatingDistribution(q);
        const total = dist.reduce((a,b)=>a+b,0) || Number(rs?.so_tra_loi || 0) || 1;
        
        let avgVal = Number(rs?.diem_tb || 0);
        let minVal = rs?.min_diem ?? null;
        let maxVal = rs?.max_diem ?? null;
        
        if (!avgVal && dist.some(d => d > 0)) {
          let sum = 0, count = 0;
          dist.forEach((c, i) => { sum += c * (i + 1); count += c; });
          if (count > 0) avgVal = sum / count;
          
          const activeIdx = dist.map((c, i) => c > 0 ? i + 1 : null).filter(Boolean);
          if (activeIdx.length) {
            minVal = Math.min(...activeIdx);
            maxVal = Math.max(...activeIdx);
          }
        }

        const ratingContainer = document.getElementById(`rpt-q-rating-container-${qId}`);
        if (ratingContainer) {
          const ratingColors = ['#ea580c', '#f97316', '#fb923c', '#3b82f6', '#00008B'];
          let barsHtml = '';
          for (let i = 4; i >= 0; i--) {
            const count = dist[i] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const color = ratingColors[i];
            barsHtml += `
              <div style="display:flex;align-items:center;gap:12px;font-size:12px;font-weight:700">
                <div style="width:24px;color:${color}">${i+1}★</div>
                <div style="flex:1;height:8px;background:#f1f5f9;border-radius:999px">
                  <div style="height:100%;width:${pct}%;background:${color};border-radius:999px"></div>
                </div>
                <div style="width:85px;text-align:right;color:#94a3b8;font-size:11px;font-weight:600">${count} người <span style="opacity:0.6">(${pct}%)</span></div>
              </div>`;
          }

          ratingContainer.innerHTML = `
            <div style="display:flex;align-items:center;gap:24px;padding:10px 0">
              <div style="width:140px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px">
                <div style="font-size:52px;font-weight:900;color:var(--brand-color);line-height:1;letter-spacing:-0.03em">${avgVal ? fmt(avgVal) : '0'}</div>
                <div style="font-size:11px;color:#94a3b8;font-weight:600;margin-bottom:4px">/ 5 sao</div>
                <div style="color:#e2e8f0;font-size:18px;letter-spacing:1px;position:relative;display:inline-block">
                  ★★★★★
                  <div style="color:#f59e0b;position:absolute;top:0;left:0;overflow:hidden;width:${avgVal/5*100}%;white-space:nowrap">★★★★★</div>
                </div>
                <div style="font-size:11.5px;color:#94a3b8;font-weight:600;margin-top:6px">${total} câu trả lời</div>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;gap:12px;padding:0 24px;border-left:1px solid #f1f5f9;border-right:1px solid #f1f5f9">
                ${barsHtml}
              </div>
              <div style="width:110px;display:flex;flex-direction:column;gap:10px">
                <div style="padding:14px 10px;border-radius:12px;background:#ecfdf5;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">
                  <div style="color:#047857;font-size:20px;font-weight:900;line-height:1">${maxVal ? maxVal + '<span style="font-size:15px;margin-left:2px">★</span>' : '—'}</div>
                  <div style="font-size:11px;color:#059669;font-weight:700;margin-top:4px">Cao nhất</div>
                </div>
                <div style="padding:14px 10px;border-radius:12px;background:#fef2f2;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">
                  <div style="color:#dc2626;font-size:20px;font-weight:900;line-height:1">${minVal ? minVal + '<span style="font-size:15px;margin-left:2px">★</span>' : '—'}</div>
                  <div style="font-size:11px;color:#dc2626;font-weight:700;margin-top:4px">Thấp nhất</div>
                </div>
              </div>
            </div>
          `;
        }
      } else if (['grid_radio','grid_checkbox'].includes(type)) {
        const answers = getQuestionTextAnswers(q);
        const getArray = val => Array.isArray(val) ? val : (typeof val === 'string' ? (val.startsWith('[') ? JSON.parse(val) : []) : []);
        const rowLabels = getArray(q.hang_grid || q.hang || []).map(x => typeof x === 'string' ? x : x?.noi_dung).filter(Boolean);
        const colLabels = getArray(q.cot_grid || q.cot || []).map(x => typeof x === 'string' ? x : x?.noi_dung).filter(Boolean);
        
        if (!rowLabels.length || !colLabels.length) {
          if (side) side.innerHTML = '<div style="color:#94a3b8;font-size:13px;font-weight:700">Lỗi: Lưới không có hàng hoặc cột ('+rowLabels.length+' x '+colLabels.length+')</div>';
          return;
        }

        const counts = Array(rowLabels.length).fill(0).map(() => Array(colLabels.length).fill(0));
        answers.forEach(a => {
          try {
            const parsed = JSON.parse(a.text);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            items.forEach(p => {
              if (!p || !p.row || !p.col) return;
              const rIdx = rowLabels.findIndex(r => r === p.row);
              const cIdx = colLabels.findIndex(c => c === p.col);
              if (rIdx >= 0 && cIdx >= 0) counts[rIdx][cIdx]++;
            });
          } catch(e) {}
        });

        const datasets = colLabels.map((colLabel, cIdx) => ({
          label: colLabel,
          data: rowLabels.map((_, rIdx) => counts[rIdx][cIdx]),
          backgroundColor: PALETTE[cIdx % PALETTE.length] + 'ee',
          borderColor: PALETTE[cIdx % PALETTE.length],
          borderWidth: 1,
          borderRadius: 2,
        }));

        const canvasContainer = document.getElementById(chartId)?.parentElement;
        if (canvasContainer) {
          canvasContainer.style.height = Math.max(300, rowLabels.length * 60) + 'px';
        }

        mkChart(chartId, {
          type: 'bar',
          data: { labels: rowLabels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { 
              legend: { 
                position: 'bottom', 
                labels: { usePointStyle: true, boxWidth: 10, font: { size: 12, weight: '600' }, padding: 20 } 
              }, 
              tooltip: { 
                mode: 'index',
                axis: 'y',
                intersect: true,
                backgroundColor: '#0f172a',
                padding: 12,
                titleFont: { size: 13 },
                bodyFont: { size: 13, weight: 'bold' }
              } 
            },
            scales: {
              x: { 
                stacked: true, 
                ticks: { precision: 0, font: { size: 11, weight: '700' } },
                grid: { color: '#f1f5f9' }
              },
              y: { 
                stacked: true, 
                ticks: { font: { size: 12, weight: '600' }, color: '#334155' },
                grid: { display: false }
              }
            }
          }
        });
        if (side) {
          side.innerHTML = '<div style="font-size:12px;color:#64748b;font-weight:700;text-align:right">Dữ liệu từ ' + answers.length + ' phản hồi</div>';
        }
      }
    } catch (err) {
      console.error(err);
      const side = document.getElementById('rpt-q-side-' + q.id);
      if (side) side.innerHTML = '<div style="color:red;font-size:12px">Lỗi hiển thị biểu đồ: ' + err.message + '</div>';
    }
  });
}

function renderDefaultCharts() {
  setFormDetailOverviewVisibility(false);
  const grid = document.getElementById('rpt-charts-grid');
  if (!grid || !analysisData) return;
  Object.keys(charts).filter(id => id.startsWith('rpt-q-chart-') || id === 'rpt-detail-timeline').forEach(destroyChart);
  grid.innerHTML = `
    <div class="dash-card report-chart-card">
      <div class="dash-card-header" style="padding-bottom:12px;border-bottom:1px solid #f1f5f9">
        <div>
          <div class="dash-card-title">Phản hồi theo thời gian</div>
        </div>
      </div>
      <div class="dash-card-body" id="rpt-detail-timeline-body" style="min-height:340px"></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:4px 0 -6px">
      <div style="font-size:16px;font-weight:900;color:var(--gray-900)">Thống kê theo từng câu hỏi</div>
      <div style="font-size:12.5px;color:#64748b;font-weight:700">${(analysisData.questions || []).length} câu hỏi</div>
    </div>
    ${(analysisData.questions || []).map((q,i) => renderQuestionDetailCard(q,i)).join('') || '<div class="dash-card" style="padding:30px;text-align:center;color:#94a3b8;font-weight:700">Biểu mẫu này chưa có câu hỏi</div>'}
  `;
  setTimeout(() => {
    renderDetailTimeline('all');
    drawQuestionDetailCharts();
  }, 80);
}

// ─────────────────────────────────────────────────────────────
//  DEFAULT CHARTS – CSV
// ─────────────────────────────────────────────────────────────
function renderDefaultChartsCSV() {
  const {headers,rows,colTypes}=csvData;
  document.getElementById('rpt-charts-grid').innerHTML='';

  // Timeline nếu có cột date
  const di=colTypes.indexOf('date');
  if(di!==-1) {
    addChartCard('c-timeline','Phản hồi theo thời gian','full',320);
    setTimeout(()=>{
      const counts={};
      rows.forEach(r=>{const d=r[di]||'';if(d)counts[d]=(counts[d]||0)+1;});
      const sorted=Object.entries(counts).sort((a,b)=>a[0].localeCompare(b[0]));
      const timelineItems = sorted.map(([ngay, so_luong]) => ({ ngay, so_luong }));
      const timelineStats = buildTimelineStats(timelineItems);
      const totalPoints = sorted.length;
      renderTimelineSummary('c-timeline', timelineStats, 'c-timeline');
      const vals = sorted.map(e=>e[1]);
      mkChart('c-timeline', {
        type:'line',
        data:{labels:sorted.map(e=>fmtDate(e[0])),datasets:[{
          data:vals,
          fill:true,
          backgroundColor:ctx => {
            const g = ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height);
            g.addColorStop(0,'rgba(59,130,246,0.08)');
            g.addColorStop(1,'rgba(59,130,246,0.005)');
            return g;
          },
          borderColor:'#3b82f6',
          borderWidth:1.5,
          borderDash:[4,3],
          pointRadius:vals.map(v => v === timelineStats.peakValue ? 5 : 0),
          pointBackgroundColor:vals.map(v => v === timelineStats.peakValue ? '#2563eb' : '#3b82f6'),
          pointBorderColor:'#fff',
          pointBorderWidth:1.5,
          pointHoverRadius:5,
          pointHoverBackgroundColor:'#2563eb',
          tension:.35
        }]},
        options:{...rAF,interaction:{mode:'index',intersect:false},
          plugins:{...noLegend,tooltip:{backgroundColor:'#0f172a',padding:10,cornerRadius:8,titleFont:{size:11},bodyFont:{size:13,weight:'bold'},callbacks:{title:i=>`📅 ${i[0].label}`,label:ctx=>ctx.raw + ' phản hồi'}}},
          scales:{
            x:{...noGrid,ticks:{font:{size:10,weight:'500'},color:'#94a3b8',maxRotation:0,autoSkip:false,
              callback(value,index){
                const every = Math.max(1, Math.ceil(totalPoints / 7));
                return index % every === 0 ? fmtShortDate(sorted[index]?.[0]) : '';
              }}},
            y:{...softGrid,beginAtZero:true,ticks:{stepSize:1,precision:0,font:{size:10},color:'#94a3b8'},
              title:{display:true,text:'Số phản hồi',color:'#94a3b8',font:{size:10,weight:'500'}}}
          }}
      });
    },100);
  }

  // Loop qua các cột để render các thẻ phân tích từng cột (giống như biểu mẫu bình thường)
  const grid = document.getElementById('rpt-charts-grid');
  
  colTypes.forEach((type, ci) => {
    const title = headers[ci];
    if (type === 'date' || /time|dấu thời gian|thời gian|ngày/i.test(title)) return;
    
    const qId = 'csv_col_' + ci;
    const chartId = 'rpt-q-chart-' + qId;
    
    let body = '';
    if (type === 'text') {
      body = `
        <div style="margin-bottom:12px">
          <input class="input" placeholder="Tìm kiếm câu trả lời..." oninput="filterCSVTextAnswers(${ci}, this.value)" style="height:38px;border-radius:10px;font-size:13px">
        </div>
        <div id="rpt-text-answers-${qId}" style="max-height:310px;overflow-y:auto;padding-right:4px"></div>`;
    } else {
      body = `
        <div style="display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px;align-items:center">
          <div style="height:260px"><canvas id="${chartId}"></canvas></div>
          <div id="rpt-q-side-${qId}"></div>
        </div>`;
    }
    
    grid.insertAdjacentHTML('beforeend', `
      <div class="dash-card report-question-card" data-question-id="${qId}" data-question-type="${type}">
        <div class="dash-card-header" style="padding-bottom:12px;border-bottom:1px solid #f1f5f9">
          <div style="display:flex;gap:12px;align-items:flex-start;min-width:0">
            <div style="width:34px;height:34px;border-radius:50%;background:#00008B;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0">${ci + 1}</div>
            <div style="min-width:0">
              <div class="dash-card-title" style="font-size:16px;line-height:1.35">${esc(title)}</div>
              <div class="dash-card-sub" style="margin-top:4px">Dữ liệu ${type === 'text' ? 'văn bản' : (type === 'checkbox' ? 'chọn nhiều' : 'lựa chọn')}</div>
            </div>
          </div>
        </div>
        <div class="dash-card-body">${body}</div>
      </div>
    `);
  });

  setTimeout(() => {
    colTypes.forEach((type, ci) => {
      const title = headers[ci];
      if (type === 'date' || /time|dấu thời gian|thời gian|ngày/i.test(title)) return;
      const qId = 'csv_col_' + ci;
      const chartId = 'rpt-q-chart-' + qId;
      
      const vals = rows.map(r => String(r[ci] || '').trim()).filter(Boolean);
      
      if (type === 'text') {
        renderCSVTextAnswers(ci, vals);
      } else {
        const counts={};
        if (type === 'checkbox') {
          vals.forEach(v => {
            v.split(',').map(s => s.trim()).filter(Boolean).forEach(opt => {
              counts[opt] = (counts[opt] || 0) + 1;
            });
          });
        } else {
          vals.forEach(v=>{counts[v]=(counts[v]||0)+1;});
        }
        const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
        const total=vals.length||1;
        
        mkChart(chartId, {
          type: 'bar',
          data:{labels:sorted.map(e=>e[0]),datasets:[{
            data:sorted.map(e=>e[1]),
            backgroundColor:sorted.map((_,i)=>PALETTE[i%PALETTE.length]),
            borderWidth:0,borderRadius:8,borderSkipped:false
          }]},
          options:{...rAF,indexAxis:'y',plugins:{...noLegend,tooltip:{callbacks:{label:ctx=>ctx.raw+' phản hồi ('+Math.round(ctx.raw/total*100)+'%)'}}},
            scales:{x:{...softGrid,beginAtZero:true,ticks:{precision:0}},y:{...noGrid,ticks:{font:{size:11,weight:'700'}}}}}
        });
        
        const side = document.getElementById('rpt-q-side-' + qId);
        if (side) {
          side.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:9px">
              ${sorted.map(([l,n],i)=>{
                const pct=Math.round(n/total*100);
                return `
                <div style="margin-bottom:10px">
                  <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">
                    <span style="font-size:12.5px;color:var(--gray-700);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l)}</span>
                    <span style="font-size:12px;font-weight:900;color:${PALETTE[i%PALETTE.length]}">${pct}%</span>
                  </div>
                  <div style="height:8px;background:#f1f5f9;border-radius:999px"><div style="height:100%;width:${pct}%;background:${PALETTE[i%PALETTE.length]};border-radius:999px"></div></div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:3px">${n} lượt chọn</div>
                </div>`
              }).join('')}
            </div>`;
        }
      }
    });
  }, 120);
}

function renderCSVTextAnswers(ci, vals) {
  window._csvTextAnswers = window._csvTextAnswers || {};
  window._csvTextAnswers[ci] = vals;
  filterCSVTextAnswers(ci, '');
}

function filterCSVTextAnswers(ci, q) {
  const vals = window._csvTextAnswers[ci] || [];
  const qId = 'csv_col_' + ci;
  const filtered = q ? vals.filter(v => v.toLowerCase().includes(q.toLowerCase())) : vals;
  
  const el = document.getElementById('rpt-text-answers-' + qId);
  if (!el) return;
  
  const colors = ['#00008B', '#ea580c', '#06b6d4', '#facc15', '#3b82f6', '#ef4444', '#0f766e', '#fdba74', '#6366f1', '#b45309', '#10b981', '#db2777', '#8b5cf6', '#84cc16', '#1e3a8a', '#f97316', '#14b8a6', '#f43f5e', '#8b1c62', '#059669'];
  el.innerHTML = filtered.length
    ? filtered.slice(0,50).map((v, i) => {
        const color = colors[i % colors.length];
        return `
          <div style="padding:12px 0;border-bottom:1px solid #f1f5f9">
            <div style="padding-left:12px;border-left:3px solid ${color};font-size:13px;color:var(--gray-900);line-height:1.5">
              ${esc(v)}
            </div>
          </div>`;
      }).join('')
    : '<div style="padding:28px;text-align:center;color:#94a3b8;font-size:13px;font-weight:700">Không tìm thấy phản hồi nào phù hợp</div>';
}

window.filterCSVTextAnswersCustom = function(qId, q) {
  const vals = window._csvTextAnswersCustom?.[qId] || [];
  const filtered = q ? vals.filter(v => v.toLowerCase().includes(q.toLowerCase())) : vals;
  const el = document.getElementById('rpt-text-answers-' + qId);
  if (!el) return;
  const colors = ['#00008B', '#ea580c', '#06b6d4', '#facc15', '#3b82f6', '#ef4444', '#0f766e', '#fdba74', '#6366f1', '#b45309', '#10b981', '#db2777', '#8b5cf6', '#84cc16', '#1e3a8a', '#f97316', '#14b8a6', '#f43f5e', '#8b1c62', '#059669'];
  el.innerHTML = filtered.length
    ? filtered.slice(0,50).map((v, i) => {
        const color = colors[i % colors.length];
        return `
          <div style="padding:12px 0;border-bottom:1px solid #f1f5f9">
            <div style="padding-left:12px;border-left:3px solid ${color};font-size:13px;color:var(--gray-900);line-height:1.5">
              ${esc(v)}
            </div>
          </div>`;
      }).join('')
    : '<div style="padding:28px;text-align:center;color:#94a3b8;font-size:13px;font-weight:700">Không tìm thấy phản hồi nào phù hợp</div>';
}

// ─────────────────────────────────────────────────────────────
//  CHART CARDS
// ─────────────────────────────────────────────────────────────
// Biểu đồ mặc định — không có year dropdown
function ensureReportChartPolish() {
  if (document.getElementById('report-chart-polish-style')) return;
  document.head.insertAdjacentHTML('beforeend', `
    <style id="report-chart-polish-style">
      #rpt-charts-grid { gap: 20px !important; }
      .report-chart-card {
        border: 1px solid rgba(148, 163, 184, .24) !important;
        border-radius: 24px !important;
        background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,251,255,.92)) !important;
        box-shadow: 0 18px 45px rgba(15, 23, 42, .08) !important;
        overflow: hidden;
      }
      .report-chart-card .dash-card-header {
        padding: 18px 20px 10px !important;
        border-bottom: 0 !important;
      }
      .report-chart-card .dash-card-title {
        color: #0f172a !important;
        font-size: 16px !important;
        font-weight: 800 !important;
        letter-spacing: -.02em;
      }
      .report-chart-card .dash-card-body {
        margin: 0 18px 18px;
        padding: 12px 14px 8px;
        border: 1px solid #e8eef7;
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(248,250,252,.82), rgba(255,255,255,.96));
      }
      .report-chart-card .remove-btn {
        width: 30px;
        height: 30px;
        border-radius: 10px;
        background: #fff5f5;
      }
    </style>
  `);
}

function addChartCard(id, title, span='half', height=210) {
  ensureReportChartPolish();
  const grid = document.getElementById('rpt-charts-grid');
  const div  = document.createElement('div');
  div.className = 'dash-card report-chart-card'; div.id = `slot-${id}`;
  if (span === 'full') div.style.gridColumn = '1/-1';
  div.innerHTML = `
    <div class="dash-card-header">
      <div class="dash-card-title">${esc(title)}</div>
      <button class="remove-btn" onclick="removeChart('${id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" width="12" height="12">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="card-inner dash-card-body" style="height:${height}px">
      <canvas id="${id}"></canvas>
    </div>`;
  grid.appendChild(div);
}

// Biểu đồ thêm mới
function addChartCardWithYear(id, title, span='half', height=210) {
  ensureReportChartPolish();
  const grid = document.getElementById('rpt-charts-grid');
  const div  = document.createElement('div');
  div.className = 'dash-card report-chart-card'; div.id = `slot-${id}`;
  if (span === 'full') div.style.gridColumn = '1/-1';

  div.innerHTML = `
    <div class="dash-card-header">
      <div style="display:flex;align-items:center;flex:1;flex-wrap:wrap;gap:4px">
        <div class="dash-card-title">${esc(title)}</div>
      </div>
      <button class="remove-btn" onclick="removeChart('${id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" width="12" height="12">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="card-inner dash-card-body" style="height:${height}px">
      <canvas id="${id}"></canvas>
    </div>`;
  grid.appendChild(div);
}

// Lưu thông tin preset để vẽ lại khi đổi năm
const _presetMap = {};

function rerunPresetYear(cid) {
  const yr = document.getElementById('yr-'+cid)?.value || '';
  const mo = document.getElementById('mo-'+cid)?.value || '';
  const info = _presetMap[cid];
  if (!info) return;

  // Lọc rawRows theo năm và tháng
  const filtered = rawRows.filter(r => {
    const d = (r.ngay_gui||'').slice(0,10);
    if (yr && !d.startsWith(yr)) return false;
    if (mo && d.slice(5,7) !== mo) return false;
    return true;
  });

  if (!filtered.length) {
    showToast('Không có dữ liệu năm ' + yr, 'error'); return;
  }

  // Tính lại rating_dist và choice_stats từ rawRows đã lọc
  let tempData = JSON.parse(JSON.stringify(analysisData));
  const rMap = {};
  filtered.forEach(r => { if(r.danh_gia) rMap[r.danh_gia]=(rMap[r.danh_gia]||0)+1; });
  tempData.rating_dist = Object.entries(rMap).map(([sao,so])=>({sao:parseInt(sao),so_luong:parseInt(so)})).sort((a,b)=>a.sao-b.sao);
  tempData.form.so_phan_hoi = filtered.length;
  tempData.form.tich_cuc = filtered.filter(r=>r.cam_xuc==='positive').length;
  tempData.form.tieu_cuc = filtered.filter(r=>r.cam_xuc==='negative').length;

  const tot = filtered.length || 1;

  if (info.type === 'p1') {
    setTimeout(() => {
      mkChart(cid,{type:'bar',data:{labels:tempData.rating_dist.map(r=>r.sao+'★'),datasets:[{
        data:tempData.rating_dist.map(r=>r.so_luong),
        backgroundColor:tempData.rating_dist.map(r=>['#ea580c', '#f97316', '#60a5fa', '#2563eb', '#00008B'][r.sao-1]||'#94a3b8'),borderRadius:0,borderSkipped:false}]},
        options:{...rAF,plugins:{...noLegend,tooltip:{callbacks:{label:ctx=>ctx.raw+' người ('+Math.round(ctx.raw/tot*100)+'%)'}}},
          scales:{x:{...noGrid,ticks:{font:{size:12}}},y:{...softGrid,beginAtZero:true}}}});
    }, 50);
  } else if (info.type === 'p2') {
    const vals = [tempData.form.tich_cuc||0, tempData.form.tieu_cuc||0];
    setTimeout(() => {
      mkChart(cid,{type:'bar',data:{labels:['Tích cực 😊','Tiêu cực 😞'],datasets:[{
        data:vals,backgroundColor:[BLUE,RED],borderRadius:0,borderSkipped:false}]},
        options:{...rAF,indexAxis:'y',plugins:{...noLegend},scales:{x:{...softGrid,beginAtZero:true},y:{...noGrid}}}});
    }, 50);
  } else if (info.type === 'rating') {
    // Lấy rating_stats từ ChiTietPhanHoi filtered theo năm — cần API hoặc dùng tổng gần đúng
    const rs = tempData.rating_stats.find(s=>s.cau_hoi_id===info.qId);
    if (!rs) return;
    const dist = [1,2,3,4,5].map(s=>{const f=tempData.rating_dist.find(r=>r.sao===s);return f?f.so_luong:0;});
    const dtot = dist.reduce((a,b)=>a+b,0)||1;
    setTimeout(() => {
      mkChart(cid,{type:'bar',data:{labels:['1★','2★','3★','4★','5★'],datasets:[{
        data:dist,backgroundColor:[1,2,3,4,5].map((s=>['#ea580c', '#f97316', '#60a5fa', '#2563eb', '#00008B'][s-1]||'#94a3b8')),borderRadius:0,borderSkipped:false}]},
        options:{...rAF,plugins:{...noLegend,tooltip:{callbacks:{label:ctx=>ctx.raw+' người ('+Math.round(ctx.raw/dtot*100)+'%)'}}},
          scales:{x:{...noGrid,ticks:{font:{size:12}}},y:{...softGrid,beginAtZero:true}}}});
    }, 50);
  }
}

function removeChart(id) {
  destroyChart(id);
  const s=document.getElementById(`slot-${id}`); if(s)s.remove();

}

function addCustomChartSlot() {
  const id='c-custom-'+Date.now();
  addChartCard(id,'Biểu đồ tùy chỉnh');
  buildState.activeSlot=id;
  showToast('Chọn cột X/Y rồi bấm Vẽ biểu đồ','default');
}

// ─────────────────────────────────────────────────────────────
//  SMART SEARCH
// ─────────────────────────────────────────────────────────────
const smartFilters = { camxuc:'', danhgia:'', period:'' };

function setSentimentFilterFromSelect(value) {
  smartFilters.camxuc = value || '';
  document.querySelectorAll('.sf-chip[data-group="camxuc"]').forEach(b => {
    const active = b.getAttribute('data-val') === smartFilters.camxuc;
    b.classList.toggle('sf-active', active);
  });
  onSmartSearch();
}

function toggleChip(btn, group) {
  document.querySelectorAll('.sf-chip[data-group="' + group + '"]').forEach(b => {
    b.classList.remove('sf-active');
    b.style.borderColor = '#e2e8f0';
    b.style.background  = '#fff';
  });
  btn.classList.add('sf-active');
  btn.style.borderColor = '#00008B';
  btn.style.background  = '#00008B';
  btn.style.color       = '#00008B';
  smartFilters[group] = btn.getAttribute('data-val');

  if (group === 'period') {
    const v = btn.getAttribute('data-val');
    const tn = document.getElementById('sf-tungay');
    const dn = document.getElementById('sf-denngay');
    if (v === '90' || v === '180' || v === '365') {
      const d = new Date();
      d.setDate(d.getDate() - parseInt(v));
      tn.value = d.toISOString().slice(0,10);
      dn.value = new Date().toISOString().slice(0,10);
    } else { tn.value = ''; dn.value = ''; }
  }
  onSmartSearch();
}

function onSmartSearch() {
  if (activeSource !== 'form') return;
  if (!rawRows.length && analysisData) rawRows = buildRawRowsFromAnalysis(analysisData);
  const tuNgay  = document.getElementById('sf-tungay')?.value;
  const denNgay = document.getElementById('sf-denngay')?.value;
  const status = document.getElementById('sf-status-select')?.value || '';
  const keyword = normalizeReportText(document.getElementById('sf-keyword-input')?.value).toLowerCase();
  const dynamicFilters = [...document.querySelectorAll('#sf-dynamic-filters [data-qid]')].map(el => ({
    qid: String(el.dataset.qid),
    type: el.dataset.filterType || '',
    values: el.multiple ? [...el.selectedOptions].map(o => o.value).filter(Boolean) : [el.value].filter(Boolean)
  })).filter(f => f.values.length);

  const filtered = rawRows.filter(r => {
    const rowDate = normalizeReportDate(r.ngay_gui);
    if (tuNgay && rowDate < tuNgay) return false;
    if (denNgay && rowDate > denNgay) return false;
    if (keyword && !buildReportRowSearchText(r).includes(keyword)) return false;
    
    // Áp dụng bộ lọc cảm xúc
    if (smartFilters.camxuc) {
      const cx = normalizeReportText(r.cam_xuc).toLowerCase();
      if (smartFilters.camxuc === 'positive' && !['tích cực', 'tich cuc', 'positive'].includes(cx)) return false;
      if (smartFilters.camxuc === 'negative' && !['tiêu cực', 'tieu cuc', 'negative'].includes(cx)) return false;
    }
    
    // Áp dụng bộ lọc đánh giá
    if (smartFilters.danhgia) {
      if (String(r.danh_gia) !== String(smartFilters.danhgia)) return false;
    }

    // Lọc theo Khoa (sf-khoa-input)
    const selectedKhoa = document.getElementById('sf-khoa-input')?.value || '';
    if (selectedKhoa && normalizeReportText(r.khoa) !== normalizeReportText(selectedKhoa)) return false;

    for (const filter of dynamicFilters) {
      const value = normalizeReportText(r['q_' + filter.qid]);
      if (filter.type === 'file') {
        if (filter.values[0] === 'has' && !value) return false;
        if (filter.values[0] === 'empty' && value) return false;
        continue;
      }
      if (['checkbox', 'multiple_choice'].includes(filter.type)) {
        const parts = splitReportAnswer(value).map(v => v.toLowerCase());
        if (!filter.values.some(v => parts.includes(v.toLowerCase()))) return false;
        continue;
      }
      if (!filter.values.includes(value)) return false;
    }
    return true;
  });

  const hasFilter = Boolean(tuNgay || denNgay || keyword || dynamicFilters.length || smartFilters.camxuc || smartFilters.danhgia || document.getElementById('sf-khoa-input')?.value);
  const bar = document.getElementById('sf-result-bar');
  const lbl = document.getElementById('sf-result-label');

  if (hasFilter && filtered.length === 0) {
    activeReportRows = [];
    recomputeAnalysis([]);
    document.getElementById('rpt-charts-grid').innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:48px;background:var(--gray-50);border-radius:16px;border:1px solid #e8edf5">' +
      '<div style="font-size:14px;font-weight:600;color:var(--gray-700);margin-bottom:6px">Không có phản hồi nào khớp</div>' +
      '<div style="font-size:13px;color:#94a3b8">Thử chọn bộ lọc khác</div></div>';
    document.getElementById('rpt-kpi-row').innerHTML = '';
    setReportBadge('0 / ' + rawRows.length + ' phản hồi');
    if (bar) { bar.style.display = 'block'; lbl.textContent = '⚠️ 0 / ' + rawRows.length + ' phản hồi'; }
    return;
  }

  const activeRows = hasFilter ? filtered : rawRows;
  activeReportRows = activeRows.slice();
  recomputeAnalysis(activeRows);
  document.getElementById('rpt-charts-grid').innerHTML = '';
  document.getElementById('rpt-kpi-row').innerHTML = '';
  renderKPIs();
  renderDefaultCharts();
  setReportBadge(hasFilter ? (activeRows.length + ' / ' + rawRows.length + ' phản hồi (đã lọc)') : (rawRows.length + ' phản hồi'));
  if (bar) {
    bar.style.display = hasFilter ? 'block' : 'none';
    if (hasFilter) lbl.textContent = '✅ ' + activeRows.length + ' / ' + rawRows.length + ' phản hồi';
  }
}

function resetSmartSearch() {
  const tn = document.getElementById('sf-tungay');  if (tn) tn.value = '';
  const dn = document.getElementById('sf-denngay'); if (dn) dn.value = '';
  const kw = document.getElementById('sf-keyword-input'); if (kw) kw.value = '';
  const khoa = document.getElementById('sf-khoa-input'); if (khoa) khoa.value = '';
  
  document.querySelectorAll('#sf-dynamic-filters select').forEach(sel => {
    [...sel.options].forEach(opt => { opt.selected = false; });
    sel.value = '';
  });
  
  ['camxuc','danhgia','period'].forEach(g => {
    smartFilters[g] = '';
    document.querySelectorAll('.sf-chip[data-group="' + g + '"]').forEach(b => {
      const isAll = b.getAttribute('data-val') === '';
      b.classList.toggle('sf-active', isAll);
      b.style.borderColor = isAll ? '#00008B' : '#e2e8f0';
      b.style.background  = isAll ? '#00008B' : '#fff';
      if (isAll) b.style.color = '#fff'; else b.style.color = '';
    });
  });
  
  const bar = document.getElementById('sf-result-bar');
  if (bar) bar.style.display = 'none';
  
  activeReportRows = rawRows.slice();
  recomputeAnalysis(rawRows);
  document.getElementById('rpt-charts-grid').innerHTML = '';
  document.getElementById('rpt-kpi-row').innerHTML = '';
  renderKPIs();
  renderDefaultCharts();
  setReportBadge(rawRows.length + ' phản hồi');
  showToast('Đã xóa bộ lọc','success');
}

// ── recomputeAnalysis ──────────────────────────────────────────
function recomputeAnalysis(rows) {
  if (!analysisData) return;
  const safeRows = Array.isArray(rows) ? rows : [];
  const rated = safeRows.map(r => Number(r.danh_gia)).filter(v => v >= 1);
  const sum   = rated.reduce((s,v) => s + v, 0);
  analysisData.form.so_phan_hoi = safeRows.length;
  analysisData.form.diem_tb     = rated.length ? sum / rated.length : null;
  analysisData.form.tich_cuc    = safeRows.filter(r => r.cam_xuc === 'positive' || r.cam_xuc === 'Tích cực').length;
  analysisData.form.trung_tinh  = safeRows.filter(r => r.cam_xuc === 'neutral' || r.cam_xuc === 'Trung lập').length;
  analysisData.form.tieu_cuc    = safeRows.filter(r => r.cam_xuc === 'negative' || r.cam_xuc === 'Tiêu cực').length;
  const dates = safeRows.map(r => normalizeReportDate(r.ngay_gui)).filter(Boolean).sort();
  analysisData.form.ngay_dau    = dates[0] || null;
  analysisData.form.ngay_cuoi   = dates[dates.length - 1] || null;
  const rMap = {};
  rated.forEach(v => { rMap[v] = (rMap[v]||0)+1; });
  analysisData.rating_dist = Object.entries(rMap).map(([s,n]) => ({sao:parseInt(s),so_luong:n})).sort((a,b)=>a.sao-b.sao);
  const tlMap = {};
  safeRows.forEach(r => { const d=normalizeReportDate(r.ngay_gui); if(d) tlMap[d]=(tlMap[d]||0)+1; });
  analysisData.timeline = Object.entries(tlMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([ngay,so_luong])=>({ngay,so_luong}));
  const stMap = {};
  safeRows.forEach(r => { const st = normalizeReportText(r.trang_thai) || 'active'; stMap[st]=(stMap[st]||0)+1; });
  analysisData.status_dist = Object.entries(stMap).map(([trang_thai,so_luong])=>({trang_thai,so_luong}));

  const choiceStats = [];
  const ratingStats = [];
  const ratingDistByQ = [];
  const textStats = [];
  (analysisData.questions || []).forEach(q => {
    const qId = String(q.id);
    const type = reportQuestionType(q.loai || q.type);
    if (['choice','dropdown','checkbox','multiple_choice'].includes(type)) {
      const countMap = {};
      getReportQuestionOptions(q).forEach(opt => { countMap[opt] = 0; });
      safeRows.forEach(r => {
        const val = r['q_' + qId] || r[qId] || r[q.noi_dung];
        const parts = ['checkbox','multiple_choice'].includes(type) ? splitReportAnswer(val) : [normalizeReportText(val)].filter(Boolean);
        parts.forEach(part => { countMap[part] = (countMap[part] || 0) + 1; });
      });
      Object.entries(countMap).forEach(([lua_chon, so_chon]) => choiceStats.push({ cau_hoi_id:q.id, lua_chon, so_chon }));
    }
    if (['rating','scale','star_rating'].includes(type)) {
      const vals = safeRows.map(r => Number(r['q_' + qId] || r[qId] || r[q.noi_dung])).filter(v => v >= 1 && v <= 5);
      vals.forEach(v => ratingDistByQ.push({ cau_hoi_id:q.id, sao:v, so_luong:1 }));
      ratingStats.push({
        cau_hoi_id:q.id,
        diem_tb: vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : null,
        so_tra_loi: vals.length,
        min_diem: vals.length ? Math.min(...vals) : null,
        max_diem: vals.length ? Math.max(...vals) : null
      });
    }
    if (['text','paragraph','short_text','long_text'].includes(type)) {
      safeRows.forEach(r => {
        const val = r['q_' + qId] || r[qId] || r[q.noi_dung];
        const text = normalizeReportText(val);
        if (text) textStats.push({ cau_hoi_id:q.id, noi_dung:text, ho_ten:r.ho_ten || 'Ẩn danh', lop:r.lop || '', khoa:r.khoa || '', giao_vien:r.giao_vien || '', danh_gia:r.danh_gia || '', cam_xuc:r.cam_xuc || '' });
      });
    }
  });
  const distMap = {};
  ratingDistByQ.forEach(item => {
    const key = item.cau_hoi_id + '|' + item.sao;
    distMap[key] = (distMap[key] || 0) + 1;
  });
  analysisData.choice_stats = choiceStats;
  analysisData.rating_stats = ratingStats;
  analysisData.rating_dist_by_q = Object.entries(distMap).map(([key, so_luong]) => {
    const [cau_hoi_id, sao] = key.split('|');
    return { cau_hoi_id, sao:Number(sao), so_luong };
  });
  analysisData.text_stats = textStats;
}

function buildReportRowSearchText(row) {
  const parts = [row.ho_ten, row.email, row.noi_dung, row.lop, row.khoa, row.giao_vien, row.doi_tuong_nop];
  (analysisData?.questions || []).forEach(q => parts.push(row['q_' + q.id]));
  return parts.map(v => normalizeReportText(v).toLowerCase()).join(' ');
}

// ─────────────────────────────────────────────────────────────
//  PRESET CHART MODAL
// ─────────────────────────────────────────────────────────────
function addCustomChartSlot() {
  if (!analysisData && !csvData) { showToast('Chưa có dữ liệu','error'); return; }
  const old = document.getElementById('custom-chart-modal');
  if (old) old.remove();

  const isForm = !!analysisData;
  const qPresets = [];
  if (analysisData && analysisData.questions) {
    analysisData.questions.forEach(q => qPresets.push({
      id: 'q_' + q.id,
      title: q.noi_dung.length > 48 ? q.noi_dung.slice(0,46)+'…' : q.noi_dung,
      desc: ({choice:'📊 Biểu đồ cột — đếm lựa chọn',checkbox:'📊 Biểu đồ cột — đếm lựa chọn',dropdown:'📊 Biểu đồ cột — đếm lựa chọn',rating:'⭐ Biểu đồ cột — phân bổ sao',text:'💬 Danh sách câu trả lời ngắn',paragraph:'💬 Danh sách đoạn văn trả lời'}[q.loai]||'📊 Biểu đồ')
    }));
  } else if (csvData) {
    csvData.headers.forEach((h, ci) => {
      const type = csvData.colTypes[ci];
      if (type === 'date' || /time|dấu thời gian|thời gian|ngày/i.test(h)) return;
      qPresets.push({
        id: 'csv_' + ci,
        title: h.length > 48 ? h.slice(0,46)+'…' : h,
        desc: ({choice:'📊 Biểu đồ — lựa chọn',checkbox:'📊 Biểu đồ — chọn nhiều',text:'💬 Danh sách câu trả lời',rating:'⭐ Biểu đồ cột — phân bổ sao',number:'📊 Biểu đồ cột — phân bổ số lượng'}[type]||'📊 Biểu đồ')
      });
    });
  }

  const mkBtn = (id, title, desc) =>
    '<button onclick="runPreset(\'' + id + '\')" ' +
    'style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:10px;border:1.5px solid #e2e8f0;background:var(--gray-50);cursor:pointer;text-align:left;width:100%;transition:all .15s" ' +
    'onmouseenter="this.style.borderColor=\'#00008b\';this.style.background=\'#fafbff\'" ' +
    'onmouseleave="this.style.borderColor=\'#e2e8f0\';this.style.background=\'#fff\'">' +
    '<div><div style="font-size:13px;font-weight:700;color:var(--gray-900)">' + title + '</div>' +
    '<div style="font-size:11.5px;color:#94a3b8;margin-top:2px">' + desc + '</div></div>' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2" width="13" height="13"><polyline points="9 18 15 12 9 6"/></svg>' +
    '</button>';
  const qSection = qPresets.length
    ? '<div style="margin-top:0"><div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:.7px;text-transform:uppercase;margin-bottom:7px">Câu hỏi trong form</div>' +
      qPresets.map(p => mkBtn(p.id, p.title, p.desc)).join('') + '</div>'
    : '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px">Không có biểu đồ nào để thêm</div>';

  const modal = document.createElement('div');
  modal.id = 'custom-chart-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)';
  modal.innerHTML =
    '<div style="background:var(--gray-50);border-radius:20px;padding:24px;width:460px;max-width:94vw;box-shadow:0 24px 60px rgba(0,0,0,.18);max-height:90vh;overflow-y:auto">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
    '<div style="font-size:17px;font-weight:800;color:var(--gray-900)">Thêm biểu đồ</div>' +
    '<button onclick="document.getElementById(\'custom-chart-modal\').remove()" style="width:32px;height:32px;border-radius:9px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;font-size:18px;color:#94a3b8">✕</button>' +
    '</div>' +
    '<div style="margin-bottom:12px"></div>' +
    '<div style="display:flex;flex-direction:column;gap:6px">' + qSection + '</div></div>';

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function runPreset(id) {
  document.getElementById('custom-chart-modal')?.remove();
  const uid = Date.now();
  let d = analysisData;

  if (id === 'p1') { // Rating dist
    if (!d?.rating_dist?.length) { showToast('Không có dữ liệu đánh giá','error'); return; }
    const cid = 'cp1-' + uid; _presetMap[cid]={type:'p1'}; addChartCardWithYear(cid,'⭐ Phân bổ đánh giá sao','half',220);
    setTimeout(() => {
      const tot = d.rating_dist.reduce((s,r)=>s+r.so_luong,0)||1;
      mkChart(cid,{type:'bar',data:{labels:d.rating_dist.map(r=>r.sao+'★'),datasets:[{data:d.rating_dist.map(r=>r.so_luong),
        backgroundColor:d.rating_dist.map(r=>['#ea580c', '#f97316', '#60a5fa', '#2563eb', '#00008B'][r.sao-1]||'#94a3b8'),borderRadius:0,borderSkipped:false}]},
        options:{...rAF,plugins:{...noLegend,tooltip:{callbacks:{label:ctx=>ctx.raw+' người ('+Math.round(ctx.raw/tot*100)+'%)'}}},
          scales:{x:{...noGrid,ticks:{font:{size:12}}},y:{...softGrid,beginAtZero:true,ticks:{stepSize:1}}}}});
    },80);

  } else if (id === 'p2') { // Sentiment bar
    if (!d) return;
    const cid = 'cp2-' + uid; _presetMap[cid]={type:'p2'}; addChartCardWithYear(cid,'😊 So sánh cảm xúc','half',220);
    setTimeout(() => {
      const vals=[d.form.tich_cuc||0,d.form.trung_tinh||0,d.form.tieu_cuc||0];
      const tot=vals.reduce((a,b)=>a+b,0)||1;
      mkChart(cid,{type:'bar',data:{labels:['Tích cực 😊','Trung lập 😐','Tiêu cực 😞'],datasets:[{data:vals,
        backgroundColor:[BLUE,'#94a3b8',RED],borderRadius:0,borderSkipped:false}]},
        options:{...rAF,indexAxis:'y',plugins:{...noLegend,tooltip:{callbacks:{label:ctx=>ctx.raw+' người ('+Math.round(ctx.raw/tot*100)+'%)'}}},
          scales:{x:{...softGrid,beginAtZero:true},y:{...noGrid,ticks:{font:{size:12}}}}}});
    },80);

  } else if (id.startsWith('q_')) {
    if (!analysisData) return;
    const qId = parseInt(id.replace('q_',''));
    const q = analysisData.questions.find(x => x.id === qId);
    if (!q) { showToast('Không tìm thấy câu hỏi','error'); return; }
    const cid = 'cq-' + uid;
    _presetMap[cid]={type:q.loai,qId:qId};
    const title = q.noi_dung;
    if (q.loai === 'choice' || q.loai === 'checkbox' || q.loai === 'dropdown') {
      const stats = analysisData.choice_stats.filter(s => s.cau_hoi_id === qId);
      if (!stats.length) { showToast('Chưa có dữ liệu','error'); return; }
      addChartCardWithYear(cid, title, 'full', 260);
      setTimeout(() => renderDonutChoice(cid, stats), 80);
    } else if (q.loai === 'rating') {
      const rs = (analysisData.rating_stats||[]).find(s=>s.cau_hoi_id===qId);
      if (!rs) { showToast('Chưa có dữ liệu rating','error'); return; }
      addChartCardWithYear(cid, title, 'full', 240);
      setTimeout(() => {
        const wrap = document.querySelector('#slot-'+cid+' .card-inner');
        if (wrap) wrap.innerHTML = renderRatingHTML(rs, qId);
      }, 80);
    } else if (['grid_radio','grid_checkbox'].includes(q.loai)) {
      const answers = analysisData.text_stats.filter(x => x.cau_hoi_id === qId);
      const getArray = val => Array.isArray(val) ? val : (typeof val === 'string' ? (val.startsWith('[') ? JSON.parse(val) : []) : []);
      const rowLabels = getArray(q.hang_grid || q.hang || []).map(x => typeof x === 'string' ? x : x?.noi_dung).filter(Boolean);
      const colLabels = getArray(q.cot_grid || q.cot || []).map(x => typeof x === 'string' ? x : x?.noi_dung).filter(Boolean);
      addChartCardWithYear(cid, title, 'full', 300);
      const chartId = 'rpt-q-chart-' + cid;
      const sideId = 'rpt-q-side-' + cid;
      setTimeout(() => {
        const wrap = document.querySelector('#slot-'+cid+' .card-inner');
        if (wrap) {
          wrap.style.height = 'auto';
          wrap.innerHTML = `<div style="height:300px"><canvas id="${chartId}"></canvas></div><div id="${sideId}"></div>`;
        }
        const canvasContainer = document.getElementById(chartId)?.parentElement;
        if (canvasContainer) canvasContainer.style.height = Math.max(300, rowLabels.length * 60) + 'px';
        const counts = Array(rowLabels.length).fill(0).map(() => Array(colLabels.length).fill(0));
        answers.forEach(a => {
          try {
            const parsed = JSON.parse(a.noi_dung);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            items.forEach(p => {
              if (!p || !p.row || !p.col) return;
              const rIdx = rowLabels.findIndex(r => r === p.row);
              const cIdx = colLabels.findIndex(c => c === p.col);
              if (rIdx >= 0 && cIdx >= 0) counts[rIdx][cIdx]++;
            });
          } catch(e) {}
        });
        const datasets = colLabels.map((colLabel, cIdx) => ({
          label: colLabel,
          data: rowLabels.map((_, rIdx) => counts[rIdx][cIdx]),
          backgroundColor: PALETTE[cIdx % PALETTE.length] + 'ee',
          borderColor: PALETTE[cIdx % PALETTE.length],
          borderWidth: 1,
          borderRadius: 2,
        }));
        mkChart(chartId, {
          type: 'bar',
          data: { labels: rowLabels, datasets },
          options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, font: { size: 12, weight: '600' }, padding: 20 } }, tooltip: { mode: 'index', axis: 'y', intersect: true } },
            scales: { x: { stacked: true, ticks: { precision: 0, font: { size: 11, weight: '700' } } }, y: { stacked: true, ticks: { font: { size: 12, weight: '600' }, color: '#334155' }, grid: { display: false } } }
          }
        });
        const side = document.getElementById(sideId);
        if (side) side.innerHTML = '<div style="font-size:12px;color:#64748b;font-weight:700;text-align:right">Dữ liệu từ ' + answers.length + ' phản hồi</div>';
      }, 80);
    } else if (['short_text', 'long_text', 'text', 'paragraph'].includes(q.loai)) {
      const textStats = (analysisData?.text_stats || []);
      const answers = textStats.filter(r => r.cau_hoi_id === qId && (r.noi_dung||'').trim().length > 2);
      if (!answers.length) { showToast('Chưa có câu trả lời cho câu hỏi này','error'); return; }
      addChartCardWithYear(cid, title, 'full', 300);
      setTimeout(() => {
        const wrap = document.querySelector('#slot-'+cid+' .card-inner');
        if (wrap) {
          wrap.style.height = 'auto';
          wrap.innerHTML = renderAnswerList(answers);
        }
      }, 80);
    }
  } else if (id.startsWith('csv_')) {
    if (!csvData) return;
    const ci = parseInt(id.replace('csv_',''));
    const type = csvData.colTypes[ci];
    const title = csvData.headers[ci];
    const qId = 'csv_col_' + ci + '_' + uid;
    const chartId = 'rpt-q-chart-' + qId;
    const cid = 'c_csv_' + uid;
    _presetMap[cid] = {type, ci, qId};

    const vals = csvData.rows.map(r => String(r[ci] || '').trim()).filter(Boolean);

    if (type === 'text') {
      addChartCardWithYear(cid, title, 'full', 350);
      setTimeout(() => {
        const wrap = document.querySelector('#slot-'+cid+' .card-inner');
        if (wrap) {
          wrap.innerHTML = `
            <div style="margin-bottom:12px">
              <input class="input" placeholder="Tìm kiếm câu trả lời..." oninput="filterCSVTextAnswersCustom('${qId}', this.value)" style="height:38px;border-radius:10px;font-size:13px">
            </div>
            <div id="rpt-text-answers-${qId}" style="max-height:310px;overflow-y:auto;padding-right:4px"></div>`;
          window._csvTextAnswersCustom = window._csvTextAnswersCustom || {};
          window._csvTextAnswersCustom[qId] = vals;
          filterCSVTextAnswersCustom(qId, '');
        }
      }, 80);
    } else {
      addChartCardWithYear(cid, title, 'full', 280);
      setTimeout(() => {
        const wrap = document.querySelector('#slot-'+cid+' .card-inner');
        if (!wrap) return;
        wrap.innerHTML = `
          <div style="display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px;align-items:center">
            <div style="height:260px"><canvas id="${chartId}"></canvas></div>
            <div id="rpt-q-side-${qId}"></div>
          </div>`;
          
        const counts={};
        if (type === 'checkbox') {
          vals.forEach(v => {
            v.split(',').map(s => s.trim()).filter(Boolean).forEach(opt => {
              counts[opt] = (counts[opt] || 0) + 1;
            });
          });
        } else {
          vals.forEach(v=>{counts[v]=(counts[v]||0)+1;});
        }
        const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
        const total=vals.length||1;
        
        mkChart(chartId, {
          type: 'bar',
          data:{labels:sorted.map(e=>e[0]),datasets:[{
            data:sorted.map(e=>e[1]),
            backgroundColor:sorted.map((_,i)=>PALETTE[i%PALETTE.length]),
            borderWidth:0,borderRadius:8,borderSkipped:false
          }]},
          options:{...rAF,indexAxis:'y',plugins:{...noLegend,tooltip:{callbacks:{label:ctx=>ctx.raw+' phản hồi ('+Math.round(ctx.raw/total*100)+'%)'}}},
            scales:{x:{...softGrid,beginAtZero:true,ticks:{precision:0}},y:{...noGrid,ticks:{font:{size:11,weight:'700'}}}}}
        });
        
        const side = document.getElementById('rpt-q-side-' + qId);
        if (side) {
          side.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:9px">
              ${sorted.map(([l,n],i)=>{
                const pct=Math.round(n/total*100);
                return `
                <div style="margin-bottom:10px">
                  <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">
                    <span style="font-size:12.5px;color:var(--gray-700);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l)}</span>
                    <span style="font-size:12px;font-weight:900;color:${PALETTE[i%PALETTE.length]}">${pct}%</span>
                  </div>
                  <div style="height:8px;background:#f1f5f9;border-radius:999px"><div style="height:100%;width:${pct}%;background:${PALETTE[i%PALETTE.length]};border-radius:999px"></div></div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:3px">${n} lượt chọn</div>
                </div>`
              }).join('')}
            </div>`;
        }
      }, 80);
    }
  }
  showToast('Đã thêm biểu đồ ✅','success');
}


// ─────────────────────────────────────────────────────────────
//  EXPORT REPORT
// ─────────────────────────────────────────────────────────────
async function doExportReport(type) {
  const hasData = !!(analysisData || csvData);
  if (!hasData) { showToast('Chưa có dữ liệu để xuất','error'); return; }

  const XLSX_lib = window.XLSX || await _loadSheetJS();
  const title = document.getElementById('rpt-dash-title')?.textContent || 'Báo cáo';

  try {
    const exportData = await _getExportRows();
    if (type === 'CSV') {
      _exportCSVDirect(exportData, title);
    } else if (type === 'Excel') {
      _exportExcelDirect(XLSX_lib, exportData, title);
    } else if (type === 'PDF') {
      _exportPDF(title);
    }
  } catch(e) {
    showToast('Lỗi xuất dữ liệu: ' + e.message, 'error');
  }
}

async function _getExportRows() {
  if (csvData) {
    return { headers: csvData.headers, rows: csvData.rows.map(r => csvData.headers.map((_,i) => r[i] ?? '')) };
  }

  // ── Gọi API export để lấy toàn bộ phản hồi + câu trả lời ──
  const token = localStorage.getItem('token') || '';
  let data = null;
  try {
    const res = await fetch(`${API}/reports/export/${currentFormId}`, {
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(errText || res.status);
    }
    data = await res.json().catch(() => null);
    if (!data) throw new Error('Dữ liệu xuất không hợp lệ');
  } catch(e) {
    const fallback = _getExportRowsFromDashboard();
    if (fallback) {
      showToast('API xuất đang lỗi, đã xuất bằng dữ liệu đang hiển thị', 'warning');
      return fallback;
    }
    throw new Error('Không tải được dữ liệu xuất: ' + e.message);
  }

  const questions = Array.isArray(data.questions) ? data.questions : [];
  const rows      = Array.isArray(data.rows)      ? data.rows      : [];

  const fixedHeaders = ['Dấu thời gian'];
  const qHeaders = questions.map(q => q.noi_dung || ('Câu hỏi ' + q.id));
  const headers = [...fixedHeaders, ...qHeaders];

  const exportRows = rows.map(r => {
    let ts = '';
    if (r.ngay_gui) {
      const d = new Date(r.ngay_gui);
      ts = d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    }
    const fixed = [ts];
    
    const qAnswers = questions.map(q => r['q_' + q.id] || '');
    return [...fixed, ...qAnswers];
  });

  return { headers, rows: exportRows };
}

function _getExportRowsFromDashboard() {
  if (!analysisData) return null;
  const questions = Array.isArray(analysisData.questions) ? analysisData.questions : [];
  const sourceRows = Array.isArray(rawRows) ? rawRows : [];

  const fixedHeaders = ['Dấu thời gian'];
  const headers = [...fixedHeaders, ...questions.map(q => q.noi_dung || ('Câu hỏi ' + q.id))];

  if (sourceRows.length) {
    const rows = sourceRows.map(r => {
      const ts = r.ngay_gui ? new Date(r.ngay_gui).toLocaleString('vi-VN') : '';
      const fixed = [ts];
      
      return [...fixed, ...questions.map(q => r['q_' + q.id] || '')];
    });
    return { headers, rows };
  }

  const form = analysisData.form || {};
  const summaryRows = [
    ['Tổng phản hồi', form.so_phan_hoi || 0],
    ['Điểm hài lòng TB', form.diem_tb ? Number(form.diem_tb).toFixed(1) : ''],
    ['Tích cực', form.tich_cuc || 0],
    ['Trung tính', form.trung_tinh || 0],
    ['Tiêu cực', form.tieu_cuc || 0],
    ['Ngày đầu', form.ngay_dau ? new Date(form.ngay_dau).toLocaleDateString('vi-VN') : ''],
    ['Ngày cuối', form.ngay_cuoi ? new Date(form.ngay_cuoi).toLocaleDateString('vi-VN') : '']
  ];
  const questionRows = questions.map((q, idx) => {
    const stats = (analysisData.choice_stats || [])
      .filter(s => Number(s.cau_hoi_id) === Number(q.id))
      .map(s => `${s.lua_chon}: ${s.so_chon}`)
      .join('; ');
    const rating = (analysisData.rating_stats || []).find(s => Number(s.cau_hoi_id) === Number(q.id));
    return [`Câu ${idx + 1}`, q.noi_dung || '', q.loai || '', stats || (rating ? `TB ${Number(rating.diem_tb || 0).toFixed(1)} (${rating.so_tra_loi || 0} trả lời)` : '')];
  });

  return {
    headers: ['Mục', 'Nội dung', 'Loại', 'Thống kê'],
    rows: [...summaryRows.map(r => [r[0], r[1], '', '']), ...questionRows]
  };
}

function _exportCSVDirect({ headers, rows }, title) {
  const { headers: h, rows: r } = { headers, rows };
  _exportCSVRaw(h, r, title);
}
function _exportCSV(title) { /* legacy stub - use _exportCSVDirect */
  const escape = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  _downloadBlob(blob, `${title}.csv`);
  showToast('Đã xuất CSV ✅', 'success');
}
function _exportCSVRaw(headers, rows, title) {
  const escape = v => { const s = String(v??''); return s.includes(',')||s.includes('"')||s.includes('\n') ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  _downloadBlob(blob, `${title}.csv`);
  showToast('Đã xuất CSV ✅', 'success');
}

function _exportExcelDirect(XLSX_lib, { headers, rows }, title) {
  _exportExcelRaw(XLSX_lib, headers, rows, title);
}
function _exportExcelRaw(XLSX_lib, headers, rows, title) {

  // Sheet 1: Dữ liệu thô
  const wsData = XLSX_lib.utils.aoa_to_sheet([headers, ...rows]);

  // Style header row (bold, bg)
  const hRange = XLSX_lib.utils.decode_range(wsData['!ref']);
  for (let c = hRange.s.c; c <= hRange.e.c; c++) {
    const cellRef = XLSX_lib.utils.encode_cell({ r: 0, c });
    if (!wsData[cellRef]) continue;
    wsData[cellRef].s = {
      font: { bold: true, color: { rgb: '1E3A8A' } },
      fill: { fgColor: { rgb: 'DBEAFE' } },
      alignment: { horizontal: 'center', wrapText: true },
      border: {
        bottom: { style: 'medium', color: { rgb: '2563EB' } }
      }
    };
  }
  // Freeze dòng header
  wsData['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Col widths
  wsData['!cols'] = headers.map((h, i) => ({
    wch: i === 0 ? 20 :           // Timestamp
         i === 2 ? 22 :           // Họ tên
         i === 3 ? 28 :           // Email
         i >= 8  ? Math.min(Math.max(h.length + 4, 20), 50) :  // Câu hỏi
         Math.max(h.length + 4, 14)
  }));

  const wb = XLSX_lib.utils.book_new();
  XLSX_lib.utils.book_append_sheet(wb, wsData, 'Dữ liệu');

  // Sheet 2: Tóm tắt thống kê
  if (analysisData) {
    const d = analysisData;
    const total = d.form.so_phan_hoi || 0;
    const summaryData = [
      ['📊 Báo cáo thống kê – ' + title],
      [],
      ['Chỉ số', 'Giá trị'],
      ['Tổng phản hồi', total],
      ['Điểm hài lòng TB', d.form.diem_tb ? parseFloat(d.form.diem_tb).toFixed(1) + ' ★' : '—'],
      ['Phản hồi tích cực', d.form.tich_cuc || 0],
      ['Phản hồi tiêu cực', d.form.tieu_cuc || 0],
      ['Tỷ lệ tích cực', total ? Math.round((d.form.tich_cuc||0)/total*100) + '%' : '—'],
      ['Ngày bắt đầu', d.form.ngay_dau ? new Date(d.form.ngay_dau).toLocaleDateString('vi-VN') : '—'],
      ['Ngày kết thúc', d.form.ngay_cuoi ? new Date(d.form.ngay_cuoi).toLocaleDateString('vi-VN') : '—'],
    ];
    const wsSummary = XLSX_lib.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 26 }, { wch: 20 }];
    wsSummary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    XLSX_lib.utils.book_append_sheet(wb, wsSummary, 'Tóm tắt');
  }

  const buf = XLSX_lib.write(wb, { bookType: 'xlsx', type: 'array' });
  _downloadBlob(new Blob([buf], { type: 'application/octet-stream' }), `${title}.xlsx`);
  showToast('Đã xuất Excel ✅', 'success');
}

async function _exportPDF(title) {
  const d = analysisData;
  let total = 0;
  if (d && d.form) total = d.form.so_phan_hoi || 0;
  else if (csvData && csvData.rows) total = csvData.rows.length;

  const id = 'pdf-preview-overlay';
  document.getElementById(id)?.remove();

  const chartsGrid = document.getElementById('rpt-charts-grid');
  if (!chartsGrid) {
    showToast('Vui lòng xem báo cáo để tải biểu đồ trước', 'error');
    return;
  }

  const clone = chartsGrid.cloneNode(true);
  const originalCanvases = chartsGrid.querySelectorAll('canvas');
  const clonedCanvases = clone.querySelectorAll('canvas');
  originalCanvases.forEach((canvas, i) => {
    try {
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png');
      img.style.width = '100%';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      clonedCanvases[i].parentNode.replaceChild(img, clonedCanvases[i]);
    } catch(e) { console.error(e); }
  });

  // Xóa các ô tìm kiếm trong bản clone để không hiện lên UI xem trước xuất PDF
  const searchInputs = clone.querySelectorAll('input');
  searchInputs.forEach(input => {
    if (input.parentNode) input.parentNode.remove();
  });

  const exportTime = new Date().toLocaleString('vi-VN');

  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)';
  overlay.innerHTML = `
    <div style="background:var(--gray-50);border-radius:16px;width:850px;max-width:95vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.2);font-family:'Inter','Segoe UI',system-ui,sans-serif">
      <!-- Header bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #f1f5f9">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:#00008B;display:flex;align-items:center;justify-content:center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div>
            <div style="font-size:14px;font-weight:800;color:var(--gray-900);letter-spacing:-0.01em">Xem trước xuất báo cáo biểu đồ</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:1px">${total} phản hồi · ${exportTime}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="window.print()" style="padding:8px 18px;background:#00008B;color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:inherit;transition:opacity .15s" onmouseenter="this.style.opacity='0.9'" onmouseleave="this.style.opacity='1'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            In / Lưu PDF
          </button>
          <button onclick="document.getElementById('${id}').remove()" style="width:34px;height:34px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;font-size:16px;color:#94a3b8;display:flex;align-items:center;justify-content:center;font-family:inherit;transition:all .15s" onmouseenter="this.style.background='#fee2e2';this.style.color='#ef4444';this.style.borderColor='#fecaca'" onmouseleave="this.style.background='var(--gray-100)';this.style.color='#94a3b8';this.style.borderColor='var(--gray-200)'">✕</button>
        </div>
      </div>
      <!-- PDF body -->
      <div id="pdf-body" style="overflow-y:auto;padding:28px 28px 24px;flex:1;font-family:'Inter','Segoe UI',system-ui,sans-serif">
        <!-- Title area -->
        <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #00008B">
          <div style="font-size:18px;font-weight:800;color:var(--gray-900);letter-spacing:-0.02em;line-height:1.3">${title}</div>
          <div style="font-size:11.5px;color:#64748b;margin-top:6px;display:flex;align-items:center;gap:12px">
            <span>📅 Xuất lúc ${exportTime}</span>
            <span style="width:4px;height:4px;border-radius:50%;background:#cbd5e1"></span>
            <span>📊 ${total} phản hồi</span>
          </div>
        </div>
        <!-- Charts Content -->
        <div style="border-radius:10px">${clone.innerHTML}</div>
      </div>
    </div>`;

  // Print style
  const style = document.createElement('style');
  style.id = 'pdf-print-style';
  style.textContent = `@media print{
    @page{margin:12mm 10mm}
    body>*:not(#${id}){display:none!important}
    #${id}{position:static!important;background:none!important;backdrop-filter:none!important;display:block!important;width:100%!important;max-width:100%!important}
    #${id}>div{box-shadow:none!important;border-radius:0!important;max-height:none!important;width:100%!important;max-width:100%!important}
    #${id} button{display:none!important}
    #pdf-body{overflow:visible!important;padding:0!important;width:100%!important}
    #pdf-body>div{border-radius:0!important;border:none!important;width:100%!important}
    #pdf-body .dash-card {page-break-inside: avoid; margin-bottom: 24px !important; border: 1px solid #e2e8f0; border-radius: 8px;}
    #pdf-body input {display:none!important}
    #pdf-body [id^="rpt-text-answers-"], #pdf-body [style*="overflow-y"] {max-height:none!important;overflow:visible!important}
  }`;
  document.head.appendChild(style);
  overlay.addEventListener('remove', () => style.remove());

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if(e.target===overlay){ overlay.remove(); style.remove(); } });
  showToast('Xem trước PDF ✅', 'success');
}

function _downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}


// ─────────────────────────────────────────────────────────────
//  AI ANALYSIS – Google Gemini (qua backend)
// ─────────────────────────────────────────────────────────────
function _buildAnalysisContext() {
  if (analysisData) {
    const d = analysisData;
    const total = d.form.so_phan_hoi || 0;
    const posR  = total ? Math.round((d.form.tich_cuc||0)/total*100) : 0;
    const negR  = total ? Math.round((d.form.tieu_cuc||0)/total*100) : 0;
    const ratingDist = (d.rating_dist||[]).map(r=>`${r.sao}★: ${r.so_luong} người`).join(', ');
    const questions  = (d.questions||[]).map(q => {
      let detail = '';
      if (q.loai === 'rating') {
        const rs = (d.rating_stats||[]).find(s=>s.cau_hoi_id===q.id);
        if (rs) detail = `(TB: ${parseFloat(rs.diem_tb).toFixed(1)}★, min: ${rs.min_diem}★, max: ${rs.max_diem}★)`;
      } else if (q.loai === 'choice') {
        const stats = (d.choice_stats||[]).filter(s=>s.cau_hoi_id===q.id);
        if (stats.length) detail = '(' + stats.map(s=>`"${s.lua_chon}": ${s.so_chon}`).join(', ') + ')';
      }
      return `- [${q.loai}] ${q.noi_dung} ${detail}`;
    }).join('\n');
    return `Form khảo sát: "${d.form?.ten_form || 'Không rõ tên'}"
Tổng phản hồi: ${total}
Điểm hài lòng trung bình: ${fmt(d.form.diem_tb)}★ / 5
Tỷ lệ tích cực: ${posR}% (${d.form.tich_cuc||0} người)
Tỷ lệ tiêu cực: ${negR}% (${d.form.tieu_cuc||0} người)
Phân bổ đánh giá: ${ratingDist || 'Không có'}
Thời gian: ${fmtDate(d.form.ngay_dau)} → ${fmtDate(d.form.ngay_cuoi)}
Câu hỏi (${(d.questions||[]).length} câu):
${questions || 'Không có'}`;
  }
  if (csvData) {
    const { headers, rows, colTypes } = csvData;
    const rCol = colTypes.map((t,i)=>({t,i})).find(c=>c.t==='rating');
    const avg  = rCol ? (() => { const v=rows.map(r=>parseFloat(r[rCol.i])).filter(v=>!isNaN(v)); return v.length?fmt(v.reduce((a,b)=>a+b,0)/v.length):null; })() : null;
    return `File Excel import: ${rows.length} phản hồi, ${headers.length} cột
Các cột: ${headers.join(', ')}
Điểm trung bình: ${avg ? avg+'★' : 'Không có cột rating'}`;
  }
  return null;
}

let aiAnalysisContext = '';
let aiChatHistory = [];
let aiLastAnalysisText = '';
const AI_QUICK_PROMPTS = [
  'Điểm yếu lớn nhất là gì?',
  'Nên ưu tiên cải thiện việc gì trước?',
  'Nếu làm lại form thì nên sửa câu hỏi nào?',
];

function removeAIMinimizedBubble() {
  document.getElementById('ai-mini-bubble')?.remove();
}

function minimizeAIAnalysis() {
  const modal = document.getElementById('ai-modal');
  if (!modal) return;
  modal.style.display = 'none';
  removeAIMinimizedBubble();

  const bubble = document.createElement('button');
  bubble.id = 'ai-mini-bubble';
  bubble.type = 'button';
  bubble.onclick = restoreAIAnalysis;
  bubble.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:100000;width:62px;height:62px;border:none;border-radius:18px;background:linear-gradient(135deg,#38bdf8,#0369a1);box-shadow:0 20px 40px rgba(79,70,229,.28);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff';
  bubble.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><span style="font-size:18px;line-height:1">✦</span><span style="font-size:10px;font-weight:700;line-height:1">AI</span></div>';
  document.body.appendChild(bubble);
}

function restoreAIAnalysis() {
  const modal = document.getElementById('ai-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  removeAIMinimizedBubble();
}

function closeAIAnalysis() {
  document.getElementById('ai-modal')?.remove();
  removeAIMinimizedBubble();
}

function openAIAnalysis() {
  const ctx = _buildAnalysisContext();
  if (!ctx) { showToast('Chưa có dữ liệu để phân tích','error'); return; }
  aiAnalysisContext = ctx;
  aiChatHistory = [];
  aiLastAnalysisText = '';

  removeAIMinimizedBubble();
  const old = document.getElementById('ai-modal'); if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'ai-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:var(--gray-50);border-radius:20px;width:760px;max-width:95vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.22);overflow:hidden">
      <div style="padding:20px 24px 16px;border-bottom:1px solid #f1f5f9;background:linear-gradient(135deg,#f0f9ff,#e0f2fe)">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#38bdf8,#0369a1);display:flex;align-items:center;justify-content:center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="20" height="20"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            </div>
            <div>
              <div style="font-size:16px;font-weight:800;color:var(--gray-900)">Phân tích AI</div>
              <div style="font-size:11.5px;color:#0284c7;font-weight:600">Powered by Google Gemini</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <button onclick="minimizeAIAnalysis()" title="Thu nhỏ" style="width:32px;height:32px;border-radius:9px;border:1px solid #e2e8f0;background:var(--gray-50);cursor:pointer;font-size:16px;color:#94a3b8">—</button>
            <button onclick="closeAIAnalysis()" style="width:32px;height:32px;border-radius:9px;border:1px solid #e2e8f0;background:var(--gray-50);cursor:pointer;font-size:16px;color:#94a3b8">✕</button>
          </div>
        </div>
      </div>
      <div id="ai-body" style="flex:1;overflow-y:auto;padding:20px 24px"></div>
      <div id="ai-chat-wrap" style="display:none;padding:0 24px 18px">
        <div style="border:1px solid #e2e8f0;border-radius:16px;background:#fcfcff;overflow:hidden">
          <div style="padding:12px 14px;border-bottom:1px solid #00008B;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#f0f9ff,#e0f2fe)">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--gray-900)">Trao đổi với bot</div>
              <div style="font-size:11.5px;color:#64748b">Hỏi thêm về chính báo cáo đang xem</div>
            </div>
          </div>
          <div id="ai-chat-messages" style="max-height:220px;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px"></div>
          <div id="ai-chat-quick" style="padding:0 14px 12px;display:flex;gap:8px;flex-wrap:wrap"></div>
          <div style="padding:12px;border-top:1px solid #00008B;display:flex;gap:10px;align-items:flex-end;background:var(--gray-50)">
            <textarea id="ai-chat-input" rows="2" placeholder="Ví dụ: Điểm yếu lớn nhất là gì? Tôi nên ưu tiên cải thiện mục nào trước?" style="flex:1;resize:none;border:1px solid #dbe5f0;border-radius:12px;padding:10px 12px;font:inherit;color:var(--gray-700);outline:none;min-height:44px;max-height:120px"></textarea>
            <button id="ai-chat-send-btn" onclick="sendAIChat()" style="padding:10px 16px;border-radius:12px;border:none;background:linear-gradient(135deg,#38bdf8,#0369a1);color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap">Gửi câu hỏi</button>
          </div>
        </div>
      </div>
      <div style="padding:14px 24px;border-top:1px solid #f1f5f9;display:flex;gap:8px;flex-wrap:wrap">
        <button id="ai-run-btn" onclick="runAIAnalysis()" style="flex:1;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,#38bdf8,#0369a1);color:#fff;font-size:13px;font-weight:700;cursor:pointer"
          onmouseenter="this.style.opacity='.88'" onmouseleave="this.style.opacity='1'">✨ Bắt đầu phân tích</button>
        <button id="ai-rerun-btn" onclick="runAIAnalysis()" style="display:none;padding:10px 18px;border-radius:10px;border:1.5px solid #e2e8f0;background:var(--gray-50);color:#64748b;font-size:13px;font-weight:600;cursor:pointer">🔄 Phân tích lại</button>
        <button id="ai-chat-toggle-btn" onclick="toggleAIChat()" style="display:none;padding:10px 18px;border-radius:10px;border:1.5px solid #bae6fd;background:#f0f9ff;color:#0369a1;font-size:13px;font-weight:700;cursor:pointer">💬 Trao đổi với bot</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target===modal) closeAIAnalysis(); });
  document.getElementById('ai-chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAIChat();
    }
  });
  setTimeout(() => runAIAnalysis(), 150);
}

function formatAIAnalysisText(text) {
  const normalized = String(text || '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*---+\s*$/gm, '')
    .trim();

  return esc(normalized)
    .replace(/\n{2,}/g, '</p><p style="margin:0 0 12px">')
    .replace(/\n/g, '<br>');
}

function renderAIQuickPrompts() {
  const wrap = document.getElementById('ai-chat-quick');
  if (!wrap) return;
  wrap.innerHTML = AI_QUICK_PROMPTS.map(prompt => `
    <button onclick="useAIQuickPrompt('${prompt.replace(/'/g, "\\'")}')" style="padding:8px 10px;border-radius:999px;border:1px solid #ddd6fe;background:#faf5ff;color:#0369a1;font-size:11.5px;font-weight:700;cursor:pointer">
      ${esc(prompt)}
    </button>
  `).join('');
}

function useAIQuickPrompt(prompt) {
  const input = document.getElementById('ai-chat-input');
  if (!input) return;
  input.value = prompt;
  input.focus();
}

function renderAIChatMessages() {
  const wrap = document.getElementById('ai-chat-messages');
  if (!wrap) return;
  if (!aiChatHistory.length) {
    wrap.innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start">
      <div style="width:34px;height:34px;border-radius:12px;background:linear-gradient(135deg,#38bdf8,#0369a1);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0">✦</div>
      <div style="max-width:85%;padding:11px 13px;border-radius:14px;font-size:12.5px;line-height:1.7;background:#f8fafc;color:var(--gray-700);border:1px solid #e2e8f0">
        Mình đã sẵn sàng trao đổi thêm về báo cáo này.
        <br>Bạn có thể dùng câu hỏi nhanh bên dưới hoặc hỏi tự do theo điều bạn đang quan tâm.
      </div>
    </div>`;
    renderAIQuickPrompts();
    return;
  }
  wrap.innerHTML = aiChatHistory.map(item => `
    <div style="display:flex;justify-content:${item.role === 'user' ? 'flex-end' : 'flex-start'};gap:10px;align-items:flex-end">
      ${item.role === 'assistant' ? `<div style="width:34px;height:34px;border-radius:12px;background:linear-gradient(135deg,#38bdf8,#0369a1);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0">✦</div>` : ''}
      <div style="max-width:85%;padding:10px 12px;border-radius:14px;font-size:12.5px;line-height:1.7;white-space:pre-wrap;background:${item.role === 'user' ? 'linear-gradient(135deg,#38bdf8,#0369a1)' : '#f8fafc'};color:${item.role === 'user' ? '#fff' : 'var(--gray-700)'};border:${item.role === 'user' ? 'none' : '1px solid #e2e8f0'}">${esc(item.text || '')}</div>
      ${item.role === 'user' ? `<div style="width:34px;height:34px;border-radius:12px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:var(--gray-600);font-size:14px;font-weight:800;flex-shrink:0">B</div>` : ''}
    </div>
  `).join('');
  renderAIQuickPrompts();
  wrap.scrollTop = wrap.scrollHeight;
}

function toggleAIChat(forceOpen) {
  const wrap = document.getElementById('ai-chat-wrap');
  if (!wrap) return;
  const open = typeof forceOpen === 'boolean' ? forceOpen : wrap.style.display === 'none';
  wrap.style.display = open ? 'block' : 'none';
  if (open) renderAIChatMessages();
}

async function sendAIChat() {
  const input = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('ai-chat-send-btn');
  if (!input || !sendBtn) return;
  const question = input.value.trim();
  if (!question || !aiAnalysisContext) return;

  aiChatHistory.push({ role: 'user', text: question });
  input.value = '';
  renderAIChatMessages();
  const wrap = document.getElementById('ai-chat-messages');
  if (wrap) {
    wrap.innerHTML += `
      <div id="ai-chat-typing" style="display:flex;justify-content:flex-start;gap:10px;align-items:flex-end">
        <div style="width:34px;height:34px;border-radius:12px;background:linear-gradient(135deg,#38bdf8,#0369a1);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0">✦</div>
        <div style="padding:10px 12px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:12px">
          Bot đang suy nghĩ...
        </div>
      </div>`;
    wrap.scrollTop = wrap.scrollHeight;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = 'Đang trả lời...';

  try {
    const resp = await fetch(`${API}/reports/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {})
      },
      body: JSON.stringify({
        context: `${aiAnalysisContext}\n\nKẾT QUẢ PHÂN TÍCH GẦN NHẤT:\n${aiLastAnalysisText || ''}`,
        question,
        history: aiChatHistory
      })
    });
    const result = await resp.json();
    document.getElementById('ai-chat-typing')?.remove();
    if (!resp.ok) {
      aiChatHistory.push({ role: 'assistant', text: result.message || 'Bot chưa thể trả lời lúc này.' });
      renderAIChatMessages();
      return;
    }
    aiChatHistory.push({ role: 'assistant', text: result.answer || result.analysis || 'Bot chưa có nội dung phản hồi.' });
    renderAIChatMessages();
  } catch (err) {
    document.getElementById('ai-chat-typing')?.remove();
    aiChatHistory.push({ role: 'assistant', text: 'Lỗi kết nối server: ' + err.message });
    renderAIChatMessages();
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Gửi câu hỏi';
  }
}

async function runAIAnalysis() {
  const ctx = _buildAnalysisContext();
  const body = document.getElementById('ai-body');
  const runBtn = document.getElementById('ai-run-btn');
  const rerunBtn = document.getElementById('ai-rerun-btn');
  const chatBtn = document.getElementById('ai-chat-toggle-btn');
  if (!body || !ctx) return;

  runBtn.disabled = true; runBtn.textContent = '⏳ Đang phân tích...';
  rerunBtn.style.display = 'none';
  if (chatBtn) chatBtn.style.display = 'none';
  toggleAIChat(false);
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;padding:8px 0">
      ${['Đọc dữ liệu form...','Phân tích xu hướng...','Đánh giá điểm mạnh / yếu...','Tạo đề xuất cải thiện...'].map((t,i)=>`
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f8fafc;border-radius:10px">
          <div style="width:8px;height:8px;border-radius:50%;background:#0284c7;animation:aipulse 1s infinite ${i*0.2}s"></div>
          <span style="font-size:13px;color:#64748b">${t}</span>
        </div>`).join('')}
    </div>
    <style>@keyframes aipulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}</style>`;

  try {
    const resp = await fetch(`${API}/reports/ai-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {})
      },
      body: JSON.stringify({ context: ctx })
    });

    const result = await resp.json();
    if (!resp.ok) {
      const isKeyError = /key/i.test(result.message || '');
      body.innerHTML = `<div style="padding:20px;background:#fff1f2;border-radius:12px;border-left:4px solid #ef4444">
        <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:6px">❌ ${esc(result.message||'Lỗi không xác định')}</div>
        <div style="font-size:12px;color:#94a3b8">${resp.status===503 ? 'Server chưa cấu hình GEMINI_API_KEY.' : resp.status===429 ? 'Gemini đang hết quota hoặc bị rate limit, thử lại sau.' : isKeyError ? 'Lỗi API Key từ phía Google.' : 'Vui lòng kiểm tra lại cấu hình hoặc thử lại sau.'}</div>
      </div>`;
      return;
    }

    if (result.analysis) {
      aiLastAnalysisText = result.analysis;
      body.innerHTML = `
        <div style="padding:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px">
          <div style="font-size:14px;font-weight:700;color:var(--gray-900);margin-bottom:10px">Kết quả phân tích</div>
          <div style="font-size:13px;color:var(--gray-700);line-height:1.8">
            <p style="margin:0 0 12px">${formatAIAnalysisText(result.analysis)}</p>
          </div>
        </div>`;
      runBtn.style.display = 'none';
      rerunBtn.style.display = 'block';
      if (chatBtn) chatBtn.style.display = 'block';
      return;
    }

    const score = result.diem_tong || 0;
    const sc = score>=80?'#059669':score>=60?'#d97706':'#dc2626';
    const sb = score>=80?'#f0fdf4':score>=60?'#fffbeb':'#fff1f2';
    const uuMap = {cao:{l:'Ưu tiên cao',c:'#dc2626',b:'#fff1f2'},trung:{l:'Trung bình',c:'#d97706',b:'#fffbeb'},thap:{l:'Thấp',c:'#64748b',b:'#f8fafc'}};

    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:20px;padding:18px;background:${sb};border-radius:14px;margin-bottom:16px;border:1px solid ${sc}22">
        <div style="text-align:center;flex-shrink:0">
          <div style="font-size:52px;font-weight:900;color:${sc};line-height:1">${score}</div>
          <div style="font-size:11px;color:${sc};font-weight:700;margin-top:2px">/ 100 điểm</div>
        </div>
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--gray-900);margin-bottom:6px">Đánh giá tổng quan</div>
          <div style="font-size:13px;color:var(--gray-700);line-height:1.6">${esc(result.nhan_xet_tong||'')}</div>
        </div>
      </div>
      ${result.canh_bao?`<div style="padding:12px 16px;background:#fff7ed;border-radius:10px;border-left:4px solid #f97316;margin-bottom:16px;display:flex;gap:10px">
        <span style="font-size:18px">⚠️</span><div style="font-size:12.5px;color:#9a3412;line-height:1.6">${esc(result.canh_bao)}</div>
      </div>`:''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div style="padding:14px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0">
          <div style="font-size:12px;font-weight:700;color:#059669;margin-bottom:8px">✅ Điểm mạnh</div>
          ${(result.diem_manh||[]).map(d=>`<div style="font-size:12px;color:#166534;padding:4px 0;border-bottom:1px solid #dcfce7;display:flex;gap:6px"><span>•</span><span>${esc(d)}</span></div>`).join('')}
        </div>
        <div style="padding:14px;background:#fff1f2;border-radius:12px;border:1px solid #fecaca">
          <div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:8px">❌ Cần cải thiện</div>
          ${(result.diem_yeu||[]).map(d=>`<div style="font-size:12px;color:#991b1b;padding:4px 0;border-bottom:1px solid #fee2e2;display:flex;gap:6px"><span>•</span><span>${esc(d)}</span></div>`).join('')}
        </div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;color:var(--gray-900);margin-bottom:10px">🎯 Đề xuất cải thiện</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${(result.de_xuat||[]).map((dx,i)=>{const u=uuMap[dx.uu_tien]||uuMap.thap;return `
          <div style="padding:12px 14px;background:#fafbff;border-radius:10px;border:1px solid #e8edf5;border-left:3px solid ${u.c}">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
              <div style="font-size:13px;font-weight:700;color:var(--gray-900)">${i+1}. ${esc(dx.tieu_de)}</div>
              <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${u.b};color:${u.c}">${u.l}</span>
            </div>
            <div style="font-size:12px;color:var(--gray-600);line-height:1.6">${esc(dx.noi_dung)}</div>
          </div>`;}).join('')}
        </div>
      </div>
      ${result.cau_hoi_phan_tich?`<div style="padding:12px 16px;background:#f0f9ff;border-radius:10px;border-left:4px solid #00008B;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--brand-color);margin-bottom:4px">📋 Nhận xét câu hỏi</div>
        <div style="font-size:12px;color:#0c4a6e;line-height:1.6">${esc(result.cau_hoi_phan_tich)}</div>
      </div>`:''}
      ${result.du_bao?`<div style="padding:12px 16px;background:#faf5ff;border-radius:10px;border-left:4px solid #0284c7">
        <div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:4px">🔮 Dự báo xu hướng</div>
        <div style="font-size:12px;color:#4c1d95;line-height:1.6">${esc(result.du_bao)}</div>
      </div>`:''}`;

    runBtn.style.display = 'none';
    rerunBtn.style.display = 'block';
  } catch(err) {
    body.innerHTML = `<div style="padding:20px;background:#fff1f2;border-radius:12px;border-left:4px solid #ef4444">
      <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:6px">❌ Lỗi kết nối server</div>
      <div style="font-size:12px;color:#64748b">${esc(err.message)}</div>
    </div>`;
  } finally {
    runBtn.disabled = false; runBtn.textContent = '✨ Bắt đầu phân tích';
  }
}

// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────
loadFormList().then(() => {
  const pending = localStorage.getItem('_pendingForm');
  if (pending) {
    localStorage.removeItem('_pendingForm');
    try {
      const { id, name } = JSON.parse(pending);
      if (id) loadFormAnalysis(id, name);
    } catch(e) {}
  }
});

let globalDashboardChartInstance = null;

async function initGlobalDashboardChart(range = '7') {
  const token = localStorage.getItem('token') || '';
  try {
    // 1. Lấy dữ liệu tổng quan cho KPI cards
    const overviewData = await fetchReportJson(`${API}/reports/overview`, token);
    
    const formsVal = document.getElementById('rpt-total-forms-value');
    if(formsVal) formsVal.textContent = overviewData.tong_form || 0;
    
    const responsesVal = document.getElementById('rpt-total-responses-value');
    if(responsesVal) responsesVal.textContent = overviewData.tong_phan_hoi || 0;
    
    const formsTrend = document.getElementById('rpt-total-forms-trend');
    if(formsTrend) {
      updateTrendUI(formsTrend, overviewData.form_thang_nay || 0, overviewData.form_thang_truoc || 0);
    }
    
    const resTrend = document.getElementById('rpt-total-responses-trend');
    if(resTrend) {
      updateTrendUI(resTrend, overviewData.phan_hoi_thang_nay || 0, overviewData.phan_hoi_thang_truoc || 0);
    }
    const activeVal = document.getElementById('rpt-active-forms-value');
    const activeTotal = document.getElementById('rpt-active-forms-total');
    const activeBar = document.getElementById('rpt-active-rate-bar');
    
    if(activeVal && activeTotal && activeBar) {
      let active = overviewData.form_hoat_dong || 0;
      let total = overviewData.tong_form || 0;
      activeVal.textContent = active;
      activeTotal.textContent = total;
      let pct = total > 0 ? (active / total) * 100 : 0;
      setTimeout(() => {
        activeBar.style.width = pct + '%';
      }, 300);
    }

    // 2. Lấy dữ liệu biểu đồ
    const chartData = await fetchReportJson(`${API}/reports/activity-chart?range=${range}`, token);
    
    const labels = [];
    const formsDataset = [];
    const responsesDataset = [];
    
    if(Array.isArray(chartData) && chartData.length > 0) {
      chartData.forEach(item => {
        let shortDay = item.ten_ngay;
        const enMap = {
          'Monday': 'T2', 'Tuesday': 'T3', 'Wednesday': 'T4',
          'Thursday': 'T5', 'Friday': 'T6', 'Saturday': 'T7', 'Sunday': 'CN'
        };
        if (enMap[shortDay]) shortDay = enMap[shortDay];
        else if (shortDay.includes('Thứ')) shortDay = shortDay.replace('Thứ ', 'T');
        else if (shortDay.includes('Chủ Nhật')) shortDay = 'CN';
        
        // Dùng tên ngày (T2, T3) cho 7 ngày, dùng ngày tháng (14/06) cho các range khác
        let labelToShow = (range === '7' || range === 7) ? shortDay : item.ngay;
        labels.push(labelToShow);
        
        formsDataset.push(item.so_form || 0);
        responsesDataset.push(item.so_phan_hoi || 0);
      });
    }

    const ctx = document.getElementById('rpt-global-chart');
    if(!ctx) return;
    
    if (globalDashboardChartInstance) {
      globalDashboardChartInstance.destroy();
    }

    globalDashboardChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['T5', 'T6', 'T7', 'CN', 'T2', 'T3', 'T4'],
        datasets: [
          {
            label: 'Biểu mẫu tạo mới',
            data: formsDataset.length ? formsDataset : [0, 0, 0, 0, 0, 0, 0],
            borderColor: '#00008B',
            backgroundColor: 'rgba(0,0,139,0.12)',
            borderWidth: 2.5,
            pointBackgroundColor: '#00008B',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            fill: true,
            tension: 0.4,
            clip: false,
            yAxisID: 'y'
          },
          {
            label: 'Phản hồi nhận được',
            data: responsesDataset.length ? responsesDataset : [0, 0, 0, 0, 0, 0, 0],
            borderColor: '#f97316',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointBackgroundColor: '#f97316',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            fill: false,
            tension: 0.4,
            clip: false,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 20, bottom: 20, left: 10, right: 10 }
        },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: true, boxWidth: 8, padding: 20,
              font: { size: 12, weight: '600', family: "'Be Vietnam Pro', sans-serif" },
              color: '#475569'
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 13, family: "'Be Vietnam Pro', sans-serif" },
            bodyFont: { size: 13, family: "'Be Vietnam Pro', sans-serif" },
            padding: 12, cornerRadius: 8, usePointStyle: true
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { 
              font: { size: 12, weight: '600', family: "'Be Vietnam Pro', sans-serif" }, 
              color: '#64748b', 
              padding: 10,
              autoSkip: true,
              maxTicksLimit: 8,
              maxRotation: 0
            }
          },
          y: {
            type: 'linear', display: true, position: 'left',
            title: { display: true, text: 'Biểu mẫu', color: '#00008B', font: { size: 12, weight: '600', family: "'Be Vietnam Pro', sans-serif" }, padding: {bottom: 10} },
            grid: { color: '#f1f5f9' },
            ticks: { stepSize: 1, color: '#00008B', font: { size: 11, weight: '600', family: "'Be Vietnam Pro', sans-serif" }, padding: 8 },
            min: 0, suggestedMax: 6
          },
          y1: {
            type: 'linear', display: true, position: 'right',
            title: { display: true, text: 'Phản hồi', color: '#f97316', font: { size: 12, weight: '600', family: "'Be Vietnam Pro', sans-serif" }, padding: {bottom: 10} },
            grid: { drawOnChartArea: false },
            ticks: { stepSize: 5, color: '#f97316', font: { size: 11, weight: '600', family: "'Be Vietnam Pro', sans-serif" }, padding: 8 },
            min: 0, suggestedMax: 35
          }
        }
      }
    });
  } catch(err) {
    console.error('Lỗi khởi tạo biểu đồ:', err);
  }
}

function updateTrendUI(element, current, previous) {
  let percent = 0;
  if(previous === 0) {
    percent = current > 0 ? 100 : 0;
  } else {
    percent = Math.round(((current - previous) / previous) * 100);
  }
  
  if (percent >= 0) {
    element.style.color = '#10b981';
    element.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
      +${percent}% <span style="color:#94a3b8;font-weight:500;">so với tháng trước</span>
    `;
  } else {
    element.style.color = '#ef4444';
    element.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>
      ${percent}% <span style="color:#94a3b8;font-weight:500;">so với tháng trước</span>
    `;
  }
}

window.setActivityRange = function(days, btn) {
  const btns = btn.parentElement.querySelectorAll('.rpt-range-btn');
  btns.forEach(b => {
    b.style.background = 'transparent';
    b.style.color = '#64748b';
    b.style.boxShadow = 'none';
  });
  btn.style.background = '#fff';
  btn.style.color = 'var(--gray-900)';
  btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
  
  initGlobalDashboardChart(days);
};
setTimeout(initGlobalDashboardChart, 100);
