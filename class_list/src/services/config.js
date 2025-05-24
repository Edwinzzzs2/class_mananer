// API基础URL配置
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3006'  // 开发环境
  : '';  // 生产环境使用相对路径

export const API_ENDPOINTS = {
  SCHEDULE: {
    DETAIL: `${API_BASE_URL}/schedule/detail`,
    SAVE: `${API_BASE_URL}/schedule/save`,
    PARSE_WPS: `${API_BASE_URL}/schedule/parse-wps`,
    KDOCS_DIRECT_DOWNLOAD: `${API_BASE_URL}/schedule/kdocs-direct-download-and-parse`
  }
}; 