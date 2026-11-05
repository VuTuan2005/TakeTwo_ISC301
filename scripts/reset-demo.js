const { db, initDatabase, backupDatabase } = require('../db');
if (process.env.DEMO_MODE === 'false') {
  console.error('Reset bị khóa khi DEMO_MODE=false.');
  process.exitCode = 1;
} else {
  const backup = backupDatabase();
  initDatabase(true);
  console.log(backup ? `Đã lưu bản sao: ${backup}` : 'Database mới; chưa có dữ liệu để sao lưu.');
  console.log('Đã reset dữ liệu mô phỏng. Khởi động lại server trước khi demo.');
}
db.close();
