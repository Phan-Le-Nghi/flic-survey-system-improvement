// ═══════════════════════════════════════════════════════════════
// SETTINGS PAGE — kết nối API thật
// ═══════════════════════════════════════════════════════════════

const API = API_BASE;

function getToken() {
  return localStorage.getItem('token') || '';
}
function authHeader() {
  return { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' };
}

async function loadCurrentUser() {
  try {
    const res = await fetch(API + '/auth/me', { headers: authHeader() });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  }
}

// ── Render toàn bộ trang sau khi có dữ liệu user ──────────────
async function renderSettingsPage() {
  const user = await loadCurrentUser();
  const avatarSrc = localStorage.getItem('flic_avatar_' + user.id) || '';
  const initials  = (user.ho_ten || 'U').split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();

  const avatarHtml = avatarSrc
    ? `<img id="avatar-img" src="${avatarSrc}" style="width:72px;height:72px;border-radius:50%;object-fit:cover">`
    : `<div id="avatar-img" class="avatar-initials" style="background:#0ea5e9;width:72px;height:72px;font-size:24px">${initials}</div>`;

  document.getElementById('page-content').innerHTML = `
  <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
    <div><h2 class="page-title">Cài đặt</h2><p class="page-sub">Quản lý cài đặt tài khoản và hệ thống</p></div>
    <button class="btn btn-primary" onclick="saveSettings()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      Lưu thay đổi
    </button>
  </div>

  <div data-tabs>
    <div class="tabs">
      <button class="tab-btn active" data-tab="account">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:4px"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Tài khoản
      </button>
      <button class="tab-btn" data-tab="notifications">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:4px"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>Thông báo
      </button>
      <button class="tab-btn" data-tab="security">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:4px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Bảo mật
      </button>
      <button class="tab-btn" data-tab="appearance">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>Giao diện
      </button>
    </div>

    <!-- ACCOUNT TAB -->
    <div class="tab-content active" data-tab-content="account">
      <div class="card card-body">
        <div style="display:flex;align-items:center;gap:20px;margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid var(--gray-200)">
          <div style="position:relative">
            ${avatarHtml}
          </div>
          <div>
            <div style="font-size:18px;font-weight:600">${user.ho_ten || 'Người dùng'}</div>
            <div style="font-size:13px;color:var(--gray-500)">${user.vai_tro || ''} · ${user.phong_ban || ''}</div>
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
              <button class="btn btn-outline btn-sm" onclick="document.getElementById('avatar-file-input').click()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Tải ảnh lên
              </button>
              ${avatarSrc ? `<button class="btn btn-outline btn-sm" style="color:var(--red)" onclick="removeAvatar(${user.id})">Xóa ảnh</button>` : ''}

            </div>
            <input type="file" id="avatar-file-input" accept="image/*" style="display:none"
              onchange="handleAvatarUpload(event, ${user.id || 0})">
            <div style="font-size:11.5px;color:var(--gray-400);margin-top:6px">JPG, PNG · Tối đa 2MB</div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Họ và tên</label>
            <input type="text" id="set-hoten" class="input" value="${user.ho_ten || ''}"></div>
          <div class="form-group"><label class="form-label">Email</label>
            <input type="email" id="set-email" class="input" value="${user.email || ''}"></div>
          <div class="form-group"><label class="form-label">Số điện thoại</label>
            <input type="tel" id="set-sdt" class="input" value="${user.so_dien_thoai || ''}"></div>
          <div class="form-group"><label class="form-label">Phòng ban</label>
            <input type="text" class="input" value="${user.phong_ban || 'Chưa phân công'}" readonly style="background:var(--gray-50)"></div>
        </div>
      </div>
    </div>

    <!-- NOTIFICATIONS TAB -->
    <div class="tab-content" data-tab-content="notifications">
      <div class="card card-body">
        <div class="section-title" style="margin-bottom:20px">Cài đặt thông báo</div>
        ${[
          {label:'Thông báo qua Email',desc:'Nhận thông báo qua địa chỉ email',id:'notif-email',checked:true},
          {label:'Thông báo đẩy',desc:'Nhận thông báo trên trình duyệt',id:'notif-push',checked:true},
          {label:'Thông báo khi có phê duyệt',desc:'Nhận thông báo khi có yêu cầu phê duyệt mới',id:'notif-approval',checked:true},
          {label:'Thông báo phản hồi mới',desc:'Nhận thông báo khi có phản hồi mới',id:'notif-feedback',checked:false},
          {label:'Báo cáo tuần',desc:'Nhận tóm tắt hoạt động hàng tuần',id:'notif-weekly',checked:true},
        ].map(n=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid var(--gray-100)">
            <div><div style="font-weight:500;font-size:14px">${n.label}</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:2px">${n.desc}</div></div>
            <label class="switch"><input type="checkbox" id="${n.id}" ${n.checked?'checked':''}><span class="switch-track"></span></label>
          </div>`).join('')}
      </div>
    </div>

    <!-- SECURITY TAB -->
    <div class="tab-content" data-tab-content="security">
      <div class="card card-body" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:20px">Đổi mật khẩu</div>
        <div class="form-group"><label class="form-label">Mật khẩu hiện tại</label>
          <div class="input-wrap">
            <input type="password" id="pw-old" class="input" placeholder="••••••••">
            <button type="button" class="input-icon-right" onclick="togglePw(this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Mật khẩu mới</label>
          <div class="input-wrap">
            <input type="password" id="pw-new" class="input" placeholder="••••••••" oninput="checkPwStrength()">
            <button type="button" class="input-icon-right" onclick="togglePw(this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
        <div id="pw-strength" style="margin-bottom:14px;display:none">
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px">Độ mạnh: <span id="pw-strength-label"></span></div>
          <div style="height:4px;background:var(--gray-100);border-radius:4px"><div id="pw-strength-bar" style="height:100%;border-radius:4px;transition:all .3s;width:0"></div></div>
        </div>
        <div class="form-group"><label class="form-label">Xác nhận mật khẩu mới</label>
          <div class="input-wrap">
            <input type="password" id="pw-confirm" class="input" placeholder="••••••••">
            <button type="button" class="input-icon-right" onclick="togglePw(this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
        <button class="btn btn-primary" onclick="changePassword()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          Đổi mật khẩu
        </button>
      </div>
      <div class="card card-body">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div><div style="font-weight:500;font-size:14px">Xác thực 2 bước (2FA)</div>
          <div style="font-size:12px;color:var(--gray-500);margin-top:2px">Tăng cường bảo mật tài khoản</div></div>
          <label class="switch"><input type="checkbox" onchange="showToast('Đã cập nhật bảo mật','success')"><span class="switch-track"></span></label>
        </div>
      </div>
    </div>

    <!-- APPEARANCE TAB -->
    <div class="tab-content" data-tab-content="appearance">
      <div class="card card-body">
        <div style="font-size:16px;font-weight:700;margin-bottom:20px">Giao diện</div>
        <div class="form-label" style="margin-bottom:12px">Giao diện hiển thị</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:720px">
          <div onclick="selectTheme('light')" style="cursor:pointer;border-radius:12px;border:2.5px solid #0ea5e9;overflow:hidden" id="t-light">
            <div style="height:90px;background:#f8fafc;border-bottom:1px solid #e2e8f0;position:relative">
              <div style="position:absolute;top:8px;left:8px;right:8px;height:10px;background:#e2e8f0;border-radius:3px"></div>
              <div style="position:absolute;top:26px;left:8px;width:40%;height:8px;background:#cbd5e1;border-radius:3px"></div>
            </div>
            <div style="padding:10px 12px;background:#fff;display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:13px;font-weight:600">Sáng</span>
              <div id="t-light-check" style="width:18px;height:18px;border-radius:50%;background:#0ea5e9;display:flex;align-items:center;justify-content:center">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="11" height="11"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
          </div>
          <div onclick="selectTheme('dark')" style="cursor:pointer;border-radius:12px;border:2px solid #e2e8f0;overflow:hidden" id="t-dark">
            <div style="height:90px;background:#1e293b;border-bottom:1px solid #334155;position:relative">
              <div style="position:absolute;top:8px;left:8px;right:8px;height:10px;background:#334155;border-radius:3px"></div>
            </div>
            <div style="padding:10px 12px;background:#fff;display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:13px;font-weight:600">Tối</span>
              <div id="t-dark-check" style="width:18px;height:18px;border-radius:50%;background:var(--gray-200)"></div>
            </div>
          </div>
          <div onclick="selectTheme('auto')" style="cursor:pointer;border-radius:12px;border:2px solid #e2e8f0;overflow:hidden" id="t-auto">
            <div style="height:90px;background:linear-gradient(135deg,#f8fafc 50%,#1e293b 50%);border-bottom:1px solid #e2e8f0"></div>
            <div style="padding:10px 12px;background:#fff;display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:13px;font-weight:600">Tự động</span>
              <div id="t-auto-check" style="width:18px;height:18px;border-radius:50%;background:var(--gray-200)"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;
  if (typeof initTabs === 'function') initTabs();
}

