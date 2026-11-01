-- ============================================================================
-- 井盖龙虎榜 manhole-app — reports 表 RLS（与 manholes/comments 对齐）
-- 说明：该表为"用户举报"功能表，应用当前未使用，但模板已建且 RLS 已开启。
-- 策略：匿名仅可"提交举报"(insert)，不可读取举报内容（无 select 策略）；
--       管理员用 postgres/service_role 角色连接即可管理（绕过 RLS）。
-- ============================================================================

-- 1) 确保 RLS 开启（幂等）
alter table public.reports enable row level security;

-- 2) 清理模板遗留策略，建立显式匿名插入策略
drop policy if exists "reports_insert_public" on public.reports;
drop policy if exists "reports_insert_anon" on public.reports;
create policy "reports_insert_anon" on public.reports
  for insert with check (true);

-- 3) 不创建 select/update/delete 策略 => 匿名无法读取/修改举报（仅 owner 可管理）
