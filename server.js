const express = require('express');
const cors = require('cors');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const { db, initDatabase } = require('./db');

// Environment & Security Configurations
const JWT_SECRET = process.env.JWT_SECRET || 'taketwo_jwt_secret_dev_key_2026';
const DEMO_MODE = process.env.DEMO_MODE !== 'false'; // Defaults to true for university demo, set DEMO_MODE=false to enforce strict security
const ALLOWED_CAMPUS_DOMAINS = [
  'fpt.edu.vn', 'fe.edu.vn', 'vnu.edu.vn', 'hust.edu.vn',
  'neu.edu.vn', 'ftu.edu.vn', 'ajc.edu.vn', 'hanu.edu.vn',
  'ptit.edu.vn', 'hau.edu.vn', 'tlu.edu.vn', 'hvnh.edu.vn',
  'hlu.edu.vn', 'utc.edu.vn', 'taketwo.vn'
];

// Initialize database schema and seeds
initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Anti-caching middleware for all API routes (prevents stale balance & stale listings)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Secure JWT Session Authentication Middleware
// Completely eliminates trusting spoofed x-user-id / user_id headers
app.use((req, res, next) => {
  req.currentUser = null;
  const token = req.cookies?.taketwo_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.userId) {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
        if (user) {
          req.currentUser = user;
        }
      }
    } catch (err) {
      // Invalid or expired token -> guest (req.currentUser = null)
      req.currentUser = null;
    }
  }
  next();
});

// Authentication guard: returns 401 Unauthorized without crashing
function requireAuth(req, res, next) {
  if (!req.currentUser) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập để thực hiện thao tác này!' });
  }
  next();
}

// Admin guard: returns 403 Forbidden for non-admin users
function requireAdmin(req, res, next) {
  if (!req.currentUser) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập tài khoản Quản trị viên!' });
  }
  if (req.currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Bạn không có quyền quản trị viên (Admin only)!' });
  }
  next();
}

// Session cookie helper
function setSessionCookie(res, user) {
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('taketwo_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  return token;
}

// Periodic background check for 5-day auto confirmations
function checkAutoConfirmations() {
  const now = new Date().toISOString();
  const expiredOrders = db.prepare(`
    SELECT * FROM orders 
    WHERE status = 'DELIVERING' 
      AND escrow_status = 'HELD' 
      AND auto_confirm_deadline IS NOT NULL 
      AND auto_confirm_deadline <= ?
  `).all(now);

  for (const order of expiredOrders) {
    console.log(`[Auto-Confirm 5-Day SLA] Order ${order.order_code} reached deadline without dispute. Auto-completing...`);
    completeOrderFunds(order, 'COMPLETED_AUTO');
  }
}

// Helper: Complete order and release Escrow funds with 3% platform commission
function completeOrderFunds(order, finalStatus = 'COMPLETED') {
  // 1. Deduct Escrow from Buyer
  const buyerWallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(order.buyer_id);
  if (buyerWallet) {
    db.prepare("UPDATE wallets SET escrow_balance = MAX(0, escrow_balance - ?), updated_at = datetime('now') WHERE id = ?")
      .run(order.total_paid, buyerWallet.id);
  }

  // 2. Calculate 3% commission on product amount
  const commission = Math.round(order.amount * 0.03);
  const sellerPayout = (order.amount - commission) + order.shipping_fee;

  // 3. Add to Seller Available Balance
  let sellerWallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(order.seller_id);
  if (!sellerWallet) {
    db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at) VALUES (?, 0, 0, 0, datetime('now'))").run(order.seller_id);
    sellerWallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(order.seller_id);
  }
  const newBal = sellerWallet.available_balance + sellerPayout;
  db.prepare("UPDATE wallets SET available_balance = available_balance + ?, updated_at = datetime('now') WHERE id = ?")
    .run(sellerPayout, sellerWallet.id);

    // Ledger for seller
    const vCode = 'PT-ESC-' + Math.floor(100000 + Math.random() * 900000);
    db.prepare(`
      INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
      VALUES (?, 'ESCROW_RELEASE', 'IN', ?, 'Két Escrow TakeTwo', ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      sellerWallet.id,
      vCode,
      sellerPayout,
      sellerWallet.available_balance,
      newBal,
      order.order_code,
      `Nhận tiền đơn ${order.order_code} (Đã trừ 3% phí sàn: -${commission.toLocaleString('vi-VN')}đ, cộng ship +${order.shipping_fee.toLocaleString('vi-VN')}đ)`
    );

  // 4. Update order status
  db.prepare(`
    UPDATE orders 
    SET status = ?, escrow_status = 'RELEASED', buyer_confirmed = 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(finalStatus, order.id);

  // 5. Update product status
  db.prepare("UPDATE products SET status = 'SOLD' WHERE id = ?").run(order.product_id);

  // 6. Update Eco points & Review count
  db.prepare('UPDATE users SET eco_points = eco_points + 50, co2_saved_kg = co2_saved_kg + 2.5 WHERE id = ?').run(order.buyer_id);
  db.prepare('UPDATE users SET review_count = review_count + 1 WHERE id = ?').run(order.seller_id);
}

// -------------------------------------------------------------
// USER & AUTH APIS (SECURE JWT SESSION COOKIES, BCRYPT & DB-BACKED OTP)
// -------------------------------------------------------------
app.get('/api/me', (req, res) => {
  if (!req.currentUser) {
    return res.json({
      user: null,
      wallet: { available_balance: 0, escrow_balance: 0, boost_credits: 0 },
      demo_mode: DEMO_MODE
    });
  }
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  res.json({
    user: req.currentUser,
    wallet: wallet || { available_balance: 0, escrow_balance: 0, boost_credits: 0 },
    demo_mode: DEMO_MODE
  });
});

app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, campus, student_code, rating_avg, avatar_url FROM users').all();
  res.json(users);
});

