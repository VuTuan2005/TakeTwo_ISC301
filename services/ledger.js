const { randomUUID } = require('node:crypto');

// Signed movements: each journal must balance, including platform expenses.
module.exports = db => function journal(event, orderId, lines) {
  const entries = lines.filter(([, , amount]) => amount !== 0);
  if (entries.some(([, , amount]) => !Number.isSafeInteger(amount)) || entries.reduce((sum, [, , amount]) => sum + amount, 0) !== 0) {
    throw new Error('Unbalanced financial journal: ' + event);
  }
  const id = randomUUID();
  db.prepare('INSERT INTO journals (id, event_key, order_id, created_at) VALUES (?, ?, ?, datetime(\'now\'))').run(id, event, orderId || null);
  const insert = db.prepare('INSERT INTO journal_lines (journal_id, account, owner, amount) VALUES (?, ?, ?, ?)');
  entries.forEach(([account, owner, amount]) => insert.run(id, account, String(owner), amount));
  return id;
};
