// Thiết lập giao diện tĩnh cho trang (Header, Bộ lọc, Bảng)
document.getElementById("page-content").innerHTML = `
  <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between">
    <div>
      <h2 class="page-title">Nhật ký hoạt động</h2>
      <p class="page-sub">Theo dõi lịch sử các thao tác liên quan đến biểu mẫu trên hệ thống</p>
    </div>
  </div>

  <div class="card card-body" style="margin-bottom:20px; display:flex; gap:12px; flex-wrap:wrap;">
    <div class="input-wrap" style="flex:1; min-width:260px;">
      <div class="input-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
      <input type="text" id="filter-search" class="input" placeholder="Tìm kiếm tên nhân viên hoặc tên biểu mẫu..." oninput="filterLogs()">
    </div>
    
    <select id="filter-action" class="input" style="width:220px;" onchange="filterLogs()">
      <option value="all">Tất cả hành động</option>
      <option value="create">Tạo mới</option>
      <option value="edit">Chỉnh sửa</option>
      <option value="delete">Xóa / Thùng rác</option>
      <option value="restore">Khôi phục</option>
      <option value="approve">Phê duyệt / Đổi trạng thái</option>
    </select>

    <input type="date" id="filter-date" class="input" style="width:160px;" onchange="filterLogs()">
  </div>

  <div class="card">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width: 15%">Thời gian</th>
            <th style="width: 20%">Người thực hiện</th>
            <th style="width: 15%">Hành động</th>
            <th style="width: 25%">Biểu mẫu tác động</th>
            <th style="width: 25%">Chi tiết</th>
          </tr>
        </thead>
        <tbody id="log-table-body">
          <tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400)">Đang tải dữ liệu...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
`;

// MOCK DATA: Chú ý chỉ track thao tác Biểu Mẫu, không track Nhân Viên
const mockLogs = [
  { id: 1, time: '2026-05-01T14:30:00', user: 'Nguyễn Văn A', role: 'Nhân viên', actionType: 'create', actionLabel: 'Tạo mới', formName: 'Khảo sát Tiếng Anh đầu vào', detail: 'Tạo bản nháp biểu mẫu mới (Lý do: Chuẩn bị cho kỳ thi sắp tới)' },
  { id: 2, time: '2026-05-01T15:00:00', user: 'Trần Thị B', role: 'Nhân viên', actionType: 'edit', actionLabel: 'Chỉnh sửa', formName: 'Đánh giá giảng viên Tin học', detail: 'Cập nhật nội dung câu hỏi số 3 và số 4 (Lý do: Câu hỏi bị sai chính tả và thiếu lựa chọn)' },
  { id: 3, time: '2026-05-02T09:15:00', user: 'Lê Văn C', role: 'Quản lý', actionType: 'approve', actionLabel: 'Phê duyệt', formName: 'Đánh giá giảng viên Tin học', detail: 'Chuyển trạng thái từ Chờ duyệt sang Đã duyệt (Lý do: Nội dung đã đạt yêu cầu)' },
  { id: 4, time: '2026-05-02T10:05:00', user: 'Nguyễn Văn A', role: 'Nhân viên', actionType: 'delete', actionLabel: 'Xóa', formName: 'Khảo sát sự kiện ngoại khóa', detail: 'Đưa biểu mẫu vào thùng rác (Lý do: Biểu mẫu bị trùng lặp)' },
  { id: 5, time: '2026-05-02T10:30:00', user: 'Lê Văn C', role: 'Quản lý', actionType: 'restore', actionLabel: 'Khôi phục', formName: 'Khảo sát sự kiện ngoại khóa', detail: 'Khôi phục biểu mẫu từ thùng rác về trạng thái Nháp (Lý do: Cần tái sử dụng lại)' },
  { id: 6, time: '2026-05-03T11:00:00', user: 'Phạm Thị D', role: 'Quản lý', actionType: 'close', actionLabel: 'Đóng biểu mẫu', formName: 'Đăng ký thi MOS Tháng 5', detail: 'Chủ động đóng biểu mẫu ngừng nhận phản hồi (Lý do: Đã đủ số lượng đăng ký)' },
];

// Hàm trả về mã HTML của Badge màu tương ứng với class có sẵn trong main.css
function getActionBadge(type, label) {
  let bgColor = '#e5e7eb';
  let color = '#374151';

  switch (type) {
    case 'create': bgColor = '#dcfce7'; color = '#15803d'; break; // Xanh lá
    case 'edit': bgColor = '#ffedd5'; color = '#c2410c'; break; // Cam
    case 'delete': bgColor = '#fee2e2'; color = '#b91c1c'; break; // Đỏ
    case 'restore': bgColor = '#ccfbf1'; color = '#0f766e'; break; // Xanh lơ mòng két
    case 'approve': bgColor = '#e0e7ff'; color = '#00008B'; break; // Xanh logo
    case 'close': bgColor = '#f1f5f9'; color = '#475569'; break; // Xám
  }

  return `<span style="display:inline-block; width:120px; text-align:center; padding:5px 8px; border-radius:6px; background-color:${bgColor}; color:${color}; font-size:13px; font-weight:600;">${label}</span>`;
}

// Render dữ liệu ra bảng
function renderLogs(data) {
  const tbody = document.getElementById('log-table-body');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400)">Không tìm thấy lịch sử hoạt động nào phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(log => {
    const dateObj = new Date(log.time);
    const timeString = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateString = dateObj.toLocaleDateString('vi-VN');

    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--gray-800)">${timeString}</div>
          <div style="font-size: 13px; color: var(--gray-600); margin-top: 4px">Ngày ${dateString}</div>
        </td>
        <td>
          <div style="font-weight: 500; color: var(--gray-900)">${log.user}</div>
          <div style="font-size: 12px; color: var(--gray-500); margin-top: 2px">${log.role}</div>
        </td>
        <td>
          ${getActionBadge(log.actionType, log.actionLabel)}
        </td>
        <td>
          <a href="form-management.html" style="font-weight: 600; color: #00008B; text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${log.formName}</a>
        </td>
        <td>
          <div style="font-size: 13px; color: var(--gray-700); line-height: 1.4">${log.detail}</div>
        </td>
      </tr>
    `;
  }).join('');
}

// Logic lọc dữ liệu nhanh trên FE
function filterLogs() {
  const search = document.getElementById('filter-search').value.toLowerCase();
  const action = document.getElementById('filter-action').value;
  const date = document.getElementById('filter-date').value;

  const filtered = mockLogs.filter(log => {
    const matchSearch = log.user.toLowerCase().includes(search) || log.formName.toLowerCase().includes(search);
    const matchAction = action === 'all' || log.actionType === action;

    // So sánh ngày
    const logDate = log.time.split('T')[0]; // Cắt chuỗi lấy YYYY-MM-DD
    const matchDate = !date || logDate === date;

    return matchSearch && matchAction && matchDate;
  });

  renderLogs(filtered);
}

// Khởi chạy khi load trang (Sau này bạn thay bằng gọi API fetch /audit-logs từ backend)
renderLogs(mockLogs);
