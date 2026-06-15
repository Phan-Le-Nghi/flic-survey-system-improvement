if (!requirePagePermission(["view_staff", "manage_staff"])) {
  throw new Error("Bạn không có quyền truy cập trang quản lý nhân viên");
}

const API = `${API_BASE}/staff`;

// getUser(), getQuyen(), isAdmin(), hasPermission() — từ layout.js
function getToken() { return localStorage.getItem("token") || ""; }

function authHeaders() {
  const token = getToken();
  if (!token) {
    showToast("Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!", "error");
    setTimeout(() => { window.location.href = "index.html"; }, 1500);
    return null;
  }
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function canManageStaff() { return isAdmin() || hasPermission("manage_staff"); }
function canViewStaff()   { return isAdmin() || hasPermission("view_staff") || hasPermission("manage_staff"); }

let STAFF = [];
let activeStaffId = null;
let deleteStaffId = null;
let activeStaffDetail = null;

const roleBadge = (r) =>
  r === "admin"
    ? '<span class="badge" style="background:#fff7ed;color:#ea580c;border:1px solid #fed7aa">Quản lý</span>'
    : '<span class="badge badge-gray">Nhân viên</span>';

const roleLabel = (r) =>
  r === "admin" ? "Quản lý" : "Nhân viên";

function mapStaff(s) {
  return {
    id: s.id,
    name: s.ho_ten,
    email: s.email,
    phone: s.so_dien_thoai || "---",
    role: s.vai_tro,
    dept: s.phong_ban || "Chưa phân công",
    status: s.trang_thai,
    forms: 0,
    last: s.ngay_tao
      ? new Date(s.ngay_tao).toLocaleDateString("vi-VN")
      : "---",
    seed: s.email,
    color: "#00008B",
  };
}

function getPermissionData() {
  return {
    view_form:       document.getElementById("p-view-form")?.checked        || false,
    add_form:        document.getElementById("p-add-form")?.checked         || false,
    edit_form:       document.getElementById("p-edit-form")?.checked        || false,
    delete_form:     document.getElementById("p-delete-form")?.checked      || false,
    view_library:    document.getElementById("p-view-library")?.checked     || false,
    add_library:     document.getElementById("p-add-library")?.checked      || false,
    edit_library:    document.getElementById("p-edit-library")?.checked     || false,
    delete_library:  document.getElementById("p-delete-library")?.checked   || false,
    view_approval:   document.getElementById("p-view-appr")?.checked        || false,
    approve:         document.getElementById("p-approve")?.checked          || false,
    share_form:      document.getElementById("p-share-form")?.checked       || false,
    view_report:     document.getElementById("p-view-report")?.checked      || false,
    export_data:     document.getElementById("p-export")?.checked           || false,
    view_staff:      document.getElementById("p-view-staff")?.checked       || false,
    manage_staff:    document.getElementById("p-manage-staff")?.checked     || false,
    view_notif:      document.getElementById("p-view-notif")?.checked       || false,
    send_notif:      document.getElementById("p-send-notif")?.checked       || false,
    view_feedback:   document.getElementById("p-view-feedback")?.checked    || false,
    delete_feedback: document.getElementById("p-delete-feedback")?.checked  || false,
  };
}

function setPermissionData(quyen = {}) {
  const map = {
    "p-view-form":       !!quyen.view_form,
    "p-add-form":        !!quyen.add_form,
    "p-edit-form":       !!quyen.edit_form,
    "p-delete-form":     !!quyen.delete_form,
    "p-view-library":    !!quyen.view_library,
    "p-add-library":     !!quyen.add_library,
    "p-edit-library":    !!quyen.edit_library,
    "p-delete-library":  !!quyen.delete_library,
    "p-view-appr":       !!quyen.view_approval,
    "p-approve":         !!quyen.approve,
    "p-share-form":      !!quyen.share_form,
    "p-view-report":     !!quyen.view_report,
    "p-export":          !!quyen.export_data,
    "p-view-staff":      !!quyen.view_staff,
    "p-manage-staff":    !!quyen.manage_staff,
    "p-view-notif":      !!quyen.view_notif,
    "p-send-notif":      !!quyen.send_notif,
    "p-view-feedback":   !!quyen.view_feedback,
    "p-delete-feedback": !!quyen.delete_feedback,
  };

  Object.entries(map).forEach(([id, checked]) => {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  });
}

function resetPermissionData() {
  setPermissionData({
    view_form:       true,
    add_form:        false,
    edit_form:       false,
    delete_form:     false,
    view_library:    true,
    add_library:     false,
    edit_library:    false,
    delete_library:  false,
    view_approval:   true,
    approve:         false,
    share_form:      false,
    view_report:     true,
    export_data:     false,
    view_staff:      true,
    manage_staff:    false,
    view_notif:      true,
    send_notif:      false,
    view_feedback:   true,
    delete_feedback: false,
  });
}

function updateStats() {
  document.getElementById("stat-total").textContent = STAFF.length;
  document.getElementById("stat-active").textContent = STAFF.filter(
    (s) => s.status === "active"
  ).length;
  document.getElementById("stat-inactive").textContent = STAFF.filter(
    (s) => s.status === "inactive"
  ).length;
}

document.getElementById("page-content").innerHTML = `
  <style>
    #add-staff-modal input[type="password"]::-ms-reveal,
    #add-staff-modal input[type="password"]::-ms-clear,
    #staff-edit-modal input[type="password"]::-ms-reveal,
    #staff-edit-modal input[type="password"]::-ms-clear {
      display: none;
    }
  </style>
  <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between">
    <div>
      <h2 class="page-title">Quản lý nhân viên</h2>
      <p class="page-sub">Quản lý thông tin và quyền hạn nhân viên</p>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <button id="btn-add-staff" class="btn btn-primary" onclick="openAddStaffModal()">${IC.plus}Thêm nhân viên</button>
    </div>
  </div>

  <div class="grid-3" style="margin-bottom:20px">
    ${statCard(
      "Tổng nhân viên",
      `<span id="stat-total">0</span>`,
      "#00008B",
      "#00008B",
      '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>'
    )}
    ${statCard(
      "Đang hoạt động",
      `<span id="stat-active" style="color:#10b981">0</span>`,
      "#10b981",
      "#dcfce7",
      '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
    )}
    ${statCard(
      "Không hoạt động",
      `<span id="stat-inactive" style="color:#64748b">0</span>`,
      "#64748b",
      "#f1f5f9",
      '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/>'
    )}
  </div>

  <div class="card card-body" style="margin-bottom:20px">
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div class="input-wrap" style="flex:1;min-width:200px">
        <div class="input-icon">${IC.search}</div>
        <input type="text" class="input" placeholder="Tìm kiếm nhân viên..." oninput="filterStaff(this.value)">
      </div>
    </div>
  </div>

  ${filterPanel("staff-fp", [
    { label: "Vai trò", opts: ["Tất cả vai trò", "Quản lý", "Nhân viên"] },
    { label: "Trạng thái", opts: ["Tất cả", "Hoạt động", "Không hoạt động"] },

    { label: "Từ ngày", type: "date" },
  ])}

  <div class="grid-3" id="staff-grid">
    <div style="text-align:center;padding:40px;color:var(--gray-400)">Đang tải...</div>
  </div>

  <div class="modal-overlay" id="add-staff-modal">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:580px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column">
      <div class="modal-header">
        <div>
          <div class="modal-title">Thêm nhân viên mới</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Tạo tài khoản nhân viên mới cho hệ thống</div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('add-staff-modal')">${IC.close}</button>
      </div>
      <div class="modal-body" style="flex:1 1 auto;min-height:0;overflow-y:auto">
        <div style="background:#00008B;border:1px solid #00008B;border-radius:var(--radius);padding:12px 14px;margin-bottom:14px;font-size:13px;color:#fff;line-height:1.5">
          Nhân viên mới sẽ nhận email hướng dẫn kích hoạt tài khoản và thiết lập mật khẩu lần đầu.
        </div>

        <div style="border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:20px;margin-bottom:14px">
          <div style="font-size:15px;font-weight:700;color:var(--sky);margin-bottom:16px">Thông tin cá nhân</div>
          <div class="form-group">
            <label class="form-label">Họ và tên <span style="color:var(--red)">*</span></label>
            <input type="text" class="input" id="as-name" placeholder="Ví dụ: Nguyễn Văn A">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Email <span style="color:var(--red)">*</span></label>
              <input type="email" class="input" id="as-email" placeholder="name@flic.edu.vn">
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Số điện thoại</label>
              <input type="tel" class="input" id="as-phone" placeholder="Nhập số điện thoại">
            </div>
          </div>
        </div>

        <div style="border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:20px;margin-bottom:14px">
          <div style="font-size:15px;font-weight:700;color:#00008B;margin-bottom:16px">Thông tin công việc</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
            <div>
              <label class="form-label">Vai trò <span style="color:var(--red)">*</span></label>
              <select class="input" style="width:100%" id="as-role">
                <option value="staff">Nhân viên</option>
                <option value="admin">Quản lý</option>
              </select>
            </div>
            <div>
              <label class="form-label">Trạng thái</label>
              <select class="input" style="width:100%" id="as-status">
                <option value="active">Hoạt động</option>
                <option value="inactive">Không hoạt động</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Phòng ban</label>
            <select class="input" id="as-dept" style="width:100%">
              <option value="">Chưa phân công</option>
              <option value="Ngoại ngữ">Ngoại ngữ</option>
              <option value="Tin học">Tin học</option>
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div>
              <label class="form-label">Mật khẩu <span style="color:var(--red)">*</span></label>
              <input type="password" class="input" id="as-pw" placeholder="Nhập mật khẩu" onmousedown="event.stopPropagation()">
            </div>
            <div>
              <label class="form-label">Nhập lại mật khẩu <span style="color:var(--red)">*</span></label>
              <div style="position:relative">
                <input type="password" class="input" id="as-pw2" placeholder="Xác nhận mật khẩu" style="padding-right:44px" onmousedown="event.stopPropagation()">
                <button type="button" class="icon-btn" onclick="togglePwField('as-pw2')" title="Hiện/ẩn mật khẩu"
                  style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:30px;height:30px;color:var(--gray-400)">${IC.eye}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('add-staff-modal')">Hủy bỏ</button>
        <button id="btn-open-permission" class="btn btn-outline" style="color:#7c3aed;border-color:#7c3aed" onclick="openPermissionModalForAdd()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          Phân quyền
        </button>
        <button class="btn btn-primary" onclick="saveAddStaff()">${IC.plus}Thêm nhân viên</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="staff-edit-modal">
    <div class="modal" style="max-width:560px" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div>
          <div class="modal-title">Chỉnh sửa thông tin nhân viên</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Cập nhật thông tin và quyền hạn nhân viên</div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('staff-edit-modal')">${IC.close}</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div class="form-group" style="margin:0">
            <label class="form-label">Họ và tên <span style="color:var(--red)">*</span></label>
            <input type="text" class="input" id="se-name" placeholder="Nguyễn Văn A">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Email <span style="color:var(--red)">*</span></label>
            <input type="email" class="input" id="se-email" placeholder="name@flic.edu.vn">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Số điện thoại</label>
            <input type="tel" class="input" id="se-phone" placeholder="Nhập số điện thoại">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Phòng ban</label>
            <select class="input" id="se-dept">
              <option value="">Chưa phân công</option>
              <option value="Ngoại ngữ">Ngoại ngữ</option>
              <option value="Tin học">Tin học</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Vai trò <span style="color:var(--red)">*</span></label>
            <select class="input" id="se-role">
              <option value="admin">Quản lý</option>
              <option value="staff">Nhân viên</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Mật khẩu mới</label>
            <input type="password" class="input" id="se-pw" placeholder="Để trống nếu không đổi" onmousedown="event.stopPropagation()">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Trạng thái <span style="color:var(--red)">*</span></label>
            <select class="input" id="se-status">
              <option value="active">Hoạt động</option>
              <option value="inactive">Không hoạt động</option>
            </select>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end">
          <button id="btn-edit-permission" class="btn btn-outline" style="color:#7c3aed;border-color:#7c3aed" onclick="openPermissionModalForEdit()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Sửa phân quyền
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('staff-edit-modal')">Hủy</button>
        <button class="btn btn-primary" onclick="saveStaffEdit()">${IC.save}Lưu thay đổi</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="staff-detail-modal">
    <div class="modal" style="max-width:500px" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div>
          <div class="modal-title">Chi tiết nhân viên</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Thông tin chi tiết về nhân viên</div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('staff-detail-modal')">${IC.close}</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--gray-100)">
          <img id="sd-avatar" src="" style="width:72px;height:72px;border-radius:50%;border:3px solid #00008B;object-fit:cover">
          <div>
            <div id="sd-name" style="font-size:18px;font-weight:800;color:var(--gray-900);margin-bottom:2px"></div>
            <div id="sd-dept" style="font-size:13px;color:var(--gray-500);margin-bottom:8px"></div>
            <div style="display:flex;align-items:center;gap:8px">
              <span id="sd-role-badge"></span>
              <span id="sd-status-dot" style="width:8px;height:8px;border-radius:50%;display:inline-block"></span>
              <span id="sd-status-text" style="font-size:13px;font-weight:500"></span>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
          <div>
            <div style="display:flex;align-items:center;gap:6px;color:var(--gray-400);margin-bottom:4px;font-size:12px">Email</div>
            <div id="sd-email" style="font-size:14px;font-weight:600;color:var(--gray-800)"></div>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:6px;color:var(--gray-400);margin-bottom:4px;font-size:12px">Số điện thoại</div>
            <div id="sd-phone" style="font-size:14px;font-weight:600;color:var(--gray-800)"></div>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:6px;color:var(--gray-400);margin-bottom:4px;font-size:12px">Vai trò</div>
            <div id="sd-role-text" style="font-size:14px;font-weight:600;color:var(--gray-800)"></div>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:6px;color:var(--gray-400);margin-bottom:4px;font-size:12px">Phòng ban</div>
            <div id="sd-dept2" style="font-size:14px;font-weight:600;color:var(--gray-800)"></div>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:6px;color:var(--gray-400);margin-bottom:4px;font-size:12px">Ngày tạo</div>
            <div id="sd-last" style="font-size:14px;font-weight:600;color:var(--gray-800)"></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('staff-detail-modal')">Đóng</button>
        <button id="btn-edit-from-detail" class="btn btn-primary" onclick="closeModal('staff-detail-modal');openStaffEdit(activeStaffId)">
          ${IC.edit}Chỉnh sửa
        </button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="permission-modal">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:500px">
      <div class="modal-header">
        <div>
          <div class="modal-title">Phân quyền nhân viên</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Chọn các quyền phù hợp với vai trò</div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('permission-modal')">${IC.close}</button>
      </div>
      <div class="modal-body">
        ${[
          {
            group: "Quản lý biểu mẫu",
            color: "#00008B",
            bg: "#00008B",
            perms: [
              { id: "p-view-form",   label: "Xem danh sách biểu mẫu",  checked: true  },
              { id: "p-add-form",    label: "Thêm biểu mẫu",           checked: false },
              { id: "p-edit-form",   label: "Sửa biểu mẫu",            checked: false },
              { id: "p-delete-form", label: "Xóa biểu mẫu",            checked: false },
            ],
          },
          {
            group: "Thư viện câu hỏi",
            color: "#00008B",
            bg: "#00008B",
            perms: [
              { id: "p-view-library",   label: "Xem danh sách câu hỏi", checked: true  },
              { id: "p-add-library",    label: "Thêm câu hỏi",          checked: false },
              { id: "p-edit-library",   label: "Sửa câu hỏi",           checked: false },
              { id: "p-delete-library", label: "Xóa câu hỏi",           checked: false },
            ],
          },
          {
            group: "Phê duyệt",
            color: "#10b981",
            bg: "#dcfce7",
            perms: [
              { id: "p-view-appr", label: "Xem yêu cầu phê duyệt", checked: true },
              { id: "p-approve", label: "Phê duyệt / Từ chối", checked: false },
              { id: "p-share-form", label: "Chia sẻ biểu mẫu", checked: false },
            ],
          },
          {
            group: "Báo cáo & Thống kê",
            color: "#8b5cf6",
            bg: "#f3e8ff",
            perms: [
              { id: "p-view-report", label: "Xem báo cáo", checked: true },
              { id: "p-export", label: "Xuất dữ liệu", checked: false },
            ],
          },
          {
            group: "Quản lý nhân viên",
            color: "#f97316",
            bg: "#ffedd5",
            perms: [
              { id: "p-view-staff", label: "Xem danh sách nhân viên", checked: true },
              { id: "p-manage-staff", label: "Thêm / Sửa / Xóa / Vô hiệu hóa nhân viên", checked: false },
            ],
          },
          {
            group: "Thông báo",
            color: "#ec4899",
            bg: "#fce7f3",
            perms: [
              { id: "p-view-notif", label: "Xem thông báo", checked: true },
              { id: "p-send-notif", label: "Tạo & Gửi thông báo", checked: false },
            ],
          },
          {
            group: "Quản lý phản hồi",
            color: "#f59e0b",
            bg: "#fef3c7",
            perms: [
              { id: "p-view-feedback", label: "Xem phản hồi", checked: true },
              { id: "p-delete-feedback", label: "Xóa phản hồi", checked: false },
            ],
          },
        ]
          .map(
            (g) => `
          <div style="margin-bottom:18px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <span style="width:10px;height:10px;border-radius:50%;background:${g.color};display:inline-block"></span>
              <span style="font-size:13.5px;font-weight:700;color:var(--gray-800)">${g.group}</span>
            </div>
            <div style="background:${g.bg}30;border:1px solid ${g.color}30;border-radius:var(--radius-lg);padding:12px 16px;display:flex;flex-direction:column;gap:10px">
              ${g.perms
                .map(
                  (p) => `
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13.5px;color:var(--gray-700)">
                  <input type="checkbox" id="${p.id}" ${
                    p.checked ? "checked" : ""
                  } style="width:16px;height:16px;accent-color:${g.color};cursor:pointer">
                  ${p.label}
                </label>
              `
                )
                .join("")}
            </div>
          </div>
        `
          )
          .join("")}
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('permission-modal')">Hủy</button>
        <button class="btn btn-primary" onclick="savePermissionAndClose()">
          ${IC.save}Lưu phân quyền
        </button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="staff-delete-modal">
    <div class="modal" style="max-width:420px" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:#fee2e2;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${IC.trashSm}
          </div>
          <span class="modal-title">Xác nhận xóa</span>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('staff-delete-modal')">${IC.close}</button>
      </div>
      <div class="modal-body">
        <p style="color:var(--gray-700);margin:0 0 14px">Bạn có chắc muốn xóa nhân viên này?</p>
        <div style="background:var(--gray-50);border-radius:var(--radius);padding:12px;display:flex;align-items:center;gap:12px">
          <div id="sdel-avatar" class="avatar-initials" style="background:#00008B;font-size:13px;width:40px;height:40px;flex-shrink:0"></div>
          <div>
            <div id="sdel-name" style="font-weight:700;font-size:14px"></div>
            <div id="sdel-dept" style="font-size:12px;color:var(--gray-500)"></div>
          </div>
        </div>
        <p style="font-size:12.5px;color:var(--gray-500);margin:12px 0 0">* Lưu ý: Hành động này không thể hoàn tác sau khi xác nhận.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('staff-delete-modal')">Hủy</button>
        <button class="btn btn-primary" style="background:#dc2626;border-color:#dc2626" onclick="confirmDeleteStaff()">${IC.trashSm}Xóa</button>
      </div>
    </div>
  </div>
`;

function renderStaff(list) {
  document.getElementById("staff-grid").innerHTML =
    list.length === 0
      ? '<div style="text-align:center;padding:40px;color:var(--gray-400)">Không có nhân viên nào</div>'
      : list
          .map(
            (s) => `
      <div style="background:#fff;border-radius:var(--radius-lg);border:1px solid var(--gray-200);overflow:hidden;box-shadow:var(--shadow-sm)">
        <div style="height:72px;background:linear-gradient(135deg,#00008B,#00008B)"></div>
        <div style="padding:0 16px 16px">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:-32px;margin-bottom:10px">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${s.seed}" style="width:64px;height:64px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.15)" loading="lazy">
            <div style="position:relative" onclick="event.stopPropagation()">
              <button onclick="toggleStaffMenu('${s.id}')" style="background:none;border:none;cursor:pointer;color:var(--gray-400);padding:4px;border-radius:4px" onmouseenter="this.style.background='rgba(0,0,0,.05)'" onmouseleave="this.style.background='none'">${IC.dots}</button>
              <div id="smenu-${s.id}" class="export-drop-menu" style="right:0;top:calc(100% + 2px);min-width:120px">
                <div class="export-drop-item btn-view-staff" onclick="openStaffDetail(${s.id})">${IC.eye}Xem</div>
                <div class="export-drop-item btn-edit-staff" onclick="openStaffEdit(${s.id})">${IC.edit}Sửa</div>
                <div class="export-drop-item btn-disable-staff" style="color:#d97706" onclick="disableStaff(${s.id})">${IC.ban}${s.status==='active'?'Vô hiệu hóa':'Kích hoạt lại'}</div>
                <div class="export-drop-item btn-delete-staff" style="color:var(--red)" onclick="deleteStaff(${s.id})">${IC.trashSm}Xóa</div>
              </div>
            </div>
          </div>
          <div style="font-size:15px;font-weight:800;color:var(--gray-900)">${s.name}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            ${roleBadge(s.role)}
            <span style="width:8px;height:8px;border-radius:50%;background:${
              s.status === "active" ? "#22c55e" : "#94a3b8"
            };display:inline-block"></span>
            <span style="font-size:12.5px;color:${
              s.status === "active" ? "#16a34a" : "#94a3b8"
            }">${s.status === "active" ? "Hoạt động" : "Không hoạt động"}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;font-size:12.5px;color:var(--gray-500)">
            <div style="display:flex;align-items:center;gap:6px">${s.email}</div>
            <div style="display:flex;align-items:center;gap:6px">${s.phone}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:10px;border-top:1px solid var(--gray-100);text-align:center">
            <div><div style="font-size:20px;font-weight:800;color:#00008B">${s.forms}</div><div style="font-size:11px;color:var(--gray-500)">Form tạo</div></div>
            <div><div style="font-size:12px;font-weight:600;color:var(--gray-800)">${s.last}</div><div style="font-size:11px;color:var(--gray-500)">Ngày tạo</div></div>
          </div>
        </div>
      </div>
    `
          )
          .join("");

  applyStaffPermissionsUI();
}

function openAddStaffModal() {
  if (!canManageStaff()) {
    showToast("Bạn không có quyền thêm nhân viên", "error");
    return;
  }

  document.getElementById("as-name").value = "";
  document.getElementById("as-email").value = "";
  document.getElementById("as-phone").value = "";
  document.getElementById("as-dept").value = "";
  document.getElementById("as-role").value = "staff";
  document.getElementById("as-status").value = "active";
  document.getElementById("as-pw").value = "";
  document.getElementById("as-pw2").value = "";
  resetPermissionData();
  openModal("add-staff-modal");
}

function openPermissionModalForAdd() {
  if (!canManageStaff()) {
    showToast("Bạn không có quyền phân quyền nhân viên", "error");
    return;
  }
  openModal("permission-modal");
}

function openPermissionModalForEdit() {
  if (!canManageStaff()) {
    showToast("Bạn không có quyền phân quyền nhân viên", "error");
    return;
  }
  openModal("permission-modal");
}

async function openStaffDetail(id) {
  const s = STAFF.find((x) => x.id === id);
  if (!s) return;

  activeStaffId = id;
  document.getElementById("sd-avatar").src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.seed}`;
  document.getElementById("sd-name").textContent = s.name;
  document.getElementById("sd-dept").textContent = s.dept;
  document.getElementById("sd-role-badge").innerHTML = roleBadge(s.role);
  document.getElementById("sd-status-dot").style.background =
    s.status === "active" ? "#22c55e" : "#94a3b8";
  document.getElementById("sd-status-text").textContent =
    s.status === "active" ? "Hoạt động" : "Không hoạt động";
  document.getElementById("sd-status-text").style.color =
    s.status === "active" ? "#16a34a" : "#94a3b8";
  document.getElementById("sd-email").textContent = s.email;
  document.getElementById("sd-phone").textContent = s.phone;
  document.getElementById("sd-role-text").textContent = roleLabel(s.role);
  document.getElementById("sd-dept2").textContent = s.dept;
  document.getElementById("sd-last").textContent = s.last;
  document.getElementById("smenu-" + id)?.classList.remove("open");
  openModal("staff-detail-modal");
}

async function openStaffEdit(id) {
  if (!canManageStaff()) {
    showToast("Bạn không có quyền chỉnh sửa nhân viên", "error");
    return;
  }

  const s = STAFF.find((x) => x.id === id);
  if (!s) return;

  activeStaffId = id;
  activeStaffDetail = null;

  document.getElementById("se-name").value = s.name;
  document.getElementById("se-email").value = s.email;
  document.getElementById("se-phone").value = s.phone === "---" ? "" : s.phone;
  document.getElementById("se-dept").value = s.dept === "Chưa phân công" ? "" : s.dept;
  document.getElementById("se-role").value = s.role;
  document.getElementById("se-status").value = s.status;
  document.getElementById("se-pw").value = "";
  resetPermissionData();

  try {
    const headers = authHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/${id}`, { headers });

    const data = await res.json();

    if (res.ok) {
      activeStaffDetail = data;
      document.getElementById("se-name").value = data.ho_ten || "";
      document.getElementById("se-email").value = data.email || "";
      document.getElementById("se-phone").value = data.so_dien_thoai || "";
      document.getElementById("se-dept").value = data.phong_ban || "";
      document.getElementById("se-role").value = data.vai_tro || "staff";
      document.getElementById("se-status").value = data.trang_thai || "active";
      setPermissionData(data);
    } else {
      showToast(data.message || "Không tải được chi tiết nhân viên", "error");
    }
  } catch (err) {
    showToast("Lỗi kết nối server!", "error");
  }

  document.getElementById("smenu-" + id)?.classList.remove("open");
  closeModal("staff-detail-modal");
  openModal("staff-edit-modal");
}

