const express = require('express');
const router = express.Router();
const axios = require('axios');
const XLSX = require('xlsx');
const { pool } = require('../db'); // 顶部引入
const { logOperation, saveExcelData } = require('../utils/logOperation');

// 请将你的cookie和csrf值配置在环境变量或安全存储中
const KDOCS_COOKIE = process.env.KDOCS_COOKIE || '';
const KDOCS_CSRF = process.env.KDOCS_CSRF || '';

// 预加载导出任务
async function preloadExport(docId) {
  const url = `https://www.kdocs.cn/api/v3/office/file/${docId}/export/xlsx/preload`;
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'cookie': KDOCS_COOKIE,
    'origin': 'https://www.kdocs.cn',
    'referer': `https://www.kdocs.cn/l/${docId}`,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  };
  const data = {
    ver: "3",
    csrfmiddlewaretoken: KDOCS_CSRF
  };
  const res = await axios.post(url, data, { headers });
  return res.data;
}

// 查询导出结果
async function getExportResult(docId, fname, task_id) {
  const url = `https://www.kdocs.cn/api/v3/office/file/${docId}/export/xlsx/result`;
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'cookie': KDOCS_COOKIE,
    'origin': 'https://www.kdocs.cn',
    'referer': `https://www.kdocs.cn/l/${docId}`,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  };
  const data = {
    fname,
    task_id,
    task_type: "normal_export",
    csrfmiddlewaretoken: KDOCS_CSRF
  };
  const res = await axios.post(url, data, { headers });
  return res.data;
}


// POST /kdocs-export { docId, fname }
router.post('/kdocs-export', async (req, res) => {
  const { docId, fname } = req.body;
  if (!docId || !fname) {
    logOperation('kdocs-export', req, '缺少docId或fname');
    return res.status(400).json({ code: 400, message: '缺少docId或fname' });
  }
  try {
    // 1. 预加载
    const preload = await preloadExport(docId);
    const task_id = preload.task_id || (preload.data && preload.data.task_id);
    if (!task_id) {
      logOperation('kdocs-export', req, '未获取到task_id');
      return res.status(500).json({ code: 500, message: '未获取到task_id', detail: preload });
    }
    // 2. 轮询result接口
    let result;
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1000));
      result = await getExportResult(docId, fname, task_id);
      if (result.status === 'finished' && result.data && result.data.url) {
        logOperation('kdocs-export', req, { docId, fname, url: result.data.url });
        return res.json({ code: 0, url: result.data.url });
      }
    }
    logOperation('kdocs-export', req, '未能获取到下载url');
    return res.status(500).json({ code: 500, message: '未能获取到下载url', detail: result });
  } catch (err) {
    logOperation('kdocs-export', req, err.message);
    return res.status(500).json({ code: 500, message: '流程出错', error: err.message });
  }
});

// 直接获取下载url的接口
router.post('/kdocs-direct-download', async (req, res) => {
  const { docId, referer } = req.body;
  if (!docId) {
    logOperation('kdocs-direct-download', req, '缺少docId');
    return res.status(400).json({ code: 400, message: '缺少docId' });
  }
  try {
    const url = `https://www.kdocs.cn/api/v3/office/file/${docId}/download`;
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'cookie': KDOCS_COOKIE,
      'referer': referer || `https://www.kdocs.cn/l/${docId}`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'priority': 'u=1, i',
      'sec-ch-ua': '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-forward-region': 'hwy',
    };
    // 不跟随重定向，拿到location
    const axiosRes = await axios.get(url, { headers, maxRedirects: 0, validateStatus: s => s >= 200 && s < 400 });
    if (axiosRes.status === 302 && axiosRes.headers.location) {
      logOperation('kdocs-direct-download', req, { docId, url: axiosRes.headers.location });
      return res.json({ code: 0, url: axiosRes.headers.location });
    } else if (axiosRes.status === 200 && axiosRes.request.res.responseUrl) {
      logOperation('kdocs-direct-download', req, { docId, url: axiosRes.request.res.responseUrl });
      return res.json({ code: 0, url: axiosRes.request.res.responseUrl });
    } else if (axiosRes.data && (axiosRes.data.download_url || axiosRes.data.url)) {
      logOperation('kdocs-direct-download', req, { docId, url: axiosRes.data.download_url || axiosRes.data.url });
      return res.json({ code: 0, url: axiosRes.data.download_url || axiosRes.data.url });
    } else {
      logOperation('kdocs-direct-download', req, '未能获取到下载url');
      return res.status(500).json({ code: 500, message: '未能获取到下载url', detail: axiosRes.data });
    }
  } catch (err) {
    if (err.response && err.response.status === 302 && err.response.headers.location) {
      logOperation('kdocs-direct-download', req, { docId, url: err.response.headers.location });
      return res.json({ code: 0, url: err.response.headers.location });
    }
    logOperation('kdocs-direct-download', req, err.message);
    return res.status(500).json({ code: 500, message: '流程出错', error: err.message });
  }
});

