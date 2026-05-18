-- ================================================================
--  FLIC_DB – Tạo database và toàn bộ bảng (đã cập nhật)
--  Phiên bản mới nhất sau các thay đổi phân quyền
--
--  Thay đổi phân quyền (bảng Quyen):
--    - Tách manage_form  → add_form, edit_form, delete_form
--    - Tách manage_library → add_library, edit_library, delete_library
--
--  SSMS: mở file → F5
-- ================================================================

CREATE DATABASE FLIC_DB;
GO

USE FLIC_DB;
GO

-- ================================================================
-- TẠO BẢNG
-- ================================================================

-- 1. NhanVien
CREATE TABLE NhanVien (
    id              INT           IDENTITY(1,1) PRIMARY KEY,
    ho_ten          NVARCHAR(100) NOT NULL,
    email           NVARCHAR(150) NOT NULL UNIQUE,
    so_dien_thoai   NVARCHAR(20),
    ten_dang_nhap   NVARCHAR(50)  NOT NULL UNIQUE,
    mat_khau        NVARCHAR(255) NOT NULL,
    vai_tro         NVARCHAR(20)  NOT NULL DEFAULT 'staff',
    phong_ban       NVARCHAR(100),
    trang_thai      NVARCHAR(20)  NOT NULL DEFAULT 'active',
    ngay_tao        DATETIME      NOT NULL DEFAULT GETDATE(),
    ngay_cap_nhat   DATETIME
);
GO

-- 2. Quyen
--    Mỗi nhân viên có đúng 1 dòng quyền (UNIQUE nhan_vien_id)
--    Các nhóm quyền:
--      · Biểu mẫu  : view_form, add_form, edit_form, delete_form
--      · Phê duyệt : view_approval, approve, share_form
--      · Báo cáo   : view_report, export_data
--      · Nhân viên : view_staff, manage_staff
--      · Thông báo : view_notif, send_notif
--      · Thư viện  : view_library, add_library, edit_library, delete_library
--      · Phản hồi  : view_feedback, delete_feedback
CREATE TABLE Quyen (
    id              INT  IDENTITY(1,1) PRIMARY KEY,
    nhan_vien_id    INT  NOT NULL UNIQUE REFERENCES NhanVien(id) ON DELETE CASCADE,
    -- Biểu mẫu
    view_form       BIT  NOT NULL DEFAULT 0,
    add_form        BIT  NOT NULL DEFAULT 0,
    edit_form       BIT  NOT NULL DEFAULT 0,
    delete_form     BIT  NOT NULL DEFAULT 0,
    -- Phê duyệt
    view_approval   BIT  NOT NULL DEFAULT 0,
    approve         BIT  NOT NULL DEFAULT 0,
    share_form      BIT  NOT NULL DEFAULT 0,
    -- Báo cáo & Thống kê
    view_report     BIT  NOT NULL DEFAULT 0,
    export_data     BIT  NOT NULL DEFAULT 0,
    -- Quản lý nhân viên
    view_staff      BIT  NOT NULL DEFAULT 0,
    manage_staff    BIT  NOT NULL DEFAULT 0,
    -- Thông báo
    view_notif      BIT  NOT NULL DEFAULT 0,
    send_notif      BIT  NOT NULL DEFAULT 0,
    -- Thư viện câu hỏi
    view_library    BIT  NOT NULL DEFAULT 0,
    add_library     BIT  NOT NULL DEFAULT 0,
    edit_library    BIT  NOT NULL DEFAULT 0,
    delete_library  BIT  NOT NULL DEFAULT 0,
    -- Phản hồi
    view_feedback   BIT  NOT NULL DEFAULT 0,
    delete_feedback BIT  NOT NULL DEFAULT 0
);
GO

-- 3. Form
CREATE TABLE Form (
    id              INT           IDENTITY(1,1) PRIMARY KEY,
    ten_form        NVARCHAR(200) NOT NULL,
    danh_muc        NVARCHAR(100) NOT NULL DEFAULT N'Khác',
    mo_ta           NVARCHAR(500),
    loi_ket         NVARCHAR(300),
    trang_thai      NVARCHAR(20)  NOT NULL DEFAULT 'draft',
    nhan_vien_id    INT           REFERENCES NhanVien(id) ON DELETE SET NULL,
    luot_xem        INT           NOT NULL DEFAULT 0,
    ngay_tao        DATETIME      NOT NULL DEFAULT GETDATE(),
    ngay_cap_nhat   DATETIME
);
GO

-- 4. ThuVienCauHoi
CREATE TABLE ThuVienCauHoi (
    id            INT           IDENTITY(1,1) PRIMARY KEY,
    bo_mon        NVARCHAR(20)  NOT NULL DEFAULT N'Ngoại ngữ',
    noi_dung      NVARCHAR(500) NOT NULL,
    loai          NVARCHAR(30)  NOT NULL DEFAULT 'choice',
    lua_chon      NVARCHAR(MAX),
    hang_grid     NVARCHAR(MAX),
    cot_grid      NVARCHAR(MAX),
    thu_tu        INT           NOT NULL DEFAULT 0,
    ngay_tao      DATETIME      NOT NULL DEFAULT GETDATE(),
    ngay_cap_nhat DATETIME
);
GO

