// ═══════════════════════════════════════════════════════════════
//  FLIC – Quản lý Phản hồi  (feedback.js)
//  Màn hình chính: danh sách FORM dạng card
//  Bấm vào form → xem tất cả phản hồi + câu hỏi/trả lời của form đó
// ═══════════════════════════════════════════════════════════════

const API = API_BASE;

// ── Helpers ───────────────────────────────────────────────────
const sentimentIcon = s =>
  s === 'positive' ? '<span style="color:#10b981;font-size:16px">😊</span>' :
                     '<span style="color:#ef4444;font-size:16px">😞</span>';

const fbStatusBadge = s =>
  s === 'new'      ? '<span class="badge badge-blue">Mới</span>' :
  s === 'archived' ? '<span class="badge badge-gray">Lưu trữ</span>' : '';

const stars = n => Array.from({length:5}, (_,i) =>
  `<svg viewBox="0 0 24 24" fill="${i<n?'#f59e0b':'#e2e8f0'}" width="13" height="13">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`).join('');

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

function avatarColor(id) {
  const colors = ['#00008B','#10b981','#8b5cf6','#f59e0b','#ec4899','#ef4444','#f97316'];
  return colors[(id || 0) % colors.length];
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
}

// ── State ─────────────────────────────────────────────────────
let allForms     = [];   // { id, ten_form, danh_muc, so_phan_hoi, tong_luot_xem, diem_tb }
let activeFbId   = null;
let activeFormId = null; // khi đang xem detail của 1 form
let allFeedbacks = [];

// ── Render khung HTML gốc ────────────────────────────────────
document.getElementById('page-content').innerHTML = `
  <!-- ── BREADCRUMB (ẩn lúc đầu, hiện khi vào form) ── -->
  <div id="fb-breadcrumb" style="display:none;align-items:center;gap:8px;margin-bottom:16px">
    <button onclick="backToFormList()"
      style="display:flex;align-items:center;gap:5px;padding:7px 14px;border-radius:9px;border:1.5px solid #00008B;background:#00008B;font-size:12.5px;color:#fff;cursor:pointer;font-weight:600;transition:all .15s;opacity:.75"
      onmouseenter="this.style.opacity='1';this.style.borderColor='#00008B'"
      onmouseleave="this.style.opacity='.75';this.style.borderColor='#00008B'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="15 18 9 12 15 6"/></svg>
      Danh sách form
    </button>
    <svg viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2" width="13" height="13"><polyline points="9 18 15 12 9 6"/></svg>
    <span id="fb-breadcrumb-name" onclick="openFormViewModal()"
      style="font-size:14px;font-weight:600;color:#00008B;cursor:pointer;transition:color .15s"
      onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='#00008B'"
      title="Bấm để xem cấu trúc form"></span>
    <span id="fb-breadcrumb-badge" style="padding:3px 10px;border-radius:999px;background:#00008B;color:#fff;font-size:12px;font-weight:600"></span>
  </div>

  <!-- ── VIEW 1: DANH SÁCH FORM ── -->
  <div id="fb-view-forms">
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
      <div>
        <h2 class="page-title">Quản lý phản hồi</h2>
        <p class="page-sub">Chọn một form để xem phản hồi từ khách hàng</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="fb-form-cat-filter" class="input" style="width:160px" onchange="renderFormCards()">
          <option value="">Tất cả danh mục</option>
          <option value="Ngoại ngữ">Ngoại ngữ</option>
          <option value="Tin học">Tin học</option>
        </select>
      </div>
    </div>

    <!-- Stat bar -->
    <div id="fb-stat-bar" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px"></div>

    <!-- Charts -->
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:24px;margin-bottom:30px">
      <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #f1f5f9;box-shadow:0 4px 12px rgba(0,0,0,0.02)">
        <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:4px">Điểm hài lòng trung bình theo tháng</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:20px">Thang 5 sao · 7 tháng gần nhất</div>
        <div style="height:210px;position:relative"><canvas id="fb-line-chart"></canvas></div>
      </div>
      <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #f1f5f9;box-shadow:0 4px 12px rgba(0,0,0,0.02);display:flex;flex-direction:column">
        <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:4px">Tỷ lệ cảm xúc</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:20px">Phân loại thái độ người dùng</div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px;flex:1;justify-content:center">
          <div style="width:160px;height:160px;position:relative"><canvas id="fb-pie-chart"></canvas></div>
          <div id="fb-sent-legend" style="width:100%;font-size:13px;display:flex;justify-content:center;gap:12px;flex-wrap:wrap"></div>
        </div>
      </div>
    </div>

    <!-- Form list -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-size:15px;font-weight:800;color:#0f172a">Danh sách Biểu mẫu</div>
      <div style="font-size:13px;color:#64748b;font-weight:500">
        Đang hiển thị <span id="fb-form-count" style="font-weight:700;color:#0f172a"></span>
      </div>
    </div>
    <div style="background:#fff;border-radius:16px;border:1px solid #f1f5f9;box-shadow:0 4px 12px rgba(0,0,0,0.02);overflow:hidden">
      <div id="fb-form-grid"></div>
    </div>
  </div>

  <!-- ── VIEW 2: PHẢN HỒI CỦA 1 FORM ── -->
  <div id="fb-view-detail" style="display:none">
    <!-- Filter bar full-width -->
    <div id="fb-detail-filterbar" style="position:sticky;top:8px;z-index:30;display:flex;flex-wrap:wrap;gap:16px;align-items:center;margin-bottom:24px;padding:16px 20px;background:#fff;border-radius:12px;border:1px solid #f1f5f9;box-shadow:0 4px 16px rgba(0,0,0,0.03)">
      <div class="input-wrap" style="flex:1;min-width:200px">
        <span class="input-icon" style="color:#94a3b8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <input id="fb-detail-search" class="input" placeholder="Tìm tên khách hàng hoặc email..." oninput="filterDetailList()" style="padding-left:40px;height:40px;border-radius:8px">
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        <select id="fb-detail-status" class="input" onchange="filterDetailList()" style="height:40px;border-radius:8px;min-width:140px">
          <option value="">Trạng thái: Tất cả</option>
          <option value="new">Mới</option>
          <option value="archived">Đã lưu trữ</option>
        </select>
        <select id="fb-detail-rating" class="input" onchange="filterDetailList()" style="height:40px;border-radius:8px;min-width:120px">
          <option value="">Số sao: Tất cả</option>
          <option value="5">5 sao</option>
          <option value="4">4 sao</option>
          <option value="3">3 sao</option>
          <option value="2">2 sao</option>
          <option value="1">1 sao</option>
        </select>
        <div style="width:1px;height:24px;background:#e2e8f0;margin:0 8px"></div>
        <span id="fb-detail-count" style="font-size:13.5px;color:#64748b;font-weight:600;white-space:nowrap"></span>
      </div>
    </div>

    <!-- Response list -->
    <div id="fb-response-list" style="display:flex;flex-direction:column;gap:14px"></div>
  </div>

  <!-- ══ MODAL: Chi tiết phản hồi + câu hỏi/trả lời ══ -->
  <div class="modal-overlay" id="fb-resp-modal">
    <div class="modal" style="max-width:680px;max-height:88vh;display:flex;flex-direction:column;border-radius:24px;padding:0;overflow:hidden" onclick="event.stopPropagation()">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #f1f5f9;background:#fff">
        <span style="font-size:18px;font-weight:800;color:#0f172a">Chi tiết phản hồi</span>
        <button onclick="closeModal('fb-resp-modal')" style="background:#f1f5f9;border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b;transition:background .15s" onmouseenter="this.style.background='#e2e8f0'" onmouseleave="this.style.background='#f1f5f9'">${IC.close}</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:24px;background:#f8fafc" id="fb-resp-modal-body"></div>
      <div style="padding:16px 24px;border-top:1px solid #f1f5f9;background:#fff;display:flex;justify-content:flex-end">
        <button onclick="closeModal('fb-resp-modal')" style="padding:10px 20px;border-radius:10px;border:none;background:#f1f5f9;color:#0f172a;font-weight:700;cursor:pointer">Đóng</button>
      </div>
    </div>
  </div>



  <!-- ══ MODAL: Xác nhận xóa ══ -->
  <div class="modal-overlay" id="fb-delete-modal">
    <div class="modal" style="max-width:400px" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:#fee2e2;display:flex;align-items:center;justify-content:center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <span class="modal-title">Xác nhận xóa</span>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('fb-delete-modal')">${IC.close}</button>
      </div>
      <div class="modal-body">
        <p style="color:var(--gray-600);margin-bottom:14px">Bạn có chắc muốn xóa phản hồi này? Hành động không thể hoàn tác.</p>
        <div id="fb-del-preview" style="background:var(--gray-50);border-radius:var(--radius);padding:12px;font-size:13px;color:var(--gray-700)"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('fb-delete-modal')">Hủy</button>
        <button class="btn btn-primary" style="background:#dc2626;border-color:#dc2626" onclick="confirmDeleteFb()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>Xóa
        </button>
      </div>
    </div>
  </div>

  <!-- ══ MODAL: Xem cấu trúc form ══ -->
  <div class="modal-overlay" id="fb-form-view-modal" onclick="closeModal('fb-form-view-modal')">
    <div class="modal" style="max-width:680px;max-height:90vh;display:flex;flex-direction:column" onclick="event.stopPropagation()">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 22px;background:#fff;border-bottom:1px solid #e2e8f0;flex-shrink:0">
        <div style="min-width:0;flex:1">
          <div style="font-size:16px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" id="fb-form-view-title"></div>
          <div style="font-size:12px;color:#64748b;margin-top:3px" id="fb-form-view-meta"></div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('fb-form-view-modal')" style="background:#00008B;border:1px solid #00008B;color:#fff;flex-shrink:0;margin-left:12px">${IC.close}</button>
      </div>
      <div class="modal-body" style="flex:1;overflow-y:auto;padding:20px 22px;background:#f1f5f9" id="fb-form-view-body">
        <div style="text-align:center;padding:40px;color:var(--gray-400)">Đang tải...</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('fb-form-view-modal')">Đóng</button>
      </div>
    </div>
  </div>
`;

