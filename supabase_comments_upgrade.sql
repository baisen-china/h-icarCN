-- 为 comments 表增加 display_name 列（用于展示留言者昵称）
-- 幂等：已存在则跳过。匿名 INSERT 策略为 with check (true)，新增列自动可写。
alter table public.comments
  add column if not exists display_name text;

-- 结果自检：应能看到 display_name 列
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'comments'
order by ordinal_position;