-- 5. CauHoi
CREATE TABLE CauHoi (
    id            INT           IDENTITY(1,1) PRIMARY KEY,
    form_id       INT           NOT NULL REFERENCES Form(id) ON DELETE CASCADE,
    thu_vien_id   INT           NULL REFERENCES ThuVienCauHoi(id) ON DELETE SET NULL,
    noi_dung      NVARCHAR(500) NOT NULL,
    loai          NVARCHAR(20)  NOT NULL DEFAULT 'choice',
    thu_tu        INT           NOT NULL DEFAULT 1,
    bat_buoc      BIT           NOT NULL DEFAULT 0
);
GO

-- 6. LuaChon
CREATE TABLE LuaChon (
    id          INT           IDENTITY(1,1) PRIMARY KEY,
    cau_hoi_id  INT           NOT NULL REFERENCES CauHoi(id) ON DELETE CASCADE,
    noi_dung    NVARCHAR(300) NOT NULL,
    thu_tu      INT           NOT NULL DEFAULT 1
);
GO

-- 7. PhanHoi
CREATE TABLE PhanHoi (
    id              INT            IDENTITY(1,1) PRIMARY KEY,
    form_id         INT            NOT NULL REFERENCES Form(id) ON DELETE CASCADE,
    ho_ten          NVARCHAR(100),
    email           NVARCHAR(150),
    danh_gia        INT            CHECK (danh_gia BETWEEN 1 AND 5),
    noi_dung        NVARCHAR(1000) NOT NULL,
    cam_xuc         NVARCHAR(20)   DEFAULT 'positive',
    trang_thai      NVARCHAR(20)   NOT NULL DEFAULT 'new',
    tra_loi         NVARCHAR(1000),
    ngay_tra_loi    DATETIME,
    ngay_gui        DATETIME       NOT NULL DEFAULT GETDATE(),
    lop             NVARCHAR(50),
    khoa            NVARCHAR(100),
    giao_vien       NVARCHAR(100)
);
GO

-- 8. ChiTietPhanHoi
CREATE TABLE ChiTietPhanHoi (
    id               INT            IDENTITY(1,1) PRIMARY KEY,
    phan_hoi_id      INT            NOT NULL REFERENCES PhanHoi(id) ON DELETE CASCADE,
    cau_hoi_id       INT            NOT NULL REFERENCES CauHoi(id),
    lua_chon_id      INT            REFERENCES LuaChon(id),
    diem_danh_gia    INT            CHECK (diem_danh_gia BETWEEN 1 AND 5),
    noi_dung_tra_loi NVARCHAR(1000),
    ngay_tra_loi     DATETIME       NOT NULL DEFAULT GETDATE()
);
GO

-- 9. PheDuyet
CREATE TABLE PheDuyet (
    id              INT           IDENTITY(1,1) PRIMARY KEY,
    form_id         INT           NOT NULL REFERENCES Form(id) ON DELETE CASCADE,
    nhan_vien_id    INT           REFERENCES NhanVien(id) ON DELETE SET NULL,
    do_uu_tien      NVARCHAR(20)  NOT NULL DEFAULT 'medium',
    trang_thai      NVARCHAR(20)  NOT NULL DEFAULT 'pending',
    ghi_chu         NVARCHAR(500),
    ngay_yeu_cau    DATETIME      NOT NULL DEFAULT GETDATE(),
    ngay_xu_ly      DATETIME
);
GO

-- 10. ThongBao
CREATE TABLE ThongBao (
    id                  INT           IDENTITY(1,1) PRIMARY KEY,
    tieu_de             NVARCHAR(200) NOT NULL,
    noi_dung            NVARCHAR(500) NOT NULL,
    loai                NVARCHAR(20)  NOT NULL DEFAULT 'info',
    nguoi_nhan          NVARCHAR(200) NOT NULL DEFAULT N'Tất cả',
    trang_thai          NVARCHAR(20)  NOT NULL DEFAULT 'draft',
    ngay_gui            DATETIME,
    tong_nguoi_nhan     INT           NOT NULL DEFAULT 0,
    luot_da_doc         INT           NOT NULL DEFAULT 0,
    nhan_vien_id        INT           REFERENCES NhanVien(id) ON DELETE SET NULL,
    ngay_tao            DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- 11. YeuThich
CREATE TABLE YeuThich (
    id              INT      IDENTITY(1,1) PRIMARY KEY,
    nhan_vien_id    INT      NOT NULL REFERENCES NhanVien(id) ON DELETE CASCADE,
    form_id         INT      NOT NULL REFERENCES Form(id) ON DELETE CASCADE,
    ngay_them       DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_YeuThich UNIQUE (nhan_vien_id, form_id)
);
GO

PRINT N'✅ Tạo bảng thành công! Chạy tiếp Dulieumau.sql';
GO