const { BusinessError } = require('./marketplace');
module.exports = ({ app, db, requireAdmin }) => {
  function period(query) {
    const end = query.to ? `${query.to}T23:59:59.999Z` : new Date().toISOString();
    const start = query.from ? `${query.from}T00:00:00.000Z` : new Date(Date.now() - 30 * 86400000).toISOString();
    if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || start > end) throw new BusinessError(400, 'Khoảng ngày không hợp lệ.');
    return { start, end };
  }
  app.get('/api/admin/dashboard-kpis', requireAdmin, (req, res) => {
    const { start, end } = period(req.query);
    const all = db.prepare('SELECT * FROM orders').all();
    const within = date => { const n = Date.parse(date?.includes('T') ? date : `${date?.replace(' ', 'T')}Z`); return n >= Date.parse(start) && n <= Date.parse(end); };
    const cohort = all.filter(o => within(o.created_at));
    const settled = all.filter(o => within(o.updated_at));
    const completed = settled.filter(o => ['COMPLETED','COMPLETED_AUTO'].includes(o.status));
    const refunds = settled.filter(o => o.escrow_status === 'REFUNDED');
    const cases = new Set(db.prepare('SELECT order_id FROM disputes').all().map(d => d.order_id));
    const sum = (list, field) => list.reduce((n, row) => n + Number(row[field] || 0), 0);
    const boosts = db.prepare("SELECT amount FROM wallet_transactions WHERE type IN ('BUY_BOOST','BUMP_PAYMENT') AND datetime(created_at) BETWEEN datetime(?) AND datetime(?)").all(start, end).reduce((n,r) => n + Math.abs(r.amount), 0);
    const fees = sum(completed, 'platform_fee'), retained = sum(refunds, 'retained_fee'), subsidy = sum(completed, 'discount'), shipping = sum(refunds, 'shipping_cost_incurred');
    res.json({ period: { start, end }, gmv: sum(completed,'amount'), completed_orders: completed.length, cancelled_orders: refunds.filter(o => !cases.has(o.id) && !o.dispute_reason).length, refunded_orders: refunds.filter(o => cases.has(o.id) || o.dispute_reason).length, disputed_orders: cohort.filter(o => cases.has(o.id) || o.dispute_reason).length, open_disputes: all.filter(o => o.status === 'DISPUTED').length, total_orders: cohort.length, fee_completed: fees, fee_retained_refund: retained, boost_revenue: boosts, voucher_subsidies: subsidy, shipping_absorbed: shipping, net_contribution: fees + retained + boosts - subsidy - shipping, total_escrow_holding: sum(all.filter(o => o.escrow_status === 'HELD'),'total_paid'), completion_rate: cohort.length ? Math.round(cohort.filter(o => ['COMPLETED','COMPLETED_AUTO'].includes(o.status)).length / cohort.length * 100) : 0, dispute_rate: cohort.length ? Math.round(cohort.filter(o => cases.has(o.id) || o.dispute_reason).length / cohort.length * 100) : 0, simulated: true });
  });
  app.get('/api/admin/orders-reconciliation', requireAdmin, (req, res) => {
    const { start, end } = period(req.query);
    const all = db.prepare(`SELECT o.*, p.title product_title, b.name buyer_name, b.email buyer_email, s.name seller_name, s.email seller_email, sh.tracking_code courier_code, sh.status courier_status, CASE WHEN sh.picked_up_at IS NOT NULL THEN sh.fee_payable ELSE 0 END courier_payable, sh.payable_status courier_payable_status FROM orders o JOIN products p ON p.id = o.product_id JOIN users b ON b.id = o.buyer_id JOIN users s ON s.id = o.seller_id LEFT JOIN shipments sh ON sh.order_id = o.id WHERE datetime(${req.query.date_basis === 'settled' ? 'o.updated_at' : 'o.created_at'}) BETWEEN datetime(?) AND datetime(?) ORDER BY o.id DESC`).all(start,end);
    const orders = all.map(o => ({ ...o, projected_seller_payout: o.seller_payout, seller_payout: o.escrow_status === 'RELEASED' ? o.seller_payout : 0, projected_fee: o.platform_fee, platform_fee: o.escrow_status === 'RELEASED' ? o.platform_fee : o.retained_fee, net_contribution: o.escrow_status === 'RELEASED' ? o.platform_fee - o.discount : o.escrow_status === 'REFUNDED' ? o.retained_fee - o.shipping_cost_incurred : 0 })).filter(o => {
      const q = req.query;
      if (q.status && q.status !== 'all' && o.status !== q.status) return false;
      if (q.escrow_status && q.escrow_status !== 'all' && o.escrow_status !== q.escrow_status) return false;
      if (q.delivery_type && q.delivery_type !== 'all' && o.delivery_type !== q.delivery_type) return false;
      if (q.buyer_id && o.buyer_id !== Number(q.buyer_id)) return false;
      if (q.seller_id && o.seller_id !== Number(q.seller_id)) return false;
      if (q.voucher_code && o.voucher_code !== q.voucher_code.toUpperCase()) return false;
      if (q.loss_only === 'true' && o.net_contribution >= 0) return false;
      return !q.search || [o.order_code,o.product_title,o.buyer_name,o.seller_name,o.buyer_email,o.seller_email].some(v => String(v).toLowerCase().includes(q.search.toLowerCase()));
    });
    const totals = {};
    for (const [name, field] of Object.entries({ total_amount:'amount', total_shipping:'shipping_fee', total_discount:'discount', total_paid:'total_paid', total_commission:'platform_fee', total_seller_payout:'seller_payout', total_refund:'refund_amount', total_retained_fee:'retained_fee', total_courier_payable:'courier_payable', total_net_contribution:'net_contribution' })) totals[name] = orders.reduce((sum,o) => sum + Number(o[field] || 0),0);
    res.json({ orders, totals, period: { start, end } });
  });
};
