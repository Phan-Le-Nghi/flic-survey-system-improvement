
-- =================================================================
-- 0. XÓA DỮ LIỆU CŨ ĐỂ CÓ THỂ CHẠY LẠI FILE INSERT NHIỀU LẦN
-- Không thay đổi cấu trúc bảng/constraint, chỉ xóa dữ liệu test cũ.
-- =================================================================
DELETE FROM ThongBao;
DELETE FROM QuestionAnalytics;
DELETE FROM FormAnalytics;
DELETE FROM YeuThich;
DELETE FROM Form_CongTac;
DELETE FROM NhatKyHoatDong;
DELETE FROM FormVersion;
DELETE FROM PheDuyet;
DELETE FROM FormUpload;
DELETE FROM ChiTietPhanHoi;
DELETE FROM LuaChon;
DELETE FROM CauHoi;
DELETE FROM ThuVienCauHoi;
DELETE FROM FormSection;
DELETE FROM PhanHoi;
DELETE FROM Form;
DELETE FROM LoaiKhaoSat;
DELETE FROM NhanVien;
GO

GO

-- =================================================================
-- =================================================================
-- 1. BẢNG NHÂN VIÊN (NhanVien) - 5 dòng tài khoản nội bộ trung tâm
-- =================================================================
PRINT N'Đang bơm dữ liệu NhanVien...';
SET IDENTITY_INSERT NhanVien ON;
INSERT INTO NhanVien (id, ho_ten, email, so_dien_thoai, ten_dang_nhap, mat_khau, vai_tro, phong_ban, trang_thai) VALUES
(1, N'Nguyễn Minh Hoàng', 'hoangnm@due.udn.vn', '0905123456', 'admin', 'pass_hashed_1', 'admin', N'Ban Giám Đốc', 'active'),
(2, N'Lê Thị Thu Thủy', 'thuyle@due.udn.vn', '0905234567', 'nvminh', 'pass_hashed_2', 'staff', N'Phòng Đào Tạo Ngoại Ngữ', 'active'),
(3, N'Trần Nhật Quang', 'quangtn@due.udn.vn', '0905345678', 'tthoa', 'pass_hashed_3', 'staff', N'Phòng Đào Tạo Tin Học', 'active'),
(4, N'Phạm Hồng Đăng', 'dangph@due.udn.vn', '0905456789', 'lvdung', 'pass_hashed_4', 'staff', N'Phòng Khảo Thí', 'active'),
(5, N'Đỗ Hoàng Long', 'longdh@due.udn.vn', '0905567890', 'ptlan', 'pass_hashed_5', 'staff', N'Phòng Công Tác Học Viên', 'active');
SET IDENTITY_INSERT NhanVien OFF;
GO

-- =================================================================
-- 2. BẢNG LOẠI KHẢO SÁT (LoaiKhaoSat) - 5 dòng danh mục dịch vụ
-- =================================================================
PRINT N'Đang bơm dữ liệu LoaiKhaoSat...';
SET IDENTITY_INSERT LoaiKhaoSat ON;
INSERT INTO LoaiKhaoSat (id, danh_muc, nganh_dao_tao, ten_loai, mo_ta, trang_thai) VALUES
(1, N'Ngoại ngữ', N'Tiếng Anh Giao Tiếp', N'Khảo sát chất lượng giảng dạy', N'Đánh giá định kỳ chất lượng giảng viên đứng lớp', 'active'),
(2, N'Ngoại ngữ', N'Luyện thi TOEIC', N'Khảo sát nguyện vọng chứng chỉ', N'Thu thập nhu cầu thi chứng chỉ quốc tế xét tốt nghiệp', 'active'),
(3, N'Tin học', N'Tin học văn phòng MOS', N'Khảo sát đăng ký lịch thi', N'Lựa chọn ca thi và phân môn thi bằng quốc tế MOS', 'active'),
(4, N'Tin học', N'Chuẩn CNTT Cơ bản DUE', N'Khảo sát cơ sở vật chất', N'Ghi nhận phản hồi về máy tính, tai nghe phòng thực hành', 'active'),
(5, N'Tin học', N'Kỹ năng mềm', N'Khảo sát dịch vụ hỗ trợ', N'Đánh giá dịch vụ tư vấn và chăm sóc học viên', 'active');
SET IDENTITY_INSERT LoaiKhaoSat OFF;
GO

-- =================================================================
-- 3. BẢNG BIỂU MẪU KHẢO SÁT (Form) - 5 chiến dịch chính
-- =================================================================
PRINT N'Đang bơm dữ liệu Form...';
SET IDENTITY_INSERT Form ON;
INSERT INTO Form (id, ten_form, loai_khao_sat_id, doi_tuong, ma_rut_gon, nguon_chia_se, mo_ta, loi_ket, trang_thai, nhan_vien_id, luot_xem, ngay_dong, mau_nen, ai_tom_tat) VALUES
(1, N'Phiếu đánh giá chất lượng giảng dạy lớp Tiếng Anh Giao Tiếp - Khóa hè', 1, N'Sinh viên', 'flic-eng-summer', 'Facebook DUE', N'Ý kiến đóng góp giúp trung tâm tối ưu hóa phương pháp giảng dạy.', N'FLIC chân thành cảm ơn ý kiến của bạn!', 'active', 2, 380, DATEADD(day, 15, GETDATE()), '#F0F4F9', N'AI Tóm tắt: 94% đánh giá tốt về giảng viên, đề xuất bổ sung thêm thời gian thảo luận nhóm.'),
(2, N'Khảo sát nguyện vọng đăng ký dự thi TOEIC xét ra trường đợt 2', 2, N'Tất cả', 'flic-toeic-out', 'Zalo Group', N'Thu thập lịch trình thi cho sinh viên trong và ngoài trường.', N'Hệ thống đã lưu lịch đăng ký dự thi.', 'active', 4, 520, DATEADD(day, 10, GETDATE()), '#FFF5F0', N'AI Tóm tắt: Thí sinh tự do tập trung đăng ký ca thi chiều Thứ Bảy.'),
(3, N'Đăng ký phân môn và ca thi lấy chứng chỉ quốc tế MOS', 3, N'Tất cả', 'flic-mos-reg', 'Website FLIC', N'Học viên lựa chọn phân môn thi MOS Word và MOS Excel.', N'Chúc bạn hoàn thành xuất sắc kỳ thi lấy bằng quốc tế!', 'active', 3, 610, DATEADD(day, 5, GETDATE()), '#E8F5E9', N'AI Tóm tắt: Số lượng đăng ký thi MOS Excel chiếm 70% tổng quy mô.'),
(4, N'Khảo sát kiểm tra hạ tầng kỹ thuật thiết bị phòng máy thực hành khu C', 4, N'Tất cả', 'flic-pc-check', 'QR Code phòng máy', N'Rà soát lỗi chuột, bàn phím, tai nghe phục vụ kỳ thi tin học.', N'Trung tâm đã tiếp nhận thông tin bảo trì.', 'active', 3, 230, DATEADD(day, 30, GETDATE()), '#FFFDE7', N'AI Tóm tắt: Xuất hiện sự cố rè tai nghe tại dãy bàn 3 phòng máy C202.'),
(5, N'Khảo sát nhu cầu đào tạo chứng chỉ tin học ứng dụng cho doanh nghiệp', 3, N'Người đi làm', 'flic-corporate-mos', 'LinkedIn', N'Đánh giá nhu cầu học và thi bằng tin học của người đi làm.', N'Cảm ơn anh/chị đã hoàn thành biểu mẫu.', 'active', 5, 95, DATEADD(day, 25, GETDATE()), '#F3E5F5', N'AI Tóm tắt: Học viên cần đào tạo chuyên sâu mảng xử lý dữ liệu báo cáo.');
SET IDENTITY_INSERT Form OFF;
GO

-- =================================================================
-- 4. BẢNG PHẦN ĐIỀU HƯỚNG BIỂU MẪU (FormSection)
-- =================================================================
PRINT N'Đang bơm dữ liệu FormSection...';
SET IDENTITY_INSERT FormSection ON;
INSERT INTO FormSection (id, form_id, title, description, thu_tu, next_action, next_section_id) VALUES
(1, 1, N'Thông tin định danh học viên', N'Vui lòng điền thông tin nền tảng', 1, 'continue', NULL),
(2, 1, N'Khảo sát chi tiết giảng viên', N'Đánh giá năng lực và phương pháp truyền đạt', 2, 'continue', NULL),
(3, 2, N'Thông tin thí sinh tự do', N'Dành riêng cho sinh viên trường ngoài và người đi làm', 1, 'continue', NULL),
(4, 3, N'Lựa chọn phân môn dự thi', N'Tick chọn chứng chỉ đăng ký lấy bằng', 1, 'continue', NULL),
(5, 3, N'Thông tin in trên bằng quốc tế', N'Nhập chính xác thông tin cá nhân', 2, 'submit', NULL),
(6, 4, N'Báo cáo chi tiết sự cố phòng thi', N'Ghi nhận lỗi phần cứng máy tính', 1, 'continue', NULL);
SET IDENTITY_INSERT FormSection OFF;
GO

