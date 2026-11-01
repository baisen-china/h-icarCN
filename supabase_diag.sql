-- ============================================================================
-- 井盖龙虎榜 — 只读诊断脚本（不会修改任何数据，可放心执行）
-- 目的：确认 (1) comments 表是否有 parent_id 列；(2) 各表 id 类型；
--       (3) 上一轮 supabase_rls_fix.sql 的策略是否真的创建成功。
-- 执行后把"结果区"文字（或截图）发回即可。
-- ============================================================================

-- A) comments 表全部列（重点看有没有 parent_id）
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'comments'
order by ordinal_position;

-- B) manholes / comments 的 id 类型（确认前端传整数还是 uuid 是否匹配）
select 'manholes' as tbl, column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='manholes' and column_name='id'
union all
select 'comments' as tbl, column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='comments' and column_name='id';

-- C) 相关 RLS 策略是否就位（重点看 comments_insert_anon / storage 两条）
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where (tablename in ('manholes','comments','display_names'))
   or (schemaname='storage' and tablename='objects')
order by tablename, policyname;
