-- ALTER TABLE sites 
-- ADD COLUMN backup_url VARCHAR(255) NULL AFTER url,
-- ADD COLUMN internal_url VARCHAR(255) NULL AFTER backup_url;

-- -- 为已存在的记录设置初始值（如果需要的话）
-- UPDATE sites 
-- SET backup_url = NULL, 
--     internal_url = NULL 
-- WHERE backup_url IS NULL AND internal_url IS NULL;

-- ALTER TABLE schedules ADD COLUMN url VARCHAR(500) NULL AFTER file_name;
-- UPDATE schedules SET url = NULL WHERE url IS NULL;

-- ALTER TABLE schedules ADD COLUMN advisor_student_map JSON NULL AFTER no_class_map;
-- ALTER TABLE schedules ADD COLUMN title VARCHAR(255) NULL AFTER url;

-- ALTER TABLE schedules ADD COLUMN advisor_student_map JSON NULL AFTER no_class_map;
-- ALTER TABLE schedules ADD COLUMN title VARCHAR(255) NULL AFTER url;

-- -- 1. schedules表增加updatetime字段
-- ALTER TABLE schedules ADD COLUMN updatetime DATETIME NULL DEFAULT NULL AFTER import_time;

-- -- 2. 新建操作日志表
-- CREATE TABLE IF NOT EXISTS operation_log (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   schedule_id INT,
--   action VARCHAR(20), -- 'save' 或 'fetch'
--   user VARCHAR(50) NULL,
--   detail TEXT,
--   create_time DATETIME DEFAULT CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DESC schedules;


-- ALTER TABLE operation_log MODIFY COLUMN action VARCHAR(50);


-- ALTER TABLE operation_log
--   ADD COLUMN ip VARCHAR(64) NULL AFTER user,
--   ADD COLUMN user_agent VARCHAR(512) NULL AFTER ip,
--   ADD COLUMN referer VARCHAR(512) NULL AFTER user_agent;

-- CREATE TABLE IF NOT EXISTS excelData (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   log_id INT,
--   schedule_id INT NULL,
--   data JSON NOT NULL,
--   source VARCHAR(50) NULL,
--   operator VARCHAR(50) NULL,
--   create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
--   INDEX (log_id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;