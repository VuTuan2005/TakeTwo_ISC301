// Read-only reconciliation. Never changes a balance to hide historical inconsistencies.
const { db } = require('../db');
const report = db.prepare(`SELECT w.user_id, u.name, w.available_balance, w.escrow_balance,
  COALESCE((SELECT SUM(o.total_paid) FROM orders o WHERE o.buyer_id = w.user_id AND o.escrow_status = 'HELD'), 0) AS expected_escrow
  FROM wallets w JOIN users u ON u.id = w.user_id`).all();
const issues = report.filter(w => w.available_balance < 0 || w.escrow_balance < 0 || w.escrow_balance !== w.expected_escrow);
console.table(report);
if (issues.length) { console.error(`${issues.length} ví cần đối soát. Không tự sửa hoặc ghi đè dữ liệu. Sao lưu và kiểm tra; chỉ reset nếu đây là dữ liệu demo bỏ được.`); process.exitCode = 1; }
else console.log('OK: ví không âm; Escrow từng người khớp các đơn HELD.');
const exists = table => db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
if (exists('journals')) {
  const journals = db.prepare('SELECT j.event_key, SUM(l.amount) AS difference FROM journals j JOIN journal_lines l ON l.journal_id=j.id GROUP BY j.id HAVING SUM(l.amount) != 0').all();
  if (journals.length) { console.table(journals); process.exitCode = 1; }
  else console.log('OK: sổ bút toán cân bằng.');
}
if (exists('voucher_campaigns')) {
  const vouchers = db.prepare(`SELECT v.code, v.budget, v.budget_used, v.budget_held,
    (SELECT COALESCE(SUM(discount_amount),0) FROM voucher_usages r WHERE r.voucher_id=v.id AND r.status='HELD') AS expected_held
    FROM voucher_campaigns v`).all();
  const invalid = vouchers.filter(v => v.budget_held !== v.expected_held || v.budget_used + v.budget_held > v.budget || v.budget_held < 0 || v.budget_used < 0);
  if (invalid.length) { console.table(invalid); process.exitCode = 1; }
  else console.log('OK: dự trữ voucher khớp ngân sách.');
}
db.close();