// 1. Send OTP Verification Code to Student Email (Stored securely in DB)
app.post('/api/auth/send-otp', (req, res) => {
  const { email, type } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email sinh viên hợp lệ!' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const domain = cleanEmail.split('@')[1];

  // Validate campus domain
  if (!DEMO_MODE && !ALLOWED_CAMPUS_DOMAINS.includes(domain)) {
    return res.status(400).json({ 
      error: `TakeTwo chỉ hỗ trợ sinh viên các trường ĐH tại Hà Nội. Tên miền @${domain} không thuộc danh sách hỗ trợ (@fpt.edu.vn, @vnu.edu.vn, @hust.edu.vn,...)!` 
    });
  }

  const existingUser = db.prepare('SELECT id, name, email FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  if (type === 'register' && existingUser) {
    return res.status(400).json({ error: 'Email này đã được đăng ký tài khoản trước đó. Vui lòng chuyển sang tab Đăng Nhập!' });
  }

  // Generate 6-digit numeric OTP and hash it with bcrypt
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = bcrypt.hashSync(otpCode, 8);
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  // Save / Update in DB otp_codes table
  db.prepare(`
    INSERT INTO otp_codes (email, code_hash, expires_at, attempts, created_at)
    VALUES (?, ?, ?, 0, datetime('now'))
    ON CONFLICT(email) DO UPDATE SET
      code_hash = excluded.code_hash,
      expires_at = excluded.expires_at,
      attempts = 0,
      created_at = excluded.created_at
  `).run(cleanEmail, codeHash, expiresAt);

  console.log(`[TakeTwo OTP] Secure OTP code generated for ${cleanEmail} (Expires in 5m)`);

  const responsePayload = {
    success: true,
    message: `Mã OTP xác thực đã được gửi về email ${cleanEmail}! (Hiệu lực trong 5 phút)`
  };

  // Only expose demo_otp when DEMO_MODE is active
  if (DEMO_MODE) {
    responsePayload.demo_otp = otpCode;
    responsePayload.message += ` [Chế độ Demo: Mã là ${otpCode}]`;
  }

  res.json(responsePayload);
});

// 2. Register New Student Account (with OTP & Welcome Bonus +100k)
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, otp_code, campus, role, student_code } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ họ tên, email trường và mật khẩu!' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên!' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const domain = cleanEmail.split('@')[1];

  // Enforce campus email restriction
  if (!DEMO_MODE && !ALLOWED_CAMPUS_DOMAINS.includes(domain)) {
    return res.status(400).json({
      error: `Chỉ chấp nhận email sinh viên trường (@fpt.edu.vn, @vnu.edu.vn, @hust.edu.vn,...)`
    });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  if (existingUser) {
    return res.status(400).json({ error: 'Email này đã tồn tại trên hệ thống TakeTwo!' });
  }

  // Verify OTP from database
  const otpRow = db.prepare('SELECT * FROM otp_codes WHERE email = ?').get(cleanEmail);
  const isUniversalDemo = DEMO_MODE && String(otp_code).trim() === '123456';

  if (!isUniversalDemo) {
    if (!otpRow) {
      return res.status(400).json({ error: 'Vui lòng bấm "Nhận Mã OTP" về email trước!' });
    }
    if (Date.now() > otpRow.expires_at) {
      db.prepare('DELETE FROM otp_codes WHERE email = ?').run(cleanEmail);
      return res.status(400).json({ error: 'Mã OTP đã hết hiệu lực (quá 5 phút). Vui lòng yêu cầu mã mới!' });
    }
    if (otpRow.attempts >= 5) {
      db.prepare('DELETE FROM otp_codes WHERE email = ?').run(cleanEmail);
      return res.status(400).json({ error: 'Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã mới!' });
    }

    const isMatch = bcrypt.compareSync(String(otp_code).trim(), otpRow.code_hash);
    if (!isMatch) {
      db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?').run(cleanEmail);
      const remaining = 5 - (otpRow.attempts + 1);
      return res.status(400).json({ error: `Mã OTP không chính xác! Bạn còn ${remaining} lần thử.` });
    }
  }

  // Clear OTP record after successful verification
  db.prepare('DELETE FROM otp_codes WHERE email = ?').run(cleanEmail);

  // Security: Admin role CANNOT be created via registration API
  const userRole = (role === 'SELLER') ? 'SELLER' : 'BUYER';
  const userCampus = campus || 'Hòa Lạc';
  const userCode = student_code || ('SV' + Math.floor(100000 + Math.random() * 900000));
  const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}`;
  const passwordHash = bcrypt.hashSync(password, 10);

  const result = db.prepare(`
    INSERT INTO users (name, email, password, role, campus, student_code, rating_avg, review_count, eco_points, co2_saved_kg, avatar_url, bonus_claimed, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 5.0, 0, 100, 2.5, ?, 1, datetime('now'))
  `).run(name.trim(), cleanEmail, passwordHash, userRole, userCampus, userCode, avatar);

  const newUserId = result.lastInsertRowid;

  // Provision wallet with 100,000 VND welcome bonus + 2 boost credits
  db.prepare(`
    INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at)
    VALUES (?, 100000, 0, 2, datetime('now'))
  `).run(newUserId);

  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(newUserId);

  // Record welcome bonus voucher transaction in ledger
  const vCode = 'PT-BONUS-' + Math.floor(100000 + Math.random() * 900000);
  db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, 'BONUS', 'IN', ?, 'TakeTwo Welcome Gift', 100000, 0, 100000, 'NEW-USER', 'Quà tặng tân sinh viên: +100.000đ vào ví và 2 lượt đẩy tin VIP', datetime('now'))
  `).run(wallet.id, vCode);

  const newUser = db.prepare('SELECT id, name, email, role, campus, student_code, rating_avg, avatar_url, eco_points, co2_saved_kg FROM users WHERE id = ?').get(newUserId);

  // Set secure HTTP-only JWT session cookie
  setSessionCookie(res, newUser);

  res.json({
    success: true,
    user: newUser,
    wallet,
    message: `Đăng ký thành công! Bạn nhận được quà tặng +100.000đ vào ví và 2 lượt đẩy tin VIP!`
  });
});

