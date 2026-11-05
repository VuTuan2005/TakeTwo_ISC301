const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// 1. app.locals
if (!s.includes('startScheduler')) {
  s = s.replace(
    'app.locals.marketplace = marketplace;',
    `app.locals.marketplace = marketplace;
app.locals.startScheduler = () => {
  marketplace.expire();
  const timer = setInterval(() => marketplace.expire(), 60000);
  return () => clearInterval(timer);
};`
  );
}

// 2. post() execute condition
s = s.replace(
  "if (route === '/api/auth/login' || route === '/api/auth/register' || route === '/api/upload')",
  "if (route === '/api/auth/login' || route === '/api/upload')"
);

// 3. /api/auth/login handler
const oldLogin = `post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu!' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác!' });
  }

  if (user.status === 'LOCKED') {
    return res.status(403).json({ error: \`Tài khoản của bạn đang bị khóa. Lý do: \${user.lock_reason || 'Vi phạm điều khoản dịch vụ'}\` });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác!' });
  }

  setSessionCookie(res, user);

  res.json({
    success: true,
    user: safeUser(user),
    is_admin: user.role === 'ADMIN',
    message: \`Đăng nhập thành công! Chào mừng \${user.name}\`
  });
});`;

const newLogin = `post('/api/auth/login', (req, res) => {
  const { email, password, otp_code, login_type } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email!' });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);

  if (login_type === 'otp') {
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
    return res.status(403).json({ error: \`Tài khoản đang bị khóa: \${user.lock_reason || 'Vi phạm điều khoản'}\` });
  }

  setSessionCookie(res, user);
  res.json({
    success: true,
    user: safeUser(user),
    is_admin: user.role === 'ADMIN',
    message: \`Đăng nhập thành công! Chào mừng \${user.name}\`
  });
});`;

if (s.includes("const { email, password } = req.body;")) {
  s = s.replace(oldLogin, newLogin);
}

fs.writeFileSync('server.js', s);
console.log('server.js patched successfully');

