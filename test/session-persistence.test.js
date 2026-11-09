const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('password session stays valid when the local server restarts with the same database', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'taketwo-session-'));
  const dbPath = path.join(folder, 'session.db');
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', TAKETWO_DB_PATH: dbPath, DEMO_MODE: 'true' };
  delete env.JWT_SECRET;
  let child;
  const base = `http://127.0.0.1:${port}`;
  async function start() {
    child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let errors = '';
    child.stderr.on('data', chunk => { errors += chunk; });
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server stopped during startup: ${errors}`);
      try { if ((await fetch(base + '/api/config')).ok) return; } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Server did not start: ${errors}`);
  }
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill();
    await exited;
  }
  try {
    await start();
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'tuanvhhe194875@fpt.edu.vn', password: 'Student@123', login_type: 'password' }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    await stop();
    await start();
    const me = await (await fetch(base + '/api/me', { headers: { cookie } })).json();
    assert.equal(me.isLoggedIn, true);
    assert.equal(me.user.email, 'tuanvhhe194875@fpt.edu.vn');
    assert.equal(me.wallet.available_balance, 250000);
    assert.equal(fs.existsSync(`${dbPath}.session-secret`), true);
  } finally {
    await stop();
    const resolved = path.resolve(folder);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('taketwo-session-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
