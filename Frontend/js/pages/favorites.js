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
  "Khảo sát": "badge-blue",
  "Đăng ký": "badge-yellow",
  "Đánh giá": "badge-purple",
  "Phản hồi": "badge-pink",
};

let favoriteForms = [];
let filteredFavorites = [];

function getFavoriteIds() {
  return new Set(JSON.parse(localStorage.getItem("flic_favorites") || "[]").map(String));
}

function saveFavoriteIds(ids) {
  localStorage.setItem("flic_favorites", JSON.stringify([...ids]));
}

function getStatusBadge(status) {
  if (status === "active") return '<span class="badge badge-green">Hoạt động</span>';
  if (status === "archived") return '<span class="badge badge-gray">Lưu trữ</span>';
  return '<span class="badge badge-yellow">Nháp</span>';
}

function categoryBadgeClass(cat) {
  return CATEGORY_COLORS[cat] || "badge-blue";
}

function formatRelativeDate(rawDate) {
  if (!rawDate) return "";
  try {
    return new Date(rawDate).toLocaleDateString("vi-VN");
  } catch {
    return "";
  }
}

function mapForm(form, index) {
  return {
    id: String(form.id),
    name: form.ten_form || "Biểu mẫu chưa đặt tên",
    cat: form.danh_muc || "Khác",
    responses: Number(form.so_phan_hoi || 0),
    modified: formatRelativeDate(form.ngay_cap_nhat || form.ngay_tao),
    status: form.trang_thai || "draft",
    img: FORM_IMAGES[index % FORM_IMAGES.length],
  };
}

async function loadFavoriteForms() {
  const favoriteIds = getFavoriteIds();
  if (!favoriteIds.size) {
    favoriteForms = [];
    filteredFavorites = [];
    renderFavorites([]);
    return;
  }

  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API_BASE}/forms`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error("Không thể tải danh sách form");
    const data = await res.json();

    favoriteForms = data
      .map(mapForm)
      .filter((form) => favoriteIds.has(form.id));

    filteredFavorites = [...favoriteForms];
    renderFavorites(filteredFavorites);
  } catch (error) {
    console.error("Lỗi tải danh sách yêu thích:", error);
    favoriteForms = [];
    filteredFavorites = [];
    renderFavorites([]);
    showToast("Không thể tải danh sách yêu thích", "error");
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
    <div class="input-wrap">
      <div class="input-icon">${IC.search}</div>
      <input type="text" id="fav-search" class="input" placeholder="Tìm kiếm biểu mẫu yêu thích..." oninput="searchFavorites()">
    </div>
  </div>

  <p id="fav-count" style="font-size:13px;color:var(--gray-500);margin-bottom:16px"></p>
  <div class="grid-3" id="fav-grid"></div>
`;

function renderFavorites(list) {
  document.getElementById("fav-count").innerHTML = `Hiển thị <strong style="color:var(--gray-800)">${list.length}</strong> trong tổng số <strong style="color:var(--gray-800)">${favoriteForms.length}</strong> form`;

  if (!list.length) {
    document.getElementById("fav-grid").innerHTML = `
      <div class="card card-body" style="grid-column:1/-1;text-align:center;padding:40px 24px;color:var(--gray-500)">
        <div style="font-size:42px;line-height:1;margin-bottom:12px">❤</div>
        <div style="font-size:18px;font-weight:700;color:var(--gray-800);margin-bottom:6px">Chưa có biểu mẫu yêu thích</div>
        <div>Nhấn vào trái tim ở trang Quản lý biểu mẫu để thêm vào đây.</div>
      </div>
    `;
    return;
  }

  document.getElementById("fav-grid").innerHTML = list.map((form) => `
    <div class="form-card">
      <div class="form-card-thumb">
        <img src="${form.img}" alt="${form.name}" loading="lazy">
        <div class="badge-pos">${getStatusBadge(form.status)}</div>
        <div style="position:absolute;top:10px;right:10px">
          <button
            type="button"
            style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.95);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.18);border:none;cursor:pointer"
            onclick="removeFavorite('${form.id}')"
            title="Bỏ yêu thích"
          >
            <span style="font-size:16px;color:#e11d48;line-height:1">❤</span>
          </button>
        </div>
        <div class="form-card-overlay">
          <button class="btn btn-outline btn-sm" style="background:rgba(255,255,255,.94)" onclick="openFavoriteForm('${form.id}')">${IC.eye}Xem form</button>
        </div>
      </div>
      <div class="form-card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span class="badge ${categoryBadgeClass(form.cat)}">${form.cat}</span>
          <span style="font-size:12px;color:var(--gray-500)">${form.modified || ""}</span>
        </div>
        <div class="form-card-name">${form.name}</div>
        <div class="form-card-meta" style="margin-top:10px">
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            ${form.responses.toLocaleString("vi-VN")} phản hồi
          </span>
        </div>
      </div>
    </div>
  `).join("");
}

function openFavoriteForm(id) {
  window.location.href = `./form-management.html?view_form_id=${encodeURIComponent(id)}`;
}

function removeFavorite(id) {
  const favoriteIds = getFavoriteIds();
  favoriteIds.delete(String(id));
  saveFavoriteIds(favoriteIds);
  favoriteForms = favoriteForms.filter((form) => form.id !== String(id));
  filteredFavorites = filteredFavorites.filter((form) => form.id !== String(id));
  renderFavorites(filteredFavorites);
  showToast("Đã bỏ khỏi danh sách yêu thích", "warning");
}

function searchFavorites() {
  const keyword = document.getElementById("fav-search").value.trim().toLowerCase();
  filteredFavorites = favoriteForms.filter((form) =>
    form.name.toLowerCase().includes(keyword) ||
    form.cat.toLowerCase().includes(keyword)
  );
  renderFavorites(filteredFavorites);
}

window.addEventListener("storage", (event) => {
  if (event.key === "flic_favorites") loadFavoriteForms();
});

loadFavoriteForms();