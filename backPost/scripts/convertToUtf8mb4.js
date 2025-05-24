const { pool } = require('../db');

const tables = [
  'operation_log',
  'excelData'
];

async function convertTableCharset(table) {
  return new Promise((resolve, reject) => {
    const sql = `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;
    console.log(`开始转换表 ${table} 字符集...`);
    pool.query(sql, (err, result) => {
      if (err) {
        console.error(`表 ${table} 转换字符集失败:`, err.message);
        reject(err);
      } else {
        console.log(`表 ${table} 转换字符集成功`);
        resolve();
      }
    });
  });
}

async function main() {
  console.log('==== 开始批量转换表字符集为 utf8mb4 ====');
  for (const table of tables) {
    try {
      await convertTableCharset(table);
    } catch (e) {}
  }
  console.log('==== 所有表字符集转换完成 ====');
  pool.end();
}

main(); 