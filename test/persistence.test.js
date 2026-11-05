const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

test('migration backs up existing DB; empty catalog never resets existing users', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'taketwo-persist-'));
  const filename = path.join(folder, 'demo.db');
  const env = { ...process.env, TAKETWO_DB_PATH: filename };
  const run = expression => {
    const result = spawnSync(process.execPath, ['-e', expression], { cwd: path.join(__dirname, '..'), env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    run("const {db,initDatabase}=require('./db');initDatabase();db.exec(\"DELETE FROM journal_lines; DELETE FROM journals; DELETE FROM wallet_transactions; DELETE FROM orders; DELETE FROM products; UPDATE users SET name='Saved User' WHERE id=1; PRAGMA user_version=0;\");db.close();");
    run("const {db,initDatabase}=require('./db');initDatabase();db.close();");
    const saved = new DatabaseSync(filename);
    assert.equal(saved.prepare('SELECT COUNT(*) AS n FROM products').get().n, 0);
    assert.equal(saved.prepare('SELECT name FROM users WHERE id=1').get().name, 'Saved User');
    saved.close();
    assert.equal(fs.readdirSync(path.join(folder, 'backups')).length, 1);
    run("const {db,initDatabase,backupDatabase}=require('./db');backupDatabase();initDatabase(true);db.close();");
    const reset = new DatabaseSync(filename);
    assert.equal(reset.prepare('SELECT COUNT(*) AS n FROM products').get().n, 50);
    assert.equal(reset.prepare('SELECT escrow_balance FROM wallets WHERE user_id=4').get().escrow_balance, 0);
    reset.close();
    assert.equal(fs.readdirSync(path.join(folder, 'backups')).length, 2);
  } finally {
    const resolved = path.resolve(folder);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('taketwo-persist-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
