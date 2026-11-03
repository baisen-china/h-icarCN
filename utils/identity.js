// 终端身份：基于设备ID自动生成默认昵称，用户可随时修改
// 昵称唯一化：
//   - 已发布过内容的昵称（留言/井盖）永久保留给原主；任何人（含原主换设备）再取都加数字尾巴；
//   - 从未发布过的“空名”才允许按活跃期释放、由后来者复用。
import { getDeviceId } from './supabase.js'

const NAME_KEY = 'manhole_nickname'
const MAX_LEN = 20
const ACTIVE_DAYS = 30 // 超过该天数未活跃的昵称视为已释放

// 生成默认昵称：访客 + 4位随机字符
export function getDefaultName() {
  let s = ''
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return '访客' + s
}

// 获取当前身份（首次进入自动生成并持久化默认昵称）
export function getIdentity() {
  const deviceId = getDeviceId()
  let name = ''
  try { name = uni.getStorageSync(NAME_KEY) } catch (e) { name = '' }
  if (!name || typeof name !== 'string' || !name.trim()) {
    name = getDefaultName()
    try { uni.setStorageSync(NAME_KEY, name) } catch (e) {}
  }
  return { deviceId, name: name.trim() }
}

// 仅取昵称
export function getDisplayName() {
  return getIdentity().name
}

// 在全局昵称表中登记/去重（后端不可用时返回 null，由调用方降级）
// 核心规则（防止无痕浏览器把有用的名字永久锁死，同时尊重原主资产）：
//  1) 若目标昵称“曾经被发布过”（留言或井盖中留下过该 display_name）→ 视为原主资产，永久保留：
//       - 当前设备正是该名字的发布者 → 原主复用原名；
//       - 否则（他人占用、或原主换了设备无法验证）→ 一律加数字尾巴，原名绝不回收。
//  2) 若目标昵称从未被发布过（空名）→ 按活跃期判断，可认领/释放。
export async function claimName(deviceId, desired) {
  const clean = (desired || '').trim().slice(0, MAX_LEN)
  if (!clean) return null
  try {
    const supabase = (await import('./supabase.js')).supabase

    // 规则1：已发布过的昵称永久保留给原主
    if (await nameEverPublished(supabase, clean)) {
      if (await isPublisher(supabase, clean, deviceId)) {
        // 原主复用原名
        await supabase.from('display_names').delete().eq('device_id', deviceId)
        await insertName(supabase, clean, deviceId)
        return clean
      }
      // 非原主（或原主换设备无法验证）→ 加尾巴，保证不抢原主原名
      return await claimWithSuffix(supabase, deviceId, clean)
    }

    // 规则2：空名，按活跃期判断
    const since = new Date(Date.now() - ACTIVE_DAYS * 864e5).toISOString()
    const { data: holders } = await supabase
      .from('display_names')
      .select('name, device_id, updated_at')
      .eq('name', clean)
      .gte('updated_at', since)

    const others = (holders || []).filter(r => r.device_id !== deviceId)
    if (others.length === 0) {
      await supabase.from('display_names').delete().eq('device_id', deviceId)
      await insertName(supabase, clean, deviceId)
      return clean
    }
    // 被他人活跃持有 → 加尾巴
    return await claimWithSuffix(supabase, deviceId, clean, since)
  } catch (e) {
    console.warn('[claimName] 失败，沿用本地昵称：', e)
    return null
  }
}

// 加数字尾巴认领（并发冲突则递增重试）。takenSince 为空时取全表已占名字。
async function claimWithSuffix(supabase, deviceId, clean, takenSince) {
  const q = supabase.from('display_names').select('name')
  if (takenSince) q.gte('updated_at', takenSince)
  const { data: allRows } = await q
  const taken = new Set((allRows || []).map(r => r.name))
  let candidate = nextSuffix(clean, taken)
  await supabase.from('display_names').delete().eq('device_id', deviceId)
  for (let i = 0; i < 30; i++) {
    const { error } = await supabase
      .from('display_names')
      .insert({ name: candidate, device_id: deviceId, updated_at: new Date().toISOString() })
    if (!error) return candidate
    if (error && /duplicate|23505/i.test(error.message || '')) {
      candidate = nextSuffix(clean, taken)
      continue
    }
    throw error
  }
  return candidate
}

// 写入一条昵称记录
async function insertName(supabase, name, deviceId) {
  await supabase
    .from('display_names')
    .insert({ name, device_id: deviceId, updated_at: new Date().toISOString() })
}

// 该昵称是否曾被任何人以该名字发布过（留言/井盖）。一旦发布过即视为原主资产，永久保留。
async function nameEverPublished(supabase, name) {
  const c = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('display_name', name)
  if ((c.count || 0) > 0) return true
  const m = await supabase
    .from('manholes')
    .select('*', { count: 'exact', head: true })
    .eq('display_name', name)
  return (m.count || 0) > 0
}

// 当前设备是否曾以该昵称发布过（用于判定“原主复用”）
async function isPublisher(supabase, name, deviceId) {
  const c = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('uploader_device_id', deviceId)
    .eq('display_name', name)
  if ((c.count || 0) > 0) return true
  const m = await supabase
    .from('manholes')
    .select('*', { count: 'exact', head: true })
    .eq('uploader_device_id', deviceId)
    .eq('display_name', name)
  return (m.count || 0) > 0
}

function nextSuffix(base, taken) {
  let k = 2
  while (taken.has(base + k)) k++
  taken.add(base + k)
  return base + k
}

// 保活：仅当本设备已登记该昵称时刷新 updated_at（不会抢占他人昵称）
export async function touchName() {
  try {
    const { deviceId, name } = getIdentity()
    if (!name) return
    const supabase = (await import('./supabase.js')).supabase
    await supabase
      .from('display_names')
      .update({ updated_at: new Date().toISOString() })
      .eq('device_id', deviceId)
      .eq('name', name)
  } catch (e) { /* 静默 */ }
}

// 设置昵称（trim、限长、非空）。成功返回最终昵称（可能被加尾巴），失败返回 false。
// 始终先本地保存，保证 UI 可用；随后尝试全局去重（表不存在/失败则降级）。
export async function setDisplayName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) return false
  const clean = name.trim().slice(0, MAX_LEN)
  const deviceId = getDeviceId()
  try { uni.setStorageSync(NAME_KEY, clean) } catch (e) {}
  try {
    const final = await claimName(deviceId, clean)
    if (final && final !== clean) {
      try { uni.setStorageSync(NAME_KEY, final) } catch (e) {}
      return final
    }
  } catch (e) { /* 降级：保留本地昵称 */ }
  return clean
}
