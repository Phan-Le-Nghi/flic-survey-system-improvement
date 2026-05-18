// ─── FORM MANAGEMENT - State (mirrors React source) ───

// ── Thùng rác helpers ──────────────────────────────────
// loadTrash / saveTrash được định nghĩa trong trash.js (dùng chung key 'flic_trash_forms')
const LS_TRASH = 'flic_trash_forms'; // alias cho TRASH_LS_KEY
const NEW_FORM_LOI_KET_DRAFT_KEY = 'flic_new_form_loi_ket_draft';
function moveToTrash(form) {
  const trash = loadTrash();
  const deletedAt = Date.now();
  const purged = trash.filter(f => f.expiresAt > Date.now());
  purged.unshift({ ...form, deletedAt, expiresAt: deletedAt + 30 * 24 * 60 * 60 * 1000 });
  saveTrash(purged);
}

function normalizeApprovalFormName(value) {
  return String(value || '').trim().toLowerCase();
}

function loadHiddenApprovalForms() {
  try {
    const raw = localStorage.getItem('flic_hidden_approval_forms');
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch(e) {
    return [];
  }
}

function saveHiddenApprovalForms(list) {
  try {
    localStorage.setItem('flic_hidden_approval_forms', JSON.stringify(list));
  } catch(e) {}
}

function hideApprovalForm(form) {
  const formId = String(form?.id ?? '');
  const formName = String(form?.name ?? '').trim();
  if (!formId && !formName) return;

  const existing = loadHiddenApprovalForms();
  const alreadyExists = existing.some(item =>
    String(item?.id ?? '') === formId ||
    (formName && normalizeApprovalFormName(item?.name) === normalizeApprovalFormName(formName))
  );
  if (alreadyExists) return;

  existing.unshift({ id: formId, name: formName });
  saveHiddenApprovalForms(existing);
}

function unhideApprovalForm(formId, formName) {
  const normalizedId = String(formId ?? '');
  const normalizedName = normalizeApprovalFormName(formName);
  const next = loadHiddenApprovalForms().filter(item =>
    String(item?.id ?? '') !== normalizedId &&
    (!normalizedName || normalizeApprovalFormName(item?.name) !== normalizedName)
  );
  saveHiddenApprovalForms(next);
}

function removeApprovalsByForm(form) {
  try {
    const approvals = JSON.parse(localStorage.getItem('flic_approvals') || '[]');
    const formId = String(form?.id ?? '');
    const formName = normalizeApprovalFormName(form?.name);
    localStorage.setItem('flic_approvals', JSON.stringify(
      approvals.filter(a =>
        String(a.id) !== formId &&
        String(a.form_id ?? '') !== formId &&
        String(a._dbId ?? '') !== formId &&
        (!formName || normalizeApprovalFormName(a.form) !== formName)
      )
    ));
  } catch(e) {}
}
// ────────────────────────────────────────────────────────

// Dữ liệu mặc định (seed)
const DEFAULT_FORMS = [
  {id:'1',name:'Đăng ký khóa học Tiếng Anh giao tiếp',cat:'Ngoại ngữ',created:'10/03/2026',status:'active',by:'Nguyễn Văn A',initials:'N',img:'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&h=200&fit=crop',color:'#0ea5e9'},
  {id:'2',name:'Khảo sát mức độ hài lòng học viên',cat:'Ngoại ngữ',created:'08/03/2026',status:'active',by:'Trần Thị B',initials:'T',img:'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=200&fit=crop',color:'#8b5cf6'},
  {id:'3',name:'Đăng ký thi chứng chỉ Tin học',cat:'Tin học',created:'05/03/2026',status:'active',by:'Lê Văn C',initials:'L',img:'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=200&fit=crop',color:'#f97316'},
  {id:'4',name:'Phiếu đánh giá giảng viên',cat:'Ngoại ngữ',created:'03/03/2026',status:'draft',by:'Phạm Thị D',initials:'P',img:'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=200&fit=crop',color:'#ec4899'},
  {id:'5',name:'Đăng ký học thử miễn phí',cat:'Ngoại ngữ',created:'01/03/2026',status:'active',by:'Hoàng Văn E',initials:'H',img:'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=200&fit=crop',color:'#10b981'},
  {id:'6',name:'Feedback chương trình học',cat:'Ngoại ngữ',created:'15/12/2025',status:'draft',by:'Vũ Thị F',initials:'V',img:'https://images.unsplash.com/photo-1517842645767-c639042777db?w=400&h=200&fit=crop',color:'#64748b'},
  {id:'7',name:'Đăng ký tư vấn lộ trình học',cat:'Ngoại ngữ',created:'25/02/2026',status:'active',by:'Đỗ Văn G',initials:'Đ',img:'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=200&fit=crop',color:'#3b82f6'},
  {id:'8',name:'Khảo sát nhu cầu mở lớp mới',cat:'Ngoại ngữ',created:'20/02/2026',status:'active',by:'Ngô Thị H',initials:'N',img:'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=400&h=200&fit=crop',color:'#f59e0b'},
];

// ── API helpers ──────────────────────────────────────────
const LS_QUESTIONS = 'flic_library_questions';

function loadLibraryQuestions() {
  // Dùng cache từ flic_lib_flat (sync từ library.js sau khi fetch API)
  try {
    const flat = localStorage.getItem('flic_lib_flat');
    if (flat) return JSON.parse(flat);
  } catch(e) {}
  return [];
}
function saveLibraryQuestions(list) {
  try { localStorage.setItem(LS_QUESTIONS, JSON.stringify(list)); } catch(e) {}
}

// Tải câu hỏi thư viện từ API (gọi sau khi renderLayout xong)
async function fetchLibraryFromAPI() {
  try {
    const token = localStorage.getItem('token') || '';
    const res   = await fetch(`${API_BASE}/library`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return;
    const data  = await res.json();
    // Flat array với category
    const flat  = data.map(q => ({ ...q, category: q.bo_mon }));
    localStorage.setItem('flic_lib_flat', JSON.stringify(flat));
    libraryQuestions = flat;
    // Cập nhật count badge nếu panel đang mở
    const countEl = document.getElementById('q-total-count');
    if (countEl) countEl.textContent = flat.length;
  } catch(e) {}
}

async function loadForms() {
  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/forms`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const colors = ['#0ea5e9','#8b5cf6','#f97316','#ec4899','#10b981','#3b82f6','#f59e0b','#64748b'];
    const imgs = [
      'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&h=200&fit=crop',
      'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=200&fit=crop',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=200&fit=crop',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=200&fit=crop',
    ];
    return data.map((f, i) => {
      // Màu avatar theo vai trò: admin → cam, staff → xanh da trời nhẹ
      const rawName = f.nguoi_tao || '';
      // Normalize: "Quản trị viên" → "Quản lý" (tên trong DB cũ)
      const displayName = (rawName === 'Quản trị viên' || rawName === 'admin' || rawName === 'Admin')
        ? 'Quản lý'
        : (rawName || 'Quản lý');
      // Màu: quản lý (admin/manager) = cam, nhân viên (staff) = xanh
      // Ưu tiên check vai_tro, fallback check tên hiển thị
      const isManager = (f.vai_tro === 'admin' || f.vai_tro === 'manager')
        || (!f.vai_tro && displayName === 'Quản lý');
      const roleColor = isManager ? '#f97316' : '#38bdf8';
      return {
        id: String(f.id),
        name: f.ten_form,
        cat: f.danh_muc || 'Khác',
        status: f.trang_thai || 'draft',
        created: f.ngay_tao ? new Date(f.ngay_tao).toLocaleDateString('vi-VN') : '',
        by: displayName,
        initials: displayName[0]?.toUpperCase() || 'Q',
        img: imgs[i % imgs.length],
        color: roleColor,
        loi_ket: f.loi_ket || '',
        vai_tro: f.vai_tro || 'staff',
      };
    });
  } catch(e) {
    console.warn('Không thể tải từ API, dùng dữ liệu mặc định:', e);
    return DEFAULT_FORMS;
  }
}
// ─────────────────────────────────────────────────────────────────

let FORMS = [];
let favorites = new Set(JSON.parse(localStorage.getItem('flic_favorites')||'[]'));
function getFavorites(){return new Set(JSON.parse(localStorage.getItem('flic_favorites')||'[]').map(String));}
function toggleFav(id,e){e.stopPropagation();const favs=getFavorites();const sid=String(id);if(favs.has(sid))favs.delete(sid);else favs.add(sid);localStorage.setItem('flic_favorites',JSON.stringify([...favs]));favorites=favs;renderGrid(filtered);}
// Sync favorites từ tab khác (ví dụ xóa từ trang yêu thích)
window.addEventListener('storage',function(ev){if(ev.key==='flic_favorites'){favorites=getFavorites();renderGrid(filtered);}});
function getRejectedEditContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    formId: params.get('edit_form_id') || '',
    approvalId: params.get('resubmit_approval_id') || ''
  };
}
function getDirectViewContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    formId: params.get('view_form_id') || ''
  };
}
function syncResubmittedApprovalLocal(approvalId, formId, formName, cat, questions) {
  try {
    const approvals = JSON.parse(localStorage.getItem('flic_approvals') || '[]');
    const idx = approvals.findIndex(a => String(a.id) === String(approvalId));
    if (idx !== -1) {
      approvals[idx] = {
        ...approvals[idx],
        status: 'pending',
        note: '',
        reject_reason: '',
        form: formName,
        cat,
        form_id: Number(formId) || approvals[idx].form_id,
        questions,
        date: new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      };
      localStorage.setItem('flic_approvals', JSON.stringify(approvals));
    }
  } catch(e) {}
}
function autoOpenRejectedFormEdit() {
  const ctx = getRejectedEditContext();
  if (!ctx.formId) return;
  const target = FORMS.find(f => String(f.id) === String(ctx.formId));
  if (!target) return;
  setTimeout(() => openEditModal(String(ctx.formId)), 120);
}
function autoOpenDirectFormView() {
  const ctx = getDirectViewContext();
  if (!ctx.formId) return;
  const target = FORMS.find(f => String(f.id) === String(ctx.formId));
  if (!target) return;
  setTimeout(() => openViewModal(String(ctx.formId)), 120);
}
(async () => {
  FORMS = await loadForms();
  filtered = [...FORMS];
  renderGrid(filtered);
  autoOpenRejectedFormEdit();
  autoOpenDirectFormView();
})();


let libraryQuestions = loadLibraryQuestions() || [];

let selectedQuestions = new Set(); // mirrors formData.selectedQuestions
let viewMode = 'grid', filtered = [];

const sBadge = s => s==='active'?'<span class="badge badge-green">Hoạt động</span>':s==='pending'?'<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a">Chờ phê duyệt</span>':s==='archived'?'<span class="badge" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1">Lưu trữ</span>':'<span class="badge badge-yellow">Nháp</span>';
const typeName = t => {
  const normalizedType = normalizeQuestionType(t);
  return normalizedType === 'choice' ? 'Lựa chọn' : normalizedType === 'rating' ? 'Đánh giá' : normalizedType === 'paragraph' ? 'Đoạn văn' : 'Đoạn văn';
};
const typeClass = t => {
  const normalizedType = normalizeQuestionType(t);
  return normalizedType === 'paragraph' ? 'q-type-text' : normalizedType === 'rating' ? 'q-type-rating' : 'q-type-choice';
};
const typeIcon = t => t==='choice'?'☑':t==='rating'?'⭐':'📝';

// ─── PAGE HTML ───
document.getElementById('page-content').innerHTML = `
  <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><h2 class="page-title">Quản lý biểu mẫu</h2><p class="page-sub">Tạo, chỉnh sửa và quản lý tất cả biểu mẫu của bạn</p></div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn btn-primary" onclick="openFormModal()">${IC.plus}Tạo biểu mẫu mới</button>
    </div>
  </div>

  <div class="card card-body" style="margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <div class="input-wrap" style="flex:1;min-width:200px">
        <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
        <input type="text" id="search-inp" class="input" placeholder="Tìm kiếm theo tên hoặc mô tả..." oninput="filterForms()">
      </div>

    </div>
  </div>

  <p id="forms-count" style="font-size:13px;color:var(--gray-500);margin-bottom:14px"></p>
  <div id="grid-view" class="grid-4"></div>
  <div id="list-view" class="card" style="display:none"></div>

  <div style="background:#fff;border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;margin-top:16px;box-shadow:var(--shadow-sm)">
    <span style="font-size:13px;color:var(--gray-500)">Trang 1 / 1</span>
    <div style="display:flex;gap:6px">
      <button class="pag-btn" disabled>Trước</button>
      <button class="pag-btn active">1</button>
      <button class="pag-btn" disabled>Sau</button>
    </div>
  </div>

  <!-- CREATE FORM MODAL -->
  <div class="modal-overlay" id="create-form-modal">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:920px;width:min(92vw,920px);border-radius:16px;display:flex;flex-direction:column">
      <div class="modal-header">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <button id="collapse-form-btn" class="btn btn-outline btn-sm" onclick="toggleCreateFormFullscreen()" style="display:none;align-items:center;gap:6px;margin-top:2px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
            Quay lại
          </button>
          <div>
            <div class="modal-title">Tạo biểu mẫu mới</div>
            <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Điền thông tin và thêm câu hỏi</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button id="expand-form-btn" class="icon-btn" title="Phóng to" onclick="toggleCreateFormFullscreen()" style="color:var(--gray-400);transition:all .15s" onmouseenter="this.style.color='#0ea5e9'" onmouseleave="this.style.color='var(--gray-400)'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>
          <button class="icon-btn close-btn" onclick="closeFormModal()">${IC.close}</button>
        </div>
      </div>

      <div id="modal-scroll" style="padding:0 24px 8px;max-height:min(76vh,820px);overflow-y:auto">

        <!-- Tên form -->
        <div class="form-group" style="margin-top:16px">
          <label class="form-label">Tên biểu mẫu <span style="color:var(--red)">*</span></label>
          <input id="new-form-name" type="text" class="input" required placeholder="VD: Khảo sát mức độ hài lòng học viên tháng 3/2026" style="background:#f8f9fb">
        </div>

        <!-- Mô tả -->
        <div class="form-group">
          <label class="form-label" style="display:flex;justify-content:space-between">
            <span>Mô tả</span>
            <span id="desc-count" style="font-size:11px;color:var(--gray-400);font-weight:400">0/100</span>
          </label>
          <textarea id="new-form-desc" class="input" maxlength="100" rows="2"
            style="height:48px;resize:none;padding:10px;background:#f8f9fb;font-size:13px"
            placeholder="Mô tả ngắn về biểu mẫu..."
            oninput="var c=document.getElementById('desc-count');c.textContent=this.value.length+'/100';c.style.color=this.value.length>85?'var(--red)':'var(--gray-400)'"></textarea>
        </div>

        <!-- Danh mục + Ngày đóng -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div>
            <label class="form-label">Danh mục <span style="color:var(--red)">*</span></label>
            <select id="new-form-cat" class="input" required style="width:100%;background:#f8f9fb">
              <option value="">Chọn danh mục</option>
              <option>Ngoại ngữ</option>
              <option>Tin học</option>
            </select>
          </div>
          <div>
            <label class="form-label">Ngày đóng biểu mẫu</label>
            <input type="date" id="new-form-close" class="input" style="width:100%;background:#f8f9fb;height:38px;font-size:12.5px">
            <label style="display:flex;align-items:center;gap:6px;margin-top:7px;cursor:pointer;font-size:12.5px;color:var(--gray-600)">
              <input type="checkbox" id="new-form-no-close" style="width:15px;height:15px;accent-color:#7c3aed;cursor:pointer"
                onchange="var el=document.getElementById('new-form-close');el.disabled=this.checked;el.style.opacity=this.checked?'0.35':'1'">
              Không đóng
            </label>
          </div>
        </div>

        <!-- Trạng thái -->
        <div class="form-group">
          <label class="form-label">Trạng thái biểu mẫu <span style="color:var(--red)">*</span></label>
          <div style="position:relative">
            <select id="new-form-status" class="input" required style="width:100%;background:#f8f9fb;appearance:none;-webkit-appearance:none;padding-right:32px" onchange="toggleApprovalNoteField()">
              <option value="draft">Nháp</option>
              <option value="pending">Chờ phê duyệt</option>
            </select>
            <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" width="14" height="14" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>

        <!-- Ghi chú phê duyệt -->
        <div class="form-group" id="approval-note-group" style="display:none">
          <label class="form-label">Ghi chú cho người phê duyệt</label>
          <div style="position:relative">
            <textarea id="new-form-note" class="input" maxlength="50" rows="2"
              style="height:42px;resize:none;padding:8px 44px 8px 10px;background:#f8f9fb;font-size:13px"
              oninput="var c=document.getElementById('note-count');c.textContent=this.value.length+'/50';c.style.color=this.value.length>40?'var(--red)':'var(--gray-400)'"></textarea>
            <span id="note-count" style="position:absolute;right:10px;bottom:8px;font-size:11px;color:var(--gray-400);pointer-events:none">0/50</span>
          </div>
        </div>

        <!-- Lời kết sau khi gửi -->
        <div class="form-group">
          <label class="form-label">Lời kết (hiển thị sau khi người dùng gửi phản hồi)</label>
          <textarea id="new-form-loi-ket" class="input" maxlength="300" rows="2"
            style="resize:none;padding:8px 10px;background:#f8f9fb;font-size:13px"
            placeholder="VD: Cảm ơn bạn đã tham gia khảo sát! Phản hồi của bạn rất có giá trị với chúng tôi."
            oninput="updateNewFormLoiKetDraft(this.value)"></textarea>
          <div style="text-align:right;font-size:11px;color:var(--gray-400);margin-top:2px"><span id="loi-ket-count">0/300</span></div>
        </div>

        <div style="height:1px;background:var(--gray-200);margin-bottom:14px"></div>

        <!-- Khu vực câu hỏi -->
        <div id="questions-area">
          <!-- Header -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span style="font-size:13.5px;font-weight:700;color:var(--gray-700)">
              Câu hỏi <span id="q-sel-count" style="color:#0ea5e9">0</span>
            </span>
            <div style="display:flex;gap:8px">
              <button onclick="toggleLibrary()"
                style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;font-size:12.5px;font-weight:600;color:#64748b;cursor:pointer;transition:all .15s"
                onmouseenter="this.style.borderColor='#0ea5e9';this.style.color='#0ea5e9'"
                onmouseleave="this.style.borderColor='#e2e8f0';this.style.color='#64748b'">
                📚 Thư viện (<span id="q-total-count">12</span>)
              </button>
              <button onclick="addDirectQ()" class="btn btn-primary btn-sm" style="background:var(--sky);border-color:var(--sky-dark)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Thêm câu hỏi
              </button>
            </div>
          </div>

          <!-- Thư viện (ẩn mặc định) -->
          <div id="library-panel" style="display:none;border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:10px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8f9fb;border-bottom:1px solid #e2e8f0">
              <span style="font-size:13px;font-weight:700;color:#374151">📚 Thư viện câu hỏi</span>
              <div style="display:flex;gap:6px;align-items:center">
                <button onclick="selectAllQ()">Chọn tất cả</button>
                <button class="btn btn-outline btn-sm" onclick="deselectAllQ()">Bỏ chọn</button>
                <button onclick="toggleLibrary()" style="background:none;border:none;cursor:pointer;color:var(--gray-400);font-size:22px;line-height:1;padding:0 2px;display:flex;align-items:center" title="Đóng">×</button>
              </div>
            </div>
            <div style="padding:8px 12px;border-bottom:1px solid #f1f5f9;display:flex;gap:8px;align-items:center">
              <select id="lib-cat-filter" class="input" style="height:34px;font-size:12.5px;width:130px;flex-shrink:0;padding:0 8px" onchange="renderQList()">
                <option value="Ngoại ngữ">🌐 Ngoại ngữ</option>
                <option value="Tin học">💻 Tin học</option>
              </select>
              <div class="input-wrap" style="margin:0;flex:1">
                <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                <input type="text" id="lib-search" class="input" placeholder="Tìm câu hỏi..." style="font-size:12.5px;height:34px" oninput="renderQList()">
              </div>
            </div>
            <div id="q-list-wrap" style="max-height:260px;overflow-y:auto"></div>
          </div>

          <!-- Danh sách câu hỏi trực tiếp -->
          <div id="direct-q-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:4px"></div>
          <div id="direct-q-empty" style="border:1.5px solid var(--gray-200);border-radius:12px;padding:18px 16px;text-align:center;color:var(--gray-400);font-size:13px">
            Chưa có câu hỏi nào. Bấm "+ Thêm câu hỏi" hoặc chọn từ 📚 Thư viện.
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid var(--gray-200);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:13px;color:var(--gray-500)">Đã chọn <strong id="q-bottom-count" style="color:var(--sky)">0</strong> câu hỏi</div>
          <button onclick="openFormPreview()"
            style="display:flex;align-items:center;gap:5px;padding:6px 13px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;font-size:12.5px;font-weight:600;color:#64748b;cursor:pointer;transition:all .15s"
            onmouseenter="this.style.borderColor='#0ea5e9';this.style.color='#0284c7'"
            onmouseleave="this.style.borderColor='#e2e8f0';this.style.color='#64748b'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Xem trước
          </button>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-outline" onclick="closeFormModal()">Hủy bỏ</button>
          <button class="btn btn-primary" onclick="requestSubmitForm()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Tạo biểu mẫu
          </button>
        </div>
      </div>
    </div>
  </div>
`;

// Inject modal preview form
document.getElementById('page-content').insertAdjacentHTML('beforeend', `
  <div class="modal-overlay" id="form-preview-modal" onclick="closeModal('form-preview-modal')">
    <div class="modal" onclick="event.stopPropagation()" style="width:100vw;max-width:none;height:100vh;max-height:none;border-radius:0;display:flex;flex-direction:column;overflow:hidden;box-shadow:none">
      <div class="modal-header" style="padding:12px 20px 10px;border-bottom:1px solid #bfdbfe;background:linear-gradient(180deg,#f8fbff 0%,#dbeafe 100%);flex-shrink:0;min-height:auto">
        <div>
          <div class="modal-title" id="form-preview-title" style="font-size:22px;line-height:1.15;font-weight:800;color:#0f172a">Xem trước biểu mẫu</div>
          <div style="font-size:12.5px;color:#64748b;margin-top:4px">Đây là giao diện người dùng sẽ thấy</div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('form-preview-modal')" style="width:34px;height:34px;border-radius:10px;background:#eff6ff;border:1px solid #93c5fd;color:#1d4ed8">${IC.close}</button>
      </div>
      <div id="form-preview-body" style="flex:1;overflow-y:auto;padding:28px 32px;background:linear-gradient(180deg,#eff6ff 0%,#dbeafe 100%)"></div>
      <div style="padding:8px 20px;border-top:1px solid #bfdbfe;display:flex;justify-content:flex-end;align-items:center;flex-shrink:0;background:#f8fbff">
        <button class="btn btn-outline btn-sm" onclick="closeModal('form-preview-modal')">Đóng</button>
      </div>
    </div>
  </div>
`);

// ─── MODAL OPEN/CLOSE ───
function toggleLibrary() {
  const p = document.getElementById('library-panel');
  if (!p) return;
  const show = p.style.display === 'none';
  p.style.display = show ? 'block' : 'none';
  if (show) fetchLibraryFromAPI().then(() => renderQList());
}

// ─── FULLSCREEN TOGGLE CHO MODAL TẠO FORM ───
let _createFormFullscreen = false;
function toggleCreateFormFullscreen() {
  const overlay = document.getElementById('create-form-modal');
  const modal = overlay ? overlay.querySelector('.modal') : null;
  const scroll = document.getElementById('modal-scroll');
  const btn = document.getElementById('expand-form-btn');
  const backBtn = document.getElementById('collapse-form-btn');
  if (!modal) return;
  _createFormFullscreen = !_createFormFullscreen;
  if (_createFormFullscreen) {
    document.body.style.overflow = 'hidden';
    overlay.style.cssText = 'position:fixed;inset:0;background:#f8fafc;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;z-index:1200;padding:0;overflow:hidden;';
    modal.style.cssText = 'width:100vw;max-width:none;height:100vh;max-height:none;border-radius:0;margin:0;display:flex;flex-direction:column;background:#fff;box-shadow:none;position:relative;';
    if (scroll) { scroll.style.maxHeight = 'none'; scroll.style.flex = '1'; scroll.style.overflow = 'auto'; scroll.style.padding = '0 24px 12px'; }
    if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>';
    if (btn) btn.title = 'Thu nhỏ';
    if (backBtn) backBtn.style.display = 'inline-flex';
  } else {
    document.body.style.overflow = '';
    overlay.removeAttribute('style');
    modal.style.cssText = 'max-width:920px;width:min(92vw,920px);border-radius:16px;display:flex;flex-direction:column;';
    if (scroll) { scroll.style.maxHeight = 'min(76vh,820px)'; scroll.style.flex = ''; scroll.style.overflow = 'auto'; scroll.style.padding = '0 24px 8px'; }
    if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
    if (btn) btn.title = 'Phóng to';
    if (backBtn) backBtn.style.display = 'none';
  }
}

// ─── EDIT FORM FULLSCREEN ───
let _editFormFullscreen = false;
function toggleEditFormFullscreen() {
  const overlay = document.getElementById('edit-form-modal');
  const modal = overlay ? overlay.querySelector('.modal') : null;
  const scroll = document.getElementById('edit-modal-scroll');
  const btn = document.getElementById('expand-edit-btn');
  if (!modal) return;
  _editFormFullscreen = !_editFormFullscreen;
  if (_editFormFullscreen) {
    overlay.style.cssText = 'position:fixed;inset:0;background:#f1f5f9;display:flex;flex-direction:column;align-items:stretch;z-index:1000;padding:0;overflow-y:auto;';
    modal.style.cssText = 'width:100%;max-width:860px;min-height:100vh;border-radius:0;margin:0 auto;display:flex;flex-direction:column;background:#fff;box-shadow:0 0 40px rgba(0,0,0,0.08);position:relative;';
    if (scroll) { scroll.style.maxHeight = 'none'; scroll.style.flex = '1'; scroll.style.overflow = 'visible'; }
    if (btn) { btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>'; btn.title = 'Thu nhỏ'; }
  } else {
    overlay.removeAttribute('style');
    modal.style.cssText = 'max-width:640px;border-radius:16px;';
    if (scroll) { scroll.style.maxHeight = '78vh'; scroll.style.flex = ''; scroll.style.overflow = ''; }
    if (btn) { btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'; btn.title = 'Phóng to'; }
  }
}

// ─── THÊM CÂU HỎI MỚI VÀO THƯ VIỆN TRỰC TIẾP ───
const TYPE_LABEL_MAP = {
  choice:'Trắc nghiệm',
  checkbox:'Hộp kiểm',
  dropdown:'Thả xuống',
  paragraph:'Đoạn văn',
  rating:'Xếp hạng',
  scale:'Tuyến tính',
  grid_radio:'Lưới trắc nghiệm',
  grid_checkbox:'Lưới hộp kiểm'
};
// Aliases for backward compat (from DB)
const TYPE_LABEL_ALIASES = {short_text:'Đoạn văn', long_text:'Đoạn văn', text:'Đoạn văn', star_rating:'Xếp hạng'};
const NEEDS_OPTS = ['choice','checkbox','dropdown','rating','scale'];
const NEEDS_GRID = ['grid_radio','grid_checkbox'];
function normalizeQuestionType(type) {
  if (type === 'text' || type === 'short_text' || type === 'long_text') return 'paragraph';
  if (type === 'star_rating') return 'rating';
  return type;
}
function getTypeOptionLabel(type) {
  return ({
    choice: '◉ Trắc nghiệm',
    checkbox: '☑ Hộp kiểm',
    dropdown: '▾ Thả xuống',
    paragraph: '¶ Đoạn văn',
    short_text: '¶ Đoạn văn',
    long_text: '¶ Đoạn văn',
    rating: '★ Xếp hạng',
    scale: '⟷ Tuyến tính',
    star_rating: '★ Xếp hạng',
    grid_radio: '⊞ Lưới trắc nghiệm',
    grid_checkbox: '⊟ Lưới hộp kiểm',
  }[type] || TYPE_LABEL_MAP[type] || type);
}
function getDefaultOptionsForType(type, count) {
  if (type === 'rating' || type === 'star_rating') return Array.from({length:5},(_,i)=>`${i+1}`);
  if (type === 'scale') return ['',''];  // [label_min, label_max]
  return [''];
}
function renderTextAnswerBuilder(type) {
  const normalizedType = normalizeQuestionType(type);
  if (normalizedType === 'paragraph') {
    return `
      <div style="padding-left:30px;margin-top:10px">
        <div style="font-size:11px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Câu trả lời mẫu</div>
        <textarea disabled rows="4" placeholder="Người trả lời sẽ nhập câu trả lời tại đây"
          style="width:100%;padding:10px 12px;border:1.5px solid #c7d2fe;border-radius:10px;font-size:12.5px;background:#eef2ff;color:#94a3b8;resize:none;outline:none"></textarea>
      </div>`;
  }
  return '';
}

function dqSetStarCount(id, n) {
  const q = _dqFindQ ? _dqFindQ(id) : (directQuestions.find(q=>sameQuestionId(q.id,id))||libraryQuestions.find(q=>sameQuestionId(q.id,id)));
  if (!q) return;
  q.opts = Array.from({length:n},(_,i)=>`${i+1}`);
  renderDirectQList();
}
function editQSetStarCount(qi, n) {
  if (!editFormQuestions[qi]) return;
  editFormQuestions[qi].opts = Array.from({length:n},(_,i)=>`${i+1}`);
  renderEditQuestions();
}

function updateSelectedPreview() { renderDirectQList(); }

// ─── FORM PREVIEW MODAL ───
function renderQuestionPreview(q) {
  const normalizedType = normalizeQuestionType(q.type);
  const opts = q.opts || [];
  if (normalizedType === 'paragraph') {
    return `<textarea disabled rows="4" placeholder="Đoạn văn" style="padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;color:#94a3b8;background:#f8f9fb;width:100%;resize:none"></textarea>`;
  }
  if (normalizedType === 'choice') {
    return opts.map((o,i) => `
      <label style="display:flex;align-items:center;gap:9px;padding:6px 0;font-size:13.5px;color:#374151;cursor:pointer">
        <span style="width:17px;height:17px;border-radius:50%;border:2px solid #0ea5e9;flex-shrink:0;display:inline-block"></span>${o||`Lựa chọn ${i+1}`}
      </label>`).join('');
  }
  if (normalizedType === 'checkbox') {
    return opts.map((o,i) => `
      <label style="display:flex;align-items:center;gap:9px;padding:6px 0;font-size:13.5px;color:#374151;cursor:pointer">
        <span style="width:16px;height:16px;border-radius:3px;border:2px solid #0ea5e9;flex-shrink:0;display:inline-block"></span>${o||`Lựa chọn ${i+1}`}
      </label>`).join('');
  }
  if (normalizedType === 'dropdown') {
    return `<select style="padding:8px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;color:#374151;background:#f8f9fb;width:100%;max-width:280px;cursor:pointer">
      <option>Chọn một mục...</option>${opts.map(o=>`<option>${o}</option>`).join('')}
    </select>`;
  }
  if (normalizedType === 'grid_radio' || normalizedType === 'grid_checkbox') {
    const rows = q.rows || ['Hàng 1'];
    const cols = q.cols || ['Cột 1'];
    const isRadio = normalizedType === 'grid_radio';
    return `<div style="overflow-x:auto;margin-top:4px">
      <table style="border-collapse:collapse;min-width:280px;font-size:12.5px">
        <thead>
          <tr>
            <th style="padding:6px 12px;text-align:left;color:#64748b;font-weight:500;border-bottom:2px solid #e2e8f0"></th>
            ${cols.map(c=>`<th style="padding:6px 12px;text-align:center;color:#0369a1;font-weight:600;border-bottom:2px solid #e2e8f0;white-space:nowrap">${c}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((r,ri)=>`<tr style="background:${ri%2===0?'#f8faff':'#fff'}">
            <td style="padding:7px 12px;color:#374151;font-weight:500;border-bottom:1px solid #f1f5f9;white-space:nowrap">${r}</td>
            ${cols.map(()=>`<td style="padding:7px 12px;text-align:center;border-bottom:1px solid #f1f5f9">
              <span style="display:inline-block;width:${isRadio?'16px':'14px'};height:${isRadio?'16px':'14px'};border-radius:${isRadio?'50%':'3px'};border:2px solid #0ea5e9;vertical-align:middle"></span>
            </td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }
  if (normalizedType === 'rating') {
    return `<div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap">
      ${Array.from({length:5},(_,i)=>`
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
          <span style="font-size:12px;font-weight:600;color:#92400e">${i+1}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" width="28" height="28"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>
        </div>
      `).join('')}
    </div>`;
  }
  if (normalizedType === 'scale') {
    const labelMin = opts[0] || '';
    const labelMax = opts[1] || '';
    return `<div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;gap:8px">
        ${[1,2,3,4,5].map(n=>`<div style="width:36px;height:36px;border-radius:50%;border:2px solid #a5b4fc;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#4338ca;background:#f8f9ff">${n}</div>`).join('')}
      </div>
      ${(labelMin||labelMax) ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#6366f1;font-style:italic">
        <span>${labelMin}</span><span>${labelMax}</span>
      </div>` : ''}
    </div>`;
  }
  return '';
}

function openFormPreview() {
  const name = document.getElementById('new-form-name')?.value?.trim() || '(Chưa đặt tên)';
  const desc = document.getElementById('new-form-desc')?.value?.trim() || '';
  const cat  = document.getElementById('new-form-cat')?.value || '';
  const sel  = getAllFormQuestions();

  const body = document.getElementById('form-preview-body');
  const title = document.getElementById('form-preview-title');
  if (!body || !title) return;

  // Keep preview above the create form in both popup and standalone create page.
  const previewOverlay = document.getElementById('form-preview-modal');
  if (previewOverlay) previewOverlay.style.zIndex = '1300';

  title.textContent = name;

  if (!sel.length) {
    body.innerHTML = `<div style="text-align:center;padding:40px 0;color:#94a3b8;font-size:14px">Chưa có câu hỏi nào trong form.</div>`;
    openModal('form-preview-modal');
    return;
  }

  body.innerHTML = `
    <div style="max-width:1180px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#dbeafe 0%,#bfdbfe 52%,#93c5fd 100%);border-radius:28px;padding:28px 32px;margin-bottom:24px;color:#1e3a8a;box-shadow:0 24px 48px rgba(59,130,246,.14)">
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
          ${cat ? `<span style="font-size:12px;background:rgba(255,255,255,0.5);padding:6px 12px;border-radius:999px;font-weight:700">${cat}</span>` : ''}
          <span style="font-size:12px;background:rgba(255,255,255,0.5);padding:6px 12px;border-radius:999px;font-weight:700">Tổng ${sel.length} câu hỏi</span>
        </div>
        <div style="font-size:42px;font-weight:800;line-height:1.08;letter-spacing:-0.02em;margin-bottom:10px">${name}</div>
        ${desc ? `<div style="font-size:17px;line-height:1.6;max-width:820px">${desc}</div>` : ''}
      </div>

      <div style="display:flex;flex-direction:column;gap:16px;padding-bottom:24px">
        ${sel.map((q, i) => `
          <div style="border:1px solid #bfdbfe;border-radius:22px;padding:20px 22px;background:rgba(255,255,255,.9);box-shadow:0 10px 26px rgba(59,130,246,.08)">
            <div style="display:flex;align-items:flex-start;gap:14px">
              <div style="width:36px;height:36px;border-radius:50%;background:#dbeafe;color:#2563eb;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">${i+1}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
                  <span style="display:inline-flex;align-items:center;padding:6px 11px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:700">${TYPE_LABEL_MAP[normalizeQuestionType(q.type)] || normalizeQuestionType(q.type)}</span>
                  ${q.required ? '<span style="display:inline-flex;align-items:center;padding:6px 11px;border-radius:999px;background:#fee2e2;color:#dc2626;font-size:12px;font-weight:700">Bắt buộc</span>' : '<span style="display:inline-flex;align-items:center;padding:6px 11px;border-radius:999px;background:#f8fafc;color:#64748b;font-size:12px;font-weight:700">Không bắt buộc</span>'}
                </div>
                <div style="font-size:22px;font-weight:700;color:#0f172a;margin-bottom:16px;line-height:1.45">${q.text}</div>
                ${renderQuestionPreview(q)}
              </div>
            </div>
          </div>`).join('')}
      </div>

      <div style="padding-bottom:20px;text-align:center">
        <button disabled style="padding:12px 36px;background:#3b82f6;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:not-allowed;opacity:.78">Gửi phản hồi</button>
      </div>
    </div>`;

  openModal('form-preview-modal');
}

function previewEsc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function previewQuestionChip(type) {
  const normalizedType = normalizeQuestionType(type);
  if (normalizedType === 'choice' || normalizedType === 'checkbox' || normalizedType === 'dropdown') return 'L&#7921;a ch&#7885;n';
  if (normalizedType === 'rating' || normalizedType === 'scale') return '&#272;&aacute;nh gi&aacute;';
  if (normalizedType === 'paragraph') return 'T&#7921; lu&#7853;n';
  if (normalizedType === 'grid_radio' || normalizedType === 'grid_checkbox') return 'Ma tr&#7853;n';
  return TYPE_LABEL_MAP[normalizedType] || normalizedType;
}

function renderPreviewOptionPills(options, kind = 'radio') {
  return `<div style="display:flex;flex-wrap:wrap;gap:12px 14px">
    ${options.map((option, index) => `
      <label style="display:inline-flex;align-items:center;gap:10px;min-height:48px;padding:0 16px;border:1px solid #cfe0ff;border-radius:16px;background:#fff;font-size:14px;font-weight:700;color:#233a63">
        <span style="width:16px;height:16px;border:${kind === 'checkbox' ? '1.8px solid #9ca3af;border-radius:4px' : '1.8px solid #9ca3af;border-radius:50%'};display:inline-block;flex-shrink:0;background:#fff"></span>
        ${previewEsc(option || `Lua chon ${index + 1}`)}
      </label>
    `).join('')}
  </div>`;
}

function renderQuestionPreview(q) {
  const normalizedType = normalizeQuestionType(q.type);
  const opts = Array.isArray(q.opts) ? q.opts : [];

  if (normalizedType === 'paragraph') {
    return `<textarea disabled rows="4" placeholder="Nh&#7853;p c&acirc;u tr&#7843; l&#7901;i c&#7911;a b&#7841;n" style="width:100%;padding:14px 16px;border:1px solid #cfe0ff;border-radius:16px;font-size:14px;color:#94a3b8;background:#fff;resize:none;outline:none"></textarea>`;
  }
  if (normalizedType === 'choice') return renderPreviewOptionPills(opts, 'radio');
  if (normalizedType === 'checkbox') return renderPreviewOptionPills(opts, 'checkbox');
  if (normalizedType === 'dropdown') {
    return `<select disabled style="width:100%;max-width:320px;padding:14px 16px;border:1px solid #cfe0ff;border-radius:16px;font-size:14px;color:#64748b;background:#fff;outline:none">
      <option>Ch&#7885;n m&#7897;t m&#7909;c...</option>
      ${opts.map(option => `<option>${previewEsc(option)}</option>`).join('')}
    </select>`;
  }
  if (normalizedType === 'grid_radio' || normalizedType === 'grid_checkbox') {
    const rows = Array.isArray(q.rows) && q.rows.length ? q.rows : ['Hang 1'];
    const cols = Array.isArray(q.cols) && q.cols.length ? q.cols : ['Cot 1'];
    const isRadio = normalizedType === 'grid_radio';
    return `<div style="overflow-x:auto">
      <table style="border-collapse:separate;border-spacing:0;width:100%;min-width:420px;border:1px solid #dbeafe;border-radius:16px;overflow:hidden;background:#fff">
        <thead>
          <tr>
            <th style="padding:12px 14px;text-align:left;background:#f8fbff;color:#64748b;font-size:13px;font-weight:700;border-bottom:1px solid #dbeafe"></th>
            ${cols.map(col => `<th style="padding:12px 14px;text-align:center;background:#f8fbff;color:#33538a;font-size:13px;font-weight:700;border-bottom:1px solid #dbeafe">${previewEsc(col)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, rowIndex) => `
            <tr style="background:${rowIndex % 2 === 0 ? '#fff' : '#fcfdff'}">
              <td style="padding:14px;color:#0f172a;font-size:14px;font-weight:600;border-bottom:${rowIndex === rows.length - 1 ? 'none' : '1px solid #eef4ff'}">${previewEsc(row)}</td>
              ${cols.map(() => `<td style="padding:14px;text-align:center;border-bottom:${rowIndex === rows.length - 1 ? 'none' : '1px solid #eef4ff'}">
                <span style="display:inline-block;width:16px;height:16px;border:${isRadio ? '1.8px solid #9ca3af;border-radius:50%' : '1.8px solid #9ca3af;border-radius:4px'};background:#fff"></span>
              </td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }
  if (normalizedType === 'rating' || normalizedType === 'scale') {
    const fallback = normalizedType === 'rating'
      ? ['1 - Rat khong hai long', '2 - Khong hai long', '3 - Binh thuong', '4 - Hai long', '5 - Rat hai long']
      : ['1', '2', '3', '4', '5'];
    const displayOpts = opts.length ? opts : fallback;
    return renderPreviewOptionPills(displayOpts, 'radio');
  }
  return '';
}

function openFormPreview() {
  const name = document.getElementById('new-form-name')?.value?.trim() || '(Chua dat ten)';
  const desc = document.getElementById('new-form-desc')?.value?.trim() || '';
  const cat  = document.getElementById('new-form-cat')?.value || 'Khac';
  const sel  = getAllFormQuestions();

  const body = document.getElementById('form-preview-body');
  const title = document.getElementById('form-preview-title');
  if (!body || !title) return;

  const previewOverlay = document.getElementById('form-preview-modal');
  if (previewOverlay) previewOverlay.style.zIndex = '1300';

  title.textContent = name;

  if (!sel.length) {
    body.innerHTML = `<div style="text-align:center;padding:40px 0;color:#94a3b8;font-size:14px">Ch&#432;a c&oacute; c&acirc;u h&#7887;i n&agrave;o trong form.</div>`;
    openModal('form-preview-modal');
    return;
  }

  const createdAt = new Date().toLocaleDateString('vi-VN');

  body.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;font-family:'Be Vietnam Pro','Segoe UI',sans-serif">
      <div style="background:#fff;border:1px solid #dbeafe;border-radius:30px;padding:34px 34px 28px;box-shadow:0 26px 60px rgba(15,23,42,.08)">
        <div style="margin-bottom:18px">
          <div style="font-size:22px;font-weight:800;line-height:1.2;color:#0f172a;margin-bottom:6px">${previewEsc(name)}</div>
          <div style="font-size:14px;color:#64748b">${previewEsc(cat)}${desc ? ` · ${previewEsc(desc)}` : ''}</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-bottom:14px">
          <div>
            <label style="display:block;margin-bottom:8px;font-size:13px;font-weight:700;color:#334155">H&#7885; v&agrave; t&ecirc;n</label>
            <input disabled value="" placeholder="Nh&#7853;p h&#7885; t&ecirc;n c&#7911;a b&#7841;n" style="width:100%;height:52px;padding:0 16px;border:1px solid #cfe0ff;border-radius:16px;background:#fff;color:#0f172a;font-size:14px;outline:none">
          </div>
          <div>
            <label style="display:block;margin-bottom:8px;font-size:13px;font-weight:700;color:#334155">Email</label>
            <input disabled value="" placeholder="Nh&#7853;p email c&#7911;a b&#7841;n" style="width:100%;height:52px;padding:0 16px;border:1px solid #cfe0ff;border-radius:16px;background:#fff;color:#0f172a;font-size:14px;outline:none">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:22px">
          <div>
            <label style="display:block;margin-bottom:8px;font-size:13px;font-weight:700;color:#334155">L&#7899;p</label>
            <input disabled value="" placeholder="VD: 49K01" style="width:100%;height:52px;padding:0 16px;border:1px solid #cfe0ff;border-radius:16px;background:#fff;color:#0f172a;font-size:14px;outline:none">
          </div>
          <div>
            <label style="display:block;margin-bottom:8px;font-size:13px;font-weight:700;color:#334155">Khoa</label>
            <input disabled value="" placeholder="VD: Ngo&#7841;i ng&#7919;" style="width:100%;height:52px;padding:0 16px;border:1px solid #cfe0ff;border-radius:16px;background:#fff;color:#0f172a;font-size:14px;outline:none">
          </div>
          <div>
            <label style="display:block;margin-bottom:8px;font-size:13px;font-weight:700;color:#334155">Gi&aacute;o vi&ecirc;n</label>
            <input disabled value="" placeholder="T&#7921; &#273;&#7897;ng &#273;i&#7873;n gi&aacute;o vi&ecirc;n" style="width:100%;height:52px;padding:0 16px;border:1px solid #cfe0ff;border-radius:16px;background:#fff;color:#0f172a;font-size:14px;outline:none">
          </div>
        </div>

        <div style="font-size:15px;font-weight:700;color:#33538a;margin:0 0 18px">Ng&agrave;y t&#7841;o: <span style="color:#c2410c">${previewEsc(createdAt)}</span></div>

        <div style="display:flex;flex-direction:column;gap:16px">
          ${sel.map((q, i) => `
            <div style="border:1px solid #d7e7ff;border-radius:24px;padding:20px 20px 18px;background:#fff;box-shadow:0 8px 22px rgba(148,163,184,.08)">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px">
                <div style="min-width:0;flex:1">
                  <div style="font-size:14px;font-weight:700;color:#516b9a;margin-bottom:10px">${i + 1}.</div>
                  <div style="font-size:18px;font-weight:800;line-height:1.5;color:#0f172a">${previewEsc(q.text)}</div>
                </div>
                <span style="display:inline-flex;align-items:center;padding:7px 14px;border-radius:999px;background:#eef4ff;color:#2563eb;font-size:12px;font-weight:800;white-space:nowrap">${previewQuestionChip(q.type)}</span>
              </div>
              ${renderQuestionPreview(q)}
            </div>
          `).join('')}
        </div>

        <div style="display:flex;justify-content:center;padding-top:24px">
          <button disabled style="min-width:210px;height:48px;border:none;border-radius:14px;background:linear-gradient(135deg,#22c1f1,#1d9bf0);color:#fff;font-size:15px;font-weight:800;opacity:.72;cursor:not-allowed">G&#7917;i ph&#7843;n h&#7891;i</button>
        </div>
      </div>
    </div>`;

  openModal('form-preview-modal');
}

function openFormModal() {
  selectedQuestions = new Set();
  directQuestions = [];
  document.getElementById('new-form-name').value = '';
  document.getElementById('new-form-desc').value = '';
  const dc = document.getElementById('desc-count');
  if (dc) dc.textContent = '0/100';
  document.getElementById('new-form-cat').value = '';
  document.getElementById('new-form-status').value = 'draft';
  document.getElementById('new-form-note').value = '';
  const nc = document.getElementById('note-count');
  if (nc) nc.textContent = '0/50';
  const lkEl = document.getElementById('new-form-loi-ket');
  const savedLoiKet = localStorage.getItem(NEW_FORM_LOI_KET_DRAFT_KEY) || '';
  if (lkEl) lkEl.value = savedLoiKet;
  const lkc = document.getElementById('loi-ket-count');
  if (lkc) {
    lkc.textContent = savedLoiKet.length + '/300';
    lkc.style.color = savedLoiKet.length > 250 ? 'var(--red)' : 'var(--gray-400)';
  }
  toggleApprovalNoteField();
  renderQList();
  renderDirectQList();
  openModal('create-form-modal');
}

function updateNewFormLoiKetDraft(value) {
  const text = String(value || '').slice(0, 300);
  const c = document.getElementById('loi-ket-count');
  if (c) {
    c.textContent = text.length + '/300';
    c.style.color = text.length > 250 ? 'var(--red)' : 'var(--gray-400)';
  }
  localStorage.setItem(NEW_FORM_LOI_KET_DRAFT_KEY, text);
}

function closeFormModal() {
  // Reset fullscreen nếu đang bật
  if (_createFormFullscreen) { _createFormFullscreen = false; toggleCreateFormFullscreen(); }
  document.body.style.overflow = '';
  const name = document.getElementById('new-form-name')?.value?.trim() || '';
  const desc = document.getElementById('new-form-desc')?.value?.trim() || '';
  const cat  = document.getElementById('new-form-cat')?.value || '';
  const loiKet = document.getElementById('new-form-loi-ket')?.value?.trim() || '';
  const hasQ = getAllFormQuestions().length > 0;
  // Cảnh báo nếu đã nhập dữ liệu
  if ((name || desc || cat || loiKet || hasQ) && !window._skipCloseConfirm) {
    showExitFormConfirm(name, desc, cat, hasQ);
    return;
  }
  window._skipCloseConfirm = false;
  // Nếu chỉ nhập tên/mô tả, chưa chọn danh mục và chưa thêm câu hỏi → tạo card nháp luôn
  if ((name || desc) && !cat && !hasQ) {
    const colors = ['#0ea5e9','#8b5cf6','#f97316','#ec4899','#10b981','#3b82f6','#f59e0b','#64748b'];
    const imgs = [
      'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&h=200&fit=crop',
      'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=200&fit=crop',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=200&fit=crop',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=200&fit=crop',
    ];
    const draftForm = {
      id: 'draft-' + Date.now(),
      name: name || '(Chưa đặt tên)',
      cat: 'Khác',
      status: 'draft',
      created: new Date().toLocaleDateString('vi-VN'),
      by: 'Quản lý', initials: 'A',
      img: imgs[Math.floor(Math.random() * imgs.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
      questions: [],
    };
    FORMS.unshift(draftForm);
    filtered = [...FORMS];
    renderGrid(filtered);
    showToast('Đã lưu nháp "' + draftForm.name + '" ✏️', 'default');
  }
  // Reset form fields
  document.getElementById('new-form-name').value = '';
  document.getElementById('new-form-desc').value = '';
  const dc = document.getElementById('desc-count');
  if (dc) dc.textContent = '0/100';
  document.getElementById('new-form-status').value = 'draft';
  document.getElementById('new-form-note').value = '';
  const nc = document.getElementById('note-count');
  if (nc) nc.textContent = '0/50';
  toggleApprovalNoteField();
  closeModal('create-form-modal');
}

function toggleApprovalNoteField() {
  const statusEl = document.getElementById('new-form-status');
  const noteWrap = document.getElementById('approval-note-group');
  if (!statusEl || !noteWrap) return;
  noteWrap.style.display = statusEl.value === 'pending' ? 'block' : 'none';
}

async function createApprovalRequest(formId, note) {
  const token = localStorage.getItem('token') || '';
  const approvalRes = await fetch(`${API_BASE}/approvals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({
      form_id: formId,
      do_uu_tien: 'medium',
      ghi_chu: note || null,
    }),
  });
  const approvalResult = await approvalRes.json().catch(() => ({}));
  if (!approvalRes.ok) {
    throw new Error(approvalResult.message || 'Không tạo được yêu cầu phê duyệt');
  }
  return approvalResult;
}

function cacheLocalApprovalItem({ approvalId, formId, formName, cat, note, questions }) {
  try {
    unhideApprovalForm(formId, formName);
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const existing = JSON.parse(localStorage.getItem('flic_approvals') || '[]');
    const normalizedId = String(approvalId || formId);
    const alreadyExists = existing.some(item => String(item.id) === normalizedId || Number(item.form_id) === Number(formId));
    if (alreadyExists) return;

    existing.unshift({
      id: normalizedId,
      _dbId: Number(approvalId) || Number(formId),
      form: formName,
      by: currentUser.ho_ten || currentUser.ten_dang_nhap || 'Quản lý',
      date: new Date().toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).replace(',', ''),
      status: 'pending',
      cat,
      note: note || '',
      priority: 'medium',
      form_id: Number(formId) || null,
      questions: questions || [],
    });
    localStorage.setItem('flic_approvals', JSON.stringify(existing));
  } catch (e) {
    console.warn('Không cache được yêu cầu phê duyệt:', e.message);
  }
}

async function updateFormStatusOnly(formId, status) {
  const tkn = localStorage.getItem('token') || '';
  const res = await fetch(`${API_BASE}/forms/${formId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(tkn ? { Authorization: `Bearer ${tkn}` } : {}) },
    body: JSON.stringify({ trang_thai: status }),
  });
  if (!res.ok) {
    throw new Error('Không cập nhật được trạng thái biểu mẫu');
  }
}

function forceCloseFormModal() {
  window._skipCloseConfirm = true;
  closeFormModal();
}

function requestSubmitForm() {
  const name = document.getElementById('new-form-name')?.value?.trim() || '(Chưa đặt tên)';
  const cat = document.getElementById('new-form-cat')?.value || 'Chưa chọn danh mục';
  const questionCount = getAllFormQuestions().length;
  document.getElementById('submit-form-confirm')?.remove();

  const d = document.createElement('div');
  d.id = 'submit-form-confirm';
  d.style.cssText = 'position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.42);backdrop-filter:blur(2px);padding:20px';
  d.innerHTML = `
    <div onclick="event.stopPropagation()" style="background:#fff;border-radius:20px;padding:28px 28px 20px;max-width:420px;width:min(92vw,420px);box-shadow:0 20px 60px rgba(0,0,0,0.18);animation:fadeInDown .15s ease;font-family:inherit">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="width:40px;height:40px;border-radius:10px;background:#e0f2fe;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" width="20" height="20"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </div>
        <div>
          <div style="font-size:15px;font-weight:700;color:#0f172a">Xác nhận tạo biểu mẫu?</div>
          <div style="font-size:12.5px;color:#64748b;margin-top:2px">Biểu mẫu chỉ được lưu sau khi bạn xác nhận.</div>
        </div>
      </div>
      <div style="background:#f8fafc;border-radius:10px;padding:10px 14px;margin-bottom:18px;font-size:12.5px;color:#475569">
        <div>📝 Tên: <strong>${name}</strong></div>
        <div>📚 Danh mục: <strong>${cat}</strong></div>
        <div>❓ Số câu hỏi: <strong>${questionCount}</strong></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="document.getElementById('submit-form-confirm').remove();submitForm(true)"
          style="padding:10px;background:#0ea5e9;color:#fff;border:none;border-radius:9px;font-size:13.5px;font-weight:700;cursor:pointer;transition:background .15s"
          onmouseenter="this.style.background='#0284c7'" onmouseleave="this.style.background='#0ea5e9'">
          Xác nhận & Lưu
        </button>
        <button onclick="document.getElementById('submit-form-confirm').remove()"
          style="padding:10px;background:#fff;color:#64748b;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s"
          onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='#fff'">
          Quay lại chỉnh sửa
        </button>
      </div>
    </div>`;
  document.body.appendChild(d);
  d.addEventListener('click', e => { if (e.target === d) d.remove(); });
}

function showExitFormConfirm(name, desc, cat, hasQ) {
  // Xóa dialog cũ nếu có
  document.getElementById('exit-form-confirm')?.remove();
  const d = document.createElement('div');
  d.id = 'exit-form-confirm';
  d.style.cssText = 'position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.42);backdrop-filter:blur(2px);padding:20px';
  d.innerHTML = `
    <div onclick="event.stopPropagation()" style="background:#fff;border-radius:20px;padding:28px 28px 20px;max-width:420px;width:min(92vw,420px);box-shadow:0 20px 60px rgba(0,0,0,0.18);animation:fadeInDown .15s ease;font-family:inherit">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="width:40px;height:40px;border-radius:10px;background:#fef3c7;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div>
          <div style="font-size:15px;font-weight:700;color:#0f172a">Thoát không lưu?</div>
          <div style="font-size:12.5px;color:#64748b;margin-top:2px">Dữ liệu bạn đã nhập sẽ bị mất.</div>
        </div>
      </div>
      <div style="background:#f8fafc;border-radius:10px;padding:10px 14px;margin-bottom:18px;font-size:12.5px;color:#475569">
        ${name ? `<div>📝 Tên: <strong>${name}</strong></div>` : ''}
        ${hasQ ? `<div>❓ Đã thêm câu hỏi</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="document.getElementById('exit-form-confirm').remove();submitForm(true)"
          style="padding:10px;background:#0ea5e9;color:#fff;border:none;border-radius:9px;font-size:13.5px;font-weight:700;cursor:pointer;transition:background .15s"
          onmouseenter="this.style.background='#0284c7'" onmouseleave="this.style.background='#0ea5e9'">
          💾 Lưu & Tạo biểu mẫu
        </button>
        <button onclick="document.getElementById('exit-form-confirm').remove();forceCloseFormModal()"
          style="padding:10px;background:#fff;color:#ef4444;border:1.5px solid #fecaca;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s"
          onmouseenter="this.style.background='#fef2f2'" onmouseleave="this.style.background='#fff'">
          Thoát không lưu
        </button>
        <button onclick="document.getElementById('exit-form-confirm').remove()"
          style="padding:9px;background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;font-weight:500;cursor:pointer">
          Tiếp tục chỉnh sửa
        </button>
      </div>
    </div>`;
  document.body.appendChild(d);
  d.addEventListener('click', e => { if(e.target===d) d.remove(); });
}

// ─── RENDER QUESTION LIST ───
function renderQList() {
  const wrap = document.getElementById('q-list-wrap');
  if (!wrap) return;

  const search  = (document.getElementById('lib-search')?.value || '').toLowerCase();
  const cat      = document.getElementById('lib-cat-filter')?.value || 'Ngoại ngữ';
  const filtered = libraryQuestions.filter(q => {
    const matchCat    = (q.category || '') === cat;
    const matchSearch = !search || q.text.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  if (!filtered.length) {
    wrap.innerHTML = `<div style="padding:20px;text-align:center;color:var(--gray-400);font-size:13px">${search ? 'Không tìm thấy câu hỏi phù hợp' : 'Thư viện trống'}</div>`;
    document.getElementById('q-total-count').textContent = libraryQuestions.length;
    return;
  }

  const typeLabel = t => ({choice:'Trắc nghiệm',checkbox:'Hộp kiểm',dropdown:'Menu thả xuống',paragraph:'Đoạn văn',short_text:'Đoạn văn',long_text:'Đoạn văn',text:'Đoạn văn',rating:'Xếp hạng',scale:'Tuyến tính',date:'Ngày',time:'Giờ',grid_radio:'Lưới trắc nghiệm',grid_checkbox:'Lưới hộp kiểm'}[t]||t);
  const typeColor = t => ({choice:'#eff6ff;color:#1d4ed8',checkbox:'#f0fdf4;color:#166534',dropdown:'#fef9c3;color:#854d0e',paragraph:'#eef2ff;color:#4338ca',short_text:'#eef2ff;color:#4338ca',long_text:'#eef2ff;color:#4338ca',text:'#eef2ff;color:#4338ca',rating:'#fff7ed;color:#c2410c',scale:'#fdf4ff;color:#7e22ce',date:'#ecfdf5;color:#065f46',time:'#ecfdf5;color:#065f46',grid_radio:'#fdf4ff;color:#6b21a8',grid_checkbox:'#f0fdf4;color:#065f46'}[t]||'#f1f5f9;color:#374151');

  let html = '';
  filtered.forEach(q => {
    const sid = String(q.id);
    const checked = selectedQuestions.has(sid);
    const tl = typeLabel(q.type);
    const tc = typeColor(q.type);
    const hasOpts = q.opts && q.opts.length > 0;

    html += `
    <div id="qrow-${sid}" style="border-bottom:1px solid #f1f5f9;${checked?'background:#f0f9ff;':''}transition:background .12s">
      <!-- Main row -->
      <div style="display:flex;align-items:center;gap:0;padding:10px 14px;cursor:pointer" onclick="toggleQ('${sid}')">
        <input type="checkbox" id="qcb-${sid}" ${checked?'checked':''} onclick="event.stopPropagation();toggleQ('${sid}')"
          style="width:16px;height:16px;accent-color:#7c3aed;flex-shrink:0;cursor:pointer;margin-right:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:${checked?'600':'500'};color:${checked?'#1e293b':'#374151'};line-height:1.4;margin-bottom:3px">${q.text||'<em style=\"color:#94a3b8\">Câu hỏi chưa có nội dung</em>'}</div>
          <span style="font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:10px;background:${tc}">${tl}</span>
          ${hasOpts && !checked ? `<span style="font-size:10.5px;color:var(--gray-400);margin-left:6px">${q.opts.length} lựa chọn</span>` : ''}
        </div>
          ${checked ? `<svg viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2.5" width="16" height="16" style="flex-shrink:0;margin-left:6px"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      </div>
    </div>`;
  });

  wrap.innerHTML = html;
  updateQCount();
  document.getElementById('q-total-count').textContent = libraryQuestions.length;
}

// ─── TOGGLE QUESTION SELECT ───
function toggleQ(id) {
  const sid = String(id);
  if (selectedQuestions.has(sid)) {
    selectedQuestions.delete(sid);
  } else {
    selectedQuestions.add(sid);
  }
  renderQList();
  renderDirectQList();
}

function updateQCount() {
  const n = getAllFormQuestions ? getAllFormQuestions().length : selectedQuestions.size;
  const el1 = document.getElementById('q-sel-count');
  const el2 = document.getElementById('q-bottom-count');
  if(el1) el1.textContent = n;
  if(el2) el2.textContent = n;
}
function selectAllQ() {
  // Chỉ chọn câu hỏi đang hiển thị (theo danh mục + tìm kiếm hiện tại)
  const search = (document.getElementById('lib-search')?.value || '').toLowerCase();
  const cat    = document.getElementById('lib-cat-filter')?.value || 'Ngoại ngữ';
  const visible = libraryQuestions.filter(q => {
    const matchCat    = (q.category || '') === cat;
    const matchSearch = !search || q.text.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });
  visible.forEach(q => selectedQuestions.add(String(q.id)));
  renderQList();
  renderDirectQList();
}
function deselectAllQ() {
  selectedQuestions.clear();
  renderQList();
  renderDirectQList();
}

// ─── DIRECT QUESTION LIST (card trực tiếp) ───
let directQuestions = []; // [{id, text, type, opts, required}]

// Dùng chung TYPE_LABEL_MAP, NEEDS_OPTS, NEEDS_GRID đã khai báo ở trên
const DQ_NEEDS_OPTS = NEEDS_OPTS;
const DQ_NEEDS_GRID = NEEDS_GRID;
const DQ_TYPE_LABELS = TYPE_LABEL_MAP;

// ─── ICON & COLOR CHO TỪNG LOẠI CÂU HỎI ───
const DQ_TYPE_ICON = {
  choice:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg>`,
  checkbox:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="7 12 10 15 17 9"/></svg>`,
  dropdown:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="2" y="6" width="20" height="12" rx="2"/><polyline points="8 11 12 15 16 11"/></svg>`,
  rating:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="5" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="2" fill="currentColor" stroke="none"/></svg>`,
  star_rating:  `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="13" height="13"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>`,
  grid_radio:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  grid_checkbox:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><polyline points="5 7 6.5 8.5 9 6" stroke-width="1.5"/><polyline points="16 7 17.5 8.5 20 6" stroke-width="1.5"/></svg>`,
};
const DQ_TYPE_COLOR = {
  choice:'#1d4ed8',checkbox:'#166534',dropdown:'#854d0e',rating:'#b45309',grid_radio:'#6b21a8',grid_checkbox:'#065f46'
};

function sameQuestionId(a, b) {
  return String(a) === String(b);
}

// ─── DRAG & DROP: câu hỏi ───────────────────────────────────────────
let _dqDragId = null;

function dqDragStart(event, id) {
  _dqDragId = id;
  event.dataTransfer.effectAllowed = 'move';
  // Làm mờ card đang kéo
  setTimeout(() => {
    const el = document.getElementById('dqcard-' + id);
    if (el) { el.style.opacity = '0.4'; el.style.boxShadow = '0 0 0 2px #0ea5e9'; }
  }, 0);
}

function dqDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  // Highlight card đang hover
  const card = event.currentTarget;
  if (card) card.style.borderColor = '#7dd3fc';
}

function dqDrop(event, targetId) {
  event.preventDefault();
  if (!_dqDragId || _dqDragId === targetId) return;

  // Tìm trong directQuestions
  const fromIdxD = directQuestions.findIndex(q => q.id === _dqDragId);
  const toIdxD   = directQuestions.findIndex(q => q.id === targetId);
  if (fromIdxD !== -1 && toIdxD !== -1) {
    const [moved] = directQuestions.splice(fromIdxD, 1);
    directQuestions.splice(toIdxD, 0, moved);
    renderDirectQList();
    return;
  }
  renderDirectQList();
}

function dqDragEnd(event) {
  // Reset tất cả card về style bình thường
  document.querySelectorAll('#direct-q-list [id^="dqcard-"]').forEach(el => {
    el.style.opacity = '';
    el.style.boxShadow = '';
    el.style.borderColor = '';
  });
  _dqDragId = null;
}

// ─── DRAG & DROP: đáp án (opts) ────────────────────────────────────
let _dqOptDrag = null; // { qId, fromIdx }

function dqOptDragStart(event, qId, fromIdx) {
  _dqOptDrag = { qId, fromIdx };
  event.dataTransfer.effectAllowed = 'move';
  setTimeout(() => { event.target.style.opacity = '0.4'; }, 0);
}

function dqOptDragOver(event, qId, toIdx) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function dqOptDrop(event, qId, toIdx) {
  event.preventDefault();
  if (!_dqOptDrag || _dqOptDrag.qId !== qId || _dqOptDrag.fromIdx === toIdx) return;
  const q = _dqFindQ(qId);
  if (!q || !q.opts) return;
  const [moved] = q.opts.splice(_dqOptDrag.fromIdx, 1);
  q.opts.splice(toIdx, 0, moved);
  _dqOptDrag = null;
  renderDirectQList();
}

function dqOptDragEnd() {
  _dqOptDrag = null;
  // Re-render để reset opacity
  renderDirectQList();
}
// ───────────────────────────────────────────────────────────────────

function dqDuplicate(id) {
  const q = _dqFindQ(id);
  if (!q) return;
  const clone = JSON.parse(JSON.stringify(q));
  clone.id = 'dq-' + Date.now();
  // Chèn ngay sau câu hỏi gốc
  const allQ = getAllFormQuestions();
  const idx = allQ.findIndex(x => sameQuestionId(x.id, id));
  // Nếu là câu hỏi từ thư viện thì push vào directQuestions sau
  const dqIdx = directQuestions.findIndex(x => sameQuestionId(x.id, id));
  if (dqIdx >= 0) {
    directQuestions.splice(dqIdx + 1, 0, clone);
  } else {
    // câu từ thư viện: thêm vào directQuestions ở vị trí đầu tương ứng
    directQuestions.unshift(clone);
  }
  renderDirectQList();
  // Scroll & focus
  setTimeout(() => {
    const newCard = document.getElementById('dqcard-' + clone.id);
    if (newCard) { newCard.scrollIntoView({ behavior:'smooth', block:'nearest' }); newCard.querySelector('input[type=text]')?.focus(); }
  }, 50);
}

function dqInsertAfter(id) {
  const newQ = { id: 'dq-' + Date.now(), text: '', type: 'choice', opts: [''], required: false };
  const dqIdx = directQuestions.findIndex(x => sameQuestionId(x.id, id));
  if (dqIdx >= 0) {
    directQuestions.splice(dqIdx + 1, 0, newQ);
  } else {
    directQuestions.unshift(newQ);
  }
  renderDirectQList();
  setTimeout(() => {
    const newCard = document.getElementById('dqcard-' + newQ.id);
    if (newCard) { newCard.scrollIntoView({ behavior:'smooth', block:'nearest' }); newCard.querySelector('input[type=text]')?.focus(); }
  }, 50);
}

function renderDirectQList() {
  const list = document.getElementById('direct-q-list');
  const empty = document.getElementById('direct-q-empty');
  // Merge: library selected + directQuestions kể cả section
  const allQ = getAllFormItems ? getAllFormItems() : getAllFormQuestions();
  if (!list) return;

  const n = allQ.length;
  const el1 = document.getElementById('q-sel-count');
  const el2 = document.getElementById('q-bottom-count');
  if (el1) el1.textContent = n;
  if (el2) el2.textContent = n;

  if (!n) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    let addWrapper = document.getElementById('direct-q-add-btn');
    if (!addWrapper) {
      addWrapper = document.createElement('div');
      addWrapper.id = 'direct-q-add-btn';
      list.parentNode.insertBefore(addWrapper, list.nextSibling);
    }
    addWrapper.innerHTML = `<div style="display:flex;justify-content:flex-start;padding:6px 0 2px">
      <button onclick="addDirectQ()"
        style="display:flex;align-items:center;gap:7px;padding:7px 18px;border:1.5px dashed #7dd3fc;border-radius:10px;background:transparent;color:#0284c7;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s"
        onmouseenter="this.style.background='#e0f2fe';this.style.borderColor='#0ea5e9'" onmouseleave="this.style.background='transparent';this.style.borderColor='#7dd3fc'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Thêm câu hỏi
      </button>
    </div>`;
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = allQ.map((q, qi) => {
    // Render section card
    if (q._isSection) {
      return `
    <div id="dqcard-${q.id}" style="border:2px dashed #fbbf24;border-radius:12px;background:#fffbeb;padding:0;display:flex">
      <div style="flex:1;min-width:0;padding:12px 14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" width="14" height="14"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          <span style="font-size:10.5px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.5px">Phần mới</span>
        </div>
        <input type="text" value="${(q.title||'').replace(/"/g,'&quot;')}" placeholder="Tiêu đề phần..."
          style="width:100%;padding:6px 10px;border:1.5px solid #fde68a;border-radius:8px;font-size:14px;font-weight:700;font-family:inherit;outline:none;background:#fff;color:#92400e;transition:border .15s;box-sizing:border-box"
          onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#fde68a'"
          oninput="(function(){var q=directQuestions.find(x=>x.id==='${q.id}');if(q)q.title=this.value;}).call(this)">
        <input type="text" value="${(q.desc||'').replace(/"/g,'&quot;')}" placeholder="Mô tả phần (tùy chọn)..."
          style="width:100%;padding:5px 10px;border:1px solid #fde68a;border-radius:7px;font-size:12.5px;font-family:inherit;outline:none;background:#fff;color:#78350f;margin-top:6px;transition:border .15s;box-sizing:border-box"
          onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#fde68a'"
          oninput="(function(){var q=directQuestions.find(x=>x.id==='${q.id}');if(q)q.desc=this.value;}).call(this)">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 6px;border-left:1px solid #fde68a;min-width:40px">
        <button onclick="dqAddSection('${q.id}')" title="Thêm phần bên dưới"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#fbbf24;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#f59e0b';this.style.background='#fef3c7'"
          onmouseleave="this.style.color='#fbbf24';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <button onclick="dqInsertAfter('${q.id}')" title="Thêm câu hỏi bên dưới"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#0284c7';this.style.background='#e0f9ff'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button onclick="(function(){directQuestions=directQuestions.filter(x=>x.id!=='${q.id}');renderDirectQList();})()" title="Xóa phần"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#ef4444';this.style.background='#fef2f2'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
    }
    const normalizedType = normalizeQuestionType(q.type);
    const needsOpts = DQ_NEEDS_OPTS.includes(normalizedType);
    const needsGrid = DQ_NEEDS_GRID.includes(normalizedType);
    const opts = q.opts || [];
    const rows = q.rows || [];
    const cols = q.cols || [];
    const typeIcon = DQ_TYPE_ICON[q.type] || DQ_TYPE_ICON[normalizedType] || '';
    const typeColor = DQ_TYPE_COLOR[q.type] || '#374151';
    const isCollapsed = !!q._collapsed;
    const summaryMeta = [];
    if (needsOpts && normalizedType !== 'rating' && normalizedType !== 'scale') {
      const filledOpts = opts.filter(o => String(o || '').trim()).length;
      if (filledOpts) summaryMeta.push(`${filledOpts} lựa chọn`);
    }
    if (needsGrid) {
      const filledRows = rows.filter(r => String(r || '').trim()).length;
      const filledCols = cols.filter(c => String(c || '').trim()).length;
      if (filledRows || filledCols) summaryMeta.push(`${filledRows} hàng • ${filledCols} cột`);
    }
    if (isCollapsed) {
      return `
        <div id="dqcard-${q.id}" onclick="dqExpandCard('${q.id}')" title="Bấm để mở câu hỏi" style="border:1.5px solid #dbeafe;border-left:5px solid #0ea5e9;border-radius:14px;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);box-shadow:0 10px 24px rgba(15,23,42,.05);padding:14px 16px;cursor:pointer">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">
            <div style="display:flex;gap:10px;min-width:0;flex:1">
              <div style="width:28px;height:28px;border-radius:50%;background:#eff6ff;color:#2563eb;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${qi+1}</div>
              <div style="min-width:0;flex:1">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                  <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700">${typeIcon}${getTypeOptionLabel(normalizedType)}</span>
                  <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:#ecfdf3;color:#15803d;font-size:11px;font-weight:700">Đã lưu</span>
                  ${q.required ? `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:#fff7ed;color:#c2410c;font-size:11px;font-weight:700">Bắt buộc</span>` : ''}
                </div>
                <div style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.45">${q.text || 'Câu hỏi chưa có nội dung'}</div>
                ${summaryMeta.length ? `<div style="font-size:12px;color:#64748b;margin-top:6px">${summaryMeta.join(' • ')}</div>` : ''}
              </div>
            </div>
          </div>
        </div>`;
    }
    return `
        <div id="dqcard-${q.id}" draggable="true"
          ondragstart="dqDragStart(event,'${q.id}')"
          ondragover="dqDragOver(event)"
          ondrop="dqDrop(event,'${q.id}')"
          ondragend="dqDragEnd(event)"
          style="border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.04);display:flex;transition:box-shadow .15s,opacity .15s">
      <!-- Drag handle 6 chấm -->
      <div class="dq-drag-handle" title="Kéo để đổi vị trí"
        style="display:flex;align-items:center;justify-content:center;width:20px;flex-shrink:0;cursor:grab;color:#cbd5e1;border-right:1px solid #f1f5f9;padding:0 2px;border-radius:12px 0 0 12px;transition:color .15s"
        onmouseenter="this.style.color='#94a3b8';this.style.background='#f8fafc'"
        onmouseleave="this.style.color='#cbd5e1';this.style.background=''">
        <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor">
          <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
          <circle cx="3" cy="6" r="1.5"/><circle cx="7" cy="6" r="1.5"/>
          <circle cx="3" cy="10" r="1.5"/><circle cx="7" cy="10" r="1.5"/>
          <circle cx="3" cy="14" r="1.5"/><circle cx="7" cy="14" r="1.5"/>
        </svg>
      </div>
      <!-- Nội dung chính -->
      <div style="flex:1;min-width:0;padding:12px 14px">
      <!-- Row: số + input câu hỏi + dropdown loại -->
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:22px;height:22px;border-radius:50%;background:#eff6ff;color:#3b82f6;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${qi+1}</div>
        <input type="text" value="${q.text.replace(/"/g,'&quot;')}" placeholder="Nhập nội dung câu hỏi..."
          style="flex:1;padding:7px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fafbff;transition:border .15s;min-width:0"
          onfocus="this.style.borderColor='#0ea5e9'" onblur="this.style.borderColor='#e2e8f0'"
          oninput="dqSetText('${q.id}',this.value)"
          class="dq-placeholder-gray">
        <select onchange="dqSetType('${q.id}',this.value)"
          style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12.5px;font-family:inherit;background:#fafbff;color:#374151;outline:none;cursor:pointer;transition:border .15s;flex-shrink:0"
          onfocus="this.style.borderColor='#0ea5e9'" onblur="this.style.borderColor='#e2e8f0'">
          ${Object.keys(DQ_TYPE_LABELS).map(v=>`<option value="${v}" ${q.type===v?'selected':''}>${getTypeOptionLabel(v)}</option>`).join('')}
        </select>
      </div>

      ${q.image ? `
      <div style="margin-top:8px;padding-left:30px;position:relative">
        <img src="${q.image}" style="max-width:100%;max-height:160px;border-radius:8px;object-fit:cover;border:1px solid #e2e8f0">
        <button onclick="(function(){var q=_dqFindQ('${q.id}');if(q){delete q.image;renderDirectQList();}})()" title="Xóa hình"
          style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;cursor:pointer;color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;line-height:1">×</button>
      </div>` : ''}

      ${q.video ? `
      <div style="margin-top:8px;padding-left:30px;position:relative">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f5f3ff;border-radius:8px;border:1px solid #e9d5ff">
          <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" width="16" height="16"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          <a href="${q.video}" target="_blank" style="font-size:12px;color:#7c3aed;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${q.video}</a>
          <button onclick="(function(){var q=_dqFindQ('${q.id}');if(q){delete q.video;renderDirectQList();}})()" title="Xóa video"
            style="background:none;border:none;cursor:pointer;color:#c4b5fd;font-size:16px;line-height:1;flex-shrink:0">×</button>
        </div>
      </div>` : ''}

      ${needsOpts ? `
      <!-- Lựa chọn -->
      <div style="padding-left:30px;margin-top:10px">

        ${normalizedType==='rating' ? `
        <!-- Xếp hạng sao cố định 5 sao -->
        <div style="padding:12px 14px;border:1px solid #fde68a;border-radius:12px;background:linear-gradient(180deg,#fffdf7 0%,#fff7ed 100%)">
          <div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">★ Xếp hạng sao (1–5)</div>
          <div style="display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap">
            ${Array.from({length:5},(_,i)=>`
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                <span style="font-size:12px;font-weight:600;color:#92400e">${i+1}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" width="28" height="28"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>
              </div>
            `).join('')}
          </div>
        </div>
        ` : normalizedType==='scale' ? `
        <!-- Tuyến tính 1-5 -->
        <div style="padding:12px 14px;border:1px solid #c7d2fe;border-radius:12px;background:linear-gradient(180deg,#f8f9ff 0%,#eef2ff 100%)">
          <div style="font-size:11px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">⟷ Phạm vi tuyến tính (1–5)</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            ${[1,2,3,4,5].map(n=>`
              <div style="width:36px;height:36px;border-radius:50%;border:2px solid #a5b4fc;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#4338ca;background:#fff">${n}</div>
            `).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1">
              <div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:4px">Nhãn đầu (tuỳ chọn)</div>
              <input type="text" value="${(opts[0]||'').replace(/"/g,'&quot;')}" placeholder="vd: Không hài lòng"
                style="width:100%;padding:6px 10px;border:1px solid #c7d2fe;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s"
                onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#c7d2fe'"
                oninput="dqSetOpt('${q.id}',0,this.value)">
            </div>
            <div style="font-size:18px;color:#a5b4fc">→</div>
            <div style="flex:1">
              <div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:4px">Nhãn cuối (tuỳ chọn)</div>
              <input type="text" value="${(opts[1]||'').replace(/"/g,'&quot;')}" placeholder="vd: Rất hài lòng"
                style="width:100%;padding:6px 10px;border:1px solid #c7d2fe;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s"
                onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#c7d2fe'"
                oninput="dqSetOpt('${q.id}',1,this.value)">
            </div>
          </div>
        </div>
        ` : `
        <!-- choice / checkbox / dropdown -->
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Các lựa chọn</div>
        <div id="dq-opts-${q.id}">
          ${opts.map((o,oi) => {
            const optIcon = normalizedType==='checkbox'
              ? `<span style="width:15px;height:15px;border-radius:3px;border:2px solid #94a3b8;flex-shrink:0;display:inline-block;background:#fff"></span>`
              : normalizedType==='dropdown'
              ? `<span style="font-size:11px;color:#94a3b8;font-weight:700;min-width:18px;text-align:center">${oi+1}</span>`
              : `<span style="width:15px;height:15px;border-radius:50%;border:2px solid #94a3b8;flex-shrink:0;display:inline-block;background:#fff"></span>`;
            const dragHandle = '<span style="cursor:grab;color:#d1d5db;display:flex;align-items:center;flex-shrink:0;padding:0 2px" title="Kéo để đổi vị trí"><svg viewBox="0 0 8 12" width="8" height="12" fill="currentColor"><circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/><circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/><circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/></svg></span>';
            const removeBtn = opts.length > 1 ? `<button onclick="dqRemoveOpt('${q.id}',${oi})" style="width:20px;height:20px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;transition:all .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>` : '';
            return `<div draggable="true" ondragstart="dqOptDragStart(event,'${q.id}',${oi})" ondragover="dqOptDragOver(event,'${q.id}',${oi})" ondrop="dqOptDrop(event,'${q.id}',${oi})" ondragend="dqOptDragEnd()" style="display:flex;align-items:center;gap:6px;margin-bottom:6px;transition:opacity .15s">${dragHandle}${optIcon}<input type="text" value="${o.replace(/"/g,'&quot;')}" placeholder="Lựa chọn ${oi+1}" style="flex:1;padding:6px 10px;border:1px solid #e2e8f0;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s" onfocus="this.style.borderColor='#0ea5e9'" onblur="this.style.borderColor='#e2e8f0'" oninput="dqSetOpt('${q.id}',${oi},this.value)">${removeBtn}</div>`;
          }).join('')}
        </div>
        <button onclick="dqAddOpt('${q.id}')"
          style="padding:5px 14px;background:transparent;border:1.5px dashed #7dd3fc;border-radius:7px;cursor:pointer;color:#0284c7;font-size:12px;font-weight:600;transition:all .15s;margin-top:2px"
          onmouseenter="this.style.background='#e0f2fe';this.style.borderColor='#0ea5e9'"
          onmouseleave="this.style.background='transparent';this.style.borderColor='#7dd3fc'">+ Thêm lựa chọn</button>
        `}

      </div>` : ''}

      ${!needsOpts && !needsGrid ? renderTextAnswerBuilder(normalizedType) : ''}

      ${needsGrid ? `
      <!-- Lưới: hàng + cột -->
      <div style="padding-left:30px;margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <!-- Hàng -->
        <div>
          <div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">📋 Hàng (tiêu đề)</div>
          <div id="dq-rows-${q.id}">
            ${rows.map((r,ri)=>`
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
              <span style="width:14px;height:14px;border-radius:${normalizedType==='grid_radio'?'50%':'3px'};border:1.5px solid #c4b5fd;flex-shrink:0;display:inline-block;background:#fff"></span>
              <input type="text" value="${r.replace(/"/g,'&quot;')}" placeholder="Hàng ${ri+1}"
                style="flex:1;padding:5px 9px;border:1px solid #e2e8f0;border-radius:7px;font-size:12px;background:#fff;outline:none;transition:border .15s"
                onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e2e8f0'"
                oninput="dqSetRow('${q.id}',${ri},this.value)">
              ${rows.length>1?`<button onclick="dqRemoveRow('${q.id}',${ri})"
                style="width:18px;height:18px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;transition:color .15s"
                onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>`:''}
            </div>`).join('')}
          </div>
          <button onclick="dqAddRow('${q.id}')"
            style="padding:4px 10px;background:transparent;border:1.5px dashed #c4b5fd;border-radius:7px;cursor:pointer;color:#7c3aed;font-size:11.5px;font-weight:600;transition:all .15s;margin-top:2px"
            onmouseenter="this.style.background='#f5f3ff'" onmouseleave="this.style.background='transparent'">+ Thêm hàng</button>
        </div>
        <!-- Cột -->
        <div>
          <div style="font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">🔷 Cột (lựa chọn)</div>
          <div id="dq-cols-${q.id}">
            ${cols.map((c,ci)=>`
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
              <span style="width:14px;height:14px;border-radius:${normalizedType==='grid_radio'?'50%':'3px'};border:1.5px solid #7dd3fc;flex-shrink:0;display:inline-block;background:#fff"></span>
              <input type="text" value="${c.replace(/"/g,'&quot;')}" placeholder="Cột ${ci+1}"
                style="flex:1;padding:5px 9px;border:1px solid #e2e8f0;border-radius:7px;font-size:12px;background:#fff;outline:none;transition:border .15s"
                onfocus="this.style.borderColor='#0ea5e9'" onblur="this.style.borderColor='#e2e8f0'"
                oninput="dqSetCol('${q.id}',${ci},this.value)">
              ${cols.length>1?`<button onclick="dqRemoveCol('${q.id}',${ci})"
                style="width:18px;height:18px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;transition:color .15s"
                onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>`:''}
            </div>`).join('')}
          </div>
          <button onclick="dqAddCol('${q.id}')"
            style="padding:4px 10px;background:transparent;border:1.5px dashed #7dd3fc;border-radius:7px;cursor:pointer;color:#0284c7;font-size:11.5px;font-weight:600;transition:all .15s;margin-top:2px"
            onmouseenter="this.style.background='#e0f2fe'" onmouseleave="this.style.background='transparent'">+ Thêm cột</button>
        </div>
      </div>` : ''}

      <!-- Bottom bar: bắt buộc + hành động -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9">
        <!-- Toggle bắt buộc -->
        <label style="display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none">
          <div style="position:relative;width:34px;height:18px">
            <input type="checkbox" ${q.required?'checked':''} onchange="dqSetRequired('${q.id}',this.checked)"
              style="opacity:0;width:0;height:0;position:absolute">
            <span style="position:absolute;inset:0;background:${q.required?'#0ea5e9':'#cbd5e1'};border-radius:9px;transition:background .2s;cursor:pointer"></span>
            <span style="position:absolute;top:3px;left:${q.required?'18px':'3px'};width:12px;height:12px;background:#fff;border-radius:50%;transition:left .2s;pointer-events:none"></span>
          </div>
          <span style="font-size:12px;font-weight:600;color:${q.required?'#0ea5e9':'#94a3b8'}">Bắt buộc</span>
        </label>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <button onclick="dqSaveToLibrary('${q.id}', this)" title="Lưu vào thư viện"
            style="padding:6px 12px;border:1px solid #bbf7d0;border-radius:8px;background:#fff;color:#059669;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s"
            onmouseenter="this.style.background='#f0fdf4';this.style.borderColor='#6ee7b7'" onmouseleave="this.style.background='#fff';this.style.borderColor='#bbf7d0'">Lưu vào thư viện</button>
          <button onclick="dqRemove('${q.id}')" title="Xóa câu hỏi"
            style="padding:6px 12px;border:1px solid #fecaca;border-radius:8px;background:#fff;color:#dc2626;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s"
            onmouseenter="this.style.background='#fef2f2';this.style.borderColor='#f87171'" onmouseleave="this.style.background='#fff';this.style.borderColor='#fecaca'">Xóa</button>
          <button onclick="dqSaveCard('${q.id}')" title="Lưu câu hỏi"
            style="padding:6px 14px;border:1px solid #0ea5e9;border-radius:8px;background:#0ea5e9;color:#fff;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s"
            onmouseenter="this.style.background='#0284c7';this.style.borderColor='#0284c7'" onmouseleave="this.style.background='#0ea5e9';this.style.borderColor='#0ea5e9'">Lưu câu hỏi</button>
        </div>
      </div>
      </div><!-- end main content -->

      <!-- Sidebar dọc bên phải -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 6px;border-left:1px solid #f1f5f9;min-width:40px">
        <!-- Thêm hình ảnh -->
        <button onclick="dqAddImage('${q.id}')" title="Thêm hình ảnh"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#0ea5e9';this.style.background='#e0f2fe'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
        <!-- Thêm video -->
        <button onclick="dqAddVideo('${q.id}')" title="Thêm video"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#8b5cf6';this.style.background='#f5f3ff'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="2" y="2" width="20" height="20" rx="5"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
        </button>
        <!-- Thêm phần (section) -->
        <button onclick="dqAddSection('${q.id}')" title="Thêm phần bên dưới"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#f59e0b';this.style.background='#fef3c7'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="4" width="18" height="7" rx="1"/><rect x="3" y="13" width="18" height="7" rx="1"/></svg>
        </button>
        <div style="width:24px;height:1px;background:#f1f5f9;margin:2px 0"></div>
        <!-- Sao chép -->
        <button onclick="dqDuplicate('${q.id}')" title="Sao chép câu hỏi"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#7c3aed';this.style.background='#f5f3ff'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <!-- Xóa -->
        <button onclick="dqRemove('${q.id}')" title="Xóa câu hỏi"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#ef4444';this.style.background='#fef2f2'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  // Nút "+ Thêm câu hỏi" cố định ở góc trái phía dưới list
  let addWrapper = document.getElementById('direct-q-add-btn');
  if (!addWrapper) {
    addWrapper = document.createElement('div');
    addWrapper.id = 'direct-q-add-btn';
    list.parentNode.insertBefore(addWrapper, list.nextSibling);
  }
  addWrapper.innerHTML = `<div style="display:flex;justify-content:flex-start;padding:6px 0 2px">
    <button onclick="addDirectQ()"
      style="display:flex;align-items:center;gap:7px;padding:7px 18px;border:1.5px dashed #7dd3fc;border-radius:10px;background:transparent;color:#0284c7;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s"
      onmouseenter="this.style.background='#e0f2fe';this.style.borderColor='#0ea5e9'" onmouseleave="this.style.background='transparent';this.style.borderColor='#7dd3fc'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Thêm câu hỏi
    </button>
  </div>`;
}

function getAllFormQuestions() {
  // Câu hỏi từ thư viện đã chọn
  const libSel = libraryQuestions.filter(q => selectedQuestions.has(String(q.id)));
  // Câu hỏi mới tạo trực tiếp (chưa vào thư viện), loại bỏ section
  return [...libSel, ...directQuestions.filter(q => !q._isSection)];
}

function getAllFormItems() {
  // Toàn bộ items kể cả section (dùng cho render)
  const libSel = libraryQuestions.filter(q => selectedQuestions.has(String(q.id)));
  return [...libSel, ...directQuestions];
}

function addDirectQ() {
  const newQ = { id: 'dq-' + Date.now(), text: '', type: 'choice', opts: [''], required: false };
  directQuestions.push(newQ);
  renderDirectQList();
  // Scroll đến card vừa thêm
  setTimeout(() => {
    const list = document.getElementById('direct-q-list');
    if (list && list.lastElementChild) {
      list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      // Focus vào input
      list.lastElementChild.querySelector('input[type=text]')?.focus();
    }
  }, 50);
}

function showLibrarySavedNotice(isOffline = false) {
  const msg = isOffline
    ? '\u0110\u00e3 l\u01b0u v\u00e0o th\u01b0 vi\u1ec7n (offline)'
    : '\u0110\u00e3 l\u01b0u v\u00e0o th\u01b0 vi\u1ec7n';
  if (typeof showToast === 'function') showToast(msg, 'success');
  else alert(msg);
}

function markLibrarySavedButton(btn) {
  if (!btn) return;
  btn.textContent = '\u0110\u00e3 l\u01b0u';
  btn.disabled = true;
  btn.style.background = '#ecfdf5';
  btn.style.borderColor = '#34d399';
  btn.style.color = '#047857';
  btn.style.cursor = 'default';
}

async function dqSaveToLibrary(id, btn) {
  const q = _dqFindQ(id);
  if (!q) return;
  if (!q.text?.trim()) { showToast('Câu hỏi chưa có nội dung!', 'error'); return; }

  // Lấy danh mục từ form đang tạo
  const cat = document.getElementById('new-form-cat')?.value || 'Ngoại ngữ';

  // Kiểm tra đã có trong thư viện chưa (theo text)
  const already = libraryQuestions.find(lq => lq.text?.trim() === q.text.trim());
  if (already) { showToast('Câu hỏi này đã có trong thư viện!', 'warning'); return; }

  // Gọi API lưu vào thư viện
  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        text: q.text.trim(),
        type: q.type,
        bo_mon: cat,
        opts: q.opts || [],
        ...(q.rows?.length ? { rows: q.rows } : {}),
        ...(q.cols?.length ? { cols: q.cols } : {}),
      }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      // Thêm vào cache local
      const newQ = { id: String(data.id || ('lib-' + Date.now())), text: q.text.trim(), type: q.type, category: cat, bo_mon: cat, opts: q.opts || [] };
      libraryQuestions.push(newQ);
      localStorage.setItem('flic_lib_flat', JSON.stringify(libraryQuestions));
      const countEl = document.getElementById('q-total-count');
      if (countEl) countEl.textContent = libraryQuestions.length;
      showLibrarySavedNotice(false);
      markLibrarySavedButton(btn);
      // Reload thư viện từ API để đồng bộ
      fetchLibraryFromAPI().catch(() => {});
      return;
    }
  } catch(e) {}

  // Fallback: lưu local nếu API lỗi
  const newQ = { id: 'lib-' + Date.now(), text: q.text.trim(), type: q.type, category: cat, bo_mon: cat, opts: q.opts || [] };
  libraryQuestions.push(newQ);
  localStorage.setItem('flic_lib_flat', JSON.stringify(libraryQuestions));
  const countEl = document.getElementById('q-total-count');
  if (countEl) countEl.textContent = libraryQuestions.length;
  showLibrarySavedNotice(true);
  markLibrarySavedButton(btn);
}


