-- ALTER TABLE sites 
-- ADD COLUMN backup_url VARCHAR(255) NULL AFTER url,
-- ADD COLUMN internal_url VARCHAR(255) NULL AFTER backup_url;

-- -- 为已存在的记录设置初始值（如果需要的话）
-- UPDATE sites 
-- SET backup_url = NULL, 
--     internal_url = NULL 
-- WHERE backup_url IS NULL AND internal_url IS NULL;

ALTER TABLE schedules ADD COLUMN url VARCHAR(500) NULL AFTER file_name;
UPDATE schedules SET url = NULL WHERE url IS NULL;