// 直接获取下载url并解析Excel的接口
router.post('/kdocs-direct-download-and-parse', async (req, res) => {
  const { url, referer } = req.body;
  if (!url) {
    logOperation('kdocs-direct-download-and-parse', req, '缺少url');
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
    logOperation('kdocs-direct-download-and-parse', req, e.message);
    return res.status(400).json({ code: 400, message: '无效的金山在线云文档链接，请确保链接格式正确' });
  }
  try {
    // 1. 获取下载url
    const downloadUrl = `https://www.kdocs.cn/api/v3/office/file/${docId}/download`;
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'cookie': KDOCS_COOKIE,
      'referer': referer || `https://www.kdocs.cn/l/${docId}`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'priority': 'u=1, i',
      'sec-ch-ua': '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-forward-region': 'hwy',
    };
    const axiosRes = await axios.get(downloadUrl, { headers, maxRedirects: 0, validateStatus: s => s >= 200 && s < 400 });
    let finalDownloadUrl;
    if (axiosRes.status === 302 && axiosRes.headers.location) {
      finalDownloadUrl = axiosRes.headers.location;
    } else if (axiosRes.status === 200 && axiosRes.request.res.responseUrl) {
      finalDownloadUrl = axiosRes.request.res.responseUrl;
    } else if (axiosRes.data && (axiosRes.data.download_url || axiosRes.data.url)) {
      finalDownloadUrl = axiosRes.data.download_url || axiosRes.data.url;
    } else {
      logOperation('kdocs-direct-download-and-parse', req, '未能获取到下载url');
      return res.status(500).json({ code: 500, message: '未能获取到下载url', detail: axiosRes.data });
    }
    // 2. 下载并解析Excel
    const fileRes = await axios.get(finalDownloadUrl, { responseType: 'arraybuffer' });
    const workbook = XLSX.read(fileRes.data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const filteredData = data.filter(row => row.some(cell => cell !== null && cell !== ''));
    // 记录成功日志，包含更多信息
    const successDetail = {
      url: req.originalUrl,
      body: req.body,
      docId,
      downloadUrl: finalDownloadUrl,
      sheetName: firstSheetName,
      rowCount: filteredData.length,
      timestamp: new Date().toISOString(),
    };
    logOperation('kdocs-direct-download-and-parse', req, successDetail, (err, logId) => {
      if (!err) {
        saveExcelData(logId, null, filteredData, 'kdocs-direct-download-and-parse', null);
      }
    });
    return res.json({ code: 0, message: '解析成功，数据已更新', data: filteredData });
  } catch (err) {
    // 记录错误日志
    const errorDetail = {
      url: req.originalUrl,
      body: req.body,
      docId,
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    };
    logOperation('kdocs-direct-download-and-parse', req, errorDetail, (err, logId) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '写入operation_log失败', error: err.message });
      }
      saveExcelData(logId, null, errorDetail, 'kdocs-direct-download-and-parse', null);
      return res.status(500).json({ code: 500, message: '流程出错', error: err.message });
    });
  }
});

module.exports = router;
module.exports.preloadExport = preloadExport;
module.exports.getExportResult = getExportResult; 