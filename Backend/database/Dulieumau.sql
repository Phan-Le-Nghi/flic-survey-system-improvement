-- ================================================================
--  FLIC_DB – File 2: Dữ liệu mẫu (sample_data.sql)
--  Chạy file này SAU khi đã chạy schema.sql
--  SSMS: mở file → F5
-- ================================================================

USE FLIC_DB;
GO

-- ================================================================
-- 1. NHÂN VIÊN (mật khẩu được hash bởi setup.js)
-- ================================================================
INSERT INTO NhanVien (ho_ten, email, so_dien_thoai, ten_dang_nhap, mat_khau, vai_tro, phong_ban, trang_thai)
VALUES
(N'Quản lý',         'admin@flic.edu.vn', '0900000000', 'admin',  'PLACEHOLDER', 'manager', N'Ban Giám đốc',   'active'),
(N'Nguyễn Văn Minh', 'minh@flic.edu.vn',  '0901111111', 'nvminh', 'PLACEHOLDER', 'manager', N'Phòng Ngoại ngữ','active'),
(N'Trần Thị Hoa',    'hoa@flic.edu.vn',   '0902222222', 'tthoa',  'PLACEHOLDER', 'staff',   N'Phòng Tin học',  'active'),
(N'Lê Văn Dũng',     'dung@flic.edu.vn',  '0903333333', 'lvdung', 'PLACEHOLDER', 'staff',   N'Phòng Ngoại ngữ','active'),
(N'Phạm Thị Lan',    'lan@flic.edu.vn',   '0904444444', 'ptlan',  'PLACEHOLDER', 'staff',   N'Phòng Tin học',  'inactive');
GO

-- ================================================================
-- 2. QUYỀN
-- Cột mới: view_form, add_form, edit_form, delete_form,
--           view_approval, approve, share_form,
--           view_report, export_data, view_staff, manage_staff,
--           view_notif, send_notif,
--           view_library, add_library, edit_library, delete_library,
--           view_feedback, delete_feedback
-- ================================================================
-- Quản lý (admin): full quyền
INSERT INTO Quyen (nhan_vien_id,view_form,add_form,edit_form,delete_form,view_approval,approve,share_form,view_report,export_data,view_staff,manage_staff,view_notif,send_notif,view_library,add_library,edit_library,delete_library,view_feedback,delete_feedback)
SELECT id,          1,        1,       1,        1,          1,            1,       1,          1,           1,          1,          1,           1,          1,           1,            1,          1,           1,              1,             1
FROM NhanVien WHERE ten_dang_nhap='admin';

-- Quản lý (nvminh): gần full, không manage_staff, không xóa form/thư viện
INSERT INTO Quyen (nhan_vien_id,view_form,add_form,edit_form,delete_form,view_approval,approve,share_form,view_report,export_data,view_staff,manage_staff,view_notif,send_notif,view_library,add_library,edit_library,delete_library,view_feedback,delete_feedback)
SELECT id,          1,        1,       1,        0,          1,            1,       1,          1,           1,          1,          0,           1,          1,           1,            1,          1,           0,              1,             0
FROM NhanVien WHERE ten_dang_nhap='nvminh';

-- Staff (tthoa): tạo/sửa form, xem báo cáo, xem phản hồi
INSERT INTO Quyen (nhan_vien_id,view_form,add_form,edit_form,delete_form,view_approval,approve,share_form,view_report,export_data,view_staff,manage_staff,view_notif,send_notif,view_library,add_library,edit_library,delete_library,view_feedback,delete_feedback)
SELECT id,          1,        1,       1,        0,          1,            0,       1,          1,           0,          0,          0,           1,          0,           1,            0,          0,           0,              1,             0
FROM NhanVien WHERE ten_dang_nhap='tthoa';

-- Staff (lvdung): xem form, xem báo cáo cơ bản
INSERT INTO Quyen (nhan_vien_id,view_form,add_form,edit_form,delete_form,view_approval,approve,share_form,view_report,export_data,view_staff,manage_staff,view_notif,send_notif,view_library,add_library,edit_library,delete_library,view_feedback,delete_feedback)
SELECT id,          1,        0,       0,        0,          0,            0,       0,          1,           0,          0,          0,           1,          0,           1,            0,          0,           0,              1,             0
FROM NhanVien WHERE ten_dang_nhap='lvdung';

-- Staff (ptlan): inactive, quyền tối thiểu
INSERT INTO Quyen (nhan_vien_id,view_form,add_form,edit_form,delete_form,view_approval,approve,share_form,view_report,export_data,view_staff,manage_staff,view_notif,send_notif,view_library,add_library,edit_library,delete_library,view_feedback,delete_feedback)
SELECT id,          1,        0,       0,        0,          0,            0,       0,          0,           0,          0,          0,           1,          0,           0,            0,          0,           0,              0,             0
FROM NhanVien WHERE ten_dang_nhap='ptlan';
GO

-- ================================================================
-- 3. FORM MẪU
-- ================================================================
INSERT INTO Form (ten_form, danh_muc, mo_ta, trang_thai, nhan_vien_id, luot_xem) VALUES
(N'Đăng ký khóa học Tiếng Anh giao tiếp', N'Ngoại ngữ', N'Form đăng ký cho học viên muốn học Tiếng Anh giao tiếp', 'active', 1, 3456),
(N'Khảo sát mức độ hài lòng học viên',    N'Ngoại ngữ', N'Thu thập ý kiến học viên về chất lượng giảng dạy',       'active', 2, 2345),
(N'Đăng ký thi chứng chỉ Tin học',         N'Tin học',   N'Form đăng ký thi chứng chỉ tin học văn phòng',           'active', 1, 1890),
(N'Đăng ký học thử miễn phí',              N'Ngoại ngữ', N'Form đăng ký buổi học thử miễn phí tại FLIC',            'active', 2, 4567),
(N'Feedback chương trình học',              N'Ngoại ngữ', N'Nhận phản hồi về nội dung và phương pháp giảng dạy',     'draft',  1,  789),
(N'Khảo sát nhu cầu mở lớp mới',           N'Ngoại ngữ', N'Khảo sát nhu cầu học tập để mở thêm lớp học phù hợp',   'active', 2,  789);
GO

-- ================================================================
-- 4. THÔNG BÁO
-- ================================================================
INSERT INTO ThongBao (tieu_de, noi_dung, loai, nguoi_nhan, trang_thai, luot_da_doc, tong_nguoi_nhan, nhan_vien_id, ngay_tao, ngay_gui) VALUES
(N'Cập nhật hệ thống v2.0.1',           N'Hệ thống đã được cập nhật với nhiều tính năng mới.',        'info',    N'Tất cả nhân viên', 'sent',      45, 120, 1, DATEADD(DAY,-5,GETDATE()),  DATEADD(DAY,-5,GETDATE())),
(N'Nhắc nhở: Deadline báo cáo tháng 3', N'Vui lòng hoàn thành báo cáo trước ngày 10/03/2026.',        'warning', N'Phòng Ngoại ngữ',  'sent',      67,  80, 1, DATEADD(DAY,-2,GETDATE()),  DATEADD(DAY,-2,GETDATE())),
(N'Form mới cần phê duyệt',             N'Có 3 form đang chờ phê duyệt của bạn.',                      'success', N'Quản lý',          'sent',      12,  12, 1, DATEADD(DAY,-1,GETDATE()),  DATEADD(DAY,-1,GETDATE())),
(N'Bảo trì hệ thống đêm nay',           N'Hệ thống sẽ bảo trì từ 22:00 - 24:00 ngày hôm nay.',        'error',   N'Tất cả nhân viên', 'scheduled',  0, 120, 1, GETDATE(),                  DATEADD(HOUR,20,GETDATE())),
(N'Chào mừng nhân viên mới',            N'Vũ Thị F đã gia nhập Phòng Tin học.',                        'info',    N'Phòng Tin học',    'draft',      0,  35, 1, GETDATE(),                  NULL),
(N'Kết quả khảo sát Q4/2025',           N'Điểm hài lòng trung bình đạt 4.2/5. Xem chi tiết Báo cáo.', 'success', N'Tất cả nhân viên', 'sent',      98, 120, 2, DATEADD(DAY,-10,GETDATE()), DATEADD(DAY,-10,GETDATE()));
GO