// 3. Login with Email + Password OR Email + OTP
app.post('/api/auth/login', (req, res) => {
  const { email, password, otp_code, login_type } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email!' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);

  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản với email này. Vui lòng đăng ký mới!' });
  }

  if (login_type === 'otp') {
    const otpRow = db.prepare('SELECT * FROM otp_codes WHERE email = ?').get(cleanEmail);
    const isUniversalDemo = DEMO_MODE && String(otp_code).trim() === '123456';

    if (!isUniversalDemo) {
      if (!otpRow) {
        return res.status(400).json({ error: 'Vui lòng bấm "Gửi mã OTP" về email trước!' });
      }
      if (Date.now() > otpRow.expires_at) {
        db.prepare('DELETE FROM otp_codes WHERE email = ?').run(cleanEmail);
        return res.status(400).json({ error: 'Mã OTP đã hết hạn! Vui lòng yêu cầu mã mới.' });
      }
      if (otpRow.attempts >= 5) {
        db.prepare('DELETE FROM otp_codes WHERE email = ?').run(cleanEmail);
        return res.status(400).json({ error: 'Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã mới!' });
      }

      const isMatch = bcrypt.compareSync(String(otp_code).trim(), otpRow.code_hash);
      if (!isMatch) {
        db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?').run(cleanEmail);
        const remaining = 5 - (otpRow.attempts + 1);
        return res.status(400).json({ error: `Mã OTP không chính xác! Bạn còn ${remaining} lần thử.` });
      }
    }
    db.prepare('DELETE FROM otp_codes WHERE email = ?').run(cleanEmail);
  } else {
    // Password authentication via bcrypt
    if (!password) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu đăng nhập!' });
    }

    const isDemoPassword = DEMO_MODE && password === '123456';
    let isPasswordCorrect = false;

    if (user.password && user.password.startsWith('$2')) {
      isPasswordCorrect = bcrypt.compareSync(password, user.password);
    } else if (user.password) {
      isPasswordCorrect = (user.password === password);
    }

    if (!isPasswordCorrect && !isDemoPassword) {
      return res.status(400).json({ error: 'Mật khẩu không chính xác! Hãy kiểm tra lại hoặc đăng nhập bằng mã OTP.' });
    }
  }

  let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(user.id);
  if (!wallet) {
    db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at) VALUES (?, 0, 0, 0, datetime('now'))").run(user.id);
    wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(user.id);
  }

  // Issue session cookie
  setSessionCookie(res, user);

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    campus: user.campus,
    student_code: user.student_code,
    rating_avg: user.rating_avg,
    avatar_url: user.avatar_url,
    eco_points: user.eco_points,
    co2_saved_kg: user.co2_saved_kg
  };

  res.json({
    success: true,
    user: safeUser,
    wallet,
    message: `Đăng nhập thành công! Chào mừng ${user.name} (${user.role})`
  });
});

// 4. Logout API - Clears session cookie
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('taketwo_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ success: true, message: 'Đã đăng xuất thành công!' });
});

