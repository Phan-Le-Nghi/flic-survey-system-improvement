// ══════════════════════════════════════════════════════════════
//  FLIC – Thư viện câu hỏi (library.js)
//  Dữ liệu luôn lấy từ API /api/library — không dùng hardcode
// ══════════════════════════════════════════════════════════════

let libData    = { ngoaingu: [], tinhoc: [] };
let activeTab  = 'ngoaingu';
let expandedId = null;
let addingNew  = false;
let searchVal  = '';
let _loading   = false;

const esc  = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const TOKEN = () => localStorage.getItem('token') || '';
const AUTH  = () => TOKEN() ? { Authorization: `Bearer ${TOKEN()}` } : {};

const TYPE_LABELS  = {choice:'Trắc nghiệm',checkbox:'Hộp kiểm',dropdown:'Thả xuống',paragraph:'Đoạn văn',short_text:'Đoạn văn',long_text:'Đoạn văn',text:'Đoạn văn',rating:'Xếp hạng',star_rating:'Xếp hạng',scale:'Tuyến tính',grid_radio:'Lưới trắc nghiệm',grid_checkbox:'Lưới hộp kiểm'};
const TYPE_COLORS  = {choice:'#eff6ff;color:#1d4ed8',checkbox:'#f0fdf4;color:#166534',dropdown:'#fef9c3;color:#854d0e',paragraph:'#eef2ff;color:#4338ca',short_text:'#eef2ff;color:#4338ca',long_text:'#eef2ff;color:#4338ca',text:'#eef2ff;color:#4338ca',rating:'#fff7ed;color:#b45309',star_rating:'#fff7ed;color:#b45309',scale:'#eef2ff;color:#4338ca',grid_radio:'#fdf4ff;color:#6b21a8',grid_checkbox:'#f0fdf4;color:#065f46'};
const NEEDS_OPTS   = ['choice','checkbox','dropdown','rating','scale'];
const DEFAULT_RATING_OPTS = ['1','2','3','4','5'];
const NEEDS_GRID   = ['grid_radio','grid_checkbox'];
const TYPE_OPTION_LABELS = {
  choice:'◉ Trắc nghiệm',
  checkbox:'☑ Hộp kiểm',
  dropdown:'▾ Thả xuống',
  paragraph:'¶ Đoạn văn',
  rating:'★ Xếp hạng',
  scale:'⟷ Tuyến tính',
  grid_radio:'⊞ Lưới trắc nghiệm',
  grid_checkbox:'⊟ Lưới hộp kiểm',
};
function normalizeQuestionType(type) {
  if (type === 'text' || type === 'short_text' || type === 'long_text') return 'paragraph';
  if (type === 'star_rating') return 'rating';
  return type;
}
function renderTextPreview(type) {
  const normalizedType = normalizeQuestionType(type);
  if (normalizedType === 'paragraph') {
    return `
      <div style="font-size:11px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Câu trả lời mẫu</div>
      <textarea disabled class="input" rows="4" placeholder="Người trả lời sẽ nhập văn bản tại đây" style="height:auto;padding:10px 12px;font-size:12.5px;background:#eef2ff;color:#94a3b8;border-color:#c7d2fe;resize:none"></textarea>`;
  }
  return '';
}

// ── Render layout ─────────────────────────────────────────────────
document.getElementById('page-content').innerHTML = `
<style>
  #lib-list [id^="qrow-"]:hover .lib-row-actions { opacity: 1 !important; }
</style>
<div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
  <div>
    <h2 class="page-title">📚 Thư viện câu hỏi</h2>
    <p class="page-sub">Quản lý câu hỏi theo từng bộ môn — dùng khi tạo biểu mẫu mới</p>
  </div>
  <div style="display:flex;gap:8px">
    <button onclick="startAddNew()" id="btn-add-new" class="btn btn-primary" style="gap:6px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Thêm câu hỏi
    </button>
  </div>
</div>

<!-- Tabs -->
<div style="display:flex;gap:0;border-bottom:2px solid #e2e8f0;margin-bottom:20px">
  <button id="tab-nn" onclick="switchTab('ngoaingu')"
    style="padding:10px 24px;border:none;background:none;font-size:13.5px;font-weight:700;cursor:pointer;border-bottom:3px solid #2563eb;color:#2563eb;margin-bottom:-2px;transition:all .15s">
    🌐 Ngoại ngữ (<span id="count-ngoaingu">0</span>)
  </button>
  <button id="tab-th" onclick="switchTab('tinhoc')"
    style="padding:10px 24px;border:none;background:none;font-size:13.5px;font-weight:700;cursor:pointer;border-bottom:3px solid transparent;color:#94a3b8;margin-bottom:-2px;transition:all .15s">
    💻 Tin học (<span id="count-tinhoc">0</span>)
  </button>
</div>

<!-- Search -->
<div style="margin-bottom:16px">
  <div class="input-wrap" style="margin:0">
    <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
    <input type="text" id="lib-search" class="input" placeholder="Tìm câu hỏi..." oninput="searchVal=this.value;renderList()">
  </div>
  <div id="lib-result-count" style="font-size:12.5px;color:#94a3b8;margin-top:6px"></div>
</div>

<!-- List -->
<div id="lib-list" style="display:flex;flex-direction:column;gap:0;border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.05)"></div>

<!-- Confirm delete -->
<div id="del-modal" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:9999;align-items:center;justify-content:center">
  <div style="background:#fff;border-radius:16px;padding:24px;width:380px;max-width:94vw;box-shadow:0 20px 50px rgba(0,0,0,.2)">
    <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:8px">Xóa câu hỏi?</div>
    <p id="del-desc" style="font-size:13.5px;color:#64748b;margin-bottom:20px;line-height:1.6"></p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button onclick="document.getElementById('del-modal').style.display='none'" class="btn btn-outline">Hủy</button>
      <button id="del-confirm-btn" class="btn" style="background:#ef4444;color:#fff;border-color:#ef4444">Xóa</button>
    </div>
  </div>
</div>
`;