-- =================================================================
-- 5. BẢNG THƯ VIỆN CÂU HỎI MẪU (ThuVienCauHoi)
-- =================================================================
PRINT N'Đang bơm dữ liệu ThuVienCauHoi...';
SET IDENTITY_INSERT ThuVienCauHoi ON;
INSERT INTO ThuVienCauHoi (id, loai_khao_sat_id, doi_tuong, noi_dung, loai, bat_buoc, bo_mon, thu_tu) VALUES
(1, 1, N'Tất cả', N'Giảng viên đứng lớp có truyền đạt dễ hiểu không?', 'choice', 1, N'Bộ môn Ngoại ngữ', 1),
(2, 2, N'Tất cả', N'Mức điểm TOEIC mục tiêu bạn cần đạt đợt này là bao nhiêu?', 'choice', 1, N'Bộ môn Ngoại ngữ', 2),
(3, 3, N'Tất cả', N'Bạn muốn đăng ký dự thi vào ca thi nào?', 'choice', 1, N'Bộ môn Tin học', 1),
(4, 4, N'Tất cả', N'Thiết bị tai nghe tại phòng thi hoạt động tốt không?', 'choice', 1, N'Bộ môn Tin học', 2),
(5, 3, N'Người đi làm', N'Chứng chỉ tin học văn phòng giúp ích gì cho công việc của bạn?', 'long_text', 1, N'Bộ môn Tin học', 3);
SET IDENTITY_INSERT ThuVienCauHoi OFF;
GO

-- =================================================================
-- 6. BẢNG CÂU HỎI THỰC TẾ TRONG FORM (CauHoi)
-- =================================================================
PRINT N'Đang bơm dữ liệu CauHoi...';
SET IDENTITY_INSERT CauHoi ON;
INSERT INTO CauHoi (id, form_id, thu_vien_id, section_id, noi_dung, loai, thu_tu, bat_buoc, mo_ta_cau_hoi) VALUES
(1, 1, 1, 1, N'Giảng viên đứng lớp giảng bài có dễ hiểu không?', 'choice', 1, 1, N'Chọn 1 phương án thích hợp'),
(2, 1, NULL, 2, N'Để lại ý kiến đóng góp tự luận để nâng cao chất lượng khóa học?', 'paragraph', 2, 0, N'Ghi ngắn gọn đóng góp của bạn'),
(3, 1, NULL, 2, N'Độ hài lòng về nhiệt độ điều hòa và không gian phòng học?', 'rating', 3, 1, N'Đánh giá theo số sao 1-5'),
(4, 2, 2, 3, N'Mục tiêu điểm số bằng TOEIC bạn cần đạt để xét ra trường/xin việc?', 'choice', 1, 1, N'Chọn mốc điểm mong muốn'),
(5, 2, NULL, 3, N'Bạn đăng ký tham gia ca thi TOEIC vào ngày nào đợt hè này?', 'choice', 2, 1, N'Lịch chọn ngày thi cụ thể'),
(6, 3, 3, 4, N'Bạn đăng ký thi lấy bằng quốc tế phân môn MOS nào?', 'multiple_choice', 1, 1, N'Có thể tick chọn cả hai môn'),
(7, 3, NULL, 4, N'Bạn lựa chọn hình thức ôn luyện thi lấy chứng chỉ nào?', 'choice', 2, 1, N'Khảo sát nguồn học liệu ôn tập'),
(8, 3, NULL, 5, N'Nhập chính xác Họ tên viết hoa có dấu để đăng ký in bằng quốc tế?', 'short_text', 3, 1, N'Ví dụ: HOÀNG VĂN TÚ'),
(9, 4, 4, 6, N'Thiết bị tai nghe nghe-nói tại máy tính bạn ngồi hoạt động ổn định không?', 'choice', 1, 1, N'Phục vụ làm bài thi phần nghe'),
(10, 4, NULL, 6, N'Bàn phím phòng máy tính có gặp hiện tượng liệt hay kẹt nút không?', 'choice', 2, 1, N'Kiểm tra độ nảy của phím bấm'),
(11, 4, NULL, 6, N'Ghi rõ số máy tính và phòng thi gặp sự cố cần sửa chữa bảo trì?', 'short_text', 3, 1, N'Ví dụ: Máy 24 phòng C202'),
(12, 5, 5, NULL, N'Kỹ năng tin học văn phòng nào ứng dụng nhiều nhất trong công việc?', 'long_text', 1, 1, N'Nêu rõ nghiệp vụ xử lý thực tế'),
(13, 5, NULL, NULL, N'Thời lượng khóa học ôn tập ngắn hạn tại FLIC có đáp ứng đủ không?', 'choice', 2, 1, N'Đánh giá số lượng buổi học ôn'),
(14, 5, NULL, NULL, N'Anh/chị có nguyện vọng mở thêm lớp ôn chứng chỉ nâng cao không?', 'choice', 3, 0, N'Ghi nhận nhu cầu mở lớp mới');
SET IDENTITY_INSERT CauHoi OFF;
GO

-- =================================================================
-- 7. BẢNG LỰA CHỌN ĐÁP ÁN KHẢO SÁT (LuaChon)
-- =================================================================
PRINT N'Đang bơm dữ liệu LuaChon...';
SET IDENTITY_INSERT LuaChon ON;
INSERT INTO LuaChon (id, cau_hoi_id, noi_dung, thu_tu, next_section_id) VALUES
(1, 1, N'Rất dễ hiểu', 1, NULL),
(2, 1, N'Bình thường', 2, NULL),
(3, 1, N'Khó hiểu', 3, NULL),
(4, 4, N'Mốc 450-600 (Đầu ra trường)', 1, NULL),
(5, 4, N'Mốc 600-750 (Xin việc làm)', 2, NULL),
(6, 4, N'Mốc trên 750 điểm', 3, NULL),
(7, 5, N'Ca sáng Thứ Bảy (27/06)', 1, NULL),
(8, 5, N'Ca chiều Thứ Bảy (27/06)', 2, NULL),
(9, 5, N'Sáng Chủ Nhật (28/06)', 3, NULL),
(10, 6, N'MOS Word 2019', 1, NULL),
(11, 6, N'MOS Excel 2019', 2, NULL),
(12, 7, N'Học lớp luyện đề offline tại FLIC', 1, NULL),
(13, 7, N'Tự ôn luyện qua phần mềm thi thử', 2, NULL),
(14, 9, N'Nghe tốt cả 2 bên', 1, NULL),
(15, 9, N'Bị rè hoặc mất tiếng 1 bên', 2, NULL),
(16, 9, N'Hỏng hoàn toàn', 3, NULL),
(17, 10, N'Phím gõ nhạy, mượt mà', 1, NULL),
(18, 10, N'Kẹt nút/Liệt phím chữ', 2, NULL),
(19, 13, N'Vừa vặn, đủ thời gian', 1, NULL),
(20, 13, N'Hơi ngắn, cần thêm số buổi', 2, NULL),
(21, 14, N'Sẵn sàng đăng ký học tiếp', 1, NULL),
(22, 14, N'Hiện tại chưa có nhu cầu', 2, NULL);
SET IDENTITY_INSERT LuaChon OFF;
GO

