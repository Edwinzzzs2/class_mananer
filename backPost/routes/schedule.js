const express = require('express');
const router = express.Router();
const { connection } = require('../db');

// 保存课程表数据
router.post('/save', async (req, res) => {
  try {
    const { excelData, teacherStats, mergeMap, noClassMap, fileName, id } = req.body;

    if (id) {
      // 更新操作
      const updateQuery = `
        UPDATE schedules 
        SET excel_data = ?, 
            teacher_stats = ?, 
            merge_map = ?, 
            no_class_map = ?,
            file_name = ?
        WHERE id = ?`;

      connection.query(updateQuery, [
        JSON.stringify(excelData),
        JSON.stringify(teacherStats),
        JSON.stringify(mergeMap),
        JSON.stringify(noClassMap),
        fileName,
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
        (excel_data, teacher_stats, merge_map, no_class_map, file_name)
        VALUES (?, ?, ?, ?, ?)`;

      connection.query(insertQuery, [
        JSON.stringify(excelData),
        JSON.stringify(teacherStats),
        JSON.stringify(mergeMap),
        JSON.stringify(noClassMap),
        fileName
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
          fileName: schedule.file_name,
          importTime: schedule.import_time
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

module.exports = router; 