// 5. Demo Account Switcher (Strictly available ONLY in DEMO_MODE)
app.post('/api/auth/demo-switch', (req, res) => {
  if (!DEMO_MODE) {
    return res.status(403).json({ error: 'Chức năng chuyển đổi tài khoản demo chỉ khả dụng khi DEMO_MODE=true!' });
  }

  const { user_id } = req.body;
  if (user_id === 'guest' || user_id === '0' || !user_id) {
    res.clearCookie('taketwo_token', { httpOnly: true, sameSite: 'lax' });
    return res.json({ success: true, user: null, message: 'Đã chuyển sang chế độ Khách (Guest)' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản người dùng demo!' });
  }

  setSessionCookie(res, user);
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(user.id);

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    campus: user.campus,
    student_code: user.student_code,
    rating_avg: user.rating_avg,
    avatar_url: user.avatar_url,
    eco_points: user.eco_points,
    co2_saved_kg: user.co2_saved_kg
  };

  res.json({
    success: true,
    user: safeUser,
    wallet: wallet || { available_balance: 0, escrow_balance: 0, boost_credits: 0 },
    message: `[Demo] Đã chuyển sang tài khoản: ${user.name} (${user.role})`
  });
});

// 6. Google SSO / Campus OAuth (Disabled in production or strictly blocked for ADMIN)
app.post('/api/auth/google', (req, res) => {
  if (!DEMO_MODE) {
    return res.status(403).json({ 
      error: 'Google SSO mô phỏng bị tắt ở môi trường Production. Cần tích hợp Google Identity Services với token verification ở server.' 
    });
  }

  const { email, name, avatar_url, campus, role } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email Google không hợp lệ!' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // SECURITY GUARD: Never allow logging in as ADMIN via Google SSO simulation
  if (cleanEmail === 'admin@taketwo.vn') {
    return res.status(403).json({ error: 'Bảo mật: Không được phép đăng nhập tài khoản Quản Trị Viên (Admin) bằng Google SSO mô phỏng!' });
  }

  let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  if (user && user.role === 'ADMIN') {
    return res.status(403).json({ error: 'Bảo mật: Không được phép đăng nhập tài khoản Quản Trị Viên (Admin) bằng Google SSO mô phỏng!' });
  }

  if (!user) {
    const userName = name || cleanEmail.split('@')[0];
    const userRole = (role === 'SELLER') ? 'SELLER' : 'BUYER';
    const userCampus = campus || 'Hòa Lạc';
    const userCode = 'SSO' + Math.floor(100000 + Math.random() * 900000);
    const userAvatar = avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userName)}`;
    const randomHash = bcrypt.hashSync(Math.random().toString(), 10);

    const result = db.prepare(`
      INSERT INTO users (name, email, password, role, campus, student_code, rating_avg, review_count, eco_points, co2_saved_kg, avatar_url, bonus_claimed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 5.0, 0, 100, 2.5, ?, 1, datetime('now'))
    `).run(userName, cleanEmail, randomHash, userRole, userCampus, userCode, userAvatar);

    const newUserId = result.lastInsertRowid;
    db.prepare(`
      INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at)
      VALUES (?, 100000, 0, 2, datetime('now'))
    `).run(newUserId);

    const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(newUserId);
    const vCode = 'PT-GOOGLE-' + Math.floor(100000 + Math.random() * 900000);
    db.prepare(`
      INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
      VALUES (?, 'BONUS', 'IN', ?, 'Google SSO Tân Sinh Viên', 100000, 0, 100000, 'GOOGLE-SSO', 'Đăng nhập Google SSO: Tặng +100.000đ vào Ví & 2 lượt đẩy tin VIP', datetime('now'))
    `).run(wallet.id, vCode);

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);
  }

  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(user.id);
  setSessionCookie(res, user);

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    campus: user.campus,
    student_code: user.student_code,
    rating_avg: user.rating_avg,
    avatar_url: user.avatar_url,
    eco_points: user.eco_points,
    co2_saved_kg: user.co2_saved_kg
  };

  res.json({
    success: true,
    user: safeUser,
    wallet,
    message: `Đăng nhập Google SSO thành công! Chào mừng ${user.name}`
  });
});

// 7. Upgrade / Switch User Role (Buyer <-> Seller ONLY for own account)
app.post('/api/users/upgrade-role', requireAuth, (req, res) => {
  const { role } = req.body;
  // Security: only allow toggling BUYER <-> SELLER, NEVER escalate to ADMIN
  const targetRole = (role === 'SELLER') ? 'SELLER' : 'BUYER';
  
  if (req.currentUser.role === 'ADMIN') {
    return res.status(400).json({ error: 'Tài khoản Quản trị viên (ADMIN) không chuyển đổi vai trò qua API này!' });
  }

  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(targetRole, req.currentUser.id);
  const updatedUser = db.prepare('SELECT id, name, email, role, campus, student_code, rating_avg, avatar_url, eco_points, co2_saved_kg FROM users WHERE id = ?').get(req.currentUser.id);

  // Update session cookie with new role
  setSessionCookie(res, updatedUser);

  res.json({
    success: true,
    user: updatedUser,
    message: `Đã chuyển đổi thành công sang vai trò: ${targetRole === 'SELLER' ? '🏪 Chủ Gian Hàng (SELLER)' : '👤 Người Mua (BUYER)'}`
  });
});

// 8. Delete / Take Down Product Listing (Admin or Seller of item)
app.post('/api/products/:id/delete', requireAuth, (req, res) => {
  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!prod) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  if (req.currentUser.role !== 'ADMIN' && req.currentUser.id !== prod.seller_id) {
    return res.status(403).json({ error: 'Chỉ Admin hoặc chính chủ gian hàng mới có quyền xóa bài đăng này!' });
  }

  db.prepare("DELETE FROM products WHERE id = ?").run(prod.id);
  res.json({ success: true, message: 'Đã gỡ bài đăng thành công khỏi Sàn!' });
});

// -------------------------------------------------------------
// PRODUCT LISTINGS APIS
// -------------------------------------------------------------
app.get('/api/products', (req, res) => {
  checkAutoConfirmations();
  const { category, campus, search, condition, status, seller_id } = req.query;

  let query = `
    SELECT p.*, c.name as category_name, c.icon as category_icon, 
           u.name as seller_name, u.email as seller_email, u.rating_avg as seller_rating, u.avatar_url as seller_avatar
    FROM products p
    JOIN categories c ON p.category_id = c.id
    JOIN users u ON p.seller_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (category && category !== 'all') {
    query += ' AND p.category_id = ?';
    params.push(category);
  }

  if (campus && campus !== 'all') {
    query += ' AND p.campus_cluster = ?';
    params.push(campus);
  }

  if (condition && condition !== 'all') {
    query += ' AND p.condition_level = ?';
    params.push(condition);
  }

  if (status && status !== 'all') {
    query += ' AND p.status = ?';
    params.push(status);
  } else if (!seller_id) {
    // By default on public feed, don't show HIDDEN
    query += " AND p.status != 'HIDDEN'";
  }

  if (seller_id) {
    query += ' AND p.seller_id = ?';
    params.push(seller_id);
  }

  if (search && search.trim() !== '') {
    query += ' AND (p.title LIKE ? OR p.defect_note LIKE ? OR p.meetup_location LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  // Sorting: Promoted first (is_promoted DESC), then newly bumped/created, then id
  query += ' ORDER BY p.is_promoted DESC, p.created_at DESC, p.id DESC';

  const products = db.prepare(query).all(...params);
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.icon as category_icon,
           u.name as seller_name, u.email as seller_email, u.rating_avg as seller_rating, 
           u.review_count as seller_reviews, u.campus as seller_campus, u.avatar_url as seller_avatar
    FROM products p
    JOIN categories c ON p.category_id = c.id
    JOIN users u ON p.seller_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  // Increment view counter naturally
  db.prepare('UPDATE products SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);

  res.json(product);
});

app.post('/api/products', requireAuth, (req, res) => {
  const { title, category_id, price, original_price, condition_level, defect_note, campus_cluster, meetup_location, image_url } = req.body;
  if (!title || !category_id || !price || !condition_level || !campus_cluster || !meetup_location) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ các thông tin bắt buộc' });
  }

  const defaultImg = image_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80';

  const result = db.prepare(`
    INSERT INTO products (
      seller_id, category_id, title, price, original_price, condition_level, defect_note,
      campus_cluster, meetup_location, image_url, status, is_promoted, bump_count, view_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', 0, 0, 1, datetime('now'))
  `).run(
    req.currentUser.id,
    category_id,
    title,
    parseInt(price, 10),
    original_price ? parseInt(original_price, 10) : null,
    condition_level,
    defect_note || 'Không có khuyết điểm đáng chú ý.',
    campus_cluster,
    meetup_location,
    defaultImg
  );

  res.json({ success: true, product_id: result.lastInsertRowid, message: 'Đăng tin thành công!' });
});

// -------------------------------------------------------------
// BUMP POST & PACKAGES APIS (1-Click Boost via Wallet)
// -------------------------------------------------------------
app.get('/api/bump-packages', (req, res) => {
  const packages = db.prepare('SELECT * FROM bump_packages ORDER BY price ASC').all();
  res.json(packages);
});