-- =================================================================
-- 8. BẢNG LƯỢT NỘP KHẢO SÁT (PhanHoi) - ĐỦ ĐÚNG 30 DÒNG TÊN MỚI 100%
-- =================================================================
PRINT N'Đang bơm dữ liệu PhanHoi (Đúng 30 dòng học viên mới)...';
SET IDENTITY_INSERT PhanHoi ON;
INSERT INTO PhanHoi (id, form_id, doi_tuong_nop, email_nguoi_gui, ho_ten_nguoi_gui, lop, khoa, giao_vien, trang_thai, submitted_ip, user_agent, thoi_gian_dien_form_giay) VALUES
(1, 1, N'Sinh viên', 'tuannguyen@gmail.com', N'Nguyễn Hoàng Tuấn', '48K11', N'Quản trị kinh doanh', N'Thầy Minh Trí', 'active', '192.168.1.10', 'Chrome 125.0', 45),
(2, 1, N'Sinh viên', 'maily.le@gmail.com', N'Lê Thị Mai Ly', '48K01', N'Kế toán', N'Thầy Minh Trí', 'active', '192.168.1.11', 'Safari 17.2', 50),
(3, 1, N'Sinh viên', 'baocao.tran@gmail.com', N'Trần Quốc Bảo', '49K12', N'Marketing', N'Cô Thu Hà', 'active', '192.168.1.12', 'Edge 124.0', 62),
(4, 1, N'Sinh viên', 'khanhvy.pham@gmail.com', N'Phạm Nguyễn Khánh Vy', '49K21', N'Kinh tế quốc tế', N'Thầy Minh Trí', 'active', '192.168.1.13', 'Chrome 125.0', 55),
(5, 1, N'Sinh viên', 'duyminh.vu@gmail.com', N'Vũ Dương Minh', '50K14', N'Tài chính', N'Cô Thu Hà', 'active', '192.168.1.14', 'Firefox 126.0', 38),
(6, 1, N'Sinh viên', 'ngocanh.dang@gmail.com', N'Đặng Ngọc Anh', '50K22', N'Luật kinh tế', N'Thầy Minh Trí', 'active', '192.168.1.15', 'Chrome 125.0', 48),
(7, 1, N'Sinh viên', 'tiendung.ng@gmail.com', N'Nguyễn Tiến Dũng', '51K22', N'Thương mại điện tử', N'Cô Thu Hà', 'active', '192.168.1.16', 'Chrome 125.0', 68),
(8, 2, N'Sinh viên', 'thanhtung.bku@gmail.com', N'Vũ Thanh Tùng', 'K22-BK', N'Cơ khí ĐHBK', NULL, 'active', '10.20.30.1', 'Chrome 125.0', 32),
(9, 2, N'Sinh viên', 'bichphuong.udn@gmail.com', N'Lê Thị Bích Phương', 'K23-SP', N'Sư phạm Tiếng Anh', NULL, 'active', '10.20.30.2', 'Safari 17.0', 28),
(10, 2, N'Sinh viên', 'minhtriet.bui@due.edu.vn', N'Bùi Minh Triết', '49K02', N'Kiểm toán', NULL, 'active', '10.20.30.3', 'Edge 124.0', 40),
(11, 2, N'Người đi làm', 'quynhchi.bank@gmail.com', N'Trần Quỳnh Chi', NULL, NULL, NULL, 'active', '10.20.30.4', 'Chrome 125.0', 53),
(12, 2, N'Người đi làm', 'namhoang.it@gmail.com', N'Vũ Hoàng Nam', NULL, NULL, NULL, 'active', '10.20.30.5', 'Chrome 125.0', 35),
(13, 3, N'Sinh viên', 'thuha.mkt@due.edu.vn', N'Nguyễn Thu Hà', '49K02.1', N'Marketing', NULL, 'active', '192.168.50.1', 'Chrome 125.0', 41),
(14, 3, N'Sinh viên', 'quangdung.ng@due.edu.vn', N'Nguyễn Quang Dũng', '49K11', N'Quản trị kinh doanh', NULL, 'active', '192.168.50.2', 'Chrome 125.0', 47),
(15, 3, N'Sinh viên', 'ngoclan.duc@gmail.com', N'Phạm Ngọc Lan', 'K47-SP', N'Ngữ văn ĐH Sư Phạm', NULL, 'active', '192.168.50.3', 'Edge 124.0', 33),
(16, 3, N'Người đi làm', 'haiyen.hr@gmail.com', N'Lê Thị Hải Yen', NULL, NULL, NULL, 'active', '192.168.50.4', 'Safari 17.2', 43),
(17, 3, N'Người đi làm', 'manhcuong.v@gmail.com', N'Vũ Mạnh Cường', NULL, NULL, NULL, 'active', '192.168.50.5', 'Chrome 125.0', 58),
(18, 4, N'Sinh viên', 'vanthang.le@due.edu.vn', N'Lê Văn Thắng', '49K22.2', NULL, NULL, 'active', '192.168.3.12', 'Chrome 125.0', 26),
(19, 4, N'Sinh viên', 'thuylinh.h@due.edu.vn', N'Hoàng Thùy Linh', '49K22.2', NULL, NULL, 'active', '192.168.3.45', 'Chrome 125.0', 19),
(20, 4, N'Sinh viên', 'quanghuy.ng@due.edu.vn', N'Nguyễn Quang Huy', '48K11', NULL, NULL, 'active', '192.168.3.72', 'Edge 124.0', 30),
(21, 4, N'Sinh viên', 'khanhhuyen.t@due.edu.vn', N'Trần Khánh Huyền', '48K02', NULL, NULL, 'active', '192.168.3.88', 'Chrome 125.0', 23),
(22, 4, N'Sinh viên', 'thanhthao.l@due.edu.vn', N'Lê Thanh Thảo', '51K11', NULL, NULL, 'active', '192.168.3.99', 'Safari 17.0', 27),
(23, 5, N'Người đi làm', 'kimoanh.sales@gmail.com', N'Trịnh Kim Oanh', NULL, NULL, NULL, 'active', '203.162.4.1', 'Chrome 125.0', 112),
(24, 5, N'Người đi làm', 'tienmanh.it@gmail.com', N'Nguyễn Tiến Mạnh', NULL, NULL, NULL, 'active', '203.162.4.2', 'Chrome 125.0', 125),
(25, 5, N'Người đi làm', 'thuyduong.mkt@gmail.com', N'Đỗ Thùy Dương', NULL, NULL, NULL, 'active', '203.162.4.3', 'Edge 124.0', 95),
(26, 5, N'Người đi làm', 'vuanh.edu@gmail.com', N'Vũ Tuấn Anh', NULL, NULL, NULL, 'active', '203.162.4.4', 'Firefox 126.0', 104),
(27, 5, N'Người đi làm', 'minhhang.acc@gmail.com', N'Lê Minh Hằng', NULL, NULL, NULL, 'active', '203.162.4.5', 'Chrome 125.0', 138),
(28, 2, N'Sinh viên', 'thuonghuyen@due.edu.vn', N'Trần Thương Huyền', '50K11', N'Kế toán', NULL, 'active', '10.20.30.9', 'Chrome 125.0', 36),
(29, 3, N'Sinh viên', 'quocanh.bku@gmail.com', N'Phạm Quốc Anh', 'K22-CNTT', N'Bách Khoa Đà Nẵng', NULL, 'active', '192.168.50.9', 'Edge 124.0', 40),
(30, 4, N'Sinh viên', 'hongngoc.ng@due.edu.vn', N'Nguyễn Hồng Ngọc', '50K12', NULL, NULL, 'active', '192.168.3.100', 'Chrome 125.0', 22);
SET IDENTITY_INSERT PhanHoi OFF;
GO

