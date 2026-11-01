// 黑名单判定与全局守卫
// 被拉入黑名单的设备访问应用界面时，始终停留在「假的个人界面（受限）」，
// 直到被管理员从黑名单移除后方可正常访问。
import { getDeviceId, supabase } from './supabase.js'

let blocked = false
const subs = new Set()

export function getBlocked() { return blocked }
export function setBlocked(v) {
  if (blocked === v) return
  blocked = v
  subs.forEach(fn => { try { fn(v) } catch (e) {} })
}
export function onBlockedChange(fn) {
  subs.add(fn)
  return () => subs.delete(fn)
}

// 查询当前设备是否在黑名单中；表不存在/查询异常时放行（fail-open）。
export async function checkBlocked() {
  const deviceId = getDeviceId()
  if (!deviceId) { setBlocked(false); return false }
  try {
    const { data, error } = await supabase
      .from('blacklist')
      .select('device_id')
      .eq('device_id', deviceId)
      .limit(1)
    if (error) {
      console.warn('[blocked] 查询失败，放行：', error.message)
      return false
    }
    const b = !!(data && data.length)
    setBlocked(b)
    return b
  } catch (e) {
    console.warn('[blocked] 检查异常，放行：', e)
    return false
  }
}

let timer = null
// 启动轮询：即使后台已移除黑名单，也能在数秒内自动恢复正常访问。
export function startBlockedWatch() {
  if (timer) return
  checkBlocked()
  timer = setInterval(() => checkBlocked(), 15000)
}
export function stopBlockedWatch() {
  if (timer) { clearInterval(timer); timer = null }
}

const BLOCKED_ROUTE = 'pages/blocked/blocked'
const HOME_ROUTE = 'pages/index/index'

// 全局守卫：在每次页面 onShow 时调用。
//  - 已拉黑且当前不在受限页 → 跳转到受限页；
//  - 未拉黑且当前在受限页 → 跳回首页（恢复访问）。
// 通过当前页面 route 去重，避免跳转死循环。
export async function guardIfBlocked() {
  let b
  try { b = await checkBlocked() } catch (e) { b = false }
  const pages = getCurrentPages()
  const cur = pages.length ? pages[pages.length - 1].route : ''
  if (b && cur !== BLOCKED_ROUTE) {
    uni.reLaunch({ url: '/' + BLOCKED_ROUTE })
    return true
  }
  if (!b && cur === BLOCKED_ROUTE) {
    uni.reLaunch({ url: '/' + HOME_ROUTE })
    return true
  }
  return b
}