// ────────────────────────────────────────────────────────────────
//  DATA LAYER  (dùng dữ liệu mẫu – dễ thay bằng fetch API)
// ────────────────────────────────────────────────────────────────

// Dữ liệu form mẫu
const SAMPLE_FORMS = [
  { id:1, ten_form:'Đăng ký khóa học Tiếng Anh giao tiếp', danh_muc:'Ngoại ngữ', luot_xem:3456 },
  { id:2, ten_form:'Khảo sát mức độ hài lòng học viên',    danh_muc:'Ngoại ngữ', luot_xem:2345 },
  { id:3, ten_form:'Đăng ký thi chứng chỉ Tin học',        danh_muc:'Tin học',   luot_xem:1890 },
  { id:5, ten_form:'Đăng ký học thử miễn phí',             danh_muc:'Ngoại ngữ', luot_xem:4567 },
  { id:7, ten_form:'Đăng ký tư vấn lộ trình học',          danh_muc:'Ngoại ngữ', luot_xem:1567 },
  { id:8, ten_form:'Khảo sát nhu cầu mở lớp mới',          danh_muc:'Tin học',   luot_xem:789  },
];

// Dữ liệu phản hồi mẫu gắn với câu hỏi/trả lời
const SAMPLE_FEEDBACKS = [
  {
    id:1, form_id:1, ho_ten:'Nguyễn Minh Anh', email:'anh@email.com',
    danh_gia:5, noi_dung:'Form rất dễ sử dụng và điền thông tin thuận tiện!',
    cam_xuc:'positive', trang_thai:'new', ngay_gui:'2026-03-14',
    tra_loi:null, ngay_tra_loi:null,
    chi_tiet:[
      { ten_cau_hoi:'Bạn muốn đăng ký khóa học nào?',   loai_cau_hoi:'choice', ten_lua_chon:'IELTS',           noi_dung:null },
      { ten_cau_hoi:'Trình độ hiện tại của bạn?',        loai_cau_hoi:'choice', ten_lua_chon:'Trung cấp',       noi_dung:null },
      { ten_cau_hoi:'Thời gian học phù hợp với bạn?',   loai_cau_hoi:'choice', ten_lua_chon:'Tối (18h-21h)',   noi_dung:null },
      { ten_cau_hoi:'Bạn có câu hỏi thêm không?',       loai_cau_hoi:'text',   ten_lua_chon:null,              noi_dung:'Khi nào khai giảng lớp IELTS tháng 4?' },
    ]
  },
  {
    id:2, form_id:1, ho_ten:'Trần Văn Bình', email:'binh@email.com',
    danh_gia:4, noi_dung:'Khá tốt nhưng cần thêm một số trường thông tin.',
    cam_xuc:'positive', trang_thai:'new', ngay_gui:'2026-03-13',
    tra_loi:'Cảm ơn bạn đã phản hồi, chúng tôi sẽ cải thiện!', ngay_tra_loi:'2026-03-13',
    chi_tiet:[
      { ten_cau_hoi:'Bạn muốn đăng ký khóa học nào?',   loai_cau_hoi:'choice', ten_lua_chon:'Tiếng Anh cơ bản', noi_dung:null },
      { ten_cau_hoi:'Trình độ hiện tại của bạn?',        loai_cau_hoi:'choice', ten_lua_chon:'Mới bắt đầu',      noi_dung:null },
      { ten_cau_hoi:'Thời gian học phù hợp với bạn?',   loai_cau_hoi:'choice', ten_lua_chon:'Cuối tuần',        noi_dung:null },
      { ten_cau_hoi:'Bạn có câu hỏi thêm không?',       loai_cau_hoi:'text',   ten_lua_chon:null,              noi_dung:'' },
    ]
  },
  {
    id:6, form_id:1, ho_ten:'Vũ Minh Phúc', email:'phuc@email.com',
    danh_gia:4, noi_dung:'Giao diện đẹp, thân thiện với người dùng.',
    cam_xuc:'positive', trang_thai:'new', ngay_gui:'2026-03-10',
    tra_loi:null, ngay_tra_loi:null,
    chi_tiet:[
      { ten_cau_hoi:'Bạn muốn đăng ký khóa học nào?',   loai_cau_hoi:'choice', ten_lua_chon:'TOEIC',            noi_dung:null },
      { ten_cau_hoi:'Trình độ hiện tại của bạn?',        loai_cau_hoi:'choice', ten_lua_chon:'Sơ cấp',           noi_dung:null },
      { ten_cau_hoi:'Thời gian học phù hợp với bạn?',   loai_cau_hoi:'choice', ten_lua_chon:'Sáng (7h-11h)',    noi_dung:null },
      { ten_cau_hoi:'Bạn có câu hỏi thêm không?',       loai_cau_hoi:'text',   ten_lua_chon:null,              noi_dung:'Học phí như thế nào?' },
    ]
  },
  {
    id:3, form_id:2, ho_ten:'Lê Thị Cúc', email:'cuc@email.com',
    danh_gia:2, noi_dung:'Form bị lỗi khi submit trên điện thoại.',
    cam_xuc:'negative', trang_thai:'new', ngay_gui:'2026-03-12',
    tra_loi:null, ngay_tra_loi:null,
    chi_tiet:[
      { ten_cau_hoi:'Bạn hài lòng như thế nào về chất lượng giảng dạy?', loai_cau_hoi:'rating', ten_lua_chon:'2 - Không hài lòng', noi_dung:null },
      { ten_cau_hoi:'Cơ sở vật chất đáp ứng nhu cầu chưa?',             loai_cau_hoi:'rating', ten_lua_chon:'3 - Trung bình',      noi_dung:null },
      { ten_cau_hoi:'Bạn có giới thiệu FLIC cho người thân không?',      loai_cau_hoi:'choice', ten_lua_chon:'Chưa chắc',           noi_dung:null },
      { ten_cau_hoi:'Bạn muốn FLIC cải thiện điều gì?',                  loai_cau_hoi:'text',   ten_lua_chon:null, noi_dung:'Cần sửa lỗi submit trên mobile' },
    ]
  },
  {
    id:4, form_id:2, ho_ten:'Phạm Quốc Dũng', email:'dung@email.com',
    danh_gia:3, noi_dung:'Bình thường, không có gì đặc biệt.',
    cam_xuc:'negative', trang_thai:'archived', ngay_gui:'2026-03-11',
    tra_loi:null, ngay_tra_loi:null,
    chi_tiet:[
      { ten_cau_hoi:'Bạn hài lòng như thế nào về chất lượng giảng dạy?', loai_cau_hoi:'rating', ten_lua_chon:'3 - Bình thường', noi_dung:null },
      { ten_cau_hoi:'Cơ sở vật chất đáp ứng nhu cầu chưa?',             loai_cau_hoi:'rating', ten_lua_chon:'3 - Trung bình',  noi_dung:null },
      { ten_cau_hoi:'Bạn có giới thiệu FLIC cho người thân không?',      loai_cau_hoi:'choice', ten_lua_chon:'Có thể có',       noi_dung:null },
      { ten_cau_hoi:'Bạn muốn FLIC cải thiện điều gì?',                  loai_cau_hoi:'text',   ten_lua_chon:null, noi_dung:'' },
    ]
  },
  {
    id:7, form_id:2, ho_ten:'Đỗ Thị Giang', email:'giang@email.com',
    danh_gia:1, noi_dung:'Không thể submit form, bị lỗi liên tục.',
    cam_xuc:'negative', trang_thai:'new', ngay_gui:'2026-03-09',
    tra_loi:null, ngay_tra_loi:null,
    chi_tiet:[
      { ten_cau_hoi:'Bạn hài lòng như thế nào về chất lượng giảng dạy?', loai_cau_hoi:'rating', ten_lua_chon:'1 - Rất không hài lòng', noi_dung:null },
      { ten_cau_hoi:'Cơ sở vật chất đáp ứng nhu cầu chưa?',             loai_cau_hoi:'rating', ten_lua_chon:'1 - Rất kém',            noi_dung:null },
      { ten_cau_hoi:'Bạn có giới thiệu FLIC cho người thân không?',      loai_cau_hoi:'choice', ten_lua_chon:'Không',                  noi_dung:null },
      { ten_cau_hoi:'Bạn muốn FLIC cải thiện điều gì?',                  loai_cau_hoi:'text',   ten_lua_chon:null, noi_dung:'Sửa lỗi kỹ thuật khẩn cấp' },
    ]
  },
  {
    id:5, form_id:3, ho_ten:'Hoàng Thị Em', email:'em@email.com',
    danh_gia:5, noi_dung:'Tuyệt vời! Hệ thống hoạt động rất nhanh và ổn định.',
    cam_xuc:'positive', trang_thai:'new', ngay_gui:'2026-03-10',
    tra_loi:'Xin cảm ơn, chúng tôi rất vui được phục vụ bạn!', ngay_tra_loi:'2026-03-11',
    chi_tiet:[]
  },
  {
    id:8, form_id:5, ho_ten:'Ngô Văn Hùng', email:'hung@email.com',
    danh_gia:5, noi_dung:'Đăng ký nhanh, nhân viên tư vấn nhiệt tình.',
    cam_xuc:'positive', trang_thai:'new', ngay_gui:'2026-03-08',
    tra_loi:'Cảm ơn bạn Hùng! Hẹn gặp bạn ở buổi học thử!', ngay_tra_loi:'2026-03-08',
    chi_tiet:[]
  },
];