-- ================================================================
-- 5. THƯ VIỆN CÂU HỎI
-- ================================================================

-- Ngoại ngữ
INSERT INTO ThuVienCauHoi (bo_mon, noi_dung, loai, lua_chon, thu_tu) VALUES
(N'Ngoại ngữ', N'Bạn đang học chương trình nào tại FLIC?',               'choice',   N'["Tiếng Anh giao tiếp","Tiếng Anh thương mại","IELTS","TOEIC","Tiếng Nhật","Tiếng Hàn","Tiếng Trung","Khác"]', 1),
(N'Ngoại ngữ', N'Bạn hài lòng với chất lượng giảng dạy của giáo viên?', 'rating',   N'["1 - Rất không hài lòng","2 - Không hài lòng","3 - Bình thường","4 - Hài lòng","5 - Rất hài lòng"]',         2),
(N'Ngoại ngữ', N'Giáo viên giải thích bài học rõ ràng, dễ hiểu?',        'rating',   N'["1 - Rất không đồng ý","2 - Không đồng ý","3 - Bình thường","4 - Đồng ý","5 - Rất đồng ý"]',                  3),
(N'Ngoại ngữ', N'Tốc độ học của lớp có phù hợp với bạn không?',          'choice',   N'["Quá nhanh","Hơi nhanh","Vừa phải","Hơi chậm","Quá chậm"]',                                                    4),
(N'Ngoại ngữ', N'Bạn có cải thiện kỹ năng nào sau khóa học?',            'checkbox', N'["Nghe","Nói","Đọc","Viết","Từ vựng","Ngữ pháp"]',                                                               5),
(N'Ngoại ngữ', N'Tài liệu học có phù hợp và đủ chất lượng không?',       'rating',   N'["1 - Rất kém","2 - Kém","3 - Trung bình","4 - Tốt","5 - Rất tốt"]',                                            6),
(N'Ngoại ngữ', N'Bạn có muốn đăng ký tiếp khóa học nâng cao không?',     'choice',   N'["Chắc chắn có","Đang xem xét","Chưa quyết định","Không"]',                                                      7),
(N'Ngoại ngữ', N'Thời gian học có phù hợp với lịch của bạn không?',      'choice',   N'["Rất phù hợp","Phù hợp","Chấp nhận được","Không phù hợp"]',                                                     8),
(N'Ngoại ngữ', N'Học phí có tương xứng với chất lượng đào tạo?',          'rating',   N'["1 - Rất không hợp lý","2 - Không hợp lý","3 - Chấp nhận được","4 - Hợp lý","5 - Rất hợp lý"]',               9),
(N'Ngoại ngữ', N'Bạn có giới thiệu FLIC cho người quen không?',           'choice',   N'["Chắc chắn có","Có thể có","Chưa chắc","Không"]',                                                               10),
(N'Ngoại ngữ', N'Bạn muốn FLIC cải thiện điểm nào cho bộ môn Ngoại ngữ?','text',     N'[]',                                                                                                              11);
GO
INSERT INTO ThuVienCauHoi (bo_mon, noi_dung, loai, lua_chon, hang_grid, cot_grid, thu_tu) VALUES
(N'Ngoại ngữ', N'Bạn gặp khó khăn gì trong quá trình học?', 'grid_radio', N'[]',
 N'["Phát âm","Ngữ pháp","Từ vựng","Giao tiếp thực tế"]',
 N'["Thường xuyên","Đôi khi","Không bao giờ"]', 12);
GO

-- Tin học
INSERT INTO ThuVienCauHoi (bo_mon, noi_dung, loai, lua_chon, thu_tu) VALUES
(N'Tin học', N'Bạn đang học khóa học Tin học nào tại FLIC?',                    'choice',   N'["Tin học văn phòng","Lập trình Python","Lập trình Web","Thiết kế đồ họa","Excel nâng cao","AutoCAD","Khác"]', 1),
(N'Tin học', N'Bạn hài lòng với chất lượng giảng dạy của giáo viên Tin học?',   'rating',   N'["1 - Rất không hài lòng","2 - Không hài lòng","3 - Bình thường","4 - Hài lòng","5 - Rất hài lòng"]',         2),
(N'Tin học', N'Nội dung khóa học có phù hợp với nhu cầu thực tế của bạn?',      'rating',   N'["1 - Rất không phù hợp","2 - Không phù hợp","3 - Bình thường","4 - Phù hợp","5 - Rất phù hợp"]',            3),
(N'Tin học', N'Máy tính và thiết bị thực hành có đáp ứng tốt không?',           'rating',   N'["1 - Rất kém","2 - Kém","3 - Trung bình","4 - Tốt","5 - Rất tốt"]',                                          4),
(N'Tin học', N'Bạn có thể ứng dụng kiến thức vào công việc/học tập ngay không?', 'choice',  N'["Có, ngay lập tức","Có, sau một thời gian","Một phần","Chưa áp dụng được"]',                                  5),
(N'Tin học', N'Bài tập thực hành có đa dạng và gần thực tế không?',             'rating',   N'["1 - Rất không đồng ý","2 - Không đồng ý","3 - Bình thường","4 - Đồng ý","5 - Rất đồng ý"]',                 6),
(N'Tin học', N'Giáo viên hỗ trợ giải đáp thắc mắc kịp thời không?',            'choice',   N'["Luôn luôn","Thường xuyên","Đôi khi","Hiếm khi"]',                                                             7),
(N'Tin học', N'Sau khóa học bạn muốn học thêm kỹ năng nào?',                    'checkbox', N'["Lập trình nâng cao","Thiết kế UI/UX","Phân tích dữ liệu","Bảo mật mạng","Quản trị hệ thống","Không có"]',    8),
(N'Tin học', N'Học phí có phù hợp với chất lượng khóa học Tin học?',            'rating',   N'["1 - Rất không hợp lý","2 - Không hợp lý","3 - Chấp nhận được","4 - Hợp lý","5 - Rất hợp lý"]',             9),
(N'Tin học', N'Bạn có muốn thi chứng chỉ Tin học sau khóa học không?',          'choice',   N'["Rất muốn","Có thể","Chưa nghĩ đến","Không cần"]',                                                             10),
(N'Tin học', N'Bạn muốn FLIC cải thiện điểm nào cho bộ môn Tin học?',           'text',     N'[]',                                                                                                             11);
GO
INSERT INTO ThuVienCauHoi (bo_mon, noi_dung, loai, lua_chon, hang_grid, cot_grid, thu_tu) VALUES
(N'Tin học', N'Bạn gặp khó khăn gì khi học Tin học?', 'grid_radio', N'[]',
 N'["Cài đặt phần mềm","Thao tác thực hành","Lý thuyết","Tốc độ bài giảng"]',
 N'["Thường xuyên","Đôi khi","Không bao giờ"]', 12);
GO

-- ================================================================
-- 6. FORM KHẢO SÁT MẪU CÓ DỮ LIỆU (form_id = 7 sau khi insert 6 form trên)
-- ================================================================
-- Lấy ID của form khảo sát chất lượng (form cuối cùng được insert)
DECLARE @fid INT = (SELECT MAX(id) FROM Form) + 1;

SET IDENTITY_INSERT Form ON;
INSERT INTO Form (id, ten_form, danh_muc, mo_ta, trang_thai, nhan_vien_id, luot_xem)
VALUES (@fid, N'Dữ liệu mẫu khảo sát chất lượng giảng dạy tại FLIC', N'Ngoại ngữ',
        N'Khảo sát định kỳ chất lượng đào tạo tại FLIC.', 'active', 1, 0);
SET IDENTITY_INSERT Form OFF;
GO

