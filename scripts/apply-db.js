const fs = require('fs');
const path = require('path');

// We will read db.js, keep the productData and structure intact, but enhance tables and migrations.
const currentDb = fs.readFileSync(path.join(__dirname, '../db.js'), 'utf8');

// Let's create the updated db.js content
const updatedDb = `const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const os = require('node:os');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const config = require('./config');

// In serverless environments (Vercel / Lambda), filesystem is read-only except /tmp
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dbDir = isServerless ? os.tmpdir() : __dirname;
const dbPath = process.env.TAKETWO_DB_PATH || path.join(dbDir, 'taketwo.db');
if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

function backupDatabase() {
  if (dbPath === ':memory:' || !fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) return null;
  const folder = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(folder, { recursive: true });
  const destination = path.join(folder, \`taketwo-\${new Date().toISOString().replace(/[:.]/g, '-')}-\${require('node:crypto').randomUUID()}.db\`);
  db.exec(\`VACUUM INTO '\${destination.replace(/'/g, "''")}'\`);
  return destination;
}

function ensureApplicationTables() {
  db.exec(\`
    CREATE TABLE IF NOT EXISTS platform_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(order_id, type)
    );
    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY(user_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS orders_auto_confirm ON orders(status, escrow_status, auto_confirm_deadline);
    CREATE INDEX IF NOT EXISTS ledger_wallet ON wallet_transactions(wallet_id, id);
    CREATE INDEX IF NOT EXISTS idx_chat_conv ON chat_conversations(product_id, buyer_id, seller_id);
    CREATE INDEX IF NOT EXISTS idx_chat_msg ON chat_messages(conversation_id, id);
    CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
    CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
    CREATE INDEX IF NOT EXISTS idx_voucher_code ON voucher_campaigns(code);
  \`);
  const statement = db.prepare('UPDATE bump_packages SET price = ?, bump_credits = ? WHERE id = ?');
  for (const pkg of config.packages) statement.run(pkg.price, pkg.credits, pkg.id);
}

function createTablesIfNotExists() {
  db.exec(\`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'BUYER',
      campus TEXT NOT NULL,
      student_code TEXT,
      rating_avg REAL DEFAULT 5.0,
      review_count INTEGER DEFAULT 0,
      eco_points INTEGER DEFAULT 0,
      co2_saved_kg REAL DEFAULT 0.0,
      avatar_url TEXT,
      bonus_claimed INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      lock_reason TEXT,
      warning_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      original_price INTEGER,
      condition_level TEXT NOT NULL,
      defect_note TEXT,
      campus_cluster TEXT NOT NULL,
      meetup_location TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      approval_status TEXT NOT NULL DEFAULT 'APPROVED',
      approved_by INTEGER,
      rejection_reason TEXT,
      is_promoted INTEGER DEFAULT 0,
      promoted_badge TEXT,
      promoted_until TEXT,
      bump_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 12,
      created_at TEXT NOT NULL,
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      available_balance INTEGER NOT NULL DEFAULT 0,
      escrow_balance INTEGER NOT NULL DEFAULT 0,
      boost_credits INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      flow_type TEXT NOT NULL DEFAULT 'IN',
      voucher_code TEXT,
      payment_method TEXT DEFAULT 'Ví TakeTwo',
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reference_id TEXT,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id)
    );

    CREATE TABLE IF NOT EXISTS bump_packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bump_credits INTEGER NOT NULL,
      price INTEGER NOT NULL,
      tag TEXT,
      description TEXT NOT NULL,
      has_badge_hot INTEGER DEFAULT 0,
      validity_days INTEGER DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT UNIQUE NOT NULL,
      product_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      shipping_fee INTEGER NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      total_paid INTEGER NOT NULL,
      delivery_type TEXT NOT NULL,
      delivery_address TEXT,
      recipient_name TEXT,
      recipient_phone TEXT,
      tracking_code TEXT,
      payment_method TEXT NOT NULL DEFAULT 'WALLET_ESCROW',
      status TEXT NOT NULL DEFAULT 'REQUESTED',
      escrow_status TEXT NOT NULL DEFAULT 'HELD',
      buyer_confirmed INTEGER DEFAULT 0,
      seller_confirmed INTEGER DEFAULT 0,
      shipped_at TEXT,
      auto_confirm_deadline TEXT,
      dispute_reason TEXT,
      voucher_code TEXT,
      pricing_version TEXT DEFAULT 'v2_net_seller',
      seller_payout INTEGER DEFAULT 0,
      platform_fee INTEGER DEFAULT 0,
      refund_amount INTEGER DEFAULT 0,
      retained_fee INTEGER DEFAULT 0,
      shipping_cost_incurred INTEGER DEFAULT 0,
      pickup_address TEXT,
      admin_resolved_at TEXT,
      admin_resolver_id INTEGER,
      admin_resolution_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS voucher_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('FIXED', 'PERCENTAGE')),
      discount_value INTEGER NOT NULL,
      max_discount INTEGER,
      min_spend INTEGER NOT NULL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      target_audience TEXT DEFAULT 'ALL' CHECK(target_audience IN ('ALL', 'NEW_BUYER', 'CAMPUS_HOALAC', 'SPECIFIC_USERS')),
      target_user_ids TEXT,
      budget INTEGER NOT NULL,
      budget_used INTEGER NOT NULL DEFAULT 0,
      budget_held INTEGER NOT NULL DEFAULT 0,
      usage_limit INTEGER NOT NULL DEFAULT 100,
      usage_per_user INTEGER NOT NULL DEFAULT 1,
      usage_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voucher_usages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_id INTEGER NOT NULL REFERENCES voucher_campaigns(id),
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      discount_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'HELD' CHECK(status IN ('HELD', 'COMMITTED', 'RELEASED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      tracking_code TEXT UNIQUE NOT NULL,
      pickup_address TEXT,
      delivery_address TEXT,
      fee_charged INTEGER NOT NULL DEFAULT 0,
      fee_payable INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING_PICKUP' CHECK(status IN ('PENDING_PICKUP', 'PICKED_UP', 'DELIVERING', 'DELIVERED', 'CANCELLED')),
      payable_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(payable_status IN ('PENDING', 'PAID')),
      payable_paid_at TEXT,
      payable_reference TEXT,
      picked_up_at TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      opened_by INTEGER NOT NULL REFERENCES users(id),
      issue_type TEXT NOT NULL CHECK(issue_type IN ('NOT_RECEIVED', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'DAMAGED', 'SELLER_NO_SHOW', 'OTHER')),
      description TEXT NOT NULL,
      evidence_images TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED')),
      seller_response TEXT,
      seller_evidence TEXT,
      seller_responded_at TEXT,
      admin_reviewed INTEGER DEFAULT 0,
      admin_decision TEXT CHECK(admin_decision IN ('RELEASE_SELLER', 'REFUND_BUYER', NULL)),
      admin_reason TEXT,
      resolved_by INTEGER REFERENCES users(id),
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      seller_id INTEGER NOT NULL REFERENCES users(id),
      last_message_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(product_id, buyer_id, seller_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      attachment_id TEXT,
      attachment_url TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listing_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      reported_by INTEGER NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'REVIEWED', 'DISMISSED')),
      resolution_action TEXT,
      resolved_at TEXT,
      resolved_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      reason TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );
  \`);
}

function ensureSchemaMigrations() {
  createTablesIfNotExists();

  const hasColumn = (table, col) => {
    try {
      const info = db.prepare(\`PRAGMA table_info(\${table})\`).all();
      return info.some(c => c.name === col);
    } catch (e) {
      return false;
    }
  };

  // 1. Wallets table boost_credits
  if (!hasColumn('wallets', 'boost_credits')) {
    db.exec('ALTER TABLE wallets ADD COLUMN boost_credits INTEGER NOT NULL DEFAULT 0;');
  }

  // 2. Orders table columns
  if (!hasColumn('orders', 'recipient_name')) db.exec('ALTER TABLE orders ADD COLUMN recipient_name TEXT;');
  if (!hasColumn('orders', 'recipient_phone')) db.exec('ALTER TABLE orders ADD COLUMN recipient_phone TEXT;');
  if (!hasColumn('orders', 'voucher_code')) db.exec('ALTER TABLE orders ADD COLUMN voucher_code TEXT;');
  if (!hasColumn('orders', 'pricing_version')) db.exec("ALTER TABLE orders ADD COLUMN pricing_version TEXT DEFAULT 'v2_net_seller';");
  if (!hasColumn('orders', 'seller_payout')) db.exec('ALTER TABLE orders ADD COLUMN seller_payout INTEGER DEFAULT 0;');
  if (!hasColumn('orders', 'platform_fee')) db.exec('ALTER TABLE orders ADD COLUMN platform_fee INTEGER DEFAULT 0;');
  if (!hasColumn('orders', 'refund_amount')) db.exec('ALTER TABLE orders ADD COLUMN refund_amount INTEGER DEFAULT 0;');
  if (!hasColumn('orders', 'retained_fee')) db.exec('ALTER TABLE orders ADD COLUMN retained_fee INTEGER DEFAULT 0;');
  if (!hasColumn('orders', 'shipping_cost_incurred')) db.exec('ALTER TABLE orders ADD COLUMN shipping_cost_incurred INTEGER DEFAULT 0;');
  if (!hasColumn('orders', 'pickup_address')) db.exec('ALTER TABLE orders ADD COLUMN pickup_address TEXT;');
  if (!hasColumn('orders', 'admin_resolved_at')) db.exec('ALTER TABLE orders ADD COLUMN admin_resolved_at TEXT;');
  if (!hasColumn('orders', 'admin_resolver_id')) db.exec('ALTER TABLE orders ADD COLUMN admin_resolver_id INTEGER;');
  if (!hasColumn('orders', 'admin_resolution_reason')) db.exec('ALTER TABLE orders ADD COLUMN admin_resolution_reason TEXT;');

  // 3. Products table columns
  if (!hasColumn('products', 'promoted_badge')) db.exec('ALTER TABLE products ADD COLUMN promoted_badge TEXT;');
  if (!hasColumn('products', 'bump_count')) db.exec('ALTER TABLE products ADD COLUMN bump_count INTEGER DEFAULT 0;');
  if (!hasColumn('products', 'approval_status')) db.exec("ALTER TABLE products ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'APPROVED';");
  if (!hasColumn('products', 'approved_by')) db.exec('ALTER TABLE products ADD COLUMN approved_by INTEGER;');
  if (!hasColumn('products', 'rejection_reason')) db.exec('ALTER TABLE products ADD COLUMN rejection_reason TEXT;');

  // 4. Users table columns
  if (!hasColumn('users', 'password')) db.exec("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT '';");
  if (!hasColumn('users', 'bonus_claimed')) db.exec('ALTER TABLE users ADD COLUMN bonus_claimed INTEGER DEFAULT 1;');
  if (!hasColumn('users', 'status')) db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';");
  if (!hasColumn('users', 'lock_reason')) db.exec('ALTER TABLE users ADD COLUMN lock_reason TEXT;');
  if (!hasColumn('users', 'warning_count')) db.exec('ALTER TABLE users ADD COLUMN warning_count INTEGER DEFAULT 0;');

  // Ensure otp_codes table exists
  db.exec(\`
    CREATE TABLE IF NOT EXISTS otp_codes (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  \`);

  // Migrate existing plaintext passwords to bcrypt hashes
  try {
    const existingUsers = db.prepare('SELECT id, password FROM users').all();
    for (const u of existingUsers) {
      if (!u.password || !u.password.startsWith('$2')) {
        const hashed = bcrypt.hashSync(u.password || 'Student@123', 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, u.id);
      }
    }
  } catch (err) {
    // Ignore migration error if users table is not ready
  }
}

function dropAndCreateTables() {
  db.exec(\`
    DROP TABLE IF EXISTS attachments;
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS listing_reports;
    DROP TABLE IF EXISTS chat_messages;
    DROP TABLE IF EXISTS chat_conversations;
    DROP TABLE IF EXISTS disputes;
    DROP TABLE IF EXISTS shipments;
    DROP TABLE IF EXISTS voucher_usages;
    DROP TABLE IF EXISTS voucher_campaigns;
    DROP TABLE IF EXISTS favorites;
    DROP TABLE IF EXISTS platform_entries;
    DROP TABLE IF EXISTS otp_codes;
    DROP TABLE IF EXISTS wallet_transactions;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS wallets;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS bump_packages;
  \`);
  createTablesIfNotExists();
}

function initDatabase(forceReseed = false) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version < 1) {
    const saved = backupDatabase();
    if (saved) console.log(\`Database backup before migration: \${saved}\`);
  }
  ensureSchemaMigrations();
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (forceReseed || userCount === 0) seedAllData();
  ensureApplicationTables();
  db.exec('PRAGMA user_version = 1;');
}

function seedAllData() {
  console.log('Seeding 50 realistic student products & TakeTwo wallet transactions with bcrypt passwords...');

  // Temporarily disable foreign keys during reseed
  db.exec('PRAGMA foreign_keys = OFF;');
  dropAndCreateTables();

  // 1. Categories
  const insertCat = db.prepare('INSERT INTO categories (id, name, icon, description) VALUES (?, ?, ?, ?)');
  insertCat.run('books', 'Giáo trình & Học tập', '📚', 'Slide in, giáo trình đại cương, sách chuyên ngành ĐH');
  insertCat.run('living', 'Đồ trọ & KTX', '🛏️', 'Nồi cơm điện, quạt, bàn xếp, ấm siêu tốc, tủ vải');
  insertCat.run('electronics', 'Điện tử & Phụ kiện', '💻', 'Chuột, phím cơ, tai nghe, màn hình, củ cáp sạc');
  insertCat.run('fashion', 'Thời trang SV', '👕', 'Áo khoác đồng phục trường, vest thuyết trình, outfit sinh viên');

  // 2. Users (4 Users: Buyer, Seller, Student, Admin)
  const insertUser = db.prepare(\`
    INSERT INTO users (id, name, email, password, role, campus, student_code, rating_avg, review_count, eco_points, co2_saved_kg, avatar_url, bonus_claimed, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', datetime('now', ?))
  \`);

  const studentHashedPassword = bcrypt.hashSync('Student@123', 10);
  const adminHashedPassword = bcrypt.hashSync('Admin@TakeTwo2026', 10);

  insertUser.run(1, 'Vũ Hán Tuấn', 'tuanvhhe194875@fpt.edu.vn', studentHashedPassword, 'BUYER', 'Khu đô thị Hòa Lạc (ĐH FPT)', 'HE194875', 4.9, 14, 450, 18.5, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', '-30 days');
  insertUser.run(2, 'Nguyễn Minh Anh (Chủ Gian Hàng)', 'minhanh.seller@fpt.edu.vn', studentHashedPassword, 'SELLER', 'Khu đô thị Hòa Lạc (ĐH FPT / KTX Dom A)', 'SE182210', 5.0, 48, 980, 42.0, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80', '-60 days');
  insertUser.run(3, 'Trần Bảo Long', 'longtb.vnu@vnu.edu.vn', studentHashedPassword, 'SELLER', 'Khu đô thị Hòa Lạc (ĐHQG Hà Nội)', 'QH20230911', 4.8, 19, 380, 14.5, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', '-20 days');
  insertUser.run(4, 'Ban Quản Trị TakeTwo', 'admin@taketwo.vn', adminHashedPassword, 'ADMIN', 'Trụ sở Hà Nội', 'ADMIN01', 5.0, 0, 0, 0.0, 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80', '-90 days');

  // 3. Wallets (Số dư mẫu + lượt đẩy bài VIP)
  const insertWallet = db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at) VALUES (?, ?, ?, ?, datetime('now'))");
  insertWallet.run(1, 250000, 55000, 2);   // Tuấn (Buyer - 2 lượt đẩy VIP)
  insertWallet.run(2, 680000, 0, 5);       // Minh Anh (Seller - 5 lượt)
  insertWallet.run(3, 195000, 0, 1);       // Long (Seller - 1 lượt)
  insertWallet.run(4, 0, 0, 99);          // Admin is platform steward

  // 4. Bump Packages
  const insertBump = db.prepare('INSERT INTO bump_packages (id, name, bump_credits, price, tag, description, has_badge_hot, validity_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertBump.run('bump_single', 'Gói Lẻ (Cơ bản)', 1, 15000, 'Mức giá neo', '15.000đ / 1 lượt đẩy bài lên đầu danh mục. Hiệu lực 30 ngày.', 0, 30);
  insertBump.run('bump_saver', 'Gói Sinh Viên Tiết Kiệm', 5, 49000, '⭐ Phổ biến nhất - Tiết kiệm 35%', '49.000đ / 5 lượt đăng & đẩy bài (Chỉ 9.8k/lượt, tiết kiệm 26.000đ).', 0, 30);
  insertBump.run('bump_vip', 'Gói Xả Đồ Ra Trường (VIP)', 10, 79000, '👑 Siêu hời - Pass nhanh x3', '79.000đ / 10 lượt đẩy + Tặng Huy hiệu "🔥 Đẩy Top" độc quyền.', 1, 60);

  // 5. Products
  const insertProduct = db.prepare(\`
    INSERT INTO products (
      seller_id, category_id, title, price, original_price, condition_level, defect_note,
      campus_cluster, meetup_location, image_url, status, approval_status, is_promoted, promoted_badge, bump_count, view_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?, ?, datetime('now', ?))
  \`);
` + currentDb.substring(currentDb.indexOf('  const productData = ['), currentDb.indexOf('  // 6. Active Escrow Order with 5-Day SLA Countdown')) + `
  // 6. Active Escrow Order with 5-Day SLA Countdown
  const insertOrder = db.prepare(\`
    INSERT INTO orders (
      order_code, product_id, buyer_id, seller_id, amount, shipping_fee, discount, total_paid,
      delivery_type, delivery_address, recipient_name, recipient_phone, tracking_code,
      payment_method, status, escrow_status, buyer_confirmed, seller_confirmed,
      shipped_at, auto_confirm_deadline, voucher_code, pricing_version, seller_payout, platform_fee, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'v2_net_seller', ?, ?, datetime('now', '-1 days'), datetime('now'))
  \`);

  const shippedDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const deadlineDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
  const seedCommission = Math.round(45000 * config.commission_rate);
  const seedSellerPayout = 45000 - seedCommission;

  insertOrder.run(
    'TK-20261102-01',
    1,
    1,
    2,
    45000,
    15000,
    5000,
    55000,
    'COURIER_ROOM',
    'Phòng 304, KTX Dom E, ĐHQG Hòa Lạc',
    'Vũ Hán Tuấn',
    '0987654321',
    'TK-EXPRESS-9921',
    'WALLET_ESCROW',
    'DELIVERING',
    'HELD',
    0,
    1,
    shippedDate,
    deadlineDate,
    'SV5K',
    seedSellerPayout,
    seedCommission
  );

  // 7. Seed Vouchers
  const insertVoucher = db.prepare(\`
    INSERT INTO voucher_campaigns (code, title, description, discount_type, discount_value, max_discount, min_spend, start_date, end_date, target_audience, budget, budget_used, budget_held, usage_limit, usage_per_user, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-10 days'))
  \`);
  insertVoucher.run('SV5K', 'Ưu Đãi Sinh Viên 5.000đ', 'Giảm 5.000đ trực tiếp vào giá hàng sinh viên', 'FIXED', 5000, 5000, 0, '2026-01-01', '2026-12-31', 'ALL', 5000000, 0, 5000, 1000, 5, 1);
  insertVoucher.run('WELCOME10', 'Chào Bạn Mới - Giảm 10%', 'Giảm 10% tối đa 20.000đ cho đơn hàng đầu tiên', 'PERCENTAGE', 10, 20000, 40000, '2026-01-01', '2026-12-31', 'NEW_BUYER', 2000000, 0, 0, 500, 1, 1);
  insertVoucher.run('HOALACFREE', 'Miễn Phí Ship Hòa Lạc', 'Giảm 15.000đ cước giao nhận tại khu đô thị Hòa Lạc', 'FIXED', 15000, 15000, 50000, '2026-01-01', '2026-12-31', 'CAMPUS_HOALAC', 3000000, 0, 0, 200, 2, 1);

  // Seed Voucher Usage for Order 1
  db.prepare(\`
    INSERT INTO voucher_usages (voucher_id, order_id, user_id, discount_amount, status, created_at, updated_at)
    VALUES (1, 1, 1, 5000, 'HELD', datetime('now', '-1 days'), datetime('now'))
  \`).run();

  // 8. Seed Shipment for Order 1
  db.prepare(\`
    INSERT INTO shipments (order_id, tracking_code, pickup_address, delivery_address, fee_charged, fee_payable, status, payable_status, picked_up_at, created_at, updated_at)
    VALUES (1, 'TK-DLV-88219', 'Sảnh Trống Đồng, KTX Dom A - ĐH FPT', 'Phòng 304, KTX Dom E, ĐHQG Hòa Lạc', 15000, 15000, 'DELIVERING', 'PENDING', datetime('now', '-1 days'), datetime('now', '-1 days'), datetime('now'))
  \`).run();

  // 9. TakeTwo Wallet Transactions (Sổ Quỹ Thu Chi Mẫu)
  const insertTx = db.prepare(\`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  \`);

  insertTx.run(1, 'TOPUP', 'IN', 'PT-20261101-01', 'VietQR MBBank', 200000, 105000, 305000, 'VQR-88219', 'Nạp tiền vào ví TakeTwo qua VietQR MBBank', '-2 days');
  insertTx.run(1, 'ESCROW_HOLD', 'HOLD', 'PC-20261101-02', 'Ví TakeTwo Escrow', -55000, 305000, 250000, 'TK-20261102-01', 'Tạm giữ tiền thanh toán đơn hàng #TK-20261102-01 (Giáo trình Triết học Mác)', '-1 days');
  insertTx.run(2, 'TOPUP', 'IN', 'PT-20261030-03', 'VietQR SeABank', 500000, 229000, 729000, 'VQR-11029', 'Nạp tiền vào ví TakeTwo qua VietQR SeABank', '-3 days');
  insertTx.run(2, 'BUY_BOOST', 'OUT', 'PC-20261031-04', 'Ví TakeTwo', -49000, 729000, 680000, 'bump_saver', 'Mua Gói Sinh Viên Tiết Kiệm (+5 lượt đẩy bài VIP)', '-2 days');

  db.exec('PRAGMA foreign_keys = ON;');
  ensureApplicationTables();
  console.log(\`Database seeded with \${productData.length} realistic student products and full TakeTwo Wallet transactions!\`);
}

module.exports = {
  db,
  dbPath,
  backupDatabase,
  initDatabase,
  seedAllData
};
`;

fs.writeFileSync(path.join(__dirname, '../db.js'), updatedDb, 'utf8');
console.log('db.js updated successfully!');