app.post('/api/products/:id/bump', requireAuth, (req, res) => {
  const productId = req.params.id;
  const { package_id } = req.body;

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  // Ownership verification: Only owner of product (or Admin) can bump
  if (req.currentUser.role !== 'ADMIN' && req.currentUser.id !== product.seller_id) {
    return res.status(403).json({ error: 'Chỉ chủ sở hữu sản phẩm mới có quyền đẩy bài này!' });
  }

  let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (!wallet) {
    db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at) VALUES (?, 0, 0, 0, datetime('now'))")
      .run(req.currentUser.id);
    wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  }

  let message = '';
  let newBal = wallet.available_balance;

  // Nếu có package_id cụ thể được truyền lên
  if (package_id) {
    const pkg = db.prepare('SELECT * FROM bump_packages WHERE id = ?').get(package_id);
    if (!pkg) return res.status(400).json({ error: 'Gói đẩy tin không hợp lệ' });

    if (wallet.available_balance < pkg.price) {
      return res.status(400).json({ 
        error: `Số dư ví không đủ (${wallet.available_balance.toLocaleString('vi-VN')}đ). Cần ${pkg.price.toLocaleString('vi-VN')}đ. Vui lòng nạp thêm tiền vào ví!` 
      });
    }

    newBal = wallet.available_balance - pkg.price;
    db.prepare("UPDATE wallets SET available_balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBal, wallet.id);

    const bumpVoucher = 'PC-BMP-' + Math.floor(100000 + Math.random() * 900000);
    db.prepare(`
      INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
      VALUES (?, 'BUMP_PAYMENT', 'OUT', ?, 'Ví TakeTwo', ?, ?, ?, ?, ?, datetime('now'))
    `).run(wallet.id, bumpVoucher, -pkg.price, wallet.available_balance, newBal, pkg.id, `Mua ${pkg.name} đẩy bài "${product.title.substring(0, 30)}..." (Trừ ví tức thì)`);

    const badge = pkg.has_badge_hot ? 'HOT' : (pkg.id === 'bump_pro' ? 'PRO' : null);
    db.prepare(`
      UPDATE products 
      SET is_promoted = 1, promoted_badge = ?, bump_count = bump_count + ?, created_at = datetime('now')
      WHERE id = ?
    `).run(badge, pkg.bump_credits, productId);

    message = `Đã đẩy bài thành công bằng ${pkg.name}! Bài viết đã được đưa lên Top 1.`;
  } else {
    // 1-Click Bump trực tiếp trên thẻ: ưu tiên trừ 1 lượt boost_credits
    if (wallet.boost_credits > 0) {
      const newCredits = wallet.boost_credits - 1;
      db.prepare("UPDATE wallets SET boost_credits = ?, updated_at = datetime('now') WHERE id = ?").run(newCredits, wallet.id);

      const bumpVoucher = 'PC-BMP-' + Math.floor(100000 + Math.random() * 900000);
      db.prepare(`
        INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
        VALUES (?, 'USE_BOOST', 'OUT', ?, 'Lượt Đẩy VIP', 0, ?, ?, 'BOOST', ?, datetime('now'))
      `).run(wallet.id, bumpVoucher, wallet.available_balance, wallet.available_balance, `Sử dụng 1 lượt đẩy bài VIP cho "${product.title.substring(0, 30)}..."`);

      db.prepare(`
        UPDATE products 
        SET is_promoted = 1, promoted_badge = 'HOT', bump_count = bump_count + 1, created_at = datetime('now')
        WHERE id = ?
      `).run(productId);

      message = `Đẩy bài thành công! Đã trừ 1 lượt đẩy VIP (Còn lại: ${newCredits} lượt). Bài viết đã nhảy lên vị trí Top 1!`;
    } else {
      // Nếu hết lượt, kiểm tra số dư ví 15.000đ
      if (wallet.available_balance < 15000) {
        return res.status(400).json({
          error: `Bạn đã hết lượt đẩy bài và số dư ví (${wallet.available_balance.toLocaleString('vi-VN')}đ) không đủ 15.000đ. Vui lòng nạp thêm tiền vào ví!`
        });
      }

      newBal = wallet.available_balance - 15000;
      db.prepare("UPDATE wallets SET available_balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBal, wallet.id);

      const bumpVoucher = 'PC-BMP-' + Math.floor(100000 + Math.random() * 900000);
      db.prepare(`
        INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
        VALUES (?, 'BUMP_PAYMENT', 'OUT', ?, 'Ví TakeTwo', -15000, ?, ?, 'bump_single', ?, datetime('now'))
      `).run(wallet.id, bumpVoucher, wallet.available_balance, newBal, `Trừ 15.000đ từ ví để đẩy bài "${product.title.substring(0, 30)}..." lên Top 1`);

      db.prepare(`
        UPDATE products 
        SET is_promoted = 1, promoted_badge = 'HOT', bump_count = bump_count + 1, created_at = datetime('now')
        WHERE id = ?
      `).run(productId);

      message = `Hết lượt VIP - Đã trừ 15.000đ từ Ví TakeTwo và đưa bài viết lên Top 1 thành công!`;
    }
  }

  res.json({
    success: true,
    message,
    remaining_balance: newBal
  });
});

// Mua gói đẩy bài trực tiếp (chỉ trừ tiền ví & cộng boost_credits, không thay đổi role của user)
app.post('/api/bump-packages/buy', requireAuth, (req, res) => {
  const { package_id } = req.body;
  const pkg = db.prepare('SELECT * FROM bump_packages WHERE id = ?').get(package_id);
  if (!pkg) return res.status(404).json({ error: 'Gói đẩy tin không hợp lệ' });

  let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (!wallet || wallet.available_balance < pkg.price) {
    return res.status(400).json({
      error: `Số dư ví không đủ (${wallet ? wallet.available_balance.toLocaleString('vi-VN') : 0}đ). Cần ${pkg.price.toLocaleString('vi-VN')}đ để mua gói. Vui lòng nạp thêm tiền vào ví!`
    });
  }

  const newBal = wallet.available_balance - pkg.price;
  const newCredits = (wallet.boost_credits || 0) + pkg.bump_credits;
  db.prepare("UPDATE wallets SET available_balance = ?, boost_credits = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newBal, newCredits, wallet.id);

  const bumpVoucher = 'PC-BMP-' + Math.floor(100000 + Math.random() * 900000);
  db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, 'BUY_BOOST', 'OUT', ?, 'Ví TakeTwo', ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    wallet.id,
    bumpVoucher,
    -pkg.price,
    wallet.available_balance,
    newBal,
    pkg.id,
    `Mua ${pkg.name} (+${pkg.bump_credits} lượt đẩy bài VIP)`
  );

  res.json({
    success: true,
    message: `Mua thành công ${pkg.name}! Nhận được +${pkg.bump_credits} lượt đẩy bài VIP.`,
    boost_credits: newCredits,
    remaining_balance: newBal
  });
});

// -------------------------------------------------------------
// WALLET & VIETQR TRANSACTION APIS
// -------------------------------------------------------------
// -------------------------------------------------------------
// WALLET & FINTAB THU CHI (TRANSACTIONS / DEPOSIT) APIS
// -------------------------------------------------------------
app.get('/api/wallet', requireAuth, (req, res) => {
  let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (!wallet) {
    db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, updated_at) VALUES (?, 0, 0, datetime('now'))")
      .run(req.currentUser.id);
    wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  }

  const transactions = db.prepare('SELECT * FROM wallet_transactions WHERE wallet_id = ? ORDER BY id DESC LIMIT 50')
    .all(wallet.id);

  res.json({
    wallet,
    transactions
  });
});

