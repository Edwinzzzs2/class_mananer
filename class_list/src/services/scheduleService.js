import { API_ENDPOINTS } from './config';

// 获取课程表详情
export const getScheduleDetail = async () => {
  try {
    const response = await fetch(API_ENDPOINTS.SCHEDULE.DETAIL);
    return await response.json();
  } catch (error) {
    console.error('获取课程表详情失败:', error);
    throw error;
  }
};

// 保存课程表
export const saveSchedule = async (data) => {
  try {
    const response = await fetch(API_ENDPOINTS.SCHEDULE.SAVE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    console.error('保存课程表失败:', error);
    throw error;
  }
};

// 解析金山在线云文档
export const parseWpsDocument = async (url) => {
  try {
    const response = await fetch(API_ENDPOINTS.SCHEDULE.PARSE_WPS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    return await response.json();
  } catch (error) {
    console.error('解析金山在线云文档失败:', error);
    throw error;
  }
};

// 从金山文档直接下载并解析
export const kdocsDirectDownloadAndParse = async (url) => {
  try {
    const response = await fetch(API_ENDPOINTS.SCHEDULE.KDOCS_DIRECT_DOWNLOAD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    return await response.json();
  } catch (error) {
    console.error('从金山文档获取数据失败:', error);
    throw error;
  }
}; 