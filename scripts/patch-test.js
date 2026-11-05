const fs = require('fs');
let t = fs.readFileSync('test/marketplace.test.js', 'utf8');

// Update helper checkout
t = t.replace(
  "function checkout(price = 45000, delivery = 'CAMPUS_MEETUP') {\n  return market.checkout(user(1), { product_id: product(price), delivery_type: delivery, delivery_address: 'KTX A' }).order_id;\n}",
  "function checkout(price = 45000, delivery = 'CAMPUS_MEETUP', voucher = 'SV5K') {\n  return market.checkout(user(1), { product_id: product(price), delivery_type: delivery, delivery_address: 'KTX A', voucher_code: voucher }).order_id;\n}"
);

// Update confirm release test
t = t.replace(
  "assert.equal(first.body.seller_payout, 58650);",
  "assert.equal(first.body.seller_payout, 43650);"
);
t = t.replace(
  "assert.equal(balance(2).available_balance, seller.available_balance + 58650);",
  "assert.equal(balance(2).available_balance, seller.available_balance + 43650);"
);
t = t.replace(
  "assert.equal(58650 + platform, 55000);",
  "assert.equal(first.body.seller_payout + 15000 + platform, 55000);"
);

// Update refund test
t = t.replace(
  "assert.equal(after.available_balance, before.available_balance + order(id).total_paid);",
  "assert.equal(after.available_balance, before.available_balance + (order(id).total_paid - order(id).retained_fee));"
);

fs.writeFileSync('test/marketplace.test.js', t, 'utf8');
console.log('test/marketplace.test.js updated');

