import { supabase } from '@/utils/supabase.js'

// 人工审核模式：内容直接入库，由数据库 force_pending 触发器自动置为 pending，
// 等待管理后台人工审核（通过 / 隐藏 / 删除 / 召回）。
// 不再调用任何云端内容审核服务。
export async function submitModerated(type, payload) {
  try {
    const table = type === 'manhole' ? 'manholes' : 'comments'
    // 注意：不要 .select('id').single()，因为 SELECT 策略只允许读 status='approved'，
    // 刚插入的 pending 行查不到，single() 会误报"提交失败"（数据其实已入库）。
    const { error } = await supabase.from(table).insert(payload)
    if (error) return { status: 'pending', id: null, error }
    return { status: 'pending', id: null, error: null }
  } catch (e) {
    return { status: 'pending', id: null, error: e }
  }
}