function dqAddSection(afterId) {
  const section = { id: 'sec-' + Date.now(), _isSection: true, title: '', desc: '' };
  const dqIdx = directQuestions.findIndex(x => sameQuestionId(x.id, afterId));
  if (dqIdx >= 0) {
    directQuestions.splice(dqIdx + 1, 0, section);
  } else {
    directQuestions.push(section);
  }
  renderDirectQList();
  setTimeout(() => {
    const el = document.getElementById('dqcard-' + section.id);
    if (el) { el.scrollIntoView({ behavior:'smooth', block:'nearest' }); el.querySelector('input')?.focus(); }
  }, 50);
}


function dqSetRequired(id, val) {
  const q = _dqFindQ(id);
  if (q) { q.required = val; renderDirectQList(); }
}

function dqExpandCard(id) {
  const q = _dqFindQ(id);
  if (!q) return;
  q._collapsed = false;
  renderDirectQList();
}

function dqValidateCard(q) {
  if (!q?.text?.trim()) return 'Câu hỏi chưa có nội dung!';

  const normalizedType = normalizeQuestionType(q.type);
  if (['choice', 'checkbox', 'dropdown'].includes(normalizedType)) {
    const filledOpts = (q.opts || []).filter(o => String(o || '').trim());
    if (!filledOpts.length) return 'Câu hỏi cần ít nhất 1 lựa chọn!';
  }

  if (['grid_radio', 'grid_checkbox'].includes(normalizedType)) {
    const filledRows = (q.rows || []).filter(r => String(r || '').trim());
    const filledCols = (q.cols || []).filter(c => String(c || '').trim());
    if (!filledRows.length || !filledCols.length) return 'Câu hỏi lưới cần ít nhất 1 hàng và 1 cột!';
  }

  return '';
}

