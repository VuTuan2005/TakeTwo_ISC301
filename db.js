const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const os = require('node:os');
const bcrypt = require('bcryptjs');

// In serverless environments (Vercel / Lambda), filesystem is read-only except /tmp
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dbDir = isServerless ? os.tmpdir() : __dirname;
const dbPath = path.join(dbDir, 'taketwo.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys
db.exec('PRAGMA foreign_keys = ON;');

function createTablesIfNotExists() {
  db.exec(`
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
      meetup_location TEXT NOT NULL,
      image_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
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
  `);
}

function ensureSchemaMigrations() {
  createTablesIfNotExists();

  // Helper to check if column exists
  const hasColumn = (table, col) => {
    try {
      const info = db.prepare(`PRAGMA table_info(${table})`).all();
      return info.some(c => c.name === col);
    } catch (e) {
      return false;
    }
  };

  // 1. Wallets table boost_credits
  if (!hasColumn('wallets', 'boost_credits')) {
    db.exec('ALTER TABLE wallets ADD COLUMN boost_credits INTEGER NOT NULL DEFAULT 0;');
  }

  // 2. Orders table recipient_name & recipient_phone
  if (!hasColumn('orders', 'recipient_name')) {
    db.exec('ALTER TABLE orders ADD COLUMN recipient_name TEXT;');
  }
  if (!hasColumn('orders', 'recipient_phone')) {
    db.exec('ALTER TABLE orders ADD COLUMN recipient_phone TEXT;');
  }

  // 3. Products table promoted_badge & bump_count
  if (!hasColumn('products', 'promoted_badge')) {
    db.exec('ALTER TABLE products ADD COLUMN promoted_badge TEXT;');
  }
  if (!hasColumn('products', 'bump_count')) {
    db.exec('ALTER TABLE products ADD COLUMN bump_count INTEGER DEFAULT 0;');
  }

  // 4. Users table password & bonus_claimed
  if (!hasColumn('users', 'password')) {
    db.exec("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT '';");
  }
  if (!hasColumn('users', 'bonus_claimed')) {
    db.exec("ALTER TABLE users ADD COLUMN bonus_claimed INTEGER DEFAULT 1;");
  }

  // Ensure otp_codes table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

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
  db.exec(`
    DROP TABLE IF EXISTS otp_codes;
    DROP TABLE IF EXISTS wallet_transactions;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS wallets;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS bump_packages;
  `);
  createTablesIfNotExists();
}

function initDatabase(forceReseed = false) {
  ensureSchemaMigrations();
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
  if (!tableCheck) {
    dropAndCreateTables();
    seedAllData();
  } else {
    const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    if (prodCount === 0 || forceReseed) {
      seedAllData();
    }
  }
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
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password, role, campus, student_code, rating_avg, review_count, eco_points, co2_saved_kg, avatar_url, bonus_claimed, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now', ?))
  `);

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
  insertWallet.run(4, 30250000, 55000, 99);// Admin (Cash reserve pool)

  // 4. Bump Packages (3 gói chuẩn hóa theo Kinh tế học hành vi: Lẻ 15k / Tiết kiệm 49k / VIP 79k)
  const insertBump = db.prepare('INSERT INTO bump_packages (id, name, bump_credits, price, tag, description, has_badge_hot, validity_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertBump.run('bump_single', 'Gói Lẻ (Cơ bản)', 1, 15000, 'Mức giá neo', '15.000đ / 1 lượt đẩy bài lên đầu danh mục. Hiệu lực 30 ngày.', 0, 30);
  insertBump.run('bump_saver', 'Gói Sinh Viên Tiết Kiệm', 5, 49000, '⭐ Phổ biến nhất - Tiết kiệm 35%', '49.000đ / 5 lượt đăng & đẩy bài (Chỉ 9.8k/lượt, tiết kiệm 26.000đ).', 0, 30);
  insertBump.run('bump_vip', 'Gói Xả Đồ Ra Trường (VIP)', 10, 79000, '👑 Siêu hời - Pass nhanh x3', '79.000đ / 10 lượt đẩy + Tặng Huy hiệu "🔥 Đẩy Top" độc quyền.', 1, 60);

  // 5. 8 Realistic Student Products Across 4 Categories
  const insertProduct = db.prepare(`
    INSERT INTO products (
      seller_id, category_id, title, price, original_price, condition_level, defect_note,
      campus_cluster, meetup_location, image_url, status, is_promoted, promoted_badge, bump_count, view_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  const productData = [
    // ==================== 1. BOOKS & EDUCATION (GIÁO TRÌNH & HỌC TẬP - 13 SP) ====================
    [2, 'books', 'Giáo trình Triết học Mác - Lênin & Tư tưởng Hồ Chí Minh (Bộ 2 cuốn)', 45000, 140000, 'Như mới 99%', 'Sách mới tinh chỉ highlight 2 trang đầu, không rách gáy.', 'Hòa Lạc', 'Sảnh Trống Đồng, KTX Dom A - ĐH FPT', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80', 'RESERVED', 1, 'HOT', 3, 148, '-2 days'],
    [1, 'books', 'Giáo trình Cấu trúc dữ liệu & Giải thuật C++ (FPT University)', 55000, 120000, 'Tốt 90%', 'Có ghi chú bằng bút chì các giải thuật DFS/BFS rất dễ hiểu.', 'Hòa Lạc', 'Thư viện ĐH FPT Hòa Lạc', 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 95, '-1 days'],
    [2, 'books', 'Sách Lập trình Web Fullstack với React, Node.js & TypeScript', 85000, 195000, 'Như mới 99%', 'Bìa bọc màng co nilon cẩn thận, tặng kèm source code dự án mẫu.', 'Cầu Giấy - Xuân Thủy', 'Cổng ĐH Quốc Gia Hà Nội, 144 Xuân Thủy', 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 4, 210, '-3 hours'],
    [3, 'books', 'Bộ đề luyện thi TOEIC 750+ ETS Format Mới Nhất (Bộ 2 cuốn)', 65000, 160000, 'Tốt 90%', 'Chỉ làm bằng bút chì vài đề đầu đã tẩy sạch sẽ, còn nguyên đĩa CD.', 'Hà Đông - Thanh Xuân', 'Căn tin Học Viện Bưu Chính Viễn Thông PTIT', 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 175, '-6 hours'],
    [2, 'books', 'Giáo trình Kinh tế Vi mô & Kinh tế Vĩ mô (ĐH Kinh Tế Quốc Dân)', 50000, 130000, 'Tốt 90%', 'Đầy đủ bài tập có lời giải tham khảo, không nhàu nát trang nào.', 'Bách - Kinh - Xây', 'Cổng KTX ĐH Kinh Tế Quốc Dân, Trần Đại Nghĩa', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 130, '-8 hours'],
    [3, 'books', 'Sách Nguyên lý Kế toán & Phân tích Báo cáo Tài chính', 58000, 145000, 'Như mới 99%', 'Sách chuyên ngành kế kiểm cực chuẩn, mép sách thẳng thớm.', 'Đống Đa - Chùa Láng', 'Sảnh A ĐH Ngoại Thương Hà Nội', 'https://images.unsplash.com/photo-1554415707-9e49fa74a982?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'PRO', 3, 190, '-10 hours'],
    [2, 'books', 'Giáo trình Giải tích 1, 2 & Đại số Tuyến tính ĐH Bách Khoa', 45000, 110000, 'Khá 80%', 'Gáy hơi sờn nhẹ theo thời gian, ruột sách rõ chữ dễ học qua môn.', 'Bách - Kinh - Xây', 'Thư viện Tạ Quang Bửu - ĐH Bách Khoa Hà Nội', 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 140, '-12 hours'],
    [3, 'books', 'Bộ sách Ngữ pháp tiếng Hàn sơ cấp 1 & 2 (ĐH Hà Nội - HANU)', 70000, 180000, 'Như mới 99%', 'Bản in màu sắc nét, phù hợp tự học topik 1 và 2 cho người mới.', 'Hà Đông - Thanh Xuân', 'Cổng chính ĐH Hà Nội (HANU), Nguyễn Trãi', 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 115, '-14 hours'],
    [2, 'books', 'Sách Lập trình Hệ thống Nhúng C/C++ cho Vi điều khiển & IoT', 60000, 150000, 'Tốt 90%', 'Kiến trúc máy tính và code mẫu chạy thực tế trên vi điều khiển STM32.', 'Hòa Lạc', 'Khu Công Nghệ Cao Hòa Lạc', 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 88, '-16 hours'],
    [3, 'books', 'Sách Tâm lý học Đại cương & Kỹ năng Giao tiếp Thuyết trình', 40000, 95000, 'Như mới 99%', 'Tài liệu môn kỹ năng mềm cần thiết cho sinh viên năm 1 và năm 2.', 'Cầu Giấy - Xuân Thủy', 'Học viện Báo chí và Tuyên truyền, Xuân Thủy', 'https://images.unsplash.com/photo-1491841573634-28140fc7ced7?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 102, '-18 hours'],
    [2, 'books', 'Bộ Flashcard 3000 Từ vựng IELTS kèm Khoen xâu inox', 35000, 90000, 'Tốt 90%', 'Đầy đủ các chủ đề Academic, thẻ giấy cứng cán bóng chống nước nhẹ.', 'Đống Đa - Chùa Láng', 'Cổng Học viện Ngoại Giao, Chùa Láng', 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 5, 230, '-1 days'],
    [3, 'books', 'Giáo trình Quản trị Marketing & Hành vi Người tiêu dùng Kotler', 75000, 220000, 'Như mới 99%', 'Bản dịch chuẩn của NXB Lao Động, gáy chắc nịch không bung trang.', 'Bách - Kinh - Xây', 'Sảnh nhà A1 ĐH Kinh Tế Quốc Dân', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 160, '-1 days'],
    [2, 'books', 'Sách Pháp luật Đại cương & Luật Thương mại Quốc tế', 48000, 115000, 'Khá 80%', 'Đã đánh dấu các điều luật quan trọng hay ra thi học kỳ.', 'Đống Đa - Chùa Láng', 'Sảnh nhà B ĐH Luật Hà Nội, Nguyễn Chí Thanh', 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 95, '-2 days'],

    // ==================== 2. DORM & LIVING (ĐỒ DÙNG PHÒNG TRỌ & KTX - 13 SP) ====================
    [2, 'living', 'Nồi cơm điện mini Lock&Lock 0.8L (Dành cho 1-2 người ở trọ KTX)', 180000, 490000, 'Tốt 90%', 'Lòng nồi chống dính còn rất tốt, xước nhẹ vỏ ngoài không ảnh hưởng.', 'Hòa Lạc', 'Cổng KTX Dom B - ĐH FPT Hòa Lạc', 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 5, 320, '-4 hours'],
    [1, 'living', 'Bàn học gấp gọn gỗ thông có khe cắm iPad & Ngăn kéo nhỏ', 75000, 170000, 'Khá 80%', 'Gỗ chắc chắn ngồi giường KTX bao tiện, có một vết mực mờ góc trái.', 'Hòa Lạc', 'Sảnh Dom C KTX FPT', 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 180, '-5 hours'],
    [3, 'living', 'Ấm siêu tốc Inox Sunhouse 1.8L đun nước sôi siêu tốc 3 phút', 65000, 150000, 'Tốt 90%', 'Đế xoay 360 độ ngắt điện tự động an toàn, đun nước pha mì ăn đêm KTX.', 'Cầu Giấy - Xuân Thủy', 'KTX ĐH Sư Phạm Hà Nội', 'https://images.unsplash.com/photo-1585675100414-add2e465a136?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 3, 245, '-7 hours'],
    [2, 'living', 'Quạt lửng đứng Senko 3 cánh chạy êm ru mát rượi phòng trọ', 120000, 290000, 'Tốt 90%', 'Động cơ đồng bền bỉ, 3 tốc độ gió lồng quạt đã lau rửa sạch bóng.', 'Hà Đông - Thanh Xuân', 'Khu trọ sinh viên Triều Khúc, Thanh Xuân', 'https://images.unsplash.com/photo-1618941716939-553df3c6c278?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 190, '-9 hours'],
    [3, 'living', 'Nồi lẩu điện mini đa năng 1.5L kèm xửng hấp 2 tầng', 115000, 260000, 'Như mới 99%', 'Dùng luộc trứng, nấu mì, ăn lẩu 1-2 người cực tiện lợi chống dính xịn.', 'Bách - Kinh - Xây', 'Khu B KTX ĐH Bách Khoa Hà Nội', 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 4, 310, '-11 hours'],
    [2, 'living', 'Kệ sách để bàn mini 3 tầng gỗ ép vintage gọn gàng bàn học', 55000, 135000, 'Tốt 90%', 'Dễ dàng tháo lắp ốc vít, để vừa tập vở và bút viết thước kẻ.', 'Đống Đa - Chùa Láng', 'KTX Học viện Ngân Hàng, Chùa Bộc', 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 140, '-13 hours'],
    [3, 'living', 'Đèn bàn học chống cận Rạng Đông bóng LED ánh sáng vàng dịu', 85000, 190000, 'Như mới 99%', 'Thân đèn uốn dẻo 360 độ, không chớp nháy bảo vệ mắt cày đồ án đêm.', 'Hòa Lạc', 'Sảnh Dom D KTX FPT Hòa Lạc', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 160, '-15 hours'],
    [2, 'living', 'Bếp từ đơn Bluestone cảm ứng tặng kèm chảo chiên chống dính', 290000, 790000, 'Tốt 90%', 'Mặt kính Ceramic cường lực sáng loáng, đun nấu nhanh tiết kiệm điện.', 'Bách - Kinh - Xây', 'Cổng KTX Xây Dựng, Đồng Tâm', 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'PRO', 4, 280, '-17 hours'],
    [3, 'living', 'Tủ vải sinh viên 3 buồng 8 ngăn khung thép bọc vải dù dày', 135000, 320000, 'Tốt 90%', 'Khung sắt sơn tĩnh điện không rỉ, khóa kéo êm ái chống bụi côn trùng.', 'Cầu Giấy - Xuân Thủy', 'Khu trọ Dịch Vọng Hậu, Cầu Giấy', 'https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 175, '-19 hours'],
    [2, 'living', 'Đệm ngủ gấp 3 bông ép Hàn Quốc 1m2 x 1m9 nằm KTX cực êm', 190000, 550000, 'Tốt 90%', 'Vỏ bọc gấm hoa sạch sẽ, lõi bông ép cứng cáp không lún lưng khi ngủ.', 'Hòa Lạc', 'KTX ĐHQG Hà Nội, Hòa Lạc', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 210, '-21 hours'],
    [3, 'living', 'Gương đứng soi toàn thân viền lượn sóng có chân tựa sống ảo', 145000, 360000, 'Như mới 99%', 'Mặt gương tráng bạc sáng nét nịnh dáng, kích thước 40x150cm.', 'Đống Đa - Chùa Láng', 'Phố Chùa Láng, Đống Đa', 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 3, 340, '-23 hours'],
    [2, 'living', 'Máy sấy tóc Panasonic 1800W 2 chiều nóng lạnh sấy nhanh khô', 85000, 220000, 'Tốt 90%', 'Máy chạy êm có chế độ sấy ion bảo vệ tóc không xơ rối gập gọn được.', 'Hà Đông - Thanh Xuân', 'KTX ĐH Kiến Trúc Hà Nội', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 150, '-1 days'],
    [3, 'living', 'Hộp cơm giữ nhiệt cắm điện hâm nóng 3 tầng inox tiện lợi', 95000, 240000, 'Như mới 99%', 'Hâm cơm nóng hổi 15 phút, khay inox 304 có nắp hút chân không.', 'Cầu Giấy - Xuân Thủy', 'Khu KTX Ngoại Ngữ ĐHQG', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 130, '-2 days'],

    // ==================== 3. ELECTRONICS & GADGETS (ĐIỆN TỬ & PHỤ KIỆN - 12 SP) ====================
    [3, 'electronics', 'Bàn phím cơ DareU EK87 White LED Red Switch gõ êm mượt', 290000, 650000, 'Tốt 90%', 'Đầy đủ hộp và cáp, các phím gõ nảy chuẩn không liệt phím nào.', 'Hòa Lạc', 'Căn tin ĐHQG Hà Nội - Hòa Lạc', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 3, 240, '-2 hours'],
    [2, 'electronics', 'Tai nghe chụp tai Sony WH-CH520 chống ồn pin 50 tiếng', 590000, 1190000, 'Như mới 99%', 'Còn bảo hành chính hãng 4 tháng, đệm tai da êm không bong tróc.', 'Cầu Giấy - Xuân Thủy', 'Cổng ĐH Sư Phạm Hà Nội, Xuân Thủy', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 410, '-5 hours'],
    [2, 'electronics', 'Chuột không dây Silent Logitech M331 bấm êm không tiếng động', 160000, 380000, 'Tốt 90%', 'Chuột cầm đầm tay không gây ồn khi cày đêm trong phòng KTX, pin trâu.', 'Hòa Lạc', 'Sảnh thư viện FPT Hòa Lạc', 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 5, 290, '-4 hours'],
    [3, 'electronics', 'Màn hình máy tính Dell 24 inch FHD IPS 75Hz viền siêu mỏng', 1450000, 2900000, 'Như mới 99%', 'Không một điểm chết, màu chuẩn IPS sáng đẹp cày code đồ họa bao phê.', 'Cầu Giấy - Xuân Thủy', 'Cổng ĐH Giao Thông Vận Tải, Cầu Giấy', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'PRO', 6, 520, '-6 hours'],
    [2, 'electronics', 'Tai nghe Bluetooth True Wireless Baseus Bowie E3 âm bass khỏe', 170000, 390000, 'Tốt 90%', 'Dock sạc nhỏ gọn pin dùng 20 tiếng, kèm dây sạc Type-C nguyên bản.', 'Đống Đa - Chùa Láng', 'Cổng ĐH Ngoại Thương, Chùa Láng', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 185, '-8 hours'],
    [3, 'electronics', 'Củ sạc nhanh GaN Ugreen 65W 3 cổng sạc đồng thời Laptop & Phone', 320000, 690000, 'Như mới 99%', 'Công nghệ GaN mát lạnh, sạc nhanh cho Macbook, Thinkpad và iPhone.', 'Bách - Kinh - Xây', 'KTX ĐH Bách Khoa, Tạ Quang Bửu', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 4, 310, '-10 hours'],
    [2, 'electronics', 'Loa Bluetooth di động JBL Go 3 chống nước pin trâu bass ấm', 450000, 990000, 'Như mới 99%', 'Chính hãng PGI nguyên tem, chống nước chuẩn IP67 mang đi phượt teambuilding.', 'Hà Đông - Thanh Xuân', 'Sảnh Học Viện An Ninh, Thanh Xuân', 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 3, 275, '-12 hours'],
    [3, 'electronics', 'Giá đỡ Laptop hợp kim nhôm tản nhiệt chỉnh 6 nấc gấp gọn', 85000, 195000, 'Tốt 90%', 'Khung nhôm dày dặn đệm cao su chống trượt giúp tư thế gõ phím chuẩn.', 'Hòa Lạc', 'Căn tin KTX FPT Dom A', 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 140, '-14 hours'],
    [2, 'electronics', 'Webcam máy tính Full HD 1080P có micro khử ồn học online Zoom', 145000, 350000, 'Tốt 90%', 'Hình ảnh nét căng 30fps cắm nhận ngay không cần cài driver.', 'Đống Đa - Chùa Láng', 'Sảnh nhà A Học viện Ngân Hàng', 'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 160, '-16 hours'],
    [3, 'electronics', 'Lót chuột cỡ lớn gaming 80x30cm bản đồ thế giới viền may chỉ', 45000, 110000, 'Tốt 90%', 'Đế cao su chống trượt mặt vải trơn mượt không bong tróc viền may.', 'Bách - Kinh - Xây', 'Cổng KTX ĐH Xây Dựng Hà Nội', 'https://images.unsplash.com/photo-1616440347437-b1c73416efc2?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 110, '-18 hours'],
    [2, 'electronics', 'Hub chuyển đổi Type-C 7 in 1 Baseus sang HDMI 4K & USB 3.0', 270000, 580000, 'Như mới 99%', 'Vỏ nhôm tản nhiệt tốt, xuất màn hình thuyết trình giảng đường mượt mà.', 'Cầu Giấy - Xuân Thủy', 'KTX ĐH Sư Phạm, Xuân Thủy', 'https://images.unsplash.com/photo-1544652478-6653e09f18a2?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 3, 220, '-20 hours'],
    [3, 'electronics', 'Pin sạc dự phòng Xiaomi 20000mAh sạc nhanh 22.5W 2 cổng ra', 230000, 490000, 'Tốt 90%', 'Dung lượng thực chuẩn sạc được 4 lần điện thoại, vỏ nhựa chống bám bẩn.', 'Hà Đông - Thanh Xuân', 'Cổng ĐH Khoa Học Tự Nhiên, Nguyễn Trãi', 'https://images.unsplash.com/photo-1609592424844-31f0cf0b7410?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 195, '-1 days'],

    // ==================== 4. FASHION & OUTFITS (THỜI TRANG & PHỤ KIỆN SV - 12 SP) ====================
    [3, 'fashion', 'Áo khoác bomber đồng phục FPT University size L chuẩn form', 150000, 350000, 'Như mới 99%', 'Mặc đúng 2 lần thi thể dục, khóa kéo trơn tru thơm tho như mới.', 'Hòa Lạc', 'Trường ĐH FPT Hòa Lạc', 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 4, 380, '-1 hours'],
    [2, 'fashion', 'Bộ vest đen thuyết trình nam form Hàn Quốc trẻ trung (Size 48)', 290000, 750000, 'Như mới 99%', 'Chỉ mặc 1 buổi bảo vệ luận văn tốt nghiệp, vải tuyết mưa đứng dáng.', 'Bách - Kinh - Xây', 'KTX ĐH Kinh Tế Quốc Dân', 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 220, '-7 hours'],
    [3, 'fashion', 'Áo sơ mi trắng cổ đức tay dài form regular fit đi thực tập', 75000, 180000, 'Như mới 99%', 'Chất vải sợi tre chống nhăn thoáng mát, mặc đi phỏng vấn bao lịch sự.', 'Đống Đa - Chùa Láng', 'Sảnh nhà A Ngoại Thương Hà Nội', 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 3, 260, '-5 hours'],
    [2, 'fashion', 'Balo laptop sinh viên chống thấm nước 15.6 inch có cổng sạc USB', 135000, 340000, 'Tốt 90%', 'Nhiều ngăn tiện lợi có đệm lưng êm ái chống gù, quai đeo trợ lực.', 'Cầu Giấy - Xuân Thủy', 'KTX ĐH Báo Chí, Xuân Thủy', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 310, '-8 hours'],
    [3, 'fashion', 'Áo hoodie nỉ bông form rộng oversize màu xám tiêu ấm áp KTX', 110000, 280000, 'Tốt 90%', 'Nỉ bông dày dặn ấm áp không xù lông mũ 2 lớp đứng form đi học mùa đông.', 'Hòa Lạc', 'Sảnh Dom B KTX FPT Hòa Lạc', 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'PRO', 4, 340, '-10 hours'],
    [2, 'fashion', 'Giày sneaker canvas trắng đế bệt cổ thấp unisex size 40', 125000, 310000, 'Tốt 90%', 'Đế cao su lưu hóa dẻo êm chân, đã giặt sạch tinh phối đồ bao đẹp.', 'Bách - Kinh - Xây', 'Cổng KTX ĐH Bách Khoa, Phố Trần Đại Nghĩa', 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 215, '-12 hours'],
    [3, 'fashion', 'Áo khoác dạ nữ dáng dài màu be thanh lịch mùa đông Hà Nội (Size S/M)', 220000, 580000, 'Như mới 99%', 'Chất dạ ép mịn đứng dáng giữ ấm cực tốt, mặc đi học đi chơi đều xinh.', 'Đống Đa - Chùa Láng', 'Sảnh Học Viện Ngoại Giao', 'https://images.unsplash.com/photo-1539533018447-63fcce667823?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 3, 290, '-14 hours'],
    [2, 'fashion', 'Áo thun polo local brand form rộng cotton 100% phối viền cổ', 85000, 220000, 'Như mới 99%', 'Vải thun cá sấu dày dặn thấm hút mồ hôi tốt, không phai màu giặt máy.', 'Hà Đông - Thanh Xuân', 'Sảnh nhà A PTIT Bưu Chính Hà Đông', 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 170, '-16 hours'],
    [3, 'fashion', 'Quần jeans baggy nam ống rộng xanh retro vải bò dày dặn (Size 30)', 130000, 330000, 'Tốt 90%', 'Dáng suông phong cách Hàn Quốc dễ phối cùng áo phông và hoodie.', 'Cầu Giấy - Xuân Thủy', 'Cổng ĐH Quốc Gia Hà Nội', 'https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 195, '-18 hours'],
    [2, 'fashion', 'Túi tote vải canvas phối da đựng vừa laptop 14 inch và tập A4', 55000, 140000, 'Như mới 99%', 'Có khóa kéo miệng và ngăn nhỏ đựng chìa khóa thẻ sinh viên.', 'Hòa Lạc', 'Cổng KTX Dom C FPT', 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 140, '-20 hours'],
    [3, 'fashion', 'Áo dài trắng nữ sinh lụa tơ tằm mềm mại chụp kỷ yếu (Size M)', 180000, 480000, 'Như mới 99%', 'Chỉ mặc đúng 1 buổi chụp ảnh kỷ yếu ra trường, tà áo thướt tha tôn dáng.', 'Bách - Kinh - Xây', 'Cổng ĐH Kinh Tế Quốc Dân', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 4, 380, '-22 hours'],
    [2, 'fashion', 'Mũ bảo hiểm nửa đầu Andes chính hãng có kính râm chắn gió bụi', 110000, 290000, 'Tốt 90%', 'Vỏ nhựa ABS nguyên sinh chịu lực tốt, đệm lót tháo giặt thơm tho.', 'Hà Đông - Thanh Xuân', 'Cổng ĐH Hà Nội HANU', 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 210, '-1 days']
  ];

  for (const item of productData) {
    insertProduct.run(...item);
  }

  // 6. Active Escrow Order with 5-Day SLA Countdown
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      order_code, product_id, buyer_id, seller_id, amount, shipping_fee, discount, total_paid,
      delivery_type, delivery_address, recipient_name, recipient_phone, tracking_code,
      payment_method, status, escrow_status, buyer_confirmed, seller_confirmed,
      shipped_at, auto_confirm_deadline, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 days'), datetime('now'))
  `);

  const shippedDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const deadlineDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

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
    deadlineDate
  );

  // 7. TakeTwo Wallet Transactions (Sổ Quỹ Thu Chi Mẫu)
  const insertTx = db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertTx.run(1, 'TOPUP', 'IN', 'PT-20261101-01', 'VietQR MBBank', 200000, 105000, 305000, 'VQR-88219', 'Nạp tiền vào ví TakeTwo qua VietQR MBBank', '-2 days');
  insertTx.run(1, 'ESCROW_HOLD', 'HOLD', 'PC-20261101-02', 'Ví TakeTwo Escrow', -55000, 305000, 250000, 'TK-20261102-01', 'Tạm giữ tiền thanh toán đơn hàng #TK-20261102-01 (Giáo trình Triết học Mác)', '-1 days');
  insertTx.run(2, 'TOPUP', 'IN', 'PT-20261030-03', 'VietQR SeABank', 500000, 229000, 729000, 'VQR-11029', 'Nạp tiền vào ví TakeTwo qua VietQR SeABank', '-3 days');
  insertTx.run(2, 'BUY_BOOST', 'OUT', 'PC-20261031-04', 'Ví TakeTwo', -49000, 729000, 680000, 'bump_saver', 'Mua Gói Sinh Viên Tiết Kiệm (+5 lượt đẩy bài VIP)', '-2 days');

  db.exec('PRAGMA foreign_keys = ON;');
  console.log(`Database seeded with ${productData.length} realistic student products and full TakeTwo Wallet transactions!`);
}

module.exports = {
  db,
  initDatabase,
  seedAllData
};
