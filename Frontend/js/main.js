// ===== SHARED CONSTANTS =====
const API_BASE = 'http://localhost:3000/api';
function buildPublicFormLink(formId) {
  const url = new URL('../pages/form-builder.html', window.location.href);
  url.searchParams.set('form_id', formId);
  url.searchParams.set('prefill', 'full_name,class_name,teacher_name,student_code,phone');
  return url.toString();
}

// ===== SHARED LOGGING =====
function logActivityAction(actionType, actionLabel, formName, detail, formId = '') {
  const logs = JSON.parse(localStorage.getItem('flic_audit_logs') || 'null') || [];
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const user = currentUser.ho_ten || currentUser.ten_đang_nhap || 'Nguyễn Văn A';
  const role = (currentUser.vai_tro === 'admin' || currentUser.vai_tro === 'manager') ? 'Quản lý' : 'Nhân viên';
  logs.unshift({
    id: Date.now(),
    time: new Date().toISOString(),
    user: user,
    role: role,
    actionType,
    actionLabel,
    formName,
    detail,
    formId
  });
  localStorage.setItem('flic_audit_logs', JSON.stringify(logs));
}

// ===== SHARED SVG ICONS =====
const IC = {
  close:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  search:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  plus:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  eye:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eye_off:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  edit:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trashSm:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`,
  dots:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
  check:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M20 6L9 17l-5-5"/></svg>`,
  reject:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  save:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  chevDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="6 9 12 15 18 9"/></svg>`,
  ban:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
};

// ===== EXPORT ENGINE =====
// Mỗi trang gán: window.__exportDataFn = () => ({ headers, rows, title, filename })

function _downloadBlob(blob, filename) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function _escCsv(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function _exportCSV(headers, rows, filename) {
  const lines = [headers.map(_escCsv).join(','), ...rows.map(r => r.map(_escCsv).join(','))];
  _downloadBlob(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), filename + '.csv');
}
function _exportExcel(headers, rows, sheetName, filename) {
  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const cell = (v, bold) => {
    const num = !isNaN(v) && v !== '' && v != null;
    return `<Cell${bold?' ss:StyleID="h"':num?' ss:StyleID="n"':''}><Data ss:Type="${num?'Number':'String'}">${num?Number(v):esc(v)}</Data></Cell>`;
  };
  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#E8F4FD" ss:Pattern="Solid"/></Style><Style ss:ID="n"><NumberFormat ss:Format="General"/></Style></Styles>
 <Worksheet ss:Name="${esc(sheetName)}"><Table>
  <Row>${headers.map(h=>cell(h,true)).join('')}</Row>
  ${rows.map(r=>`<Row>${r.map(v=>cell(v,false)).join('')}</Row>`).join('')}
 </Table></Worksheet></Workbook>`;
  _downloadBlob(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' }), filename + '.xls');
}
function _exportPDF(headers, rows, title) {
  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}h2{font-size:16px;margin-bottom:4px}.sub{font-size:11px;color:#666;margin-bottom:14px}table{width:100%;border-collapse:collapse}th{background:#00008B;color:#fff;padding:7px 10px;text-align:left;font-size:11px}td{padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px}tr:nth-child(even)td{background:#f8fafc}@media print{@page{margin:1cm}}</style>
</head><body><h2>${esc(title)}</h2><div class="sub">Xuất lúc: ${new Date().toLocaleString('vi-VN')} · Tổng: ${rows.length} dòng</div>
<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
<script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
function doExport(type) {
  if (typeof window.__exportDataFn !== 'function') { showToast('Chưa có dữ liệu để xuất', 'error'); return; }
  const { headers, rows, title, filename } = window.__exportDataFn();
  if (!rows?.length) { showToast('Không có dữ liệu để xuất', 'error'); return; }
  const fname = filename || title || 'export';
  try {
    if (type === 'CSV')   _exportCSV(headers, rows, fname);
    if (type === 'Excel') _exportExcel(headers, rows, title, fname);
    if (type === 'PDF')   _exportPDF(headers, rows, title);
    showToast(`Đã xuất ${type} thành công ✅`, 'success');
  } catch(e) { showToast('Xuất thất bại: ' + e.message, 'error'); }
}

// ===== SHARED BUILDERS =====
function filterPanel(panelId, fields) {
  const fieldHtml = fields.map(f => `
    <div>
      <label style="font-size:12.5px;font-weight:600;color:var(--gray-600);display:block;margin-bottom:5px">${f.label}</label>
      ${f.type === 'date'
        ? `<input type="date" class="input" style="width:100%">`
        : `<select id="${f.id||''}" class="input" style="width:100%">${f.opts.map(o=>
            typeof o==='string' ? `<option>${o}</option>` : `<option value="${o.v}">${o.l}</option>`
          ).join('')}</select>`
      }
    </div>`).join('');
  return `
  <div id="${panelId}" style="display:none;margin-bottom:16px">
    <div style="background:#fff;border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow-sm)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span style="font-size:15px;font-weight:700">Bộ lọc nâng cao</span>
        <button class="icon-btn" onclick="document.getElementById('${panelId}').style.display='none'">${IC.close}</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px">${fieldHtml}</div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" onclick="applyFilter()">Áp dụng bộ lọc</button>
        <button class="btn btn-outline" onclick="resetFilter()">Xóa bộ lọc</button>
      </div>
    </div>
  </div>`;
}

function statCard(label, value, color, bg, iconPath, extra='') {
  return `<div class="card stat-card" style="padding:20px">
    <div class="stat-header">
      <div><div class="stat-label">${label}</div><div class="stat-value" style="color:${color}">${value}</div></div>
      ${bg ? `<div class="stat-icon" style="background:${bg}"><svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" width="22" height="22">${iconPath}</svg></div>` : ''}
    </div>${extra}</div>`;
}

function outsideClick(wrapId, menuId) {
  document.addEventListener('click', e => {
    if (!e.target.closest('#' + wrapId)) document.getElementById(menuId)?.classList.remove('open');
  });
}

// ===== TOAST =====
function showToast(message, type = 'default') {
  let container = document.getElementById('toast-container');
  if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M20 6L9 17l-5-5"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = (icons[type] || icons.default) + `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'fadeOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ===== THEME ENGINE =====
(function initThemeEngine() {
  const THEME_KEY = 'flic_theme';
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  const getStoredTheme = () => localStorage.getItem(THEME_KEY) || 'light';
  const resolveTheme   = t => t === 'auto' ? (media?.matches ? 'dark' : 'light') : (t === 'dark' ? 'dark' : 'light');
  const applyTheme     = theme => {
    const resolved = resolveTheme(theme || getStoredTheme());
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-mode', theme || getStoredTheme());
    document.body.setAttribute('data-theme', resolved);
    return resolved;
  };
  window.getStoredTheme = getStoredTheme;
  window.applyTheme = applyTheme;
  applyTheme(getStoredTheme());
  media?.addEventListener('change', () => { if (getStoredTheme() === 'auto') applyTheme('auto'); });
})();

// ===== MODAL & PANEL =====
function openModal(id)  { const o=document.getElementById(id); if(o){ o.classList.add('open');    document.body.style.overflow='hidden'; } }
function closeModal(id) { const o=document.getElementById(id); if(o){ o.classList.remove('open'); document.body.style.overflow=''; } }
function openPanel(id)  { const o=document.getElementById(id); if(o){ o.classList.add('open');    document.body.style.overflow='hidden'; } }
function closePanel(id) { const o=document.getElementById(id); if(o){ o.classList.remove('open'); document.body.style.overflow=''; } }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('panel-overlay')) {
    if (e.target.id === 'edit-form-modal' || e.target.id === 'create-form-modal') return; // không tự đóng khi click ngoài
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ===== TABS =====
function initTabs(containerSelector) {
  document.querySelectorAll(containerSelector || '[data-tabs]').forEach(container => {
    const buttons  = container.querySelectorAll('.tab-btn');
    const contents = container.querySelectorAll('.tab-content');
    buttons.forEach(btn => btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      container.querySelector(`[data-tab-content="${btn.dataset.tab}"]`)?.classList.add('active');
    }));
  });
}

// ===== DROPDOWN =====
function initDropdowns() {
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-dropdown-trigger]');
    if (trigger) {
      e.stopPropagation();
      const menu = document.getElementById(trigger.dataset.dropdownTrigger);
      if (menu) {
        document.querySelectorAll('.dropdown-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
        menu.classList.toggle('open');
      }
      return;
    }
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  });
}