-- =================================================================
-- 9. BẢNG CÂU TRẢ LỜI CHI TIẾT (ChiTietPhanHoi) - ĐỦ ĐÚNG 30 DÒNG KÈM AI NÂNG CAO
-- =================================================================
PRINT N'Đang bơm dữ liệu ChiTietPhanHoi (Đúng 30 dòng câu trả lời)...';
SET IDENTITY_INSERT ChiTietPhanHoi ON;
INSERT INTO ChiTietPhanHoi (id, phan_hoi_id, cau_hoi_id, lua_chon_id, cau_tra_loi, diem_danh_gia, ai_cam_xuc, ai_tu_khoa) VALUES
(1, 1, 1, 1, N'Rất dễ hiểu', 5, N'Tích cực', N'giảng viên, dễ hiểu'),
(2, 1, 2, NULL, N'Thầy Trí giảng dạy rất nhiệt tình, lấy ví dụ thực tiễn cực kỳ lôi cuốn.', NULL, N'Tích cực', N'nhiệt tình, ví dụ thực tiễn'),
(3, 1, 3, NULL, NULL, 5, N'Tích cực', N'lớp mát, không gian thoáng'),
(4, 2, 1, 1, N'Rất dễ hiểu', 5, N'Tích cực', N'giảng viên tốt'),
(5, 2, 2, NULL, N'Trung tâm setup lớp học khang trang, sạch sẽ, giảng viên dạy hay.', NULL, N'Tích cực', N'khang trang, sạch sẽ'),
(6, 3, 1, 2, N'Bình thường', 3, N'Trung lập', N'bình thường'),
(7, 3, 2, NULL, N'Lớp học hơi đông nên điều hòa ở khu vực cuối phòng phả hơi mát không đều.', NULL, N'Tiêu cực', N'cuối phòng, mát không đều'),
(8, 4, 1, 1, N'Rất dễ hiểu', 5, N'Tích cực', N'thầy dạy hay'),
(9, 4, 3, NULL, NULL, 4, N'Tích cực', N'điều hòa mát'),
(10, 5, 1, 2, N'Bình thường', 3, N'Trung lập', N'tốc độ vừa phải'),
(11, 5, 2, NULL, N'Phòng học hơi bí khí vào buổi tối, trung tâm nên bật thêm quạt thông gió.', NULL, N'Tiêu cực', N'phòng bí, quạt thông gió'),
(12, 6, 1, 1, N'Rất dễ hiểu', 5, N'Tích cực', N'dễ hiểu bài'),
(13, 7, 1, 3, N'Khó hiểu', 2, N'Tiêu cực', N'nói hơi nhanh'),
(14, 8, 4, 4, N'Mốc 450-600 (Đầu ra trường)', NULL, N'Trung lập', N'mục tiêu ra trường tốt nghiệp'),
(15, 9, 4, 5, N'Mốc 600-750 (Xin việc làm)', NULL, N'Tích cực', N'toeic đi làm xin việc'),
(16, 10, 4, 4, N'Mốc 450-600 (Đầu ra trường)', NULL, N'Trung lập', N'chuẩn đầu ra'),
(17, 11, 5, 7, N'Sáng Thứ Bảy (27/06)', NULL, N'Trung lập', N'ca sáng tiện lợi'),
(18, 12, 5, 8, N'Chiều Thứ Bảy (27/06)', NULL, N'Trung lập', N'ca chiều thứ bảy'),
(19, 13, 6, 11, N'MOS Excel 2019', NULL, N'Trung lập', N'đăng ký thi excel'),
(20, 14, 6, 10, N'MOS Word 2019', NULL, N'Trung lập', N'đăng ký thi word'),
(21, 15, 6, 11, N'MOS Excel 2019', NULL, N'Trung lập', N'thi lấy chứng chỉ'),
(22, 16, 7, 12, N'Học lớp luyện đề offline tại FLIC', NULL, N'Tích cực', N'lớp ôn tập tốt'),
(23, 17, 7, 13, N'Tự ôn luyện qua phần mềm thi thử', NULL, N'Trung lập', N'tự cày phần mềm'),
(24, 18, 9, 13, N'Nghe rõ, âm thanh mượt', NULL, N'Tích cực', N'tai nghe xịn mượt'),
(25, 19, 9, 14, N'Bị rè hoặc mất tiếng 1 bên', NULL, N'Tiêu cực', N'tai nghe rè lỗi máy 15'),
(26, 20, 10, 16, N'Phím gõ nhạy, mượt mà', NULL, N'Tích cực', N'bàn phím tốt nhạy'),
(27, 21, 10, 17, N'Kẹt nút/Liệt phím chữ', NULL, N'Tiêu cực', N'bàn phím kẹt nút space máy 18'),
(28, 22, 9, 13, N'Nghe rõ, âm thanh mượt', NULL, N'Tích cực', N'tai nghe tốt'),
(29, 23, 11, NULL, N'Máy số 14 phòng C201 bị sập nguồn liên tục khi đang làm bài thử.', NULL, N'Tiêu cực', N'sập nguồn, lỗi máy 14'),
(30, 24, 12, NULL, N'Cần đào tạo chuyên sâu mảng phân tích dữ liệu và hàm báo cáo nâng cao.', NULL, N'Tích cực', N'hàm báo cáo nâng cao');
SET IDENTITY_INSERT ChiTietPhanHoi OFF;
GO

-- =================================================================
-- 10. BẢNG TỆP TIN ĐÍNH KÈM MINH CHỨNG (FormUpload) - FIXED LỖI NULL cau_hoi_id
-- =================================================================
PRINT N'Đang bơm dữ liệu FormUpload (30 dòng file đính kèm)...';
SET IDENTITY_INSERT FormUpload ON;
INSERT INTO FormUpload (id, phan_hoi_id, cau_hoi_id, file_name, file_url, file_type, file_size) VALUES
(1, 1, 2, 'cccd_nguyenhoangtuan.jpg', 'https://flic.due.udn.vn/uploads/cccd_tuan.jpg', 'image/jpeg', 215000),
(2, 2, 2, 'receipt_hoc_phi_maily.pdf', 'https://flic.due.udn.vn/uploads/receipt_ly.pdf', 'application/pdf', 174000),
(3, 3, 2, 'receipt_bao_tran.pdf', 'https://flic.due.udn.vn/uploads/receipt_bao.pdf', 'application/pdf', 195000),
(4, 4, 2, 'cccd_khanhvy.jpg', 'https://flic.due.udn.vn/uploads/cccd_vy.jpg', 'image/jpeg', 220000),
(5, 5, 2, 'the_sv_duyminh.png', 'https://flic.due.udn.vn/uploads/the_sv_minh.png', 'image/png', 130000),
(6, 6, 2, 'receipt_ngocanh.pdf', 'https://flic.due.udn.vn/uploads/receipt_anh.pdf', 'application/pdf', 165000),
(7, 7, 2, 'the_sv_tiendung.png', 'https://flic.due.udn.vn/uploads/the_sv_dung.png', 'image/png', 140000),
(8, 8, 4, 'the_sv_tung_bku.png', 'https://flic.due.udn.vn/uploads/the_sv_tung.png', 'image/png', 145000),
(9, 9, 4, 'the_sv_bichphuong.jpg', 'https://flic.due.udn.vn/uploads/the_sv_phuong.jpg', 'image/jpeg', 155000),
(10, 10, 4, 'receipt_minhtriet.pdf', 'https://flic.due.udn.vn/uploads/receipt_triet.pdf', 'application/pdf', 180000),
(11, 11, 4, 'anh_the_3x4_quynhchi.jpg', 'https://flic.due.udn.vn/uploads/anhthe_chi.jpg', 'image/jpeg', 89000),
(12, 12, 4, 'cccd_namhoang.jpg', 'https://flic.due.udn.vn/uploads/cccd_nam.jpg', 'image/jpeg', 205000),
(13, 13, 6, 'receipt_chuyen_khoan_mos.pdf', 'https://flic.due.udn.vn/uploads/receipt_mos.pdf', 'application/pdf', 220000),
(14, 14, 6, 'receipt_quangdung.pdf', 'https://flic.due.udn.vn/uploads/receipt_dung.pdf', 'application/pdf', 190000),
(15, 15, 6, 'the_sv_ngoclan.png', 'https://flic.due.udn.vn/uploads/the_sv_lan.png', 'image/png', 125000),
(16, 16, 6, 'cccd_haiyen.jpg', 'https://flic.due.udn.vn/uploads/cccd_yen.jpg', 'image/jpeg', 210000),
(17, 17, 6, 'receipt_manhcuong.pdf', 'https://flic.due.udn.vn/uploads/receipt_cuong.pdf', 'application/pdf', 185000),
(18, 18, 9, 'the_sv_vanthang.png', 'https://flic.due.udn.vn/uploads/the_sv_thang.png', 'image/png', 115000),
(19, 19, 9, 'receipt_thuylinh.pdf', 'https://flic.due.udn.vn/uploads/receipt_linh.pdf', 'application/pdf', 170000),
(20, 20, 10, 'cccd_quanghuy.jpg', 'https://flic.due.udn.vn/uploads/cccd_huy.jpg', 'image/jpeg', 198000),
(21, 21, 10, 'the_sv_huyen.png', 'https://flic.due.udn.vn/uploads/the_sv_huyen.png', 'image/png', 122000),
(22, 22, 9, 'receipt_thanhthao.pdf', 'https://flic.due.udn.vn/uploads/receipt_thao.pdf', 'application/pdf', 160000),
(23, 23, 11, 'cccd_kimoanh.jpg', 'https://flic.due.udn.vn/uploads/cccd_oanh.jpg', 'image/jpeg', 230000),
(24, 24, 12, 'receipt_tienmanh.pdf', 'https://flic.due.udn.vn/uploads/receipt_manh.pdf', 'application/pdf', 175000),
(25, 25, 1, 'the_sv_thuonghuyen.png', 'https://flic.due.udn.vn/uploads/the_sv_thuyen.png', 'image/png', 128000),
(26, 26, 2, 'cccd_quocanh.jpg', 'https://flic.due.udn.vn/uploads/cccd_qanh.jpg', 'image/jpeg', 202000),
(27, 27, 3, 'receipt_hongngoc.pdf', 'https://flic.due.udn.vn/uploads/receipt_ngoc.pdf', 'application/pdf', 168000),
(28, 28, 4, 'the_sv_thanhthao2.png', 'https://flic.due.udn.vn/uploads/the_sv_thao2.png', 'image/png', 131000),
(29, 29, 5, 'receipt_thanhhang.pdf', 'https://flic.due.udn.vn/uploads/receipt_hang.pdf', 'application/pdf', 182000),
(30, 30, 1, 'cccd_duongminh2.jpg', 'https://flic.due.udn.vn/uploads/cccd_minh2.jpg', 'image/jpeg', 212000);
SET IDENTITY_INSERT FormUpload OFF;
GO