async function saveStaffEdit() {
  if (!canManageStaff()) {
    showToast("Bạn không có quyền cập nhật nhân viên", "error");
    return;
  }

  const name = document.getElementById("se-name").value.trim();
  const email = document.getElementById("se-email").value.trim();
  const phone = document.getElementById("se-phone").value.trim();
  const pw = document.getElementById("se-pw").value;

  if (!name) {
    showToast("Vui lòng nhập họ và tên!", "error");
    return;
  }
  if (!email) {
    showToast("Vui lòng nhập email!", "error");
    return;
  }

  const body = {
    ho_ten: name,
    email,
    so_dien_thoai: phone || null,
    phong_ban: document.getElementById("se-dept")?.value?.trim() || null,
    vai_tro: document.getElementById("se-role").value,
    trang_thai: document.getElementById("se-status").value,
    quyen: getPermissionData(),
  };

  if (pw) body.mat_khau = pw;

  try {
    const res = await fetch(`${API}/${activeStaffId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok) {
      showToast("Đã cập nhật thông tin " + name + "!", "success");
      closeModal("staff-edit-modal");
      closeModal("permission-modal");
      loadStaff();
    } else {
      showToast(data.message || "Cập nhật thất bại!", "error");
    }
  } catch (err) {
    showToast("Lỗi kết nối server!", "error");
  }
}

async function saveAddStaff() {
  if (!canManageStaff()) {
    showToast("Bạn không có quyền thêm nhân viên", "error");
    return;
  }

  const name = document.getElementById("as-name")?.value?.trim();
  const email = document.getElementById("as-email")?.value?.trim();
  const pw = document.getElementById("as-pw")?.value;
  const pw2 = document.getElementById("as-pw2")?.value;

  if (!name) {
    showToast("Vui lòng nhập họ và tên!", "error");
    return;
  }
  if (!email) {
    showToast("Vui lòng nhập email!", "error");
    return;
  }
  if (!pw) {
    showToast("Vui lòng nhập mật khẩu!", "error");
    return;
  }
  if (pw.length < 6) {
    showToast("Mật khẩu phải có ít nhất 6 ký tự!", "error");
    return;
  }
  if (pw !== pw2) {
    showToast("Mật khẩu nhập lại không khớp!", "error");
    return;
  }

  const body = {
    ho_ten: name,
    email,
    so_dien_thoai: document.getElementById("as-phone")?.value?.trim() || null,
    phong_ban: document.getElementById("as-dept")?.value?.trim() || null,
    ten_dang_nhap: email.split("@")[0],
    mat_khau: pw,
    vai_tro: document.getElementById("as-role")?.value || "staff",
    trang_thai: document.getElementById("as-status")?.value || "active",
    quyen: getPermissionData(),
  };

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok) {
      showToast("Đã thêm nhân viên " + name + " thành công!", "success");
      closeModal("permission-modal");
      closeModal("add-staff-modal");
      loadStaff();
    } else {
      showToast(data.message || "Thêm thất bại!", "error");
    }
  } catch (err) {
    showToast("Lỗi kết nối server!", "error");
  }
}

function deleteStaff(id) {
  if (!canManageStaff()) {
    showToast("Bạn không có quyền xóa nhân viên", "error");
    return;
  }

  document.getElementById("smenu-" + id)?.classList.remove("open");
  deleteStaffId = id;

  const s = STAFF.find((x) => x.id === id);
  if (!s) return;

  document.getElementById("sdel-avatar").textContent = s.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  document.getElementById("sdel-name").textContent = s.name;
  document.getElementById("sdel-dept").textContent = s.dept;
  openModal("staff-delete-modal");
}

async function confirmDeleteStaff() {
  try {
    const headers = authHeaders();
    if (!headers) { closeModal("staff-delete-modal"); return; }
    const res = await fetch(`${API}/${deleteStaffId}`, {
      method: "DELETE",
      headers,
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message || "Xóa nhân viên thành công", "success");
      loadStaff();
    } else {
      showToast(data.message || "Xóa thất bại!", "error");
    }
  } catch (err) {
    showToast("Lỗi kết nối server!", "error");
  }

  closeModal("staff-delete-modal");
}

async function disableStaff(id) {
  if (!canManageStaff()) {
    showToast("Bạn không có quyền thực hiện thao tác này", "error");
    return;
  }
  document.getElementById("smenu-" + id)?.classList.remove("open");
  const s = STAFF.find(x => x.id === id);
  if (!s) return;
  const newStatus = s.status === "active" ? "inactive" : "active";
  const label = newStatus === "inactive" ? "vô hiệu hóa" : "kích hoạt lại";
  try {
    const headers = authHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/${id}/status`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ trang_thai: newStatus })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || `Đã ${label} nhân viên thành công`, "success");
      loadStaff();
    } else {
      showToast(data.message || `Thao tác thất bại!`, "error");
    }
  } catch (err) {
    showToast("Lỗi kết nối server!", "error");
  }
}

