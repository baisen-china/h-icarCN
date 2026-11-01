// ============================================================================
// 井盖年龄榜 — 审核后台 API（Supabase Edge Function 版）
// 部署：supabase functions deploy admin-api
// 说明：
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由平台自动注入，无需手动设置；
//   - 使用 service_role 客户端绕过 RLS，具备审核所需全部读写权限；
//   - 自定义鉴权：登录后返回 HMAC 签名令牌（用 service_role 密钥签名），
//     之后每次请求在 x-admin-token 头携带；无状态、可跨实例。
//   - 启动首次调用会幂等建 blacklist 表 + anon 只读策略（供前端拉黑判定）。
// 前端：admin-web/index.html，通过 supabase.functions.invoke('admin-api', ...) 调用。
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN_PW = Deno.env.get('ADMIN_PW') || 'admin123'
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000 // 令牌有效期 8 小时

const supabase = createClient(SUPABASE_URL, SRK, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const ALLOWED_TABLES = ['manholes', 'comments', 'reports']
const ALLOWED_STATUS = ['pending', 'approved', 'rejected']
const ID_RE = /^(\d{1,20}|[0-9a-fA-F-]{36})$/
const DEVICE_RE = /^d_[a-z0-9_]+$/i

// ---------- 工具：base64url + HMAC 令牌 ----------
function b64urlEncodeBytes(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function hmacSign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SRK), { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return b64urlEncodeBytes(new Uint8Array(sig))
}
async function issueToken(): Promise<string> {
  const exp = Date.now() + TOKEN_TTL_MS
  const sig = await hmacSign(String(exp))
  return `${exp}.${sig}`
}
async function verifyToken(token: string | null): Promise<boolean> {
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot < 0) return false
  const exp = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expect = await hmacSign(exp)
  const a = new TextEncoder().encode(sig)
  const b = new TextEncoder().encode(expect)
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]
  if (r !== 0) return false
  const expNum = Number(exp)
  return Number.isFinite(expNum) && expNum > Date.now()
}

// ---------- 工具：响应 ----------
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-admin-token, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }
}
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' }
  })
}

// ---------- 黑名单表初始化（幂等，依赖 supabase_blacklist.sql 中定义的 RPC）----------
let blacklistReady = false
async function ensureBlacklist() {
  if (blacklistReady) return
  blacklistReady = true // 只尝试一次，避免每次请求都打 RPC
  try {
    // ensure_blacklist_tables 由 supabase_blacklist.sql 创建（SECURITY DEFINER，幂等建表 + 配 anon 只读策略）
    const { error } = await supabase.rpc('ensure_blacklist_tables' as any)
    if (error) throw error
    console.log('✅ blacklist 黑名单表已就绪（或已存在）')
  } catch (e) {
    console.warn('⚠️ blacklist 初始化失败：请先在 Supabase SQL Editor 执行 supabase_blacklist.sql。拉黑功能将不可用。', (e as Error).message)
  }
}

// ---------- 拉黑联动：隐藏/恢复留言 ----------
async function hideCommentsByDevices(ids: string[]): Promise<number> {
  if (!ids.length) return 0
  const { count, error } = await supabase
    .from('comments')
    .update({ status: 'rejected' })
    .in('uploader_device_id', ids)
    .neq('status', 'deleted')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count || 0
}
async function unhideCommentsByDevices(ids: string[]): Promise<number> {
  if (!ids.length) return 0
  const { count, error } = await supabase
    .from('comments')
    .update({ status: 'approved' })
    .in('uploader_device_id', ids)
    .eq('status', 'rejected')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count || 0
}

// 彻底删除井盖时清理 Storage 图片
async function cleanupManholeImage(id: number) {
  try {
    const { data } = await supabase.from('manholes').select('image_url').eq('id', id).single()
    const url = data && (data as any).image_url
    if (!url) return
    const m = String(url).match(/\/manhole-images\/(.+)$/)
    if (!m) return
    await supabase.storage.from('manhole-images').remove([m[1]])
    console.log('🧹 已清理图片：', m[1])
  } catch (e) {
    console.warn('⚠️ 图片清理失败（已跳过）：', (e as Error).message)
  }
}

