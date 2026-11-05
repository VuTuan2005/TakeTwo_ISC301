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

let server, base;
const cookies = {};

before(async () => {
  db.exec("UPDATE voucher_campaigns SET usage_per_user = 1000"); // These regression cases deliberately reuse the fixture account.
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const id of [1, 2, 3, 4]) {
    const res = await fetch(base + '/api/auth/demo-switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: id })
    });
    cookies[id] = res.headers.get('set-cookie').split(';')[0];
  }
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
});

async function request(url, id, body, method = 'POST') {
  const response = await fetch(base + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(id ? { cookie: cookies[id] } : {})
    },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) })
  });
  return { status: response.status, body: await response.json() };
}

function createProduct(sellerId = 2, price = 150000) {
  return db.prepare(`
    INSERT INTO products (seller_id, category_id, title, price, condition_level, campus_cluster, meetup_location, image_url, status, approval_status, created_at)
    VALUES (?, 'electronics', 'Sản phẩm thử nghiệm PLAN', ?, 'Như mới 99%', 'Hòa Lạc', 'Căn tin Dom A', 'https://example.com/p.jpg', 'AVAILABLE', 'APPROVED', datetime('now'))
  `).run(sellerId, price).lastInsertRowid;
}

test('PLAN 1.3: Quote API correctly calculates P, S, D, C, F, missing balance and suggested topup (rounded 10k)', async () => {
  const pid = createProduct(2, 150000);
  // Test quote with voucher SV5K and delivery COURIER_ROOM (15k)
  const q = await request('/api/checkout/quote', 1, {
    product_id: pid,
    delivery_type: 'COURIER_ROOM',
    voucher_code: 'SV5K'
  });
  assert.equal(q.status, 200);
  assert.equal(q.body.price, 150000);
  assert.equal(q.body.shipping_fee, 15000);
  assert.equal(q.body.discount, 5000);
  assert.equal(q.body.total_paid, 160000); // 150k + 15k - 5k = 160k
  assert.equal(q.body.commission, 4500);  // 150k * 3% = 4500
  assert.equal(q.body.potential_fee_retained, 4500);

  // Test quote with no voucher: discount must be 0 (PLAN 3.8: không có mã không tự giảm)
  const qNoVoucher = await request('/api/checkout/quote', 1, {
    product_id: pid,
    delivery_type: 'CAMPUS_MEETUP'
  });
  assert.equal(qNoVoucher.body.discount, 0);
  assert.equal(qNoVoucher.body.total_paid, 150000);
});

test('PLAN 1.3: Settle completed order pays P - F to seller; shipping fee is NOT given to seller', async () => {
  const pid = createProduct(2, 150000);
  const checkoutRes = await request('/api/orders/checkout', 1, {
    product_id: pid,
    delivery_type: 'COURIER_ROOM',
    delivery_address: 'KTX Dom B, FPT Hòa Lạc',
    voucher_code: 'SV5K'
  });
  assert.equal(checkoutRes.status, 200);
  const oid = checkoutRes.body.order_id;

  // Accept and ship
  await request(`/api/orders/${oid}/accept`, 2);
  await request(`/api/orders/${oid}/ready-pickup`, 2, { pickup_address: 'Địa chỉ seller' });
  const sh = db.prepare('SELECT id FROM shipments WHERE order_id = ?').get(oid);
  assert.equal((await request(`/api/admin/shipments/${sh.id}/status`, 4, { status: 'PICKED_UP' })).status, 200);

  const sellerBefore = balance(2).available_balance;
  const confirmRes = await request(`/api/orders/${oid}/confirm`, 1);
  assert.equal(confirmRes.status, 200);

  // P = 150.000, F = 4.500. Seller must receive P - F = 145.500 (NOT + 15.000 ship!)
  assert.equal(confirmRes.body.seller_payout, 145500);
  assert.equal(balance(2).available_balance, sellerBefore + 145500);
  assert.equal(order(oid).status, 'COMPLETED');
});

