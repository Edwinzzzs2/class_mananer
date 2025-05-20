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
  "mergeMap": {              // 合并单元格配置
    "k1朗朗": "k1朗朗",
    "k2星星": "k2星星"
  },
  "noClassMap": {            // 无课时间配置
    "k1朗朗": ["周一4:30", "周三4:30"]
  },
  "fileName": "2024春季班课程表.xlsx",  // 可选，文件名
  "id": "xxx"                // 可选，存在时为更新操作
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
    "mergeMap": {              // 合并单元格配置
      "k1朗朗": "k1朗朗",
      "k2星星": "k2星星"
    },
    "noClassMap": {            // 无课时间配置
      "k1朗朗": ["周一4:30", "周三4:30"]
    },
    "fileName": "2024春季班课程表.xlsx",
    "importTime": "2024-05-01T12:00:00Z"
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

## 错误码说明

- 0: 成功
- 500: 服务器内部错误

## 注意事项

1. 所有时间相关的字段使用 ISO 8601 格式
2. 文件大小限制为 10MB
3. 建议在请求时设置适当的超时时间
