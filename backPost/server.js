const express = require('express');
const cors = require('cors');
const { init } = require('./db');
const scheduleRoutes = require('./routes/schedule');
const config = require('./config');

const app = express();
const port = config.server.port;

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use('/schedule', scheduleRoutes);

// 初始化数据库并启动服务器
init()
  .then(() => {
    app.listen(port, () => {
      console.log(`服务器运行在 http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('服务器启动失败:', err);
    process.exit(1);
  });