function dqSaveCard(id) {
  const q = _dqFindQ(id);
  if (!q) return;
  const error = dqValidateCard(q);
  if (error) {
    showToast(error, 'error');
    return;
  }
  q._collapsed = true;
  renderDirectQList();
  showToast('Đã lưu câu hỏi', 'success');
}

function dqAddImage(id) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const q = _dqFindQ(id); if (!q) return;
      q.image = ev.target.result;
      renderDirectQList();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function dqAddVideo(id) {
  const url = prompt('Nhập URL video (YouTube, Google Drive...):', '');
  if (!url?.trim()) return;
  const q = _dqFindQ(id); if (!q) return;
  q.video = url.trim();
  renderDirectQList();
}

function dqSetText(id, val) {
  const q = _dqFindQ(id);
  if (q) {
    q.text = val;
    q._collapsed = false;
  }
}
function dqSetType(id, val) {
  const q = directQuestions.find(q => sameQuestionId(q.id, id)) || libraryQuestions.find(q => sameQuestionId(q.id, id));
  if (!q) return;
  q.type = val;
  q._collapsed = false;
  if (DQ_NEEDS_OPTS.includes(val) && (!q.opts || !q.opts.length)) q.opts = getDefaultOptionsForType(val);
  else if (!DQ_NEEDS_OPTS.includes(val)) q.opts = [];
  if (val === 'rating' && (!q.opts || !q.opts.length)) q.opts = getDefaultOptionsForType(val);
  if (DQ_NEEDS_GRID.includes(val)) {
    if (!q.rows || !q.rows.length) q.rows = [''];
    if (!q.cols || !q.cols.length) q.cols = [''];
  } else {
    q.rows = []; q.cols = [];
  }
  renderDirectQList();
}
function dqSetOpt(id, oi, val) {
  const q = _dqFindQ(id);
  if (!q) return;
  // Nếu người dùng xóa trắng → giữ lại default làm giá trị lưu
  const trimmed = val.trim();
  q.opts[oi] = trimmed || (getDefaultOptionsForType(q.type)[oi] || '');
  q._collapsed = false;
}
function dqAddOpt(id) {
  const q = _dqFindQ(id);
  if (q) { q.opts.push(''); renderDirectQList(); }
}
function dqRemoveOpt(id, oi) {
  const q = _dqFindQ(id);
  if (q && q.opts.length > 1) { q.opts.splice(oi, 1); renderDirectQList(); }
}
function dqRemove(id) {
  if (id.startsWith('dq-')) {
    directQuestions = directQuestions.filter(q => !sameQuestionId(q.id, id));
  } else {
    selectedQuestions.delete(id);
    renderQList();
  }
  renderDirectQList();
}

