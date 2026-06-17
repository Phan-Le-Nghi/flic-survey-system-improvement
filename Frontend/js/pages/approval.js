requireMenuAccess("approval-management");

// ── Permission helpers ────────────────────────────────────────────
// getUser(), isAdmin(), hasPermission(), hasAnyPermission() — từ layout.js
function canApproveNow() { return isAdmin() || hasPermission("approve"); }
function canShareFormNow() { return isAdmin() || hasPermission("share_form"); }
function canViewApprovalNow() {
  return isAdmin() || hasAnyPermission(["view_approval", "approve", "share_form"]);
}

if (!canViewApprovalNow()) {
  alert("Bạn không có quyền truy cập chức năng này");
  window.location.href = "dashboard.html";
}

// ── localStorage ─────────────────────────────────────────────────
const LS_APPROVALS = "flic_approvals";
const LS_TRASH_FORMS = "flic_trash_forms";
const LS_HIDDEN_APPROVAL_FORMS = "flic_hidden_approval_forms";
const LS_NOTIFS = "flic_notifications";
const DEFAULT_APPROVALS = [
  {
    id: "1",
    form: "Đăng ký khóa học Tiếng Anh",
    by: "Nguyễn Minh Anh",
    date: "14/03/2026 09:30",
    status: "pending",
    cat: "Đăng ký",
    priority: "high",
    questions: [
      {
        id: "q1",
        text: "Bạn muốn đăng ký khóa học nào?",
        type: "choice",
        opts: ["Tiếng Anh cơ bản", "Tiếng Anh nâng cao", "IELTS", "TOEIC"],
      },
      {
        id: "q2",
        text: "Trình độ hiện tại của bạn?",
        type: "choice",
        opts: ["Mới bắt đầu", "Sơ cấp", "Trung cấp", "Nâng cao"],
      },
    ],
  },
  {
    id: "2",
    form: "Khảo sát mức độ hài lòng",
    by: "Trần Văn Bình",
    date: "13/03/2026 14:15",
    status: "pending",
    cat: "Khảo sát",
    priority: "medium",
    questions: [
      {
        id: "q1",
        text: "Bạn hài lòng như thế nào về chất lượng giảng dạy?",
        type: "rating",
        opts: [
          "1 - Rất không hài lòng",
          "2 - Không hài lòng",
          "3 - Bình thường",
          "4 - Hài lòng",
          "5 - Rất hài lòng",
        ],
      },
      {
        id: "q2",
        text: "Bạn có giới thiệu FLIC cho người thân không?",
        type: "choice",
        opts: ["Chắc chắn có", "Có thể", "Chưa chắc", "Không"],
      },
    ],
  },
  {
    id: "3",
    form: "Phiếu đánh giá giảng viên",
    by: "Lê Thị Cúc",
    date: "12/03/2026 11:00",
    status: "approved",
    cat: "Đánh giá",
    priority: "low",
    questions: [
      {
        id: "q1",
        text: "Giảng viên có giảng dạy nhiệt tình không?",
        type: "rating",
        opts: ["1", "2", "3", "4", "5"],
      },
    ],
  },
  {
    id: "4",
    form: "Đăng ký thi chứng chỉ Tin học",
    by: "Phạm Quốc Dũng",
    date: "11/03/2026 16:45",
    status: "rejected",
    cat: "Đăng ký",
    priority: "high",
    questions: [
      {
        id: "q1",
        text: "Bạn muốn thi chứng chỉ nào?",
        type: "choice",
        opts: ["IC3", "MOS", "ICDL"],
      },
    ],
  },
  {
    id: "5",
    form: "Feedback chương trình học",
    by: "Hoàng Thị Em",
    date: "10/03/2026 08:20",
    status: "approved",
    cat: "Phản hồi",
    priority: "medium",
    questions: [
      {
        id: "q1",
        text: "Chương trình học có phù hợp không?",
        type: "rating",
        opts: ["1", "2", "3", "4", "5"],
      },
      {
        id: "q2",
        text: "Bạn muốn FLIC cải thiện điều gì?",
        type: "text",
        opts: [],
      },
    ],
  },
  {
    id: "6",
    form: "Đăng ký học thử miễn phí",
    by: "Vũ Minh Phúc",
    date: "09/03/2026 13:30",
    status: "pending",
    cat: "Đăng ký",
    priority: "high",
    questions: [
      {
        id: "q1",
        text: "Bạn quan tâm đến khóa học nào?",
        type: "choice",
        opts: ["Tiếng Anh", "Tin học", "Thiết kế"],
      },
    ],
  },
];

const API_APPROVALS = `${API_BASE}/approvals`;

function getAuthHeaders() {
  const token = localStorage.getItem("token") || "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function padApprovalDatePart(value) {
  return String(value).padStart(2, "0");
}

function formatApprovalDateTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return (
    padApprovalDatePart(date.getDate()) +
    "/" +
    padApprovalDatePart(date.getMonth() + 1) +
    "/" +
    date.getFullYear() +
    " " +
    padApprovalDatePart(date.getHours()) +
    ":" +
    padApprovalDatePart(date.getMinutes())
  );
}

function formatApprovalDate(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (match) return match[1];
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "").split(" ")[0];
  return (
    padApprovalDatePart(date.getDate()) +
    "/" +
    padApprovalDatePart(date.getMonth() + 1) +
    "/" +
    date.getFullYear()
  );
}

function parseApprovalDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const viMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (viMatch) {
      const [, dd, mm, yyyy, hh = "0", mi = "0"] = viMatch;
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi));
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getApprovalDisplayDate(a) {
  return formatApprovalDate(a.requested_at || a.date);
}

function splitApprovalNote(rawNote = "") {
  const text = String(rawNote || "").trim();
  if (!text) return { note: "", urgentReason: "" };

  const urgentMatch = text.match(/Lý do duyệt gấp:\s*([\s\S]*?)(?:\n\s*Hạn chót phê duyệt:|$)/i);
  const urgentReason = urgentMatch ? urgentMatch[1].trim() : "";
  const note = text
    .replace(/Lý do duyệt gấp:\s*[\s\S]*?(?=\n\s*Hạn chót phê duyệt:|$)/i, "")
    .replace(/^Hạn chót phê duyệt:.*$/gim, "")
    .trim();

  return { note, urgentReason };
}

// Map dữ liệu từ DB → format FE
function mapDbApproval(a) {
  const priorityMap = { urgent: "high", high: "high", normal: "medium", medium: "medium", low: "low" };
  const statusMap = { pending: "pending", approved: "approved", rejected: "rejected" };
  const dateStr = formatApprovalDate(a.ngay_yeu_cau || new Date());
  const status = statusMap[a.trang_thai] || "pending";
  const rejectReason = a.ly_do_tu_choi || (status === "rejected" ? a.ghi_chu : "") || "";
  const noteParts = splitApprovalNote(a.ghi_chu || "");
  return {
    id: String(a.id),
    _dbId: a.id,           // id số nguyên thật từ DB
    form: a.ten_form || "",
    by: a.nguoi_gui || "",
    date: dateStr,
    status,
    cat: a.danh_muc || "Khác",
    priority: priorityMap[a.do_uu_tien] || "medium",
    note: status === "approved" ? "" : status === "rejected" ? rejectReason : noteParts.note,
    urgent_reason: noteParts.urgentReason,
    reject_reason: rejectReason,
    approval_deadline: a.han_chot_duyet || "",
    form_id: a.form_id || null,
    requested_at: a.ngay_yeu_cau || null,
    processed_at: a.ngay_xu_ly || null,
    processedDate: formatApprovalDateTime(a.ngay_xu_ly),
    questions: [],
  };
}

function saveApprovals(list) {
  try {
    localStorage.setItem(LS_APPROVALS, JSON.stringify(list));
  } catch (e) { }
}