// Dedicated Fintab Thu Chi (Deposit / Transactions) Endpoint
function handleTransactionsLedger(req, res) {
  try {
    const user = req.currentUser;
    const { tab, search, view_all } = req.query;
    // Security: Only ADMIN can view global transactions
    const isGlobalView = view_all === 'true' && user.role === 'ADMIN';

    let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(user.id);
    if (!wallet) {
      wallet = { id: 0, available_balance: 0, escrow_balance: 0 };
    }

    let query = `
      SELECT wt.*, u.name as user_name, u.student_code as user_student_code, u.email as user_email
      FROM wallet_transactions wt
      JOIN wallets w ON wt.wallet_id = w.id
      JOIN users u ON w.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (!isGlobalView) {
      query += ' AND wt.wallet_id = ?';
      params.push(wallet.id);
    }

    if (tab === 'deposit') {
      query += " AND wt.flow_type = 'IN'";
    } else if (tab === 'payment') {
      query += " AND wt.flow_type = 'OUT'";
    } else if (tab === 'escrow') {
      query += " AND wt.flow_type = 'HOLD'";
    }

    if (search && search.trim() !== '') {
      query += " AND (wt.voucher_code LIKE ? OR wt.reference_id LIKE ? OR wt.description LIKE ?)";
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY wt.id DESC LIMIT 100';
    const items = db.prepare(query).all(...params);

    // Calculate summary totals
    let sumQuery = `SELECT 
      COALESCE(SUM(CASE WHEN flow_type = 'IN' THEN amount ELSE 0 END), 0) as total_in,
      COALESCE(SUM(CASE WHEN flow_type = 'OUT' THEN ABS(amount) ELSE 0 END), 0) as total_out
      FROM wallet_transactions wt WHERE 1=1`;
    const sumParams = [];
    if (!isGlobalView) {
      sumQuery += ' AND wt.wallet_id = ?';
      sumParams.push(wallet.id);
    }
    const sums = db.prepare(sumQuery).get(...sumParams);

    res.json({
      items,
      stats: {
        total_income: sums.total_in,
        total_expense: sums.total_out,
        available_balance: wallet.available_balance,
        escrow_balance: wallet.escrow_balance
      }
    });
  } catch (err) {
    console.error('Error in /api/transactions:', err);
    res.status(500).json({ error: err.message, items: [], stats: {} });
  }
}

app.get('/api/transactions', requireAuth, handleTransactionsLedger);
app.get('/api/ledger', requireAuth, handleTransactionsLedger);

app.post('/api/wallet/topup', requireAuth, (req, res) => {
  const { amount, bank_name } = req.body;
  const numAmount = parseInt(amount, 10);
  if (!numAmount || numAmount < 10000) {
    return res.status(400).json({ error: 'Số tiền nạp tối thiểu là 10.000 VNĐ' });
  }

  let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (!wallet) {
    db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at) VALUES (?, 0, 0, 0, datetime('now'))").run(req.currentUser.id);
    wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  }
  const newBal = wallet.available_balance + numAmount;

  db.prepare("UPDATE wallets SET available_balance = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newBal, wallet.id);

  const refCode = 'VQR-' + Math.floor(100000 + Math.random() * 900000);
  const voucherCode = 'PT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(10 + Math.random() * 90);

  db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, 'TOPUP', 'IN', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    wallet.id,
    voucherCode,
    `VietQR ${bank_name || 'MBBank'}`,
    numAmount,
    wallet.available_balance,
    newBal,
    refCode,
    `Nạp tiền vào ví TakeTwo qua VietQR ${bank_name || 'MBBank'}`
  );

  res.json({
    success: true,
    message: `Nạp thành công +${numAmount.toLocaleString('vi-VN')} VNĐ vào ví!`,
    voucher_code: voucherCode,
    new_balance: newBal
  });
});

app.post('/api/wallet/withdraw', requireAuth, (req, res) => {
  const { amount, bank_account, bank_name } = req.body;
  const numAmount = parseInt(amount, 10);
  if (!numAmount || numAmount < 20000) {
    return res.status(400).json({ error: 'Số tiền rút tối thiểu là 20.000 VNĐ' });
  }

  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (!wallet || wallet.available_balance < numAmount) {
    return res.status(400).json({ error: 'Số dư khả dụng không đủ để rút tiền' });
  }

  const newBal = wallet.available_balance - numAmount;
  db.prepare("UPDATE wallets SET available_balance = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newBal, wallet.id);

  const refCode = 'WDR-' + Math.floor(100000 + Math.random() * 900000);
  const voucherCode = 'PC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(10 + Math.random() * 90);

  db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, 'WITHDRAW', 'OUT', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    wallet.id,
    voucherCode,
    `STK ${bank_account || 'xxxx'} (${bank_name || 'Ngân hàng'})`,
    -numAmount,
    wallet.available_balance,
    newBal,
    refCode,
    `Rút tiền về STK ${bank_account || 'xxxx'} (${bank_name || 'Ngân hàng'}) - Hoàn tất tức thì`
  );

  res.json({
    success: true,
    message: `Rút tiền thành công! ${numAmount.toLocaleString('vi-VN')} VNĐ đã được chuyển về tài khoản ngân hàng của bạn.`,
    voucher_code: voucherCode,
    remaining_balance: newBal
  });
});

// -------------------------------------------------------------
// CHECKOUT & ESCROW ORDER APIS
// -------------------------------------------------------------
const handleOrderCheckout = (req, res) => {
  const { product_id, delivery_type, delivery_address, recipient_name, recipient_phone } = req.body;

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
  if (product.status !== 'AVAILABLE') {
    return res.status(400).json({ error: 'Sản phẩm này hiện đang được giữ chỗ hoặc đã bán' });
  }

  // Self-buy prevention
  if (product.seller_id === req.currentUser.id) {
    return res.status(400).json({ error: 'Bạn không thể tự mua sản phẩm do chính mình đăng bán' });
  }

  let shippingFee = 0;
  if (delivery_type === 'COURIER_EXPRESS') {
    shippingFee = 25000;
  } else if (delivery_type === 'COURIER_ROOM' || delivery_type === 'COURIER') {
    shippingFee = 15000;
  }
  const isCourier = shippingFee > 0;
  const discount = 5000; // 5k voucher for students
  const totalPaid = (product.price + shippingFee) - discount;

  // Check buyer wallet
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (!wallet || wallet.available_balance < totalPaid) {
    return res.status(400).json({
      error: `Số dư ví không đủ (hiện có ${wallet ? wallet.available_balance.toLocaleString('vi-VN') : 0}đ). Cần ${totalPaid.toLocaleString('vi-VN')}đ. Vui lòng nạp thêm tiền vào ví!`
    });
  }

  // Deduct from available balance, lock into escrow balance
  const newAvail = wallet.available_balance - totalPaid;
  const newEscrow = wallet.escrow_balance + totalPaid;
  db.prepare("UPDATE wallets SET available_balance = ?, escrow_balance = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newAvail, newEscrow, wallet.id);

  const orderCode = 'TK-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(10 + Math.random() * 90);

  // Log transaction
  const holdVoucher = 'PC-HLD-' + Math.floor(100000 + Math.random() * 900000);
  db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, 'ESCROW_HOLD', 'HOLD', ?, 'Ví TakeTwo Escrow', ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    wallet.id,
    holdVoucher,
    -totalPaid,
    wallet.available_balance,
    newAvail,
    orderCode,
    `Tạm giữ tiền mua "${product.title.substring(0, 30)}..." trong Két Escrow TakeTwo (An toàn 100%)`
  );

  // Lock product to RESERVED
  db.prepare("UPDATE products SET status = 'RESERVED' WHERE id = ?").run(product.id);

  // Create order
  const orderResult = db.prepare(`
    INSERT INTO orders (
      order_code, product_id, buyer_id, seller_id, amount, shipping_fee, discount, total_paid,
      delivery_type, delivery_address, recipient_name, recipient_phone, tracking_code,
      payment_method, status, escrow_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WALLET_ESCROW', 'REQUESTED', 'HELD', datetime('now'), datetime('now'))
  `).run(
    orderCode,
    product.id,
    req.currentUser.id,
    product.seller_id,
    product.price,
    shippingFee,
    discount,
    totalPaid,
    delivery_type,
    delivery_address || (isCourier ? 'KTX Trường' : product.meetup_location),
    recipient_name || req.currentUser.name,
    recipient_phone || '0987654321',
    isCourier ? ('TK-EXP-' + Math.floor(1000 + Math.random() * 9000)) : 'MEETUP-DIRECT'
  );

  res.json({
    success: true,
    order_id: orderResult.lastInsertRowid,
    order_code: orderCode,
    message: 'Thanh toán Escrow thành công! Tiền đang được bảo vệ an toàn trong két TakeTwo.'
  });
};

app.post('/api/orders/checkout', requireAuth, handleOrderCheckout);
app.post('/api/orders', requireAuth, handleOrderCheckout);

app.get('/api/orders', requireAuth, (req, res) => {
  checkAutoConfirmations();
  const { role } = req.query; // 'buyer', 'seller', or 'admin'

  let query = `
    SELECT o.*, p.title as product_title, p.image_url as product_image, p.price as product_price,
           b.name as buyer_name, b.email as buyer_email, b.student_code as buyer_student_code,
           s.name as seller_name, s.email as seller_email
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users b ON o.buyer_id = b.id
    JOIN users s ON o.seller_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (role === 'seller') {
    query += ' AND o.seller_id = ?';
    params.push(req.currentUser.id);
  } else if (role === 'buyer') {
    query += ' AND o.buyer_id = ?';
    params.push(req.currentUser.id);
  } else if (req.currentUser.role !== 'ADMIN') {
    // If not admin, see both my buying and selling
    query += ' AND (o.buyer_id = ? OR o.seller_id = ?)';
    params.push(req.currentUser.id, req.currentUser.id);
  }

  query += ' ORDER BY o.id DESC';
  const orders = db.prepare(query).all(...params);
  res.json(orders);
});

// Seller accepts order
app.post('/api/orders/:id/accept', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (order.seller_id !== req.currentUser.id && req.currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Bạn không có quyền duyệt đơn này' });
  }

  db.prepare("UPDATE orders SET status = 'ACCEPTED', seller_confirmed = 1, updated_at = datetime('now') WHERE id = ?")
    .run(order.id);

  res.json({ success: true, message: 'Đã chấp nhận đơn hàng. Vui lòng chuẩn bị và giao hàng!' });
});

