-- 为 manholes 表增加 display_name 列，用于展示井盖照片的上传者昵称
-- 与 comments 表的 display_name 一致：上传/发布时由前端把当前昵称快照写入。
alter table if exists public.manholes
  add column if not exists display_name text;

-- 结果自检：执行后应能看到 display_name 列
-- select column_name
-- from information_schema.columns
-- where table_name = 'manholes' and column_name = 'display_name';
