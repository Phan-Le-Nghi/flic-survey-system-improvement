const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/forms/trash/list',
  method: 'GET',
  // Simulate no token. If it returns 401, maybe the frontend has no token? 
  // No, the frontend definitely has a token if other things work.
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    if (res.statusCode === 200) {
      try {
        const dbItems = JSON.parse(data);
        console.log("Parsed:", dbItems);
        const trashItems = dbItems.map(f => ({
          id: String(f.id),
          name: f.ten_form,
          cat: f.danh_muc || '',
          deletedBy: f.nguoi_xoa || 'Hệ thống',
          deletedAt: new Date(f.ngay_xoa).getTime(),
          deleteReason: f.ly_do_xoa || 'Không có lý do'
        }));
        console.log("Mapped:", trashItems);
      } catch (e) {
        console.error("Parse/map error:", e);
      }
    } else {
      console.log("Body:", data);
    }
  });
});
req.on('error', e => console.error(e));
req.end();