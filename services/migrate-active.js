const { randomUUID } = require('node:crypto');
module.exports = db => {
  const campaigns = db.prepare('SELECT * FROM voucher_campaigns').all();
  for (const campaign of campaigns) {
    // Legacy local seed recorded a budget hold but omitted its redemption row.
    // Only connect it when the aggregate matches exactly; never alter a budget to hide a mismatch.
    const missing = db.prepare("SELECT * FROM orders o WHERE o.escrow_status = 'HELD' AND o.voucher_code = ? AND NOT EXISTS (SELECT 1 FROM voucher_usages v WHERE v.order_id = o.id)").all(campaign.code);
    const reserved = db.prepare("SELECT COALESCE(SUM(discount_amount),0) n FROM voucher_usages WHERE voucher_id = ? AND status='HELD'").get(campaign.id).n;
    if (missing.length && reserved + missing.reduce((sum,o)=>sum+o.discount,0) === campaign.budget_held) {
      for (const o of missing) db.prepare("INSERT INTO voucher_usages(voucher_id,order_id,user_id,discount_amount,status,created_at,updated_at) VALUES(?,?,?,?,'HELD',datetime('now'),datetime('now'))").run(campaign.id,o.id,o.buyer_id,o.discount);
    }
  }
  // Preserve historical settlements. Only hydrate missing logistics for money still held.
  const orders = db.prepare("SELECT * FROM orders WHERE escrow_status = 'HELD' AND shipping_fee > 0").all();
  for (const order of orders) {
    let sh = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(order.id);
    if (!sh) {
      const picked = order.shipped_at || null;
      db.prepare(`INSERT INTO shipments (order_id, tracking_code, pickup_address, delivery_address, fee_charged, fee_payable, status, picked_up_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`)
        .run(order.id, `TK-DLV-${randomUUID()}`, order.pickup_address || '', order.delivery_address || '', order.shipping_fee, order.shipping_fee, picked ? 'PICKED_UP' : 'PENDING_PICKUP', picked);
      sh = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(order.id);
    }
    if (sh.picked_up_at && !db.prepare('SELECT 1 FROM journals WHERE event_key = ?').get(`pickup:${order.id}`)) {
      require('./ledger')(db)(`pickup:${order.id}`, order.id, [['CARRIER_PAYABLE',order.id, sh.fee_payable],['SHIPPING_CLEARING',order.id,-sh.fee_payable]]);
    }
  }
};
