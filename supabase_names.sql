-- 昵称占用登记表：用于「改昵称时若被他人占用则自动加数字尾巴」「他人不用的昵称可释放复用」
-- 在 Supabase 控制台 → SQL Editor 执行本脚本（仅需一次）。
create table if not exists public.display_names (
  name        text primary key,
  device_id   text not null,
  updated_at  timestamptz not null default now()
);

create index if not exists display_names_device_idx   on public.display_names(device_id);
create index if not exists display_names_updated_idx  on public.display_names(updated_at);

alter table public.display_names enable row level security;

-- 读：公开可读（前端需读取已有昵称以计算尾巴）
drop policy if exists "display_names_anon_read" on public.display_names;
create policy "display_names_anon_read" on public.display_names
  for select using (true);

-- 写：开放写入（与本项目「匿名可提交井盖/留言」的开放模型一致）。
-- 注意：这允许匿名删除任意昵称行，影响仅限于昵称展示，属低风险。
drop policy if exists "display_names_anon_write" on public.display_names;
create policy "display_names_anon_write" on public.display_names
  for insert with check (true);

drop policy if exists "display_names_anon_delete" on public.display_names;
create policy "display_names_anon_delete" on public.display_names
  for delete using (true);

-- 自检：应能看到一张空表
-- select * from public.display_names;