-- ================================================================
-- CÂU HỎI FORM KHẢO SÁT
-- ================================================================
DECLARE @f INT = (SELECT id FROM Form WHERE ten_form = N'Dữ liệu mẫu khảo sát chất lượng giảng dạy tại FLIC');

INSERT INTO CauHoi (form_id, noi_dung, loai, thu_tu, bat_buoc) VALUES
(@f, N'Khoa',                                                    'choice', 1,  1),
(@f, N'Lớp học tại trường',                                      'choice', 2,  1),
(@f, N'Giáo viên phụ trách',                                     'choice', 3,  1),
(@f, N'Giáo viên truyền đạt đầy đủ nội dung mỗi buổi học',      'rating', 4,  1),
(@f, N'Phương pháp giảng dạy dễ hiểu, rõ ràng, mạch lạc',       'rating', 5,  1),
(@f, N'Tốc độ giảng dạy phù hợp với trình độ học viên',          'rating', 6,  1),
(@f, N'Tương tác tốt, tự nhiên, thân thiện với học viên',        'rating', 7,  1),
(@f, N'Thái độ thân thiện, vui vẻ, hợp tác với học viên',        'rating', 8,  1),
(@f, N'Tạo không khí học tập thoải mái, năng động',              'rating', 9,  1),
(@f, N'Nội dung giáo trình phù hợp với cấp độ học viên',         'rating', 10, 1),
(@f, N'Cơ sở vật chất, phòng học đáp ứng nhu cầu',              'rating', 11, 1),
(@f, N'Thời gian học tập phù hợp',                               'rating', 12, 1),
(@f, N'Học liệu, bài tập hỗ trợ tốt quá trình học',             'rating', 13, 1),
(@f, N'Cảm nhận khi học với cô Nguyễn Thị Thu Hằng',            'text',   14, 0),
(@f, N'Cảm nhận khi học với thầy Trần Văn Minh',                 'text',   15, 0),
(@f, N'Cảm nhận khi học với cô Lê Thị Bích Ngọc',               'text',   16, 0),
(@f, N'Cảm nhận khi học với thầy Phạm Quốc Tuấn',               'text',   17, 0),
(@f, N'Điều bạn hài lòng nhất về khóa học tại FLIC',             'text',   18, 1),
(@f, N'Điều bạn chưa hài lòng hoặc muốn FLIC cải thiện',         'text',   19, 0),
(@f, N'Kỹ năng bạn thấy tiến bộ rõ nhất sau khóa học',           'text',   20, 1),
(@f, N'Bạn có muốn tiếp tục học tại FLIC không? Lý do?',         'text',   21, 0);
GO

-- Lựa chọn câu hỏi Khoa / Lớp / Giáo viên
DECLARE @f2  INT = (SELECT id FROM Form WHERE ten_form = N'Dữ liệu mẫu khảo sát chất lượng giảng dạy tại FLIC');
DECLARE @qK  INT = (SELECT id FROM CauHoi WHERE form_id = @f2 AND thu_tu = 1);
DECLARE @qL  INT = (SELECT id FROM CauHoi WHERE form_id = @f2 AND thu_tu = 2);
DECLARE @qG  INT = (SELECT id FROM CauHoi WHERE form_id = @f2 AND thu_tu = 3);

INSERT INTO LuaChon (cau_hoi_id, noi_dung, thu_tu) VALUES
(@qK, N'KDQT',      1), (@qK, N'Marketing', 2), (@qK, N'Ngân hàng', 3), (@qK, N'Kế toán', 4);

INSERT INTO LuaChon (cau_hoi_id, noi_dung, thu_tu) VALUES
(@qL, '48K01', 1), (@qL, '48K02', 2),
(@qL, '49K01', 3), (@qL, '49K02', 4),
(@qL, '50K01', 5), (@qL, '50K02', 6),
(@qL, '51K01', 7), (@qL, '51K02', 8);

INSERT INTO LuaChon (cau_hoi_id, noi_dung, thu_tu) VALUES
(@qG, N'Nguyễn Thị Thu Hằng', 1),
(@qG, N'Trần Văn Minh',        2),
(@qG, N'Lê Thị Bích Ngọc',    3),
(@qG, N'Phạm Quốc Tuấn',      4);
GO

-- ================================================================
-- 7. PHẢN HỒI (~130 phản hồi, 4 GV, 8 lớp, 4 đợt)
-- ================================================================
DECLARE @f3 INT = (SELECT id FROM Form WHERE ten_form = N'Dữ liệu mẫu khảo sát chất lượng giảng dạy tại FLIC');

