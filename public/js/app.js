
let currentCheckoutQuote = null;
let activeChatConversationId = null;
let chatPollInterval = null;
let currentChatAttachmentId = null;
let disputeAttachmentIds = [];
// TakeTwo shared state, existing authentication forms and business actions.
// Routing, focused views and request lifecycle live in workspace.js.

let currentUser = null;
let currentWallet = { available_balance: 0, escrow_balance: 0, boost_credits: 0 };
let allUsers = [];
let bumpPackages = [];
let currentCategory = 'all';
let currentTransactionTab = 'all';
let checkoutProduct = null;
let currentTransactionsList = [];
let liveInterval = null;
let isDemoMode = true;

// Centralized API fetch helper with automatic credentials (session cookies) and 401 handling
function $id(id) {
  return document.getElementById(id);
}
function $text(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val !== undefined && val !== null ? val : '';
}
function $val(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? el.value : fallback;
}
function $setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
function $src(id, src) {
  const el = document.getElementById(id);
  if (el) el.src = src;
}

document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
});

function openLoginModal(initialTab = 'login') {
  switchAuthTab(initialTab);
  renderLoginCards();
  openModal('modalLogin');
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  const isReg = tab === 'register';
  const isDemo = tab === 'demo';

  const tabLogin = $id('btnTabLogin');
  const tabReg = $id('btnTabRegister');
  const tabDemo = $id('btnTabDemo');

  const contentLogin = $id('authContentLogin');
  const contentReg = $id('authContentRegister');
  const contentDemo = $id('authContentDemo');

  if (tabLogin) {
    tabLogin.style.background = isLogin ? 'white' : 'transparent';
    tabLogin.style.color = isLogin ? 'var(--primary)' : 'var(--text-muted)';
    tabLogin.style.fontWeight = isLogin ? '700' : '600';
    tabLogin.style.boxShadow = isLogin ? '0 1px 2px rgba(0,0,0,0.06)' : 'none';
  }
  if (tabReg) {
    tabReg.style.background = isReg ? 'white' : 'transparent';
    tabReg.style.color = isReg ? 'var(--primary)' : 'var(--text-muted)';
    tabReg.style.fontWeight = isReg ? '700' : '600';
    tabReg.style.boxShadow = isReg ? '0 1px 2px rgba(0,0,0,0.06)' : 'none';
  }
  if (tabDemo) {
    tabDemo.style.background = isDemo ? 'white' : 'transparent';
    tabDemo.style.color = isDemo ? 'var(--primary)' : 'var(--text-muted)';
    tabDemo.style.fontWeight = isDemo ? '700' : '600';
    tabDemo.style.boxShadow = isDemo ? '0 1px 2px rgba(0,0,0,0.06)' : 'none';
  }

  if (contentLogin) contentLogin.style.display = isLogin ? 'block' : 'none';
  if (contentReg) contentReg.style.display = isReg ? 'block' : 'none';
  if (contentDemo) {
    contentDemo.style.display = isDemo ? 'block' : 'none';
    if (isDemo) renderLoginCards();
  }
}

function toggleLoginMethod(method) {
  const passBox = $id('loginPassBox');
  const otpBox = $id('loginOtpBox');
  if (method === 'otp') {
    if (passBox) passBox.style.display = 'none';
    if (otpBox) otpBox.style.display = 'block';
  } else {
    if (passBox) passBox.style.display = 'block';
    if (otpBox) otpBox.style.display = 'none';
  }
}

async function sendAuthOtp(type) {
  const emailInput = type === 'login' ? $id('loginEmail') : $id('regEmail');
  const email = emailInput ? emailInput.value.trim() : '';

  if (!email || !email.includes('@')) {
    showToast('Vui lòng nhập địa chỉ email hợp lệ trước khi gửi OTP!', 'error');
    if (emailInput) emailInput.focus();
    return;
  }

  try {
    const res = await apiFetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, type })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    showToast(data.message, 'success');

    // Auto-fill OTP field for demo convenience
    if (data.simulated_otp) {
      if (type === 'login') {
        $setVal('loginOtpCode', data.simulated_otp);
      } else {
        $setVal('regOtpCode', data.simulated_otp);
      }
    }

    // Disable button for 30s
    const btn = type === 'login' ? $id('btnSendLoginOtp') : $id('btnSendRegOtp');
    if (btn) {
      let countdown = 30;
      btn.disabled = true;
      const originText = btn.textContent;
      const timer = setInterval(() => {
        countdown--;
        btn.textContent = `Gửi lại (${countdown}s)`;
        if (countdown <= 0) {
          clearInterval(timer);
          btn.disabled = false;
          btn.textContent = originText;
        }
      }, 1000);
    }
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

