const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const { db, dbPath, initDatabase } = require('./db');
const config = require('./config');
const { createMarketplace, BusinessError, money, code } = require('./services/marketplace');

// Environment & Security Configurations
function sessionSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const generated = require('node:crypto').randomBytes(32).toString('hex');
  if (dbPath === ':memory:') return generated;
  const filename = `${dbPath}.session-secret`;
  try { fs.writeFileSync(filename, generated, { encoding: 'utf8', flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const value = fs.readFileSync(filename, 'utf8').trim();
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('Khóa phiên local không hợp lệ. Kiểm tra file khóa hoặc đặt JWT_SECRET.');
  return value;
}
const JWT_SECRET = sessionSecret();
const DEMO_MODE = process.env.DEMO_MODE !== 'false'; // Defaults to true for university demo
const ALLOWED_CAMPUS_DOMAINS = [
  'fpt.edu.vn', 'fe.edu.vn', 'vnu.edu.vn', 'hust.edu.vn',
  'neu.edu.vn', 'ftu.edu.vn', 'ajc.edu.vn', 'hanu.edu.vn',
  'ptit.edu.vn', 'hau.edu.vn', 'tlu.edu.vn', 'hvnh.edu.vn',
  'hlu.edu.vn', 'utc.edu.vn', 'taketwo.vn'
];

// Initialize database schema and seeds
initDatabase();
const marketplace = createMarketplace(db);

const app = express();
app.locals.marketplace = marketplace;
app.locals.startScheduler = () => {
  marketplace.expire();
  const timer = setInterval(() => marketplace.expire(), 30000);
  return () => clearInterval(timer);
};
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Anti-caching middleware for API routes
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Reject malformed wire values before string methods or bindings
app.use('/api', (req, res, next) => {
  if (Object.values(req.query).some(value => typeof value !== 'string')) {
    return res.status(400).json({ error: 'Mỗi bộ lọc chỉ nhận một giá trị văn bản.' });
  }
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    if (req.body == null) req.body = {};
    if (typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Nội dung yêu cầu phải là một JSON object.' });
    }
    const textFields = [
      'email', 'password', 'name', 'login_type', 'campus', 'role', 'student_code',
      'title', 'category_id', 'condition_level', 'defect_note', 'campus_cluster',
      'meetup_location', 'image_url', 'delivery_type', 'delivery_address',
      'recipient_name', 'recipient_phone', 'tracking_code', 'reason', 'decision',
      'bank_account', 'bank_name', 'package_id', 'voucher_code', 'issue_type',
      'pickup_address', 'content', 'filename', 'data'
      , 'client_id', 'attachment_id', 'message_text', 'file_base64', 'file_name'
    ];
    if (textFields.some(key => req.body[key] !== undefined && req.body[key] !== null && typeof req.body[key] !== 'string')) {
      return res.status(400).json({ error: 'Trường văn bản không được chứa object, mảng hoặc giá trị số.' });
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Secure JWT Session Authentication Middleware
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
      req.currentUser = null;
    }
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập để thực hiện thao tác này!' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.currentUser) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập tài khoản Quản trị viên!' });
  }
  if (req.currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Bạn không có quyền quản trị viên (Admin only)!' });
  }
  next();
}

function setSessionCookie(res, user) {
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('taketwo_token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  return token;
}

// Controllers here are synchronous. Async I/O must finish before opening a financial transaction.
function post(route, ...handlers) {
  const handler = handlers.pop();
  app.post(route, ...handlers, (req, res, next) => {
    const send = res.json.bind(res);
    let payload;
    res.json = value => { payload = value; return res; };
    try {
      const execute = () => {
        const key = req.get('Idempotency-Key');
        const guarded = req.currentUser && key && /^\/api\/(wallet\/|orders|bump-packages|products\/\d+\/bump)/.test(req.path);
        const fingerprint = guarded ? require('node:crypto').createHash('sha256').update(req.path + JSON.stringify(req.body)).digest('hex') : null;
        if (guarded) {
          if (key.length > 100) throw new BusinessError(400, 'Mã yêu cầu quá dài.');
          const old = db.prepare('SELECT * FROM mutation_keys WHERE user_id = ? AND key = ?').get(req.currentUser.id, key);
          if (old) {
            if (old.fingerprint !== fingerprint) throw new BusinessError(409, 'Mã yêu cầu đã được dùng cho nội dung khác.');
            payload = JSON.parse(old.response); return;
          }
        }
        const result = handler(req, res);
        if (result && typeof result.then === 'function') throw new Error('Async controller must not run inside transaction.');
        if (res.statusCode >= 400) { const error = new Error('Rejected request'); error.payload = payload; throw error; }
        if (guarded) db.prepare('INSERT INTO mutation_keys (user_id, key, fingerprint, response) VALUES (?, ?, ?, ?)').run(req.currentUser.id, key, fingerprint, JSON.stringify(payload));
      };
      if (['/api/auth/login', '/api/upload'].includes(route)) execute();
      else marketplace.atomic(execute);
      res.json = send;
      send(payload);
    } catch (error) { res.json = send; if (error.payload) send(error.payload); else next(error); }
  });
}

function safeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function checkAutoConfirmations() { return marketplace.expire(); }

function requireDemo(req, res, next) {
  if (!DEMO_MODE) return res.status(403).json({ error: 'Dịch vụ thật chưa tích hợp. Thao tác này chỉ dùng trong chế độ mô phỏng.' });
  next();
}

require('./services/reports')({ app, db, requireAdmin });
const operations = require('./services/operations')({ app, post, db, market: marketplace, requireAuth, requireAdmin, config });

app.get('/api/config', (req, res) => res.json({ ...config, demo_mode: DEMO_MODE }));

// -------------------------------------------------------------
// USER & AUTH APIS
// -------------------------------------------------------------
app.get('/api/me', (req, res) => {
  if (!req.currentUser) {
    return res.json({
      user: null,
      wallet: { available_balance: 0, escrow_balance: 0, boost_credits: 0 },
      demo_mode: DEMO_MODE,
      isLoggedIn: false
    });
  }

  let wallet = db.prepare('SELECT available_balance, escrow_balance, boost_credits FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (!wallet) {
    db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at) VALUES (?, 0, 0, 0, datetime('now'))")
      .run(req.currentUser.id);
    wallet = { available_balance: 0, escrow_balance: 0, boost_credits: 0 };
  }

  res.json({
    user: safeUser(req.currentUser),
    wallet,
    demo_mode: DEMO_MODE,
    isLoggedIn: true
  });
});

app.get('/api/users', requireDemo, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, campus, student_code, rating_avg, avatar_url, eco_points, status FROM users ORDER BY id ASC').all();
  res.json(users);
});

