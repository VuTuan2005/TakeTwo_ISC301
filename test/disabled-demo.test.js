const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.TAKETWO_DB_PATH = ':memory:';
process.env.DEMO_MODE = 'false';
const app = require('../server');
const { db } = require('../db');
test('demo shortcuts are blocked when disabled; real password login remains available', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function post(path, body, cookie) {
    return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  }
  try {
    const login = await post('/api/auth/login', { email: 'tuanvhhe194875@fpt.edu.vn', password: 'Student@123' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    for (const [path, body] of [
      ['/api/auth/demo-switch', { user_id: 4 }], ['/api/auth/google', { email: 'student@fpt.edu.vn' }],
      ['/api/auth/send-otp', { email: 'student@fpt.edu.vn' }], ['/api/wallet/topup', { amount: 10000 }],
      ['/api/wallet/withdraw', { amount: 20000, bank_account: '123' }], ['/api/orders/1/simulate-5days', {}]
    ]) assert.equal((await post(path, body, cookie)).status, 403, path);
    assert.equal((await post('/api/auth/login', { email: 'admin@taketwo.vn', password: '123456' })).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); db.close(); }
});