// Seller ships order -> Triggers 5-day auto-confirm deadline
app.post('/api/orders/:id/ship', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (order.seller_id !== req.currentUser.id && req.currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Bạn không có quyền gửi đơn này' });
  }

  const { tracking_code } = req.body;
  const now = new Date();
  const deadline = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // exactly 5 days

  db.prepare(`
    UPDATE orders 
    SET status = 'DELIVERING', 
         shipped_at = ?, 
         auto_confirm_deadline = ?,
         tracking_code = COALESCE(?, tracking_code),
         updated_at = ?
    WHERE id = ?
  `).run(now.toISOString(), deadline.toISOString(), tracking_code || null, now.toISOString(), order.id);

  res.json({
    success: true,
    message: 'Đã cập nhật trạng thái gửi hàng! Đồng hồ bảo vệ 5 ngày đã được kích hoạt.'
  });
});

// Buyer confirms receipt & releases escrow funds to seller
app.post('/api/orders/:id/confirm', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (order.buyer_id !== req.currentUser.id && req.currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Chỉ người mua mới được bấm xác nhận hoàn tất' });
  }

  completeOrderFunds(order, 'COMPLETED');
  res.json({ success: true, message: 'Giao dịch hoàn tất thành công! Tiền đã được giải ngân cho người bán.' });
});