// ════════════════════════════════════════════════════════════════
// AVATAR
// ════════════════════════════════════════════════════════════════
function handleAvatarUpload(event, userId) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Ảnh phải nhỏ hơn 2MB!', 'error'); return; }
  if (!file.type.startsWith('image/')) { showToast('Vui lòng chọn file ảnh!', 'error'); return; }

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    try {
      localStorage.setItem('flic_avatar_' + userId, base64);
    } catch {
      showToast('Bộ nhớ đầy, không lưu được ảnh!', 'error'); return;
    }
    // Cập nhật ảnh ngay trên UI
    const el = document.getElementById('avatar-img');
    if (el) {
      const img = document.createElement('img');
      img.id = 'avatar-img';
      img.src = base64;
      img.style.cssText = 'width:72px;height:72px;border-radius:50%;object-fit:cover';
      el.parentNode.replaceChild(img, el);
    }
    event.target.value = '';
    showToast('Đã cập nhật ảnh đại diện ✅', 'success');
  };
  reader.readAsDataURL(file);
}

function removeAvatar(userId) {
  if (!confirm('Xóa ảnh đại diện?')) return;
  localStorage.removeItem('flic_avatar_' + userId);
  showToast('Đã xóa ảnh đại diện', 'success');
  renderSettingsPage();
}

