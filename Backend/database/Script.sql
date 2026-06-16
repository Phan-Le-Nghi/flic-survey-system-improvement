-- =================================================================

CREATE DATABASE FLIC_DATABASE;
GO
USE FLIC_DATABASE;
GO



CREATE TABLE NhanVien (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ho_ten NVARCHAR(100) NOT NULL,
    email NVARCHAR(150) NOT NULL UNIQUE,
    so_dien_thoai NVARCHAR(20),
    ten_dang_nhap NVARCHAR(50) NOT NULL UNIQUE,
    mat_khau NVARCHAR(255) NOT NULL,
    vai_tro NVARCHAR(20) NOT NULL DEFAULT 'staff' CONSTRAINT CHK_NhanVien_VaiTro CHECK (vai_tro IN ('admin', 'staff')),
    phong_ban NVARCHAR(100),
    trang_thai NVARCHAR(20) NOT NULL DEFAULT 'active' CONSTRAINT CHK_NhanVien_TrangThai CHECK (trang_thai IN ('active', 'inactive', 'locked')),
    ngay_tao DATETIME NOT NULL DEFAULT GETDATE(),
    ngay_cap_nhat DATETIME NULL
);
GO

CREATE TABLE LoaiKhaoSat (
    id INT IDENTITY(1,1) PRIMARY KEY,
    danh_muc NVARCHAR(100) NOT NULL CONSTRAINT CHK_LoaiKhaoSat_DanhMuc CHECK (danh_muc IN (N'Ngoại ngữ', N'Tin học')),
    nganh_dao_tao NVARCHAR(255) NULL,
    ten_loai NVARCHAR(100) NOT NULL,
    mo_ta NVARCHAR(500) NULL,
    trang_thai NVARCHAR(20) NOT NULL DEFAULT 'active' CONSTRAINT CHK_LoaiKhaoSat_TrangThai CHECK (trang_thai IN ('active', 'inactive')),
    ngay_tao DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_LoaiKhaoSat UNIQUE (danh_muc, ten_loai)
);
GO

CREATE TABLE Form (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ten_form NVARCHAR(200) NOT NULL,
    loai_khao_sat_id INT NOT NULL REFERENCES LoaiKhaoSat(id),
    doi_tuong NVARCHAR(50) NOT NULL DEFAULT N'Tất cả' CONSTRAINT CHK_Form_DoiTuong CHECK (doi_tuong IN (N'Tất cả', N'Sinh viên', N'Người đi làm')),
    ma_rut_gon VARCHAR(20) UNIQUE NULL,
    nguon_chia_se NVARCHAR(255) NULL,
    mo_ta NVARCHAR(500) NULL,
    loi_ket NVARCHAR(500) NULL,
    trang_thai NVARCHAR(20) NOT NULL DEFAULT 'draft' CONSTRAINT CHK_Form_TrangThai CHECK (trang_thai IN ('draft', 'pending', 'active', 'rejected', 'closed', 'deleted')),
    nhan_vien_id INT NULL REFERENCES NhanVien(id) ON DELETE SET NULL,
    luot_xem INT NOT NULL DEFAULT 0,
    ngay_tao DATETIME NOT NULL DEFAULT GETDATE(),
    ngay_cap_nhat DATETIME NULL,
    ngay_dong DATETIME NULL,
    anh_bia NVARCHAR(MAX) NULL,
    mau_nen NVARCHAR(20) DEFAULT '#F0F4F9',
    font_family NVARCHAR(80) DEFAULT 'Roboto',
    accept_responses BIT NOT NULL DEFAULT 1,
    collect_email BIT NOT NULL DEFAULT 0,
    limit_one_response BIT NOT NULL DEFAULT 0,
    allow_edit_after_submit BIT NOT NULL DEFAULT 0,
    disable_autosave BIT NOT NULL DEFAULT 0,
    is_public BIT NOT NULL DEFAULT 0,
    ngay_xoa DATETIME NULL,
    nguoi_xoa_id INT NULL REFERENCES NhanVien(id),
    ly_do_xoa NVARCHAR(500) NULL,
    ai_tom_tat NVARCHAR(MAX) NULL,
    ngay_cap_nhat_ai DATETIME NULL,
    CONSTRAINT CHK_Form_NgayDong CHECK (ngay_dong IS NULL OR ngay_dong >= ngay_tao)
);
GO

