import React, { useState, useMemo, useEffect } from 'react';
import { Upload, Button, Table, Card, Tag, ConfigProvider, Modal, Select, Form, message, Tooltip, Collapse, Input } from 'antd';
import { UploadOutlined, UserOutlined, CalendarOutlined, QuestionCircleOutlined, SaveOutlined, SyncOutlined, EditOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import zhCN from 'antd/lib/locale/zh_CN';
import './App.css';

message.config({
  top: 80,
  duration: 2,
  maxCount: 3,
  getContainer: () => document.body,
});

function App() {
  const [loading, setLoading] = useState(false);
  const [classData, setClassData] = useState(null);
  const [teacherStats, setTeacherStats] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [viewMode, setViewMode] = useState('teachers'); // 'teachers', 'timeSlots', 'detail'
  const [helpDrawerVisible, setHelpDrawerVisible] = useState(false);
  const [mergeMap, setMergeMap] = useState({});
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [mergeForm] = Form.useForm();
  const [mergeTarget, setMergeTarget] = useState('');
  const [mergeSource, setMergeSource] = useState([]);
  const [editMergeGroup, setEditMergeGroup] = useState(null); // 编辑中的合并组名
  const [excelData, setExcelData] = useState(null); // 新增：保存原始Excel数据
  const [noClassMap, setNoClassMap] = useState({}); // 新增：无课时设置
  const [adjustModalVisible, setAdjustModalVisible] = useState(false); // 课程调整弹窗
  const [adjustTeachers, setAdjustTeachers] = useState([]); // 选中的老师
  const [adjustSlots, setAdjustSlots] = useState([]); // 选中的时间段
  const [editNoClassTeacher, setEditNoClassTeacher] = useState(null); // 编辑无课时老师
  const [saveLoading, setSaveLoading] = useState(false); // 保存按钮loading
  const [scheduleId, setScheduleId] = useState(null); // 数据库id
  const [teacherDetailVisible, setTeacherDetailVisible] = useState(false);
  const [teacherDetailData, setTeacherDetailData] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false); // 新增：更新按钮loading状态
  const [title, setTitle] = useState(localStorage.getItem('title') || '雨花课程表分析系统');
  const [editingTitle, setEditingTitle] = useState(false);
  const [url, setUrl] = useState(localStorage.getItem('url') || 'https://www.kdocs.cn/l/ckDFlQtwrj6B');
  const [editingUrl, setEditingUrl] = useState(false);

  // 1. 获取所有时间段，并按周一~周日排序
  const weekOrder = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const weekColorMap = {
    '周一': '#1890ff',
    '周二': '#52c41a',
    '周三': '#faad14',
    '周四': '#eb2f96',
    '周五': '#722ed1',
    '周六': '#fa541c',
    '周日': '#13c2c2',
  };
  const allTimeSlots = useMemo(() => {
    const slots = Array.from(
      new Set(
        teacherStats.flatMap(teacher =>
          teacher.slots.map(slot => slot.timeSlot.trim())
        )
      )
    );
    // 按周一~周日排序，同一天按时间从小到大
    return slots.sort((a, b) => {
      const getWeekIdx = s => weekOrder.findIndex(w => s.replace(/\s/g, '').includes(w));
      const getTimeNum = s => {
        // 兼容"周四 6:30"与"周四6:30"
        const match = s.match(/(\d+):(\d+)/) || s.replace(/\s/g, '').match(/(\d+):(\d+)/);
        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          return hours * 60 + minutes;
        }
        return 0;
      };
      const aWeek = getWeekIdx(a);
      const bWeek = getWeekIdx(b);
      if (aWeek !== bWeek) return aWeek - bWeek;
      return getTimeNum(a) - getTimeNum(b);
    });
  }, [teacherStats]);

  // 获取所有原始老师名
  const allTeacherNames = useMemo(() => teacherStats.map(t => t.name), [teacherStats]);
  // 反向映射：合并后名 -> 原老师名数组
  const mergedGroups = useMemo(() => {
    const group = {};
    allTeacherNames.forEach(name => {
      const merged = mergeMap[name] || name;
      if (!group[merged]) group[merged] = [];
      group[merged].push(name);
    });
    return group;
  }, [mergeMap, allTeacherNames]);

  // 合并后的老师统计
  const mergedTeacherStats = useMemo(() => {
    // 合并 slots
    return Object.entries(mergedGroups).map(([mergedName, names]) => {
      // 合并所有老师的slots
      const slotsMap = {};
      let totalSlots = 0, filledSlots = 0, availableSlots = 0;
      names.forEach(name => {
        const t = teacherStats.find(t => t.name === name);
        if (!t) return;
        t.slots.forEach(slot => {
          if (!slotsMap[slot.timeSlot]) {
            slotsMap[slot.timeSlot] = { ...slot };
          } else {
            // 合并学生
            slotsMap[slot.timeSlot].students = [...slotsMap[slot.timeSlot].students, ...slot.students];
            slotsMap[slot.timeSlot].filledCells += slot.filledCells;
            slotsMap[slot.timeSlot].emptyCells += slot.emptyCells;
            slotsMap[slot.timeSlot].totalCells += slot.totalCells;
          }
        });
        totalSlots += t.totalSlots;
        filledSlots += t.filledSlots;
        availableSlots += t.availableSlots;
      });
      return {
        name: mergedName,
        slots: Object.values(slotsMap),
        totalSlots,
        filledSlots,
        availableSlots,
        mergedFrom: names.length > 1 ? names : undefined,
      };
    });
  }, [teacherStats, mergedGroups]);

  // 2. 构建表格数据
  const timeTableData = useMemo(() => {
    return mergedTeacherStats.map(teacher => {
      const row = { name: teacher.name, _teacher: teacher };
      allTimeSlots.forEach(time => {
        const slot = teacher.slots.find(s => s.timeSlot === time);
        if (slot) {
          row[time] = {
            filled: slot.filledCells,
            empty: slot.emptyCells,
            total: slot.totalCells,
          };
        } else {
          row[time] = null;
        }
      });
      return row;
    });
  }, [mergedTeacherStats, allTimeSlots]);

  // 3. 表格列定义
  const timeTableColumns = useMemo(() => [
    {
      title: '教师',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 90,
      render: (text, record) => (
        <span
          style={{
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'inline-block',
            maxWidth: 80,
            verticalAlign: 'middle',
            color: 'black',
            cursor: 'pointer',
          }}
          title={text}
          onClick={() => {
            const t = mergedTeacherStats.find(t => t.name === text);
            if (t) {
              setTeacherDetailData(t);
              setTeacherDetailVisible(true);
            }
          }}
        >
          {text}
        </span>
      )
    },
    ...allTimeSlots.map(time => {
      const week = weekOrder.find(w => time.includes(w)) || '';
      const weekColor = weekColorMap[week] || '#1677ff';
      return {
        title: (
          <Tag color={weekColor} style={{ fontSize: 12, padding: '0 4px', minWidth: 40, textAlign: 'center' }}>{time}</Tag>
        ),
        dataIndex: time,
        key: time,
        align: 'center',
        render: (cell, row) => {
          // 获取所有原始老师名，合并老师时遍历所有原始老师
          const rawNames = row._teacher?.mergedFrom || [row._teacher?.name];
          if (rawNames.some(name => noClassMap[name]?.includes(time))) {
            return <span style={{ color: '#ccc', fontSize: 14 }}>—</span>;
          }
          if (!cell) return <span style={{ color: '#ccc', fontSize: 13 }}>—</span>;
          // 找到该老师该时间段的学生
          let students = [];
          if (row._teacher && row._teacher.slots) {
            const slot = row._teacher.slots.find(s => s.timeSlot === time);
            if (slot) students = slot.students;
          }
          if (cell.empty === 0) {
            return (
              <Tooltip title={students.length > 0 ? students.join('、') : '无学生'} placement="top">
                <Tag color="orange" style={{ fontSize: 12, fontWeight: 500, color: '#fa8c16', minWidth: 36, textAlign: 'center' }}>满({cell.filled})</Tag>
              </Tooltip>
            );
          }
          if (cell.filled === 0) {
            return <Tag color="green" style={{ fontSize: 12, fontWeight: 500, color: '#52c41a', minWidth: 36, textAlign: 'center' }}>空({cell.empty})</Tag>;
          }
          return (
            <span style={{ display: 'inline-flex', gap: 2 }}>
              <Tooltip title={students.length > 0 ? students.join('、') : '无学生'} placement="top">
                <Tag color="blue" style={{ fontSize: 12, fontWeight: 500, color: '#1677ff', minWidth: 32, textAlign: 'center' }}>报{cell.filled}</Tag>
              </Tooltip>
              <Tag color="green" style={{ fontSize: 12, fontWeight: 500, color: '#52c41a', minWidth: 32, textAlign: 'center' }}>空{cell.empty}</Tag>
            </span>
          );
        }
      };
    })
  ], [allTimeSlots, noClassMap]);

  // 初始化时优先接口，失败用localStorage
  useEffect(() => {
    (async () => {
      try {
        // const res = await fetch('/schedule/detail');
        const res = await fetch('http://192.168.31.80:3609/schedule/detail');
        const result = await res.json();
        if (result.code === 0 && result.data) {
          const { excelData, teacherStats, mergeMap, noClassMap, id, url: remoteUrl, title: remoteTitle } = result.data;
          setExcelData(excelData);
          setClassData(excelData);
          setTeacherStats(teacherStats);
          setMergeMap(mergeMap || {});
          setNoClassMap(noClassMap || {});
          setScheduleId(id);
          // 新增：下发url和title
          if (remoteUrl) {
            setUrl(remoteUrl);
            localStorage.setItem('url', remoteUrl);
          }
          if (remoteTitle) {
            setTitle(remoteTitle);
            localStorage.setItem('title', remoteTitle);
          }
          // 同步localStorage
          localStorage.setItem('excelData', JSON.stringify(excelData));
          localStorage.setItem('classData', JSON.stringify(excelData));
          localStorage.setItem('teacherStats', JSON.stringify(teacherStats));
          localStorage.setItem('mergeMap', JSON.stringify(mergeMap || {}));
          localStorage.setItem('noClassMap', JSON.stringify(noClassMap || {}));
          localStorage.setItem('scheduleId', id);
        } else {
          // fallback to localStorage
          const savedTeacherStats = localStorage.getItem('teacherStats');
          const savedClassData = localStorage.getItem('classData');
          const savedMergeMap = localStorage.getItem('mergeMap');
          const savedExcelData = localStorage.getItem('excelData');
          const savedNoClassMap = localStorage.getItem('noClassMap');
          const savedId = localStorage.getItem('scheduleId');
          const savedUrl = localStorage.getItem('url');
          const savedTitle = localStorage.getItem('title');
          if (savedTeacherStats) setTeacherStats(JSON.parse(savedTeacherStats));
          if (savedClassData) setClassData(JSON.parse(savedClassData));
          if (savedMergeMap) setMergeMap(JSON.parse(savedMergeMap));
          if (savedExcelData) setExcelData(JSON.parse(savedExcelData));
          if (savedNoClassMap) setNoClassMap(JSON.parse(savedNoClassMap));
          if (savedId) setScheduleId(savedId);
          if (savedUrl) setUrl(savedUrl);
          if (savedTitle) setTitle(savedTitle);
        }
      } catch (error) {
        // fallback to localStorage
        const savedTeacherStats = localStorage.getItem('teacherStats');
        const savedClassData = localStorage.getItem('classData');
        const savedMergeMap = localStorage.getItem('mergeMap');
        const savedExcelData = localStorage.getItem('excelData');
        const savedNoClassMap = localStorage.getItem('noClassMap');
        const savedId = localStorage.getItem('scheduleId');
        const savedUrl = localStorage.getItem('url');
        const savedTitle = localStorage.getItem('title');
        if (savedTeacherStats) setTeacherStats(JSON.parse(savedTeacherStats));
        if (savedClassData) setClassData(JSON.parse(savedClassData));
        if (savedMergeMap) setMergeMap(JSON.parse(savedMergeMap));
        if (savedExcelData) setExcelData(JSON.parse(savedExcelData));
        if (savedNoClassMap) setNoClassMap(JSON.parse(savedNoClassMap));
        if (savedId) setScheduleId(savedId);
        if (savedUrl) setUrl(savedUrl);
        if (savedTitle) setTitle(savedTitle);
      }
    })();
  }, []);

  // 解析Excel文件
  const handleFileUpload = (file) => {
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        // 保存原始Excel数据
        setExcelData(jsonData);
        localStorage.setItem('excelData', JSON.stringify(jsonData));

        setClassData(jsonData);
        localStorage.setItem('classData', JSON.stringify(jsonData));

        processClassData(jsonData);
      } catch (error) {
        console.error('解析Excel出错:', error);
        message.error('解析Excel文件失败');
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
    return false;
  };

  // 处理课程表数据
  const processClassData = (data) => {
    const teachers = {};
    const weekKeys = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const blockIndexes = [0, 7, 14, 22, 29];
    let currentTimeByCol = {};
    let currentTeacherByCol = {};
    let lastTeacherByCol = {}; // 记录上一个老师名
    let lastCourseByCol = {};  // 记录上一个课程对象

    // 在处理 slot.timeSlot 时，统一格式
    const normalizeTimeSlot = s => (s || '').replace(/：/g, ':').replace(/\s|　/g, '');

    for (let row = 0; row < data.length; row++) {
      const rowArr = data[row];
      // 判断是否为时间行
      let isTimeRow = false;
      blockIndexes.forEach(col => {
        const cell = rowArr[col]?.toString();
        if (cell && weekKeys.some(w => cell.includes(w))) {
          isTimeRow = true;
          currentTimeByCol[col] = normalizeTimeSlot(cell.trim());
          currentTeacherByCol[col] = null;
          lastTeacherByCol[col] = null;
          lastCourseByCol[col] = null;
        }
      });
      if (isTimeRow) continue;

      blockIndexes.forEach(col => {
        const cell = rowArr[col]?.toString().trim();
        // 如果有老师名，更新当前老师
        if (cell) {
          currentTeacherByCol[col] = cell;
          lastTeacherByCol[col] = cell;
          // 初始化老师数据结构
          if (!teachers[cell]) teachers[cell] = [];
          // 新增一个时间段课程
          const course = {
            timeSlot: normalizeTimeSlot(currentTimeByCol[col] || '未知时间'),
            students: [],
          };
          teachers[cell].push(course);
          lastCourseByCol[col] = course;
        }
        // 如果没有老师名，沿用上一个老师
        const teacherName = currentTeacherByCol[col] || lastTeacherByCol[col];
        const courseObj = lastCourseByCol[col];
        if (teacherName && courseObj) {
          // 学生区：老师名右侧的单元格（col+1 ~ col+6）
          for (let c = col + 1; c < col + 7 && c < rowArr.length; c++) {
            const student = rowArr[c]?.toString().trim();
            if (student) courseObj.students.push(student);
          }
        }
      });
    }

    // 整理老师统计信息
    const teacherStats = Object.entries(teachers).map(([name, slots]) => {
      // 根据老师名字判断最大学生数
      const MAX_STUDENTS = name.toLowerCase().includes('k1') ||
        name.toLowerCase().includes('k2') ||
        name.toLowerCase().includes('k3') ? 6 : 8;

      return {
        name,
        slots: slots.map(slot => ({
          ...slot,
          filledCells: slot.students.length,
          emptyCells: Math.max(0, MAX_STUDENTS - slot.students.length),
          totalCells: MAX_STUDENTS,
        })),
        totalSlots: slots.length * MAX_STUDENTS,
        filledSlots: slots.reduce((sum, s) => sum + s.students.length, 0),
        availableSlots: slots.reduce((sum, s) => sum + Math.max(0, MAX_STUDENTS - s.students.length), 0)
      };
    });

    setTeacherStats(teacherStats);
    localStorage.setItem('teacherStats', JSON.stringify(teacherStats));
    setTimeSlots([]); // 如需按时间段展示可再整理

    // === 自动补全mergeMap并标准化 ===
    const newMergeMap = { ...mergeMap };
    Object.keys(teachers).forEach(name => {
      const stdName = name.replace(/\s/g, '').replace(/　/g, '').toLowerCase();
      let found = false;
      Object.keys(mergeMap).forEach(oldName => {
        const stdOld = oldName.replace(/\s/g, '').replace(/　/g, '').toLowerCase();
        if (stdName === stdOld) {
          newMergeMap[name] = Array.isArray(mergeMap[oldName]) ? mergeMap[oldName][0] : mergeMap[oldName];
          found = true;
        }
      });
      if (!found && !newMergeMap[name]) {
        newMergeMap[name] = name; // 没有合并关系，自己合并到自己
      }
    });
    setMergeMap(newMergeMap);
    localStorage.setItem('mergeMap', JSON.stringify(newMergeMap));
  };

  // 打开帮助抽屉
  const showHelpDrawer = () => {
    setHelpDrawerVisible(true);
  };

  // 关闭帮助抽屉
  const closeHelpDrawer = () => {
    setHelpDrawerVisible(false);
  };

  // 合并老师弹窗
  const showMergeModal = (e) => {
    e.stopPropagation();
    setMergeModalVisible(true);
    mergeForm.resetFields();
    setMergeSource([]);
    setMergeTarget('');
  };
  const handleEditMerge = (mergedName) => {
    // 找到该组成员
    const members = mergedGroups[mergedName] || [];
    setMergeSource(members);
    setMergeTarget(mergedName);
    setEditMergeGroup(mergedName);
    setMergeModalVisible(true);
    mergeForm.setFieldsValue({ source: members, target: mergedName });
  };
  const handleMergeOk = () => {
    mergeForm.validateFields()
      .then(values => {
        let { source, target } = values;
        if (!Array.isArray(source) || source.length < 2) {
          message.error('请选择2个及以上老师');
          return;
        }
        if (Array.isArray(target)) {
          target = target[target.length - 1] || '';
        }
        if (!target) {
          message.error('请输入合并后名字');
          return;
        }
        if (Object.keys(mergedGroups).some(name => name === target && name !== editMergeGroup && mergedGroups[name].length > 1)) {
          message.error('该合并名称已被占用');
          return;
        }
        const newMap = { ...mergeMap };
        if (editMergeGroup) {
          Object.keys(newMap).forEach(k => {
            if (newMap[k] === editMergeGroup) delete newMap[k];
          });
        }
        source.forEach(name => {
          newMap[name] = target; // 保证是字符串
        });
        setMergeMap(newMap);
        localStorage.setItem('mergeMap', JSON.stringify(newMap));
        setMergeModalVisible(false);
        setEditMergeGroup(null);
        setTeacherStats(ts => [...ts]);
      })
      .catch(() => {
        // 表单校验未通过，不需要额外处理
      });
  };
  const handleMergeCancel = () => {
    setMergeModalVisible(false);
    setEditMergeGroup(null);
  };
  // 取消某个合并
  const handleRemoveMerge = (mergedName) => {
    const newMap = { ...mergeMap };
    Object.keys(newMap).forEach(k => {
      if ((Array.isArray(newMap[k]) && newMap[k][0] === mergedName) || newMap[k] === mergedName) {
        delete newMap[k];
      }
    });
    setMergeMap(newMap);
    localStorage.setItem('mergeMap', JSON.stringify(newMap));
    setTeacherStats(ts => [...ts]); // 强制刷新，确保Tag消失
  };

  // 更新noClassMap并持久化
  const updateNoClassMap = (newMap) => {
    setNoClassMap(newMap);
    localStorage.setItem('noClassMap', JSON.stringify(newMap));
  };

  // 打开课程调整弹窗
  const showAdjustModal = (e) => {
    e.stopPropagation();
    setAdjustModalVisible(true);
    setAdjustTeachers('');
    setAdjustSlots([]);
    setEditNoClassTeacher(null);
  };
  // 编辑无课时
  const handleEditNoClass = (teacher) => {
    setAdjustModalVisible(true);
    setAdjustTeachers(teacher);
    setAdjustSlots(noClassMap[teacher] || []);
    setEditNoClassTeacher(teacher);
  };
  const handleAdjustCancel = () => {
    setAdjustModalVisible(false);
    setEditNoClassTeacher(null);
  };
  // 批量设置无课时/编辑无课时
  const handleSetNoClass = () => {
    if (!adjustTeachers) {
      message.warning('请选择老师和时间段');
      return;
    }
    const newMap = { ...noClassMap };
    if (editNoClassTeacher) {
      // 编辑模式，只更新该老师
      newMap[editNoClassTeacher] = [...adjustSlots];
      if (newMap[editNoClassTeacher].length === 0) delete newMap[editNoClassTeacher];
    } else {
    
   
        if (!newMap[adjustTeachers]) newMap[adjustTeachers] = [];
        adjustSlots.forEach(slot => {
          if (!newMap[adjustTeachers].includes(slot)) newMap[adjustTeachers].push(slot);
        });
    
    }
    updateNoClassMap(newMap);
    message.success('设置成功');
    setAdjustModalVisible(false);
    setEditNoClassTeacher(null);
  };

  // 保存到接口和localStorage
  const handleSave = async () => {
    setSaveLoading(true);
    try {
      const body = {
        excelData,
        teacherStats,
        mergeMap,
        noClassMap,
        fileName: '', // 可根据实际情况传
        id: scheduleId,
        url, // 新增
        title, // 新增
      };
      const res = await fetch('http://192.168.31.80:3609/schedule/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (result.code === 0) {
        message.success('保存成功');
        // 更新id
        if (result.scheduleId) {
          setScheduleId(result.scheduleId);
          localStorage.setItem('scheduleId', result.scheduleId);
        }
        // 同步localStorage
        localStorage.setItem('excelData', JSON.stringify(excelData));
        localStorage.setItem('classData', JSON.stringify(excelData));
        localStorage.setItem('teacherStats', JSON.stringify(teacherStats));
        localStorage.setItem('mergeMap', JSON.stringify(mergeMap || {}));
        localStorage.setItem('noClassMap', JSON.stringify(noClassMap || {}));
        localStorage.setItem('url', url);
        localStorage.setItem('title', title);
      } else {
        message.error(result.message || '保存失败');
      }
    } catch (e) {
      message.error('保存失败，服务器连接异常');
    } finally {
      setSaveLoading(false);
    }
  };

  // 新增：从金山文档获取数据
  const handleUpdateFromKdocs = async () => {
    setUpdateLoading(true);
    try {
      const res = await fetch('http://192.168.31.26:3006/schedule/kdocs-direct-download-and-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url // 取自当前界面上的url状态
        })
      });
      const result = await res.json();
      if (result.code === 0 && result.data) {
        setExcelData(result.data);
        localStorage.setItem('excelData', JSON.stringify(result.data));
        setClassData(result.data);
        localStorage.setItem('classData', JSON.stringify(result.data));
        processClassData(result.data);
        message.success(result.message);
      } else {
        message.error(result.message || '获取数据失败');
      }
    } catch (error) {
      console.error('从金山文档获取数据失败:', error);
      message.error('获取数据失败，请检查网络连接');
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <ConfigProvider locale={zhCN}>
      <div className="App" style={{ margin: '0 auto', padding: 24 }}>
        <div className="main-content-mobile">
          <div style={{ width: '100%', margin: '8px 2px 8px 0' }}>
            <div className="button-group-mobile" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {editingTitle ? (
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={() => {
                      setEditingTitle(false);
                      localStorage.setItem('title', title);
                    }}
                    onPressEnter={() => {
                      setEditingTitle(false);
                      localStorage.setItem('title', title);
                    }}
                    style={{ fontWeight: 'bold', fontSize: '2.2rem', width: 220 }}
                    autoFocus
                  />
                ) : (
                  <span
                    className="side-title"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setEditingTitle(true)}
                    title="点击编辑标题"
                  >
                    {title}
                  </span>
                )}
                {editingUrl ? (
                  <Input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onBlur={() => {
                      setEditingUrl(false);
                      localStorage.setItem('url', url);
                    }}
                    onPressEnter={() => {
                      setEditingUrl(false);
                      localStorage.setItem('url', url);
                    }}
                    style={{ width: 320 }}
                    autoFocus
                  />
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#1677ff',
                        fontSize: 16,
                        marginLeft: 8,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        maxWidth: 320,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={url}
                    >
                      {url}
                    </a>
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => setEditingUrl(true)}
                      style={{ padding: 0, marginLeft: 2 }}
                      title="编辑链接"
                    />
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <Button 
                  icon={<SyncOutlined />} 
                  type="primary" 
                  size="large"
                  loading={updateLoading}
                  onClick={handleUpdateFromKdocs}
                >
                  更新数据
                </Button>
                <Upload
                  accept=".xlsx,.xls"
                  beforeUpload={handleFileUpload}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />} type="primary" size="large">
                    导入Excel课程表
                  </Button>
                </Upload>
                <Button onClick={handleSave} type="primary" size="large" icon={<SaveOutlined />} loading={saveLoading}>
                  保存
                </Button>
              </div>
            </div>
          </div>
          {/* 合并关系和无课时设置折叠区 */}
          <Collapse defaultActiveKey={[]} style={{ marginBottom: 12 }}>
            <Collapse.Panel header={
              <span>
                合并关系
                <span style={{ marginLeft: 16 }}>
                  <a style={{ color: '#1677ff', fontWeight: 500, fontSize: 14, cursor: 'pointer' }} onClick={(e) => showMergeModal(e)}>添加合并关系</a>
                </span>
              </span>
            } key="merge">
              <Card bodyStyle={{ padding: 12 }} style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>
                <div className="merge-group-list">
                  {Object.entries(mergedGroups).filter(([k, v]) => v.length > 1).map(([merged, names]) => (
                    <Tag
                      color="purple"
                      key={merged}
                      className="merge-group-tag"
                      closable
                      onClose={() => handleRemoveMerge(merged)}
                    >
                      <span style={{
                        whiteSpace: 'nowrap',
                        overflowX: 'auto',
                        display: 'inline-block',
                        verticalAlign: 'middle',
                        maxWidth: '80vw',
                        textAlign: 'center'
                      }}>
                        {names.join('、')} <span style={{ fontWeight: 600, color: '#fa8c16' }}>→</span> {merged}
                      </span>
                      <span
                        style={{ marginLeft: 8, cursor: 'pointer', color: '#1890ff', fontWeight: 700 }}
                        onClick={e => {
                          e.stopPropagation();
                          handleEditMerge(merged);
                        }}
                      >
                        编辑
                      </span>
                    </Tag>
                  ))}
                </div>
              </Card>
            </Collapse.Panel>
            <Collapse.Panel key="noClass" header={
              <span>
                无课时设置
                <span style={{ marginLeft: 16 }}>
                  <a style={{ color: '#1677ff', fontWeight: 500, fontSize: 14, cursor: 'pointer' }} onClick={(e) => showAdjustModal(e)}>添加无课设置</a>
                </span>
              </span>
            }>
              <div style={{ marginBottom: 8, textAlign: 'right' }}>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                {Object.entries(noClassMap).map(([teacher, slots]) =>
                  slots.length > 0 && (
                    <div className="no-class-row" key={teacher}>
                      <span className="no-class-teacher">{teacher}：</span>
                      <span className="no-class-tag-scroll">
                        {slots.map(slot => (
                          <Tag
                            color="gray"
                            key={slot}
                            closable
                            onClose={e => {
                              e.preventDefault();
                              // 移除该老师该时间段
                              const newMap = { ...noClassMap };
                              newMap[teacher] = newMap[teacher].filter(s => s !== slot);
                              if (newMap[teacher].length === 0) delete newMap[teacher];
                              updateNoClassMap(newMap);
                            }}
                            style={{ marginLeft: 6, marginRight: 0, fontSize: 13 }}
                          >
                            {slot}
                          </Tag>
                        ))}
                      </span>
                      <Button
                        type="link"
                        size="small"
                        className="no-class-edit-btn"
                        onClick={() => handleEditNoClass(teacher)}
                      >
                        编辑
                      </Button>
                    </div>
                  )
                )}
              </div>
            </Collapse.Panel>
          </Collapse>
          {/* 只保留时间段汇总表 */}
          <Card
            title={<span style={{ fontWeight: 600 }}>按时间段汇总表</span>}
            style={{ marginTop: 0, marginBottom: 24, width: '100%', maxWidth: '100vw' }}
            bordered
          >
            <Table
              dataSource={timeTableData}
              columns={timeTableColumns}
              rowKey="name"
              pagination={false}
              size="small"
              bordered
              scroll={{ x: 'max-content' }}
              style={{ background: '#fff', borderRadius: 8, width: '100%' }}
              rowClassName={(record, index) => index % 2 === 0 ? 'even-row' : 'odd-row'}
              onRow={(record, index) => ({
                style: {
                  backgroundColor: index % 2 === 0 ? '#fafafa' : '#ffffff',
                },
              })}
              summary={(pageData) => {
                const totalRow = { name: '合计' };
                allTimeSlots.forEach(time => {
                  let totalFilled = 0;
                  let totalEmpty = 0;
                  pageData.forEach(row => {
                    const cell = row[time];
                    if (cell) {
                      totalFilled += cell.filled;
                      totalEmpty += cell.empty;
                    }
                  });
                  totalRow[time] = {
                    filled: totalFilled,
                    empty: totalEmpty,
                    total: totalFilled + totalEmpty
                  };
                });
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={1}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>合计</span>
                      </Table.Summary.Cell>
                      {allTimeSlots.map((time, index) => {
                        const cell = totalRow[time];
                        if (!cell) return <Table.Summary.Cell key={time} index={index + 1} />;
                        return (
                          <Table.Summary.Cell key={time} index={index + 1}>
                            <span style={{ fontSize: 15, fontWeight: 500 }}>
                              报{cell.filled} 空{cell.empty}
                            </span>
                          </Table.Summary.Cell>
                        );
                      })}
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
            />
          </Card>
        </div>
        {/* 合并老师弹窗 */}
        <Modal
          title="合并老师"
          open={mergeModalVisible}
          onOk={handleMergeOk}
          maskClosable={false} 
          onCancel={handleMergeCancel}
          okText="确定"
          cancelText="取消"
        >
          <Form form={mergeForm} layout="vertical">
            <Form.Item label="选择要合并的老师" name="source" rules={[{ required: true, message: '请选择老师' }]}>
              <Select
                mode="multiple"
                allowClear
                placeholder="请选择2个及以上老师"
                options={allTeacherNames
                  .filter(n => !Object.entries(mergedGroups).filter(([k, v]) => v.length > 1).map(([k, v]) => v).flat().includes(n))
                  .map(n => ({ label: n, value: n }))}
                value={mergeSource}
                onChange={setMergeSource}
                showSearch
                filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
                autoClearSearchValue={false}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              label="合并后老师名字（可自定义输入）"
              name="target"
              rules={[{ required: true, message: '请输入合并后名字' }]}
            >
              <Select
                mode="tags"
                showSearch
                allowClear
                placeholder="输入或选择合并后名字后回车"
                options={
                  Array.from(
                    new Set([
                      ...allTeacherNames,
                    ])
                  ).map(n => ({ label: n, value: n }))
                }
                value={mergeTarget ? [mergeTarget] : []}
                onChange={val => setMergeTarget(val[val.length - 1] || '')}
                filterOption={(input, option) =>
                  option.label.toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
                maxTagCount={1}
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* 课程调整弹窗 */}
        <Modal
          title="无课时设置"
          maskClosable={false} 
          open={adjustModalVisible}
          onCancel={handleAdjustCancel}
          onOk={handleSetNoClass}
          okText="确定"
          cancelText="取消"
        >
          <Form layout="vertical">
            <Form.Item label="选择老师">
              <Select
                allowClear
                readOnly
                placeholder="请选择老师"
                options={allTeacherNames.map(n => ({ label: n, value: n }))}
                value={adjustTeachers}
                onChange={setAdjustTeachers}
                style={{ width: '100%' }}
                disabled={!!editNoClassTeacher} // 编辑时只允许单老师
              />
            </Form.Item>
            <Form.Item label="选择时间段">
              <Select
                mode="multiple"
                allowClear
                readOnly
                placeholder="请选择时间段"
                options={allTimeSlots.map(t => ({ label: t, value: t }))}
                value={adjustSlots}
                onChange={setAdjustSlots}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* 老师详情弹窗 */}
        <Modal
          title={teacherDetailData ? `${teacherDetailData.name} 课程详情` : ''}
          open={teacherDetailVisible}
          maskClosable={false} 
          onCancel={() => setTeacherDetailVisible(false)}
          footer={null}
          width={window.innerWidth < 600 ? '90vw' : 600}
          bodyStyle={{ 
            padding: window.innerWidth < 600 ? 8 : 24,
            maxHeight: window.innerWidth < 600 ? '60vh' : '72vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          style={{ 
            top: window.innerWidth < 600 ? '10vh' : '15vh',
            paddingBottom: 0,
          }}
        >
          {teacherDetailData && (
            <div style={{ 
              flex: 1,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}>
              {teacherDetailData.slots
                .slice()
                .filter(slot => {
                  // 只显示有课程的时间段
                  const hasClass = slot.filledCells > 0 || slot.emptyCells > 0;
                  // 检查是否在无课时设置中
                  const isNoClass = teacherDetailData.mergedFrom?.some(name => 
                    noClassMap[name]?.includes(slot.timeSlot)
                  );
                  return hasClass && !isNoClass;
                })
                .sort((a, b) => {
                  // 星期排序
                  const weekOrder = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
                  const getWeekIdx = s => weekOrder.findIndex(w => s.includes(w));
                  const getTimeNum = s => {
                    const match = s.match(/(\d+):(\d+)/);
                    if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
                    return 0;
                  };
                  const aWeek = getWeekIdx(a.timeSlot);
                  const bWeek = getWeekIdx(b.timeSlot);
                  if (aWeek !== bWeek) return aWeek - bWeek;
                  return getTimeNum(a.timeSlot) - getTimeNum(b.timeSlot);
                })
                .map(slot => {
                  const weekOrder = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
                  const week = weekOrder.find(w => slot.timeSlot.includes(w)) || '';
                  const weekColor = weekColorMap[week] || '#1677ff';
                  return (
                    <div key={slot.timeSlot} style={{ marginBottom: 16, borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        <span style={{ color: weekColor }}>{week}</span>
                        <span style={{ color: '#1677ff', marginLeft: 4 }}>{slot.timeSlot.replace(week, '')}</span>
                      </div>
                      <div style={{ fontSize: 14, marginBottom: 8 }}>
                        <span style={{ color: '#1890ff', fontWeight: 500 }}>学生：</span>
                        {slot.students.length > 0 ? (
                          <span style={{ color: '#333', fontWeight: 500 }}>{slot.students.join('、')}</span>
                        ) : (
                          <span style={{ color: '#aaa' }}>无</span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, marginBottom: 2 }}>
                        <span style={{ color: '#1677ff', fontWeight: 700, background: '#e6f4ff', borderRadius: 4, padding: '2px 10px', marginRight: 6 }}>
                          报{slot.filledCells}
                        </span>
                        {slot.emptyCells === 0 ? (
                          <span style={{ color: '#fa8c16', fontWeight: 700, background: '#fff7e6', borderRadius: 4, padding: '2px 10px', marginRight: 6 }}>满</span>
                        ) : (
                          <span style={{ color: '#52c41a', fontWeight: 700, background: '#f6ffed', borderRadius: 4, padding: '2px 10px', marginRight: 6 }}>
                            空{slot.emptyCells}
                          </span>
                        )}
                        <span style={{ color: '#999', margin: '0 4px' }}>/</span>
                        <span style={{ color: '#1890ff', fontWeight: 600 }}>总数：</span>
                        <span style={{ color: '#1890ff', fontWeight: 700 }}>{slot.totalCells}</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: 3,
                        background: '#f0f0f0',
                        borderRadius: 6,
                        margin: '8px 0 0 0',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(slot.filledCells / slot.totalCells) * 100}%`,
                          height: '100%',
                          background: slot.emptyCells === 0 ? '#fa8c16' : '#1677ff',
                          borderRadius: 6,
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Modal>

        <Button
          type="primary"
          onClick={() => {
            message.success('又偷偷点我，想我啦？')
            console.log({mergeMap})
            console.log({mergeSource})
            console.log({allTeacherNames})
            console.log({mergedGroups})
            console.log(Object.entries(mergedGroups).filter(([k, v]) => v.length > 1).map(([k, v]) => v).flat())
          }}
          style={{ margin: 16 }}
        >
          测试 Antd Message
        </Button>
    </div>
    </ConfigProvider>
  );
}

export default App;
