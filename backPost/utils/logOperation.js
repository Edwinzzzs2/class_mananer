const { pool } = require('../db'); // 一定要加这行
// 日志工具函数
function logOperation(action, req, error, cb) {
    console.log('logOperation 被调用:', action, req.originalUrl);
    const clientIp = req.headers['x-forwarded-for'] || req.ip;
    const userAgent = req.headers['user-agent'] || '';
    const refererHeader = req.headers['referer'] || '';
    const detail = {
      url: req.originalUrl,
      body: req.body,
    };
    if (error) detail.error = error;
    console.log('准备写入 operation_log');
    pool.query(
      'INSERT INTO operation_log (schedule_id, action, user, detail, ip, user_agent, referer) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [null, action, null, JSON.stringify(detail), clientIp, userAgent, refererHeader],
      (err, result) => {
        console.log('operation_log 回调触发');
        if (err) {
          console.error('写入 operation_log 失败:', err);
          cb && cb(err, null);
        } else {
          console.log('写入 operation_log 成功:', result.insertId);
          cb && cb(null, result.insertId);
        }
      }
    );
  }

  // 新增：写入excelData表，log_id与操作日志关联
function saveExcelData(logId, scheduleId, data, source, operator) {
    pool.query(
      'INSERT INTO excelData (log_id, schedule_id, data, source, operator) VALUES (?, ?, ?, ?, ?)',
      [logId, scheduleId, JSON.stringify(data), source, operator || null],
    
    );
  }

  module.exports = { logOperation, saveExcelData };
  