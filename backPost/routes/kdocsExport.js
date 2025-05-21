const express = require('express');
const router = express.Router();
const axios = require('axios');

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
    return res.status(400).json({ code: 400, message: '缺少docId或fname' });
  }
  try {
    // 1. 预加载
    const preload = await preloadExport(docId);
    const task_id = preload.task_id || (preload.data && preload.data.task_id);
    if (!task_id) {
      return res.status(500).json({ code: 500, message: '未获取到task_id', detail: preload });
    }
    // 2. 轮询result接口
    let result;
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1000));
      result = await getExportResult(docId, fname, task_id);
      if (result.status === 'finished' && result.data && result.data.url) {
        return res.json({ code: 0, url: result.data.url });
      }
    }
    return res.status(500).json({ code: 500, message: '未能获取到下载url', detail: result });
  } catch (err) {
    return res.status(500).json({ code: 500, message: '流程出错', error: err.message });
  }
});

// 直接获取下载url的接口
router.post('/kdocs-direct-download', async (req, res) => {
  const { docId, referer } = req.body;
  if (!docId) {
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
      return res.json({ code: 0, url: axiosRes.headers.location });
    } else if (axiosRes.status === 200 && axiosRes.request.res.responseUrl) {
      // 某些情况下直接返回文件
      return res.json({ code: 0, url: axiosRes.request.res.responseUrl });
    } else if (axiosRes.data && (axiosRes.data.download_url || axiosRes.data.url)) {
      // 兼容返回 download_url 或 url 字段的情况
      return res.json({ code: 0, url: axiosRes.data.download_url || axiosRes.data.url });
    } else {
      return res.status(500).json({ code: 500, message: '未能获取到下载url', detail: axiosRes.data });
    }
  } catch (err) {
    if (err.response && err.response.status === 302 && err.response.headers.location) {
      // 兼容axios抛出重定向异常
      return res.json({ code: 0, url: err.response.headers.location });
    }
    return res.status(500).json({ code: 500, message: '流程出错', error: err.message });
  }
});

module.exports = router;
module.exports.preloadExport = preloadExport;
module.exports.getExportResult = getExportResult; 