document.getElementById('del-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('del-modal')) document.getElementById('del-modal').style.display = 'none';
});

// ── API helpers ───────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...AUTH(), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Lỗi ${res.status}`);
  return data;
}

// ── Load từ API ───────────────────────────────────────────────────

async function loadLibFromAPI() {
  _loading = true;
  renderList();
  try {
    const list = await apiFetch('/library');
    libData.ngoaingu = list.filter(q => q.bo_mon === 'Ngoại ngữ');
    libData.tinhoc   = list.filter(q => q.bo_mon === 'Tin học');
    syncFlatCache();
  } catch (e) {
    showToast('Không tải được thư viện: ' + e.message, 'error');
    libData = { ngoaingu: [], tinhoc: [] };
  }
  _loading = false;
  updateCounts();
  renderList();
}

function syncFlatCache() {
  try {
    const flat = [
      ...libData.ngoaingu.map(q => ({ ...q, category: 'Ngoại ngữ' })),
      ...libData.tinhoc.map(q =>   ({ ...q, category: 'Tin học'   })),
    ];
    localStorage.setItem('flic_lib_flat', JSON.stringify(flat));
  } catch {}
}

// ── Tab ───────────────────────────────────────────────────────────

function switchTab(tab) {
  activeTab  = tab;
  expandedId = null;
  addingNew  = false;
  searchVal  = '';
  const s = document.getElementById('lib-search');
  if (s) s.value = '';
  document.getElementById('tab-nn').style.borderBottom = tab==='ngoaingu' ? '3px solid #2563eb' : '3px solid transparent';
  document.getElementById('tab-nn').style.color        = tab==='ngoaingu' ? '#2563eb' : '#94a3b8';
  document.getElementById('tab-th').style.borderBottom = tab==='tinhoc'   ? '3px solid #2563eb' : '3px solid transparent';
  document.getElementById('tab-th').style.color        = tab==='tinhoc'   ? '#2563eb' : '#94a3b8';
  renderList();
}

function updateCounts() {
  document.getElementById('count-ngoaingu').textContent = libData.ngoaingu.length;
  document.getElementById('count-tinhoc').textContent   = libData.tinhoc.length;
}

// ── Render list ───────────────────────────────────────────────────

