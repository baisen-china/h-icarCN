-- ============================================================================
-- 井盖龙虎榜 manhole-app — Supabase 表结构与 RLS 策略
-- 说明：前端使用 anon/publishable key，因此安全边界完全依赖 RLS。
-- 设计原则：公开只读"已审核(status='approved')"内容；匿名可提交，但提交内容
--           先进入 pending，由管理员(service_role)审核后再公开，防止灌水/垃圾公开。
-- 应用方式：在 Supabase 控制台 SQL Editor 全选执行，或用 `supabase db push`。
-- ============================================================================

-- 1) 井盖表 -------------------------------------------------------------------
create table if not exists public.manholes (
  id                  uuid primary key default gen_random_uuid(),
  image_url           text,
  province            text,
  city                text,
  district            text,
  install_year        integer check (install_year between 1900 and 2100),
  material            text,
  uploader_device_id  text,
  status              text not null default 'pending'
                        check (status in ('pending','approved','rejected')),
  created_at          timestamptz not null default now()
);

-- 2) 留言表 -------------------------------------------------------------------
create table if not exists public.comments (
  id                  uuid primary key default gen_random_uuid(),
  manhole_id          uuid references public.manholes(id) on delete cascade,
  content             text not null,
  uploader_device_id  text,
  status              text not null default 'pending'
                        check (status in ('pending','approved','rejected')),
  created_at          timestamptz not null default now()
);

-- 3) 索引（提升筛选/排序性能）------------------------------------------------
create index if not exists idx_manholes_status on public.manholes(status);
create index if not exists idx_manholes_province on public.manholes(province);
create index if not exists idx_manholes_install_year on public.manholes(install_year);
create index if not exists idx_manholes_created_at on public.manholes(created_at desc);
create index if not exists idx_comments_manhole on public.comments(manhole_id);
create index if not exists idx_comments_status on public.comments(status);

-- 4) 强制新提交进入待审核（忽略客户端传入的 status）--------------------------
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

-- 5) 开启 RLS -----------------------------------------------------------------
alter table public.manholes enable row level security;
alter table public.comments enable row level security;

-- 6) SELECT：匿名/登录用户都只能读"已审核"内容（公开榜单 & 公开留言）---------
drop policy if exists "manholes_select_public" on public.manholes;
create policy "manholes_select_public" on public.manholes
  for select using (status = 'approved');

drop policy if exists "comments_select_public" on public.comments;
create policy "comments_select_public" on public.comments
  for select using (status = 'approved');

-- 7) INSERT：允许匿名提交（status 会被上面的触发器强制为 pending）-------------
drop policy if exists "manholes_insert_anon" on public.manholes;
create policy "manholes_insert_anon" on public.manholes
  for insert with check (true);

drop policy if exists "comments_insert_anon" on public.comments;
create policy "comments_insert_anon" on public.comments
  for insert with check (true);

-- 8) 禁止匿名 UPDATE / DELETE（防止篡改或删库式攻击）-------------------------
-- 默认即禁止：不创建 update/delete policy 即生效。

-- ============================================================================
-- 附：存储桶 manhole-images 设置
--   1. 在 Supabase Storage 创建 bucket: manhole-images，设为 public。
--   2. 若不想用 public bucket，改为 private 并加策略：
--      create policy "公开读图" on storage.objects
--        for select using (bucket_id = 'manhole-images');
--   前端 getPublicUrl 仅拼接 URL，能否访问取决于 bucket 是否 public + 上述策略。
--
-- 审核后台示例（用 service_role 连接，绕过 RLS）：
--   update public.manholes set status = 'approved' where id = '<id>';
--   update public.comments set status = 'approved' where id = '<id>';
-- ============================================================================
