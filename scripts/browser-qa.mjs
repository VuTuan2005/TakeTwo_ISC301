// Local browser regression. Uses the same zero-dependency browser driver as the design inspector.
// Run with: node scripts/browser-qa.mjs <path-to-skill-cdp.mjs> [base-url]
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]) throw new Error('Pass the design skill scripts/lib/cdp.mjs path.');
const { Browser, sleep } = await import(pathToFileURL(process.argv[2]).href);
const base = process.argv[3] || 'http://127.0.0.1:3000';
const out = 'scratch/browser-qa'; mkdirSync(out, { recursive: true });
const browser = await Browser.launch();
const page = await browser.newPage({ width: 1440, height: 900 });
const results = [];
async function waitFor(fn, label) {
  for (let i = 0; i < 100; i++) { if (await page.eval(fn)) return; await sleep(100); }
  throw new Error(`Timed out: ${label}`);
}
async function route(value) {
  await page.eval(value => { location.hash = value; }, value);
  await waitFor(() => [...document.querySelectorAll('main > section')].filter(el => !el.hidden).length === 1, 'one visible screen');
  await sleep(150);
}
async function snapshot(name, width = 1440) {
  await page.setViewport({ width, height: width === 390 ? 844 : width === 768 ? 1024 : 900, mobile: width === 390 });
  await sleep(100);
  const state = await page.eval(() => ({
    route: location.hash,
    width: innerWidth,
    document: document.documentElement.scrollWidth,
    main: document.querySelector('main').clientWidth,
    mainScroll: document.querySelector('main').scrollWidth,
    visible: [...document.querySelectorAll('main > section')].filter(el => !el.hidden).map(el => el.id),
    title: document.querySelector('main > section:not([hidden]) h1')?.textContent,
    modal: document.querySelectorAll('.fintab-modal-overlay.open').length,
    errorText: document.querySelector('main > section:not([hidden]) .form-error')?.textContent
  }));
  assert.equal(state.visible.length, 1, name);
  assert.ok(state.document <= state.width + 1, `document overflow ${name}: ${JSON.stringify(state)}`);
  assert.ok(state.mainScroll <= state.main + 1, `main overflow ${name}: ${JSON.stringify(state)}`);
  assert.ok(state.modal <= 1);
  assert.ok(state.title, `missing title: ${name}`);
  await page.screenshot({ path: `${out}/${name}-${width}.jpg` });
  results.push({ name, ...state });
}
try {
  await page.goto(base, { settleMs: 300 });
  await waitFor(() => document.querySelector('#overviewTasks')?.children.length > 0, 'initialization');
  await page.eval(() => onUserSwitch(1));
  await snapshot('overview');
  await route('marketplace');
  await waitFor(() => document.querySelectorAll('#productGrid article').length > 0, 'products');
  await snapshot('marketplace');
  await page.eval(() => document.querySelector('#productGrid .save-button').click());
  await waitFor(() => document.querySelector('#productGrid .save-button')?.getAttribute('aria-pressed') === 'true', 'favorite saved');
  await route('favorites');
  await waitFor(() => document.querySelectorAll('#favoritesGrid article').length > 0, 'favorites list');
  await snapshot('favorites');
  await page.eval(() => onUserSwitch(2));
  await route('store');
  await waitFor(() => document.querySelectorAll('#storeGrid article').length > 0, 'seller store');
  await snapshot('store');
  await page.eval(() => openCreateListingModal());
  await waitFor(() => !document.querySelector('#view-create').hidden, 'listing screen');
  await snapshot('create');
  await page.eval(() => submitCreateListing());
  assert.ok(await page.eval(() => document.querySelector('#newPostTitleError')?.textContent));
  const listingTitle = `Sách demo browser ${Date.now()} <b>nguyên văn</b>`;
  await page.eval(title => {
    document.querySelector('#newPostTitle').value = title;
    document.querySelector('#newPostPrice').value = '10000';
    document.querySelector('#newPostMeetupLocation').value = 'Cổng KTX A';
    document.querySelector('#newPostDefectNote').value = 'Mô tả <img src=x onerror="window.injected=true">';
    return submitCreateListing();
  }, listingTitle);
  await waitFor(() => location.hash === '#store', 'listing created');
  const productId = await page.eval(async title => (await (await apiFetch('/api/products?seller_id=2')).json()).find(p => p.title === title)?.id, listingTitle);
  assert.ok(productId);
  await page.eval(() => onUserSwitch(1));
  await route(`product/${productId}`);
  await waitFor(() => document.querySelector('#productDetail h1')?.textContent.includes('nguyên văn'), 'detail');
  assert.equal(await page.eval(() => window.injected), undefined);
  assert.equal(await page.eval(() => document.querySelector('#productDetail h1 b')), null);
  await snapshot('product');
  await page.eval(id => openCheckoutModal(id), productId);
  await waitFor(() => !document.querySelector('#view-checkout').hidden, 'checkout screen');
  await snapshot('checkout');
  await page.eval(() => submitCheckout());
  await waitFor(() => location.hash === '#orders', 'checkout success');
  const orderId = await page.eval(async id => (await (await apiFetch('/api/orders')).json()).find(o => o.product_id === id)?.id, productId);
  assert.ok(orderId);
  await route(`order/${orderId}`);
  await waitFor(() => document.querySelector('#orderDetail h1'), 'order detail');
  await snapshot('order-requested');
  await page.eval(() => onUserSwitch(2));
  await page.eval(id => sellerAcceptOrder(id), orderId);
  await waitFor(() => document.querySelector('#orderDetail .state-ACCEPTED'), 'accepted');
  // Replace native dialogs for this isolated demo fixture only.
  await page.eval(() => { window.prompt = () => 'TK-QA-123'; window.confirm = () => true; });
  await page.eval(id => sellerShipOrder(id), orderId);
  await waitFor(() => document.querySelector('#orderDetail .state-DELIVERING'), 'shipped');
  await page.eval(() => onUserSwitch(1));
  await snapshot('order-delivering');
  await page.eval(id => buyerConfirmOrder(id), orderId);
  await waitFor(() => document.querySelector('#orderDetail .state-COMPLETED'), 'completed');
  await snapshot('order-completed');
  await route('transactions'); await waitFor(() => document.querySelectorAll('#transactionsTableBody tr').length > 0, 'ledger');
  await snapshot('wallet');
  await page.eval(() => openVoucherReceiptModal(0));
  assert.equal(await page.eval(() => document.querySelectorAll('.fintab-modal-overlay.open').length), 1);
  await page.eval(() => openTopupModal());
  assert.equal(await page.eval(() => document.querySelectorAll('.fintab-modal-overlay.open').length), 1);
  await page.eval(() => closeModal('modalTopup'));
  await route('packages'); await waitFor(() => document.querySelectorAll('#packagesGrid article').length === 3, 'packages');
  await snapshot('packages');
  await page.eval(() => onUserSwitch(4));
  await route('metrics'); await waitFor(() => document.querySelector('#metricsContent dl'), 'metrics');
  await snapshot('metrics');
  await route('disputes'); await waitFor(() => document.querySelector('#disputesList')?.children.length > 0, 'disputes');
  await snapshot('disputes');
  // A separate order exercises dispute -> admin refund through the visible UI.
  await page.eval(() => onUserSwitch(2));
  const disputedProduct = await page.eval(async () => (await (await apiFetch('/api/products', { method: 'POST', body: {
    title: 'Sách demo khiếu nại', category_id: 'books', condition_level: 'Tốt 90%', price: 10000,
    campus_cluster: 'Hòa Lạc', meetup_location: 'KTX A', defect_note: 'Dữ liệu kiểm thử trình duyệt'
  } })).json()).product_id);
  await page.eval(() => onUserSwitch(1));
  const disputedOrder = await page.eval(async id => (await (await apiFetch('/api/orders/checkout', { method: 'POST', body: { product_id: id, delivery_type: 'CAMPUS_MEETUP' } })).json()).order_id, disputedProduct);
  await page.eval(() => onUserSwitch(2));
  await route(`order/${disputedOrder}`);
  await page.eval(id => sellerAcceptOrder(id), disputedOrder);
  await page.eval(id => sellerShipOrder(id), disputedOrder);
  await page.eval(() => onUserSwitch(1));
  await page.eval(id => { openDisputeModal(id); document.querySelector('#disputeReasonInput').value = 'Sách rách gáy, cần đối chiếu.'; return submitDispute(); }, disputedOrder);
  await waitFor(() => document.querySelector('#orderDetail .state-DISPUTED'), 'disputed');
  await snapshot('order-disputed');
  await page.eval(() => onUserSwitch(4));
  await route('disputes');
  await waitFor(() => document.querySelector('#disputesList .task-row'), 'admin dispute queue');
  await snapshot('disputes-queue');
  await route(`order/${disputedOrder}`);
  await page.eval(id => resolveDisputeAdmin(id, 'REFUND_BUYER'), disputedOrder);
  await waitFor(() => document.querySelector('#orderDetail .state-CANCELLED'), 'refunded');
  await snapshot('order-refunded');
  // Seed order exercises simulated expiry with no waiting or changes to machine time.
  await page.eval(() => onUserSwitch(1));
  const expiringOrder = await page.eval(async () => (await (await apiFetch('/api/orders')).json()).find(o => o.status === 'DELIVERING')?.id);
  if (expiringOrder) {
    await route(`order/${expiringOrder}`);
    await page.eval(id => simulate5Days(id), expiringOrder);
    await waitFor(() => document.querySelector('#orderDetail .state-COMPLETED_AUTO'), 'auto-confirm');
    await snapshot('order-auto-completed');
  }
  await page.eval(() => onUserSwitch(1));
  assert.equal(await page.eval(() => document.querySelector('#nav-metrics').hidden), true);
  assert.equal(await page.eval(() => document.querySelector('#view-metrics').hidden), true);
  for (const width of [768, 390]) {
    await route('overview'); await snapshot('overview', width);
    await route('marketplace'); await waitFor(() => document.querySelectorAll('#productGrid article').length > 0, 'mobile products'); await snapshot('marketplace', width);
    await route('orders'); await snapshot('orders', width);
    await route(`order/${orderId}`); await snapshot('order', width);
    await route('transactions'); await snapshot('wallet', width);
    await route('packages'); await snapshot('packages', width);
    await page.eval(() => openCreateListingModal()); await snapshot('create', width);
  }
  await route('marketplace'); await route('packages');
  await page.eval(() => history.back()); await waitFor(() => location.hash === '#marketplace', 'browser back');
  await page.goto(base + '/#transactions', { settleMs: 300 });
  await waitFor(() => document.querySelector('#transactionsTableBody tr'), 'reload keeps route');
  assert.equal(await page.eval(() => location.hash), '#transactions');
  // An older response from account 1 must not repaint account 2's private screen.
  await page.eval(async () => {
    const original = window.fetch;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let held = false;
    window.fetch = async (url, options) => {
      const response = await original(url, options);
      if (!held && String(url) === '/api/orders') { held = true; await gate; }
      return response;
    };
    const oldRead = loadOrders();
    await new Promise(resolve => setTimeout(resolve, 30));
    await onUserSwitch(2);
    release(); await oldRead;
    window.fetch = original;
  });
  assert.equal(await page.eval(() => currentUser.id), 2);
  await page.eval(() => handleLogout());
  await page.eval(() => { openLoginModal(); document.querySelector('#loginEmail').value = 'tuanvhhe194875@fpt.edu.vn'; document.querySelector('#loginPassword').value = 'bad-password'; return submitAuthLogin(); });
  assert.ok(await page.eval(() => document.querySelector('#modalLogin .form-error')?.textContent.includes('Mật khẩu')));
  await page.screenshot({ path: `${out}/auth-error-390.jpg` });
  await page.eval(() => { document.querySelector('#loginPassword').value = 'Student@123'; return submitAuthLogin(); });
  assert.equal(await page.eval(() => currentUser.id), 1);
  await route('transactions');
  // A real network failure produces a visible retry control instead of stale/private data.
  await page.eval(async () => {
    const original = window.fetch;
    window.fetch = async (url, options) => { if (String(url).startsWith('/api/transactions')) throw new Error('Không kết nối được máy chủ'); return original(url, options); };
    await loadTransactionsTable(); window.fetch = original;
  });
  assert.ok(await page.eval(() => document.querySelector('#transactionsTableBody').textContent.includes('Thử lại')));
  await page.eval(() => loadTransactionsTable());
  assert.deepEqual(page.consoleErrors, []);
  writeFileSync(`${out}/report.json`, JSON.stringify({ results, consoleErrors: page.consoleErrors }, null, 2));
  console.log(`PASS: ${results.length} screenshots; checkout -> accept -> ship -> confirm; favorites, safe text, role isolation, Back, reload, responsive; no console exceptions.`);
} finally { await page.close(); await browser.close(); }