// ════════════════════════════════════════════════════════════════
// LƯU THÔNG TIN → PUT /api/auth/profile
// ════════════════════════════════════════════════════════════════
async function saveSettings() {
  const ho_ten        = document.getElementById('set-hoten')?.value?.trim();
  const email         = document.getElementById('set-email')?.value?.trim();
  const so_dien_thoai = document.getElementById('set-sdt')?.value?.trim();

  if (!ho_ten) { showToast('Họ tên không được để trống!', 'error'); return; }
  if (!email)  { showToast('Email không được để trống!', 'error'); return; }

  try {
    const res = await fetch(API + '/auth/profile', {
      method: 'PUT',
      headers: authHeader(),
      body: JSON.stringify({ ho_ten, email, so_dien_thoai }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Lỗi lưu thông tin', 'error'); return; }

    // Cập nhật cache localStorage
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      Object.assign(u, { ho_ten, email, so_dien_thoai });
      localStorage.setItem('user', JSON.stringify(u));
    } catch {}

    showToast('Đã lưu thông tin thành công ✅', 'success');
  } catch {
    showToast('Không kết nối được server!', 'error');
  }
}

// ════════════════════════════════════════════════════════════════
// ĐỔI MẬT KHẨU → POST /api/auth/change-password
// ════════════════════════════════════════════════════════════════
async function changePassword() {
  const mat_khau_cu  = document.getElementById('pw-old')?.value || '';
  const mat_khau_moi = document.getElementById('pw-new')?.value || '';
  const confirm_pw   = document.getElementById('pw-confirm')?.value || '';

  if (!mat_khau_cu)              { showToast('Vui lòng nhập mật khẩu hiện tại!', 'error'); return; }
  if (!mat_khau_moi)             { showToast('Vui lòng nhập mật khẩu mới!', 'error'); return; }
  if (mat_khau_moi.length < 6)   { showToast('Mật khẩu mới phải ít nhất 6 ký tự!', 'error'); return; }
  if (mat_khau_moi !== confirm_pw){ showToast('Mật khẩu xác nhận không khớp!', 'error'); return; }

  try {
    const res = await fetch(API + '/auth/change-password', {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ mat_khau_cu, mat_khau_moi }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Đổi mật khẩu thất bại', 'error'); return; }

    ['pw-old','pw-new','pw-confirm'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('pw-strength').style.display = 'none';
    showToast('Đổi mật khẩu thành công ✅', 'success');
  } catch {
    showToast('Không kết nối được server!', 'error');
  }
}

// ── Đo độ mạnh mật khẩu ────────────────────────────────────────
function checkPwStrength() {
  const pw  = document.getElementById('pw-new')?.value || '';
  const bar = document.getElementById('pw-strength-bar');
  const lbl = document.getElementById('pw-strength-label');
  const wrap= document.getElementById('pw-strength');
  if (!wrap) return;
  if (!pw) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  let score = 0;
  if (pw.length >= 8)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const lvs = [
    {pct:20,color:'#ef4444',text:'Rất yếu'},
    {pct:40,color:'#f97316',text:'Yếu'},
    {pct:65,color:'#f59e0b',text:'Trung bình'},
    {pct:85,color:'#22c55e',text:'Mạnh'},
    {pct:100,color:'#10b981',text:'Rất mạnh'},
  ];
  const lv = lvs[Math.min(score, lvs.length-1)];
  bar.style.width = lv.pct + '%';
  bar.style.background = lv.color;
  lbl.textContent = lv.text;
  lbl.style.color = lv.color;
}

function togglePw(btn) {
  const input = btn.closest('.input-wrap')?.querySelector('input');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

function selectTheme(theme) {
  ['light','dark','auto'].forEach(t => {
    const card  = document.getElementById('t-' + t);
    const check = document.getElementById('t-' + t + '-check');
    if (!card || !check) return;
    if (t === theme) {
      card.style.border = '2.5px solid #0ea5e9';
      check.style.background = '#0ea5e9';
      check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="11" height="11"><polyline points="20 6 9 17 4 12"/></svg>';
    } else {
      card.style.border = '2px solid #e2e8f0';
      check.style.background = 'var(--gray-200)';
      check.innerHTML = '';
    }
  });
  localStorage.setItem('flic_theme', theme);
  showToast('Đã chọn giao diện: ' + {light:'Sáng',dark:'Tối',auto:'Tự động'}[theme], 'success');
}

// Khởi động
renderSettingsPage().then(() => {
  const tab = new URLSearchParams(window.location.search).get('tab');
  if (tab) switchTab(tab);
});

function switchTab(tabId) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.click();
}

// ── CÀI ĐẶT TÀI KHOẢN modal ───────────────────────────────────
document.body.insertAdjacentHTML('beforeend', `
  <div class="modal-overlay" id="my-setting-modal" style="z-index:9999">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:580px;border-radius:14px">
      <div class="modal-header">
        <div><div class="modal-title">Cài đặt tài khoản</div>
        <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Thông tin và cấu hình tài khoản của bạn</div></div>
        <button class="icon-btn close-btn" onclick="closeModal('my-setting-modal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div id="my-setting-body" style="padding:20px;max-height:72vh;overflow-y:auto"></div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('my-setting-modal')">Đóng</button>
        <button class="btn btn-primary" onclick="saveMyAccountSetting()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Lưu cài đặt
        </button>
      </div>
    </div>
  </div>
`);

async function openMyAccountSetting() {
  const token = localStorage.getItem('token') || '';
  let user = {};
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (res.ok) user = await res.json();
  } catch(e) {
    try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch {}
  }

  const permGroups = [
    { label:'Quản lý biểu mẫu', color:'#0ea5e9', items:[
      {key:'view_form',label:'Xem form'},{key:'create_form',label:'Tạo form'},
      {key:'edit_form',label:'Sửa form'},{key:'delete_form',label:'Xóa form'}]},
    { label:'Phê duyệt', color:'#10b981', items:[
      {key:'view_approval',label:'Xem phê duyệt'},{key:'approve',label:'Phê duyệt / Từ chối'}]},
    { label:'Báo cáo', color:'#8b5cf6', items:[
      {key:'view_report',label:'Xem báo cáo'},{key:'export_data',label:'Xuất dữ liệu'}]},
    { label:'Nhân viên', color:'#f97316', items:[
      {key:'view_staff',label:'Xem nhân viên'},{key:'manage_staff',label:'Thêm / Sửa / Xóa / Vô hiệu hóa'}]},
    { label:'Thông báo', color:'#ec4899', items:[
      {key:'view_notif',label:'Xem thông báo'},{key:'send_notif',label:'Gửi thông báo'}]},
  ];

  document.getElementById('my-setting-body').innerHTML = `
    <div style="display:flex;gap:0;border-bottom:2px solid var(--gray-200);margin-bottom:20px">
      <button onclick="switchMyTab('myt-info')" id="mybtn-info" style="padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid #0ea5e9;color:#0ea5e9;margin-bottom:-2px">Thông tin</button>
      <button onclick="switchMyTab('myt-perm')" id="mybtn-perm" style="padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;color:var(--gray-400);margin-bottom:-2px">Phân quyền</button>
      <button onclick="switchMyTab('myt-notif')" id="mybtn-notif" style="padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;color:var(--gray-400);margin-bottom:-2px">Thông báo</button>
    </div>

    <div id="myt-info">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="form-group"><label class="form-label">Họ và tên</label><input type="text" id="mys-name" class="input" value="${user.ho_ten || ''}"></div>
        <div class="form-group"><label class="form-label">Email</label><input type="email" id="mys-email" class="input" value="${user.email || ''}"></div>
        <div class="form-group"><label class="form-label">Số điện thoại</label><input type="tel" id="mys-phone" class="input" value="${user.so_dien_thoai || ''}"></div>
        <div class="form-group"><label class="form-label">Vai trò</label><input class="input" value="${user.vai_tro||''}" readonly style="background:var(--gray-50)"></div>
        <div class="form-group"><label class="form-label">Phòng ban</label><input class="input" value="${user.phong_ban||''}" readonly style="background:var(--gray-50)"></div>
        <div class="form-group"><label class="form-label">Trạng thái</label><input class="input" value="${user.trang_thai==='active'?'Hoạt động':'Ngừng'}" readonly style="background:var(--gray-50)"></div>
      </div>
      <div class="form-group" style="margin-top:4px"><label class="form-label">Đổi mật khẩu</label>
        <div style="display:flex;gap:8px">
          <input type="password" id="mys-pw-old" class="input" placeholder="Mật khẩu hiện tại" style="flex:1">
          <input type="password" id="mys-pw-new" class="input" placeholder="Mật khẩu mới" style="flex:1">
        </div>
      </div>
    </div>

    <div id="myt-perm" style="display:none">
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12.5px;color:#92400e">
        ⚠️ Phân quyền do quản trị viên cấp, bạn chỉ có thể xem.
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${permGroups.map(g => `
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="width:10px;height:10px;border-radius:50%;background:${g.color};display:inline-block"></span>
              <span style="font-size:13px;font-weight:700;color:var(--gray-800)">${g.label}</span>
            </div>
            <div style="background:#f8fafc;border:1px solid var(--gray-200);border-radius:10px;padding:10px 14px;display:flex;flex-wrap:wrap;gap:8px">
              ${g.items.map(item => `
                <div style="display:flex;align-items:center;gap:6px;font-size:13px;min-width:45%;color:var(--gray-700)">
                  <span style="width:14px;height:14px;border-radius:3px;border:1.5px solid ${user[item.key] ? g.color : 'var(--gray-300)'};background:${user[item.key] ? g.color : '#fff'};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">
                    ${user[item.key] ? '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="9" height="9"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                  </span>
                  ${item.label}
                </div>`).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>

    <div id="myt-notif" style="display:none">
      ${[
        {id:'myn-email',label:'Thông báo qua Email',desc:'Nhận email khi có sự kiện mới',val:true},
        {id:'myn-approval',label:'Thông báo phê duyệt',desc:'Khi có yêu cầu phê duyệt mới',val:!!user.view_approval},
        {id:'myn-feedback',label:'Thông báo phản hồi',desc:'Khi có phản hồi mới',val:false},
        {id:'myn-system',label:'Thông báo hệ thống',desc:'Cập nhật và bảo trì',val:true},
      ].map(n => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--gray-100)">
          <div><div style="font-size:13.5px;font-weight:500">${n.label}</div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:2px">${n.desc}</div></div>
          <label class="switch"><input type="checkbox" id="${n.id}" ${n.val?'checked':''}><span class="switch-track"></span></label>
        </div>`).join('')}
    </div>
  `;

  document.getElementById('my-setting-modal').dataset.userId = user.id || 0;
  openModal('my-setting-modal');
}

function switchMyTab(tabId) {
  ['myt-info','myt-perm','myt-notif'].forEach(t => {
    document.getElementById(t).style.display = t === tabId ? '' : 'none';
  });
  const map = {'myt-info':'mybtn-info','myt-perm':'mybtn-perm','myt-notif':'mybtn-notif'};
  Object.entries(map).forEach(([t, btnId]) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const active = map[tabId] === btnId;
    btn.style.borderBottomColor = active ? '#0ea5e9' : 'transparent';
    btn.style.color = active ? '#0ea5e9' : 'var(--gray-400)';
  });
}

async function saveMyAccountSetting() {
  const token = localStorage.getItem('token') || '';
  const name  = document.getElementById('mys-name')?.value?.trim();
  const email = document.getElementById('mys-email')?.value?.trim();
  const phone = document.getElementById('mys-phone')?.value?.trim();
  const pwOld = document.getElementById('mys-pw-old')?.value || '';
  const pwNew = document.getElementById('mys-pw-new')?.value || '';

  if (!name)  { showToast('Họ tên không được để trống!', 'error'); return; }
  if (!email) { showToast('Email không được để trống!', 'error'); return; }

  // Lưu thông tin
  try {
    const r1 = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ ho_ten: name, email, so_dien_thoai: phone }),
    });
    const d1 = await r1.json();
    if (!r1.ok) { showToast(d1.message || 'Lỗi lưu thông tin', 'error'); return; }
  } catch { showToast('Không kết nối được server!', 'error'); return; }

  // Đổi mật khẩu nếu có nhập
  if (pwOld && pwNew) {
    if (pwNew.length < 6) { showToast('Mật khẩu mới phải ít nhất 6 ký tự!', 'error'); return; }
    try {
      const r2 = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ mat_khau_cu: pwOld, mat_khau_moi: pwNew }),
      });
      const d2 = await r2.json();
      if (!r2.ok) { showToast(d2.message || 'Đổi mật khẩu thất bại', 'error'); return; }
    } catch { showToast('Lỗi đổi mật khẩu!', 'error'); return; }
  }

  // Cập nhật cache
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    Object.assign(u, { ho_ten: name, email, so_dien_thoai: phone });
    localStorage.setItem('user', JSON.stringify(u));
  } catch {}

  showToast('Đã lưu cài đặt tài khoản ✅', 'success');
  closeModal('my-setting-modal');
  renderSettingsPage(); // refresh trang cài đặt
}