-- =================================================================
-- 11. BẢNG PHÊ DUYỆT BIỂU MẪU (PheDuyet) - 30 dòng quy trình duyệt
-- =================================================================
PRINT N'Đang bơm dữ liệu PheDuyet (30 dòng tiến độ duyệt)...';
SET IDENTITY_INSERT PheDuyet ON;
INSERT INTO PheDuyet (id, form_id, nguoi_gui_id, nguoi_duyet_id, loai_phe_duyet, do_uu_tien, trang_thai, ghi_chu, ngay_xu_ly) VALUES
(1, 1, 2, 1, N'Phê duyệt thường kỳ', 'normal', 'approved', N'Đã phê chuẩn form khảo sát Anh văn lớp hè.', GETDATE()),
(2, 2, 4, 1, N'Duyệt hỏa tốc tốt nghiệp', 'urgent', 'approved', N'Kích hoạt gấp cổng nhận hồ sơ TOEIC đầu ra.', GETDATE()),
(3, 3, 3, 1, N'Phê duyệt thường kỳ', 'normal', 'approved', N'Mẫu form đăng ký thi chứng chỉ MOS hợp lệ.', GETDATE()),
(4, 4, 3, 1, N'Duyệt hỏa tốc cơ sở vật chất', 'urgent', 'approved', N'Triển khai quét lỗi phòng máy tính phục vụ kỳ thi.', GETDATE()),
(5, 5, 5, 1, N'Phê duyệt thường kỳ', 'low', 'approved', N'Duyệt mở cổng form khảo sát tin học doanh nghiệp.', GETDATE()),
(6, 1, 2, 1, N'Cập nhật cấu hình giao diện', 'normal', 'approved', N'Duyệt đổi màu nền form sang xanh đậm.', GETDATE()),
(7, 2, 4, 1, N'Gia hạn thời gian chốt form', 'urgent', 'approved', N'Nới rộng thêm 5 ngày nhận hồ sơ đăng ký.', GETDATE()),
(8, 3, 3, 1, N'Bổ sung câu hỏi phân môn', 'normal', 'approved', N'Duyệt thêm lựa chọn MOS PowerPoint.', GETDATE()),
(9, 4, 3, 1, N'Rà soát phòng máy định kỳ', 'low', 'approved', N'Duyệt nội dung phần cứng khu C.', GETDATE()),
(10, 5, 5, 1, N'Cập nhật đối tượng doanh nghiệp', 'normal', 'approved', N'Chấp thuận mở rộng filter người đi làm.', GETDATE()),
(11, 1, 2, 1, N'Review định kỳ v1', 'normal', 'approved', N'Hợp lệ', GETDATE()),
(12, 1, 2, 1, N'Review định kỳ v2', 'normal', 'approved', N'Hợp lệ', GETDATE()),
(13, 2, 4, 1, N'Review định kỳ v1', 'urgent', 'approved', N'Hợp lệ', GETDATE()),
(14, 2, 4, 1, N'Review định kỳ v2', 'urgent', 'approved', N'Hợp lệ', GETDATE()),
(15, 3, 3, 1, N'Review định kỳ v1', 'normal', 'approved', N'Hợp lệ', GETDATE()),
(16, 3, 3, 1, N'Review định kỳ v2', 'normal', 'approved', N'Hợp lệ', GETDATE()),
(17, 4, 3, 1, N'Review định kỳ v1', 'urgent', 'approved', N'Hợp lệ', GETDATE()),
(18, 4, 3, 1, N'Review định kỳ v2', 'urgent', 'approved', N'Hợp lệ', GETDATE()),
(19, 5, 5, 1, N'Review định kỳ v1', 'low', 'approved', N'Hợp lệ', GETDATE()),
(20, 5, 5, 1, N'Review định kỳ v2', 'low', 'approved', N'Hợp lệ', GETDATE()),
(21, 1, 2, 1, N'Khảo sát phụ v1', 'normal', 'approved', N'Thông qua', GETDATE()),
(22, 1, 2, 1, N'Khảo sát phụ v2', 'normal', 'approved', N'Thông qua', GETDATE()),
(23, 2, 4, 1, N'Khảo sát phụ v1', 'urgent', 'approved', N'Thông qua', GETDATE()),
(24, 2, 4, 1, N'Khảo sát phụ v2', 'urgent', 'approved', N'Thông qua', GETDATE()),
(25, 3, 3, 1, N'Khảo sát phụ v1', 'normal', 'approved', N'Thông qua', GETDATE()),
(26, 3, 3, 1, N'Khảo sát phụ v2', 'normal', 'approved', N'Thông qua', GETDATE()),
(27, 4, 3, 1, N'Khảo sát phụ v1', 'urgent', 'approved', N'Thông qua', GETDATE()),
(28, 4, 3, 1, N'Khảo sát phụ v2', 'urgent', 'approved', N'Thông qua', GETDATE()),
(29, 5, 5, 1, N'Khảo sát phụ v1', 'low', 'approved', N'Thông qua', GETDATE()),
(30, 5, 5, 1, N'Khảo sát phụ v2', 'low', 'approved', N'Thông qua', GETDATE());
SET IDENTITY_INSERT PheDuyet OFF;
GO

-- =================================================================
-- 12. BẢNG LƯU PHIÊN BẢN / AUTOSAVE (FormVersion) - 30 dòng snapshot
-- =================================================================
PRINT N'Đang bơm dữ liệu FormVersion (30 dòng lịch sử nháp)...';
SET IDENTITY_INSERT FormVersion ON;
INSERT INTO FormVersion (id, form_id, version_no, snapshot_json, created_by, note) VALUES
(1, 1, 1, '{"form_id": 1, "title": "Khảo sát Anh văn hè v1"}', 2, N'Autosave nháp khởi tạo ban đầu'),
(2, 1, 2, '{"form_id": 1, "title": "Khảo sát Anh văn hè v2"}', 2, N'Cập nhật bộ câu hỏi rating 5 sao'),
(3, 1, 3, '{"form_id": 1, "title": "Khảo sát Anh văn hè v3"}', 2, N'Chèn thêm trường upload tệp minh chứng'),
(4, 2, 1, '{"form_id": 2, "title": "Nguyện vọng TOEIC đợt 2 v1"}', 4, N'Snapshot lưu trữ cấu hình thô'),
(5, 2, 2, '{"form_id": 2, "title": "Nguyện vọng TOEIC đợt 2 v2"}', 4, N'Cấu hình giới hạn mốc điểm ra trường'),
(6, 2, 3, '{"form_id": 2, "title": "Nguyện vọng TOEIC đợt 2 v3"}', 4, N'Gài lịch ca thi sáng Thứ Bảy'),
(7, 3, 1, '{"form_id": 3, "title": "Đăng ký chứng chỉ MOS v1"}', 3, N'Snapshot cấu trúc phân môn tin học'),
(8, 3, 2, '{"form_id": 3, "title": "Đăng ký chứng chỉ MOS v2"}', 3, N'Bổ sung phân mục rẽ nhánh thí sinh tự do'),
(9, 3, 3, '{"form_id": 3, "title": "Đăng ký chứng chỉ MOS v3"}', 3, N'Cấu hình chuỗi JSON validation tên in bằng'),
(10, 4, 1, '{"form_id": 4, "title": "Quét lỗi phòng máy khu C v1"}', 3, N'Lưu vết cấu trúc phần cứng nhập liệu'),
(11, 4, 2, '{"form_id": 4, "title": "Quét lỗi phòng máy khu C v2"}', 3, N'Thêm check kẹt nút bàn phím'),
(12, 4, 3, '{"form_id": 4, "title": "Quét lỗi phòng máy khu C v3"}', 3, N'Tối ưu hóa mã QR trỏ thẳng thiết bị'),
(13, 5, 1, '{"form_id": 5, "title": "MOS Doanh nghiệp v1"}', 5, N'Nháp cấu trúc form lớp học người đi làm'),
(14, 5, 2, '{"form_id": 5, "title": "MOS Doanh nghiệp v2"}', 5, N'Thêm câu hỏi tự luận về lộ trình thăng tiến'),
(15, 5, 3, '{"form_id": 5, "title": "MOS Doanh nghiệp v3"}', 5, N'Hoàn thiện đóng gói schema gửi duyệt'),
(16, 1, 4, '{"v": 4}', 2, N'Lưu nháp tự động'),
(17, 1, 5, '{"v": 5}', 2, N'Lưu nháp tự động'),
(18, 1, 6, '{"v": 6}', 2, N'Lưu nháp tự động'),
(19, 2, 4, '{"v": 4}', 4, N'Lưu nháp tự động'),
(20, 2, 5, '{"v": 5}', 4, N'Lưu nháp tự động'),
(21, 2, 6, '{"v": 6}', 4, N'Lưu nháp tự động'),
(22, 3, 4, '{"v": 4}', 3, N'Lưu nháp tự động'),
(23, 3, 5, '{"v": 5}', 3, N'Lưu nháp tự động'),
(24, 3, 6, '{"v": 6}', 3, N'Lưu nháp tự động'),
(25, 4, 4, '{"v": 4}', 3, N'Lưu nháp tự động'),
(26, 4, 5, '{"v": 5}', 3, N'Lưu nháp tự động'),
(27, 4, 6, '{"v": 6}', 3, N'Lưu nháp tự động'),
(28, 5, 4, '{"v": 4}', 5, N'Lưu nháp tự động'),
(29, 5, 5, '{"v": 5}', 5, N'Lưu nháp tự động'),
(30, 5, 6, '{"v": 6}', 5, N'Lưu nháp tự động');
SET IDENTITY_INSERT FormVersion OFF;
GO

