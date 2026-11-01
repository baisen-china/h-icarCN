-- ============================================================================
-- 井盖龙虎榜 manhole-app — 存储桶 + 存储 RLS 修复
-- 问题：上传图片报 "new row violates row-level security policy"。
-- 根因：之前只建了表与表级 RLS，从未创建 manhole-images 存储桶，也没给
--       storage.objects 配置匿名上传 / 读取策略。supabase.storage.upload()
--       会在 storage.objects 表插入一行，被 RLS 拦截，从而报 RLS 错误。
-- 应用：在 Supabase 控制台 SQL Editor 全选执行，或用 Management API 推送。
-- ============================================================================

-- 1) 创建 public 存储桶（幂等：已存在则保持 public）--------------------------
insert into storage.buckets (id, name, public)
values ('manhole-images', 'manhole-images', true)
on conflict (id) do update set public = true;

-- 2) 匿名可上传到该桶（storage.upload 的底层 INSERT 需要此策略）-------------
drop policy if exists "anon_upload_manhole_images" on storage.objects;
create policy "anon_upload_manhole_images" on storage.objects
  for insert to anon
  with check (bucket_id = 'manhole-images');

-- 3) 任何人可读取该桶图片（公开榜单需要 getPublicUrl 能访问）-------------
drop policy if exists "public_read_manhole_images" on storage.objects;
create policy "public_read_manhole_images" on storage.objects
  for select to anon
  using (bucket_id = 'manhole-images');

-- 4) 归一化 manholes / comments 插入策略（确保匿名可提交，避免模板策略冲突）-
drop policy if exists "manholes_insert_anon" on public.manholes;
create policy "manholes_insert_anon" on public.manholes
  for insert to anon with check (true);

drop policy if exists "comments_insert_anon" on public.comments;
create policy "comments_insert_anon" on public.comments
  for insert to anon with check (true);

-- 结果自检 --------------------------------------------------------------------
select 'bucket' as kind, name, public::text from storage.buckets where name='manhole-images';
