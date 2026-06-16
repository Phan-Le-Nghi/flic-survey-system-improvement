const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/forms/trash/list',
  method: 'GET',
  // Normally requires auth, but let's see if we get 401 or what.
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.on('error', e => console.error(e));
req.end();