// ─── GRID ROW/COL HELPERS ───
function _dqFindQ(id) { return directQuestions.find(q=>sameQuestionId(q.id,id))||libraryQuestions.find(q=>sameQuestionId(q.id,id)); }
function dqSetRow(id,ri,val){ const q=_dqFindQ(id); if(q){if(!q.rows)q.rows=[];q.rows[ri]=val;} }
function dqAddRow(id){ const q=_dqFindQ(id); if(q){if(!q.rows)q.rows=[];q.rows.push('');renderDirectQList();} }
function dqRemoveRow(id,ri){ const q=_dqFindQ(id); if(q&&q.rows&&q.rows.length>1){q.rows.splice(ri,1);renderDirectQList();} }
function dqSetCol(id,ci,val){ const q=_dqFindQ(id); if(q){if(!q.cols)q.cols=[];q.cols[ci]=val;} }
function dqAddCol(id){ const q=_dqFindQ(id); if(q){if(!q.cols)q.cols=[];q.cols.push('');renderDirectQList();} }
function dqRemoveCol(id,ci){ const q=_dqFindQ(id); if(q&&q.cols&&q.cols.length>1){q.cols.splice(ci,1);renderDirectQList();} }

function deleteQ(id) {
  // mirrors handleDeleteQuestion
  document.getElementById('qdm-'+id)?.classList.remove('open');
  if (!confirm('Bạn có chắc muốn xóa câu hỏi này?')) return;
  libraryQuestions = libraryQuestions.filter(q => !sameQuestionId(q.id, id));
  selectedQuestions.delete(id);
  saveLibraryQuestions(libraryQuestions);
  renderQList();
  showToast('Đã xóa câu hỏi khỏi thư viện!', 'success');
}