// Nút Demo Giảng viên: "⚡ Demo: Qua 5 ngày (Auto-confirm)"
app.post('/api/orders/:id/simulate-5days', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (order.status === 'COMPLETED' || order.status === 'COMPLETED_AUTO') {
    return res.status(400).json({ error: 'Đơn hàng này đã được hoàn tất trước đó rồi' });
  }

  console.log(`[DEMO FOR TEACHER] Simulating 5-day expiration for order ${order.order_code}...`);
  completeOrderFunds(order, 'COMPLETED_AUTO');

  res.json({
    success: true,
    message: `⚡ [DEMO] Giả lập thành công: Đã trôi qua 5 ngày không có khiếu nại! Tiền ${order.total_paid.toLocaleString('vi-VN')}đ đã tự động giải ngân cho Người bán.`
  });
});

// Buyer reports dispute
app.post('/api/orders/:id/dispute', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

  // Security check: Only the buyer of the order (or Admin) can dispute
  if (order.buyer_id !== req.currentUser.id && req.currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Chỉ người mua đơn hàng này mới có quyền gửi khiếu nại!' });
  }

  const { reason } = req.body;
  db.prepare(`
    UPDATE orders 
    SET status = 'DISPUTED', 
        dispute_reason = ?, 
        auto_confirm_deadline = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(reason || 'Hàng lỗi hoặc chưa nhận được đồ', order.id);

  res.json({
    success: true,
    message: 'Đã đóng băng đơn hàng và gửi khiếu nại tới Ban Quản Trị để đối soát xử lý!'
  });
});

// Admin resolves dispute (Refund Buyer OR Release Seller)
app.post('/api/orders/:id/admin-resolve', requireAdmin, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

  const { decision } = req.body; // 'REFUND_BUYER' or 'RELEASE_SELLER'

  if (decision === 'REFUND_BUYER') {
    // Return escrow funds to buyer available balance
    const buyerWallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(order.buyer_id);
    if (buyerWallet) {
      db.prepare("UPDATE wallets SET escrow_balance = escrow_balance - ?, available_balance = available_balance + ?, updated_at = datetime('now') WHERE id = ?")
        .run(order.total_paid, order.total_paid, buyerWallet.id);

      const refVoucher = 'PT-REF-' + Math.floor(100000 + Math.random() * 900000);
      db.prepare(`
        INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
        VALUES (?, 'REFUND', 'IN', ?, 'Két Escrow TakeTwo', ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        buyerWallet.id,
        refVoucher,
        order.total_paid,
        buyerWallet.available_balance,
        buyerWallet.available_balance + order.total_paid,
        order.order_code,
        `Hoàn tiền đơn khiếu nại ${order.order_code} về ví theo phán quyết của Admin`
      );
    }

    db.prepare("UPDATE orders SET status = 'CANCELLED', escrow_status = 'REFUNDED', updated_at = datetime('now') WHERE id = ?").run(order.id);
    db.prepare("UPDATE products SET status = 'AVAILABLE' WHERE id = ?").run(order.product_id);

    return res.json({ success: true, message: 'Đã hoàn lại 100% tiền tạm giữ cho Người mua!' });
  } else {
    // Decision is release to seller
    completeOrderFunds(order, 'COMPLETED');
    return res.json({ success: true, message: 'Đã bác bỏ khiếu nại và giải ngân tiền cho Người bán!' });
  }
});

// -------------------------------------------------------------
// ADMIN METRICS (5 Key Metrics - Admin Only)
// -------------------------------------------------------------
app.get('/api/admin/metrics', requireAdmin, (req, res) => {
  const verifiedTx = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as gmv FROM orders WHERE status IN ('COMPLETED', 'COMPLETED_AUTO')").get();
  const activeListings = db.prepare("SELECT COUNT(*) as count FROM products WHERE status = 'AVAILABLE'").get();
  const totalSellers = db.prepare('SELECT COUNT(DISTINCT seller_id) as count FROM products').get();
  const repeatSellers = db.prepare('SELECT COUNT(*) as count FROM (SELECT seller_id FROM products GROUP BY seller_id HAVING COUNT(*) >= 2)').get();
  const repeatRate = totalSellers.count > 0 ? Math.round((repeatSellers.count / totalSellers.count) * 100) : 0;
  const totalEscrowHeld = db.prepare('SELECT COALESCE(SUM(escrow_balance), 0) as total FROM wallets').get();

  res.json({
    north_star_verified_transactions: verifiedTx.count,
    gmv_completed: verifiedTx.gmv,
    active_real_listings: activeListings.count,
    repeat_seller_rate: repeatRate,
    escrow_held_pool: totalEscrowHeld.total,
    budget_cash_ledger: 30250000,
    platform_fee_collected: Math.round(verifiedTx.gmv * 0.03)
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 TakeTwo Marketplace V2.0 Server is LIVE!`);
    console.log(`📍 Web Interface: http://localhost:${PORT}`);
    console.log(`⚡ Native SQLite & In-app Escrow Wallet ready!`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