async function requireAuth(req: Request): Promise<boolean> {
  const t = req.headers.get('x-admin-token')
  return await verifyToken(t)
}

// ---------- 主入口 ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
  try {
    let body: any = {}
    try { body = await req.json() } catch { body = {} }
    const action = body.action

    // 登录（无需令牌）
    if (action === 'login') {
      const pw = body.password || ''
      if (pw !== ADMIN_PW) return json({ error: '口令错误' }, 401)
      const token = await issueToken()
      return json({ ok: true, token, expiresIn: TOKEN_TTL_MS })
    }

    // 其余接口鉴权
    const authed = await requireAuth(req)
    if (!authed) return json({ error: '未登录或登录已过期' }, 401)

    switch (action) {
      // 全部内容（所有状态）
      case 'list': {
        const table = body.table
        if (!ALLOWED_TABLES.includes(table)) return json({ error: 'bad table' }, 400)
        const { data, error } = await supabase
          .from(table).select('*').order('created_at', { ascending: false }).limit(500)
        if (error) return json({ error: error.message }, 500)
        return json({ rows: data || [] })
      }
      // 举报列表
      case 'reports': {
        const { data, error } = await supabase
          .from('reports').select('*').order('created_at', { ascending: false }).limit(200)
        if (error) return json({ error: error.message }, 500)
        return json({ rows: data || [] })
      }
      // 留言筛选：按用户名 或 关联井盖编号
      case 'commentsFilter': {
        const filter = body.filter
        const value = body.value
        let query = supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(1000)
        if (filter === 'user' && value) query = query.eq('display_name', value)
        else if (filter === 'manhole' && /^\d{1,20}$/.test(String(value))) query = query.eq('manhole_id', Number(value))
        else return json({ error: 'bad filter' }, 400)
        const { data, error } = await query
        if (error) return json({ error: error.message }, 500)
        return json({ rows: data || [], filter, value })
      }
      // 有留言的井盖编号汇总（编号 + 留言数 + 最近留言时间，倒序）
      case 'commentsByManhole': {
        const { data, error } = await supabase
          .from('comments').select('manhole_id, created_at').not('manhole_id', 'is', null)
        if (error) return json({ error: error.message }, 500)
        const map = new Map<number, { count: number; last: string }>()
        for (const r of (data || []) as any[]) {
          const mid = Number(r.manhole_id)
          if (!mid) continue
          const cur = map.get(mid) || { count: 0, last: '' }
          cur.count++
          const t = r.created_at || ''
          if (t > cur.last) cur.last = t
          map.set(mid, cur)
        }
        const rows = [...map.entries()]
          .map(([manhole_id, v]) => ({ manhole_id, comment_count: v.count, last_comment_at: v.last }))
          .sort((a, b) => (b.last_comment_at > a.last_comment_at ? 1 : -1))
        return json({ rows })
      }
      // 批量操作留言：按设备ID组(user) 或 井盖编号(manhole) 整批 隐藏(rejected)/软删(deleted)
      case 'bulkComments': {
        const { action: bact, deviceIds, manholeId } = body
        if (!['hide', 'delete'].includes(bact)) return json({ error: 'bad action' }, 400)
        const status = bact === 'hide' ? 'rejected' : 'deleted'
        let q = supabase.from('comments').update({ status })
        if (Array.isArray(deviceIds) && deviceIds.length) {
          const ids = deviceIds.filter((d: any) => typeof d === 'string' && DEVICE_RE.test(d))
          if (!ids.length) return json({ error: 'bad deviceIds' }, 400)
          q = q.in('uploader_device_id', ids)
        } else if (manholeId != null && /^\d{1,20}$/.test(String(manholeId))) {
          q = q.eq('manhole_id', Number(manholeId))
        } else {
          return json({ error: 'bad scope' }, 400)
        }
        const { count, error } = await q.select('*', { count: 'exact', head: true })
        if (error) return json({ error: error.message }, 500)
        return json({ updated: count || 0 })
      }
      // 黑名单列表
      case 'blacklistList': {
        await ensureBlacklist()
        const { data, error } = await supabase
          .from('blacklist').select('device_id, added_at, note, added_by').order('added_at', { ascending: false }).limit(500)
        if (error) return json({ error: error.message }, 500)
        return json({ rows: data || [] })
      }
      // 加入黑名单（批量设备ID；已存在则忽略）+ 自动隐藏其全部留言
      case 'blacklistAdd': {
        await ensureBlacklist()
        const ids = Array.isArray(body.deviceIds)
          ? body.deviceIds.filter((d: any) => typeof d === 'string' && DEVICE_RE.test(d))
          : []
        if (!ids.length) return json({ error: 'bad deviceIds' }, 400)
        const note = String(body.note || '').slice(0, 200)
        const addedBy = String(body.addedBy || 'admin').slice(0, 50)
        const rows = ids.map((device_id: string) => ({ device_id, note, added_by: addedBy }))
        const { error } = await supabase
          .from('blacklist').upsert(rows, { onConflict: 'device_id', ignoreDuplicates: true })
        if (error) return json({ error: error.message }, 500)
        let hidden = 0
        try { hidden = await hideCommentsByDevices(ids) } catch (e) { console.warn('⚠️ 拉黑隐藏留言失败：', (e as Error).message) }
        return json({ inserted: ids.length, hidden })
      }
      // 移除黑名单（恢复访问）+ 自动恢复其被隐藏留言
      case 'blacklistRemove': {
        await ensureBlacklist()
        const id = body.deviceId
        if (typeof id !== 'string' || !DEVICE_RE.test(id)) return json({ error: 'bad deviceId' }, 400)
        let restored = 0
        try { restored = await unhideCommentsByDevices([id]) } catch (e) { console.warn('⚠️ 解除拉黑恢复留言失败：', (e as Error).message) }
        const { error } = await supabase.from('blacklist').delete().eq('device_id', id)
        if (error) return json({ error: error.message }, 500)
        return json({ deleted: 1, restored })
      }
      // 修改状态：公开(approved) / 隐藏(rejected)
      case 'setStatus': {
        const { table, id, status } = body
        if (!ALLOWED_TABLES.includes(table)) return json({ error: 'bad table' }, 400)
        if (!ALLOWED_STATUS.includes(status)) return json({ error: 'bad status' }, 400)
        if (typeof id !== 'string' || !ID_RE.test(id)) return json({ error: 'bad id' }, 400)
        const { count, error } = await supabase
          .from(table).update({ status }).eq('id', Number(id)).select('*', { count: 'exact', head: true })
        if (error) return json({ error: error.message }, 500)
        return json({ updated: count || 0 })
      }
      // 软删除：标记 status='deleted'
      case 'softDelete': {
        const { table, id } = body
        if (!ALLOWED_TABLES.includes(table)) return json({ error: 'bad table' }, 400)
        if (typeof id !== 'string' || !ID_RE.test(id)) return json({ error: 'bad id' }, 400)
        const { count, error } = await supabase
          .from(table).update({ status: 'deleted' }).eq('id', Number(id)).select('*', { count: 'exact', head: true })
        if (error) return json({ error: error.message }, 500)
        return json({ deleted: count || 0 })
      }
      // 彻底删除：物理移除记录（及井盖图片）
      case 'purge': {
        const { table, id } = body
        if (!ALLOWED_TABLES.includes(table)) return json({ error: 'bad table' }, 400)
        if (typeof id !== 'string' || !ID_RE.test(id)) return json({ error: 'bad id' }, 400)
        if (table === 'manholes') await cleanupManholeImage(Number(id))
        const { count, error } = await supabase
          .from(table).delete().eq('id', Number(id)).select('*', { count: 'exact', head: true })
        if (error) return json({ error: error.message }, 500)
        return json({ deleted: count || 0 })
      }
      default:
        return json({ error: 'unknown action' }, 400)
    }
  } catch (e) {
    console.error(e)
    return json({ error: String((e as Error).message || e) }, 500)
  }
})