function toggleQDotMenu(id) {
  document.querySelectorAll('.export-drop-menu.open').forEach(m => { if(m.id !== 'qdm-'+id) m.classList.remove('open'); });
  document.getElementById('qdm-'+id)?.classList.toggle('open');
}

// ─── SUBMIT FORM ───
async function submitForm(skipCloseConfirm = false) {
  const name = document.getElementById('new-form-name')?.value?.trim();
  const cat = document.getElementById('new-form-cat')?.value;
  const statusVal = document.getElementById('new-form-status')?.value || '';
  if (!name) { showToast('Vui lòng nhập tên form!', 'error'); document.getElementById('new-form-name')?.focus(); return; }
  if (!cat) { showToast('Vui lòng chọn danh mục!', 'error'); return; }
  if (!statusVal) { showToast('Vui lòng chọn trạng thái!', 'error'); document.getElementById('new-form-status')?.focus(); return; }

  const chosenQuestions = getAllFormQuestions();
  if (!chosenQuestions.length) { showToast('Vui lòng thêm ít nhất 1 câu hỏi!', 'error'); return; }
  for (let i = 0; i < chosenQuestions.length; i++) {
    if (!chosenQuestions[i].text?.trim()) {
      showToast(`Câu hỏi ${i + 1} chưa có nội dung!`, 'error');
      return;
    }
  }

  const colors = ['#0ea5e9','#8b5cf6','#f97316','#ec4899','#10b981','#3b82f6','#f59e0b','#64748b'];
  const imgs = [
    'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=200&fit=crop',
  ];

  let newId = 'f-' + Date.now();
  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        ten_form: name,
        danh_muc: cat,
        trang_thai: statusVal,
        loi_ket: document.getElementById('new-form-loi-ket')?.value?.trim() || '',
        cau_hoi: chosenQuestions.map(q => ({
          noi_dung: q.text,
          loai: q.type,
          bat_buoc: q.required || false,
          lua_chon: q.opts || [],
          thu_tu: q._order ?? 0,
        })),
      })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result.message || 'Không tạo được form');
    }
    if (result.id) newId = String(result.id);
  } catch (e) {
    showToast(e.message || 'Lỗi kết nối server!', 'error');
    return;
  }
  localStorage.removeItem(NEW_FORM_LOI_KET_DRAFT_KEY);

  // Lấy thông tin user đang đăng nhập
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const byName = currentUser.ho_ten || currentUser.ten_dang_nhap || 'Quản lý';

  const newForm = {
    id: newId, name, cat,
    created: new Date().toLocaleDateString('vi-VN'), status: statusVal,
    loi_ket: document.getElementById('new-form-loi-ket')?.value?.trim() || '',
    by: byName,
    initials: byName[0]?.toUpperCase() || 'A',
    img: imgs[Math.floor(Math.random() * imgs.length)],
    color: colors[Math.floor(Math.random() * colors.length)],
    questions: chosenQuestions,
  };
  FORMS.unshift(newForm);
  filtered = [...FORMS];

  const dbFormId = parseInt(newId, 10);
  let approvalCreated = false;
  let approvalId = '';
  const approvalNote = document.getElementById('new-form-note')?.value.trim() || '';
  if (statusVal === 'pending' && !Number.isNaN(dbFormId)) {
    try {
      const approvalResult = await createApprovalRequest(dbFormId, approvalNote);
      approvalCreated = true;
      approvalId = String(approvalResult.id || dbFormId);
      cacheLocalApprovalItem({
        approvalId,
        formId: dbFormId,
        formName: name,
        cat,
        note: approvalNote,
        questions: chosenQuestions,
      });
    } catch (e) {
      console.warn('Không tạo được yêu cầu phê duyệt:', e.message);
      try {
        await updateFormStatusOnly(dbFormId, 'draft');
        newForm.status = 'draft';
        const createdIdx = FORMS.findIndex(f => String(f.id) === String(newId));
        if (createdIdx !== -1) FORMS[createdIdx].status = 'draft';
      } catch (_) {}
    }
  }

  window._skipCloseConfirm = true;
  closeFormModal();

  // Nếu đang ở trang standalone form-create.html → redirect về quản lý biểu mẫu
  if (window.location.pathname.includes('form-create')) {
    const msg = approvalCreated
      ? `Đã tạo form "${name}" và gửi tới quản lý phê duyệt`
      : `Đã tạo form "${name}" thành công`;
    showToast(msg, 'success');
    setTimeout(() => { window.location.href = 'form-management.html'; }, 900);
    return;
  }

  // Reload lại danh sách từ API để đảm bảo đồng bộ với DB
  try {
    const freshForms = await loadForms();
    FORMS = freshForms;
    filtered = [...FORMS];
  } catch(e) {
    // Nếu reload thất bại vẫn giữ newForm đã unshift ở trên
  }
  renderGrid(filtered);

  if (approvalCreated) {
    showToast(`Đã tạo form "${name}" và gửi tới quản lý phê duyệt`, 'success');
  } else if (statusVal === 'pending') {
    showToast(`Đã tạo form "${name}" nhưng chưa gửi được yêu cầu phê duyệt, form đã được chuyển về nháp`, 'warning');
  } else {
    showToast(`Đã tạo form "${name}" dưới dạng nháp`, 'success');
  }
}

// ─── FORM CARDS GRID / LIST ───

// Portal dropdown — appended to body, positioned via getBoundingClientRect
function showFormMenu(btnEl, formId) {
  // Remove existing portal menu
  const existing = document.getElementById('portal-fmenu');
  if (existing) {
    if (existing.dataset.fid === formId && existing.style.display !== 'none') {
      existing.remove();
      return;
    }
    existing.remove();
  }

  const rect = btnEl.getBoundingClientRect();
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  const scrollX = window.scrollX || document.documentElement.scrollLeft;

  const menu = document.createElement('div');
  menu.id = 'portal-fmenu';
  menu.dataset.fid = formId;
  menu.style.cssText = `
    position:absolute;
    top:${rect.bottom + scrollY + 4}px;
    left:${rect.right + scrollX - 160}px;
    width:160px;
    background:#fff;
    border:1px solid #e2e8f0;
    border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,.13),0 2px 8px rgba(0,0,0,.07);
    z-index:99999;
    overflow:hidden;
    animation:fadeInDown .12s ease;
  `;

  const item = (icon, label, color, onclick) => {
    const el = document.createElement('div');
    el.style.cssText = `display:flex;align-items:center;gap:9px;padding:10px 14px;font-size:13px;color:${color||'#374151'};cursor:pointer;transition:background .1s;white-space:nowrap;font-family:inherit`;
    el.onmouseenter = () => el.style.background = '#f8fafc';
    el.onmouseleave = () => el.style.background = '';
    el.innerHTML = icon + label;
    el.onclick = (e) => { e.stopPropagation(); menu.remove(); onclick(); };
    return el;
  };
  const divider = () => { const d = document.createElement('div'); d.style.cssText='height:1px;background:#f1f5f9;margin:3px 0'; return d; };

  menu.appendChild(item('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>', 'Xem form', '#374151', () => openViewModal(formId)));
  menu.appendChild(item('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>', 'Chỉnh sửa', '#374151', () => openEditModal(formId)));
  menu.appendChild(item('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>', 'Tạo bản sao', '#374151', () => duplicateForm(formId)));
    menu.appendChild(item('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>', 'Chia s\u1ebb', '#374151', () => openShareModal(formId)));
  menu.appendChild(divider());
  menu.appendChild(item('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>', 'Xóa form', '#ef4444', () => deleteForm(formId)));

  document.body.appendChild(menu);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', handler); }
    });
  }, 0);
}

// Add fadeInDown keyframe once
if (!document.getElementById('fmenu-style')) {
  const s = document.createElement('style');
  s.id = 'fmenu-style';
  s.textContent = `@keyframes fadeInDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}} .dq-placeholder-gray::placeholder{color:#b0b8c8;opacity:1;}`;
  document.head.appendChild(s);
}

