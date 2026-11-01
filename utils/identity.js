// 终端身份：基于设备ID自动生成默认昵称，用户可随时修改
// 昵称唯一化：改昵称时若目标昵称已被其他活跃用户占用，自动追加数字尾巴；
//             用户改走旧昵称时释放旧名，使其可被他人复用。
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
// 逻辑：
//  1) 取近 ACTIVE_DAYS 天内、且不属于本设备的已占用昵称集合
//  2) 目标昵称被占用 → 找最小可用数字尾巴（name2, name3 …）
//  3) 释放本设备旧昵称（他人即可复用）
//  4) 插入新昵称；若并发冲突则继续递增尾巴重试
export async function claimName(deviceId, desired) {
  const clean = (desired || '').trim().slice(0, MAX_LEN)
  if (!clean) return null
  try {
    const supabase = (await import('./supabase.js')).supabase
    const since = new Date(Date.now() - ACTIVE_DAYS * 864e5).toISOString()
    const { data: rows } = await supabase
      .from('display_names')
      .select('name, device_id')
      .gte('updated_at', since)
    const taken = new Set()
    for (const r of (rows || [])) {
      if (r.device_id !== deviceId) taken.add(r.name)
    }
    let candidate = taken.has(clean) ? nextSuffix(clean, taken) : clean

    // 释放本设备全部旧昵称
    await supabase.from('display_names').delete().eq('device_id', deviceId)

    // 登记新昵称（并发冲突则递增尾巴重试）
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
  } catch (e) {
    console.warn('[claimName] 失败，沿用本地昵称：', e)
    return null
  }
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
