const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.TAKETWO_DB_PATH = ':memory:';
process.env.DEMO_MODE = 'true';
const app = require('../server');
const { db } = require('../db');
const market = app.locals.marketplace;
const user = id => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const balance = id => db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(id);
const order = id => db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
const count = sql => db.prepare(sql).get().count;
let server, base;
const cookies = {};
before(async () => {
  db.exec("UPDATE voucher_campaigns SET usage_per_user = 1000"); // These regression cases deliberately reuse the fixture account.
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const id of [1, 2, 3, 4]) {
    const response = await fetch(base + '/api/auth/demo-switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: id }) });
    cookies[id] = response.headers.get('set-cookie').split(';')[0];
    assert.equal(response.status, 200);
  }
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
async function request(url, id, body, method = 'POST') {
  const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(id ? { cookie: cookies[id] } : {}) }, ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }) });
  return { status: response.status, body: await response.json() };
}
function product(price = 45000) {
  return db.prepare(`INSERT INTO products (seller_id, category_id, title, price, condition_level, campus_cluster, meetup_location, image_url, created_at)
    VALUES (2, 'books', 'Sách kiểm thử', ?, 'Tốt 90%', 'Hòa Lạc', 'Cổng trường', 'https://example.com/book.jpg', datetime('now'))`).run(price).lastInsertRowid;
}
function checkout(price = 45000, delivery = 'CAMPUS_MEETUP', voucher = 'SV5K') {
  return market.checkout(user(1), { product_id: product(price), delivery_type: delivery, delivery_address: 'KTX A', voucher_code: voucher }).order_id;
}
function delivering(id) {
  market.transition(user(2), id, 'accept');
  if (order(id).delivery_type === 'CAMPUS_MEETUP') market.transition(user(2), id, 'ship');
  else {
    market.transition(user(2), id, 'ready_pickup', { pickup_address: 'Cổng trường' });
    market.shipmentStatus(user(4), db.prepare('SELECT id FROM shipments WHERE order_id = ?').get(id).id, 'PICKED_UP');
  }
}