function loadLocalApprovals() {
  try {
    const raw = localStorage.getItem(LS_APPROVALS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function loadLocalNotifications() {
  try {
    const raw = localStorage.getItem(LS_NOTIFS);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function loadTrashForms() {
  try {
    const raw = localStorage.getItem(LS_TRASH_FORMS);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function loadHiddenApprovalForms() {
  try {
    const raw = localStorage.getItem(LS_HIDDEN_APPROVAL_FORMS);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveHiddenApprovalForms(list) {
  try {
    localStorage.setItem(LS_HIDDEN_APPROVAL_FORMS, JSON.stringify(list));
  } catch (e) { }
}

function normalizeApprovalFormName(value) {
  return String(value || "").trim().toLowerCase();
}

function isApprovalFormHidden(item) {
  const hiddenForms = loadHiddenApprovalForms();
  if (!hiddenForms.length) return false;

  const approvalId = String(item?.form_id ?? item?._dbId ?? item?.id ?? "");
  const approvalName = normalizeApprovalFormName(item?.form);

  return hiddenForms.some((form) => {
    const hiddenId = String(form?.id ?? "");
    const hiddenName = normalizeApprovalFormName(form?.name);
    return (
      (hiddenId && hiddenId === approvalId) ||
      (!approvalId && hiddenName && hiddenName === approvalName)
    );
  });
}

function hideApprovalFormItem(item) {
  const hiddenForms = loadHiddenApprovalForms();
  const formId = String(item?.form_id ?? item?._dbId ?? item?.id ?? "");
  const formName = String(item?.form ?? "").trim();
  const alreadyExists = hiddenForms.some((form) => {
    const hiddenId = String(form?.id ?? "");
    const hiddenName = normalizeApprovalFormName(form?.name);
    return (
      (formId && hiddenId === formId) ||
      (formName && hiddenName === normalizeApprovalFormName(formName))
    );
  });
  if (alreadyExists) return;

  hiddenForms.unshift({ id: formId, name: formName });
  saveHiddenApprovalForms(hiddenForms);
}

function isApprovalFormInTrash(item) {
  const trashForms = loadTrashForms();
  if (!trashForms.length) return false;

  return trashForms.some((form) => {
    const trashId = String(form?.id ?? "");
    const trashName = normalizeApprovalFormName(form?.name);
    const approvalName = normalizeApprovalFormName(item?.form);
    if (!trashId) return false;

    return (
      trashId === String(item?.form_id ?? "") ||
      trashId === String(item?._dbId ?? "") ||
      trashId === String(item?.id ?? "") ||
      (!(item?.form_id || item?._dbId || item?.id) && trashName && trashName === approvalName)
    );
  });
}

function removeApprovalsOfTrashedForms(list) {
  return (Array.isArray(list) ? list : []).filter(
    (item) => !isApprovalFormInTrash(item) && !isApprovalFormHidden(item)
  );
}

function mergeApprovalNotesFromCache(mappedList, cachedList) {
  const cachedById = new Map();
  (Array.isArray(cachedList) ? cachedList : []).forEach((item) => {
    cachedById.set(String(item._dbId || item.id), item);
    if (item.form_id) cachedById.set(`form:${item.form_id}`, item);
  });

  const notifs = loadLocalNotifications();

  return mappedList.map((item) => {
    const cached = cachedById.get(String(item._dbId || item.id)) || cachedById.get(`form:${item.form_id}`);
    if (item.note || item.reject_reason) return item;

    const cachedReason = cached ? (cached.reject_reason || cached.note || "") : "";
    if (item.status === "rejected" && cachedReason) {
      return { ...item, note: cachedReason, reject_reason: cachedReason };
    }
    if (item.status === "rejected") {
      const relatedNotif = notifs.find((notif) => {
        const msg = String(notif.msg || notif.noi_dung || "");
        return msg.includes(`"${item.form}"`) && msg.includes("Lý do:");
      });
      const notifReason = String(relatedNotif?.msg || relatedNotif?.noi_dung || "")
        .split("Lý do:")
        .slice(1)
        .join("Lý do:")
        .trim();
      if (notifReason) return { ...item, note: notifReason, reject_reason: notifReason };
    }
    return item;
  });
}

function removeApprovalById(id) {
  approvalData = approvalData.filter((a) => String(a.id) !== String(id));
  saveApprovals(approvalData);
}

function trashApprovalItem(id) {
  const item = approvalData.find((a) => String(a.id) === String(id));
  if (!item) return;
  if (!confirm(`Ẩn biểu mẫu "${item.form}" khỏi Quản lý phê duyệt?`)) return;

  hideApprovalFormItem(item);
  removeApprovalById(id);
  renderApproval(currentApprovalTab);
  showToast(`Đã ẩn "${item.form}" khỏi Quản lý phê duyệt`, "success");
}

async function loadApprovalsFromAPI() {
  try {
    const res = await fetch(API_APPROVALS, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const mapped = removeApprovalsOfTrashedForms(
      mergeApprovalNotesFromCache(data.map(mapDbApproval), loadLocalApprovals())
    );
    approvalData = mapped;
    saveApprovals(mapped);   // đồng bộ cache local
    return mapped;
  } catch (e) {
    console.warn("Không lấy được dữ liệu từ API, dùng localStorage:", e.message);
    approvalData = removeApprovalsOfTrashedForms(loadLocalApprovals());
    return approvalData;
  }
}

let approvalData = removeApprovalsOfTrashedForms(loadLocalApprovals());   // hiển thị ngay từ cache
let currentApprovalTab = "all";
let currentApprovalPage = 1;
const APPROVAL_PAGE_SIZE = 10;

// ── Helpers ───────────────────────────────────────────────────────
const priorityBadge = (p) =>
  p === "high"
    ? '<span class="badge badge-red">Cao</span>'
    : p === "medium"
      ? '<span class="badge badge-yellow">Trung bình</span>'
      : '<span class="badge badge-gray">Thấp</span>';

const apprStatusBadge = (s, item = null) =>
  s === "pending"
    ? isUrgentApproval(item)
      ? '<span class="badge badge-red">Chờ duyệt</span>'
      : '<span class="badge badge-yellow">Chờ duyệt</span>'
    : s === "approved"
      ? '<span class="badge badge-green">Đã duyệt</span>'
      : '<span class="badge badge-red">Từ chối</span>';

const typeLabel = (t) =>
  t === "choice" ? "Lựa chọn" : t === "rating" ? "Đánh giá" : "Văn bản";

const typeBadgeColor = (t) =>
  t === "rating" ? "#f59e0b" : t === "text" ? "#8b5cf6" : "#00008B";

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeJsString(str = "") {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function getApprovalNote(a) {
  if (a.status === "approved") return "";
  if (a.status === "rejected") return a.reject_reason || a.note || "";
  if (isUrgentApproval(a)) return a.urgent_reason || splitApprovalNote(a.note).urgentReason || "";
  return a.note || "";
}

function renderApprovalNote(a) {
  const note = getApprovalNote(a);
  return note ? escapeHtml(note) : '<span style="color:var(--gray-300)">-</span>';
}

function isUrgentApproval(a) {
  return a?.status === "pending" && (a.priority === "high" || a.priority === "urgent");
}

function getApprovalDeadlineDate(a) {
  return parseApprovalDate(a?.approval_deadline || a?.deadline || a?.han_chot_duyet || "");
}

function renderApprovalDeadline(a) {
  const deadline = getApprovalDeadlineDate(a);
  if (!deadline) {
    return isUrgentApproval(a)
      ? '<span style="color:#b45309;font-weight:600">Chưa đặt hạn</span>'
      : '<span style="color:var(--gray-300)">-</span>';
  }

  const now = new Date();
  const isPast = deadline < now;
  const isToday = deadline.toDateString() === now.toDateString();
  const color = isPast ? "#dc2626" : isUrgentApproval(a) ? "#df2f0b" : "var(--gray-600)";
  const bg = isPast ? "#fef2f2" : isUrgentApproval(a) ? "#fff7ed" : "#f8fafc";
  const label = isPast ? "Quá hạn" : isToday ? "Hôm nay" : "Hạn chót";

  return `
    <div style="display:inline-flex;flex-direction:column;gap:3px;min-width:126px">
      <span style="display:inline-flex;align-items:center;width:max-content;padding:4px 8px;border-radius:8px;background:${bg};color:${color};font-size:12px;font-weight:700">${label}</span>
      <span style="font-size:12px;color:var(--gray-600);white-space:nowrap">${escapeHtml(formatApprovalDateTime(deadline))}</span>
    </div>
  `;
}

function getApprovalSortRank(a) {
  if (isUrgentApproval(a)) return 0;
  if (a.status === "pending") return 1;
  if (a.status === "rejected") return 2;
  if (a.status === "approved") return 3;
  return 4;
}

function sortApprovalsForReview(list) {
  return [...list].sort((a, b) => {
    const rankDiff = getApprovalSortRank(a) - getApprovalSortRank(b);
    if (rankDiff) return rankDiff;

    const deadlineA = getApprovalDeadlineDate(a)?.getTime() || Number.POSITIVE_INFINITY;
    const deadlineB = getApprovalDeadlineDate(b)?.getTime() || Number.POSITIVE_INFINITY;
    if (deadlineA !== deadlineB) return deadlineA - deadlineB;

    const requestedA = parseApprovalDate(a.requested_at || a.date)?.getTime() || 0;
    const requestedB = parseApprovalDate(b.requested_at || b.date)?.getTime() || 0;
    return requestedB - requestedA;
  });
}

function getFilteredApprovals(tab = "all") {
  let list = [...approvalData];

  if (tab !== "all") {
    list = list.filter((a) => a.status === tab);
  }

  const searchInput = document.getElementById("approval-search");
  const keyword = (searchInput?.value || "").trim().toLowerCase();

  if (keyword) {
    list = list.filter((a) => {
      return (
        String(a.form).toLowerCase().includes(keyword) ||
        String(a.by).toLowerCase().includes(keyword) ||
        String(a.cat).toLowerCase().includes(keyword)
      );
    });
  }

  return sortApprovalsForReview(list);
}


function renderApproval(tab = "all", resetPage = false) {
  if (tab !== currentApprovalTab || resetPage) {
    currentApprovalPage = 1;
  }
  currentApprovalTab = tab;

  const list = getFilteredApprovals(tab);
  const totalPages = Math.max(1, Math.ceil(list.length / APPROVAL_PAGE_SIZE));
  currentApprovalPage = Math.min(Math.max(currentApprovalPage, 1), totalPages);
  const startIdx = (currentApprovalPage - 1) * APPROVAL_PAGE_SIZE;
  const currentList = list.slice(startIdx, startIdx + APPROVAL_PAGE_SIZE);
  const tbody = document.getElementById("approval-tbody");
  if (!tbody) return;

  tbody.innerHTML =
    list.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--gray-400)">Không có dữ liệu</td></tr>`
      : currentList
        .map(
          (a) => `
      <tr>
        <td>
          <div style="font-weight:500;color:var(--gray-900)">${escapeHtml(a.form)}</div>
          <div style="font-size:12px;color:var(--gray-400)">${escapeHtml(a.cat)}</div>
        </td>
        <td style="min-width:170px;white-space:nowrap">${escapeHtml(a.by)}</td>
        <td style="font-size:12px;color:var(--gray-500)">${escapeHtml(getApprovalDisplayDate(a))}</td>
        <td style="font-size:12px;color:var(--gray-500);min-width:150px">${renderApprovalDeadline(a)}</td>
        <td>${apprStatusBadge(a.status, a)}</td>
        <td style="font-size:12.5px;color:var(--gray-500);max-width:180px">${renderApprovalNote(a)}</td>
        <td style="min-width:210px">${renderApprovalActions(a)}</td>
      </tr>
    `
        )
        .join("");

  updateTabCounts();
  updateStats();
  updateActiveTabButton();
  updateApprovalPagination(list.length, totalPages);
  syncApprovalToolbar();
}

function updateApprovalPagination(totalItems, totalPages) {
  const pagination = document.getElementById("approval-pagination");
  const pageInfo = document.getElementById("approval-page-info");
  const pageButtons = document.getElementById("approval-page-buttons");
  if (!pagination || !pageInfo || !pageButtons) return;

  pagination.style.display = totalItems > APPROVAL_PAGE_SIZE ? "flex" : "none";
  if (totalItems <= APPROVAL_PAGE_SIZE) return;

  const start = (currentApprovalPage - 1) * APPROVAL_PAGE_SIZE + 1;
  const end = Math.min(start + APPROVAL_PAGE_SIZE - 1, totalItems);
  pageInfo.textContent = `Hiển thị ${start}-${end} / ${totalItems} yêu cầu`;

  let buttons = `
    <button class="pag-btn" onclick="changeApprovalPage(${currentApprovalPage - 1})" ${currentApprovalPage === 1 ? "disabled" : ""}>Trước</button>
  `;

  for (let page = 1; page <= totalPages; page += 1) {
    buttons += `
      <button class="pag-btn ${page === currentApprovalPage ? "active" : ""}" onclick="changeApprovalPage(${page})">${page}</button>
    `;
  }

  buttons += `
    <button class="pag-btn" onclick="changeApprovalPage(${currentApprovalPage + 1})" ${currentApprovalPage === totalPages ? "disabled" : ""}>Sau</button>
  `;

  pageButtons.innerHTML = buttons;
}

function changeApprovalPage(page) {
  currentApprovalPage = page;
  renderApproval(currentApprovalTab);
  document.getElementById("approval-tbody")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateActiveTabButton() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.tab === currentApprovalTab) {
      btn.classList.add("active");
    }
  });
}

function updateTabCounts() {
  const pending = approvalData.filter((a) => a.status === "pending").length;
  const approved = approvalData.filter((a) => a.status === "approved").length;
  const rejected = approvalData.filter((a) => a.status === "rejected").length;
  const counts = { pending, approved, rejected };
  Object.entries(counts).forEach(([tab, count]) => {
    const el = document.querySelector(`.tab-btn[data-tab="${tab}"] .badge`);
    if (el) el.textContent = count;
  });
}

function updateStats() {
  const pending = approvalData.filter((a) => a.status === "pending").length;
  const approved = approvalData.filter((a) => a.status === "approved").length;
  const rejected = approvalData.filter((a) => a.status === "rejected").length;
  const total = approvalData.length;

  const pendingEl = document.getElementById("stat-pending");
  const approvedEl = document.getElementById("stat-approved");
  const rejectedEl = document.getElementById("stat-rejected");
  const totalEl = document.getElementById("stat-total");

  if (pendingEl) pendingEl.textContent = pending;
  if (approvedEl) approvedEl.textContent = approved;
  if (rejectedEl) rejectedEl.textContent = rejected;
  if (totalEl) totalEl.textContent = total;
}

function approveItem(id) {
  if (!canApproveNow()) {
    showToast("Bạn không có quyền phê duyệt", "error");
    return;
  }

  const item = approvalData.find((a) => a.id === id);
  if (!item) return;

  // Điền thông tin vào modal xác nhận duyệt
  document.getElementById("approve-modal-form-name").textContent = item.form || "";
  document.getElementById("approve-modal-sender").textContent = "Người gửi: " + (item.by || "");
  document.getElementById("approve-modal-cat").textContent = item.cat || "";
  document.getElementById("approve-modal-priority").innerHTML = priorityBadge(item.priority);
  document.getElementById("approve-modal").dataset.pendingId = id;

  openModal("approve-modal");
}

async function confirmApprove() {
  if (!canApproveNow()) {
    showToast("Bạn không có quyền phê duyệt", "error");
    return;
  }

  const id = document.getElementById("approve-modal").dataset.pendingId;
  const item = approvalData.find((a) => a.id === id);
  if (!item) return;

  const btn = document.getElementById("approve-confirm-btn");
  const btnOriginal = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20 6L9 17l-5-5"/></svg> Xác nhận phê duyệt`;
  btn.disabled = true;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0"/></svg> Đang xử lý...`;

  // Bắt buộc gọi API — dùng _dbId nếu có, fallback sang id
  const dbId = item._dbId || Number(id);
  let updatedApproval = null;
  try {
    const res = await fetch(`${API_APPROVALS}/${dbId}/approve`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 404) {
        removeApprovalById(id);
        closeModal("approve-modal");
        renderApproval(currentApprovalTab);
      }
      showToast(data.message || "Lỗi khi phê duyệt", "error");
      btn.disabled = false;
      btn.innerHTML = btnOriginal;
      return;
    }
    updatedApproval = data.approval || null;
  } catch (e) {
    showToast("⚠️ Không kết nối được server. Kiểm tra lại backend!", "error");
    btn.disabled = false;
    btn.innerHTML = btnOriginal;
    return;
  }

  // ✅ DB đã lưu → cập nhật cache local
  item.status = "approved";
  item.note = "";
  item.reject_reason = "";
  item.urgent_reason = "";
  item.processed_at = updatedApproval?.ngay_xu_ly || item.processed_at || null;
  item.processedDate = formatApprovalDateTime(item.processed_at) || item.date;
  saveApprovals(approvalData);

  // Gửi thông báo tự động đến người tạo biểu mẫu
  sendApproveNotification(item);
  if (typeof window.logActivity === 'function') {
    window.logActivity('approve', item.form_id || id, item.form || '', 'Chuyển từ trạng thái chờ duyệt sang trạng thái phê duyệt');
  }
  closeModal("approve-modal");
  renderApproval(currentApprovalTab);
  showToast(`Đã duyệt biểu mẫu "${item.form}"`, "success");
  showToast("✅ Đã phê duyệt và lưu vào database!", "success");

  btn.disabled = false;
  btn.innerHTML = btnOriginal;
}

async function sendApproveNotification(item) {
  try {
    const body = {
      tieu_de: "Yêu cầu tạo biểu mẫu đã được phê duyệt",
      noi_dung: `Yêu cầu "${item.form}" của bạn đã được phê duyệt. Biểu mẫu đã được xuất bản và có thể sử dụng ngay lập tức.`,
      loai: "success",
      nguoi_nhan: item.by || "Người gửi",
      trang_thai: "sent",
      tong_nguoi_nhan: 1
    };

    const res = await fetch(`${API_BASE}/notifications`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      console.error("Không thể gửi thông báo phê duyệt qua API", await res.text());
    } else {
      // Trigger header bell update if possible
      if (typeof fetchUnreadNotifications === 'function') {
        fetchUnreadNotifications();
      }
    }
  } catch (e) {
    console.error("Lỗi khi gửi thông báo phê duyệt:", e);
  }
}

function rejectItem(id) {
  if (!canApproveNow()) {
    showToast("Bạn không có quyền từ chối yêu cầu", "error");
    return;
  }

  const item = approvalData.find((a) => a.id === id);
  if (!item) return;

  // Hiển thị thông tin biểu mẫu trong modal
  document.getElementById("reject-modal-form-name").textContent = item.form || "";
  document.getElementById("reject-modal-sender").textContent = "Người gửi: " + (item.by || "");
  document.getElementById("reject-modal-cat").textContent = item.cat || "";
  document.getElementById("reject-modal-priority").innerHTML = priorityBadge(item.priority);
  document.getElementById("reject-reason").value = "";
  document.getElementById("reject-reason-error").style.display = "none";

  // Lưu id để dùng khi xác nhận
  document.getElementById("reject-modal").dataset.pendingId = id;

  openModal("reject-modal");
}

async function confirmReject() {
  if (!canApproveNow()) {
    showToast("Bạn không có quyền từ chối yêu cầu", "error");
    return;
  }

  const id = document.getElementById("reject-modal").dataset.pendingId;
  const reasonText = document.getElementById("reject-reason").value.trim();

  if (!reasonText) {
    document.getElementById("reject-reason-error").style.display = "flex";
    document.getElementById("reject-reason").focus();
    return;
  }

  const item = approvalData.find((a) => a.id === id);
  if (!item) return;

  // Disable nút tránh bấm 2 lần
  const btn = document.getElementById("reject-confirm-btn");
  const btnOriginal = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0"/></svg> Đang xử lý...`;
  }

  // Bắt buộc gọi API — dùng _dbId nếu có, fallback sang id
  const dbId = item._dbId || Number(id);
  let updatedApproval = null;
  try {
    const res = await fetch(`${API_APPROVALS}/${dbId}/reject`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ ghi_chu: reasonText, ly_do_tu_choi: reasonText }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 404) {
        removeApprovalById(id);
        closeModal("reject-modal");
        renderApproval(currentApprovalTab);
      }
      showToast(data.message || "Lỗi khi từ chối yêu cầu", "error");
      if (btn) { btn.disabled = false; btn.innerHTML = btnOriginal; }
      return;
    }
    updatedApproval = data.approval || null;
  } catch (e) {
    showToast("⚠️ Không kết nối được server. Kiểm tra lại backend!", "error");
    if (btn) { btn.disabled = false; btn.innerHTML = btnOriginal; }
    return;
  }

  // ✅ DB đã lưu → cập nhật cache local
  item.status = "rejected";
  item.reject_reason = reasonText;
  item.note = reasonText;
  item.processed_at = updatedApproval?.ngay_xu_ly || item.processed_at || null;
  item.processedDate = formatApprovalDateTime(item.processed_at) || item.date;
  saveApprovals(approvalData);

  // Gửi thông báo tự động đến người tạo biểu mẫu
  sendRejectNotification(item, reasonText);
  if (typeof window.logActivity === 'function') {
    window.logActivity('reject', item.form_id || id, item.form || '', `Chuyển từ trạng thái chờ duyệt sang trạng thái từ chối (Lý do: ${reasonText})`);
  }
  closeModal("reject-modal");
  renderApproval(currentApprovalTab);
  showToast(`Đã từ chối biểu mẫu "${item.form}"`, "error");
  if (btn) { btn.disabled = false; btn.innerHTML = btnOriginal; }
}

async function sendRejectNotification(item, reason) {
  try {
    const body = {
      tieu_de: "Yêu cầu tạo biểu mẫu bị từ chối",
      noi_dung: `Yêu cầu "${item.form}" của bạn đã bị từ chối.\nLý do: ${reason}`,
      loai: "error",
      nguoi_nhan: item.by || "Người gửi",
      trang_thai: "sent",
      tong_nguoi_nhan: 1
    };

    const res = await fetch(`${API_BASE}/notifications`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      console.error("Không thể gửi thông báo từ chối qua API", await res.text());
    } else {
      // Trigger header bell update if possible
      if (typeof fetchUnreadNotifications === 'function') {
        fetchUnreadNotifications();
      }
    }
  } catch (e) {
    console.error("Lỗi khi gửi thông báo từ chối:", e);
  }
}



// ── View questions modal ──────────────────────────────────────────
function aprvNormType(t) {
  if (t === 'text' || t === 'short_text' || t === 'long_text') return 'paragraph';
  if (t === 'star_rating') return 'rating';
  return t || 'choice';
}
function aprvTypeLabel(t) {
  const n = aprvNormType(t);
  const map = { choice: 'Trắc nghiệm', checkbox: 'Hộp kiểm', dropdown: 'Thả xuống', paragraph: 'Đoạn văn', rating: 'Xếp hạng', scale: 'Tuyến tính', grid_radio: 'Lưới trắc nghiệm', grid_checkbox: 'Lưới hộp kiểm' };
  return map[n] || t || 'Khác';
}
function aprvEsc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function aprvRenderOpts(opts, kind) {
  return `<div style="display:flex;flex-direction:column;gap:0">
    ${opts.map(o => `<label style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#374151;cursor:default">
      <span style="width:16px;height:16px;border:1.8px solid #9ca3af;border-radius:${kind === 'checkbox' ? '4px' : '50%'};display:inline-block;flex-shrink:0;background:#fff"></span>
      ${aprvEsc(o)}
    </label>`).join('')}
  </div>`;
}
function aprvRenderQuestion(q, idx) {
  const n = aprvNormType(q.type);
  const opts = Array.isArray(q.opts) ? q.opts : [];
  let answerHtml = '';
  if (n === 'paragraph') {
    answerHtml = `<textarea disabled rows="3" placeholder="Nhập câu trả lời..." style="width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#94a3b8;background:#f8fafc;resize:none;outline:none;box-sizing:border-box;margin-top:10px"></textarea>`;
  } else if (n === 'dropdown') {
    answerHtml = `<select disabled style="margin-top:10px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#64748b;background:#f8fafc;outline:none;min-width:220px">
      <option>Chọn một mục...</option>${opts.map(o => `<option>${aprvEsc(o)}</option>`).join('')}
    </select>`;
  } else if (opts.length) {
    const kind = n === 'checkbox' ? 'checkbox' : 'radio';
    answerHtml = `<div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff">${aprvRenderOpts(opts, kind)}</div>`;
  }
  return `<div style="border:1px solid #00008B;border-radius:18px;padding:18px 20px;background:rgba(255,255,255,.95);box-shadow:0 6px 18px rgba(0,0,139,.07)">
    <div style="display:flex;align-items:flex-start;gap:12px">
      <div style="width:34px;height:34px;border-radius:50%;background:#00008B;color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">${idx + 1}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <span style="padding:5px 10px;border-radius:999px;background:#00008B;color:#fff;font-size:11.5px;font-weight:700">${aprvTypeLabel(q.type)}</span>
          ${q.required ? '<span style="padding:5px 10px;border-radius:999px;background:#fee2e2;color:#dc2626;font-size:11.5px;font-weight:700">Bắt buộc</span>' : '<span style="padding:5px 10px;border-radius:999px;background:#f8fafc;color:#64748b;font-size:11.5px;font-weight:700">Không bắt buộc</span>'}
        </div>
        <div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:2px;line-height:1.4">${aprvEsc(q.text)}</div>
        ${answerHtml}
      </div>
    </div>
  </div>`;
}

async function openViewModal(id) {
  const item = approvalData.find((a) => a.id === id);
  if (!item) return;

  document.getElementById("view-modal-title").textContent = item.form;
  document.getElementById("view-modal-cat").textContent = item.cat + " · đang tải...";
  document.getElementById("view-modal-questions").innerHTML =
    '<div style="text-align:center;padding:40px;color:#94a3b8">Đang tải câu hỏi...</div>';
  openModal("view-modal");

  let qs = item.questions || [];
  const formId = item.form_id;
  if (formId) {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE}/forms/${formId}`, {
        headers: token ? { Authorization: 'Bearer ' + token } : {}
      });
      if (res.ok) {
        const data = await res.json();
        qs = (data.cau_hoi || []).map(q => ({
          text: q.noi_dung,
          type: q.loai,
          required: q.bat_buoc,
          opts: (q.lua_chon || []).map(o => typeof o === 'string' ? o : (o.noi_dung || '')),
        }));
      }
    } catch (e) { console.warn('Không load được câu hỏi:', e); }
  }

  document.getElementById("view-modal-cat").textContent = `${item.cat} · ${qs.length} câu hỏi`;

  const container = document.getElementById("view-modal-questions");
  if (!qs.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Không có câu hỏi nào</div>';
    return;
  }

  container.innerHTML = `
    <div style="background:linear-gradient(135deg,#00008B 0%,#00008B 52%,#00008B 100%);border-radius:20px;padding:22px 24px;margin-bottom:18px;color:#00008B;box-shadow:0 16px 36px rgba(0,0,139,.13)">
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <span style="font-size:12px;background:rgba(255,255,255,.55);padding:5px 12px;border-radius:999px;font-weight:700">${aprvEsc(item.cat)}</span>
        <span style="font-size:12px;background:rgba(255,255,255,.55);padding:5px 12px;border-radius:999px;font-weight:700">Tổng ${qs.length} câu hỏi</span>
      </div>
      <div style="font-size:30px;font-weight:800;line-height:1.1;letter-spacing:-0.01em">${aprvEsc(item.form)}</div>
      ${item.ngay_tao ? `<div style="font-size:13px;margin-top:8px;opacity:.85">Ngày tạo: <strong>${new Date(item.ngay_tao).toLocaleDateString('vi-VN')}</strong></div>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${qs.map((q, i) => aprvRenderQuestion(q, i)).join('')}
    </div>
    <div style="padding:20px 0 4px;text-align:center">
      <button disabled style="padding:11px 32px;background:#00008B;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:not-allowed;opacity:.75">Gửi phản hồi</button>
    </div>`;
}

// ── Share modal ───────────────────────────────────────────────────
const SHARE_LINK = `${API_BASE}/forms/`;


// Link ngắn hơn cho QR (bỏ prefill để QR không quá dày)
function buildShortFormLink(formId) {
  const url = new URL('../pages/form-builder.html', window.location.href);
  url.searchParams.set('form_id', formId);
  return url.toString();
}

// ── Share state ───────────────────────────────────────────────
let _shareFormId = null;
let _shareDbFormId = null;
let _shareFormName = null;
let _pendingEmails = [];   // danh sách email sẽ gửi

async function openShareModal(id, formName) {
  if (!canShareFormNow()) {
    showToast("Bạn không có quyền chia sẻ biểu mẫu này", "error");
    return;
  }

  const item = approvalData.find(a => a.id === id);
  _shareFormId = id;
  _shareDbFormId = item ? item.form_id : null;
  _shareFormName = formName || "";
  _pendingEmails = [];

  const link = _shareDbFormId
    ? buildPublicFormLink(_shareDbFormId)
    : buildPublicFormLink(id);

  document.getElementById("share-form-name").textContent = formName || "";
  document.getElementById("share-link-input").value = link;
  document.getElementById("share-copied-msg").style.display = "none";
  document.getElementById("share-email-inp").value = "";
  document.getElementById("share-email-tags").innerHTML = "";
  document.getElementById("share-send-status").style.display = "none";

  // Reset QR panel
  const qrArea = document.getElementById("qr-code-area");
  const chevron = document.getElementById("qr-chevron");
  if (qrArea) qrArea.style.display = "none";
  if (chevron) chevron.style.transform = "";

  openModal("share-modal");
}

// ─── QR CODE ───
function toggleShareQR() {
  const area = document.getElementById("qr-code-area");
  const chevron = document.getElementById("qr-chevron");
  if (!area) return;
  const isOpen = area.style.display !== "none";
  if (isOpen) {
    area.style.display = "none";
    if (chevron) chevron.style.transform = "";
  } else {
    area.style.display = "block";
    if (chevron) chevron.style.transform = "rotate(180deg)";
    // Dùng link ngắn (không có prefill) để QR thưa, dễ quét
    const shortLink = _shareDbFormId ? buildShortFormLink(_shareDbFormId) : buildShortFormLink(_shareFormId);
    generateQRCode(shortLink);
  }
}

function generateQRCode(text) {
  const canvas = document.getElementById("qr-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const size = 180;
  canvas.width = size; canvas.height = size;

  // Dùng thư viện QRCode nếu đã load, nếu không thì load rồi vẽ
  if (window.QRCode) {
    _drawQR(text, canvas, size);
    return;
  }
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
  script.onload = () => _drawQR(text, canvas, size);
  script.onerror = () => {
    // Fallback: vẽ placeholder nếu không load được thư viện
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Không tải được QR", size / 2, size / 2);
  };
  document.head.appendChild(script);
}

function _drawQR(text, canvas, size) {
  // Dùng QRCode.js render vào div tạm, lấy canvas
  const tmp = document.createElement("div");
  tmp.style.display = "none";
  document.body.appendChild(tmp);
  try {
    const qr = new QRCode(tmp, {
      text: text,
      width: size,
      height: size,
      colorDark: "#1e293b",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.L
    });
    // Sau khi render xong, copy sang canvas chính
    setTimeout(() => {
      const srcCanvas = tmp.querySelector("canvas");
      const srcImg = tmp.querySelector("img");
      const ctx = canvas.getContext("2d");
      if (srcCanvas) {
        ctx.drawImage(srcCanvas, 0, 0, size, size);
      } else if (srcImg) {
        srcImg.onload = () => ctx.drawImage(srcImg, 0, 0, size, size);
      }
      document.body.removeChild(tmp);
    }, 100);
  } catch (e) {
    document.body.removeChild(tmp);
  }
}

function downloadQR() {
  const canvas = document.getElementById("qr-canvas");
  if (!canvas) return;
  const name = (_shareFormName || "form").replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const a = document.createElement("a");
  a.download = "qr_" + name + ".png";
  a.href = canvas.toDataURL("image/png");
  a.click();
}

// Thêm email vào danh sách chờ gửi
function addShareEmail() {
  const inp = document.getElementById("share-email-inp");
  const raw = (inp.value || "").trim();
  if (!raw) return;

  // Hỗ trợ nhập nhiều email cách nhau bằng dấu phẩy hoặc dấu cách
  const list = raw.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  list.forEach(email => {
    if (!emailRegex.test(email)) {
      showToast(email + ' không phải email hợp lệ', 'error'); return;
    }
    if (_pendingEmails.includes(email)) return;
    _pendingEmails.push(email);
  });

  inp.value = "";
  _renderEmailTags();
}

function _renderEmailTags() {
  const tags = document.getElementById("share-email-tags");
  if (!tags) return;
  tags.innerHTML = _pendingEmails.map((e, i) => `
    <span style="display:inline-flex;align-items:center;gap:6px;background:#00008B;
                 border:1px solid #00008B;border-radius:20px;padding:4px 12px;font-size:13px;color:#00008B">
      ${e}
      <button onclick="_removeEmail(${i})" style="border:none;background:none;cursor:pointer;color:#00008B;padding:0;line-height:1;font-size:15px;display:flex;align-items:center"
        onmouseenter="this.style.color='#00008B'" onmouseleave="this.style.color='#00008B'">×</button>
    </span>`).join('');
}

function _removeEmail(idx) {
  _pendingEmails.splice(idx, 1);
  _renderEmailTags();
}

// Gửi email thật qua API
async function sendShareEmails() {
  if (_pendingEmails.length === 0) {
    showToast('Vui lòng thêm ít nhất một email!', 'error'); return;
  }

  const btn = document.getElementById("share-send-btn");
  const statusEl = document.getElementById("share-send-status");
  btn.disabled = true;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-dasharray="28" stroke-dashoffset="10"/></svg> Đang gửi...';

  const me = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token') || '';

  try {
    const res = await fetch(`${API_BASE}/share/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify({
        emails: _pendingEmails,
        form_id: _shareDbFormId,
        form_name: _shareFormName,
        sender_name: me.ho_ten || 'Quản trị viên',
      }),
    });

    const data = await res.json();

    if (res.ok) {
      const ok = (data.results || []).filter(r => r.success);
      const fail = (data.results || []).filter(r => !r.success);
      statusEl.style.display = 'block';
      statusEl.style.background = fail.length ? '#fffbeb' : '#f0fdf4';
      statusEl.style.border = '1px solid ' + (fail.length ? '#fde68a' : '#bbf7d0');
      statusEl.style.color = fail.length ? '#92400e' : '#166534';
      statusEl.innerHTML = `✅ Đã gửi thành công <strong>${ok.length}</strong> email.`
        + (fail.length ? `<br>❌ Thất bại: ${fail.map(f => f.email).join(', ')}` : '');
      _pendingEmails = fail.map(f => f.email);
      _renderEmailTags();
      if (!fail.length) showToast('Đã gửi link biểu mẫu cho khách hàng ✅', 'success');
    } else {
      statusEl.style.display = 'block';
      statusEl.style.background = '#fef2f2';
      statusEl.style.border = '1px solid #fecaca';
      statusEl.style.color = '#991b1b';
      statusEl.innerHTML = '❌ ' + (data.message || 'Gửi thất bại');
      showToast(data.message || 'Gửi email thất bại', 'error');
    }
  } catch (e) {
    statusEl.style.display = 'block';
    statusEl.style.background = '#fef2f2';
    statusEl.style.border = '1px solid #fecaca';
    statusEl.style.color = '#991b1b';
    statusEl.innerHTML = '❌ Không kết nối được server. Hãy sao chép link và gửi tay.';
  }

  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Gửi email';
}

function saveShareAndClose() {
  closeModal('share-modal');
}

async function _approvalDoShorten(url) {
  try {
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
    if (res.ok) { const s = await res.text(); if (s && s.startsWith('http')) return s.trim(); }
  } catch (e) { }
  try {
    const res2 = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
    if (res2.ok) { const s2 = await res2.text(); if (s2 && s2.startsWith('http')) return s2.trim(); }
  } catch (e) { }
  return null;
}

async function approvalShortenLink() {
  const url = document.getElementById('share-link-input')?.value?.trim();
  if (!url) return;
  const btn = document.getElementById('apr-shorten-btn');
  if (btn) { btn.textContent = 'Đang rút gọn...'; btn.disabled = true; }
  const short = await _approvalDoShorten(url);
  if (btn) { btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> Rút gọn'; btn.disabled = false; }
  if (!short) { showToast('Không rút gọn được link!', 'error'); return; }
  const wrap = document.getElementById('apr-shortened-wrap');
  const input = document.getElementById('apr-shortened-input');
  if (wrap) wrap.style.display = 'block';
  if (input) input.value = short;
  showToast('Đã rút gọn link!', 'success');
}

async function aprCopyShortenedLink() {
  const val = document.getElementById('apr-shortened-input')?.value?.trim();
  if (!val) return;
  try { await navigator.clipboard.writeText(val); } catch (e) { document.getElementById('apr-shortened-input')?.select(); document.execCommand('copy'); }
  showToast('Đã sao chép link rút gọn!', 'success');
}

function copyShareLink() {
  if (!canShareFormNow()) {
    showToast("Bạn không có quyền sao chép liên kết chia sẻ", "error");
    return;
  }

  const input = document.getElementById("share-link-input");
  if (!input) return;

  navigator.clipboard
    .writeText(input.value)
    .then(() => {
      const copied = document.getElementById("share-copied-msg");
      if (copied) {
        copied.style.display = "flex";
        setTimeout(() => {
          copied.style.display = "none";
        }, 2500);
      }
      showToast("Đã sao chép!", "success");
    })
    .catch(() => {
      input.select();
      document.execCommand("copy");
      showToast("Đã sao chép!", "success");
    });
}

// ── Page HTML ─────────────────────────────────────────────────────
document.getElementById("page-content").innerHTML = `
  <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h2 class="page-title">Quản lý phê duyệt</h2>
      <p class="page-sub">Xem xét và phê duyệt các yêu cầu từ nhân viên</p>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
    </div>
  </div>

  <div class="grid-4" style="margin-bottom:24px">
    ${statCard(
  "Chờ phê duyệt",
  '<span id="stat-pending">0</span>',
  "#f59e0b",
  "#fef9c3",
  '<path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/>'
)}
    ${statCard(
  "Đã phê duyệt",
  '<span id="stat-approved">0</span>',
  "#10b981",
  "#dcfce7",
  '<path d="M20 6L9 17l-5-5"/>'
)}
    ${statCard(
  "Từ chối",
  '<span id="stat-rejected">0</span>',
  "#ef4444",
  "#fee2e2",
  '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
)}
    ${statCard(
  "Tổng yêu cầu",
  '<span id="stat-total">0</span>',
  "#1d4ed8",
  "#c7d2fe",
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
)}
  </div>

  <div class="card card-body" style="margin-bottom:20px">
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div class="input-wrap" style="flex:1;min-width:200px">
        <div class="input-icon">${IC.search}</div>
        <input
          type="text"
          id="approval-search"
          class="input"
          placeholder="Tìm kiếm yêu cầu..."
          oninput="renderApproval(currentApprovalTab, true)"
        >
      </div>
    </div>
  </div>

  <div data-tabs>
    <div class="tabs">
      <button class="tab-btn active" data-tab="all" onclick="renderApproval('all')">Tất cả</button>
      <button class="tab-btn" data-tab="pending" onclick="renderApproval('pending')">Chờ duyệt <span class="badge badge-yellow" style="margin-left:4px">0</span></button>
      <button class="tab-btn" data-tab="approved" onclick="renderApproval('approved')">Đã duyệt <span class="badge badge-green" style="margin-left:4px">0</span></button>
      <button class="tab-btn" data-tab="rejected" onclick="renderApproval('rejected')">Từ chối <span class="badge badge-red" style="margin-left:4px">0</span></button>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Biểu mẫu</th>
              <th style="min-width:170px;white-space:nowrap">Người gửi</th>
              <th>Ngày gửi</th>
              <th>Hạn chót</th>
              <th>Trạng thái</th>
              <th>Ghi chú</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody id="approval-tbody"></tbody>
        </table>
      </div>
    </div>

    <div id="approval-pagination" style="display:none;background:#fff;border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:12px 18px;align-items:center;justify-content:space-between;margin-top:16px;box-shadow:var(--shadow-sm);gap:12px;flex-wrap:wrap">
      <span id="approval-page-info" style="font-size:13px;color:var(--gray-500)">Hiển thị 1-10 / 10 yêu cầu</span>
      <div id="approval-page-buttons" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
        <button class="pag-btn" disabled>Trước</button>
        <button class="pag-btn active">1</button>
        <button class="pag-btn" disabled>Sau</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="view-modal" onclick="closeModal('view-modal')">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:720px;max-height:92vh;display:flex;flex-direction:column;padding:0;overflow:hidden;border-radius:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 22px;background:linear-gradient(135deg,#00008B,#00008B);border-bottom:1px solid #00008B;flex-shrink:0">
        <div style="min-width:0">
          <div style="font-size:16px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" id="view-modal-title"></div>
          <div style="font-size:12px;color:#64748b;margin-top:3px" id="view-modal-cat"></div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('view-modal')" style="flex-shrink:0;margin-left:12px;background:#00008B;border:1px solid #00008B;color:#fff">${IC.close}</button>
      </div>
      <div style="flex:1;overflow-y:auto;background:#f1f5f9;padding:20px 22px" id="view-modal-questions"></div>
      <div style="padding:14px 22px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;flex-shrink:0;background:#fff">
        <button class="btn btn-outline" onclick="closeModal('view-modal')">Đóng</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="approve-modal" onclick="closeModal('approve-modal')">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:520px">
      <div class="modal-header" style="border-bottom:1px solid var(--gray-100)">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" width="20" height="20">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div>
            <div class="modal-title" style="color:var(--gray-900)">Xác nhận phê duyệt</div>
            <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Bạn có chắc chắn muốn phê duyệt yêu cầu này?</div>
          </div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('approve-modal')">${IC.close}</button>
      </div>

      <div class="modal-body">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:16px;display:flex;align-items:flex-start;gap:12px">
          <div style="width:36px;height:36px;border-radius:8px;background:#dcfce7;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" width="18" height="18">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
            </svg>
          </div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--gray-900);margin-bottom:2px" id="approve-modal-form-name"></div>
            <div style="font-size:12px;color:var(--gray-500);margin-bottom:6px" id="approve-modal-sender"></div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:11.5px;background:#dcfce7;color:#16a34a;border-radius:4px;padding:2px 7px;font-weight:600" id="approve-modal-cat"></span>
              <span id="approve-modal-priority"></span>
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:flex-start;gap:10px;background:#00008B;border:1px solid #00008B;border-radius:var(--radius-lg);padding:12px 14px">
          <svg viewBox="0 0 24 24" fill="none" stroke="#00008B" stroke-width="2" width="16" height="16" style="flex-shrink:0;margin-top:1px">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style="font-size:13px;color:#00008B;line-height:1.5">Sau khi phê duyệt, biểu mẫu sẽ được xuất bản và có thể sử dụng ngay lập tức.</span>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('approve-modal')">Hủy</button>
        <button
          id="approve-confirm-btn"
          class="btn"
          style="background:#16a34a;color:#fff;display:flex;align-items:center;gap:6px"
          onclick="confirmApprove()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          Xác nhận phê duyệt
        </button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="reject-modal" onclick="closeModal('reject-modal')">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:520px">
      <div class="modal-header" style="border-bottom:1px solid var(--gray-100)">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;border-radius:50%;background:#fee2e2;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" width="20" height="20">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div>
            <div class="modal-title" style="color:var(--gray-900)">Từ chối yêu cầu</div>
            <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px">Vui lòng nhập lý do từ chối để gửi phản hồi cho người yêu cầu</div>
          </div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('reject-modal')">${IC.close}</button>
      </div>

      <div class="modal-body">
        <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:20px;display:flex;align-items:flex-start;gap:12px">
          <div style="width:36px;height:36px;border-radius:8px;background:#fee2e2;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" width="18" height="18">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
            </svg>
          </div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--gray-900);margin-bottom:2px" id="reject-modal-form-name"></div>
            <div style="font-size:12px;color:var(--gray-500);margin-bottom:6px" id="reject-modal-sender"></div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:11.5px;background:#fee2e2;color:#dc2626;border-radius:4px;padding:2px 7px;font-weight:600" id="reject-modal-cat"></span>
              <span id="reject-modal-priority"></span>
            </div>
          </div>
        </div>

        <div>
          <label class="form-label" style="margin-bottom:6px;font-weight:600">
            Lý do từ chối <span style="color:#dc2626">*</span>
          </label>
          <textarea
            id="reject-reason"
            class="input"
            rows="4"
            placeholder="Nhập lý do từ chối yêu cầu này..."
            style="resize:vertical;min-height:100px;font-family:inherit"
            oninput="document.getElementById('reject-reason-error').style.display='none'"
          ></textarea>
          <div id="reject-reason-error" style="display:none;align-items:center;gap:5px;margin-top:6px;font-size:12.5px;color:#dc2626">
            <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" width="13" height="13">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Vui lòng nhập lý do từ chối
          </div>
          <div style="display:flex;align-items:center;gap:5px;margin-top:8px;font-size:12px;color:var(--gray-400)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Lý do từ chối sẽ được gửi đến người tạo yêu cầu
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('reject-modal')">Hủy</button>
        <button
          class="btn"
          id="reject-confirm-btn"
          style="background:#dc2626;color:#fff;display:flex;align-items:center;gap:6px"
          onclick="confirmReject()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          Xác nhận từ chối
        </button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="share-modal">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:500px;border-radius:14px;max-height:90vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <div>
          <div class="modal-title">Chia sẻ biểu mẫu</div>
          <div style="font-size:12.5px;color:var(--gray-400);margin-top:2px" id="share-form-name"></div>
        </div>
        <button class="icon-btn close-btn" onclick="closeModal('share-modal')">${IC.close}</button>
      </div>

      <div class="modal-body" style="overflow-y:auto;flex:1">

        <!-- Gửi email cho khách -->
        <div style="margin-bottom:20px">
          <label class="form-label" style="margin-bottom:6px">
            Gửi link cho khách hàng qua Email
          </label>
          <div style="display:flex;gap:8px">
            <input type="email" id="share-email-inp" class="input"
              placeholder="Nhập email khách hàng..."
              style="flex:1"
              onkeydown="if(event.key==='Enter'){addShareEmail()}"
              autocomplete="off">
            <button class="btn btn-outline" onclick="addShareEmail()" style="flex-shrink:0;white-space:nowrap">
              + Thêm
            </button>
          </div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:5px">
            Nhấn Enter hoặc "+ Thêm" để thêm nhiều email. Nhấn "Gửi email" để gửi tất cả.
          </div>

          <!-- Danh sách email sẽ gửi -->
          <div id="share-email-tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;min-height:0"></div>
        </div>

        <!-- Trạng thái gửi -->
        <div id="share-send-status" style="display:none;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:14px"></div>

        <!-- Sao chép link -->
        <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:14px">
          <div style="font-size:13px;font-weight:700;color:var(--gray-700);margin-bottom:8px">
            Hoặc sao chép liên kết chia sẻ
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" id="share-link-input" class="input" readonly
              style="flex:1;background:#fff;font-size:12px;color:var(--gray-600);cursor:default">
            <button class="btn btn-outline btn-sm" onclick="copyShareLink()" style="flex-shrink:0;white-space:nowrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Sao chép
            </button>
          </div>
          <div id="share-copied-msg" style="display:none;align-items:center;gap:6px;margin-top:8px;font-size:12.5px;color:#16a34a;font-weight:600">
            <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" width="13" height="13"><path d="M20 6L9 17l-5-5"/></svg>
            Đã sao chép liên kết!
          </div>
          <div style="margin-top:10px">
            <button id="apr-shorten-btn" onclick="approvalShortenLink()" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border:1.5px solid #c4b5fd;border-radius:8px;background:#fff;color:#7c3aed;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s" onmouseenter="this.style.background='#f5f3ff'" onmouseleave="this.style.background='#fff'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              Rút gọn
            </button>
            <div id="apr-shortened-wrap" style="display:none;margin-top:8px">
              <div style="display:flex;gap:8px;align-items:center">
                <input id="apr-shortened-input" class="input" readonly style="flex:1;background:#f8fafc;font-size:12px;color:#7c3aed;font-weight:600;cursor:default" />
                <button class="btn btn-outline btn-sm" onclick="aprCopyShortenedLink()" style="color:#7c3aed;border-color:#c4b5fd;white-space:nowrap">Sao chép</button>
              </div>
            </div>
          </div>
        </div>

        <!-- QR Code section -->
        <div style="margin-top:16px;border-top:1px solid var(--gray-200);padding-top:16px">
          <button onclick="toggleShareQR()" id="qr-toggle-btn"
            style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#374151;transition:all .15s"
            onmouseenter="this.style.borderColor='#00008B';this.style.color='#00008B'" onmouseleave="this.style.borderColor='#e2e8f0';this.style.color='#374151'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/><rect x="19" y="19" width="2" height="2"/></svg>
            Hiển thị mã QR để điền biểu mẫu
            <svg id="qr-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-left:auto;transition:transform .2s"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div id="qr-code-area" style="display:none;text-align:center;padding:20px 0 4px">
            <div style="font-size:12px;color:var(--gray-400);margin-bottom:12px">Học viên quét mã QR để mở và điền biểu mẫu trực tiếp</div>
            <div id="qr-canvas-wrap" style="display:inline-block;padding:12px;background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
              <canvas id="qr-canvas" width="180" height="180"></canvas>
            </div>
            <div style="margin-top:12px">
              <button onclick="downloadQR()" class="btn btn-outline btn-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Tải xuống QR
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('share-modal')">Đóng</button>
        <button class="btn btn-primary" id="share-send-btn" onclick="sendShareEmails()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Gửi email
        </button>
      </div>
    </div>
  </div>
`;

// Load dữ liệu từ API khi trang khởi động
(async () => {
  renderApproval("all");   // hiển thị cache ngay lập tức
  await loadApprovalsFromAPI();
  renderApproval(currentApprovalTab);  // re-render sau khi có dữ liệu thật từ DB
})();

window.addEventListener("storage", (event) => {
  if (
    event.key === "quyen" ||
    event.key === "user" ||
    event.key === LS_APPROVALS ||
    event.key === LS_TRASH_FORMS ||
    event.key === LS_HIDDEN_APPROVAL_FORMS
  ) {
    approvalData = removeApprovalsOfTrashedForms(loadLocalApprovals());
    renderApproval(currentApprovalTab);
  }
});

window.addEventListener("focus", async () => {
  await loadApprovalsFromAPI();
  renderApproval(currentApprovalTab);
});

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    await loadApprovalsFromAPI();
    renderApproval(currentApprovalTab);
  }
});

function renderApprovalActions(a) {
  const canApprove = canApproveNow();
  const canShareForm = canShareFormNow();
  const safeFormName = escapeJsString(a.form || '');
  const actionBtnStyle = "width:112px;justify-content:center;white-space:nowrap";
  const iconBtnStyle = "width:34px;height:34px;min-width:34px;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap";
  let html = `<div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;align-items:center;justify-content:start;gap:8px;white-space:nowrap">`;

  if (a.status === 'pending' && canApprove) {
    html += `
      <button class="btn btn-sm" style="background:#dcfce7;color:#166534;${actionBtnStyle}" onclick="approveItem('${a.id}')">
        ${IC.check}Duyệt
      </button>
      <button class="btn btn-sm" style="background:#fee2e2;color:#991b1b;width:86px;justify-content:center;white-space:nowrap" onclick="rejectItem('${a.id}')">
        ${IC.reject}Từ chối
      </button>
    `;
  }

  if (a.status === 'approved' && canShareForm) {
    html += `
      <button class="btn btn-sm" style="background:#00008B;color:#fff;${actionBtnStyle}" onclick="openShareModal('${a.id}', '${safeFormName}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Chia sẻ
      </button>
    `;
  }

  if (a.status === 'rejected' && a.form_id) {
    html += `
      <button class="btn btn-sm" style="background:#00008B;color:#fff;${actionBtnStyle}" onclick="editRejectedForm('${a.id}', '${a.form_id}')">
        ${IC.edit}Chỉnh sửa
      </button>
    `;
  }

  html += `
    <button class="icon-btn" title="Xem câu hỏi" onclick="openViewModal('${a.id}')" style="${iconBtnStyle}">
      ${IC.eye}
    </button>
    <button class="icon-btn" title="Ẩn khỏi phê duyệt" onclick="trashApprovalItem('${a.id}')" style="color:#64748b;${iconBtnStyle}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17">
        <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58"/>
        <path d="M9.88 5.09A10.65 10.65 0 0112 4c5 0 9 5 9 8a9.77 9.77 0 01-2.06 3.13"/>
        <path d="M6.61 6.61C4.46 8.13 3 10.24 3 12c0 3 4 8 9 8a9.84 9.84 0 004.22-.98"/>
        <line x1="3" y1="3" x2="21" y2="21"/>
      </svg>
    </button>
  `;

  html += `</div>`;
  return html;
}

function editRejectedForm(approvalId, formId) {
  window.location.href = `form-management.html?edit_form_id=${encodeURIComponent(formId)}&resubmit_approval_id=${encodeURIComponent(approvalId)}`;
}