function filterStaff(q) {
  renderStaff(
    STAFF.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
  );
}

function applyFilter() {
  showToast("Đã áp dụng bộ lọc", "success");
}

function resetFilter() {
  showToast("Đã xóa bộ lọc");
}

function toggleStaffMenu(id) {
  document.querySelectorAll('[id^="smenu-"].open').forEach((m) => {
    if (m.id !== "smenu-" + id) m.classList.remove("open");
  });
  document.getElementById("smenu-" + id)?.classList.toggle("open");
}

function applyStaffPermissionsUI() {
  if (!canManageStaff()) {
    applyPageQuyen({
      manage_staff:
        "#btn-add-staff, #btn-open-permission, .btn-edit-staff, .btn-delete-staff, .btn-disable-staff, #btn-edit-from-detail, #btn-edit-permission",
    });
  }
}

document.addEventListener("click", (e) => {
  if (!e.target.closest('[id^="smenu-"]') && !e.target.closest(".q-dot-btn")) {
    document
      .querySelectorAll('[id^="smenu-"].open')
      .forEach((m) => m.classList.remove("open"));
  }
});

async function loadStaff() {
  if (!canViewStaff()) {
    showToast("Bạn không có quyền xem danh sách nhân viên", "error");
    return;
  }

  const token = getToken();
  try {
    const res = await fetch(API, {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.message || "Không tải được danh sách nhân viên", "error");
      // Nếu đã có dữ liệu cũ thì vẫn hiển thị
      if (STAFF.length) { renderStaff(STAFF); updateStats(); }
      return;
    }
    const data = await res.json();
    STAFF = data.map(mapStaff);
    renderStaff(STAFF);
    updateStats();
    applyStaffPermissionsUI();
  } catch (err) {
    console.error("Lỗi tải nhân viên:", err);
    // Không toast lỗi nếu đã có data cũ — tránh spam
    if (!STAFF.length) showToast("Không kết nối được server!", "error");
    if (STAFF.length) { renderStaff(STAFF); updateStats(); }
  }
}