function renderGrid(list) {
  document.getElementById('forms-count').innerHTML = `Hiển thị <strong style="color:var(--gray-800)">${list.length}</strong> trong tổng số <strong style="color:var(--gray-800)">${FORMS.length}</strong> form`;

  const dotsBtn = (id) => `<button
    onclick="event.stopPropagation();showFormMenu(this,'${id}')"
    style="width:30px;height:30px;border-radius:6px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#94a3b8;flex-shrink:0;transition:all .15s"
    onmouseenter="this.style.background='#f1f5f9';this.style.color='#475569'"
    onmouseleave="this.style.background='transparent';this.style.color='#94a3b8'"
    title="Tùy chọn">
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
  </button>`;

  if (viewMode === 'grid') {
    document.getElementById('grid-view').innerHTML = list.map(f=>`
      <div class="form-card" onclick="openViewModal('${f.id}')" title="Xem câu hỏi">
        <div class="form-card-thumb">
          <img src="${f.img}" alt="${f.name}" loading="lazy">
          <div style="position:absolute;top:10px;left:10px">${sBadge(f.status)}</div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:${f.color}"></div>
        </div>
        <div class="form-card-body">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${f.color};flex-shrink:0;display:inline-block"></span>
            <span class="badge" style="font-size:11px;padding:2px 7px;background:var(--gray-100);color:var(--gray-600)">${f.cat}</span>
          </div>
          <div class="form-card-name">${f.name}</div>
          <div class="form-card-meta" style="margin-top:8px">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${f.created}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--gray-100);margin-top:10px">
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:24px;height:24px;border-radius:50%;background:${f.color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">${f.initials}</div>
              <span style="font-size:12px;color:var(--gray-600)">${f.by}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px">
              <button onclick="toggleFav('${f.id}',event)" style="background:none;border:none;cursor:pointer;padding:4px;font-size:16px;line-height:1;transition:transform .15s" title="Yêu thích" onmouseenter="this.style.transform='scale(1.2)'" onmouseleave="this.style.transform='scale(1)'">${favorites.has(String(f.id))?'❤️':'🤍'}</button>
              ${dotsBtn(f.id)}
            </div>
          </div>
        </div>
      </div>`).join('');
    document.getElementById('list-view').style.display = 'none';
    document.getElementById('grid-view').style.display = '';
  } else {
    document.getElementById('list-view').innerHTML = list.map(f=>`
      <div style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--gray-100);transition:background .12s;cursor:pointer" onclick="openViewModal('${f.id}')" title="Xem câu hỏi" onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background=''">
        <div style="width:4px;height:40px;border-radius:2px;background:${f.color};flex-shrink:0"></div>
        <img src="${f.img}" style="width:52px;height:38px;border-radius:6px;object-fit:cover;flex-shrink:0">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13.5px;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px">${f.name}</div>
          <div style="font-size:12px;color:var(--gray-500)">${f.cat}</div>
        </div>
        ${sBadge(f.status)}
        <div style="display:flex;gap:20px;font-size:12.5px;color:var(--gray-500);min-width:100px">
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:middle;margin-right:3px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${f.created}</span>
        </div>
        <button onclick="toggleFav('${f.id}',event)" style="background:none;border:none;cursor:pointer;padding:4px;font-size:18px;line-height:1;flex-shrink:0" title="Yêu thích">${favorites.has(String(f.id))?'❤️':'🤍'}</button>
        ${dotsBtn(f.id)}
      </div>`).join('');
    document.getElementById('grid-view').style.display = 'none';
    document.getElementById('list-view').style.display = 'block';
  }
}

function setView(v) {
  viewMode = v;
  const gb = document.getElementById('btn-grid');
  const lb = document.getElementById('btn-list');
  if(gb) gb.classList.toggle('active', v==='grid');
  if(lb) lb.classList.toggle('active', v==='list');
  renderGrid(filtered);
}
function filterForms() {
  const q = document.getElementById('search-inp').value.toLowerCase();
  filtered = FORMS.filter(f => f.name.toLowerCase().includes(q));
  renderGrid(filtered);
}
function applyFilter() { filtered = [...FORMS]; renderGrid(filtered); }
function resetFilter() { filtered = [...FORMS]; renderGrid(filtered); }

async function deleteForm(id) {
  const f = FORMS.find(f => f.id === id);
  if (!f) return;
  if (!confirm(`Chuyển form "${f.name}" vào thùng rác?\n\nForm sẽ tự động xóa vĩnh viễn sau 30 ngày.`)) return;

  // Ẩn card ngay lập tức
  const card = document.querySelector(`[onclick*="openViewModal('${id}')"], [onclick*='openViewModal("${id}")']`);
  if (card) card.style.display = 'none';

  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/forms/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error();
  } catch(e) {
    if (card) card.style.display = '';
    showToast('Lỗi kết nối server!', 'error');
    return;
  }

  moveToTrash(f);
  hideApprovalForm(f);
  removeApprovalsByForm(f);
  FORMS.splice(FORMS.findIndex(f => f.id === id), 1);
  filtered = filtered.filter(f => f.id !== id);
  renderGrid(filtered);
  showToast(`Đã chuyển "${f.name}" vào thùng rác`, 'success');
}

async function duplicateForm(id) {
  const f = FORMS.find(f => f.id === id);
  if (!f) return;
  const copyName = f.name + ' (bản sao)';

  let sourceQuestions = Array.isArray(f.questions) ? [...f.questions] : [];
  if (!sourceQuestions.length) {
    try {
      const tkn = localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE}/forms/${id}`, {
        headers: tkn ? { Authorization: `Bearer ${tkn}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        sourceQuestions = (data.cau_hoi || []).map((q, i) => ({
          id: q.id || ('dq-copy-' + i),
          text: q.noi_dung || '',
          type: normalizeQuestionType(q.loai || 'choice'),
          required: q.bat_buoc || false,
          opts: (q.lua_chon || []).map(o => o.noi_dung || o),
        }));
      }
    } catch (e) {}
  }

  try {
    const tkn2 = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tkn2 ? { Authorization: `Bearer ${tkn2}` } : {}) },
      body: JSON.stringify({
        ten_form: copyName,
        danh_muc: f.cat || 'Khác',
        trang_thai: 'draft',
        cau_hoi: sourceQuestions.map(q => ({
          noi_dung: q.text || q.noi_dung || '',
          loai: q.type || q.loai || 'choice',
          bat_buoc: q.required || q.bat_buoc || false,
          lua_chon: q.opts || [],
        })),
      })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || 'Không tạo được bản sao');
  } catch (e) {
    showToast(e.message || 'Không tạo được bản sao biểu mẫu', 'error');
    return;
  }

  try {
    const freshForms = await loadForms();
    FORMS = freshForms;
    filtered = [...FORMS];
    renderGrid(filtered);
  } catch (e) {}

  showToast(`Đã tạo bản sao "${copyName}"`, 'success');
}

// ─── EDIT FORM STATE ───
let editFormQuestions = []; // mảng câu hỏi đang edit, mỗi phần tử: {id, text, type, opts, required}

function openEditModal(id) {
  const f = FORMS.find(f => f.id === id);
  if (!f) return;
  document.getElementById('edit-form-id').value = f.id;
  document.getElementById('edit-form-name').value = f.name;
  document.getElementById('edit-form-cat').value = f.cat;
  document.getElementById('edit-form-status').value = f.status || 'draft';
  const editLoiKetEl = document.getElementById('edit-form-loi-ket');
  const editLoiKetCount = document.getElementById('edit-loi-ket-count');
  const localLoiKet = f.loi_ket || '';
  if (editLoiKetEl) editLoiKetEl.value = localLoiKet;
  if (editLoiKetCount) editLoiKetCount.textContent = localLoiKet.length + '/300';

  // Load câu hỏi từ local (form mới tạo) hoặc từ API
  editFormQuestions = (f.questions || []).map((q, i) => ({
    id: q.id || ('eq-' + i),
    text: q.text || q.noi_dung || '',
    type: normalizeQuestionType(q.type || q.loai || 'choice'),
    opts: q.opts && q.opts.length ? [...q.opts] : (q.lua_chon ? q.lua_chon.map(o => o.noi_dung || o) : []),
    required: q.required || q.bat_buoc || false,
  }));

  renderEditQuestions();
  openModal('edit-form-modal');

  // Load đầy đủ từ API: câu hỏi + lời kết chính xác
  const tkn3 = localStorage.getItem('token') || '';
  fetch(`${API_BASE}/forms/${id}`, {
    headers: tkn3 ? { Authorization: `Bearer ${tkn3}` } : {}
  })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;
      // Cập nhật câu hỏi
      if (data.cau_hoi && data.cau_hoi.length) {
        editFormQuestions = data.cau_hoi.map((q, i) => ({
          id: 'eq-' + (q.id || i),
          text: q.noi_dung || '',
          type: normalizeQuestionType(q.loai || 'choice'),
          opts: (q.lua_chon || []).map(o => o.noi_dung || o),
          required: q.bat_buoc || false,
        }));
        renderEditQuestions();
      }
      // Cập nhật lời kết — luôn set từ API vì local FORMS không có
      const lkEl = document.getElementById('edit-form-loi-ket');
      const lkCount = document.getElementById('edit-loi-ket-count');
      const loiKet = data.loi_ket || '';
      if (lkEl) { lkEl.value = loiKet; }
      if (lkCount) { lkCount.textContent = loiKet.length + '/300'; }
    }).catch(() => {});
}

const EDIT_TYPE_LABELS = {
  choice:'◉ Trắc nghiệm', checkbox:'☑ Hộp kiểm', dropdown:'▾ Thả xuống',
  paragraph:'¶ Đoạn văn',
  rating:'★ Xếp hạng', scale:'⟷ Tuyến tính', grid_radio:'⊞ Lưới trắc nghiệm', grid_checkbox:'⊟ Lưới hộp kiểm'
};

function editQEscHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function renderEditQuestions() {
  const wrap = document.getElementById('edit-q-list');
  if (!wrap) return;
  if (!editFormQuestions.length) {
    wrap.innerHTML = `<div style="padding:24px;text-align:center;color:var(--gray-400);font-size:13px">Chưa có câu hỏi nào. Bấm "+ Thêm câu hỏi" để thêm.</div>`;
    document.getElementById('edit-q-count').textContent = 0;
    return;
  }
  wrap.innerHTML = editFormQuestions.map((q, qi) => {
    // Render section card (giống Tạo biểu mẫu mới)
    if (q._isSection) {
      return `
    <div style="border:2px dashed #fbbf24;border-radius:12px;background:#fffbeb;padding:0;display:flex;margin-bottom:10px">
      <div style="flex:1;min-width:0;padding:12px 14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" width="14" height="14"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          <span style="font-size:10.5px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.5px">Phần mới</span>
        </div>
        <input type="text" value="${(q.title||'').replace(/"/g,'&quot;')}" placeholder="Tiêu đề phần..."
          style="width:100%;padding:6px 10px;border:1.5px solid #fde68a;border-radius:8px;font-size:14px;font-weight:700;font-family:inherit;outline:none;background:#fff;color:#92400e;transition:border .15s;box-sizing:border-box"
          onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#fde68a'"
          oninput="editFormQuestions[${qi}].title=this.value">
        <input type="text" value="${(q.desc||'').replace(/"/g,'&quot;')}" placeholder="Mô tả phần (tùy chọn)..."
          style="width:100%;padding:5px 10px;border:1px solid #fde68a;border-radius:7px;font-size:12.5px;font-family:inherit;outline:none;background:#fff;color:#78350f;margin-top:6px;transition:border .15s;box-sizing:border-box"
          onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#fde68a'"
          oninput="editFormQuestions[${qi}].desc=this.value">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 6px;border-left:1px solid #fde68a;min-width:40px">
        <button onclick="editQAddSection(${qi})" title="Thêm phần bên dưới"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#fbbf24;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#f59e0b';this.style.background='#fef3c7'"
          onmouseleave="this.style.color='#fbbf24';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <button onclick="editQAddNew(${qi})" title="Thêm câu hỏi bên dưới"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#0284c7';this.style.background='#e0f9ff'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button onclick="editFormQuestions.splice(${qi},1);renderEditQuestions()" title="Xóa phần"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#ef4444';this.style.background='#fef2f2'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
    }
    const normalizedType = normalizeQuestionType(q.type);
    const needsOpts = ['choice','checkbox','dropdown','rating'].includes(normalizedType);
    const needsGrid = ['grid_radio','grid_checkbox'].includes(normalizedType);
    const opts = q.opts || [];
    const rows = q.rows || [];
    const cols = q.cols || [];
    const typeColor = {choice:'#1d4ed8',checkbox:'#166534',dropdown:'#854d0e',rating:'#b45309',grid_radio:'#6b21a8',grid_checkbox:'#065f46'}[q.type]||'#374151';
    if (q._collapsed) {
      const summaryOpts = needsGrid
        ? `${rows.filter(Boolean).length} hàng · ${cols.filter(Boolean).length} cột`
        : needsOpts
        ? `${opts.filter(Boolean).length} lựa chọn`
        : 'Câu trả lời văn bản';
      return `
    <div onclick="editQExpand(${qi})" title="Bấm để mở câu hỏi" style="border:1.5px solid #dbeafe;border-left:5px solid #0ea5e9;border-radius:14px;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);box-shadow:0 10px 24px rgba(15,23,42,.05);display:flex;align-items:center;gap:12px;margin:0 0 10px 0;padding:12px 14px;cursor:pointer">
      <div style="width:26px;height:26px;border-radius:50%;background:#dbeafe;color:#2563eb;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${qi+1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${editQEscHtml(q.text || 'Chưa có nội dung câu hỏi')}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px">
          <span style="padding:3px 9px;border-radius:999px;background:#dcfce7;color:#15803d;font-size:11.5px;font-weight:800">Đã lưu</span>
          <span style="padding:3px 9px;border-radius:999px;background:#eff6ff;color:${typeColor};font-size:11.5px;font-weight:700">${getTypeOptionLabel(q.type)}</span>
          <span style="font-size:12px;color:#64748b">${summaryOpts}</span>
          ${q.required ? '<span style="font-size:12px;color:#ef4444;font-weight:700">Bắt buộc</span>' : ''}
        </div>
      </div>
    </div>`;
    }
    return `
    <div id="eqcard-${qi}" draggable="true"
      ondragstart="eqDragStart(event,${qi})"
      ondragover="eqDragOver(event)"
      ondrop="eqDrop(event,${qi})"
      ondragend="eqDragEnd(event)"
      style="border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.04);display:flex;margin-bottom:10px;transition:box-shadow .15s,opacity .15s">
      <!-- Drag handle 6 chấm -->
      <div title="Kéo để đổi vị trí"
        style="display:flex;align-items:center;justify-content:center;width:20px;flex-shrink:0;cursor:grab;color:#cbd5e1;border-right:1px solid #f1f5f9;padding:0 2px;border-radius:12px 0 0 12px"
        onmouseenter="this.style.color='#94a3b8';this.style.background='#f8fafc'"
        onmouseleave="this.style.color='#cbd5e1';this.style.background=''">
        <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor">
          <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
          <circle cx="3" cy="6" r="1.5"/><circle cx="7" cy="6" r="1.5"/>
          <circle cx="3" cy="10" r="1.5"/><circle cx="7" cy="10" r="1.5"/>
          <circle cx="3" cy="14" r="1.5"/><circle cx="7" cy="14" r="1.5"/>
        </svg>
      </div>
      <div style="flex:1;min-width:0;padding:12px 14px">
        <!-- Row: số + input + dropdown loại -->
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:22px;height:22px;border-radius:50%;background:#eff6ff;color:#3b82f6;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${qi+1}</div>
          <input type="text" value="${q.text.replace(/"/g,'&quot;')}" placeholder="Nhập nội dung câu hỏi..."
            style="flex:1;padding:7px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fafbff;transition:border .15s;min-width:0"
            onfocus="this.style.borderColor='#0ea5e9'" onblur="this.style.borderColor='#e2e8f0'"
            oninput="editQSetText(${qi},this.value)">
          <select onchange="editQSetType(${qi},this.value)"
            style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12.5px;font-family:inherit;background:#fafbff;color:#374151;outline:none;cursor:pointer;transition:border .15s;flex-shrink:0"
            onfocus="this.style.borderColor='#0ea5e9'" onblur="this.style.borderColor='#e2e8f0'">
            ${Object.keys(EDIT_TYPE_LABELS).map(v=>`<option value="${v}" ${q.type===v?'selected':''}>${getTypeOptionLabel(v)}</option>`).join('')}
          </select>
        </div>

        ${needsOpts ? `
        <div style="padding-left:30px;margin-top:10px">
          ${normalizedType==='rating' ? `
          <div style="padding:12px 14px;border:1px solid #fde68a;border-radius:12px;background:linear-gradient(180deg,#fffdf7 0%,#fff7ed 100%)">
            <div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">★ Xếp hạng sao (1–5)</div>
            <div style="display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap">
              ${Array.from({length:5},(_,i)=>`
                <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                  <span style="font-size:12px;font-weight:600;color:#92400e">${i+1}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" width="28" height="28"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>
                </div>
              `).join('')}
            </div>
          </div>
          ` : normalizedType==='scale' ? `
          <div style="padding:12px 14px;border:1px solid #c7d2fe;border-radius:12px;background:linear-gradient(180deg,#f8f9ff 0%,#eef2ff 100%)">
            <div style="font-size:11px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">⟷ Phạm vi tuyến tính (1–5)</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              ${[1,2,3,4,5].map(n=>`<div style="width:36px;height:36px;border-radius:50%;border:2px solid #a5b4fc;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#4338ca;background:#fff">${n}</div>`).join('')}
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1">
                <div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:4px">Nhãn đầu (tuỳ chọn)</div>
                <input type="text" value="${(opts[0]||'').replace(/"/g,'&quot;')}" placeholder="vd: Không hài lòng"
                  style="width:100%;padding:6px 10px;border:1px solid #c7d2fe;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s"
                  onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#c7d2fe'"
                  oninput="editQSetOpt(${qi},0,this.value)">
              </div>
              <div style="font-size:18px;color:#a5b4fc">→</div>
              <div style="flex:1">
                <div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:4px">Nhãn cuối (tuỳ chọn)</div>
                <input type="text" value="${(opts[1]||'').replace(/"/g,'&quot;')}" placeholder="vd: Rất hài lòng"
                  style="width:100%;padding:6px 10px;border:1px solid #c7d2fe;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s"
                  onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#c7d2fe'"
                  oninput="editQSetOpt(${qi},1,this.value)">
              </div>
            </div>
          </div>
          ` : `
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Các lựa chọn</div>
          ${opts.map((o,oi)=>{
            const optIcon=normalizedType==='checkbox'
              ?`<span style="width:15px;height:15px;border-radius:3px;border:2px solid #94a3b8;flex-shrink:0;display:inline-block;background:#fff"></span>`
              :normalizedType==='dropdown'
              ?`<span style="font-size:11px;color:#94a3b8;font-weight:700;min-width:18px;text-align:center">${oi+1}</span>`
              :`<span style="width:15px;height:15px;border-radius:50%;border:2px solid #94a3b8;flex-shrink:0;display:inline-block;background:#fff"></span>`;
            const eqOptDragHandle = '<span style="cursor:grab;color:#d1d5db;display:flex;align-items:center;flex-shrink:0;padding:0 2px" title="Kéo để đổi vị trí"><svg viewBox="0 0 8 12" width="8" height="12" fill="currentColor"><circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/><circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/><circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/></svg></span>';
            const eqOptRemoveBtn = opts.length > 1 ? `<button onclick="editQRemoveOpt(${qi},${oi})" style="width:20px;height:20px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;transition:all .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>` : '';
            return `<div draggable="true" ondragstart="eqOptDragStart(event,${qi},${oi})" ondragover="eqOptDragOver(event,${qi},${oi})" ondrop="eqOptDrop(event,${qi},${oi})" ondragend="eqOptDragEnd()" style="display:flex;align-items:center;gap:6px;margin-bottom:6px;transition:opacity .15s">${eqOptDragHandle}${optIcon}<input type="text" value="${o.replace(/"/g,'&quot;')}" placeholder="Lựa chọn ${oi+1}" style="flex:1;padding:6px 10px;border:1px solid #e2e8f0;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s" onfocus="this.style.borderColor='#0ea5e9'" onblur="this.style.borderColor='#e2e8f0'" oninput="editQSetOpt(${qi},${oi},this.value)">${eqOptRemoveBtn}</div>`;
          }).join('')}
          <button onclick="editQAddOpt(${qi})"
            style="padding:5px 14px;background:transparent;border:1.5px dashed #7dd3fc;border-radius:7px;cursor:pointer;color:#0284c7;font-size:12px;font-weight:600;transition:all .15s;margin-top:2px"
            onmouseenter="this.style.background='#e0f2fe';this.style.borderColor='#0ea5e9'"
            onmouseleave="this.style.background='transparent';this.style.borderColor='#7dd3fc'">+ Thêm lựa chọn</button>
          `}
        </div>` : ''}

        ${!needsOpts && !needsGrid ? renderTextAnswerBuilder(normalizedType) : ''}

        ${needsGrid ? `
        <div style="padding-left:30px;margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">📋 Hàng (tiêu đề)</div>
            ${rows.map((r,ri)=>`<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
              <span style="width:14px;height:14px;border-radius:${normalizedType==='grid_radio'?'50%':'3px'};border:1.5px solid #c4b5fd;flex-shrink:0;display:inline-block;background:#fff"></span>
              <input type="text" value="${r.replace(/"/g,'&quot;')}" placeholder="Hàng ${ri+1}"
                style="flex:1;padding:5px 9px;border:1px solid #e2e8f0;border-radius:7px;font-size:12px;background:#fff;outline:none;transition:border .15s"
                onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e2e8f0'"
                oninput="editQSetRow(${qi},${ri},this.value)">
              ${rows.length>1?`<button onclick="editQRemoveRow(${qi},${ri})" style="width:18px;height:18px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;transition:color .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>`:''}
            </div>`).join('')}
            <button onclick="editQAddRow(${qi})" style="padding:4px 10px;background:transparent;border:1.5px dashed #c4b5fd;border-radius:7px;cursor:pointer;color:#7c3aed;font-size:11.5px;font-weight:600;transition:all .15s;margin-top:2px" onmouseenter="this.style.background='#f5f3ff'" onmouseleave="this.style.background='transparent'">+ Thêm hàng</button>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">🔷 Cột (lựa chọn)</div>
            ${cols.map((c,ci)=>`<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
              <span style="width:14px;height:14px;border-radius:${normalizedType==='grid_radio'?'50%':'3px'};border:1.5px solid #7dd3fc;flex-shrink:0;display:inline-block;background:#fff"></span>
              <input type="text" value="${c.replace(/"/g,'&quot;')}" placeholder="Cột ${ci+1}"
                style="flex:1;padding:5px 9px;border:1px solid #e2e8f0;border-radius:7px;font-size:12px;background:#fff;outline:none;transition:border .15s"
                onfocus="this.style.borderColor='#0ea5e9'" onblur="this.style.borderColor='#e2e8f0'"
                oninput="editQSetCol(${qi},${ci},this.value)">
              ${cols.length>1?`<button onclick="editQRemoveCol(${qi},${ci})" style="width:18px;height:18px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;transition:color .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>`:''}
            </div>`).join('')}
            <button onclick="editQAddCol(${qi})" style="padding:4px 10px;background:transparent;border:1.5px dashed #7dd3fc;border-radius:7px;cursor:pointer;color:#0284c7;font-size:11.5px;font-weight:600;transition:all .15s;margin-top:2px" onmouseenter="this.style.background='#e0f2fe'" onmouseleave="this.style.background='transparent'">+ Thêm cột</button>
          </div>
        </div>` : ''}

        <!-- Bottom: bắt buộc -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9">
          <label style="display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none">
            <div style="position:relative;width:34px;height:18px">
              <input type="checkbox" ${q.required?'checked':''} onchange="editFormQuestions[${qi}].required=this.checked;renderEditQuestions()"
                style="opacity:0;width:0;height:0;position:absolute">
              <span style="position:absolute;inset:0;background:${q.required?'#0ea5e9':'#cbd5e1'};border-radius:9px;transition:background .2s;cursor:pointer"></span>
              <span style="position:absolute;top:3px;left:${q.required?'18px':'3px'};width:12px;height:12px;background:#fff;border-radius:50%;transition:left .2s;pointer-events:none"></span>
            </div>
            <span style="font-size:12px;font-weight:600;color:${q.required?'#0ea5e9':'#94a3b8'}">Bắt buộc</span>
          </label>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end">
            <button onclick="editQSaveToLibrary(${qi}, this)"
              style="padding:6px 12px;border:1px solid #bbf7d0;border-radius:8px;background:#fff;color:#059669;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s"
              onmouseenter="this.style.background='#f0fdf4';this.style.borderColor='#6ee7b7'" onmouseleave="this.style.background='#fff';this.style.borderColor='#bbf7d0'">Lưu vào thư viện</button>
            <button onclick="editQRemove(${qi})"
              style="padding:6px 12px;border:1px solid #fecaca;border-radius:8px;background:#fff;color:#dc2626;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s"
              onmouseenter="this.style.background='#fef2f2';this.style.borderColor='#f87171'" onmouseleave="this.style.background='#fff';this.style.borderColor='#fecaca'">Xóa</button>
            <button onclick="editQSaveCard(${qi})"
              style="padding:6px 14px;border:1px solid #0ea5e9;border-radius:8px;background:#0ea5e9;color:#fff;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s"
              onmouseenter="this.style.background='#0284c7';this.style.borderColor='#0284c7'" onmouseleave="this.style.background='#0ea5e9';this.style.borderColor='#0ea5e9'">Lưu câu hỏi</button>
          </div>
        </div>
      </div>

      <!-- Sidebar dọc bên phải -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 6px;border-left:1px solid #f1f5f9;min-width:40px">
        <button onclick="editQAddImage(${qi})" title="Thêm hình ảnh"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#0ea5e9';this.style.background='#e0f2fe'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
        <button onclick="editQAddVideo(${qi})" title="Thêm video"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#8b5cf6';this.style.background='#f5f3ff'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="2" y="2" width="20" height="20" rx="5"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
        </button>
        <button onclick="editQAddSection(${qi})" title="Thêm phần bên dưới"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#f59e0b';this.style.background='#fef3c7'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="4" width="18" height="7" rx="1"/><rect x="3" y="13" width="18" height="7" rx="1"/></svg>
        </button>
        <div style="width:24px;height:1px;background:#f1f5f9;margin:2px 0"></div>
        <button onclick="(function(){var c=JSON.parse(JSON.stringify(editFormQuestions[${qi}]));editFormQuestions.splice(${qi}+1,0,c);renderEditQuestions();})()" title="Sao chép"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#7c3aed';this.style.background='#f5f3ff'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <button onclick="editQRemove(${qi})" title="Xóa câu hỏi"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#ef4444';this.style.background='#fef2f2'"
          onmouseleave="this.style.color='#94a3b8';this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
  fixEditQuestionBottomBarLabels();
  document.getElementById('edit-q-count').textContent = editFormQuestions.length;
}

