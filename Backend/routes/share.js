const express    = require("express");
const router     = express.Router();
const nodemailer = require("nodemailer");
const { authMiddleware } = require("../middleware/auth");

// ── Cấu hình SMTP — dùng Brevo (miễn phí 300 email/ngày) ────────
// Hướng dẫn lấy SMTP key: https://app.brevo.com → SMTP & API → SMTP
// Đăng ký tại: https://www.brevo.com (miễn phí, không cần thẻ)
//
// Sau khi đăng ký Brevo, vào: SMTP & API → SMTP → Generate SMTP Key
// Điền vào 2 dòng bên dưới:
const SMTP_CONFIG = {
  host:   "smtp.gmail.com",
  port:   465,
  secure: true,
  auth: {
    user: "trantienhung17pnt@gmail.com",
    pass: "fwjzkujgnmcczhdr",  // App Password không có dấu cách
  },
  tls: {
    rejectUnauthorized: false,
  },
};

const FROM_NAME  = "FLIC - Trung Tâm Ngoại Ngữ - Tin Học";
const FROM_EMAIL = "trantienhung17pnt@gmail.com";

function buildPublicFormUrl(req, formId) {
  const base = process.env.PUBLIC_FORM_BASE_URL ||
    `${req.get("origin") || "http://127.0.0.1:5500"}/Flic_Project/Frontend/pages/form-builder.html`;
  const url = new URL(base);
  url.searchParams.set("form_id", formId);
  return url.toString();
}


// ── Tạo transporter ────────────────────────────────────────────
let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(SMTP_CONFIG);
  }
  return transporter;
}

// POST /api/share/send-email
// Body: { emails: string[], form_id, form_name, sender_name }
router.post("/send-email", authMiddleware, async (req, res) => {
  const { emails, form_id, form_name, sender_name } = req.body;

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ message: "Vui lòng nhập ít nhất một email" });
  }
  if (!form_id) {
    return res.status(400).json({ message: "Thiếu form_id" });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalid = emails.filter(e => !emailRegex.test(e.trim()));
  if (invalid.length) {
    return res.status(400).json({ message: `Email không hợp lệ: ${invalid.join(", ")}` });
  }

  const formLink  = buildPublicFormUrl(req, form_id);
  const sender    = sender_name || "Quản trị viên FLIC";
  const formTitle = form_name   || "Biểu mẫu";

  const htmlBody = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb);padding:28px 32px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:.5px">FLIC</div>
      <div style="font-size:12px;color:rgba(255,255,255,.8);margin-top:4px">Trung Tâm Ngoại Ngữ - Tin Học</div>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="font-size:15px;color:#1e293b;margin:0 0 16px">Xin chào,</p>
      <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px">
        <strong style="color:#0284c7">${sender}</strong> đã chia sẻ biểu mẫu
        <strong style="color:#1e293b">"${formTitle}"</strong> với bạn.
        Vui lòng nhấn nút bên dưới để truy cập và điền thông tin:
      </p>

      <div style="text-align:center;margin:28px 0">
        <a href="${formLink}"
           style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;
                  text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;
                  font-weight:700;letter-spacing:.3px">
          📋 Mở biểu mẫu
        </a>
      </div>

      <p style="font-size:12.5px;color:#94a3b8;margin:0 0 8px">Hoặc sao chép đường dẫn sau vào trình duyệt:</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                  padding:10px 14px;font-size:12px;color:#475569;word-break:break-all">
        ${formLink}
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="font-size:11.5px;color:#94a3b8;margin:0">
        Email này được gửi từ hệ thống FLIC.<br>
        Nếu bạn không mong đợi email này, vui lòng bỏ qua.
      </p>
    </div>
  </div>
</body>
</html>`;

  const results = [];
  const tp = getTransporter();

  // Verify transporter trước khi gửi
  try {
    await tp.verify();
    console.log("✅ SMTP kết nối OK");
  } catch (verifyErr) {
    console.error("❌ SMTP verify thất bại:", verifyErr.message);
    return res.status(500).json({
      message: "Lỗi kết nối SMTP: " + verifyErr.message,
      details: verifyErr.message,
    });
  }

  for (const email of emails) {
    try {
      await tp.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to:   email.trim(),
        subject: `[FLIC] ${sender} đã chia sẻ biểu mẫu "${formTitle}" với bạn`,
        html: htmlBody,
      });
      console.log("✅ Gửi OK →", email);
      results.push({ email, success: true });
    } catch (err) {
      console.error("❌ Gửi thất bại →", email, ":", err.message);
      results.push({ email, success: false, error: err.message });
    }
  }

  const ok   = results.filter(r => r.success).length;
  const fail = results.filter(r => !r.success);

  if (ok === 0) {
    return res.status(500).json({
      message: "Gửi email thất bại: " + (fail[0]?.error || "Lỗi không xác định"),
      details: fail,
    });
  }

  res.json({
    message: `Đã gửi thành công ${ok}/${results.length} email`,
    results,
  });
});

module.exports = router;
