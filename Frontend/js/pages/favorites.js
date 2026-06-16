const FORM_IMAGES = [
  "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=400&h=200&fit=crop",
];

const CATEGORY_COLORS = {
  "Ngoại ngữ": "badge-blue",
  "Tin học": "badge-green",
};

let favoriteForms = [];
let filteredFavorites = [];
let currentPage = 1;
const itemsPerPage = 12;

function getCurrentUserId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.id || 1;
  } catch {
    return 1;
  }
}

function getAuthHeaders() {
  const token = localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function saveFavoriteIds(ids) {
  localStorage.setItem("flic_favorites", JSON.stringify([...ids].map(String)));
}

function getStatusBadge(status) {
  if (status === "active") return '<span class="badge badge-green">Hoạt động</span>';
  if (status === "closed" || status === "archived") return '<span class="badge badge-gray">Lưu trữ</span>';
  if (status === "pending") return '<span class="badge badge-yellow">Chờ duyệt</span>';
  return '<span class="badge badge-yellow">Nháp</span>';
}

function categoryBadgeClass(cat) {
  return CATEGORY_COLORS[cat] || "badge-blue";
}

function formatDate(rawDate) {
  if (!rawDate) return "";
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN");
}

function mapFavoriteForm(form, index) {
  return {
    id: String(form.form_id || form.id),
    favoriteId: String(form.id || ""),
    name: form.ten_form || "Biểu mẫu chưa đặt tên",
    cat: form.danh_muc || "Khác",
    responses: Number(form.so_phan_hoi || 0),
    modified: formatDate(form.ngay_them || form.ngay_cap_nhat || form.ngay_tao),
    status: form.trang_thai || "draft",
    img: FORM_IMAGES[index % FORM_IMAGES.length],
  };
}

async function loadFavoriteForms() {
  const nhanVienId = getCurrentUserId();

  try {
    const res = await fetch(`${API_BASE}/favorites/${nhanVienId}`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    favoriteForms = data.map(mapFavoriteForm);
    filteredFavorites = [...favoriteForms];
    currentPage = 1;
    saveFavoriteIds(new Set(favoriteForms.map((form) => form.id)));
    renderFavorites(filteredFavorites);
  } catch (error) {
    console.error("Lỗi tải danh sách yêu thích:", error);
    favoriteForms = [];
    filteredFavorites = [];
    saveFavoriteIds(new Set());
    renderFavorites([]);
    if (typeof showToast === "function") showToast("Không thể tải danh sách yêu thích", "error");
  }
}

document.getElementById("page-content").innerHTML = `
  <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between">
    <div>
      <h2 class="page-title">Danh sách yêu thích</h2>
      <p class="page-sub">Các biểu mẫu bạn đã đánh dấu yêu thích</p>
    </div>
  </div>

  <div class="card card-body" style="margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <div class="input-wrap" style="flex:1;min-width:200px;margin-bottom:0">
        <div class="input-icon">${IC.search}</div>
        <input type="text" id="fav-search" class="input" placeholder="Tìm kiếm biểu mẫu yêu thích..." oninput="applyFilters()">
      </div>
      <select id="fav-cat-filter" class="input" style="width:200px;background:var(--gray-50)" onchange="applyFilters()">
        <option value="">Tất cả danh mục</option>
        <option value="Ngoại ngữ">Ngoại ngữ</option>
        <option value="Tin học">Tin học</option>
      </select>
    </div>
  </div>

  <p id="fav-count" style="font-size:13px;color:var(--gray-500);margin-bottom:16px"></p>
  <div class="grid-3" id="fav-grid"></div>

  <div id="fav-pagination" style="display:none;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:12px 18px;align-items:center;justify-content:space-between;margin-top:16px;box-shadow:var(--shadow-sm)">
    <span id="fav-page-info" style="font-size:13px;color:var(--gray-500)">Trang 1 / 1</span>
    <div style="display:flex;gap:6px">
      <button id="fav-prev-btn" class="btn btn-outline btn-sm" onclick="changePage(-1)">Trước</button>
      <button id="fav-next-btn" class="btn btn-outline btn-sm" onclick="changePage(1)">Sau</button>
    </div>
  </div>
`;

function renderFavorites(list) {
  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);

  document.getElementById("fav-count").innerHTML =
    `Hiển thị <strong style="color:var(--gray-800)">${totalItems}</strong> trong tổng số ` +
    `<strong style="color:var(--gray-800)">${favoriteForms.length}</strong> biểu mẫu`;

  if (totalItems === 0) {
    document.getElementById("fav-grid").innerHTML = `
      <div class="card card-body" style="grid-column:1/-1;text-align:center;padding:40px 24px;color:var(--gray-500)">
        <div style="font-size:42px;line-height:1;margin-bottom:12px">♡</div>
        <div style="font-size:18px;font-weight:700;color:var(--gray-800);margin-bottom:6px">Chưa có biểu mẫu yêu thích</div>
        <div>Nhấn vào trái tim ở trang Quản lý biểu mẫu để thêm vào đây.</div>
      </div>
    `;
    document.getElementById("fav-pagination").style.display = "none";
    return;
  }

  const startIdx = (currentPage - 1) * itemsPerPage;
  const currentList = list.slice(startIdx, startIdx + itemsPerPage);

  document.getElementById("fav-grid").innerHTML = currentList.map((form) => `
    <div class="form-card">
      <div class="form-card-thumb">
        <img src="${form.img}" alt="${form.name}" loading="lazy">
        <div class="badge-pos">${getStatusBadge(form.status)}</div>
        <div style="position:absolute;top:10px;right:10px">
          <button type="button" style="width:32px;height:32px;border-radius:50%;background:var(--gray-50);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.18);border:none;cursor:pointer" onclick="removeFavorite('${form.id}')" title="Bỏ yêu thích">
            <span style="font-size:16px;color:#e11d48;line-height:1">♥</span>
          </button>
        </div>
        <div class="form-card-overlay">
          <button class="btn btn-outline btn-sm" style="background:var(--gray-50)" onclick="openFavoriteForm('${form.id}')">${IC.eye}Xem form</button>
        </div>
      </div>
      <div class="form-card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span class="badge ${categoryBadgeClass(form.cat)}">${form.cat}</span>
          <span style="font-size:12px;color:var(--gray-500)">${form.modified}</span>
        </div>
        <div class="form-card-name">${form.name}</div>
        <div class="form-card-meta" style="margin-top:10px">
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            ${form.responses.toLocaleString("vi-VN")} phản hồi
          </span>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn btn-outline btn-sm" style="flex:1;justify-content:center" onclick="openFavoriteForm('${form.id}')">${IC.eye}Xem</button>
          <button class="btn btn-outline btn-sm" style="flex:1;justify-content:center;border-color:#fecaca;color:#b91c1c;background:var(--gray-50)" onclick="removeFavorite('${form.id}')">Bỏ yêu thích</button>
        </div>
      </div>
    </div>
  `).join("");

  const pagContainer = document.getElementById("fav-pagination");
  pagContainer.style.display = totalPages > 1 ? "flex" : "none";

  if (totalPages > 1) {
    document.getElementById("fav-page-info").textContent = `Trang ${currentPage} / ${totalPages}`;
    const prevBtn = document.getElementById("fav-prev-btn");
    const nextBtn = document.getElementById("fav-next-btn");
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    prevBtn.style.opacity = prevBtn.disabled ? "0.5" : "1";
    nextBtn.style.opacity = nextBtn.disabled ? "0.5" : "1";
    prevBtn.style.cursor = prevBtn.disabled ? "not-allowed" : "pointer";
    nextBtn.style.cursor = nextBtn.disabled ? "not-allowed" : "pointer";
  }
}

function openFavoriteForm(id) {
  window.location.href = `./form-management.html?view_form_id=${encodeURIComponent(id)}`;
}

async function removeFavorite(id) {
  const sid = String(id);
  const previousForms = [...favoriteForms];
  const previousFiltered = [...filteredFavorites];
  const previousPage = currentPage;

  favoriteForms = favoriteForms.filter((form) => form.id !== sid);
  filteredFavorites = filteredFavorites.filter((form) => form.id !== sid);
  saveFavoriteIds(new Set(favoriteForms.map((form) => form.id)));
  renderFavorites(filteredFavorites);

  try {
    const res = await fetch(`${API_BASE}/favorites/${getCurrentUserId()}/${encodeURIComponent(sid)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (typeof showToast === "function") showToast("Đã bỏ khỏi danh sách yêu thích", "warning");
  } catch (err) {
    console.error("Lỗi khi xóa yêu thích:", err);
    favoriteForms = previousForms;
    filteredFavorites = previousFiltered;
    currentPage = previousPage;
    saveFavoriteIds(new Set(favoriteForms.map((form) => form.id)));
    renderFavorites(filteredFavorites);
    if (typeof showToast === "function") showToast("Không thể bỏ yêu thích", "error");
  }
}

function applyFilters() {
  const keyword = document.getElementById("fav-search").value.trim().toLowerCase();
  const cat = document.getElementById("fav-cat-filter").value;

  filteredFavorites = favoriteForms.filter((form) => {
    const haystack = `${form.name} ${form.cat}`.toLowerCase();
    return haystack.includes(keyword) && (!cat || form.cat === cat);
  });

  currentPage = 1;
  renderFavorites(filteredFavorites);
}

function changePage(delta) {
  currentPage += delta;
  renderFavorites(filteredFavorites);
  document.getElementById("fav-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

window.addEventListener("storage", (event) => {
  if (event.key === "flic_favorites") loadFavoriteForms();
});

loadFavoriteForms();