-- =================================================================
-- 13. BẢNG NHẬT KÝ THAO TÁC HỆ THỐNG (NhatKyHoatDong) - 30 dòng log
-- =================================================================
PRINT N'Đang bơm dữ liệu NhatKyHoatDong (30 dòng log vết)...';
SET IDENTITY_INSERT NhatKyHoatDong ON;
INSERT INTO NhatKyHoatDong (id, nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, ly_do, chi_tiet) VALUES
(1, 2, 'CREATE', 'Form', 1, N'Tạo biểu mẫu khảo sát lớp Anh văn hè', N'Khởi tạo thành công trạng thái draft'),
(2, 1, 'APPROVE', 'Form', 1, N'Duyệt biểu mẫu tiếng Anh công khai', N'Chuyển đổi trạng thái sang active'),
(3, 4, 'CREATE', 'Form', 2, N'Thiết lập cổng đăng ký thi TOEIC đầu ra', N'Khởi tạo thành công trạng thái draft'),
(4, 1, 'APPROVE', 'Form', 2, N'Kích hoạt form TOEIC xét ra trường đợt hè', N'Chuyển đổi trạng thái sang active'),
(5, 3, 'CREATE', 'Form', 3, N'Thiết lập form đăng ký thi MOS tin học', N'Khởi tạo thành công trạng thái draft'),
(6, 1, 'APPROVE', 'Form', 3, N'Duyệt mở link đăng ký bằng tin học quốc tế', N'Chuyển đổi trạng thái sang active'),
(7, 3, 'CREATE', 'Form', 4, N'Tạo biểu mẫu quét lỗi thiết bị máy tính thực hành khu C', N'Khởi tạo thành công trạng thái draft'),
(8, 1, 'APPROVE', 'Form', 4, N'Duyệt mở QR Code tại phòng máy thi', N'Chuyển đổi trạng thái sang active'),
(9, 5, 'CREATE', 'Form', 5, N'Tạo biểu mẫu khảo sát tin học doanh nghiệp', N'Khởi tạo thành công trạng thái draft'),
(10, 1, 'APPROVE', 'Form', 5, N'Duyệt mở link LinkedIn thu thập ý kiến', N'Chuyển đổi trạng thái sang active'),
(11, 2, 'UPDATE', 'Form', 1, N'Sửa giao diện', N'Đổi tone màu chủ đạo'),
(12, 2, 'UPDATE', 'Form', 1, N'Sửa mô tả', N'Tối ưu câu chữ loi_ket'),
(13, 4, 'UPDATE', 'Form', 2, N'Gia hạn lịch', N'Thay đổi ngày ngay_dong'),
(14, 4, 'UPDATE', 'Form', 2, N'Cấu hình link', N'Cập nhật ma_rut_gon'),
(15, 3, 'UPDATE', 'Form', 3, N'Thêm môn thi', N'Chèn lựa chọn Excel nâng cao'),
(16, 3, 'UPDATE', 'Form', 3, N'Sửa tiêu đề', N'Đổi tên in trên bằng'),
(17, 3, 'UPDATE', 'Form', 4, N'Thêm phòng máy', N'Cấu hình thêm phòng C203'),
(18, 3, 'UPDATE', 'Form', 4, N'Fix lỗi hiển thị', N'Sửa font chữ câu hỏi'),
(19, 5, 'UPDATE', 'Form', 5, N'Thêm filter', N'Cài đặt phân loại người đi làm'),
(20, 5, 'UPDATE', 'Form', 5, N'Cập nhật SEO', N'Thêm ảnh bìa banner'),
(21, 1, 'LOGIN', 'Account', 1, N'Đăng nhập hệ thống', N'IP 192.168.1.100'),
(22, 2, 'LOGIN', 'Account', 2, N'Đăng nhập hệ thống', N'IP 192.168.1.101'),
(23, 3, 'LOGIN', 'Account', 3, N'Đăng nhập hệ thống', N'IP 192.168.1.102'),
(24, 4, 'LOGIN', 'Account', 4, N'Đăng nhập hệ thống', N'IP 192.168.1.103'),
(25, 5, 'LOGIN', 'Account', 5, N'Đăng nhập hệ thống', N'IP 192.168.1.104'),
(26, 1, 'EXPORT', 'Excel', 1, N'Xuất báo cáo thô', N'Form khảo sát Anh văn'),
(27, 1, 'EXPORT', 'Excel', 2, N'Xuất báo cáo thô', N'Form lịch thi TOEIC'),
(28, 1, 'EXPORT', 'Excel', 3, N'Xuất báo cáo thô', N'Form đăng ký MOS'),
(29, 1, 'EXPORT', 'Excel', 4, N'Xuất báo cáo thô', N'Form lỗi phòng máy'),
(30, 1, 'EXPORT', 'Excel', 5, N'Xuất báo cáo thô', N'Form tin học doanh nghiệp');
SET IDENTITY_INSERT NhatKyHoatDong OFF;
GO

-- =================================================================
-- 14. BẢNG CHIA SẺ QUYỀN SỬA CHUNG (Form_CongTac) - 25 dòng hợp lệ theo UNIQUE(form_id, nhan_vien_id)
-- Lưu ý: DB chỉ có 5 form x 5 nhân viên = tối đa 25 cặp không trùng. Không thể insert 30 dòng nếu không sửa DB.
-- =================================================================
PRINT N'Đang bơm dữ liệu Form_CongTac (25 dòng không trùng)...';
SET IDENTITY_INSERT Form_CongTac ON;
INSERT INTO Form_CongTac (id, form_id, nhan_vien_id, quyen, can_share) VALUES
(1, 1, 1, 'editor', 1),
(2, 1, 2, 'editor', 1),
(3, 1, 3, 'viewer', 0),
(4, 1, 4, 'viewer', 0),
(5, 1, 5, 'viewer', 0),
(6, 2, 1, 'viewer', 1),
(7, 2, 2, 'editor', 0),
(8, 2, 3, 'viewer', 1),
(9, 2, 4, 'editor', 1),
(10, 2, 5, 'viewer', 0),
(11, 3, 1, 'viewer', 0),
(12, 3, 2, 'editor', 1),
(13, 3, 3, 'editor', 0),
(14, 3, 4, 'viewer', 0),
(15, 3, 5, 'editor', 1),
(16, 4, 1, 'viewer', 0),
(17, 4, 2, 'viewer', 0),
(18, 4, 3, 'editor', 1),
(19, 4, 4, 'editor', 1),
(20, 4, 5, 'viewer', 0),
(21, 5, 1, 'viewer', 1),
(22, 5, 2, 'viewer', 0),
(23, 5, 3, 'viewer', 0),
(24, 5, 4, 'editor', 0),
(25, 5, 5, 'editor', 1);
SET IDENTITY_INSERT Form_CongTac OFF;
GO

-- =================================================================
-- 15. BẢNG GHIM FORM YÊU THÍCH (YeuThich) - 25 dòng hợp lệ theo UNIQUE(nhan_vien_id, form_id)
-- Lưu ý: DB chỉ có 5 nhân viên x 5 form = tối đa 25 cặp không trùng. Không thể insert 30 dòng nếu không sửa DB.
-- =================================================================
PRINT N'Đang bơm dữ liệu YeuThich (25 dòng không trùng)...';
SET IDENTITY_INSERT YeuThich ON;
INSERT INTO YeuThich (id, nhan_vien_id, form_id) VALUES
(1, 1, 1),
(2, 1, 2),
(3, 1, 3),
(4, 1, 4),
(5, 1, 5),
(6, 2, 1),
(7, 2, 2),
(8, 2, 3),
(9, 2, 4),
(10, 2, 5),
(11, 3, 1),
(12, 3, 2),
(13, 3, 3),
(14, 3, 4),
(15, 3, 5),
(16, 4, 1),
(17, 4, 2),
(18, 4, 3),
(19, 4, 4),
(20, 4, 5),
(21, 5, 1),
(22, 5, 2),
(23, 5, 3),
(24, 5, 4),
(25, 5, 5);
SET IDENTITY_INSERT YeuThich OFF;
GO

