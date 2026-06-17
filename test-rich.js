const assert = require('assert');

function previewEsc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
}
function applyInlineRichText(str) { return str; } // Mock

function renderRichTextBlocks(value) {
  const lines = value.split('\n');
  let html = '';
  lines.forEach((line, index) => {
    html += applyInlineRichText(line);
    if (index < lines.length - 1) html += '<br>';
  });
  return html;
}

function formatRichText(value, isRequired = false) {
  if (!value) return isRequired ? ' <span style="color:#ef4444;margin-left:2px">*</span>' : '';
  
  let text = String(value);
  if (isRequired) {
    const lines = text.split('\n');
    lines[0] = lines[0] + '__REQ_STAR__';
    text = lines.join('\n');
  }

  let html = renderRichTextBlocks(previewEsc(text));

  if (isRequired) {
    html = html.replace('__REQ_STAR__', ' <span style="color:#ef4444;margin-left:2px">*</span>');
  }
  return html;
}

const res = formatRichText("Đánh giá về Học liệu tại Khóa học\nCụ thể thang điểm như sau:\n1 = Rất không hài lòng", true);
console.log(res);
