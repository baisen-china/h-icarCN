-- 井盖点赞：每个访客（设备）每天可给每个井盖点一次赞，统计总点赞数
create table if not exists public.manhole_likes (
  manhole_id bigint    not null,
  device_id  text      not null,
  like_date  date      not null default current_date,
  created_at timestamptz not null default now(),
  primary key (manhole_id, device_id, like_date)  -- 同一设备同一井盖同一天只能一条
);

alter table public.manhole_likes enable row level security;

-- 匿名/已登录用户可写入点赞（去重由 PK 约束保证）
drop policy if exists "manhole_likes_anon_insert" on public.manhole_likes;
create policy "manhole_likes_anon_insert" on public.manhole_likes
  for insert to anon, authenticated with check (true);

-- 统计走 SECURITY DEFINER 的 RPC，普通用户不允许直接 dump 整张表
drop policy if exists "manhole_likes_service_select" on public.manhole_likes;
create policy "manhole_likes_service_select" on public.manhole_likes
  for select to service_role using (true);

-- 点赞：插入（今日已点则忽略），返回该井盖累计点赞数
create or replace function public.add_like(p_manhole_id bigint, p_device_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.manhole_likes (manhole_id, device_id, like_date)
  values (p_manhole_id, p_device_id, current_date)
  on conflict (manhole_id, device_id, like_date) do nothing;
  select count(*) into v_count from public.manhole_likes where manhole_id = p_manhole_id;
  return v_count;
end;
$$;

-- 批量获取多个井盖的点赞数（首页列表用）
create or replace function public.get_like_counts(p_ids bigint[])
returns table (manhole_id bigint, cnt bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select l.manhole_id, count(*)::bigint as cnt
  from public.manhole_likes l
  where l.manhole_id = any(p_ids)
  group by l.manhole_id;
end;
$$;