post('/api/auth/send-otp', requireDemo, (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email sinh viên không hợp lệ!' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const existingUser = db.prepare('SELECT role FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  if (existingUser && existingUser.role === 'ADMIN') {
    return res.status(403).json({ error: 'Tài khoản Quản trị viên (Admin) không thể nhận mã OTP. Vui lòng đăng nhập bằng mật khẩu.' });
  }

  const domain = cleanEmail.split('@')[1];
  if (!ALLOWED_CAMPUS_DOMAINS.includes(domain)) {
    return res.status(400).json({
      error: `Email không thuộc các trường đại học hỗ trợ (${ALLOWED_CAMPUS_DOMAINS.slice(0, 5).join(', ')}...)`
    });
  }

  const otp = '123456';
  const hashedOtp = bcrypt.hashSync(otp, 8);
  const expiresAt = Date.now() + 5 * 60 * 1000;

  db.prepare(`
    INSERT INTO otp_codes (email, code_hash, expires_at, attempts, created_at)
    VALUES (?, ?, ?, 0, datetime('now'))
    ON CONFLICT(email) DO UPDATE SET
      code_hash = excluded.code_hash,
      expires_at = excluded.expires_at,
      attempts = 0,
      created_at = datetime('now')
  `).run(cleanEmail, hashedOtp, expiresAt);

  console.log(`[TakeTwo OTP] Generated a simulated verification code (expires in 5m).`);

  res.json({
    success: true,
    message: 'Mã xác thực OTP (mô phỏng) đã được tạo.',
    simulated_otp: otp,
    demo_otp: otp
  });
});