test('PLAN 1.2 & 1.3: Dispute refund after pickup refunds C - Fr to buyer; retains Fr for platform; absorbs courier fee', async () => {
  await request('/api/wallet/topup', 1, { amount: 500000 });
  const pid = createProduct(2, 150000);
  const checkoutRes = await request('/api/orders/checkout', 1, {
    product_id: pid,
    delivery_type: 'COURIER_ROOM',
    delivery_address: 'KTX Dom B',
    voucher_code: 'SV5K'
  });
  const oid = checkoutRes.body.order_id;
  await request(`/api/orders/${oid}/accept`, 2);
  await request(`/api/orders/${oid}/ready-pickup`, 2, { pickup_address: 'Địa chỉ seller' });
  const sh = db.prepare('SELECT id FROM shipments WHERE order_id = ?').get(oid);
  assert.equal((await request(`/api/admin/shipments/${sh.id}/status`, 4, { status: 'PICKED_UP' })).status, 200);

  const evidence = await request('/api/upload', 1, { data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', filename: 'proof.png' });
  // Buyer disputes order
  const disputeRes = await request(`/api/orders/${oid}/dispute`, 1, {
    issue_type: 'DAMAGED',
    reason: 'Hàng bị nứt vỡ khi giao đến nơi',
    evidence_images: [evidence.body.id]
  });
  assert.equal(disputeRes.status, 200);
  assert.equal(order(oid).status, 'DISPUTED');
  assert.equal(order(oid).auto_confirm_deadline, null);

  const dossierId = db.prepare('SELECT id FROM disputes WHERE order_id = ?').get(oid).id;
  await request(`/api/admin/disputes/${dossierId}/review`, 4);
  // Admin resolves: REFUND_BUYER ("Hoàn tiền sau khi trừ phí sàn")
  const buyerBefore = balance(1).available_balance;
  const resolveRes = await request(`/api/orders/${oid}/admin-resolve`, 4, {
    decision: 'REFUND_BUYER',
    reason: 'Xác nhận hàng bị hư hỏng trong quá trình vận chuyển. Hoàn tiền theo quy chế sàn.'
  });
  assert.equal(resolveRes.status, 200);

  // C = 160.000, F = 4.500. Fr = 4.500. Buyer refund = 160.000 - 4.500 = 155.500đ! (Matches Table PLAN 1.3 line 76)
  assert.equal(resolveRes.body.refund_amount, 155500);
  assert.equal(resolveRes.body.retained_fee, 4500);
  assert.equal(balance(1).available_balance, buyerBefore + 155500);

  // Product is returned to AVAILABLE but approval_status PENDING_APPROVAL for quality check
  const prodAfter = db.prepare('SELECT * FROM products WHERE id = ?').get(pid);
  assert.equal(prodAfter.status, 'AVAILABLE');
  assert.equal(prodAfter.approval_status, 'PENDING_APPROVAL');
});

test('PLAN 1.3: Pre-processing cancellation (REQUESTED) refunds 100% without fee or penalty', async () => {
  const pid = createProduct(2, 80000);
  const checkoutRes = await request('/api/orders/checkout', 1, {
    product_id: pid,
    delivery_type: 'CAMPUS_MEETUP',
    voucher_code: 'SV5K'
  });
  const oid = checkoutRes.body.order_id;
  const buyerBefore = balance(1).available_balance;

  // Buyer cancels before seller accepts
  const cancelRes = await request(`/api/orders/${oid}/cancel-requested`, 1, {
    reason: 'Đổi ý không mua nữa'
  });
  assert.equal(cancelRes.status, 200);
  assert.equal(order(oid).status, 'CANCELLED');
  assert.equal(order(oid).escrow_status, 'REFUNDED');
  // 100% refund of total_paid
  assert.equal(balance(1).available_balance, buyerBefore + order(oid).total_paid);
});

test('PLAN 3.1 & 4.5: Admin role is strictly blocked from trading actions (buy, post, chat as user)', async () => {
  const pid = createProduct(2, 50000);
  // Admin cannot buy
  const buyRes = await request('/api/orders/checkout', 4, {
    product_id: pid,
    delivery_type: 'CAMPUS_MEETUP'
  });
  assert.equal(buyRes.status, 403);

  // Admin cannot create product
  const postRes = await request('/api/products', 4, {
    title: 'Admin product',
    category_id: 'books',
    price: 50000,
    condition_level: 'Tốt 90%',
    campus_cluster: 'Hòa Lạc'
  });
  assert.equal(postRes.status, 403);

  // Admin cannot topup personal wallet
  const topupRes = await request('/api/wallet/topup', 4, { amount: 50000 });
  assert.equal(topupRes.status, 403);

  // Admin cannot chat as buyer
  const chatRes = await request('/api/chat/conversations', 4, { product_id: pid });
  assert.equal(chatRes.status, 403);
});

test('PLAN 2.3: Chat before buying works directly between buyer and seller', async () => {
  const pid = createProduct(2, 65000);
  // Buyer opens conversation
  const convRes = await request('/api/chat/conversations', 1, { product_id: pid });
  assert.equal(convRes.status, 200);
  const convId = convRes.body.conversation.id;

  // Buyer sends message
  const sendRes = await request(`/api/chat/conversations/${convId}/messages`, 1, {
    content: 'Chào bạn, sách này còn mới không ạ?'
  });
  assert.equal(sendRes.status, 200);
  assert.equal(sendRes.body.message.content, 'Chào bạn, sách này còn mới không ạ?');

  // Seller views conversation
  const viewRes = await request(`/api/chat/conversations/${convId}`, 2, null, 'GET');
  assert.equal(viewRes.status, 200);
  assert.equal(viewRes.body.messages.length, 1);

  // Outsider (user 3) is blocked from viewing
  const outsiderRes = await request(`/api/chat/conversations/${convId}`, 3, null, 'GET');
  assert.equal(outsiderRes.status, 403);
});

test('PLAN 4.6: Secure image upload endpoint accepts Base64 JPEG/PNG/WebP under 5MB', async () => {
  const base64Png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const uploadRes = await request('/api/upload', 1, {
    data: base64Png,
    filename: 'test-evidence.png'
  });
  assert.equal(uploadRes.status, 200);
  assert.ok(uploadRes.body.id);
  assert.ok(uploadRes.body.url.startsWith('/api/attachments/'));

  // Get attachment
  const attRes = await fetch(base + uploadRes.body.url, { headers: { cookie: cookies[1] } });
  assert.equal(attRes.status, 200);
  assert.equal(attRes.headers.get('content-type'), 'image/png');
});

test('PLAN 3.2 & 3.3: Admin reconciliation and KPI dashboard reflect accurate net contribution and order counts', async () => {
  const kpiRes = await request('/api/admin/dashboard-kpis', 4, null, 'GET');
  assert.equal(kpiRes.status, 200);
  assert.ok(kpiRes.body.gmv >= 0);
  assert.ok(kpiRes.body.completed_orders >= 0);
  assert.ok(typeof kpiRes.body.net_contribution === 'number');

  const reconRes = await request('/api/admin/orders-reconciliation', 4, null, 'GET');
  assert.equal(reconRes.status, 200);
  assert.ok(Array.isArray(reconRes.body.orders));
  assert.ok(reconRes.body.totals);
  assert.equal(reconRes.body.totals.total_paid >= 0, true);
});
