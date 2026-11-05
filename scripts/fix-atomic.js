const fs = require('fs');
let m = fs.readFileSync('services/marketplace.js', 'utf8');

const oldAtomic = `  function atomic(work) {
    if (depth) return work();
    db.exec('BEGIN IMMEDIATE');
    depth++;
    try { const value = work(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
    finally { depth--; }
  }`;

const newAtomic = `  function atomic(work) {
    if (depth) return work();
    db.exec('BEGIN IMMEDIATE');
    depth++;
    let isPromise = false;
    try {
      const value = work();
      if (value && typeof value.then === 'function') {
        isPromise = true;
        return value
          .then(res => {
            db.exec('COMMIT');
            return res;
          })
          .catch(err => {
            try { db.exec('ROLLBACK'); } catch (_) {}
            throw err;
          })
          .finally(() => {
            depth--;
          });
      }
      db.exec('COMMIT');
      return value;
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw error;
    } finally {
      if (!isPromise) depth--;
    }
  }`;

m = m.replace(oldAtomic, newAtomic);
fs.writeFileSync('services/marketplace.js', m);
console.log('marketplace.js atomic updated!');

