-- ============================================================================
-- 井盖龙虎榜 — 模拟前端(anon)插入诊断（会真插一条诊断数据，可删）
-- 目的：以匿名角色实际 INSERT 一条 comments，把真实错误原样打印，
--       直接区分「RLS 拒绝 / parent_id 列缺失 / id 类型不匹配」。
-- 执行后把 "【结果】anon 插入失败: ..." 那一行（或截图）发回即可。
-- 若显示成功，请到后台把 content='诊断测试_可删' 的那条删掉（pending，不会公开）。
-- ============================================================================

do $$
declare mid text;
begin
  select id::text into mid from public.manholes where status='approved' limit 1;
  if mid is null then
    raise notice '【跳过】没有 approved 的 manhole，无法测试（但生产环境应至少有一条）';
    return;
  end if;
  execute 'set role anon';
  begin
    insert into public.comments (manhole_id, content, uploader_device_id, display_name, parent_id)
    values (mid, '诊断测试_可删', 'd_diag', '诊断', null);
    raise notice '【结果】anon 插入成功：RLS/列/类型均正常。请后台删除 content=''诊断测试_可删'' 这条。';
  exception when others then
    raise notice '【结果】anon 插入失败: %', SQLERRM;
  end;
  execute 'reset role';
end $$;

-- 附：列结构（确认 comments 是否有 parent_id、id 是什么类型）
select 'comments' as tbl, column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='comments'
union all
select 'manholes.id', column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='manholes' and column_name='id'
order by tbl, column_name;
