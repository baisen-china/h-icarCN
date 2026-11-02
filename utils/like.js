// 井盖点赞：每个设备每天可对同一井盖点一次赞
// 客户端用 localStorage 记录「今天已赞过」，仅作 UI 状态；真正去重由数据库 PK 保证。
import { supabase, getDeviceId } from './supabase.js'

const KEY = 'manhole_liked_dates' // { [manholeId]: 'YYYY-MM-DD' }

function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

export function isLikedToday(id) {
  try {
    const m = uni.getStorageSync(KEY) || {}
    return m[String(id)] === todayStr()
  } catch (e) {
    return false
  }
}

export function markLikedToday(id) {
  try {
    const m = uni.getStorageSync(KEY) || {}
    m[String(id)] = todayStr()
    uni.setStorageSync(KEY, m)
  } catch (e) { /* 忽略 */ }
}

// 点赞：插入（已点过则忽略），返回该井盖最新总赞数
export async function likeManhole(manholeId) {
  const deviceId = getDeviceId()
  const { data, error } = await supabase.rpc('add_like', {
    p_manhole_id: manholeId,
    p_device_id: deviceId
  })
  if (error) throw error
  return data
}

// 批量获取点赞数：传入 id 数组，返回 { [manholeId]: count }
export async function fetchLikeCounts(ids) {
  if (!ids || !ids.length) return {}
  const { data, error } = await supabase.rpc('get_like_counts', { p_ids: ids })
  if (error) return {}
  const map = {}
  for (const r of (data || [])) map[r.manhole_id] = Number(r.cnt)
  return map
}