async function submitAuthLogin() {
  const email = $val('loginEmail', '').trim();
  const methodRadios = document.getElementsByName('loginMethod');
  let method = 'password';
  for (const r of methodRadios) {
    if (r.checked) method = r.value;
  }

  const password = $val('loginPassword', '');
  const otp_code = $val('loginOtpCode', '');

  if (!email) {
    showToast('Vui lòng nhập địa chỉ email sinh viên!', 'error');
    return;
  }

  if (method === 'password' && !password) {
    showToast('Vui lòng nhập mật khẩu tài khoản!', 'error');
    return;
  }

  if (method === 'otp' && !otp_code) {
    showToast('Vui lòng nhập mã OTP 6 số đã gửi về email!', 'error');
    return;
  }

  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, otp_code, login_type: method })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    closeModal('modalLogin');
    localStorage.setItem('takeTwo_activeUserId', String(data.user.id));
    await loadMe();
    if (currentUser?.role === 'ADMIN') return;
    await loadFavoriteIds();
    if (!(await resumePendingCheckout())) await renderRoute();
    updateHeaderWalletDisplay();
    await loadUsers();
    showToast(data.message, 'success');

    await loadOverview();
    await loadProducts();
    await loadOrders();
    await loadTransactionsTable();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

async function submitAuthRegister() {
  const name = $val('regName', '').trim();
  const student_code = $val('regStudentCode', '').trim();
  const email = $val('regEmail', '').trim();
  const campus = $val('regCampus', 'Hòa Lạc');
  const password = $val('regPassword', '');
  const otp_code = $val('regOtpCode', '').trim();

  if (!name || !email || !password) {
    showToast('Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu!', 'error');
    return;
  }

  if (!otp_code) {
    showToast('Vui lòng bấm "Nhận Mã OTP" và nhập mã xác thực email!', 'error');
    return;
  }

  try {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, student_code, email, campus, password, otp: otp_code })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    closeModal('modalLogin');
    localStorage.setItem('takeTwo_activeUserId', String(data.user.id));
    await loadMe();
    if (currentUser?.role === 'ADMIN') return;
    await loadFavoriteIds();
    if (!(await resumePendingCheckout())) await renderRoute();
    updateHeaderWalletDisplay();
    await loadUsers();
    showToast(data.message, 'success');

    await loadOverview();
    await loadProducts();
    await loadOrders();
    await loadTransactionsTable();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

async function promptGoogleSSO() {
  const email = prompt('Nhập địa chỉ email trường ĐH hoặc Google Workspace của bạn:\n(Ví dụ: sinhvien.k20@fpt.edu.vn hoặc tuananh@vnu.edu.vn)', 'sinhvien.k20@fpt.edu.vn');
  if (!email || !email.trim()) return;

  const cleanEmail = email.trim();
  const name = cleanEmail.split('@')[0].replace(/[._]/g, ' ').toUpperCase();

  try {
    const res = await apiFetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        name: name,
        campus: 'Hòa Lạc',
        role: 'BUYER'
      })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    closeModal('modalLogin');
    localStorage.setItem('takeTwo_activeUserId', String(data.user.id));
    await loadMe();
    if (currentUser?.role === 'ADMIN') return;
    await loadFavoriteIds();
    if (!(await resumePendingCheckout())) await renderRoute();
    updateHeaderWalletDisplay();
    await loadUsers();
    showToast(data.message, 'success');

    await loadOverview();
    await loadProducts();
    await loadOrders();
    await loadTransactionsTable();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

async function handleLogin(userId) {
  closeModal('modalLogin');
  await onUserSwitch(userId);
  showToast(`Đăng nhập thành công! Chào mừng ${currentUser ? currentUser.name : ''}`, 'success');
}

function handleAuthClick() {
  if (currentUser) {
    handleLogout();
  } else {
    openLoginModal('login');
  }
}

function onFilterChange() {
  loadProducts();
}

function setCategoryPill(catId, btn) {
  currentCategory = catId;
  document.querySelectorAll('.btn-pill-group .btn-pill-item').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadProducts();
}

