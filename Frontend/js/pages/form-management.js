// --- FORM MANAGEMENT - State (mirrors React source) ---

// -- Thông rác helpers ----------------------------------
// loadTrash / saveTrash được định nghĩa trong trash.js (dùng chung key 'flic_trash_forms')
const LS_TRASH = 'flic_trash_forms'; // alias cho TRASH_LS_KEY
const NEW_FORM_LOI_KET_DRAFT_KEY = 'flic_new_form_loi_ket_draft';
const FORM_QUESTION_MEDIA_CACHE_KEY = 'flic_form_question_media_cache';
const FORM_ITEMS_CACHE_KEY = 'flic_form_items_cache';
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

function loadFormQuestionMediaCache() {
  try {
    const raw = localStorage.getItem(FORM_QUESTION_MEDIA_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    let changed = false;
    Object.keys(parsed).forEach(formId => {
      if (!Array.isArray(parsed[formId])) return;
      parsed[formId] = parsed[formId].map(item => {
        if (isVideoDataUrl(item?.video)) {
          changed = true;
          return { ...item, video: '' };
        }
        return item;
      });
    });
    if (changed) localStorage.setItem(FORM_QUESTION_MEDIA_CACHE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch(e) {
    return {};
  }
}

function saveFormQuestionMediaCache(formId, items) {
  const cachedItems = (items || [])
    .filter(q => !isSectionItem(q))
    .map((q, index) => ({
      index,
      text: q.text || q.noi_dung || '',
      image: q.image || q.image_url || q.hinh_anh_url || '',
      video: isVideoDataUrl(q.video || q.video_url) ? '' : (q.video || q.video_url || ''),
      rows: getGridRows(q),
      cols: getGridCols(q),
    }))
    .filter(item => item.image || item.video || item.rows.length || item.cols.length);

  const cache = loadFormQuestionMediaCache();
  if (cachedItems.length) cache[String(formId)] = cachedItems;
  else delete cache[String(formId)];
  try {
    localStorage.setItem(FORM_QUESTION_MEDIA_CACHE_KEY, JSON.stringify(cache));
  } catch(e) {}
}

function mergeQuestionMediaCache(formId, questions) {
  const cached = loadFormQuestionMediaCache()[String(formId)];
  if (!Array.isArray(cached) || !cached.length) return questions;

  let realIndex = -1;
  return (questions || []).map(q => {
    if (isSectionItem(q)) return q;
    realIndex += 1;
    const currentImage = q.hinh_anh_url || q.image_url || q.image || '';
    const currentVideo = isVideoDataUrl(q.video_url || q.video) ? '' : (q.video_url || q.video || '');
    const currentRows = getGridRows(q);
    const currentCols = getGridCols(q);

    const byIndex = cached.find(item => item.index === realIndex);
    const text = q.noi_dung || q.text || '';
    const byText = cached.find(item => item.text && item.text === text);
    const media = byIndex || byText;
    if (!media) return q;

    return {
      ...q,
      hinh_anh_url: currentImage || media.image || '',
      video_url: currentVideo || (isVideoDataUrl(media.video) ? '' : media.video) || '',
      image: q.image || currentImage || media.image || '',
      video: isVideoDataUrl(q.video) ? '' : (q.video || currentVideo || (isVideoDataUrl(media.video) ? '' : media.video) || ''),
      rows: currentRows.length ? currentRows : (media.rows || []),
      cols: currentCols.length ? currentCols : (media.cols || []),
      hang: currentRows.length ? currentRows : (q.hang || media.rows || []),
      cot: currentCols.length ? currentCols : (q.cot || media.cols || []),
    };
  });
}

function mergeQuestionLocalFallback(questions, localItems) {
  const localQuestions = (localItems || []).filter(item => !isSectionItem(item));
  if (!localQuestions.length) return questions;

  let realIndex = -1;
  return (questions || []).map(q => {
    if (isSectionItem(q)) return q;
    realIndex += 1;

    const rows = getGridRows(q);
    const cols = getGridCols(q);
    if (rows.length && cols.length) return q;

    const text = q.noi_dung || q.text || '';
    const local = localQuestions[realIndex] || localQuestions.find(item => (item.text || item.noi_dung || '') === text);
    if (!local) return q;

    return {
      ...q,
      rows: rows.length ? rows : getGridRows(local),
      cols: cols.length ? cols : getGridCols(local),
      hang: rows.length ? rows : getGridRows(local),
      cot: cols.length ? cols : getGridCols(local),
    };
  });
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
// --------------------------------------------------------

// Dữ liệu mặc định (seed)
const DEFAULT_FORMS = [
  {id:'1',name:'Đăng ký khóa học Tiếng Anh giao tiếp',cat:'Ngoại ngữ',created:'10/03/2026',status:'active',by:'Nguyễn Văn A',initials:'N',img:'https://images.unsplash.com/photo-1546410531-bb4caa6b424đểw=400&h=200&fit=crop',color:'#00008B'},
  {id:'2',name:'Khảo sát mức độ hài lòng học viên',cat:'Ngoại ngữ',created:'08/03/2026',status:'active',by:'Trần Thị B',initials:'T',img:'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=200&fit=crop',color:'#8b5cf6'},
  {id:'3',name:'Đăng ký thi chứng chỉ Tin học',cat:'Tin học',created:'05/03/2026',status:'active',by:'Lê Văn C',initials:'L',img:'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=200&fit=crop',color:'#f97316'},
  {id:'4',name:'Phiếu đánh giá giảng viên',cat:'Ngoại ngữ',created:'03/03/2026',status:'draft',by:'Phạm Thị D',initials:'P',img:'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=200&fit=crop',color:'#ec4899'},
  {id:'5',name:'Đăng ký học thử miễn phí',cat:'Ngoại ngữ',created:'01/03/2026',status:'active',by:'Hoàng Văn E',initials:'H',img:'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=200&fit=crop',color:'#10b981'},
  {id:'6',name:'Feedback chương trình học',cat:'Ngoại ngữ',created:'15/12/2025',status:'draft',by:'Vũ Thị F',initials:'V',img:'https://images.unsplash.com/photo-1517842645767-c639042777db?w=400&h=200&fit=crop',color:'#64748b'},
  {id:'7',name:'Đăng ký tư vấn lộ trình học',cat:'Ngoại ngữ',created:'25/02/2026',status:'active',by:'Đỗ Văn G',initials:'Đ',img:'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=200&fit=crop',color:'#00008B'},
  {id:'8',name:'Khảo sát nhu cầu mở lớp mới',cat:'Ngoại ngữ',created:'20/02/2026',status:'active',by:'Ngô Thị H',initials:'N',img:'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=400&h=200&fit=crop',color:'#f59e0b'},
];

// -- API helpers ------------------------------------------
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

function normalizeLibraryCategory(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('tin')) return 'Tin học';
  if (text.includes('ngoại') || text.includes('ngoai')) return 'Ngoại ngữ';
  return value || 'Ngoại ngữ';
}

function normalizeSurveyTarget(value) {
  const raw = String(value || '').trim();
  const text = raw.toLowerCase();
  if (!raw || text === 'all' || text === 'tat ca' || text === 'tất cả') return 'Tất cả';
  if (text.includes('sinh')) return 'Sinh viên';
  if (text.includes('làm') || text.includes('lam') || text.includes('đi làm') || text.includes('di lam')) return 'Người đi làm';
  return raw;
}

function normalizeLibrarySurveyType(value) {
  return String(value || '').trim();
}

const FORM_CATEGORY_COLORS = {
  'Ngoại ngữ': '#f97316',
  'Tin học': '#00008B',
};
const SURVEY_TYPES_BY_CATEGORY = {
  'Ngoại ngữ': ['VSTEP', 'TOEIC'],
  'Tin học': ['CNTT Cơ bản', 'CNTT Nâng cao', 'Tableau', 'Python', 'MOS', 'IC3'],
};
const ALL_SURVEY_TYPES = Object.values(SURVEY_TYPES_BY_CATEGORY).flat();
const UNTITLED_FORM_NAME = 'Biểu mẫu không có tiêu đề';
const DEFAULT_DRAFT_CATEGORY = 'Ngoại ngữ';
const DEFAULT_FORM_THEME = {
  headerFont: 'Be Vietnam Pro',
  headerSize: 24,
  questionFont: 'Be Vietnam Pro',
  questionSize: 14,
  textFont: 'Be Vietnam Pro',
  textSize: 13,
  color: '#00008B',
  background: '#ffffff',
  headerImage: ''
};
const DEFAULT_PREVIEW_THEME = {
  ...DEFAULT_FORM_THEME,
  background: '#eef5ff'
};
const LEGACY_DEFAULT_BACKGROUNDS = new Set(['', '#ffffff', '#fff', '#f0f4f9']);
let createFormTheme = { ...DEFAULT_FORM_THEME };
let createHistoryStack = [];
let createRedoStack = [];
let createHistoryTimer = null;
let createCollaborators = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function loadFormItemsCache() {
  try {
    const raw = localStorage.getItem(FORM_ITEMS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch(e) {
    return {};
  }
}

function saveFormItemsCache(formId, items) {
  const cache = loadFormItemsCache();
  const cleaned = cloneForHistory(items || []);
  if (cleaned.length) cache[String(formId)] = cleaned;
  else delete cache[String(formId)];
  try { localStorage.setItem(FORM_ITEMS_CACHE_KEY, JSON.stringify(cache)); } catch(e) {}
}

function getFormItemsCache(formId) {
  const cached = loadFormItemsCache()[String(formId)];
  return Array.isArray(cached) ? cached : [];
}

function normalizeLocalItemsForPreview(items) {
  return (items || []).map((q, index) => {
    if (isSectionItem(q)) {
      return {
        ...q,
        id: q.id || `section-local-${index}`,
        loai: 'section',
        type: 'section',
        _isSection: true,
        title: q.title || q.noi_dung || '',
        desc: q.desc || q.description || q.mo_ta_cau_hoi || '',
      };
    }
    const type = normalizeQuestionType(q.type || q.loai || 'choice');
    const opts = Array.isArray(q.opts)
      ? q.opts
      : Array.isArray(q.lua_chon)
      ? q.lua_chon.map(o => o.noi_dung || o)
      : [];
    return {
      ...q,
      id: q.id || `local-q-${index}`,
      noi_dung: q.noi_dung || q.text || '',
      text: q.text || q.noi_dung || '',
      loai: type,
      type,
      bat_buoc: q.bat_buoc ?? q.required ?? false,
      required: q.required ?? q.bat_buoc ?? false,
      lua_chon: opts.map((o, i) => typeof o === 'string' ? { noi_dung: o, thu_tu: i + 1 } : o),
      opts: opts.map(o => typeof o === 'string' ? o : (o.noi_dung || '')),
      hinh_anh_url: q.hinh_anh_url || q.image_url || q.image || '',
      video_url: q.video_url || q.video || '',
      rows: getGridRows(q),
      cols: getGridCols(q),
      allowOther: questionAllowsOther({ ...q, type }),
      allow_other: questionAllowsOther({ ...q, type }),
    };
  });
}

function getSurveyTypesForCategory(category) {
  if (!String(category || '').trim()) return ALL_SURVEY_TYPES;
  const normalizedCategory = normalizeLibraryCategory(category || '');
  return SURVEY_TYPES_BY_CATEGORY[normalizedCategory] || ALL_SURVEY_TYPES;
}

function getDefaultSurveyType(category) {
  return getSurveyTypesForCategory(category)[0] || '';
}

function syncCreateSurveyTypes() {
  const category = document.getElementById('new-form-cat')?.value || '';
  const select = document.getElementById('new-form-survey-type');
  if (!select) return;
  const previous = select.value;
  const types = getSurveyTypesForCategory(category);
  select.innerHTML = `<option value="">Chọn loại khảo sát</option>${types.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('')}`;
  if (previous && types.includes(previous)) {
    select.value = previous;
  }
}

function syncEditSurveyTypes(nextValue = '') {
  const category = document.getElementById('edit-form-cat')?.value || '';
  const select = document.getElementById('edit-form-survey-type');
  if (!select) return;
  const previous = nextValue || select.value;
  const types = getSurveyTypesForCategory(category);
  select.innerHTML = `<option value="">Chọn loại khảo sát</option>${types.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('')}`;
  if (previous && types.includes(previous)) {
    select.value = previous;
  }
}

function getFormCategoryColor(value) {
  return FORM_CATEGORY_COLORS[normalizeLibraryCategory(value)] || FORM_CATEGORY_COLORS['Ngoại ngữ'];
}

function normalizeLibraryQuestion(raw) {
  const category = normalizeLibraryCategory(raw.bo_mon || raw.category);
  const surveyType = normalizeLibrarySurveyType(raw.loai_khao_sat || raw.survey_type || raw.ten_loai || raw.ten_loai_khao_sat || raw.loaiKhaoSat);
  const target = normalizeSurveyTarget(raw.doi_tuong || raw.target || raw.doiTuong);
  const type = normalizeQuestionType(raw.type || raw.loai || 'choice');
  const allowOther = questionAllowsOther({ ...raw, type });
  return {
    ...raw,
    id: raw.id,
    text: raw.text || raw.noi_dung || '',
    type,
    opts: Array.isArray(raw.opts) ? raw.opts : Array.isArray(raw.lua_chon) ? raw.lua_chon : [],
    rows: Array.isArray(raw.rows) ? raw.rows : Array.isArray(raw.hang) ? raw.hang : [],
    cols: Array.isArray(raw.cols) ? raw.cols : Array.isArray(raw.cot) ? raw.cot : [],
    required: !!(raw.required || raw.bat_buoc),
    bat_buoc: !!(raw.required || raw.bat_buoc),
    allowOther,
    allow_other: allowOther,
    bo_mon: category,
    category,
    loai_khao_sat: surveyType,
    survey_type: surveyType,
    doi_tuong: target,
    target,
  };
}

let libraryFetchPromise = null;
let libraryCountReady = false;

function setLibraryCountLabel(value) {
  const countEl = document.getElementById('q-total-count');
  if (countEl) countEl.textContent = value;
  const editCountEl = document.getElementById('edit-lib-total-count');
  if (editCountEl) editCountEl.textContent = value;
}

function updateLibraryCountLabel() {
  setLibraryCountLabel(libraryCountReady ? libraryQuestions.length : '...');
}

// Tải câu hỏi thư viện từ API (gọi sau khi renderLayout xong)
async function fetchLibraryFromAPI({ silent = false } = {}) {
  if (libraryFetchPromise) return libraryFetchPromise;
  libraryFetchPromise = (async () => {
  try {
    const token = localStorage.getItem('token') || '';
    const res   = await fetch(`${API_BASE}/library`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data  = await res.json();
    const flat  = data.map(normalizeLibraryQuestion);
    localStorage.setItem('flic_lib_flat', JSON.stringify(flat));
    libraryQuestions = flat;
    libraryCountReady = true;
    updateLibraryCountLabel();
    renderQList();
    renderEditLibraryList();
    return flat;
  } catch(e) {
    console.warn('Không tải được thư viện câu hỏi từ API:', e);
    libraryCountReady = true;
    updateLibraryCountLabel();
    if (!silent) showToast('Không tải được thư viện câu hỏi từ backend', 'error');
    return libraryQuestions;
  } finally {
    libraryFetchPromise = null;
  }
  })();
  return libraryFetchPromise;
}

function isPastCloseDate(value) {
  if (!value) return false;
  const closeDate = new Date(value);
  if (Number.isNaN(closeDate.getTime())) return false;
  closeDate.setHours(23, 59, 59, 999);
  return closeDate < new Date();
}

function resolveFormStatus(form) {
  const rawStatus = String(form?.trang_thai || form?.status || 'draft').toLowerCase();
  if (rawStatus !== 'deleted' && isPastCloseDate(form?.ngay_dong || form?.closeDate)) return 'closed';
  return rawStatus;
}

async function loadForms() {
  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/forms`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.map((f, i) => {
      const rawName = f.nguoi_tao || '';
      // Normalize: "Quản trị viên" ? "Quản lý" (tên trong DB cũ)
      const displayName = (rawName === 'Quản trị viên' || rawName === 'admin' || rawName === 'Admin')
        ? 'Quản lý'
        : (rawName || 'Quản lý');
      const category = normalizeLibraryCategory(f.danh_muc || 'Ngoại ngữ');
      return {
        id: String(f.id),
        name: f.ten_form,
        cat: category,
        loai_khao_sat: f.loai_khao_sat || '',
        status: resolveFormStatus(f),
        created: formatDateForDisplay(f.ngay_tao),
        createdRaw: f.ngay_tao || '',
        closeDate: f.ngay_dong || '',
        updatedRaw: f.ngay_cap_nhat || '',
        responses: Number(f.so_phan_hoi || 0),
        so_cau_hoi: Number(f.so_cau_hoi || 0),
        questionPreview: f.cau_hoi_dau || '',
        views: Number(f.luot_xem || 0),
        by: displayName,
        initials: displayName[0]?.toUpperCase() || 'Q',
        img: f.anh_bia || '',
        color: getFormCategoryColor(category),
        mo_ta: f.mo_ta || '',
        desc: f.mo_ta || '',
        loi_ket: f.loi_ket || '',
        vai_tro: f.vai_tro || 'staff',
        doi_tuong: normalizeSurveyTarget(f.doi_tuong || 'Tất cả'),
        approval_priority: f.approval_priority || f.do_uu_tien || '',
        approval_deadline: f.approval_deadline || f.han_chot_duyet || '',
        anh_bia: f.anh_bia || '',
        mau_nen: f.mau_nen || '',
        font_family: f.font_family || '',
      };
    });
  } catch(e) {
    console.warn('Không thể tải từ API, dùng dữ liệu mặc định:', e);
    return DEFAULT_FORMS.map(f => ({
      ...f,
      cat: normalizeLibraryCategory(f.cat),
      color: getFormCategoryColor(f.cat),
    }));
  }
}
// -----------------------------------------------------------------

let FORMS = [];
let favorites = getFavorites();
function getFavorites(){return new Set(JSON.parse(localStorage.getItem('flic_favorites')||'[]').map(String));}
function saveFavorites(favs) {
  localStorage.setItem('flic_favorites', JSON.stringify([...favs].map(String)));
  favorites = favs;
}
function getCurrentNhanVienId() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.id || 1;
  } catch(e) {
    return 1;
  }
}
async function loadFavoritesFromAPI() {
  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/favorites/${getCurrentNhanVienId()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    saveFavorites(new Set(data.map(item => String(item.form_id || item.id))));
    renderGrid(filtered);
  } catch (err) {
    console.warn('Không thể tải danh sách yêu thích từ API:', err);
    favorites = getFavorites();
    renderGrid(filtered);
  }
}
async function toggleFav(id, e) {
  e.stopPropagation();
  const previousFavs = getFavorites();
  const favs = new Set(previousFavs);
  const sid = String(id);
  const isAdding = !favs.has(sid);
  
  // 1. Đổi UI ngay lập tức cho mượt
  if (isAdding) favs.add(sid); 
  else favs.delete(sid);
  saveFavorites(favs);
  renderGrid(filtered);

  // 2. Gọi API để lưu vào DB
  try {
    const token = localStorage.getItem('token') || '';
    const nhan_vien_id = getCurrentNhanVienId();
    let res;
    
    if (isAdding) {
      res = await fetch(`${API_BASE}/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ nhan_vien_id, form_id: sid })
      });
    } else {
      res = await fetch(`${API_BASE}/favorites/${nhan_vien_id}/${encodeURIComponent(sid)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    }
    if (!res.ok && !(isAdding && res.status === 409)) throw new Error(`HTTP ${res.status}`);
    if (typeof showToast === 'function') showToast(isAdding ? 'Đã thêm vào danh sách yêu thích' : 'Đã bỏ yêu thích', isAdding ? 'success' : 'warning');
  } catch (err) {
    console.error("Lỗi đồng bộ yêu thích API:", err);
    saveFavorites(previousFavs);
    renderGrid(filtered);
    if (typeof showToast === 'function') showToast('Không thể đồng bộ yêu thích với backend', 'error');
  }
}
// Sync favorites từ tab khác (và để xóa từ trang yêu thích)
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
  setTimeout(() => {
    openViewModal(String(ctx.formId));
    clearViewFormQuery();
  }, 120);
}
(async () => {
  FORMS = await loadForms();
  filtered = sortFormsForManagement(FORMS);
  renderGrid(filtered);
  autoOpenRejectedFormEdit();
  autoOpenDirectFormView();
})();


let libraryQuestions = loadLibraryQuestions() || [];

let selectedQuestions = new Set(); // mirrors formData.selectedQuestions
let libraryQuestionFormOverrides = {};
let libraryInsertAfterId = null;
let libraryModalSelection = new Set();
let viewMode = 'grid', filtered = [];
let currentPage = 1;
const PAGE_SIZE = 8;
let createFormHistoryActive = false;
let createFormClosing = false;
let createFormInitialSnapshot = '';
setTimeout(() => {
  updateLibraryCountLabel();
  fetchLibraryFromAPI({ silent: true });
}, 0);

const sBadge = s => {
  const status = String(s || 'draft').toLowerCase();
  if (status === 'active') return '<span class="badge badge-green">Hoạt động</span>';
  if (status === 'pending') return '<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a">Chờ phê duyệt</span>';
  if (status === 'rejected') return '<span class="badge" style="background:#fee2e2;color:#991b1b;border:1px solid #fecaca">Bị từ chối</span>';
  if (status === 'closed' || status === 'archived') return '<span class="badge" style="background:#e2e8f0;color:#334155;border:1px solid #cbd5e1">Đã đóng biểu mẫu</span>';
  return '<span class="badge badge-yellow">Nháp</span>';
};

function isUrgentApprovalForm(form) {
  const priority = String(form?.approval_priority || form?.do_uu_tien || form?.priority || '').toLowerCase();
  const status = String(form?.status || form?.trang_thai || '').toLowerCase();
  return status === 'pending' && (priority === 'urgent' || priority === 'high');
}

function formStatusBadge(form) {
  if (isUrgentApprovalForm(form)) {
    return '<span class="badge" style="background:#fee2e2;color:#991b1b;border:1px solid #fecaca">Chờ phê duyệt</span>';
  }
  return sBadge(form?.status || form?.trang_thai);
}

function getFormSortTime(form) {
  const raw = form?.updatedRaw || form?.ngay_cap_nhat || form?.createdRaw || form?.ngay_tao || '';
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function sortFormsForManagement(list) {
  return [...(list || [])].sort((a, b) => {
    const urgentDelta = Number(isUrgentApprovalForm(b)) - Number(isUrgentApprovalForm(a));
    if (urgentDelta) return urgentDelta;
    return getFormSortTime(b) - getFormSortTime(a);
  });
}

function isActiveForm(form) {
  return String(form?.status || '').toLowerCase() === 'active';
}

function canDeleteFormsNow() {
  return typeof hasPermission === 'function' ? hasPermission('delete_form') : true;
}

const typeName = t => {
  const normalizedType = normalizeQuestionType(t);
  return normalizedType === 'choice' ? 'Lựa chọn' : normalizedType === 'rating' ? 'Đánh giá' : normalizedType === 'paragraph' ? 'Đoạn văn' : 'Đoạn văn';
};
const typeClass = t => {
  const normalizedType = normalizeQuestionType(t);
  return normalizedType === 'paragraph' ? 'q-type-text' : normalizedType === 'rating' ? 'q-type-rating' : 'q-type-choice';
};
const typeIcon = t => t==='choice' ? '◻' : t==='rating' ? '★' : '📝';

// --- PAGE HTML ---
document.getElementById('page-content').innerHTML = `
  <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><h2 class="page-title">Quản lý biểu mẫu</h2><p class="page-sub">Tạo, chỉnh sửa và quản lý tất cả biểu mẫu của bạn</p></div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn btn-primary" onclick="openFormModal()">${IC.plus}Tạo biểu mẫu mới</button>
    </div>
  </div>

  <div class="card card-body" style="margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <div class="input-wrap" style="flex:1;min-width:260px">
        <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
        <input type="text" id="search-inp" class="input" placeholder="Tìm kiếm theo tên biểu mẫu..." oninput="filterForms()">
      </div>
      <select id="status-filter" class="input" onchange="filterForms()" style="width:165px;flex:0 0 165px">
        <option value="">Tất cả trạng thái</option>
        <option value="draft">Nháp</option>
        <option value="pending">Chờ phê duyệt</option>
        <option value="active">Hoạt động</option>
        <option value="rejected">Bị từ chối</option>
        <option value="closed">Đã đóng biểu mẫu</option>
      </select>
      <select id="cat-filter" class="input" onchange="filterForms()" style="width:170px;flex:0 0 170px;padding-right:30px">
        <option value="">Tất cả danh mục</option>
        <option value="Ngoại ngữ">Ngoại ngữ</option>
        <option value="Tin học">Tin học</option>
      </select>
      <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid #dbe5f0;border-radius:12px;background:#f8fafc;flex:0 0 auto">
        <span style="font-size:12px;color:var(--gray-500);font-weight:800;white-space:nowrap">Ngày</span>
        <input type="date" id="filter-from" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none" onchange="syncFilterDateDisplay('filter-from');filterForms()">
        <input type="text" id="filter-from-display" class="input" placeholder="Từ" readonly title="Từ ngày tạo" style="width:104px;height:32px;border-radius:8px;font-size:12.5px;background:#fff;cursor:pointer;padding:0 9px" onclick="openFilterDatePicker('filter-from')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openFilterDatePicker('filter-from')}">
        <span style="font-size:12px;color:#94a3b8;font-weight:800">-</span>
        <input type="date" id="filter-to" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none" onchange="syncFilterDateDisplay('filter-to');filterForms()">
        <input type="text" id="filter-to-display" class="input" placeholder="Đến" readonly title="Đến ngày tạo" style="width:104px;height:32px;border-radius:8px;font-size:12.5px;background:#fff;cursor:pointer;padding:0 9px" onclick="openFilterDatePicker('filter-to')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openFilterDatePicker('filter-to')}">
      </div>
      <button class="btn btn-outline" onclick="resetFilter()" style="height:42px">Đặt lại</button>
    </div>
  </div>


  <p id="forms-count" style="font-size:13px;color:var(--gray-500);margin-bottom:14px"></p>
  <div id="grid-view" class="grid-4"></div>
  <div id="list-view" class="card" style="display:none"></div>

  <div id="forms-pagination" style="background:#fff;border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;margin-top:16px;box-shadow:var(--shadow-sm);gap:12px;flex-wrap:wrap">
    <span id="forms-page-info" style="font-size:13px;color:var(--gray-500)">Trang 1 / 1</span>
    <div id="forms-page-buttons" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
      <button class="pag-btn" disabled>Trước</button>
      <button class="pag-btn active">1</button>
      <button class="pag-btn" disabled>Sau</button>
    </div>
  </div>

  <style>
    .rich-title-editor:empty::before,
    .rich-title-editor.is-empty::before {
      content: attr(data-placeholder);
      color: #64748b;
      font-weight: 400;
      pointer-events: none;
    }
    #create-form-modal .modal-header .rich-title-editor:empty::before,
    #create-form-modal .modal-header .rich-title-editor.is-empty::before {
      color: rgba(219,234,254,.92);
      font-weight: 500;
    }
    .rich-title-editor a {
      color: #00008B;
      text-decoration: underline;
    }
    .rich-title-editor ol,
    .rich-title-editor ul {
      margin: 8px 0 8px 28px;
      padding-left: 18px;
    }
    .rich-title-editor li {
      margin: 4px 0;
      padding-left: 4px;
      min-height: 1.45em;
    }
    .rich-title-editor li:empty::after {
      content: "\\200B";
    }
    .rich-title-editor u {
      text-decoration: underline;
      text-decoration-thickness: from-font;
      text-underline-offset: 2px;
    }
    #create-form-modal .create-desc-wrap, #edit-form-modal .create-desc-wrap {
      margin-top: 4px;
      max-width: calc(100% - 230px);
    }
    #create-form-modal .create-desc-editor, #edit-form-modal .create-desc-editor {
      max-height: none;
      overflow: hidden !important;
    }
    #create-form-modal .create-desc-wrap:not(.is-expanded) .create-desc-editor, #edit-form-modal .create-desc-wrap:not(.is-expanded) .create-desc-editor {
      max-height: 70px;
    }
    #create-form-modal .create-desc-wrap.is-expanded .create-desc-editor, #edit-form-modal .create-desc-wrap.is-expanded .create-desc-editor {
      max-height: none;
    }
    #create-form-modal .modal-header.is-desc-expanded, #edit-form-modal .modal-header.is-desc-expanded {
      max-height: none !important;
      overflow: visible !important;
      padding-bottom: 18px !important;
    }
    #create-form-modal .modal-header.is-desc-expanded .create-desc-wrap, #edit-form-modal .modal-header.is-desc-expanded .create-desc-wrap {
      padding-bottom: 4px;
    }
    #create-form-modal .create-desc-toggle, #edit-form-modal .create-desc-toggle {
      position: absolute;
      right: 24px;
      bottom: 14px;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid rgba(255,255,255,.75);
      border-radius: 50%;
      background: #fff;
      color: #00008B;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 18px rgba(0,0,0,.14);
      transition: background .15s, transform .15s, box-shadow .15s;
    }
    #create-form-modal .create-desc-toggle:hover, #edit-form-modal .create-desc-toggle:hover {
      background: #eef5ff;
      transform: translateY(-1px);
      box-shadow: 0 10px 22px rgba(0,0,0,.18);
    }
    #create-form-modal .create-desc-toggle svg, #edit-form-modal .create-desc-toggle svg {
      width: 22px;
      height: 22px;
      color: #00008B;
      stroke: #00008B !important;
      display: block;
    }
    #create-form-modal .create-desc-toggle svg path, #edit-form-modal .create-desc-toggle svg path {
      stroke: #00008B !important;
    }
    #create-form-modal .create-desc-toggle[hidden], #edit-form-modal .create-desc-toggle[hidden] {
      display: none !important;
    }
    #create-form-modal .modal-header.is-default-look .create-desc-toggle,
    #edit-form-modal .create-desc-toggle {
      background: #fff;
      color: #00008B;
      border-color: rgba(255,255,255,.75);
    }
    .rich-title-toolbar,
    .field-format-toolbar {
      display: none;
      align-items: center;
      gap: 6px;
      margin: 8px 0 0;
      padding-left: 2px;
    }
    .rich-title-toolbar.is-visible,
    .field-format-toolbar.is-visible {
      display: flex;
    }
    #create-form-modal .modal-header.is-default-look .rich-title-toolbar button,
    #create-form-modal .modal-header.is-default-look .field-format-toolbar button,
    #create-form-modal .modal-header.is-default-look #collapse-form-btn,
    #create-form-modal .modal-header.is-default-look #create-form-header-actions .icon-btn,
    #edit-form-modal .rich-title-toolbar button,
    #edit-form-modal .field-format-toolbar button,
    #edit-form-modal #collapse-edit-btn,
    #edit-form-modal #edit-form-header-actions .icon-btn {
      background: #fff !important;
      color: #00008B !important;
      border-color: rgba(255,255,255,.75) !important;
      box-shadow: 0 8px 18px rgba(0,0,0,.14);
    }
    #create-form-modal .modal-header.is-default-look .rich-title-toolbar button *,
    #create-form-modal .modal-header.is-default-look .field-format-toolbar button *,
    #create-form-modal .modal-header.is-default-look #collapse-form-btn *,
    #create-form-modal .modal-header.is-default-look #create-form-header-actions .icon-btn *,
    #edit-form-modal .rich-title-toolbar button *,
    #edit-form-modal .field-format-toolbar button *,
    #edit-form-modal #collapse-edit-btn *,
    #edit-form-modal #edit-form-header-actions .icon-btn * {
      color: #00008B !important;
      stroke: currentColor !important;
    }
    #create-form-modal .modal-header.is-default-look .rich-title-toolbar button:hover,
    #create-form-modal .modal-header.is-default-look .field-format-toolbar button:hover,
    #create-form-modal .modal-header.is-default-look #collapse-form-btn:hover,
    #create-form-modal .modal-header.is-default-look #create-form-header-actions .icon-btn:hover,
    #edit-form-modal .rich-title-toolbar button:hover,
    #edit-form-modal .field-format-toolbar button:hover,
    #edit-form-modal #collapse-edit-btn:hover,
    #edit-form-modal #edit-form-header-actions .icon-btn:hover {
      background: #eef5ff !important;
      color: #00008B !important;
    }
    #create-form-modal .modal-header.is-default-look #create-form-header-actions .icon-btn:disabled,
    #edit-form-modal #edit-form-header-actions .icon-btn:disabled {
      opacity: .55;
    }
  </style>

  <!-- CREATE FORM MODAL -->
  <div class="modal-overlay" id="create-form-modal">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:920px;width:min(92vw,920px);border-radius:16px;display:flex;flex-direction:column">
      <div class="modal-header" style="position:relative;align-items:flex-start;padding:18px 112px 14px 24px;background:#00008B;color:#fff;border-bottom:0;max-height:220px;overflow:hidden">
        <div style="display:flex;align-items:flex-start;gap:10px;width:100%;min-width:0">
          <button id="collapse-form-btn" class="btn btn-outline btn-sm" onclick="toggleCreateFormFullscreen()" style="display:none;align-items:center;gap:6px;margin-top:2px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
            Quay lại
          </button>
          <div id="new-form-title-wrap" onfocusout="handleRichTitleFocusOut(event)" style="min-width:0;max-width:100%;width:100%">
            <input id="new-form-name" type="hidden" required>
            <div id="new-form-name-editor" class="modal-title rich-title-editor" contenteditable="true" role="textbox" aria-label="Tên biểu mẫu"
              data-placeholder="Tạo biểu mẫu mới"
              style="min-height:32px;max-height:72px;overflow-y:auto;scrollbar-gutter:stable;line-height:1.25;outline:none;white-space:pre-wrap;word-break:break-word;color:#fff;font-weight:400;padding:0;border:0;background:transparent"
              onfocus="showRichTitleToolbar()"
              oninput="syncRichTitleInputFromEditor()"
              onblur="syncRichTitleInputFromEditor()"
              onkeydown="if(event.key==='Enter'){event.preventDefault();}"
              onpaste="pastePlainTextIntoRichTitle(event)"></div>
            ${renderFormTitleFormatToolbar('new-form-name-editor')}
            <div id="new-form-desc-wrap" class="create-desc-wrap" onfocusout="handleFieldToolbarFocusOut(event, 'new-form-desc')">
              <textarea id="new-form-desc" maxlength="1000" style="display:none"></textarea>
              <div id="new-form-desc-editor" class="rich-title-editor create-desc-editor" contenteditable="true" role="textbox" aria-label="Mô tả ngắn"
                data-sync-target="new-form-desc"
                data-placeholder="Mô tả ngắn về biểu mẫu..."
              style="min-height:22px;line-height:1.4;outline:none;white-space:pre-wrap;word-break:break-word;color:#dbeafe;font-size:12.5px;font-weight:500;padding:0;border:0;background:transparent"
                onfocus="showFieldToolbar('new-form-desc')"
                oninput="syncRichTextFieldFromEditor('new-form-desc-editor')"
                onblur="syncRichTextFieldFromEditor('new-form-desc-editor')"
                onkeydown="handleRichFieldKeydown(event, 'new-form-desc-editor')"
                onclick="handleRichFieldClick(event, 'new-form-desc-editor')"
                onpaste="pastePlainTextIntoRichField(event, 'new-form-desc-editor')"></div>
              ${renderTextFormatToolbar('new-form-desc-editor', { hidden: true, toolbarFor: 'new-form-desc' })}
              <button type="button" id="new-form-desc-toggle" class="create-desc-toggle" onclick="toggleNewFormDescExpanded()" title="Mở rộng mô tả" aria-label="Mở rộng mô tả" hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="#00008B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div id="create-form-header-actions" style="position:absolute;right:24px;top:22px;z-index:3;display:flex;align-items:center;gap:6px">
          <button class="icon-btn" title="Giao diện" onclick="toggleCreateThemePanel()" style="color:var(--gray-500);transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='var(--gray-500)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 3C7 3 3 6.8 3 11.5S7.1 20 12.2 20h1.3c1.3 0 2.3-1.1 2.1-2.4-.1-.7-.4-1.3-.8-1.8-.7-.9-.1-2.3 1.1-2.3H18c1.7 0 3-1.4 3-3.1C21 6.3 17 3 12 3z"/></svg>
          </button>
          <button id="create-undo-btn" class="icon-btn" title="Hoàn tác" onclick="undoCreateForm()" style="color:var(--gray-500);transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='var(--gray-500)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-1"/></svg>
          </button>
          <button id="create-redo-btn" class="icon-btn" title="Làm lại" onclick="redoCreateForm()" style="color:var(--gray-500);transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='var(--gray-500)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h1"/></svg>
          </button>
          <button class="icon-btn" title="Lấy liên kết" onclick="copyCreatePreviewLink()" style="color:var(--gray-500);transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='var(--gray-500)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/></svg>
          </button>
          <button class="icon-btn" title="Thêm cộng tác viên" onclick="openCreateCollaboratorsPanel()" style="color:var(--gray-500);transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='var(--gray-500)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          </button>
          <button id="expand-form-btn" class="icon-btn" title="Phóng to" onclick="toggleCreateFormFullscreen()" style="color:var(--gray-400);transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='var(--gray-400)'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>
          <button class="icon-btn close-btn" onclick="closeFormModal()">${IC.close}</button>
        </div>
      </div>

      <div id="modal-scroll" style="padding:0 24px 8px;max-height:min(76vh,820px);overflow-y:auto">
        <!-- Danh mục + đối tượng + Ngày đóng -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:16px 0">
          <div>
            <label class="form-label">Danh mục <span style="color:var(--red)">*</span></label>
            <select id="new-form-cat" class="input" required style="width:100%;background:#f8f9fb" onchange="syncCreateSurveyTypes()">
              <option value="">Chọn danh mục</option>
              <option>Ngoại ngữ</option>
              <option>Tin học</option>
            </select>
          </div>
          <div>
            <label class="form-label">Loại khảo sát <span style="color:var(--red)">*</span></label>
            <select id="new-form-survey-type" class="input" required style="width:100%;background:#f8f9fb">
              <option value="">Chọn loại khảo sát</option>
            </select>
          </div>
          <div>
            <label class="form-label">Đối tượng khảo sát <span style="color:var(--red)">*</span></label>
            <select id="new-form-target" class="input" required style="width:100%;background:#f8f9fb">
              <option value="Tất cả">Tất cả</option>
              <option value="Sinh viên">Sinh viên</option>
              <option value="Người đi làm">Người đi làm</option>
            </select>
          </div>
          <div>
            <label class="form-label">Ngày đóng biểu mẫu</label>
            <input type="date" id="new-form-close" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none" onchange="syncHiddenToDisplay(this.value); if(isPastInputDate(this.value)){showToast('Không được chọn ngày đóng trong quá khứ','error'); this.value=''; document.getElementById('new-form-close-display').value='';}">
            <input type="text" id="new-form-close-display" class="input" placeholder="dd/mm/yyyy" readonly style="width:100%;background:#f8f9fb;height:38px;font-size:12.5px;cursor:pointer" onclick="openCloseDatePicker()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCloseDatePicker()}">
            <label style="display:flex;align-items:center;gap:6px;margin-top:7px;cursor:pointer;font-size:12.5px;color:var(--gray-600)">
              <input type="checkbox" id="new-form-no-close" style="width:15px;height:15px;accent-color:var(--sidebar-active,#df2f0b);cursor:pointer"
                onchange="setCreateNoCloseState(this.checked);scheduleCreateHistoryRecord()">
              Không đóng
            </label>
          </div>
        </div>

        <!-- Ghi chú phê duyệt -->
        <div class="form-group" id="approval-note-group" style="display:block">
          <div style="margin-bottom:12px">
            <label style="height:38px;width:100%;display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8f9fb;color:var(--gray-700);font-size:13px;font-weight:700;cursor:pointer">
              <input id="new-approval-urgent" type="checkbox" style="width:15px;height:15px;accent-color:var(--sidebar-active,#df2f0b)" onchange="toggleUrgentApprovalFields()">
              Duyệt gấp
            </label>
          </div>
          <div id="urgent-approval-reason-group" style="display:none;margin-bottom:12px">
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start">
              <div>
                <label class="form-label">Lý do duyệt gấp</label>
                <div style="position:relative">
                  <textarea id="new-approval-urgent-reason" class="input" maxlength="250" rows="2"
                    placeholder="Ví dụ: Biểu mẫu cần phát hành trước buổi khảo sát ngày mai."
                    style="height:48px;min-height:48px;resize:none;padding:10px 58px 10px 10px;background:#f8f9fb;font-size:13px;line-height:1.35"
                    oninput="updateUrgentReasonCount()"></textarea>
                  <span id="urgent-reason-count" style="position:absolute;right:10px;bottom:7px;font-size:11px;color:var(--gray-400);pointer-events:none">0/250</span>
                </div>
              </div>
              <div>
                <label class="form-label">Hạn chót phê duyệt</label>
                <input id="new-approval-deadline" type="datetime-local"
                  style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none"
                  onchange="syncApprovalDeadlineDisplay();validateApprovalDeadlineField()">
                <input id="new-approval-deadline-display" type="text" class="input"
                  placeholder="dd/mm/yyyy hh:mm" readonly
                  style="width:100%;height:48px;background:#f8f9fb;cursor:pointer;font-size:13px"
                  class="flatpickr-input"
                  >
              </div>
            </div>
          </div>
        </div>

        <div style="height:1px;background:var(--gray-200);margin-bottom:14px"></div>

        <!-- Khu vực câu hỏi -->
        <div id="questions-area">
          <!-- Header -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span style="font-size:13.5px;font-weight:700;color:var(--gray-700)">
              Tổng <span id="q-sel-count" style="color:#00008B">0</span> câu hỏi
            </span>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
              <button onclick="toggleLibrary()" class="fm-library-toggle"
                style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;font-size:12.5px;font-weight:600;color:#64748b;cursor:pointer;transition:all .15s;white-space:nowrap"
                onmouseenter="this.style.borderColor='#00008B';this.style.color='#00008B'"
                onmouseleave="this.style.borderColor='#e2e8f0';this.style.color='#64748b'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M4 4v15.5A2.5 2.5 0 006.5 22H20V6a2 2 0 00-2-2H6.5A2.5 2.5 0 004 6.5"/></svg>
                Thư viện (<span id="q-total-count">0</span>)
              </button>
              <button type="button" data-add-direct-q="first-section" onclick="handleAddDirectQ(event, 'first-section')" class="fm-add-question-btn btn btn-primary btn-sm" title="Thêm câu hỏi" style="min-width:128px;height:34px;padding:0 14px;background:var(--sky);border-color:var(--sky-dark);display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:9px;white-space:nowrap;font-weight:700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Thêm câu hỏi</span>
              </button>
            </div>
          </div>

          <!-- Thư viện (ẩn mặc định) -->
          <div id="library-panel" onclick="if(event.target===this)closeLibraryModal()" style="display:none;position:fixed;inset:0;z-index:1800;background:rgba(15,23,42,.48);align-items:center;justify-content:center;padding:22px">
          <div id="library-dialog" onclick="event.stopPropagation()" style="width:min(92vw,920px);max-height:min(84vh,720px);display:flex;flex-direction:column;border:1px solid #cfe0ff;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 28px 70px rgba(15,23,42,.28)">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:linear-gradient(180deg,#f8fbff 0%,#eef5ff 100%);border-bottom:1px solid #dbe8ff">
              <div style="display:flex;align-items:center;gap:9px;min-width:0">
                <div style="width:32px;height:32px;border-radius:10px;background:#00008B;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M4 4v15.5A2.5 2.5 0 006.5 22H20V6a2 2 0 00-2-2H6.5A2.5 2.5 0 004 6.5"/></svg>
                </div>
                <div>
                  <div style="font-size:14px;font-weight:800;color:#172554">Thư viện câu hỏi</div>
                  <div id="library-insert-hint" style="font-size:12px;color:#64748b;margin-top:1px">Chọn câu hỏi mẫu từ backend</div>
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
                <button class="btn btn-outline btn-sm" onclick="selectAllQ()" style="height:32px">Chọn tất cả</button>
                <button class="btn btn-outline btn-sm" onclick="deselectAllQ()" style="height:32px">Bỏ chọn</button>
                <button onclick="closeLibraryModal()" style="width:32px;height:32px;border:1px solid #cfe0ff;border-radius:9px;background:#fff;cursor:pointer;color:#64748b;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center" title="Đóng">×</button>
              </div>
            </div>
            <div style="padding:12px 16px;border-bottom:1px solid #eef4ff;display:flex;gap:10px;align-items:center;background:#fff;flex-wrap:wrap">
              <select id="lib-cat-filter" class="input" style="height:38px;font-size:13px;width:138px;flex-shrink:0;padding:0 10px;background:#f8fbff" onchange="syncLibrarySurveyFilterOptions();renderQList()">
                <option value="Ngoại ngữ">Ngoại ngữ</option>
                <option value="Tin học">Tin học</option>
              </select>
              <select id="lib-survey-filter" class="input" style="height:38px;font-size:13px;width:150px;flex-shrink:0;padding:0 10px;background:#f8fbff" onchange="renderQList()">
                <option value="Tất cả">Tất cả</option>
              </select>
              <select id="lib-target-filter" class="input" style="height:38px;font-size:13px;width:138px;flex-shrink:0;padding:0 10px;background:#f8fbff" onchange="renderQList()">
                <option value="Tất cả">Tất cả</option>
                <option value="Sinh viên">Sinh viên</option>
                <option value="Người đi làm">Người đi làm</option>
              </select>
              <div class="input-wrap" style="margin:0;flex:1">
                <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                <input type="text" id="lib-search" class="input" placeholder="Tìm câu hỏi..." style="font-size:13px;height:38px;background:#f8fbff" oninput="renderQList()">
              </div>
            </div>
            <div id="q-list-wrap" style="flex:1;min-height:220px;max-height:420px;overflow-y:auto;background:#fff"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid #e2e8f0;background:#fff">
              <div style="font-size:12.5px;color:#64748b">Đã chọn <strong id="library-selected-count" style="color:#00008B">0</strong> câu hỏi</div>
              <div style="display:flex;gap:8px;align-items:center">
                <button class="btn btn-outline btn-sm" onclick="closeLibraryModal()" style="height:36px">Hủy</button>
                <button class="btn btn-primary btn-sm" onclick="confirmLibrarySelection()" style="height:36px;min-width:128px;background:#00008B;border-color:#00008B">
                  + Thêm câu hỏi
                </button>
              </div>
            </div>
          </div>
          </div>

          <!-- Danh sách câu hỏi trực tiếp -->
          <div id="direct-q-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:4px"></div>
          <div id="direct-q-empty" style="border:1.5px solid var(--gray-200);border-radius:12px;padding:18px 16px;text-align:center;color:var(--gray-400);font-size:13px">
            Chưa có câu hỏi nào. Bấm "+ Thêm câu hỏi" hoặc chọn từ Thư viện.
          </div>
        </div>

        <div style="height:1px;background:var(--gray-200);margin:18px 0 14px"></div>

        <!-- Lời kết sau khi gửi -->
        <div class="form-group" id="new-form-loi-ket-wrap" style="margin-bottom:18px" onfocusout="handleFieldToolbarFocusOut(event, 'new-form-loi-ket')">
          <label class="form-label" style="margin-bottom:3px">Lời kết</label>
          <div style="font-size:12.5px;color:#94a3b8;font-weight:600;margin-bottom:8px">(Hiển thị sau khi người dùng gửi phản hồi)</div>
          <textarea id="new-form-loi-ket" maxlength="300" style="display:none"></textarea>
          <div id="new-form-loi-ket-editor" class="input rich-title-editor" contenteditable="true" role="textbox" aria-label="Lời kết"
            data-sync-target="new-form-loi-ket"
            data-placeholder="Ví dụ: Cảm ơn bạn đã tham gia khảo sát! Phản hồi của bạn rất có giá trị với chúng tôi."
            style="background:#f8f9fb;min-height:46px;height:auto;display:block;line-height:1.5;outline:none;white-space:pre-wrap;word-break:break-word;padding:10px 12px;overflow:auto"
            onfocus="showFieldToolbar('new-form-loi-ket')"
            oninput="syncRichTextFieldFromEditor('new-form-loi-ket-editor')"
            onblur="syncRichTextFieldFromEditor('new-form-loi-ket-editor')"
            onkeydown="handleRichFieldKeydown(event, 'new-form-loi-ket-editor')"
            onclick="handleRichFieldClick(event, 'new-form-loi-ket-editor')"
            onpaste="pastePlainTextIntoRichField(event, 'new-form-loi-ket-editor')"></div>
          ${renderTextFormatToolbar('new-form-loi-ket-editor', { hidden: true, toolbarFor: 'new-form-loi-ket' })}
          <div style="text-align:right;font-size:11px;color:var(--gray-400);margin-top:2px"><span id="loi-ket-count">0/300</span></div>
        </div>

      </div>

      <!-- Footer -->
      <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid var(--gray-200);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:13px;color:var(--gray-500)">Đã chọn <strong id="q-bottom-count" style="color:var(--sky)">0</strong> câu hỏi</div>
          <button type="button" onclick="openFormPreview()" title="Xem trước biểu mẫu"
            style="height:38px;min-width:118px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 14px;border-radius:10px;border:1.5px solid #00008B;background:#fff;font-size:12.5px;font-weight:900;color:#00008B;cursor:pointer;transition:background .15s,border-color .15s,color .15s,box-shadow .15s;white-space:nowrap"
            onmouseenter="this.style.background='#dbeafe';this.style.borderColor='#00008B';this.style.color='#00008B';this.style.boxShadow='0 6px 16px rgba(0,0,139,.16)'"
            onmouseleave="this.style.background='#fff';this.style.borderColor='#00008B';this.style.color='#00008B';this.style.boxShadow='none'"
            onmousedown="this.style.background='#bfdbfe';this.style.color='#00008B'"
            onmouseup="this.style.background='#dbeafe';this.style.color='#00008B'">
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
  <div class="modal-overlay" id="form-preview-modal" onclick="closeFormPreviewModal()">
    <div class="modal" onclick="event.stopPropagation()" style="width:100vw;max-width:none;height:100vh;max-height:none;border-radius:0;display:flex;flex-direction:column;overflow:hidden;box-shadow:none;background:#f7fbff">
      <div class="modal-header" style="padding:14px 24px;border-bottom:1px solid #dbeafe;background:linear-gradient(135deg,#f8fbff 0%,#eef5ff 100%);box-shadow:0 8px 24px rgba(15,23,42,.05);flex-shrink:0;min-height:auto">
        <div>
          <div class="modal-title" id="form-preview-title" style="font-size:22px;line-height:1.15;font-weight:800;color:#0f172a">Xem trước biểu mẫu</div>
        </div>
        <button class="icon-btn close-btn" onclick="closeFormPreviewModal()" title="Đóng xem trước" style="width:38px;height:38px;border-radius:12px;background:#fff;border:1px solid #cbd5e1;color:#334155;box-shadow:0 8px 18px rgba(15,23,42,.08);display:flex;align-items:center;justify-content:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div id="form-preview-body" style="flex:1;overflow-y:auto;padding:0;background:radial-gradient(circle at top left,rgba(0,0,139,.12),transparent 28%),linear-gradient(180deg,#f7fbff 0%,#eef5ff 100%)"></div>
    </div>
  </div>
`);

document.getElementById('page-content').insertAdjacentHTML('beforeend', `
  <div class="modal-overlay" id="fm-confirm-modal" onclick="handleConfirmDialog(false)" style="z-index:1900">
    <div class="modal" onclick="event.stopPropagation()" style="width:min(92vw,440px);border-radius:20px;overflow:hidden;box-shadow:0 28px 72px rgba(15,23,42,.28);background:#fff">
      <div style="padding:22px 24px 12px;display:flex;gap:14px;align-items:flex-start">
        <div id="fm-confirm-icon" style="width:46px;height:46px;border-radius:15px;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="22" height="22" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </div>
        <div style="min-width:0;flex:1">
          <div id="fm-confirm-title" style="font-size:19px;line-height:1.25;font-weight:900;color:#0f172a">Xác nhận thao tác</div>
          <div id="fm-confirm-message" style="margin-top:8px;font-size:14px;line-height:1.55;color:#475569"></div>
        </div>
      </div>
      <div id="fm-confirm-note" style="display:none;margin:4px 24px 0;padding:12px 14px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px;line-height:1.45;font-weight:700"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;padding:20px 24px 24px">
        <button type="button" class="btn btn-outline" onclick="handleConfirmDialog(false)" id="fm-confirm-cancel" style="height:40px;min-width:96px">Hủy</button>
        <button type="button" class="btn btn-primary" onclick="handleConfirmDialog(true)" id="fm-confirm-ok" style="height:40px;min-width:128px;background:#dc2626;border-color:#dc2626">Xác nhận</button>
      </div>
    </div>
  </div>
`);

document.getElementById('page-content').insertAdjacentHTML('beforeend', `
  <aside id="create-theme-panel" style="position:fixed;right:0;top:0;height:100vh;width:min(360px,92vw);background:#fff;border-left:1px solid #dbe5f0;box-shadow:-18px 0 42px rgba(15,23,42,.14);z-index:1400;display:none;flex-direction:column;font-family:inherit">
    <div style="height:58px;padding:0 18px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:10px;font-weight:800;color:#0f172a;font-size:18px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 3C7 3 3 6.8 3 11.5S7.1 20 12.2 20h1.3c1.3 0 2.3-1.1 2.1-2.4-.1-.7-.4-1.3-.8-1.8-.7-.9-.1-2.3 1.1-2.3H18c1.7 0 3-1.4 3-3.1C21 6.3 17 3 12 3z"/></svg>
        Giao diện
      </div>
      <button class="icon-btn close-btn" onclick="toggleCreateThemePanel(false)" title="Đóng">${IC.close}</button>
    </div>
    <div style="flex:1;overflow:auto;padding:12px 18px;display:flex;flex-direction:column;gap:14px">
      <section>
        <h3 style="margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.4px;color:#334155">Kiểu văn bản</h3>
        ${['header:Đầu trang:headerSize', 'question:Câu hỏi:questionSize', 'text:Văn bản:textSize'].map(row => {
          const [key, label, sizeKey] = row.split(':');
          const fontKey = key + 'Font';
          return `<div style="margin-bottom:10px">
            <label class="form-label" style="margin-bottom:4px">${label}</label>
            <div style="display:grid;grid-template-columns:1fr 74px;gap:8px">
              <select class="input" data-theme-key="${fontKey}" onchange="setCreateTheme('${fontKey}', this.value)" style="height:36px;background:#fff">
                <option>Roboto</option><option>Arial</option><option>Times New Roman</option><option>Georgia</option><option>Verdana</option><option>Be Vietnam Pro</option>
              </select>
              <select class="input" data-theme-key="${sizeKey}" onchange="setCreateTheme('${sizeKey}', Number(this.value))" style="height:36px;background:#fff">
                ${[11,12,13,14,16,18,20,22,24,28,32,36].map(size => `<option value="${size}">${size}</option>`).join('')}
              </select>
            </div>
          </div>`;
        }).join('')}
      </section>
      <section style="border-top:1px solid #e2e8f0;padding-top:14px">
        <h3 style="margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.4px;color:#334155">Đầu trang</h3>
        <input type="file" id="create-theme-header-file" accept="image/*" style="display:none" onchange="handleCreateHeaderImage(this.files && this.files[0])">
        <div id="create-theme-header-preview" style="height:70px;border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc center/cover no-repeat;margin-bottom:10px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12.5px;font-weight:700">Chưa chọn ảnh</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" onclick="document.getElementById('create-theme-header-file')?.click()" style="height:36px;gap:6px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            Chọn hình ảnh
          </button>
          <button class="btn btn-outline" onclick="setCreateTheme('headerImage','')" style="height:36px;color:#ef4444;border-color:#fecaca">Xóa</button>
        </div>
      </section>
      <section style="border-top:1px solid #e2e8f0;padding-top:14px">
        <h3 style="margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.4px;color:#334155">Màu</h3>
        <div id="create-theme-color-grid" style="display:grid;grid-template-columns:repeat(6,32px);gap:10px;margin-bottom:10px"></div>
        <label class="form-label" style="margin-bottom:6px">Nền</label>
        <div id="create-theme-bg-grid" style="display:grid;grid-template-columns:repeat(6,32px);gap:10px"></div>
      </section>
    </div>
  </aside>
`);

document.getElementById('page-content').insertAdjacentHTML('beforeend', `
  <div class="modal-overlay" id="create-collab-modal" onclick="closeModal('create-collab-modal')" style="z-index:1500">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:520px;border-radius:16px">
      <div class="modal-header">
        <div>
          <div class="modal-title">Thêm cộng tác viên</div>
          <div style="font-size:12.5px;color:#64748b;margin-top:2px">Nhập email hoặc tên nhân viên, quyền sẽ được lưu khi biểu mẫu được tạo.</div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('create-collab-modal')">${IC.close}</button>
      </div>
      <div style="padding:18px">
        <input id="create-collab-input" class="input" placeholder="Ví dụ: nguyenvana@flic.edu.vn" style="height:44px">
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:12px">
          <select id="create-collab-role" class="input" style="height:42px">
            <option value="editor">Có thể chỉnh sửa</option>
            <option value="viewer">Chỉ xem</option>
          </select>
          <button class="btn btn-primary" onclick="addCreateCollaborator()">Thêm</button>
        </div>
        <div id="create-collab-list" style="margin-top:14px;display:flex;flex-direction:column;gap:8px"></div>
      </div>
    </div>
  </div>
`);

// --- MODAL OPEN/CLOSE ---
function syncLibrarySurveyFilterOptions(nextValue = '') {
  const category = document.getElementById('lib-cat-filter')?.value
    || document.getElementById('new-form-cat')?.value
    || 'Ngoại ngữ';
  const select = document.getElementById('lib-survey-filter');
  if (!select) return;
  const selected = nextValue || select.value || 'Tất cả';
  const types = getSurveyTypesForCategory(category);
  select.innerHTML = `<option value="Tất cả">Tất cả</option>${types.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('')}`;
  select.value = types.includes(selected) ? selected : 'Tất cả';
}

function prepareLibraryFiltersFromCurrentForm() {
  const currentCategory = normalizeLibraryCategory(document.getElementById('new-form-cat')?.value || 'Ngoại ngữ');
  const currentSurveyType = document.getElementById('new-form-survey-type')?.value || 'Tất cả';
  const currentTarget = normalizeSurveyTarget(document.getElementById('new-form-target')?.value || 'Tất cả');
  const catFilter = document.getElementById('lib-cat-filter');
  const targetFilter = document.getElementById('lib-target-filter');
  const search = document.getElementById('lib-search');

  if (catFilter) catFilter.value = currentCategory;
  syncLibrarySurveyFilterOptions(currentSurveyType);
  if (targetFilter) targetFilter.value = currentTarget;
  if (search) search.value = '';
}

function getLibraryQuestionSurveyType(q) {
  return normalizeLibrarySurveyType(q?.loai_khao_sat || q?.survey_type || q?.ten_loai || '');
}

function getFilteredLibraryQuestions() {
  const search = (document.getElementById('lib-search')?.value || '').trim().toLowerCase();
  const cat = document.getElementById('lib-cat-filter')?.value || 'Ngoại ngữ';
  const surveyType = document.getElementById('lib-survey-filter')?.value || 'Tất cả';
  const target = normalizeSurveyTarget(document.getElementById('lib-target-filter')?.value || 'Tất cả');

  return libraryQuestions.filter(q => {
    const matchCat = normalizeLibraryCategory(q.category || q.bo_mon) === cat;
    const qSurveyType = getLibraryQuestionSurveyType(q);
    const qTarget = normalizeSurveyTarget(q.doi_tuong || q.target);
    const matchSurveyType = surveyType === 'Tất cả' || qSurveyType === surveyType;
    const matchTarget = target === 'Tất cả' || qTarget === target;
    const matchSearch = !search || String(q.text || q.noi_dung || '').toLowerCase().includes(search);
    return matchCat && matchSurveyType && matchTarget && matchSearch;
  });
}

function toggleLibrary(insertAfterId = null) {
  const p = document.getElementById('library-panel');
  if (!p) return;
  libraryInsertAfterId = insertAfterId ? String(insertAfterId) : null;
  libraryModalSelection = new Set();
  prepareLibraryFiltersFromCurrentForm();
  p.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  fetchLibraryFromAPI().then(() => renderQList());
}

function closeLibraryModal() {
  const p = document.getElementById('library-panel');
  if (p) p.style.display = 'none';
  libraryInsertAfterId = null;
  libraryModalSelection = new Set();
  document.body.style.overflow = '';
  renderQList();
}

function getLibraryQuestionClone(source) {
  const type = normalizeQuestionType(source.type || source.loai || 'choice');
  const allowOther = questionAllowsOther({ ...source, type });
  return {
    id: 'dq-lib-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    thu_vien_id: Number(source.id) || null,
    text: source.text || source.noi_dung || '',
    type,
    opts: Array.isArray(source.opts)
      ? [...source.opts]
      : Array.isArray(source.lua_chon)
      ? source.lua_chon.map(o => o.noi_dung || o)
      : [],
    rows: source.rows ? [...source.rows] : [],
    cols: source.cols ? [...source.cols] : [],
    scale: source.scale ? { ...source.scale } : undefined,
    rating: source.rating ? { ...source.rating } : undefined,
    validation_json: source.validation_json || source.validation || source.logic_json || '',
    allowOther,
    allow_other: allowOther,
    required: source.required || source.bat_buoc || false,
    bat_buoc: source.required || source.bat_buoc || false,
    image: source.image || source.hinh_anh_url || source.image_url || '',
    hinh_anh_url: source.image || source.hinh_anh_url || source.image_url || '',
    video: source.video || source.video_url || '',
    video_url: source.video || source.video_url || '',
  };
}

function confirmLibrarySelection() {
  const ids = Array.from(libraryModalSelection || []);
  if (!ids.length) {
    showToast('Vui lòng chọn ít nhất một câu hỏi từ thư viện.', 'warning');
    return;
  }
  if (libraryInsertAfterId) {
    const insertAt = directQuestions.findIndex(x => sameQuestionId(x.id, libraryInsertAfterId));
    let offset = 1;
    ids.forEach(id => {
      const source = libraryQuestions.find(q => sameQuestionId(q.id, id));
      if (!source) return;
      const clone = getLibraryQuestionClone(source);
      if (insertAt >= 0) directQuestions.splice(insertAt + offset, 0, clone);
      else directQuestions.push(clone);
      offset += 1;
      activeDirectQuestionId = String(clone.id);
    });
  } else {
    ids.forEach(id => selectedQuestions.add(String(id)));
  }
  closeLibraryModal();
  renderDirectQList();
  updateQCount();
  showToast(`Đã thêm ${ids.length} câu hỏi từ thư viện`, 'success');
}

// --- FULLSCREEN TOGGLE CHO MODAL TẠO FORM ---
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

// --- EDIT FORM FULLSCREEN ---
let _editFormFullscreen = false;
function toggleEditFormFullscreen() {
  const overlay = document.getElementById('edit-form-modal');
  const modal = overlay ? overlay.querySelector('.modal') : null;
  const scroll = document.getElementById('edit-modal-scroll');
  const btn = document.getElementById('expand-edit-btn');
  const backBtn = document.getElementById('collapse-edit-btn');
  if (!modal) return;
  _editFormFullscreen = !_editFormFullscreen;
  if (_editFormFullscreen) {
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

// --- THÊM CÂU HỎI MỚI VÀO THƯ VIỆN TRỰC TIẾP ---
const TYPE_LABEL_MAP = {
  short_text:'Trả lời ngắn',
  paragraph:'Đoạn văn',
  choice:'Trắc nghiệm',
  checkbox:'Hộp kiểm',
  dropdown:'Menu thả xuống',
  upload:'Tải tệp lên',
  scale:'Phạm vi tuyến tính',
  rating:'Xếp hạng',
  grid_radio:'Lưới trắc nghiệm',
  grid_checkbox:'Lưới hộp kiểm',
  date:'Ngày',
  time:'Giờ',
  presentation_image:'Hình ảnh',
  presentation_video:'Video'
};
// Aliases for backward compat (from DB)
const TYPE_LABEL_ALIASES = {text:'Trả lời ngắn', long_text:'Đoạn văn', star_rating:'Xếp hạng'};
const NEEDS_OPTS = ['choice','checkbox','dropdown','rating','scale'];
const NEEDS_GRID = ['grid_radio','grid_checkbox'];
function normalizeQuestionType(type) {
  if (type === 'text') return 'short_text';
  if (type === 'long_text') return 'paragraph';
  if (type === 'star_rating') return 'rating';
  return type;
}
function getTypeOptionLabel(type) {
  return ({
    short_text: 'Trả lời ngắn',
    choice: 'Trắc nghiệm',
    checkbox: 'Hộp kiểm',
    dropdown: 'Menu thả xuống',
    paragraph: 'Đoạn văn',
    long_text: 'Đoạn văn',
    upload: 'Tải tệp lên',
    rating: 'Xếp hạng',
    scale: 'Phạm vi tuyến tính',
    star_rating: 'Xếp hạng',
    grid_radio: 'Lưới trắc nghiệm',
    grid_checkbox: 'Lưới hộp kiểm',
    date: 'Ngày',
    time: 'Giờ',
  }[type] || TYPE_LABEL_MAP[type] || type);
}
const QUESTION_TYPE_GROUPS = [
  ['Văn bản', ['short_text', 'paragraph']],
  ['Lựa chọn', ['choice', 'checkbox', 'dropdown']],
  ['Tệp', ['upload']],
  ['Đánh giá', ['scale', 'rating']],
  ['Lưới', ['grid_radio', 'grid_checkbox']],
  ['Ngày giờ', ['date', 'time']],
];
function renderQuestionTypeOptions(selectedType) {
  const selected = normalizeQuestionType(selectedType || 'choice');
  return QUESTION_TYPE_GROUPS.map(([, values], index) => {
    const options = values
      .map(value => `<option value="${value}" ${selected === value ? 'selected' : ''}>${getTypeOptionLabel(value)}</option>`)
      .join('');
    const separator = index < QUESTION_TYPE_GROUPS.length - 1
      ? '<option disabled>────────────────</option>'
      : '';
    return options + separator;
  }).join('');
}
function closeQuestionTypeMenus(exceptId = '') {
  document.querySelectorAll('.question-type-menu').forEach(menu => {
    if (menu.id !== exceptId) menu.style.display = 'none';
  });
}
function toggleQuestionTypeMenu(menuId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const willOpen = menu.style.display === 'none' || !menu.style.display;
  closeQuestionTypeMenus(menuId);
  menu.style.display = willOpen ? 'block' : 'none';
}
document.addEventListener('click', event => {
  if (!event.target.closest('.question-type-dropdown')) closeQuestionTypeMenus();
  if (!event.target.closest('.dq-section-menu-wrap')) closeDirectSectionMenus();
});
function renderQuestionTypeDropdown(selectedType, context, target) {
  const normalizedType = normalizeQuestionType(selectedType || 'choice');
  const safeTarget = String(target).replace(/[^a-zA-Z0-9_-]/g, '-');
  const menuId = `qtype-menu-${context}-${safeTarget}`;
  const targetArg = String(target).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const renderAction = value => context === 'edit'
    ? `editQSetType(${Number(target)},'${value}');closeQuestionTypeMenus()`
    : `dqSetType('${targetArg}','${value}');closeQuestionTypeMenus()`;
  const renderOption = value => {
    const isActive = normalizeQuestionType(value) === normalizedType;
    return `
      <button type="button" onclick="${renderAction(value)}"
        style="width:100%;height:30px;padding:0 8px;border:0;background:${isActive ? '#e8f0fe' : '#fff'};color:#334155;display:flex;align-items:center;gap:7px;font-size:12px;font-weight:500;text-align:left;cursor:pointer"
        onmouseenter="this.style.background='${isActive ? '#e8f0fe' : '#f8fafc'}'"
        onmouseleave="this.style.background='${isActive ? '#e8f0fe' : '#fff'}'">
        <span style="width:15px;display:inline-flex;align-items:center;justify-content:center;color:#5f6368;flex-shrink:0">${DQ_TYPE_ICON[value] || DQ_TYPE_ICON[normalizeQuestionType(value)] || ''}</span>
        <span>${getTypeOptionLabel(value)}</span>
      </button>`;
  };
  const menuHtml = QUESTION_TYPE_GROUPS.map(([, values], index) => `
    ${values.map(renderOption).join('')}
    ${index < QUESTION_TYPE_GROUPS.length - 1 ? '<div style="height:1px;background:#e5e7eb;margin:3px 0"></div>' : ''}
  `).join('');
  return `
    <div class="question-type-dropdown" style="position:relative;flex-shrink:0;min-width:230px" onclick="event.stopPropagation()">
      <button type="button" onclick="toggleQuestionTypeMenu('${menuId}')"
        style="width:100%;height:38px;padding:0 10px;border:1.5px solid #e2e8f0;border-radius:8px;background:#fafbff;color:#374151;display:flex;align-items:center;gap:9px;font-size:12.5px;font-family:inherit;cursor:pointer;transition:border .15s"
        onfocus="this.style.borderColor='#00008B'" onblur="this.style.borderColor='#e2e8f0'">
        <span style="width:18px;display:inline-flex;align-items:center;justify-content:center;color:#64748b;flex-shrink:0">${DQ_TYPE_ICON[normalizedType] || ''}</span>
        <span style="flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${getTypeOptionLabel(normalizedType)}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="14" height="14" style="flex-shrink:0;color:#475569"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div id="${menuId}" class="question-type-menu"
        style="display:none;position:absolute;right:0;top:calc(100% + 5px);width:100%;min-width:230px;max-height:292px;overflow:auto;background:#fff;border:1px solid #e5e7eb;border-radius:4px;box-shadow:0 8px 20px rgba(15,23,42,.16);padding:4px 0;z-index:2000">
        ${menuHtml}
      </div>
    </div>`;
}
function getDefaultOptionsForType(type, count) {
  if (type === 'rating' || type === 'star_rating') return [];
  if (type === 'scale') return [];
  return [''];
}

const DEFAULT_SCALE_CONFIG = { start: 1, end: 5, labelMin: '', labelMax: '' };
const DEFAULT_RATING_CONFIG = { count: 5, icon: 'star' };

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function normalizeScaleConfig(config = {}) {
  const rawStart = Number(config.start ?? config.min ?? DEFAULT_SCALE_CONFIG.start);
  const rawEnd = Number(config.end ?? config.max ?? DEFAULT_SCALE_CONFIG.end);
  const start = rawStart === 0 ? 0 : 1;
  let end = Number.isFinite(rawEnd) ? Math.round(rawEnd) : DEFAULT_SCALE_CONFIG.end;
  end = Math.min(10, Math.max(2, end));
  if (end <= start) end = start + 1;
  return {
    start,
    end,
    labelMin: String(config.labelMin ?? config.label_min ?? config.minLabel ?? '').trim(),
    labelMax: String(config.labelMax ?? config.label_max ?? config.maxLabel ?? '').trim(),
  };
}

function getQuestionScaleConfig(q = {}) {
  const validation = parseJsonObject(q.validation_json || q.validation || q.logic_json);
  const fromValidation = validation.scale_config || validation.scale || {};
  const fromQuestion = q.scale_config || q.scale || {};
  const opts = Array.isArray(q.opts) ? q.opts : Array.isArray(q.lua_chon) ? q.lua_chon.map(o => o?.noi_dung || o) : [];
  const legacyLabels = opts.length && opts.length <= 2
    ? { labelMin: opts[0] || '', labelMax: opts[1] || '' }
    : {};
  return normalizeScaleConfig({
    ...DEFAULT_SCALE_CONFIG,
    ...legacyLabels,
    ...fromValidation,
    ...fromQuestion,
  });
}

function normalizeRatingConfig(config = {}) {
  const rawCount = Number(config.count ?? config.max ?? config.stars ?? DEFAULT_RATING_CONFIG.count);
  const count = Math.min(10, Math.max(3, Number.isFinite(rawCount) ? Math.round(rawCount) : DEFAULT_RATING_CONFIG.count));
  return {
    count,
    icon: 'star',
  };
}

function getQuestionRatingConfig(q = {}) {
  const validation = parseJsonObject(q.validation_json || q.validation || q.logic_json);
  const fromValidation = validation.rating_config || validation.rating || {};
  const fromQuestion = q.rating_config || q.rating || {};
  const opts = Array.isArray(q.opts) ? q.opts : Array.isArray(q.lua_chon) ? q.lua_chon.map(o => o?.noi_dung || o) : [];
  const legacyCount = opts.length >= 3 ? { count: opts.length } : {};
  return normalizeRatingConfig({
    ...DEFAULT_RATING_CONFIG,
    ...legacyCount,
    ...fromValidation,
    ...fromQuestion,
  });
}

function getScaleValues(config) {
  const scale = normalizeScaleConfig(config);
  return Array.from({ length: scale.end - scale.start + 1 }, (_, index) => scale.start + index);
}

function setQuestionScaleConfig(q, patch) {
  if (!q) return;
  q.scale = normalizeScaleConfig({ ...getQuestionScaleConfig(q), ...patch });
  q.opts = [];
  q._collapsed = false;
}

function setQuestionRatingConfig(q, patch) {
  if (!q) return;
  q.rating = normalizeRatingConfig({ ...getQuestionRatingConfig(q), ...patch });
  q.opts = [];
  q._collapsed = false;
}

function supportsOtherOption(type) {
  return ['choice', 'checkbox'].includes(normalizeQuestionType(type || ''));
}

function questionAllowsOther(q = {}) {
  const type = normalizeQuestionType(q.type || q.loai || 'choice');
  if (!supportsOtherOption(type)) return false;
  const validation = parseJsonObject(q.validation_json || q.validation || q.logic_json);
  return !!(
    q.allowOther ||
    q.allow_other ||
    q.hasOtherOption ||
    q.has_other_option ||
    q.cho_phep_khac ||
    validation.allow_other ||
    validation.allowOther ||
    validation.has_other_option
  );
}

function setQuestionAllowOther(q, value) {
  if (!q) return;
  const enabled = !!value && supportsOtherOption(q.type || q.loai || 'choice');
  q.allowOther = enabled;
  q.allow_other = enabled;
  if (!enabled) {
    delete q.hasOtherOption;
    delete q.has_other_option;
    delete q.cho_phep_khac;
  }
  q._collapsed = false;
}

function getQuestionValidationJson(q = {}) {
  const validation = parseJsonObject(q.validation_json || q.validation || q.logic_json);
  const type = normalizeQuestionType(q.type || q.loai);
  if (type === 'scale') {
    validation.scale_config = getQuestionScaleConfig(q);
  }
  if (type === 'rating') {
    validation.rating_config = getQuestionRatingConfig(q);
  }
  if (q.image_align && q.image_align !== 'left') {
    validation.image_align = q.image_align;
  } else {
    delete validation.image_align;
  }
  if (q.image_width) {
    validation.image_width = q.image_width;
  } else {
    delete validation.image_width;
  }
  if (supportsOtherOption(type) && questionAllowsOther(q)) {
    validation.allow_other = true;
  } else {
    delete validation.allow_other;
    delete validation.allowOther;
    delete validation.has_other_option;
  }
  return Object.keys(validation).length ? JSON.stringify(validation) : null;
}

function renderOtherOptionIcon(type, color = '#94a3b8') {
  const isCheckbox = normalizeQuestionType(type) === 'checkbox';
  return `<span style="width:15px;height:15px;border-radius:${isCheckbox ? '3px' : '50%'};border:2px solid ${color};flex-shrink:0;display:inline-block;background:#fff"></span>`;
}

function renderOtherOptionEditor(q, normalizedType, mode, target) {
  if (!supportsOtherOption(normalizedType)) return '';
  const enabled = questionAllowsOther(q);
  const safeTarget = String(target).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const addAction = mode === 'edit' ? `editQToggleOther(${Number(target)},true)` : `dqToggleOther('${safeTarget}',true)`;
  const removeAction = mode === 'edit' ? `editQToggleOther(${Number(target)},false)` : `dqToggleOther('${safeTarget}',false)`;

  if (enabled) {
    return `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="width:12px;flex-shrink:0;display:inline-block"></span>
        ${renderOtherOptionIcon(normalizedType)}
        <input type="text" value="Khác..." readonly
          style="flex:1;padding:6px 10px;border:1px solid #e2e8f0;border-radius:7px;font-size:12.5px;background:#fff;color:#64748b;outline:none;cursor:default">
        <button type="button" onclick="${removeAction}" title="Xóa lựa chọn khác"
          style="width:20px;height:20px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;transition:all .15s"
          onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">X</button>
      </div>`;
  }

  return `
    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:5px;font-size:12px;color:#64748b">
      <span>hoặc</span>
      <button type="button" onclick="${addAction}"
        style="padding:0;border:0;background:transparent;color:#2563eb;font-size:12px;font-weight:700;cursor:pointer">
        thêm "Câu trả lời khác"
      </button>
    </div>`;
}

function renderRatingPreview(config, compact = false) {
  const rating = normalizeRatingConfig(config);
  const uid = Math.random().toString(36).substring(2,9);
  return `<div class="rating-preview-wrap-${uid}" style="display:flex;align-items:flex-end;gap:${compact ? '12px' : '16px'};flex-wrap:wrap">
    ${Array.from({ length: rating.count }, (_, i) => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:${compact ? '4px' : '6px'};min-width:${compact ? '26px' : '34px'}">
        <span style="font-size:12px;font-weight:700;color:#475569">${i + 1}</span>
        <svg onclick="var w=this.closest('.rating-preview-wrap-${uid}');if(w){var svgs=w.querySelectorAll('svg');svgs.forEach((s,idx)=>{s.setAttribute('fill',idx<=${i}?'#f59e0b':'none');s.setAttribute('stroke',idx<=${i}?'#f59e0b':'#cbd5e1');});}" style="cursor:pointer;transition:all .15s" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.7" width="${compact ? '24' : '30'}" height="${compact ? '24' : '30'}"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>
      </div>
    `).join('')}
  </div>`;
}

function renderRatingConfigEditor(q, mode, target) {
  const rating = getQuestionRatingConfig(q);
  const setter = mode === 'edit'
    ? `editQSetRating(${Number(target)},'count',this.value)`
    : `dqSetRating('${String(target).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}','count',this.value)`;
  return `
    <div style="padding:12px 14px;border:1px solid #fde68a;border-radius:12px;background:#fffbeb">
      <div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">Xếp hạng</div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <select onchange="${setter}" style="height:36px;min-width:84px;padding:0 10px;border:1px solid #fbbf24;border-radius:8px;background:#fff;color:#0f172a;font-size:13px;font-weight:700;outline:none">
          ${Array.from({ length: 8 }, (_, i) => i + 3).map(n => `<option value="${n}" ${rating.count === n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      ${renderRatingPreview(rating, true)}
    </div>`;
}

function renderScalePreview(config, compact = false) {
  const scale = normalizeScaleConfig(config);
  const values = getScaleValues(scale);
  return `<div style="display:flex;flex-direction:column;gap:${compact ? '7px' : '10px'};max-width:620px">
    <div style="display:flex;align-items:center;gap:${compact ? '7px' : '10px'};flex-wrap:wrap">
      ${values.map(n => `<label style="display:flex;flex-direction:column;align-items:center;gap:5px;color:#1e293b;font-size:12.5px;font-weight:700">
        <span>${n}</span>
        <span style="width:${compact ? '24px' : '30px'};height:${compact ? '24px' : '30px'};border-radius:50%;border:2px solid #a5b4fc;background:#fff;display:inline-block"></span>
      </label>`).join('')}
    </div>
    ${(scale.labelMin || scale.labelMax) ? `<div style="display:flex;justify-content:space-between;gap:18px;color:#64748b;font-size:12.5px;font-weight:600">
      <span>${previewEsc(scale.labelMin)}</span>
      <span style="text-align:right">${previewEsc(scale.labelMax)}</span>
    </div>` : ''}
  </div>`;
}

function renderScaleConfigEditor(q, mode, target) {
  const scale = getQuestionScaleConfig(q);
  const setter = (key, valueExpr) => mode === 'edit'
    ? `editQSetScale(${Number(target)},'${key}',${valueExpr})`
    : `dqSetScale('${String(target).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}','${key}',${valueExpr})`;
  return `
    <div style="padding:12px 14px;border:1px solid #dbe4f0;border-radius:12px;background:#f8fbff">
      <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">Phạm vi tuyến tính</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <select onchange="${setter('start', 'this.value')}" style="height:36px;min-width:74px;padding:0 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font-size:13px;font-weight:700;outline:none">
          <option value="0" ${scale.start === 0 ? 'selected' : ''}>0</option>
          <option value="1" ${scale.start === 1 ? 'selected' : ''}>1</option>
        </select>
        <span style="font-size:13px;color:#475569;font-weight:700">đến</span>
        <select onchange="${setter('end', 'this.value')}" style="height:36px;min-width:74px;padding:0 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font-size:13px;font-weight:700;outline:none">
          ${Array.from({ length: 9 }, (_, i) => i + 2).map(n => `<option value="${n}" ${scale.end === n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px">
        <label style="display:flex;align-items:center;gap:10px">
          <span style="min-width:22px;color:#64748b;font-size:13px;font-weight:700">${scale.start}</span>
          <input type="text" value="${String(scale.labelMin || '').replace(/"/g,'&quot;')}" placeholder="Nhãn (không bắt buộc)"
            style="width:100%;padding:8px 10px;border:0;border-bottom:1.5px solid #cbd5e1;font-size:13px;background:transparent;outline:none"
            oninput="${setter('labelMin', 'this.value')}">
        </label>
        <label style="display:flex;align-items:center;gap:10px">
          <span style="min-width:22px;color:#64748b;font-size:13px;font-weight:700">${scale.end}</span>
          <input type="text" value="${String(scale.labelMax || '').replace(/"/g,'&quot;')}" placeholder="Nhãn (không bắt buộc)"
            style="width:100%;padding:8px 10px;border:0;border-bottom:1.5px solid #cbd5e1;font-size:13px;background:transparent;outline:none"
            oninput="${setter('labelMax', 'this.value')}">
        </label>
      </div>
    </div>`;
}

function getFormTitleEditor() {
  return document.getElementById('new-form-name-editor');
}

function sanitizeRichTitleHrefForStorage(value) {
  const href = String(value || '').trim();
  if (!/^(https?:|mailto:|tel:|#|\/)/i.test(href)) return '#';
  return href.replace(/"/g, '%22').replace(/[<>]/g, '');
}

function sanitizeRichTitleNode(node) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();
  const content = Array.from(node.childNodes).map(sanitizeRichTitleNode).join('');
  if (tag === 'br') return '\n';
  if (tag === 'div' || tag === 'p') return content ? `\n${content}` : '\n';
  if (tag === 'ol') {
    const items = Array.from(node.children)
      .filter(child => child.tagName?.toLowerCase() === 'li')
      .map(child => Array.from(child.childNodes).map(sanitizeRichTitleNode).join('').trim())
      .filter(Boolean)
      .map((content, index) => `${index + 1}. ${content}`)
      .join('\n');
    return items ? `${items}\n` : '';
  }
  if (tag === 'ul') {
    const items = Array.from(node.children)
      .filter(child => child.tagName?.toLowerCase() === 'li')
      .map(child => Array.from(child.childNodes).map(sanitizeRichTitleNode).join('').trim())
      .filter(Boolean)
      .map(content => `- ${content}`)
      .join('\n');
    return items ? `${items}\n` : '';
  }
  if (tag === 'li') return content;
  if (tag === 'strong' || tag === 'b') return `<strong>${content}</strong>`;
  if (tag === 'em' || tag === 'i') return `<em>${content}</em>`;
  if (tag === 'u') return `<u>${content}</u>`;
  if (tag === 'span' && /underline/i.test(node.style.textDecoration || node.style.textDecorationLine || '')) return `<u>${content}</u>`;
  if (tag === 's' || tag === 'strike' || tag === 'del') return `<s>${content}</s>`;
  if (tag === 'a') {
    const href = sanitizeRichTitleHrefForStorage(node.getAttribute('href') || '');
    return `<a href="${href}">${content}</a>`;
  }
  return content;
}

function getRichEditorStoredValue(editor) {
  return Array.from(editor?.childNodes || []).map(sanitizeRichTitleNode).join('').trim();
}

function updateRichEditorEmptyState(editor, value = null) {
  if (!editor) return '';
  const storedValue = value === null ? getRichEditorStoredValue(editor) : String(value || '').trim();
  const plainText = String(storedValue || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\u200B/g, '')
    .trim();
  const isEmpty = !plainText;
  editor.classList.toggle('is-empty', isEmpty);
  editor.dataset.empty = isEmpty ? '1' : '0';
  if (isEmpty && editor.innerHTML.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, '').trim() === '') {
    editor.innerHTML = '';
  }
  return storedValue;
}

function syncRichTitleInputFromEditor() {
  const editor = getFormTitleEditor();
  const input = document.getElementById('new-form-name');
  if (!editor || !input) return;
  input.value = updateRichEditorEmptyState(editor);
}

function updateNewFormDescCount(value) {
  const c = document.getElementById('desc-count');
  const len = String(value || '').length;
  if (c) {
    c.textContent = len + '/1000';
    c.style.color = len > 900 ? 'var(--red)' : 'var(--gray-400)';
  }
  updateNewFormDescCollapseState();
}

function setNewFormDescToggleIcon(expanded) {
  const toggle = document.getElementById('new-form-desc-toggle');
  if (!toggle) return;
  toggle.title = expanded ? 'Thu gọn mô tả' : 'Mở rộng mô tả';
  toggle.setAttribute('aria-label', toggle.title);
  toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  toggle.innerHTML = expanded
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="#00008B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="#00008B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
}

function updateNewFormDescCollapseState() {
  const wrap = document.getElementById('new-form-desc-wrap');
  const editor = document.getElementById('new-form-desc-editor');
  const toggle = document.getElementById('new-form-desc-toggle');
  const header = document.querySelector('#create-form-modal .modal-header');
  if (!wrap || !editor || !toggle) return;

  setTimeout(() => {
    const wasExpanded = wrap.classList.contains('is-expanded');
    if (wasExpanded) {
      wrap.classList.remove('is-expanded');
      header?.classList.remove('is-desc-expanded');
    }
    const shouldToggle = editor.scrollHeight > 74;
    if (wasExpanded) {
      wrap.classList.add('is-expanded');
      header?.classList.add('is-desc-expanded');
    }

    if (!shouldToggle) {
      wrap.classList.remove('is-expanded');
      header?.classList.remove('is-desc-expanded');
    }
    toggle.hidden = !shouldToggle;
    setNewFormDescToggleIcon(shouldToggle && wasExpanded);
  }, 50);
}

function toggleNewFormDescExpanded() {
  const wrap = document.getElementById('new-form-desc-wrap');
  const toggle = document.getElementById('new-form-desc-toggle');
  const header = document.querySelector('#create-form-modal .modal-header');
  if (!wrap || !toggle) return;
  const expanded = wrap.classList.toggle('is-expanded');
  header?.classList.toggle('is-desc-expanded', expanded);
  setNewFormDescToggleIcon(expanded);
}

function getRichTextPlainLength(value) {
  const temp = document.createElement('div');
  temp.innerHTML = formatRichTextForEditor(value || '');
  return (temp.textContent || '').trim().length;
}

function syncRichTextFieldFromEditor(editorId) {
  const editor = document.getElementById(editorId);
  const targetId = editor?.dataset.syncTarget;
  const target = targetId ? document.getElementById(targetId) : null;
  if (!editor) return;
  const value = updateRichEditorEmptyState(editor);
  if (target) target.value = value;
  if (editor.dataset.directQuestionId) dqSetText(editor.dataset.directQuestionId, value);
  if (editor.dataset.directSectionId && editor.dataset.directSectionField) {
    const section = directQuestions.find(q => sameQuestionId(q.id, editor.dataset.directSectionId));
    if (section) section[editor.dataset.directSectionField] = value;
  }
  if (editor.dataset.editQuestionIndex) editQSetText(Number(editor.dataset.editQuestionIndex), value);
  if (editor.dataset.editSectionIndex && editor.dataset.editSectionField) {
    const section = editFormQuestions[Number(editor.dataset.editSectionIndex)];
    if (section) section[editor.dataset.editSectionField] = value;
  }
  if (targetId === 'new-form-desc') updateNewFormDescCount(value);
  if (targetId === 'new-form-loi-ket') updateNewFormLoiKetDraft(value);
  if (targetId === 'edit-form-loi-ket') updateEditFormLoiKetCount(value);
  if (editorId === 'new-form-desc-editor') updateNewFormDescCollapseState();
  if (editorId === 'edit-form-desc-editor') updateEditFormDescCollapseState();
}

function setRichTextFieldValue(fieldId, value = '') {
  const target = document.getElementById(fieldId);
  const editor = document.querySelector(`[data-sync-target="${fieldId}"]`);
  if (target) target.value = value || '';
  if (editor) {
    editor.innerHTML = value ? formatRichTextForEditor(value) : '';
    updateRichEditorEmptyState(editor, value);
  }
  if (fieldId === 'new-form-desc') updateNewFormDescCount(value || '');
  if (fieldId === 'edit-form-desc') updateEditFormDescCollapseState();
  if (fieldId === 'new-form-loi-ket') updateNewFormLoiKetDraft(value || '');
  if (fieldId === 'edit-form-loi-ket') updateEditFormLoiKetCount(value || '');
}

function setRichTitleEditorValue(value = '') {
  const editor = getFormTitleEditor();
  const input = document.getElementById('new-form-name');
  if (editor) {
    editor.innerHTML = value ? formatRichText(value) : '';
    updateRichEditorEmptyState(editor, value);
  }
  if (input) input.value = value || '';
}

function focusRichTitleEditor() {
  const editor = getFormTitleEditor();
  if (editor) {
    showRichTitleToolbar();
    editor.focus();
  }
  else document.getElementById('new-form-name')?.focus();
}

function showRichTitleToolbar() {
  hideFieldToolbar('new-form-desc');
  document.getElementById('new-form-name-toolbar')?.classList.add('is-visible');
}

function hideRichTitleToolbar() {
  document.getElementById('new-form-name-toolbar')?.classList.remove('is-visible');
}

function handleRichTitleFocusOut(event) {
  const wrap = document.getElementById('new-form-title-wrap');
  const next = event.relatedTarget;
  if (wrap && next && wrap.contains(next)) return;
  setTimeout(() => {
    const active = document.activeElement;
    if (wrap && active && wrap.contains(active)) return;
    hideRichTitleToolbar();
  }, 0);
}

function getFieldToolbarId(fieldId) {
  return `${fieldId}-toolbar`;
}

function showFieldToolbar(fieldId) {
  if (fieldId === 'new-form-desc') hideRichTitleToolbar();
  if (fieldId === 'new-form-name') hideFieldToolbar('new-form-desc');
  document.getElementById(getFieldToolbarId(fieldId))?.classList.add('is-visible');
}

function hideFieldToolbar(fieldId) {
  document.getElementById(getFieldToolbarId(fieldId))?.classList.remove('is-visible');
}

function handleFieldToolbarFocusOut(event, fieldId) {
  const wrap = document.getElementById(`${fieldId}-wrap`);
  const next = event.relatedTarget;
  if (wrap && next && wrap.contains(next)) return;
  setTimeout(() => {
    const active = document.activeElement;
    if (wrap && active && wrap.contains(active)) return;
    hideFieldToolbar(fieldId);
  }, 0);
}

function pastePlainTextIntoRichTitle(event) {
  event.preventDefault();
  const text = (event.clipboardData || window.clipboardData)?.getData('text/plain') || '';
  document.execCommand('insertText', false, text.replace(/\s*\n+\s*/g, ' '));
  syncRichTitleInputFromEditor();
}

function pastePlainTextIntoRichField(event, editorId) {
  event.preventDefault();
  const text = (event.clipboardData || window.clipboardData)?.getData('text/plain') || '';
  document.execCommand('insertText', false, text);
  syncRichTextFieldFromEditor(editorId);
}

function isEffectivelyEmptyListItem(li) {
  if (!li) return false;
  return String(li.textContent || '').replace(/\u200B/g, '').trim() === '';
}

function placeCaretInElement(element) {
  if (!element) return;
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getActiveListItem(editor) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !editor.contains(selection.anchorNode)) return null;
  const node = selection.anchorNode.nodeType === Node.ELEMENT_NODE
    ? selection.anchorNode
    : selection.anchorNode.parentElement;
  return node?.closest?.('li') || null;
}

function removeEmptyListItem(editor, li) {
  if (!li || !isEffectivelyEmptyListItem(li)) return false;
  const list = li.parentElement;
  const next = li.nextElementSibling;
  const previous = li.previousElementSibling;
  li.remove();

  if (next) placeCaretInElement(next);
  else if (previous) placeCaretInElement(previous);
  else {
    const paragraph = document.createElement('div');
    paragraph.innerHTML = '<br>';
    list.replaceWith(paragraph);
    placeCaretInElement(paragraph);
  }

  syncRichTextFieldFromEditor(editor.id);
  return true;
}

function handleRichFieldKeydown(event, editorId) {
  const editor = document.getElementById(editorId);
  if (!editor) return;
  const li = getActiveListItem(editor);
  if (!li || !isEffectivelyEmptyListItem(li)) return;

  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    removeEmptyListItem(editor, li);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    const paragraph = document.createElement('div');
    paragraph.innerHTML = '<br>';
    const list = li.parentElement;
    if (li.nextSibling) list.parentNode.insertBefore(paragraph, list.nextSibling);
    else list.after(paragraph);
    li.remove();
    if (!list.querySelector('li')) list.remove();
    placeCaretInElement(paragraph);
    syncRichTextFieldFromEditor(editor.id);
  }
}

function handleRichFieldClick(event, editorId) {
  const editor = document.getElementById(editorId);
  if (!editor) return;
  const li = event.target?.closest?.('li');
  if (!li || !editor.contains(li) || !isEffectivelyEmptyListItem(li)) return;
  placeCaretInElement(li);
}

function selectionIsInsideEditor(editor) {
  const selection = window.getSelection();
  return !!(
    selection &&
    selection.rangeCount &&
    editor.contains(selection.anchorNode) &&
    editor.contains(selection.focusNode)
  );
}

function wrapRichTitleSelection(editor, tagName) {
  if (!selectionIsInsideEditor(editor)) return false;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;

  const range = selection.getRangeAt(0);
  const wrapper = document.createElement(tagName);
  wrapper.appendChild(range.extractContents());
  range.insertNode(wrapper);

  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(wrapper);
  selection.addRange(nextRange);
  syncRichTitleInputFromEditor();
  syncRichTextFieldFromEditor(editor.id);
  return true;
}

function closestUnderlineElement(node, editor) {
  let current = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  while (current && current !== editor) {
    const tag = current.tagName?.toLowerCase();
    const isUnderlineTag = tag === 'u';
    const isUnderlineStyle = /underline/i.test(current.style?.textDecoration || current.style?.textDecorationLine || '');
    if (isUnderlineTag || isUnderlineStyle) return current;
    current = current.parentElement;
  }
  return null;
}

function unwrapRichTitleElement(element) {
  if (!element || !element.parentNode) return false;
  const parent = element.parentNode;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
  parent.normalize();
  syncRichTitleInputFromEditor();
  const editor = parent.nodeType === Node.ELEMENT_NODE ? parent.closest?.('[data-sync-target]') : null;
  if (editor) syncRichTextFieldFromEditor(editor.id);
  return true;
}

function removeRichTitleUnderline(editor) {
  if (!selectionIsInsideEditor(editor)) return false;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;

  if (document.queryCommandState && document.queryCommandState('underline')) {
    document.execCommand('underline', false, null);
    syncRichTitleInputFromEditor();
    syncRichTextFieldFromEditor(editor.id);
    return true;
  }

  const startUnderline = closestUnderlineElement(selection.anchorNode, editor);
  const endUnderline = closestUnderlineElement(selection.focusNode, editor);
  if (startUnderline && startUnderline === endUnderline) {
    return unwrapRichTitleElement(startUnderline);
  }
  return false;
}

function formatRichTitleSelection(editor, format) {
  editor.focus();

  if (format === 'clear') {
    document.execCommand('unlink', false, null);
    document.execCommand('removeFormat', false, null);
    syncRichTitleInputFromEditor();
    syncRichTextFieldFromEditor(editor.id);
    return;
  }

  if (format === 'link') {
    const url = prompt('Nhập liên kết', 'https://');
    if (!url) return;
    const selection = window.getSelection();
    const hasSelection = selection && !selection.isCollapsed && editor.contains(selection.anchorNode);
    if (hasSelection) {
      document.execCommand('createLink', false, url.trim());
    } else {
      document.execCommand('insertHTML', false, `<a href="${sanitizeRichTextHref(url)}">liên kết</a>`);
    }
    editor.querySelectorAll('a').forEach(a => {
      a.target = '_blank';
      a.rel = 'noopener';
    });
    syncRichTitleInputFromEditor();
    syncRichTextFieldFromEditor(editor.id);
    return;
  }

  if (format === 'orderedList' || format === 'bulletList') {
    document.execCommand('styleWithCSS', false, false);
    document.execCommand(format === 'orderedList' ? 'insertOrderedList' : 'insertUnorderedList', false, null);
    syncRichTitleInputFromEditor();
    syncRichTextFieldFromEditor(editor.id);
    return;
  }

  if (format === 'underline') {
    if (removeRichTitleUnderline(editor)) return;
    if (wrapRichTitleSelection(editor, 'u')) return;
  }

  const command = {
    bold: 'bold',
    italic: 'italic',
    underline: 'underline',
  }[format];
  if (!command) return;
  document.execCommand('styleWithCSS', false, false);
  document.execCommand(command, false, null);
  syncRichTitleInputFromEditor();
  syncRichTextFieldFromEditor(editor.id);
}

function clearInlineFormattingText(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<\/?(strong|b|em|i|u|s|strike|del)\b[^>]*>/gi, '')
    .replace(/^\s*(?:[-*]\s+|\d+\.\s+)/gm, '')
    .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
    .replace(/~~([\s\S]*?)~~/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2');
}

function formatTextareaListSelection(el, ordered = false) {
  el.focus();
  const value = el.value || '';
  const selectionStart = el.selectionStart ?? 0;
  const selectionEnd = el.selectionEnd ?? selectionStart;
  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
  const nextBreak = value.indexOf('\n', selectionEnd);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const selectedBlock = value.slice(lineStart, lineEnd);
  const lines = selectedBlock.split('\n');
  const hasList = lines.some(line => /^\s*(?:[-*]\s+|\d+\.\s+)/.test(line));
  const formatted = lines.map((line, index) => {
    const content = line.replace(/^\s*(?:[-*]\s+|\d+\.\s+)/, '');
    if (hasList) return content;
    if (!content.trim()) return content;
    return ordered ? `${index + 1}. ${content}` : `- ${content}`;
  }).join('\n');
  el.setRangeText(formatted, lineStart, lineEnd, 'select');
  el.setSelectionRange(lineStart, lineStart + formatted.length);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function formatTextareaSelection(textareaId, format) {
  const el = document.getElementById(textareaId);
  if (!el) return;
  if (el.isContentEditable) {
    formatRichTitleSelection(el, format);
    return;
  }

  const formats = {
    bold: { open: '**', close: '**', placeholder: 'văn bản' },
    italic: { open: '*', close: '*', placeholder: 'văn bản' },
    underline: { open: '<u>', close: '</u>', placeholder: 'văn bản' },
  };

  if (format === 'link') {
    el.focus();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const value = el.value || '';
    const selected = value.slice(start, end) || 'liên kết';
    const url = prompt('Nhập liên kết', 'https://');
    if (!url) return;
    const wrapped = `[${selected}](${url.trim()})`;
    const maxLength = Number(el.getAttribute('maxlength') || 0);
    const nextLength = value.length - (end - start) + wrapped.length;
    if (maxLength && nextLength > maxLength) {
      if (typeof showToast === 'function') showToast('Nội dung vượt quá giới hạn ký tự', 'error');
      return;
    }
    el.setRangeText(wrapped, start, end, 'select');
    el.setSelectionRange(start + 1, start + 1 + selected.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  if (format === 'orderedList' || format === 'bulletList') {
    formatTextareaListSelection(el, format === 'orderedList');
    return;
  }

  if (format === 'clear') {
    el.focus();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const value = el.value || '';
    const hasSelection = end > start;
    const targetStart = hasSelection ? start : 0;
    const targetEnd = hasSelection ? end : value.length;
    const plain = clearInlineFormattingText(value.slice(targetStart, targetEnd));
    el.setRangeText(plain, targetStart, targetEnd, 'select');
    el.setSelectionRange(targetStart, targetStart + plain.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  const rule = formats[format];
  if (!rule) return;

  el.focus();

  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? start;
  const value = el.value || '';
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);
  const alreadyWrapped =
    selected &&
    before.endsWith(rule.open) &&
    after.startsWith(rule.close);

  if (alreadyWrapped) {
    const next =
      before.slice(0, -rule.open.length) +
      selected +
      after.slice(rule.close.length);
    el.value = next;
    const nextStart = start - rule.open.length;
    el.setSelectionRange(nextStart, nextStart + selected.length);
  } else {
    const content = selected || rule.placeholder;
    const wrapped = `${rule.open}${content}${rule.close}`;
    const maxLength = Number(el.getAttribute('maxlength') || 0);
    const nextLength = value.length - selected.length + wrapped.length;
    if (maxLength && nextLength > maxLength) {
      if (typeof showToast === 'function') showToast('Nội dung vượt quá giới hạn ký tự', 'error');
      return;
    }
    el.setRangeText(wrapped, start, end, 'select');
    el.setSelectionRange(start + rule.open.length, start + rule.open.length + content.length);
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function renderTextFormatToolbar(textareaId, options = {}) {
  const fieldId = options.toolbarFor || textareaId;
  const toolbarId = options.hidden ? getFieldToolbarId(fieldId) : '';
  const toolbarClass = options.hidden ? 'field-format-toolbar' : '';
  const toolbarStyle = options.hidden ? '' : 'display:flex;align-items:center;gap:6px;margin:0 0 8px';
  const mouseDown = options.hidden ? ` onmousedown="showFieldToolbar('${fieldId}')"` : '';
  const listButtons = options.hideLists ? '' : `
      <button type="button" title="Danh sách đánh số" onmousedown="event.preventDefault()" onclick="formatTextareaSelection('${textareaId}','orderedList')" style="width:30px;height:30px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;display:inline-flex;align-items:center;justify-content:center;cursor:pointer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" width="17" height="17"><path d="M10 6h10"/><path d="M10 12h10"/><path d="M10 18h10"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M4 14h2l-2 4h2"/></svg>
      </button>
      <button type="button" title="Danh sách dấu chấm" onmousedown="event.preventDefault()" onclick="formatTextareaSelection('${textareaId}','bulletList')" style="width:30px;height:30px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;display:inline-flex;align-items:center;justify-content:center;cursor:pointer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" width="17" height="17"><circle cx="5" cy="6" r="1.1" fill="currentColor"/><circle cx="5" cy="12" r="1.1" fill="currentColor"/><circle cx="5" cy="18" r="1.1" fill="currentColor"/><path d="M10 6h10"/><path d="M10 12h10"/><path d="M10 18h10"/></svg>
      </button>`;
  return `
    <div${toolbarId ? ` id="${toolbarId}"` : ''}${toolbarClass ? ` class="${toolbarClass}"` : ''}${mouseDown} style="${toolbarStyle}">
      <button type="button" title="In đậm" onmousedown="event.preventDefault()" onclick="formatTextareaSelection('${textareaId}','bold')" style="width:30px;height:30px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font-size:13px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;cursor:pointer">B</button>
      <button type="button" title="In nghiêng" onmousedown="event.preventDefault()" onclick="formatTextareaSelection('${textareaId}','italic')" style="width:30px;height:30px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font-size:13px;font-style:italic;font-weight:700;display:inline-flex;align-items:center;justify-content:center;cursor:pointer">I</button>
      <button type="button" title="Gạch chân" onmousedown="event.preventDefault()" onclick="formatTextareaSelection('${textareaId}','underline')" style="width:30px;height:30px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font-size:13px;font-weight:800;text-decoration:underline;display:inline-flex;align-items:center;justify-content:center;cursor:pointer">U</button>
      <button type="button" title="Chèn liên kết" onmousedown="event.preventDefault()" onclick="formatTextareaSelection('${textareaId}','link')" style="width:30px;height:30px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font-size:15px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;cursor:pointer">↗</button>
      ${listButtons}
      <button type="button" title="Xóa định dạng" onmousedown="event.preventDefault()" onclick="formatTextareaSelection('${textareaId}','clear')" style="width:30px;height:30px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font-size:13px;font-weight:800;text-decoration:line-through;display:inline-flex;align-items:center;justify-content:center;cursor:pointer">T</button>
    </div>
  `;
}

function renderFormTitleFormatToolbar(inputId) {
  return renderTextFormatToolbar(inputId, { hidden: true, toolbarFor: 'new-form-name', hideLists: true });
}

function renderQuestionFormatToolbar(inputId, options = {}) {
  return renderTextFormatToolbar(inputId, options);
}
function renderTextAnswerBuilder(type) {
  const normalizedType = normalizeQuestionType(type);
  if (normalizedType === 'short_text') {
    return `
      <div style="padding-left:30px;margin-top:10px">
        <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Trả lời ngắn</div>
        <input disabled type="text" placeholder="Văn bản trả lời ngắn"
          style="width:min(100%,420px);padding:9px 12px;border:0;border-bottom:2px solid #cbd5e1;border-radius:8px 8px 0 0;font-size:12.5px;background:#f8fafc;color:#94a3b8;outline:none">
      </div>`;
  }
  if (normalizedType === 'paragraph') {
    return `
      <div style="padding-left:30px;margin-top:10px">
        <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Đoạn văn bản</div>
        <textarea disabled rows="4" placeholder="Văn bản trả lời dài"
          style="width:100%;padding:10px 12px;border:1.5px solid #fdba74;border-radius:10px;font-size:12.5px;background:#fff;color:#7c2d12;resize:vertical;outline:none"></textarea>
      </div>`;
  }
  if (normalizedType === 'upload') {
    return `
      <div style="padding-left:30px;margin-top:10px">
        <div style="display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:1.5px dashed #94a3b8;border-radius:10px;background:#f8fafc;color:#475569;font-size:12.5px;font-weight:800">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/></svg>
          Tải tệp lên
        </div>
      </div>`;
  }
  if (normalizedType === 'date' || normalizedType === 'time') {
    const label = normalizedType === 'date' ? 'Ngày' : 'Giờ';
    const inputType = normalizedType === 'date' ? 'date' : 'time';
    return `
      <div style="padding-left:30px;margin-top:10px">
        <div style="font-size:11px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">${label}</div>
        <input disabled type="${inputType}"
          style="width:min(100%,240px);padding:9px 12px;border:1.5px solid #bbf7d0;border-radius:10px;font-size:12.5px;background:#f8fffb;color:#64748b;outline:none">
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

function cloneLibraryQuestionForEdit(source) {
  const imageUrl = getQuestionImageUrl(source);
  const videoUrl = getQuestionVideoUrl(source);
  return {
    id: 'eq-lib-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    thu_vien_id: Number(source.id) || null,
    text: source.text || source.noi_dung || '',
    type: normalizeQuestionType(source.type || source.loai || 'choice'),
    opts: Array.isArray(source.opts)
      ? [...source.opts]
      : Array.isArray(source.lua_chon)
      ? source.lua_chon.map(o => o.noi_dung || o)
      : [],
    rows: source.rows ? [...source.rows] : [],
    cols: source.cols ? [...source.cols] : [],
    image: imageUrl,
    hinh_anh_url: imageUrl,
    video: videoUrl,
    video_url: videoUrl,
    required: false,
  };
}

function renderEditLibraryList() {
  const wrap = document.getElementById('edit-lib-list-wrap');
  if (!wrap) return;

  const search = (document.getElementById('edit-lib-search')?.value || '').toLowerCase();
  const cat = document.getElementById('edit-lib-cat-filter')?.value || document.getElementById('edit-form-cat')?.value || 'Ngoại ngữ';
  const filtered = libraryQuestions.filter(q => {
    const matchCat = normalizeLibraryCategory(q.category || q.bo_mon) === cat;
    const matchSearch = !search || String(q.text || '').toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  updateLibraryCountLabel();

  if (!filtered.length) {
    wrap.innerHTML = `<div style="padding:24px 16px;text-align:center;color:#94a3b8;font-size:13px">
      ${search ? 'Không tìm thấy câu hỏi phù hợp.' : 'Chưa có câu hỏi trong danh mục này.'}
    </div>`;
    return;
  }

  const typeLabel = t => getTypeOptionLabel(normalizeQuestionType(t));

  wrap.innerHTML = filtered.map(q => {
    const sid = String(q.id);
    const hasOpts = q.opts && q.opts.length > 0;
    return `
      <div style="border-bottom:1px solid #eef4ff;padding:12px 14px;display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:700;color:#0f172a;line-height:1.45;margin-bottom:5px">${previewEsc(q.text || 'Câu hỏi chưa có nội dung')}</div>
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
            <span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:#eef2ff;color:#00008B">${typeLabel(q.type)}</span>
            ${hasOpts ? `<span style="font-size:11.5px;color:#64748b">${q.opts.length} lựa chọn</span>` : ''}
          </div>
        </div>
        <button type="button" onclick="editInsertLibraryQuestion('${sid}')"
          style="display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:8px;border:1px solid #bfdbfe;background:#eff6ff;color:#00008B;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Thêm
        </button>
      </div>`;
  }).join('');
}

function toggleEditLibrary() {
  const panel = document.getElementById('edit-library-panel');
  if (!panel) return;
  const show = panel.style.display === 'none';
  panel.style.display = show ? 'block' : 'none';
  if (show) {
    const catEl = document.getElementById('edit-lib-cat-filter');
    if (catEl) catEl.value = document.getElementById('edit-form-cat')?.value || 'Ngoại ngữ';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    fetchLibraryFromAPI().then(renderEditLibraryList).catch(renderEditLibraryList);
  }
}

function editInsertLibraryQuestion(questionId) {
  const source = libraryQuestions.find(q => sameQuestionId(q.id, questionId));
  if (!source) return;
  const newQ = cloneLibraryQuestionForEdit(source);
  editFormQuestions.push(newQ);
  renderEditQuestions();
  renderEditLibraryList();
  setTimeout(() => {
    const cardIndex = editFormQuestions.findIndex(q => String(q.id) === String(newQ.id));
    const card = document.getElementById('eqcard-' + cardIndex);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
  showToast('Đã thêm câu hỏi từ thư viện', 'success');
}

function updateSelectedPreview() { renderDirectQList(); }

// --- FORM PREVIEW MODAL ---
let formPreviewHistoryActive = false;
let formPreviewPageState = {
  page: 0,
  formInfo: null,
  questions: [],
  containerId: 'form-preview-body',
};

function buildFormPreviewPages(normalizedQuestions) {
  const items = normalizedQuestions || [];
  const hasSection = items.some(isSectionItem);

  if (!hasSection) {
    return [{
      section: null,
      sectionIndex: -1,
      items: items.map((item, originalIndex) => ({ item, originalIndex })),
    }];
  }

  const pages = [];
  let current = { section: null, sectionIndex: -1, items: [] };

  items.forEach((item, index) => {
    if (isSectionItem(item)) {
      if (current.section || current.items.length) pages.push(current);
      current = { section: item, sectionIndex: index, items: [] };
      return;
    }

    current.items.push({ item, originalIndex: index });
  });

  if (current.section || current.items.length || !pages.length) pages.push(current);
  return pages;
}

function setFormPreviewPage(pageIndex) {
  const state = formPreviewPageState || {};
  const body = document.getElementById(state.containerId || 'form-preview-body');
  if (!body || !state.formInfo) return;

  const normalizedQuestions = (state.questions || []).map(normalizeQuestionForPreview);
  const pageCount = buildFormPreviewPages(normalizedQuestions).length || 1;
  const nextPage = Math.min(Math.max(Number(pageIndex) || 0, 0), pageCount - 1);
  formPreviewPageState.page = nextPage;
  body.innerHTML = renderFormPreviewSurface(
    { ...state.formInfo, _previewPageIndex: nextPage },
    state.questions || []
  );
  body.scrollTop = 0;
}

function pushFormPreviewHistory() {
  if (history.state?.formPreviewModal && formPreviewHistoryActive) return;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  history.replaceState({ ...(history.state || {}), formCreateActive: true }, '', currentUrl);
  history.pushState({ formPreviewModal: true, formCreateActive: true }, '', currentUrl);
  formPreviewHistoryActive = true;
}

function closeFormPreviewModal(fromHistory = false) {
  closeModal('form-preview-modal');
  formPreviewHistoryActive = false;
  if (!fromHistory && history.state?.formPreviewModal) {
    history.back();
  }
}

function cloneForHistory(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function getCreateFormStateSnapshot() {
  syncRichTitleInputFromEditor();
  syncRichTextFieldFromEditor('new-form-desc-editor');
  syncRichTextFieldFromEditor('new-form-loi-ket-editor');
  return {
    name: document.getElementById('new-form-name')?.value || '',
    desc: document.getElementById('new-form-desc')?.value || '',
    cat: document.getElementById('new-form-cat')?.value || '',
    surveyType: document.getElementById('new-form-survey-type')?.value || '',
    target: document.getElementById('new-form-target')?.value || 'Tất cả',
    noClose: !!document.getElementById('new-form-no-close')?.checked,
    closeDate: document.getElementById('new-form-close')?.value || '',
    closeDisplay: document.getElementById('new-form-close-display')?.value || '',
    urgent: !!document.getElementById('new-approval-urgent')?.checked,
    urgentReason: document.getElementById('new-approval-urgent-reason')?.value || '',
    approvalDeadline: document.getElementById('new-approval-deadline')?.value || '',
    loiKet: document.getElementById('new-form-loi-ket')?.value || '',
    selectedQuestions: Array.from(selectedQuestions || []),
    directQuestions: cloneForHistory(directQuestions || []),
    theme: cloneForHistory(createFormTheme),
    collaborators: cloneForHistory(createCollaborators),
  };
}

function applyCreateFormStateSnapshot(state) {
  if (!state) return;
  setRichTitleEditorValue(state.name || '');
  setRichTextFieldValue('new-form-desc', state.desc || '');
  setRichTextFieldValue('new-form-loi-ket', state.loiKet || '');
  const cat = document.getElementById('new-form-cat');
  if (cat) cat.value = state.cat || '';
  syncCreateSurveyTypes();
  const survey = document.getElementById('new-form-survey-type');
  if (survey) survey.value = state.surveyType || '';
  const target = document.getElementById('new-form-target');
  if (target) target.value = state.target || 'Tất cả';
  const noClose = document.getElementById('new-form-no-close');
  if (noClose) noClose.checked = !!state.noClose;
  const close = document.getElementById('new-form-close');
  if (close) close.value = state.closeDate || '';
  const closeDisplay = document.getElementById('new-form-close-display');
  if (closeDisplay) closeDisplay.value = state.closeDisplay || formatISOToDDMMYYYY(state.closeDate || '');
  setCreateNoCloseState(!!state.noClose);
  const urgent = document.getElementById('new-approval-urgent');
  if (urgent) urgent.checked = !!state.urgent;
  const urgentReason = document.getElementById('new-approval-urgent-reason');
  if (urgentReason) urgentReason.value = state.urgentReason || '';
  const deadline = document.getElementById('new-approval-deadline');
  if (deadline) deadline.value = state.approvalDeadline || '';
  selectedQuestions = new Set(state.selectedQuestions || []);
  directQuestions = cloneForHistory(state.directQuestions || []);
  createFormTheme = { ...DEFAULT_FORM_THEME, ...(state.theme || {}) };
  createCollaborators = cloneForHistory(state.collaborators || []);
  updateUrgentReasonCount();
  toggleApprovalNoteField();
  renderQList();
  renderDirectQList();
  applyCreateTheme();
  renderCreateCollaborators();
}

function recordCreateHistory({ resetRedo = true } = {}) {
  if (!isModalVisible('create-form-modal')) return;
  const state = getCreateFormStateSnapshot();
  const last = createHistoryStack[createHistoryStack.length - 1];
  if (JSON.stringify(last) === JSON.stringify(state)) return;
  createHistoryStack.push(state);
  if (createHistoryStack.length > 60) createHistoryStack.shift();
  if (resetRedo) createRedoStack = [];
  updateCreateHistoryButtons();
}

function scheduleCreateHistoryRecord() {
  clearTimeout(createHistoryTimer);
  createHistoryTimer = setTimeout(() => recordCreateHistory(), 220);
}

function updateCreateHistoryButtons() {
  const undo = document.getElementById('create-undo-btn');
  const redo = document.getElementById('create-redo-btn');
  if (undo) undo.style.opacity = createHistoryStack.length > 1 ? '1' : '.38';
  if (redo) redo.style.opacity = createRedoStack.length ? '1' : '.38';
}

function undoCreateForm() {
  if (createHistoryStack.length <= 1) return;
  const current = createHistoryStack.pop();
  createRedoStack.push(current);
  applyCreateFormStateSnapshot(createHistoryStack[createHistoryStack.length - 1]);
  updateCreateHistoryButtons();
}

function redoCreateForm() {
  const next = createRedoStack.pop();
  if (!next) return;
  createHistoryStack.push(next);
  applyCreateFormStateSnapshot(next);
  updateCreateHistoryButtons();
}

function toggleCreateThemePanel(force) {
  const panel = document.getElementById('create-theme-panel');
  if (!panel) return;
  const next = typeof force === 'boolean' ? force : panel.style.display === 'none';
  panel.style.display = next ? 'flex' : 'none';
  if (next) syncThemePanelControls();
}

function syncThemePanelControls() {
  document.querySelectorAll('[data-theme-key]').forEach(control => {
    const key = control.getAttribute('data-theme-key');
    if (key && createFormTheme[key] != null) control.value = createFormTheme[key];
  });
  renderThemeColorGrid();
  applyCreateTheme();
}

function renderThemeColorGrid() {
  const colors = ['#db4437','#673ab7','#3f51b5','#4285f4','#03a9f4','#00acc1','#ff5722','#ff9800','#009688','#4caf50','#607d8b','#9e9e9e'];
  const backgrounds = ['#ffffff','#f8fafc','#eef5ff','#f3e8ff','#fef3c7','#ffedd5','#dcfce7','#e0f2fe','#fce7f3','#f1f5f9','#e5e7eb','#111827'];
  const render = (id, list, key) => {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    wrap.innerHTML = list.map(color => `<button type="button" title="${color}" onclick="setCreateTheme('${key}','${color}')" style="width:32px;height:32px;border-radius:50%;border:${createFormTheme[key] === color ? '3px solid #0f172a' : '1px solid #e2e8f0'};background:${color};cursor:pointer;box-shadow:0 2px 8px rgba(15,23,42,.08)"></button>`).join('');
  };
  render('create-theme-color-grid', colors, 'color');
  render('create-theme-bg-grid', backgrounds, 'background');
}

function setCreateTheme(key, value) {
  createFormTheme = { ...createFormTheme, [key]: value };
  applyCreateTheme();
  syncThemePanelControls();
  scheduleCreateHistoryRecord();
}

function handleCreateHeaderImage(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Vui lòng chọn tệp hình ảnh', 'error');
    return;
  }
  if (file.size > 1024 * 1024 * 2) {
    showToast('Ảnh đầu trang nên nhỏ hơn 2MB', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => setCreateTheme('headerImage', reader.result || '');
  reader.readAsDataURL(file);
}

function hasCustomFormTheme(theme = {}) {
  const headerImage = String(theme.headerImage || theme.anh_bia || '').trim();
  const color = String(theme.color || '').trim().toLowerCase();
  const background = String(theme.background || theme.mau_nen || '').trim().toLowerCase();
  const headerFont = String(theme.headerFont || theme.font_family || '').trim();
  return !!headerImage
    || (!!color && color !== DEFAULT_FORM_THEME.color.toLowerCase())
    || (!!background && !LEGACY_DEFAULT_BACKGROUNDS.has(background))
    || (!!headerFont && headerFont !== DEFAULT_FORM_THEME.headerFont);
}

function resolveFormPreviewTheme(formInfo = {}) {
  const rawTheme = {
    ...(formInfo.theme || {}),
    headerImage: formInfo.theme?.headerImage || formInfo.anh_bia || formInfo.headerImage || '',
    background: formInfo.theme?.background || formInfo.mau_nen || formInfo.background || '',
    headerFont: formInfo.theme?.headerFont || formInfo.font_family || formInfo.headerFont || '',
  };
  if (!hasCustomFormTheme(rawTheme)) return { ...DEFAULT_PREVIEW_THEME };
  return {
    ...DEFAULT_PREVIEW_THEME,
    ...rawTheme,
    headerImage: rawTheme.headerImage || '',
    background: rawTheme.background || DEFAULT_PREVIEW_THEME.background,
    headerFont: rawTheme.headerFont || DEFAULT_PREVIEW_THEME.headerFont,
  };
}

function applyCreateTheme() {
  const theme = { ...DEFAULT_FORM_THEME, ...createFormTheme };
  const modal = document.querySelector('#create-form-modal .modal');
  const header = document.querySelector('#create-form-modal .modal-header');
  const scroll = document.getElementById('modal-scroll');
  const title = document.getElementById('new-form-name-editor');
  const desc = document.getElementById('new-form-desc-editor');
  const useDefaultEditLook = !theme.headerImage
    && theme.color === DEFAULT_FORM_THEME.color
    && theme.background === DEFAULT_FORM_THEME.background;
  if (modal) modal.style.background = '#fff';
  if (scroll) scroll.style.background = useDefaultEditLook ? '#fff' : theme.background;
  if (header) {
    header.classList.toggle('is-default-look', useDefaultEditLook);
    header.style.borderTop = '0';
    header.style.borderBottom = useDefaultEditLook ? '0' : '1px solid #dbe5f0';
    header.style.color = useDefaultEditLook ? '#fff' : '#0f172a';
    header.style.maxHeight = useDefaultEditLook ? '220px' : '';
    header.style.overflow = useDefaultEditLook ? 'hidden' : '';
    header.style.background = useDefaultEditLook
      ? '#00008B'
      : theme.headerImage
      ? `linear-gradient(90deg,rgba(255,255,255,.92),rgba(255,255,255,.78)),url("${theme.headerImage}") center/cover`
      : '#fff';
  }
  if (title) {
    title.style.fontFamily = `'${theme.headerFont}', 'Be Vietnam Pro', sans-serif`;
    title.style.fontSize = `${theme.headerSize}px`;
    title.style.color = useDefaultEditLook ? '#fff' : theme.color;
    title.style.fontWeight = '400';
  }
  if (desc) {
    desc.style.fontFamily = `'${theme.textFont}', 'Be Vietnam Pro', sans-serif`;
    desc.style.fontSize = `${theme.textSize}px`;
    desc.style.color = useDefaultEditLook ? '#dbeafe' : '#475569';
    desc.style.fontWeight = useDefaultEditLook ? '500' : '400';
  }
  document.querySelectorAll('#create-form-header-actions .icon-btn').forEach(btn => {
    btn.style.color = useDefaultEditLook ? '#00008B' : 'var(--gray-500)';
    btn.style.background = useDefaultEditLook ? '#fff' : '';
    btn.style.border = useDefaultEditLook ? '1px solid rgba(255,255,255,.75)' : '';
    btn.style.boxShadow = useDefaultEditLook ? '0 8px 18px rgba(0,0,0,.14)' : '';
  });
  document.querySelectorAll('#direct-q-list input, #direct-q-list textarea, #direct-q-list select').forEach(el => {
    el.style.fontFamily = `'${theme.questionFont}', 'Be Vietnam Pro', sans-serif`;
  });
  const preview = document.getElementById('create-theme-header-preview');
  if (preview) {
    preview.style.backgroundImage = theme.headerImage ? `url("${theme.headerImage}")` : '';
    preview.textContent = theme.headerImage ? '' : 'Chưa chọn ảnh';
  }
}

async function copyCreatePreviewLink() {
  const value = `${location.origin}${location.pathname}#preview-form-draft`;
  try {
    await navigator.clipboard.writeText(value);
    showToast('Đã sao chép liên kết xem trước tạm', 'success');
  } catch {
    showToast('Trình duyệt không cho phép sao chép tự động', 'warning');
  }
}

function openCreateCollaboratorsPanel() {
  renderCreateCollaborators();
  openModal('create-collab-modal');
}

function addCreateCollaborator() {
  const input = document.getElementById('create-collab-input');
  const role = document.getElementById('create-collab-role')?.value || 'editor';
  const value = input?.value?.trim();
  if (!value) {
    showToast('Vui lòng nhập email hoặc tên cộng tác viên', 'error');
    return;
  }
  if (createCollaborators.some(item => item.value.toLowerCase() === value.toLowerCase())) {
    showToast('Cộng tác viên này đã được thêm', 'warning');
    return;
  }
  createCollaborators.push({ value, role });
  if (input) input.value = '';
  renderCreateCollaborators();
  scheduleCreateHistoryRecord();
}

function removeCreateCollaborator(index) {
  createCollaborators.splice(index, 1);
  renderCreateCollaborators();
  scheduleCreateHistoryRecord();
}

function renderCreateCollaborators() {
  const wrap = document.getElementById('create-collab-list');
  if (!wrap) return;
  wrap.innerHTML = createCollaborators.length
    ? createCollaborators.map((item, index) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc">
        <div style="min-width:0"><div style="font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(item.value)}</div><div style="font-size:12px;color:#64748b">${item.role === 'viewer' ? 'Chỉ xem' : 'Có thể chỉnh sửa'}</div></div>
        <button class="icon-btn" onclick="removeCreateCollaborator(${index})" title="Xóa">${IC.close}</button>
      </div>`).join('')
    : '<div style="padding:12px;border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;font-size:13px;text-align:center">Chưa có cộng tác viên</div>';
}

document.addEventListener('input', (event) => {
  if (event.target?.closest?.('#create-form-modal')) scheduleCreateHistoryRecord();
});
document.addEventListener('change', (event) => {
  if (event.target?.closest?.('#create-form-modal')) scheduleCreateHistoryRecord();
});

window.addEventListener('popstate', (event) => {
  const preview = document.getElementById('form-preview-modal');
  const previewIsOpen = preview && window.getComputedStyle(preview).display !== 'none';
  if (event.state?.formPreviewModal) {
    openFormPreview(false);
    formPreviewHistoryActive = true;
    return;
  }
  if (formPreviewHistoryActive || previewIsOpen) {
    closeFormPreviewModal(true);
  }
});

function isModalVisible(id) {
  const modal = document.getElementById(id);
  return !!modal && modal.classList.contains('open');
}

let confirmDialogResolver = null;

function handleConfirmDialog(result) {
  const resolver = confirmDialogResolver;
  confirmDialogResolver = null;
  closeModal('fm-confirm-modal');
  if (resolver) resolver(!!result);
}

function showConfirmDialog({
  title = 'Xác nhận thao tác',
  message = '',
  note = '',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  variant = 'danger',
} = {}) {
  const modal = document.getElementById('fm-confirm-modal');
  const titleEl = document.getElementById('fm-confirm-title');
  const messageEl = document.getElementById('fm-confirm-message');
  const noteEl = document.getElementById('fm-confirm-note');
  const okBtn = document.getElementById('fm-confirm-ok');
  const cancelBtn = document.getElementById('fm-confirm-cancel');
  const iconEl = document.getElementById('fm-confirm-icon');
  if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn) {
    return Promise.resolve(window.confirm(`${title}\n\n${message}${note ? `\n\n${note}` : ''}`));
  }

  const palette = variant === 'warning'
    ? { bg: '#fff7ed', fg: '#ea580c', btn: '#ea580c', border: '#ea580c' }
    : { bg: '#fee2e2', fg: '#dc2626', btn: '#dc2626', border: '#dc2626' };

  titleEl.textContent = title;
  messageEl.innerHTML = message;
  if (noteEl) {
    noteEl.style.display = note ? 'block' : 'none';
    noteEl.textContent = note;
  }
  if (iconEl) {
    iconEl.style.background = palette.bg;
    iconEl.style.color = palette.fg;
  }
  okBtn.textContent = confirmText;
  okBtn.style.background = palette.btn;
  okBtn.style.borderColor = palette.border;
  cancelBtn.textContent = cancelText;

  openModal('fm-confirm-modal');
  setTimeout(() => okBtn.focus(), 0);
  return new Promise(resolve => {
    confirmDialogResolver = resolve;
  });
}

function hideCreateFormModalVisual() {
  const modal = document.getElementById('create-form-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';
  document.body.style.overflow = '';
}

function releaseCreateFormModalVisual() {
  const modal = document.getElementById('create-form-modal');
  if (!modal) return;
  modal.style.opacity = '';
  modal.style.pointerEvents = '';
}

function pushCreateFormHistory() {
  if (history.state?.createFormModal && createFormHistoryActive) return;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  history.replaceState({ ...(history.state || {}), formManagementList: true }, '', currentUrl);
  history.pushState({ createFormModal: true }, '', currentUrl);
  createFormHistoryActive = true;
}

window.addEventListener('popstate', (event) => {
  if (createFormClosing) return;

  if (event.state?.createFormModal) {
    createFormHistoryActive = true;
    if (!isModalVisible('create-form-modal')) openFormModal(false);
    return;
  }

  if (isModalVisible('form-preview-modal')) return;

  if (createFormHistoryActive || isModalVisible('create-form-modal')) {
    window._skipCloseConfirm = true;
    closeFormModal(true);
  }
});

function renderQuestionPreview(q) {
  const normalizedType = normalizeQuestionType(q.type);
  const opts = q.opts || [];
  if (normalizedType === 'short_text') {
    return `<input disabled type="text" placeholder="Câu trả lời ngắn" style="padding:10px 12px;border:0;border-bottom:2px solid #cbd5e1;border-radius:8px 8px 0 0;font-size:13px;color:#94a3b8;background:#f8f9fb;width:100%;max-width:420px;outline:none">`;
  }
  if (normalizedType === 'paragraph') {
    return `<textarea disabled rows="4" placeholder="Đoạn văn" style="padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;color:#94a3b8;background:#f8f9fb;width:100%;resize:none"></textarea>`;
  }
  if (normalizedType === 'choice') {
    return opts.map((o,i) => `
      <label style="display:flex;align-items:center;gap:9px;padding:6px 0;font-size:13.5px;color:#374151;cursor:pointer">
        <span style="width:17px;height:17px;border-radius:50%;border:2px solid #00008B;flex-shrink:0;display:inline-block"></span>${o||`Lựa chọn ${i+1}`}
      </label>`).join('');
  }
  if (normalizedType === 'checkbox') {
    return opts.map((o,i) => `
      <label style="display:flex;align-items:center;gap:9px;padding:6px 0;font-size:13.5px;color:#374151;cursor:pointer">
        <span style="width:16px;height:16px;border-radius:3px;border:2px solid #00008B;flex-shrink:0;display:inline-block"></span>${o||`Lựa chọn ${i+1}`}
      </label>`).join('');
  }
  if (normalizedType === 'dropdown') {
    return `<select style="padding:8px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;color:#374151;background:#f8f9fb;width:100%;max-width:280px;cursor:pointer">
      <option>Chọn một mục...</option>${opts.map(o=>`<option>${o}</option>`).join('')}
    </select>`;
  }
  if (normalizedType === 'grid_radio' || normalizedType === 'grid_checkbox') {
    const rows = getGridRows(q);
    const cols = getGridCols(q);
    if (!rows.length || !cols.length) {
      return `<div style="padding:10px 12px;border:1px dashed #f59e0b;border-radius:10px;background:#fffbeb;color:#92400e;font-size:12.5px;font-weight:700">Câu hỏi lưới cần có ít nhất 1 hàng và 1 cột.</div>`;
    }
    const isRadio = normalizedType === 'grid_radio';
    return `<div style="overflow-x:auto;margin-top:4px">
      <table style="border-collapse:collapse;min-width:280px;font-size:12.5px">
        <thead>
          <tr>
            <th style="padding:6px 12px;text-align:left;color:#64748b;font-weight:500;border-bottom:2px solid #e2e8f0"></th>
            ${cols.map(c=>`<th style="padding:6px 12px;text-align:center;color:#00008B;font-weight:600;border-bottom:2px solid #e2e8f0;white-space:nowrap">${c}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((r,ri)=>`<tr style="background:${ri%2===0?'#f8faff':'#fff'}">
            <td style="padding:7px 12px;color:#374151;font-weight:500;border-bottom:1px solid #f1f5f9;white-space:nowrap">${r}</td>
            ${cols.map(()=>`<td style="padding:7px 12px;text-align:center;border-bottom:1px solid #f1f5f9">
              <span style="display:inline-block;width:${isRadio?'16px':'14px'};height:${isRadio?'16px':'14px'};border-radius:${isRadio?'50%':'3px'};border:2px solid #00008B;vertical-align:middle"></span>
            </td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }
  if (normalizedType === 'rating') {
    return renderRatingPreview(getQuestionRatingConfig(q));
  }
  if (normalizedType === 'upload') {
    return `<button disabled style="display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:1.5px dashed #94a3b8;border-radius:10px;background:#f8fafc;color:#475569;font-size:13px;font-weight:800"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/></svg>Tải tệp lên</button>`;
  }
  if (normalizedType === 'date' || normalizedType === 'time') {
    return `<input disabled type="${normalizedType === 'date' ? 'date' : 'time'}" style="width:220px;max-width:100%;padding:10px 12px;border:1.5px solid #bbf7d0;border-radius:10px;background:#f8fffb;color:#64748b;font-size:13px">`;
  }
  if (normalizedType === 'scale') {
    return renderScalePreview(getQuestionScaleConfig(q));
  }
  return '';
}

function openFormPreview(pushHistory = true) {
  const name = document.getElementById('new-form-name')?.value?.trim() || '(Chưa đặt tên)';
  const desc = document.getElementById('new-form-desc')?.value?.trim() || '';
  const cat  = document.getElementById('new-form-cat')?.value || '';
  const sel  = typeof getAllFormItems === 'function' ? getAllFormItems() : getAllFormQuestions();

  const body = document.getElementById('form-preview-body');
  const title = document.getElementById('form-preview-title');
  if (!body || !title) return;

  // Keep preview above the create form in both popup and standalone create page.
  const previewOverlay = document.getElementById('form-preview-modal');
  if (previewOverlay) previewOverlay.style.zIndex = '1300';

  title.innerHTML = formatRichText(name);

  const previewInfo = { name, desc, cat, target: '', theme: createFormTheme };
  formPreviewPageState = { page: 0, formInfo: previewInfo, questions: sel, containerId: 'form-preview-body' };
  body.innerHTML = renderFormPreviewSurface({ ...previewInfo, _previewPageIndex: 0 }, sel);
  openModal('form-preview-modal');
  if (pushHistory) pushFormPreviewHistory();
  return;

  if (!sel.length) {
    body.innerHTML = `<div style="text-align:center;padding:40px 0;color:#94a3b8;font-size:14px">Chưa có câu hỏi nào trong form.</div>`;
    openModal('form-preview-modal');
    if (pushHistory) pushFormPreviewHistory();
    return;
  }

  body.innerHTML = `
    <div style="max-width:1180px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#00008B 0%,#00008B 52%,#00008B 100%);border-radius:28px;padding:28px 32px;margin-bottom:24px;color:#00008B;box-shadow:0 24px 48px rgba(0,0,139,.14)">
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
          ${cat ? `<span style="font-size:12px;background:rgba(255,255,255,0.5);padding:6px 12px;border-radius:999px;font-weight:700">${cat}</span>` : ''}
          <span style="font-size:12px;background:rgba(255,255,255,0.5);padding:6px 12px;border-radius:999px;font-weight:700">Tổng ${sel.length} câu hỏi</span>
        </div>
        <div style="font-size:32px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;margin-bottom:10px">${formatRichText(name)}</div>
        ${desc ? `<div style="font-size:17px;line-height:1.6;width:100%">${formatRichText(desc)}</div>` : ''}
      </div>

      <div style="display:flex;flex-direction:column;gap:16px;padding-bottom:24px">
        ${sel.map((q, i) => `
          <div style="border:1px solid #00008B;border-radius:22px;padding:20px 22px;background:rgba(255,255,255,.9);box-shadow:0 10px 26px rgba(0,0,139,.08)">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px">
              <div style="display:flex;align-items:flex-start;gap:14px;flex:1;min-width:0">
                <div style="width:36px;height:36px;border-radius:50%;background:#00008B;color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">${i+1}</div>
                <div style="flex:1;min-width:0">
                <div style="font-size:16px;font-weight:600;color:#0f172a;margin-bottom:12px;line-height:1.5">${formatRichText(q.text, q.required)}</div>
                  ${renderQuestionMedia(q)}
                  ${renderQuestionPreview(q)}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
                <span style="flex-shrink:0;padding:6px 12px;border-radius:999px;background:#00008B;color:#fff;font-size:12px;font-weight:700;white-space:nowrap">${TYPE_LABEL_MAP[normalizeQuestionType(q.type)] || normalizeQuestionType(q.type)}</span>
              </div>
            </div>
          </div>`).join('')}
      </div>

      <div style="padding-bottom:20px;text-align:center">
        <button disabled style="padding:12px 36px;background:#00008B;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:not-allowed;opacity:.78">Gửi phản hồi</button>
      </div>
    </div>`;

  openModal('form-preview-modal');
  if (pushHistory) pushFormPreviewHistory();
}

function previewEsc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeRichTextHref(value) {
  const href = String(value || '').replace(/&amp;/g, '&').trim();
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(href)) return previewEsc(href);
  return '#';
}

function applyInlineRichText(value) {
  return value
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => `<a href="${sanitizeRichTextHref(href)}" target="_blank" rel="noopener" style="color:#00008B;text-decoration:underline">${text}</a>`)
    .replace(/&lt;a href=&quot;([\s\S]*?)&quot;&gt;([\s\S]*?)&lt;\/a&gt;/g, (_, href, text) => `<a href="${sanitizeRichTextHref(href)}" target="_blank" rel="noopener" style="color:#00008B;text-decoration:underline">${text}</a>`)
    .replace(/&lt;strong&gt;([\s\S]*?)&lt;\/strong&gt;/g, '<strong>$1</strong>')
    .replace(/&lt;b&gt;([\s\S]*?)&lt;\/b&gt;/g, '<strong>$1</strong>')
    .replace(/&lt;em&gt;([\s\S]*?)&lt;\/em&gt;/g, '<em>$1</em>')
    .replace(/&lt;i&gt;([\s\S]*?)&lt;\/i&gt;/g, '<em>$1</em>')
    .replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, '<u>$1</u>')
    .replace(/&lt;s&gt;([\s\S]*?)&lt;\/s&gt;/g, '<s>$1</s>')
    .replace(/~~([\s\S]*?)~~/g, '<s>$1</s>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

function renderRichTextBlocks(value) {
  const lines = value.split('\n');
  let html = '';
  let listType = '';
  let listItems = [];

  const flushList = () => {
    if (!listType) return;
    html += `<${listType} style="margin:6px 0 6px 22px;padding:0">${listItems.map(item => `<li>${item}</li>`).join('')}</${listType}>`;
    listType = '';
    listItems = [];
  };

  lines.forEach((line, index) => {
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (ordered || bullet) {
      const nextType = ordered ? 'ol' : 'ul';
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push(applyInlineRichText(ordered ? ordered[1] : bullet[1]));
      return;
    }

    flushList();
    if (line) html += applyInlineRichText(line);
    if (index < lines.length - 1) html += '<br>';
  });

  flushList();
  return html;
}

function formatRichText(value, isRequired = false) {
  if (!value) return isRequired ? ' <span style="color:#ef4444;margin-left:2px">*</span>' : '';
  let text = String(value);
  if (isRequired) {
    const lines = text.split('\n');
    lines[0] = lines[0] + '__REQ_STAR__';
    text = lines.join('\n');
  }
  let html = renderRichTextBlocks(previewEsc(text));
  if (isRequired) {
    html = html.replace('__REQ_STAR__', ' <span style="color:#ef4444;margin-left:2px">*</span>');
  }
  return html;
}

function renderRichTextBlocksForEditor(value) {
  const lines = value.split('\n');
  let html = '';
  let listType = '';
  let listItems = [];

  const flushList = () => {
    if (!listType) return;
    html += `<${listType}>${listItems.map(item => `<li>${item}</li>`).join('')}</${listType}>`;
    listType = '';
    listItems = [];
  };

  lines.forEach((line, index) => {
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (ordered || bullet) {
      const nextType = ordered ? 'ol' : 'ul';
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push(applyInlineRichText(ordered ? ordered[1] : bullet[1]));
      return;
    }

    flushList();
    if (line) html += applyInlineRichText(line);
    if (index < lines.length - 1) html += '<br>';
  });

  flushList();
  return html;
}

function formatRichTextForEditor(value) {
  return renderRichTextBlocksForEditor(previewEsc(value));
}

function getQuestionImageUrl(q) {
  return q?.image || q?.image_url || q?.hinh_anh_url || '';
}

function getQuestionVideoUrl(q) {
  return q?.video || q?.video_url || '';
}

function getYoutubeEmbedUrl(url) {
  const text = String(url || '').trim();
  if (!text) return '';
  try {
    const parsed = new URL(text);
    let id = '';
    if (parsed.hostname.includes('youtu.be')) id = parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (parsed.hostname.includes('youtube.com')) id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop() || '';
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : '';
  } catch(e) {
    return '';
  }
}

function isNativeVideoUrl(url) {
  const text = String(url || '').trim();
  return /^data:video\//i.test(text) || /\.(mp4|webm|ogg)([?#].*)?$/i.test(text);
}

function renderQuestionMedia(q) {
  const imageUrl = getQuestionImageUrl(q);
  const videoUrl = getQuestionVideoUrl(q);
  if (!imageUrl && !videoUrl) return '';

  const align = q.image_align || parseJsonObject(q.validation_json || q.validation || q.logic_json).image_align || 'left';
  const width = q.image_width || parseJsonObject(q.validation_json || q.validation || q.logic_json).image_width || 'auto';
  const imageHtml = imageUrl ? `
    <div style="margin-bottom:12px;display:flex;justify-content:${align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'}">
      <img src="${previewEsc(imageUrl)}" alt="Hình ảnh câu hỏi" style="width:${width};display:block;max-width:100%;max-height:400px;border-radius:12px;border:1px solid #dbe4f0;object-fit:contain;background:#f8fafc">
    </div>` : '';

  const embedUrl = getYoutubeEmbedUrl(videoUrl);
  const videoHtml = videoUrl ? (isNativeVideoUrl(videoUrl) ? `
    <div style="margin-bottom:12px;max-width:560px">
      <video src="${previewEsc(videoUrl)}" controls style="display:block;width:100%;max-height:320px;border-radius:12px;border:1px solid #dbe4f0;background:#0f172a"></video>
    </div>` : embedUrl ? `
    <div style="margin-bottom:12px;max-width:560px;aspect-ratio:16/9;border-radius:12px;overflow:hidden;border:1px solid #dbe4f0;background:#0f172a">
      <iframe src="${previewEsc(embedUrl)}" title="Video câu hỏi" style="width:100%;height:100%;border:0" allowfullscreen></iframe>
    </div>` : `
    <div style="margin-bottom:12px">
      <a href="${previewEsc(videoUrl)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;background:#f5f3ff;border:1px solid #ddd6fe;color:#6d28d9;font-size:13px;font-weight:700;text-decoration:none;max-width:100%;word-break:break-all">Video: ${previewEsc(videoUrl)}</a>
    </div>`) : '';

  return `<div style="margin:0 0 14px">${imageHtml}${videoHtml}</div>`;
}

function previewQuestionChip(type) {
  const normalizedType = normalizeQuestionType(type);
  if (normalizedType === 'choice') return 'Lựa chọn';
  if (normalizedType === 'checkbox') return 'Hộp kiểm';
  if (normalizedType === 'dropdown') return 'Thả xuống';
  if (normalizedType === 'rating') return 'Đánh giá';
  if (normalizedType === 'scale') return 'Thang đo';
  if (normalizedType === 'short_text') return 'Tự luận';
  if (normalizedType === 'paragraph') return 'Tự luận dài';
  if (normalizedType === 'grid_radio') return 'Lưới trắc nghiệm';
  if (normalizedType === 'grid_checkbox') return 'Lưới hộp kiểm';
  if (normalizedType === 'upload') return 'Tải tệp';
  if (normalizedType === 'date') return 'Ngày';
  if (normalizedType === 'time') return 'Giờ';
  return TYPE_LABEL_MAP[normalizedType] || normalizedType;
}

function getPreviewControlName(q, fallback = '') {
  const raw = q?.id || q?.client_id || q?.ma_cau_hoi || q?.text || q?.noi_dung || fallback || 'preview';
  return `preview_${String(raw).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function renderPreviewOptionPills(q, kind = 'radio', includeOther = false, controlName = 'preview_choice') {
  const options = Array.isArray(q.opts) ? q.opts : [];
  const list = [...options];
  const type = kind === 'checkbox' ? 'checkbox' : 'radio';
  const nameAttr = type === 'radio' ? `name="${previewEsc(controlName)}"` : '';
  const otherId = `${controlName}_other`;
  const otherTextId = `${controlName}_other_text`;
  const controlStyle = `width:18px;height:18px;accent-color:#00008B;cursor:pointer;flex-shrink:0`;
  
  let vj = {}; try { vj = typeof q.validation_json === 'string' ? JSON.parse(q.validation_json) : q.validation_json; } catch(e){}
  const optImgs = vj && vj.option_images ? vj.option_images : {};

  return `<div style="display:flex;flex-direction:column;gap:10px">
    ${list.map((option, index) => {
      const imgHtml = optImgs[index] ? `<img src="${optImgs[index]}" style="margin-top:8px;max-height:120px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;align-self:flex-start">` : '';
      return `<label style="display:flex;align-items:flex-start;gap:8px;width:100%;min-height:50px;padding:12px 14px;border:1px solid #dbe4f0;border-radius:12px;background:rgba(255,255,255,.92);font-size:14px;font-weight:500;color:#334155;box-sizing:border-box;cursor:pointer">
        <input type="${type}" ${nameAttr} value="${previewEsc(option || `Lựa chọn ${index + 1}`)}" style="${controlStyle};margin-top:2px;">
        <div style="display:flex;flex-direction:column;flex:1;word-break:break-word">
          <span>${previewEsc(option || `Lựa chọn ${index + 1}`)}</span>
          ${imgHtml}
        </div>
      </label>`;
    }).join('')}
    ${includeOther ? `
      <label style="display:flex;align-items:center;gap:8px;width:100%;min-height:50px;padding:12px 14px;border:1px solid #dbe4f0;border-radius:12px;background:rgba(255,255,255,.92);font-size:14px;font-weight:500;color:#334155;box-sizing:border-box;cursor:pointer">
        <input id="${previewEsc(otherId)}" type="${type}" ${nameAttr} value="__other__" onchange="const otherText=document.getElementById('${previewEsc(otherTextId)}');if(this.checked&&otherText){setTimeout(()=>otherText.focus(),0)}" style="${controlStyle}">
        <span>Khác:</span>
        <input id="${previewEsc(otherTextId)}" type="text" placeholder="Câu trả lời khác" onfocus="const el=document.getElementById('${previewEsc(otherId)}');if(el)el.checked=true" style="flex:1;min-width:160px;border:0;border-bottom:1.5px solid #cbd5e1;background:transparent;padding:6px 0;font:inherit;color:#334155;outline:none">
      </label>
    ` : ''}
  </div>`;
}

function renderInteractiveScalePreview(q) {
  const scale = normalizeScaleConfig(getQuestionScaleConfig(q));
  const values = getScaleValues(scale);
  const name = getPreviewControlName(q, 'scale');
  const hasLabels = !!(scale.labelMin || scale.labelMax);
  return `<div style="width:100%;overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;min-width:${Math.max(values.length * 56, 200)}px">
      <thead>
        <tr>
          ${hasLabels ? `<td style="width:1%"></td>` : ''}
          ${values.map(n => `<td style="padding:0 0 6px;text-align:center;font-size:13px;font-weight:700;color:#1e293b">${n}</td>`).join('')}
          ${hasLabels ? `<td style="width:1%"></td>` : ''}
        </tr>
      </thead>
      <tbody>
        <tr>
          ${hasLabels ? `<td style="padding:0 10px 0 0;white-space:nowrap;font-size:12.5px;font-weight:700;color:#64748b;text-align:left;width:1%">${previewEsc(scale.labelMin || '')}</td>` : ''}
          ${values.map(n => `<td style="padding:4px 0;text-align:center">
            <label style="display:flex;flex-direction:column;align-items:center;cursor:pointer">
              <input type="radio" name="${previewEsc(name)}" value="${n}" style="width:20px;height:20px;accent-color:#00008B;cursor:pointer;margin:0">
            </label>
          </td>`).join('')}
          ${hasLabels ? `<td style="padding:0 0 0 10px;white-space:nowrap;font-size:12.5px;font-weight:700;color:#64748b;text-align:right;width:1%">${previewEsc(scale.labelMax || '')}</td>` : ''}
        </tr>
      </tbody>
    </table>
  </div>`;
}

function renderInteractiveRatingPreview(q) {
  const rating = normalizeRatingConfig(getQuestionRatingConfig(q));
  const name = getPreviewControlName(q, 'rating');
  const uid = previewEsc(name);
  return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap" id="rating-wrap-${uid}">
    ${Array.from({ length: rating.count }, (_, i) => {
      const value = i + 1;
      return `<label style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer" title="${value} sao">
        <span style="font-size:12px;font-weight:700;color:#64748b">${value}</span>
        <input type="radio" name="${previewEsc(name)}" value="${value}"
          style="position:absolute;opacity:0;width:0;height:0"
          onchange="(function(el){var wrap=el.closest('[id^=rating-wrap]');if(!wrap)return;var val=Number(el.value);wrap.querySelectorAll('.preview-star').forEach(function(s,idx){s.textContent=idx<val?'★':'☆';s.style.color=idx<val?'#f59e0b':'#cbd5e1';});})( this)">
        <span class="preview-star" style="font-size:30px;line-height:1;color:#cbd5e1;cursor:pointer">☆</span>
      </label>`;
    }).join('')}
  </div>`;
}

function renderQuestionPreview(q) {
  const normalizedType = normalizeQuestionType(q.type);
  if (normalizedType === 'presentation_image' || normalizedType === 'presentation_video') return '';
  const opts = Array.isArray(q.opts) ? q.opts : [];
  const controlName = getPreviewControlName(q, normalizedType);

  if (normalizedType === 'short_text') {
    return `<input type="text" placeholder="Nh&#7853;p c&acirc;u tr&#7843; l&#7901;i ng&#7855;n" style="width:100%;max-width:460px;box-sizing:border-box;padding:12px 14px;border:0;border-bottom:2px solid #cbd5e1;border-radius:12px 12px 0 0;font:inherit;color:#334155;background:#fff;outline:none">`;
  }
  if (normalizedType === 'paragraph') {
    return `<textarea rows="4" placeholder="Nh&#7853;p c&acirc;u tr&#7843; l&#7901;i c&#7911;a b&#7841;n" style="width:100%;box-sizing:border-box;min-height:120px;padding:12px 14px;border:1px solid #cbd5e1;border-radius:14px;font:inherit;color:#334155;background:#fff;resize:vertical;outline:none"></textarea>`;
  }
  if (normalizedType === 'choice') return renderPreviewOptionPills(q, 'radio', questionAllowsOther(q), controlName);
  if (normalizedType === 'checkbox') return renderPreviewOptionPills(q, 'checkbox', questionAllowsOther(q), controlName);
  if (normalizedType === 'dropdown') {
    return `<select style="width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #cbd5e1;border-radius:14px;font:inherit;color:#334155;background:#fff;outline:none;cursor:pointer">
      <option>Ch&#7885;n m&#7897;t m&#7909;c...</option>
      ${opts.map(option => `<option>${previewEsc(option)}</option>`).join('')}
    </select>`;
  }
  if (normalizedType === 'grid_radio' || normalizedType === 'grid_checkbox') {
    const rows = getGridRows(q);
    const cols = getGridCols(q);
    if (!rows.length || !cols.length) {
      return `<div style="padding:12px 14px;border:1px dashed #f59e0b;border-radius:12px;background:#fffbeb;color:#92400e;font-size:13px;font-weight:700">Cau hoi luoi can co it nhat 1 hang va 1 cot.</div>`;
    }
    const isRadio = normalizedType === 'grid_radio';
    return `<div style="overflow-x:auto">
      <table style="border-collapse:separate;border-spacing:0;width:100%;min-width:420px;table-layout:fixed;border:1px solid #00008B;border-radius:16px;overflow:hidden;background:#fff">
        <thead>
          <tr>
            <th style="padding:12px 14px;text-align:left;background:#00008B;color:#fff;font-size:13px;font-weight:700;border-bottom:1px solid #00008B"></th>
            ${cols.map(col => `<th style="padding:12px 14px;text-align:center;background:#00008B;color:#fff;font-size:13px;font-weight:700;border-bottom:1px solid #00008B">${previewEsc(col)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, rowIndex) => `
            <tr style="background:${rowIndex % 2 === 0 ? '#fff' : '#fcfdff'}">
              <td style="padding:14px;color:#0f172a;font-size:14px;font-weight:600;border-bottom:${rowIndex === rows.length - 1 ? 'none' : '1px solid #eef4ff'}">${previewEsc(row)}</td>
              ${cols.map((col, colIndex) => `<td style="padding:14px;text-align:center;border-bottom:${rowIndex === rows.length - 1 ? 'none' : '1px solid #eef4ff'}">
                <input type="${isRadio ? 'radio' : 'checkbox'}" ${isRadio ? `name="${previewEsc(`${controlName}_${rowIndex}`)}"` : ''} value="${previewEsc(col)}" style="width:18px;height:18px;accent-color:#00008B;cursor:pointer">
              </td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }
  if (normalizedType === 'scale') {
    return renderInteractiveScalePreview(q);
  }
  if (normalizedType === 'rating') {
    return renderInteractiveRatingPreview(q);
  }
  if (normalizedType === 'upload') {
    return `<label style="display:inline-flex;align-items:center;gap:8px;padding:11px 14px;border:1.5px dashed #94a3b8;border-radius:12px;background:#f8fafc;color:#475569;font:inherit;font-weight:800;cursor:pointer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/></svg>T&#7843;i t&#7879;p l&ecirc;n<input type="file" style="display:none"></label>`;
  }
  if (normalizedType === 'date' || normalizedType === 'time') {
    return `<input type="${normalizedType === 'date' ? 'date' : 'time'}" style="width:220px;max-width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid #bbf7d0;border-radius:12px;background:#f8fffb;color:#334155;font:inherit;outline:none">`;
  }
  return '';
}

function normalizeQuestionForPreview(q) {
  if (isSectionItem(q)) {
    return {
      ...q,
      type: 'section',
      text: q.title || q.noi_dung || q.text || '',
      desc: q.desc || q.description || q.mo_ta_cau_hoi || '',
    };
  }

  const choices = Array.isArray(q.lua_chon)
    ? q.lua_chon.map(o => o?.noi_dung || o).filter(Boolean)
    : [];

  return {
    ...q,
    type: normalizeQuestionType(q.type || q.loai),
    text: q.text || q.noi_dung || '',
    desc: q.desc || q.description || q.mo_ta_cau_hoi || '',
    opts: Array.isArray(q.opts) && q.opts.length ? q.opts : choices,
    required: Boolean(q.required ?? q.bat_buoc),
    rows: getGridRows(q),
    cols: getGridCols(q),
    image: getQuestionImageUrl(q),
    video: getQuestionVideoUrl(q),
  };
}

function renderFormPreviewSurface(formInfo, questions) {
  const normalizedQuestions = (questions || []).map(normalizeQuestionForPreview);
  const realCount = countRealQuestions(normalizedQuestions);
  const name = formInfo.name || '(Chưa đặt tên)';
  const desc = formInfo.desc || '';
  const cat = formInfo.cat || 'Khác';
  const theme = resolveFormPreviewTheme(formInfo);
  const accent = theme.color || DEFAULT_FORM_THEME.color;
  const background = theme.background || DEFAULT_FORM_THEME.background;
  const headerImage = theme.headerImage || formInfo.anh_bia || '';
  const headerBg = headerImage
    ? `linear-gradient(135deg,rgba(255,255,255,.92),rgba(255,255,255,.78)),url("${String(headerImage).replace(/"/g, '%22')}") center/cover`
    : `linear-gradient(135deg,${background} 0%,#ffffff 70%)`;
  const previewPages = buildFormPreviewPages(normalizedQuestions);
  const previewPageIndex = Math.min(
    Math.max(Number(formInfo._previewPageIndex || 0), 0),
    Math.max(previewPages.length - 1, 0)
  );
  const currentPreviewPage = previewPages[previewPageIndex] || previewPages[0] || { section: null, sectionIndex: -1, items: [] };
  const previewQuestionItems = currentPreviewPage.items || [];
  const hasPreviewPages = previewPages.length > 1;

  if (!normalizedQuestions.length) {
    return `<div style="min-height:100%;background:${background};font-family:'Be Vietnam Pro','${theme.textFont}',sans-serif">
      <div style="max-width:1080px;margin:0 auto;padding:52px 20px 64px">
        <div style="text-align:center;padding:40px 0;color:#94a3b8;font-size:14px">Chưa có câu hỏi nào trong form.</div>
        <div style="display:flex;justify-content:center"><button type="button" disabled style="min-width:210px;height:48px;padding:0 20px;border:none;border-radius:14px;background:linear-gradient(135deg,#22c1f1,#1d9bf0);color:#fff;font-size:15px;font-weight:800;opacity:.72;cursor:not-allowed">Gửi phản hồi</button></div>
      </div>
    </div>`;
  }

  return `
    <div style="min-height:100%;background:${background};font-family:'Be Vietnam Pro','${theme.textFont}',sans-serif;color:#0f172a">
    <div style="max-width:1080px;margin:0 auto;padding:52px 20px 64px">
      <section style="background:transparent;border:0;border-radius:0;padding:0;box-shadow:none">
        <div style="min-height:180px;margin-bottom:18px;position:relative;overflow:hidden;border-radius:30px;background:${headerBg};border-top:8px solid ${accent};box-shadow:0 24px 48px rgba(15,23,42,.12);display:flex;flex-direction:column;justify-content:flex-end;padding:28px 30px">
          <div style="position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(255,255,255,.32),transparent 34%),radial-gradient(circle at bottom left,rgba(255,255,255,.22),transparent 28%)"></div>
          <div style="position:relative;z-index:1">
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
              <span style="padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.72);color:${accent};font-size:12px;font-weight:700">${previewEsc(cat)}</span>
              <span style="padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.72);color:${accent};font-size:12px;font-weight:700">Tổng ${realCount} câu hỏi</span>
            </div>
            <h1 style="margin:0;font-family:'${theme.headerFont}','Be Vietnam Pro',sans-serif;font-size:32px;line-height:1.2;font-weight:700;color:${accent}">${formatRichText(name)}</h1>
            ${desc ? `<p style="margin:12px 0 0;width:100%;font-size:16px;color:${accent};line-height:1.55">${formatRichText(desc)}</p>` : ''}
          </div>
        </div>
      </section>

      <div style="display:flex;flex-direction:column;gap:16px;padding:12px 0 28px">
        ${currentPreviewPage.section ? `
          <div style="border:1px solid #fbbf24;border-left:6px solid #f59e0b;border-radius:20px;padding:20px 22px;background:linear-gradient(180deg,#fffbeb 0%,#fff7ed 100%);box-shadow:0 12px 26px rgba(180,83,9,.08)">
            <div style="font-size:12px;font-weight:900;color:#b45309;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Phần ${getSectionNumber(normalizedQuestions, currentPreviewPage.sectionIndex)} / ${getTotalSectionCount(normalizedQuestions)}</div>
            <div style="font-size:24px;font-weight:900;color:#78350f;line-height:1.3">${formatRichText(currentPreviewPage.section.text || `Phần ${getSectionNumber(normalizedQuestions, currentPreviewPage.sectionIndex)}`)}</div>
            ${currentPreviewPage.section.desc ? `<div style="font-size:14px;color:#92400e;line-height:1.55;margin-top:8px">${formatRichText(currentPreviewPage.section.desc)}</div>` : ''}
          </div>
        ` : (hasPreviewPages ? `
          <div style="border:1px solid #fbbf24;border-left:6px solid #f59e0b;border-radius:20px;padding:14px 18px;background:linear-gradient(180deg,#fffbeb 0%,#fff7ed 100%);box-shadow:0 12px 26px rgba(180,83,9,.06)">
            <div style="font-size:12px;font-weight:900;color:#b45309;text-transform:uppercase;letter-spacing:.6px">Phần ${previewPageIndex + 1} / ${previewPages.length}</div>
          </div>
        ` : '')}
        ${previewQuestionItems.map(({ item: q, originalIndex: i }) => `
          <div style="border:1px solid ${accent};border-radius:22px;padding:20px 20px 22px;background:linear-gradient(180deg,rgba(255,255,255,.96) 0%,rgba(255,247,237,.95) 100%);box-shadow:0 12px 26px rgba(0,0,139,.08)">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px">
              <div style="min-width:0;flex:1;display:flex;align-items:flex-start;gap:14px">
                <div style="width:36px;height:36px;border-radius:50%;background:${accent};color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${getQuestionNumberInSection(normalizedQuestions, i)}</div>
                <p style="margin:0;font-size:16px;line-height:1.5;font-weight:600;color:#0f172a">${formatRichText(q.text || 'Câu hỏi chưa có nội dung', q.required)}</p>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
                <span style="flex-shrink:0;padding:6px 12px;border-radius:999px;background:${accent};color:#fff;font-size:12px;font-weight:700;white-space:nowrap">${previewQuestionChip(q.type)}</span>
              </div>
            </div>
            ${renderQuestionMedia(q)}
            ${renderQuestionPreview(q)}
          </div>
        `).join('')}
      </div>
      <div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:18px;flex-wrap:wrap">
        ${hasPreviewPages && previewPageIndex > 0 ? `<button type="button" onclick="setFormPreviewPage(${previewPageIndex - 1})" style="min-width:118px;height:48px;padding:0 20px;border:1px solid #cbd5e1;border-radius:14px;background:#fff;color:${accent};font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 8px 18px rgba(15,23,42,.08)">Quay lại</button>` : ''}
        ${hasPreviewPages && previewPageIndex < previewPages.length - 1
          ? `<button type="button" onclick="setFormPreviewPage(${previewPageIndex + 1})" style="min-width:118px;height:48px;padding:0 20px;border:none;border-radius:14px;background:linear-gradient(135deg,#22c1f1,#1d9bf0);color:#fff;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 12px 28px rgba(29,155,240,.24)">Tiếp</button>`
          : `<button type="button" disabled title="Chỉ xem trước, không thể gửi phản hồi" style="min-width:210px;height:48px;padding:0 20px;border:none;border-radius:14px;background:linear-gradient(135deg,#22c1f1,#1d9bf0);color:#fff;font-size:15px;font-weight:800;opacity:.72;cursor:not-allowed">Gửi phản hồi</button>`}
        ${hasPreviewPages ? `<span style="font-size:13px;font-weight:800;color:#64748b">Phần ${previewPageIndex + 1}/${previewPages.length}</span>` : ''}
      </div>
    </div>
    </div>
  `;
}

function openFormPreview(pushHistory = true) {
  const name = document.getElementById('new-form-name')?.value?.trim() || '(Chưa đặt tên)';
  const desc = document.getElementById('new-form-desc')?.value?.trim() || '';
  const cat  = document.getElementById('new-form-cat')?.value || 'Khac';
  const target = normalizeSurveyTarget(document.getElementById('new-form-target')?.value || 'Tất cả');
  const sel  = typeof getAllFormItems === 'function' ? getAllFormItems() : getAllFormQuestions();

  const body = document.getElementById('form-preview-body');
  const title = document.getElementById('form-preview-title');
  if (!body || !title) return;

  const previewOverlay = document.getElementById('form-preview-modal');
  if (previewOverlay) previewOverlay.style.zIndex = '1300';

  title.innerHTML = formatRichText(name);

  const previewInfo = { name, desc, cat, target, theme: createFormTheme };
  formPreviewPageState = { page: 0, formInfo: previewInfo, questions: sel, containerId: 'form-preview-body' };
  body.innerHTML = renderFormPreviewSurface({ ...previewInfo, _previewPageIndex: 0 }, sel);
  openModal('form-preview-modal');
  if (pushHistory) pushFormPreviewHistory();
  return;

  if (!sel.length) {
    body.innerHTML = `<div style="text-align:center;padding:40px 0;color:#94a3b8;font-size:14px">Ch&#432;a c&oacute; c&acirc;u h&#7887;i n&agrave;o trong form.</div>`;
    openModal('form-preview-modal');
    if (pushHistory) pushFormPreviewHistory();
    return;
  }

  const createdAt = new Date().toLocaleDateString('vi-VN');

  body.innerHTML = `
    <div style="max-width:1080px;margin:0 auto;padding:52px 20px 64px;font-family:'Be Vietnam Pro',sans-serif;color:#0f172a">
      <section style="background:transparent;border:0;border-radius:0;padding:0;box-shadow:none">
        <div style="min-height:180px;margin-bottom:18px;position:relative;overflow:hidden;border-radius:30px;background:linear-gradient(135deg,#00008B 0%,#00008B 50%,#00008B 100%);box-shadow:0 24px 48px rgba(0,0,139,.16);display:flex;flex-direction:column;justify-content:flex-end;padding:28px 30px">
          <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(219,234,254,.92) 0%,rgba(224,242,254,.84) 42%,rgba(199,210,254,.9) 100%)"></div>
          <div style="position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(255,255,255,.32),transparent 34%),radial-gradient(circle at bottom left,rgba(255,255,255,.22),transparent 28%)"></div>
          <div style="position:relative;z-index:1">
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
              <span style="padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.36);color:#00008B;font-size:12px;font-weight:700">${previewEsc(cat)}</span>
              <span style="padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.36);color:#00008B;font-size:12px;font-weight:700">Tổng ${sel.length} câu hỏi</span>
            </div>
            <h1 style="margin:0;font-size:32px;font-weight:700;line-height:1.2;color:#00008B">${formatRichText(name)}</h1>
            ${desc ? `<p style="margin:12px 0 0;color:#00008B;font-size:16px">${formatRichText(desc)}</p>` : ''}
          </div>
        </div>

        <div style="padding:8px 8px 14px;color:#00008B;font-size:14px">Ng&agrave;y t&#7841;o: <strong style="color:#c2410c">${previewEsc(createdAt)}</strong></div>

        <div style="display:flex;flex-direction:column;gap:16px">
          ${sel.map((q, i) => `
            <div style="border:1px solid #00008B;border-radius:22px;padding:20px 20px 22px;background:linear-gradient(180deg,rgba(255,255,255,.96) 0%,rgba(255,247,237,.95) 100%);box-shadow:0 12px 26px rgba(0,0,139,.08)">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px">
                <div style="min-width:0;flex:1;display:flex;align-items:flex-start;gap:14px">
                  <div style="width:36px;height:36px;border-radius:50%;background:#00008B;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0">${i + 1}</div>
                  <p style="margin:0;font-size:16px;line-height:1.5;font-weight:600;color:#0f172a">${formatRichText(q.text, q.required)}</p>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
                  <span style="flex-shrink:0;padding:6px 12px;border-radius:999px;background:#00008B;color:#fff;font-size:12px;font-weight:700;white-space:nowrap">${previewQuestionChip(q.type)}</span>
                </div>
              </div>
              ${renderQuestionMedia(q)}
              ${renderQuestionPreview(q)}
            </div>
          `).join('')}
        </div>

        <div style="display:flex;justify-content:center;padding-top:24px">
          <button disabled style="min-width:210px;height:48px;border:none;border-radius:14px;background:linear-gradient(135deg,#22c1f1,#1d9bf0);color:#fff;font-size:15px;font-weight:800;opacity:.72;cursor:not-allowed">G&#7917;i ph&#7843;n h&#7891;i</button>
        </div>
      </section>
    </div>`;

  openModal('form-preview-modal');
  if (pushHistory) pushFormPreviewHistory();
}

function openFormModal(pushHistory = true) {
  selectedQuestions = new Set();
  libraryQuestionFormOverrides = {};
  directQuestions = [];
  activeDirectQuestionId = '';
  createFormTheme = { ...DEFAULT_FORM_THEME };
  createCollaborators = [];
  createHistoryStack = [];
  createRedoStack = [];
  setRichTitleEditorValue('');
  initCreateFormFlatpickr();
  setRichTextFieldValue('new-form-desc', '');
  const dc = document.getElementById('desc-count');
  if (dc) dc.textContent = '0/1000';
  document.getElementById('new-form-cat').value = '';
  syncCreateSurveyTypes();
  const targetInput = document.getElementById('new-form-target');
  if (targetInput) targetInput.value = 'Tất cả';
  resetApprovalRequestFields();
  const closeInput = document.getElementById('new-form-close');
  const closeDisplay = document.getElementById('new-form-close-display');
  const noCloseInput = document.getElementById('new-form-no-close');
  if (closeInput) {
    closeInput.min = todayInputValue();
    closeInput.value = '';
    closeInput.disabled = true;
  }
  if (closeDisplay) {
    closeDisplay.value = '';
    closeDisplay.disabled = true;
    closeDisplay.style.opacity = '0.35';
  }
  if (noCloseInput) noCloseInput.checked = true;
  const savedLoiKet = localStorage.getItem(NEW_FORM_LOI_KET_DRAFT_KEY) || '';
  setRichTextFieldValue('new-form-loi-ket', savedLoiKet);
  toggleApprovalNoteField();
  renderQList();
  renderDirectQList();
  applyCreateTheme();
  syncThemePanelControls();
  renderCreateCollaborators();
  hideRichTitleToolbar();
  hideFieldToolbar('new-form-desc');
  hideFieldToolbar('new-form-loi-ket');
  releaseCreateFormModalVisual();
  createFormInitialSnapshot = getCreateFormDraftSnapshot();
  openModal('create-form-modal');
  recordCreateHistory({ resetRedo: true });
  updateLibraryCountLabel();
  fetchLibraryFromAPI({ silent: true });
  if (pushHistory) pushCreateFormHistory();
}

function updateNewFormLoiKetDraft(value) {
  const text = String(value || '');
  const len = getRichTextPlainLength(text);
  const c = document.getElementById('loi-ket-count');
  if (c) {
    c.textContent = len + '/300';
    c.style.color = len > 250 ? 'var(--red)' : 'var(--gray-400)';
  }
  localStorage.setItem(NEW_FORM_LOI_KET_DRAFT_KEY, text);
}

function updateEditFormLoiKetCount(value) {
  const c = document.getElementById('edit-loi-ket-count');
  if (!c) return;
  const len = getRichTextPlainLength(value || '');
  c.textContent = len + '/300';
  c.style.color = len > 250 ? 'var(--red)' : 'var(--gray-400)';
}

function isDefaultOptionLabel(value) {
  return /^Lựa chọn\s*\d+$/i.test(String(value || '').trim());
}

function isDefaultGridLabel(value, prefix) {
  return new RegExp(`^${prefix}\\s*\\d+$`, 'i').test(String(value || '').trim());
}

function hasMeaningfulQuestionDraftContent(item) {
  if (!item) return false;
  if (typeof isSectionItem === 'function' && isSectionItem(item)) {
    return !!String(item.title || item.text || item.noi_dung || item.desc || item.mo_ta || '').trim();
  }

  const text = String(item.text || item.noi_dung || item.title || '').trim();
  const desc = String(item.desc || item.mo_ta || item.description || '').trim();
  if (text || desc || item.hinh_anh_url || item.image_url || item.image || item.video_url || item.video) return true;

  const opts = item.opts || item.lua_chon || [];
  if (Array.isArray(opts) && opts.some(opt => {
    const value = String(opt || '').trim();
    return value && !isDefaultOptionLabel(value);
  })) return true;

  const rows = item.rows || item.hang || [];
  const cols = item.cols || item.cot || [];
  if (Array.isArray(rows) && rows.some(row => {
    const value = String(row || '').trim();
    return value && !isDefaultGridLabel(value, 'Hàng');
  })) return true;
  if (Array.isArray(cols) && cols.some(col => {
    const value = String(col || '').trim();
    return value && !isDefaultGridLabel(value, 'Cột');
  })) return true;

  const validation = getQuestionValidationJson(item);
  const scaleLeft = validation?.scale_config?.label_left || item.scale?.label_left || '';
  const scaleRight = validation?.scale_config?.label_right || item.scale?.label_right || '';
  return !!String(scaleLeft || scaleRight || '').trim();
}

function hasMeaningfulCreateFormDraftChanges() {
  syncRichTitleInputFromEditor();
  syncRichTextFieldFromEditor('new-form-desc-editor');
  syncRichTextFieldFromEditor('new-form-loi-ket-editor');

  const hasBasicInput = [
    document.getElementById('new-form-name')?.value,
    document.getElementById('new-form-desc')?.value,
    document.getElementById('new-form-cat')?.value,
    document.getElementById('new-form-survey-type')?.value,
    document.getElementById('new-form-close')?.value,
    document.getElementById('new-form-loi-ket')?.value,
    document.getElementById('new-approval-deadline')?.value,
    document.getElementById('new-approval-urgent-reason')?.value,
  ].some(value => String(value || '').trim());

  const targetChanged = (document.getElementById('new-form-target')?.value || 'Tất cả') !== 'Tất cả';
  const closeChanged = !document.getElementById('new-form-no-close')?.checked;
  const urgentChanged = !!document.getElementById('new-approval-urgent')?.checked;
  const items = typeof getAllFormItems === 'function' ? getAllFormItems() : [];
  const hasFilledItem = items.some(hasMeaningfulQuestionDraftContent);
  const themeChanged = JSON.stringify(createFormTheme) !== JSON.stringify(DEFAULT_FORM_THEME);

  return hasBasicInput || targetChanged || closeChanged || urgentChanged || hasFilledItem || themeChanged;
}

function getCreateFormDraftSnapshot() {
  syncRichTitleInputFromEditor();
  syncRichTextFieldFromEditor('new-form-desc-editor');
  syncRichTextFieldFromEditor('new-form-loi-ket-editor');
  const items = typeof getAllFormItems === 'function' ? getAllFormItems() : [];
  const compactItems = items.map(item => ({
    id: item.id || '',
    text: item.text || item.noi_dung || item.title || '',
    desc: item.desc || item.mo_ta || '',
    type: item.type || item.loai || '',
    required: !!item.required,
    opts: item.opts || item.lua_chon || [],
    rows: item.rows || [],
    cols: item.cols || [],
    isSection: !!(typeof isSectionItem === 'function' && isSectionItem(item))
  }));
  return JSON.stringify({
    name: document.getElementById('new-form-name')?.value?.trim() || '',
    desc: document.getElementById('new-form-desc')?.value?.trim() || '',
    cat: document.getElementById('new-form-cat')?.value || '',
    surveyType: document.getElementById('new-form-survey-type')?.value || '',
    target: document.getElementById('new-form-target')?.value || 'Tất cả',
    status: 'draft',
    noClose: !!document.getElementById('new-form-no-close')?.checked,
    closeDate: document.getElementById('new-form-close')?.value || '',
    loiKet: document.getElementById('new-form-loi-ket')?.value?.trim() || '',
    approvalDeadline: document.getElementById('new-approval-deadline')?.value || '',
    urgentApproval: !!document.getElementById('new-approval-urgent')?.checked,
    urgentReason: document.getElementById('new-approval-urgent-reason')?.value?.trim() || '',
    theme: createFormTheme,
    collaborators: createCollaborators,
    items: compactItems
  });
}

function hasCreateFormDraftChanges() {
  return getCreateFormDraftSnapshot() !== createFormInitialSnapshot && hasMeaningfulCreateFormDraftChanges();
}

async function closeFormModal(fromHistory = false) {
  if (createFormClosing) {
    hideCreateFormModalVisual();
    return;
  }

  const formIsOpen = isModalVisible('create-form-modal');
  if (!formIsOpen && !createFormHistoryActive) return;
  createFormClosing = true;
  createFormHistoryActive = false;

  hideCreateFormModalVisual();
  try {
    if (!hasCreateFormDraftChanges()) {
      resetAndCloseCreateForm(fromHistory);
      return;
    }

    await submitForm(true, {
      forcedStatus: 'draft',
      autoDraft: true,
      closeFromHistory: true,
      successMessage: 'Đã lưu biểu mẫu dưới dạng nháp',
    });

    if (!fromHistory && history.state?.createFormModal) {
      history.back();
    }
  } finally {
    setTimeout(() => {
      createFormClosing = false;
    }, 0);
  }
}

function resetAndCloseCreateForm(fromHistory = false) {
  // Reset fullscreen nếu đang bật
  if (_createFormFullscreen) { _createFormFullscreen = false; toggleCreateFormFullscreen(); }
  document.body.style.overflow = '';
  window._skipCloseConfirm = false;
  // Reset form fields
  setRichTitleEditorValue('');
  setRichTextFieldValue('new-form-desc', '');
  const dc = document.getElementById('desc-count');
  if (dc) dc.textContent = '0/1000';
  const catInput = document.getElementById('new-form-cat');
  if (catInput) catInput.value = '';
  syncCreateSurveyTypes();
  const targetInput = document.getElementById('new-form-target');
  if (targetInput) targetInput.value = 'Tất cả';
  resetApprovalRequestFields();
  createFormTheme = { ...DEFAULT_FORM_THEME };
  createCollaborators = [];
  createHistoryStack = [];
  createRedoStack = [];
  toggleCreateThemePanel(false);
  applyCreateTheme();
  renderCreateCollaborators();
  hideRichTitleToolbar();
  hideFieldToolbar('new-form-desc');
  hideFieldToolbar('new-form-loi-ket');
  toggleApprovalNoteField();
  closeModal('create-form-modal');
  hideCreateFormModalVisual();
  createFormHistoryActive = false;
  createFormInitialSnapshot = '';
  if (!fromHistory && history.state?.createFormModal) {
    history.back();
  }
}

function toggleApprovalNoteField() {
  const noteWrap = document.getElementById('approval-note-group');
  if (!noteWrap) return;
  noteWrap.style.display = 'block';
  const deadlineInput = document.getElementById('new-approval-deadline');
  if (deadlineInput) deadlineInput.min = getCurrentDateTimeLocalValue();
  toggleUrgentApprovalFields();
}

function getCurrentDateTimeLocalValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function updateUrgentReasonCount() {
  const input = document.getElementById('new-approval-urgent-reason');
  const count = document.getElementById('urgent-reason-count');
  if (!input || !count) return;
  count.textContent = input.value.length + '/250';
  count.style.color = input.value.length > 210 ? 'var(--red)' : 'var(--gray-400)';
}

function toggleUrgentApprovalFields() {
  const urgentInput = document.getElementById('new-approval-urgent');
  const reasonWrap = document.getElementById('urgent-approval-reason-group');
  const deadlineInput = document.getElementById('new-approval-deadline');
  const deadlineDisplay = document.getElementById('new-approval-deadline-display');
  const urgentReasonInput = document.getElementById('new-approval-urgent-reason');
  if (!urgentInput || !reasonWrap) return;
  const showReason = urgentInput.checked;
  reasonWrap.style.display = showReason ? 'block' : 'none';
  if (showReason) {
    if (deadlineInput) deadlineInput.min = getCurrentDateTimeLocalValue();
  } else {
    if (deadlineInput) deadlineInput.value = '';
    if (deadlineDisplay) { deadlineDisplay.value = ''; if(deadlineDisplay._flatpickr) deadlineDisplay._flatpickr.clear(); }
    if (urgentReasonInput) urgentReasonInput.value = '';
    updateUrgentReasonCount();
  }
}

function validateApprovalDeadlineField() {
  const input = document.getElementById('new-approval-deadline');
  if (!input || !input.value) return true;
  const selected = new Date(input.value);
  if (Number.isNaN(selected.getTime()) || selected < new Date()) {
    showToast('Hạn chót phê duyệt không được ở quá khứ', 'error');
    input.value = '';
    syncApprovalDeadlineDisplay();
    return false;
  }
  syncApprovalDeadlineDisplay();
  return true;
}

function formatDateTimeLocalToDisplay(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function syncApprovalDeadlineDisplay() {
  const input = document.getElementById('new-approval-deadline');
  const display = document.getElementById('new-approval-deadline-display');
  if (display) { display.value = formatDateTimeLocalToDisplay(input?.value || ''); if(display._flatpickr && input?.value) display._flatpickr.setDate(new Date(input.value)); }
}

function getTodayEndDateTimeLocal() {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:59`;
}

function openApprovalDeadlinePicker() {
  const input = document.getElementById('new-approval-deadline');
  if (!input) return;
  input.min = getCurrentDateTimeLocalValue();
  if (!input.value) {
    input.value = getTodayEndDateTimeLocal();
    syncApprovalDeadlineDisplay();
  }
  if (typeof input.showPicker === 'function') input.showPicker();
  else {
    input.focus();
    input.click();
  }
}

function resetApprovalRequestFields() {
  const deadlineInput = document.getElementById('new-approval-deadline');
  const deadlineDisplay = document.getElementById('new-approval-deadline-display');
  const urgentInput = document.getElementById('new-approval-urgent');
  const urgentReasonInput = document.getElementById('new-approval-urgent-reason');
  if (deadlineInput) {
    deadlineInput.value = '';
    deadlineInput.min = getCurrentDateTimeLocalValue();
  }
  if (deadlineDisplay) { deadlineDisplay.value = ''; if(deadlineDisplay._flatpickr) deadlineDisplay._flatpickr.clear(); }
  if (urgentInput) urgentInput.checked = false;
  if (urgentReasonInput) urgentReasonInput.value = '';
  updateUrgentReasonCount();
  toggleUrgentApprovalFields();
}

async function createApprovalRequest(formId, note, options = {}) {
  const token = localStorage.getItem('token') || '';
  const approvalRes = await fetch(`${API_BASE}/approvals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({
      form_id: formId,
      do_uu_tien: options.priority || 'normal',
      ghi_chu: note || null,
      han_chot_duyet: options.deadline || null,
      ly_do_duyet_gap: options.urgentReason || null,
    }),
  });
  const approvalResult = await approvalRes.json().catch(() => ({}));
  if (!approvalRes.ok) {
    throw new Error(approvalResult.message || 'Không tạo được yêu cầu phê duyệt');
  }
  return approvalResult;
}

function cacheLocalApprovalItem({ approvalId, formId, formName, cat, note, questions, priority = 'normal', deadline = '' }) {
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
      by: currentUser.ho_ten || currentUser.ten_đang_nhap || 'Quản lý',
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
      priority: priority === 'urgent' ? 'high' : priority === 'low' ? 'low' : 'medium',
      approval_deadline: deadline || '',
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
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Không cập nhật được trạng thái biểu mẫu');
  }
}

function forceCloseFormModal() {
  resetAndCloseCreateForm();
}

function requestSubmitForm() {
  const formItems = getAllFormItems ? getAllFormItems() : getAllFormQuestions();
  const validationError = validateCreateFormItems(formItems);
  if (validationError) { showToast(validationError, 'error'); return; }
  document.getElementById('submit-form-confirm')?.remove();
  submitForm(true);
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
        ${name ? `<div>Tên: <strong>${formatRichText(name)}</strong></div>` : ''}
        ${hasQ ? `<div>Có thêm câu hỏi</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="document.getElementById('exit-form-confirm').remove();submitForm(true)"
          style="padding:10px;background:#00008B;color:#fff;border:none;border-radius:9px;font-size:13.5px;font-weight:700;cursor:pointer;transition:background .15s"
          onmouseenter="this.style.background='#00008B'" onmouseleave="this.style.background='#00008B'">
          Lưu & Tạo biểu mẫu
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

// --- RENDER QUESTION LIST ---
function renderQList() {
  const wrap = document.getElementById('q-list-wrap');
  if (!wrap) return;

  const search = (document.getElementById('lib-search')?.value || '').trim();
  const filtered = getFilteredLibraryQuestions();
  const hint = document.getElementById('library-insert-hint');
  if (hint) hint.textContent = libraryInsertAfterId
    ? 'Chọn câu hỏi mẫu, bấm "Thêm câu hỏi" để chèn sau mục đang chọn'
    : 'Chọn câu hỏi mẫu, bấm "Thêm câu hỏi" để đưa vào biểu mẫu';

  if (!filtered.length) {
    wrap.innerHTML = `<div style="padding:30px 18px;text-align:center;color:#94a3b8;font-size:13px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="34" height="34" style="margin:0 auto 10px;display:block;opacity:.65"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M4 4v15.5A2.5 2.5 0 006.5 22H20V6a2 2 0 00-2-2H6.5A2.5 2.5 0 004 6.5"/></svg>
      <div style="font-weight:700;color:#64748b">${search ? 'Không tìm thấy câu hỏi phù hợp' : 'Chưa có câu hỏi phù hợp với bộ lọc'}</div>
      <div style="font-size:12px;margin-top:4px">Thử đổi danh mục, loại khảo sát hoặc đối tượng ở phía trên.</div>
    </div>`;
    const selectedCountEl = document.getElementById('library-selected-count');
    if (selectedCountEl) selectedCountEl.textContent = libraryModalSelection.size;
    updateLibraryCountLabel();
    return;
  }

  const typeLabel = t => getTypeOptionLabel(normalizeQuestionType(t));
  const typeColor = t => ({choice:'#00008B;color:#00008B',checkbox:'#f0fdf4;color:#166534',dropdown:'#fef9c3;color:#854d0e',paragraph:'#eef2ff;color:#334155',short_text:'#f8fafc;color:#475569',long_text:'#eef2ff;color:#334155',text:'#f8fafc;color:#475569',upload:'#f8fafc;color:#475569',rating:'#fff7ed;color:#c2410c',scale:'#fdf4ff;color:#7e22ce',date:'#ecfdf5;color:#065f46',time:'#ecfdf5;color:#065f46',grid_radio:'#fdf4ff;color:#6b21a8',grid_checkbox:'#f0fdf4;color:#065f46'}[normalizeQuestionType(t)]||'#f1f5f9;color:#374151');

  let html = '';
  filtered.forEach(q => {
    const sid = String(q.id);
    const checked = libraryModalSelection.has(sid);
    const tl = typeLabel(q.type);
    const tc = typeColor(q.type);
    const hasOpts = q.opts && q.opts.length > 0;
    const surveyType = getLibraryQuestionSurveyType(q);
    const target = normalizeSurveyTarget(q.doi_tuong || q.target);

    html += `
    <div id="qrow-${sid}" style="border-bottom:1px solid #eef4ff;${checked?'background:#f0f9ff;':''}transition:background .12s">
      <!-- Main row -->
      <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer" onclick="toggleQ('${sid}')">
        <input type="checkbox" id="qcb-${sid}" ${checked?'checked':''} onclick="event.stopPropagation();toggleQ('${sid}')"
          style="width:16px;height:16px;accent-color:#00008B;flex-shrink:0;cursor:pointer">
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:${checked?'700':'600'};color:${checked?'#1e293b':'#334155'};line-height:1.45;margin-bottom:5px">${q.text||'<em style=\"color:#94a3b8\">Câu hỏi chưa có nội dung</em>'}</div>
          <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:${tc}">${tl}</span>
            ${surveyType ? `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#eef2ff;color:#00008B">${escapeHtml(surveyType)}</span>` : ''}
            ${target ? `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#fff7ed;color:#c2410c">${escapeHtml(target)}</span>` : ''}
            ${hasOpts ? `<span style="font-size:11.5px;color:#64748b">${q.opts.length} lựa chọn</span>` : ''}
          </div>
        </div>
          ${checked ? `<svg viewBox="0 0 24 24" fill="none" stroke="#00008B" stroke-width="2.5" width="16" height="16" style="flex-shrink:0;margin-left:6px"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      </div>
    </div>`;
  });

  wrap.innerHTML = html;
  const selectedCountEl = document.getElementById('library-selected-count');
  if (selectedCountEl) selectedCountEl.textContent = libraryModalSelection.size;
  updateQCount();
  updateLibraryCountLabel();
}

// --- TOGGLE QUESTION SELECT ---
function toggleQ(id) {
  const sid = String(id);
  if (libraryModalSelection.has(sid)) {
    libraryModalSelection.delete(sid);
  } else {
    libraryModalSelection.add(sid);
  }
  renderQList();
}

function insertLibraryQuestionAfter(questionId, afterId) {
  const source = libraryQuestions.find(q => sameQuestionId(q.id, questionId));
  if (!source) return;
  const type = normalizeQuestionType(source.type || source.loai || 'choice');
  const allowOther = questionAllowsOther({ ...source, type });

  const newQ = {
    id: 'dq-lib-' + Date.now(),
    thu_vien_id: Number(source.id) || null,
    text: source.text || source.noi_dung || '',
    type,
    opts: Array.isArray(source.opts)
      ? [...source.opts]
      : Array.isArray(source.lua_chon)
      ? source.lua_chon.map(o => o.noi_dung || o)
      : [],
    rows: source.rows ? [...source.rows] : [],
    cols: source.cols ? [...source.cols] : [],
    validation_json: source.validation_json || source.validation || source.logic_json || '',
    allowOther,
    allow_other: allowOther,
    required: source.required || source.bat_buoc || false,
  };

  const dqIdx = directQuestions.findIndex(x => sameQuestionId(x.id, afterId));
  if (dqIdx >= 0) {
    directQuestions.splice(dqIdx + 1, 0, newQ);
  } else {
    directQuestions.unshift(newQ);
  }
  activeDirectQuestionId = String(newQ.id);
  renderDirectQList();
  setTimeout(() => {
    const card = document.getElementById('dqcard-' + newQ.id);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
  showToast('Đã thêm câu hỏi từ thư viện', 'success');
}

function updateQCount() {
  const n = getAllFormQuestions ? getAllFormQuestions().length : selectedQuestions.size;
  const el1 = document.getElementById('q-sel-count');
  const el2 = document.getElementById('q-bottom-count');
  if(el1) el1.textContent = n;
  if(el2) el2.textContent = n;
}

function getLibraryQuestionForForm(q) {
  const sid = String(q.id);
  const override = libraryQuestionFormOverrides[sid] || {};
  const required = Object.prototype.hasOwnProperty.call(override, 'required')
    ? !!override.required
    : false;
  return {
    ...q,
    required,
    bat_buoc: required,
    allowOther: questionAllowsOther(q),
    allow_other: questionAllowsOther(q),
    thu_vien_id: Number(q.id) || q.thu_vien_id || null,
  };
}

function selectAllQ() {
  // Chỉ chọn câu hỏi đang hiển thị theo 3 bộ lọc hiện tại.
  const visible = getFilteredLibraryQuestions();
  visible.forEach(q => libraryModalSelection.add(String(q.id)));
  renderQList();
}
function deselectAllQ() {
  libraryModalSelection.clear();
  renderQList();
}

// --- DIRECT QUESTION LIST (card trực tiếp) ---
let directQuestions = []; // [{id, text, type, opts, required}]
let activeDirectQuestionId = '';

// Dùng chung TYPE_LABEL_MAP, NEEDS_OPTS, NEEDS_GRID đã khai báo ở trên
const DQ_NEEDS_OPTS = NEEDS_OPTS;
const DQ_NEEDS_GRID = NEEDS_GRID;
const DQ_TYPE_LABELS = TYPE_LABEL_MAP;

// --- ICON & COLOR CHO TỔNG LOẠI CÂU HỎI ---
const DQ_TYPE_ICON = {
  short_text:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  paragraph:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="17" x2="15" y2="17"/></svg>`,
  choice:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg>`,
  checkbox:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="7 12 10 15 17 9"/></svg>`,
  dropdown:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="2" y="6" width="20" height="12" rx="2"/><polyline points="8 11 12 15 16 11"/></svg>`,
  upload:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/></svg>`,
  scale:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/></svg>`,
  rating:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="5" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="2" fill="currentColor" stroke="none"/></svg>`,
  star_rating:  `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="13" height="13"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>`,
  grid_radio:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  grid_checkbox:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><polyline points="5 7 6.5 8.5 9 6" stroke-width="1.5"/><polyline points="16 7 17.5 8.5 20 6" stroke-width="1.5"/></svg>`,
  date:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  time:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>`,
};
const DQ_TYPE_COLOR = {
  short_text:'#4b5563',paragraph:'#4b5563',choice:'#00008B',checkbox:'#166534',dropdown:'#854d0e',upload:'#475569',scale:'#7e22ce',rating:'#b45309',grid_radio:'#6b21a8',grid_checkbox:'#065f46',date:'#065f46',time:'#065f46'
};

function sameQuestionId(a, b) {
  return String(a) === String(b);
}

function isSectionItem(item) {
  return !!item?._isSection || normalizeQuestionType(item?.type || item?.loai) === 'section';
}

function isPresentationItem(item) {
  const type = normalizeQuestionType(item?.type || item?.loai);
  return type === 'presentation_image' || type === 'presentation_video';
}

function countRealQuestions(items) {
  return (items || []).filter(item => !isSectionItem(item) && !isPresentationItem(item)).length;
}

function getQuestionNumberInSection(items, index) {
  let number = 0;
  for (let i = 0; i <= index; i++) {
    if (isSectionItem(items[i])) {
      number = 0;
    } else if (!isPresentationItem(items[i])) {
      number += 1;
    }
  }
  return number;
}

function getSectionNumber(items, index) {
  const firstSectionIndex = (items || []).findIndex(isSectionItem);
  let number = firstSectionIndex > 0 ? 1 : 0;
  for (let i = 0; i <= index; i++) {
    if (isSectionItem(items[i])) number += 1;
  }
  return Math.max(number, 1);
}

function getTotalSectionCount(items) {
  const sectionCount = (items || []).filter(isSectionItem).length;
  const firstSectionIndex = (items || []).findIndex(isSectionItem);
  return sectionCount + (firstSectionIndex > 0 ? 1 : 0) || 1;
}

function hasLeadingImplicitSection(items) {
  return (items || []).findIndex(isSectionItem) > 0;
}

function getCleanTextArray(values) {
  return (Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

function getGridRows(item) {
  return getCleanTextArray(item?.rows || item?.hang);
}

function getGridCols(item) {
  return getCleanTextArray(item?.cols || item?.cot);
}

function buildQuestionPayload(items) {
  return (items || []).map(q => {
    if (isSectionItem(q)) {
      return {
        id: q.id,
        loai: 'section',
        _isSection: true,
        title: q.title || q.noi_dung || '',
        desc: q.desc || q.description || q.mo_ta_cau_hoi || '',
      };
    }
    const type = normalizeQuestionType(q.type || q.loai || 'choice');
    const videoUrl = q.video_url || q.video || null;
    return {
      id: q.id,
      thu_vien_id: q.thu_vien_id || null,
      noi_dung: q.text || q.noi_dung || '',
      loai: type,
      bat_buoc: q.required || q.bat_buoc || false,
      lua_chon: (type === 'scale' || type === 'rating') ? [] : (q.opts || q.lua_chon || []).map(opt => typeof opt === 'string' ? opt : opt.noi_dung).filter(opt => String(opt || '').trim()),
      rows: NEEDS_GRID.includes(type) ? getGridRows(q) : [],
      cols: NEEDS_GRID.includes(type) ? getGridCols(q) : [],
      validation_json: getQuestionValidationJson(q),
      hinh_anh_url: q.hinh_anh_url || q.image_url || q.image || null,
      video_url: isVideoDataUrl(videoUrl) ? null : videoUrl,
    };
  });
}

const MAX_MEDIA_PAYLOAD_BYTES = 1.2 * 1024 * 1024;
const MAX_VIDEO_FILE_BYTES = 8 * 1024 * 1024;
const MAX_FORM_JSON_PAYLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_COMPRESSION_STEPS = [
  { max: 1600, quality: 0.82 },
  { max: 1280, quality: 0.76 },
  { max: 1000, quality: 0.72 },
  { max: 800, quality: 0.68 },
  { max: 640, quality: 0.62 },
];

function isImageDataUrl(value) {
  return /^data:image\//i.test(String(value || ''));
}

function isVideoDataUrl(value) {
  return /^data:video\//i.test(String(value || ''));
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function compressImageSource(src) {
  if (!src || !src.startsWith('data:image/')) return src;
  const img = await loadImageElement(src);
  let best = src;
  for (const step of IMAGE_COMPRESSION_STEPS) {
    const scale = Math.min(1, step.max / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round((img.width || 1) * scale));
    const height = Math.max(1, Math.round((img.height || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    best = canvas.toDataURL('image/jpeg', step.quality);
    if (best.length <= MAX_MEDIA_PAYLOAD_BYTES) break;
  }
  return best;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getJsonPayloadBytes(payload) {
  try {
    return new Blob([JSON.stringify(payload)]).size;
  } catch(e) {
    return JSON.stringify(payload || {}).length;
  }
}

function assertFormPayloadWithinLimit(payload) {
  const size = getJsonPayloadBytes(payload);
  if (size <= MAX_FORM_JSON_PAYLOAD_BYTES) return;

  const mb = (size / 1024 / 1024).toFixed(1);
  throw new Error(`Ảnh/video đang làm dữ liệu biểu mẫu quá lớn (${mb}MB). Vui lòng nén ảnh hoặc dùng URL video.`);
}

async function normalizeQuestionMediaForSave(items) {
  const normalized = [];
  for (const q of (items || [])) {
    if (isSectionItem(q)) {
      normalized.push(q);
      continue;
    }
    const next = { ...q };
    const imageUrl = getQuestionImageUrl(next);
    if (isImageDataUrl(imageUrl) && imageUrl.length > MAX_MEDIA_PAYLOAD_BYTES) {
      try {
        const compressed = await compressImageSource(imageUrl);
        next.image = compressed;
        next.hinh_anh_url = compressed;
      } catch(e) {}
    }
    const videoUrl = getQuestionVideoUrl(next);
    if (isVideoDataUrl(videoUrl)) {
      next.video = '';
      next.video_url = '';
    }
    
    // Nén ảnh tùy chọn
    if (next.validation_json) {
      try {
        const vj = typeof next.validation_json === 'string' ? JSON.parse(next.validation_json) : next.validation_json;
        if (vj && vj.option_images) {
          let hasChanges = false;
          for (const key in vj.option_images) {
            const optImg = vj.option_images[key];
            if (isImageDataUrl(optImg) && optImg.length > MAX_MEDIA_PAYLOAD_BYTES) {
              const compImg = await compressImageSource(optImg);
              vj.option_images[key] = compImg;
              hasChanges = true;
            }
          }
          if (hasChanges) {
            next.validation_json = JSON.stringify(vj);
          }
        }
      } catch(e){}
    }

    normalized.push(next);
  }
  return normalized;
}

function getCleanFormItemsForSave(items) {
  return (items || []).map(q => isSectionItem(q) ? q : ({
    ...q,
    opts: ['scale', 'rating'].includes(normalizeQuestionType(q.type || q.loai)) ? [] : (q.opts || q.lua_chon || [])
      .map(opt => typeof opt === 'string' ? opt : opt.noi_dung)
      .map(opt => String(opt || '').trim())
      .filter(Boolean),
    scale: normalizeQuestionType(q.type || q.loai) === 'scale' ? getQuestionScaleConfig(q) : q.scale,
    rating: normalizeQuestionType(q.type || q.loai) === 'rating' ? getQuestionRatingConfig(q) : q.rating,
    validation_json: getQuestionValidationJson(q),
    rows: (q.rows || q.hang || []).map(row => String(row || '').trim()).filter(Boolean),
    cols: (q.cols || q.cot || []).map(col => String(col || '').trim()).filter(Boolean),
    image: q.image || q.hinh_anh_url || q.image_url || '',
    video: isVideoDataUrl(q.video || q.video_url) ? '' : (q.video || q.video_url || ''),
    hinh_anh_url: q.hinh_anh_url || q.image_url || q.image || '',
    video_url: isVideoDataUrl(q.video_url || q.video) ? '' : (q.video_url || q.video || ''),
  }));
}

function normalizeOptionForDuplicateCheck(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function findDuplicateOptionLabel(options = []) {
  const seen = new Set();
  for (const opt of options) {
    const raw = typeof opt === 'string' ? opt : opt?.noi_dung;
    const normalized = normalizeOptionForDuplicateCheck(raw);
    if (!normalized) continue;
    if (seen.has(normalized)) return String(raw || '').trim();
    seen.add(normalized);
  }
  return '';
}

function isDuplicateOptionAt(options = [], index, value) {
  const normalized = normalizeOptionForDuplicateCheck(value);
  if (!normalized) return false;
  return (options || []).some((opt, i) => {
    if (i === index) return false;
    const raw = typeof opt === 'string' ? opt : opt?.noi_dung;
    return normalizeOptionForDuplicateCheck(raw) === normalized;
  });
}

function setOptionDuplicateState(input, isDuplicate) {
  if (!input) return;
  input.dataset.duplicate = isDuplicate ? '1' : '';
  input.style.borderColor = isDuplicate ? '#ef4444' : (document.activeElement === input ? '#00008B' : '#e2e8f0');
  input.style.boxShadow = isDuplicate ? '0 0 0 2px rgba(239,68,68,.12)' : '';
  let msg = input.parentElement?.querySelector?.('.option-duplicate-msg');
  if (isDuplicate) {
    if (!msg) {
      msg = document.createElement('div');
      msg.className = 'option-duplicate-msg';
      msg.style.cssText = 'position:absolute;right:26px;top:100%;margin-top:3px;color:#dc2626;font-size:11px;font-weight:700;background:#fff;padding:1px 4px;border-radius:4px;z-index:2';
      input.parentElement.style.position = 'relative';
      input.parentElement.appendChild(msg);
    }
    msg.textContent = 'Lựa chọn này đã tồn tại';
  } else if (msg) {
    msg.remove();
  }
}

function updateDirectOptionDuplicateState(input, id, oi, showMessage = false) {
  const q = _dqFindQ(id);
  if (!q) return false;
  const duplicated = isDuplicateOptionAt(q.opts || [], oi, input?.value || '');
  setOptionDuplicateState(input, duplicated);
  if (duplicated && showMessage) showToast('Lựa chọn này đã tồn tại, vui lòng nhập đáp án khác!', 'error');
  return duplicated;
}

function updateEditOptionDuplicateState(input, qi, oi, showMessage = false) {
  const q = editFormQuestions[qi];
  if (!q) return false;
  const duplicated = isDuplicateOptionAt(q.opts || [], oi, input?.value || '');
  setOptionDuplicateState(input, duplicated);
  if (duplicated && showMessage) showToast('Lựa chọn này đã tồn tại, vui lòng nhập đáp án khác!', 'error');
  return duplicated;
}

function validateCreateFormItems(items) {
  const realQuestions = (items || []).filter(q => !isSectionItem(q));
  if (!realQuestions.length) return 'Vui lòng thêm ít nhất 1 câu hỏi!';

  for (let i = 0; i < realQuestions.length; i++) {
    const q = realQuestions[i];
    const questionNo = i + 1;
    const text = q.text || q.noi_dung || '';
    if (!String(text).trim()) return `Câu hỏi ${questionNo} chưa có nội dung!`;

    const normalizedType = normalizeQuestionType(q.type || q.loai || 'choice');
    if (['choice', 'checkbox', 'dropdown'].includes(normalizedType)) {
      const filledOpts = (q.opts || q.lua_chon || [])
        .map(opt => typeof opt === 'string' ? opt : opt.noi_dung)
        .filter(opt => String(opt || '').trim());
      if (!filledOpts.length) return `Câu hỏi ${questionNo} cần ít nhất 1 lựa chọn!`;
      const duplicateOpt = findDuplicateOptionLabel(filledOpts);
      if (duplicateOpt) return `Câu hỏi ${questionNo} có lựa chọn bị trùng: "${duplicateOpt}"`;
    }

    if (['grid_radio', 'grid_checkbox'].includes(normalizedType)) {
      const filledRows = (q.rows || q.hang || []).filter(row => String(row || '').trim());
      const filledCols = (q.cols || q.cot || []).filter(col => String(col || '').trim());
      if (!filledRows.length || !filledCols.length) return `Câu hỏi ${questionNo} cần ít nhất 1 hàng và 1 cột!`;
    }
  }

  return '';
}

// --- DRAG & DROP: câu hỏi -------------------------------------------
let _dqDragId = null;

function dqDragStart(event, id) {
  if (!event.target?.closest?.('.dq-drag-handle')) {
    event.preventDefault();
    return;
  }
  _dqDragId = id;
  event.dataTransfer.effectAllowed = 'move';
  // Làm mới card đang kéo
  setTimeout(() => {
    const el = document.getElementById('dqcard-' + id);
    if (el) { el.style.opacity = '0.4'; el.style.boxShadow = '0 0 0 2px #00008B'; }
  }, 0);
}

function dqDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  // Highlight card đang hover
  const card = event.currentTarget;
  if (card) card.style.borderColor = '#00008B';
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

// --- DRAG & DROP: đáp án (opts) ------------------------------------
let _dqOptDrag = null; // { qId, fromIdx }

function dqOptDragStart(event, qId, fromIdx) {
  event.stopPropagation();
  if (!event.target?.closest?.('.dq-opt-drag-handle')) {
    event.preventDefault();
    return;
  }
  _dqOptDrag = { qId, fromIdx };
  event.dataTransfer.effectAllowed = 'move';
  setTimeout(() => { event.target.style.opacity = '0.4'; }, 0);
}

function dqOptDragOver(event, qId, toIdx) {
  event.stopPropagation();
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function dqOptDrop(event, qId, toIdx) {
  event.stopPropagation();
  event.preventDefault();
  if (!_dqOptDrag || _dqOptDrag.qId !== qId || _dqOptDrag.fromIdx === toIdx) return;
  const q = _dqFindQ(qId);
  if (!q || !q.opts) return;
  const [moved] = q.opts.splice(_dqOptDrag.fromIdx, 1);
  q.opts.splice(toIdx, 0, moved);
  _dqOptDrag = null;
  renderDirectQList();
}

function dqOptDragEnd(event = null) {
  if (event) event.stopPropagation();
  _dqOptDrag = null;
  // Re-render để reset opacity
  renderDirectQList();
}
// -------------------------------------------------------------------

function focusDirectQuestionText(card, qId = '') {
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const questionEditor = (qId ? document.getElementById('dq-text-' + qId) : null)
    || card.querySelector('[id^="dq-text-"][contenteditable="true"]')
    || card.querySelector('.rich-title-editor[contenteditable="true"]');
  if (questionEditor) {
    questionEditor.focus();
    const range = document.createRange();
    range.selectNodeContents(questionEditor);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }
  card.querySelector('input[type=text]')?.focus();
}

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
    // câu từ thư viện: thêm vào directQuestions ở vị trí tương ứng
    directQuestions.unshift(clone);
  }
  activeDirectQuestionId = String(clone.id);
  renderDirectQList();
  // Scroll & focus
  setTimeout(() => {
    const newCard = document.getElementById('dqcard-' + clone.id);
    focusDirectQuestionText(newCard, clone.id);
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
  activeDirectQuestionId = String(newQ.id);
  renderDirectQList();
  setTimeout(() => {
    const newCard = document.getElementById('dqcard-' + newQ.id);
    focusDirectQuestionText(newCard, newQ.id);
  }, 50);
}

function setActiveDirectQuestion(id, focus = true) {
  activeDirectQuestionId = String(id || '');
  renderDirectQList();
  if (!focus || !activeDirectQuestionId) return;
  setTimeout(() => {
    const card = document.getElementById('dqcard-' + activeDirectQuestionId);
    focusDirectQuestionText(card, activeDirectQuestionId);
  }, 30);
}

function setActiveDirectSection(id, focus = true) {
  activeDirectQuestionId = String(id || '');
  renderDirectQList();
  if (!focus || !activeDirectQuestionId) return;
  setTimeout(() => {
    const editor = document.getElementById('dq-section-title-' + activeDirectQuestionId);
    if (!editor) return;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, 30);
}

function renderDirectQuestionCollapsedCard(q, questionNo, normalizedType) {
  const required = q.required || q.bat_buoc;
  const title = formatRichText(q.text || 'Câu hỏi chưa có nội dung', required);
  return `
    <div id="dqcard-${q.id}"
      onclick="setActiveDirectQuestion('${q.id}')"
      ondragover="dqDragOver(event)"
      ondrop="dqDrop(event,'${q.id}')"
      title="Bấm để chỉnh sửa câu hỏi"
      style="border:1px solid #dbe5f0;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.04);display:flex;transition:box-shadow .15s;cursor:pointer">
      <div class="dq-drag-handle" title="Kéo để đổi vị trí" draggable="true"
        onclick="event.stopPropagation()"
        ondragstart="dqDragStart(event,'${q.id}')"
        ondragend="dqDragEnd(event)"
        style="display:flex;align-items:center;justify-content:center;width:20px;flex-shrink:0;cursor:grab;color:#cbd5e1;border-right:1px solid #f1f5f9;padding:0 2px;border-radius:12px 0 0 12px">
        <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor">
          <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
          <circle cx="3" cy="6" r="1.5"/><circle cx="7" cy="6" r="1.5"/>
          <circle cx="3" cy="10" r="1.5"/><circle cx="7" cy="10" r="1.5"/>
          <circle cx="3" cy="14" r="1.5"/><circle cx="7" cy="14" r="1.5"/>
        </svg>
      </div>
      <div style="flex:1;min-width:0;padding:18px 20px">
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div style="width:28px;height:28px;border-radius:50%;background:#00008B;color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${isPresentationItem(q) ? '' : questionNo}</div>
          <div style="flex:1;min-width:0;display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
            <div style="flex:1;min-width:0">
              <div style="font-size:18px;font-weight:800;color:#0f172a;line-height:1.35;margin-bottom:14px">${title}</div>
              ${renderQuestionMedia(q)}
              <div style="pointer-events:none">${renderQuestionPreview(q)}</div>
            </div>
            <div style="flex-shrink:0">
              <span style="padding:5px 11px;border-radius:999px;background:#00008B;color:#fff;font-size:12px;font-weight:800;white-space:nowrap">${getTypeOptionLabel(normalizedType)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderDirectImplicitSectionHeader(totalSections) {
  return `
    <div onclick="dqActivateImplicitFirstSection()" title="Bấm để chỉnh sửa phần 1"
      style="border:1.5px dashed #fbbf24;border-radius:12px;background:#fffbeb;padding:10px 14px;display:flex;align-items:center;gap:8px;color:#b45309;cursor:pointer;transition:box-shadow .15s"
      onmouseenter="this.style.boxShadow='0 6px 18px rgba(245,158,11,.14)'"
      onmouseleave="this.style.boxShadow='none'">
      <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" width="14" height="14"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      <span style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px">Phần 1 / ${totalSections}</span>
    </div>`;
}

function renderDirectSectionCollapsedCard(q, sectionNo, totalSections) {
  const title = formatRichText(q.title || 'Tiêu đề phần');
  const desc = formatRichText(q.desc || q.description || '');
  return `
    <div id="dqcard-${q.id}"
      onclick="setActiveDirectSection('${q.id}')"
      title="Bấm để chỉnh sửa phần"
      style="border:1px solid #fde68a;border-left:5px solid #f59e0b;border-radius:12px;background:#fffdf4;box-shadow:0 1px 3px rgba(15,23,42,.04);display:flex;cursor:pointer;transition:box-shadow .15s">
      <div class="dq-drag-handle" title="Kéo để đổi vị trí" draggable="true"
        onclick="event.stopPropagation()"
        ondragstart="dqDragStart(event,'${q.id}')"
        ondragend="dqDragEnd(event)"
        style="display:flex;align-items:center;justify-content:center;width:20px;flex-shrink:0;cursor:grab;color:#fbbf24;border-right:1px solid #fef3c7;padding:0 2px;border-radius:12px 0 0 12px">
        <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor">
          <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
          <circle cx="3" cy="6" r="1.5"/><circle cx="7" cy="6" r="1.5"/>
          <circle cx="3" cy="10" r="1.5"/><circle cx="7" cy="10" r="1.5"/>
          <circle cx="3" cy="14" r="1.5"/><circle cx="7" cy="14" r="1.5"/>
        </svg>
      </div>
      <div style="flex:1;min-width:0;padding:14px 18px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">
          <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" width="14" height="14"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          <span style="font-size:10.5px;font-weight:800;color:#b45309;text-transform:uppercase;letter-spacing:.5px">Phần ${sectionNo} / ${totalSections}</span>
        </div>
        <div style="font-size:17px;font-weight:800;color:#92400e;line-height:1.35;margin-bottom:${desc ? '6px' : '0'}">${title}</div>
        ${desc ? `<div style="font-size:13px;color:#78350f;line-height:1.45">${desc}</div>` : ''}
      </div>
    </div>`;
}

function renderDirectInlineAddButton(afterId) {
  const safeAfterId = String(afterId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `<div style="display:flex;justify-content:flex-start;padding:10px 0 4px">
    <button type="button" onclick="dqInsertAfter('${safeAfterId}')" class="fm-add-question-btn" title="Thêm câu hỏi dưới mục đang chọn"
      style="min-width:132px;height:36px;padding:0 14px;border:1.5px dashed #00008B;border-radius:10px;background:#fff;color:#00008B;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:13px;font-weight:700;white-space:nowrap"
      onmouseenter="this.style.background='#eef2ff';this.style.borderColor='#00008B'"
      onmouseleave="this.style.background='#fff';this.style.borderColor='#00008B'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>Thêm câu hỏi</span>
    </button>
  </div>`;
}

function renderDirectQList() {
  const list = document.getElementById('direct-q-list');
  const empty = document.getElementById('direct-q-empty');
  // Merge: library selected + directQuestions k? c? section
  const allQ = getAllFormItems ? getAllFormItems() : getAllFormQuestions();
  if (!list) return;

  const n = countRealQuestions(allQ);
  const el1 = document.getElementById('q-sel-count');
  const el2 = document.getElementById('q-bottom-count');
  if (el1) el1.textContent = n;
  if (el2) el2.textContent = n;

  if (!allQ.length) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    let addWrapper = document.getElementById('direct-q-add-btn');
    if (!addWrapper) {
      addWrapper = document.createElement('div');
      addWrapper.id = 'direct-q-add-btn';
      list.parentNode.insertBefore(addWrapper, list.nextSibling);
    }
    addWrapper.innerHTML = `<div style="display:flex;justify-content:flex-start;padding:10px 0 2px">
      <button type="button" data-add-direct-q="end" onclick="handleAddDirectQ(event, 'end')" class="fm-add-question-btn" title="Thêm câu hỏi"
        style="min-width:132px;height:36px;padding:0 14px;border:1.5px dashed #00008B;border-radius:10px;background:#fff;color:#00008B;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:13px;font-weight:700;white-space:nowrap"
        onmouseenter="this.style.background='#eef2ff';this.style.borderColor='#00008B'" onmouseleave="this.style.background='#fff';this.style.borderColor='#00008B'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Thêm câu hỏi</span>
      </button>
    </div>`;
    return;
  }
  if (empty) empty.style.display = 'none';
  const firstRealQuestion = allQ.find(q => !q._isSection);
  if (!activeDirectQuestionId && firstRealQuestion) activeDirectQuestionId = String(firstRealQuestion.id);
  if (activeDirectQuestionId && !allQ.some(q => sameQuestionId(q.id, activeDirectQuestionId))) {
    activeDirectQuestionId = firstRealQuestion ? String(firstRealQuestion.id) : '';
  }

  const existingAddWrapper = document.getElementById('direct-q-add-btn');
  if (existingAddWrapper) existingAddWrapper.remove();
  const sectionHeaderHtml = hasLeadingImplicitSection(allQ) ? renderDirectImplicitSectionHeader(getTotalSectionCount(allQ)) : '';
  list.innerHTML = sectionHeaderHtml + allQ.map((q, qi) => {
    const questionNo = getQuestionNumberInSection(allQ, qi);
    const sectionNo = getSectionNumber(allQ, qi);
    const totalSections = getTotalSectionCount(allQ);
    const inlineAddHtml = sameQuestionId(q.id, activeDirectQuestionId) ? renderDirectInlineAddButton(q.id) : '';
    // Render section card
    if (q._isSection) {
      const isActiveSection = sameQuestionId(q.id, activeDirectQuestionId);
      if (!isActiveSection) return renderDirectSectionCollapsedCard(q, sectionNo, totalSections);
      return `
    <div id="dqcard-${q.id}" style="border:2px dashed #fbbf24;border-radius:12px;background:#fffbeb;padding:0;display:flex">
      <div style="flex:1;min-width:0;padding:12px 14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" width="14" height="14"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          <span style="font-size:10.5px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.5px">Phần ${sectionNo} / ${totalSections}</span>
        </div>
        <div id="dq-section-title-${q.id}-wrap" onfocusout="handleFieldToolbarFocusOut(event, 'dq-section-title-${q.id}')">
          <div id="dq-section-title-${q.id}" class="rich-title-editor" contenteditable="true" role="textbox" aria-label="Tiêu đề phần"
            data-direct-section-id="${q.id}" data-direct-section-field="title"
            data-placeholder="Tiêu đề phần..."
            style="width:100%;min-height:34px;padding:6px 10px;border:1.5px solid #fde68a;border-radius:8px;font-size:14px;font-weight:700;font-family:inherit;outline:none;background:#fff;color:#92400e;transition:border .15s;box-sizing:border-box;white-space:pre-wrap;word-break:break-word"
            onfocus="this.style.borderColor='#f59e0b';showFieldToolbar('dq-section-title-${q.id}')"
            onblur="this.style.borderColor='#fde68a';syncRichTextFieldFromEditor('dq-section-title-${q.id}')"
            oninput="syncRichTextFieldFromEditor('dq-section-title-${q.id}')"
            onkeydown="handleRichFieldKeydown(event, 'dq-section-title-${q.id}')"
            onclick="handleRichFieldClick(event, 'dq-section-title-${q.id}')"
            onpaste="pastePlainTextIntoRichField(event, 'dq-section-title-${q.id}')">${formatRichTextForEditor(q.title || '')}</div>
          ${renderTextFormatToolbar(`dq-section-title-${q.id}`, { hidden: true })}
        </div>
        <div id="dq-section-desc-${q.id}-wrap" onfocusout="handleFieldToolbarFocusOut(event, 'dq-section-desc-${q.id}')" style="margin-top:6px">
          <div id="dq-section-desc-${q.id}" class="rich-title-editor" contenteditable="true" role="textbox" aria-label="Mô tả phần"
            data-direct-section-id="${q.id}" data-direct-section-field="desc"
            data-placeholder="Mô tả phần (tùy chọn)..."
            style="width:100%;min-height:32px;padding:5px 10px;border:1px solid #fde68a;border-radius:7px;font-size:12.5px;font-family:inherit;outline:none;background:#fff;color:#78350f;transition:border .15s;box-sizing:border-box;white-space:pre-wrap;word-break:break-word"
            onfocus="this.style.borderColor='#f59e0b';showFieldToolbar('dq-section-desc-${q.id}')"
            onblur="this.style.borderColor='#fde68a';syncRichTextFieldFromEditor('dq-section-desc-${q.id}')"
            oninput="syncRichTextFieldFromEditor('dq-section-desc-${q.id}')"
            onkeydown="handleRichFieldKeydown(event, 'dq-section-desc-${q.id}')"
            onclick="handleRichFieldClick(event, 'dq-section-desc-${q.id}')"
            onpaste="pastePlainTextIntoRichField(event, 'dq-section-desc-${q.id}')">${formatRichTextForEditor(q.desc || '')}</div>
          ${renderTextFormatToolbar(`dq-section-desc-${q.id}`, { hidden: true })}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 6px;border-left:1px solid #fde68a;min-width:40px;flex:0 0 40px">
        <button onclick="dqDuplicateSection('${q.id}')" title="Sao chép phần"
          style="width:28px;height:28px;border:none;background:none;cursor:pointer;color:#b45309;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.background='#fef3c7';this.style.color='#92400e'"
          onmouseleave="this.style.background='none';this.style.color='#b45309'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="9" y="9" width="11" height="11" rx="2"/><rect x="4" y="4" width="11" height="11" rx="2"/></svg>
        </button>
        <button onclick="dqMoveSection('${q.id}', -1)" title="Di chuyển phần lên"
          style="width:28px;height:28px;border:none;background:none;cursor:pointer;color:#b45309;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.background='#fef3c7';this.style.color='#92400e'"
          onmouseleave="this.style.background='none';this.style.color='#b45309'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>
        </button>
        <button onclick="dqMoveSection('${q.id}', 1)" title="Di chuyển phần xuống"
          style="width:28px;height:28px;border:none;background:none;cursor:pointer;color:#b45309;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.background='#fef3c7';this.style.color='#92400e'"
          onmouseleave="this.style.background='none';this.style.color='#b45309'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15"><path d="M12 5v14"/><path d="M18 13l-6 6-6-6"/></svg>
        </button>
        <button onclick="dqMergeSectionWithPrevious('${q.id}')" title="Hợp nhất với phần trên"
          style="width:28px;height:28px;border:none;background:none;cursor:pointer;color:#b45309;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.background='#fef3c7';this.style.color='#92400e'"
          onmouseleave="this.style.background='none';this.style.color='#b45309'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M5 7h14"/><path d="M5 17h14"/><path d="M12 4v16"/><path d="M8 11l4 4 4-4"/></svg>
        </button>
        <button onclick="dqRemoveSection('${q.id}')" title="Xóa phần"
          style="width:28px;height:28px;border:none;background:none;cursor:pointer;color:#ef4444;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.background='#fef2f2';this.style.color='#dc2626'"
          onmouseleave="this.style.background='none';this.style.color='#ef4444'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </div>
    </div>${inlineAddHtml}`;
    }
    const normalizedType = normalizeQuestionType(q.type);
    const needsOpts = DQ_NEEDS_OPTS.includes(normalizedType);
    const needsGrid = DQ_NEEDS_GRID.includes(normalizedType);
    const opts = q.opts || [];
    const rows = q.rows || [];
    const cols = q.cols || [];
    const typeIcon = DQ_TYPE_ICON[q.type] || DQ_TYPE_ICON[normalizedType] || '';
    const typeColor = DQ_TYPE_COLOR[q.type] || '#374151';
    const isActiveQuestion = sameQuestionId(q.id, activeDirectQuestionId);
    const isCollapsed = !!q._collapsed || !isActiveQuestion;
    const summaryMeta = [];
    if (needsOpts && normalizedType !== 'rating' && normalizedType !== 'scale') {
      const filledOpts = opts.filter(o => String(o || '').trim()).length;
      if (filledOpts) summaryMeta.push(`${filledOpts} lựa chọn`);
    }
    if (normalizedType === 'scale') {
      const scale = getQuestionScaleConfig(q);
      summaryMeta.push(`${scale.start} đến ${scale.end}`);
    }
    if (normalizedType === 'rating') {
      summaryMeta.push(`${getQuestionRatingConfig(q).count} sao`);
    }
    if (needsGrid) {
      const filledRows = rows.filter(r => String(r || '').trim()).length;
      const filledCols = cols.filter(c => String(c || '').trim()).length;
      if (filledRows || filledCols) summaryMeta.push(`${filledRows} hàng × ${filledCols} cột`);
    }
    if (isCollapsed) return renderDirectQuestionCollapsedCard(q, questionNo, normalizedType);
    return `
        <div id="dqcard-${q.id}"
          ondragover="dqDragOver(event)"
          ondrop="dqDrop(event,'${q.id}')"
          style="border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.04);display:flex;transition:box-shadow .15s,opacity .15s">
      <!-- Drag handle 6 chợm -->
      <div class="dq-drag-handle" title="Kéo để đổi vị trí" draggable="true"
        ondragstart="dqDragStart(event,'${q.id}')"
        ondragend="dqDragEnd(event)"
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
      <div id="dq-text-${q.id}-wrap" onfocusout="handleFieldToolbarFocusOut(event, 'dq-text-${q.id}')">
        <!-- Row: số + input câu hỏi + dropdown loại -->
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:22px;height:22px;border-radius:50%;background:#00008B;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${isPresentationItem(q) ? '' : questionNo}</div>
          <div id="dq-text-${q.id}" class="dq-placeholder-gray rich-title-editor" contenteditable="true" role="textbox" aria-label="${normalizedType==='presentation_image'?'Tiêu đề hình ảnh':normalizedType==='presentation_video'?'Tiêu đề video':'Nội dung câu hỏi'}"
            data-direct-question-id="${q.id}"
            draggable="false"
            data-placeholder="${normalizedType==='presentation_image'?'Tiêu đề hình ảnh (không bắt buộc)':normalizedType==='presentation_video'?'Tiêu đề video (không bắt buộc)':'Nhập nội dung câu hỏi...'}"
            style="flex:1;width:100%;min-height:35px;padding:7px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;line-height:1.45;outline:none;background:#fafbff;transition:border .15s;min-width:0;white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text"
            onmousedown="event.stopPropagation()"
            ondragstart="event.preventDefault()"
            onfocus="this.style.borderColor='#00008B';showFieldToolbar('dq-text-${q.id}')"
            onblur="this.style.borderColor='#e2e8f0';syncRichTextFieldFromEditor('dq-text-${q.id}')"
            oninput="syncRichTextFieldFromEditor('dq-text-${q.id}')"
            onkeydown="handleRichFieldKeydown(event, 'dq-text-${q.id}')"
            onpaste="pastePlainTextIntoRichField(event, 'dq-text-${q.id}')">${formatRichTextForEditor(q.text || '')}</div>
          ${isPresentationItem(q) ? '' : `<button onclick="dqChangeImage('${q.id}')" title="Thêm hình ảnh" style="width:40px;height:40px;border-radius:8px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748b;transition:background .15s" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='transparent'"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></button>`}
          ${isPresentationItem(q) ? '' : renderQuestionTypeDropdown(q.type, 'direct', q.id)}
        </div>
        <div style="margin-left:30px">
          ${renderQuestionFormatToolbar(`dq-text-${q.id}`, { hidden: true })}
        </div>
      </div>

      ${getQuestionImageUrl(q) ? (() => {
        const align = q.image_align || parseJsonObject(q.validation_json || q.validation || q.logic_json).image_align || 'left';
        const width = q.image_width || parseJsonObject(q.validation_json || q.validation || q.logic_json).image_width || 'auto';
        return `
      <div style="margin-top:8px;padding-left:${isPresentationItem(q) ? '0' : '30px'};position:relative;display:flex;justify-content:${align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'}">
        <div style="position:relative;display:inline-block"
             onmouseenter="this.querySelector('.resize-overlay').style.display='block'"
             onmouseleave="this.querySelector('.resize-overlay').style.display='none'">
          <img id="dq-img-${q.id}" src="${previewEsc(getQuestionImageUrl(q))}" style="width:${width};max-width:100%;max-height:400px;border-radius:8px;object-fit:contain;border:1px solid #e2e8f0;background:#f8fafc">
          <div class="resize-overlay" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;border:2px solid #3b82f6;pointer-events:none;z-index:40">
            <div style="position:absolute;top:-5px;left:-5px;width:10px;height:10px;background:#fff;border:1px solid #3b82f6;pointer-events:auto;cursor:nwse-resize" onmousedown="startImageResize(event, '${q.id}', 'nw')"></div>
            <div style="position:absolute;top:-5px;right:-5px;width:10px;height:10px;background:#fff;border:1px solid #3b82f6;pointer-events:auto;cursor:nesw-resize" onmousedown="startImageResize(event, '${q.id}', 'ne')"></div>
            <div style="position:absolute;bottom:-5px;left:-5px;width:10px;height:10px;background:#fff;border:1px solid #3b82f6;pointer-events:auto;cursor:nesw-resize" onmousedown="startImageResize(event, '${q.id}', 'sw')"></div>
            <div style="position:absolute;bottom:-5px;right:-5px;width:10px;height:10px;background:#fff;border:1px solid #3b82f6;pointer-events:auto;cursor:nwse-resize" onmousedown="startImageResize(event, '${q.id}', 'se')"></div>
          </div>
          <div style="position:absolute;top:4px;left:4px;z-index:50">
            <button onclick="toggleImageMenu(event, '${q.id}')" title="Tùy chọn hình ảnh" style="width:28px;height:28px;border-radius:4px;background:#fff;border:1px solid #cbd5e1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,.1);color:#334155">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
            <div id="image-menu-${q.id}" class="image-dropdown-menu" style="display:none;position:absolute;top:100%;left:0;margin-top:4px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.1);min-width:140px;z-index:50;padding:4px 0">
              <div onclick="dqSetImageAlign('${q.id}','left')" style="padding:8px 12px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='none'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="19" y2="18"/></svg> Căn trái
              </div>
              <div onclick="dqSetImageAlign('${q.id}','center')" style="padding:8px 12px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='none'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="3" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5" y1="18" x2="19" y2="18"/></svg> Căn giữa
              </div>
              <div onclick="dqSetImageAlign('${q.id}','right')" style="padding:8px 12px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='none'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="5" y1="18" x2="21" y2="18"/></svg> Căn phải
              </div>
              <div style="height:1px;background:#e2e8f0;margin:4px 0"></div>
              <div onclick="dqChangeImage('${q.id}')" style="padding:8px 12px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='none'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Thay đổi
              </div>
              <div onclick="dqRemoveImage('${q.id}')" style="padding:8px 12px;font-size:13px;cursor:pointer;color:#ef4444;display:flex;align-items:center;gap:8px" onmouseenter="this.style.background='#fef2f2'" onmouseleave="this.style.background='none'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> Xóa
              </div>
            </div>
          </div>
        </div>
      </div>`;
      })() : ''}

      ${getQuestionVideoUrl(q) ? `
      <div style="margin-top:8px;padding-left:30px;position:relative">
        ${isNativeVideoUrl(getQuestionVideoUrl(q)) ? `
        <video src="${previewEsc(getQuestionVideoUrl(q))}" controls style="display:block;width:100%;max-height:190px;border-radius:8px;border:1px solid #e9d5ff;background:#0f172a"></video>` : `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f5f3ff;border-radius:8px;border:1px solid #e9d5ff">
          <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" width="16" height="16"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          <a href="${previewEsc(getQuestionVideoUrl(q))}" target="_blank" style="font-size:12px;color:#7c3aed;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${previewEsc(getQuestionVideoUrl(q))}</a>
        </div>`}
        <button onclick="(function(){var q=_dqFindQ('${q.id}');if(q){delete q.video;delete q.video_url;renderDirectQList();}})()" title="Xóa video"
          style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;cursor:pointer;color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;line-height:1">×</button>
      </div>` : ''}

      ${needsOpts ? `
      <!-- Lựa chọn -->
      <div style="padding-left:30px;margin-top:10px">

        ${normalizedType==='rating' ? `
        ${renderRatingConfigEditor(q, 'direct', q.id)}
        ` : normalizedType==='scale' ? `
        ${renderScaleConfigEditor(q, 'direct', q.id)}
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
            const dragHandle = '<span class="dq-opt-drag-handle" draggable="true" ondragstart="dqOptDragStart(event,\'' + q.id + '\',' + oi + ')" ondragend="dqOptDragEnd(event)" style="cursor:grab;color:#d1d5db;display:flex;align-items:center;flex-shrink:0;padding:0 2px" title="Kéo để đổi vị trí"><svg viewBox="0 0 8 12" width="8" height="12" fill="currentColor"><circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/><circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/><circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/></svg></span>';
            const removeBtn = opts.length > 1 ? `<button onclick="dqRemoveOpt('${q.id}',${oi})" title="Xóa lựa chọn" style="width:20px;height:20px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;transition:all .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">X</button>` : '';
            let vj = {}; try { vj = typeof q.validation_json === 'string' ? JSON.parse(q.validation_json) : q.validation_json; } catch(e){}
            const optImgUrl = vj && vj.option_images && vj.option_images[oi] ? vj.option_images[oi] : null;
            const imgBtn = `<button onclick="dqChangeOptImage('${q.id}', ${oi})" title="Thêm hình ảnh" style="width:20px;height:20px;background:none;border:none;cursor:pointer;color:#94a3b8;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='#94a3b8'"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></button>`;
            const imgPreview = optImgUrl ? `<div style="margin-top:6px;margin-left:27px;position:relative;display:inline-block"><img src="${optImgUrl}" style="height:60px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;"><button onclick="dqRemoveOptImage('${q.id}', ${oi})" title="Xóa ảnh" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#ef4444;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;box-shadow:0 1px 3px rgba(0,0,0,0.2);">X</button></div>` : '';
            return `<div ondragover="dqOptDragOver(event,'${q.id}',${oi})" ondrop="dqOptDrop(event,'${q.id}',${oi})" style="margin-bottom:6px;transition:opacity .15s"><div style="display:flex;align-items:center;gap:6px;">${dragHandle}${optIcon}<input type="text" value="${o.replace(/"/g,'&quot;')}" placeholder="Lựa chọn ${oi+1}" style="flex:1;padding:6px 10px;border:1px solid #e2e8f0;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s" onfocus="this.style.borderColor=this.dataset.duplicate==='1'?'#ef4444':'#00008B'" onblur="updateDirectOptionDuplicateState(this,'${q.id}',${oi},true);if(this.dataset.duplicate!=='1')this.style.borderColor='#e2e8f0'" oninput="dqSetOpt('${q.id}',${oi},this.value);updateDirectOptionDuplicateState(this,'${q.id}',${oi},false)" onkeydown="if(event.key==='Enter'){event.preventDefault();dqAddOpt('${q.id}');}">${imgBtn}${removeBtn}</div>${imgPreview}</div>`;
          }).join('')}
        </div>
        <button onclick="dqAddOpt('${q.id}')"
          style="padding:5px 14px;background:transparent;border:1.5px dashed #00008B;border-radius:7px;cursor:pointer;color:#00008B;font-size:12px;font-weight:600;transition:all .15s;margin-top:2px"
          onmouseenter="this.style.background='#00008B';this.style.borderColor='#fff'"
          onmouseleave="this.style.background='transparent';this.style.borderColor='#00008B'">+ Thêm lựa chọn</button>
        ${renderOtherOptionEditor(q, normalizedType, 'direct', q.id)}
        `}

      </div>` : ''}

      ${!needsOpts && !needsGrid ? renderTextAnswerBuilder(normalizedType) : ''}

      ${needsGrid ? `
      <!-- Lưới: hàng + cột -->
      <div style="padding-left:30px;margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <!-- Hàng -->
        <div>
          <div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Hàng (tùy chọn)</div>
          <div id="dq-rows-${q.id}">
            ${rows.map((r,ri)=>`
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
              <span style="width:14px;height:14px;border-radius:${normalizedType==='grid_radio'?'50%':'3px'};border:1.5px solid #c4b5fd;flex-shrink:0;display:inline-block;background:#fff"></span>
              <input type="text" value="${r.replace(/"/g,'&quot;')}" placeholder="Hàng ${ri+1}"
                style="flex:1;padding:5px 9px;border:1px solid #e2e8f0;border-radius:7px;font-size:12px;background:#fff;outline:none;transition:border .15s"
                onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e2e8f0'"
                oninput="dqSetRow('${q.id}',${ri},this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();dqAddRow('${q.id}');}">
              ${rows.length>1?`<button onclick="dqRemoveRow('${q.id}',${ri})"
                style="width:20px;height:20px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;line-height:1;flex-shrink:0;transition:color .15s"
                onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>`:''}
            </div>`).join('')}
          </div>
          <button onclick="dqAddRow('${q.id}')"
            style="padding:4px 10px;background:transparent;border:1.5px dashed #c4b5fd;border-radius:7px;cursor:pointer;color:#7c3aed;font-size:11.5px;font-weight:600;transition:all .15s;margin-top:2px"
            onmouseenter="this.style.background='#f5f3ff'" onmouseleave="this.style.background='transparent'">+ Thêm hàng</button>
        </div>
        <!-- Cột -->
        <div>
          <div style="font-size:11px;font-weight:700;color:#00008B;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Cột (lựa chọn)</div>
          <div id="dq-cols-${q.id}">
            ${cols.map((c,ci)=>`
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
              <span style="width:14px;height:14px;border-radius:${normalizedType==='grid_radio'?'50%':'3px'};border:1.5px solid #00008B;flex-shrink:0;display:inline-block;background:#fff"></span>
              <input type="text" value="${c.replace(/"/g,'&quot;')}" placeholder="Cột ${ci+1}"
                style="flex:1;padding:5px 9px;border:1px solid #e2e8f0;border-radius:7px;font-size:12px;background:#fff;outline:none;transition:border .15s"
                onfocus="this.style.borderColor='#00008B'" onblur="this.style.borderColor='#e2e8f0'"
                oninput="dqSetCol('${q.id}',${ci},this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();dqAddCol('${q.id}');}">
              ${cols.length>1?`<button onclick="dqRemoveCol('${q.id}',${ci})"
                style="width:20px;height:20px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;line-height:1;flex-shrink:0;transition:color .15s"
                onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>`:''}
            </div>`).join('')}
          </div>
          <button onclick="dqAddCol('${q.id}')"
            style="padding:4px 10px;background:transparent;border:1.5px dashed #00008B;border-radius:7px;cursor:pointer;color:#00008B;font-size:11.5px;font-weight:600;transition:all .15s;margin-top:2px"
            onmouseenter="this.style.background='#00008B'" onmouseleave="this.style.background='transparent'">+ Thêm cột</button>
        </div>
      </div>` : ''}

      <!-- Bottom bar: bắt buộc + hành động -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding-top:10px;border-top:1px solid #f1f5f9;flex-wrap:wrap">
        <!-- Toggle bắt buộc -->
        ${isPresentationItem(q) ? '<div></div>' : `
        <label style="display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none">
          <div style="position:relative;width:34px;height:18px">
            <input type="checkbox" ${q.required ? 'checked' : ''} onchange="dqSetRequired('${q.id}',this.checked)"
              style="opacity:0;width:0;height:0;position:absolute">
            <span style="position:absolute;inset:0;background:${q.required ? '#00008B' : '#cbd5e1'};border-radius:9px;transition:background .2s;cursor:pointer"></span>
            <span style="position:absolute;top:3px;left:${q.required ? '18px' : '3px'};width:12px;height:12px;background:#fff;border-radius:50%;transition:left .2s;pointer-events:none"></span>
          </div>
          <span style="font-size:12px;font-weight:600;color:${q.required ? '#00008B' : '#94a3b8'}">Bắt buộc</span>
        </label>`}
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-left:auto">
          ${isPresentationItem(q) ? '' : renderLibrarySaveButton({ saved: isQuestionSavedInLibrary(q), onclick: `dqSaveToLibrary('${q.id}', this)` })}
          <button onclick="dqRemove('${q.id}')" title="Xóa câu hỏi"
            style="height:34px;padding:0 12px;border:1px solid #fecaca;border-radius:8px;background:#fff;color:#dc2626;font-size:12px;font-weight:800;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap"
            onmouseenter="this.style.background='#fef2f2';this.style.borderColor='#f87171'" onmouseleave="this.style.background='#fff';this.style.borderColor='#fecaca'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Xóa
          </button>
        </div>
      </div>
      </div><!-- end main content -->

      <!-- Sidebar bên phải -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 6px;border-left:1px solid #f1f5f9;min-width:40px">
        <!-- Nhập câu hỏi từ thư viện -->
        <button onclick="toggleLibrary('${q.id}')" title="Nhập câu hỏi từ thư viện"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#00008B';this.style.background='#eef5ff'"
          onmouseleave="this.style.color:#94a3b8;this.style.background='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M4 4v15.5A2.5 2.5 0 006.5 22H20V6a2 2 0 00-2-2H6.5A2.5 2.5 0 004 6.5"/><path d="M8 8h8"/><path d="M8 12h6"/></svg>
        </button>
        <!-- Thêm hình ảnh -->
        <button onclick="dqAddImage('${q.id}')" title="Thêm hình ảnh"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#00008B';this.style.background='#00008B'"
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
    </div>${inlineAddHtml}`;
  }).join('');

}

function getAllFormQuestions() {
  return getAllFormItems().filter(q => !q._isSection);
}

function getAllFormItems() {
  if (selectedQuestions.size > 0) {
    const libSel = libraryQuestions.filter(q => selectedQuestions.has(String(q.id))).map(getLibraryQuestionForForm);
    const toAdd = libSel.filter(lq => !directQuestions.some(dq => sameQuestionId(dq.id, lq.id)));
    directQuestions.unshift(...toAdd);
    selectedQuestions.clear();
  }
  return [...directQuestions];
}

function addDirectQ(position = 'first-section') {
  const newQ = { id: 'dq-' + Date.now(), text: '', type: 'choice', opts: [''], required: false };
  if (position === 'first-section') {
    const firstSectionIndex = directQuestions.findIndex(isSectionItem);
    if (firstSectionIndex >= 0) {
      directQuestions.splice(firstSectionIndex, 0, newQ);
    } else {
      directQuestions.push(newQ);
    }
  } else {
    directQuestions.push(newQ);
  }
  activeDirectQuestionId = String(newQ.id);
  renderDirectQList();
  setTimeout(() => {
    const card = document.getElementById('dqcard-' + newQ.id);
    focusDirectQuestionText(card, newQ.id);
  }, 50);
}

function handleAddDirectQ(event, position = 'first-section') {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  addDirectQ(position);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add-direct-q]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  addDirectQ(button.getAttribute('data-add-direct-q') || 'first-section');
});

function showLibrarySavedNotice(isOffline = false) {
  const msg = isOffline
    ? '\u0110\u00e3 l\u01b0u v\u00e0o th\u01b0 vi\u1ec7n (offline)'
    : '\u0110\u00e3 l\u01b0u v\u00e0o th\u01b0 vi\u1ec7n';
  if (typeof showToast === 'function') showToast(msg, 'success');
  else alert(msg);
}

function markLibrarySavedButton(btn) {
  if (!btn) return;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="14" height="14"><path d="M20 6L9 17l-5-5"/></svg> Đã lưu`;
  btn.disabled = true;
  btn.removeAttribute('onclick');
  btn.style.background = '#ecfdf5';
  btn.style.borderColor = '#34d399';
  btn.style.color = '#047857';
  btn.style.cursor = 'default';
  btn.onmouseenter = null;
  btn.onmouseleave = null;
}

function getQuestionLibraryId(q) {
  return q?.thu_vien_id || q?.library_id || q?.libraryQuestionId || q?.ma_thu_vien || null;
}

function normalizeQuestionSignatureText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeQuestionSignatureList(values) {
  return (Array.isArray(values) ? values : [])
    .map(normalizeQuestionSignatureText)
    .filter(Boolean);
}

function getQuestionLibrarySignature(q) {
  const normalizedType = normalizeQuestionType(q?.type || q?.loai || 'choice');
  return {
    text: normalizeQuestionSignatureText(q?.text || q?.noi_dung),
    type: normalizedType,
    opts: normalizeQuestionSignatureList(q?.opts || q?.lua_chon),
    rows: normalizeQuestionSignatureList(q?.rows || q?.hang),
    cols: normalizeQuestionSignatureList(q?.cols || q?.cot),
    allowOther: !!questionAllowsOther({ ...q, type: normalizedType }),
  };
}

function sameQuestionLibrarySignature(a, b) {
  const left = getQuestionLibrarySignature(a);
  const right = getQuestionLibrarySignature(b);
  return left.text
    && left.text === right.text
    && left.type === right.type
    && JSON.stringify(left.opts) === JSON.stringify(right.opts)
    && JSON.stringify(left.rows) === JSON.stringify(right.rows)
    && JSON.stringify(left.cols) === JSON.stringify(right.cols)
    && left.allowOther === right.allowOther;
}

function findQuestionInLibrary(q) {
  if (!q || isSectionItem(q)) return null;
  const libraryId = getQuestionLibraryId(q);
  if (libraryId) {
    const byId = libraryQuestions.find(lq => sameQuestionId(lq.id, libraryId));
    if (byId) return byId;
  }
  return libraryQuestions.find(lq => sameQuestionLibrarySignature(q, lq)) || null;
}

function isQuestionSavedInLibrary(q) {
  return !!findQuestionInLibrary(q);
}

function renderLibrarySaveButton({ saved, onclick }) {
  if (saved) {
    return `
      <button type="button" disabled title="Câu hỏi đã có trong thư viện"
        style="height:34px;padding:0 13px;border:1px solid #34d399;border-radius:8px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:800;cursor:default;display:inline-flex;align-items:center;gap:6px;white-space:nowrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="14" height="14"><path d="M20 6L9 17l-5-5"/></svg>
        Đã lưu
      </button>`;
  }

  return `
    <button onclick="${onclick}" title="Lưu vào thư viện"
      style="height:34px;padding:0 13px;border:1px solid #bbf7d0;border-radius:8px;background:#fff;color:#059669;font-size:12px;font-weight:800;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap"
      onmouseenter="this.style.background='#f0fdf4';this.style.borderColor='#6ee7b7'" onmouseleave="this.style.background='#fff';this.style.borderColor='#bbf7d0'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><path d="M19 21H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 5 7 9 15 9"/></svg>
      Lưu vào thư viện
    </button>`;
}

function getFilledQuestionOptions(q) {
  return (q?.opts || []).map(o => String(o || '').trim()).filter(Boolean);
}

function validateQuestionBeforeLibrarySave(q) {
  if (!q?.text?.trim()) return 'Câu hỏi chưa có nội dung!';

  const normalizedType = normalizeQuestionType(q.type);
  if (['choice', 'checkbox', 'dropdown'].includes(normalizedType)) {
    const opts = getFilledQuestionOptions(q);
    if (!opts.length) return 'Câu hỏi cần ít nhất 1 lựa chọn!';
    const duplicateOpt = findDuplicateOptionLabel(opts);
    if (duplicateOpt) return `Lựa chọn bị trùng: "${duplicateOpt}"`;
  }

  if (['grid_radio', 'grid_checkbox'].includes(normalizedType)) {
    const filledRows = (q.rows || []).filter(r => String(r || '').trim());
    const filledCols = (q.cols || []).filter(c => String(c || '').trim());
    if (!filledRows.length || !filledCols.length) return 'Câu hỏi lưới cần ít nhất 1 hàng và 1 cột!';
  }

  return '';
}

function getLibraryContextFromForm(prefix) {
  const category = normalizeLibraryCategory(document.getElementById(`${prefix}-form-cat`)?.value || 'Ngoại ngữ');
  const surveyType = document.getElementById(`${prefix}-form-survey-type`)?.value || getDefaultSurveyType(category);
  const target = normalizeSurveyTarget(document.getElementById(`${prefix}-form-target`)?.value || 'Tất cả');
  return { category, surveyType, target };
}

function buildLibraryQuestionFallback(q, context, opts) {
  return {
    id: 'lib-' + Date.now(),
    text: q.text.trim(),
    type: q.type,
    category: context.category,
    bo_mon: context.category,
    loai_khao_sat: context.surveyType,
    survey_type: context.surveyType,
    doi_tuong: context.target,
    target: context.target,
    opts,
    validation_json: getQuestionValidationJson(q),
    allowOther: questionAllowsOther(q),
    allow_other: questionAllowsOther(q),
    ...(q.rows?.length ? { rows: q.rows } : {}),
    ...(q.cols?.length ? { cols: q.cols } : {}),
    ...(getQuestionImageUrl(q) ? { image: getQuestionImageUrl(q), image_url: getQuestionImageUrl(q), hinh_anh_url: getQuestionImageUrl(q) } : {}),
    ...(getQuestionVideoUrl(q) ? { video: getQuestionVideoUrl(q), video_url: getQuestionVideoUrl(q) } : {}),
  };
}

async function postQuestionToLibrary(q, context, opts) {
  const token = localStorage.getItem('token') || '';
  const res = await fetch(`${API_BASE}/library`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      text: q.text.trim(),
      type: q.type,
      bo_mon: context.category,
      loai_khao_sat: context.surveyType,
      survey_type: context.surveyType,
      doi_tuong: context.target,
      target: context.target,
      opts,
      required: !!q.required,
      bat_buoc: !!q.required,
      validation_json: getQuestionValidationJson(q),
      allow_other: questionAllowsOther(q),
      ...(q.rows?.length ? { rows: q.rows } : {}),
      ...(q.cols?.length ? { cols: q.cols } : {}),
      ...(getQuestionImageUrl(q) ? { image: getQuestionImageUrl(q), image_url: getQuestionImageUrl(q), hinh_anh_url: getQuestionImageUrl(q) } : {}),
      ...(getQuestionVideoUrl(q) ? { video: getQuestionVideoUrl(q), video_url: getQuestionVideoUrl(q) } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Không lưu được câu hỏi vào thư viện');
  return data;
}

async function dqSaveToLibrary(id, btn) {
  const q = _dqFindQ(id);
  if (!q) return;
  const validationError = validateQuestionBeforeLibrarySave(q);
  if (validationError) { showToast(validationError, 'error'); return; }
  const opts = getFilledQuestionOptions(q);

  const context = getLibraryContextFromForm('new');

  const already = findQuestionInLibrary(q);
  if (already) {
    q.thu_vien_id = Number(already.id) || already.id;
    markLibrarySavedButton(btn);
    showToast('Câu hỏi này đã có trong thư viện!', 'warning');
    return;
  }

  // Gửi API lưu vào thư viện
  try {
    const data = await postQuestionToLibrary(q, context, opts);
    const newQ = normalizeLibraryQuestion(data.data || buildLibraryQuestionFallback(q, context, opts));
    libraryQuestions.push(newQ);
    q.thu_vien_id = Number(newQ.id) || newQ.id;
    localStorage.setItem('flic_lib_flat', JSON.stringify(libraryQuestions));
    libraryCountReady = true;
    updateLibraryCountLabel();
    showLibrarySavedNotice(false);
    markLibrarySavedButton(btn);
    fetchLibraryFromAPI().catch(() => {});
  } catch(e) {
    showToast(e.message || 'Không lưu được câu hỏi vào thư viện', 'error');
  }
}


function dqAddSection(afterId) {
  const section = { id: 'sec-' + Date.now(), _isSection: true, title: '', desc: '' };
  const dqIdx = directQuestions.findIndex(x => sameQuestionId(x.id, afterId));
  if (dqIdx >= 0) {
    directQuestions.splice(dqIdx + 1, 0, section);
  } else {
    directQuestions.unshift(section);
  }
  renderDirectQList();
  setTimeout(() => {
    const el = document.getElementById('dqcard-' + section.id);
    if (el) { el.scrollIntoView({ behavior:'smooth', block:'nearest' }); el.querySelector('input')?.focus(); }
  }, 50);
}

function closeDirectSectionMenus(exceptId = '') {
  document.querySelectorAll('.dq-section-menu').forEach(menu => {
    if (!exceptId || menu.id !== `dq-section-menu-${exceptId}`) menu.style.display = 'none';
  });
}

function toggleDirectSectionMenu(event, id) {
  event?.stopPropagation?.();
  const menu = document.getElementById(`dq-section-menu-${id}`);
  if (!menu) return;
  const willOpen = menu.style.display !== 'block';
  closeDirectSectionMenus(id);
  menu.style.display = willOpen ? 'block' : 'none';
}

function getDirectSectionBlockRange(sectionIndex) {
  if (sectionIndex < 0 || !isSectionItem(directQuestions[sectionIndex])) return null;
  let end = directQuestions.length;
  for (let i = sectionIndex + 1; i < directQuestions.length; i++) {
    if (isSectionItem(directQuestions[i])) {
      end = i;
      break;
    }
  }
  return { start: sectionIndex, end };
}

function getDirectSectionBlocks() {
  const blocks = [];
  const firstSectionIndex = directQuestions.findIndex(isSectionItem);
  if (firstSectionIndex > 0) {
    blocks.push({ start: 0, end: firstSectionIndex, implicit: true });
  }
  directQuestions.forEach((item, index) => {
    if (!isSectionItem(item)) return;
    const range = getDirectSectionBlockRange(index);
    if (range) blocks.push({ ...range, id: item.id, implicit: false });
  });
  return blocks;
}

function cloneDirectFormItem(item, suffix) {
  const clone = JSON.parse(JSON.stringify(item || {}));
  clone.id = isSectionItem(clone) ? `sec-${Date.now()}-${suffix}` : `dq-${Date.now()}-${suffix}`;
  return clone;
}

function createBlankDirectSection() {
  return { id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, _isSection: true, title: '', desc: '' };
}

function dqActivateImplicitFirstSection() {
  const firstSectionIndex = directQuestions.findIndex(isSectionItem);
  if (firstSectionIndex !== 0) {
    const section = createBlankDirectSection();
    directQuestions.unshift(section);
    setActiveDirectSection(section.id);
    return;
  }
  setActiveDirectSection(directQuestions[0].id);
}

function dqDuplicateSection(id) {
  closeDirectSectionMenus();
  const idx = directQuestions.findIndex(x => sameQuestionId(x.id, id) && isSectionItem(x));
  const range = getDirectSectionBlockRange(idx);
  if (!range) return;
  const block = directQuestions.slice(range.start, range.end).map((item, i) => cloneDirectFormItem(item, i));
  directQuestions.splice(range.end, 0, ...block);
  activeDirectQuestionId = '';
  renderDirectQList();
  setTimeout(() => document.getElementById('dqcard-' + block[0]?.id)?.scrollIntoView({ behavior:'smooth', block:'nearest' }), 50);
}

function dqMoveSection(id, direction) {
  closeDirectSectionMenus();
  const blocks = getDirectSectionBlocks();
  const currentBlockIndex = blocks.findIndex(block => !block.implicit && sameQuestionId(block.id, id));
  const targetBlockIndex = currentBlockIndex + (direction < 0 ? -1 : 1);
  if (currentBlockIndex < 0 || targetBlockIndex < 0 || targetBlockIndex >= blocks.length) return;

  const currentBlock = blocks[currentBlockIndex];
  const targetBlock = blocks[targetBlockIndex];
  const currentItems = directQuestions.slice(currentBlock.start, currentBlock.end);
  const targetItems = directQuestions.slice(targetBlock.start, targetBlock.end);

  if (direction < 0 && targetBlock.implicit) {
    directQuestions.splice(targetBlock.start, targetItems.length + currentItems.length, ...currentItems, createBlankDirectSection(), ...targetItems);
  } else if (direction < 0) {
    directQuestions.splice(targetBlock.start, targetItems.length + currentItems.length, ...currentItems, ...targetItems);
  } else if (direction > 0 && currentBlock.implicit) {
    directQuestions.splice(currentBlock.start, currentItems.length + targetItems.length, ...targetItems, createBlankDirectSection(), ...currentItems);
  } else {
    directQuestions.splice(currentBlock.start, currentItems.length + targetItems.length, ...targetItems, ...currentItems);
  }
  activeDirectQuestionId = '';
  renderDirectQList();
}

function dqMergeSectionWithPrevious(id) {
  closeDirectSectionMenus();
  const idx = directQuestions.findIndex(x => sameQuestionId(x.id, id) && isSectionItem(x));
  if (idx < 0) return;
  directQuestions.splice(idx, 1);
  renderDirectQList();
}

function dqRemoveSection(id) {
  closeDirectSectionMenus();
  const idx = directQuestions.findIndex(x => sameQuestionId(x.id, id) && isSectionItem(x));
  const range = getDirectSectionBlockRange(idx);
  if (!range) return;
  directQuestions.splice(range.start, range.end - range.start);
  activeDirectQuestionId = '';
  renderDirectQList();
}


function dqSetRequired(id, val) {
  const direct = directQuestions.find(q => sameQuestionId(q.id, id));
  if (direct) {
    direct.required = val;
    direct.bat_buoc = val;
    renderDirectQList();
    return;
  }
  const lib = libraryQuestions.find(q => sameQuestionId(q.id, id));
  if (lib && selectedQuestions.has(String(lib.id))) {
    libraryQuestionFormOverrides[String(lib.id)] = {
      ...(libraryQuestionFormOverrides[String(lib.id)] || {}),
      required: !!val,
    };
    renderDirectQList();
  }
}

function dqExpandCard(id) {
  const q = _dqFindQ(id);
  if (!q) return;
  q._collapsed = false;
  activeDirectQuestionId = String(id);
  renderDirectQList();
}

function dqValidateCard(q) {
  const normalizedType = normalizeQuestionType(q?.type);
  if (normalizedType === 'presentation_image' || normalizedType === 'presentation_video') return '';

  if (!q?.text?.trim()) return 'Câu hỏi chưa có nội dung!';

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

function dqAddImage(id) {
  openImageSourceModal(dataUrl => {
    const newQ = { id: 'dq-' + Date.now(), text: '', type: 'presentation_image', opts: [], required: false, image: dataUrl, hinh_anh_url: dataUrl };
    const dqIdx = directQuestions.findIndex(x => sameQuestionId(x.id, id));
    if (dqIdx >= 0) {
      directQuestions.splice(dqIdx + 1, 0, newQ);
    } else {
      directQuestions.push(newQ);
    }
    activeDirectQuestionId = String(newQ.id);
    renderDirectQList();
    setTimeout(() => {
      const card = document.getElementById('dqcard-' + newQ.id);
      focusDirectQuestionText(card, newQ.id);
    }, 50);
  });
}

function dqAddVideo(id) {
  const url = prompt('Nhập URL video (YouTube, Google Drive...):', '');
  if (!url?.trim()) return;
  const newQ = { id: 'dq-' + Date.now(), text: '', type: 'presentation_video', opts: [], required: false, video: url.trim(), video_url: url.trim() };
  const dqIdx = directQuestions.findIndex(x => sameQuestionId(x.id, id));
  if (dqIdx >= 0) {
    directQuestions.splice(dqIdx + 1, 0, newQ);
  } else {
    directQuestions.push(newQ);
  }
  activeDirectQuestionId = String(newQ.id);
  renderDirectQList();
  setTimeout(() => {
    const card = document.getElementById('dqcard-' + newQ.id);
    focusDirectQuestionText(card, newQ.id);
  }, 50);
}

function toggleImageMenu(event, id) {
  event.stopPropagation();
  const menu = document.getElementById('image-menu-' + id);
  if (!menu) return;
  const isVisible = menu.style.display === 'block';
  closeAllImageMenus();
  if (!isVisible) {
    menu.style.display = 'block';
  }
}

function closeAllImageMenus() {
  document.querySelectorAll('.image-dropdown-menu').forEach(m => m.style.display = 'none');
}

document.addEventListener('click', closeAllImageMenus);

function dqSetImageAlign(id, align) {
  const q = _dqFindQ(id);
  if (q) {
    q.image_align = align;
    renderDirectQList();
  }
}

function dqChangeImage(id) {
  openImageSourceModal(dataUrl => {
    const q = _dqFindQ(id);
    if (q) {
      q.image = dataUrl;
      q.hinh_anh_url = dataUrl;
      renderDirectQList();
    }
  });
}

function dqRemoveImage(id) {
  const q = _dqFindQ(id);
  if (q) {
    delete q.image; delete q.hinh_anh_url; delete q.image_url; delete q.image_align;
    renderDirectQList();
  }
}

async function readMediaFileAsDataUrl(file, onDone) {
  if (!file) return;
  try {
    if (file.type?.startsWith('image/')) {
      const original = await readFileAsDataUrl(file);
      const dataUrl = original.length > MAX_MEDIA_PAYLOAD_BYTES ? await compressImageSource(original) : original;
      if (dataUrl.length > MAX_MEDIA_PAYLOAD_BYTES) {
        showToast('Ảnh này quá lớn, vui lòng chọn ảnh nhỏ hơn hoặc ảnh đã nén.', 'error');
        return;
      }
      if (dataUrl.length < original.length) showToast('Ảnh đã được nén để lưu ổn định hơn.', 'success');
      onDone(dataUrl);
      return;
    }

    if (file.type?.startsWith('video/') && file.size > MAX_VIDEO_FILE_BYTES) {
      showToast('Video quá lớn. Vui lòng chọn video dưới 8MB hoặc dùng URL video.', 'error');
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    onDone(dataUrl);
  } catch(e) {
    showToast('Không đọc được file đã chọn. Vui lòng thử file khác.', 'error');
  }
}

function pickMediaFile(accept, onDone) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = e => readMediaFileAsDataUrl(e.target.files?.[0], onDone);
  input.click();
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
  if (!supportsOtherOption(val)) setQuestionAllowOther(q, false);
  if (val === 'scale') setQuestionScaleConfig(q, getQuestionScaleConfig(q));
  if (val === 'rating') setQuestionRatingConfig(q, getQuestionRatingConfig(q));
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
  q.opts[oi] = val;
  q._collapsed = false;
}
function dqSetScale(id, key, val) {
  const q = _dqFindQ(id);
  if (!q) return;
  setQuestionScaleConfig(q, { [key]: key === 'start' || key === 'end' ? Number(val) : val });
  if (key === 'start' || key === 'end') renderDirectQList();
}
function dqSetRating(id, key, val) {
  const q = _dqFindQ(id);
  if (!q) return;
  setQuestionRatingConfig(q, { [key]: Number(val) });
  renderDirectQList();
}
function dqAddOpt(id) {
  const q = _dqFindQ(id);
  if (q) {
    q.opts.push('');
    renderDirectQList();
    setTimeout(() => {
      const optsDiv = document.getElementById(`dq-opts-${id}`);
      if (optsDiv) {
        const inputs = optsDiv.querySelectorAll('input[type="text"]');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
      }
    }, 50);
  }
}
function dqToggleOther(id, enabled) {
  const q = _dqFindQ(id);
  if (!q) return;
  setQuestionAllowOther(q, enabled);
  renderDirectQList();
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

// --- GRID ROW/COL HELPERS ---
function _dqFindQ(id) { return directQuestions.find(q=>sameQuestionId(q.id,id))||libraryQuestions.find(q=>sameQuestionId(q.id,id)); }
function dqSetRow(id,ri,val){ const q=_dqFindQ(id); if(q){if(!q.rows)q.rows=[];q.rows[ri]=val;} }
function dqAddRow(id){ const q=_dqFindQ(id); if(q){if(!q.rows)q.rows=[];q.rows.push('');renderDirectQList();setTimeout(()=>{const d=document.getElementById(`dq-rows-${id}`);if(d){const i=d.querySelectorAll('input[type="text"]');if(i.length)i[i.length-1].focus();}},50);} }
function dqRemoveRow(id,ri){ const q=_dqFindQ(id); if(q&&q.rows&&q.rows.length>1){q.rows.splice(ri,1);renderDirectQList();} }
function dqSetCol(id,ci,val){ const q=_dqFindQ(id); if(q){if(!q.cols)q.cols=[];q.cols[ci]=val;} }
function dqAddCol(id){ const q=_dqFindQ(id); if(q){if(!q.cols)q.cols=[];q.cols.push('');renderDirectQList();setTimeout(()=>{const d=document.getElementById(`dq-cols-${id}`);if(d){const i=d.querySelectorAll('input[type="text"]');if(i.length)i[i.length-1].focus();}},50);} }
function dqRemoveCol(id,ci){ const q=_dqFindQ(id); if(q&&q.cols&&q.cols.length>1){q.cols.splice(ci,1);renderDirectQList();} }

async function deleteQ(id) {
  // mirrors handleDeleteQuestion
  document.getElementById('qdm-'+id)?.classList.remove('open');
  const q = libraryQuestions.find(item => sameQuestionId(item.id, id));
  const ok = await showConfirmDialog({
    title: 'Xóa câu hỏi khỏi thư viện?',
    message: `Câu hỏi <strong>${escapeHtml(q?.text || 'chưa có nội dung')}</strong> sẽ bị xóa khỏi thư viện câu hỏi.`,
    note: 'Các biểu mẫu đã thêm câu hỏi này sẽ không bị ảnh hưởng.',
    confirmText: 'Xóa câu hỏi',
    cancelText: 'Hủy',
    variant: 'danger',
  });
  if (!ok) return;
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

// --- SUBMIT FORM ---
async function submitForm(skipCloseConfirm = false, options = {}) {
  const isAutoDraft = !!options.autoDraft;
  const rawName = document.getElementById('new-form-name')?.value?.trim() || '';
  const name = rawName || (isAutoDraft ? UNTITLED_FORM_NAME : '');
  const desc = document.getElementById('new-form-desc')?.value?.trim() || '';
  const rawCat = document.getElementById('new-form-cat')?.value || '';
  const cat = rawCat || (isAutoDraft ? DEFAULT_DRAFT_CATEGORY : '');
  const rawSurveyType = document.getElementById('new-form-survey-type')?.value || '';
  const surveyType = rawSurveyType || (isAutoDraft ? getDefaultSurveyType(cat) : '');
  const target = document.getElementById('new-form-target')?.value || 'Tất cả';
  const statusVal = options.forcedStatus || (isAutoDraft ? 'draft' : 'pending');
  const closeInput = document.getElementById('new-form-close');
  const closeDisplay = document.getElementById('new-form-close-display');
  const noCloseInput = document.getElementById('new-form-no-close');
  const closeDate = noCloseInput?.checked ? '' : (closeInput?.value || '');
  const loiKet = document.getElementById('new-form-loi-ket')?.value?.trim() || '';
  const approvalDeadline = document.getElementById('new-approval-deadline')?.value || '';
  const urgentApproval = !!document.getElementById('new-approval-urgent')?.checked;
  const urgentReason = document.getElementById('new-approval-urgent-reason')?.value?.trim() || '';
  if (!name) { showToast('Vui lòng nhập tên biểu mẫu!', 'error'); focusRichTitleEditor(); return; }
  if (!cat) { showToast('Vui lòng chọn danh mục!', 'error'); return; }
  if (!surveyType) { showToast('Vui lòng chọn loại khảo sát!', 'error'); document.getElementById('new-form-survey-type')?.focus(); return; }
  if (statusVal === 'pending' && !validateApprovalDeadlineField()) return;
  if (getRichTextPlainLength(loiKet) > 300) {
    showToast('Lời kết không được vượt quá 300 ký tự!', 'error');
    document.getElementById('new-form-loi-ket-editor')?.focus();
    return;
  }
  if (closeDate && isPastInputDate(closeDate)) {
    showToast('Không được chọn ngày đóng trong quá khứ', 'error');
    closeDisplay?.focus();
    return;
  }

  const formItems = getAllFormItems ? getAllFormItems() : getAllFormQuestions();
  let itemsForSave = formItems;
  if (isAutoDraft) {
    const draftValidationError = validateCreateFormItems(formItems);
    itemsForSave = draftValidationError ? [] : formItems;
  } else {
    const validationError = validateCreateFormItems(formItems);
    if (validationError) { showToast(validationError, 'error'); return; }
  }
  const cleanFormItems = await normalizeQuestionMediaForSave(getCleanFormItemsForSave(itemsForSave));

  let newId = 'f-' + Date.now();
  try {
    const token = localStorage.getItem('token') || '';
    const customTheme = hasCustomFormTheme(createFormTheme);
    const payload = {
      ten_form: name,
      danh_muc: cat,
      loai_khao_sat: surveyType,
      doi_tuong: target,
      trang_thai: statusVal,
      mo_ta: desc,
      ngay_dong: closeDate || null,
      loi_ket: loiKet,
      ...(customTheme ? {
        anh_bia: createFormTheme.headerImage || null,
        mau_nen: createFormTheme.background || null,
        font_family: createFormTheme.headerFont || null,
      } : {}),
      cong_tac: createCollaborators,
      cau_hoi: buildQuestionPayload(cleanFormItems),
    };
    assertFormPayloadWithinLimit(payload);
    const res = await fetch(`${API_BASE}/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 413) throw new Error('Ảnh/video quá lớn. Vui lòng chọn ảnh nhỏ hơn hoặc dùng URL video.');
      throw new Error(result.error || result.message || 'Không tạo được form');
    }
    if (result.id) newId = String(result.id);
  } catch (e) {
    if (!isAutoDraft) {
      showToast(e.message || 'Lỗi kết nối server!', 'error');
      return;
    }
    console.warn('Không lưu được nháp lên server, tạm lưu ở giao diện:', e.message || e);
  }
  saveFormQuestionMediaCache(newId, cleanFormItems);
  saveFormItemsCache(newId, cleanFormItems);
  localStorage.removeItem(NEW_FORM_LOI_KET_DRAFT_KEY);

  // Lấy thông tin user đang đăng nhập
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const byName = currentUser.ho_ten || currentUser.ten_đang_nhap || 'Quản lý';
  const firstQuestionPreview = cleanFormItems.find(item => !isSectionItem(item))?.text
    || cleanFormItems.find(item => !isSectionItem(item))?.noi_dung
    || '';

  const newForm = {
    id: newId, name, cat,
    loai_khao_sat: surveyType,
    doi_tuong: target,
    created: formatDateForDisplay(new Date()), status: statusVal,
    createdRaw: new Date().toISOString(),
    closeDate: closeDate || '',
    mo_ta: desc,
    desc,
    loi_ket: loiKet,
    so_cau_hoi: countRealQuestions(cleanFormItems),
    questionPreview: firstQuestionPreview,
    by: byName,
    initials: byName[0]?.toUpperCase() || 'A',
    img: hasCustomFormTheme(createFormTheme) ? (createFormTheme.headerImage || '') : '',
    color: getFormCategoryColor(cat),
    anh_bia: hasCustomFormTheme(createFormTheme) ? (createFormTheme.headerImage || '') : '',
    mau_nen: hasCustomFormTheme(createFormTheme) ? (createFormTheme.background || '') : '',
    font_family: hasCustomFormTheme(createFormTheme) ? (createFormTheme.headerFont || '') : '',
    theme: hasCustomFormTheme(createFormTheme) ? cloneForHistory(createFormTheme) : {},
    questions: cleanFormItems,
    approval_priority: urgentApproval ? 'urgent' : 'normal',
    approval_deadline: approvalDeadline,
  };
  FORMS.unshift(newForm);
  filtered = sortFormsForManagement(FORMS);
  currentPage = 1;

  const dbFormId = parseInt(newId, 10);
  let approvalCreated = false;
  let approvalId = '';
  const approvalNote = urgentApproval && urgentReason ? `Lý do duyệt gấp: ${urgentReason}` : '';
  const approvalPriority = urgentApproval ? 'urgent' : 'normal';
  if (statusVal === 'pending' && !Number.isNaN(dbFormId)) {
    try {
      const approvalResult = await createApprovalRequest(dbFormId, approvalNote, {
        priority: approvalPriority,
        deadline: approvalDeadline,
        urgentReason,
      });
      approvalCreated = true;
      approvalId = String(approvalResult.id || dbFormId);
      cacheLocalApprovalItem({
        approvalId,
        formId: dbFormId,
        formName: name,
        cat,
        note: approvalNote,
        priority: approvalPriority,
        deadline: approvalDeadline,
        questions: cleanFormItems,
      });
    } catch (e) {
      console.warn('Không tạo được yêu cầu phê duyệt:', e.message);
    }
  }

  resetAndCloseCreateForm(Boolean(options.closeFromHistory));

  // Nếu đang ở trang standalone form-create.html thì redirect về quản lý biểu mẫu
  if (window.location.pathname.includes('form-create')) {
    const msg = approvalCreated
      ? `Đã tạo biểu mẫu "${name}" và gửi tới quản lý phê duyệt`
      : `Đã tạo biểu mẫu "${name}" thành công`;
    showToast(msg, 'success');
    setTimeout(() => { window.location.href = 'form-management.html'; }, 900);
    return;
  }

  // Reload lại danh sách từ API để đồng bộ dữ liệu về DB
  try {
    const freshForms = await loadForms();
    FORMS = freshForms;
    filtered = sortFormsForManagement(FORMS);
    currentPage = 1;
  } catch(e) {
    // Nếu reload thất bại vẫn giữ newForm đã unshift ở trên
  }
  renderGrid(filtered);

  if (options.successMessage) {
    showToast(`${options.successMessage}: "${name}"`, 'success');
  } else if (approvalCreated) {
    showToast(`Đã tạo biểu mẫu "${name}" và gửi tới quản lý phê duyệt`, 'success');
  } else if (statusVal === 'pending') {
    showToast(`Đã tạo biểu mẫu "${name}" ở trạng thái chờ phê duyệt`, 'warning');
  } else {
    showToast(`Đã tạo biểu mẫu "${name}" dưới dạng nháp`, 'success');
  }
  return true;
}

// --- FORM CARDS GRID / LIST ---

// Portal dropdown appended to body, positioned via getBoundingClientRect
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
  const menuWidth = 178;
  const estimatedMenuHeight = 260;
  const gap = 8;
  const margin = 10;
  const left = Math.min(
    Math.max(rect.right - menuWidth, margin),
    window.innerWidth - menuWidth - margin
  );
  const opensUp = rect.bottom + gap + estimatedMenuHeight > window.innerHeight;
  const top = opensUp
    ? Math.max(rect.top - estimatedMenuHeight - gap, margin)
    : Math.min(rect.bottom + gap, window.innerHeight - estimatedMenuHeight - margin);

  const menu = document.createElement('div');
  menu.id = 'portal-fmenu';
  menu.dataset.fid = formId;
  menu.style.cssText = `
    position:fixed;
    top:${top}px;
    left:${left}px;
    width:${menuWidth}px;
    background:#fff;
    border:1px solid #e2e8f0;
    border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,.13),0 2px 8px rgba(0,0,0,.07);
    z-index:99999;
    overflow:hidden;
    animation:${opensUp ? 'fadeInUp' : 'fadeInDown'} .12s ease;
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
  const form = FORMS.find(f => String(f.id) === String(formId));
  const active = isActiveForm(form);
  const pending = String(form?.status || form?.trang_thai || '').toLowerCase() === 'pending';

  menu.appendChild(item('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>', 'Xem trước', '#374151', () => openViewModal(formId)));
  if (!active && !pending) {
    menu.appendChild(item('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>', 'Chỉnh sửa', '#374151', () => openEditModal(formId)));
  }
  menu.appendChild(item('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>', 'Tạo bản sao', '#374151', () => duplicateForm(formId)));
    menu.appendChild(item('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>', 'Chia s\u1ebb', '#374151', () => openShareModal(formId)));
  menu.appendChild(divider());
  if (active) {
    menu.appendChild(item('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0"><rect x="6" y="4" width="12" height="16" rx="2"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></svg>', 'Đóng biểu mẫu', '#b45309', () => closeActiveForm(formId)));
  } else if (canDeleteFormsNow()) {
    menu.appendChild(item('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>', 'Xóa biểu mẫu', '#ef4444', () => deleteForm(formId)));
  }

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
  s.textContent = `@keyframes fadeInDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}} @keyframes fadeInUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} .dq-placeholder-gray::placeholder{color:#b0b8c8;opacity:1;}`;
  document.head.appendChild(s);
}

function getFormCoverImage(form) {
  return String(form?.anh_bia || form?.theme?.headerImage || '').trim();
}

function getFormSoftBackground(form, categoryColor) {
  const base = String(form?.mau_nen || form?.theme?.background || '').trim();
  const color = /^#[0-9a-f]{3,8}$/i.test(base) ? base : (categoryColor || '#eef5ff');
  return `linear-gradient(135deg,${color} 0%,#ffffff 78%)`;
}

function getPreviewPlainText(value, fallback = '') {
  const text = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function getFormThumbnailQuestion(form) {
  const localItems = (Array.isArray(form?.questions) && form.questions.length)
    ? form.questions
    : getFormItemsCache(form?.id);
  const firstQuestion = (localItems || []).find(item => !isSectionItem(item) && getPreviewPlainText(item?.text || item?.noi_dung));
  return getPreviewPlainText(form?.questionPreview || firstQuestion?.text || firstQuestion?.noi_dung, '');
}

function getFormThumbnailQuestionCount(form) {
  const localItems = (Array.isArray(form?.questions) && form.questions.length)
    ? form.questions
    : getFormItemsCache(form?.id);
  return Number(form?.so_cau_hoi || 0) || countRealQuestions(localItems || []);
}

function clipPreviewText(value, max = 54) {
  const text = getPreviewPlainText(value);
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trim()}...` : text;
}

function renderFormThumb(form, categoryColor) {
  const coverImage = getFormCoverImage(form);
  const status = `<div style="position:absolute;top:10px;left:10px;z-index:2">${formStatusBadge(form)}</div>`;
  const accent = `<div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:${categoryColor};z-index:2"></div>`;
  const background = getFormSoftBackground(form, categoryColor);
  const title = clipPreviewText(form?.name || 'Biểu mẫu không có tiêu đề', 48);
  const desc = clipPreviewText(form?.mo_ta || form?.desc || '', 58);
  const question = clipPreviewText(getFormThumbnailQuestion(form), 64);
  const questionCount = getFormThumbnailQuestionCount(form);
  const headerBg = coverImage
    ? `background-image:linear-gradient(90deg,rgba(255,255,255,.35),rgba(255,255,255,.1)),url('${coverImage.replace(/'/g, '%27')}');background-size:cover;background-position:center;`
    : `background:linear-gradient(135deg,${categoryColor} 0%,#ffffff 92%);`;
  return `
    <div class="form-card-thumb" style="background:${background};overflow:hidden">
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 18% 22%,rgba(255,255,255,.75),transparent 34%),radial-gradient(circle at 84% 80%,rgba(255,255,255,.55),transparent 32%)"></div>
      ${status}
      <div style="position:absolute;left:48px;right:48px;top:20px;bottom:18px;border-radius:4px;background:#fff;border:1px solid rgba(148,163,184,.55);box-shadow:0 8px 18px rgba(15,23,42,.10);overflow:hidden">
        <div style="height:36px;${headerBg};border-top:3px solid ${categoryColor};border-bottom:1px solid #e2e8f0"></div>
        <div style="padding:7px 10px 0;color:#0f172a;line-height:1.25">
          <div style="font-size:8.5px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">${escapeHtml(title)}</div>
          <div style="font-size:6.8px;font-weight:600;color:#64748b;height:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${desc ? escapeHtml(desc) : '&nbsp;'}</div>
          <div style="height:1px;background:#e2e8f0;margin:5px 0"></div>
          <div style="border-radius:4px;background:#f8fafc;border:1px solid #e2e8f0;padding:5px 6px;min-height:34px">
            <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
              <span style="width:8px;height:8px;border-radius:50%;border:1.5px solid ${categoryColor};display:inline-block;flex-shrink:0"></span>
              <span style="font-size:6.5px;font-weight:800;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${question ? escapeHtml(question) : 'Chưa có câu hỏi'}</span>
            </div>
            <div style="height:5px;width:82%;border-radius:999px;background:#dbeafe;margin-left:12px"></div>
            <div style="height:5px;width:58%;border-radius:999px;background:#e2e8f0;margin:4px 0 0 12px"></div>
          </div>
          <div style="font-size:6.5px;color:#64748b;font-weight:800;margin-top:4px">Tổng ${questionCount} câu hỏi</div>
        </div>
      </div>
      ${accent}
    </div>`;
}

function renderFormListThumb(form, categoryColor) {
  const coverImage = getFormCoverImage(form);
  const background = getFormSoftBackground(form, categoryColor);
  const headerBg = coverImage
    ? `background-image:url('${coverImage.replace(/'/g, '%27')}');background-size:cover;background-position:center;`
    : `background:${categoryColor};opacity:.18`;
  return `
    <div style="width:52px;height:38px;border-radius:6px;flex-shrink:0;background:${background};border:1px solid #dbeafe;position:relative;overflow:hidden">
      <div style="position:absolute;left:13px;right:13px;top:5px;bottom:5px;border-radius:2px;background:#fff;border:1px solid rgba(148,163,184,.45);overflow:hidden">
        <div style="height:9px;${headerBg};border-top:2px solid ${categoryColor}"></div>
        <div style="height:3px;width:58%;background:#94a3b8;margin:4px 4px 3px;border-radius:999px"></div>
        <div style="height:3px;width:76%;background:#e2e8f0;margin:0 4px 3px;border-radius:999px"></div>
        <div style="height:3px;width:68%;background:#e2e8f0;margin:0 4px;border-radius:999px"></div>
      </div>
    </div>`;
}

function renderGrid(list) {
  const source = sortFormsForManagement(Array.isArray(list) ? list : []);
  const totalItems = source.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = source.slice(startIndex, startIndex + PAGE_SIZE);
  const visibleFrom = totalItems ? startIndex + 1 : 0;
  const visibleTo = totalItems ? startIndex + pageItems.length : 0;

  document.getElementById('forms-count').innerHTML = totalItems
    ? `Hiển thị <strong style="color:var(--gray-800)">${visibleFrom}-${visibleTo}</strong> trong tổng số <strong style="color:var(--gray-800)">${totalItems}</strong> biểu mẫu`
    : `Không có biểu mẫu phù hợp`;
  renderFormsPagination(totalItems, totalPages);

  const dotsBtn = (id) => `<button
    onclick="event.stopPropagation();showFormMenu(this,'${id}')"
    style="width:30px;height:30px;border-radius:6px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#94a3b8;flex-shrink:0;transition:all .15s"
    onmouseenter="this.style.background='#f1f5f9';this.style.color='#475569'"
    onmouseleave="this.style.background='transparent';this.style.color='#94a3b8'"
    title="Tùy chọn">
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
  </button>`;

  if (viewMode === 'grid') {
    document.getElementById('grid-view').innerHTML = pageItems.length ? pageItems.map(f=>{
      const categoryColor = getFormCategoryColor(f.cat || f.danh_muc);
      return `
      <div class="form-card" onclick="openViewModal('${f.id}')" title="Xem câu hỏi">
        ${renderFormThumb(f, categoryColor)}
        <div class="form-card-body">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${categoryColor};flex-shrink:0;display:inline-block"></span>
            <span class="badge" style="font-size:11px;padding:2px 7px;background:var(--gray-100);color:var(--gray-600)">${f.cat}</span>
          </div>
          <div class="form-card-name">${formatRichText(f.name)}</div>
          <div class="form-card-meta" style="margin-top:8px">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${f.created}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--gray-100);margin-top:10px">
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:24px;height:24px;border-radius:50%;background:${categoryColor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">${f.initials}</div>
              <span style="font-size:12px;color:var(--gray-600)">${f.by}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px">
             
<button onclick="toggleFav('${f.id}',event)" style="background:none;border:none;cursor:pointer;padding:4px;font-size:16px;line-height:1;transition:transform .15s" title="Yêu thích" onmouseenter="this.style.transform='scale(1.2)'" onmouseleave="this.style.transform='scale(1)'">${favorites.has(String(f.id))?'❤️':'🤍'}</button>
              ${dotsBtn(f.id)}
            </div>
          </div>
        </div>
      </div>`;
    }).join('') : `<div style="grid-column:1/-1;border:1.5px dashed var(--gray-200);border-radius:14px;padding:32px;text-align:center;color:var(--gray-400);font-weight:700;background:#fff">Không có biểu mẫu nào để hiển thị.</div>`;
    document.getElementById('list-view').style.display = 'none';
    document.getElementById('grid-view').style.display = '';
  } else {
    document.getElementById('list-view').innerHTML = pageItems.length ? pageItems.map(f=>{
      const categoryColor = getFormCategoryColor(f.cat || f.danh_muc);
      return `
      <div style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--gray-100);transition:background .12s;cursor:pointer" onclick="openViewModal('${f.id}')" title="Xem câu hỏi" onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background=''">
        <div style="width:4px;height:40px;border-radius:2px;background:${categoryColor};flex-shrink:0"></div>
        ${renderFormListThumb(f, categoryColor)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13.5px;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px">${formatRichText(f.name)}</div>
          <div style="font-size:12px;color:var(--gray-500)">${f.cat}</div>
        </div>
        ${formStatusBadge(f)}
        <div style="display:flex;gap:20px;font-size:12.5px;color:var(--gray-500);min-width:100px">
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:middle;margin-right:3px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${f.created}</span>
        </div>
        <button onclick="toggleFav('${f.id}',event)" style="background:none;border:none;cursor:pointer;padding:4px;font-size:18px;line-height:1;flex-shrink:0" title="Yêu thích">${favorites.has(String(f.id))?'❤️':'🤍'}</button>
        ${dotsBtn(f.id)}
      </div>`;
    }).join('') : `<div style="padding:32px;text-align:center;color:var(--gray-400);font-weight:700">Không có biểu mẫu nào để hiển thị.</div>`;
    document.getElementById('grid-view').style.display = 'none';
    document.getElementById('list-view').style.display = 'block';
  }
}

function renderFormsPagination(totalItems, totalPages) {
  const pagination = document.getElementById('forms-pagination');
  const info = document.getElementById('forms-page-info');
  const buttons = document.getElementById('forms-page-buttons');
  if (!pagination || !info || !buttons) return;

  pagination.style.display = totalItems > PAGE_SIZE ? 'flex' : 'none';
  info.textContent = `Trang ${currentPage} / ${totalPages}`;
  if (totalItems <= PAGE_SIZE) {
    buttons.innerHTML = '';
    return;
  }

  const pages = [];
  for (let page = 1; page <= totalPages; page++) {
    if (
      page === 1 ||
      page === totalPages ||
      Math.abs(page - currentPage) <= 1
    ) {
      pages.push(page);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  buttons.innerHTML = `
    <button class="pag-btn" onclick="goToFormsPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Trước</button>
    ${pages.map(page => page === '...'
      ? `<span style="padding:5px 4px;color:var(--gray-400);font-weight:700">...</span>`
      : `<button class="pag-btn ${page === currentPage ? 'active' : ''}" onclick="goToFormsPage(${page})">${page}</button>`
    ).join('')}
    <button class="pag-btn" onclick="goToFormsPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Sau</button>
  `;
}

function goToFormsPage(page) {
  const totalPages = Math.max(1, Math.ceil((filtered || []).length / PAGE_SIZE));
  const nextPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  if (nextPage === currentPage) return;
  currentPage = nextPage;
  renderGrid(filtered);
  document.getElementById('forms-count')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setView(v) {
  viewMode = v;
  const gb = document.getElementById('btn-grid');
  const lb = document.getElementById('btn-list');
  if(gb) gb.classList.toggle('active', v==='grid');
  if(lb) lb.classList.toggle('active', v==='list');
  renderGrid(filtered);
}

function parseFormCreatedDate(form) {
  if (form.createdRaw) {
    const raw = new Date(form.createdRaw);
    if (!Number.isNaN(raw.getTime())) {
      raw.setHours(0, 0, 0, 0);
      return raw;
    }
  }
  const parts = String(form.created || '').split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function parseFilterDate(value, endOfDay = false) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return parsed;
}

function todayInputValue() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateForDisplay(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  const iso = normalizeDateToInputValue(value);
  return iso ? formatISOToDDMMYYYY(iso) : String(value || '');
}

function isPastInputDate(value) {
  if (!value) return false;
  return value < todayInputValue();
}

function formatISOToDDMMYYYY(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateTimeLocalForDisplay(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function parseDDMMYYYYToISO(str) {
  if (!str) return '';
  const parts = String(str || '').trim().split(/[\/\-\.]/).map(s => s.trim());
  if (parts.length !== 3) return '';
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy) return '';
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function syncHiddenToDisplay(iso) {
  const display = document.getElementById('new-form-close-display');
  if (!display) return;
  display.value = formatISOToDDMMYYYY(iso);
}

function setCreateNoCloseState(checked) {
  const hidden = document.getElementById('new-form-close');
  const display = document.getElementById('new-form-close-display');
  if (hidden) hidden.disabled = checked;
  if (display) {
    display.disabled = checked;
    display.style.opacity = checked ? '0.35' : '1';
  }
}

function syncDisplayToHidden(str) {
  const hidden = document.getElementById('new-form-close');
  const raw = String(str || '').trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : parseDDMMYYYYToISO(raw);
  if (hidden) hidden.value = iso || '';
  return iso || '';
}

function syncDisplayDateToHidden(value) {
  const hidden = document.getElementById('new-form-close');
  const display = document.getElementById('new-form-close-display');
  const iso = String(value || '').trim();
  if (hidden) hidden.value = iso;
  if (iso && isPastInputDate(iso)) {
    showToast('Không được chọn ngày đóng trong quá khứ', 'error');
    if (hidden) hidden.value = '';
    if (display) display.value = '';
  }
}

function openCloseDatePicker() {
  const hidden = document.getElementById('new-form-close');
  const display = document.getElementById('new-form-close-display');
  const noClose = document.getElementById('new-form-no-close');
  if (!hidden || hidden.disabled || noClose?.checked) return;
  hidden.min = todayInputValue();
  if (display?.value && !hidden.value) hidden.value = parseDDMMYYYYToISO(display.value) || '';
  if (typeof hidden.showPicker === 'function') hidden.showPicker();
  else {
    hidden.focus();
    hidden.click();
  }
}

function normalizeDateToInputValue(value) {
  if (!value) return '';
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsedVi = parseDDMMYYYYToISO(raw);
  if (parsedVi) return parsedVi;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function syncEditCloseToDisplay(iso) {
  const display = document.getElementById('edit-form-close-display');
  if (display) display.value = formatISOToDDMMYYYY(iso);
}

function setEditNoCloseState(checked) {
  const hidden = document.getElementById('edit-form-close');
  const display = document.getElementById('edit-form-close-display');
  if (hidden) hidden.disabled = checked;
  if (display) {
    display.disabled = checked;
    display.style.opacity = checked ? '0.35' : '1';
    if (checked) display.value = '';
  }
  if (checked && hidden) hidden.value = '';
}

function openEditCloseDatePicker() {
  const hidden = document.getElementById('edit-form-close');
  const noClose = document.getElementById('edit-form-no-close');
  if (!hidden || hidden.disabled || noClose?.checked) return;
  hidden.min = todayInputValue();
  if (typeof hidden.showPicker === 'function') hidden.showPicker();
  else {
    hidden.focus();
    hidden.click();
  }
}

function syncFilterDateDisplay(inputId) {
  const hidden = document.getElementById(inputId);
  const display = document.getElementById(inputId + '-display');
  if (display) display.value = formatISOToDDMMYYYY(hidden?.value || '');
}

function openFilterDatePicker(inputId) {
  const hidden = document.getElementById(inputId);
  const display = document.getElementById(inputId + '-display');
  if (!hidden) return;
  if (display?.value && !hidden.value) hidden.value = parseDDMMYYYYToISO(display.value) || '';
  if (typeof hidden.showPicker === 'function') hidden.showPicker();
  else {
    hidden.focus();
    hidden.click();
  }
}

function validateDisplayDate(str) {
  const iso = syncDisplayToHidden(str);
  const disp = document.getElementById('new-form-close-display');
  if (!iso && str) {
    showToast('Ngày không hợp lệ. Vui lòng nhập theo định dạng dd/mm/yyyy', 'error');
    if (disp) disp.value = '';
    return;
  }
  if (iso && isPastInputDate(iso)) {
    showToast('Không được chọn ngày đóng trong quá khứ', 'error');
    if (disp) disp.value = '';
    document.getElementById('new-form-close').value = '';
    return;
  }
}

function filterForms() {
  const q = (document.getElementById('search-inp')?.value || '').trim().toLowerCase();
  const status = document.getElementById('status-filter')?.value || '';
  const category = document.getElementById('cat-filter')?.value || '';
  const fromDate = parseFilterDate(document.getElementById('filter-from')?.value || '');
  const toDate = parseFilterDate(document.getElementById('filter-to')?.value || '', true);

  filtered = sortFormsForManagement(FORMS.filter(f => {
    const matchesKeyword = !q || String(f.name || '').toLowerCase().includes(q);
    const matchesStatus = !status || String(f.status || 'draft').toLowerCase() === status;
    const matchesCategory = !category || String(f.cat || f.danh_muc || '').trim() === category;
    const createdDate = parseFormCreatedDate(f);
    const matchesFrom = !fromDate || (createdDate && createdDate >= fromDate);
    const matchesTo = !toDate || (createdDate && createdDate <= toDate);
    return matchesKeyword && matchesStatus && matchesCategory && matchesFrom && matchesTo;
  }));
  currentPage = 1;
  renderGrid(filtered);
}
function applyFilter() { filterForms(); }
function resetFilter() {
  const search = document.getElementById('search-inp');
  const status = document.getElementById('status-filter');
  const category = document.getElementById('cat-filter');
  const from = document.getElementById('filter-from');
  const to = document.getElementById('filter-to');
  const fromDisplay = document.getElementById('filter-from-display');
  const toDisplay = document.getElementById('filter-to-display');
  if (search) search.value = '';
  if (status) status.value = '';
  if (category) category.value = '';
  if (from) from.value = '';
  if (to) to.value = '';
  if (fromDisplay) fromDisplay.value = '';
  if (toDisplay) toDisplay.value = '';
  filtered = sortFormsForManagement(FORMS);
  currentPage = 1;
  renderGrid(filtered);
}

async function closeActiveForm(id) {
  const f = FORMS.find(f => String(f.id) === String(id));
  if (!f) return;
  if (!isActiveForm(f)) {
    showToast('Chỉ biểu mẫu đang hoạt động mới cần đóng.', 'default');
    return;
  }
  const ok = await showConfirmDialog({
    title: 'Đóng biểu mẫu?',
    message: `Biểu mẫu <strong>${escapeHtml(f.name || 'Biểu mẫu không có tiêu đề')}</strong> sẽ ngừng thu thập phản hồi.`,
    note: 'Bạn vẫn có thể xem dữ liệu và mở lại biểu mẫu sau.',
    confirmText: 'Đóng biểu mẫu',
    cancelText: 'Hủy',
    variant: 'warning',
  });
  if (!ok) return;

  try {
    await updateFormStatusOnly(Number(id), 'closed');
  } catch (e) {
    showToast(e.message || 'Không thể đóng biểu mẫu. Vui lòng thử lại.', 'error');
    return;
  }

  f.status = 'closed';
  filtered = filtered.map(item => String(item.id) === String(id) ? { ...item, status: 'closed' } : item);
  FORMS = FORMS.map(item => String(item.id) === String(id) ? { ...item, status: 'closed' } : item);
  renderGrid(filtered);
  showToast(`Đã đóng biểu mẫu "${f.name}"`, 'success');
}

async function deleteForm(id) {
  const f = FORMS.find(f => String(f.id) === String(id));
  if (!f) return;
  if (isActiveForm(f)) {
    showToast('Biểu mẫu đang hoạt động, vui lòng đóng biểu mẫu trước khi xóa.', 'error');
    return;
  }
  const ok = await showConfirmDialog({
    title: 'Chuyển vào thùng rác?',
    message: `Chuyển biểu mẫu <strong>${escapeHtml(f.name || 'Biểu mẫu không có tiêu đề')}</strong> vào thùng rác.`,
    note: 'Biểu mẫu sẽ tự động xóa vĩnh viễn sau 30 ngày.',
    confirmText: 'Chuyển vào thùng rác',
    cancelText: 'Hủy',
    variant: 'danger',
  });
  if (!ok) return;

  // Ẩn card ngay lập tức
  const card = document.querySelector(`[onclick*="openViewModal('${id}')"], [onclick*='openViewModal("${id}")']`);
  if (card) card.style.display = 'none';

  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/forms/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      let detail = '';
      try {
        const data = await res.json();
        detail = data.message || data.error || '';
      } catch (_) {
        detail = await res.text().catch(() => '');
      }
      throw new Error(detail || `Không thể chuyển biểu mẫu vào thùng rác (HTTP ${res.status})`);
    }
  } catch(e) {
    if (card) card.style.display = '';
    showToast(e.message || 'Không thể chuyển biểu mẫu vào thùng rác. Vui lòng thử lại.', 'error');
    return;
  }

  try {
    moveToTrash(f);
  } catch (e) {
    console.warn('Không thể lưu bản ghi thùng rác local:', e);
  }
  hideApprovalForm(f);
  removeApprovalsByForm(f);
  FORMS.splice(FORMS.findIndex(f => f.id === id), 1);
  filtered = filtered.filter(f => f.id !== id);
  renderGrid(filtered);
  setTimeout(() => showToast(`Đã chuyển "${f.name}" vào thùng rác`, 'success'), 0);
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
        doi_tuong: normalizeSurveyTarget(f.doi_tuong || 'Tất cả'),
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
    filtered = sortFormsForManagement(FORMS);
    currentPage = 1;
    renderGrid(filtered);
  } catch (e) {}

  showToast(`Đã tạo bản sao "${copyName}"`, 'success');
}

// --- EDIT FORM STATE ---
let editFormQuestions = []; // mảng câu hỏi đang edit, mỗi phần tử: {id, text, type, opts, required}

function mapFormItemsToEditItems(items) {
  return normalizeLocalItemsForPreview(items || []).map((q, i) => {
    const imageUrl = getQuestionImageUrl(q);
    const videoUrl = getQuestionVideoUrl(q);
    if (isSectionItem(q)) {
      return {
        id: q.client_id || q.id || ('sec-' + i),
        dbSectionId: q.section_id || q.id || null,
        _isSection: true,
        type: 'section',
        title: q.title || q.noi_dung || '',
        desc: q.desc || q.description || q.mo_ta_cau_hoi || '',
      };
    }
    return {
      id: q.id || ('eq-' + i),
      text: q.text || q.noi_dung || '',
      type: normalizeQuestionType(q.type || q.loai || 'choice'),
      opts: q.opts && q.opts.length ? [...q.opts] : (q.lua_chon ? q.lua_chon.map(o => o.noi_dung || o) : []),
      rows: getGridRows(q),
      cols: getGridCols(q),
      scale: getQuestionScaleConfig(q),
      rating: getQuestionRatingConfig(q),
      validation_json: q.validation_json || q.validation || q.logic_json || '',
      image_align: q.image_align || parseJsonObject(q.validation_json || q.validation || q.logic_json || '{}').image_align || 'left',
      image_width: q.image_width || parseJsonObject(q.validation_json || q.validation || q.logic_json || '{}').image_width || '',
      image: imageUrl,
      hinh_anh_url: imageUrl,
      video: videoUrl,
      video_url: videoUrl,
      required: q.required || q.bat_buoc || false,
      allowOther: questionAllowsOther(q),
      allow_other: questionAllowsOther(q),
    };
  });
}

function openEditModal(id) {
  const f = FORMS.find(f => f.id === id);
  if (!f) return;
  if (isActiveForm(f)) {
    showToast('Biểu mẫu đang hoạt động nên không thể chỉnh sửa. Bạn có thể đóng biểu mẫu trước thời hạn nếu cần.', 'warning');
    return;
  }
  document.getElementById('edit-form-id').value = f.id;
  setRichTextFieldValue('edit-form-name', f.name);
  setRichTextFieldValue('edit-form-desc', f.mo_ta || f.desc || '');
  document.getElementById('edit-form-cat').value = f.cat;
  syncEditSurveyTypes(f.loai_khao_sat || '');
  const editTarget = document.getElementById('edit-form-target');
  if (editTarget) editTarget.value = normalizeSurveyTarget(f.doi_tuong || 'Tất cả');
  const editCloseValue = normalizeDateToInputValue(f.ngay_dong || f.closeDate || '');
  const editCloseInput = document.getElementById('edit-form-close');
  const editCloseDisplay = document.getElementById('edit-form-close-display');
  const editNoClose = document.getElementById('edit-form-no-close');
  if (editCloseInput) {
    editCloseInput.min = todayInputValue();
    editCloseInput.value = editCloseValue;
  }
  if (editCloseDisplay) editCloseDisplay.value = formatISOToDDMMYYYY(editCloseValue);
  if (editNoClose) editNoClose.checked = !editCloseValue;
  setEditNoCloseState(!editCloseValue);
  const localLoiKet = f.loi_ket || '';
  setRichTextFieldValue('edit-form-loi-ket', localLoiKet);
  const editLibraryPanel = document.getElementById('edit-library-panel');
  if (editLibraryPanel) editLibraryPanel.style.display = 'none';
  const editLibSearch = document.getElementById('edit-lib-search');
  if (editLibSearch) editLibSearch.value = '';
  const editLibCat = document.getElementById('edit-lib-cat-filter');
  if (editLibCat) editLibCat.value = f.cat || 'Ngoại ngữ';
  renderEditLibraryList();

  // Load câu hỏi từ local/cache trước để modal hiện ngay, rồi đồng bộ API phía dưới.
  const localSourceItems = (Array.isArray(f.questions) && f.questions.length) ? f.questions : getFormItemsCache(id);
  const localEditItems = mergeQuestionMediaCache(id, localSourceItems);
  editFormQuestions = mapFormItemsToEditItems(localEditItems);

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
      setRichTextFieldValue('edit-form-desc', data.mo_ta || '');
      if (data.danh_muc) {
        const catInput = document.getElementById('edit-form-cat');
        if (catInput) catInput.value = normalizeLibraryCategory(data.danh_muc);
      }
      syncEditSurveyTypes(data.loai_khao_sat || f.loai_khao_sat || '');
      // Cập nhật câu hỏi
      if ((Array.isArray(data.form_items) && data.form_items.length) || (data.cau_hoi && data.cau_hoi.length)) {
        const fallbackItems = localSourceItems.length ? localSourceItems : getFormItemsCache(id);
        const apiItems = mergeQuestionLocalFallback(
          mergeQuestionMediaCache(id, Array.isArray(data.form_items) && data.form_items.length ? data.form_items : data.cau_hoi),
          fallbackItems
        );
        editFormQuestions = mapFormItemsToEditItems(apiItems);
        renderEditQuestions();
      }
      // Cập nhật lời kết và luôn set từ API; local FORMS không có
      const loiKet = data.loi_ket || '';
      setRichTextFieldValue('edit-form-loi-ket', loiKet);
    }).catch(() => {});
}

const EDIT_TYPE_LABELS = TYPE_LABEL_MAP;

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
    const questionNo = getQuestionNumberInSection(editFormQuestions, qi);
    const sectionNo = getSectionNumber(editFormQuestions, qi);
    // Render section card (giống Tạo biểu mẫu mới)
    if (q._isSection) {
      return `
    <div style="border:2px dashed #fbbf24;border-radius:12px;background:#fffbeb;padding:0;display:flex;margin-bottom:10px">
      <div style="flex:1;min-width:0;padding:12px 14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" width="14" height="14"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          <span style="font-size:10.5px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.5px">Phần ${sectionNo}</span>
        </div>
        <div id="edit-section-title-${qi}-wrap" onfocusout="handleFieldToolbarFocusOut(event, 'edit-section-title-${qi}')">
          <div id="edit-section-title-${qi}" class="rich-title-editor" contenteditable="true" role="textbox" aria-label="Tiêu đề phần"
            data-edit-section-index="${qi}" data-edit-section-field="title"
            data-placeholder="Tiêu đề phần..."
            style="width:100%;min-height:34px;padding:6px 10px;border:1.5px solid #fde68a;border-radius:8px;font-size:14px;font-weight:700;font-family:inherit;outline:none;background:#fff;color:#92400e;transition:border .15s;box-sizing:border-box;white-space:pre-wrap;word-break:break-word"
            onfocus="this.style.borderColor='#f59e0b';showFieldToolbar('edit-section-title-${qi}')"
            onblur="this.style.borderColor='#fde68a';syncRichTextFieldFromEditor('edit-section-title-${qi}')"
            oninput="syncRichTextFieldFromEditor('edit-section-title-${qi}')"
            onkeydown="handleRichFieldKeydown(event, 'edit-section-title-${qi}')"
            onclick="handleRichFieldClick(event, 'edit-section-title-${qi}')"
            onpaste="pastePlainTextIntoRichField(event, 'edit-section-title-${qi}')">${formatRichTextForEditor(q.title || '')}</div>
          ${renderTextFormatToolbar(`edit-section-title-${qi}`, { hidden: true })}
        </div>
        <div id="edit-section-desc-${qi}-wrap" onfocusout="handleFieldToolbarFocusOut(event, 'edit-section-desc-${qi}')" style="margin-top:6px">
          <div id="edit-section-desc-${qi}" class="rich-title-editor" contenteditable="true" role="textbox" aria-label="Mô tả phần"
            data-edit-section-index="${qi}" data-edit-section-field="desc"
            data-placeholder="Mô tả phần (tùy chọn)..."
            style="width:100%;min-height:32px;padding:5px 10px;border:1px solid #fde68a;border-radius:7px;font-size:12.5px;font-family:inherit;outline:none;background:#fff;color:#78350f;transition:border .15s;box-sizing:border-box;white-space:pre-wrap;word-break:break-word"
            onfocus="this.style.borderColor='#f59e0b';showFieldToolbar('edit-section-desc-${qi}')"
            onblur="this.style.borderColor='#fde68a';syncRichTextFieldFromEditor('edit-section-desc-${qi}')"
            oninput="syncRichTextFieldFromEditor('edit-section-desc-${qi}')"
            onkeydown="handleRichFieldKeydown(event, 'edit-section-desc-${qi}')"
            onclick="handleRichFieldClick(event, 'edit-section-desc-${qi}')"
            onpaste="pastePlainTextIntoRichField(event, 'edit-section-desc-${qi}')">${formatRichTextForEditor(q.desc || '')}</div>
          ${renderTextFormatToolbar(`edit-section-desc-${qi}`, { hidden: true })}
        </div>
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
          onmouseenter="this.style.color='#00008B';this.style.background='#00008B'"
          onmouseleave="this.style.color:#94a3b8;this.style.background='none'">
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
    const needsOpts = ['choice','checkbox','dropdown','rating','scale'].includes(normalizedType);
    const needsGrid = ['grid_radio','grid_checkbox'].includes(normalizedType);
    const opts = q.opts || [];
    const rows = q.rows || [];
    const cols = q.cols || [];
    const typeColor = DQ_TYPE_COLOR[q.type] || DQ_TYPE_COLOR[normalizedType] || '#374151';
    if (q._collapsed) {
      const summaryOpts = needsGrid
        ? `${rows.filter(Boolean).length} hàng × ${cols.filter(Boolean).length} cột`
        : normalizedType === 'scale'
        ? `${getQuestionScaleConfig(q).start} đến ${getQuestionScaleConfig(q).end}`
        : normalizedType === 'rating'
        ? `${getQuestionRatingConfig(q).count} sao`
        : needsOpts
        ? `${opts.filter(Boolean).length} lựa chọn`
        : 'Câu trả lời văn bản';
      return `
    <div onclick="editQExpand(${qi})" title="Bấm để mở câu hỏi" style="border:1.5px solid #00008B;border-left:5px solid #00008B;border-radius:14px;background:linear-gradient(180deg,#ffffff 0%,#00008B 100%);box-shadow:0 10px 24px rgba(15,23,42,.05);display:flex;align-items:center;gap:12px;margin:0 0 10px 0;padding:12px 14px;cursor:pointer">
      <div style="width:26px;height:26px;border-radius:50%;background:#00008B;color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${isPresentationItem(q) ? '' : questionNo}</div>
      <div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${formatRichText(q.text || 'Chưa có nội dung câu hỏi', q.required)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px">
            <span style="padding:3px 9px;border-radius:999px;background:#dcfce7;color:#15803d;font-size:11.5px;font-weight:800">Đã lưu</span>
            <span style="font-size:12px;color:#64748b">${summaryOpts}</span>
          </div>
        </div>
        <div style="flex-shrink:0">
          <span style="padding:3px 9px;border-radius:999px;background:#00008B;color:#fff;font-size:11.5px;font-weight:700;white-space:nowrap">${getTypeOptionLabel(q.type)}</span>
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
      <!-- Drag handle 6 chợm -->
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
        <div id="edit-q-text-${qi}-wrap" onfocusout="handleFieldToolbarFocusOut(event, 'edit-q-text-${qi}')">
        <!-- Row: số + input câu hỏi + dropdown loại -->
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:22px;height:22px;border-radius:50%;background:#00008B;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${isPresentationItem(q) ? '' : questionNo}</div>
          <div id="edit-q-text-${qi}" class="dq-placeholder-gray rich-title-editor" contenteditable="true" role="textbox" aria-label="Nội dung câu hỏi"
            data-edit-question-index="${qi}"
            data-placeholder="Nhập nội dung câu hỏi..."
            style="flex:1;width:100%;min-height:35px;padding:7px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;line-height:1.45;outline:none;background:#fafbff;transition:border .15s;min-width:0;white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text"
            onfocus="this.style.borderColor='#00008B';showFieldToolbar('edit-q-text-${qi}')"
            onblur="this.style.borderColor='#e2e8f0';syncRichTextFieldFromEditor('edit-q-text-${qi}')"
            oninput="syncRichTextFieldFromEditor('edit-q-text-${qi}')"
            onkeydown="handleRichFieldKeydown(event, 'edit-q-text-${qi}')"
            onclick="handleRichFieldClick(event, 'edit-q-text-${qi}')"
            onpaste="pastePlainTextIntoRichField(event, 'edit-q-text-${qi}')">${formatRichTextForEditor(q.text || '')}</div>
          ${renderQuestionTypeDropdown(q.type, 'edit', qi)}
        </div>
        <div style="margin-left:30px">
          ${renderQuestionFormatToolbar(`edit-q-text-${qi}`, { hidden: true })}
        </div>
        </div>

        ${getQuestionImageUrl(q) ? (() => {
          const align = q.image_align || parseJsonObject(q.validation_json || q.validation || q.logic_json).image_align || 'left';
          const width = q.image_width || parseJsonObject(q.validation_json || q.validation || q.logic_json).image_width || 'auto';
          return `
        <div style="margin-top:8px;padding-left:30px;position:relative;display:flex;justify-content:${align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'}">
          <div style="position:relative;display:inline-block"
               onmouseenter="this.querySelector('.resize-overlay').style.display='block'"
               onmouseleave="this.querySelector('.resize-overlay').style.display='none'">
            <img id="dq-img-${q.id}" src="${previewEsc(getQuestionImageUrl(q))}" style="width:${width};max-width:100%;max-height:400px;border-radius:8px;object-fit:contain;border:1px solid #e2e8f0;background:#f8fafc">
            <div class="resize-overlay" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;border:2px solid #3b82f6;pointer-events:none;z-index:40">
              <div style="position:absolute;top:-5px;left:-5px;width:10px;height:10px;background:#fff;border:1px solid #3b82f6;pointer-events:auto;cursor:nwse-resize" onmousedown="startImageResize(event, '${q.id}', 'nw')"></div>
              <div style="position:absolute;top:-5px;right:-5px;width:10px;height:10px;background:#fff;border:1px solid #3b82f6;pointer-events:auto;cursor:nesw-resize" onmousedown="startImageResize(event, '${q.id}', 'ne')"></div>
              <div style="position:absolute;bottom:-5px;left:-5px;width:10px;height:10px;background:#fff;border:1px solid #3b82f6;pointer-events:auto;cursor:nesw-resize" onmousedown="startImageResize(event, '${q.id}', 'sw')"></div>
              <div style="position:absolute;bottom:-5px;right:-5px;width:10px;height:10px;background:#fff;border:1px solid #3b82f6;pointer-events:auto;cursor:nwse-resize" onmousedown="startImageResize(event, '${q.id}', 'se')"></div>
            </div>
            <button onclick="(function(){var eq=editFormQuestions[${qi}];if(eq){delete eq.image;delete eq.hinh_anh_url;delete eq.image_url;renderEditQuestions();}})()" title="Xóa hình"
              style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;cursor:pointer;color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;line-height:1;z-index:50">×</button>
          </div>
        </div>`;
        })() : ''}

        ${getQuestionVideoUrl(q) ? `
        <div style="margin-top:8px;padding-left:30px;position:relative">
          ${isNativeVideoUrl(getQuestionVideoUrl(q)) ? `
          <video src="${previewEsc(getQuestionVideoUrl(q))}" controls style="display:block;width:100%;max-height:190px;border-radius:8px;border:1px solid #e9d5ff;background:#0f172a"></video>` : `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f5f3ff;border-radius:8px;border:1px solid #e9d5ff">
            <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" width="16" height="16"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            <a href="${previewEsc(getQuestionVideoUrl(q))}" target="_blank" style="font-size:12px;color:#7c3aed;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${previewEsc(getQuestionVideoUrl(q))}</a>
          </div>`}
          <button onclick="(function(){var q=editFormQuestions[${qi}];if(q){delete q.video;delete q.video_url;renderEditQuestions();}})()" title="Xóa video"
            style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;cursor:pointer;color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;line-height:1">×</button>
        </div>` : ''}

        ${needsOpts ? `
        <div style="padding-left:30px;margin-top:10px">
          ${normalizedType==='rating' ? `
          ${renderRatingConfigEditor(q, 'edit', qi)}
          ` : normalizedType==='scale' ? `
          ${renderScaleConfigEditor(q, 'edit', qi)}
          ` : `
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Các lựa chọn</div>
          ${opts.map((o,oi)=>{
            const optIcon=normalizedType==='checkbox'
              ?`<span style="width:15px;height:15px;border-radius:3px;border:2px solid #94a3b8;flex-shrink:0;display:inline-block;background:#fff"></span>`
              :normalizedType==='dropdown'
              ?`<span style="font-size:11px;color:#94a3b8;font-weight:700;min-width:18px;text-align:center">${oi+1}</span>`
              :`<span style="width:15px;height:15px;border-radius:50%;border:2px solid #94a3b8;flex-shrink:0;display:inline-block;background:#fff"></span>`;
            const eqOptDragHandle = '<span style="cursor:grab;color:#d1d5db;display:flex;align-items:center;flex-shrink:0;padding:0 2px" title="Kéo để đổi vị trí"><svg viewBox="0 0 8 12" width="8" height="12" fill="currentColor"><circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/><circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/><circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/></svg></span>';
            const eqOptRemoveBtn = opts.length > 1 ? `<button onclick="editQRemoveOpt(${qi},${oi})" title="Xóa lựa chọn" style="width:20px;height:20px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;transition:all .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">X</button>` : '';
            let vj = {}; try { vj = typeof q.validation_json === 'string' ? JSON.parse(q.validation_json) : q.validation_json; } catch(e){}
            const optImgUrl = vj && vj.option_images && vj.option_images[oi] ? vj.option_images[oi] : null;
            const imgBtn = `<button onclick="editQChangeOptImage(${qi}, ${oi})" title="Thêm hình ảnh" style="width:20px;height:20px;background:none;border:none;cursor:pointer;color:#94a3b8;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='#94a3b8'"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></button>`;
            const imgPreview = optImgUrl ? `<div style="margin-top:6px;margin-left:27px;position:relative;display:inline-block"><img src="${optImgUrl}" style="height:60px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;"><button onclick="editQRemoveOptImage(${qi}, ${oi})" title="Xóa ảnh" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#ef4444;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;box-shadow:0 1px 3px rgba(0,0,0,0.2);">X</button></div>` : '';
            return `<div draggable="true" ondragstart="eqOptDragStart(event,${qi},${oi})" ondragover="eqOptDragOver(event,${qi},${oi})" ondrop="eqOptDrop(event,${qi},${oi})" ondragend="eqOptDragEnd()" style="margin-bottom:6px;transition:opacity .15s"><div style="display:flex;align-items:center;gap:6px;">${eqOptDragHandle}${optIcon}<input type="text" value="${o.replace(/"/g,'&quot;')}" placeholder="Lựa chọn ${oi+1}" style="flex:1;padding:6px 10px;border:1px solid #e2e8f0;border-radius:7px;font-size:12.5px;background:#fff;outline:none;transition:border .15s" onfocus="this.style.borderColor=this.dataset.duplicate==='1'?'#ef4444':'#00008B'" onblur="updateEditOptionDuplicateState(this,${qi},${oi},true);if(this.dataset.duplicate!=='1')this.style.borderColor='#e2e8f0'" oninput="editQSetOpt(${qi},${oi},this.value);updateEditOptionDuplicateState(this,${qi},${oi},false)">${imgBtn}${eqOptRemoveBtn}</div>${imgPreview}</div>`;
          }).join('')}
          <button onclick="editQAddOpt(${qi})"
            style="padding:5px 14px;background:transparent;border:1.5px dashed #00008B;border-radius:7px;cursor:pointer;color:#00008B;font-size:12px;font-weight:600;transition:all .15s;margin-top:2px"
            onmouseenter="this.style.background='#00008B';this.style.borderColor='#fff'"
            onmouseleave="this.style.background='transparent';this.style.borderColor='#00008B'">+ Thêm lựa chọn</button>
          ${renderOtherOptionEditor(q, normalizedType, 'edit', qi)}
          `}
        </div>` : ''}

        ${!needsOpts && !needsGrid ? renderTextAnswerBuilder(normalizedType) : ''}

        ${needsGrid ? `
        <div style="padding-left:30px;margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Hàng (tùy chọn)</div>
            ${rows.map((r,ri)=>`<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
              <span style="width:14px;height:14px;border-radius:${normalizedType==='grid_radio'?'50%':'3px'};border:1.5px solid #c4b5fd;flex-shrink:0;display:inline-block;background:#fff"></span>
              <input type="text" value="${r.replace(/"/g,'&quot;')}" placeholder="Hàng ${ri+1}"
                style="flex:1;padding:5px 9px;border:1px solid #e2e8f0;border-radius:7px;font-size:12px;background:#fff;outline:none;transition:border .15s"
                onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e2e8f0'"
                oninput="editQSetRow(${qi},${ri},this.value)">
              ${rows.length>1?`<button onclick="editQRemoveRow(${qi},${ri})" style="width:20px;height:20px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;line-height:1;flex-shrink:0;transition:color .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>`:''}
            </div>`).join('')}
            <button onclick="editQAddRow(${qi})" style="padding:4px 10px;background:transparent;border:1.5px dashed #c4b5fd;border-radius:7px;cursor:pointer;color:#7c3aed;font-size:11.5px;font-weight:600;transition:all .15s;margin-top:2px" onmouseenter="this.style.background='#f5f3ff'" onmouseleave="this.style.background='transparent'">+ Thêm hàng</button>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#00008B;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Cột (lựa chọn)</div>
            ${cols.map((c,ci)=>`<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
              <span style="width:14px;height:14px;border-radius:${normalizedType==='grid_radio'?'50%':'3px'};border:1.5px solid #00008B;flex-shrink:0;display:inline-block;background:#fff"></span>
              <input type="text" value="${c.replace(/"/g,'&quot;')}" placeholder="Cột ${ci+1}"
                style="flex:1;padding:5px 9px;border:1px solid #e2e8f0;border-radius:7px;font-size:12px;background:#fff;outline:none;transition:border .15s"
                onfocus="this.style.borderColor='#00008B'" onblur="this.style.borderColor='#e2e8f0'"
                oninput="editQSetCol(${qi},${ci},this.value)">
              ${cols.length>1?`<button onclick="editQRemoveCol(${qi},${ci})" style="width:20px;height:20px;background:none;border:none;cursor:pointer;color:#cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;line-height:1;flex-shrink:0;transition:color .15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>`:''}
            </div>`).join('')}
            <button onclick="editQAddCol(${qi})" style="padding:4px 10px;background:transparent;border:1.5px dashed #00008B;border-radius:7px;cursor:pointer;color:#00008B;font-size:11.5px;font-weight:600;transition:all .15s;margin-top:2px" onmouseenter="this.style.background='#00008B'" onmouseleave="this.style.background='transparent'">+ Thêm cột</button>
          </div>
        </div>` : ''}

        <!-- Bottom: bắt buộc -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding-top:10px;border-top:1px solid #f1f5f9;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none">
            <div style="position:relative;width:34px;height:18px">
              <input type="checkbox" ${editFormQuestions[qi].required ? 'checked' : ''} onchange="editFormQuestions[qi].required=this.checked;renderEditQuestions()"
                style="opacity:0;width:0;height:0;position:absolute">
              <span style="position:absolute;inset:0;background:${editFormQuestions[qi].required ? '#00008B' : '#cbd5e1'};border-radius:9px;transition:background .2s;cursor:pointer"></span>
              <span style="position:absolute;top:3px;left:${editFormQuestions[qi].required ? '18px' : '3px'};width:12px;height:12px;background:#fff;border-radius:50%;transition:left .2s;pointer-events:none"></span>
            </div>
            <span style="font-size:12px;font-weight:600;color:${editFormQuestions[qi].required ? '#00008B' : '#94a3b8'}">Bắt buộc</span>
          </label>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-left:auto">
            ${renderLibrarySaveButton({ saved: isQuestionSavedInLibrary(editFormQuestions[qi]), onclick: `editQSaveToLibrary(${qi}, this)` })}
            <button onclick="editQRemove(${qi})"
              style="height:34px;padding:0 12px;border:1px solid #fecaca;border-radius:8px;background:#fff;color:#dc2626;font-size:12px;font-weight:800;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap"
              onmouseenter="this.style.background='#fef2f2';this.style.borderColor='#f87171'" onmouseleave="this.style.background='#fff';this.style.borderColor='#fecaca'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Xóa
            </button>
          </div>
        </div>
      </div>

      <!-- Sidebar bên phải -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 6px;border-left:1px solid #f1f5f9;min-width:40px">
        <button onclick="editQAddImage(${qi})" title="Thêm hình ảnh"
          style="width:32px;height:32px;border:none;background:none;cursor:pointer;color:#94a3b8;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseenter="this.style.color='#00008B';this.style.background='#00008B'"
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
  const count = countRealQuestions(editFormQuestions);
  const topCount = document.getElementById('edit-q-count');
  const bottomCount = document.getElementById('edit-q-bottom-count');
  if (topCount) topCount.textContent = count;
  if (bottomCount) bottomCount.textContent = count;
}

function fixEditQuestionBottomBarLabels() {
  // Không cần ghi đã label nữa và các nút đã có text/icon trực tiếp trong HTML template
}

// --- DRAG & DROP: câu hỏi trong chỉnh sửa form ---------------------
let _eqDragIdx = null;
function eqDragStart(event, qi) {
  _eqDragIdx = qi;
  event.dataTransfer.effectAllowed = 'move';
  setTimeout(() => {
    const el = document.getElementById('eqcard-' + qi);
    if (el) { el.style.opacity = '0.4'; el.style.boxShadow = '0 0 0 2px #00008B'; }
  }, 0);
}
function eqDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const card = event.currentTarget;
  if (card) card.style.borderColor = '#00008B';
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

// --- DRAG & DROP: đáp án trong chỉnh sửa form ---------------------
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
// -------------------------------------------------------------------

function editQSetText(qi, val) { editFormQuestions[qi].text = val; }

function editQAddImage(qi) {
  if (!editFormQuestions[qi]) return;
  openImageSourceModal(dataUrl => {
    editFormQuestions[qi].image = dataUrl;
    editFormQuestions[qi].hinh_anh_url = dataUrl;
    renderEditQuestions();
  });
}
function editQAddVideo(qi) {
  if (!editFormQuestions[qi]) return;
  const url = prompt('Nhập URL video (YouTube, Google Drive...):');
  if (!url?.trim()) return;
  editFormQuestions[qi].video = url.trim();
  editFormQuestions[qi].video_url = url.trim();
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
  const validationError = validateQuestionBeforeLibrarySave(q);
  if (validationError) { showToast(validationError, 'error'); return; }
  const opts = getFilledQuestionOptions(q);

  const already = findQuestionInLibrary(q);
  if (already) {
    q.thu_vien_id = Number(already.id) || already.id;
    markLibrarySavedButton(btn);
    showToast('Câu hỏi này đã có trong thư viện!', 'warning');
    return;
  }

  const context = getLibraryContextFromForm('edit');

  try {
    const data = await postQuestionToLibrary(q, context, opts);
    const newQ = normalizeLibraryQuestion(data.data || buildLibraryQuestionFallback(q, context, opts));
    libraryQuestions.push(newQ);
    q.thu_vien_id = Number(newQ.id) || newQ.id;
    localStorage.setItem('flic_lib_flat', JSON.stringify(libraryQuestions));
    libraryCountReady = true;
    updateLibraryCountLabel();
    showLibrarySavedNotice(false);
    markLibrarySavedButton(btn);
    fetchLibraryFromAPI().catch(() => {});
  } catch(e) {
    showToast(e.message || 'Không lưu được câu hỏi vào thư viện', 'error');
  }
}
function editQValidateCard(q) {
  if (!q?.text?.trim()) return 'Cau hoi chua co noi dung!';

  const normalizedType = normalizeQuestionType(q.type);
  if (['choice','checkbox','dropdown'].includes(normalizedType)) {
    const filledOpts = (q.opts || []).filter(o => String(o || '').trim());
    if (!filledOpts.length) return 'Cau hoi can it nhat 1 lua chon!';
    const duplicateOpt = findDuplicateOptionLabel(filledOpts);
    if (duplicateOpt) return `Lua chon bi trung: "${duplicateOpt}"`;
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
function editQSetType(qi, val) {
  editFormQuestions[qi].type = val;
  const needsOpts = ['choice','checkbox','dropdown','rating','scale'];
  const needsGrid = ['grid_radio','grid_checkbox'];
  if (needsOpts.includes(val) && !editFormQuestions[qi].opts.length) {
    editFormQuestions[qi].opts = getDefaultOptionsForType(val);
  } else if (!needsOpts.includes(val)) {
    editFormQuestions[qi].opts = [];
  }
  if (!supportsOtherOption(val)) setQuestionAllowOther(editFormQuestions[qi], false);
  if (val === 'scale') setQuestionScaleConfig(editFormQuestions[qi], getQuestionScaleConfig(editFormQuestions[qi]));
  if (val === 'rating') setQuestionRatingConfig(editFormQuestions[qi], getQuestionRatingConfig(editFormQuestions[qi]));
  if (needsGrid.includes(val)) {
    if (!editFormQuestions[qi].rows || !editFormQuestions[qi].rows.length) editFormQuestions[qi].rows = [''];
    if (!editFormQuestions[qi].cols || !editFormQuestions[qi].cols.length) editFormQuestions[qi].cols = [''];
  } else {
    editFormQuestions[qi].rows = [];
    editFormQuestions[qi].cols = [];
  }
  renderEditQuestions();
}
function editQSetOpt(qi, oi, val) {
  const q = editFormQuestions[qi];
  if (!q) return;
  q.opts[oi] = val;
}
function editQSetScale(qi, key, val) {
  const q = editFormQuestions[qi];
  if (!q) return;
  setQuestionScaleConfig(q, { [key]: key === 'start' || key === 'end' ? Number(val) : val });
  if (key === 'start' || key === 'end') renderEditQuestions();
}
function editQSetRating(qi, key, val) {
  const q = editFormQuestions[qi];
  if (!q) return;
  setQuestionRatingConfig(q, { [key]: Number(val) });
  renderEditQuestions();
}
function editQAddOpt(qi) { editFormQuestions[qi].opts.push(''); renderEditQuestions(); }
function editQToggleOther(qi, enabled) {
  if (!editFormQuestions[qi]) return;
  setQuestionAllowOther(editFormQuestions[qi], enabled);
  renderEditQuestions();
}
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
function editQAdd(position = 'first-section') {
  const newQ = { id: 'eq-' + Date.now(), text: '', type: 'choice', opts: [''], required: false };
  if (position === 'first-section') {
    const firstSectionIndex = editFormQuestions.findIndex(isSectionItem);
    if (firstSectionIndex >= 0) {
      editFormQuestions.splice(firstSectionIndex, 0, newQ);
    } else {
      editFormQuestions.push(newQ);
    }
  } else {
    editFormQuestions.push(newQ);
  }
  renderEditQuestions();
  setTimeout(() => {
    const cardIndex = editFormQuestions.findIndex(q => String(q.id) === String(newQ.id));
    const card = document.getElementById('eqcard-' + cardIndex);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      card.querySelector('input[type=text]')?.focus();
    }
  }, 50);
}

document.getElementById('page-content').insertAdjacentHTML('beforeend', `
  <div class="modal-overlay" id="edit-form-modal">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:920px;width:min(92vw,920px);border-radius:16px;display:flex;flex-direction:column">
      <div class="modal-header" style="position:relative;align-items:flex-start;padding:18px 260px 14px 24px;background:#00008B;color:#fff;border-bottom:0;border-radius:16px 16px 0 0">
        <div style="display:flex;align-items:flex-start;gap:10px;width:100%;min-width:0">
          <button id="collapse-edit-btn" class="btn btn-outline btn-sm" onclick="toggleEditFormFullscreen()" style="display:none;align-items:center;gap:6px;margin-top:2px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
            Quay lại
          </button>
          <div id="edit-form-title-wrap" onfocusout="handleFieldToolbarFocusOut(event, 'edit-form-name')" style="min-width:0;max-width:100%;width:100%">
            <input id="edit-form-name" type="hidden" required>
            <div id="edit-form-name-editor" class="modal-title rich-title-editor" contenteditable="true" role="textbox" aria-label="Tên biểu mẫu"
              data-sync-target="edit-form-name"
              data-placeholder="Chỉnh sửa biểu mẫu"
              style="min-height:32px;max-height:100px;overflow-y:auto;scrollbar-gutter:stable;line-height:1.25;outline:none;white-space:pre-wrap;word-break:break-word;color:#fff;font-weight:400;padding:0;border:0;background:transparent"
              onfocus="showFieldToolbar('edit-form-name')"
              oninput="syncRichTextFieldFromEditor('edit-form-name-editor')"
              onblur="syncRichTextFieldFromEditor('edit-form-name-editor')"
              onkeydown="handleRichFieldKeydown(event, 'edit-form-name-editor')"
              onclick="handleRichFieldClick(event, 'edit-form-name-editor')"
              onpaste="pastePlainTextIntoRichField(event, 'edit-form-name-editor')"></div>
            ${renderTextFormatToolbar('edit-form-name-editor', { hidden: true, toolbarFor: 'edit-form-name', hideLists: true, lightBg: true })}
            <div id="edit-form-desc-wrap" class="create-desc-wrap" onfocusout="handleFieldToolbarFocusOut(event, 'edit-form-desc')">
              <textarea id="edit-form-desc" maxlength="1000" style="display:none"></textarea>
              <div id="edit-form-desc-editor" class="rich-title-editor create-desc-editor" contenteditable="true" role="textbox" aria-label="Mô tả ngắn"
                data-sync-target="edit-form-desc"
                data-placeholder="Mô tả ngắn về biểu mẫu..."
                style="min-height:22px;line-height:1.4;outline:none;white-space:pre-wrap;word-break:break-word;color:#dbeafe;font-size:12.5px;font-weight:500;padding:0;border:0;background:transparent"
                onfocus="showFieldToolbar('edit-form-desc')"
                oninput="syncRichTextFieldFromEditor('edit-form-desc-editor')"
                onblur="syncRichTextFieldFromEditor('edit-form-desc-editor')"
                onkeydown="handleRichFieldKeydown(event, 'edit-form-desc-editor')"
                onclick="handleRichFieldClick(event, 'edit-form-desc-editor')"
                onpaste="pastePlainTextIntoRichField(event, 'edit-form-desc-editor')"></div>
              ${renderTextFormatToolbar('edit-form-desc-editor', { hidden: true, toolbarFor: 'edit-form-desc', lightBg: true })}
              <button type="button" id="edit-form-desc-toggle" class="create-desc-toggle" onclick="toggleEditFormDescExpanded()" title="Mở rộng mô tả" aria-label="Mở rộng mô tả" hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div id="edit-form-header-actions" style="position:absolute;right:24px;top:22px;z-index:3;display:flex;align-items:center;gap:6px">
          <button class="icon-btn" title="Giao diện" onclick="alert('Chức năng đang phát triển')" style="color:var(--gray-500);transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='var(--gray-500)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 3C7 3 3 6.8 3 11.5S7.1 20 12.2 20h1.3c1.3 0 2.3-1.1 2.1-2.4-.1-.7-.4-1.3-.8-1.8-.7-.9-.1-2.3 1.1-2.3H18c1.7 0 3-1.4 3-3.1C21 6.3 17 3 12 3z"/></svg>
          </button>
          <button id="edit-undo-btn" class="icon-btn" title="Hoàn tác" onclick="alert('Chức năng đang phát triển')" style="color:var(--gray-500);transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='var(--gray-500)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-1"/></svg>
          </button>
          <button id="edit-redo-btn" class="icon-btn" title="Làm lại" onclick="alert('Chức năng đang phát triển')" style="color:var(--gray-500);transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='var(--gray-500)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h1"/></svg>
          </button>
          <button class="icon-btn" title="Lấy liên kết" onclick="alert('Chức năng đang phát triển')" style="color:var(--gray-500);transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='var(--gray-500)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/></svg>
          </button>
          <button class="icon-btn" title="Thêm cộng tác viên" onclick="alert('Chức năng đang phát triển')" style="color:var(--gray-500);transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='var(--gray-500)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          </button>
          <button id="expand-edit-btn" class="icon-btn" title="Phóng to" onclick="toggleEditFormFullscreen()" style="color:var(--gray-400);transition:all .15s" onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='var(--gray-400)'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>
          <button class="icon-btn close-btn" onclick="closeModal('edit-form-modal')">${IC.close}</button>
        </div>
      </div>

      <div id="edit-modal-scroll" style="padding:0 24px 8px;max-height:min(76vh,820px);overflow-y:auto">

        <!-- Thông tin cơ bản -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:16px 0">
          <input type="hidden" id="edit-form-id">
          <div>
            <label class="form-label">Danh mục <span style="color:var(--red)">*</span></label>
            <select id="edit-form-cat" class="input" required style="width:100%;background:#f8f9fb" onchange="syncEditSurveyTypes();var s=document.getElementById('edit-lib-cat-filter');if(s)s.value=this.value;renderEditLibraryList()">
              <option value="">Chọn danh mục</option>
              <option>Ngoại ngữ</option><option>Tin học</option>
            </select>
          </div>
            <div>
              <label class="form-label">Loại khảo sát <span style="color:var(--red)">*</span></label>
              <select id="edit-form-survey-type" class="input" required style="width:100%;background:#f8f9fb">
                <option value="">Chọn loại khảo sát</option>
              </select>
            </div>
            <div>
              <label class="form-label">Đối tượng <span style="color:var(--red)">*</span></label>
              <select id="edit-form-target" class="input" required style="width:100%;background:#f8f9fb">
                <option value="Tất cả">Tất cả</option>
                <option value="Sinh viên">Sinh viên</option>
                <option value="Người đi làm">Người đi làm</option>
              </select>
            </div>
            <div>
              <label class="form-label">Ngày đóng biểu mẫu</label>
              <input type="date" id="edit-form-close" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none" onchange="syncEditCloseToDisplay(this.value); if(isPastInputDate(this.value)){showToast('Không được chọn ngày đóng trong quá khứ','error'); this.value=''; syncEditCloseToDisplay('');}">
              <input type="text" id="edit-form-close-display" class="input" placeholder="dd/mm/yyyy" readonly style="width:100%;background:#f8f9fb;height:38px;font-size:12.5px;cursor:pointer" onclick="openEditCloseDatePicker()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openEditCloseDatePicker()}">
              <label style="display:flex;align-items:center;gap:6px;margin-top:7px;cursor:pointer;font-size:12.5px;color:var(--gray-600)">
                <input type="checkbox" id="edit-form-no-close" style="width:15px;height:15px;accent-color:var(--sidebar-active,#df2f0b);cursor:pointer" onchange="setEditNoCloseState(this.checked)">
                Không đóng
              </label>
            </div>
          </div>

        <!-- Khu vực câu hỏi -->
        <div style="padding:14px 0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <span style="font-size:13.5px;font-weight:700;color:var(--gray-700)">
              Tổng <span id="edit-q-count" style="color:#00008B">0</span> câu hỏi
            </span>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
              <button onclick="toggleEditLibrary()" title="Chọn từ thư viện câu hỏi"
                style="display:flex;align-items:center;gap:5px;padding:7px 12px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;font-size:12.5px;font-weight:700;color:#64748b;cursor:pointer;transition:all .15s;white-space:nowrap"
                onmouseenter="this.style.borderColor='#00008B';this.style.color='#00008B'"
                onmouseleave="this.style.borderColor='#e2e8f0';this.style.color='#64748b'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M4 4v15.5A2.5 2.5 0 006.5 22H20V6a2 2 0 00-2-2H6.5A2.5 2.5 0 004 6.5"/></svg>
                Thư viện (<span id="edit-lib-total-count">0</span>)
              </button>
              <button onclick="editQAdd('first-section')" title="Thêm câu hỏi"
                style="width:34px;height:34px;padding:0;background:var(--sky);color:#fff;border:none;border-radius:8px;cursor:pointer;transition:opacity .15s;box-shadow:0 2px 6px rgba(0,0,139,0.3);display:flex;align-items:center;justify-content:center"
                onmouseenter="this.style.opacity='.88'" onmouseleave="this.style.opacity='1'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>
          <div id="edit-library-panel" style="display:none;border:1px solid #cfe0ff;border-radius:14px;overflow:hidden;margin:0 0 14px;background:#fff;box-shadow:0 14px 34px rgba(15,23,42,.08)">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:linear-gradient(180deg,#f8fbff 0%,#eef5ff 100%);border-bottom:1px solid #dbe8ff">
              <div style="min-width:0">
                <div style="font-size:14px;font-weight:800;color:#172554">Thư viện câu hỏi</div>
                <div style="font-size:12px;color:#64748b;margin-top:1px">Chọn câu hỏi mẫu để thêm vào biểu mẫu đang chỉnh sửa</div>
              </div>
              <button onclick="toggleEditLibrary()" style="width:32px;height:32px;border:1px solid #cfe0ff;border-radius:9px;background:#fff;cursor:pointer;color:#64748b;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center" title="Đóng">×</button>
            </div>
            <div style="padding:12px 14px;border-bottom:1px solid #eef4ff;display:flex;gap:10px;align-items:center;background:#fff;flex-wrap:wrap">
              <select id="edit-lib-cat-filter" class="input" style="height:38px;font-size:13px;width:150px;flex-shrink:0;padding:0 10px;background:#f8fbff" onchange="renderEditLibraryList()">
                <option value="Ngoại ngữ">Ngoại ngữ</option>
                <option value="Tin học">Tin học</option>
              </select>
              <div class="input-wrap" style="margin:0;flex:1">
                <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                <input type="text" id="edit-lib-search" class="input" placeholder="Tìm câu hỏi..." style="font-size:13px;height:38px;background:#f8fbff" oninput="renderEditLibraryList()">
              </div>
            </div>
            <div id="edit-lib-list-wrap" style="max-height:280px;overflow-y:auto;background:#fff"></div>
          </div>
          <div id="edit-q-list"></div>
        </div>

        <!-- Lời kết -->
        <div class="form-group" id="edit-form-loi-ket-wrap" style="padding:14px 0 18px;border-top:1px solid var(--gray-200)" onfocusout="handleFieldToolbarFocusOut(event, 'edit-form-loi-ket')">
          <label class="form-label" style="margin-bottom:3px">Lời kết</label>
          <div style="font-size:12.5px;color:#94a3b8;font-weight:600;margin-bottom:8px">(Hiển thị sau khi người dùng gửi phản hồi)</div>
          <textarea id="edit-form-loi-ket" maxlength="300" style="display:none"></textarea>
          <div id="edit-form-loi-ket-editor" class="input rich-title-editor" contenteditable="true" role="textbox" aria-label="Lời kết"
            data-sync-target="edit-form-loi-ket"
            data-placeholder="Ví dụ: Cảm ơn bạn đã tham gia khảo sát! Phản hồi của bạn rất có giá trị với chúng tôi."
            style="background:#f8f9fb;min-height:46px;height:auto;display:block;line-height:1.5;outline:none;white-space:pre-wrap;word-break:break-word;padding:10px 12px;overflow:auto"
            onfocus="showFieldToolbar('edit-form-loi-ket')"
            oninput="syncRichTextFieldFromEditor('edit-form-loi-ket-editor')"
            onblur="syncRichTextFieldFromEditor('edit-form-loi-ket-editor')"
            onkeydown="handleRichFieldKeydown(event, 'edit-form-loi-ket-editor')"
            onclick="handleRichFieldClick(event, 'edit-form-loi-ket-editor')"
            onpaste="pastePlainTextIntoRichField(event, 'edit-form-loi-ket-editor')"></div>
          ${renderTextFormatToolbar('edit-form-loi-ket-editor', { hidden: true, toolbarFor: 'edit-form-loi-ket' })}
          <div style="text-align:right;font-size:11px;color:var(--gray-400);margin-top:2px"><span id="edit-loi-ket-count">0/300</span></div>
        </div>

      </div>

      <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid var(--gray-200);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-radius:0 0 16px 16px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:13px;color:var(--gray-500)">Đã chọn <strong id="edit-q-bottom-count" style="color:var(--sky)">0</strong> câu hỏi</div>
          <button type="button" onclick="openEditFormPreview()" title="Xem trước biểu mẫu"
            style="height:38px;min-width:118px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 14px;border-radius:10px;border:1.5px solid #00008B;background:#fff;font-size:12.5px;font-weight:900;color:#00008B;cursor:pointer;transition:background .15s,border-color .15s,color .15s,box-shadow .15s;white-space:nowrap"
            onmouseenter="this.style.background='#dbeafe';this.style.borderColor='#00008B';this.style.color='#00008B';this.style.boxShadow='0 6px 16px rgba(0,0,139,.16)'"
            onmouseleave="this.style.background='#fff';this.style.borderColor='#00008B';this.style.color='#00008B';this.style.boxShadow='none'"
            onmousedown="this.style.background='#bfdbfe';this.style.color='#00008B'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Xem trước
          </button>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap">
          <button class="btn btn-outline" onclick="closeModal('edit-form-modal')">Hủy bỏ</button>
          <button class="btn btn-primary" onclick="saveEditForm()">${IC.save} Lưu thay đổi</button>
        </div>
      </div>
    </div>
  </div>
`);

// Init handled by async loadForms() above

// -- Charts (data-driven from FORMS list) ------------------------
let fmLineChart = null;
let fmDoughnutChart = null;
const CAT_COLORS = {'Đăng ký':'#00008B','Khảo sát':'#8b5cf6','Đánh giá':'#f97316','Phản hồi':'#10b981','Khác':'#64748b'};
// --- VIEW QUESTIONS MODAL ---------------------------------------

let viewFormHistoryActive = false;

function clearViewFormQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('view_form_id')) return;
  url.searchParams.delete('view_form_id');
  const query = url.searchParams.toString();
  history.replaceState(history.state || {}, '', `${url.pathname}${query ? `?${query}` : ''}${url.hash}`);
}

function getCleanFormManagementUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('view_form_id');
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
}

function pushViewFormHistory(formId) {
  if (history.state?.viewFormModal && viewFormHistoryActive) return;
  const cleanUrl = getCleanFormManagementUrl();
  history.replaceState({ ...(history.state || {}), formManagementList: true }, '', cleanUrl);
  history.pushState({ viewFormModal: true, formId: String(formId) }, '', cleanUrl);
  viewFormHistoryActive = true;
}

function closeViewFormModal(fromHistory = false) {
  closeModal('view-form-modal');
  clearViewFormQuery();
  viewFormHistoryActive = false;
  if (!fromHistory && history.state?.viewFormModal) {
    history.back();
  }
}

window.addEventListener('popstate', (event) => {
  const modal = document.getElementById('view-form-modal');
  const modalIsOpen = modal && window.getComputedStyle(modal).display !== 'none';
  if (event.state?.viewFormModal && event.state.formId) {
    openViewModal(String(event.state.formId), false);
    viewFormHistoryActive = true;
    return;
  }
  if (viewFormHistoryActive || modalIsOpen) {
    closeViewFormModal(true);
  }
});

// Inject modal HTML (chạy 1 lần)
document.getElementById('page-content').insertAdjacentHTML('beforeend', `
  <div class="modal-overlay" id="view-form-modal" onclick="closeViewFormModal()">
    <div class="modal" onclick="event.stopPropagation()" style="width:100vw;max-width:none;height:100vh;max-height:none;border-radius:0;display:flex;flex-direction:column;overflow:hidden;box-shadow:none">
      <div class="modal-header" style="padding:14px 24px 12px;border-bottom:1px solid #c7d2fe;background:linear-gradient(180deg,#e0ecff 0%,#f8fbff 100%);flex-shrink:0;min-height:auto">
        <div>
          <div class="modal-title" id="view-modal-title" style="font-size:22px;line-height:1.15;font-weight:800;color:#0f172a">Chi tiết biểu mẫu</div>
        </div>
        <button class="icon-btn close-btn" onclick="closeViewFormModal()" style="width:36px;height:36px;border-radius:10px;background:#ffffff;border:1px solid #93c5fd;color:#00008B;box-shadow:0 6px 16px rgba(15,23,42,.08)">${IC.close}</button>
      </div>
      <div id="view-modal-body" style="padding:0;overflow-y:auto;flex:1;background:radial-gradient(circle at top left,rgba(0,0,139,.12),transparent 28%),linear-gradient(180deg,#f7fbff 0%,#eef5ff 100%)"></div>
    </div>
  </div>
`);

document.getElementById('page-content').insertAdjacentHTML('beforeend', `
  <div class="modal-overlay" id="share-form-modal" onclick="closeModal('share-form-modal')">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:640px;border-radius:14px">
      <div class="modal-header">
        <div>
          <div class="modal-title">Chia sẻ biểu mẫu</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px" id="share-modal-sub">Tạo link công khai giúp gửi cho học viên</div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('share-form-modal')">${IC.close}</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
        <div style="padding:14px 16px;border:1px solid #00008B;background:#00008B;border-radius:12px">
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:6px" id="share-form-name">Biểu mẫu</div>
          <div style="font-size:12.5px;color:var(--gray-500)" id="share-form-desc">Link này sẽ mở một trang biểu mẫu công khai với phần thông tin người học ở đầu biểu mẫu.</div>
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
              Rất gọn
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
  document.getElementById('share-form-desc').textContent = `Danh mục: ${form.cat || 'Khác'} · Link công khai có sẵn phần thông tin học viên ở đầu biểu mẫu.`;
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
  if (btn) { btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> Rất gọn'; btn.disabled = false; }
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

async function openViewModal(id, manageHistory = true) {
  const f = FORMS.find(f => f.id === id);
  if (!f) return;
  if (manageHistory) pushViewFormHistory(id);

  // Cập nhật tiêu đề
  document.getElementById('view-modal-title').innerHTML = formatRichText(f.name);
  document.getElementById('view-modal-body').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:40px 0;color:var(--gray-400)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-dasharray="28" stroke-dashoffset="10"/></svg>
      <span style="margin-left:10px;font-size:14px">Đang tải câu hỏi...</span>
    </div>`;
  openModal('view-form-modal');

  // Gọi API lấy câu hỏi
  let questions = [];
  let formDetail = null;
  const localPreviewItems = normalizeLocalItemsForPreview(
    (Array.isArray(f.questions) && f.questions.length) ? f.questions : getFormItemsCache(id)
  );
  try {
    const tkn4 = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/forms/${id}`, {
      headers: tkn4 ? { Authorization: `Bearer ${tkn4}` } : {}
    });
    if (res.ok) {
      const data = await res.json();
      formDetail = data;
      questions = (Array.isArray(data.form_items) && data.form_items.length ? data.form_items : data.cau_hoi) || [];
    }
  } catch(e) {
    console.warn('Không tải được chi tiết biểu mẫu, dùng dữ liệu tạm:', e);
  }
  questions = questions.length ? questions : localPreviewItems;
  questions = mergeQuestionLocalFallback(questions, localPreviewItems);
  questions = mergeQuestionMediaCache(id, questions);
  const formDesc = (formDetail?.mo_ta || f.mo_ta || f.desc || '').trim();
  const viewFormInfo = {
    name: f.name,
    desc: formDesc,
    cat: f.cat || formDetail?.danh_muc || 'Khác',
    target: formDetail?.doi_tuong || f.target || f.doi_tuong || '',
    theme: {
      ...DEFAULT_FORM_THEME,
      headerImage: formDetail?.anh_bia || f.anh_bia || '',
      background: formDetail?.mau_nen || f.mau_nen || DEFAULT_FORM_THEME.background,
      headerFont: formDetail?.font_family || f.font_family || DEFAULT_FORM_THEME.headerFont,
    },
    anh_bia: formDetail?.anh_bia || f.anh_bia || '',
  };

  formPreviewPageState = { page: 0, formInfo: viewFormInfo, questions, containerId: 'view-modal-body' };

  document.getElementById('view-modal-body').innerHTML = renderFormPreviewSurface(
    { ...viewFormInfo, _previewPageIndex: 0 },
    questions
  );
  return;

  const renderViewAnswer = (question) => {
    const normalizedType = normalizeQuestionType(question.loai);
    const options = (question.lua_chon || []).map(o => o.noi_dung || o).filter(Boolean);
    if (normalizedType === 'short_text') {
      return `<div style="max-width:420px"><div style="font-size:12.5px;color:#64748b;margin-bottom:8px">Câu trả lời ngắn</div><div style="height:42px;border-bottom:2px solid #cbd5e1;background:linear-gradient(180deg,rgba(255,255,255,.8),rgba(255,255,255,.95));border-radius:10px 10px 0 0"></div></div>`;
    }
    if (normalizedType === 'paragraph') {
      return `<div><div style="font-size:12.5px;color:#64748b;margin-bottom:8px">Câu trả lời dài</div><div style="height:92px;border:1.5px solid #dbe4f0;background:rgba(255,255,255,.92);border-radius:14px;position:relative;overflow:hidden"><div style="position:absolute;left:18px;right:18px;top:20px;height:1px;background:#d7dee8"></div><div style="position:absolute;left:18px;right:18px;top:46px;height:1px;background:#d7dee8"></div><div style="position:absolute;left:18px;right:18px;top:72px;height:1px;background:#d7dee8"></div></div></div>`;
    }
    if (normalizedType === 'choice') {
      return `<div style="display:flex;flex-direction:column;gap:10px">${options.map((option, index) => `<label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #dbe4f0;border-radius:12px;background:rgba(255,255,255,.92)"><span style="width:18px;height:18px;border-radius:50%;border:2px solid #00008B;flex-shrink:0"></span><span style="font-size:14px;color:#334155">${option || `Lựa chọn ${index + 1}`}</span></label>`).join('')}</div>`;
    }
    if (normalizedType === 'checkbox') {
      return `<div style="display:flex;flex-direction:column;gap:10px">${options.map((option, index) => `<label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #dbe4f0;border-radius:12px;background:rgba(255,255,255,.92)"><span style="width:18px;height:18px;border-radius:5px;border:2px solid #f59e0b;flex-shrink:0"></span><span style="font-size:14px;color:#334155">${option || `Lựa chọn ${index + 1}`}</span></label>`).join('')}</div>`;
    }
    if (normalizedType === 'dropdown') {
      return `<div style="max-width:360px"><div style="padding:12px 14px;border:1px solid #dbe4f0;border-radius:12px;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:space-between;color:#64748b"><span>Chọn một mục</span><span style="font-size:16px">?</span></div>${options.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">${options.map(option => `<span style="padding:6px 10px;border-radius:999px;background:#fff7ed;border:1px solid #fed7aa;font-size:12.5px;color:#9a3412">${option}</span>`).join('')}</div>` : ''}</div>`;
    }
    if (normalizedType === 'rating') {
      return renderRatingPreview(getQuestionRatingConfig(question));
    }
    if (normalizedType === 'scale') {
      return renderScalePreview(getQuestionScaleConfig(question));
    }
    if (normalizedType === 'upload') {
      return `<button disabled style="display:inline-flex;align-items:center;gap:8px;padding:11px 14px;border:1.5px dashed #94a3b8;border-radius:12px;background:#f8fafc;color:#475569;font-size:13px;font-weight:800"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/></svg>Tải tệp lên</button>`;
    }
    if (normalizedType === 'date' || normalizedType === 'time') {
      return `<input disabled type="${normalizedType === 'date' ? 'date' : 'time'}" style="width:220px;max-width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid #bbf7d0;border-radius:12px;background:#f8fffb;color:#64748b;font:inherit">`;
    }
    if (normalizedType === 'grid_radio' || normalizedType === 'grid_checkbox') {
      const rows = getGridRows(question);
      const cols = getGridCols(question);
      if (!rows.length || !cols.length) {
        return `<div style="padding:12px 14px;border:1px dashed #f59e0b;border-radius:12px;background:#fffbeb;color:#92400e;font-size:13px;font-weight:700">Câu hỏi lưới chưa có dữ liệu hàng/cột.</div>`;
      }
      const control = normalizedType === 'grid_radio'
        ? '<span style="width:16px;height:16px;border-radius:50%;border:2px solid #00008B;display:inline-block"></span>'
        : '<span style="width:16px;height:16px;border-radius:4px;border:2px solid #f59e0b;display:inline-block"></span>';
      return `<div style="overflow:auto"><table style="width:100%;min-width:520px;table-layout:fixed;border-collapse:separate;border-spacing:0 8px"><thead><tr><th style="text-align:left;padding:0 12px 6px;color:#64748b;font-size:12px;font-weight:700"></th>${cols.map(col => `<th style="text-align:center;padding:0 12px 6px;color:#00008B;font-size:12px;font-weight:700">${col}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr><td style="padding:14px 12px;background:rgba(255,255,255,.92);border:1px solid #dbe4f0;border-right:none;border-radius:12px 0 0 12px;font-size:14px;font-weight:600;color:#334155">${row}</td>${cols.map(() => `<td style="padding:14px 12px;background:rgba(255,255,255,.92);border-top:1px solid #dbe4f0;border-bottom:1px solid #dbe4f0;text-align:center">${control}</td>`).join('')}<td style="width:1px;padding:0;background:transparent;border:none"></td></tr>`).join('')}</tbody></table></div>`;
    }
    return `<div style="font-size:13px;color:#94a3b8">Không có dữ liệu xem trước.</div>`;
  };

  if (!questions.length) {
    document.getElementById('view-modal-body').innerHTML = `
      <div style="text-align:center;padding:40px 0;color:var(--gray-400)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40" style="margin:0 auto 12px;display:block;opacity:.4"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div style="font-size:14px">Biểu mẫu này chưa có câu hỏi nào</div>
      </div>`;
    return;
  }

  document.getElementById('view-modal-body').innerHTML = `
    <div style="max-width:980px;margin:0 auto;color:#172554">
      <div style="background:linear-gradient(135deg,#dbeafe 0%,#eff6ff 55%,#e0e7ff 100%);border:1px solid #bfdbfe;border-radius:26px;min-height:180px;position:relative;overflow:hidden;box-shadow:0 22px 42px rgba(30,64,175,.14)">
        <div style="position:absolute;inset:0;background-image:url('${(f.img || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1400&h=700&fit=crop').replace(/'/g, '%27')}');background-size:cover;background-position:center;filter:saturate(1.05) contrast(1.02);transform:scale(1.03)"></div>
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(239,246,255,.95) 0%,rgba(219,234,254,.88) 46%,rgba(224,231,255,.93) 100%)"></div>
        <div style="position:relative;padding:28px 30px;color:#172554;display:flex;flex-direction:column;justify-content:flex-end;min-height:140px">
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
            <span style="padding:6px 12px;border-radius:999px;background:#ffffff;border:1px solid #bfdbfe;font-size:12px;font-weight:800;color:#00008B">${f.cat || 'Khác'}</span>
            <span style="padding:6px 12px;border-radius:999px;background:#ffffff;border:1px solid #bfdbfe;font-size:12px;font-weight:800;color:#00008B">Tổng ${countRealQuestions(questions)} câu hỏi</span>
          </div>
          <div style="font-size:32px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#00008B">${formatRichText(f.name)}</div>
          ${formDesc ? `<div style="font-size:16px;margin-top:12px;color:#334155;font-weight:600;line-height:1.55">${formatRichText(formDesc)}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;padding:12px 0 28px">
      ${questions.map((q, i) => isSectionItem(q) ? `
        <div style="border:1px solid #fbbf24;border-left:6px solid #f59e0b;border-radius:20px;padding:20px 22px;background:linear-gradient(180deg,#fffbeb 0%,#fff7ed 100%);box-shadow:0 12px 26px rgba(180,83,9,.08)">
          <div style="font-size:12px;font-weight:900;color:#b45309;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Phần ${getSectionNumber(questions, i)}</div>
          <div style="font-size:24px;font-weight:900;color:#78350f;line-height:1.3">${q.title || q.noi_dung || `Phần ${getSectionNumber(questions, i)}`}</div>
          ${(q.desc || q.description || q.mo_ta_cau_hoi) ? `<div style="font-size:14px;color:#92400e;line-height:1.55;margin-top:8px">${q.desc || q.description || q.mo_ta_cau_hoi}</div>` : ''}
        </div>
      ` : `
        <div style="border:1px solid #bfdbfe;border-radius:20px;padding:20px 20px 22px;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);box-shadow:0 12px 26px rgba(30,64,175,.08)">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px">
            <div style="display:flex;align-items:flex-start;gap:14px;flex:1;min-width:0">
              <div style="width:36px;height:36px;border-radius:50%;background:#00008B;color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;box-shadow:0 8px 18px rgba(0,0,139,.18)">${getQuestionNumberInSection(questions, i)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:16px;font-weight:600;color:#0f172a;margin-bottom:12px;line-height:1.5">
                  ${formatRichText(q.noi_dung, q.bat_buoc)}
                </div>
                ${renderQuestionMedia(q)}
                ${renderViewAnswer(q)}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
              <span style="flex-shrink:0;padding:6px 12px;border-radius:999px;background:#00008B;color:#fff;font-size:12px;font-weight:800;white-space:nowrap">${TYPE_LABEL_MAP[normalizeQuestionType(q.loai)] || normalizeQuestionType(q.loai)}</span>
            </div>
          </div>
        </div>
      `).join('')}
      </div>
    </div>`;
}

async function saveEditForm() {
  syncRichTextFieldFromEditor('edit-form-name-editor');
  syncRichTextFieldFromEditor('edit-form-desc-editor');
  syncRichTextFieldFromEditor('edit-form-loi-ket-editor');
  const id = document.getElementById('edit-form-id').value;
  const name = document.getElementById('edit-form-name').value.trim();
  const desc = document.getElementById('edit-form-desc')?.value?.trim() || '';
  const cat = document.getElementById('edit-form-cat').value;
  const surveyType = document.getElementById('edit-form-survey-type')?.value || '';
  const target = normalizeSurveyTarget(document.getElementById('edit-form-target')?.value || 'Tất cả');
  const editNoClose = document.getElementById('edit-form-no-close');
  const closeDate = editNoClose?.checked ? '' : (document.getElementById('edit-form-close')?.value || '');
  const loiKet = document.getElementById('edit-form-loi-ket')?.value?.trim() || '';

  if (!name) {
    showToast('Vui lòng nhập tên biểu mẫu!', 'error');
    document.getElementById('edit-form-name-editor')?.focus();
    return;
  }
  if (!cat) {
    showToast('Vui lòng chọn danh mục!', 'error');
    return;
  }
  if (!surveyType) {
    showToast('Vui lòng chọn loại khảo sát!', 'error');
    document.getElementById('edit-form-survey-type')?.focus();
    return;
  }
  if (closeDate && isPastInputDate(closeDate)) {
    showToast('Không được chọn ngày đóng trong quá khứ', 'error');
    document.getElementById('edit-form-close-display')?.focus();
    return;
  }

  for (let i = 0; i < editFormQuestions.length; i++) {
    const q = editFormQuestions[i];
    if (isSectionItem(q)) continue;
    if (!q.text.trim()) {
      showToast(`Câu hỏi ${getQuestionNumberInSection(editFormQuestions, i)} chưa có nội dung!`, 'error');
      return;
    }
    const type = normalizeQuestionType(q.type || q.loai || 'choice');
    const needsOpts = ['choice', 'checkbox', 'dropdown'];
    if (needsOpts.includes(type)) {
      const filledOpts = (q.opts || []).filter(o => String(o).trim());
      if (!filledOpts.length) {
        showToast(`Câu hỏi ${getQuestionNumberInSection(editFormQuestions, i)} cần ít nhất 1 lựa chọn!`, 'error');
        return;
      }
      const duplicateOpt = findDuplicateOptionLabel(filledOpts);
      if (duplicateOpt) {
        showToast(`Câu hỏi ${getQuestionNumberInSection(editFormQuestions, i)} có lựa chọn bị trùng: "${duplicateOpt}"`, 'error');
        return;
      }
    }
    if (NEEDS_GRID.includes(type) && (!getGridRows(q).length || !getGridCols(q).length)) {
      showToast(`Câu hỏi ${getQuestionNumberInSection(editFormQuestions, i)} cần ít nhất 1 hàng và 1 cột!`, 'error');
      return;
    }
  }

  const status = 'pending';
  const chosenQuestions = await normalizeQuestionMediaForSave(editFormQuestions.map(q => ({
    ...q,
    opts: ['scale', 'rating'].includes(normalizeQuestionType(q.type || q.loai)) ? [] : (q.opts || []).filter(o => String(o).trim()),
    scale: normalizeQuestionType(q.type || q.loai) === 'scale' ? getQuestionScaleConfig(q) : q.scale,
    rating: normalizeQuestionType(q.type || q.loai) === 'rating' ? getQuestionRatingConfig(q) : q.rating,
    validation_json: getQuestionValidationJson(q),
    rows: getGridRows(q),
    cols: getGridCols(q),
  })));
  const previousStatus = FORMS.find(f => String(f.id) === String(id))?.status || '';

  try {
    const token = localStorage.getItem('token') || '';
    const payload = {
      ten_form: name,
      danh_muc: cat,
      loai_khao_sat: surveyType,
      doi_tuong: target,
      trang_thai: status,
      mo_ta: desc,
      ngay_dong: closeDate || null,
      loi_ket: loiKet,
      cau_hoi: buildQuestionPayload(chosenQuestions),
    };
    assertFormPayloadWithinLimit(payload);
    const res = await fetch(`${API_BASE}/forms/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 413) throw new Error('Ảnh/video quá lớn. Vui lòng chọn ảnh nhỏ hơn hoặc dùng URL video.');
      throw new Error(errData.message || 'Lưu biểu mẫu thất bại');
    }
  } catch (e) {
    showToast(e.message || 'Lỗi kết nối server!', 'error');
    return;
  }

  saveFormQuestionMediaCache(id, chosenQuestions);
  saveFormItemsCache(id, chosenQuestions);

  const idx = FORMS.findIndex(f => String(f.id) === String(id));
  if (idx !== -1) {
    const firstQuestionPreview = chosenQuestions.find(item => !isSectionItem(item))?.text
      || chosenQuestions.find(item => !isSectionItem(item))?.noi_dung
      || '';
    FORMS[idx] = {
      ...FORMS[idx],
      name,
      cat,
      loai_khao_sat: surveyType,
      doi_tuong: target,
      status,
      closeDate: closeDate || '',
      ngay_dong: closeDate || '',
      color: getFormCategoryColor(cat),
      loi_ket: loiKet,
      mo_ta: desc,
      desc,
      so_cau_hoi: countRealQuestions(chosenQuestions),
      questionPreview: firstQuestionPreview,
      questions: chosenQuestions
    };
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
      showToast(`Đã cập nhật biểu mẫu "${name}" và gửi duyệt lại`, 'success');
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
      showToast(`Đã cập nhật biểu mẫu "${name}" và gửi duyệt`, 'success');
      return;
    } catch (e) {
      const msg = String(e.message || '');
      if (msg.includes('đang có yêu cầu') || msg.includes('chờ phê duyệt')) {
        cacheLocalApprovalItem({
          approvalId: id,
          formId: id,
          formName: name,
          cat,
          note: '',
          questions: chosenQuestions,
        });
        closeModal('edit-form-modal');
        showToast(`Biểu mẫu "${name}" đã nằm trong hàng chờ phê duyệt`, 'success');
        return;
      }
      showToast(e.message || 'Không tạo được yêu cầu phê duyệt', 'error');
      return;
    }
  }

  closeModal('edit-form-modal');
  showToast(`Đã cập nhật biểu mẫu "${name}"`, 'success');
  // Reload lỗi từ API để đồng bộ với DB
  loadForms()
    .then(fresh => {
      FORMS = fresh;
      filtered = sortFormsForManagement(FORMS);
      renderGrid(filtered);
      return loadFavoritesFromAPI();
    })
    .catch(() => {});
}
// -- Standalone create page (form-create.html) ------------------
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
          <span class="badge" style="background:#00008B;color:#fff">Trang tạo biểu mẫu</span>
        </div>
        <h2 class="page-title">Tạo biểu mẫu mới</h2>
        <p class="page-sub">Người dùng có thể tập trung thêm câu hỏi và cấu hình biểu mẫu trên một trang riêng thay vì popup.</p>
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
  libraryQuestionFormOverrides = {};
  directQuestions = [];
  activeDirectQuestionId = '';

  const catInput = document.getElementById('new-form-cat');
  const deadlineInput = document.getElementById('new-approval-deadline');
  const urgentInput = document.getElementById('new-approval-urgent');
  const urgentReasonInput = document.getElementById('new-approval-urgent-reason');
  const loiKetInput = document.getElementById('new-form-loi-ket');
  const closeInput = document.getElementById('new-form-close');
  const closeDisplay = document.getElementById('new-form-close-display');
  const noCloseInput = document.getElementById('new-form-no-close');
  const descCount = document.getElementById('desc-count');

  setRichTitleEditorValue('');
  setRichTextFieldValue('new-form-desc', '');
  if (catInput) catInput.value = '';
  syncCreateSurveyTypes();
  if (deadlineInput) {
    deadlineInput.value = '';
    deadlineInput.min = getCurrentDateTimeLocalValue();
  }
  if (urgentInput) urgentInput.checked = false;
  if (urgentReasonInput) urgentReasonInput.value = '';
  if (loiKetInput) {
    const savedLoiKet = localStorage.getItem(NEW_FORM_LOI_KET_DRAFT_KEY) || '';
    setRichTextFieldValue('new-form-loi-ket', savedLoiKet);
  }
  if (closeInput) {
    closeInput.min = todayInputValue();
    closeInput.value = '';
    closeInput.disabled = true;
  }
  if (closeDisplay) {
    closeDisplay.value = '';
    closeDisplay.disabled = true;
    closeDisplay.style.opacity = '0.35';
  }
  if (noCloseInput) noCloseInput.checked = true;
  if (descCount) descCount.textContent = '0/1000';
  updateUrgentReasonCount();
  toggleApprovalNoteField();
  hideRichTitleToolbar();
  hideFieldToolbar('new-form-desc');
  hideFieldToolbar('new-form-loi-ket');

  renderQList();
  renderDirectQList();
})();

function setEditFormDescToggleIcon(expanded) {
  const toggle = document.getElementById('edit-form-desc-toggle');
  if (!toggle) return;
  toggle.title = expanded ? 'Thu gọn mô tả' : 'Mở rộng mô tả';
  toggle.setAttribute('aria-label', toggle.title);
  toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  toggle.innerHTML = expanded
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
}

function updateEditFormDescCollapseState() {
  const wrap = document.getElementById('edit-form-desc-wrap');
  const editor = document.getElementById('edit-form-desc-editor');
  const toggle = document.getElementById('edit-form-desc-toggle');
  const header = document.querySelector('#edit-form-modal .modal-header');
  if (!wrap || !editor || !toggle) return;

  setTimeout(() => {
    const wasExpanded = wrap.classList.contains('is-expanded');
    if (wasExpanded) {
      wrap.classList.remove('is-expanded');
      header?.classList.remove('is-desc-expanded');
    }
    const shouldToggle = editor.scrollHeight > 74;
    if (wasExpanded) {
      wrap.classList.add('is-expanded');
      header?.classList.add('is-desc-expanded');
    }

    if (!shouldToggle) {
      wrap.classList.remove('is-expanded');
      header?.classList.remove('is-desc-expanded');
    }
    toggle.hidden = !shouldToggle;
    setEditFormDescToggleIcon(shouldToggle && wasExpanded);
  }, 50);
}

function toggleEditFormDescExpanded() {
  const wrap = document.getElementById('edit-form-desc-wrap');
  const toggle = document.getElementById('edit-form-desc-toggle');
  const header = document.querySelector('#edit-form-modal .modal-header');
  if (!wrap || !toggle) return;
  const expanded = wrap.classList.toggle('is-expanded');
  header?.classList.toggle('is-desc-expanded', expanded);
  setEditFormDescToggleIcon(expanded);
}

function openEditFormPreview(pushHistory = true) {
  const name = document.getElementById('edit-form-name')?.value?.trim() || '(Chưa đặt tên)';
  const desc = document.getElementById('edit-form-desc')?.value?.trim() || '';
  const cat  = document.getElementById('edit-form-cat')?.value || 'Khác';
  const target = typeof normalizeSurveyTarget === 'function' ? normalizeSurveyTarget(document.getElementById('edit-form-target')?.value || 'Tất cả') : (document.getElementById('edit-form-target')?.value || 'Tất cả');
  const sel  = typeof editFormQuestions !== 'undefined' ? editFormQuestions : [];

  const body = document.getElementById('form-preview-body');
  const title = document.getElementById('form-preview-title');
  if (!body || !title) return;

  const previewOverlay = document.getElementById('form-preview-modal');
  if (previewOverlay) previewOverlay.style.zIndex = '1300';

  title.innerHTML = typeof formatRichText === 'function' ? formatRichText(name) : name;

  const previewInfo = { name, desc, cat, target, theme: typeof createFormTheme !== 'undefined' ? createFormTheme : null };
  if (typeof formPreviewPageState !== 'undefined') {
    formPreviewPageState = { page: 0, formInfo: previewInfo, questions: sel, containerId: 'form-preview-body' };
  }
  
  if (typeof renderFormPreviewSurface === 'function') {
    body.innerHTML = renderFormPreviewSurface({ ...previewInfo, _previewPageIndex: 0 }, sel);
  } else {
    body.innerHTML = '<div style="padding:20px;text-align:center">Preview not available</div>';
  }
  
  openModal('form-preview-modal');
  if (pushHistory && typeof pushFormPreviewHistory === 'function') pushFormPreviewHistory();
}

// --- DRAG & DROP: Căn chỉnh/thay đổi kích thước hình ảnh ---
let isResizingImage = false;
let currentResizingImageId = null;
let startX = 0;
let startWidth = 0;
let resizeDir = '';

window.startImageResize = function(e, qid, dir) {
  isResizingImage = true;
  currentResizingImageId = qid;
  resizeDir = dir;
  startX = e.clientX;
  const imgElement = document.getElementById(`dq-img-${qid}`);
  if (!imgElement) return;
  startWidth = imgElement.offsetWidth;
  e.preventDefault();
  e.stopPropagation();
  
  document.addEventListener('mousemove', onImageResizeMove);
  document.addEventListener('mouseup', onImageResizeUp);
};

function onImageResizeMove(e) {
  if (!isResizingImage) return;
  let dx = e.clientX - startX;
  if (resizeDir === 'nw' || resizeDir === 'sw') dx = -dx;
  
  let q = typeof directQuestions !== 'undefined' ? directQuestions.find(x => sameQuestionId(x.id, currentResizingImageId)) : null;
  if (!q && typeof editFormQuestions !== 'undefined') q = editFormQuestions.find(x => sameQuestionId(x.id, currentResizingImageId));
  const align = q?.image_align || 'left';
  if (align === 'center') dx *= 2;

  const newWidth = Math.max(100, startWidth + dx);
  const imgElement = document.getElementById(`dq-img-${currentResizingImageId}`);
  if (imgElement) {
    imgElement.style.width = newWidth + 'px';
  }
}

function onImageResizeUp(e) {
  if (!isResizingImage) return;
  isResizingImage = false;
  document.removeEventListener('mousemove', onImageResizeMove);
  document.removeEventListener('mouseup', onImageResizeUp);
  const imgElement = document.getElementById(`dq-img-${currentResizingImageId}`);
  if (imgElement) {
    const finalWidth = imgElement.style.width;
    dqSetImageWidth(currentResizingImageId, finalWidth);
  }
}

window.dqSetImageWidth = function(qid, width) {
  let q = typeof directQuestions !== 'undefined' ? directQuestions.find(x => sameQuestionId(x.id, qid)) : null;
  if (q) {
    q.image_width = width;
    if (typeof recordCreateHistory === 'function') recordCreateHistory();
  } else {
    q = typeof editFormQuestions !== 'undefined' ? editFormQuestions.find(x => sameQuestionId(x.id, qid)) : null;
    if (q) {
      q.image_width = width;
    }
  }
};

// --- Bổ sung tính năng chèn ảnh vào tùy chọn và câu hỏi ---
function editQChangeImage(qi) {
  openImageSourceModal(dataUrl => {
    if (editFormQuestions[qi]) {
      editFormQuestions[qi].image = dataUrl;
      editFormQuestions[qi].hinh_anh_url = dataUrl;
      renderEditQuestions();
    }
  });
}

function _setOptImage(q, oi, dataUrl) {
  if (!q.validation_json) q.validation_json = "{}";
  let vj = {};
  try { vj = typeof q.validation_json === 'string' ? JSON.parse(q.validation_json) : q.validation_json; } catch(e){}
  if (typeof vj !== 'object' || !vj) vj = {};
  if (!vj.option_images) vj.option_images = {};
  vj.option_images[oi] = dataUrl;
  q.validation_json = JSON.stringify(vj);
}

function _removeOptImage(q, oi) {
  if (!q.validation_json) return;
  let vj = {};
  try { vj = typeof q.validation_json === 'string' ? JSON.parse(q.validation_json) : q.validation_json; } catch(e){}
  if (vj && vj.option_images && vj.option_images[oi]) {
    delete vj.option_images[oi];
    q.validation_json = JSON.stringify(vj);
  }
}

function dqChangeOptImage(id, oi) {
  openImageSourceModal(dataUrl => {
    const q = _dqFindQ(id);
    if (q) { _setOptImage(q, oi, dataUrl); renderDirectQList(); }
  });
}

function dqRemoveOptImage(id, oi) {
  const q = _dqFindQ(id);
  if (q) { _removeOptImage(q, oi); renderDirectQList(); }
}

function editQChangeOptImage(qi, oi) {
  openImageSourceModal(dataUrl => {
    if (editFormQuestions[qi]) { _setOptImage(editFormQuestions[qi], oi, dataUrl); renderEditQuestions(); }
  });
}

function editQRemoveOptImage(qi, oi) {
  if (editFormQuestions[qi]) { _removeOptImage(editFormQuestions[qi], oi); renderEditQuestions(); }
}

// --- Advanced Image Source Modal ---
let imageSourceModalCallback = null;
let webcamStream = null;

function closeImageSourceModal() {
  const modal = document.getElementById('image-source-modal');
  if (modal) modal.style.display = 'none';
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
}

function openImageSourceModal(callback) {
  imageSourceModalCallback = callback;
  let modal = document.getElementById('image-source-modal');
  if (!modal) {
    const modalHtml = `
      <div id="image-source-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;align-items:center;justify-content:center;backdrop-filter:blur(2px)">
        <div style="background:#fff;border-radius:12px;width:100%;max-width:600px;box-shadow:0 10px 25px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden;animation:slideUp .2s ease-out">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #e2e8f0">
            <h3 style="margin:0;font-size:16px;color:#1e293b;font-weight:700">Chèn hình ảnh</h3>
            <button onclick="closeImageSourceModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#64748b">&times;</button>
          </div>
          <div style="display:flex;border-bottom:1px solid #e2e8f0;padding:0 24px">
            <button class="ism-tab-btn active" data-tab="ism-upload" style="padding:12px 16px;background:none;border:none;border-bottom:2px solid #00008B;color:#00008B;font-weight:600;cursor:pointer;font-size:14px">Tải lên</button>
            <button class="ism-tab-btn" data-tab="ism-webcam" style="padding:12px 16px;background:none;border:none;border-bottom:2px solid transparent;color:#64748b;font-weight:600;cursor:pointer;font-size:14px">Webcam</button>
            <button class="ism-tab-btn" data-tab="ism-url" style="padding:12px 16px;background:none;border:none;border-bottom:2px solid transparent;color:#64748b;font-weight:600;cursor:pointer;font-size:14px">Theo URL</button>
          </div>
          <div style="padding:24px;min-height:300px;display:flex;flex-direction:column">
            
            <!-- Tab Upload -->
            <div id="ism-upload" class="ism-tab-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;border:2px dashed #cbd5e1;border-radius:8px;background:#f8fafc">
              <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" width="48" height="48" style="margin-bottom:16px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <div style="color:#64748b;margin-bottom:16px;font-size:14px">Kéo tệp vào đây hoặc</div>
              <button onclick="document.getElementById('ism-file-input').click()" style="padding:8px 16px;background:#00008B;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px">Duyệt qua máy tính</button>
              <input type="file" id="ism-file-input" accept="image/*" style="display:none" onchange="handleIsmFileUpload(event)">
            </div>
            
            <!-- Tab Webcam -->
            <div id="ism-webcam" class="ism-tab-content" style="display:none;flex-direction:column;align-items:center;flex:1">
              <div id="ism-webcam-error" style="display:none;color:#ef4444;margin-bottom:12px;font-size:13px;text-align:center">Không thể truy cập máy ảnh. Vui lòng kiểm tra quyền.</div>
              <div style="position:relative;width:100%;max-width:400px;aspect-ratio:4/3;background:#0f172a;border-radius:8px;overflow:hidden;margin-bottom:16px;display:flex;align-items:center;justify-content:center">
                <video id="ism-video" autoplay playsinline style="width:100%;height:100%;object-fit:cover;display:none;transform:scaleX(-1)"></video>
                <canvas id="ism-canvas" style="display:none"></canvas>
                <svg id="ism-webcam-placeholder" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" width="48" height="48"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
              <button id="ism-capture-btn" onclick="handleIsmCapture()" style="padding:10px 24px;background:#00008B;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;display:none">Chụp ảnh</button>
            </div>
            
            <!-- Tab URL -->
            <div id="ism-url" class="ism-tab-content" style="display:none;flex-direction:column;flex:1">
              <div style="font-size:14px;color:#334155;margin-bottom:8px;font-weight:600">Dán URL của hình ảnh:</div>
              <input type="text" id="ism-url-input" placeholder="https://..." style="padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;outline:none;width:100%;box-sizing:border-box" oninput="handleIsmUrlInput()">
              <div id="ism-url-preview-container" style="margin-top:16px;display:none;flex-direction:column;align-items:center">
                <img id="ism-url-preview" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid #e2e8f0;object-fit:contain">
              </div>
              <div style="margin-top:auto;display:flex;justify-content:flex-end">
                <button onclick="handleIsmUrlSubmit()" style="padding:10px 24px;background:#00008B;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;margin-top:16px">Chèn hình ảnh</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('image-source-modal');

    // Tab switching logic
    document.querySelectorAll('.ism-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.ism-tab-btn').forEach(b => {
          b.style.borderBottomColor = 'transparent';
          b.style.color = '#64748b';
          b.classList.remove('active');
        });
        e.target.style.borderBottomColor = '#00008B';
        e.target.style.color = '#00008B';
        e.target.classList.add('active');

        document.querySelectorAll('.ism-tab-content').forEach(c => c.style.display = 'none');
        const tabId = e.target.getAttribute('data-tab');
        document.getElementById(tabId).style.display = 'flex';

        // Manage webcam
        if (tabId === 'ism-webcam') {
          startWebcam();
        } else {
          stopWebcam();
        }
      });
    });

    // Drag drop logic
    const dropZone = document.getElementById('ism-upload');
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.background = '#eef2ff'; dropZone.style.borderColor = '#00008B'; });
    dropZone.addEventListener('dragleave', e => { e.preventDefault(); dropZone.style.background = '#f8fafc'; dropZone.style.borderColor = '#cbd5e1'; });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.style.background = '#f8fafc'; dropZone.style.borderColor = '#cbd5e1';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processIsmFile(e.dataTransfer.files[0]);
      }
    });
  }
  
  modal.style.display = 'flex';
  // reset to default tab
  document.querySelector('.ism-tab-btn[data-tab="ism-upload"]').click();
  document.getElementById('ism-file-input').value = '';
  document.getElementById('ism-url-input').value = '';
  document.getElementById('ism-url-preview-container').style.display = 'none';
}

function processIsmFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => {
    if (imageSourceModalCallback) imageSourceModalCallback(e.target.result);
    closeImageSourceModal();
  };
  reader.readAsDataURL(file);
}

function handleIsmFileUpload(e) {
  if (e.target.files && e.target.files[0]) {
    processIsmFile(e.target.files[0]);
  }
}

async function startWebcam() {
  const video = document.getElementById('ism-video');
  const errorMsg = document.getElementById('ism-webcam-error');
  const placeholder = document.getElementById('ism-webcam-placeholder');
  const btn = document.getElementById('ism-capture-btn');
  
  errorMsg.style.display = 'none';
  
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = webcamStream;
    video.style.display = 'block';
    placeholder.style.display = 'none';
    btn.style.display = 'block';
  } catch(err) {
    errorMsg.style.display = 'block';
    video.style.display = 'none';
    placeholder.style.display = 'block';
    btn.style.display = 'none';
  }
}

function stopWebcam() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
  const video = document.getElementById('ism-video');
  if(video) video.style.display = 'none';
  const placeholder = document.getElementById('ism-webcam-placeholder');
  if(placeholder) placeholder.style.display = 'block';
  const btn = document.getElementById('ism-capture-btn');
  if(btn) btn.style.display = 'none';
}

function handleIsmCapture() {
  const video = document.getElementById('ism-video');
  const canvas = document.getElementById('ism-canvas');
  if (!video || video.style.display === 'none') return;
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  // mirror the image if video is mirrored
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  const dataUrl = canvas.toDataURL('image/png');
  if (imageSourceModalCallback) imageSourceModalCallback(dataUrl);
  closeImageSourceModal();
}

function handleIsmUrlInput() {
  const val = document.getElementById('ism-url-input').value.trim();
  const preview = document.getElementById('ism-url-preview');
  const container = document.getElementById('ism-url-preview-container');
  if (val) {
    preview.src = val;
    preview.onload = () => container.style.display = 'flex';
    preview.onerror = () => container.style.display = 'none';
  } else {
    container.style.display = 'none';
  }
}

function handleIsmUrlSubmit() {
  const val = document.getElementById('ism-url-input').value.trim();
  if (val && imageSourceModalCallback) {
    imageSourceModalCallback(val);
    closeImageSourceModal();
  }
}

function initCreateFormFlatpickr() {
  if (typeof flatpickr !== 'undefined') {
    const customVnLocale = (flatpickr.l10ns && flatpickr.l10ns.vn) ? { ...flatpickr.l10ns.vn } : {};
    customVnLocale.months = {
      shorthand: ["Thg 01", "Thg 02", "Thg 03", "Thg 04", "Thg 05", "Thg 06", "Thg 07", "Thg 08", "Thg 09", "Thg 10", "Thg 11", "Thg 12"],
      longhand: [
        "Tháng 01", "Tháng 02", "Tháng 03", "Tháng 04", "Tháng 05", "Tháng 06",
        "Tháng 07", "Tháng 08", "Tháng 09", "Tháng 10", "Tháng 11", "Tháng 12"
      ]
    };

    flatpickr("#new-approval-deadline-display", {
      enableTime: true,
      dateFormat: "d/m/Y H:i",
      time_24hr: true,
      defaultHour: 23,
      defaultMinute: 59,
      locale: customVnLocale,
      minDate: "today",
      onChange: function(selectedDates, dateStr) {
        const hidden = document.getElementById('new-approval-deadline');
        if (hidden) {
          if (selectedDates.length > 0) {
            const d = selectedDates[0];
            const pad = n => String(n).padStart(2, '0');
            hidden.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          } else {
            hidden.value = '';
          }
          validateApprovalDeadlineField();
        }
      }
    });

    flatpickr("#new-form-close-display", {
      enableTime: true,
      dateFormat: "d/m/Y H:i",
      time_24hr: true,
      defaultHour: 23,
      defaultMinute: 59,
      locale: customVnLocale,
      minDate: "today",
      onChange: function(selectedDates, dateStr) {
        const hidden = document.getElementById('new-form-close');
        if (hidden) {
          if (selectedDates.length > 0) {
            const d = selectedDates[0];
            const pad = n => String(n).padStart(2, '0');
            hidden.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          } else {
            hidden.value = '';
          }
        }
      }
    });
  }
}
