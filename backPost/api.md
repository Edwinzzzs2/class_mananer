# 课程表管理系统 API 文档

## 基础信息

- 基础URL: `http://localhost:3006`
- 所有请求和响应均使用 JSON 格式
- 响应格式统一为：
  ```json
  {
    "code": 0,       // 0 表示成功，非 0 表示错误
    "message": "",   // 错误信息，成功时可能为空
    "data": {}       // 响应数据，错误时可能为空
  }
  ```

## API 列表

### 1. 保存课程表数据

保存或更新课程表数据，包含所有配置信息。

#### 请求信息

- **接口**: `POST http://localhost:3006/schedule/save`
- **Content-Type**: `application/json`

#### 请求参数

```json
{
  "excelData": [],           // 二维数组，原始表格内容
  "teacherStats": [],        // 老师统计信息
  "mergeMap": {},            // 合并单元格配置
  "noClassMap": {},          // 无课时间配置
  "fileName": "2024春季班课程表.xlsx",  // 可选，文件名
  "id": "xxx",              // 可选，存在时为更新操作
  "url": "https://www.kdocs.cn/l/xxxx" // 可选，课程表关联的外部文档url
}
```

#### 响应示例

成功响应：
```json
{
  "code": 0,
  "message": "保存成功",
  "scheduleId": "123"  // 新建或更新的主键id
}
```

错误响应：
```json
{
  "code": 500,
  "message": "保存课程表失败"
}
```

### 2. 获取课程表数据

获取最新的课程表数据。

#### 请求信息

- **接口**: `GET http://localhost:3006/schedule/detail`
- **Content-Type**: `application/json`

#### 响应示例

成功响应：
```json
{
  "code": 0,
  "data": {
    "id": 1,                  // 课程表ID，用于更新操作
    "excelData": [],           // 二维数组，原始表格内容
    "teacherStats": [],        // 老师统计信息
    "mergeMap": {},            // 合并单元格配置
    "noClassMap": {},          // 无课时间配置
    "fileName": "2024春季班课程表.xlsx",
    "importTime": "2024-05-01T12:00:00Z",
    "url": "https://www.kdocs.cn/l/xxxx" // 课程表关联的外部文档url
  }
}
```

无数据响应：
```json
{
  "code": 0,
  "data": null
}
```

错误响应：
```json
{
  "code": 500,
  "message": "获取课程表失败"
}
```

## 数据结构说明

### excelData
二维数组，存储原始表格内容。每个单元格的数据格式取决于实际内容。

### teacherStats
老师统计信息数组，包含每个老师的课程统计。

### mergeMap
合并单元格配置对象，key 为单元格标识，value 为合并后的值。

### noClassMap
无课时间配置对象，key 为老师标识，value 为该老师的无课时间数组。

### url
课程表关联的外部文档链接（如金山文档等），可选。

## 错误码说明

- 0: 成功
- 500: 服务器内部错误

## 注意事项

1. 所有时间相关的字段使用 ISO 8601 格式
2. 文件大小限制为 10MB
3. 建议在请求时设置适当的超时时间

## 金山文档导出 API 文档

## 接口说明

所有接口都遵循统一的响应格式：
- 成功响应：`{ "code": 0, ... }`
- 错误响应：`{ "code": 400/500, "message": "错误信息", ... }`

## 接口列表

### 1. 预加载导出任务

**接口路径**：`POST /kdocs-export`

**功能说明**：预加载导出任务并获取下载链接

**请求参数**：
```json
{
  "docId": "文档ID",  // 必填，金山文档ID
  "fname": "文件名"   // 必填，导出文件名
}
```

**响应示例**：
```json
{
  "code": 0,         // 0表示成功
  "url": "下载链接"   // 成功时返回下载链接
}
```

**错误响应**：
```json
{
  "code": 400,       // 400表示请求参数错误
  "message": "缺少docId或fname"
}
```

### 2. 直接获取下载链接

**接口路径**：`POST /kdocs-direct-download`

**功能说明**：直接获取文档下载链接

**请求参数**：
```json
{
  "docId": "文档ID",  // 必填，金山文档ID
  "referer": "来源页" // 可选，来源页面URL
}
```

**响应示例**：
```json
{
  "code": 0,         // 0表示成功
  "url": "下载链接"   // 成功时返回下载链接
}
```

**错误响应**：
```json
{
  "code": 400,       // 400表示请求参数错误
  "message": "缺少docId"
}
```

### 3. 获取下载链接并解析Excel

**接口路径**：`POST /kdocs-direct-download-and-parse`

**功能说明**：获取下载链接并直接解析Excel内容

**请求参数**：
```json
{
  "url": "文档URL",   // 必填，金山文档完整URL
  "referer": "来源页" // 可选，来源页面URL
}
```

**响应示例**：
```json
{
  "code": 0,         // 0表示成功
  "message": "解析成功",
  "data": [          // Excel数据，二维数组格式
    ["表头1", "表头2", ...],
    ["数据1", "数据2", ...],
    ...
  ]
}
```

**错误响应**：
```json
{
  "code": 400,       // 400表示请求参数错误
  "message": "请提供金山在线云文档URL"
}
```

## 错误码说明

- `400`：请求参数错误
  - 缺少必要参数
  - 参数格式不正确
  - 无效的文档ID或URL

- `500`：服务器错误
  - 获取下载链接失败
  - 解析Excel失败
  - 其他服务器内部错误

## 注意事项

1. 所有接口都需要配置有效的金山文档 Cookie
2. 文档ID可以从金山文档URL中提取：
   - 格式1：`https://www.kdocs.cn/l/{docId}`
   - 格式2：`https://www.kdocs.cn/view/{docId}`
3. 建议在生产环境中使用环境变量配置 Cookie 和 CSRF Token