test('checkout uses server price, voucher and shipping and records one hold', () => {
  const before = balance(1);
  const id = checkout(45000, 'COURIER_ROOM');
  assert.equal(order(id).total_paid, 55000);
  assert.equal(balance(1).available_balance, before.available_balance - 55000);
  assert.equal(balance(1).escrow_balance, before.escrow_balance + 55000);
  assert.equal(db.prepare('SELECT status FROM products WHERE id = ?').get(order(id).product_id).status, 'RESERVED');
});
test('same product requested twice creates only one order; no balance change on retry', async () => {
  const id = product(10000);
  const body = { product_id: id, delivery_type: 'CAMPUS_MEETUP' };
  const responses = await Promise.all([request('/api/orders/checkout', 1, body), request('/api/orders/checkout', 1, body)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders WHERE product_id = ?').get(id).count, 1);
});
test('reject self-buy, insufficient money, invalid delivery and unsafe monetary values', async () => {
  const id = product();
  assert.throws(() => market.checkout(user(2), { product_id: id, delivery_type: 'CAMPUS_MEETUP' }), /tự mua/);
  assert.throws(() => checkout(100000000), /không đủ/);
  assert.throws(() => market.checkout(user(1), { product_id: id, delivery_type: 'FREE' }), /không hợp lệ/);
  for (const amount of [-20000, '10000x', 10000.5, 'Infinity', true, 100000001]) {
    assert.equal((await request('/api/wallet/topup', 1, { amount })).status, 400);
  }
  assert.equal((await request('/api/products', 2, { title: 'Bad price', price: 4999, category_id: 'books', condition_level: 'good', campus_cluster: 'Hòa Lạc', meetup_location: 'Gate' })).status, 400);
});
test('strict state machine and ownership; no early ship, confirm or dispute', async () => {
  const id = checkout(5000);
  for (const action of ['ship', 'confirm', 'dispute']) {
    assert.equal((await request(`/api/orders/${id}/${action}`, action === 'ship' ? 2 : 1, { reason: 'Lỗi' })).status, 409);
  }
  assert.equal((await request(`/api/orders/${id}/accept`, 3)).status, 403);
  assert.equal((await request(`/api/orders/${id}/accept`, 2)).status, 200);
  assert.equal((await request(`/api/orders/${id}/accept`, 2)).status, 409);
  assert.equal((await request(`/api/orders/${id}/ship`, 2)).status, 200);
  assert.equal((await request(`/api/orders/${id}/confirm`, 3)).status, 403);
});
test('confirm releases exactly once and voucher subsidy reconciles with payout', async () => {
  const id = checkout(45000, 'COURIER_ROOM'); delivering(id);
  const seller = balance(2), buyer = balance(1), points = user(1).eco_points;
  const first = await request(`/api/orders/${id}/confirm`, 1);
  assert.equal(first.status, 200);
  assert.equal(first.body.seller_payout, 43650);
  assert.equal(first.body.commission, 1350);
  assert.equal(balance(2).available_balance, seller.available_balance + 43650);
  assert.equal(balance(1).escrow_balance, buyer.escrow_balance - 55000);
  assert.equal(user(1).eco_points, points + 50);
  const platform = db.prepare('SELECT SUM(amount) AS total FROM platform_entries WHERE order_id = ?').get(id).total;
  assert.equal(first.body.seller_payout + platform, 55000);
  const after = balance(2);
  assert.equal((await request(`/api/orders/${id}/confirm`, 1)).status, 409);
  assert.deepEqual(balance(2), after);
  assert.equal(user(1).eco_points, points + 50);
});
test('dispute stops expiry; refund once restores available balance and product', async () => {
  const id = checkout(5000); delivering(id);
  assert.equal((await request(`/api/orders/${id}/dispute`, 1, { reason: 'Sai mô tả' })).status, 200);
  assert.equal(order(id).auto_confirm_deadline, null);
  market.expire('2099-01-01T00:00:00.000Z');
  assert.equal(order(id).status, 'DISPUTED');
  assert.equal((await request(`/api/orders/${id}/simulate-5days`, 1)).status, 409);
  assert.equal((await request(`/api/orders/${id}/admin-resolve`, 1, { decision: 'REFUND_BUYER', reason: 'Thẩm định chứng cứ và hoàn theo chính sách' })).status, 403);
  assert.equal((await request(`/api/orders/${id}/admin-resolve`, 4, { decision: 'UNKNOWN' })).status, 400);
  db.prepare('UPDATE disputes SET admin_reviewed = 1 WHERE order_id = ?').run(id);
  const before = balance(1);
  assert.equal((await request(`/api/orders/${id}/admin-resolve`, 4, { decision: 'REFUND_BUYER', reason: 'Thẩm định chứng cứ và hoàn theo chính sách' })).status, 200);
  const after = balance(1);
  assert.equal(after.available_balance, before.available_balance + (order(id).total_paid - order(id).retained_fee));
  assert.equal(db.prepare('SELECT status FROM products WHERE id = ?').get(order(id).product_id).status, 'AVAILABLE');
  assert.equal((await request(`/api/orders/${id}/admin-resolve`, 4, { decision: 'REFUND_BUYER', reason: 'Thẩm định chứng cứ và hoàn theo chính sách' })).status, 409);
  assert.deepEqual(balance(1), after);
});
test('admin release is allowed only once for disputed order', () => {
  const id = checkout(5000); delivering(id);
  market.transition(user(1), id, 'dispute', { reason: 'Chưa nhận đồ' });
  db.prepare('UPDATE disputes SET admin_reviewed = 1 WHERE order_id = ?').run(id);
  market.transition(user(4), id, 'resolve', { decision: 'RELEASE_SELLER', reason: 'Thẩm định chứng cứ và giải ngân' });
  assert.equal(order(id).escrow_status, 'RELEASED');
  assert.equal(order(id).buyer_confirmed, 0);
  assert.throws(() => market.transition(user(4), id, 'resolve', { decision: 'RELEASE_SELLER', reason: 'Thẩm định chứng cứ và giải ngân' }), /Trạng thái/);
});
test('demo expiry requires participation and repeated expiry never pays twice', async () => {
  const id = checkout(5000); delivering(id);
  assert.equal((await request(`/api/orders/${id}/simulate-5days`, 3)).status, 403);
  assert.equal((await request(`/api/orders/${id}/simulate-5days`, 1)).status, 200);
  const seller = balance(2);
  assert.equal(order(id).buyer_confirmed, 0);
  assert.equal((await request(`/api/orders/${id}/simulate-5days`, 1)).status, 409);
  market.expire('2099-01-01T00:00:00.000Z');
  assert.deepEqual(balance(2), seller);
});
test('mid-transaction failure rolls back wallets, order, ledger and eco points', () => {
  const id = checkout(5000); delivering(id);
  const seller = balance(2), buyer = balance(1), points = user(1).eco_points;
  const ledger = count('SELECT COUNT(*) AS count FROM wallet_transactions');
  db.exec("CREATE TRIGGER fail_platform BEFORE INSERT ON platform_entries BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
  try { assert.throws(() => market.transition(user(1), id, 'confirm'), /injected failure/); }
  finally { db.exec('DROP TRIGGER fail_platform'); }
  assert.deepEqual(balance(2), seller); assert.deepEqual(balance(1), buyer);
  assert.equal(user(1).eco_points, points);
  assert.equal(order(id).status, 'DELIVERING');
  assert.equal(count('SELECT COUNT(*) AS count FROM wallet_transactions'), ledger);
});
test('buy package then bump consumes one credit and rejects unavailable product', async () => {
  const before = balance(2);
  const id = product();
  assert.equal((await request(`/api/products/${id}/bump`, 2, { package_id: 'bump_saver' })).status, 200);
  assert.equal(balance(2).available_balance, before.available_balance - 49000);
  assert.equal(balance(2).boost_credits, before.boost_credits + 4);
  db.prepare("UPDATE products SET status = 'RESERVED' WHERE id = ?").run(id);
  assert.equal((await request(`/api/products/${id}/bump`, 2)).status, 409);
});
test('safe user response, private ledgers, and idempotent account-scoped favorites', async () => {
  assert.equal((await request('/api/me', 1, null, 'GET')).body.user.password, undefined);
  assert.equal((await request('/api/wallet', null, null, 'GET')).status, 401);
  assert.equal((await request('/api/admin/metrics', 1, null, 'GET')).status, 403);
  const id = product();
  for (let i = 0; i < 2; i++) assert.equal((await request(`/api/favorites/${id}`, 1, {}, 'PUT')).status, 200);
  assert.equal((await request('/api/favorites', 1, null, 'GET')).body.filter(p => p.id === id).length, 1);
  assert.equal((await request('/api/favorites', 3, null, 'GET')).body.length, 0);
  for (let i = 0; i < 2; i++) assert.equal((await request(`/api/favorites/${id}`, 1, {}, 'DELETE')).status, 200);
});
test('active-order listing cannot be removed; completed listing is soft-hidden', async () => {
  const id = checkout(5000), pid = order(id).product_id;
  assert.equal((await request(`/api/products/${pid}/delete`, 2)).status, 409);
  delivering(id); market.transition(user(1), id, 'confirm');
  assert.equal((await request(`/api/products/${pid}/delete`, 2)).status, 200);
  assert.ok(order(id));
  assert.equal((await request(`/api/products/${pid}`, 1, null, 'GET')).status, 404);
  assert.equal((await request(`/api/products/${pid}`, 2, null, 'GET')).status, 200);
  assert.equal((await request('/api/products?status=HIDDEN&seller_id=2', 1, null, 'GET')).body.length, 0);
});
test('OTP failures increment security counter even when HTTP request is rejected', async () => {
  const email = 'tuanvhhe194875@fpt.edu.vn';
  assert.equal((await request('/api/auth/send-otp', null, { email, type: 'login' })).status, 200);
  const hashBefore = db.prepare('SELECT * FROM otp_codes WHERE email = ?').get(email).code_hash;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await request('/api/auth/login', null, { email, login_type: 'otp', otp_code: 'not-a-code' });
    assert.equal(response.status, 400);
    assert.equal(db.prepare('SELECT attempts FROM otp_codes WHERE email = ?').get(email).attempts, attempt);
  }
  assert.equal((await request('/api/auth/login', null, { email, login_type: 'otp', otp_code: 'not-a-code' })).status, 400);
  assert.equal(db.prepare('SELECT * FROM otp_codes WHERE email = ?').get(email), undefined);
  assert.ok(hashBefore.startsWith('$2'));
});
test('registration provisions user, wallet and welcome ledger atomically', async () => {
  const before = count('SELECT COUNT(*) AS count FROM users');
  db.exec("CREATE TRIGGER fail_welcome BEFORE INSERT ON wallet_transactions WHEN NEW.type = 'BONUS' BEGIN SELECT RAISE(ABORT, 'welcome failure'); END;");
  try {
    assert.equal((await request('/api/auth/register', null, { email: 'new-student@fpt.edu.vn', name: 'New Student', password: 'Student@123', otp_code: '123456' })).status, 500);
    assert.equal(count('SELECT COUNT(*) AS count FROM users'), before);
    assert.equal(db.prepare('SELECT * FROM users WHERE email = ?').get('new-student@fpt.edu.vn'), undefined);
  } finally { db.exec('DROP TRIGGER fail_welcome'); }
  const registered = await request('/api/auth/register', null, { email: 'new-student@fpt.edu.vn', name: 'New Student', password: 'Student@123', otp_code: '123456', role: 'ADMIN' });
  assert.equal(registered.status, 200); assert.equal(registered.body.user.role, 'BUYER');
  assert.equal(registered.body.wallet.available_balance, 100000); assert.equal(registered.body.user.password, undefined);
});
test('local scheduler settles overdue orders at startup exactly once', () => {
  const id = checkout(5000); delivering(id);
  db.prepare('UPDATE orders SET auto_confirm_deadline = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', id);
  const before = balance(2);
  const stop = app.locals.startScheduler(); stop();
  assert.equal(order(id).status, 'COMPLETED_AUTO');
  assert.equal(order(id).buyer_confirmed, 0);
  assert.equal(balance(2).available_balance, before.available_balance + 4850);
  const after = balance(2);
  const stopAgain = app.locals.startScheduler(); stopAgain();
  assert.deepEqual(balance(2), after);
});
test('malformed text fields and repeated filters return controlled 400 responses', async () => {
  assert.equal((await request('/api/auth/login', null, { email: { invalid: true }, password: 'test' })).status, 400);
  assert.equal((await request('/api/products?search=one&search=two', null, null, 'GET')).status, 400);
  assert.equal((await request('/api/orders/checkout', 1, { product_id: product(), delivery_type: ['CAMPUS_MEETUP'] })).status, 400);
});