function fixEditQuestionBottomBarLabels() {
  // Không cần ghi đè label nữa vì các nút đã có text/icon trực tiếp trong HTML template
}

// ─── DRAG & DROP: câu hỏi trong chỉnh sửa form ─────────────────────
let _eqDragIdx = null;
function eqDragStart(event, qi) {
  _eqDragIdx = qi;
  event.dataTransfer.effectAllowed = 'move';
  setTimeout(() => {
    const el = document.getElementById('eqcard-' + qi);
    if (el) { el.style.opacity = '0.4'; el.style.boxShadow = '0 0 0 2px #0ea5e9'; }
  }, 0);
}
function eqDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const card = event.currentTarget;
  if (card) card.style.borderColor = '#7dd3fc';
}
function eqDrop(event, toQi) {
  event.preventDefault();
  if (_eqDragIdx === null || _eqDragIdx === toQi) return;
  const [moved] = editFormQuestions.splice(_eqDragIdx, 1);
  editFormQuestions.splice(toQi, 0, moved);
  _eqDragIdx = null;
  renderEditQuestions();
}
function eqDragEnd(event) {
  document.querySelectorAll('[id^="eqcard-"]').forEach(el => {
    el.style.opacity = '';
    el.style.boxShadow = '';
    el.style.borderColor = '';
  });
  _eqDragIdx = null;
}

// ─── DRAG & DROP: đáp án trong chỉnh sửa form ─────────────────────
let _eqOptDrag = null;
function eqOptDragStart(event, qi, oi) {
  _eqOptDrag = { qi, oi };
  event.dataTransfer.effectAllowed = 'move';
  setTimeout(() => { event.target.style.opacity = '0.4'; }, 0);
}
function eqOptDragOver(event, qi, oi) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}
function eqOptDrop(event, qi, toOi) {
  event.preventDefault();
  if (!_eqOptDrag || _eqOptDrag.qi !== qi || _eqOptDrag.oi === toOi) return;
  const q = editFormQuestions[qi];
  if (!q || !q.opts) return;
  const [moved] = q.opts.splice(_eqOptDrag.oi, 1);
  q.opts.splice(toOi, 0, moved);
  _eqOptDrag = null;
  renderEditQuestions();
}
function eqOptDragEnd() {
  _eqOptDrag = null;
  renderEditQuestions();
}
// ───────────────────────────────────────────────────────────────────

function editQSetText(qi, val) { editFormQuestions[qi].text = val; }