-- =================================================================
-- 16. BẢNG CACHE THỐNG KÊ TỔNG QUAN BIỂU MẪU (FormAnalytics) - 30 dòng cache tổng
-- =================================================================
PRINT N'Đang bơm dữ liệu FormAnalytics (30 dòng bộ nhớ đệm Dashboard)...';
SET IDENTITY_INSERT FormAnalytics ON;
INSERT INTO FormAnalytics (id, form_id, metric_key, metric_json) VALUES
(1, 1, 'summary_summer', '{"total_views": 380, "submissions": 30, "completion_rate": 7.89, "peak_day": "2026-05-28"}'),
(2, 2, 'summary_toeic', '{"total_views": 520, "submissions": 30, "completion_rate": 5.76, "peak_day": "2026-05-29"}'),
(3, 3, 'summary_mos', '{"total_views": 610, "submissions": 30, "completion_rate": 4.91, "peak_day": "2026-05-27"}'),
(4, 4, 'summary_room_c', '{"total_views": 230, "submissions": 30, "completion_rate": 13.04, "peak_day": "2026-05-26"}'),
(5, 5, 'summary_corporate', '{"total_views": 95, "submissions": 30, "completion_rate": 31.57, "peak_day": "2026-05-25"}'),
(6, 1, 'monthly_report', '{"active_users": 150, "drop_rate": 2.1}'),
(7, 1, 'weekly_report', '{"clicks": 80}'),
(8, 1, 'hourly_report', '{"peak_hour": 14}'),
(9, 2, 'monthly_report', '{"active_users": 210, "drop_rate": 1.5}'),
(10, 2, 'weekly_report', '{"clicks": 95}'),
(11, 2, 'hourly_report', '{"peak_hour": 9}'),
(12, 3, 'monthly_report', '{"active_users": 340, "drop_rate": 0.9}'),
(13, 3, 'weekly_report', '{"clicks": 140}'),
(14, 3, 'hourly_report', '{"peak_hour": 15}'),
(15, 4, 'monthly_report', '{"active_users": 110, "drop_rate": 4.2}'),
(16, 4, 'weekly_report', '{"clicks": 50}'),
(17, 4, 'hourly_report', '{"peak_hour": 10}'),
(18, 5, 'monthly_report', '{"active_users": 65, "drop_rate": 0.5}'),
(19, 5, 'weekly_report', '{"clicks": 30}'),
(20, 5, 'hourly_report', '{"peak_hour": 19}'),
(21, 1, 'device_stats', '{"desktop_pct": 60, "mobile_pct": 40}'),
(22, 2, 'device_stats', '{"desktop_pct": 45, "mobile_pct": 55}'),
(23, 3, 'device_stats', '{"desktop_pct": 75, "mobile_pct": 25}'),
(24, 4, 'device_stats', '{"desktop_pct": 90, "mobile_pct": 10}'),
(25, 5, 'device_stats', '{"desktop_pct": 80, "mobile_pct": 20}'),
(26, 1, 'geo_stats', '{"da_nang": 95, "other": 5}'),
(27, 2, 'geo_stats', '{"da_nang": 88, "other": 12}'),
(28, 3, 'geo_stats', '{"da_nang": 92, "other": 8}'),
(29, 4, 'geo_stats', '{"da_nang": 100, "other": 0}'),
(30, 5, 'geo_stats', '{"da_nang": 85, "other": 15}');
SET IDENTITY_INSERT FormAnalytics OFF;
GO

-- =================================================================
-- 17. BẢNG CACHE THỐNG KÊ BIỂU ĐỒ CÂU HỎI (QuestionAnalytics) - 30 dòng cache biểu đồ
-- =================================================================
PRINT N'Đang bơm dữ liệu QuestionAnalytics (30 dòng bộ nhớ đệm câu hỏi)...';
SET IDENTITY_INSERT QuestionAnalytics ON;
INSERT INTO QuestionAnalytics (id, cau_hoi_id, metric_key, metric_json) VALUES
(1, 1, 'satisfaction_chart', '{"satisfied_pct": 85.7, "neutral_pct": 14.3, "unsatisfied_pct": 0.0}'),
(2, 4, 'target_score_chart', '{"under_450": 10.0, "450_to_650": 30.0, "above_650": 60.0}'),
(3, 5, 'exam_date_chart', '{"sat_morning": 50.0, "sat_afternoon": 20.0, "sun_morning": 30.0}'),
(4, 6, 'mos_subject_chart', '{"word": 30.0, "excel": 70.0}'),
(5, 9, 'headset_status_chart', '{"good_both": 40.0, "one_side": 50.0, "broken": 10.0}'),
(6, 10, 'keyboard_status_chart', '{"good_murt": 60.0, "ket_nut": 40.0}'),
(7, 1, 'trend_line', '{"values": [4.5, 4.6, 4.8]}'),
(8, 2, 'word_cloud', '{"nhiet_tinh": 50, "vui_ve": 30}'),
(9, 3, 'star_distribution', '{"5_star": 80, "4_star": 20}'),
(10, 4, 'trend_line', '{"values": [520, 540, 580]}'),
(11, 5, 'bar_chart', '{"weekend": 80, "weekday": 20}'),
(12, 6, 'pie_chart', '{"word_2019": 40, "excel_2019": 60}'),
(13, 7, 'method_share', '{"offline": 70, "online": 30}'),
(14, 8, 'text_length_avg', '{"avg_chars": 15}'),
(15, 9, 'error_log', '{"room_201": 5, "room_202": 12}'),
(16, 10, 'maintenance_flag', '{"need_replace": 8}'),
(17, 11, 'text_summary', '{"keywords": ["may_24", "may_18"]}'),
(18, 12, 'industry_distribution', '{"banking": 40, "it": 30}'),
(19, 13, 'duration_rating', '{"enough": 90, "short": 10}'),
(20, 14, 'next_class_intent', '{"yes": 40, "no": 60}'),
(21, 1, 'backup_metric', '{"status": "ok"}'),
(22, 2, 'backup_metric', '{"status": "ok"}'),
(23, 3, 'backup_metric', '{"status": "ok"}'),
(24, 4, 'backup_metric', '{"status": "ok"}'),
(25, 5, 'backup_metric', '{"status": "ok"}'),
(26, 6, 'backup_metric', '{"status": "ok"}'),
(27, 7, 'backup_metric', '{"status": "ok"}'),
(28, 8, 'backup_metric', '{"status": "ok"}'),
(29, 9, 'backup_metric', '{"status": "ok"}'),
(30, 10, 'backup_metric', '{"status": "ok"}');
SET IDENTITY_INSERT QuestionAnalytics OFF;
GO

