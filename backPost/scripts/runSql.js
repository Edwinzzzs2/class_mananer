// 必须在根目录执行才能读取到.env文件
require('dotenv').config();

console.log('数据库连接配置:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
console.log('DB_NAME:', process.env.DB_NAME);

const fs = require('fs').promises;
const path = require('path');
const db = require('../db');

async function runMigration(sqlFileName) {
  try {
    // 读取 SQL 迁移脚本
    const migrationSqlPath = path.join(__dirname, '../sql/', sqlFileName);
    const migrationSql = await fs.readFile(migrationSqlPath, 'utf8');

    // 分割 SQL 语句
    const sqlStatements = migrationSql.split(';').filter(statement => statement.trim() !== '');

    // 逐条执行 SQL 语句
    for (const statement of sqlStatements) {
      await new Promise((resolve, reject) => {
        console.log(`执行 SQL: ${statement.trim()}`);
        db.pool.query(statement, (error, results) => {
          if (error) {
            console.error('执行 SQL 语句失败:', error);
            return reject(error);
          }
          console.log('执行 SQL 语句成功');
          resolve(results);
        });
      });
    }
    
    console.log(`迁移文件 ${sqlFileName} 执行完成`);
  } catch (error) {
    console.error('执行 SQL 迁移脚本失败:', error);
    throw error;
  }
}

async function main() {
  // 获取命令行参数
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('请提供SQL文件名作为参数');
    console.log('用法: node runSql.js <sql文件名>');
    console.log('示例: node runSql.js 20240625_add_backup_internal_urls.sql');
    process.exit(1);
  }
  
  const sqlFileName = args[0];
  
  try {
    await runMigration(sqlFileName);
    console.log('迁移成功完成');
    process.exit(0);
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  }
}

// 执行主函数
main(); 