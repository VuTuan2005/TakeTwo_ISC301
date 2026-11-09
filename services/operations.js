const { BusinessError, money, code } = require('./marketplace');

module.exports = ({ app, post, db, market, requireAuth, requireAdmin, config }) => {
  const fail = (status, message) => { throw new BusinessError(status, message); };
  const audit = (uid, action, type, id, reason, metadata = {}) => db.prepare(`INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(uid, action, type, String(id), reason, JSON.stringify(metadata));
  const attachments = (uid, ids) => {
    if (!Array.isArray(ids) || ids.length > 5) fail(400, 'Mỗi nội dung được đính kèm tối đa 5 ảnh.');
    return [...new Set(ids)].map(value => {
      const id = String(value).replace('/api/attachments/', '');
      const image = db.prepare('SELECT * FROM attachments WHERE id = ? AND uploaded_by = ?').get(id, uid);
      if (!image) fail(403, 'Ảnh bằng chứng không thuộc người gửi.');
      return id;
    });
  };
  const dossier = (uid, role, id) => {
    const d = db.prepare('SELECT d.*, o.buyer_id, o.seller_id FROM disputes d JOIN orders o ON o.id = d.order_id WHERE d.id = ?').get(id);
    if (!d) fail(404, 'Không tìm thấy hồ sơ.');
    if (role !== 'ADMIN' && uid !== d.buyer_id && uid !== d.seller_id) fail(403, 'Bạn không tham gia hồ sơ này.');
    return d;
  };

  post('/api/admin/escrow/:id/release', requireAdmin, (req, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) fail(404, 'Không tìm thấy đơn.');
    if (order.status !== 'DELIVERING' || order.escrow_status !== 'HELD') fail(409, 'Chỉ giải ngân đơn đang giao, giữ tiền và không tranh chấp. Tranh chấp cần xử lý trong hồ sơ.');
    const reason = String(req.body.reason || '').trim();
    if (!reason) fail(400, 'Bắt buộc nhập lý do và căn cứ giải ngân.');
    const result = market.settle(order, 'COMPLETED', false);
    db.prepare("UPDATE orders SET admin_resolver_id=?, admin_resolution_reason=?, admin_resolved_at=datetime('now') WHERE id=?").run(req.currentUser.id,reason,order.id);
    audit(req.currentUser.id,'ADMIN_ESCROW_RELEASE','ORDER',order.id,reason);
    res.json(result);
  });

  market.shipmentStatus = (user, id, status, reason) => market.atomic(() => {
    if (user.role !== 'ADMIN') fail(403, 'Chỉ admin điều phối vận chuyển.');
    const sh = db.prepare('SELECT * FROM shipments WHERE id = ?').get(id);
    if (!sh) fail(404, 'Không tìm thấy vận đơn.');
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(sh.order_id);
    const allowed = { PENDING_PICKUP: ['PICKED_UP', 'CANCELLED'], PICKED_UP: ['DELIVERING', 'DELIVERED'], DELIVERING: ['DELIVERED'] };
    if (!allowed[sh.status]?.includes(status)) fail(409, 'Không được bỏ bước hoặc cập nhật lại vận chuyển đã kết thúc.');
    if (o.escrow_status !== 'HELD' || !['ACCEPTED', 'DELIVERING', 'DISPUTED'].includes(o.status)) fail(409, 'Đơn không còn cho phép thay đổi vận chuyển.');
    if (status === 'PICKED_UP' && (!o.pickup_address || o.status !== 'ACCEPTED')) fail(409, 'Cần seller chấp nhận và báo địa chỉ sẵn sàng lấy hàng.');
    const now = new Date().toISOString();
    if (status === 'PICKED_UP') {
      market.journal(`pickup:${o.id}`, o.id, [['CARRIER_PAYABLE', o.id, sh.fee_payable], ['SHIPPING_CLEARING', o.id, -sh.fee_payable]]);
      db.prepare('UPDATE shipments SET picked_up_at = ? WHERE id = ?').run(now, sh.id);
      db.prepare("UPDATE orders SET status = 'DELIVERING', shipped_at = ?, auto_confirm_deadline = ?, tracking_code = ?, shipping_cost_incurred = ?, updated_at = ? WHERE id = ?")
        .run(now, new Date(Date.now() + config.escrow_hours * 3600000).toISOString(), sh.tracking_code, sh.fee_payable, now, o.id);
    }
    if (status === 'DELIVERING') {
      db.prepare("UPDATE orders SET updated_at = ? WHERE id = ?").run(now, o.id);
    }
    if (status === 'DELIVERED') {
      db.prepare('UPDATE shipments SET delivered_at = ? WHERE id = ?').run(now, sh.id);
      const deadline = new Date(Date.now() + config.escrow_hours * 3600000).toISOString();
      db.prepare("UPDATE orders SET auto_confirm_deadline = ?, updated_at = ? WHERE id = ?").run(deadline, now, o.id);
    }
    db.prepare('UPDATE shipments SET status = ?, updated_at = ? WHERE id = ?').run(status, now, sh.id);
    audit(user.id, 'SHIPMENT_STATUS', 'SHIPMENT', sh.id, reason || `Chuyển sang ${status}`, { from: sh.status, to: status });
    return { success: true, message: 'Đã cập nhật vận chuyển mô phỏng.' };
  });
  post('/api/admin/shipments/:id/status', requireAdmin, (req, res) => {
    res.json(market.shipmentStatus(req.currentUser, req.params.id, req.body.status, req.body.reason));
  });
  post('/api/admin/shipments/:id/pay', requireAdmin, (req, res) => {
    const sh = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id);
    if (!sh) fail(404, 'Không tìm thấy vận đơn.');
    if (sh.payable_status === 'PAID') fail(409, 'Khoản cước đã thanh toán.');
    if (!sh.picked_up_at) fail(409, 'Chưa lấy hàng nên chưa phát sinh khoản phải trả.');
    const reference = String(req.body.reference || '').trim();
    if (!reference) fail(400, 'Phải nhập mã đối soát thanh toán.');
    market.journal(`carrier-pay:${sh.id}`, sh.order_id, [['CARRIER_PAYABLE', sh.order_id, -sh.fee_payable], ['MOCK_FUNDING', 'platform', sh.fee_payable]]);
    db.prepare("UPDATE shipments SET payable_status = 'PAID', payable_paid_at = datetime('now'), payable_reference = ? WHERE id = ?").run(reference.slice(0, 100), sh.id);
    audit(req.currentUser.id, 'PAY_CARRIER', 'SHIPMENT', sh.id, reference);
    res.json({ success: true, message: 'Đã ghi nhận thanh toán cước mô phỏng một lần.' });
  });

  app.get('/api/disputes/:id', requireAuth, (req, res) => {
    const d = dossier(req.currentUser.id, req.currentUser.role, req.params.id);
    const posts = db.prepare('SELECT p.*, u.name AS author_name, u.role FROM dispute_posts p JOIN users u ON u.id = p.author_id WHERE dispute_id = ? ORDER BY p.id').all(d.id);
    res.json({ dispute: d, posts, seller_deadline: new Date(Date.parse(d.created_at.replace(' ', 'T') + 'Z') + 48 * 3600000).toISOString(), admin_deadline: new Date(Date.parse(d.created_at.replace(' ', 'T') + 'Z') + 72 * 3600000).toISOString() });
  });
  post('/api/disputes/:id/posts', requireAuth, (req, res) => {
    const d = dossier(req.currentUser.id, req.currentUser.role, req.params.id);
    if (d.status === 'RESOLVED') fail(409, 'Hồ sơ đã kết thúc.');
    const content = String(req.body.content || '').trim();
    if (!content || content.length > 4000) fail(400, 'Giải trình cần từ 1 đến 4.000 ký tự.');
    const ids = attachments(req.currentUser.id, req.body.attachment_ids || []);
    db.prepare('INSERT INTO dispute_posts (dispute_id, author_id, content, attachment_ids) VALUES (?, ?, ?, ?)').run(d.id, req.currentUser.id, content, JSON.stringify(ids));
    db.prepare('UPDATE disputes SET admin_reviewed = 0, updated_at = datetime(\'now\') WHERE id = ?').run(d.id);
    db.prepare('UPDATE disputes SET stage = ? WHERE id = ?').run(req.currentUser.role === 'ADMIN' ? 'NEED_INFO' : 'WAITING_REVIEW', d.id);
    if (req.currentUser.id === d.seller_id) db.prepare('UPDATE disputes SET seller_response = ?, seller_evidence = ?, seller_responded_at = datetime(\'now\') WHERE id = ?').run(content, JSON.stringify(ids.map(id => `/api/attachments/${id}`)), d.id);
    audit(req.currentUser.id, 'CASE_POST', 'DISPUTE', d.id, content);
    res.json({ success: true, message: 'Đã lưu giải trình; quản trị viên cần thẩm định nội dung mới.' });
  });

  function voucherInput(body, previous) {
    const value = { ...previous, ...body };
    const cleanCode = String(value.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(cleanCode) || !String(value.title || '').trim()) fail(400, 'Mã cần 3–32 ký tự chữ, số, dấu _ hoặc - và có tên chiến dịch.');
    if (!['FIXED', 'PERCENTAGE'].includes(value.discount_type)) fail(400, 'Loại giảm giá không hợp lệ.');
    const discount = money(value.discount_value);
    if (value.discount_type === 'PERCENTAGE' && discount > 100) fail(400, 'Phần trăm giảm phải từ 1 đến 100.');
    const budget = money(value.budget);
    if (budget < Number(previous?.budget_used || 0) + Number(previous?.budget_held || 0)) fail(409, 'Ngân sách mới thấp hơn số đã dùng và đang giữ.');
    const start = value.start_date || null, end = value.end_date || null;
    if ((start && !Number.isFinite(Date.parse(start))) || (end && !Number.isFinite(Date.parse(end))) || (start && end && Date.parse(start) >= Date.parse(end))) fail(400, 'Khoảng thời gian không hợp lệ.');
    const audience = value.target_audience || 'ALL';
    if (!['ALL', 'NEW_BUYER', 'CAMPUS_HOALAC', 'SPECIFIC_USERS'].includes(audience)) fail(400, 'Đối tượng voucher không hợp lệ.');
    let targets = value.target_user_ids || [];
    if (typeof targets === 'string') { try { targets = JSON.parse(targets); } catch (_) { fail(400, 'Danh sách tài khoản phải là mảng ID.'); } }
    if (!Array.isArray(targets) || targets.some(id => !Number.isSafeInteger(Number(id)))) fail(400, 'Danh sách tài khoản không hợp lệ.');
    if (audience === 'SPECIFIC_USERS' && !targets.length) fail(400, 'Chưa chọn đối tượng được dùng.');
    const limit = money(value.usage_limit || 100), perUser = money(value.usage_per_user || 1);
    const reserved = previous ? db.prepare("SELECT COUNT(*) n FROM voucher_usages WHERE voucher_id = ? AND status != 'RELEASED'").get(previous.id).n : 0;
    if (limit < reserved) fail(409, 'Số lượt mới thấp hơn lượt đã dùng và đang giữ.');
    return [cleanCode, String(value.title).trim().slice(0, 200), String(value.description || '').slice(0, 2000), value.discount_type, discount, value.max_discount ? money(value.max_discount) : null, money(value.min_spend || 0, 0), start, end, audience, JSON.stringify(targets.map(Number)), budget, limit, perUser];
  }
  post('/api/admin/vouchers', requireAdmin, (req, res) => {
    const values = voucherInput(req.body);
    if (db.prepare('SELECT 1 FROM voucher_campaigns WHERE code = ?').get(values[0])) fail(409, 'Mã đã tồn tại.');
    const row = db.prepare(`INSERT INTO voucher_campaigns (code, title, description, discount_type, discount_value, max_discount, min_spend, start_date, end_date, target_audience, target_user_ids, budget, usage_limit, usage_per_user, created_at) VALUES (${Array(14).fill('?').join(',')}, datetime('now'))`).run(...values);
    audit(req.currentUser.id, 'CREATE_VOUCHER', 'VOUCHER', row.lastInsertRowid, values[1]);
    res.json({ success: true, id: row.lastInsertRowid, message: 'Đã tạo chiến dịch.' });
  });
  post('/api/admin/vouchers/:id/update', requireAdmin, (req, res) => {
    const old = db.prepare('SELECT * FROM voucher_campaigns WHERE id = ?').get(req.params.id);
    if (!old) fail(404, 'Không tìm thấy chiến dịch.');
    if (req.body.code && req.body.code.toUpperCase() !== old.code) fail(400, 'Không đổi mã đã phát hành.');
    const values = voucherInput(req.body, old);
    db.prepare(`UPDATE voucher_campaigns SET code=?, title=?, description=?, discount_type=?, discount_value=?, max_discount=?, min_spend=?, start_date=?, end_date=?, target_audience=?, target_user_ids=?, budget=?, usage_limit=?, usage_per_user=? WHERE id=?`).run(...values, old.id);
    audit(req.currentUser.id, 'UPDATE_VOUCHER', 'VOUCHER', old.id, 'Cập nhật chiến dịch');
    res.json({ success: true, message: 'Đã cập nhật chiến dịch; đơn cũ giữ nguyên mức giảm.' });
  });
  app.get('/api/admin/vouchers/:id/report', requireAdmin, (req, res) => {
    const campaign = db.prepare('SELECT * FROM voucher_campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) fail(404, 'Không tìm thấy chiến dịch.');
    const report = db.prepare(`SELECT COUNT(*) orders, SUM(CASE WHEN o.status IN ('COMPLETED','COMPLETED_AUTO') THEN o.amount ELSE 0 END) gmv, SUM(CASE WHEN o.status IN ('COMPLETED','COMPLETED_AUTO') THEN o.discount ELSE 0 END) subsidy, SUM(CASE WHEN o.status IN ('COMPLETED','COMPLETED_AUTO') THEN o.platform_fee - o.discount WHEN o.escrow_status = 'REFUNDED' THEN o.retained_fee - o.shipping_cost_incurred ELSE 0 END) net_contribution FROM voucher_usages v JOIN orders o ON o.id = v.order_id WHERE v.voucher_id = ?`).get(campaign.id);
    res.json({ campaign, ...report, remaining_budget: campaign.budget - campaign.budget_used - campaign.budget_held });
  });
  app.get('/api/admin/users/:id/history', requireAdmin, (req, res) => {
    res.json({ orders: db.prepare('SELECT * FROM orders WHERE buyer_id = ? OR seller_id = ? ORDER BY id DESC').all(req.params.id, req.params.id), violations: db.prepare("SELECT * FROM audit_logs WHERE target_type = 'USER' AND target_id = ? ORDER BY id DESC").all(req.params.id) });
  });
  post('/api/admin/users/:id/verification', requireAdmin, (req, res) => {
    const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!target || target.role === 'ADMIN') fail(404,'Không tìm thấy tài khoản sinh viên.');
    if (!['LOCAL_VERIFIED','UNVERIFIED','REJECTED'].includes(req.body.status)) fail(400,'Trạng thái xác minh không hợp lệ.');
    const reason = String(req.body.reason || '').trim();
    if (!reason) fail(400,'Cần nhập căn cứ kiểm tra email sinh viên.');
    db.prepare('UPDATE users SET verification_status=? WHERE id=?').run(req.body.status,target.id);
    audit(req.currentUser.id,'VERIFY_STUDENT_LOCAL','USER',target.id,reason,{status:req.body.status});
    res.json({success:true,message:'Đã lưu kết quả kiểm tra local; chưa xác minh với trường đại học.'});
  });
  app.get('/api/admin/audit', requireAdmin, (req, res) => res.json(db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500').all()));
  return { attachments, audit };
};
