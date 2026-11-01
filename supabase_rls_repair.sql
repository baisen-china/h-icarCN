-- ============================================================================
-- 井盖龙虎榜 — RLS 彻底修复（一次性，幂等，双角色 anon + authenticated 兜底）
--
-- 用法：在 Supabase 控制台 SQL Editor 中【全选本文件】→ Run。
-- 执行后请重点看最下方「第 5 段验证」的结果：
--   ✅ 显示  INSERT 0 1  →  数据库写入已通，去刷新 h-icar.cn 测试即可
--   ❌ 显示红色错误 new row violates row-level security policy
--        → 说明策略仍未生效（把红色错误文字发我）
--   ℹ️ 显示 INSERT 0 0  →  库里暂时没有 approved 的井盖，无法用此方式测试，
--        但只要第 1~4 段没有红色报错，策略已就位，直接用网站测试即可
-- ============================================================================

-- 1) 开启 RLS（幂等）---------------------------------------------------------
alter table if exists public.manholes        enable row level security;
alter table if exists public.comments        enable row level security;
alter table if exists public.display_names   enable row level security;

-- 2) 强制新提交进入待审核（触发器，幂等重建）--------------------------------
create or replace function public.force_pending()
returns trigger as $$
begin
  new.status = 'pending';
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_manholes_pending on public.manholes;
create trigger trg_manholes_pending
  before insert on public.manholes
  for each row execute function public.force_pending();

drop trigger if exists trg_comments_pending on public.comments;
create trigger trg_comments_pending
  before insert on public.comments
  for each row execute function public.force_pending();

-- 3) SELECT：匿名只能读"已审核"内容 ----------------------------------------
drop policy if exists "manholes_select_public" on public.manholes;
create policy "manholes_select_public" on public.manholes
  for select to anon, authenticated using (status = 'approved');

drop policy if exists "comments_select_public" on public.comments;
create policy "comments_select_public" on public.comments
  for select to anon, authenticated using (status = 'approved');

drop policy if exists "display_names_anon_read" on public.display_names;
create policy "display_names_anon_read" on public.display_names
  for select to anon, authenticated using (true);

-- 4) INSERT：允许匿名提交（双角色兜底，彻底覆盖 publishable key 实际角色）--
drop policy if exists "manholes_insert_anon" on public.manholes;
create policy "manholes_insert_anon" on public.manholes
  for insert to anon, authenticated with check (true);

drop policy if exists "comments_insert_anon" on public.comments;
create policy "comments_insert_anon" on public.comments
  for insert to anon, authenticated with check (true);

drop policy if exists "display_names_anon_write" on public.display_names;
create policy "display_names_anon_write" on public.display_names
  for insert to anon, authenticated with check (true);

drop policy if exists "display_names_anon_delete" on public.display_names;
create policy "display_names_anon_delete" on public.display_names
  for delete to anon, authenticated using (true);

-- 5) Storage：manhole-images 桶匿名上传 + 公开读取 --------------------------
drop policy if exists "manhole_images_insert" on storage.objects;
create policy "manhole_images_insert" on storage.objects
  for insert to anon, authenticated
  with check ( bucket_id = 'manhole-images' );

drop policy if exists "manhole_images_select" on storage.objects;
create policy "manhole_images_select" on storage.objects
  for select to anon, authenticated
  using ( bucket_id = 'manhole-images' );

-- 6) 验证：以 anon 身份真实插入一条（失败会红色报错，成功显示 INSERT 0 1）--
--    （公开站点能显示榜单，说明库里有 approved 井盖，此 INSERT 应能成功）
set role anon;
insert into public.comments (manhole_id, content, uploader_device_id, display_name, parent_id)
select id, '诊断测试_可删_' || now()::text, 'd_diag_repair', '诊断', null
from public.manholes where status = 'approved' limit 1;
reset role;