// ── Tổng hợp dữ liệu form ────────────────────────────────────
function buildFormSummary() {
  return SAMPLE_FORMS.map(form => {
    const fbs = SAMPLE_FEEDBACKS.filter(f => f.form_id === form.id);
    const rated = fbs.filter(f => f.danh_gia != null && f.danh_gia > 0);
    const avgRating = rated.length
      ? (rated.reduce((s,f) => s + Number(f.danh_gia), 0) / rated.length).toFixed(1)
      : null;
    const newCount = fbs.filter(f => f.trang_thai === 'new').length;
    return {
      ...form,
      so_phan_hoi: fbs.length,
      diem_tb: avgRating,
      so_moi: newCount,
    };
  }).filter(f => f.so_phan_hoi > 0);
}

async function loadRealForms() {
  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API}/reports/forms-with-data`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('load forms failed');
    const data = await res.json();
    return data.map((item) => ({
      ...item,
      id: Number(item.id),
      luot_xem: Number(item.luot_xem || 0),
      so_phan_hoi: Number(item.so_phan_hoi || 0),
      diem_tb: (item.diem_tb != null && !isNaN(Number(item.diem_tb))) ? Number(item.diem_tb).toFixed(1) : null,
    }));
  } catch (e) {
    return buildFormSummary();
  }
}

async function loadRealFeedbacks(formId = '') {
  try {
    const url = formId ? `${API}/feedback?form_id=${formId}` : `${API}/feedback`;
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('load feedback failed');
    return await res.json();
  } catch (e) {
    return formId ? SAMPLE_FEEDBACKS.filter((f) => f.form_id === formId) : SAMPLE_FEEDBACKS;
  }
}

// ════════════════════════════════════════════════════════════════
//  VIEW 1 – DANH SÁCH FORM
// ════════════════════════════════════════════════════════════════

function renderFormCards() {
  const cat = document.getElementById('fb-form-cat-filter')?.value || '';
  const filtered = allForms.filter(f => !cat || f.danh_muc === cat);
  document.getElementById('fb-form-count').textContent = `${filtered.length} / ${allForms.length}`;
  const grid = document.getElementById('fb-form-grid');
  if (!filtered.length) {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">Không tìm thấy biểu mẫu nào.</div>';
    return;
  }
  const catColors = {'Ngoại ngữ':'#00008B','Tin học':'#10b981','Đánh giá':'#8b5cf6','Phản hồi':'#f59e0b','Tư vấn':'#ec4899','Khác':'#64748b'};
  const statusBadge = s =>
    s==='active' ? '<span style="display:inline-flex;padding:4px 10px;background:#dcfce7;color:#16a34a;border-radius:6px;font-size:12px;font-weight:700">Hoạt động</span>' :
    s==='draft'  ? '<span style="display:inline-flex;padding:4px 10px;background:#fef3c7;color:#d97706;border-radius:6px;font-size:12px;font-weight:700">Nháp</span>' :
                   '<span style="display:inline-flex;padding:4px 10px;background:#f1f5f9;color:#64748b;border-radius:6px;font-size:12px;font-weight:700">Lưu trữ</span>';
  grid.innerHTML = filtered.map((f, idx) => {
    const color  = catColors[f.danh_muc] || '#64748b';
    const isLast = idx === filtered.length - 1;
    return `<div onclick="openFormDetail(${f.id})"
         style="display:flex;align-items:center;gap:20px;padding:20px 24px;cursor:pointer;border-bottom:${isLast?'none':'1px solid #f1f5f9'};transition:all .2s;background:#fff"
         onmouseenter="this.style.background='#f8fafc';this.style.transform='translateX(4px)'" onmouseleave="this.style.background='#fff';this.style.transform='translateX(0)'">
      <div style="width:48px;height:48px;border-radius:12px;background:${color}15;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:15px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px">${f.ten_form}</div>
        <div style="font-size:13px;color:#64748b;font-weight:500">${f.danh_muc}</div>
      </div>
      <div style="flex-shrink:0;width:120px;text-align:left">${statusBadge(f.trang_thai||'active')}</div>
      <div style="flex-shrink:0;width:100px;text-align:right">
        <div style="font-size:17px;font-weight:800;color:#0f172a;line-height:1">${f.so_phan_hoi}</div>
        <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-top:4px">Phản hồi</div>
      </div>
      <div style="flex-shrink:0;margin-left:12px;color:#cbd5e1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>`;
  }).join('');
}