-- =================================================================
-- 18. BẢNG TIN BÁO THÔNG BÁO TIẾN ĐỘ (ThongBao) - 30 dòng thông báo hệ thống
-- =================================================================
PRINT N'Đang bơm dữ liệu ThongBao (30 dòng thông báo)...';
SET IDENTITY_INSERT ThongBao ON;
INSERT INTO ThongBao (id, tieu_de, noi_dung, loai, nguoi_nhan, trang_thai, ngay_gui, tong_nguoi_nhan, luot_da_doc, nhan_vien_id) VALUES
(1, N'Biểu mẫu Tiếng Anh lớp hè đã kích hoạt', N'Form của bạn thiết kế đã được ban giám đốc duyệt và phát hành link công khai.', 'success', N'Lê Thị Thu Thủy', 'sent', GETDATE(), 1, 1, 2),
(2, N'Form đăng ký TOEIC được duyệt hỏa tốc', N'Hệ thống đã mở cổng nhận đăng ký ca thi lấy bằng đợt hè.', 'success', N'Phạm Hồng Đăng', 'sent', GETDATE(), 1, 1, 4),
(3, N'Cổng đăng ký lịch thi lấy bằng MOS đã mở', N'Mẫu đăng ký phân môn thi MOS Excel/Word đã hoạt động chính thức.', 'success', N'Trần Nhật Quang', 'sent', GETDATE(), 1, 1, 3),
(4, N'Form quét sự cố phòng máy khu C đã trực tuyến', N'Hệ thống thu thập lỗi phần cứng đã được triển khai thông qua mã QR Code.', 'success', N'Trần Nhật Quang', 'sent', GETDATE(), 1, 1, 3),
(5, N'Yêu cầu duyệt form tin học doanh nghiệp', N'Nhân viên gửi một yêu cầu duyệt biểu mẫu khảo sát người đi làm.', 'info', N'Nguyễn Minh Hoàng', 'sent', GETDATE(), 1, 1, 5),
(6, N'Cảnh báo: Form khảo sát Anh văn sắp hết hạn', N'Hệ thống nhắc nhở form flic-eng-summer sẽ đóng cửa sau 3 ngày nữa.', 'warning', N'Lê Thị Thu Thủy', 'sent', GETDATE(), 1, 1, 2),
(7, N'Thông báo nội bộ v1', N'Nội dung thông báo hệ thống', 'info', N'Tất cả', 'sent', GETDATE(), 5, 5, 1),
(8, N'Thông báo nội bộ v2', N'Nội dung thông báo hệ thống', 'info', N'Tất cả', 'sent', GETDATE(), 5, 4, 1),
(9, N'Thông báo nội bộ v3', N'Nội dung thông báo hệ thống', 'info', N'Tất cả', 'sent', GETDATE(), 5, 3, 1),
(10, N'Thông báo nội bộ v4', N'Nội dung thông báo hệ thống', 'info', N'Tất cả', 'sent', GETDATE(), 5, 2, 1),
(11, N'Thông báo nội bộ v5', N'Nội dung thông báo hệ thống', 'info', N'Tất cả', 'sent', GETDATE(), 5, 5, 1),
(12, N'Thông báo phòng ban v1', N'Cập nhật tiến độ phòng ban', 'success', N'Lê Thị Thu Thủy', 'sent', GETDATE(), 1, 1, 2),
(13, N'Thông báo phòng ban v2', N'Cập nhật tiến độ phòng ban', 'success', N'Trần Nhật Quang', 'sent', GETDATE(), 1, 1, 3),
(14, N'Thông báo phòng ban v3', N'Cập nhật tiến độ phòng ban', 'success', N'Phạm Hồng Đăng', 'sent', GETDATE(), 1, 1, 4),
(15, N'Thông báo phòng ban v4', N'Cập nhật tiến độ phòng ban', 'success', N'Đỗ Hoàng Long', 'sent', GETDATE(), 1, 1, 5),
(16, N'Hệ thống bảo trì v1', N'Lịch bảo trì máy chủ SQL Server trung tâm', 'warning', N'Tất cả', 'sent', GETDATE(), 5, 5, 1),
(17, N'Hệ thống bảo trì v2', N'Nâng cấp module phân tích AI Insights', 'success', N'Tất cả', 'sent', GETDATE(), 5, 5, 1),
(18, N'Cập nhật bảo mật v1', N'Yêu cầu nhân viên thay đổi mật khẩu định kỳ', 'error', N'Tất cả', 'sent', GETDATE(), 5, 4, 1),
(19, N'Cập nhật bảo mật v2', N'Mã hóa token biểu mẫu chống spam', 'success', N'Tất cả', 'sent', GETDATE(), 5, 5, 1),
(20, N'Báo cáo tuần v1', N'Tổng kết lượt xem biểu mẫu tuần 22', 'info', N'Nguyễn Minh Hoàng', 'sent', GETDATE(), 1, 1, 1),
(21, N'Báo cáo tuần v2', N'Tổng kết lượt xem biểu mẫu tuần 23', 'info', N'Nguyễn Minh Hoàng', 'sent', GETDATE(), 1, 1, 1),
(22, N'Báo cáo tuần v3', N'Tổng kết lượt xem biểu mẫu tuần 24', 'info', N'Nguyễn Minh Hoàng', 'sent', GETDATE(), 1, 1, 1),
(23, N'Báo cáo tuần v4', N'Tổng kết lượt xem biểu mẫu tuần 25', 'info', N'Nguyễn Minh Hoàng', 'sent', GETDATE(), 1, 1, 1),
(24, N' Duyệt form thành công v1', N'Form thi chứng chỉ MOS Excel đã hoạt động', 'success', N'Trần Nhật Quang', 'sent', GETDATE(), 1, 1, 3),
(25, N'Duyệt form thành công v2', N'Form thi thử TOEIC quốc tế đã hoạt động', 'success', N'Phạm Hồng Đăng', 'sent', GETDATE(), 1, 1, 4),
(26, N'Từ chối phê duyệt v1', N'Form nháp khảo sát dịch vụ bị từ chối do thiếu câu hỏi', 'error', N'Lê Thị Thu Thủy', 'sent', GETDATE(), 1, 1, 2),
(27, N'Từ chối phê duyệt v2', N'Form nháp phòng máy bị từ chối do sai phân môn', 'error', N'Trần Nhật Quang', 'sent', GETDATE(), 1, 1, 3),
(28, N'Nhắc nhở công việc v1', N'Vui lòng xuất file báo cáo khảo sát Anh văn trước 17h', 'warning', N'Lê Thị Thu Thủy', 'sent', GETDATE(), 1, 1, 2),
(29, N'Nhắc nhở công việc v2', N'Vui lòng rà soát danh sách phòng C202 trước ca thi', 'warning', N'Trần Nhật Quang', 'sent', GETDATE(), 1, 1, 3),
(30, N'Chiến dịch hoàn thành', N'Form khảo sát k48 đã đạt chỉ tiêu 30 phản hồi thô.', 'success', N'Nguyễn Minh Hoàng', 'sent', GETDATE(), 1, 1, 1);
SET IDENTITY_INSERT ThongBao OFF;
GO

PRINT N'=================================================================';
PRINT N'🎉 ĐÃ HOÀN THÀNH BƠM DỮ LIỆU TEST HỢP LỆ THEO SCHEMA HIỆN TẠI!';
PRINT N'=================================================================';


-- Đồng bộ lại identity sau khi insert id cố định
DBCC CHECKIDENT ('NhanVien', RESEED);
DBCC CHECKIDENT ('LoaiKhaoSat', RESEED);
DBCC CHECKIDENT ('Form', RESEED);
DBCC CHECKIDENT ('FormSection', RESEED);
DBCC CHECKIDENT ('ThuVienCauHoi', RESEED);
DBCC CHECKIDENT ('CauHoi', RESEED);
DBCC CHECKIDENT ('LuaChon', RESEED);
DBCC CHECKIDENT ('PhanHoi', RESEED);
DBCC CHECKIDENT ('ChiTietPhanHoi', RESEED);
DBCC CHECKIDENT ('FormUpload', RESEED);
DBCC CHECKIDENT ('PheDuyet', RESEED);
DBCC CHECKIDENT ('FormVersion', RESEED);
DBCC CHECKIDENT ('NhatKyHoatDong', RESEED);
DBCC CHECKIDENT ('Form_CongTac', RESEED);
DBCC CHECKIDENT ('YeuThich', RESEED);
DBCC CHECKIDENT ('FormAnalytics', RESEED);
DBCC CHECKIDENT ('QuestionAnalytics', RESEED);
DBCC CHECKIDENT ('ThongBao', RESEED);
GO


INSERT INTO LoaiKhaoSat (danh_muc, ten_loai, mo_ta)
SELECT N'Tin học', N'CNTT Cơ bản', N'Khảo sát liên quan CNTT Cơ bản'
WHERE NOT EXISTS (
    SELECT 1 FROM LoaiKhaoSat 
    WHERE danh_muc = N'Tin học' AND ten_loai = N'CNTT Cơ bản'
);
GO

INSERT INTO LoaiKhaoSat (danh_muc, ten_loai, mo_ta)
SELECT N'Tin học', N'CNTT Nâng cao', N'Khảo sát liên quan CNTT Nâng cao'
WHERE NOT EXISTS (
    SELECT 1 FROM LoaiKhaoSat 
    WHERE danh_muc = N'Tin học' AND ten_loai = N'CNTT Nâng cao'
);
GO

INSERT INTO LoaiKhaoSat (danh_muc, ten_loai, mo_ta)
SELECT N'Tin học', N'Tableau', N'Khảo sát liên quan Tableau'
WHERE NOT EXISTS (
    SELECT 1 FROM LoaiKhaoSat 
    WHERE danh_muc = N'Tin học' AND ten_loai = N'Tableau'
);
GO

INSERT INTO LoaiKhaoSat (danh_muc, ten_loai, mo_ta)
SELECT N'Tin học', N'Python', N'Khảo sát liên quan Python'
WHERE NOT EXISTS (
    SELECT 1 FROM LoaiKhaoSat 
    WHERE danh_muc = N'Tin học' AND ten_loai = N'Python'
);
GO

INSERT INTO LoaiKhaoSat (danh_muc, ten_loai, mo_ta)
SELECT N'Tin học', N'MOS', N'Khảo sát liên quan MOS'
WHERE NOT EXISTS (
    SELECT 1 FROM LoaiKhaoSat 
    WHERE danh_muc = N'Tin học' AND ten_loai = N'MOS'
);
GO

INSERT INTO LoaiKhaoSat (danh_muc, ten_loai, mo_ta)
SELECT N'Tin học', N'IC3', N'Khảo sát liên quan IC3'
WHERE NOT EXISTS (
    SELECT 1 FROM LoaiKhaoSat 
    WHERE danh_muc = N'Tin học' AND ten_loai = N'IC3'
);
GO

INSERT INTO LoaiKhaoSat (danh_muc, ten_loai, mo_ta)
SELECT N'Ngoại ngữ', N'VSTEP', N'Khảo sát liên quan VSTEP'
WHERE NOT EXISTS (
    SELECT 1 FROM LoaiKhaoSat 
    WHERE danh_muc = N'Ngoại ngữ' AND ten_loai = N'VSTEP'
);
GO

INSERT INTO LoaiKhaoSat (danh_muc, ten_loai, mo_ta)
SELECT N'Ngoại ngữ', N'TOEIC', N'Khảo sát liên quan TOEIC'
WHERE NOT EXISTS (
    SELECT 1 FROM LoaiKhaoSat 
    WHERE danh_muc = N'Ngoại ngữ' AND ten_loai = N'TOEIC'
);
GO