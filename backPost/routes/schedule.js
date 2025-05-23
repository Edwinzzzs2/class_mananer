const express = require('express');
const router = express.Router();
const { connection } = require('../db');
const axios = require('axios');
const XLSX = require('xlsx');
const kdocsExport = require('./kdocsExport');

// 金山文档配置
const WPS_CONFIG = {
  appId: process.env.WPS_APP_ID || '', // 从环境变量获取 APPID
  appKey: process.env.WPS_APP_KEY || '', // 从环境变量获取 APPKEY
  accessToken: process.env.WPS_ACCESS_TOKEN || '', // 从环境变量获取 access_token
  refreshToken: process.env.WPS_REFRESH_TOKEN || '' // 从环境变量获取 refresh_token
};

// 刷新 access_token
async function refreshAccessToken() {
  try {
    const response = await axios.post('https://account.wps.cn/oauth2/token', {
      grant_type: 'refresh_token',
      appid: WPS_CONFIG.appId,
      appkey: WPS_CONFIG.appKey,
      refresh_token: WPS_CONFIG.refreshToken
    });

    if (response.data && response.data.access_token) {
      // 更新环境变量中的 token
      process.env.WPS_ACCESS_TOKEN = response.data.access_token;
      process.env.WPS_REFRESH_TOKEN = response.data.refresh_token;
      WPS_CONFIG.accessToken = response.data.access_token;
      WPS_CONFIG.refreshToken = response.data.refresh_token;
      return true;
    }
    return false;
  } catch (error) {
    console.error('刷新 access_token 失败:', error);
    return false;
  }
}

// 保存课程表数据
router.post('/save', async (req, res) => {
  try {
    const { excelData, teacherStats, mergeMap, noClassMap, fileName, id, advisorStudentMap, url, title } = req.body;

    if (id) {
      // 更新操作
      const updateQuery = `
        UPDATE schedules 
        SET excel_data = ?, 
            teacher_stats = ?, 
            merge_map = ?, 
            no_class_map = ?,
            advisor_student_map = ?,
            file_name = ?,
            url = ?,
            title = ?
        WHERE id = ?`;

      connection.query(updateQuery, [
        JSON.stringify(excelData),
        JSON.stringify(teacherStats),
        JSON.stringify(mergeMap),
        JSON.stringify(noClassMap),
        JSON.stringify(advisorStudentMap || {}),
        fileName,
        url,
        title,
        id
      ], (error, results) => {
        if (error) {
          console.error('更新课程表失败:', error);
          return res.status(500).json({
            code: 500,
            message: '更新课程表失败'
          });
        }

        return res.json({
          code: 0,
          message: '更新成功',
          scheduleId: id
        });
      });
    } else {
      // 新建操作
      const insertQuery = `
        INSERT INTO schedules 
        (excel_data, teacher_stats, merge_map, no_class_map, advisor_student_map, file_name, url, title)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

      connection.query(insertQuery, [
        JSON.stringify(excelData),
        JSON.stringify(teacherStats),
        JSON.stringify(mergeMap),
        JSON.stringify(noClassMap),
        JSON.stringify(advisorStudentMap || {}),
        fileName,
        url,
        title
      ], (error, results) => {
        if (error) {
          console.error('保存课程表失败:', error);
          return res.status(500).json({
            code: 500,
            message: '保存课程表失败'
          });
        }

        return res.json({
          code: 0,
          message: '保存成功',
          scheduleId: results.insertId
        });
      });
    }
  } catch (error) {
    console.error('保存课程表失败:', error);
    res.status(500).json({
      code: 500,
      message: '保存课程表失败'
    });
  }
});

// 获取最新的课程表数据
router.get('/detail', async (req, res) => {
  try {
    const query = `
      SELECT * FROM schedules 
      ORDER BY import_time DESC 
      LIMIT 1`;

    connection.query(query, (error, results) => {
      if (error) {
        console.error('获取课程表失败:', error);
        return res.status(500).json({
          code: 500,
          message: '获取课程表失败'
        });
      }

      if (!results || results.length === 0) {
        return res.json({
          code: 0,
          data: null
        });
      }

      const schedule = results[0];
      res.json({
        code: 0,
        data: {
          id: schedule.id,
          excelData: JSON.parse(schedule.excel_data),
          teacherStats: JSON.parse(schedule.teacher_stats),
          mergeMap: JSON.parse(schedule.merge_map),
          noClassMap: JSON.parse(schedule.no_class_map),
          advisorStudentMap: schedule.advisor_student_map ? JSON.parse(schedule.advisor_student_map) : {},
          fileName: schedule.file_name,
          importTime: schedule.import_time,
          url: schedule.url,
          title: schedule.title || ''
        }
      });
    });
  } catch (error) {
    console.error('获取课程表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取课程表失败'
    });
  }
});

// 解析金山在线云文档表格数据，老的两部接口解析流程，新的接口解析流程在kdocsExport.js中
router.post('/parse-wps', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ code: 400, message: '请提供金山在线云文档URL' });
    }
    // 提取文档ID
    let docId;
    try {
      if (url.includes('/l/')) {
        docId = url.split('/l/')[1].split('?')[0];
      } else if (url.includes('/view/')) {
        docId = url.split('/view/')[1].split('?')[0];
      } else {
        docId = url.split('/').pop().split('?')[0];
      }
      if (!docId || docId.length < 5) throw new Error('无效的文档ID');
    } catch (e) {
      return res.status(400).json({ code: 400, message: '无效的金山在线云文档链接，请确保链接格式正确' });
    }
    // 构造文件名
    const fname = '工作簿.ksheet'; // 可根据实际情况调整
    // 1. 通过kdocsExport流程获取下载url
    const kdocsExportRouter = require('./kdocsExport');
    // 直接调用导出流程函数
    const { preloadExport, getExportResult } = require('./kdocsExport');
    let task_id;
    try {
      const preload = await preloadExport(docId);
      task_id = preload.task_id || (preload.data && preload.data.task_id);
      if (!task_id) throw new Error('未获取到task_id');
    } catch (e) {
      return res.status(500).json({ code: 500, message: '导出任务预加载失败', detail: e.message });
    }
    let result, downloadUrl;
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1000));
      result = await getExportResult(docId, fname, task_id);
      if (result.status === 'finished' && result.data && result.data.url) {
        downloadUrl = result.data.url;
        break;
      }
    }
    if (!downloadUrl) {
      return res.status(500).json({ code: 500, message: '未能获取到下载url', detail: result });
    }
    // 2. 下载并解析Excel
    try {
      const fileRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
      const workbook = XLSX.read(fileRes.data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const filteredData = data.filter(row => row.some(cell => cell !== null && cell !== ''));
      return res.json({ code: 0, message: '解析成功', data: filteredData });
    } catch (e) {
      return res.status(500).json({ code: 500, message: '下载或解析Excel失败', detail: e.message });
    }
  } catch (error) {
    res.status(500).json({ code: 500, message: '解析金山在线云文档失败: ' + error.message });
  }
});

module.exports = router; 