async function deleteProduct(productId) {
  if (!confirm('Bạn có chắc chắn muốn gỡ bài đăng này khỏi sàn TakeTwo không?')) return;
  try {
    const res = await apiFetch(`/api/products/${productId}/delete`, {
      method: 'POST',
      });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }
    showToast(data.message, 'success');
    await loadProducts();
    if (workspaceRoute === 'store') await loadStore();
    if (workspaceRoute.startsWith('product/')) await loadProductDetail(productId);
    await loadOverview();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

// 1-Click Bump Product to Top 1
async function quickBumpProduct(productId) {
  try {
    const res = await apiFetch(`/api/products/${productId}/bump`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }
    showToast(data.message, 'success');
    await loadMe();
    await loadProducts();
    if (workspaceRoute === 'store') await loadStore();
    if (workspaceRoute.startsWith('product/')) await loadProductDetail(productId);
    await loadTransactionsTable();
    await loadOverview();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

// -------------------------------------------------------------
// 3. FINTAB THU CHI (TRANSACTIONS / DEPOSIT) SỔ QUÝ
// -------------------------------------------------------------
function setTransactionTab(tab, btn) {
  currentTransactionTab = tab;
  document.querySelectorAll('#view-transactions .btn-pill-group .btn-pill-item').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadTransactionsTable();
}

function openVoucherReceiptModal(index) {
  const tx = currentTransactionsList[index];
  if (!tx) return;

  const isDeposit = tx.flow_type === 'IN';
  $text('voucherHeaderType', isDeposit ? 'PHIẾU THU TIỀN ĐIỆN TỬ (DEPOSIT)' : (tx.flow_type === 'HOLD' ? 'PHIẾU TẠM GIỮ TIỀN (ESCROW HOLD)' : 'PHIẾU CHI TIỀN ĐIỆN TỬ (PAYMENT)'));
  $text('vReceiptCode', tx.voucher_code || tx.reference_id || 'PT-20261102');
  $text('vReceiptDate', `Ngày hạch toán: ${tx.created_at}`);
  $text('vReceiptParty', `${tx.user_name || (currentUser ? currentUser.name : 'Sinh Viên')} (${tx.user_student_code || 'MSSV'})`);
  $text('vReceiptMethod', tx.payment_method || 'Ví TakeTwo Shield');
  $text('vReceiptDesc', tx.description);
  
  const amtEl = $id('vReceiptAmount');
  if (amtEl) {
    amtEl.textContent = `${isDeposit ? '+' : ''}${formatVND(tx.amount)}`;
    amtEl.style.color = isDeposit ? '#10B981' : '#EF4444';
  }
  
  $text('vReceiptBalAfter', formatVND(tx.balance_after));
  $text('vSignUser', tx.user_name || (currentUser ? currentUser.name : 'Sinh Viên'));

  openModal('modalVoucherReceipt');
}

// -------------------------------------------------------------
// 4. ORDERS & SHIPPING MANAGEMENT
// -------------------------------------------------------------
async function simulate5Days(orderId) {
  try {
    const res = await apiFetch(`/api/orders/${orderId}/simulate-5days`, {
      method: 'POST',
      });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }
    showToast(data.message, 'success');
    await loadMe();
    await loadOrders();
    await loadProducts();
    await loadTransactionsTable();
    await loadOverview();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

// Quick ship order helper
async function sellerAcceptOrder(orderId) {
  try {
    const res = await apiFetch(`/api/orders/${orderId}/accept`, {
      method: 'POST',
      });
    const data = await res.json();
    showToast(data.message, 'success');
    loadOrders();
    loadOverview();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

async function sellerShipOrder(orderId) {
  if (!confirm('Xác nhận đã bàn giao trực tiếp cho người mua?')) return;
  try {
    const res = await apiFetch(`/api/orders/${orderId}/ship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    const data = await res.json();
    showToast(data.message, 'success');
    loadOrders();
    loadOverview();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

async function buyerConfirmOrder(orderId) {
  if (!confirm('Bạn xác nhận đã nhận được món đồ đúng mô tả và đồng ý giải phóng tiền Escrow cho Người bán?')) return;
  try {
    const res = await apiFetch(`/api/orders/${orderId}/confirm`, {
      method: 'POST',
      });
    const data = await res.json();
    showToast(data.message, 'success');
    await loadMe();
    await loadOrders();
    await loadProducts();
    await loadTransactionsTable();
    await loadOverview();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

function openDisputeModal(orderId) {
  $setVal('disputeOrderId', orderId);
  openModal('modalDispute');
}

async function submitDispute() {
  const orderId = $val('disputeOrderId', '');
  const reason = $val('disputeReasonInput', '');
  if (!reason.trim()) {
    showToast('Vui lòng nhập lý do khiếu nại', 'error');
    return;
  }

  try {
    const res = await apiFetch(`/api/orders/${orderId}/dispute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    closeModal('modalDispute');
    showToast(data.message, 'success');
    loadOrders();
    loadOverview();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

// -------------------------------------------------------------
// CHECKOUT & ESCROW ORDER MODAL (QUOTE API & VOUCHER ENGINE)
// -------------------------------------------------------------
async function openCheckoutModal(productId) {
  if (!currentUser) {
    pendingCheckout = { productId: Number(productId), userId: null };
    showToast('Vui lòng đăng nhập tài khoản sinh viên để đặt mua đồ!', 'info');
    openLoginModal();
    return;
  }
  if (currentUser.role === 'ADMIN') {
    showToast('Tài khoản Quản trị viên (ADMIN) không được phép đặt mua hàng!', 'error');
    return;
  }
  try {
    const res = await apiFetch(`/api/products/${productId}`);
    checkoutProduct = await res.json();

    if (currentUser && currentUser.id === checkoutProduct.seller_id) {
      showToast('Bạn không thể tự mua món đồ do chính mình đăng!', 'error');
      return;
    }

    $src('checkoutProductImg', checkoutProduct.image_url);
    $text('checkoutProductTitle', checkoutProduct.title);
    $text('checkoutProductPrice', formatVND(checkoutProduct.price));
    $text('checkoutSellerInfo', `Người bán: ${checkoutProduct.seller_name} (${checkoutProduct.seller_rating})`);
    $text('checkoutMeetupAddress', `Điểm hẹn gợi ý: ${checkoutProduct.meetup_location || 'Hẹn gặp trực tiếp'} (${checkoutProduct.campus_cluster})`);
    $text('checkoutCurrentBalance', `Khả dụng: ${formatVND(currentWallet.available_balance)}`);

    if (currentUser && !$val('checkoutRecipientName')) {
      $setVal('checkoutRecipientName', currentUser.name);
    }
    if (!$val('checkoutRecipientPhone')) {
      $setVal('checkoutRecipientPhone', '');
    }
    if (checkoutProduct.meetup_location && !$val('checkoutMeetupInput')) {
      $setVal('checkoutMeetupInput', checkoutProduct.meetup_location);
    }

    await fetchCheckoutQuote();
    if (!currentUser || !checkoutProduct) return;
    openModal('modalCheckout');
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

async function fetchCheckoutQuote() {
  if (!checkoutProduct) return;
  const deliveryTypeEl = document.querySelector('input[name="deliveryType"]:checked');
  const deliveryType = deliveryTypeEl ? deliveryTypeEl.value : 'CAMPUS_MEETUP';
  const voucherCode = $val('checkoutVoucherInput', '').trim().toUpperCase();

  const isCourier = deliveryType !== 'CAMPUS_MEETUP';
  const courierGroup = $id('courierAddressGroup');
  if (courierGroup) courierGroup.style.display = isCourier ? 'block' : 'none';
  const meetupGroup = $id('meetupLocationGroup');
  if (meetupGroup) meetupGroup.style.display = !isCourier ? 'block' : 'none';

  const generation = quoteRequest;
  try {
    const res = await apiFetch('/api/checkout/quote', {
      method: 'POST',
      body: {
        product_id: checkoutProduct.id,
        delivery_type: deliveryType,
        voucher_code: voucherCode || undefined
      }
    });
    const quote = await res.json();
    if (generation !== quoteRequest) return;
    currentCheckoutQuote = quote;

    $text('billItemAmount', formatVND(quote.price));
    $text('billShippingFee', formatVND(quote.shipping_fee));
    $text('billVoucherDiscount', quote.discount > 0 ? `- ${formatVND(quote.discount)}` : '0 đ');
    $text('billTotalAmount', formatVND(quote.total_paid));
    $text('billPlatformFee', formatVND(quote.commission));

    const vMsg = $id('checkoutVoucherMessage');
    if (vMsg) {
      if (quote.applied_voucher) {
        vMsg.innerHTML = `<span style="color: #10B981; font-weight: 600;">✓ Đã áp dụng: ${E(quote.applied_voucher.title)} (-${formatVND(quote.discount)})</span>`;
      } else if (voucherCode) {
        vMsg.textContent = quote.voucher_error || 'Voucher không hợp lệ';
      } else {
        vMsg.textContent = '';
      }
    }

    const alertBox = $id('checkoutBalanceAlert');
    const missingText = $id('checkoutMissingText');
    const btnConfirm = $id('btnConfirmCheckout');

    if (!(quote.missing_amount === 0)) {
      if (alertBox) alertBox.style.display = 'block';
      if (missingText) missingText.textContent = `Ví hiện có ${formatVND(currentWallet.available_balance)}. Còn thiếu ${formatVND(quote.missing_amount)}. Gợi ý nạp: ${formatVND(quote.suggested_topup)}.`;
      if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = `Ví Không Đủ - Cần Nạp Thêm (${formatVND(quote.missing_amount)})`;
        btnConfirm.style.background = '#94A3B8';
      }
    } else {
      if (alertBox) alertBox.style.display = 'none';
      if (btnConfirm) {
        btnConfirm.disabled = Boolean(quote.voucher_error);
        btnConfirm.innerHTML = `Xác Nhận & Giữ Tiền Escrow (${formatVND(quote.total_paid)})`;
        btnConfirm.style.background = 'var(--primary)';
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateCheckoutTotal() {
  fetchCheckoutQuote();
}

async function applyCheckoutVoucher() {
  await fetchCheckoutQuote();
  if (currentCheckoutQuote?.applied_voucher) {
    showToast(`Áp dụng voucher ${currentCheckoutQuote.applied_voucher.code} thành công!`, 'success');
  }
}

function openTopupFromCheckout() {
  const suggested = currentCheckoutQuote?.suggested_topup || 50000;
  $setVal('topupCustomAmount', suggested);
  $src('qrMockupImg', `https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=TAKETWO-TOPUP-${suggested}`);
  openModal('modalTopup');
}

async function submitCheckout() {
  if (!checkoutProduct) return;
  const deliveryTypeEl = document.querySelector('input[name="deliveryType"]:checked');
  const deliveryType = deliveryTypeEl ? deliveryTypeEl.value : 'CAMPUS_MEETUP';
  const recipientName = $val('checkoutRecipientName', '').trim();
  const recipientPhone = $val('checkoutRecipientPhone', '').trim();
  const meetupLocation = $val('checkoutMeetupInput', '').trim();
  const deliveryAddress = $val('checkoutDeliveryAddress', '').trim();
  const voucherCode = $val('checkoutVoucherInput', '').trim();

  let finalAddress = '';
  if (deliveryType === 'CAMPUS_MEETUP') {
    if (!meetupLocation) {
      showToast('Vui lòng nhập điểm hẹn giao nhận trực tiếp', 'error');
      return;
    }
    finalAddress = meetupLocation;
  } else {
    if (!deliveryAddress) {
      showToast('Vui lòng nhập địa chỉ nhận hàng chi tiết (Tòa KTX / Phòng / Khu trọ)', 'error');
      return;
    }
    finalAddress = deliveryAddress;
  }

  try {
    const res = await apiFetch('/api/orders/checkout', {
      method: 'POST',
      body: {
        product_id: checkoutProduct.id,
        delivery_type: deliveryType,
        delivery_address: finalAddress,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        voucher_code: voucherCode || undefined,
        expected_total: currentCheckoutQuote?.total_paid
      }
    });

    const data = await res.json();
    sessionStorage.removeItem(checkoutDraftKey());
    switchNav(`order/${data.order_id}`);
    showToast(`Đặt mua thành công đơn ${data.order_code}! Tiền đã khóa trong Két Escrow bảo vệ 5 ngày.`, 'success');
    try {
      await loadMe();
      await loadOrders();
    } catch (refreshError) {
      showToast('Đơn đã được tạo. Không tải lại được dữ liệu; mở Đơn hàng và chọn Thử lại.', 'info');
    }
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}
// -------------------------------------------------------------
// TOPUP & WITHDRAW WALLET
// -------------------------------------------------------------
function openTopupModal() {
  openModal('modalTopup');
}

function setTopupAmount(amt) {
  $setVal('topupCustomAmount', amt);
  $src('qrMockupImg', `https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=TAKETWO-TOPUP-${amt}`);
}

async function simulateTopupSuccess() {
  const amt = $val('topupCustomAmount', '100000');
  try {
    const res = await apiFetch('/api/wallet/topup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amt,
        bank_name: 'MBBank'
      })
    });
    const data = await res.json();
    closeModal('modalTopup');
    showToast(`Nạp thành công +${formatVND(amt)}! Mã phiếu: ${data.voucher_code}`, 'success');
    await loadMe();
    await loadTransactionsTable();
    await loadOverview();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

function openWithdrawModal() {
  showToast('🔒 Ví TakeTwo là ví dịch vụ đóng. Không hỗ trợ rút tiền về ngân hàng.', 'info');
}

async function submitWithdraw() {
  showToast('🔒 Ví TakeTwo là ví dịch vụ đóng. Không hỗ trợ rút tiền về ngân hàng.', 'info');
}

// -------------------------------------------------------------
// BUMP PACKAGES & 1-CLICK BOOST
// -------------------------------------------------------------
async function loadBumpPackages() {
  try {
    const res = await apiFetch('/api/bump-packages');
    bumpPackages = await res.json();
  } catch (err) {
    console.error('Error loading bump packages:', err);
  }
}

async function buyBumpPackage(packageId) {
  if (!currentUser) {
    showToast('Vui lòng đăng nhập để mua gói đẩy bài!', 'info');
    openLoginModal('login');
    return;
  }
  try {
    const res = await apiFetch('/api/bump-packages/buy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ package_id: packageId })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }
    showToast(` ${data.message}`, 'success');
    await loadMe();
    await loadTransactionsTable();
    await loadOverview();
    renderPackagesTab();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

function handleImageUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const dataUrl = evt.target.result;
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let width = img.width;
      let height = img.height;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const optimizedUrl = canvas.toDataURL('image/jpeg', 0.85);

      $setVal('newPostImageUrl', optimizedUrl);
      const previewImg = $id('newPostImagePreview');
      const previewWrapper = $id('imagePreviewWrapper');
      const uploadPrompt = $id('uploadPrompt');
      if (previewImg) previewImg.src = optimizedUrl;
      if (previewWrapper) previewWrapper.style.display = 'block';
      if (uploadPrompt) uploadPrompt.style.display = 'none';
      showToast('Đã tải và xử lý ảnh thật thành công!', 'success');
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

async function openCreateListingModal() {
  if (!currentUser) {
    showToast('Vui lòng đăng nhập tài khoản sinh viên để đăng bán đồ!', 'info');
    openLoginModal('login');
    return;
  }
  $setVal('newPostImageUrl', '');
  const fileInput = $id('newPostImageFile');
  if (fileInput) fileInput.value = '';
  const previewWrapper = $id('imagePreviewWrapper');
  if (previewWrapper) previewWrapper.style.display = 'none';
  const uploadPrompt = $id('uploadPrompt');
  if (uploadPrompt) uploadPrompt.style.display = 'block';
  openModal('modalCreateListing');
}

async function submitCreateListing() {
  const title = $val('newPostTitle', '');
  const category_id = $val('newPostCategory', 'books');
  const condition_level = $val('newPostCondition', 'Tốt 90%');
  const price = $val('newPostPrice', '');
  const original_price = $val('newPostOriginalPrice', '');
  const campus_cluster = $val('newPostCampusCluster', 'Hòa Lạc');
  const meetup_location = $val('newPostMeetupLocation', '');
  const defect_note = $val('newPostDefectNote', '');
  const image_url = $val('newPostImageUrl', '');

  if (!title || !price) {
    showToast('Vui lòng điền đầy đủ các thông tin bắt buộc (*)', 'error');
    return;
  }

  const defaultCategoryImages = {
    books: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
    living: 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?auto=format&fit=crop&w=600&q=80',
    electronics: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
    fashion: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80'
  };
  const finalImage = image_url || defaultCategoryImages[category_id] || defaultCategoryImages.books;

  try {
    const res = await apiFetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title, category_id, condition_level, price, original_price,
        campus_cluster, meetup_location, defect_note, image_url: finalImage
      })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    closeModal('modalCreateListing');
    showToast(data.message, 'success');

    // Reset filters so the newly posted product is immediately visible
    currentCategory = 'all';
    document.querySelectorAll('.btn-pill-group .btn-pill-item').forEach(el => el.classList.remove('active'));
    const firstPill = document.querySelector('.btn-pill-group .btn-pill-item');
    if (firstPill) firstPill.classList.add('active');
    $setVal('marketCampusSelect', 'all');
    $setVal('globalSearchInput', '');

    switchNav(`product/${data.product_id}`);
    await loadStore();
    await loadOverview();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

// -------------------------------------------------------------
// DISPUTES & ADMIN 5 KPIS
// -------------------------------------------------------------
async function resolveDisputeAdmin(orderId, decision) {
  if (!confirm(`Bạn chắc chắn muốn thực thi phán quyết "${decision}" cho đơn hàng này?`)) return;
  try {
    const res = await apiFetch(`/api/orders/${orderId}/admin-resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ decision })
    });
    const data = await res.json();
    showToast(data.message, 'success');
    loadDisputesView();
    loadOrders();
    loadMe();
    loadTransactionsTable();
  } catch (err) {
    showToast(err.message || 'Không thể xử lý thao tác. Vui lòng thử lại.', 'error');
  }
}

// -------------------------------------------------------------
// UTILITIES & MODAL
// -------------------------------------------------------------
function formatVND(amount) {
  if (amount === undefined || amount === null) return '0 đ';
  return Number(amount).toLocaleString('vi-VN') + ' đ';
}


// -------------------------------------------------------------
// PRE-PURCHASE REAL-TIME CHAT MODULE
// -------------------------------------------------------------
async function openChatWithSeller(productId) {
  if (!currentUser) {
    showToast('Vui lòng đăng nhập để nhắn tin với người bán!', 'info');
    openLoginModal();
    return;
  }
  if (currentUser.role === 'ADMIN') {
    showToast('Tài khoản Quản trị viên (ADMIN) không được phép tham gia chat người dùng!', 'error');
    return;
  }
  try {
    const res = await apiFetch('/api/chat/conversations', {
      method: 'POST',
      body: { product_id: productId }
    });
    const data = await res.json();
    switchNav(`chat/${data.id}`);
  } catch (err) {
    showToast(err.message || 'Không thể mở hội thoại chat.', 'error');
  }
}

function stopChatPoll() {
  if (chatPollInterval) {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }
}

async function loadChatView(requestedConvId) {
  if (!currentUser) return;
  try {
    const res = await apiFetch('/api/chat/conversations');
    const convs = await res.json();
    renderChatConversationsList(convs, requestedConvId);

    const activeId = requestedConvId ? Number(requestedConvId) : (convs.length ? convs[0].id : null);
    if (activeId) {
      await selectChatConversation(activeId);
    } else {
      activeChatConversationId = null;
      $id('chatEmptyPlaceholder').style.display = 'block';
      $id('chatActiveContent').style.display = 'none';
    }

    // Start polling every 3 seconds while on chat view
    stopChatPoll();
    chatPollInterval = setInterval(async () => {
      if (document.hidden || !currentUser || !workspaceRoute.startsWith('chat')) return;
      if (activeChatConversationId) {
        await refreshActiveChatMessages(activeChatConversationId);
      }
    }, 3000);
  } catch (err) {
    console.error('Chat load error:', err);
  }
}

function renderChatConversationsList(convs, activeId) {
  const container = $id('chatConversationsList');
  if (!container) return;
  if (!convs.length) {
    container.innerHTML = '<div style="padding: 16px; font-size: 12.5px; color: var(--text-muted); text-align: center;">Chưa có hội thoại nào.</div>';
    return;
  }

  container.innerHTML = convs.map(c => {
    const isAct = activeId && Number(activeId) === c.id;
    return `
      <div class="chat-conversation-item ${isAct ? 'active' : ''}" onclick="selectChatConversation(${c.id})">
        <img class="chat-conv-thumb" src="${imageURL(c.product_image)}" alt="">
        <div class="chat-conv-meta">
          <div class="chat-conv-top">
            <span class="chat-conv-name">${E(currentUser.id === c.buyer_id ? c.seller_name : c.buyer_name)}</span>
            ${c.unread_count > 0 ? `<span class="chat-unread-badge">${c.unread_count}</span>` : ''}
          </div>
          <div class="chat-conv-title">${E(c.product_title)}</div>
          <div class="chat-conv-snippet">${E(c.last_message || 'Bắt đầu cuộc trò chuyện...')}</div>
        </div>
      </div>`;
  }).join('');
}

async function selectChatConversation(convId) {
  if (workspaceRoute !== `chat/${convId}`) { switchNav(`chat/${convId}`); return; }
  if (chatHistoryConvId !== Number(convId)) { chatHistoryConvId = Number(convId); chatLoadedMessages = []; }
  activeChatConversationId = Number(convId);
  try {
    const res = await apiFetch(`/api/chat/conversations/${convId}`);
    const data = await res.json();
    const conv = data.conversation;
    const messages = data.messages || [];
    if (!chatLoadedMessages.length) chatHasEarlier = data.has_more;

    $id('chatEmptyPlaceholder').style.display = 'none';
    $id('chatActiveContent').style.display = 'flex';

    // Update banner
    const banner = $id('chatProductBanner');
    if (banner) {
      banner.innerHTML = `
        <div class="chat-banner-info">
          <img src="${imageURL(conv.product_image)}" alt="">
          <div>
            <strong>${E(conv.product_title)}</strong>
            <span>${formatVND(conv.product_price)}</span>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <a class="btn-fintab btn-fintab-outline" href="#product/${conv.product_id}" style="font-size: 11.5px; padding: 4px 10px;">Xem sản phẩm</a>
          ${conv.product_status === 'AVAILABLE' && currentUser.id !== conv.seller_id ? `<button class="btn-fintab btn-fintab-primary" onclick="openCheckoutModal(${conv.product_id})" style="font-size: 11.5px; padding: 4px 10px;">Đặt mua ngay</button>` : ''}
        </div>`;
    }

    renderChatMessages(messages);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function refreshActiveChatMessages(convId) {
  try {
    const res = await apiFetch(`/api/chat/conversations/${convId}`);
    const data = await res.json();
    renderChatMessages(data.messages || [], false);
  } catch (err) {
    // quiet polling
  }
}

function renderChatMessages(messages, scrollToBottom = true) {
  const container = $id('chatMessagesScroll');
  if (!container) return;

  const merged = new Map(chatLoadedMessages.map(m=>[m.id,m]));
  messages.forEach(m=>merged.set(m.id,m));
  chatLoadedMessages = [...merged.values()].sort((a,b)=>a.id-b.id);
  container.innerHTML = (chatHasEarlier ? '<button class="text-button" onclick="loadEarlierChat()">Tải tin nhắn trước đó</button>' : '') + chatLoadedMessages.map(m => {
    const isMine = m.sender_id === currentUser.id;
    return `
      <div class="chat-bubble-row ${isMine ? 'mine' : 'theirs'}">
        <span class="chat-sender-label">${isMine ? 'Bạn' : E(m.sender_name)}</span>
        <div class="chat-bubble">
          ${m.content ? `<div>${E(m.content)}</div>` : ''}
          ${m.attachment_url ? `<a href="${m.attachment_url}" target="_blank"><img class="chat-msg-attachment" src="${m.attachment_url}" alt="Bằng chứng đính kèm"></a>` : ''}
        </div>
        <span class="chat-msg-time">${E(m.created_at)}</span>
      </div>`;
  }).join('');

  if (scrollToBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

async function submitChatMessage() {
  if (!activeChatConversationId) return;
  const input = $id('chatTextInput');
  const text = input ? input.value.trim() : '';

  if (!text && !currentChatAttachmentId) return;

  try {
    await apiFetch(`/api/chat/conversations/${activeChatConversationId}/messages`, {
      method: 'POST',
      body: {
        content: text,
        client_id: chatRetryKey || (chatRetryKey = crypto.randomUUID()),
        attachment_id: currentChatAttachmentId || undefined
      }
    });

    chatRetryKey = null;
    if (input) input.value = '';
    clearChatAttachment();
    await selectChatConversation(activeChatConversationId);
  } catch (err) {
    showToast(err.message || 'Không thể gửi tin nhắn.', 'error');
  }
}

async function handleChatFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(evt) {
    const base64Data = evt.target.result;
    try {
      showToast('Đang tải ảnh đính kèm...', 'info');
      const res = await apiFetch('/api/upload', {
        method: 'POST',
        body: {
          file_base64: base64Data,
          file_name: file.name,
          file_type: file.type
        }
      });
      const data = await res.json();
      currentChatAttachmentId = data.attachment_id;

      $id('chatAttachmentName').textContent = `📷 Đã đính kèm: ${file.name}`;
      $id('chatAttachmentPreviewBox').style.display = 'flex';
      showToast('Đã đính kèm ảnh, bấm Gửi để hoàn tất.', 'success');
    } catch (err) {
      showToast(err.message || 'Lỗi tải ảnh.', 'error');
    }
  };
  reader.readAsDataURL(file);
}

function clearChatAttachment() {
  currentChatAttachmentId = null;
  const box = $id('chatAttachmentPreviewBox');
  if (box) box.style.display = 'none';
  const fileInput = $id('chatFileInput');
  if (fileInput) fileInput.value = '';
}
