const mysql = require('mysql');
const config = require('../config');

// 创建数据库连接池
const pool = mysql.createPool({
  ...config.database,
  connectionLimit: 10 // 可根据需要调整
});

// 监听 error 事件，防止进程崩溃
pool.on('error', function(err) {
  console.error('MySQL Pool Error:', err);
  // 这里可以选择重连，或只打印日志
});

// 初始化函数，连接数据库并创建必要的表
function init() {
  return new Promise((resolve, reject) => {
    // 尝试获取一个连接，测试数据库是否可用
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('数据库连接失败:', err);
        return reject(err);
      }
      console.log('数据库连接成功');
      connection.release(); // 释放连接
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
        advisor_student_map JSON NULL,
        file_name VARCHAR(255),
        url VARCHAR(500),
        title VARCHAR(255),
        import_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatetime DATETIME NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

    const createOperationLogTable = `
    CREATE TABLE IF NOT EXISTS operation_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      schedule_id INT,
      action VARCHAR(20),
      user VARCHAR(50) NULL,
      detail TEXT,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

    const tables = [
      { name: 'schedules', query: createSchedulesTable },
      { name: 'operation_log', query: createOperationLogTable }
    ];

    const promises = tables.map(table => {
      return new Promise((resolveTable, rejectTable) => {
        pool.query(table.query, (err) => {
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
  pool
}; 