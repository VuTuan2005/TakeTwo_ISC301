const { randomUUID } = require('node:crypto');
const config = require('../config');

class BusinessError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new BusinessError(status, message); };
const code = prefix => `${prefix}-${randomUUID()}`;
function money(value, minimum = 1) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') fail(400, 'Số tiền không hợp lệ.');
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < minimum || amount > config.max_amount) fail(400, `Số tiền phải là số nguyên từ ${minimum.toLocaleString('vi-VN')} đến ${config.max_amount.toLocaleString('vi-VN')}đ.`);
  return amount;
}

function createMarketplace(db) {
  let depth = 0;
  const journal = require('./ledger')(db);
  const vouchers = require('./vouchers')(db);
  function atomic(work) {
    if (depth) return work();
    db.exec('BEGIN IMMEDIATE');
    depth++;
    try {
      const value = work();
      if (value && typeof value.then === 'function') throw new Error('Do not await inside a SQLite transaction.');
      db.exec('COMMIT');
      return value;
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw error;
    } finally { depth--; }
  }

  const wallet = userId => {
    const result = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId);
    if (!result) fail(409, 'Không tìm thấy ví của tài khoản.');
    return result;
  };

  function entry(w, type, flow, amount, reference, description, method = 'Ví TakeTwo (mô phỏng)') {
    const after = w.available_balance + amount;
    if (!Number.isSafeInteger(after) || after < 0 || after > config.max_amount) fail(409, 'Số dư ví không đủ hoặc vượt giới hạn.');
    db.prepare("UPDATE wallets SET available_balance = ?, updated_at = datetime('now') WHERE id = ?").run(after, w.id);
    const voucher = code(flow === 'IN' ? 'PT' : 'PC');
    db.prepare(`INSERT INTO wallet_transactions
      (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(w.id, type, flow, voucher, method, amount, w.available_balance, after, reference, description);
    return { voucher_code: voucher, new_balance: after, remaining_balance: after };
  }

  function platformEntry(order, type, amount) {
    db.prepare("INSERT OR REPLACE INTO platform_entries (order_id, type, amount, created_at) VALUES (?, ?, ?, datetime('now'))")
      .run(order.id, type, amount);
  }

  function orderById(id) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) fail(404, 'Không tìm thấy đơn hàng.');
    return order;
  }

  const authorize = (user, ownerId) => {
    if (user.role === 'ADMIN') fail(403, 'Quản trị viên không thực hiện thao tác trực tiếp của người dùng.');
    if (user.id !== ownerId) fail(403, 'Bạn không có quyền thực hiện thao tác trên đơn này.');
  };

  function assertHeld(order, statuses) {
    if (!statuses.includes(order.status) || order.escrow_status !== 'HELD') fail(409, 'Trạng thái đơn không cho phép thao tác này.');
    if (wallet(order.buyer_id).escrow_balance !== db.prepare("SELECT COALESCE(SUM(total_paid), 0) n FROM orders WHERE buyer_id = ? AND escrow_status = 'HELD'").get(order.buyer_id).n) fail(409, 'Tiền tạm giữ không đủ. Cần đối soát dữ liệu trước khi xử lý.');
  }

  // Settle order on completion (Buyer confirmed or auto-confirm after 120h)
  // Per PLAN.md 1.3:
  // Buyer pays: P + S - D
  // Seller receives: P - F (Shipping fee is NOT paid to seller!)
  // Shipping payable: S (owed to logistics unit)
  // Platform net: F - D
  function settle(order, status, buyerConfirmed = false) {
    assertHeld(order, status === 'COMPLETED_AUTO' ? ['DELIVERING'] : ['DELIVERING', 'DISPUTED']);
    const commission = Math.round(order.amount * config.commission_rate);
    const sellerPayout = order.amount - commission;

    const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(order.id);
    if (order.shipping_fee > 0 && !shipment?.picked_up_at) fail(409, 'Chưa ghi nhận đơn vị vận chuyển lấy hàng; không thể giải ngân đơn vận chuyển này.');
    journal(`settle:${order.id}`, order.id, [
      ['ORDER_ESCROW', order.id, -order.total_paid], ['USER_AVAILABLE', order.seller_id, sellerPayout],
      [shipment?.picked_up_at ? 'SHIPPING_CLEARING' : 'CARRIER_PAYABLE', order.id, order.shipping_fee],
      ['FEE_REVENUE', 'platform', commission], ['VOUCHER_EXPENSE', 'platform', -order.discount]
    ]);
    // Deduct total_paid from buyer's escrow
    db.prepare("UPDATE wallets SET escrow_balance = escrow_balance - ?, updated_at = datetime('now') WHERE user_id = ?")
      .run(order.total_paid, order.buyer_id);

    // Pay seller P - F
    entry(wallet(order.seller_id), 'ESCROW_RELEASE', 'IN', sellerPayout, order.order_code,
      `Giải ngân ${order.order_code}: giá hàng ${order.amount.toLocaleString('vi-VN')}đ - phí sàn ${commission.toLocaleString('vi-VN')}đ`);

    // Financial ledger records
    platformEntry(order, 'COMMISSION', commission);
    if (order.discount > 0) {
      platformEntry(order, 'VOUCHER_SUBSIDY', -order.discount);
    }
    if (order.shipping_fee > 0) {
      platformEntry(order, 'SHIPPING_PAYABLE', order.shipping_fee);
    }

    vouchers.finish(order, true);

    // Update shipment status if courier shipment
    db.prepare("UPDATE shipments SET status = 'DELIVERED', updated_at = datetime('now') WHERE order_id = ?").run(order.id);

    // Update order record
    db.prepare(`UPDATE orders SET status = ?, escrow_status = 'RELEASED', buyer_confirmed = ?,
      seller_payout = ?, platform_fee = ?, auto_confirm_deadline = NULL, updated_at = datetime('now') WHERE id = ?`)
      .run(status, buyerConfirmed ? 1 : 0, sellerPayout, commission, order.id);

    db.prepare("UPDATE products SET status = 'SOLD' WHERE id = ?").run(order.product_id);
    db.prepare('UPDATE users SET eco_points = eco_points + 50, co2_saved_kg = co2_saved_kg + 2.5 WHERE id = ?').run(order.buyer_id);

    return {
      success: true,
      message: 'Đã giải ngân một lần cho người bán (mô phỏng).',
      commission,
      seller_payout: sellerPayout,
      shipping_fee: order.shipping_fee
    };
  }

  // Dispute refund after platform fee retained (PLAN.md 1.2 & 1.3):
  // "Hoàn tiền cho buyer sau khi trừ phí sàn"
  // Buyer refund: C - Fr (Fr = min(F, C))
  // Seller receives: 0
  // Platform fee retained: Fr
  // Courier payable incurred: K (if picked up, K = S; else 0)
  // Platform net: Fr - K
  function refundAfterFee(order, reason, adminId) {
    assertHeld(order, ['DISPUTED']);
    const commission = Math.round(order.amount * config.commission_rate);
    const retainedFee = Math.min(commission, order.total_paid);
    const refundToBuyer = order.total_paid - retainedFee;

    const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(order.id);
    const shippingIncurred = shipment?.picked_up_at ? shipment.fee_payable : 0;
    journal(`settle:${order.id}`, order.id, [
      ['ORDER_ESCROW', order.id, -order.total_paid], ['USER_AVAILABLE', order.buyer_id, refundToBuyer],
      ['FEE_REVENUE', 'platform', retainedFee], ['SHIPPING_EXPENSE', 'platform', -shippingIncurred],
      ['SHIPPING_CLEARING', order.id, shippingIncurred]
    ]);

    // Deduct buyer escrow
    db.prepare('UPDATE wallets SET escrow_balance = escrow_balance - ?, updated_at = datetime(\'now\') WHERE user_id = ?')
      .run(order.total_paid, order.buyer_id);

    // Credit buyer with C - Fr
    if (refundToBuyer > 0) {
      entry(wallet(order.buyer_id), 'REFUND', 'IN', refundToBuyer, order.order_code,
        `Hoàn tiền sau khi trừ phí sàn ${order.order_code} (Trừ ${retainedFee.toLocaleString('vi-VN')}đ phí sàn)`);
    }

    // Platform records
    platformEntry(order, 'RETAINED_FEE', retainedFee);
    if (shippingIncurred > 0) {
      platformEntry(order, 'SHIPPING_ABSORBED', -shippingIncurred);
    }

    vouchers.finish(order, false);

    // Update dispute record
    db.prepare(`UPDATE disputes 
      SET status = 'RESOLVED', admin_reviewed = 1, admin_decision = 'REFUND_BUYER', admin_reason = ?,
          resolved_by = ?, resolved_at = datetime('now'), updated_at = datetime('now')
      WHERE order_id = ?`).run(reason || 'Hoàn tiền cho người mua sau khi trừ phí sàn.', adminId, order.id);

    // Update order
    db.prepare(`UPDATE orders 
      SET status = 'CANCELLED', escrow_status = 'REFUNDED', seller_payout = 0, refund_amount = ?, retained_fee = ?,
          shipping_cost_incurred = ?, admin_resolution_reason = ?, admin_resolver_id = ?, admin_resolved_at = datetime('now'),
          auto_confirm_deadline = NULL, updated_at = datetime('now')
      WHERE id = ?`)
      .run(refundToBuyer, retainedFee, shippingIncurred, reason || 'Hoàn tiền sau khi trừ phí sàn', adminId, order.id);
    db.prepare("UPDATE shipments SET status = 'CANCELLED', updated_at = datetime('now') WHERE order_id = ?").run(order.id);

    // Quality complaint: item sent back to PENDING_APPROVAL per PLAN.md 3.7
    db.prepare("UPDATE products SET status = 'AVAILABLE', approval_status = 'PENDING_APPROVAL' WHERE id = ?").run(order.product_id);

    return {
      success: true,
      message: 'Đã hoàn tiền cho người mua sau khi trừ phí sàn.',
      refund_amount: refundToBuyer,
      retained_fee: retainedFee,
      shipping_absorbed: shippingIncurred
    };
  }

  // Pre-processing cancellation (Buyer cancel or seller reject when REQUESTED)
  function cancelRequested(user, orderId, isSeller = false, reason = '') {
    const order = orderById(orderId);
    assertHeld(order, ['REQUESTED']);
    if (isSeller) {
      if (user.id !== order.seller_id) fail(403, 'Chỉ người bán của đơn mới được từ chối đơn hàng.');
    } else {
      if (user.id !== order.buyer_id) fail(403, 'Chỉ người mua của đơn mới được hủy đơn chờ xử lý.');
    }

    journal(`settle:${order.id}`, order.id, [['ORDER_ESCROW', order.id, -order.total_paid], ['USER_AVAILABLE', order.buyer_id, order.total_paid]]);
    // 100% refund of total_paid to buyer, 0 fee, 0 shipping cost
    db.prepare('UPDATE wallets SET escrow_balance = escrow_balance - ?, updated_at = datetime(\'now\') WHERE user_id = ?')
      .run(order.total_paid, order.buyer_id);

    entry(wallet(order.buyer_id), 'REFUND', 'IN', order.total_paid, order.order_code,
      isSeller ? `Người bán từ chối đơn ${order.order_code}: ${reason || 'Không thể thực hiện giao dịch'}`
               : `Người mua hủy đơn ${order.order_code} trước khi người bán nhận đơn`);

    vouchers.finish(order, false);

    // Cancel shipment if created
    db.prepare("UPDATE shipments SET status = 'CANCELLED', updated_at = datetime('now') WHERE order_id = ?").run(order.id);

    // Cancel order
    db.prepare(`UPDATE orders SET status = 'CANCELLED', escrow_status = 'REFUNDED', seller_payout = 0, refund_amount = ?,
      auto_confirm_deadline = NULL, updated_at = datetime('now') WHERE id = ?`).run(order.total_paid, order.id);

    // Product back to AVAILABLE
    db.prepare("UPDATE products SET status = 'AVAILABLE' WHERE id = ?").run(order.product_id);

    return {
      success: true,
      message: isSeller ? 'Đã từ chối đơn hàng và hoàn tiền cho người mua.' : 'Đã hủy đơn hàng và hoàn tiền vào ví.'
    };
  }

  // Quote API for checkout preview
  function quote(user, body) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(body.product_id);
    if (!product) fail(404, 'Sản phẩm không tồn tại.');
    if (product.status !== 'AVAILABLE') fail(409, 'Sản phẩm đã được giữ chỗ hoặc không còn bán.');
    if (product.approval_status !== 'APPROVED') fail(409, 'Sản phẩm chưa được duyệt.');
    if (!user || user.role === 'ADMIN') fail(403, 'Chỉ người mua được lấy báo giá.');
    const price = money(product.price, config.min_product_price);

    const deliveryType = body.delivery_type || 'CAMPUS_MEETUP';
    if (!Object.hasOwn(config.shipping, deliveryType)) fail(400, 'Hình thức nhận hàng không hợp lệ.');
    const shipping = config.shipping[deliveryType];

    let discount = 0;
    let appliedVoucher = null;
    let voucherError = null;

    try {
      const evaluation = vouchers.evaluate(user, product, body.voucher_code);
      discount = evaluation.discount;
      if (evaluation.campaign) appliedVoucher = { code: evaluation.campaign.code, title: evaluation.campaign.title, discount_amount: discount };
    } catch (error) { voucherError = error.message; }

    const total = Math.max(0, price + shipping - discount);
    const commission = Math.round(price * config.commission_rate);
    const potentialFeeRetained = Math.min(commission, total);
    const balance = user ? wallet(user.id).available_balance : 0;
    const missing = Math.max(0, total - balance);
    const suggestedTopup = missing > 0 ? Math.ceil(missing / 10000) * 10000 : 0;

    return {
      product_id: product.id,
      product_title: product.title,
      price,
      shipping_fee: shipping,
      delivery_type: deliveryType,
      discount,
      total_paid: total,
      commission,
      potential_fee_retained: potentialFeeRetained,
      wallet_balance: balance,
      missing_amount: missing,
      suggested_topup: suggestedTopup,
      applied_voucher: appliedVoucher,
      voucher_error: voucherError,
      refund_policy: 'Chính sách hoàn tiền: Hoàn tiền sau khi trừ phí sàn trong trường hợp khiếu nại hợp lệ.'
    };
  }

  function checkout(user, body) {
    if (user.role === 'ADMIN') fail(403, 'Quản trị viên không được thực hiện mua hàng.');
    if (user.status === 'LOCKED') fail(403, 'Tài khoản của bạn đang bị khóa. Không thể đặt mua.');

    return atomic(() => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(body.product_id);
      if (!product) fail(404, 'Sản phẩm không tồn tại.');
      const seller = db.prepare('SELECT status FROM users WHERE id = ?').get(product.seller_id);
      if (seller?.status === 'LOCKED') fail(409, 'Người bán đang bị khóa.');
      if (product.seller_id === user.id) fail(400, 'Bạn không thể tự mua sản phẩm của mình.');
      if (product.status !== 'AVAILABLE') fail(409, 'Sản phẩm đã được giữ chỗ hoặc không còn bán.');
      if (product.approval_status !== 'APPROVED') fail(409, 'Sản phẩm đang chờ duyệt hoặc không khả dụng.');

      const price = money(product.price, config.min_product_price);
      if (!Object.hasOwn(config.shipping, body.delivery_type)) fail(400, 'Hình thức nhận hàng không hợp lệ.');
      const shipping = config.shipping[body.delivery_type];
      if (shipping > 0 && (!body.delivery_address || !String(body.delivery_address).trim())) {
        fail(400, 'Vui lòng nhập địa chỉ nhận hàng.');
      }
      if (body.delivery_type === 'CAMPUS_MEETUP' && (!body.delivery_address && !product.meetup_location)) {
        fail(400, 'Vui lòng xác nhận điểm hẹn nhận hàng.');
      }

      // Voucher evaluation
      let discount = 0;
      let voucherCampaign = null;
      const voucherCode = body.voucher_code ? String(body.voucher_code).trim().toUpperCase() : null;

      const evaluation = vouchers.evaluate(user, product, voucherCode);
      discount = evaluation.discount;
      voucherCampaign = evaluation.campaign;

      const total = price + shipping - discount;
      if (body.expected_total !== undefined && Number(body.expected_total) !== total) fail(409, 'Giá hoặc voucher đã thay đổi. Vui lòng kiểm tra lại báo giá.');
      const commission = Math.round(price * config.commission_rate);
      const sellerPayout = price - commission;
      const buyer = wallet(user.id);
      if (buyer.available_balance < total) fail(400, 'Số dư ví không đủ. Vui lòng nạp thêm tiền mô phỏng.');

      const orderCode = code('TK');
      entry(buyer, 'ESCROW_HOLD', 'HOLD', -total, orderCode, `Tạm giữ tiền mua ${product.title}`);
      if (!Number.isSafeInteger(buyer.escrow_balance + total)) fail(409, 'Số dư tạm giữ vượt giới hạn.');
      db.prepare('UPDATE wallets SET escrow_balance = escrow_balance + ? WHERE id = ?').run(total, buyer.id);

      // Reserve voucher budget
      if (voucherCampaign && discount > 0) {
        db.prepare('UPDATE voucher_campaigns SET budget_held = budget_held + ? WHERE id = ?').run(discount, voucherCampaign.id);
      }

      const orderResult = db.prepare(`INSERT INTO orders
        (order_code, product_id, buyer_id, seller_id, amount, shipping_fee, discount, total_paid,
        delivery_type, delivery_address, recipient_name, recipient_phone, tracking_code, payment_method,
        status, escrow_status, voucher_code, pricing_version, seller_payout, platform_fee, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WALLET_ESCROW', 'REQUESTED', 'HELD', ?, 'v2_net_seller', ?, ?, datetime('now'), datetime('now'))`)
        .run(orderCode, product.id, user.id, product.seller_id, price, shipping, discount, total,
          body.delivery_type, String(body.delivery_address || product.meetup_location || '').slice(0, 500),
          String(body.recipient_name || user.name).slice(0, 100), String(body.recipient_phone || '').slice(0, 30),
          null, voucherCampaign?.code || null, sellerPayout, commission);

      const orderId = orderResult.lastInsertRowid;
      journal(`hold:${orderId}`, orderId, [['USER_AVAILABLE', user.id, -total], ['ORDER_ESCROW', orderId, total]]);

      if (voucherCampaign && discount > 0) {
        db.prepare(`INSERT INTO voucher_usages (voucher_id, order_id, user_id, discount_amount, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'HELD', datetime('now'), datetime('now'))`).run(voucherCampaign.id, orderId, user.id, discount);
      }

      // Create shipment record if courier delivery
      if (shipping > 0) {
        const shipmentCode = code('TK-DLV');
        db.prepare(`INSERT INTO shipments 
          (order_id, tracking_code, pickup_address, delivery_address, fee_charged, fee_payable, status, payable_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'PENDING_PICKUP', 'PENDING', datetime('now'), datetime('now'))`)
          .run(orderId, shipmentCode, '', String(body.delivery_address || '').slice(0, 500), shipping, shipping);
      }

      db.prepare("UPDATE products SET status = 'RESERVED' WHERE id = ?").run(product.id);

      return {
        success: true,
        order_id: orderId,
        order_code: orderCode,
        total_paid: total,
        discount,
        shipping_fee: shipping,
        message: 'Đã đặt mua và tạm giữ tiền (mô phỏng).'
      };
    });
  }

  function transition(user, id, action, body = {}, demo = false) {
    if (user.status === 'LOCKED' && ['accept', 'ship', 'ready_pickup'].includes(action)) fail(403, 'Tài khoản của bạn đang bị khóa.');

    return atomic(() => {
      const order = orderById(id);
      db.prepare("INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, created_at) VALUES (?, ?, 'ORDER', ?, ?, datetime('now'))")
        .run(user.id, `ORDER_${action.toUpperCase()}`, String(id), String(body.reason || action).slice(0, 2000));

      if (action === 'simulate' && !demo) fail(403, 'Giả lập thời gian chỉ khả dụng trong chế độ demo.');

      if (action === 'resolve') {
        if (user.role !== 'ADMIN') fail(403, 'Chỉ admin được xử lý tranh chấp.');
        if (!String(body.reason || '').trim()) fail(400, 'Quyết định phải có lý do.');
        const dossier = db.prepare('SELECT * FROM disputes WHERE order_id = ?').get(id);
        if (!dossier?.admin_reviewed) fail(409, 'Cần thẩm định bằng chứng trước khi quyết định.');
        if (!['REFUND_BUYER', 'RELEASE_SELLER'].includes(body.decision)) fail(400, 'Phán quyết không hợp lệ.');
      } else if (action === 'simulate') {
        if (user.role !== 'ADMIN' && user.id !== order.buyer_id && user.id !== order.seller_id) fail(403, 'Bạn không tham gia đơn hàng này.');
      } else if (action === 'cancel_requested') {
        if (user.role === 'ADMIN') fail(403, 'Admin không thực hiện thay người tham gia.');
        return cancelRequested(user, id, user.id === order.seller_id, body.reason);
      } else {
        authorize(user, ['accept', 'ship', 'ready_pickup'].includes(action) ? order.seller_id : order.buyer_id);
      }

      if (action === 'accept') {
        assertHeld(order, ['REQUESTED']);
        db.prepare("UPDATE orders SET status = 'ACCEPTED', seller_confirmed = 1, updated_at = datetime('now') WHERE id = ?").run(id);
      } else if (action === 'ready_pickup') {
        assertHeld(order, ['ACCEPTED']);
        if (order.delivery_type === 'CAMPUS_MEETUP') fail(409, 'Đơn gặp trực tiếp không cần vận chuyển.');
        const pickupAddr = String(body.pickup_address || '').trim();
        if (!pickupAddr) fail(400, 'Vui lòng cung cấp địa chỉ lấy hàng cho đơn vị vận chuyển.');
        db.prepare("UPDATE orders SET pickup_address = ?, updated_at = datetime('now') WHERE id = ?").run(pickupAddr, id);
        db.prepare("UPDATE shipments SET pickup_address = ?, updated_at = datetime('now') WHERE order_id = ?").run(pickupAddr, id);
      } else if (action === 'ship') {
        assertHeld(order, ['ACCEPTED']);
        if (order.delivery_type !== 'CAMPUS_MEETUP') fail(409, 'Seller chỉ báo sẵn sàng; admin xác nhận đơn vị vận chuyển đã lấy hàng.');
        // If Campus Meetup: seller confirms handover directly
        const now = new Date();
        const deadline = new Date(now.getTime() + config.escrow_hours * 3600000).toISOString();
        db.prepare("UPDATE orders SET status = 'DELIVERING', shipped_at = ?, auto_confirm_deadline = ?, tracking_code = COALESCE(?, tracking_code), updated_at = ? WHERE id = ?")
          .run(now.toISOString(), deadline, body.tracking_code ? String(body.tracking_code).slice(0, 100) : null, now.toISOString(), id);
        if (order.delivery_type === 'CAMPUS_MEETUP') {
          // No courier payable for meetup
        } else {
          // If courier delivery, update shipment to PICKED_UP
          db.prepare("UPDATE shipments SET status = 'PICKED_UP', picked_up_at = ?, updated_at = ? WHERE order_id = ?")
            .run(now.toISOString(), now.toISOString(), id);
        }
      } else if (action === 'confirm' || action === 'simulate') {
        assertHeld(order, ['DELIVERING']);
        return settle(order, action === 'simulate' ? 'COMPLETED_AUTO' : 'COMPLETED', action === 'confirm');
      } else if (action === 'dispute') {
        assertHeld(order, ['ACCEPTED', 'DELIVERING']);
        const reason = String(body.reason || body.description || '').trim();
        if (!reason || reason.length > 2000) fail(400, 'Lý do khiếu nại cần từ 1 đến 2.000 ký tự.');
        const issueType = ['NOT_RECEIVED', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'DAMAGED', 'SELLER_NO_SHOW', 'OTHER'].includes(body.issue_type)
          ? body.issue_type : 'OTHER';

        // Evidence check: For wrong item or damaged, expect photo evidence
        const evidenceImages = Array.isArray(body.evidence_images) ? JSON.stringify(body.evidence_images) : (body.evidence_images ? String(body.evidence_images) : null);

        if (['WRONG_ITEM', 'NOT_AS_DESCRIBED', 'DAMAGED'].includes(issueType) && (!Array.isArray(body.evidence_images) || !body.evidence_images.length)) fail(400, 'Vui lòng cung cấp ảnh bằng chứng cho vấn đề hàng hóa.');
        db.prepare(`INSERT INTO disputes
          (order_id, opened_by, issue_type, description, evidence_images, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'OPEN', datetime('now'), datetime('now'))`)
          .run(id, user.id, issueType, reason, evidenceImages);

        db.prepare('UPDATE disputes SET original_deadline = ? WHERE order_id = ?').run(order.auto_confirm_deadline, id);
        db.prepare("UPDATE orders SET status = 'DISPUTED', dispute_reason = ?, auto_confirm_deadline = NULL, updated_at = datetime('now') WHERE id = ?").run(reason, id);
      } else if (action === 'resolve') {
        assertHeld(order, ['DISPUTED']);
        db.prepare("UPDATE disputes SET stage = 'RESOLVED' WHERE order_id = ?").run(order.id);
        db.prepare("INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, metadata, created_at) VALUES (?, 'RESOLVE_DISPUTE', 'ORDER', ?, ?, ?, datetime('now'))")
          .run(user.id, String(order.id), body.reason, JSON.stringify({ decision: body.decision }));
        if (body.decision === 'RELEASE_SELLER') {
          const res = settle(order, 'COMPLETED');
          db.prepare(`UPDATE disputes 
            SET status = 'RESOLVED', admin_reviewed = 1, admin_decision = 'RELEASE_SELLER',
                admin_reason = ?, resolved_by = ?, resolved_at = datetime('now'), updated_at = datetime('now')
            WHERE order_id = ?`).run(body.reason || 'Admin giải ngân cho người bán.', user.id, id);
          return res;
        }
        return refundAfterFee(order, body.reason, user.id);
      } else fail(400, 'Thao tác không hợp lệ.');

      return { success: true, message: 'Đã cập nhật đơn hàng (mô phỏng).' };
    });
  }

  function expire(now = new Date().toISOString(), onError = (id, error) => console.error(`Escrow order ${id} requires reconciliation: ${error.message}`)) {
    const candidates = db.prepare("SELECT id FROM orders WHERE status = 'DELIVERING' AND escrow_status = 'HELD' AND auto_confirm_deadline <= ?").all(now);
    let completed = 0;
    for (const { id } of candidates) {
      try {
        atomic(() => {
          const fresh = orderById(id);
          if (fresh.status === 'DELIVERING' && fresh.escrow_status === 'HELD' && fresh.auto_confirm_deadline <= now) {
            settle(fresh, 'COMPLETED_AUTO');
            completed++;
          }
        });
      } catch (error) { onError(id, error); }
    }
    return completed;
  }

  function cash(user, body, withdraw = false) {
    if (user.role === 'ADMIN') fail(403, 'Quản trị viên không dùng ví cá nhân.');
    if (user.status === 'LOCKED') fail(403, 'Tài khoản đang bị khóa.');

    return atomic(() => {
      const amount = money(body.amount, withdraw ? 20000 : 10000);
      if (withdraw && !String(body.bank_account || '').trim()) fail(400, 'Vui lòng nhập số tài khoản mô phỏng.');
      const result = entry(wallet(user.id), withdraw ? 'WITHDRAW' : 'TOPUP', withdraw ? 'OUT' : 'IN', withdraw ? -amount : amount,
        code(withdraw ? 'WDR' : 'VQR'), withdraw ? 'Rút tiền mô phỏng; không chuyển tiền ngân hàng.' : 'Nạp tiền mô phỏng; không có giao dịch ngân hàng.');
      journal(`cash:${result.voucher_code}`, null, [['USER_AVAILABLE', user.id, withdraw ? -amount : amount], ['MOCK_FUNDING', 'platform', withdraw ? amount : -amount]]);
      return { success: true, ...result, message: withdraw ? 'Đã rút tiền mô phỏng.' : 'Đã nạp tiền mô phỏng.' };
    });
  }

  function boost(user, productId, packageId, buyOnly = false) {
    if (user.role === 'ADMIN') fail(403, 'Quản trị viên không thực hiện đẩy bài.');
    if (user.status === 'LOCKED') fail(403, 'Tài khoản đang bị khóa.');

    return atomic(() => {
      const w = wallet(user.id);
      let product;
      if (!buyOnly) {
        product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        if (!product) fail(404, 'Không tìm thấy sản phẩm.');
        authorize(user, product.seller_id);
        if (product.approval_status !== 'APPROVED') fail(409, 'Chỉ đẩy tin đã được duyệt.');
        if (product.status !== 'AVAILABLE') fail(409, 'Chỉ có thể đẩy sản phẩm đang bán.');
      }
      const pkg = packageId ? config.packages.find(p => p.id === packageId) : null;
      if ((buyOnly || packageId) && !pkg) fail(400, 'Gói đẩy tin không hợp lệ.');
      let result = { remaining_balance: w.available_balance };
      let credits = w.boost_credits;
      if (pkg) {
        result = entry(w, 'BUY_BOOST', 'OUT', -pkg.price, pkg.id, `Mua gói ${pkg.price.toLocaleString('vi-VN')}đ / ${pkg.credits} lượt`);
        journal(`boost:${result.voucher_code}`, null, [['USER_AVAILABLE', user.id, -pkg.price], ['BOOST_REVENUE', 'platform', pkg.price]]);
        credits += pkg.credits;
        // Record boost revenue
        db.prepare(`INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, metadata, created_at)
          VALUES (?, 'BUY_BOOST', 'BUMP_PACKAGE', ?, 'Mua gói đẩy tin', ?, datetime('now'))`)
          .run(user.id, pkg.id, JSON.stringify({ price: pkg.price, credits: pkg.credits }));
      }
      if (!buyOnly) {
        if (credits > 0) {
          credits--;
          entry(wallet(user.id), 'USE_BOOST', 'OUT', 0, String(product.id), `Dùng 1 lượt đẩy: ${product.title}`);
        } else {
          result = entry(w, 'BUMP_PAYMENT', 'OUT', -config.packages[0].price, String(product.id), `Đẩy tin lẻ: ${product.title}`);
        }
        if (result.voucher_code && !pkg) journal(`boost:${result.voucher_code}`, null, [['USER_AVAILABLE', user.id, -config.packages[0].price], ['BOOST_REVENUE', 'platform', config.packages[0].price]]);
        db.prepare("UPDATE products SET is_promoted = 1, promoted_badge = ?, bump_count = bump_count + 1, promoted_until = ?, created_at = datetime('now') WHERE id = ?")
          .run(pkg?.id === 'bump_vip' ? 'HOT' : null, new Date(Date.now() + 7 * 86400000).toISOString(), product.id);
      }
      db.prepare("UPDATE wallets SET boost_credits = ?, updated_at = datetime('now') WHERE id = ?").run(credits, w.id);
      return { success: true, ...result, boost_credits: credits, message: buyOnly ? 'Đã mua gói đẩy tin.' : 'Đã đẩy tin; sử dụng một lượt.' };
    });
  }

  return {
    atomic,
    journal,
    checkout,
    quote,
    transition,
    expire,
    cash,
    boost,
    wallet,
    entry,
    settle: (...args) => atomic(() => settle(...args)),
    refundAfterFee: (...args) => atomic(() => refundAfterFee(...args)),
    cancelRequested: (...args) => atomic(() => cancelRequested(...args))
  };
}

module.exports = { createMarketplace, BusinessError, money, code };
