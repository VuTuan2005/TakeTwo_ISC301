const { BusinessError } = require('./marketplace');
const reject = message => { throw new BusinessError(400, message); };

module.exports = db => {
  function evaluate(user, product, input) {
    const code = String(input || '').trim().toUpperCase();
    if (!code) return { discount: 0, campaign: null };
    const campaign = db.prepare('SELECT * FROM voucher_campaigns WHERE UPPER(code) = ?').get(code);
    if (!campaign || !campaign.is_active) reject('Mã voucher không tồn tại hoặc đã ngừng áp dụng.');
    const now = Date.now();
    if ((campaign.start_date && Date.parse(campaign.start_date) > now) || (campaign.end_date && Date.parse(campaign.end_date) <= now)) reject('Voucher chưa đến thời gian sử dụng hoặc đã hết hạn.');
    if (product.price < campaign.min_spend) reject('Đơn chưa đạt giá trị tối thiểu của voucher.');
    const reserved = db.prepare("SELECT COUNT(*) n FROM voucher_usages WHERE voucher_id = ? AND status = 'HELD'").get(campaign.id).n;
    if (campaign.usage_count + reserved >= campaign.usage_limit) reject('Voucher đã hết lượt sử dụng.');
    const used = db.prepare("SELECT COUNT(*) n FROM voucher_usages WHERE voucher_id = ? AND user_id = ? AND status != 'RELEASED'").get(campaign.id, user.id).n;
    if (used >= campaign.usage_per_user) reject('Bạn đã dùng hết số lượt được phép của voucher này.');
    if (campaign.target_audience === 'NEW_BUYER' && db.prepare("SELECT 1 FROM orders WHERE buyer_id = ? AND status IN ('COMPLETED', 'COMPLETED_AUTO')").get(user.id)) reject('Voucher chỉ dành cho khách hàng chưa có đơn hoàn tất.');
    if (campaign.target_audience === 'CAMPUS_HOALAC' && !String(user.campus || '').includes('Hòa Lạc')) reject('Voucher chỉ dành cho sinh viên cụm Hòa Lạc.');
    if (campaign.target_audience === 'SPECIFIC_USERS') {
      let targets = [];
      try { targets = JSON.parse(campaign.target_user_ids || '[]'); } catch (_) {}
      if (!targets.map(Number).includes(user.id)) reject('Tài khoản không thuộc đối tượng của voucher.');
    }
    const discount = Math.min(product.price, campaign.discount_type === 'FIXED' ? campaign.discount_value : Math.min(Math.round(product.price * campaign.discount_value / 100), campaign.max_discount || product.price));
    if (discount <= 0 || campaign.budget - campaign.budget_used - campaign.budget_held < discount) reject('Ngân sách voucher không còn đủ cho mức giảm này.');
    return { campaign, discount };
  }
  function finish(order, consumed) {
    const usage = db.prepare("SELECT * FROM voucher_usages WHERE order_id = ? AND status = 'HELD'").get(order.id);
    if (!usage) {
      if (order.voucher_code && db.prepare('SELECT 1 FROM voucher_campaigns WHERE code = ?').get(order.voucher_code)) throw new BusinessError(409, 'Thiếu bản ghi giữ voucher; cần đối soát trước khi xử lý.');
      return; // Historical fixed subsidies had no campaign.
    }
    const result = db.prepare(`UPDATE voucher_campaigns SET budget_held = budget_held - ?, budget_used = budget_used + ?, usage_count = usage_count + ? WHERE id = ? AND budget_held >= ?`)
      .run(usage.discount_amount, consumed ? usage.discount_amount : 0, consumed ? 1 : 0, usage.voucher_id, usage.discount_amount);
    if (!result.changes) throw new BusinessError(409, 'Ngân sách voucher không khớp; cần đối soát trước khi xử lý.');
    db.prepare("UPDATE voucher_usages SET status = ?, updated_at = datetime('now') WHERE id = ?").run(consumed ? 'COMMITTED' : 'RELEASED', usage.id);
  }
  return { evaluate, finish };
};
