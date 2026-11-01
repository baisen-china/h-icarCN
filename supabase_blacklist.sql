-- ============================================================================
-- 井盖龙虎榜 · 黑名单表 + anon 只读策略 + 幂等初始化 RPC
-- 在 Supabase 控制台 → SQL Editor 执行一次即可（幂等，可重复执行）。
-- admin-api Edge Function 会在首次访问黑名单时自动调用 ensure_blacklist_tables()，
-- 但若该 RPC 不存在（尚未执行本文件），拉黑功能会提示失败 —— 故请先执行本文件。
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blacklist (
  device_id text primary key,
  added_at timestamptz not null default now(),
  note text,
  added_by text
);

ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blacklist' AND policyname = 'anon_read_blacklist'
  ) THEN
    CREATE POLICY anon_read_blacklist ON public.blacklist FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- 幂等初始化 RPC（供 admin-api Edge Function 调用，SECURITY DEFINER 以便建表/建策略）
CREATE OR REPLACE FUNCTION public.ensure_blacklist_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.blacklist (
    device_id text primary key,
    added_at timestamptz not null default now(),
    note text,
    added_by text
  );
  ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blacklist' AND policyname = 'anon_read_blacklist'
  ) THEN
    CREATE POLICY anon_read_blacklist ON public.blacklist FOR SELECT TO anon USING (true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_blacklist_tables() TO service_role, authenticated, anon;