loadStaff();
// ── Export data function (dùng bởi doExport trong main.js) ──
window.__exportDataFn = function() {
  const list = typeof filtered !== 'undefined' ? filtered : STAFF;
  return {
    title: 'Danh sách nhân viên',
    filename: 'nhan-vien-' + new Date().toISOString().slice(0,10),
    headers: ['STT', 'Họ tên', 'Email', 'Số điện thoại', 'Vai trò', 'Trạng thái'],
    rows: list.map((s, i) => [
      i + 1,
      s.name || s.ho_ten || '',
      s.email || '',
      s.phone || s.so_dien_thoai || '',
      s.role  || s.vai_tro  || '',

      s.status === 'active' ? 'Hoạt động' : s.status === 'inactive' ? 'Ngừng hoạt động' : (s.status || ''),
    ])
  };
};

// ═══════════════════════════════════════════════════════════════
// SAVE PERMISSION — lưu phân quyền từ modal rồi đóng
// Nếu đang mở từ edit → gọi saveStaffEdit luôn
// Nếu đang mở từ add  → chỉ đóng modal (data sẽ được đọc khi saveAddStaff)
// ═══════════════════════════════════════════════════════════════
async function savePermissionAndClose() {
  closeModal('permission-modal');
  // Nếu đang trong luồng edit (activeStaffId có giá trị) → lưu ngay
  if (activeStaffId) {
    await saveStaffEdit();
  } else {
    showToast('Đã cập nhật phân quyền ✅', 'success');
  }
}