function renderList() {
  const list = document.getElementById('lib-list');
  if (!list) return;

  if (_loading) {
    list.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94a3b8">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" style="animation:spin 1s linear infinite;margin:0 auto 12px;display:block"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-dasharray="28" stroke-dashoffset="10"/></svg>
      <div style="font-size:13.5px;font-weight:600">Đang tải dữ liệu từ server...</div>
    </div>`;
    return;
  }

  const q     = (searchVal || '').toLowerCase().trim();
  const items = (libData[activeTab] || []).filter(item => !q || item.text.toLowerCase().includes(q));

  document.getElementById('lib-result-count').textContent =
    q ? `${items.length} / ${libData[activeTab].length} câu hỏi` : `${items.length} câu hỏi`;
  updateCounts();

  if (!items.length && !addingNew) {
    list.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94a3b8">
      <div style="font-size:36px;margin-bottom:12px">${q ? '🔍' : '📭'}</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px">${q ? 'Không tìm thấy câu hỏi phù hợp' : 'Chưa có câu hỏi nào'}</div>
      <div style="font-size:12.5px">${q ? 'Thử từ khóa khác' : 'Bấm "+ Thêm câu hỏi" để bắt đầu'}</div>
    </div>`;
    return;
  }

  let html = '';
  if (addingNew) html += renderAddForm();

  items.forEach((item, idx) => {
    const sid     = String(item.id);
    const normalizedType = normalizeQuestionType(item.type);
    const tl      = TYPE_LABELS[normalizedType] || normalizedType;
    const tc      = TYPE_COLORS[normalizedType] || '#f1f5f9;color:#374151';
    const isOpen  = expandedId === sid;
    const hasOpts = NEEDS_OPTS.includes(item.type);
    const hasGrid = NEEDS_GRID.includes(item.type);
    const isLast  = idx === items.length - 1 && !addingNew;

    html += `
    <div id="qrow-${sid}" style="border-bottom:${isLast?'none':'1px solid #f1f5f9'};transition:background .12s${isOpen?';background:#f8faff':''}">
      <div style="display:flex;align-items:center;gap:10px;padding:13px 16px;cursor:pointer" onclick="toggleExpand('${sid}')">
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:600;color:#0f172a;line-height:1.4;margin-bottom:4px">${esc(item.text)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:10px;background:${tc}">${tl}</span>
            ${hasOpts && item.opts.length ? `<span style="font-size:11.5px;color:#94a3b8">${item.opts.length} lựa chọn</span>` : ''}
            ${hasGrid ? `<span style="font-size:11.5px;color:#94a3b8">${(item.rows||[]).length} hàng · ${(item.cols||[]).length} cột</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">
          <div class="lib-row-actions" style="display:flex;gap:2px;opacity:0;transition:opacity .15s">
            <button onclick="event.stopPropagation();libAddImage('${sid}')" title="Thêm hình ảnh"
              style="width:28px;height:28px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s"
              onmouseenter="this.style.color='#0ea5e9';this.style.background='#e0f2fe'"
              onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </button>
            <button onclick="event.stopPropagation();libAddVideo('${sid}')" title="Thêm video"
              style="width:28px;height:28px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s"
              onmouseenter="this.style.color='#8b5cf6';this.style.background='#f5f3ff'"
              onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="2" width="20" height="20" rx="5"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
            </button>
            <button onclick="event.stopPropagation();libDuplicate('${sid}')" title="Sao chép câu hỏi"
              style="width:28px;height:28px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s"
              onmouseenter="this.style.color='#7c3aed';this.style.background='#f5f3ff'"
              onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            </button>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" width="16" height="16" style="transition:transform .2s;transform:rotate(${isOpen?'180':'0'}deg)"><polyline points="6 9 12 15 18 9"/></svg>
          <button onclick="event.stopPropagation();confirmDelete('${sid}')"
            style="width:28px;height:28px;border-radius:7px;border:1.5px solid #fecaca;background:#fff;cursor:pointer;color:#ef4444;display:flex;align-items:center;justify-content:center;transition:all .15s"
            onmouseenter="this.style.background='#fee2e2'" onmouseleave="this.style.background='#fff'" title="Xóa">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </div>

      ${isOpen ? `
      <div style="padding:4px 16px 16px;background:#f8faff;border-top:1px solid #e0e7ff" onclick="event.stopPropagation()">
        <div style="margin-bottom:12px">
          <label style="font-size:11.5px;font-weight:700;color:#374151;display:block;margin-bottom:5px">Nội dung câu hỏi</label>
          <input id="edit-text-${sid}" type="text" class="input" value="${esc(item.text)}" style="font-size:13px">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div>
            <label style="font-size:11.5px;font-weight:700;color:#374151;display:block;margin-bottom:5px">Loại câu hỏi</label>
            <select id="edit-type-${sid}" class="input" style="height:36px;font-size:13px" onchange="onEditTypeChange('${sid}')">
              ${Object.entries(TYPE_OPTION_LABELS).filter(([v]) => v !== 'text').map(([v,l]) => `<option value="${v}"${normalizedType===v?' selected':''}>${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11.5px;font-weight:700;color:#374151;display:block;margin-bottom:5px">Bộ môn</label>
            <select id="edit-bomon-${sid}" class="input" style="height:36px;font-size:13px">
              <option value="Ngoại ngữ" ${item.bo_mon==='Ngoại ngữ'?'selected':''}>🌐 Ngoại ngữ</option>
              <option value="Tin học"   ${item.bo_mon==='Tin học'?'selected':''}>💻 Tin học</option>
            </select>
          </div>
        </div>
        <div id="edit-opts-area-${sid}">${renderEditOpts(item)}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
          <button onclick="cancelExpand()" class="btn btn-outline btn-sm">Hủy</button>
          <button onclick="saveEdit('${sid}')" class="btn btn-primary btn-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
            Lưu
          </button>
        </div>
      </div>` : ''}
    </div>`;
  });

  list.innerHTML = html;
}

function renderEditOpts(item) {
  const normalizedType = normalizeQuestionType(item.type);
  if (normalizedType === 'rating') {
    const count = (item.opts && item.opts.length) ? item.opts.length : 5;
    return `<div style="padding:12px 14px;border:1px solid #fde68a;border-radius:12px;background:linear-gradient(180deg,#fffdf7 0%,#fff7ed 100%)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        <div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.4px">★ Xếp hạng sao</div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px;color:#92400e">Số sao:</span>
          <select onchange="onEditStarCountChange('${item.id}',parseInt(this.value))"
            style="padding:3px 8px;border:1px solid #fcd34d;border-radius:6px;font-size:12px;background:#fff;color:#92400e;cursor:pointer">
            ${[3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${count===n?'selected':''}>${n}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="star-preview-${item.id}" style="display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap">
        ${Array.from({length:count},(_,i)=>`
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style="font-size:12px;font-weight:600;color:#92400e">${i+1}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" width="28" height="28"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>
          </div>
        `).join('')}
      </div>
    </div>`;
  }
  if (normalizedType === 'scale') {
    const opts = item.opts && item.opts.length >= 2 ? item.opts : ['',''];
    return `<div style="padding:12px 14px;border:1px solid #c7d2fe;border-radius:12px;background:linear-gradient(180deg,#f8f9ff 0%,#eef2ff 100%)">
      <div style="font-size:11px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">⟷ Phạm vi tuyến tính (1–5)</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        ${[1,2,3,4,5].map(n=>`<div style="width:36px;height:36px;border-radius:50%;border:2px solid #a5b4fc;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#4338ca;background:#fff">${n}</div>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1">
          <div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:4px">Nhãn đầu (tuỳ chọn)</div>
          <input type="text" value="${esc(opts[0])}" placeholder="vd: Không hài lòng" data-opt="0"
            style="width:100%;padding:6px 10px;border:1px solid #c7d2fe;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s"
            onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#c7d2fe'">
        </div>
        <div style="font-size:18px;color:#a5b4fc">→</div>
        <div style="flex:1">
          <div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:4px">Nhãn cuối (tuỳ chọn)</div>
          <input type="text" value="${esc(opts[1])}" placeholder="vd: Rất hài lòng" data-opt="1"
            style="width:100%;padding:6px 10px;border:1px solid #c7d2fe;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s"
            onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#c7d2fe'">
        </div>
      </div>
    </div>`;
  }
  if (NEEDS_OPTS.includes(normalizedType)) {
    const opts = item.opts && item.opts.length ? item.opts : [''];
    return `
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Các lựa chọn</div>
      <div id="opts-list-${item.id}" style="display:flex;flex-direction:column;gap:5px;margin-bottom:8px">
        ${opts.map((o,i) => _optRow(item.id, o, i, opts.length, normalizedType)).join('')}
      </div>
      <button onclick="addEditOpt('${item.id}')" style="padding:5px 14px;background:transparent;border:1.5px dashed #7dd3fc;border-radius:7px;cursor:pointer;color:#0284c7;font-size:12px;font-weight:600;transition:all .15s" onmouseenter="this.style.background='#e0f2fe';this.style.borderColor='#0ea5e9'" onmouseleave="this.style.background='transparent';this.style.borderColor='#7dd3fc'">+ Thêm lựa chọn</button>`;
  }
  if (NEEDS_GRID.includes(normalizedType)) {
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">📋 Hàng (tiêu đề)</div>
          <div id="rows-list-${item.id}" style="display:flex;flex-direction:column;gap:5px;margin-bottom:6px">
            ${(item.rows||['']).map((r,i) => _gridRow(item.id,'row',r,i,normalizedType)).join('')}
          </div>
          <button onclick="addGridRow('${item.id}','row')" style="padding:4px 10px;background:transparent;border:1.5px dashed #c4b5fd;border-radius:7px;cursor:pointer;color:#7c3aed;font-size:11.5px;font-weight:600;transition:all .15s" onmouseenter="this.style.background='#f5f3ff'" onmouseleave="this.style.background='transparent'">+ Thêm hàng</button>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">🔷 Cột (lựa chọn)</div>
          <div id="cols-list-${item.id}" style="display:flex;flex-direction:column;gap:5px;margin-bottom:6px">
            ${(item.cols||['']).map((c,i) => _gridRow(item.id,'col',c,i,normalizedType)).join('')}
          </div>
          <button onclick="addGridRow('${item.id}','col')" style="padding:4px 10px;background:transparent;border:1.5px dashed #7dd3fc;border-radius:7px;cursor:pointer;color:#0284c7;font-size:11.5px;font-weight:600;transition:all .15s" onmouseenter="this.style.background='#e0f2fe'" onmouseleave="this.style.background='transparent'">+ Thêm cột</button>
        </div>
      </div>`;
  }
  return renderTextPreview(normalizedType);
}

function _ratingOptRow(qid, val, idx, total) {
  const defaults = DEFAULT_RATING_OPTS;
  const ph = defaults[idx] || ('Mức ' + (idx+1));
  const isDefault = defaults.includes(val);
  const dv = isDefault ? '' : esc(val);
  return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
    <span style="width:20px;height:20px;border-radius:50%;background:#fff7ed;color:#c2410c;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1.5px solid #fed7aa">${idx+1}</span>
    <input type="text" value="${dv}" data-opt="${idx}" placeholder="${ph}"
      style="flex:1;padding:6px 10px;border:1px solid #e2e8f0;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s"
      onfocus="this.style.borderColor='#f97316'" onblur="this.style.borderColor='#e2e8f0'">
    ${total>1?`<button onclick="removeEditOpt('${qid}',${idx})" style="background:none;border:none;cursor:pointer;color:#cbd5e1;font-size:18px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:color .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>`:''}
  </div>`;
}
function _optRow(qid, val, idx, total, type) {
  const optIcon = type==='checkbox'
    ? `<span style="width:15px;height:15px;border-radius:3px;border:2px solid #94a3b8;flex-shrink:0;display:inline-block;background:#fff"></span>`
    : type==='dropdown'
    ? `<span style="font-size:11px;color:#94a3b8;font-weight:700;min-width:18px;text-align:center">${idx+1}</span>`
    : `<span style="width:15px;height:15px;border-radius:50%;border:2px solid #94a3b8;flex-shrink:0;display:inline-block;background:#fff"></span>`;
  return `<div style="display:flex;align-items:center;gap:6px">
    ${optIcon}
    <input type="text" value="${esc(val)}" data-opt="${idx}" class="input" style="flex:1;height:32px;font-size:12.5px" placeholder="Lựa chọn ${idx+1}">
    ${total>1?`<button onclick="removeEditOpt('${qid}',${idx})" style="background:none;border:none;cursor:pointer;color:#cbd5e1;font-size:18px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:color .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>`:''}
  </div>`;
}
function _gridRow(qid, kind, val, idx, type) {
  const icon = kind==='row'
    ? `<span style="width:14px;height:14px;border-radius:${type==='grid_radio'?'50%':'3px'};border:1.5px solid #c4b5fd;flex-shrink:0;display:inline-block;background:#fff"></span>`
    : `<span style="width:14px;height:14px;border-radius:${type==='grid_radio'?'50%':'3px'};border:1.5px solid #7dd3fc;flex-shrink:0;display:inline-block;background:#fff"></span>`;
  return `<div style="display:flex;align-items:center;gap:6px">
    ${icon}
    <input type="text" value="${esc(val)}" data-idx="${idx}" class="input" style="flex:1;height:30px;font-size:12px" placeholder="${kind==='row'?'Hàng':'Cột'} ${idx+1}">
    <button onclick="removeGridRow('${qid}','${kind}',${idx})" style="background:none;border:none;cursor:pointer;color:#cbd5e1;font-size:18px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:color .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>
  </div>`;
}

function toggleExpand(id) {
  const sid = String(id);
  expandedId = (expandedId === sid) ? null : sid;
  if (expandedId) addingNew = false;
  renderList();
  if (expandedId) setTimeout(() => document.getElementById('qrow-'+sid)?.scrollIntoView({behavior:'smooth',block:'nearest'}), 50);
}
function cancelExpand() { expandedId = null; addingNew = false; renderList(); }

function addEditOpt(qid) {
  const item = _findItem(qid);
  if (!item) return;
  item.opts.push('');
  const area = document.getElementById('opts-list-' + qid);
  if (area) area.innerHTML = item.opts.map((o,i) => _optRow(qid, o, i, item.opts.length)).join('');
}
function removeEditOpt(qid, idx) {
  const item = _findItem(qid);
  if (!item || item.opts.length <= 1) return;
  item.opts.splice(idx, 1);
  const area = document.getElementById('opts-list-' + qid);
  if (area) area.innerHTML = item.opts.map((o,i) => _optRow(qid, o, i, item.opts.length)).join('');
}
function addGridRow(qid, kind) {
  const item = _findItem(qid);
  if (!item) return;
  if (kind === 'row') item.rows = [...(item.rows||[]), '']; else item.cols = [...(item.cols||[]), ''];
  const area = document.getElementById(`${kind}s-list-${qid}`);
  const arr = kind === 'row' ? item.rows : item.cols;
  if (area) area.innerHTML = arr.map((v,i) => _gridRow(qid, kind, v, i)).join('');
}
function removeGridRow(qid, kind, idx) {
  const item = _findItem(qid);
  if (!item) return;
  const arr = kind === 'row' ? item.rows : item.cols;
  if (!arr || arr.length <= 1) return;
  arr.splice(idx, 1);
  const area = document.getElementById(`${kind}s-list-${qid}`);
  if (area) area.innerHTML = arr.map((v,i) => _gridRow(qid, kind, v, i)).join('');
}
function onEditTypeChange(qid) {
  const item = _findItem(qid);
  if (!item) return;
  const newType = normalizeQuestionType(document.getElementById('edit-type-' + qid).value);
  item.type = newType;
  if (newType === 'rating') item.opts = Array.from({length:5},(_,i)=>`${i+1}`);
  else if (newType === 'scale') item.opts = item.opts && item.opts.length >= 2 ? item.opts : ['',''];
  else if (NEEDS_OPTS.includes(newType) && (!item.opts || !item.opts.length)) item.opts = [''];
  else if (!NEEDS_OPTS.includes(newType) && !NEEDS_GRID.includes(newType)) item.opts = [];
  if (NEEDS_GRID.includes(newType)) { if (!item.rows?.length) item.rows = ['']; if (!item.cols?.length) item.cols = ['']; }
  const area = document.getElementById('edit-opts-area-' + qid);
  if (area) area.innerHTML = renderEditOpts(item);
}
function onEditStarCountChange(qid, n) {
  const item = _findItem(qid);
  if (!item) return;
  item.opts = Array.from({length:n},(_,i)=>`${i+1}`);
  const preview = document.getElementById('star-preview-' + qid);
  if (preview) preview.innerHTML = Array.from({length:n},(_,i)=>`
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <span style="font-size:12px;font-weight:600;color:#92400e">${i+1}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" width="28" height="28"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>
    </div>
  `).join('');
}

// ── Save edit → API PUT ───────────────────────────────────────────

async function saveEdit(qid) {
  const item = _findItem(qid);
  if (!item) return;
  const text   = (document.getElementById('edit-text-'  + qid)?.value || '').trim();
  const bo_mon = document.getElementById('edit-bomon-'  + qid)?.value || item.bo_mon;
  const type   = document.getElementById('edit-type-'   + qid)?.value || item.type;
  if (!text) { showToast('Vui lòng nhập nội dung câu hỏi', 'error'); return; }

  let opts = item.opts || [], rows = item.rows || [], cols = item.cols || [];
  if (NEEDS_OPTS.includes(type))
    opts = [...document.querySelectorAll(`#opts-list-${qid} input`)].map(i=>i.value.trim()).filter(Boolean);
  if (NEEDS_GRID.includes(type)) {
    rows = [...document.querySelectorAll(`#rows-list-${qid} input`)].map(i=>i.value.trim()).filter(Boolean);
    cols = [...document.querySelectorAll(`#cols-list-${qid} input`)].map(i=>i.value.trim()).filter(Boolean);
  }

  const btn = document.querySelector(`#qrow-${qid} button.btn-primary`);
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

  try {
    await apiFetch(`/library/${qid}`, { method: 'PUT', body: JSON.stringify({ bo_mon, text, type, opts, rows, cols }) });
    expandedId = null;
    await loadLibFromAPI();
    showToast('Đã lưu câu hỏi ✅', 'success');
  } catch (e) {
    showToast('Lỗi lưu: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Lưu'; }
  }
}

// ── Add new form ──────────────────────────────────────────────────

function renderAddForm() {
  return `
  <div id="add-new-form" style="border-bottom:1px solid #e0e7ff;background:#faf5ff;padding:16px">
    <div style="font-size:12px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">✦ Tạo câu hỏi mới</div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border-radius:8px;border:1.5px solid ${activeTab==='ngoaingu'?'#2563eb':'#e2e8f0'};background:${activeTab==='ngoaingu'?'#eff6ff':'#fff'};font-size:12.5px;font-weight:600" id="new-lbl-nn">
        <input type="radio" name="new-tab" value="ngoaingu" ${activeTab==='ngoaingu'?'checked':''} onchange="const v=this.value;['nn','th'].forEach(x=>{const el=document.getElementById('new-lbl-'+x);el.style.borderColor=((x==='nn'&&v==='ngoaingu')||(x==='th'&&v==='tinhoc'))?'#2563eb':'#e2e8f0';el.style.background=((x==='nn'&&v==='ngoaingu')||(x==='th'&&v==='tinhoc'))?'#eff6ff':'#fff';})"> 🌐 Ngoại ngữ
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border-radius:8px;border:1.5px solid ${activeTab==='tinhoc'?'#2563eb':'#e2e8f0'};background:${activeTab==='tinhoc'?'#eff6ff':'#fff'};font-size:12.5px;font-weight:600" id="new-lbl-th">
        <input type="radio" name="new-tab" value="tinhoc" ${activeTab==='tinhoc'?'checked':''} onchange="const v=this.value;['nn','th'].forEach(x=>{const el=document.getElementById('new-lbl-'+x);el.style.borderColor=((x==='nn'&&v==='ngoaingu')||(x==='th'&&v==='tinhoc'))?'#2563eb':'#e2e8f0';el.style.background=((x==='nn'&&v==='ngoaingu')||(x==='th'&&v==='tinhoc'))?'#eff6ff':'#fff';})"> 💻 Tin học
      </label>
    </div>
    <input id="new-q-text" type="text" class="input" placeholder="Nhập nội dung câu hỏi..." style="margin-bottom:10px;font-size:13px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <label style="font-size:12px;color:#6b21a8;font-weight:600;white-space:nowrap">Loại:</label>
      <select id="new-q-type" class="input" style="height:34px;font-size:12.5px" onchange="renderNewOpts()">
        ${Object.entries(TYPE_OPTION_LABELS).filter(([v]) => v !== 'text').map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
      </select>
    </div>
    <div id="new-opts-area" style="margin-bottom:10px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button onclick="cancelAdd()" class="btn btn-outline btn-sm">Hủy</button>
      <button id="btn-confirm-add" onclick="confirmAdd()" class="btn btn-primary btn-sm" style="background:#7c3aed;border-color:#6d28d9">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Thêm vào thư viện
      </button>
    </div>
  </div>`;
}

let _newOpts = [''], _newRows = [''], _newCols = [''];

function startAddNew() {
  addingNew  = true; expandedId = null;
  _newOpts = ['']; _newRows = ['']; _newCols = [''];
  renderList();
  setTimeout(() => { renderNewOpts(); document.getElementById('new-q-text')?.focus(); document.getElementById('add-new-form')?.scrollIntoView({behavior:'smooth',block:'nearest'}); }, 30);
}
function cancelAdd() { addingNew = false; renderList(); }

function renderNewOpts() {
  const type = normalizeQuestionType(document.getElementById('new-q-type')?.value || 'choice');
  const area = document.getElementById('new-opts-area');
  if (!area) return;
  if (type === 'rating') {
    if (!_newOpts.length) _newOpts = DEFAULT_RATING_OPTS.slice();
    const count = _newOpts.length;
    area.innerHTML = `<div style="padding:12px 14px;border:1px solid #fde68a;border-radius:12px;background:linear-gradient(180deg,#fffdf7 0%,#fff7ed 100%)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        <div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.4px">★ Xếp hạng sao</div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px;color:#92400e">Số sao:</span>
          <select onchange="onNewStarCountChange(parseInt(this.value))"
            style="padding:3px 8px;border:1px solid #fcd34d;border-radius:6px;font-size:12px;background:#fff;color:#92400e;cursor:pointer">
            ${[3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${count===n?'selected':''}>${n}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="new-star-preview" style="display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap">
        ${Array.from({length:count},(_,i)=>`
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style="font-size:12px;font-weight:600;color:#92400e">${i+1}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" width="28" height="28"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>
          </div>
        `).join('')}
      </div>
    </div>`;
  } else if (NEEDS_OPTS.includes(type)) {
    if (!_newOpts.length) _newOpts = [''];
    area.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Các lựa chọn</div>
      <div id="new-opts-list" style="display:flex;flex-direction:column;gap:5px;margin-bottom:6px">${_newOpts.map((o,i)=>_newOptRow(o,i,type)).join('')}</div>
      <button onclick="addNewOpt()" style="padding:5px 14px;background:transparent;border:1.5px dashed #7dd3fc;border-radius:7px;cursor:pointer;color:#0284c7;font-size:12px;font-weight:600;transition:all .15s" onmouseenter="this.style.background='#e0f2fe';this.style.borderColor='#0ea5e9'" onmouseleave="this.style.background='transparent';this.style.borderColor='#7dd3fc'">+ Thêm lựa chọn</button>`;
  } else if (type === 'scale') {
    area.innerHTML = `<div style="padding:12px 14px;border:1px solid #c7d2fe;border-radius:12px;background:linear-gradient(180deg,#f8f9ff 0%,#eef2ff 100%)">
      <div style="font-size:11px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">⟷ Phạm vi tuyến tính (1–5)</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        ${[1,2,3,4,5].map(n=>`<div style="width:36px;height:36px;border-radius:50%;border:2px solid #a5b4fc;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#4338ca;background:#fff">${n}</div>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1">
          <div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:4px">Nhãn đầu (tuỳ chọn)</div>
          <input type="text" placeholder="vd: Không hài lòng"
            style="width:100%;padding:6px 10px;border:1px solid #c7d2fe;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s"
            onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#c7d2fe'"
            oninput="_newOpts[0]=this.value">
        </div>
        <div style="font-size:18px;color:#a5b4fc">→</div>
        <div style="flex:1">
          <div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:4px">Nhãn cuối (tuỳ chọn)</div>
          <input type="text" placeholder="vd: Rất hài lòng"
            style="width:100%;padding:6px 10px;border:1px solid #c7d2fe;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s"
            onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#c7d2fe'"
            oninput="_newOpts[1]=this.value">
        </div>
      </div>
    </div>`;
    if (!_newOpts.length) _newOpts = ['',''];
  } else if (NEEDS_GRID.includes(type)) {
    area.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">📋 Hàng (tiêu đề)</div>
          <div id="new-rows-list" style="display:flex;flex-direction:column;gap:5px;margin-bottom:6px">${_newRows.map((r,i)=>_newGridRow('row',r,i,type)).join('')}</div>
          <button onclick="addNewGridRow('row')" style="padding:4px 10px;background:transparent;border:1.5px dashed #c4b5fd;border-radius:7px;cursor:pointer;color:#7c3aed;font-size:11.5px;font-weight:600;transition:all .15s" onmouseenter="this.style.background='#f5f3ff'" onmouseleave="this.style.background='transparent'">+ Thêm hàng</button>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">🔷 Cột (lựa chọn)</div>
          <div id="new-cols-list" style="display:flex;flex-direction:column;gap:5px;margin-bottom:6px">${_newCols.map((c,i)=>_newGridRow('col',c,i,type)).join('')}</div>
          <button onclick="addNewGridRow('col')" style="padding:4px 10px;background:transparent;border:1.5px dashed #7dd3fc;border-radius:7px;cursor:pointer;color:#0284c7;font-size:11.5px;font-weight:600;transition:all .15s" onmouseenter="this.style.background='#e0f2fe'" onmouseleave="this.style.background='transparent'">+ Thêm cột</button>
        </div>
      </div>`;
  } else { area.innerHTML = renderTextPreview(type); }
}
function onNewStarCountChange(n) {
  _newOpts = Array.from({length:n},(_,i)=>`${i+1}`);
  const preview = document.getElementById('new-star-preview');
  if (preview) preview.innerHTML = Array.from({length:n},(_,i)=>`
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <span style="font-size:12px;font-weight:600;color:#92400e">${i+1}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" width="28" height="28"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>
    </div>
  `).join('');
}
function _newOptRow(val, idx, type) {
  const optIcon = type==='checkbox'
    ? `<span style="width:15px;height:15px;border-radius:3px;border:2px solid #94a3b8;flex-shrink:0;display:inline-block;background:#fff"></span>`
    : type==='dropdown'
    ? `<span style="font-size:11px;color:#94a3b8;font-weight:700;min-width:18px;text-align:center">${idx+1}</span>`
    : `<span style="width:15px;height:15px;border-radius:50%;border:2px solid #94a3b8;flex-shrink:0;display:inline-block;background:#fff"></span>`;
  return `<div style="display:flex;align-items:center;gap:6px">
    ${optIcon}
    <input type="text" value="${esc(val)}" class="input" style="flex:1;height:32px;font-size:12.5px;background:#fff" placeholder="Lựa chọn ${idx+1}" oninput="_newOpts[${idx}]=this.value">
    ${_newOpts.length>1?`<button onclick="removeNewOpt(${idx})" style="background:none;border:none;cursor:pointer;color:#cbd5e1;font-size:18px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:color .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>`:''}
  </div>`;
}
function _newGridRow(kind, val, idx, type) {
  const icon = kind==='row'
    ? `<span style="width:14px;height:14px;border-radius:${type==='grid_radio'?'50%':'3px'};border:1.5px solid #c4b5fd;flex-shrink:0;display:inline-block;background:#fff"></span>`
    : `<span style="width:14px;height:14px;border-radius:${type==='grid_radio'?'50%':'3px'};border:1.5px solid #7dd3fc;flex-shrink:0;display:inline-block;background:#fff"></span>`;
  return `<div style="display:flex;align-items:center;gap:6px">
    ${icon}
    <input type="text" value="${esc(val)}" class="input" style="flex:1;height:30px;font-size:12px;background:#fff" placeholder="${kind==='row'?'Hàng':'Cột'} ${idx+1}" oninput="${kind==='row'?'_newRows':'_newCols'}[${idx}]=this.value">
    <button onclick="removeNewGridRow('${kind}',${idx})" style="background:none;border:none;cursor:pointer;color:#cbd5e1;font-size:18px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:color .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>
  </div>`;
}
function addNewOpt() { _newOpts.push(''); renderNewOpts(); }
function removeNewOpt(idx) { if(_newOpts.length>1) _newOpts.splice(idx,1); renderNewOpts(); }
function addNewGridRow(kind) { if(kind==='row') _newRows.push(''); else _newCols.push(''); renderNewOpts(); }
function removeNewGridRow(kind,idx) { const a=kind==='row'?_newRows:_newCols; if(a.length>1) a.splice(idx,1); renderNewOpts(); }

// ── confirmAdd → API POST ─────────────────────────────────────────

async function confirmAdd() {
  const text = (document.getElementById('new-q-text')?.value || '').trim();
  if (!text) { showToast('Vui lòng nhập nội dung câu hỏi', 'error'); document.getElementById('new-q-text')?.focus(); return; }
  const tab    = document.querySelector('input[name="new-tab"]:checked')?.value || activeTab;
  const type   = normalizeQuestionType(document.getElementById('new-q-type')?.value || 'choice');
  const bo_mon = tab === 'ngoaingu' ? 'Ngoại ngữ' : 'Tin học';

  document.querySelectorAll('#new-opts-list input').forEach((inp,i) => { _newOpts[i] = inp.value; });
  document.querySelectorAll('#new-rows-list input').forEach((inp,i) => { _newRows[i] = inp.value; });
  document.querySelectorAll('#new-cols-list input').forEach((inp,i) => { _newCols[i] = inp.value; });

  let opts = [], rows = [], cols = [];
  if (NEEDS_OPTS.includes(type)) {
    opts = _newOpts.filter(Boolean);
    if (!opts.length) { showToast('Vui lòng thêm ít nhất 1 lựa chọn', 'error'); return; }
  }
  if (NEEDS_GRID.includes(type)) {
    rows = _newRows.filter(Boolean); cols = _newCols.filter(Boolean);
    if (!rows.length || !cols.length) { showToast('Vui lòng thêm hàng và cột', 'error'); return; }
  }

  const btn = document.getElementById('btn-confirm-add');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

  try {
    await apiFetch('/library', { method: 'POST', body: JSON.stringify({ bo_mon, text, type, opts, rows, cols }) });
    addingNew = false; _newOpts = ['']; _newRows = ['']; _newCols = [''];
    activeTab = tab;
    await loadLibFromAPI();
    switchTab(tab);
    showToast('Đã thêm câu hỏi vào thư viện ✅', 'success');
  } catch (e) {
    showToast('Lỗi thêm câu hỏi: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Thêm vào thư viện'; }
  }
}

// ── libAddImage, libAddVideo, libDuplicate ────────────────────────

async function libAddImage(id) {
  const item = _findItem(id);
  if (!item) return;
  const url = prompt('Nhập URL hình ảnh:');
  if (!url || !url.trim()) return;
  try {
    await apiFetch(`/library/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ bo_mon: item.bo_mon, text: item.text, type: item.type, opts: item.opts || [], rows: item.rows || [], cols: item.cols || [], image: url.trim() })
    });
    await loadLibFromAPI();
    showToast('Đã thêm hình ảnh ✅', 'success');
  } catch (e) {
    // Lưu local nếu API chưa hỗ trợ field image
    item.image = url.trim();
    renderList();
    showToast('Đã thêm hình ảnh (local)', 'success');
  }
}

