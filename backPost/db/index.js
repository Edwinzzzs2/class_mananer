const mysql = require('mysql');
const config = require('../config');

// 创建数据库连接
const connection = mysql.createConnection(config.database);
console.log(process.env.DB_PORT)
// 初始化函数，连接数据库并创建必要的表
function init() {
  return new Promise((resolve, reject) => {
    connection.connect((err) => {
      if (err) {
        console.error('数据库连接失败:', err);
        return reject(err);
      }
      console.log('数据库连接成功');
      createTables()
        .then(resolve)
        .catch(reject);
    });
  });
}

// 创建数据表
function createTables() {
  return new Promise((resolve, reject) => {
    const createSchedulesTable = `
    CREATE TABLE IF NOT EXISTS schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        excel_data JSON NOT NULL,
        teacher_stats JSON NOT NULL,
        merge_map JSON NOT NULL,
        no_class_map JSON NOT NULL,
        file_name VARCHAR(255),
        import_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

    const tables = [
      { name: 'schedules', query: createSchedulesTable }
    ];

    const promises = tables.map(table => {
      return new Promise((resolveTable, rejectTable) => {
        connection.query(table.query, (err) => {
          if (err) {
            console.error(`创建 ${table.name} 表失败:`, err);
            return rejectTable(err);
          }
          console.log(`${table.name} 表检查/创建成功`);
          resolveTable();
        });
      });
    });

    Promise.all(promises)
      .then(resolve)
      .catch(reject);
  });
}

module.exports = {
  init,
  connection
}; 