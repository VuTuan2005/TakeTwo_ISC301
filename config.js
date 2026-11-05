// Shared business constants. Exposed read-only through /api/config.
module.exports = Object.freeze({
  commission_rate: 0.03,
  min_product_price: 5000,
  max_amount: 100000000,
  escrow_hours: 120,
  shipping: Object.freeze({ CAMPUS_MEETUP: 0, COURIER_ROOM: 15000, COURIER: 15000, COURIER_EXPRESS: 25000 }),
  packages: Object.freeze([
    { id: 'bump_single', price: 15000, credits: 1 },
    { id: 'bump_saver', price: 49000, credits: 5 },
    { id: 'bump_vip', price: 79000, credits: 10 }
  ])
});