// ═══════════════════════════════════════════════════════════════
// CÀI ĐẶT NHÂN VIÊN — modal xem/sửa cài đặt cá nhân của từng NV
// Hiển thị: thông tin cơ bản + quyền + lịch sử đăng nhập
// ═══════════════════════════════════════════════════════════════

// Inject modal cài đặt nhân viên vào DOM
document.getElementById('page-content').insertAdjacentHTML('beforeend', `
  <div class="modal-overlay" id="staff-setting-modal">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:600px;border-radius:14px">
      <div class="modal-header">
        <div>
          <div class="modal-title">Cài đặt nhân viên</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Thông tin tài khoản và cấu hình cá nhân</div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('staff-setting-modal')">${IC.close}</button>
      </div>
      <div id="staff-setting-body" style="padding:20px;max-height:72vh;overflow-y:auto"></div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('staff-setting-modal')">Đóng</button>
        <button class="btn btn-primary" onclick="saveStaffSetting()">
          ${IC.save}Lưu cài đặt
        </button>
      </div>
    </div>
  </div>
`);

async function openStaffSetting(id) {
  const s = STAFF.find(x => x.id === id);
  if (!s) return;

  document.getElementById('smenu-' + id)?.classList.remove('open');

  const roleLabel = s.role === 'admin' ? 'Quản lý' : 'Nhân viên';
  const statusBadge = s.status === 'active'
    ? '<span class="badge badge-green">Hoạt động</span>'
    : '<span class="badge badge-gray">Ngừng hoạt động</span>';

  // Load chi tiết từ API để lấy quyền
  let detail = {};
  try {
    const token = getToken();
    const res = await fetch(API + '/' + id, {
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    });
    if (res.ok) detail = await res.json();
  } catch(e) {}

  const quyen = detail.quyen || {};

  const permGroups = [
    {
      label: 'Quản lý biểu mẫu', color: '#00008B',
      items: [
        { key: 'view_form',   label: 'Xem danh sách biểu mẫu' },
        { key: 'add_form',    label: 'Thêm biểu mẫu' },
        { key: 'edit_form',   label: 'Sửa biểu mẫu' },
        { key: 'delete_form', label: 'Xóa biểu mẫu' },
      ]
    },
    {
      label: 'Thư viện câu hỏi', color: '#00008B',
      items: [
        { key: 'view_library',   label: 'Xem danh sách câu hỏi' },
        { key: 'add_library',    label: 'Thêm câu hỏi' },
        { key: 'edit_library',   label: 'Sửa câu hỏi' },
        { key: 'delete_library', label: 'Xóa câu hỏi' },
      ]
    },
    {
      label: 'Phê duyệt', color: '#10b981',
      items: [
        { key: 'view_approval', label: 'Xem phê duyệt' },
        { key: 'approve',       label: 'Phê duyệt / Từ chối' },
        { key: 'share_form',    label: 'Chia sẻ biểu mẫu' },
      ]
    },
    {
      label: 'Báo cáo & Thống kê', color: '#8b5cf6',
      items: [
        { key: 'view_report',  label: 'Xem báo cáo' },
        { key: 'export_data',  label: 'Xuất dữ liệu' },
      ]
    },
    {
      label: 'Quản lý nhân viên', color: '#f97316',
      items: [
        { key: 'view_staff',   label: 'Xem nhân viên' },
        { key: 'manage_staff', label: 'Thêm / Sửa / Xóa' },
      ]
    },
    {
      label: 'Thông báo', color: '#ec4899',
      items: [
        { key: 'view_notif', label: 'Xem thông báo' },
        { key: 'send_notif', label: 'Tạo & Gửi thông báo' },
      ]
    },
    {
      label: 'Quản lý phản hồi', color: '#f59e0b',
      items: [
        { key: 'view_feedback',   label: 'Xem phản hồi' },
        { key: 'delete_feedback', label: 'Xóa phản hồi' },
      ]
    },
  ];

  document.getElementById('staff-setting-body').innerHTML = `
    <!-- Thông tin cơ bản -->
    <div style="display:flex;align-items:center;gap:16px;padding:16px;background:#f8fafc;border-radius:12px;margin-bottom:20px">
      <div style="width:56px;height:56px;border-radius:50%;background:#00008B;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700;flex-shrink:0">
        ${(s.name||'U')[0].toUpperCase()}
      </div>
      <div style="flex:1">
        <div style="font-size:16px;font-weight:700;color:var(--gray-900)">${s.name}</div>
        <div style="font-size:13px;color:var(--gray-500);margin-top:2px">${roleLabel} · ${s.dept || ''}</div>
        <div style="margin-top:6px">${statusBadge}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="closeModal('staff-setting-modal');openStaffEdit(${id})">
        ${IC.edit}Sửa thông tin
      </button>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:0;border-bottom:2px solid var(--gray-200);margin-bottom:20px">
      <button onclick="switchSettingTab('tab-info')" id="stab-info"
        style="padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid #00008B;color:#00008B;margin-bottom:-2px">
        Thông tin
      </button>
      <button onclick="switchSettingTab('tab-perm')" id="stab-perm"
        style="padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;color:var(--gray-400);margin-bottom:-2px">
        Phân quyền
      </button>
      <button onclick="switchSettingTab('tab-notif')" id="stab-notif"
        style="padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;color:var(--gray-400);margin-bottom:-2px">
        Thông báo
      </button>
    </div>

    <!-- Tab: Thông tin -->
    <div id="tab-info">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="form-group"><label class="form-label">Họ và tên</label>
          <input type="text" id="ss-name" class="input" value="${s.name || ''}"></div>
        <div class="form-group"><label class="form-label">Email</label>
          <input type="email" id="ss-email" class="input" value="${s.email || ''}"></div>
        <div class="form-group"><label class="form-label">Số điện thoại</label>
          <input type="tel" id="ss-phone" class="input" placeholder="Nhập số điện thoại" value="${s.phone !== '---' ? s.phone : ''}"></div>
        <div class="form-group"><label class="form-label">Phòng ban</label>
          <select id="ss-dept" class="input">
            <option value="" ${!s.dept || s.dept === 'Chưa phân công' ? 'selected' : ''}>Chưa phân công</option>
            <option value="Ngoại ngữ" ${s.dept === 'Ngoại ngữ' ? 'selected' : ''}>Ngoại ngữ</option>
            <option value="Tin học" ${s.dept === 'Tin học' ? 'selected' : ''}>Tin học</option>
          </select></div>
        <div class="form-group"><label class="form-label">Vai trò</label>
          <input type="text" class="input" value="${roleLabel}" readonly style="background:var(--gray-50)"></div>
        <div class="form-group"><label class="form-label">Ngày tạo</label>
          <input type="text" class="input" value="${s.created || ''}" readonly style="background:var(--gray-50)"></div>
      </div>
      <div class="form-group" style="margin-top:4px"><label class="form-label">Đặt lại mật khẩu</label>
        <div style="display:flex;gap:8px">
          <input type="password" id="ss-pw" class="input" placeholder="Để trống nếu không đổi" style="flex:1">
          <button class="btn btn-outline btn-sm" onclick="togglePwField('ss-pw')">Hiện</button>
        </div>
      </div>
    </div>

    <!-- Tab: Phân quyền -->
    <div id="tab-perm" style="display:none">
      <div style="display:flex;flex-direction:column;gap:14px">
        ${permGroups.map(g => `
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="width:10px;height:10px;border-radius:50%;background:${g.color};display:inline-block"></span>
              <span style="font-size:13.5px;font-weight:700;color:var(--gray-800)">${g.label}</span>
            </div>
            <div style="background:#f8fafc;border:1px solid var(--gray-200);border-radius:10px;padding:12px 16px;display:flex;flex-wrap:wrap;gap:10px">
              ${g.items.map(item => `
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--gray-700);min-width:45%">
                  <input type="checkbox" id="ss-perm-${item.key}" ${quyen[item.key] ? 'checked' : ''}
                    style="width:15px;height:15px;accent-color:${g.color};cursor:pointer">
                  ${item.label}
                </label>`).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Tab: Thông báo -->
    <div id="tab-notif" style="display:none">
      <div style="display:flex;flex-direction:column;gap:4px">
        ${[
          { id:'ss-notif-email', label:'Nhận thông báo qua Email', desc:'Gửi email khi có sự kiện mới', val: true },
          { id:'ss-notif-approval', label:'Thông báo phê duyệt', desc:'Khi có yêu cầu phê duyệt mới', val: !!quyen.view_approval },
          { id:'ss-notif-feedback', label:'Thông báo phản hồi', desc:'Khi có phản hồi mới từ người dùng', val: false },
          { id:'ss-notif-system', label:'Thông báo hệ thống', desc:'Cập nhật và bảo trì hệ thống', val: true },
        ].map(n => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--gray-100)">
            <div>
              <div style="font-size:13.5px;font-weight:500;color:var(--gray-800)">${n.label}</div>
              <div style="font-size:12px;color:var(--gray-400);margin-top:2px">${n.desc}</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="${n.id}" ${n.val ? 'checked' : ''}>
              <span class="switch-track"></span>
            </label>
          </div>`).join('')}
      </div>
    </div>
  `;

  // Lưu id để saveStaffSetting dùng
  document.getElementById('staff-setting-modal').dataset.staffId = id;
  openModal('staff-setting-modal');
}

function switchSettingTab(tabId) {
  ['tab-info','tab-perm','tab-notif'].forEach(t => {
    document.getElementById(t).style.display = t === tabId ? '' : 'none';
  });
  const tabMap = { 'tab-info': 'stab-info', 'tab-perm': 'stab-perm', 'tab-notif': 'stab-notif' };
  Object.entries(tabMap).forEach(([t, btnId]) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const active = tabMap[tabId] === btnId;
    btn.style.borderBottomColor = active ? '#00008B' : 'transparent';
    btn.style.color = active ? '#00008B' : 'var(--gray-400)';
  });
}

function togglePwField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  el.focus();
}

