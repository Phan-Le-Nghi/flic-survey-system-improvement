// native fetch is used

async function test() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ten_dang_nhap: 'hoangnm', mat_khau: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  if (!token) {
    console.log('Login failed', loginData);
    return;
  }

  const res = await fetch('http://localhost:3000/api/approvals', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
}
test();