INSERT INTO PhanHoi (form_id,ho_ten,email,danh_gia,noi_dung,cam_xuc,trang_thai,lop,khoa,giao_vien,ngay_gui) VALUES
-- GV THU HẰNG – 48K01 – Đợt 1
(@f3,N'Nguyễn Minh Anh',   'anh.48k01@due.vn',  5,N'Cô Thu Hằng dạy rất tốt, rõ ràng và sinh động.',        'positive','replied','48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-530,GETDATE())),
(@f3,N'Trần Thị Bảo',      'bao.48k01@due.vn',  5,N'Phương pháp của cô hiệu quả, điểm nghe tăng rõ.',       'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-525,GETDATE())),
(@f3,N'Lê Văn Cường',      'cuong.48k01@due.vn',4,N'Cô nhiệt tình, giải thích rõ từng phần.',                'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-520,GETDATE())),
(@f3,N'Phạm Thị Dung',     'dung.48k01@due.vn', 5,N'Lớp học vui, cô tạo không khí rất tốt.',                'positive','replied','48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-518,GETDATE())),
(@f3,N'Hoàng Văn Em',      'em.48k01@due.vn',   5,N'Chiến lược làm bài TOEIC của cô rất thực tế.',           'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-515,GETDATE())),
(@f3,N'Vũ Thị Phương',     'phuong.48k01@due.vn',4,N'Rất hài lòng, chỉ mong thêm buổi luyện đề.',           'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-512,GETDATE())),
(@f3,N'Đặng Văn Giang',    'giang.48k01@due.vn',5,N'Cô Thu Hằng là GV tốt nhất tôi từng học.',               'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-509,GETDATE())),
(@f3,N'Bùi Thị Hoa',       'hoa.48k01@due.vn',  4,N'Học liệu tốt, cô giảng dễ hiểu.',                       'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-506,GETDATE())),
(@f3,N'Ngô Văn Hùng',      'hung.48k01@due.vn', 5,N'Cô dạy hay, tốc độ vừa phải, dễ theo kịp.',             'positive','replied','48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-503,GETDATE())),
(@f3,N'Đinh Thị Khanh',    'khanh.48k01@due.vn',4,N'Học được nhiều, sẽ đăng ký khóa EXP.',                   'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-500,GETDATE())),
(@f3,N'Lý Văn Linh',       'linh.48k01@due.vn', 5,N'Cô giải thích Part 7 rất hay, dễ hiểu.',                 'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-497,GETDATE())),
(@f3,N'Trương Thị Mỹ',     'my.48k01@due.vn',   4,N'Nội dung bài học thực tế, sát đề thi.',                  'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-494,GETDATE())),
(@f3,N'Phan Văn Nghĩa',    'nghia.48k01@due.vn',5,N'Cô tương tác nhiệt tình, không ai bị bỏ lại.',           'positive','replied','48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-491,GETDATE())),
(@f3,N'Võ Thị Oanh',       'oanh.48k01@due.vn', 5,N'Điểm Listening tăng 60 điểm sau khóa học!',              'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-488,GETDATE())),
(@f3,N'Hồ Văn Phong',      'phong.48k01@due.vn',4,N'Khóa học chất lượng, xứng đáng với học phí.',            'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-485,GETDATE())),
-- GV THU HẰNG – 48K01 – Đợt 3
(@f3,N'Cao Thị Quỳnh',     'quynh.48k01@due.vn',5,N'Cô ngày càng dạy hay hơn, có nhiều tài liệu mới.',       'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-160,GETDATE())),
(@f3,N'Lưu Văn Rồng',      'rong.48k01@due.vn', 5,N'Cô bổ sung thêm bài nghe thật từ đề thi gần đây.',       'positive','replied','48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-155,GETDATE())),
(@f3,N'Dương Thị Sen',     'sen.48k01@due.vn',  5,N'Cô ngày càng có kinh nghiệm và tinh tế hơn.',            'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-150,GETDATE())),
(@f3,N'Mai Văn Tài',       'tai.48k01@due.vn',  4,N'Cô có thêm phương pháp mới, đa dạng hơn.',               'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-147,GETDATE())),
(@f3,N'Nguyễn Thị Uyên',  'uyen.48k01@due.vn', 5,N'Tốt hơn đợt trước nhiều, cô đã bổ sung tài liệu.',       'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-144,GETDATE())),
(@f3,N'Trần Văn Vinh',     'vinh.48k01@due.vn', 5,N'Cô ngày càng tốt, luôn cập nhật đề mới nhất.',           'positive','replied','48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-141,GETDATE())),
(@f3,N'Lê Thị Xuân',       'xuan.48k01@due.vn', 4,N'Phương pháp cô ngày càng hay và hiệu quả hơn.',          'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-138,GETDATE())),
(@f3,N'Phạm Văn Yên',      'yen.48k01@due.vn',  5,N'Cô luôn lắng nghe ý kiến học viên để cải thiện.',        'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-135,GETDATE())),
(@f3,N'Hoàng Thị Zoan',    'zoan.48k01@due.vn', 5,N'Rất hài lòng, sẽ tiếp tục học khóa EXP với cô.',         'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-132,GETDATE())),
(@f3,N'Vũ Văn An',         'an2.48k01@due.vn',  4,N'Cô dạy tốt, phòng học mới thoáng và đẹp hơn.',           'positive','new',    '48K01','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-129,GETDATE())),
-- GV THU HẰNG – 48K02 – Đợt 2
(@f3,N'Đặng Thị Bình',     'binh.48k02@due.vn', 5,N'Cô Thu Hằng dạy xuất sắc, tôi rất ấn tượng.',           'positive','replied','48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-350,GETDATE())),
(@f3,N'Bùi Văn Chiến',     'chien.48k02@due.vn',5,N'Điểm TOEIC tôi đạt 600+ nhờ cô.',                        'positive','new',    '48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-345,GETDATE())),
(@f3,N'Ngô Thị Duyên',     'duyen.48k02@due.vn',4,N'Cô giảng hay, phòng học mát, học rất thoải mái.',        'positive','new',    '48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-342,GETDATE())),
(@f3,N'Đinh Văn Đạt',      'dat.48k02@due.vn',  5,N'Không có gì để chê! Cô xuất sắc.',                       'positive','new',    '48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-339,GETDATE())),
(@f3,N'Lý Thị Em',         'em.48k02@due.vn',   5,N'Cô tận tâm, luôn sẵn sàng giải đáp.',                    'positive','replied','48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-336,GETDATE())),
(@f3,N'Trương Văn Giang',  'giang.48k02@due.vn',4,N'Học liệu phong phú, cô giảng rõ từng phần.',             'positive','new',    '48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-333,GETDATE())),
(@f3,N'Phan Thị Hoa',      'hoa.48k02@due.vn',  5,N'Lớp học vui, cô luôn tạo không khí tích cực.',           'positive','new',    '48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-330,GETDATE())),
(@f3,N'Võ Văn Ích',        'ich.48k02@due.vn',  4,N'Cô dạy tốt, mong có thêm buổi mock test.',               'positive','new',    '48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-327,GETDATE())),
(@f3,N'Hồ Thị Kim',        'kim.48k02@due.vn',  5,N'Sau 2 tháng học với cô, tôi tự tin với TOEIC.',           'positive','replied','48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-324,GETDATE())),
(@f3,N'Cao Văn Long',      'long.48k02@due.vn', 5,N'Cô Thu Hằng là điểm sáng của FLIC.',                     'positive','new',    '48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-321,GETDATE())),
-- GV THU HẰNG – 48K02 – Đợt 4
(@f3,N'Lưu Thị Mai',       'mai.48k02@due.vn',  5,N'Cô không ngừng cải thiện, mỗi đợt đều tốt hơn.',         'positive','new',    '48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-65,GETDATE())),
(@f3,N'Dương Văn Nam',     'nam.48k02@due.vn',  5,N'Cô cập nhật đề thi mới nhất 2025, sát thực tế.',         'positive','replied','48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-60,GETDATE())),
(@f3,N'Mai Thị Ngọc',      'ngoc.48k02@due.vn', 4,N'Cô ngày càng có nhiều kinh nghiệm hơn.',                 'positive','new',    '48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-55,GETDATE())),
(@f3,N'Nguyễn Văn Ổn',     'on.48k02@due.vn',   5,N'Tốt nhất! Cô dạy hay và rất tận tâm.',                   'positive','new',    '48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-50,GETDATE())),
(@f3,N'Trần Thị Phúc',     'phuc.48k02@due.vn', 5,N'Sẽ tiếp tục học với cô đến khi đạt mục tiêu.',           'positive','new',    '48K02','KDQT',N'Nguyễn Thị Thu Hằng',DATEADD(DAY,-45,GETDATE())),
-- GV TRẦN MINH – 49K01 – Đợt 1
(@f3,N'Lê Văn Quân',       'quan.49k01@due.vn', 4,N'Thầy Minh dạy ổn, giải thích từ vựng rõ.',               'positive','new',    '49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-520,GETDATE())),
(@f3,N'Phạm Thị Rồng',     'rong.49k01@due.vn', 4,N'Nội dung tốt, thầy nhiệt tình dù đôi khi hơi nhanh.',   'positive','new',    '49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-516,GETDATE())),
(@f3,N'Hoàng Văn Sơn',     'son.49k01@due.vn',  5,N'Thầy dạy sinh động, có nhiều ví dụ thực tế.',            'positive','replied','49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-512,GETDATE())),
(@f3,N'Vũ Thị Trang',      'trang.49k01@due.vn',4,N'Học được nhiều, thầy vui tính và dễ gần.',               'positive','new',    '49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-508,GETDATE())),
(@f3,N'Ngô Văn Uy',        'uy.49k01@due.vn',   3,N'Thầy dạy ổn nhưng tốc độ hơi nhanh, khó theo.',         'positive','new',    '49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-504,GETDATE())),
(@f3,N'Đinh Thị Vân',      'van.49k01@due.vn',  4,N'Chương trình tốt, thầy giải đáp nhiệt tình.',            'positive','replied','49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-500,GETDATE())),
(@f3,N'Lý Văn Việt',       'viet.49k01@due.vn', 4,N'Thầy Minh dạy rõ phần Reading, rất hữu ích.',            'positive','new',    '49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-496,GETDATE())),
(@f3,N'Trương Thị Xuân',   'xuan.49k01@due.vn', 3,N'Bình thường, cần thêm bài nghe đa dạng hơn.',            'positive','new',    '49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-492,GETDATE())),
(@f3,N'Phan Văn Yên',      'yen.49k01@due.vn',  5,N'Rất hài lòng! Thầy giảng hay và tạo động lực.',          'positive','new',    '49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-488,GETDATE())),
(@f3,N'Võ Thị Ý',          'y.49k01@due.vn',    4,N'Học được nhiều kỹ năng, thầy tâm lý với học viên.',      'positive','new',    '49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-484,GETDATE())),
-- GV TRẦN MINH – 49K01 – Đợt 3
(@f3,N'Hồ Văn An',         'an.49k01@due.vn',   4,N'Thầy cải thiện tốc độ giảng, dễ theo hơn.',              'positive','new',    '49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-155,GETDATE())),
(@f3,N'Cao Thị Bình',      'binh.49k01@due.vn', 4,N'Thầy bổ sung thêm bài tập nghe, đa dạng hơn.',           'positive','new',    '49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-150,GETDATE())),
(@f3,N'Lưu Văn Chiến',     'chien.49k01@due.vn',5,N'Thầy tiến bộ rõ rệt, cách giảng tốt hơn hẳn.',          'positive','replied','49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-145,GETDATE())),
(@f3,N'Dương Thị Duyên',   'duyen.49k01@due.vn',3,N'Ổn hơn đợt trước, nhưng vẫn cần cải thiện thêm.',       'positive','new',    '49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-140,GETDATE())),
(@f3,N'Mai Văn Đức',       'duc.49k01@due.vn',  4,N'Thầy có thêm tài liệu mới, phong phú hơn.',              'positive','new',    '49K01','Marketing',N'Trần Văn Minh',DATEADD(DAY,-135,GETDATE())),
-- GV TRẦN MINH – 49K02 – Đợt 2
(@f3,N'Nguyễn Thị Em',     'em.49k02@due.vn',   4,N'Thầy dạy tốt, có phương pháp riêng hiệu quả.',           'positive','new',    '49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-330,GETDATE())),
(@f3,N'Trần Văn Giang',    'giang.49k02@due.vn',4,N'Phần Listening được cải thiện nhờ thầy.',                 'positive','replied','49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-326,GETDATE())),
(@f3,N'Lê Thị Hoa',        'hoa.49k02@due.vn',  5,N'Thầy rất nhiệt tình và thân thiện với lớp.',             'positive','new',    '49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-322,GETDATE())),
(@f3,N'Phạm Văn Ích',      'ich.49k02@due.vn',  3,N'Ổn, nhưng thầy giảng đôi khi lạc đề.',                  'positive','new',    '49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-318,GETDATE())),
(@f3,N'Hoàng Thị Kim',     'kim.49k02@due.vn',  4,N'Học được nhiều, sẽ giới thiệu bạn bè.',                  'positive','new',    '49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-314,GETDATE())),
(@f3,N'Vũ Văn Long',       'long.49k02@due.vn', 4,N'Thầy giảng rõ, có nhiều bài thực hành.',                 'positive','replied','49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-310,GETDATE())),
(@f3,N'Ngô Thị Mai',       'mai.49k02@due.vn',  3,N'Tốc độ nhanh, mong thầy ôn bài nhiều hơn.',              'positive','new',    '49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-306,GETDATE())),
(@f3,N'Đinh Văn Nam',      'nam.49k02@due.vn',  5,N'Rất hài lòng! Thầy dạy có tâm và hiệu quả.',             'positive','new',    '49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-302,GETDATE())),
(@f3,N'Lý Thị Ngọc',       'ngoc.49k02@due.vn', 4,N'Lớp vui, thầy hay kể chuyện minh họa thú vị.',           'positive','new',    '49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-298,GETDATE())),
(@f3,N'Trương Văn Ổn',     'on.49k02@due.vn',   4,N'Thầy Minh dạy bài bản, có lộ trình rõ ràng.',            'positive','new',    '49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-294,GETDATE())),
-- GV TRẦN MINH – 49K02 – Đợt 4
(@f3,N'Phan Thị Phương',   'phuong.49k02@due.vn',4,N'Thầy ngày càng cải thiện tốt hơn qua các đợt.',         'positive','new',    '49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-40,GETDATE())),
(@f3,N'Võ Văn Quân',       'quan.49k02@due.vn', 4,N'Thầy bổ sung thêm chiến lược làm bài mới.',              'positive','new',    '49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-35,GETDATE())),
(@f3,N'Hồ Thị Rồng',       'rong.49k02@due.vn', 3,N'Có cải thiện nhưng vẫn cần thêm thời gian.',             'positive','new',    '49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-30,GETDATE())),
(@f3,N'Cao Văn Sơn',       'son.49k02@due.vn',  5,N'Thầy rất tiến bộ, dạy hay hơn hẳn năm ngoái.',           'positive','replied','49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-25,GETDATE())),
(@f3,N'Lưu Thị Trang',     'trang.49k02@due.vn',4,N'Hài lòng, thầy đã khắc phục nhiều điểm yếu.',           'positive','new',    '49K02','Marketing',N'Trần Văn Minh',DATEADD(DAY,-20,GETDATE())),
-- GV BÍCH NGỌC – 50K01 – Đợt 1
(@f3,N'Dương Văn Uy',      'uy.50k01@due.vn',   4,N'Cô Ngọc dạy tốt phần Grammar trong TOEIC.',              'positive','new',    '50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-510,GETDATE())),
(@f3,N'Mai Thị Vân',       'van.50k01@due.vn',  3,N'Cô giảng ổn nhưng đôi khi thiếu sinh động.',             'positive','new',    '50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-506,GETDATE())),
(@f3,N'Nguyễn Văn Việt',   'viet.50k01@due.vn', 4,N'Học được phần Vocabulary tốt từ cô.',                    'positive','replied','50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-502,GETDATE())),
(@f3,N'Trần Thị Xuân',     'xuan.50k01@due.vn', 3,N'Cô dạy ổn, nhưng tốc độ hơi chậm so với kỳ vọng.',      'positive','new',    '50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-498,GETDATE())),
(@f3,N'Lê Văn Yên',        'yen.50k01@due.vn',  4,N'Cô kiên nhẫn giải thích từng phần, hữu ích.',            'positive','new',    '50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-494,GETDATE())),
(@f3,N'Phạm Thị Ý',        'y.50k01@due.vn',    3,N'Bình thường, cần cải thiện phần tương tác với lớp.',     'positive','new',    '50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-490,GETDATE())),
(@f3,N'Hoàng Văn An',      'an.50k01@due.vn',   4,N'Cô Ngọc dạy rõ cấu trúc đề, dễ ôn tập.',               'positive','new',    '50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-486,GETDATE())),
(@f3,N'Vũ Thị Bình',       'binh.50k01@due.vn', 3,N'Tiến bộ chậm hơn mong đợi, nội dung ổn.',               'positive','new',    '50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-482,GETDATE())),
(@f3,N'Ngô Văn Chiến',     'chien.50k01@due.vn',4,N'Cô nhiệt tình, lớp học thoải mái.',                      'positive','replied','50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-478,GETDATE())),
(@f3,N'Đinh Thị Duyên',    'duyen.50k01@due.vn',3,N'Chưa hài lòng lắm, mong cô tương tác nhiều hơn.',       'positive','new',    '50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-474,GETDATE())),
-- GV BÍCH NGỌC – 50K01 – Đợt 3
(@f3,N'Lý Văn Đức',        'duc.50k01@due.vn',  4,N'Cô có cải thiện, dạy sinh động hơn đợt trước.',          'positive','new',    '50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-150,GETDATE())),
(@f3,N'Trương Thị Em',     'em.50k01@due.vn',   3,N'Ổn hơn nhưng vẫn chưa đạt kỳ vọng.',                    'positive','new',    '50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-145,GETDATE())),
(@f3,N'Phan Văn Giang',    'giang.50k01@due.vn',4,N'Cô bổ sung thêm bài tập, tốt hơn.',                      'positive','new',    '50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-140,GETDATE())),
(@f3,N'Võ Thị Hoa',        'hoa.50k01@due.vn',  3,N'Vẫn cần cải thiện thêm phần tương tác.',                 'positive','new',    '50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-135,GETDATE())),
(@f3,N'Hồ Văn Ích',        'ich.50k01@due.vn',  4,N'Cô tiến bộ hơn, lớp học vui hơn trước.',                'positive','replied','50K01','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-130,GETDATE())),
-- GV BÍCH NGỌC – 50K02 – Đợt 2
(@f3,N'Cao Thị Kim',       'kim.50k02@due.vn',  3,N'Cô dạy được nhưng chưa có gì nổi bật.',                  'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-325,GETDATE())),
(@f3,N'Lưu Văn Long',      'long.50k02@due.vn', 4,N'Phần Reading tiến bộ hơn nhờ cô.',                       'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-320,GETDATE())),
(@f3,N'Dương Thị Mai',     'mai.50k02@due.vn',  3,N'Ổn, nhưng mong cô cho thêm bài tập về nhà.',            'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-315,GETDATE())),
(@f3,N'Mai Văn Nam',       'nam.50k02@due.vn',  4,N'Cô giải thích Grammar khá rõ ràng.',                     'positive','replied','50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-310,GETDATE())),
(@f3,N'Nguyễn Thị Ngọc',  'ngoc.50k02@due.vn', 3,N'Học được nhưng tiến độ hơi chậm.',                       'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-305,GETDATE())),
(@f3,N'Trần Văn Ổn',       'on.50k02@due.vn',   4,N'Cô dạy bài bản, phù hợp người mới bắt đầu.',            'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-300,GETDATE())),
(@f3,N'Lê Thị Phương',     'phuong.50k02@due.vn',3,N'Tốc độ chậm, lớp có lúc mất tập trung.',               'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-295,GETDATE())),
(@f3,N'Phạm Văn Quân',     'quan.50k02@due.vn', 4,N'Nội dung ổn, cô thân thiện với học viên.',               'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-290,GETDATE())),
(@f3,N'Hoàng Thị Rồng',    'rong.50k02@due.vn', 3,N'Bình thường, chưa thấy tiến bộ nhiều.',                  'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-285,GETDATE())),
(@f3,N'Vũ Văn Sơn',        'son.50k02@due.vn',  4,N'Cô dạy ổn, lớp học thoải mái.',                         'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-280,GETDATE())),
-- GV BÍCH NGỌC – 50K02 – Đợt 4
(@f3,N'Ngô Thị Trang',     'trang.50k02@due.vn',4,N'Cô cải thiện nhiều, tốt hơn hẳn đợt đầu.',              'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-20,GETDATE())),
(@f3,N'Đinh Văn Uy',       'uy.50k02@due.vn',   3,N'Có tiến bộ nhưng vẫn chưa đều.',                        'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-15,GETDATE())),
(@f3,N'Lý Thị Vân',        'van.50k02@due.vn',  4,N'Cô bổ sung nhiều kỹ năng mới, thực tế hơn.',            'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-12,GETDATE())),
(@f3,N'Trương Văn Việt',   'viet.50k02@due.vn', 3,N'Ổn hơn trước, nhưng cần cải thiện thêm.',               'positive','new',    '50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-9,GETDATE())),
(@f3,N'Phan Thị Xuân',     'xuan.50k02@due.vn', 4,N'Cô đã khắc phục được điểm yếu về tốc độ.',              'positive','replied','50K02','Ngân hàng',N'Lê Thị Bích Ngọc',DATEADD(DAY,-7,GETDATE())),
-- GV QUỐC TUẤN – 51K01 – Đợt 1
(@f3,N'Võ Văn Yên',        'yen.51k01@due.vn',  2,N'Thầy Tuấn giảng không rõ, khó hiểu.',                   'negative','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-505,GETDATE())),
(@f3,N'Hồ Thị Ý',          'y.51k01@due.vn',    3,N'Thầy dạy ổn nhưng thiếu tương tác với lớp.',            'positive','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-501,GETDATE())),
(@f3,N'Cao Văn An',        'an.51k01@due.vn',   2,N'Thầy hay đọc slide, không có phương pháp riêng.',        'negative','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-497,GETDATE())),
(@f3,N'Lưu Thị Bình',      'binh.51k01@due.vn', 3,N'Học được nhưng không nhiều, ít tương tác.',              'positive','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-493,GETDATE())),
(@f3,N'Dương Văn Chiến',   'chien.51k01@due.vn',2,N'Giờ học nhàm chán, không tạo được không khí.',           'negative','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-489,GETDATE())),
(@f3,N'Mai Thị Duyên',     'duyen.51k01@due.vn',3,N'Thầy dạy tạm ổn, cần cải thiện phong cách.',            'positive','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-485,GETDATE())),
(@f3,N'Nguyễn Văn Đức',   'duc.51k01@due.vn',  2,N'Thất vọng với cách giảng, không hiệu quả.',              'negative','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-481,GETDATE())),
(@f3,N'Trần Thị Em',       'em.51k01@due.vn',   3,N'Nội dung ổn nhưng thầy cần cải thiện kỹ năng giảng.',   'positive','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-477,GETDATE())),
(@f3,N'Lê Văn Giang',      'giang.51k01@due.vn',4,N'Thầy nhiệt tình nhưng phong cách giảng chưa hay.',      'positive','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-473,GETDATE())),
(@f3,N'Phạm Thị Hoa',      'hoa.51k01@due.vn',  2,N'Mong FLIC xem xét lại chất lượng GV này.',              'negative','replied','51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-469,GETDATE())),
-- GV QUỐC TUẤN – 51K01 – Đợt 3
(@f3,N'Hoàng Văn Ích',     'ich.51k01@due.vn',  3,N'Thầy có cải thiện chút, nhưng vẫn chưa đủ.',            'positive','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-148,GETDATE())),
(@f3,N'Vũ Thị Kim',        'kim.51k01@due.vn',  2,N'Chưa thấy thầy cải thiện nhiều so với đợt đầu.',        'negative','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-143,GETDATE())),
(@f3,N'Ngô Văn Long',      'long.51k01@due.vn', 3,N'Ổn hơn chút nhưng vẫn cần phấn đấu thêm.',             'positive','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-138,GETDATE())),
(@f3,N'Đinh Thị Mai',      'mai.51k01@due.vn',  2,N'Không có gì thay đổi, vẫn nhàm như cũ.',                'negative','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-133,GETDATE())),
(@f3,N'Lý Văn Nam',        'nam.51k01@due.vn',  3,N'Thầy có chú ý hơn đến học viên, nhưng ít thôi.',        'positive','new',    '51K01','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-128,GETDATE())),
-- GV QUỐC TUẤN – 51K02 – Đợt 2
(@f3,N'Trương Thị Ngọc',   'ngoc.51k02@due.vn', 3,N'Thầy dạy ổn nhưng không có gì đặc biệt.',               'positive','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-318,GETDATE())),
(@f3,N'Phan Văn Ổn',       'on.51k02@due.vn',   2,N'Thầy đọc slide nhiều quá, không giải thích đủ.',         'negative','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-314,GETDATE())),
(@f3,N'Võ Thị Phương',     'phuong.51k02@due.vn',3,N'Học được một ít, còn nhiều điểm cần cải thiện.',        'positive','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-310,GETDATE())),
(@f3,N'Hồ Văn Quân',       'quan.51k02@due.vn', 2,N'Giờ học mất thời gian, không học được nhiều.',           'negative','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-306,GETDATE())),
(@f3,N'Cao Thị Rồng',      'rong.51k02@due.vn', 3,N'Thầy cần tương tác nhiều hơn với học viên.',             'positive','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-302,GETDATE())),
(@f3,N'Lưu Văn Sơn',       'son.51k02@due.vn',  2,N'Không hài lòng với phong cách giảng của thầy.',          'negative','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-298,GETDATE())),
(@f3,N'Dương Thị Trang',   'trang.51k02@due.vn',3,N'Ổn, nhưng mong thầy chuẩn bị bài kỹ hơn.',             'positive','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-294,GETDATE())),
(@f3,N'Mai Văn Uy',         'uy.51k02@due.vn',   4,N'Thầy có kiến thức tốt, chỉ cần cải thiện truyền đạt.',  'positive','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-290,GETDATE())),
(@f3,N'Nguyễn Thị Vân',    'van.51k02@due.vn',  2,N'Thất vọng, mong FLIC có biện pháp cải thiện.',           'negative','replied','51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-286,GETDATE())),
(@f3,N'Trần Văn Việt',     'viet.51k02@due.vn', 3,N'Học được nhưng không đáng với số tiền bỏ ra.',           'positive','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-282,GETDATE())),
-- GV QUỐC TUẤN – 51K02 – Đợt 4
(@f3,N'Lê Thị Xuân',       'xuan2.51k02@due.vn',3,N'Thầy cải thiện đôi chút, ít nhàm hơn trước.',           'positive','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-18,GETDATE())),
(@f3,N'Phạm Văn Yên',      'yen2.51k02@due.vn', 2,N'Vẫn chưa hài lòng, chưa thấy thay đổi nhiều.',          'negative','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-14,GETDATE())),
(@f3,N'Hoàng Thị Ý',       'y.51k02@due.vn',    3,N'Thầy chú tâm hơn chút, nhưng vẫn cần cố gắng.',         'positive','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-11,GETDATE())),
(@f3,N'Vũ Văn An',         'an2.51k02@due.vn',  4,N'Thầy có tiến bộ rõ hơn đợt trước, tốt hơn.',            'positive','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-8,GETDATE())),
(@f3,N'Ngô Thị Bình',      'binh2.51k02@due.vn',3,N'Ổn hơn đợt 2 nhưng vẫn cần phấn đấu nhiều hơn.',       'positive','new',    '51K02','Kế toán',N'Phạm Quốc Tuấn',DATEADD(DAY,-5,GETDATE()));
GO

-- ================================================================
-- 8. CHI TIẾT PHẢN HỒI — câu hỏi lựa chọn (Khoa / Lớp / GV)
-- ================================================================
DECLARE @f4  INT = (SELECT id FROM Form WHERE ten_form = N'Dữ liệu mẫu khảo sát chất lượng giảng dạy tại FLIC');
DECLARE @qK2 INT = (SELECT id FROM CauHoi WHERE form_id = @f4 AND thu_tu = 1);
DECLARE @qL2 INT = (SELECT id FROM CauHoi WHERE form_id = @f4 AND thu_tu = 2);
DECLARE @qG2 INT = (SELECT id FROM CauHoi WHERE form_id = @f4 AND thu_tu = 3);

INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, lua_chon_id)
SELECT ph.id, @qK2, lc.id
FROM PhanHoi ph
JOIN LuaChon lc ON lc.cau_hoi_id = @qK2 AND lc.noi_dung = ph.khoa
WHERE ph.form_id = @f4;

INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, lua_chon_id)
SELECT ph.id, @qL2, lc.id
FROM PhanHoi ph
JOIN LuaChon lc ON lc.cau_hoi_id = @qL2 AND lc.noi_dung = ph.lop
WHERE ph.form_id = @f4;

INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, lua_chon_id)
SELECT ph.id, @qG2, lc.id
FROM PhanHoi ph
JOIN LuaChon lc ON lc.cau_hoi_id = @qG2 AND lc.noi_dung = ph.giao_vien
WHERE ph.form_id = @f4;
GO

-- ================================================================
-- 9. CHI TIẾT PHẢN HỒI — câu hỏi rating (câu 4-13)
-- ================================================================
DECLARE @f5 INT = (SELECT id FROM Form WHERE ten_form = N'Dữ liệu mẫu khảo sát chất lượng giảng dạy tại FLIC');

INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, diem_danh_gia)
SELECT ph.id, ch.id,
  CAST(CASE
    WHEN ph.giao_vien = N'Nguyễn Thị Thu Hằng' THEN
      CASE (ph.id + ch.thu_tu) % 6 WHEN 0 THEN 5 WHEN 1 THEN 5 WHEN 2 THEN 5 WHEN 3 THEN 4 WHEN 4 THEN 5 ELSE 4 END
    WHEN ph.giao_vien = N'Trần Văn Minh' THEN
      CASE (ph.id + ch.thu_tu) % 6 WHEN 0 THEN 5 WHEN 1 THEN 4 WHEN 2 THEN 4 WHEN 3 THEN 4 WHEN 4 THEN 3 ELSE 4 END
    WHEN ph.giao_vien = N'Lê Thị Bích Ngọc' THEN
      CASE (ph.id + ch.thu_tu) % 6 WHEN 0 THEN 4 WHEN 1 THEN 4 WHEN 2 THEN 3 WHEN 3 THEN 3 WHEN 4 THEN 3 ELSE 4 END
    ELSE -- Phạm Quốc Tuấn
      CASE (ph.id + ch.thu_tu) % 6 WHEN 0 THEN 4 WHEN 1 THEN 3 WHEN 2 THEN 2 WHEN 3 THEN 2 WHEN 4 THEN 2 ELSE 3 END
  END AS INT)
FROM PhanHoi ph
CROSS JOIN CauHoi ch
WHERE ph.form_id = @f5 AND ch.form_id = @f5 AND ch.loai = 'rating';
GO

-- ================================================================
-- 10. CHI TIẾT PHẢN HỒI — câu hỏi text (câu 14-21)
-- ================================================================
DECLARE @f6  INT = (SELECT id FROM Form WHERE ten_form = N'Dữ liệu mẫu khảo sát chất lượng giảng dạy tại FLIC');
DECLARE @q14 INT = (SELECT id FROM CauHoi WHERE form_id = @f6 AND thu_tu = 14);
DECLARE @q15 INT = (SELECT id FROM CauHoi WHERE form_id = @f6 AND thu_tu = 15);
DECLARE @q16 INT = (SELECT id FROM CauHoi WHERE form_id = @f6 AND thu_tu = 16);
DECLARE @q17 INT = (SELECT id FROM CauHoi WHERE form_id = @f6 AND thu_tu = 17);
DECLARE @q18 INT = (SELECT id FROM CauHoi WHERE form_id = @f6 AND thu_tu = 18);
DECLARE @q19 INT = (SELECT id FROM CauHoi WHERE form_id = @f6 AND thu_tu = 19);
DECLARE @q20 INT = (SELECT id FROM CauHoi WHERE form_id = @f6 AND thu_tu = 20);
DECLARE @q21 INT = (SELECT id FROM CauHoi WHERE form_id = @f6 AND thu_tu = 21);

-- Câu 14: Cảm nhận GV Thu Hằng (chỉ SV học với cô)
INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, noi_dung_tra_loi)
SELECT ph.id, @q14,
  CASE (ROW_NUMBER() OVER(ORDER BY ph.id)) % 5
    WHEN 0 THEN N'Cô Thu Hằng giảng rất rõ ràng, sinh động và cuốn hút. Tôi chưa bao giờ thấy chán trong giờ học của cô.'
    WHEN 1 THEN N'Phong cách dạy của cô rất hiệu quả, dẫn dắt từ dễ đến khó một cách tự nhiên. Tôi tự tin hơn rất nhiều.'
    WHEN 2 THEN N'Cô truyền cảm hứng học tập. Luôn hỏi xem học viên hiểu chưa và giải thích lại nếu cần. Rất tận tâm.'
    WHEN 3 THEN N'Cô dạy chiến lược làm bài thực tế, áp dụng được ngay vào đề thi. Rất ấn tượng với kinh nghiệm của cô.'
    ELSE        N'Cô cập nhật đề thi mới nhất liên tục. Phong cách năng động, không buổi học nào nhàm chán.'
  END
FROM PhanHoi ph WHERE ph.form_id = @f6 AND ph.giao_vien = N'Nguyễn Thị Thu Hằng';

-- Câu 15: Cảm nhận GV Trần Minh
INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, noi_dung_tra_loi)
SELECT ph.id, @q15,
  CASE (ROW_NUMBER() OVER(ORDER BY ph.id)) % 4
    WHEN 0 THEN N'Thầy Minh giảng rõ phần Reading, có nhiều ví dụ thực tế. Đôi khi tốc độ hơi nhanh.'
    WHEN 1 THEN N'Thầy hay kể chuyện minh họa thú vị, lớp học vui. Nhiệt tình giải đáp ngoài giờ.'
    WHEN 2 THEN N'Thầy có kiến thức tốt, cần cải thiện thêm tốc độ và phong cách truyền đạt.'
    ELSE        N'Thầy dạy bài bản, lộ trình rõ ràng. Học được nhiều kỹ năng từ thầy.'
  END
FROM PhanHoi ph WHERE ph.form_id = @f6 AND ph.giao_vien = N'Trần Văn Minh';

-- Câu 16: Cảm nhận GV Bích Ngọc
INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, noi_dung_tra_loi)
SELECT ph.id, @q16,
  CASE (ROW_NUMBER() OVER(ORDER BY ph.id)) % 4
    WHEN 0 THEN N'Cô Ngọc giải thích Grammar khá rõ, kiên nhẫn. Tuy nhiên cần sinh động hơn.'
    WHEN 1 THEN N'Cô dạy bài bản, phù hợp người mới bắt đầu. Cần tăng tương tác với lớp hơn.'
    WHEN 2 THEN N'Cô thân thiện nhưng tốc độ giảng hơi chậm. Cần điều chỉnh để phù hợp hơn.'
    ELSE        N'Cô có kiến thức tốt nhưng cách truyền đạt chưa cuốn hút. Cần cải thiện thêm.'
  END
FROM PhanHoi ph WHERE ph.form_id = @f6 AND ph.giao_vien = N'Lê Thị Bích Ngọc';

-- Câu 17: Cảm nhận GV Quốc Tuấn
INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, noi_dung_tra_loi)
SELECT ph.id, @q17,
  CASE (ROW_NUMBER() OVER(ORDER BY ph.id)) % 4
    WHEN 0 THEN N'Thầy Tuấn có kiến thức nhưng hay đọc slide, không giải thích đủ. Cần cải thiện nhiều.'
    WHEN 1 THEN N'Thầy cần học hỏi thêm về phong cách giảng dạy. Lớp học thiếu tương tác.'
    WHEN 2 THEN N'Thầy không tạo được không khí học. Học viên hay mất tập trung trong giờ.'
    ELSE        N'Thầy có chuyên môn nhưng chưa biết cách truyền đạt hiệu quả. Mong FLIC hỗ trợ.'
  END
FROM PhanHoi ph WHERE ph.form_id = @f6 AND ph.giao_vien = N'Phạm Quốc Tuấn';

-- Câu 18: Hài lòng nhất (tất cả SV)
INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, noi_dung_tra_loi)
SELECT ph.id, @q18,
  CASE (ROW_NUMBER() OVER(ORDER BY ph.id)) % 8
    WHEN 0 THEN N'Chất lượng giảng dạy của giáo viên, đặc biệt là cách giảng dễ hiểu và thực tế.'
    WHEN 1 THEN N'Không khí lớp học vui vẻ, thân thiện. Học viên được tương tác và hỗ trợ tốt.'
    WHEN 2 THEN N'Học liệu phong phú, bám sát cấu trúc đề thi TOEIC thật. Rất thực tế và hữu ích.'
    WHEN 3 THEN N'Phòng học thoáng mát, thiết bị âm thanh tốt. Phù hợp cho việc luyện nghe.'
    WHEN 4 THEN N'Thời gian học linh hoạt, phù hợp với lịch học của sinh viên đại học.'
    WHEN 5 THEN N'Cách tổ chức lớp học khoa học, có lộ trình rõ ràng từ đầu đến cuối khóa.'
    WHEN 6 THEN N'Nhân viên và giáo viên nhiệt tình, luôn hỗ trợ học viên kịp thời.'
    ELSE        N'Giá học phí hợp lý so với chất lượng đào tạo. Xứng đáng với số tiền bỏ ra.'
  END
FROM PhanHoi ph WHERE ph.form_id = @f6;

-- Câu 19: Chưa hài lòng (chỉ 3★ trở xuống)
INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, noi_dung_tra_loi)
SELECT ph.id, @q19,
  CASE (ROW_NUMBER() OVER(ORDER BY ph.id)) % 5
    WHEN 0 THEN N'Lớp học đôi khi hơi đông, mong FLIC giảm sĩ số để được hỗ trợ tốt hơn.'
    WHEN 1 THEN N'Phòng học mùa hè thiếu điều hòa, ảnh hưởng đến chất lượng học tập.'
    WHEN 2 THEN N'Cần có thêm buổi mock test để học viên đánh giá tiến độ thực tế.'
    WHEN 3 THEN N'Lịch học đôi khi thay đổi đột ngột, mong thông báo sớm hơn để chuẩn bị.'
    ELSE        N'Mong có thêm tài liệu luyện tập nghe ở nhà để bổ sung ngoài giờ học.'
  END
FROM PhanHoi ph WHERE ph.form_id = @f6 AND ph.danh_gia <= 3;

-- Câu 20: Kỹ năng tiến bộ nhất (tất cả SV)
INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, noi_dung_tra_loi)
SELECT ph.id, @q20,
  CASE (ROW_NUMBER() OVER(ORDER BY ph.id)) % 6
    WHEN 0 THEN N'Kỹ năng Listening cải thiện rõ rệt, đặc biệt phần Part 3 và Part 4 không còn bị bỏ sót.'
    WHEN 1 THEN N'Reading nhanh hơn nhiều, biết cách skim và scan để tìm thông tin hiệu quả.'
    WHEN 2 THEN N'Vốn từ vựng TOEIC tăng đáng kể, nhận ra được nhiều từ quen thuộc trong đề thi.'
    WHEN 3 THEN N'Kỹ năng quản lý thời gian khi làm bài thi tốt hơn, không còn bị hết giờ ở Part 7.'
    WHEN 4 THEN N'Nghe hiểu tiếng Anh tự nhiên tốt hơn, không chỉ trong bài thi mà cả trong giao tiếp.'
    ELSE        N'Tự tin hơn khi tiếp cận đề thi TOEIC, không còn bị áp lực và lo lắng như trước.'
  END
FROM PhanHoi ph WHERE ph.form_id = @f6;

-- Câu 21: Có muốn học tiếp không
INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, noi_dung_tra_loi)
SELECT ph.id, @q21,
  CASE
    WHEN ph.danh_gia >= 4 THEN
      CASE (ROW_NUMBER() OVER(PARTITION BY ph.giao_vien ORDER BY ph.id)) % 3
        WHEN 0 THEN N'Có, sẽ đăng ký khóa EXP ngay sau khi kết thúc. Tin tưởng vào chất lượng FLIC.'
        WHEN 1 THEN N'Chắc chắn có! Sẽ tiếp tục học để đạt mục tiêu 650 TOEIC. Sẽ giới thiệu bạn bè.'
        ELSE        N'Có, đã đăng ký khóa tiếp theo rồi. Rất hài lòng với khóa hiện tại.'
      END
    ELSE
      CASE (ROW_NUMBER() OVER(PARTITION BY ph.giao_vien ORDER BY ph.id)) % 3
        WHEN 0 THEN N'Có thể, nhưng mong FLIC cải thiện chất lượng giảng viên trước.'
        WHEN 1 THEN N'Chưa chắc, cần cân nhắc thêm. Muốn thử lớp với giáo viên khác.'
        ELSE        N'Cần suy nghĩ thêm. Khóa này chưa đạt kỳ vọng nên chưa quyết định tiếp.'
      END
  END
FROM PhanHoi ph WHERE ph.form_id = @f6;
GO

-- ================================================================
-- KIỂM TRA
-- ================================================================
SELECT ph.giao_vien, ph.lop,
  COUNT(*)                        AS so_sv,
  AVG(CAST(ph.danh_gia AS FLOAT)) AS diem_tb,
  MIN(ph.ngay_gui)                AS tu_ngay,
  MAX(ph.ngay_gui)                AS den_ngay
FROM PhanHoi ph
WHERE ph.form_id = (SELECT id FROM Form WHERE ten_form = N'Dữ liệu mẫu khảo sát chất lượng giảng dạy tại FLIC')
GROUP BY ph.giao_vien, ph.lop
ORDER BY ph.giao_vien, ph.lop;

SELECT COUNT(*) AS tong_phan_hoi FROM PhanHoi
WHERE form_id = (SELECT id FROM Form WHERE ten_form = N'Dữ liệu mẫu khảo sát chất lượng giảng dạy tại FLIC');
GO

PRINT N'✅ Xong! Dữ liệu mẫu đã được tạo thành công.';
GO