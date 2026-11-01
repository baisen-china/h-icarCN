-- ============================================================================
-- 井盖龙虎榜 — RLS 修复脚本（幂等，可重复执行）
-- 作用：恢复匿名(anon)用户的前端写入权限，修复
--       "new row violates row-level security policy" 提交/上传失败问题。
-- 适用：在 Supabase 控制台 SQL Editor 全选执行一次即可。
-- ============================================================================

-- 0) 确保表开启 RLS（幂等）---------------------------------------------------
alter table if exists public.manholes        enable row level security;
alter table if exists public.comments        enable row level security;
alter table if exists public.display_names   enable row level security;

-- 1) 强制新提交进入待审核（触发器，幂等重建）-------------------------------
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

-- 2) SELECT：匿名只能读"已审核"内容（公开榜单 & 公开留言 & 昵称表）----------
drop policy if exists "manholes_select_public" on public.manholes;
create policy "manholes_select_public" on public.manholes
  for select to anon using (status = 'approved');

drop policy if exists "comments_select_public" on public.comments;
create policy "comments_select_public" on public.comments
  for select to anon using (status = 'approved');

drop policy if exists "display_names_anon_read" on public.display_names;
create policy "display_names_anon_read" on public.display_names
  for select to anon using (true);

-- 3) INSERT：允许匿名提交（status 由触发器强制为 pending）-------------------
drop policy if exists "manholes_insert_anon" on public.manholes;
create policy "manholes_insert_anon" on public.manholes
  for insert to anon with check (true);

drop policy if exists "comments_insert_anon" on public.comments;
create policy "comments_insert_anon" on public.comments
  for insert to anon with check (true);

drop policy if exists "display_names_anon_write" on public.display_names;
create policy "display_names_anon_write" on public.display_names
  for insert to anon with check (true);

drop policy if exists "display_names_anon_delete" on public.display_names;
create policy "display_names_anon_delete" on public.display_names
  for delete to anon using (true);

-- 4) Storage：manhole-images 桶的匿名上传 + 公开读取 ------------------------
-- （public 桶只解决"读取"，"上传"仍需下面这条 INSERT 策略，否则照片上传报 RLS 错）
drop policy if exists "manhole_images_insert" on storage.objects;
create policy "manhole_images_insert" on storage.objects
  for insert to anon
  with check ( bucket_id = 'manhole-images' );

drop policy if exists "manhole_images_select" on storage.objects;
create policy "manhole_images_select" on storage.objects
  for select to anon
  using ( bucket_id = 'manhole-images' );

-- ============================================================================
-- 自查（可选）：执行后取消注释查看策略是否都已就位
-- select schemaname, tablename, policyname, cmd
-- from pg_policies
-- where tablename in ('manholes','comments','display_names')
--    or (schemaname='storage' and tablename='objects');
-- ============================================================================