post('/api/auth/register', (req, res) => {
  const { email, password, name, campus, student_code } = req.body;
  const otp = req.body.otp || req.body.otp_code;
  const campusName = campus || 'Khu đô thị Hòa Lạc (ĐH FPT)';
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ các trường bắt buộc!' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const domain = cleanEmail.split('@')[1];
  if (!ALLOWED_CAMPUS_DOMAINS.includes(domain)) {
    return res.status(400).json({ error: 'Chỉ chấp nhận email sinh viên thuộc các trường đại học Hà Nội được hỗ trợ!' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có tối thiểu 6 ký tự!' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'Email này đã được đăng ký trong hệ thống TakeTwo!' });
  }

  if (!otp) {
    return res.status(400).json({ error: 'Vui lòng nhập mã xác thực OTP gửi về email!' });
  }

  const isUniversalDemo = DEMO_MODE && String(otp).trim() === '123456';
  if (!isUniversalDemo) {
    const record = db.prepare('SELECT * FROM otp_codes WHERE email = ?').get(cleanEmail);
    if (!record || Date.now() > record.expires_at) {
      return res.status(400).json({ error: 'Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng lấy mã mới!' });
    }
    if (record.attempts >= 5) {
      return res.status(429).json({ error: 'Đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã mới!' });
    }
    const match = bcrypt.compareSync(String(otp).trim(), record.code_hash);
    if (!match) {
      db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?').run(cleanEmail);
      return res.status(400).json({ error: 'Mã OTP không chính xác!' });
    }
  }
  db.prepare('DELETE FROM otp_codes WHERE email = ?').run(cleanEmail);

  const hashedPassword = bcrypt.hashSync(password, 10);
  const avatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';

  const userResult = db.prepare(`
    INSERT INTO users (name, email, password, role, campus, student_code, rating_avg, review_count, eco_points, co2_saved_kg, avatar_url, bonus_claimed, status, created_at)
    VALUES (?, ?, ?, 'BUYER', ?, ?, 5.0, 0, 100, 5.0, ?, 1, 'ACTIVE', datetime('now'))
  `).run(name, email.toLowerCase(), hashedPassword, campusName, student_code || '', avatar);

  const newUserId = userResult.lastInsertRowid;
  const initialBalance = 100000;
  const initialBoost = 1;

  db.prepare(`
    INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at)
    VALUES (?, ?, 0, ?, datetime('now'))
  `).run(newUserId, initialBalance, initialBoost);

  const newWallet = db.prepare('SELECT id FROM wallets WHERE user_id = ?').get(newUserId);
  db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, 'BONUS', 'IN', 'WELCOME-T2', 'Quà Chào Mừng TakeTwo', ?, 0, ?, 'NEW-USER-2026', 'Tặng 100.000đ & 1 lượt đẩy bài VIP chào mừng sinh viên mới gia nhập Sàn', datetime('now'))
  `).run(newWallet.id, initialBalance, initialBalance);
  marketplace.journal(`welcome:${newUserId}`, null, [['USER_AVAILABLE', newUserId, initialBalance], ['MOCK_FUNDING', 'platform', -initialBalance]]);
  db.prepare("UPDATE users SET verification_status='LOCAL_VERIFIED' WHERE id=?").run(newUserId);

  const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);
  setSessionCookie(res, newUser);

  res.json({
    success: true,
    user: safeUser(newUser),
    wallet: { available_balance: initialBalance, escrow_balance: 0, boost_credits: initialBoost },
    message: 'Chào mừng bạn đến với Sàn Pass Đồ Sinh Viên TakeTwo!'
  });
});

post('/api/auth/login', (req, res) => {
  const { email, password, login_type } = req.body;
  const otp_code = req.body.otp_code || req.body.otp;
  if (!email) {
    return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email!' });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);

  if (login_type === 'otp') {
    if (user && user.role === 'ADMIN') {
      return res.status(403).json({ error: 'Tài khoản Quản trị viên (Admin) bắt buộc phải đăng nhập bằng mật khẩu để bảo mật.' });
    }
    if (!otp_code) return res.status(400).json({ error: 'Vui lòng nhập mã OTP!' });
    const otpRow = db.prepare('SELECT * FROM otp_codes WHERE email = ?').get(cleanEmail);
    const isUniversalDemo = DEMO_MODE && String(otp_code).trim() === '123456';

    if (!isUniversalDemo) {
      if (!otpRow) return res.status(400).json({ error: 'Vui lòng bấm gửi mã OTP trước!' });
      if (Date.now() > otpRow.expires_at) {
        db.prepare('DELETE FROM otp_codes WHERE email = ?').run(cleanEmail);
        return res.status(400).json({ error: 'Mã OTP đã hết hạn!' });
      }
      if (otpRow.attempts >= 5) {
        db.prepare('DELETE FROM otp_codes WHERE email = ?').run(cleanEmail);
        return res.status(400).json({ error: 'Bạn đã nhập sai OTP quá 5 lần!' });
      }
      const isMatch = bcrypt.compareSync(String(otp_code).trim(), otpRow.code_hash);
      if (!isMatch) {
        const nextAttempt = otpRow.attempts + 1;
        if (nextAttempt > 5) {
          db.prepare('DELETE FROM otp_codes WHERE email = ?').run(cleanEmail);
        } else {
          db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?').run(cleanEmail);
        }
        return res.status(400).json({ error: 'Mã OTP không chính xác!' });
      }
    }
    db.prepare('DELETE FROM otp_codes WHERE email = ?').run(cleanEmail);
  } else {
    if (!password) return res.status(400).json({ error: 'Vui lòng nhập mật khẩu!' });
    if (!user) return res.status(400).json({ error: 'Email hoặc mật khẩu không chính xác!' });
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Mật khẩu không chính xác!' });
  }

  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  if (user.status === 'LOCKED') {
    return res.status(403).json({ error: `Tài khoản đang bị khóa: ${user.lock_reason || 'Vi phạm điều khoản'}` });
  }

  setSessionCookie(res, user);
  res.json({
    success: true,
    user: safeUser(user),
    is_admin: user.role === 'ADMIN',
    message: `Đăng nhập thành công! Chào mừng ${user.name}`
  });
});

post('/api/auth/logout', (req, res) => {
  res.clearCookie('taketwo_token', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ success: true, message: 'Đã đăng xuất thành công khỏi hệ thống!' });
});

post('/api/auth/demo-switch', requireDemo, (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Vui lòng chọn user_id demo!' });

  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  if (!targetUser) return res.status(404).json({ error: 'Tài khoản demo không tồn tại!' });

  setSessionCookie(res, targetUser);

  res.json({
    success: true,
    user: safeUser(targetUser),
    is_admin: targetUser.role === 'ADMIN',
    message: `Đã chuyển đổi sang tài khoản: ${targetUser.name} (${targetUser.role})`
  });
});

post('/api/auth/google', requireDemo, (req, res) => {
  const demoEmail = 'sinhvien.k20@fpt.edu.vn';
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(demoEmail);

  if (!user) {
    const defaultPassword = bcrypt.hashSync('Student@123', 10);
    const result = db.prepare(`
      INSERT INTO users (name, email, password, role, campus, student_code, rating_avg, review_count, eco_points, co2_saved_kg, avatar_url, bonus_claimed, status, created_at)
      VALUES ('Sinh Viên K20 (FPT Edu)', ?, ?, 'BUYER', 'Khu đô thị Hòa Lạc (ĐH FPT)', 'HE199999', 5.0, 0, 100, 5.0,
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80', 1, 'ACTIVE', datetime('now'))
    `).run(demoEmail, defaultPassword);

    const uid = result.lastInsertRowid;
    db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at) VALUES (?, 0, 0, 1, datetime('now'))").run(uid);
    marketplace.entry(marketplace.wallet(uid), 'BONUS', 'IN', 100000, `WELCOME-${uid}`, 'Quà chào mừng Google mô phỏng');
    marketplace.journal(`welcome:${uid}`, null, [['USER_AVAILABLE', uid, 100000], ['MOCK_FUNDING', 'platform', -100000]]);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  }

  setSessionCookie(res, user);

  res.json({
    success: true,
    user: safeUser(user),
    message: 'Đăng nhập Google Workspace sinh viên thành công!'
  });
});

post('/api/users/upgrade-role', requireAuth, (req, res) => {
  const { role } = req.body;
  const targetRole = (role === 'SELLER') ? 'SELLER' : 'BUYER';
  if (req.currentUser.role === 'ADMIN') {
    return res.status(400).json({ error: 'Tài khoản Quản trị viên (ADMIN) không chuyển đổi vai trò qua API này!' });
  }

  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(targetRole, req.currentUser.id);
  const updatedUser = db.prepare('SELECT id, name, email, role, campus, student_code, rating_avg, avatar_url, eco_points, co2_saved_kg FROM users WHERE id = ?').get(req.currentUser.id);
  setSessionCookie(res, updatedUser);

  res.json({
    success: true,
    user: updatedUser,
    message: `Đã chuyển đổi thành công sang vai trò: ${targetRole === 'SELLER' ? '🏪 Chủ Gian Hàng' : '👤 Người Mua'}`
  });
});

post('/api/products/:id/delete', requireAuth, (req, res) => {
  if (req.currentUser.role === 'ADMIN') throw new BusinessError(403, 'Admin ẩn tin qua kiểm duyệt, có lý do và nhật ký.');
  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!prod) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  if (req.currentUser.role !== 'ADMIN' && req.currentUser.id !== prod.seller_id) {
    return res.status(403).json({ error: 'Chỉ Admin hoặc chính chủ gian hàng mới có quyền xóa bài đăng này!' });
  }

  if (prod.status === 'RESERVED' || db.prepare("SELECT id FROM orders WHERE product_id = ? AND escrow_status = 'HELD'").get(prod.id)) {
    return res.status(409).json({ error: 'Không thể gỡ sản phẩm đang có tiền tạm giữ.' });
  }
  db.prepare("UPDATE products SET status = 'HIDDEN' WHERE id = ?").run(prod.id);
  res.json({ success: true, message: 'Đã gỡ bài đăng thành công khỏi Sàn!' });
});

// -------------------------------------------------------------
// PRODUCT LISTINGS APIS
// -------------------------------------------------------------
app.get('/api/products', (req, res) => {
  checkAutoConfirmations();
  db.prepare("UPDATE products SET is_promoted = 0, promoted_badge = NULL WHERE promoted_until IS NOT NULL AND promoted_until <= ?").run(new Date().toISOString());
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
  }

  const canSeeHidden = req.currentUser && (req.currentUser.role === 'ADMIN' || (seller_id && Number(seller_id) === req.currentUser.id));
  if (!canSeeHidden) {
    query += " AND p.status != 'HIDDEN' AND (p.approval_status = 'APPROVED' OR p.seller_id = ?)";
    params.push(req.currentUser ? req.currentUser.id : 0);
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
  if ((product.status === 'HIDDEN' || product.approval_status !== 'APPROVED') && req.currentUser?.id !== product.seller_id && req.currentUser?.role !== 'ADMIN') {
    return res.status(404).json({ error: 'Sản phẩm đã được gỡ.' });
  }

  db.prepare('UPDATE products SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);
  res.json(product);
});

post('/api/products', requireAuth, (req, res) => {
  if (req.currentUser.role === 'ADMIN') {
    return res.status(403).json({ error: 'Quản trị viên không được đăng bán hàng.' });
  }
  if (req.currentUser.status === 'LOCKED') {
    return res.status(403).json({ error: 'Tài khoản của bạn đang bị khóa.' });
  }

  const { title, category_id, price, original_price, condition_level, defect_note, campus_cluster, meetup_location, image_url } = req.body;
  if (!title || !category_id || !price || !condition_level || !campus_cluster) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ các thông tin bắt buộc (Tên, danh mục, giá, tình trạng, cụm trường)' });
  }

  money(price, config.min_product_price);
  if (original_price !== undefined && original_price !== '' && original_price !== null) money(original_price);
  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id)) throw new BusinessError(400, 'Danh mục không hợp lệ.');
  if (String(title).length > 200 || String(defect_note || '').length > 2000) throw new BusinessError(400, 'Tiêu đề tối đa 200 ký tự; mô tả tối đa 2.000 ký tự.');
  if (image_url && !/^(https?:\/\/|data:image\/(jpeg|png|webp);base64,|\/api\/attachments\/)/i.test(image_url)) {
    throw new BusinessError(400, 'Ảnh phải là URL hợp lệ hoặc ảnh JPEG/PNG/WebP.');
  }

  const defaultImg = image_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80';
  const approvalStatus = 'PENDING_APPROVAL';

  const result = db.prepare(`
    INSERT INTO products (
      seller_id, category_id, title, price, original_price, condition_level, defect_note,
      campus_cluster, meetup_location, image_url, status, approval_status, is_promoted, bump_count, view_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, 0, 0, 1, datetime('now'))
  `).run(
    req.currentUser.id,
    category_id,
    title,
    Number(price),
    original_price ? Number(original_price) : null,
    condition_level,
    defect_note || 'Không có khuyết điểm đáng chú ý.',
    campus_cluster,
    meetup_location || '',
    defaultImg,
    approvalStatus
  );

  res.json({
    success: true,
    product_id: result.lastInsertRowid,
    approval_status: approvalStatus,
    message: approvalStatus === 'APPROVED' ? 'Đăng tin thành công!' : 'Đã đăng bài thành công; bài viết đang chờ ban quản trị kiểm duyệt.'
  });
});

post('/api/products/:id/report', requireAuth, (req, res) => {
  if (req.currentUser.role === 'ADMIN') throw new BusinessError(403, 'Admin xử lý báo cáo trong cổng quản trị.');
  const { reason, description } = req.body;
  if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'Vui lòng chọn lý do báo cáo vi phạm.' });
  const prod = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!prod) return res.status(404).json({ error: 'Sản phẩm không tồn tại.' });

  db.prepare(`INSERT INTO listing_reports (product_id, reported_by, reason, description, status, created_at)
    VALUES (?, ?, ?, ?, 'PENDING', datetime('now'))`)
    .run(prod.id, req.currentUser.id, String(reason).slice(0, 100), String(description || '').slice(0, 500));

  res.json({ success: true, message: 'Đã gửi báo cáo vi phạm tới Ban Quản Trị. Cảm ơn bạn!' });
});

// -------------------------------------------------------------
// BUMP & PACKAGES
// -------------------------------------------------------------
app.get('/api/bump-packages', (req, res) => {
  res.json(db.prepare('SELECT * FROM bump_packages ORDER BY price ASC').all());
});

post('/api/products/:id/bump', requireAuth, (req, res) => {
  res.json(marketplace.boost(req.currentUser, req.params.id, req.body.package_id));
});

post('/api/bump-packages/buy', requireAuth, (req, res) => {
  res.json(marketplace.boost(req.currentUser, null, req.body.package_id, true));
});

// -------------------------------------------------------------
// WALLET & TRANSACTIONS
// -------------------------------------------------------------
app.get('/api/wallet', requireAuth, (req, res) => {
  let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (!wallet) {
    db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at) VALUES (?, 0, 0, 0, datetime('now'))").run(req.currentUser.id);
    wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  }
  const transactions = db.prepare('SELECT * FROM wallet_transactions WHERE wallet_id = ? ORDER BY id DESC LIMIT 50').all(wallet.id);
  res.json({ wallet, transactions });
});

function handleTransactionsLedger(req, res) {
  const { type, search, start_date, end_date, all } = req.query;
  const canViewAll = req.currentUser.role === 'ADMIN' && all === 'true';

  let query = `
    SELECT t.*, w.user_id, u.name as user_name, u.email as user_email, u.student_code as user_student_code
    FROM wallet_transactions t
    JOIN wallets w ON t.wallet_id = w.id
    JOIN users u ON w.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (!canViewAll) {
    query += ' AND w.user_id = ?';
    params.push(req.currentUser.id);
  }
  if (type && type !== 'all') {
    if (type === 'deposit') query += " AND t.flow_type = 'IN'";
    else if (type === 'payment') query += " AND t.flow_type = 'OUT'";
    else if (type === 'escrow') query += " AND t.flow_type = 'HOLD'";
    else { query += ' AND t.type = ?'; params.push(type); }
  }
  if (search && search.trim() !== '') {
    query += ' AND (t.voucher_code LIKE ? OR t.description LIKE ? OR t.reference_id LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }
  if (start_date) { query += ' AND t.created_at >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND t.created_at <= ?'; params.push(end_date + ' 23:59:59'); }

  query += ' ORDER BY t.id DESC LIMIT 100';
  const list = db.prepare(query).all(...params);

  let totalIncome = 0;
  let totalExpense = 0;
  for (const item of list) {
    if (item.flow_type === 'IN') totalIncome += Math.abs(item.amount);
    else if (item.flow_type === 'OUT') totalExpense += Math.abs(item.amount);
  }
  res.json({ transactions: list, total_income: totalIncome, total_expense: totalExpense });
}

app.get('/api/transactions', requireAuth, handleTransactionsLedger);
app.get('/api/ledger', requireAuth, handleTransactionsLedger);

post('/api/wallet/topup', requireAuth, requireDemo, (req, res) => res.json(marketplace.cash(req.currentUser, req.body)));
post('/api/wallet/withdraw', requireAuth, requireDemo, (req, res) => res.status(400).json({ error: 'Ví TakeTwo là ví dịch vụ đóng (Closed-loop Wallet). Hệ thống không hỗ trợ rút tiền về tài khoản ngân hàng hoặc quy đổi thành tiền mặt.' }));

// -------------------------------------------------------------
// CHECKOUT, QUOTE & VOUCHERS
// -------------------------------------------------------------
post('/api/checkout/quote', (req, res) => {
  res.json(marketplace.quote(req.currentUser, req.body));
});

app.get('/api/vouchers/available', (req, res) => {
  const campaigns = db.prepare(`
    SELECT code, title, description, discount_type, discount_value, max_discount, min_spend,
           target_audience, (budget - budget_used - budget_held) as remaining_budget
    FROM voucher_campaigns
    WHERE is_active = 1 AND (budget - budget_used - budget_held) > 0
    ORDER BY id ASC
  `).all();
  res.json(campaigns);
});

const handleOrderCheckout = (req, res) => res.json(marketplace.checkout(req.currentUser, req.body));
post('/api/orders/checkout', requireAuth, handleOrderCheckout);
post('/api/orders', requireAuth, handleOrderCheckout);

app.get('/api/orders', requireAuth, (req, res) => {
  checkAutoConfirmations();
  const { role } = req.query;

  let query = `
    SELECT o.*, p.title as product_title, p.image_url as product_image, p.price as product_price,
           b.name as buyer_name, b.email as buyer_email, b.student_code as buyer_student_code,
           s.name as seller_name, s.email as seller_email,
           (SELECT tracking_code FROM shipments sh WHERE sh.order_id = o.id) as courier_tracking_code,
           (SELECT status FROM shipments sh WHERE sh.order_id = o.id) as courier_status,
           (SELECT picked_up_at FROM shipments sh WHERE sh.order_id = o.id) as courier_picked_up_at,
           (SELECT delivered_at FROM shipments sh WHERE sh.order_id = o.id) as courier_delivered_at,
           (SELECT id FROM disputes d WHERE d.order_id = o.id) as dispute_id
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
    query += ' AND (o.buyer_id = ? OR o.seller_id = ?)';
    params.push(req.currentUser.id, req.currentUser.id);
  }

  query += ' ORDER BY o.id DESC';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare(`
    SELECT o.*, p.title as product_title, p.image_url as product_image, p.price as product_price, p.meetup_location as product_meetup_location,
           b.name as buyer_name, b.email as buyer_email, b.student_code as buyer_student_code,
           s.name as seller_name, s.email as seller_email, s.campus as seller_campus
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users b ON o.buyer_id = b.id
    JOIN users s ON o.seller_id = s.id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
  if (req.currentUser.role !== 'ADMIN' && req.currentUser.id !== order.buyer_id && req.currentUser.id !== order.seller_id) {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập đơn hàng này.' });
  }

  const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(order.id);
  const dispute = db.prepare('SELECT * FROM disputes WHERE order_id = ?').get(order.id);

  res.json({ order, shipment, dispute });
});

for (const [path, action] of [
  ['accept', 'accept'],
  ['ready-pickup', 'ready_pickup'],
  ['ship', 'ship'],
  ['confirm', 'confirm'],
  ['simulate-5days', 'simulate'],
  ['dispute', 'dispute'],
  ['cancel-requested', 'cancel_requested'],
  ['admin-resolve', 'resolve']
]) {
  post(`/api/orders/:id/${path}`, requireAuth, (req, res) => {
    if (action === 'dispute') req.body.evidence_images = operations.attachments(req.currentUser.id, req.body.evidence_images || []).map(id => `/api/attachments/${id}`);
    res.json(marketplace.transition(req.currentUser, req.params.id, action, req.body, DEMO_MODE));
  });
}

// -------------------------------------------------------------
// CHAT APIS (BUYER-SELLER BEFORE BUYING)
// -------------------------------------------------------------
post('/api/chat/conversations', requireAuth, (req, res) => {
  if (req.currentUser.role === 'ADMIN') return res.status(403).json({ error: 'Quản trị viên không tham gia chat trực tiếp.' });
  if (req.currentUser.status === 'LOCKED') return res.status(403).json({ error: 'Tài khoản đang bị khóa.' });

  const { product_id } = req.body;
  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!prod) return res.status(404).json({ error: 'Sản phẩm không tồn tại.' });
  if (prod.seller_id === req.currentUser.id) return res.status(400).json({ error: 'Bạn không thể chat với chính mình.' });

  let conv = db.prepare('SELECT * FROM chat_conversations WHERE product_id = ? AND buyer_id = ? AND seller_id = ?')
    .get(prod.id, req.currentUser.id, prod.seller_id);

  if (!conv) {
    if (prod.status !== 'AVAILABLE' || prod.approval_status !== 'APPROVED') return res.status(409).json({ error: 'Sản phẩm không còn mở hội thoại mới.' });
    const resConv = db.prepare(`INSERT INTO chat_conversations
      (product_id, buyer_id, seller_id, last_message_at, created_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))`)
      .run(prod.id, req.currentUser.id, prod.seller_id);
    conv = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(resConv.lastInsertRowid);
  }

  res.json({ success: true, id: conv.id, conversation: conv });
});

app.get('/api/chat/conversations', requireAuth, (req, res) => {
  const list = db.prepare(`
    SELECT c.*, p.title as product_title, p.price as product_price, p.image_url as product_image, p.status as product_status,
           b.name as buyer_name, b.avatar_url as buyer_avatar,
           s.name as seller_name, s.avatar_url as seller_avatar,
           (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.is_read = 0) as unread_count,
           (SELECT content FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message
    FROM chat_conversations c
    JOIN products p ON c.product_id = p.id
    JOIN users b ON c.buyer_id = b.id
    JOIN users s ON c.seller_id = s.id
    WHERE c.buyer_id = ? OR c.seller_id = ?
    ORDER BY c.last_message_at DESC, c.id DESC
  `).all(req.currentUser.id, req.currentUser.id, req.currentUser.id);
  res.json(list);
});

app.get('/api/chat/conversations/:id', requireAuth, (req, res) => {
  const conv = db.prepare(`
    SELECT c.*, p.title as product_title, p.price as product_price, p.image_url as product_image, p.status as product_status,
           b.name as buyer_name, s.name as seller_name
    FROM chat_conversations c
    JOIN products p ON c.product_id = p.id
    JOIN users b ON c.buyer_id = b.id
    JOIN users s ON c.seller_id = s.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!conv) return res.status(404).json({ error: 'Không tìm thấy cuộc hội thoại.' });
  if (req.currentUser.id !== conv.buyer_id && req.currentUser.id !== conv.seller_id) {
    return res.status(403).json({ error: 'Bạn không có quyền xem cuộc trò chuyện này.' });
  }

  db.prepare('UPDATE chat_messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?')
    .run(conv.id, req.currentUser.id);

  const messages = db.prepare(`
    SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar
    FROM chat_messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ? AND m.id < ?
    ORDER BY m.id DESC LIMIT 100
  `).all(conv.id, Number(req.query.before) > 0 ? Number(req.query.before) : Number.MAX_SAFE_INTEGER).reverse();

  const oldest = messages[0]?.id || null;
  const hasMore = oldest ? Boolean(db.prepare('SELECT 1 FROM chat_messages WHERE conversation_id = ? AND id < ?').get(conv.id, oldest)) : false;
  res.json({ conversation: conv, messages, has_more: hasMore, oldest_id: oldest });
});

post('/api/chat/conversations/:id/messages', requireAuth, (req, res) => {
  if (req.currentUser.role === 'ADMIN') return res.status(403).json({ error: 'Quản trị viên không gửi tin nhắn trực tiếp.' });
  if (req.currentUser.status === 'LOCKED') return res.status(403).json({ error: 'Tài khoản đang bị khóa.' });

  const conv = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Không tìm thấy cuộc hội thoại.' });
  if (req.currentUser.id !== conv.buyer_id && req.currentUser.id !== conv.seller_id) {
    return res.status(403).json({ error: 'Bạn không thuộc cuộc trò chuyện này.' });
  }

  const listing = db.prepare('SELECT status, approval_status FROM products WHERE id = ?').get(conv.product_id);
  const active = db.prepare("SELECT 1 FROM orders WHERE product_id = ? AND buyer_id = ? AND seller_id = ? AND escrow_status = 'HELD'").get(conv.product_id, conv.buyer_id, conv.seller_id);
  if ((listing.status !== 'AVAILABLE' || listing.approval_status !== 'APPROVED') && !active) throw new BusinessError(409, 'Hội thoại chỉ đọc vì sản phẩm không còn bán và không có đơn đang xử lý.');

  const content = String(req.body.content || req.body.message_text || '').trim();
  if (content.length > 4000) throw new BusinessError(400, 'Tin nhắn tối đa 4.000 ký tự.');
  if (req.body.client_id) {
    const prior = db.prepare('SELECT id FROM chat_messages WHERE conversation_id = ? AND sender_id = ? AND client_id = ?').get(conv.id, req.currentUser.id, String(req.body.client_id));
    if (prior) return res.json({ success: true, id: prior.id });
  }
  const attachmentId = req.body.attachment_id || null;
  let attachmentUrl = null;
  if (attachmentId) {
    const att = db.prepare('SELECT * FROM attachments WHERE id = ? AND uploaded_by = ?').get(attachmentId, req.currentUser.id);
    if (!att) throw new BusinessError(403, 'Không được sử dụng ảnh của người khác.');
    if (db.prepare('SELECT 1 FROM chat_messages WHERE attachment_id = ?').get(attachmentId)) throw new BusinessError(409, 'Ảnh đã được gắn với một tin nhắn.');
    attachmentUrl = `/api/attachments/${att.id}`;
  }


  if (!content && !attachmentId && !attachmentUrl) {
    return res.status(400).json({ error: 'Tin nhắn không được để trống.' });
  }

  const result = db.prepare(`INSERT INTO chat_messages
    (conversation_id, sender_id, content, attachment_id, attachment_url, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`)
    .run(conv.id, req.currentUser.id, content || 'Đã gửi một hình ảnh', attachmentId, attachmentUrl);

  db.prepare("UPDATE chat_conversations SET last_message_at = datetime('now') WHERE id = ?").run(conv.id);

  const msg = db.prepare(`SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar
    FROM chat_messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`).get(result.lastInsertRowid);

  if (req.body.client_id) db.prepare('UPDATE chat_messages SET client_id = ? WHERE id = ?').run(String(req.body.client_id).slice(0, 100), msg.id);
  res.json({ success: true, message: msg });
});

// -------------------------------------------------------------
// FILE UPLOAD & ATTACHMENT ACCESS
// -------------------------------------------------------------
post('/api/upload', requireAuth, (req, res) => {
  const data = req.body.data || req.body.file_base64;
  const filename = req.body.filename || req.body.file_name;
  if (!data || typeof data !== 'string') return res.status(400).json({ error: 'Dữ liệu file không hợp lệ.' });

  const match = data.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'Chỉ chấp nhận ảnh định dạng JPEG, PNG hoặc WebP.' });

  const mimeType = match[1];
  const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
  const buffer = Buffer.from(match[3], 'base64');
  if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Dung lượng file tối đa là 5 MB.' });

  const valid = mimeType === 'image/png' ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mimeType === 'image/jpeg' ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
    : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!valid || !buffer.length) return res.status(400).json({ error: 'Nội dung ảnh không khớp định dạng.' });
  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const fileId = require('node:crypto').randomUUID();
  const savedName = `${fileId}.${ext}`;
  const filePath = path.join(uploadDir, savedName);
  fs.writeFileSync(filePath, buffer);

  db.prepare(`INSERT INTO attachments (id, original_name, mime_type, size, file_path, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`)
    .run(fileId, String(filename || savedName).slice(0, 200), mimeType, buffer.length, filePath, req.currentUser.id);

  res.json({
    success: true,
    id: fileId,
    attachment_id: fileId,
    url: `/api/attachments/${fileId}`,
    filename: filename || savedName,
    mime_type: mimeType
  });
});

app.get('/api/attachments/:id', requireAuth, (req, res) => {
  const att = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Không tìm thấy file.' });
  const uid = req.currentUser.id;
  const chat = db.prepare(`SELECT 1 FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id WHERE m.attachment_id = ? AND (c.buyer_id = ? OR c.seller_id = ?)`).get(att.id, uid, uid);
  const cases = db.prepare(`SELECT d.*, o.buyer_id, o.seller_id FROM disputes d JOIN orders o ON o.id = d.order_id`).all();
  const caseAccess = cases.some(d => {
    if (req.currentUser.role !== 'ADMIN' && uid !== d.buyer_id && uid !== d.seller_id) return false;
    const text = [d.evidence_images, d.seller_evidence, ...db.prepare('SELECT attachment_ids FROM dispute_posts WHERE dispute_id = ?').all(d.id).map(p => p.attachment_ids)].join(' ');
    return text.includes(att.id);
  });
  if (att.uploaded_by !== uid && !chat && !caseAccess) return res.status(403).json({ error: 'Bạn không có quyền xem ảnh này.' });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!fs.existsSync(att.file_path)) return res.status(404).json({ error: 'File không tồn tại trên máy chủ.' });
  res.setHeader('Content-Type', att.mime_type);
  res.sendFile(att.file_path);
});

// -------------------------------------------------------------
// FAVORITES
// -------------------------------------------------------------
app.get('/api/favorites', requireAuth, (req, res) => {
  if (req.currentUser.role === 'ADMIN') return res.json([]);
  res.json(db.prepare(`SELECT p.*, u.name AS seller_name, u.rating_avg AS seller_rating, u.avatar_url AS seller_avatar,
    c.name AS category_name FROM favorites f JOIN products p ON p.id = f.product_id JOIN users u ON u.id = p.seller_id
    JOIN categories c ON c.id = p.category_id WHERE f.user_id = ? AND p.status != 'HIDDEN' ORDER BY f.created_at DESC`).all(req.currentUser.id));
});

app.put('/api/favorites/:id', requireAuth, (req, res) => {
  if (req.currentUser.role === 'ADMIN') return res.status(403).json({error:'Admin không sử dụng yêu thích.'});
  if (req.currentUser.role === 'ADMIN') return res.status(403).json({ error: 'Quản trị viên không dùng tính năng yêu thích.' });
  db.prepare('INSERT OR IGNORE INTO favorites (user_id, product_id, created_at) VALUES (?, ?, datetime(\'now\'))').run(req.currentUser.id, req.params.id);
  res.json({ success: true });
});

app.delete('/api/favorites/:id', requireAuth, (req, res) => {
  if (req.currentUser.role === 'ADMIN') return res.status(403).json({error:'Admin không sử dụng yêu thích.'});
  if (req.currentUser.role === 'ADMIN') return res.status(403).json({ error: 'Quản trị viên không dùng tính năng yêu thích.' });
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(req.currentUser.id, req.params.id);
  res.json({ success: true });
});

// -------------------------------------------------------------
// DEDICATED ADMIN PORTAL APIS (/api/admin/...)
// -------------------------------------------------------------
app.get('/api/admin/metrics', requireAdmin, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  const totalProducts = db.prepare("SELECT COUNT(*) AS count FROM products WHERE status != 'HIDDEN'").get().count;
  const totalOrders = db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
  const totalEscrow = db.prepare("SELECT COALESCE(SUM(total_paid), 0) AS total FROM orders WHERE escrow_status = 'HELD'").get().total;
  const totalCommissions = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM platform_entries WHERE type = 'COMMISSION'").get().total;
  const totalVoucherSubsidies = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM platform_entries WHERE type = 'VOUCHER_SUBSIDY'").get().total;

  res.json({
    total_users: totalUsers,
    total_products: totalProducts,
    total_orders: totalOrders,
    total_escrow_holding: totalEscrow,
    total_commission_earned: totalCommissions,
    total_voucher_subsidy: totalVoucherSubsidies,
    net_platform_revenue: totalCommissions + totalVoucherSubsidies
  });
});

app.get('/api/admin/shipments', requireAdmin, (req, res) => {
  const shipments = db.prepare(`
    SELECT sh.*, o.order_code, o.delivery_type, o.status as order_status,
           p.title as product_title, b.name as buyer_name, o.recipient_phone as buyer_phone, s.name as seller_name
    FROM shipments sh
    JOIN orders o ON sh.order_id = o.id
    JOIN products p ON o.product_id = p.id
    JOIN users b ON o.buyer_id = b.id
    JOIN users s ON o.seller_id = s.id
    ORDER BY sh.id DESC
  `).all();
  res.json(shipments);
});

app.get('/api/admin/escrow-audit', requireAdmin, (req, res) => {
  const heldOrders = db.prepare(`
    SELECT o.id, o.order_code, o.total_paid, o.delivery_type, o.status, o.shipped_at, o.auto_confirm_deadline,
           p.title as product_title, b.name as buyer_name, b.id as buyer_id, s.name as seller_name
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users b ON o.buyer_id = b.id
    JOIN users s ON o.seller_id = s.id
    WHERE o.escrow_status = 'HELD'
    ORDER BY o.id ASC
  `).all();

  // Integrity Check: Compare sum of escrow_balance in wallets with sum of held orders
  const walletSum = db.prepare('SELECT COALESCE(SUM(escrow_balance), 0) AS total FROM wallets').get().total;
  const orderSum = db.prepare("SELECT COALESCE(SUM(total_paid), 0) AS total FROM orders WHERE escrow_status = 'HELD'").get().total;
  const discrepancy = walletSum - orderSum;

  const now = Date.now();
  const enriched = heldOrders.map(o => {
    let hoursRemaining = null;
    let isUrgent = false;
    let isOverdue = false;
    if (o.auto_confirm_deadline) {
      const deadlineMs = new Date(o.auto_confirm_deadline).getTime();
      hoursRemaining = Math.max(0, Math.round((deadlineMs - now) / 3600000));
      if (hoursRemaining <= 24 && hoursRemaining > 0) isUrgent = true;
      if (deadlineMs <= now) isOverdue = true;
    }
    return {
      ...o,
      hours_remaining: hoursRemaining,
      is_urgent: isUrgent,
      is_overdue: isOverdue,
      is_balanced: db.prepare('SELECT escrow_balance FROM wallets WHERE user_id = ?').get(o.buyer_id).escrow_balance === db.prepare("SELECT COALESCE(SUM(total_paid),0) n FROM orders WHERE buyer_id = ? AND escrow_status = 'HELD'").get(o.buyer_id).n,
      is_frozen: o.status === 'DISPUTED'
    };
  });

  res.json({
    held_orders: enriched,
    wallet_escrow_sum: walletSum,
    order_escrow_sum: orderSum,
    is_balanced: discrepancy === 0 && enriched.every(o => o.is_balanced),
    discrepancy
  });
});

app.get('/api/admin/disputes', requireAdmin, (req, res) => {
  const disputes = db.prepare(`
    SELECT d.*, o.order_code, o.amount, o.shipping_fee, o.discount, o.total_paid, o.status as order_status,
           p.title as product_title, p.price as product_price,
           b.name as buyer_name, s.name as seller_name
    FROM disputes d
    JOIN orders o ON d.order_id = o.id
    JOIN products p ON o.product_id = p.id
    JOIN users b ON d.opened_by = b.id
    JOIN users s ON o.seller_id = s.id
    ORDER BY CASE WHEN d.status = 'RESOLVED' THEN 1 ELSE 0 END, d.created_at ASC
  `).all();
  res.json(disputes);
});

app.get('/api/admin/disputes/:id', requireAdmin, (req, res) => {
  const dispute = db.prepare(`
    SELECT d.*, o.order_code, o.amount, o.shipping_fee, o.discount, o.total_paid, o.delivery_type, o.status as order_status,
           p.id as product_id, p.title as product_title, p.price as product_price, p.image_url as product_image,
           b.id as buyer_id, b.name as buyer_name, b.email as buyer_email,
           s.id as seller_id, s.name as seller_name, s.email as seller_email,
           r.name as resolver_name
    FROM disputes d
    JOIN orders o ON d.order_id = o.id
    JOIN products p ON o.product_id = p.id
    JOIN users b ON d.opened_by = b.id
    JOIN users s ON o.seller_id = s.id
    LEFT JOIN users r ON d.resolved_by = r.id
    WHERE d.id = ?
  `).get(req.params.id);

  if (!dispute) return res.status(404).json({ error: 'Không tìm thấy hồ sơ khiếu nại.' });

  const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(dispute.order_id);
  const conv = db.prepare('SELECT id FROM chat_conversations WHERE product_id = ? AND buyer_id = ? AND seller_id = ?')
    .get(dispute.product_id, dispute.buyer_id, dispute.seller_id);
  let messages = [];
  if (conv) {
    messages = db.prepare('SELECT m.*, u.name as sender_name FROM chat_messages m JOIN users u ON m.sender_id = u.id WHERE m.conversation_id = ? ORDER BY m.id ASC')
      .all(conv.id);
  }

  // Financial preview
  const commission = Math.round(dispute.amount * config.commission_rate);
  const potentialFeeRetained = Math.min(commission, dispute.total_paid);
  const refundToBuyer = dispute.total_paid - potentialFeeRetained;
  const sellerPayout = dispute.amount - commission;
  const courierFeeIncurred = shipment?.picked_up_at ? shipment.fee_payable : 0;

  operations.audit(req.currentUser.id, 'VIEW_DISPUTE', 'DISPUTE', dispute.id, 'Đọc hồ sơ và lịch sử chat theo vụ việc');
  res.json({
    posts: db.prepare('SELECT p.*, u.name AS author_name FROM dispute_posts p JOIN users u ON u.id = p.author_id WHERE dispute_id = ? ORDER BY p.id').all(dispute.id),
    dispute,
    shipment,
    chat_messages: messages,
    financial_preview: {
      commission,
      potential_fee_retained: potentialFeeRetained,
      refund_to_buyer: refundToBuyer,
      seller_payout: sellerPayout,
      courier_fee_incurred: courierFeeIncurred,
      platform_net_on_release: commission - dispute.discount,
      platform_net_on_refund: potentialFeeRetained - courierFeeIncurred
    }
  });
});

post('/api/admin/disputes/:id/review', requireAdmin, (req, res) => {
  const dossier = db.prepare('SELECT * FROM disputes WHERE id = ?').get(req.params.id);
  if (!dossier) throw new BusinessError(404, 'Không tìm thấy hồ sơ.');
  if (dossier.status === 'RESOLVED') throw new BusinessError(409, 'Hồ sơ đã kết thúc.');
  db.prepare('UPDATE disputes SET reviewed_by = ? WHERE id = ?').run(req.currentUser.id, dossier.id);
  db.prepare("UPDATE disputes SET stage = 'REVIEWING' WHERE id = ?").run(dossier.id);
  db.prepare("UPDATE disputes SET admin_reviewed = 1, status = 'UNDER_REVIEW', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true, message: 'Đã đánh dấu đã thẩm định hồ sơ khiếu nại.' });
});

post('/api/admin/disputes/:id/resolve', requireAdmin, (req, res) => {
  const { decision, reason } = req.body;
  if (!['RELEASE_SELLER', 'REFUND_BUYER'].includes(decision)) {
    return res.status(400).json({ error: 'Quyết định không hợp lệ (Phải là RELEASE_SELLER hoặc REFUND_BUYER).' });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập lý do và căn cứ quyết định giải quyết khiếu nại.' });
  }

  const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(req.params.id);
  if (!dispute) return res.status(404).json({ error: 'Không tìm thấy hồ sơ khiếu nại.' });

  if (!dispute.admin_reviewed) throw new BusinessError(409, 'Cần thẩm định bằng chứng trước khi quyết định.');
  const result = marketplace.transition(req.currentUser, dispute.order_id, 'resolve', { decision, reason });
  res.json(result);
});

// Admin Users Management
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.campus, u.student_code, u.status, u.lock_reason, u.warning_count, u.verification_status,
           u.created_at, w.available_balance, w.escrow_balance,
           (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id OR o.seller_id = u.id) as order_count,
           (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id) as product_count
    FROM users u
    LEFT JOIN wallets w ON u.id = w.user_id
    ORDER BY u.id ASC
  `).all();
  res.json(users);
});

post('/api/admin/users/:id/status', requireAdmin, (req, res) => {
  const { status, reason } = req.body;
  if (!String(reason || '').trim()) throw new BusinessError(400, 'Khóa hoặc mở khóa đều phải có lý do.');
  if (!['ACTIVE', 'LOCKED'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
  if (status === 'LOCKED' && (!reason || !String(reason).trim())) {
    return res.status(400).json({ error: 'Vui lòng nhập lý do khóa tài khoản.' });
  }

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
  if (target.role === 'ADMIN') return res.status(400).json({ error: 'Không thể khóa tài khoản Quản trị viên.' });

  db.prepare("UPDATE users SET status = ?, lock_reason = ? WHERE id = ?")
    .run(status, status === 'LOCKED' ? String(reason).slice(0, 500) : null, target.id);

  db.prepare(`INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, created_at)
    VALUES (?, 'CHANGE_USER_STATUS', 'USER', ?, ?, datetime('now'))`)
    .run(req.currentUser.id, String(target.id), `Chuyển trạng thái người dùng sang ${status}: ${reason || ''}`);

  if (status === 'LOCKED') db.prepare("UPDATE products SET status = 'HIDDEN' WHERE seller_id = ? AND status = 'AVAILABLE'").run(target.id);
  res.json({ success: true, message: `Đã ${status === 'LOCKED' ? 'khóa' : 'mở khóa'} tài khoản thành công.` });
});

post('/api/admin/users/:id/warn', requireAdmin, (req, res) => {
  const { reason } = req.body;
  if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'Vui lòng nhập lý do cảnh cáo.' });

  db.prepare('UPDATE users SET warning_count = warning_count + 1 WHERE id = ?').run(req.params.id);
  db.prepare(`INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, created_at)
    VALUES (?, 'WARN_USER', 'USER', ?, ?, datetime('now'))`)
    .run(req.currentUser.id, req.params.id, String(reason).slice(0, 500));

  res.json({ success: true, message: 'Đã gửi cảnh cáo tới người dùng.' });
});

// Admin Product Moderation
app.get('/api/admin/products', requireAdmin, (req, res) => {
  const { approval_status } = req.query;
  let query = `
    SELECT p.*, c.name as category_name, u.name as seller_name, u.email as seller_email
    FROM products p
    JOIN categories c ON p.category_id = c.id
    JOIN users u ON p.seller_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (approval_status && approval_status !== 'all') {
    query += ' AND p.approval_status = ?';
    params.push(approval_status);
  }
  query += ' ORDER BY p.id DESC';
  res.json(db.prepare(query).all(...params));
});

post('/api/admin/products/:id/approve', requireAdmin, (req, res) => {
  const target = db.prepare('SELECT p.*, u.status AS seller_status FROM products p JOIN users u ON u.id = p.seller_id WHERE p.id = ?').get(req.params.id);
  if (!target) throw new BusinessError(404, 'Không tìm thấy sản phẩm.');
  if (target.seller_status === 'LOCKED') throw new BusinessError(409, 'Người bán đang bị khóa.');
  operations.audit(req.currentUser.id, 'APPROVE_PRODUCT', 'PRODUCT', target.id, 'Duyệt tin');
  db.prepare("UPDATE products SET approval_status = 'APPROVED', status = CASE WHEN status = 'HIDDEN' THEN 'AVAILABLE' ELSE status END, approved_by = ? WHERE id = ?")
    .run(req.currentUser.id, req.params.id);
  res.json({ success: true, message: 'Đã duyệt sản phẩm thành công!' });
});

post('/api/admin/products/:id/reject', requireAdmin, (req, res) => {
  const { reason } = req.body;
  db.prepare("UPDATE products SET approval_status = 'REJECTED', rejection_reason = ?, approved_by = ? WHERE id = ?")
    .run(String(reason || 'Nội dung không phù hợp').slice(0, 500), req.currentUser.id, req.params.id);
  res.json({ success: true, message: 'Đã từ chối duyệt bài đăng.' });
});

post('/api/admin/products/:id/hide', requireAdmin, (req, res) => {
  const { reason } = req.body;
  if (!String(reason || '').trim()) throw new BusinessError(400, 'Cần nhập lý do ẩn tin.');
  const target = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!target) throw new BusinessError(404, 'Không tìm thấy tin.');
  if (target.status === 'RESERVED') throw new BusinessError(409, 'Tin đang giữ tiền; xử lý qua đơn hoặc tranh chấp.');
  db.prepare("UPDATE products SET status = 'HIDDEN' WHERE id = ?").run(req.params.id);
  db.prepare(`INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, created_at)
    VALUES (?, 'HIDE_PRODUCT', 'PRODUCT', ?, ?, datetime('now'))`)
    .run(req.currentUser.id, req.params.id, String(reason || 'Admin gỡ tin').slice(0, 500));
  res.json({ success: true, message: 'Đã ẩn sản phẩm khỏi Sàn.' });
});

// Admin Reports
app.get('/api/admin/reports', requireAdmin, (req, res) => {
  const reports = db.prepare(`
    SELECT r.*, p.title as product_title, p.price as product_price, p.status as product_status,
           u.name as reporter_name, s.name as seller_name
    FROM listing_reports r
    JOIN products p ON r.product_id = p.id
    JOIN users u ON r.reported_by = u.id
    JOIN users s ON p.seller_id = s.id
    ORDER BY r.id DESC
  `).all();
  res.json(reports);
});

post('/api/admin/reports/:id/resolve', requireAdmin, (req, res) => {
  const { action } = req.body;
  if (!['DISMISS', 'HIDE_PRODUCT'].includes(action)) throw new BusinessError(400, 'Thao tác không hợp lệ.');
  const rep = db.prepare('SELECT * FROM listing_reports WHERE id = ?').get(req.params.id);
  if (!rep) return res.status(404).json({ error: 'Không tìm thấy báo cáo.' });

  if (rep.status !== 'PENDING') throw new BusinessError(409, 'Báo cáo đã được xử lý.');
  operations.audit(req.currentUser.id, 'RESOLVE_REPORT', 'REPORT', rep.id, String(req.body.reason || action));
  if (action === 'HIDE_PRODUCT') {
    if (db.prepare("SELECT 1 FROM orders WHERE product_id = ? AND escrow_status = 'HELD'").get(rep.product_id)) throw new BusinessError(409, 'Sản phẩm có đơn giữ tiền; cần xử lý tranh chấp trước.');
    db.prepare("UPDATE products SET status = 'HIDDEN' WHERE id = ?").run(rep.product_id);
  }
  db.prepare("UPDATE listing_reports SET status = 'REVIEWED', resolution_action = ?, resolved_by = ?, resolved_at = datetime('now') WHERE id = ?")
    .run(action, req.currentUser.id, rep.id);

  res.json({ success: true, message: 'Đã xử lý báo cáo vi phạm!' });
});

// Admin Voucher Campaigns
app.get('/api/admin/vouchers', requireAdmin, (req, res) => {
  const list = db.prepare('SELECT * FROM voucher_campaigns ORDER BY id DESC').all();
  res.json(list);
});

post('/api/admin/vouchers/:id/toggle', requireAdmin, (req, res) => {
  const v = db.prepare('SELECT * FROM voucher_campaigns WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Không tìm thấy chiến dịch voucher.' });
  const newState = v.is_active ? 0 : 1;
  db.prepare('UPDATE voucher_campaigns SET is_active = ? WHERE id = ?').run(newState, v.id);
  res.json({ success: true, is_active: newState, message: `Đã ${newState ? 'bật' : 'tắt'} chiến dịch voucher.` });
});

// -------------------------------------------------------------
// 404 & ERROR HANDLING
// -------------------------------------------------------------
app.use('/api', (req, res) => res.status(404).json({ error: 'API không tồn tại.' }));

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON không hợp lệ.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Nội dung gửi lên vượt giới hạn.' });
  if (error instanceof BusinessError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error('[API Unhandled Error]', error);
  res.status(500).json({ error: 'Đã có lỗi hệ thống xảy ra trên server TakeTwo!' });
});

// Startup scheduler
marketplace.expire();

if (require.main === module) {
  let stopScheduler;
  const server = app.listen(PORT, HOST, error => {
    if (error) {
      console.error(`Không thể mở cổng ${PORT}: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    stopScheduler = app.locals.startScheduler();
    console.log(`===================================================`);
    console.log(`♻️  TAKETWO SERVER 2.0 (HANOI STUDENT C2C ESCROW)  `);
    console.log(`🚀 Local URL: http://${HOST}:${PORT}                 `);
    console.log(`📦 Database: ${process.env.TAKETWO_DB_PATH || 'Local SQLite'} `);
    console.log(`👤 Admin Portal: http://${HOST}:${PORT}/admin.html    `);
    console.log(`===================================================`);
  });
  server.on('close', () => stopScheduler?.());
}

module.exports = app;
