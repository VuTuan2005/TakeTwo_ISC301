// Focused screens over the existing vanilla-JS forms and actions.
// Each async read is scoped to an account generation; stale results never render.
let accountGeneration = 0;
let workspaceRoute = 'overview';
let workspaceConfig = null;
let favoriteIds = new Set();
let workspaceOrders = [];
let orderTab = 'all';
let viewRequests = new Map();
let pendingMutations = new Map();
let mutationKeys = new Map();
let ledgerDebounce;
let orderPoll;
let lastModalFocus;
let pendingCheckout = null;
const privateRoutes = new Set(['store', 'favorites', 'orders', 'order', 'transactions', 'create', 'checkout', 'chat', 'case']);
const adminRoutes = new Set(['metrics', 'disputes']);
const routeTitles = { case: 'Hồ sơ khiếu nại', overview: 'Tổng quan', marketplace: 'Sản phẩm', store: 'Gian hàng của tôi', favorites: 'Yêu thích', product: 'Chi tiết sản phẩm', create: 'Đăng bán', checkout: 'Đặt mua', orders: 'Đơn hàng', order: 'Chi tiết đơn', transactions: 'Ví & Sổ giao dịch', packages: 'Gói đẩy tin', metrics: 'Thống kê mô phỏng', disputes: 'Tranh chấp', chat: 'Tin nhắn' };
const stateLabels = { AVAILABLE: 'Đang bán', RESERVED: 'Đang giữ chỗ', SOLD: 'Đã bán', HIDDEN: 'Đã gỡ', REQUESTED: 'Chờ người bán duyệt', ACCEPTED: 'Đã duyệt · Chờ gửi hàng', DELIVERING: 'Đang giao hàng', COMPLETED: 'Đã hoàn tất', COMPLETED_AUTO: 'Tự động hoàn tất', DISPUTED: 'Đang tranh chấp', CANCELLED: 'Đã hủy' };
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const E = escapeHTML;
function imageURL(value) {
  return /^(https?:\/\/|\/api\/attachments\/|data:image\/(jpeg|png|webp);base64,)/i.test(String(value || '')) ? E(value) : 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22400%22%20height=%22300%22%3E%3Crect%20width=%22400%22%20height=%22300%22%20fill=%22%23eef1f4%22/%3E%3C/svg%3E';
}
function stateTag(status) { return `<span class="state-tag state-${E(status)}">${E(stateLabels[status] || status)}</span>`; }
function orderDetailedStatusTag(o) {
  if (!o) return '';
  if (o.status === 'CANCELLED') return `<span class="state-tag state-CANCELLED">Đã hủy</span>`;
  if (o.status === 'DISPUTED') return `<span class="state-tag state-DISPUTED">Đang tranh chấp</span>`;
  if (o.status === 'COMPLETED' || o.status === 'COMPLETED_AUTO') return `<span class="state-tag state-COMPLETED">Hoàn tất</span>`;
  if (o.status === 'REQUESTED') return `<span class="state-tag state-REQUESTED">Chờ người bán duyệt</span>`;
  if (o.delivery_type === 'CAMPUS_MEETUP') {
    if (o.status === 'ACCEPTED') return `<span class="state-tag state-ACCEPTED">Chờ gặp bàn giao</span>`;
    if (o.status === 'DELIVERING') return `<span class="state-tag state-DELIVERING">Đã bàn giao · Chờ xác nhận</span>`;
  } else {
    if (o.status === 'ACCEPTED') {
      return o.pickup_address 
        ? `<span class="state-tag state-ACCEPTED" style="background:#EFF6FF; color:#1D4ED8; border-color:#DBEAFE;">Chờ bưu tá lấy hàng</span>` 
        : `<span class="state-tag state-ACCEPTED">Chờ chuẩn bị hàng</span>`;
    }
    if (o.status === 'DELIVERING') {
      if (o.courier_status === 'PICKED_UP') return `<span class="state-tag state-DELIVERING" style="background:#FEF3C7; color:#B45309; border-color:#FDE68A;">🚚 ĐVVC đã lấy hàng</span>`;
      if (o.courier_status === 'DELIVERING') return `<span class="state-tag state-DELIVERING" style="background:#E0E7FF; color:#4338CA; border-color:#C7D2FE;">🚚 Đang trên đường giao</span>`;
      if (o.courier_status === 'DELIVERED') return `<span class="state-tag state-DELIVERING" style="background:#ECFDF5; color:#047857; border-color:#A7F3D0;">📦 Đã giao thành công</span>`;
      return `<span class="state-tag state-DELIVERING">Đang giao hàng</span>`;
    }
  }
  return stateTag(o.status);
}
function stepDot(num, state) {
  return `<div class="order-step-dot">${state === 'completed' ? '✓' : num}</div>`;
}
function renderOrderTimeline(o) {
  if (o.status === 'CANCELLED' || o.status === 'DISPUTED') return '';
  const isMeetup = o.delivery_type === 'CAMPUS_MEETUP';
  if (isMeetup) {
    const s1 = 'completed';
    const s2 = ['ACCEPTED', 'DELIVERING', 'COMPLETED', 'COMPLETED_AUTO'].includes(o.status) ? 'completed' : (o.status === 'REQUESTED' ? 'active' : '');
    const s3 = ['DELIVERING', 'COMPLETED', 'COMPLETED_AUTO'].includes(o.status) ? 'completed' : (o.status === 'ACCEPTED' ? 'active' : '');
    const s4 = ['COMPLETED', 'COMPLETED_AUTO'].includes(o.status) ? 'completed' : (o.status === 'DELIVERING' ? 'active' : '');
    return `
      <div class="order-stepper">
        <div class="order-step ${s1}">${stepDot(1, s1)}<span class="order-step-title">Đặt mua</span></div>
        <div class="order-step-line ${s2 === 'completed' ? 'completed' : ''}"></div>
        <div class="order-step ${s2}">${stepDot(2, s2)}<span class="order-step-title">Người bán duyệt</span></div>
        <div class="order-step-line ${s3 === 'completed' ? 'completed' : ''}"></div>
        <div class="order-step ${s3}">${stepDot(3, s3)}<span class="order-step-title">Bàn giao</span></div>
        <div class="order-step-line ${s4 === 'completed' ? 'completed' : ''}"></div>
        <div class="order-step ${s4}">${stepDot(4, s4)}<span class="order-step-title">Hoàn tất</span></div>
      </div>
    `;
  }
  const isDone = ['COMPLETED', 'COMPLETED_AUTO'].includes(o.status);
  const s1 = 'completed';
  const s2 = (o.pickup_address || ['DELIVERING', 'COMPLETED', 'COMPLETED_AUTO'].includes(o.status)) ? 'completed' : (o.status === 'ACCEPTED' ? 'active' : '');
  const s3 = (['DELIVERING', 'DELIVERED'].includes(o.courier_status) || isDone) ? 'completed' : (o.courier_status === 'PICKED_UP' ? 'active' : '');
  const s4 = (o.courier_status === 'DELIVERED' || isDone) ? 'completed' : (o.courier_status === 'DELIVERING' ? 'active' : '');
  const s5 = isDone ? 'completed' : (o.courier_status === 'DELIVERED' ? 'active' : '');
  const s6 = isDone ? 'completed' : '';
  return `
    <div class="order-stepper">
      <div class="order-step ${s1}">${stepDot(1, s1)}<span class="order-step-title">Đặt hàng</span></div>
      <div class="order-step-line ${s2 === 'completed' ? 'completed' : ''}"></div>
      <div class="order-step ${s2}">${stepDot(2, s2)}<span class="order-step-title">Chuẩn bị hàng</span></div>
      <div class="order-step-line ${s3 === 'completed' ? 'completed' : ''}"></div>
      <div class="order-step ${s3}">${stepDot(3, s3)}<span class="order-step-title">ĐVVC đã lấy</span></div>
      <div class="order-step-line ${s4 === 'completed' ? 'completed' : ''}"></div>
      <div class="order-step ${s4}">${stepDot(4, s4)}<span class="order-step-title">Đang giao</span></div>
      <div class="order-step-line ${s5 === 'completed' ? 'completed' : ''}"></div>
      <div class="order-step ${s5}">${stepDot(5, s5)}<span class="order-step-title">Đã giao</span></div>
      <div class="order-step-line ${s6 === 'completed' ? 'completed' : ''}"></div>
      <div class="order-step ${s6}">${stepDot(6, s6)}<span class="order-step-title">Hoàn tất</span></div>
    </div>
  `;
}
function messageHTML(message, action) { return `<div class="empty-state"><p>${E(message)}</p>${action || ''}</div>`; }
function blockError(id, error, retry) {
  if (error.name === 'StaleSessionError' || error.name === 'SupersededRead') return;
  const el = $id(id);
  if (el) el.innerHTML = messageHTML(error.message || 'Không tải được dữ liệu.', `<button class="btn-fintab btn-fintab-outline" onclick="${retry}">Thử lại</button>`);
}
function stampError() { const error = new Error('Đã đổi tài khoản.'); error.name = 'StaleSessionError'; return error; }
function clearAccountViews(preserveModal = false) {
  accountGeneration++;
  if (typeof stopChatPoll === 'function') stopChatPoll();
  activeChatConversationId = null; currentChatAttachmentId = null; currentCheckoutQuote = null;
  clearChatAttachment(); $text('chatAttachmentName','');
  chatRetryKey = null; chatLoadedMessages = []; chatHistoryConvId = null; mutationKeys.clear();
  for (const id of ['chatConversationsList','chatMessagesScroll','chatProductBanner']) $id(id)?.replaceChildren();
  $setVal('chatTextInput',''); $setVal('checkoutVoucherInput',''); $setVal('checkoutMeetupInput','');
  workspaceOrders = []; currentTransactionsList = []; favoriteIds = new Set(); checkoutProduct = null;
  orderTab = 'all'; currentTransactionTab = 'all';
  for (const id of ['newPostTitle', 'newPostPrice', 'newPostOriginalPrice', 'newPostMeetupLocation', 'newPostDefectNote', 'newPostImageUrl', 'newPostImageFile', 'checkoutDeliveryAddress', 'checkoutRecipientName', 'checkoutRecipientPhone', 'disputeReasonInput', 'disputeOrderId', 'transactionSearchInput']) $setVal(id, '');
  for (const id of ['checkoutProductTitle', 'checkoutProductPrice', 'checkoutSellerInfo', 'checkoutMeetupAddress', 'vReceiptCode', 'vReceiptDate', 'vReceiptParty', 'vReceiptMethod', 'vReceiptDesc', 'vReceiptAmount', 'vReceiptBalAfter', 'vSignUser']) $text(id, '');
  for (const id of ['checkoutProductImg', 'newPostImagePreview']) $src(id, 'data:,');
  if ($id('imagePreviewWrapper')) $id('imagePreviewWrapper').style.display = 'none';
  if ($id('uploadPrompt')) $id('uploadPrompt').style.display = 'block';
  currentUser = null; currentWallet = { available_balance: 0, escrow_balance: 0, boost_credits: 0 };
  for (const id of ['overviewTasks', 'productGrid', 'storeGrid', 'favoritesGrid', 'productDetail', 'ordersList', 'orderDetail', 'metricsContent', 'disputesList', 'caseContent']) {
    if ($id(id)) $id(id).innerHTML = '';
  }
  if ($id('transactionsTableBody')) $id('transactionsTableBody').replaceChildren();
  for (const id of ['stripTotalIncome', 'stripTotalExpense']) $text(id, '0 đ');
  if (!preserveModal) document.querySelectorAll('.fintab-modal-overlay.open').forEach(el => el.classList.remove('open'));
  updateHeaderWalletDisplay(); updateRoleNavigation();
}