async function saveStaffSetting() {
  const modal = document.getElementById('staff-setting-modal');
  const id = parseInt(modal.dataset.staffId, 10);
  if (!id) return;
  const staff = STAFF.find(x => x.id === id);

  const name  = document.getElementById('ss-name')?.value?.trim();
  const email = document.getElementById('ss-email')?.value?.trim();
  const phone = document.getElementById('ss-phone')?.value?.trim();
  const dept  = document.getElementById('ss-dept')?.value?.trim();
  const pw    = document.getElementById('ss-pw')?.value || '';

  if (!name)  { showToast('Họ tên không được để trống!', 'error'); switchSettingTab('tab-info'); return; }
  if (!email) { showToast('Email không được để trống!', 'error'); switchSettingTab('tab-info'); return; }

  // Thu thập quyền từ tab phân quyền
  const permKeys = [
    'view_form','add_form','edit_form','delete_form',
    'view_approval','approve','share_form',
    'view_report','export_data',
    'view_staff','manage_staff',
    'view_notif','send_notif',
    'view_library','add_library','edit_library','delete_library',
    'view_feedback','delete_feedback',
  ];
  const quyen = {};
  permKeys.forEach(k => {
    const el = document.getElementById('ss-perm-' + k);
    quyen[k] = el ? el.checked : false;
  });

  const body = {
    ho_ten: name,
    email,
    so_dien_thoai: phone || null,
    phong_ban: dept || null,
    vai_tro: staff?.role || 'staff',
    trang_thai: staff?.status || 'active',
    quyen,
  };
  if (pw) body.mat_khau = pw;

  try {
    const token = getToken();
    const res = await fetch(API + '/' + id, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Đã lưu cài đặt cho ' + name + ' ✅', 'success');
      closeModal('staff-setting-modal');
      loadStaff();
    } else {
      showToast(data.message || 'Lưu thất bại!', 'error');
    }
  } catch(e) {
    showToast('Không kết nối được server!', 'error');
  }
}