function populateCatFilter() {
  // Category filter removed; only Ngoại ngữ and Tin học are used as danh_muc values
}

function renderStatBar(fbs) {
  const total    = fbs.length;
  const rated    = fbs.filter(f => f.danh_gia != null && f.danh_gia > 0);
  const avgRating = rated.length
    ? (rated.reduce((s, f) => s + Number(f.danh_gia), 0) / rated.length).toFixed(1)
    : '0';
  const posCount = fbs.filter(f=>f.cam_xuc==='positive').length;

  const items = [
    { label:'Tổng số phản hồi',  value: total,    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', color:'#00008B' },
    { label:'Điểm trung bình',   value: avgRating, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', color:'#10b981' },
    { label:'Đánh giá tích cực', value: posCount, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>', color:'#8b5cf6' },
  ];

  document.getElementById('fb-stat-bar').innerHTML = items.map(i => `
    <div style="background:#fff; border-radius:12px; padding:20px; display:flex; align-items:center; gap:16px; border:1px solid #f1f5f9; box-shadow:0 4px 12px rgba(0,0,0,0.02)">
      <div style="width:48px;height:48px;border-radius:12px;background:${i.color}15;color:${i.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i.icon}</div>
      <div>
        <div style="font-size:24px;font-weight:800;color:#0f172a;line-height:1.2">${i.value}</div>
        <div style="font-size:13px;color:#64748b;font-weight:500;margin-top:2px">${i.label}</div>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════════════════════════════════
//  VIEW 2 – PHẢN HỒI CỦA 1 FORM
// ════════════════════════════════════════════════════════════════

let currentFormFeedbacks = [];  // danh sách gốc của form đang xem

async function openFormDetail(formId) {
  activeFormId = formId;
  const form = allForms.find(f => f.id === formId);
  if (!form) return;

  currentFormFeedbacks = await loadRealFeedbacks(formId);

  // Reset filters
  document.getElementById('fb-detail-search').value  = '';
  document.getElementById('fb-detail-status').value  = '';
  document.getElementById('fb-detail-rating').value  = '';

  // Breadcrumb
  document.getElementById('fb-breadcrumb-name').textContent = form.ten_form;
  document.getElementById('fb-breadcrumb-badge').textContent = `${form.so_phan_hoi ?? currentFormFeedbacks.length} phản hồi`;
  document.getElementById('fb-breadcrumb').style.display = 'flex';

  // Switch views
  document.getElementById('fb-view-forms').style.display  = 'none';
  document.getElementById('fb-view-detail').style.display = 'block';

  filterDetailList();
}

function backToFormList() {
  document.getElementById('fb-view-detail').style.display = 'none';
  document.getElementById('fb-view-forms').style.display  = 'block';
  document.getElementById('fb-breadcrumb').style.display  = 'none';
  activeFormId = null;
}

function goToFormReport() {
  if (!activeFormId) return;
  const form = allForms.find(f => f.id === activeFormId);
  if (!form) return;
  localStorage.setItem('_pendingForm', JSON.stringify({ id: form.id, name: form.ten_form }));
  window.location.href = 'reports.html';
}

// ── Helpers xem cấu trúc form ──────────────────────────────
function fbEsc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fbNormalizeType(t) {
  if (t==='text'||t==='short_text'||t==='long_text') return 'paragraph';
  if (t==='star_rating') return 'rating';
  return t;
}
function fbTypeChip(t) {
  const n = fbNormalizeType(t);
  const map = {
    choice:'Trắc nghiệm', checkbox:'Hộp kiểm', dropdown:'Thả xuống',
    rating:'Xếp hạng', scale:'Tuyến tính', paragraph:'Tự luận',
    grid_radio:'Lưới trắc nghiệm', grid_checkbox:'Lưới hộp kiểm',
    date:'Ngày', time:'Giờ'
  };
  return map[n] || t || 'Khác';
}
function fbRenderQuestion(q, idx) {
  const n = fbNormalizeType(q.loai || q.type || 'choice');
  const opts = Array.isArray(q.lua_chon) ? q.lua_chon.map(o => typeof o === 'string' ? o : (o.noi_dung||'')) :
               Array.isArray(q.opts) ? q.opts : [];
  let answerHtml = '';
  if (n === 'paragraph') {
    answerHtml = `<textarea disabled rows="3" placeholder="Nhập câu trả lời..." style="width:100%;padding:12px 14px;border:1px solid #cfe0ff;border-radius:12px;font-size:13px;color:#94a3b8;background:#fff;resize:none;outline:none;box-sizing:border-box"></textarea>`;
  } else if (n === 'choice' || n === 'checkbox' || n === 'rating' || n === 'scale') {
    const kind = n === 'checkbox' ? 'checkbox' : 'radio';
    answerHtml = `<div style="display:flex;flex-direction:column;gap:8px">
      ${opts.map(o => `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;font-size:13px;color:#334155">
        <span style="width:15px;height:15px;border:2px solid #00008B;border-radius:${kind==='checkbox'?'4px':'50%'};display:inline-block;flex-shrink:0;background:#fff"></span>
        ${fbEsc(o)}
      </div>`).join('')}
    </div>`;
  } else if (n === 'dropdown') {
    answerHtml = `<select disabled style="padding:10px 14px;border:1px solid #cfe0ff;border-radius:12px;font-size:13px;color:#64748b;background:#fff;outline:none;min-width:200px">
      <option>Chọn một mục...</option>
      ${opts.map(o=>`<option>${fbEsc(o)}</option>`).join('')}
    </select>`;
  }
  return `<div style="border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.05)">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <span style="display:inline-flex;align-items:center;padding:4px 12px;border-radius:999px;background:#00008B;color:#fff;font-size:11.5px;font-weight:700">${fbTypeChip(q.loai||q.type)}</span>
      ${(q.bat_buoc||q.required) ? '<span style="display:inline-flex;align-items:center;padding:4px 12px;border-radius:999px;background:#fee2e2;color:#dc2626;font-size:11.5px;font-weight:700">Bắt buộc</span>' : ''}
    </div>
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:14px">
      <div style="width:28px;height:28px;border-radius:50%;background:#00008B;color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${idx + 1}</div>
      <div style="font-size:16px;font-weight:700;color:#0f172a;line-height:1.5;padding-top:4px">${fbEsc(q.noi_dung || q.text || '')}</div>
    </div>
    ${answerHtml}
  </div>`;
}

async function openFormViewModal() {
  if (!activeFormId) return;
  const formMeta = allForms.find(f => f.id === activeFormId) || {};
  const title = formMeta.ten_form || '';
  const cat   = formMeta.danh_muc || '';
  const created = formMeta.ngay_tao ? new Date(formMeta.ngay_tao).toLocaleDateString('vi-VN') : '';

  // helpers giống reports.js
  const rEsc = v => String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const rNorm = t => { if(t==='text'||t==='short_text'||t==='long_text') return 'paragraph'; if(t==='star_rating') return 'rating'; return t||'choice'; };
  const rLabel = t => ({choice:'Trắc nghiệm',checkbox:'Hộp kiểm',dropdown:'Thả xuống',paragraph:'Đoạn văn',rating:'Xếp hạng',scale:'Tuyến tính',grid_radio:'Lưới trắc nghiệm',grid_checkbox:'Lưới hộp kiểm'}[rNorm(t)] || t || 'Khác');
  const rOpts = (opts, kind) => `<div style="display:flex;flex-direction:column;gap:0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;margin-top:10px">
    ${opts.map(o=>`<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#374151">
      <span style="width:16px;height:16px;border:1.8px solid #00008B;border-radius:${kind==='checkbox'?'4px':'50%'};display:inline-block;flex-shrink:0;background:#fff"></span>
      ${rEsc(o)}</div>`).join('')}</div>`;
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
            ${req?'<span style="padding:5px 10px;border-radius:999px;background:#fee2e2;color:#dc2626;font-size:11.5px;font-weight:700">Bắt buộc</span>':''}
          </div>
          <div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:2px;line-height:1.4">${rEsc(q.noi_dung||q.text||'')}</div>
          ${ans}
        </div>
      </div>
    </div>`;
  };

  // Cập nhật header modal
  document.getElementById('fb-form-view-title').textContent = title;
  document.getElementById('fb-form-view-meta').textContent = cat + (cat && created ? ' · ' : '') + (created ? 'Ngày tạo: ' + created : '');
  document.getElementById('fb-form-view-body').innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Đang tải câu hỏi...</div>';
  openModal('fb-form-view-modal');

  try {
    const tkn = localStorage.getItem('token') || '';
    const res = await fetch(`${API}/forms/${activeFormId}`, {
      headers: tkn ? { Authorization: `Bearer ${tkn}` } : {}
    });
    if (!res.ok) throw new Error('Không tải được form');
    const data = await res.json();
    const qs = (data.cau_hoi || []).map(q => ({
      noi_dung: q.noi_dung, loai: q.loai, bat_buoc: q.bat_buoc,
      lua_chon: (q.lua_chon||[]).map(o=>typeof o==='string'?o:(o.noi_dung||''))
    }));
    const body = document.getElementById('fb-form-view-body');
    if (!body) return;
    if (!qs.length) { body.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Form chưa có câu hỏi nào.</div>'; return; }
    body.innerHTML = `
      <div style="background:linear-gradient(135deg,#00008B 0%,#00008B 52%,#00008B 100%);border-radius:20px;padding:22px 24px;margin-bottom:18px;color:#00008B;box-shadow:0 16px 36px rgba(0,0,139,.13)">
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          ${cat?`<span style="font-size:12px;background:rgba(255,255,255,.55);padding:5px 12px;border-radius:999px;font-weight:700">${rEsc(cat)}</span>`:''}
          <span style="font-size:12px;background:rgba(255,255,255,.55);padding:5px 12px;border-radius:999px;font-weight:700">Tổng ${qs.length} câu hỏi</span>
        </div>
        <div style="font-size:28px;font-weight:800;line-height:1.2;letter-spacing:-0.01em">${rEsc(title)}</div>
        ${created?`<div style="font-size:13px;margin-top:8px;opacity:.85">Ngày tạo: <strong>${created}</strong></div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${qs.map((q,i) => rQ(q,i)).join('')}
      </div>`;
  } catch(e) {
    document.getElementById('fb-form-view-body').innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444">Lỗi: ${rEsc(e.message)}</div>`;
  }
}

function filterDetailList() {
  const search = (document.getElementById('fb-detail-search')?.value || '').toLowerCase();
  const status = document.getElementById('fb-detail-status')?.value || '';
  const rating = document.getElementById('fb-detail-rating')?.value || '';

  const filtered = currentFormFeedbacks.filter(f =>
    (!search || (f.ho_ten||'').toLowerCase().includes(search) || (f.noi_dung||'').toLowerCase().includes(search)) &&
    (!status || f.trang_thai === status) &&
    (!rating || f.danh_gia  === parseInt(rating))
  );

  document.getElementById('fb-detail-count').textContent = `${filtered.length} / ${currentFormFeedbacks.length} phản hồi`;
  renderDetailList(filtered);
}

function renderDetailList(list) {
  const container = document.getElementById('fb-response-list');
  if (!list.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray-400)">Không có phản hồi nào phù hợp.</div>`;
    return;
  }

  container.innerHTML = list.map(f => {
    const color  = avatarColor(f.id);

    return `
    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #f1f5f9;box-shadow:0 4px 12px rgba(0,0,0,0.02)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <!-- Left: avatar + info -->
        <div style="display:flex;align-items:center;gap:14px;min-width:0">
          <div style="width:40px;height:40px;border-radius:12px;background:${color}15;color:${color};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0">${initials(f.ho_ten)}</div>
          <div style="min-width:0">
            <div style="font-weight:800;font-size:15px;color:#0f172a">${f.ho_ten || 'Ẩn danh'}</div>
            <div style="font-size:13px;color:#64748b;font-weight:500;margin-top:2px">${f.email || ''} · ${formatDate(f.ngay_gui)}</div>
          </div>
        </div>
        <!-- Right: badges + stars -->
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;margin-left:12px">
          ${sentimentIcon(f.cam_xuc)}
          ${fbStatusBadge(f.trang_thai||f.status)}
          <div style="display:flex;gap:2px;background:#f8fafc;padding:6px 10px;border-radius:99px">${stars(f.danh_gia)}</div>
        </div>
      </div>

      <!-- Nội dung phản hồi tổng -->
      <div style="font-size:14px;color:#334155;border-left:3px solid #00008B;padding-left:16px;margin-bottom:16px;line-height:1.6">
        <span style="font-style:italic;color:#64748b">"</span>${f.noi_dung}<span style="font-style:italic;color:#64748b">"</span>
      </div>

      <!-- Trả lời đã có -->
      ${f.tra_loi ? `
      <div style="background:#f0fdf4;border-left:3px solid #22c55e;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:800;color:#16a34a;margin-bottom:4px;letter-spacing:0.5px">PHẢN HỒI LẠI · ${formatDate(f.ngay_tra_loi)}</div>
        <p style="font-size:13px;color:#15803d;margin:0;line-height:1.5">${f.tra_loi}</p>
      </div>` : ''}

      <!-- Actions -->
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button onclick="openRespDetail(${f.id})" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#f8fafc;color:#00008B;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='#f8fafc'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Xem đầy đủ
        </button>

        ${(f.trang_thai !== 'archived' && f.status !== 'archived') ? `
        <button onclick="archiveFb(${f.id})" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#f8fafc;color:#64748b;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='#f8fafc'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
          Lưu trữ
        </button>` : ''}


        <button onclick="openDeleteFb(${f.id})" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#fef2f2;color:#dc2626;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s" onmouseenter="this.style.background='#fee2e2'" onmouseleave="this.style.background='#fef2f2'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          Xóa
        </button>
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════════
//  MODAL – XEM ĐẦY ĐỦ chi tiết + câu hỏi/câu trả lời
// ════════════════════════════════════════════════════════════════

async function openRespDetail(id) {
  const f = currentFormFeedbacks.find(x => x.id === id) || allFeedbacks.find(x => x.id === id) || SAMPLE_FEEDBACKS.find(x => x.id === id);
  if (!f) return;
  activeFbId = id;

  if (!f.chi_tiet) {
    try {
      const tkn2 = localStorage.getItem('token') || '';
      const res = await fetch(`${API}/feedback/${id}/chitiet`, {
        headers: tkn2 ? { Authorization: `Bearer ${tkn2}` } : {}
      });
      if (res.ok) f.chi_tiet = await res.json();
    } catch (e) {
      f.chi_tiet = [];
    }
  }

  const color = avatarColor(f.id);

  // Render từng câu hỏi/trả lời
  const qaHTML = f.chi_tiet && f.chi_tiet.length ? `
    <div style="margin-top:24px">
      <div style="font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:12px">CÂU HỎI & CÂU TRẢ LỜI (${f.chi_tiet.length})</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${f.chi_tiet.map((ct, idx) => `
          <div style="background:#fff;border:1px solid #f1f5f9;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.01)">
            <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:8px;display:flex;gap:8px;align-items:flex-start">
              <span style="color:#00008B">${idx+1}.</span>
              <span style="flex:1">${ct.ten_cau_hoi}</span>
              <span style="font-size:11px;font-weight:600;padding:4px 8px;border-radius:6px;background:${
                ct.loai_cau_hoi==='choice'?'#eff6ff':ct.loai_cau_hoi==='rating'?'#fef3c7':'#f0fdf4'
              };color:${
                ct.loai_cau_hoi==='choice'?'#2563eb':ct.loai_cau_hoi==='rating'?'#d97706':'#16a34a'
              }">${
                ct.loai_cau_hoi==='choice'?'Trắc nghiệm':ct.loai_cau_hoi==='rating'?'Đánh giá':'Tự luận'
              }</span>
            </div>
            <div style="font-size:14px;color:#334155;display:flex;align-items:flex-start;gap:8px;background:#f8fafc;padding:12px 16px;border-radius:8px">
              ${ct.loai_cau_hoi==='choice' ? `
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" width="16" height="16" style="margin-top:2px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <strong style="color:#0f172a">${ct.ten_lua_chon || '—'}</strong>` : ''}
              ${ct.loai_cau_hoi==='rating' ? `
                <span style="color:#f59e0b;font-size:18px;line-height:1">★</span>
                <strong style="color:#0f172a">${ct.ten_lua_chon || '—'}</strong>` : ''}
              ${ct.loai_cau_hoi==='text' ? `
                <span style="color:#64748b;font-style:italic">"${ct.noi_dung || '(Không điền)'}"</span>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>` : `
    <div style="margin-top:24px;padding:24px;background:#f8fafc;border-radius:12px;text-align:center;font-size:14px;color:#94a3b8;border:1px dashed #cbd5e1">
      Không có dữ liệu câu hỏi/trả lời chi tiết.
    </div>`;

  document.getElementById('fb-resp-modal-body').innerHTML = `
    <!-- Thông tin người gửi -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;background:#fff;padding:20px;border-radius:16px;border:1px solid #f1f5f9;box-shadow:0 2px 8px rgba(0,0,0,0.01)">
      <div style="width:48px;height:48px;border-radius:12px;background:${color}15;color:${color};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;flex-shrink:0">${initials(f.ho_ten)}</div>
      <div style="min-width:0">
        <div style="font-weight:800;font-size:16px;color:#0f172a;margin-bottom:2px">${f.ho_ten || 'Ẩn danh'}</div>
        <div style="font-size:13px;color:#64748b">${f.email || 'Không có email'} · ${formatDate(f.ngay_gui)}</div>
      </div>
      <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
        ${sentimentIcon(f.cam_xuc)}
        ${fbStatusBadge(f.trang_thai||f.status)}
      </div>
    </div>

    <!-- Đánh giá sao -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;padding:16px 20px;background:#fff;border-radius:16px;border:1px solid #f1f5f9">
      <div style="display:flex;gap:4px">${stars(f.danh_gia)}</div>
      <span style="font-weight:800;font-size:16px;color:#f59e0b;margin-left:4px">${f.danh_gia}/5</span>
      <span style="font-size:13px;color:#64748b;margin-left:8px;padding-left:12px;border-left:1px solid #e2e8f0">${f.cam_xuc==='positive'?'Tích cực':'Tiêu cực'}</span>
    </div>

    <!-- Nội dung tổng -->
    <div style="margin-bottom:24px;background:#fff;border-radius:16px;padding:20px;border:1px solid #f1f5f9">
      <div style="font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:12px">NỘI DUNG PHẢN HỒI</div>
      <p style="font-size:14px;color:#334155;line-height:1.6;margin:0;border-left:3px solid #00008B;padding-left:16px"><span style="color:#94a3b8;font-style:italic">"</span>${f.noi_dung}<span style="color:#94a3b8;font-style:italic">"</span></p>
    </div>

    <!-- Câu hỏi & câu trả lời -->
    ${qaHTML}

    <!-- Trả lời (nếu có) -->
    ${f.tra_loi ? `
    <div style="margin-top:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px">
      <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:8px;display:flex;align-items:center;gap:6px">
        <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" width="13" height="13"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
        ĐÃ TRẢ LỜI · ${formatDate(f.ngay_tra_loi)} · Quản trị viên
      </div>
      <p style="font-size:13px;color:var(--gray-700);margin:0;line-height:1.5">${f.tra_loi}</p>
    </div>` : ''}
  `;

  openModal('fb-resp-modal');
}

// ════════════════════════════════════════════════════════════════
//  ACTIONS
// ════════════════════════════════════════════════════════════════

function syncFeedbackItem(updated) {
  allFeedbacks = allFeedbacks.map(item => item.id === updated.id ? { ...item, ...updated } : item);
  currentFormFeedbacks = currentFormFeedbacks.map(item => item.id === updated.id ? { ...item, ...updated } : item);
}

async function archiveFb(id) {
  const f = currentFormFeedbacks.find(x => x.id === id) || allFeedbacks.find(x => x.id === id) || SAMPLE_FEEDBACKS.find(x => x.id === id);
  if (!f) return;
  try {
    const tkn3 = localStorage.getItem('token') || '';
    const res = await fetch(`${API}/feedback/${id}/archive`, {
      method: 'PATCH',
      headers: tkn3 ? { Authorization: `Bearer ${tkn3}` } : {}
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || 'Không thể lưu trữ phản hồi');
  } catch (e) {
    showToast(e.message || 'Lỗi server', 'error');
    return;
  }
  syncFeedbackItem({ id, trang_thai: 'archived' });
  showToast('Đã lưu trữ phản hồi của ' + (f.ho_ten || 'khách'), 'success');
  if (activeFormId) filterDetailList();
}

function openDeleteFb(id) {
  const f = currentFormFeedbacks.find(x => x.id === id) || allFeedbacks.find(x => x.id === id) || SAMPLE_FEEDBACKS.find(x => x.id === id);
  if (!f) return;
  activeFbId = id;
  document.getElementById('fb-del-preview').innerHTML =
    `<strong>${f.ho_ten || 'Ẩn danh'}</strong> · ${formatDate(f.ngay_gui)}<br><span style="color:var(--gray-500)">"${f.noi_dung.slice(0,80)}${f.noi_dung.length>80?'…':''}"</span>`;
  openModal('fb-delete-modal');
}

async function confirmDeleteFb() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/feedback/${activeFbId}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || 'Không thể xóa phản hồi');
  } catch (e) {
    showToast(e.message || 'Lỗi server', 'error');
    return;
  }
  allFeedbacks = allFeedbacks.filter(x => x.id !== activeFbId);
  currentFormFeedbacks = currentFormFeedbacks.filter(x => x.id !== activeFbId);
  closeModal('fb-delete-modal');
  showToast('Đã xóa phản hồi','success');
  if (activeFormId) {
    filterDetailList();
  }
}

// ════════════════════════════════════════════════════════════════
//  CHARTS (view 1)
// ════════════════════════════════════════════════════════════════

let fbLineChart = null, fbPieChart = null;

function buildFbCharts() {
  const fbs = allFeedbacks || [];

  // Line chart
  const months   = ['T10','T11','T12','T1','T2','T3','T4'];
  const scores   = [3.8, 3.9, 4.0, 4.1, 4.2, 4.3, 4.4];
  const respCnts = [85, 102, 130, 115, 158, 142, 180];

  const lc = document.getElementById('fb-line-chart');
  if (lc) {
    if (fbLineChart) fbLineChart.destroy();
    fbLineChart = new Chart(lc, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          { label:'Điểm hài lòng TB', data:scores, borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,.10)',
            fill:true, tension:0.45, borderWidth:2.5, pointBackgroundColor:'#f59e0b', pointRadius:5, yAxisID:'y' },
          { label:'Lượt phản hồi', data:respCnts, borderColor:'#00008B', backgroundColor:'rgba(0,0,139,.06)',
            fill:false, tension:0.4, borderWidth:2, pointRadius:3, borderDash:[4,3], yAxisID:'y1' },
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'top', labels:{ font:{size:11}, boxWidth:10, padding:10 } } },
        scales:{
          x:{ grid:{color:'#f1f5f9'} },
          y:{ position:'left', min:0, max:5, grid:{color:'#f1f5f9'}, ticks:{stepSize:1, callback:v=>v+'★'} },
          y1:{ position:'right', beginAtZero:true, grid:{drawOnChartArea:false} },
        }
      }
    });
  }

  // Pie chart
  const pos = fbs.filter(f=>f.cam_xuc==='positive').length;
  const neg = fbs.filter(f=>f.cam_xuc==='negative').length;
  const total = fbs.length || 1;

  const pc = document.getElementById('fb-pie-chart');
  if (pc) {
    if (fbPieChart) fbPieChart.destroy();
    fbPieChart = new Chart(pc, {
      type:'doughnut',
      data:{ labels:['Tích cực','Tiêu cực'], datasets:[{ data:[pos,neg], backgroundColor:['#10b981','#ef4444'], borderWidth:2, borderColor:'#fff', hoverOffset:8 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw/total*100)}%)`}} }, cutout:'62%' }
    });
  }

  const legend = document.getElementById('fb-sent-legend');
  if (legend) {
    const labels = ['Tích cực','Tiêu cực'];
    const vals   = [pos, neg];
    const colors = ['#10b981','#ef4444'];
    const emojis = ['😊','😞'];
    legend.innerHTML = labels.map((l,i) => {
      const pct = Math.round(vals[i]/total*100);
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--gray-100)">
        <span style="font-size:15px">${emojis[i]}</span>
        <span style="color:var(--gray-600);flex:1">${l}</span>
        <div style="width:48px;height:5px;background:var(--gray-100);border-radius:3px">
          <div style="height:100%;width:${pct}%;background:${colors[i]};border-radius:3px"></div>
        </div>
        <span style="font-weight:700;color:${colors[i]};min-width:30px;text-align:right">${pct}%</span>
      </div>`;
    }).join('');
  }
}

// ════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════

async function init() {
  allForms = await loadRealForms();
  allFeedbacks = await loadRealFeedbacks();
  populateCatFilter();
  renderStatBar(allFeedbacks);
  renderFormCards();
  if (typeof Chart !== 'undefined') buildFbCharts();
  else { const t = setInterval(() => { if (typeof Chart!=='undefined') { buildFbCharts(); clearInterval(t); } }, 50); }
}

init();

// Export
window.__exportDataFn = function() {
  return {
    title:'Danh sách phản hồi', filename:'phan-hoi-'+new Date().toISOString().slice(0,10),
    headers:['STT','Họ tên','Form','Điểm','Nội dung','Ngày','Trạng thái'],
    rows: (allFeedbacks || []).map((f,i) => [
      i+1, f.ho_ten||'', (allForms || []).find(x=>x.id===f.form_id)?.ten_form||'',
      f.danh_gia||'', f.noi_dung||'', formatDate(f.ngay_gui),
      f.trang_thai==='new'?'Mới':'Lưu trữ'
    ])
  };
};