// ===== THEME HOOKS =====
function syncThemeSelection(theme) {
  ['light', 'dark', 'auto'].forEach(t => {
    const card = document.getElementById('t-' + t);
    const check = document.getElementById('t-' + t + '-check');
    if (!card || !check) return;
    if (t === theme) {
      card.style.border = '2.5px solid #0ea5e9';
      check.style.background = '#0ea5e9';
      check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="11" height="11"><polyline points="20 6 9 17 4 12"/></svg>';
    } else {
      card.style.border = '2px solid #e2e8f0';
      check.style.background = 'var(--gray-200)';
      check.innerHTML = '';
    }
  });
}

selectTheme = function(theme) {
  syncThemeSelection(theme);
  localStorage.setItem('flic_theme', theme);
  if (typeof window.applyTheme === 'function') {
    window.applyTheme(theme);
  }
  showToast('Đã chọn giao diện: ' + ({ light: 'Sáng', dark: 'Tối', auto: 'Tự động' }[theme] || theme), 'success');
};

setTimeout(() => {
  const theme = (typeof window.getStoredTheme === 'function' && window.getStoredTheme()) || localStorage.getItem('flic_theme') || 'light';
  syncThemeSelection(theme);
  if (typeof window.applyTheme === 'function') {
    window.applyTheme(theme);
  }
}, 0);

selectTheme = function(theme) {
  syncThemeSelection(theme);
  localStorage.setItem('flic_theme', theme);
  if (typeof window.applyTheme === 'function') {
    window.applyTheme(theme);
  }
  showToast('\u0110\u00e3 ch\u1ecdn giao di\u1ec7n: ' + ({ light: 'S\u00e1ng', dark: 'T\u1ed1i', auto: 'T\u1ef1 \u0111\u1ed9ng' }[theme] || theme), 'success');
};