// ============================================================================
// 井盖龙虎榜 — 人工审核 Edge Function（纯人工审核，无云端内容审核）
// 部署：supabase functions deploy moderate
// 说明：SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY 由平台自动注入，无需设置。
// 逻辑：service_role 插入记录（force_pending 触发器自动置为 pending），
//       返回 pending，等待管理后台人工审核。不调用任何付费内容审核服务。
// 备注：当前前端 utils/moderate.js 已改为直接入库（同样走 force_pending 触发器），
//       本函数仅在仍部署且被调用时作为等效后端入口存在，逻辑一致。
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ---------- 工具 ----------
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }
}
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' }
  })
}

// ---------- 主流程（纯人工审核）----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
  try {
    const { type, payload } = await req.json()
    if (type !== 'manhole' && type !== 'comment') return json({ error: 'bad type' }, 400)

    let id: number
    let table: string

    if (type === 'manhole') {
      const row = {
        image_url: payload.image_url ?? null,
        province: payload.province ?? null,
        city: payload.city ?? null,
        district: payload.district ?? null,
        install_year: payload.install_year ?? null,
        material: payload.material ?? null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        uploader_device_id: payload.uploader_device_id ?? null
      }
      const { data, error } = await supabase.from('manholes').insert(row).select('id').single()
      if (error) return json({ error: error.message }, 500)
      id = data.id
      table = 'manholes'
    } else {
      const row = {
        manhole_id: Number(payload.manhole_id),
        content: payload.content,
        parent_id: payload.parent_id ?? null,
        display_name: payload.display_name ?? null,
        uploader_device_id: payload.uploader_device_id ?? null
      }
      const { data, error } = await supabase.from('comments').insert(row).select('id').single()
      if (error) return json({ error: error.message }, 500)
      id = data.id
      table = 'comments'
    }

    // force_pending 触发器会将 status 置为 pending，这里保持返回语义一致。
    await supabase.from(table).update({ status: 'pending' }).eq('id', id)

    return json({ id, status: 'pending' })
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})
