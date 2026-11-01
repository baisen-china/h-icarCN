-- 首页访问计数器
-- 在 Supabase 后台 SQL Editor 执行一次即可（与 supabase_blacklist.sql 同理）

-- 1) 计数表：每行一个页面（'home' 表示首页）
create table if not exists public.visit_counter (
  page       text primary key,
  count      bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- 2) 自增并返回最新值（SECURITY DEFINER，匿名用户只拿到执行权限，无法直接改表）
create or replace function public.bump_visit(p_page text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v bigint;
begin
  insert into public.visit_counter (page, count)
  values (p_page, 1)
  on conflict (page) do update set count = visit_counter.count + 1, updated_at = now();
  select count into v from public.visit_counter where page = p_page;
  return v;
end;
$$;

-- 3) 读取当前值（不增加）
create or replace function public.get_visit(p_page text)
returns bigint
language sql
security definer
set search_path = public
as $$
  select coalesce((select count from public.visit_counter where page = p_page), 0);
$$;

-- 4) 权限：仅允许匿名/登录用户执行函数（不直接授权表写，安全）
grant execute on function public.bump_visit(text) to anon, authenticated;
grant execute on function public.get_visit(text)   to anon, authenticated;