CREATE TABLE FormSection (
    id INT IDENTITY(1,1) PRIMARY KEY,
    form_id INT NOT NULL REFERENCES Form(id) ON DELETE CASCADE,
    title NVARCHAR(200) NOT NULL DEFAULT N'Phần không có tiêu đề',
    description NVARCHAR(500) NULL,
    thu_tu INT NOT NULL,
    next_action NVARCHAR(30) NOT NULL DEFAULT 'continue',
    next_section_id INT NULL,
    ngay_tao DATETIME NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE ThuVienCauHoi (
    id INT IDENTITY(1,1) PRIMARY KEY,
    loai_khao_sat_id INT NOT NULL REFERENCES LoaiKhaoSat(id),
    doi_tuong NVARCHAR(50) NOT NULL DEFAULT N'Tất cả' CONSTRAINT CHK_ThuVien_DoiTuong CHECK (doi_tuong IN (N'Tất cả', N'Sinh viên', N'Người đi làm')),
    noi_dung NVARCHAR(500) NOT NULL,
    loai NVARCHAR(50) NOT NULL CONSTRAINT CHK_ThuVien_Loai CHECK (loai IN ('short_text', 'long_text', 'paragraph', 'choice', 'multiple_choice', 'checkbox', 'dropdown', 'upload', 'rating', 'scale', 'grid', 'grid_radio', 'grid_checkbox', 'date', 'time', 'section')),
    bat_buoc BIT NOT NULL DEFAULT 0,
    hinh_anh NVARCHAR(MAX) NULL,
    video NVARCHAR(MAX) NULL,
    lua_chon_mau NVARCHAR(MAX) NULL,
    hang_grid NVARCHAR(MAX) NULL,
    cot_grid NVARCHAR(MAX) NULL,
    bo_mon NVARCHAR(100) NULL,
    thu_tu INT NOT NULL DEFAULT 0,
    ngay_tao DATETIME NOT NULL DEFAULT GETDATE(),
    ngay_cap_nhat DATETIME NULL
);
GO

CREATE TABLE CauHoi (
    id INT IDENTITY(1,1) PRIMARY KEY,
    form_id INT NOT NULL REFERENCES Form(id) ON DELETE CASCADE,
    thu_vien_id INT NULL REFERENCES ThuVienCauHoi(id) ON DELETE SET NULL,
    section_id INT NULL REFERENCES FormSection(id) ON DELETE NO ACTION,
    noi_dung NVARCHAR(500) NOT NULL,
    loai NVARCHAR(50) NOT NULL CONSTRAINT CHK_CauHoi_Loai CHECK (loai IN ('short_text', 'long_text', 'paragraph', 'choice', 'multiple_choice', 'checkbox', 'dropdown', 'upload', 'rating', 'scale', 'grid', 'grid_radio', 'grid_checkbox', 'date', 'time', 'section')),
    thu_tu INT NOT NULL,
    bat_buoc BIT NOT NULL DEFAULT 0,
    mo_ta_cau_hoi NVARCHAR(500) NULL,
    hinh_anh NVARCHAR(MAX) NULL,
    video NVARCHAR(MAX) NULL,
    hang_grid NVARCHAR(MAX) NULL,
    cot_grid NVARCHAR(MAX) NULL,
    logic_json NVARCHAR(MAX) NULL,
    validation_json NVARCHAR(MAX) NULL
);
GO

CREATE TABLE LuaChon (
    id INT IDENTITY(1,1) PRIMARY KEY,
    cau_hoi_id INT NOT NULL REFERENCES CauHoi(id) ON DELETE CASCADE,
    noi_dung NVARCHAR(200) NOT NULL,
    thu_tu INT NOT NULL,
    next_section_id INT NULL REFERENCES FormSection(id) ON DELETE NO ACTION
);
GO

CREATE TABLE PhanHoi (
    id INT IDENTITY(1,1) PRIMARY KEY,
    form_id INT NOT NULL REFERENCES Form(id) ON DELETE CASCADE,
    doi_tuong_nop NVARCHAR(50) NOT NULL DEFAULT N'Khác' CONSTRAINT CHK_PhanHoi_DoiTuong CHECK (doi_tuong_nop IN (N'Khác', N'Sinh viên', N'Người đi làm')),
    email_nguoi_gui NVARCHAR(150) NULL,
    ho_ten_nguoi_gui NVARCHAR(100) NULL,
    lop NVARCHAR(50) NULL,
    khoa NVARCHAR(100) NULL,
    giao_vien NVARCHAR(100) NULL,
    ngay_gui DATETIME NOT NULL DEFAULT GETDATE(),
    trang_thai NVARCHAR(20) NOT NULL DEFAULT 'active' CONSTRAINT CHK_PhanHoi_TrangThai CHECK (trang_thai IN ('active', 'deleted')),
    ngay_xoa DATETIME NULL,
    nguoi_xoa_id INT NULL REFERENCES NhanVien(id),
    ly_do_xoa NVARCHAR(500) NULL,
    ma_token UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    ip_gui NVARCHAR(80) NULL,
    thong_tin_trinh_duyet NVARCHAR(500) NULL,
    thoi_gian_dien_form_giay INT NULL,
    danh_gia INT NULL CONSTRAINT CHK_PhanHoi_DanhGia CHECK (danh_gia IS NULL OR danh_gia BETWEEN 0 AND 10),
    cam_xuc NVARCHAR(20) NULL CONSTRAINT CHK_PhanHoi_CamXuc CHECK (cam_xuc IN (N'Tích cực', N'Tiêu cực', N'Trung lập', N'Không rõ'))
);
GO

CREATE TABLE ChiTietPhanHoi (
    id INT IDENTITY(1,1) PRIMARY KEY,
    phan_hoi_id INT NOT NULL REFERENCES PhanHoi(id) ON DELETE CASCADE,
    cau_hoi_id INT NOT NULL REFERENCES CauHoi(id) ON DELETE NO ACTION,
    lua_chon_id INT NULL REFERENCES LuaChon(id) ON DELETE NO ACTION,
    cau_tra_loi NVARCHAR(MAX) NULL,
    diem_danh_gia INT NULL CONSTRAINT CHK_ChiTietPhanHoi_Diem CHECK (diem_danh_gia IS NULL OR diem_danh_gia BETWEEN 0 AND 10),
    ai_cam_xuc NVARCHAR(20) NULL CONSTRAINT CHK_ChiTietPhanHoi_AICamXuc CHECK (ai_cam_xuc IN (N'Tích cực', N'Tiêu cực', N'Trung lập', N'Không rõ')),
    ai_tu_khoa NVARCHAR(200) NULL
);
GO

CREATE TABLE FormUpload (
    id INT IDENTITY(1,1) PRIMARY KEY,
    phan_hoi_id INT NULL REFERENCES PhanHoi(id) ON DELETE CASCADE,
    cau_hoi_id INT NOT NULL REFERENCES CauHoi(id) ON DELETE NO ACTION,
    file_name NVARCHAR(255) NOT NULL,
    file_url NVARCHAR(MAX) NOT NULL,
    file_type NVARCHAR(120) NULL,
    file_size BIGINT NULL,
    uploaded_at DATETIME NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE PheDuyet (
    id INT IDENTITY(1,1) PRIMARY KEY,
    form_id INT NOT NULL REFERENCES Form(id) ON DELETE CASCADE,
    nguoi_gui_id INT NULL REFERENCES NhanVien(id) ON DELETE SET NULL,
    nguoi_duyet_id INT NULL REFERENCES NhanVien(id),
    loai_phe_duyet NVARCHAR(100) NULL,
    do_uu_tien NVARCHAR(20) NOT NULL DEFAULT 'normal' CONSTRAINT CHK_PheDuyet_UuTien CHECK (do_uu_tien IN ('low', 'normal', 'urgent')),
    trang_thai NVARCHAR(20) NOT NULL DEFAULT 'pending' CONSTRAINT CHK_PheDuyet_TrangThai CHECK (trang_thai IN ('pending', 'approved', 'rejected')),
    ghi_chu NVARCHAR(500) NULL,
    ly_do_tu_choi NVARCHAR(500) NULL,
    ngay_yeu_cau DATETIME NOT NULL DEFAULT GETDATE(),
    han_chot_duyet DATETIME NULL,
    ngay_xu_ly DATETIME NULL
);
GO

CREATE TABLE FormVersion (
    id INT IDENTITY(1,1) PRIMARY KEY,
    form_id INT NOT NULL REFERENCES Form(id) ON DELETE CASCADE,
    version_no INT NOT NULL,
    snapshot_json NVARCHAR(MAX) NOT NULL,
    created_by INT NULL REFERENCES NhanVien(id),
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    note NVARCHAR(300) NULL,
    CONSTRAINT UQ_FormVersion UNIQUE(form_id, version_no)
);
GO

CREATE TABLE NhatKyHoatDong (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nhan_vien_id INT NULL REFERENCES NhanVien(id) ON DELETE SET NULL,
    hanh_dong NVARCHAR(50) NOT NULL,
    doi_tuong NVARCHAR(50) NOT NULL,
    doi_tuong_id INT NULL,
    ly_do NVARCHAR(500) NULL,
    chi_tiet NVARCHAR(MAX) NULL,
    thoi_gian DATETIME NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE Form_CongTac (
    id INT IDENTITY(1,1) PRIMARY KEY,
    form_id INT NOT NULL REFERENCES Form(id) ON DELETE CASCADE,
    nhan_vien_id INT NOT NULL REFERENCES NhanVien(id) ON DELETE CASCADE,
    quyen NVARCHAR(30) NOT NULL DEFAULT 'editor',
    can_share BIT NOT NULL DEFAULT 0,
    ngay_cap_quyen DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_Form_CongTac UNIQUE (form_id, nhan_vien_id)
);
GO

CREATE TABLE YeuThich (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nhan_vien_id INT NOT NULL REFERENCES NhanVien(id) ON DELETE CASCADE,
    form_id INT NOT NULL REFERENCES Form(id) ON DELETE CASCADE,
    ngay_tao DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_YeuThich UNIQUE (nhan_vien_id, form_id)
);
GO

CREATE TABLE FormAnalytics (
    id INT IDENTITY(1,1) PRIMARY KEY,
    form_id INT NOT NULL REFERENCES Form(id) ON DELETE CASCADE,
    metric_key NVARCHAR(100) NOT NULL,
    metric_json NVARCHAR(MAX) NOT NULL,
    generated_at DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_FormAnalytics UNIQUE(form_id, metric_key)
);
GO

CREATE TABLE QuestionAnalytics (
    id INT IDENTITY(1,1) PRIMARY KEY,
    cau_hoi_id INT NOT NULL REFERENCES CauHoi(id) ON DELETE CASCADE,
    metric_key NVARCHAR(100) NOT NULL,
    metric_json NVARCHAR(MAX) NOT NULL,
    generated_at DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_QuestionAnalytics UNIQUE(cau_hoi_id, metric_key)
);
GO

CREATE TABLE ThongBao (
    id INT IDENTITY(1,1) PRIMARY KEY,
    tieu_de NVARCHAR(200) NOT NULL,
    noi_dung NVARCHAR(500) NOT NULL,
    loai NVARCHAR(20) NOT NULL DEFAULT 'info' CONSTRAINT CHK_ThongBao_Loai CHECK (loai IN ('info', 'warning', 'success', 'error')),
    nguoi_nhan NVARCHAR(200) NOT NULL DEFAULT N'Tất cả',
    trang_thai NVARCHAR(20) NOT NULL DEFAULT 'draft' CONSTRAINT CHK_ThongBao_TrangThai CHECK (trang_thai IN ('draft', 'scheduled', 'sent')),
    ngay_gui DATETIME NULL,
    ngay_len_lich DATETIME NULL,
    tong_nguoi_nhan INT NOT NULL DEFAULT 0,
    luot_da_doc INT NOT NULL DEFAULT 0,
    nhan_vien_id INT NULL REFERENCES NhanVien(id) ON DELETE SET NULL,
    ngay_tao DATETIME NOT NULL DEFAULT GETDATE()
);
GO



/* =====================================================
   1. SỬA ĐỐI TƯỢNG TRONG BẢNG FORM
===================================================== */

IF EXISTS (
    SELECT 1 
    FROM sys.check_constraints 
    WHERE name = 'CHK_Form_DoiTuong'
)
BEGIN
    ALTER TABLE Form DROP CONSTRAINT CHK_Form_DoiTuong;
END
GO

UPDATE Form
SET doi_tuong = N'Sinh viên trong ĐH Kinh tế'
WHERE doi_tuong = N'Sinh viên';
GO

ALTER TABLE Form
ALTER COLUMN doi_tuong NVARCHAR(80) NOT NULL;
GO

ALTER TABLE Form
ADD CONSTRAINT CHK_Form_DoiTuong
CHECK (doi_tuong IN (
    N'Tất cả',
    N'Sinh viên trong ĐH Kinh tế',
    N'Sinh viên ngoài Trường ĐH Kinh tế',
    N'Người đi làm'
));
GO


/* =====================================================
   2. SỬA ĐỐI TƯỢNG TRONG BẢNG THƯ VIỆN CÂU HỎI
===================================================== */

IF EXISTS (
    SELECT 1 
    FROM sys.check_constraints 
    WHERE name = 'CHK_ThuVien_DoiTuong'
)
BEGIN
    ALTER TABLE ThuVienCauHoi DROP CONSTRAINT CHK_ThuVien_DoiTuong;
END
GO

UPDATE ThuVienCauHoi
SET doi_tuong = N'Sinh viên trong ĐH Kinh tế'
WHERE doi_tuong = N'Sinh viên';
GO

ALTER TABLE ThuVienCauHoi
ALTER COLUMN doi_tuong NVARCHAR(80) NOT NULL;
GO

ALTER TABLE ThuVienCauHoi
ADD CONSTRAINT CHK_ThuVien_DoiTuong
CHECK (doi_tuong IN (
    N'Tất cả',
    N'Sinh viên trong ĐH Kinh tế',
    N'Sinh viên ngoài Trường ĐH Kinh tế',
    N'Người đi làm'
));
GO


/* =====================================================
   3. THÊM TRẠNG THÁI CHO CÂU HỎI MẪU NẾU CHƯA CÓ
   Để sau này có thể ẩn câu hỏi mẫu không dùng nữa
===================================================== */

IF COL_LENGTH('ThuVienCauHoi', 'trang_thai') IS NULL
BEGIN
    ALTER TABLE ThuVienCauHoi
    ADD trang_thai NVARCHAR(20) NOT NULL DEFAULT 'active';
END
GO

IF NOT EXISTS (
    SELECT 1 
    FROM sys.check_constraints 
    WHERE name = 'CHK_ThuVien_TrangThai'
)
BEGIN
    ALTER TABLE ThuVienCauHoi
    ADD CONSTRAINT CHK_ThuVien_TrangThai
    CHECK (trang_thai IN ('active', 'inactive'));
END
GO


/* =====================================================
   1. FORM: cho phép Tất cả / Sinh viên / Người đi làm
===================================================== */

IF EXISTS (
    SELECT 1 
    FROM sys.check_constraints 
    WHERE name = 'CHK_Form_DoiTuong'
)
BEGIN
    ALTER TABLE Form DROP CONSTRAINT CHK_Form_DoiTuong;
END
GO

UPDATE Form
SET doi_tuong = N'Sinh viên'
WHERE doi_tuong IN (
    N'Sinh viên trong ĐH Kinh tế',
    N'Sinh viên ngoài Trường ĐH Kinh tế'
);
GO

ALTER TABLE Form
ALTER COLUMN doi_tuong NVARCHAR(50) NOT NULL;
GO

ALTER TABLE Form
ADD CONSTRAINT CHK_Form_DoiTuong
CHECK (doi_tuong IN (
    N'Tất cả',
    N'Sinh viên',
    N'Người đi làm'
));
GO


/* =====================================================
   2. DEFAULT của FORM.doi_tuong: để Tất cả
===================================================== */

DECLARE @df_form NVARCHAR(200);

SELECT @df_form = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c 
    ON dc.parent_object_id = c.object_id
   AND dc.parent_column_id = c.column_id
WHERE OBJECT_NAME(dc.parent_object_id) = 'Form'
  AND c.name = 'doi_tuong';

IF @df_form IS NOT NULL
BEGIN
    EXEC('ALTER TABLE Form DROP CONSTRAINT ' + @df_form);
END
GO

ALTER TABLE Form
ADD CONSTRAINT DF_Form_DoiTuong DEFAULT N'Tất cả' FOR doi_tuong;
GO


/* =====================================================
   3. THƯ VIỆN CÂU HỎI: Tất cả / Sinh viên / Người đi làm
===================================================== */

IF EXISTS (
    SELECT 1 
    FROM sys.check_constraints 
    WHERE name = 'CHK_ThuVien_DoiTuong'
)
BEGIN
    ALTER TABLE ThuVienCauHoi DROP CONSTRAINT CHK_ThuVien_DoiTuong;
END
GO

UPDATE ThuVienCauHoi
SET doi_tuong = N'Sinh viên'
WHERE doi_tuong IN (
    N'Sinh viên trong ĐH Kinh tế',
    N'Sinh viên ngoài Trường ĐH Kinh tế'
);
GO

ALTER TABLE ThuVienCauHoi
ALTER COLUMN doi_tuong NVARCHAR(50) NOT NULL;
GO

ALTER TABLE ThuVienCauHoi
ADD CONSTRAINT CHK_ThuVien_DoiTuong
CHECK (doi_tuong IN (
    N'Tất cả',
    N'Sinh viên',
    N'Người đi làm'
));
GO


/* =====================================================
   4. PHẢN HỒI: Khác / Sinh viên / Người đi làm
   Nếu muốn cho phép Tất cả trong phản hồi thì thêm vào,
   nhưng thường phản hồi nên là người nộp cụ thể nên không cần.
===================================================== */

IF EXISTS (
    SELECT 1 
    FROM sys.check_constraints 
    WHERE name = 'CHK_PhanHoi_DoiTuong'
)
BEGIN
    ALTER TABLE PhanHoi DROP CONSTRAINT CHK_PhanHoi_DoiTuong;
END
GO

UPDATE PhanHoi
SET doi_tuong_nop = N'Sinh viên'
WHERE doi_tuong_nop IN (
    N'Sinh viên trong ĐH Kinh tế',
    N'Sinh viên ngoài Trường ĐH Kinh tế'
);
GO

ALTER TABLE PhanHoi
ALTER COLUMN doi_tuong_nop NVARCHAR(50) NOT NULL;
GO

ALTER TABLE PhanHoi
ADD CONSTRAINT CHK_PhanHoi_DoiTuong
CHECK (doi_tuong_nop IN (
    N'Khác',
    N'Sinh viên',
    N'Người đi làm'
));
GO
