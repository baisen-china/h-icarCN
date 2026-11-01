import { supabase } from '@/utils/supabase.js'

// 人工审核模式：内容直接入库，由数据库 force_pending 触发器自动置为 pending，
// 等待管理后台人工审核（通过 / 隐藏 / 删除 / 召回）。
// 不再调用任何云端内容审核服务。
export async function submitModerated(type, payload) {
  try {
    const table = type === 'manhole' ? 'manholes' : 'comments'
    const { data, error } = await supabase.from(table).insert(payload).select('id').single()
    if (error) return { status: 'pending', id: null, error }
    return { status: 'pending', id: data?.id ?? null, error: null }
  } catch (e) {
    return { status: 'pending', id: null, error: e }
  }
}
