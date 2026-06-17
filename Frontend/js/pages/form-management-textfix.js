(function () {
  const fixes = [
    ['Qu?n l� bi?u m?u', 'Quản lý biểu mẫu'],
    ['T?o, ch?nh s?a v� qu?n l� t?t c? bi?u m?u c?a b?n', 'Tạo, chỉnh sửa và quản lý tất cả biểu mẫu của bạn'],
    ['T?o bi?u m?u m?i', 'Tạo biểu mẫu mới'],
    ['T?o bi?u m?u', 'Tạo biểu mẫu'],
    ['Tạo bi?u m?u', 'Tạo biểu mẫu'],
    ['bi?u m?u', 'biểu mẫu'],
    ['T�m ki?m theo t�n hoặc m� t?...', 'Tìm kiếm theo tên hoặc mô tả...'],
    ['Hi?n th?', 'Hiển thị'],
    ['trong t?ng s?', 'trong tổng số'],
    ['Ho?t d?ng', 'Hoạt động'],
    ['Nh�p', 'Nháp'],
    ['Ch? ph� duy?t', 'Chờ phê duyệt'],
    ['Luu trữ', 'Lưu trữ'],
    ['T�n bi?u m?u', 'Tên biểu mẫu'],
    ['�i?n th�ng tin v� th�m c�u h?i', 'Điền thông tin và thêm câu hỏi'],
    ['M� t?', 'Mô tả'],
    ['Mô tả ng?n v? bi?u m?u...', 'Mô tả ngắn về biểu mẫu...'],
    ['Mô tả ng?n v? biểu mẫu...', 'Mô tả ngắn về biểu mẫu...'],
    ['Mô tả ngắn v? biểu mẫu...', 'Mô tả ngắn về biểu mẫu...'],
    ['ng?n', 'ngắn'],
    ['v? biểu mẫu', 'về biểu mẫu'],
    ['M� t? ng?n v? bi?u m?u...', 'Mô tả ngắn về biểu mẫu...'],
    ['Danh m?c', 'Danh mục'],
    ['Ch?n danh m?c', 'Chọn danh mục'],
    ['Ng�y d�ng bi?u m?u', 'Ngày đóng biểu mẫu'],
    ['Kh�ng d�ng', 'Không đóng'],
    ['Tr?ng th�i bi?u m?u', 'Trạng thái biểu mẫu'],
    ['Tr?ng th�i', 'Trạng thái'],
    ['Ghi ch� cho ngu?i ph� duy?t', 'Ghi chú cho người phê duyệt'],
    ['Lời kết (hiển thị sau khi ngu?i d�ng gửi phản hồi)', 'Lời kết (hiển thị sau khi người dùng gửi phản hồi)'],
    ['người d�ng', 'người dùng'],
    ['ngu?i dùng', 'người dùng'],
    ['C�u h?i', 'Câu hỏi'],
    ['câu h?i', 'câu hỏi'],
    ['c�u h?i', 'câu hỏi'],
    ['Th�m c�u h?i', 'Thêm câu hỏi'],
    ['Thư viện c�u h?i', 'Thư viện câu hỏi'],
    ['T�m c�u h?i...', 'Tìm câu hỏi...'],
    ['Ch?n t?t c?', 'Chọn tất cả'],
    ['B? ch?n', 'Bỏ chọn'],
    ['Chua c� c�u h?i n�o', 'Chưa có câu hỏi nào'],
    ['�� ch?n', 'Đã chọn'],
    ['Đã chọn', 'Đã chọn'],
    ['Xem trước bi?u m?u', 'Xem trước biểu mẫu'],
    ['��y l� giao di?n ngu?i d�ng s? th?y', 'Đây là giao diện người dùng sẽ thấy'],
    ['H?y b?', 'Hủy bỏ'],
    ['H?y', 'Hủy'],
    ['��ng', 'Đóng'],
    ['Ph�ng to', 'Phóng to'],
    ['Thu nh?', 'Thu nhỏ'],
    ['Trắc nghiệm', 'Trắc nghiệm'],
    ['Hộp kiểm', 'Hộp kiểm'],
    ['Menu th? xu?ng', 'Menu thả xuống'],
    ['Thả xuống', 'Thả xuống'],
    ['�o?n van', 'Đoạn văn'],
    ['Tuy?n t�nh', 'Tuyến tính'],
    ['Lu?i tr?c nghi?m', 'Lưới trắc nghiệm'],
    ['Lu?i h?p ki?m', 'Lưới hộp kiểm'],
    ['C�u tr? l?i m?u', 'Câu trả lời mẫu'],
    ['Ngu?i tr? l?i s? nh?p c�u tr? l?i t?i d�y', 'Người trả lời sẽ nhập câu trả lời tại đây'],
    ['Kh�ng b?t bu?c', 'Không bắt buộc'],
    ['B?t bu?c', 'Bắt buộc'],
    ['G?i ph?n h?i', 'Gửi phản hồi'],
    ['gửi ph?n hồi', 'gửi phản hồi'],
    ['gửi phần hồi', 'gửi phản hồi'],
    ['ph?n hồi', 'phản hồi'],
    ['phần hồi', 'phản hồi'],
    ['C?m on b?n đã tham gia kh?o sát! Ph?n h?i c?a b?n r?t có gi� tr? v?i ch�ng t�i.', 'Cảm ơn bạn đã tham gia khảo sát! Phản hồi của bạn rất có giá trị với chúng tôi.'],
    ['C?m on b?n', 'Cảm ơn bạn'],
    ['Cảm on bạn', 'Cảm ơn bạn'],
    ['Cảm ơn bạn đã tham gia kh?o st! Phản hồi của bạn r?t có gi tr? với chúng tôi.', 'Cảm ơn bạn đã tham gia khảo sát! Phản hồi của bạn rất có giá trị với chúng tôi.'],
    ['Cảm ơn bạn đã tham gia kh?o st!', 'Cảm ơn bạn đã tham gia khảo sát!'],
    ['tham gia kh?o sát', 'tham gia khảo sát'],
    ['tham gia kh?o st', 'tham gia khảo sát'],
    ['kh?o sát', 'khảo sát'],
    ['kh?o st', 'khảo sát'],
    ['Ph?n h?i', 'Phản hồi'],
    ['c?a b?n', 'của bạn'],
    ['r?t có gi� tr?', 'rất có giá trị'],
    ['r?t có gi tr?', 'rất có giá trị'],
    ['r?t', 'rất'],
    ['gi tr?', 'giá trị'],
    ['v?i chng ti', 'với chúng tôi'],
    ['v?i chúng tôi', 'với chúng tôi'],
    ['chng ti', 'chúng tôi'],
    ['thng 3/2026', 'tháng 3/2026'],
    ['?? Thư viện', 'Thư viện'],
    ['? Thư viện', 'Thư viện'],
    ['Thm câu hỏi', 'Thêm câu hỏi'],
    ['Chưa có câu hỏi no.', 'Chưa có câu hỏi nào.'],
    ['chưa có câu hỏi no.', 'chưa có câu hỏi nào.'],
    ['Chưa có câu hỏi no. Bấm "+ Thêm câu hỏi" hoặc chọn từ Thư viện.', 'Chưa có câu hỏi nào. Bấm "+ Thêm câu hỏi" hoặc chọn từ Thư viện.'],
    ['Nh?p n?i dung câu hỏi...', 'Nhập nội dung câu hỏi...'],
    ['Nhập n?i dung câu hỏi...', 'Nhập nội dung câu hỏi...'],
    ['n?i dung', 'nội dung'],
    ['? Trắc nghiệm', 'Trắc nghiệm'],
    ['CC L?A CH?N', 'CÁC LỰA CHỌN'],
    ['CC LỰA CHỌN', 'CÁC LỰA CHỌN'],
    ['l?a ch?n', 'lựa chọn'],
    ['Lựa ch?n', 'Lựa chọn'],
    ['+ Thm l?a ch?n', '+ Thêm lựa chọn'],
    ['+ Thêm l?a ch?n', '+ Thêm lựa chọn'],
    ['Thm l?a ch?n', 'Thêm lựa chọn'],
    ['Lưu vo thư viện', 'Lưu vào thư viện'],
    ['Luu vo thư viện', 'Lưu vào thư viện'],
    ['vo thư viện', 'vào thư viện'],
    ['Lưu câu hỏi', 'Lưu câu hỏi'],
    ['Thm ph?n bn dưới', 'Thêm phần bên dưới'],
    ['Thêm ph?n bn dưới', 'Thêm phần bên dưới'],
    ['bn dưới', 'bên dưới'],
    ['�ang k�', 'Đăng ký'],
    ['Kh?o s�t', 'Khảo sát'],
    ['h�i l�ng', 'hài lòng'],
    ['h?c vi�n', 'học viên'],
    ['h?c', 'học'],
    ['kh�a', 'khóa'],
    ['mi?n ph�', 'miễn phí'],
    ['tu v?n', 'tư vấn'],
    ['l? tr�nh', 'lộ trình'],
    ['Phi?u d�nh gi�', 'Phiếu đánh giá'],
    ['gi?ng vi�n', 'giảng viên'],
    ['L� Van', 'Lê Văn'],
    ['Ho�ng Van', 'Hoàng Văn'],
    ['Ng� Th?', 'Ngô Thị'],
    ['�? Van', 'Đỗ Văn'],
    ['Kh�c', 'Khác'],
    ['Qu?n l�', 'Quản lý'],
    ['Chi ti?t form', 'Chi tiết biểu mẫu'],
    ['Chia s? form', 'Chia sẻ biểu mẫu'],
    ['Bi?u m?u', 'Biểu mẫu'],
    ['T?o link c�ng khai d?p d? g?i cho h?c vi�n', 'Tạo link công khai đẹp để gửi cho học viên'],
    ['Sao ch�p', 'Sao chép'],
    ['M? link', 'Mở link'],
    ['R�t g?n', 'Rút gọn'],
    ['Ng�y t?o', 'Ngày tạo'],
    ['Mẫu hiển thị trực tiếp c?a bi?u m?u', 'Mẫu hiển thị trực tiếp của biểu mẫu'],
    ['d�ng d? xem nhanh n?i dung tru?c khi chia s? hoặc ch?nh s?a', 'dùng để xem nhanh nội dung trước khi chia sẻ hoặc chỉnh sửa'],
    ['Vui l�ng', 'Vui lòng'],
    ['Kh�ng', 'Không'],
    ['c�', 'có'],
    ['d�', 'đã'],
    ['��', 'Đã'],
    ['�ang', 'Đang'],
    ['�', '']
  ];

  const regexFixes = [
    [/\bThm\b/g, 'Th\u00eam'],
    [/\bThem\b/g, 'Th\u00eam'],
    [/\bvo\b/g, 'v\u00e0o'],
    [/\bXa\b/g, 'X\u00f3a'],
    [/\bXoa\b/g, 'X\u00f3a'],
    [/vi\?n/g, 'vi\u00ean'],
    [/thu vi/g, 'th\u01b0 vi'],
    [/th\u01b0 vi\?n/g, 'th\u01b0 vi\u1ec7n'],
    [/Tr\u1eafc nghi\u00eam/g, 'Tr\u1eafc nghi\u1ec7m'],
    [/\? Tr\u1eafc nghi\u1ec7m/g, 'Tr\u1eafc nghi\u1ec7m'],
    [/CC L\?A CH\?N/g, 'C\u00c1C L\u1ef0A CH\u1eccN'],
    [/CC L\u1ef0A CH\u1eccN/g, 'C\u00c1C L\u1ef0A CH\u1eccN'],
    [/Nh.p n.i dung c.u h.i/g, 'Nh\u1eadp n\u1ed9i dung c\u00e2u h\u1ecfi'],
    [/n.i dung/g, 'n\u1ed9i dung'],
    [/c.u h.i/g, 'c\u00e2u h\u1ecfi'],
    [/C.u h.i/g, 'C\u00e2u h\u1ecfi'],
    [/l.a ch.n/g, 'l\u1ef1a ch\u1ecdn'],
    [/L.a ch.n/g, 'L\u1ef1a ch\u1ecdn'],
    [/bn d..i/g, 'b\u00ean d\u01b0\u1edbi'],
    [/b.n d..i/g, 'b\u00ean d\u01b0\u1edbi'],
    [/B.t bu.c/g, 'B\u1eaft bu\u1ed9c'],
    [/L.u v.o th. vi.n/g, 'L\u01b0u v\u00e0o th\u01b0 vi\u1ec7n'],
    [/L.u c.u h.i/g, 'L\u01b0u c\u00e2u h\u1ecfi'],
    [/T.o bi.u m.u/g, 'T\u1ea1o bi\u1ec3u m\u1eabu'],
    [/bi.u m.u/g, 'bi\u1ec3u m\u1eabu'],
    [/Ch.a c. c.u h.i no\./g, 'Ch\u01b0a c\u00f3 c\u00e2u h\u1ecfi n\u00e0o.'],
    [/ch.a c. c.u h.i no\./g, 'ch\u01b0a c\u00f3 c\u00e2u h\u1ecfi n\u00e0o.'],
    [/\?\? Th. vi.n/g, 'Th\u01b0 vi\u1ec7n'],
    [/\? Th. vi.n/g, 'Th\u01b0 vi\u1ec7n'],
    [/Th. vi.n/g, 'Th\u01b0 vi\u1ec7n']
  ];

  function repair(value) {
    if (!value || typeof value !== 'string') return value;
    let next = value;
    for (const [bad, good] of fixes) next = next.split(bad).join(good);
    for (const [bad, good] of regexFixes) next = next.replace(bad, good);
    next = next.replace(/ph\u1ea7n h\u1ed3i/g, 'ph\u1ea3n h\u1ed3i');
    next = next.replace(/Ph\u1ea7n h\u1ed3i/g, 'Ph\u1ea3n h\u1ed3i');
    return next;
  }

  function repairNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const fixed = repair(node.nodeValue);
      if (fixed !== node.nodeValue) node.nodeValue = fixed;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    for (const attr of ['placeholder', 'title', 'aria-label', 'value']) {
      if (node.hasAttribute(attr)) {
        const value = node.getAttribute(attr);
        const fixed = repair(value);
        if (fixed !== value) node.setAttribute(attr, fixed);
      }
    }

    for (const child of node.childNodes) repairNode(child);
  }

  function enforceCreateModalText() {
    const modal = document.getElementById('create-form-modal');
    if (!modal) return;

    const nameInput = document.getElementById('new-form-name');
    if (nameInput) nameInput.placeholder = 'T\u1ea1o bi\u1ec3u m\u1eabu m\u1edbi';
    const nameEditor = document.getElementById('new-form-name-editor');
    if (nameEditor) nameEditor.setAttribute('data-placeholder', 'T\u1ea1o bi\u1ec3u m\u1eabu m\u1edbi');

    const descInput = document.getElementById('new-form-desc');
    if (descInput) descInput.placeholder = 'M\u00f4 t\u1ea3 ng\u1eafn v\u1ec1 bi\u1ec3u m\u1eabu...';
    const descEditor = document.getElementById('new-form-desc-editor');
    if (descEditor) descEditor.setAttribute('data-placeholder', 'M\u00f4 t\u1ea3 ng\u1eafn v\u1ec1 bi\u1ec3u m\u1eabu...');

    const loiKet = document.getElementById('new-form-loi-ket');
    if (loiKet) loiKet.placeholder = 'V\u00ed d\u1ee5: C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 tham gia kh\u1ea3o s\u00e1t! Ph\u1ea3n h\u1ed3i c\u1ee7a b\u1ea1n r\u1ea5t c\u00f3 gi\u00e1 tr\u1ecb v\u1edbi ch\u00fang t\u00f4i.';
    const loiKetEditor = document.getElementById('new-form-loi-ket-editor');
    if (loiKetEditor) loiKetEditor.setAttribute('data-placeholder', 'V\u00ed d\u1ee5: C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 tham gia kh\u1ea3o s\u00e1t! Ph\u1ea3n h\u1ed3i c\u1ee7a b\u1ea1n r\u1ea5t c\u00f3 gi\u00e1 tr\u1ecb v\u1edbi ch\u00fang t\u00f4i.');

    const labelByControl = {
      'new-form-cat': 'Danh m\u1ee5c',
      'new-form-target': '\u0110\u1ed1i t\u01b0\u1ee3ng kh\u1ea3o s\u00e1t',
      'new-form-close': 'Ng\u00e0y \u0111\u00f3ng bi\u1ec3u m\u1eabu',
      'new-form-status': 'Tr\u1ea1ng th\u00e1i bi\u1ec3u m\u1eabu',
      'new-form-note': 'Ghi ch\u00fa cho ng\u01b0\u1eddi ph\u00ea duy\u1ec7t',
      'new-form-loi-ket': 'L\u1eddi k\u1ebft'
    };
    modal.querySelectorAll('.form-label').forEach(label => {
      const container = label.parentElement;
      const control = container?.querySelector?.('select,input,textarea');
      const text = labelByControl[control?.id];
      if (!text) return;
      const required = label.querySelector('span[style*="red"]');
      label.textContent = text + (required ? ' ' : '');
      if (required) {
        required.textContent = '*';
        required.style.color = 'var(--red)';
        label.appendChild(required);
      }
    });

    const fixTargetSelect = (targetSelect) => {
      if (!targetSelect) return;
      const targetLabels = {
        'T\u1ea5t c\u1ea3': 'T\u1ea5t c\u1ea3',
        'Sinh vi\u00ean': 'Sinh vi\u00ean',
        'Sinh vi\u1ec7n': 'Sinh vi\u00ean',
        'Ng\u01b0\u1eddi \u0111i l\u00e0m': 'Ng\u01b0\u1eddi \u0111i l\u00e0m'
      };
      Array.from(targetSelect.options).forEach(option => {
        const fixed = targetLabels[option.value] || targetLabels[repair(option.value)];
        if (fixed) {
          option.value = fixed;
          option.textContent = fixed;
        }
      });
    };
    fixTargetSelect(document.getElementById('new-form-target'));
    fixTargetSelect(document.getElementById('edit-form-target'));

    const empty = document.getElementById('direct-q-empty');
    if (empty) empty.textContent = 'Ch\u01b0a c\u00f3 c\u00e2u h\u1ecfi n\u00e0o. B\u1ea5m "+ Th\u00eam c\u00e2u h\u1ecfi" ho\u1eb7c ch\u1ecdn t\u1eeb Th\u01b0 vi\u1ec7n.';

    modal.querySelectorAll('.dq-placeholder-gray').forEach(input => {
      input.placeholder = 'Nh\u1eadp n\u1ed9i dung c\u00e2u h\u1ecfi...';
    });

    modal.querySelectorAll('button').forEach(button => {
      const action = button.getAttribute('onclick') || '';
      if (action.includes('toggleLibrary') && button.classList.contains('fm-library-toggle')) {
        const count = document.getElementById('q-total-count')?.textContent?.trim() || '0';
        const desired = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M4 4v15.5A2.5 2.5 0 006.5 22H20V6a2 2 0 00-2-2H6.5A2.5 2.5 0 004 6.5"/></svg>Th\u01b0 vi\u1ec7n (<span id="q-total-count">' + count + '</span>)';
        if (button.innerHTML !== desired) button.innerHTML = desired;
      } else if (button.matches('[data-add-direct-q]')) {
        button.classList.add('fm-add-question-btn');
      } else if (action.includes('dqInsertAfter')) {
        button.title = 'Th\u00eam c\u00e2u h\u1ecfi b\u00ean d\u01b0\u1edbi';
      } else if (action.includes('dqAddOpt')) {
        button.textContent = '+ Th\u00eam l\u1ef1a ch\u1ecdn';
      } else if (action.includes('dqSaveToLibrary') && !button.disabled) {
        button.textContent = 'Lưu vào thư viện';
        button.title = 'Lưu vào thư viện';
      } else if (action.includes('dqRemoveRow') || action.includes('dqRemoveCol')) {
        button.textContent = '\u00d7';
        button.title = action.includes('dqRemoveRow') ? 'X\u00f3a h\u00e0ng' : 'X\u00f3a c\u1ed9t';
      } else if (action.includes('dqRemoveOpt')) {
        button.textContent = 'X';
        button.title = 'X\u00f3a l\u1ef1a ch\u1ecdn';
      } else if (action.includes('dqRemove')) {
        if (button.textContent.trim()) button.textContent = 'X\u00f3a';
        button.title = 'X\u00f3a c\u00e2u h\u1ecfi';
      } else if (action.includes('dqSaveCard')) {
        button.textContent = 'L\u01b0u c\u00e2u h\u1ecfi';
        button.title = 'L\u01b0u c\u00e2u h\u1ecfi';
      } else if (action.includes('dqAddSection')) {
        button.title = 'Th\u00eam ph\u1ea7n b\u00ean d\u01b0\u1edbi';
      } else if (action.includes('closeFormModal')) {
        if (button.classList.contains('icon-btn')) {
          button.title = '\u0110\u00f3ng';
        } else {
          button.textContent = 'H\u1ee7y b\u1ecf';
        }
      } else if (action.includes('createForm')) {
        button.textContent = '+  T\u1ea1o bi\u1ec3u m\u1eabu';
      }
    });

    modal.querySelectorAll('select option').forEach(option => {
      const value = option.value || option.textContent;
      const map = {
        choice: 'Tr\u1eafc nghi\u1ec7m',
        checkbox: 'H\u1ed9p ki\u1ec3m',
        dropdown: 'Menu th\u1ea3 xu\u1ed1ng',
        paragraph: '\u0110o\u1ea1n v\u0103n',
        short_text: 'Tr\u1ea3 l\u1eddi ng\u1eafn',
        long_text: '\u0110o\u1ea1n v\u0103n',
        text: 'Tr\u1ea3 l\u1eddi ng\u1eafn',
        upload: 'T\u1ea3i t\u1ec7p l\u00ean',
        rating: 'X\u1ebfp h\u1ea1ng',
        scale: 'Ph\u1ea1m vi tuy\u1ebfn t\u00ednh',
        grid_radio: 'L\u01b0\u1edbi tr\u1eafc nghi\u1ec7m',
        grid_checkbox: 'L\u01b0\u1edbi h\u1ed9p ki\u1ec3m',
        date: 'Ng\u00e0y',
        time: 'Gi\u1edd'
      };
      if (map[value]) option.textContent = map[value];
    });
  }

  function enforceGridRemoveButtons() {
    document.querySelectorAll('button[onclick*="dqRemoveRow"], button[onclick*="dqRemoveCol"], button[onclick*="editQRemoveRow"], button[onclick*="editQRemoveCol"]').forEach(button => {
      const action = button.getAttribute('onclick') || '';
      if (button.textContent.trim() !== '\u00d7') button.textContent = '\u00d7';
      button.title = action.includes('RemoveRow') ? 'X\u00f3a h\u00e0ng' : 'X\u00f3a c\u1ed9t';
      button.setAttribute('aria-label', button.title);
      button.style.width = '20px';
      button.style.height = '20px';
      button.style.minWidth = '20px';
      button.style.padding = '0';
      button.style.fontSize = '16px';
      button.style.fontWeight = '800';
      button.style.lineHeight = '1';
      button.style.display = 'flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
    });
  }

  let scheduled = false;
  function enforceSidebarLabels() {
    const labels = {
      'feedback-management': 'Qu\u1ea3n l\u00fd ph\u1ea3n h\u1ed3i',
      'staff-management': 'Qu\u1ea3n l\u00fd nh\u00e2n vi\u00ean'
    };
    Object.entries(labels).forEach(([page, label]) => {
      const el = document.querySelector(`.sidebar-item[data-page="${page}"] span`);
      if (el && el.textContent !== label) el.textContent = label;
    });
  }

  function repairPage() {
    scheduled = false;
    const scopes = [
      document.getElementById('page-content'),
      document.getElementById('create-form-modal'),
      document.getElementById('edit-form-modal'),
      document.getElementById('view-form-modal'),
      document.getElementById('submit-form-confirm'),
      document.getElementById('exit-form-confirm'),
      document.getElementById('toast-container')
    ].filter(Boolean);
    scopes.forEach(repairNode);
    enforceCreateModalText();
    enforceGridRemoveButtons();
    enforceSidebarLabels();
    document.title = repair(document.title);
  }

  function scheduleRepair() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(repairPage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleRepair);
  } else {
    scheduleRepair();
  }

  new MutationObserver(scheduleRepair).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'title', 'aria-label', 'value']
  });

  window.requestSubmitForm = function requestSubmitFormFixed() {
    const formItems = typeof getAllFormItems === 'function'
      ? getAllFormItems()
      : (typeof getAllFormQuestions === 'function' ? getAllFormQuestions() : []);
    if (typeof validateCreateFormItems === 'function') {
      const validationError = validateCreateFormItems(formItems);
      if (validationError) {
        if (typeof showToast === 'function') showToast(validationError, 'error');
        else alert(validationError);
        return;
      }
    }
    document.getElementById('submit-form-confirm')?.remove();
    if (typeof submitForm === 'function') submitForm(true);
  };

  window.showExitFormConfirm = function showExitFormConfirmFixed(name, desc, cat, hasQ) {
    document.getElementById('exit-form-confirm')?.remove();
    const d = document.createElement('div');
    d.id = 'exit-form-confirm';
    d.style.cssText = 'position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.42);backdrop-filter:blur(2px);padding:20px';
    d.innerHTML = `
      <div onclick="event.stopPropagation()" style="background:#fff;border-radius:20px;padding:28px 28px 20px;max-width:420px;width:min(92vw,420px);box-shadow:0 20px 60px rgba(0,0,0,0.18);animation:fadeInDown .15s ease;font-family:inherit">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <div style="width:40px;height:40px;border-radius:10px;background:#fef3c7;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
            <div style="font-size:15px;font-weight:700;color:#0f172a">Tho\u00e1t kh\u00f4ng l\u01b0u?</div>
            <div style="font-size:12.5px;color:#64748b;margin-top:2px">D\u1eef li\u1ec7u b\u1ea1n \u0111\u00e3 nh\u1eadp s\u1ebd b\u1ecb m\u1ea5t.</div>
          </div>
        </div>
        <div style="background:#f8fafc;border-radius:10px;padding:10px 14px;margin-bottom:18px;font-size:12.5px;color:#475569">
          ${name ? `<div>T\u00ean: <strong>${typeof formatRichText === 'function' ? formatRichText(name) : name}</strong></div>` : ''}
          ${hasQ ? `<div>\u0110\u00e3 th\u00eam c\u00e2u h\u1ecfi</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button onclick="document.getElementById('exit-form-confirm').remove();submitForm(true)"
            style="padding:10px;background:#00008B;color:#fff;border:none;border-radius:9px;font-size:13.5px;font-weight:700;cursor:pointer">
            L\u01b0u & T\u1ea1o bi\u1ec3u m\u1eabu
          </button>
          <button onclick="document.getElementById('exit-form-confirm').remove();forceCloseFormModal()"
            style="padding:10px;background:#fff;color:#ef4444;border:1.5px solid #fecaca;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer">
            Tho\u00e1t kh\u00f4ng l\u01b0u
          </button>
          <button onclick="document.getElementById('exit-form-confirm').remove()"
            style="padding:9px;background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;font-weight:500;cursor:pointer">
            Ti\u1ebfp t\u1ee5c ch\u1ec9nh s\u1eeda
          </button>
        </div>
      </div>`;
    document.body.appendChild(d);
    d.addEventListener('click', e => { if(e.target===d) d.remove(); });
    scheduleRepair();
  };
})();