async function apiFetch(url, options = {}) {
  const changesAccount = options.method === 'POST' && ['/api/auth/login', '/api/auth/register', '/api/auth/google'].includes(url);
  if (changesAccount) accountGeneration++;
  let generation = accountGeneration;
  const request = { ...options, credentials: 'same-origin', headers: { ...(options.headers || {}) } };
  if (request.body && typeof request.body === 'object' && !(request.body instanceof FormData)) {
    request.headers['Content-Type'] = 'application/json'; request.body = JSON.stringify(request.body);
  }
  const mutation = request.method && request.method !== 'GET';
  const key = `${generation}:${request.method || 'GET'}:${url}:${request.body || ''}`;
  if (mutation) {
    if (!mutationKeys.has(key)) mutationKeys.set(key, crypto.randomUUID());
    request.headers['Idempotency-Key'] = mutationKeys.get(key);
  }
  const button = document.activeElement?.tagName === 'BUTTON' ? document.activeElement : null;
  const wasDisabled = button?.disabled;
  if (mutation && button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  try {
    let response;
    if (mutation) {
      if (!pendingMutations.has(key)) pendingMutations.set(key, window.fetch(url, request));
      response = (await pendingMutations.get(key)).clone();
    } else response = await window.fetch(url, { ...request, cache: 'no-store' });
    if (generation !== accountGeneration) throw stampError();
    if (!response.ok) {
      mutationKeys.delete(key);
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401 && !url.includes('/api/auth/')) {
        if (checkoutProduct && (workspaceRoute === 'checkout' || url === '/api/checkout/quote' || url === '/api/orders/checkout')) {
          saveCheckoutDraft();
          pendingCheckout = { productId: checkoutProduct.id, userId: currentUser?.id || null };
        }
        clearAccountViews();
        if (privateRoutes.has(workspaceRoute.split('/')[0]) || adminRoutes.has(workspaceRoute)) switchNav('marketplace');
        if (pendingCheckout) openLoginModal();
      }
      const error = new Error(payload.error || 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
      showFormError(error.message);
      throw error;
    }
    if (changesAccount) {
      clearAccountViews(true);
      generation = accountGeneration;
    }
    const parse = response.json.bind(response);
    mutationKeys.delete(key);
    response.json = async () => { const data = await parse(); if (generation !== accountGeneration) throw stampError(); return data; };
    return response;
  } finally {
    if (mutation) pendingMutations.delete(key);
    if (mutation && button) { button.disabled = wasDisabled; button.removeAttribute('aria-busy'); }
  }
}
async function readView(key, url) {
  const token = Symbol(key); viewRequests.set(key, token);
  const data = await (await apiFetch(url)).json();
  if (viewRequests.get(key) !== token) { const error = new Error('Newer read already started'); error.name = 'SupersededRead'; throw error; }
  return data;
}
function showFormError(message) {
  const host = document.querySelector('.fintab-modal-overlay.open .modal-content-body') ||
    (workspaceRoute === 'checkout' ? $id('checkoutFormHost') : workspaceRoute === 'create' ? $id('listingFormHost') : null);
  if (!host) return;
  let error = host.querySelector('.form-error');
  if (!error) { error = document.createElement('p'); error.className = 'form-error'; error.setAttribute('role', 'alert'); host.prepend(error); }
  error.textContent = message;
}
function showToast(message, type = 'info') {
  if (!message || String(message).includes('Đã đổi tài khoản') || String(message).includes('Newer read')) return;
  const toast = document.createElement('div'); toast.className = `fintab-toast toast-${type}`;
  while ($id('toastContainer')?.children.length >= 2) $id('toastContainer').firstElementChild.remove();
  toast.textContent = message; $id('toastContainer')?.append(toast);
  setTimeout(() => toast.remove(), 4500);
}

async function initApp() {
  try {
    workspaceConfig = await (await apiFetch('/api/config')).json();
    await loadMe(); await loadUsers(); await loadBumpPackages();
    if (currentUser) await loadFavoriteIds();
    await renderRoute();
    clearInterval(liveInterval); liveInterval = setInterval(updateCountdowns, 1000);
    clearInterval(orderPoll); orderPoll = setInterval(async () => {
      if (document.hidden || !currentUser) return;
      const screen = workspaceRoute.split('/')[0];
      if (!['orders', 'order', 'disputes'].includes(screen)) return;
      try { await refreshCurrentScreen(); } catch (error) { /* keep last successful data during polling */ }
    }, 10000);
  } catch (error) { blockError('overviewTasks', error, 'initApp()'); }
}
async function loadMe() {
  const data = await (await apiFetch('/api/me')).json();
  currentUser = data.user; currentWallet = data.wallet;
  if (currentUser?.role === 'ADMIN') { location.replace('/admin.html'); return; }
  renderDemoBanner(data.demo_mode); updateHeaderWalletDisplay(); updateRoleNavigation();
}
async function loadUsers() {
  allUsers = isDemoMode ? await (await apiFetch('/api/users')).json() : [];
  const select = $id('userSwitcher');
  if (select) { select.replaceChildren(new Option('Chọn tài khoản demo', 'guest'), ...allUsers.map(u => new Option(`${u.name} · ${u.role}`, u.id))); select.value = currentUser ? String(currentUser.id) : 'guest'; }
}
function renderLoginCards() {
  const list = $id('loginUserCardsList');
  if (list) list.innerHTML = allUsers.map(u => `<button class="demo-account-option" onclick="handleLogin(${Number(u.id)})"><strong>${E(u.name)}</strong><span>${E(u.role)} · ${E(u.student_code)}</span></button>`).join('');
}
async function onUserSwitch(id) {
  clearAccountViews();
  try {
    const data = await (await apiFetch('/api/auth/demo-switch', { method: 'POST', body: { user_id: id } })).json();
    await loadMe();
    if (currentUser?.role === 'ADMIN') return;
    await loadUsers();
    if (currentUser) await loadFavoriteIds();
    if (!(await resumePendingCheckout())) await renderRoute();
    showToast(currentUser ? `Đang dùng ${currentUser.name}` : 'Đã chuyển sang khách.', 'success');
  } catch (error) { showToast(error.message, 'error'); }
}
async function handleLogout() {
  pendingCheckout = null;
  clearAccountViews();
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('takeTwo_activeUserId');
    currentUser = null;
    currentWallet = { available_balance: 0, escrow_balance: 0, boost_credits: 0 };
    updateHeaderWalletDisplay();
    updateRoleNavigation();
    await loadUsers();
    closeModal('modalLogin');
    switchNav('marketplace');
    showToast('Đã đăng xuất thành công.', 'info');
  }
  catch (error) { showToast(error.message, 'error'); }
}
function renderDemoBanner(value) {
  isDemoMode = Boolean(value);
  $id('demoModeBanner').textContent = isDemoMode ? 'Chế độ mô phỏng · OTP, Google, số dư và thanh toán không phải giao dịch thật' : 'Demo đã tắt · Các dịch vụ thanh toán và OTP thật chưa được tích hợp';
  $id('sidebarUserSwitchRow').hidden = !isDemoMode;
  if ($id('btnTabDemo')) $id('btnTabDemo').style.display = isDemoMode ? '' : 'none';
  const simulated = ['promptGoogleSSO()', 'openTopupModal()', 'simulateTopupSuccess()'];
  document.querySelectorAll('button[onclick]').forEach(button => {
    if (simulated.includes(button.getAttribute('onclick'))) { button.disabled = !isDemoMode; button.title = isDemoMode ? '' : 'Dịch vụ thật chưa tích hợp.'; }
  });
  for (const id of ['btnSendLoginOtp', 'btnSendRegOtp', 'btnTabRegister']) {
    if ($id(id)) { $id(id).disabled = !isDemoMode; $id(id).title = isDemoMode ? '' : 'OTP thật chưa tích hợp.'; }
  }
  const otp = document.querySelector('input[name="loginMethod"][value="otp"]');
  if (otp) otp.disabled = !isDemoMode;
  if ($id('loginPassword')) $id('loginPassword').placeholder = isDemoMode ? 'Mật khẩu (demo: 123456)' : 'Mật khẩu của bạn';
}
function updateHeaderWalletDisplay() {
  for (const id of ['topbarWalletAvailable', 'kpiOverviewWalletAvail', 'stripAvailableBal', 'packagesWalletBal']) $text(id, formatVND(currentWallet.available_balance));
  for (const id of ['kpiOverviewEscrow', 'stripEscrowBal']) $text(id, formatVND(currentWallet.escrow_balance));
  for (const id of ['kpiOverviewBoostCredits', 'packagesCurrentCredits']) $text(id, `${currentWallet.boost_credits || 0} lượt`);
  $text('checkoutCurrentBalance', `Khả dụng: ${formatVND(currentWallet.available_balance)}`);
  $id('sidebarUserCard').hidden = !currentUser;
  $id('sidebarGuestBox').hidden = !!currentUser;
  $id('sidebarUserSwitchRow').hidden = !isDemoMode;
  $id('btnSidebarLogout').hidden = !currentUser;
  $text('btnTopbarAuth', currentUser ? 'Đăng xuất' : 'Đăng nhập');
  $text('sidebarUserName', currentUser?.name || '');
  $text('sidebarStudentCode', currentUser ? (currentUser.student_code || 'Thành viên') : '');
  $text('topupUserCode', currentUser?.student_code || 'DEMO');
  if (currentUser) $id('sidebarUserAvatar').src = currentUser.avatar_url && /^(https?:\/\/|data:image\/)/.test(currentUser.avatar_url) ? currentUser.avatar_url : 'data:,';
}
function updateRoleNavigation() {
  document.querySelectorAll('[data-admin]').forEach(el => { el.hidden = currentUser?.role !== 'ADMIN'; });
  document.querySelectorAll('[data-private]').forEach(el => { el.hidden = !currentUser; });
  const checkbox = $id('chkViewAllLedger');
  if (checkbox) { checkbox.parentElement.hidden = currentUser?.role !== 'ADMIN'; if (currentUser?.role !== 'ADMIN') checkbox.checked = false; }
}
function toggleMenu(force) {
  const open = force ?? !$id('mainSidebar').classList.contains('is-open');
  $id('mainSidebar').classList.toggle('is-open', open); $id('navScrim').hidden = !open;
  $id('mobileMenu').setAttribute('aria-expanded', String(open));
}
function switchNav(route) {
  const target = String(route).replace(/^#/, '');
  if (location.hash === `#${target}`) return renderRoute();
  location.hash = target;
}
async function renderRoute() {
  if (currentUser?.role === 'ADMIN') { location.replace('/admin.html'); return; }
  let route = location.hash.slice(1) || 'overview';
  let [screen] = route.split('/');
  if (!routeTitles[screen]) { history.replaceState(null, '', '#overview'); route = screen = 'overview'; }
  if ((privateRoutes.has(screen) && !currentUser) || (adminRoutes.has(screen) && currentUser?.role !== 'ADMIN')) {
    const unauthenticated = !currentUser;
    history.replaceState(null, '', '#marketplace'); route = screen = 'marketplace';
    if (unauthenticated) showToast('Đăng nhập để xem thông tin cá nhân.');
  }
  if (workspaceRoute.split('/')[0] === 'chat' && screen !== 'chat' && typeof stopChatPoll === 'function') stopChatPoll();
  workspaceRoute = route; toggleMenu(false);
  document.querySelectorAll('main > section').forEach(el => { el.hidden = el.id !== `view-${screen}`; });
  const parent = { product: 'marketplace', create: 'store', checkout: 'marketplace', order: 'orders', chat: 'chat', case: 'orders' }[screen] || screen;
  document.querySelectorAll('.sidebar-nav-item').forEach(el => { const active = el.id === `nav-${parent}`; el.classList.toggle('active', active); if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
  $text('breadcrumbCurrent', routeTitles[screen]); document.title = `${routeTitles[screen]} · TakeTwo`;
  $id('mainContent').scrollTop = 0;
  if (screen === 'case') return loadCase(route.split('/')[1]);
  if (screen === 'overview') return loadOverview();
  if (screen === 'marketplace') return loadProducts();
  if (screen === 'store') return loadStore();
  if (screen === 'favorites') return loadFavorites();
  if (screen === 'product') return loadProductDetail(route.split('/')[1]);
  if (screen === 'orders' || screen === 'order') return loadOrders();
  if (screen === 'transactions') { await loadMe(); return loadTransactionsTable(); }
  if (screen === 'chat') return loadChatView(route.split('/')[1]);
  if (screen === 'packages') { await loadBumpPackages(); return renderPackagesTab(); }
  if (screen === 'metrics') return loadMetrics();
  if (screen === 'disputes') return loadDisputesView();
  if (screen === 'checkout') return checkoutProduct ? fetchCheckoutQuote() : restoreCheckoutDraft();
}
async function refreshCurrentScreen() {
  await loadMe();
  if (workspaceRoute === 'disputes') return loadDisputesView();
  return loadOrders();
}
window.addEventListener('hashchange', () => { renderRoute().catch(error => showToast(error.message, 'error')); });

async function loadOverview() {
  $text('overviewGreeting', currentUser ? `Chào ${currentUser.name}. Những việc cần bạn xử lý hôm nay.` : 'Đăng nhập để theo dõi đơn hàng và số dư mô phỏng của bạn.');
  if (!currentUser) { $id('overviewTasks').innerHTML = messageHTML('Bắt đầu bằng một món đồ bạn đang cần.', '<a class="btn-fintab btn-fintab-primary" href="#marketplace">Xem sản phẩm</a>'); return; }
  try {
    const orders = await readView('overview', '/api/orders');
    const tasks = orders.filter(o => ['REQUESTED', 'ACCEPTED', 'DELIVERING', 'DISPUTED'].includes(o.status)).slice(0, 5);
    $id('overviewTasks').innerHTML = tasks.length ? tasks.map(o => `<a class="task-row" href="#order/${o.id}"><div><strong>${E(o.product_title)}</strong><span>${orderDetailedStatusTag(o)}</span></div><div><strong>${formatVND(o.total_paid)}</strong><span>Xem đơn →</span></div></a>`).join('') : messageHTML('Bạn không có đơn nào đang chờ xử lý.');
  } catch (error) { blockError('overviewTasks', error, 'loadOverview()'); }
}
function productCards(products) {
  if (!products.length) return messageHTML('Chưa có món đồ phù hợp.', '<a href="#marketplace">Khám phá sản phẩm →</a>');
  return products.map(p => `
    <article class="product-card ${p.is_promoted ? 'promoted-card' : ''}">
      <a class="product-image" href="#product/${p.id}">
        <img src="${imageURL(p.image_url)}" alt="${E(p.title)}" loading="lazy">
        ${p.is_promoted ? '<span class="image-badge-promoted">🔥 ƯU TIÊN TOP</span>' : ''}
        <span class="image-status">${E(stateLabels[p.status] || p.status)}</span>
      </a>
      <div class="product-card-body">
        <div class="product-meta">
          <span>${E(p.category_name || 'Đồ sinh viên')}</span>
          ${p.is_promoted ? '<span class="promoted-badge-pill">🔥 Đã đẩy Top</span>' : ''}
        </div>
        <h2><a href="#product/${p.id}">${E(p.title)}</a></h2>
        <strong class="product-price">${formatVND(p.price)}</strong>
        <p class="product-location">${E(p.campus_cluster)}</p>
        <div class="product-card-footer">
          <span>${E(p.condition_level)}</span>
          <button class="save-button" aria-label="${favoriteIds.has(p.id) ? 'Bỏ lưu' : 'Lưu'} ${E(p.title)}" aria-pressed="${favoriteIds.has(p.id)}" onclick="toggleFavorite(${p.id})">${favoriteIds.has(p.id) ? 'Đã lưu' : 'Lưu'}</button>
        </div>
      </div>
    </article>
  `).join('');
}
async function loadProducts(searchOverride) {
  const search = typeof searchOverride === 'string' ? searchOverride : $val('globalSearchInput');
  const url = `/api/products?category=${encodeURIComponent(currentCategory)}&campus=${encodeURIComponent($val('marketCampusSelect', 'all'))}&condition=${encodeURIComponent($val('conditionFilter', 'all'))}&search=${encodeURIComponent(search)}`;
  if (!$id('productGrid').children.length) $id('productGrid').innerHTML = messageHTML('Đang tải sản phẩm…');
  try {
    const products = await readView('products', url);
    renderProducts(products);
  } catch (error) { blockError('productGrid', error, 'loadProducts()'); }
}
function renderProducts(products) {
  $id('productGrid').innerHTML = productCards(products);
  $text('productResultCount', `${products.length} sản phẩm trong bộ lọc hiện tại`);
  $text('navProductCount', products.length);
}
async function loadStore() {
  if (!currentUser) return;
  try {
    const products = await readView('store', `/api/products?seller_id=${currentUser.id}`);
    const promotedCount = products.filter(p => p.is_promoted).length;
    const banner = `
      <div class="store-credits-banner">
        <div class="store-credits-info">
          <span>Lượt đẩy tin trong ví: <strong style="color:#EA580C; font-weight:700;">${currentWallet.boost_credits || 0} lượt</strong></span>
          <span style="color:#CBD5E1;">•</span>
          <span>Tin đang đẩy Top: <strong style="color:#16A34A; font-weight:700;">${promotedCount} món</strong></span>
        </div>
        <a href="#packages" class="btn-fintab btn-fintab-outline" style="padding:6px 14px; font-size:12.5px;">Mua thêm gói đẩy tin →</a>
      </div>
    `;
    $id('storeGrid').innerHTML = banner + productCards(products);
  }
  catch (error) { blockError('storeGrid', error, 'loadStore()'); }
}
async function loadFavoriteIds() {
  favoriteIds = new Set((await (await apiFetch('/api/favorites')).json()).map(p => p.id));
}
async function loadFavorites() {
  try { const products = await readView('favorites', '/api/favorites'); favoriteIds = new Set(products.map(p => p.id)); $id('favoritesGrid').innerHTML = productCards(products); }
  catch (error) { blockError('favoritesGrid', error, 'loadFavorites()'); }
}
async function toggleFavorite(id) {
  if (!currentUser) { openLoginModal(); return; }
  try {
    const adding = !favoriteIds.has(id);
    await apiFetch(`/api/favorites/${id}`, { method: adding ? 'PUT' : 'DELETE' });
    if (adding) favoriteIds.add(id); else favoriteIds.delete(id);
    if (workspaceRoute === 'favorites') await loadFavorites();
    else if (workspaceRoute.startsWith('product/')) await loadProductDetail(id);
    else if (workspaceRoute === 'store') await loadStore(); else await loadProducts();
  } catch (error) { showToast(error.message, 'error'); }
}
async function loadProductDetail(id) {
  $id('productDetail').innerHTML = messageHTML('Đang tải chi tiết…');
  try {
    const p = await readView('product', `/api/products/${encodeURIComponent(id)}`);
    const own = currentUser?.id === p.seller_id, manager = own;
    const bumpBox = manager ? `
      <div class="bump-status-box ${p.is_promoted ? 'is-promoted' : ''}">
        <div class="bump-status-header">
          <span class="bump-fire-icon">${p.is_promoted ? '🔥' : '🚀'}</span>
          <div>
            <strong>${p.is_promoted ? `Món đồ này đang được ĐẨY TOP (${p.bump_count || 1} lượt)` : 'Đưa món đồ này lên vị trí ưu tiên hàng đầu'}</strong>
            <p>${p.is_promoted 
              ? `Món đồ đang nằm ở vị trí ưu tiên đầu danh mục Marketplace đến hết ngày ${new Date(p.promoted_until).toLocaleDateString('vi-VN')}.`
              : 'Sử dụng 1 lượt đẩy để đưa món đồ này lên vị trí ưu tiên đầu danh sách trong 7 ngày.'}</p>
          </div>
        </div>
        <div class="bump-status-action">
          <span>Ví hiện có: <strong style="color: #EA580C;">${currentWallet.boost_credits || 0} lượt có sẵn</strong></span>
          ${p.status === 'AVAILABLE' && p.approval_status === 'APPROVED' ? `
            <button class="btn-fintab ${p.is_promoted ? 'btn-fintab-outline' : 'btn-fintab-primary'}" onclick="quickBumpProduct(${p.id})">
              ${p.is_promoted ? 'Đẩy thêm lượt' : '🚀 Đẩy tin ngay'} (${currentWallet.boost_credits > 0 ? 'Dùng 1 lượt' : '15.000 đ'})
            </button>
          ` : ''}
        </div>
      </div>
    ` : '';
    $id('productDetail').innerHTML = `<a class="back-link" href="${own ? '#store' : '#marketplace'}">← ${own ? 'Gian hàng của tôi' : 'Sản phẩm'}</a><div class="product-detail-grid"><div class="detail-photo"><img src="${imageURL(p.image_url)}" alt="${E(p.title)}"></div><div class="detail-copy"><p class="scope-caption">${E(p.category_name)} · ${E(p.campus_cluster)}</p><h1>${E(p.title)}</h1><div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">${stateTag(p.status)}${p.is_promoted ? '<span class="state-tag state-PROMOTED">🔥 Đang đẩy Top</span>' : ''}</div>${p.approval_status !== 'APPROVED' ? '<p class="notice">Tin chưa được duyệt: ' + E(p.approval_status) + '</p>' : ''}<strong class="detail-price">${formatVND(p.price)}</strong><p>${E(p.defect_note)}</p><dl class="detail-fields"><div><dt>Tình trạng</dt><dd>${E(p.condition_level)}</dd></div><div><dt>Người bán</dt><dd>${E(p.seller_name)}</dd></div><div><dt>Điểm hẹn</dt><dd>${E(p.meetup_location || 'Hẹn gặp trực tiếp / Trao đổi qua chat')}</dd></div></dl>${bumpBox}<div class="detail-actions">${p.status === 'AVAILABLE' && !own && currentUser?.role !== 'ADMIN' ? `<button class="btn-fintab btn-fintab-primary" onclick="openCheckoutModal(${p.id})">Đặt mua qua ví</button><button class="btn-fintab btn-fintab-outline" onclick="openChatWithSeller(${p.id})">💬 Nhắn tin cho người bán</button>` : ''}<button class="btn-fintab btn-fintab-outline" onclick="toggleFavorite(${p.id})">${favoriteIds.has(p.id) ? 'Bỏ lưu' : 'Lưu món đồ'}</button>${manager && p.status === 'AVAILABLE' && p.approval_status === 'APPROVED' ? `<button class="btn-fintab btn-fintab-outline" onclick="quickBumpProduct(${p.id})">🚀 Đẩy tin (${currentWallet.boost_credits > 0 ? `${currentWallet.boost_credits} lượt sẵn` : '15.000 đ'})</button>` : ''}${!own && currentUser ? `<button class="text-button danger-text" onclick="reportProduct(${p.id})">Báo cáo tin đăng</button>` : ''}${manager && p.status !== 'RESERVED' && p.status !== 'HIDDEN' ? `<button class="text-button danger-text" onclick="deleteProduct(${p.id})">Gỡ bài</button>` : ''}</div></div></div>`;
  } catch (error) { blockError('productDetail', error, `loadProductDetail(${Number(id) || 0})`); }
}
async function loadOrders() {
  if (!currentUser) return;
  try { const orders = await readView('orders', '/api/orders'); workspaceOrders = orders; renderOrders(orders); }
  catch (error) { blockError(workspaceRoute.startsWith('order/') ? 'orderDetail' : 'ordersList', error, 'loadOrders()'); }
}
function setOrderTab(tab) { orderTab = tab; renderOrders(workspaceOrders); }
function renderOrders(orders) {
  const rows = orders.filter(o => orderTab === 'all' || (orderTab === 'buyer' ? o.buyer_id : o.seller_id) === currentUser?.id);
  $text('navOrderCount', orders.filter(o => o.escrow_status === 'HELD').length);
  document.querySelectorAll('[data-order-tab]').forEach(el => { const active = el.dataset.orderTab === orderTab; el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active)); });
  $id('ordersList').innerHTML = rows.length ? rows.map(o => `<a class="order-row" href="#order/${o.id}"><img src="${imageURL(o.product_image)}" alt=""><div class="order-identity"><strong>${E(o.product_title)}</strong><span>${currentUser?.id === o.buyer_id ? `Mua từ ${E(o.seller_name)}` : `Bán cho ${E(o.buyer_name)}`}</span></div><div class="order-amount"><strong>${formatVND(o.total_paid)}</strong>${orderDetailedStatusTag(o)}</div><span class="row-arrow">→</span></a>`).join('') : messageHTML('Không có đơn hàng trong mục này.');
  if (workspaceRoute.startsWith('order/')) renderOrderDetail(Number(workspaceRoute.split('/')[1]));
}
function renderOrderDetail(id) {
  const o = workspaceOrders.find(o => o.id === id);
  if (!o) { $id('orderDetail').innerHTML = messageHTML('Đơn không tồn tại hoặc bạn không có quyền xem.', '<a href="#orders">Về danh sách đơn →</a>'); return; }
  const isBuyer = currentUser.id === o.buyer_id;
  const isSeller = currentUser.id === o.seller_id;
  const isMeetup = o.delivery_type === 'CAMPUS_MEETUP';
  const actions = [];

  // REQUESTED state actions
  if (o.status === 'REQUESTED') {
    if (isBuyer) {
      actions.push(`<button class="btn-fintab btn-fintab-outline" onclick="buyerCancelOrder(${id})">Hủy đơn mua</button>`);
    }
    if (isSeller) {
      actions.push(`<button class="btn-fintab btn-fintab-primary" onclick="sellerAcceptOrder(${id})">Chấp nhận đơn</button>`);
      actions.push(`<button class="btn-fintab btn-fintab-outline" onclick="sellerRejectOrder(${id})">Từ chối đơn</button>`);
    }
  }

  // ACCEPTED state actions
  if (o.status === 'ACCEPTED') {
    if (isSeller) {
      if (isMeetup) {
        actions.push(`<button class="btn-fintab btn-fintab-primary" onclick="sellerMeetupHandover(${id})">Xác nhận đã bàn giao trực tiếp</button>`);
      } else {
        if (!o.pickup_address) {
          actions.push(`<button class="btn-fintab btn-fintab-primary" onclick="sellerReadyPickup(${id})">Cung cấp địa chỉ lấy hàng</button>`);
        } else {
          actions.push(`<span class="state-tag state-ACCEPTED">Đã báo sẵn sàng lấy hàng (${E(o.pickup_address)})</span>`);
        }
      }
    }
  }

  if (isBuyer && o.status === 'ACCEPTED') actions.push(`<button class="btn-fintab btn-fintab-danger" onclick="openDisputeModal(${id})">Khiếu nại</button>`);
  if (o.status === 'DISPUTED' || o.dispute_reason) actions.push(`<button class="btn-fintab btn-fintab-outline" onclick="openOrderCase(${id})">Hồ sơ & giải trình</button>`);

  // DELIVERING state actions
  if (o.status === 'DELIVERING') {
    if (isSeller) {
      if (isMeetup) {
        actions.push(`<div class="order-status-callout success">🤝 <b>Đã bàn giao trực tiếp</b>: Bạn đã bàn giao hàng cho người mua. Tiền sẽ vào ví khi người mua xác nhận hài lòng hoặc sau khi hết thời gian Escrow 5 ngày.</div>`);
      } else {
        if (o.courier_status === 'PICKED_UP') {
          actions.push(`<div class="order-status-callout info">🚚 <b>Đơn vị vận chuyển đã lấy hàng</b>: Bưu tá đã lấy kiện hàng từ bạn và đang luân chuyển. Bạn có thể theo dõi tiến trình tại đây.</div>`);
        } else if (o.courier_status === 'DELIVERING') {
          actions.push(`<div class="order-status-callout info">🚚 <b>Đang trên đường giao</b>: Bưu tá đang giao hàng tới người mua (${E(o.recipient_name)} · ${E(o.recipient_phone)}).</div>`);
        } else if (o.courier_status === 'DELIVERED') {
          actions.push(`<div class="order-status-callout success">📦 <b>Đã giao hàng thành công</b>: Bưu tá đã giao kiện hàng đến người mua. Thời gian bảo vệ Escrow 5 ngày đang đếm ngược; sau đó tiền sẽ tự động giải ngân cho bạn nếu người mua không khiếu nại.</div>`);
        }
      }
    }
    if (isBuyer) {
      if (isMeetup || o.courier_status === 'DELIVERED') {
        actions.push(`<button class="btn-fintab btn-fintab-primary" onclick="buyerConfirmOrder(${id})">Đã nhận & Hài lòng</button>`);
        actions.push(`<button class="btn-fintab btn-fintab-danger" onclick="openDisputeModal(${id})">Khiếu nại / Hoàn tiền</button>`);
      } else {
        const courierText = o.courier_status === 'PICKED_UP' ? 'Đơn vị vận chuyển đã lấy hàng từ người bán · Đang luân chuyển' : 'Bưu tá đang trên đường giao hàng tới bạn';
        actions.push(`<div class="order-status-callout warning">🚚 <b>${courierText}</b>. Bạn có thể bấm xác nhận hài lòng sau khi bưu tá giao hàng thành công đến bạn.</div>`);
        actions.push(`<button class="btn-fintab btn-fintab-danger" onclick="openDisputeModal(${id})">Khiếu nại đơn hàng</button>`);
      }
    }
    if (isDemoMode && (isMeetup || o.courier_status === 'DELIVERED')) {
      actions.push(`<button class="text-button" onclick="simulate5Days(${id})">Mô phỏng hết 5 ngày</button>`);
    }
  }

  // Countdown & Dispute notice
  let countdown = '';
  if (o.status === 'DELIVERING') {
    if (isMeetup || o.courier_status === 'DELIVERED') {
      if (o.auto_confirm_deadline) {
        countdown = `<div class="deadline-panel"><span>Thời gian bảo vệ Escrow còn lại</span><strong class="live-countdown" data-deadline="${E(o.auto_confirm_deadline)}"></strong><small>Bắt đầu tính khi ${isMeetup ? 'bàn giao trực tiếp' : 'bưu tá giao hàng thành công'}. Hết hạn sẽ tự động giải ngân cho người bán nếu không có khiếu nại.</small></div>`;
      }
    } else {
      countdown = `<div class="deadline-panel" style="background:#F0FDF4; border-color:#BBF7D0;"><span style="color:#15803D;">🚚 Hàng đang vận chuyển</span><p style="margin:4px 0 0; font-size:12.5px; color:#166534;">Thời gian bảo vệ Escrow 5 ngày sẽ bắt đầu đếm ngược ngay sau khi bưu tá giao hàng thành công đến người nhận.</p></div>`;
    }
  } else if (o.status === 'DISPUTED') {
    countdown = '<p class="notice notice-danger">Đồng hồ tự động hoàn tất đã dừng. Đơn đang chờ Admin giải quyết tranh chấp với bằng chứng.</p>';
  }

  // Detailed step info for delivery section
  let courierStepTitle = 'Chờ người bán duyệt đơn';
  let courierStepDesc = 'Đơn hàng mới tạo, đang chờ người bán xác nhận.';
  if (o.status === 'ACCEPTED') {
    if (!o.pickup_address) {
      courierStepTitle = 'Người bán đang chuẩn bị hàng';
      courierStepDesc = 'Người bán cần cung cấp địa chỉ lấy hàng để TakeTwo điều phối bưu tá.';
    } else {
      courierStepTitle = 'Đã sẵn sàng lấy hàng';
      courierStepDesc = `Người bán đã gửi địa chỉ (${E(o.pickup_address)}). Đang chờ bưu tá đến lấy.`;
    }
  } else if (o.status === 'DELIVERING') {
    if (o.courier_status === 'PICKED_UP') {
      courierStepTitle = '🚚 Đơn vị vận chuyển đã lấy hàng từ người bán';
      courierStepDesc = 'Bưu tá đã nhận kiện hàng và đang luân chuyển.';
    } else if (o.courier_status === 'DELIVERING') {
      courierStepTitle = '🚚 Bưu tá đang trên đường giao hàng đến bạn';
      courierStepDesc = `Đơn hàng đang trên đường giao tới ${E(o.delivery_address)}. Vui lòng chú ý điện thoại (${E(o.recipient_phone)}).`;
    } else if (o.courier_status === 'DELIVERED') {
      courierStepTitle = '📦 Đã giao hàng thành công';
      courierStepDesc = 'Bưu tá đã giao hàng thành công. Thời gian bảo vệ Escrow 5 ngày bắt đầu đếm ngược để người mua kiểm tra.';
    }
  } else if (o.status === 'COMPLETED' || o.status === 'COMPLETED_AUTO') {
    courierStepTitle = '✓ Giao dịch đã hoàn tất';
    courierStepDesc = 'Người mua đã nhận hàng hài lòng, tiền cước đã hạch toán và tiền hàng đã giải ngân cho người bán.';
  } else if (o.status === 'DISPUTED') {
    courierStepTitle = '⚠️ Đơn hàng đang có khiếu nại';
    courierStepDesc = 'Đồng hồ tự động giải ngân tạm dừng, Admin đang thẩm định bằng chứng.';
  }

  // Delivery display section
  const deliverySection = isMeetup
    ? `<dl class="detail-fields">
        <div><dt>Hình thức</dt><dd>Gặp trực tiếp tại trường / KTX (Miễn phí)</dd></div>
        <div><dt>Tiến trình</dt><dd><strong style="color: #1E40AF;">${o.status === 'REQUESTED' ? 'Chờ người bán duyệt đơn' : (o.status === 'ACCEPTED' ? 'Người bán đã chấp nhận · Chờ gặp mặt bàn giao' : (o.status === 'DELIVERING' ? 'Đã bàn giao trực tiếp · Đang bảo vệ Escrow 5 ngày' : (o.status === 'DISPUTED' ? 'Đang tranh chấp khiếu nại' : 'Đã hoàn tất')))}</strong></dd></div>
        <div><dt>Điểm hẹn bàn giao</dt><dd><strong>${E(o.delivery_address || 'Hẹn gặp trực tiếp')}</strong></dd></div>
        <div><dt>Người nhận</dt><dd>${E(o.recipient_name)} · ${E(o.recipient_phone)}</dd></div>
        <div><dt>Người mua</dt><dd>${E(o.buyer_name)}</dd></div>
        <div><dt>Người bán</dt><dd>${E(o.seller_name)}</dd></div>
      </dl>`
    : `<dl class="detail-fields">
        <div><dt>Hình thức</dt><dd>TakeTwo vận chuyển (${formatVND(o.shipping_fee)})</dd></div>
        <div><dt>Tiến trình vận chuyển</dt><dd><strong style="color: #1E40AF; font-size: 13.5px;">${courierStepTitle}</strong><p style="margin: 3px 0 0; font-size: 12px; color: var(--text-muted);">${courierStepDesc}</p></dd></div>
        <div><dt>Mã điều phối bưu tá</dt><dd><strong>${E(o.tracking_code || 'Chờ tạo lượt giao nhận')}</strong></dd></div>
        <div><dt>Địa chỉ lấy hàng</dt><dd>${E(o.pickup_address || 'Chờ người bán cung cấp')}</dd></div>
        <div><dt>Địa chỉ giao hàng</dt><dd>${E(o.delivery_address)}</dd></div>
        <div><dt>Người nhận</dt><dd>${E(o.recipient_name)} · ${E(o.recipient_phone)}</dd></div>
      </dl>`;

  // Financial breakdown calculation
  const sellerPayout = o.escrow_status === 'REFUNDED' ? 0 : o.seller_payout ?? (o.amount - Math.round(o.amount * 0.03));
  const platformFee = o.platform_fee ?? Math.round(o.amount * 0.03);

  $id('orderDetail').innerHTML = `
    <a class="back-link" href="#orders">← Về danh sách đơn hàng</a>
    <div class="page-heading">
      <div>
        <p class="scope-caption">Mã đơn: ${E(o.order_code)}</p>
        <h1>${E(o.product_title)}</h1>
      </div>
      ${orderDetailedStatusTag(o)}
    </div>
    ${renderOrderTimeline(o)}
    <div class="order-detail-layout">
      <div class="workspace-panel">
        <h2>Giao nhận & Tiến trình</h2>
        ${deliverySection}
        ${o.dispute_reason ? `<div style="margin-top: 14px; padding: 12px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px;"><strong style="color: #DC2626;">Lý do khiếu nại:</strong><p style="margin: 4px 0 0; font-size: 13px;">${E(o.dispute_reason)}</p></div>` : ''}
        ${countdown}
        <div class="detail-actions" style="margin-top: 20px;">
          ${actions.join('') || '<span class="muted">Không có thao tác khả dụng.</span>'}
        </div>
      </div>
      <div class="workspace-panel">
        <h2>Hạch toán tài chính</h2>
        <dl class="detail-fields">
          <div><dt>Tiền hàng (P)</dt><dd>${formatVND(o.amount)}</dd></div>
          <div><dt>Phí vận chuyển (S)</dt><dd>${formatVND(o.shipping_fee)}</dd></div>
          <div><dt>Giảm giá Voucher (D)</dt><dd style="color: #10B981;">−${formatVND(o.discount)}</dd></div>
          <div><dt>Buyer đã thanh toán (C)</dt><dd><strong>${formatVND(o.total_paid)}</strong></dd></div>
          <div><dt>Phí sàn (3% P)</dt><dd>${formatVND(platformFee)}</dd></div>
          <div><dt>Seller nhận khi hoàn tất (P - F)</dt><dd style="color: #1677FF; font-weight: 700;">${formatVND(sellerPayout)}</dd></div>
          <div><dt>Trạng thái Escrow</dt><dd>${E({ HELD: 'Đang tạm giữ', RELEASED: 'Đã giải ngân cho người bán', REFUNDED: o.retained_fee > 0 ? 'Đã hoàn sau khi trừ phí' : 'Đã hoàn tiền' }[o.escrow_status] || o.escrow_status)}</dd></div>
          ${o.refund_amount != null ? `<div><dt>Buyer được hoàn thực tế</dt><dd style="color: #10B981; font-weight: 700;">${formatVND(o.refund_amount)}</dd></div>` : ''}
          ${o.retained_fee != null ? `<div><dt>Phí sàn giữ lại</dt><dd>${formatVND(o.retained_fee)}</dd></div>` : ''}
        </dl>
        <p class="muted" style="margin-top: 12px; font-size: 11.5px;">
          Quy tắc tài chính: Người bán nhận P - F (tiền ship chuyển cho đơn vị vận chuyển). Nếu khiếu nại hoàn tiền, người mua nhận lại C - Fr (Fr = min(F, C)), không áp dụng hoàn một phần.
        </p>
      </div>
    </div>`;
  updateCountdowns();
}
function updateCountdowns() {
  document.querySelectorAll('.live-countdown').forEach(el => {
    const remaining = new Date(el.dataset.deadline).getTime() - Date.now();
    if (!Number.isFinite(remaining)) { el.textContent = '—'; return; }
    if (remaining <= 0) { el.textContent = 'Đến hạn · Đang chờ server xác nhận'; return; }
    const total = Math.floor(remaining / 1000);
    el.textContent = `${Math.floor(total / 86400)} ngày ${Math.floor(total % 86400 / 3600)} giờ ${Math.floor(total % 3600 / 60)} phút ${total % 60} giây`;
  });
}
function debounceLedger() { clearTimeout(ledgerDebounce); ledgerDebounce = setTimeout(loadTransactionsTable, 250); }
async function loadTransactionsTable() {
  if (!currentUser) return;
  try {
    const data = await readView('ledger', `/api/transactions?type=${encodeURIComponent(currentTransactionTab)}&search=${encodeURIComponent($val('transactionSearchInput'))}&all=${$id('chkViewAllLedger').checked}`);
    if (!Array.isArray(data.transactions)) throw new Error('Không tải được danh sách giao dịch.');
    currentTransactionsList = data.transactions;
    const incoming = data.total_income;
    const outgoing = data.total_expense;
    $text('stripTotalIncome', `+${formatVND(incoming)}`); $text('stripTotalExpense', `−${formatVND(outgoing)}`);
    $id('transactionsTableBody').innerHTML = data.transactions.length ? data.transactions.map((t, index) => `<tr><td><span class="receipt-code">${E(t.voucher_code)}</span><small>${E(t.created_at)}</small></td><td><strong>${E(t.description)}</strong><small>${E(t.user_name)} · ${E(t.payment_method)}</small></td><td>${E({ IN: 'Thu', OUT: 'Chi', HOLD: 'Tạm giữ' }[t.flow_type])}</td><td class="numeric">${t.amount > 0 ? '+' : ''}${formatVND(t.amount)}</td><td><button class="text-button" onclick="openVoucherReceiptModal(${index})">Chứng từ →</button></td></tr>`).join('') : '<tr><td colspan="5">Không có chứng từ phù hợp.</td></tr>';
  } catch (error) {
    if (error.name === 'StaleSessionError' || error.name === 'SupersededRead') return;
    $id('transactionsTableBody').innerHTML = `<tr><td colspan="5">${E(error.message)} <button class="text-button" onclick="loadTransactionsTable()">Thử lại</button></td></tr>`;
  }
}
function renderPackagesTab() {
  $id('packagesGrid').innerHTML = bumpPackages.map(pkg => `<article class="workspace-panel package-card"><span>${pkg.bump_credits} lượt đẩy</span><h2>${E(pkg.name)}</h2><strong class="package-price">${formatVND(pkg.price)}</strong><p>${formatVND(Math.round(pkg.price / pkg.bump_credits))} / lượt</p><ul><li>Cộng ${pkg.bump_credits} lượt vào tài khoản</li><li>Mỗi lần đẩy dùng một lượt</li><li>Mỗi lần ưu tiên hiển thị 7 ngày</li></ul><button class="btn-fintab ${pkg.id === 'bump_saver' ? 'btn-fintab-primary' : 'btn-fintab-outline'}" onclick="buyBumpPackage('${E(pkg.id)}')">Mua ${pkg.bump_credits} lượt</button></article>`).join('');
}
async function loadMetrics() {
  try {
    const m = await readView('metrics', '/api/admin/metrics');
    const figures = [['Đơn hoàn tất trên hệ thống', m.completed_transactions], ['Đơn buyer xác nhận, seller đã duyệt', m.north_star_verified_transactions], ['GMV đơn hoàn tất', formatVND(m.gmv_completed)], ['Sản phẩm đang bán', m.active_real_listings], ['Seller đăng từ 2 sản phẩm', `${m.repeat_seller_rate}%`], ['Escrow đang giữ', formatVND(m.escrow_held_pool)], ['Phí sàn đã ghi nhận', formatVND(m.platform_fee_collected)], ['Trợ giá voucher', formatVND(m.voucher_subsidies)], ['Biến động ròng phí và trợ giá', formatVND(m.net_platform_movement)]];
    $id('metricsContent').innerHTML = `<div class="workspace-panel"><dl class="metric-list">${figures.map(([label, value]) => `<div><dt>${E(label)}</dt><dd>${E(value)}</dd></div>`).join('')}</dl></div><p class="muted">Tất cả số liệu trên thuộc dữ liệu mô phỏng. Chấp nhận đơn không đồng nghĩa xác nhận giao dịch thực tế. Đơn tự hoàn tất và đơn admin giải ngân không tính là buyer đã xác nhận. Ngân sách kế hoạch không phải số dư tiền mặt.</p>`;
  } catch (error) { blockError('metricsContent', error, 'loadMetrics()'); }
}
async function loadDisputesView() {
  if (currentUser?.role !== 'ADMIN') return;
  try {
    const orders = await readView('disputes', '/api/orders');
    renderAdminDisputes(orders.filter(o => o.status === 'DISPUTED'));
  } catch (error) { blockError('disputesList', error, 'loadDisputesView()'); }
}
function renderAdminDisputes(disputes) {
  $text('navDisputeCount', disputes.length || '');
  $id('disputesList').innerHTML = disputes.length ? `<div class="workspace-panel">${disputes.map(o => `<a class="task-row" href="#order/${o.id}"><div><strong>${E(o.product_title)}</strong><span>${E(o.buyer_name)} · ${E(o.dispute_reason)}</span></div><div><strong>${formatVND(o.total_paid)}</strong><span>Xem và xử lý →</span></div></a>`).join('')}</div>` : messageHTML('Không có tranh chấp đang chờ xử lý.');
}

// The long existing forms become dedicated screens, retaining every business step.
function mountForm(modalId, hostId) {
  const dialog = $id(modalId)?.querySelector('.fintab-modal-dialog');
  if (dialog) { $id(hostId).append(dialog); dialog.querySelector('.modal-header-bar')?.remove(); }
}
mountForm('modalCreateListing', 'listingFormHost'); mountForm('modalCheckout', 'checkoutFormHost');
function openModal(id) {
  document.querySelectorAll('.form-error').forEach(el => el.remove());
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  if (id === 'modalCreateListing') return switchNav('create');
  if (id === 'modalCheckout') return switchNav('checkout');
  document.querySelectorAll('.fintab-modal-overlay.open').forEach(el => el.classList.remove('open'));
  lastModalFocus = document.activeElement;
  const modal = $id(id); if (!modal) return;
  modal.classList.add('open'); modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
  const title = modal.querySelector('h3'); if (title) { title.id ||= `${id}Title`; modal.setAttribute('aria-labelledby', title.id); }
  modal.querySelector('button, input, select, textarea')?.focus();
}
function closeModal(id) {
  if (id === 'modalCreateListing') return switchNav('store');
  if (id === 'modalCheckout') return switchNav(checkoutProduct ? `product/${checkoutProduct.id}` : 'marketplace');
  $id(id)?.classList.remove('open'); lastModalFocus?.focus();
}
document.addEventListener('keydown', event => {
  const modal = document.querySelector('.fintab-modal-overlay.open');
  if (event.key === 'Escape') { if (modal) closeModal(modal.id); else toggleMenu(false); }
  if (event.key !== 'Tab' || !modal) return;
  const nodes = [...modal.querySelectorAll('button, input, select, textarea, a[href]')].filter(el => !el.disabled && el.getClientRects().length);
  const first = nodes[0], last = nodes.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
document.addEventListener('input', event => {
  event.target.removeAttribute('aria-invalid');
  event.target.parentElement?.querySelector('.field-error')?.remove();
});
function invalidField(id, message) {
  const field = $id(id); if (!field) return false;
  field.setAttribute('aria-invalid', 'true');
  let error = field.parentElement.querySelector('.field-error');
  if (!error) { error = document.createElement('small'); error.className = 'field-error'; error.id = `${id}Error`; field.after(error); }
  error.textContent = message; field.setAttribute('aria-describedby', error.id); field.focus(); return false;
}
// Wrap existing submitters rather than duplicate their payload contracts.
const originalCreateListing = submitCreateListing;
submitCreateListing = async function () {
  if (!$val('newPostTitle').trim()) return invalidField('newPostTitle', 'Nhập tên món đồ.');
  if (!Number.isSafeInteger(Number($val('newPostPrice'))) || Number($val('newPostPrice')) < workspaceConfig.min_product_price) return invalidField('newPostPrice', 'Giá tối thiểu 5.000đ, không có phần thập phân.');
  await originalCreateListing();
};
const originalCheckout = submitCheckout;
submitCheckout = async function () {
  if (!$val('checkoutRecipientName').trim()) return invalidField('checkoutRecipientName', 'Nhập tên người nhận.');
  if (!$val('checkoutRecipientPhone').trim()) return invalidField('checkoutRecipientPhone', 'Nhập số điện thoại.');
  const type = document.querySelector('input[name="deliveryType"]:checked')?.value;
  if (type === 'CAMPUS_MEETUP' && !$val('checkoutMeetupInput').trim()) return invalidField('checkoutMeetupInput', 'Nhập điểm hẹn bàn giao.');
  if (type !== 'CAMPUS_MEETUP' && !$val('checkoutDeliveryAddress').trim()) return invalidField('checkoutDeliveryAddress', 'Nhập địa chỉ nhận hàng chi tiết.');
  await originalCheckout();
};
const originalImageUpload = handleImageUpload;
handleImageUpload = function (event) {
  const file = event.target.files?.[0]; if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    event.target.value = ''; showToast('Chọn JPEG, PNG hoặc WebP tối đa 5 MB.', 'error'); return;
  }
  originalImageUpload(event);
};