async function libAddVideo(id) {
  const item = _findItem(id);
  if (!item) return;
  const url = prompt('Nhập URL video (YouTube, v.v.):');
  if (!url || !url.trim()) return;
  try {
    await apiFetch(`/library/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ bo_mon: item.bo_mon, text: item.text, type: item.type, opts: item.opts || [], rows: item.rows || [], cols: item.cols || [], video: url.trim() })
    });
    await loadLibFromAPI();
    showToast('Đã thêm video ✅', 'success');
  } catch (e) {
    item.video = url.trim();
    renderList();
    showToast('Đã thêm video (local)', 'success');
  }
}

async function libDuplicate(id) {
  const item = _findItem(id);
  if (!item) return;
  try {
    await apiFetch('/library', {
      method: 'POST',
      body: JSON.stringify({
        bo_mon: item.bo_mon,
        text: item.text + ' (sao chép)',
        type: item.type,
        opts: item.opts || [],
        rows: item.rows || [],
        cols: item.cols || [],
      })
    });
    await loadLibFromAPI();
    showToast('Đã sao chép câu hỏi ✅', 'success');
  } catch (e) {
    showToast('Lỗi sao chép: ' + e.message, 'error');
  }
}

// ── confirmDelete → API DELETE ────────────────────────────────────

function confirmDelete(id) {
  const item = _findItem(id);
  if (!item) return;
  document.getElementById('del-desc').textContent =
    `Xóa câu hỏi "${item.text.slice(0,60)}${item.text.length>60?'…':''}"? Hành động này không thể hoàn tác.`;
  document.getElementById('del-confirm-btn').onclick = async () => {
    document.getElementById('del-modal').style.display = 'none';
    try {
      await apiFetch(`/library/${id}`, { method: 'DELETE' });
      if (expandedId === String(id)) expandedId = null;
      await loadLibFromAPI();
      showToast('Đã xóa câu hỏi', 'success');
    } catch (e) { showToast('Lỗi xóa: ' + e.message, 'error'); }
  };
  document.getElementById('del-modal').style.display = 'flex';
}

function _findItem(id) {
  const sid = String(id);
  return [...libData.ngoaingu, ...libData.tinhoc].find(q => String(q.id) === sid);
}

// ── Khởi động ─────────────────────────────────────────────────────
loadLibFromAPI();