function editQAddImage(qi) {
  const url = prompt('Nhập URL hình ảnh:');
  if (!url) return;
  editFormQuestions[qi].image = url;
  renderEditQuestions();
}
function editQAddVideo(qi) {
  const url = prompt('Nhập URL video (YouTube, v.v.):');
  if (!url) return;
  editFormQuestions[qi].video = url;
  renderEditQuestions();
}
function editQAddSection(qi) {
  editFormQuestions.splice(qi + 1, 0, { id: Date.now(), text: '', type: 'section', opts: [], required: false, _isSection: true, title: '', desc: '' });
  renderEditQuestions();
}
function editQAddNew(qi) {
  editFormQuestions.splice(qi + 1, 0, { id: Date.now(), text: '', type: 'choice', opts: [''], required: false });
  renderEditQuestions();
}
async function editQSaveToLibrary(qi, btn) {
  const q = editFormQuestions[qi];
  if (!q || !q.text?.trim()) { showToast('Câu hỏi chưa có nội dung!', 'error'); return; }

  // Kiểm tra trùng trong thư viện (theo text)
  const already = libraryQuestions.find(lq => lq.text?.trim() === q.text.trim());
  if (already) { showToast('Câu hỏi này đã có trong thư viện!', 'warning'); return; }

  // Lấy danh mục từ form đang chỉnh sửa (hoặc fallback)
  const cat = document.getElementById('edit-form-cat')?.value || 'Ngoại ngữ';

  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        text: q.text.trim(),
        type: q.type,
        bo_mon: cat,
        opts: q.opts || [],
        ...(q.rows?.length ? { rows: q.rows } : {}),
        ...(q.cols?.length ? { cols: q.cols } : {}),
      })
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const newQ = { id: String(data.id || ('lib-' + Date.now())), text: q.text.trim(), type: q.type, category: cat, bo_mon: cat, opts: q.opts || [] };
      libraryQuestions.push(newQ);
      localStorage.setItem('flic_lib_flat', JSON.stringify(libraryQuestions));
      const countEl = document.getElementById('q-total-count');
      if (countEl) countEl.textContent = libraryQuestions.length;
      showLibrarySavedNotice(false);
      markLibrarySavedButton(btn);
      fetchLibraryFromAPI().catch(() => {});
      return;
    }
    throw new Error('API lỗi');
  } catch(e) {
    const newQ = { id: 'lib-' + Date.now(), text: q.text.trim(), type: q.type, category: cat, bo_mon: cat, opts: q.opts || [] };
    libraryQuestions.push(newQ);
    localStorage.setItem('flic_lib_flat', JSON.stringify(libraryQuestions));
    const countEl = document.getElementById('q-total-count');
    if (countEl) countEl.textContent = libraryQuestions.length;
    showLibrarySavedNotice(true);
    markLibrarySavedButton(btn);
  }
}
function editQValidateCard(q) {
  if (!q?.text?.trim()) return 'Cau hoi chua co noi dung!';

  const normalizedType = normalizeQuestionType(q.type);
  if (['choice','checkbox','dropdown'].includes(normalizedType)) {
    const filledOpts = (q.opts || []).filter(o => String(o || '').trim());
    if (!filledOpts.length) return 'Cau hoi can it nhat 1 lua chon!';
  }

  if (['grid_radio','grid_checkbox'].includes(normalizedType)) {
    const filledRows = (q.rows || []).filter(r => String(r || '').trim());
    const filledCols = (q.cols || []).filter(c => String(c || '').trim());
    if (!filledRows.length || !filledCols.length) return 'Cau hoi luoi can it nhat 1 hang va 1 cot!';
  }

  return '';
}
function editQExpand(qi) {
  if (!editFormQuestions[qi]) return;
  editFormQuestions[qi]._collapsed = false;
  renderEditQuestions();
  setTimeout(() => {
    const card = document.getElementById('edit-q-list')?.children?.[qi];
    card?.querySelector('input[type="text"]')?.focus();
  }, 50);
}
function editQSaveCard(qi) {
  const q = editFormQuestions[qi];
  const error = editQValidateCard(q);
  if (error) {
    showToast(error, 'error');
    return;
  }
  q._collapsed = true;
  renderEditQuestions();
  showToast(`Da luu cau hoi ${qi + 1}`, 'success');
}
function editQSetType(qi, val) {
  editFormQuestions[qi].type = val;
  const needsOpts = ['choice','checkbox','dropdown','rating'];
  const needsGrid = ['grid_radio','grid_checkbox'];
  if (needsOpts.includes(val) && !editFormQuestions[qi].opts.length) {
    editFormQuestions[qi].opts = getDefaultOptionsForType(val);
  } else if (!needsOpts.includes(val)) {
    editFormQuestions[qi].opts = [];
  }
  if (val === 'rating' && !editFormQuestions[qi].opts.length) editFormQuestions[qi].opts = getDefaultOptionsForType(val);
  if (needsGrid.includes(val)) {
    if (!editFormQuestions[qi].rows || !editFormQuestions[qi].rows.length) editFormQuestions[qi].rows = [''];
    if (!editFormQuestions[qi].cols || !editFormQuestions[qi].cols.length) editFormQuestions[qi].cols = [''];
  } else {
    editFormQuestions[qi].rows = [];
    editFormQuestions[qi].cols = [];
  }
  renderEditQuestions();
}
function editQSetOpt(qi, oi, val) { editFormQuestions[qi].opts[oi] = val; }
function editQAddOpt(qi) { editFormQuestions[qi].opts.push(''); renderEditQuestions(); }
function editQRemoveOpt(qi, oi) {
  if (editFormQuestions[qi].opts.length > 1) {
    editFormQuestions[qi].opts.splice(oi, 1);
    renderEditQuestions();
  }
}
function editQRemove(qi) {
  editFormQuestions.splice(qi, 1);
  renderEditQuestions();
}
function editQSetRow(qi,ri,val){ editFormQuestions[qi].rows[ri]=val; }
function editQAddRow(qi){ editFormQuestions[qi].rows.push(''); renderEditQuestions(); }
function editQRemoveRow(qi,ri){ if(editFormQuestions[qi].rows.length>1){ editFormQuestions[qi].rows.splice(ri,1); renderEditQuestions(); } }
function editQSetCol(qi,ci,val){ editFormQuestions[qi].cols[ci]=val; }
function editQAddCol(qi){ editFormQuestions[qi].cols.push(''); renderEditQuestions(); }
function editQRemoveCol(qi,ci){ if(editFormQuestions[qi].cols.length>1){ editFormQuestions[qi].cols.splice(ci,1); renderEditQuestions(); } }
function editQAdd() {
  editFormQuestions.push({ id: 'eq-' + Date.now(), text: '', type: 'choice', opts: [''], required: false });
  renderEditQuestions();
  setTimeout(() => {
    const wrap = document.getElementById('edit-q-list');
    wrap && wrap.lastElementChild && wrap.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

document.getElementById('page-content').insertAdjacentHTML('beforeend', `
  <div class="modal-overlay" id="edit-form-modal">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:640px;border-radius:16px">
      <div class="modal-header" style="background:linear-gradient(90deg,#0ea5e9,#0284c7);border-radius:16px 16px 0 0;padding:14px 20px">
        <div>
          <div class="modal-title" style="color:#fff">Chỉnh sửa biểu mẫu</div>
          <div style="font-size:12.5px;color:rgba(255,255,255,0.75);margin-top:2px">Cập nhật thông tin và câu hỏi</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button id="expand-edit-btn" class="icon-btn" title="Phóng to" onclick="toggleEditFormFullscreen()"
            style="color:#fff;background:rgba(255,255,255,0.15);transition:all .15s"
            onmouseenter="this.style.background='rgba(255,255,255,0.28)'" onmouseleave="this.style.background='rgba(255,255,255,0.15)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
          <button class="icon-btn close-btn" onclick="closeModal('edit-form-modal')" style="color:#fff;background:rgba(255,255,255,0.15)">${IC.close}</button>
        </div>
      </div>

      <div id="edit-modal-scroll" style="padding:0 20px 4px;max-height:78vh;overflow-y:auto">

        <!-- Thông tin cơ bản -->
        <div style="padding:16px 0 14px;border-bottom:1px solid var(--gray-200)">
          <input type="hidden" id="edit-form-id">
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Tên biểu mẫu <span style="color:var(--red)">*</span></label>
            <input id="edit-form-name" type="text" class="input" required placeholder="Tên biểu mẫu" style="background:#f8f9fb">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="form-label">Danh mục <span style="color:var(--red)">*</span></label>
              <select id="edit-form-cat" class="input" required style="width:100%;background:#f8f9fb">
                <option value="">Chọn danh mục</option>
                <option>Ngoại ngữ</option><option>Tin học</option>
              </select>
            </div>
            <div>
              <label class="form-label">Trạng thái <span style="color:var(--red)">*</span></label>
              <div style="position:relative">
                <select id="edit-form-status" class="input" required style="width:100%;background:#f8f9fb;appearance:none;-webkit-appearance:none;padding-right:32px">
                  <option value="draft">Nháp</option>
                  <option value="pending">Chờ phê duyệt</option>
                </select>
                <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" width="14" height="14" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Lời kết -->
        <div class="form-group" style="margin-top:4px">
          <label class="form-label">Lời kết (hiển thị sau khi người dùng gửi phản hồi)</label>
          <textarea id="edit-form-loi-ket" class="input" maxlength="300" rows="2"
            style="resize:none;padding:8px 10px;background:#f8f9fb;font-size:13px"
            placeholder="VD: Cảm ơn bạn đã tham gia khảo sát! Phản hồi của bạn rất có giá trị với chúng tôi."
            oninput="var c=document.getElementById('edit-loi-ket-count');c.textContent=this.value.length+'/300';c.style.color=this.value.length>250?'var(--red)':'var(--gray-400)'"></textarea>
          <div style="text-align:right;font-size:11px;color:var(--gray-400);margin-top:2px"><span id="edit-loi-ket-count">0/300</span></div>
        </div>
        <div style="height:1px;background:var(--gray-200);margin-bottom:14px"></div>

        <!-- Khu vực câu hỏi -->
        <div style="padding:14px 0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <span style="font-size:13.5px;font-weight:700;color:var(--gray-700)">
              Câu hỏi <span id="edit-q-count" style="color:#0ea5e9">0</span>
            </span>
            <button onclick="editQAdd()"
              style="display:flex;align-items:center;gap:5px;padding:6px 14px;background:var(--sky);color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;transition:opacity .15s;box-shadow:0 2px 6px rgba(14,165,233,0.3)"
              onmouseenter="this.style.opacity='.88'" onmouseleave="this.style.opacity='1'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Thêm câu hỏi
            </button>
          </div>
          <div id="edit-q-list"></div>
        </div>

      </div>

      <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid var(--gray-200);padding:12px 20px;display:flex;justify-content:space-between;align-items:center;gap:10px;border-radius:0 0 16px 16px;flex-wrap:wrap">
        <button class="btn btn-outline" onclick="editQAdd()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Thêm câu hỏi
        </button>
        <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap">
        <button class="btn btn-outline" onclick="closeModal('edit-form-modal')">Hủy</button>
        <button class="btn btn-primary" onclick="saveEditForm()">${IC.save}Lưu thay đổi</button>
        </div>
      </div>
    </div>
  </div>
`);

// Init handled by async loadForms() above

// ── Charts (data-driven from FORMS list) ────────────────────────
let fmLineChart = null;
let fmDoughnutChart = null;
const CAT_COLORS = {'Đăng ký':'#0ea5e9','Khảo sát':'#8b5cf6','Đánh giá':'#f97316','Phản hồi':'#10b981','Khác':'#64748b'};
// ─── VIEW QUESTIONS MODAL ───────────────────────────────────────

// Inject modal HTML (chạy 1 lần)
document.getElementById('page-content').insertAdjacentHTML('beforeend', `
  <div class="modal-overlay" id="view-form-modal" onclick="closeModal('view-form-modal')">
    <div class="modal" onclick="event.stopPropagation()" style="width:100vw;max-width:none;height:100vh;max-height:none;border-radius:0;display:flex;flex-direction:column;overflow:hidden;box-shadow:none">
      <div class="modal-header" style="padding:12px 20px 10px;border-bottom:1px solid #bfdbfe;background:linear-gradient(180deg,#eff6ff 0%,#ffedd5 100%);flex-shrink:0;min-height:auto">
        <div>
          <div class="modal-title" id="view-modal-title" style="font-size:22px;line-height:1.15;font-weight:800;color:#0f172a">Chi tiết form</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:4px" id="view-modal-sub"></div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('view-form-modal')" style="width:34px;height:34px;border-radius:10px;background:#ffffff;border:1px solid #93c5fd;color:#1d4ed8">${IC.close}</button>
      </div>
      <div id="view-modal-body" style="padding:28px 32px;overflow-y:auto;flex:1;background:linear-gradient(180deg,#eff6ff 0%,#fff7ed 100%)"></div>
      <div style="padding:8px 20px;border-top:1px solid #bfdbfe;display:flex;justify-content:flex-end;align-items:center;background:linear-gradient(180deg,#fffaf5 0%,#eff6ff 100%);flex-shrink:0">
        <button class="btn btn-outline btn-sm" onclick="closeModal('view-form-modal')">Đóng</button>
      </div>
    </div>
  </div>
`);

document.getElementById('page-content').insertAdjacentHTML('beforeend', `
  <div class="modal-overlay" id="share-form-modal" onclick="closeModal('share-form-modal')">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:640px;border-radius:14px">
      <div class="modal-header">
        <div>
          <div class="modal-title">Chia sẻ form</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px" id="share-modal-sub">Tạo link công khai đẹp để gửi cho học viên</div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('share-form-modal')">${IC.close}</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
        <div style="padding:14px 16px;border:1px solid #dbeafe;background:#f8fbff;border-radius:12px">
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:6px" id="share-form-name">Biểu mẫu</div>
          <div style="font-size:12.5px;color:var(--gray-500)" id="share-form-desc">Link này sẽ mở một trang biểu mẫu công khai với phần thông tin người học ở đầu form.</div>
        </div>

        <div>
          <label class="form-label" style="margin-bottom:8px">Link chia sẻ</label>
          <div style="display:flex;gap:8px">
            <input id="share-link-input" class="input" readonly style="font-size:12.5px;background:#f8fafc" />
            <button class="btn btn-outline" onclick="copyShareLink()">Sao chép</button>
            <button class="btn btn-primary" onclick="openShareLink()">Mở link</button>
          </div>
          <div style="margin-top:10px">
            <button id="shorten-btn" class="btn btn-outline" onclick="shortenAndCopyLink()" style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:#7c3aed;border-color:#c4b5fd">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              Rút gọn
            </button>
            <div id="shortened-link-wrap" style="display:none;margin-top:8px">
              <div style="display:flex;gap:8px;align-items:center">
                <input id="shortened-link-input" class="input" readonly style="font-size:12.5px;background:#f8fafc;color:#7c3aed;font-weight:600" />
                <button class="btn btn-outline" onclick="copyShortenedLink()" style="font-size:12.5px;color:#7c3aed;border-color:#c4b5fd;white-space:nowrap">Sao chép</button>
              </div>
            </div>
          </div>
        </div>


      </div>
      <div style="padding:12px 20px;border-top:1px solid var(--gray-200);display:flex;justify-content:flex-end">
        <button class="btn btn-outline" onclick="closeModal('share-form-modal')">Đóng</button>
      </div>
    </div>
  </div>
`);

function openShareModal(formId) {
  const form = FORMS.find((f) => String(f.id) === String(formId));
  if (!form) return;

  const link = buildPublicFormLink(formId);
  document.getElementById('share-form-name').textContent = form.name || 'Biểu mẫu';
  document.getElementById('share-form-desc').textContent = `Danh mục: ${form.cat || 'Khác'} • Link public có sẵn phần thông tin học viên ở đầu form.`;
  document.getElementById('share-link-input').value = link;
  document.getElementById('share-form-modal').dataset.link = link;
  openModal('share-form-modal');
}

async function copyShareLink() {
  const input = document.getElementById('share-link-input');
  const value = input?.value?.trim();
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    showToast('Đã sao chép link chia sẻ', 'success');
  } catch (error) {
    input.select();
    document.execCommand('copy');
    showToast('Đã sao chép link chia sẻ', 'success');
  }
}

function openShareLink() {
  const value = document.getElementById('share-link-input')?.value?.trim();
  if (!value) return;
  window.open(value, '_blank', 'noopener,noreferrer');
}

async function _doShortenLink(url) {
  // Dùng TinyURL API (không cần key)
  try {
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const short = await res.text();
      if (short && short.startsWith('http')) return short.trim();
    }
  } catch(e) {}
  // Fallback: is.gd
  try {
    const res2 = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
    if (res2.ok) {
      const short2 = await res2.text();
      if (short2 && short2.startsWith('http')) return short2.trim();
    }
  } catch(e) {}
  return null;
}

async function shortenAndCopyLink() {
  const url = document.getElementById('share-link-input')?.value?.trim();
  if (!url) return;
  const btn = document.getElementById('shorten-btn');
  if (btn) { btn.textContent = 'Đang rút gọn...'; btn.disabled = true; }
  const short = await _doShortenLink(url);
  if (btn) { btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> Rút gọn'; btn.disabled = false; }
  if (!short) { showToast('Không rút gọn được link, kiểm tra kết nối!', 'error'); return; }
  const wrap = document.getElementById('shortened-link-wrap');
  const input = document.getElementById('shortened-link-input');
  if (wrap) wrap.style.display = 'block';
  if (input) input.value = short;
  showToast('Đã rút gọn link!', 'success');
}

async function copyShortenedLink() {
  const val = document.getElementById('shortened-link-input')?.value?.trim();
  if (!val) return;
  try { await navigator.clipboard.writeText(val); } catch(e) { document.getElementById('shortened-link-input')?.select(); document.execCommand('copy'); }
  showToast('Đã sao chép link rút gọn!', 'success');
}

async function shortenLinkForForm(formId) {
  const url = buildPublicFormLink(formId);
  showToast('Đang rút gọn link...', 'default');
  const short = await _doShortenLink(url);
  if (!short) { showToast('Không rút gọn được link!', 'error'); return; }
  try { await navigator.clipboard.writeText(short); } catch(e) {}
  showToast('Đã sao chép link rút gọn: ' + short, 'success');
}

async function openViewModal(id) {
  const f = FORMS.find(f => f.id === id);
  if (!f) return;

  // Cập nhật tiêu đề
  document.getElementById('view-modal-title').textContent = f.name;
  document.getElementById('view-modal-sub').textContent = `${f.cat} · Ngày tạo: ${f.created}`;
  document.getElementById('view-modal-body').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:40px 0;color:var(--gray-400)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-dasharray="28" stroke-dashoffset="10"/></svg>
      <span style="margin-left:10px;font-size:14px">Đang tải câu hỏi...</span>
    </div>`;
  openModal('view-form-modal');

  // Gọi API lấy câu hỏi
  let questions = [];
  try {
    const tkn4 = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/forms/${id}`, {
      headers: tkn4 ? { Authorization: `Bearer ${tkn4}` } : {}
    });
    if (res.ok) {
      const data = await res.json();
      questions = data.cau_hoi || [];
    }
  } catch(e) {
    // Fallback: dùng câu hỏi local nếu form mới tạo
    questions = (f.questions || []).map((q, i) => ({
      id: i + 1, noi_dung: q.text, loai: q.type,
      bat_buoc: q.bat_buoc || false,
      lua_chon: (q.opts || []).map((o, j) => ({ noi_dung: o, thu_tu: j + 1 }))
    }));
  }

  const renderViewAnswer = (question) => {
    const normalizedType = normalizeQuestionType(question.loai);
    const options = (question.lua_chon || []).map(o => o.noi_dung || o).filter(Boolean);
    if (normalizedType === 'short_text') {
      return `<div style="max-width:420px"><div style="font-size:12.5px;color:#64748b;margin-bottom:8px">Câu trả lời ngắn</div><div style="height:42px;border-bottom:2px solid #cbd5e1;background:linear-gradient(180deg,rgba(255,255,255,.8),rgba(255,255,255,.95));border-radius:10px 10px 0 0"></div></div>`;
    }
    if (normalizedType === 'long_text') {
      return `<div><div style="font-size:12.5px;color:#64748b;margin-bottom:8px">Câu trả lời dài</div><div style="height:92px;border:1.5px solid #dbe4f0;background:rgba(255,255,255,.92);border-radius:14px;position:relative;overflow:hidden"><div style="position:absolute;left:18px;right:18px;top:20px;height:1px;background:#d7dee8"></div><div style="position:absolute;left:18px;right:18px;top:46px;height:1px;background:#d7dee8"></div><div style="position:absolute;left:18px;right:18px;top:72px;height:1px;background:#d7dee8"></div></div></div>`;
    }
    if (normalizedType === 'choice') {
      return `<div style="display:flex;flex-direction:column;gap:10px">${options.map((option, index) => `<label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #dbe4f0;border-radius:12px;background:rgba(255,255,255,.92)"><span style="width:18px;height:18px;border-radius:50%;border:2px solid #60a5fa;flex-shrink:0"></span><span style="font-size:14px;color:#334155">${option || `Lựa chọn ${index + 1}`}</span></label>`).join('')}</div>`;
    }
    if (normalizedType === 'checkbox') {
      return `<div style="display:flex;flex-direction:column;gap:10px">${options.map((option, index) => `<label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #dbe4f0;border-radius:12px;background:rgba(255,255,255,.92)"><span style="width:18px;height:18px;border-radius:5px;border:2px solid #f59e0b;flex-shrink:0"></span><span style="font-size:14px;color:#334155">${option || `Lựa chọn ${index + 1}`}</span></label>`).join('')}</div>`;
    }
    if (normalizedType === 'dropdown') {
      return `<div style="max-width:360px"><div style="padding:12px 14px;border:1px solid #dbe4f0;border-radius:12px;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:space-between;color:#64748b"><span>Chọn một mục</span><span style="font-size:16px">▾</span></div>${options.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">${options.map(option => `<span style="padding:6px 10px;border-radius:999px;background:#fff7ed;border:1px solid #fed7aa;font-size:12.5px;color:#9a3412">${option}</span>`).join('')}</div>` : ''}</div>`;
    }
    if (normalizedType === 'rating' || normalizedType === 'star_rating') {
      return `<div style="display:flex;flex-wrap:wrap;gap:10px">${options.map((option, index) => `<div style="min-width:72px;padding:12px 10px;border-radius:14px;border:1px solid #fed7aa;background:linear-gradient(180deg,#fffdf7 0%,#fff7ed 100%);text-align:center"><div style="font-size:22px;color:#f59e0b;line-height:1;margin-bottom:8px">${normalizedType === 'star_rating' ? '★' : index + 1}</div><div style="font-size:12.5px;color:#9a3412;font-weight:600">${option}</div></div>`).join('')}</div>`;
    }
    if (normalizedType === 'grid_radio' || normalizedType === 'grid_checkbox') {
      const rows = question.hang || question.rows || ['Hàng 1'];
      const cols = question.cot || question.cols || ['Cột 1'];
      const control = normalizedType === 'grid_radio'
        ? '<span style="width:16px;height:16px;border-radius:50%;border:2px solid #60a5fa;display:inline-block"></span>'
        : '<span style="width:16px;height:16px;border-radius:4px;border:2px solid #f59e0b;display:inline-block"></span>';
      return `<div style="overflow:auto"><table style="width:100%;min-width:520px;border-collapse:separate;border-spacing:0 8px"><thead><tr><th style="text-align:left;padding:0 12px 6px;color:#64748b;font-size:12px;font-weight:700"></th>${cols.map(col => `<th style="text-align:center;padding:0 12px 6px;color:#0369a1;font-size:12px;font-weight:700">${col}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr><td style="padding:14px 12px;background:rgba(255,255,255,.92);border:1px solid #dbe4f0;border-right:none;border-radius:12px 0 0 12px;font-size:14px;font-weight:600;color:#334155">${row}</td>${cols.map(() => `<td style="padding:14px 12px;background:rgba(255,255,255,.92);border-top:1px solid #dbe4f0;border-bottom:1px solid #dbe4f0;text-align:center">${control}</td>`).join('')}<td style="width:1px;padding:0;background:transparent;border:none"></td></tr>`).join('')}</tbody></table></div>`;
    }
    return `<div style="font-size:13px;color:#94a3b8">Không có dữ liệu xem trước.</div>`;
  };

  if (!questions.length) {
    document.getElementById('view-modal-body').innerHTML = `
      <div style="text-align:center;padding:40px 0;color:var(--gray-400)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40" style="margin:0 auto 12px;display:block;opacity:.4"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div style="font-size:14px">Form này chưa có câu hỏi nào</div>
      </div>`;
    return;
  }

  document.getElementById('view-modal-body').innerHTML = `
    <div style="max-width:980px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#bae6fd 0%,#dbeafe 50%,#c7d2fe 100%);border-radius:30px;min-height:180px;position:relative;overflow:hidden;box-shadow:0 24px 48px rgba(59,130,246,.16)">
        <div style="position:absolute;inset:0;background-image:url('${(f.img || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1400&h=700&fit=crop').replace(/'/g, '%27')}');background-size:cover;background-position:center;filter:saturate(1.05) contrast(1.02);transform:scale(1.03)"></div>
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(219,234,254,.92) 0%,rgba(224,242,254,.84) 42%,rgba(199,210,254,.9) 100%)"></div>
        <div style="position:absolute;inset:0;background:radial-gradient(circle at top right, rgba(255,255,255,.32), transparent 34%),radial-gradient(circle at bottom left, rgba(255,255,255,.22), transparent 28%)"></div>
        <div style="position:relative;padding:28px 30px;color:#fff;display:flex;flex-direction:column;justify-content:flex-end;min-height:140px">
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
            <span style="padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.36);font-size:12px;font-weight:700;color:#1d4ed8">${f.cat || 'Khác'}</span>
            <span style="padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.36);font-size:12px;font-weight:700;color:#1d4ed8">Tổng ${questions.length} câu hỏi</span>
          </div>
          <div style="font-size:42px;line-height:1.08;font-weight:800;letter-spacing:-0.02em;color:#1e3a8a">${f.name}</div>
          <div style="font-size:16px;opacity:.92;margin-top:12px;color:#1d4ed8">Mẫu hiển thị trực tiếp của biểu mẫu, dùng để xem nhanh nội dung trước khi chia sẻ hoặc chỉnh sửa.</div>
        </div>
      </div>
      <div style="padding:18px 8px 14px;font-size:14px;color:#1d4ed8">Ngày tạo: <strong style="color:#c2410c">${f.created}</strong></div>
      <div style="display:flex;flex-direction:column;gap:16px;padding-bottom:28px">
      ${questions.map((q, i) => `
        <div style="border:1px solid #bfdbfe;border-radius:22px;padding:20px 20px 22px;background:linear-gradient(180deg,rgba(255,255,255,.96) 0%,rgba(255,247,237,.95) 100%);backdrop-filter:blur(8px);box-shadow:0 12px 26px rgba(37,99,235,.08)">
          <div style="display:flex;align-items:flex-start;gap:14px">
            <div style="width:36px;height:36px;border-radius:50%;background:#dbeafe;color:#1d4ed8;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">${i + 1}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
                <span style="display:inline-flex;align-items:center;padding:6px 11px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700">${TYPE_LABEL_MAP[normalizeQuestionType(q.loai)] || normalizeQuestionType(q.loai)}</span>
                ${q.bat_buoc ? '<span style="display:inline-flex;align-items:center;padding:6px 11px;border-radius:999px;background:#ffedd5;color:#c2410c;font-size:12px;font-weight:700">Bắt buộc</span>' : '<span style="display:inline-flex;align-items:center;padding:6px 11px;border-radius:999px;background:#eff6ff;color:#2563eb;font-size:12px;font-weight:700">Không bắt buộc</span>'}
              </div>
              <div style="font-size:21px;font-weight:700;color:#0f172a;margin-bottom:14px;line-height:1.45">
                ${q.noi_dung}
              </div>
              ${renderViewAnswer(q)}
            </div>
          </div>
        </div>
      `).join('')}
      </div>
    </div>`;
}

async function saveEditForm() {
  const id = document.getElementById('edit-form-id').value;
  const name = document.getElementById('edit-form-name').value.trim();
  const cat = document.getElementById('edit-form-cat').value;
  const sv = document.getElementById('edit-form-status').value;
  const loiKet = document.getElementById('edit-form-loi-ket')?.value?.trim() || '';
  if (!sv) {
    showToast('Vui lòng chọn trạng thái!', 'error');
    document.getElementById('edit-form-status').focus();
    return;
  }

  if (!name) {
    showToast('Vui lòng nhập tên form!', 'error');
    document.getElementById('edit-form-name').focus();
    return;
  }
  if (!cat) {
    showToast('Vui lòng chọn danh mục!', 'error');
    return;
  }

  for (let i = 0; i < editFormQuestions.length; i++) {
    const q = editFormQuestions[i];
    if (!q.text.trim()) {
      showToast(`Câu hỏi ${i + 1} chưa có nội dung!`, 'error');
      return;
    }
    const needsOpts = ['choice', 'checkbox', 'dropdown'];
    if (needsOpts.includes(q.type) && !(q.opts || []).some(o => String(o).trim())) {
      showToast(`Câu hỏi ${i + 1} cần ít nhất 1 lựa chọn!`, 'error');
      return;
    }
  }

  const status = sv || 'draft';
  const chosenQuestions = editFormQuestions.map(q => ({
    ...q,
    opts: (q.opts || []).filter(o => String(o).trim()),
  }));
  const previousStatus = FORMS.find(f => String(f.id) === String(id))?.status || '';

  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/forms/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        ten_form: name,
        danh_muc: cat,
        trang_thai: status,
        loi_ket: loiKet,
        cau_hoi: chosenQuestions.map(q => ({
          noi_dung: q.text,
          loai: q.type,
          bat_buoc: q.required || false,
          lua_chon: q.opts || [],
        })),
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Lưu biểu mẫu thất bại');
    }
  } catch (e) {
    showToast(e.message || 'Lỗi kết nối server!', 'error');
    return;
  }

  const idx = FORMS.findIndex(f => String(f.id) === String(id));
  if (idx !== -1) {
    FORMS[idx] = { ...FORMS[idx], name, cat, status, loi_ket: loiKet, questions: chosenQuestions };
    filtered = filtered.map(f => String(f.id) === String(id) ? FORMS[idx] : f);
    renderGrid(filtered);
  }

  const rejectedCtx = getRejectedEditContext();
  if (rejectedCtx.approvalId && String(rejectedCtx.formId) === String(id)) {
    try {
      const token = localStorage.getItem('token') || '';
      const resubmitRes = await fetch(`${API_BASE}/approvals/${rejectedCtx.approvalId}/resubmit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
      });
      const resubmitData = await resubmitRes.json().catch(() => ({}));
      if (!resubmitRes.ok) {
        throw new Error(resubmitData.message || 'Không gửi lại được yêu cầu phê duyệt');
      }
      syncResubmittedApprovalLocal(rejectedCtx.approvalId, id, name, cat, chosenQuestions);
      closeModal('edit-form-modal');
      showToast(`Đã cập nhật form "${name}" và gửi duyệt lại`, 'success');
      setTimeout(() => {
        window.location.href = 'approval.html';
      }, 500);
      return;
    } catch (e) {
      showToast(e.message || 'Không gửi lại được yêu cầu phê duyệt', 'error');
      return;
    }
  }

  if (status === 'pending') {
    try {
      const approvalResult = await createApprovalRequest(Number(id), null);
      cacheLocalApprovalItem({
        approvalId: approvalResult.id || id,
        formId: id,
        formName: name,
        cat,
        note: '',
        questions: chosenQuestions,
      });
      closeModal('edit-form-modal');
      showToast(`Đã cập nhật form "${name}" và gửi duyệt`, 'success');
      return;
    } catch (e) {
      const msg = String(e.message || '');
      if (msg.includes('đang có yêu cầu chờ phê duyệt')) {
        cacheLocalApprovalItem({
          approvalId: id,
          formId: id,
          formName: name,
          cat,
          note: '',
          questions: chosenQuestions,
        });
        closeModal('edit-form-modal');
        showToast(`Form "${name}" đã nằm trong hàng chờ phê duyệt`, 'success');
        return;
      }
      try {
        await updateFormStatusOnly(Number(id), previousStatus || 'draft');
        if (idx !== -1) {
          FORMS[idx].status = previousStatus || 'draft';
          filtered = filtered.map(f => String(f.id) === String(id) ? FORMS[idx] : f);
          renderGrid(filtered);
        }
      } catch (_) {}
      showToast(e.message || 'Không tạo được yêu cầu phê duyệt', 'error');
      return;
    }
  }

  closeModal('edit-form-modal');
  showToast(`Đã cập nhật form "${name}"`, 'success');
  // Reload lại từ API để đồng bộ
  loadForms().then(fresh => { FORMS = fresh; filtered = [...FORMS]; renderGrid(filtered); }).catch(() => {});
}
// ── Standalone create page (form-create.html) ──────────────────
// Chỉ chạy khi đang ở trang form-create.html, không ảnh hưởng form-management.html
if (window.location.pathname.includes('form-create')) (function initStandaloneCreatePage() {
  const pageContent = document.getElementById('page-content');
  const createOverlay = document.getElementById('create-form-modal');
  const previewModal = document.getElementById('form-preview-modal');
  if (!pageContent || !createOverlay) return;

  const createModal = createOverlay.querySelector('.modal');
  const createMarkup = createModal ? createModal.outerHTML : '';
  const previewMarkup = previewModal ? previewModal.outerHTML : '';

  pageContent.innerHTML = `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="window.location.href='form-management.html'" style="padding-inline:12px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Quay lại
          </button>
          <span class="badge" style="background:#e0f2fe;color:#0369a1">Trang tạo form</span>
        </div>
        <h2 class="page-title">Tạo biểu mẫu mới</h2>
        <p class="page-sub">Người dùng có thể tập trung thêm câu hỏi và cấu hình form trên một trang riêng thay vì popup.</p>
      </div>
    </div>

    <div style="max-width:1120px;margin:0 auto">
      <div id="form-create-card" class="card" style="border-radius:20px;overflow:hidden;border:1px solid #dbe5f0;box-shadow:0 16px 40px rgba(15,23,42,.06);background:#fff">
        ${createMarkup}
      </div>
    </div>
    ${previewMarkup}
  `;

  const standalonePreviewModal = document.getElementById('form-preview-modal');
  if (standalonePreviewModal) {
    standalonePreviewModal.style.zIndex = '1300';
    document.body.appendChild(standalonePreviewModal);
  }

  const cardModal = pageContent.querySelector('#form-create-card .modal');
  if (cardModal) {
    cardModal.removeAttribute('onclick');
    cardModal.style.maxWidth = 'none';
    cardModal.style.width = '100%';
    cardModal.style.borderRadius = '0';
    cardModal.style.boxShadow = 'none';
    cardModal.style.border = 'none';
    cardModal.style.display = 'flex';
    cardModal.style.flexDirection = 'column';
  }

  const modalScroll = pageContent.querySelector('#modal-scroll');
  if (modalScroll) {
    modalScroll.style.maxHeight = 'none';
    modalScroll.style.overflow = 'visible';
    modalScroll.style.padding = '0 24px 12px';
  }

  const expandBtn = pageContent.querySelector('#expand-form-btn');
  if (expandBtn) expandBtn.remove();

  selectedQuestions = new Set();
  directQuestions = [];

  const nameInput = document.getElementById('new-form-name');
  const descInput = document.getElementById('new-form-desc');
  const catInput = document.getElementById('new-form-cat');
  const noteInput = document.getElementById('new-form-note');
  const loiKetInput = document.getElementById('new-form-loi-ket');
  const closeInput = document.getElementById('new-form-close');
  const noCloseInput = document.getElementById('new-form-no-close');
  const descCount = document.getElementById('desc-count');
  const noteCount = document.getElementById('note-count');
  const loiKetCount = document.getElementById('loi-ket-count');

  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
  if (catInput) catInput.value = '';
  if (noteInput) noteInput.value = '';
  if (loiKetInput) {
    const savedLoiKet = localStorage.getItem(NEW_FORM_LOI_KET_DRAFT_KEY) || '';
    loiKetInput.value = savedLoiKet;
    if (loiKetCount) {
      loiKetCount.textContent = savedLoiKet.length + '/300';
      loiKetCount.style.color = savedLoiKet.length > 250 ? 'var(--red)' : 'var(--gray-400)';
    }
  }
  if (closeInput) {
    closeInput.value = '';
    closeInput.disabled = false;
    closeInput.style.opacity = '1';
  }
  if (noCloseInput) noCloseInput.checked = false;
  if (descCount) descCount.textContent = '0/100';
  if (noteCount) noteCount.textContent = '0/50';

  renderQList();
  renderDirectQList();
})();