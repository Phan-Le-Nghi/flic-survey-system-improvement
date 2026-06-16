/**
 * cleanExcel.js
 * Làm sạch dữ liệu Excel trước khi đưa vào dashboard.
 * Sử dụng: const { headers, rows, colTypes, skipped } = cleanExcel(rawData);
 */

// ── Null tokens coi như rỗng ─────────────────────────────────────────────────
const NULL_TOKENS = new Set([
  'n/a', 'na', 'null', 'none', 'undefined',
  '-', '–', '—', '.', '..', '...',
  'trống', 'không có', 'chưa có', 'không', 'chưa',
]);

/**
 * Làm sạch 1 ô:
 * - Xóa ký tự ẩn \r \n \t \u00A0
 * - Chuẩn hóa khoảng trắng thừa
 * - Trim đầu cuối
 * - Null tokens → ""
 */
function cleanCell(v) {
  const s = String(v ?? '')
    .replace(/[\r\n\t]/g, ' ')   // ký tự điều khiển
    .replace(/\u00A0/g, ' ')     // non-breaking space
    .replace(/\s+/g, ' ')        // khoảng trắng thừa giữa từ
    .trim();

  return NULL_TOKENS.has(s.toLowerCase()) ? '' : s;
}

/**
 * Xử lý headers:
 * - Header rỗng → "Cột N"
 * - Header trùng → thêm suffix _2, _3
 */
function cleanHeaders(rawHeaders) {
  const seen = {};
  return rawHeaders.map((h, i) => {
    let name = cleanCell(h) || `Cột ${i + 1}`;
    if (seen[name]) {
      seen[name]++;
      name = `${name}_${seen[name]}`;
    } else {
      seen[name] = 1;
    }
    return name;
  });
}

/**
 * Chuẩn hóa số cho cột rating/number:
 * - "4,5" → "4.5"  (dấu phẩy thập phân kiểu VN/EU)
 * - "4.0" → "4"    (bỏ .0 thừa)
 */
function normalizeNumber(v) {
  const s = v.replace(',', '.');
  const n = parseFloat(s);
  if (isNaN(n)) return v;
  return Number.isInteger(n) ? String(n) : String(n);
}

/**
 * Phát hiện kiểu cột từ dữ liệu đã clean.
 * (Tương đương colTypes cũ nhưng chạy sau khi clean)
 */
function detectColType(vals) {
  if (!vals.length) return 'text';
  const nums = vals.filter(v => !isNaN(v.replace(',', '.')) && v !== '');
  if (nums.length / vals.length > 0.8)
    return Math.max(...nums.map(v => parseFloat(v.replace(',', '.')))) <= 10 ? 'rating' : 'number';
  const uniq = new Set(vals);
  if (uniq.size <= 15 && uniq.size < vals.length * 0.6) return 'choice';
  if (vals.some(v => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(v))) return 'date';
  return 'text';
}

/**
 * Hàm chính: nhận raw data từ XLSX.utils.sheet_to_json({ header:1 })
 * Trả về { headers, rows, colTypes, skipped }
 *
 * @param {Array[]} raw  - mảng 2 chiều, raw[0] là header
 * @returns {{ headers: string[], rows: Array[], colTypes: string[], skipped: number }}
 */
function cleanExcel(raw) {
  if (!raw || raw.length < 2) {
    return { headers: [], rows: [], colTypes: [], skipped: 0 };
  }

  // ── 1. Clean & xử lý headers ────────────────────────────────────────────
  const rawHeaders = (raw[0] || []).map(h => String(h ?? ''));
  const headers    = cleanHeaders(rawHeaders);

  // ── 2. Clean từng ô trong data rows ─────────────────────────────────────
  const originalCount = raw.length - 1;
  let cleanedRows = raw.slice(1).map(row =>
    headers.map((_, ci) => cleanCell(row[ci] ?? ''))
  );

  // ── 3. Lọc dòng toàn rỗng ───────────────────────────────────────────────
  cleanedRows = cleanedRows.filter(row => row.some(v => v !== ''));

  // ── 4. Lọc cột toàn rỗng ────────────────────────────────────────────────
  const validColIndexes = headers
    .map((_, ci) => ci)
    .filter(ci => cleanedRows.some(row => row[ci] !== ''));

  const finalHeaders = validColIndexes.map(ci => headers[ci]);
  const finalRows    = cleanedRows.map(row => validColIndexes.map(ci => row[ci]));

  // ── 5. Detect kiểu cột + chuẩn hóa số ───────────────────────────────────
  const colTypes = finalHeaders.map((_, ci) => {
    const vals = finalRows.map(r => r[ci]).filter(v => v !== '');
    const type = detectColType(vals);

    // Chuẩn hóa số cho cột rating/number
    if (type === 'rating' || type === 'number') {
      finalRows.forEach(row => {
        if (row[ci] !== '') row[ci] = normalizeNumber(row[ci]);
      });
    }

    return type;
  });

  const skipped = originalCount - finalRows.length;

  return { headers: finalHeaders, rows: finalRows, colTypes, skipped };
}

// Export cho cả module (Node/test) lẫn browser global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cleanExcel, cleanCell };
} else {
  window.cleanExcel = cleanExcel;
}