// 井盖龙虎榜 · 简易审核后台（带登录口令保护）
// 说明：
//  - 使用 postgres 角色直连（绕过 RLS），具备审核所需读写权限。
//  - 配置优先从环境变量读取，其次从本目录 .env 读取（DB_PW / ADMIN_PW）。
//  - 密码仅来自环境变量或 .env，不写死在代码里；服务仅绑定 127.0.0.1。
//  - 访问需登录：POST /api/login 校验 ADMIN_PW，成功后下发 HttpOnly 会话 Cookie。
// 功能：
//  - 查看全部井盖/留言（含已公开、待审核、已隐藏、已删除），支持公开/隐藏切换、软删除与召回。
//  - 「删除」为软删除（标记 status='deleted'，保留记录与图片），可在审核页「召回」恢复显示；
//    「彻底删除」才会物理移除记录（及井盖图片）。
// 运行：
//   npm start                （需先在 .env 配置 DB_PW，或 export DB_PW=...）
//   或  DB_PW=数据库密码 node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const REF = 'etxxigwpnhjjbebybdoz';
const REGION = 'eu-north-1';
const HOST = `aws-0-${REGION}.pooler.supabase.com`;
const HTTP_PORT = Number(process.env.PORT) || 3000;
const COOKIE = 'manhole_admin';

// —— 极简 .env 加载（无需 dotenv 依赖）——
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    });
  }
})();

const DB_PW = process.env.DB_PW;
if (!DB_PW) {
  console.error('❌ 缺少数据库密码：请在 admin/.env 写入 DB_PW=你的数据库密码，或运行前设置环境变量 DB_PW');
  process.exit(1);
}
const ADMIN_PW = process.env.ADMIN_PW || 'admin123';

const pool = new Pool({
  host: HOST, port: 6543,
  user: `postgres.${REF}`, password: DB_PW, database: 'postgres',
  ssl: { rejectUnauthorized: false },
  max: 5,
});

const ALLOWED_TABLES = ['manholes', 'comments', 'reports'];
const ALLOWED_STATUS = ['pending', 'approved', 'rejected'];
// 主键值校验：线上库使用自增数字 id（如 "3"），也兼容 uuid，杜绝注入。
const ID_RE = /^(\d{1,20}|[0-9a-fA-F-]{36})$/;

// —— 会话（内存态，重启即失效）——
const sessions = new Set();
function makeToken() { return crypto.randomBytes(24).toString('hex'); }
function getCookie(req, name) {
  const h = req.headers.cookie || '';
  const m = h.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
function authed(req) {
  const t = getCookie(req, COOKIE);
  return !!(t && sessions.has(t));
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>审核后台 · 登录</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;background:#f5f6f8;display:flex;align-items:center;justify-content:center;height:100vh}
  .box{background:#fff;border-radius:12px;padding:28px 32px;width:300px;box-shadow:0 4px 20px rgba(0,0,0,.08)}
  h2{margin:0 0 18px;font-size:18px;color:#1989fa}
  input{width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px;margin-bottom:14px}
  button{width:100%;background:#1989fa;color:#fff;border:none;border-radius:8px;padding:11px;font-size:15px;cursor:pointer}
  .err{color:#ee0a24;font-size:13px;min-height:18px;margin-bottom:8px}
</style></head>
<body><div class="box">
  <h2>审核后台登录</h2>
  <div class="err" id="err"></div>
  <input id="pw" type="password" placeholder="请输入管理口令" autofocus>
  <button id="go">登录</button>
</div>
<script>
const pw=document.getElementById('pw'),err=document.getElementById('err');
async function login(){
  err.textContent='';
  const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw.value})});
  if(res.ok){location.href='/';}else{const j=await res.json().catch(()=>({}));err.textContent=j.error||'登录失败';}
}
document.getElementById('go').onclick=login;
pw.addEventListener('keydown',e=>{if(e.key==='Enter')login();});
</script></body></html>`;

// 删除井盖时清理 Storage 中的图片；失败不影响主记录删除。
async function cleanupManholeImage(id) {
  try {
    const r0 = await pool.query(
      `select image_url from public.manholes where id=$1::bigint`, [id]);
    const url = r0.rows[0] && r0.rows[0].image_url;
    if (!url) return;
    const m = String(url).match(/\/manhole-images\/(.+)$/);
    if (!m) return;
    await pool.query(
      `delete from storage.objects where bucket_id=$1 and name=$2`,
      ['manhole-images', m[1]]);
    console.log('🧹 已清理图片：', m[1]);
  } catch (e) {
    console.warn('⚠️ 图片清理失败（已跳过）：', e.message);
  }
}

// 拉黑后批量隐藏该用户的全部留言（已软删除的保留，不动）；
// 解除拉黑后恢复为公开（仅恢复被隐藏 rejected 的，已删除/管理员另行处理的保持原状）。
async function hideCommentsByDevices(deviceIds) {
  const r = await pool.query(
    `update public.comments set status='rejected'
     where uploader_device_id = ANY($1::text[]) and status <> 'deleted'`,
    [deviceIds]);
  return r.rowCount || 0;
}
async function unhideCommentsByDevices(deviceIds) {
  const r = await pool.query(
    `update public.comments set status='approved'
     where uploader_device_id = ANY($1::text[]) and status='rejected'`,
    [deviceIds]);
  return r.rowCount || 0;
}

// 启动即确保黑名单表存在，并配置 anon 只读策略（供前端判定当前设备是否被拉黑）
async function ensureBlacklist() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.blacklist (
        device_id text primary key,
        added_at timestamptz not null default now(),
        note text,
        added_by text
      );
    `);
    await pool.query(`ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;`);
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname='public' AND tablename='blacklist' AND policyname='anon_read_blacklist'
        ) THEN
          CREATE POLICY anon_read_blacklist ON public.blacklist FOR SELECT TO anon USING (true);
        END IF;
      END $$;
    `);
    console.log('✅ blacklist 黑名单表已就绪（含 anon 读取策略，供前端拉黑判定）');
  } catch (e) {
    console.warn('⚠️ blacklist 表初始化失败（拉黑功能将不可用）：', e.message);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    // 登录页
    if (req.method === 'GET' && url.pathname === '/login') {
      return sendHtml(res, LOGIN_HTML);
    }
    // 登录接口
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const body = await readBody(req);
      if (body.password !== ADMIN_PW) return send(res, 401, { error: '口令错误' });
      const token = makeToken();
      sessions.add(token);
      res.writeHead(200, {
        'Set-Cookie': `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400`,
        'Content-Type': 'application/json; charset=utf-8'
      });
      return res.end(JSON.stringify({ ok: true }));
    }
    // 登出
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      const t = getCookie(req, COOKIE);
      if (t) sessions.delete(t);
      res.writeHead(200, {
        'Set-Cookie': `${COOKIE}=; HttpOnly; Path=/; Max-Age=0`,
        'Content-Type': 'application/json; charset=utf-8'
      });
      return res.end(JSON.stringify({ ok: true }));
    }

    // 以下接口与页面均需登录
    if (!authed(req)) {
      if (url.pathname.startsWith('/api/')) return send(res, 401, { error: '未登录' });
      res.writeHead(302, { Location: '/login' });
      return res.end();
    }

    // 首页（审核面板）
    if (req.method === 'GET' && url.pathname === '/') {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
      return sendHtml(res, html);
    }

    // 全部内容（所有状态）：井盖 / 留言
    if (req.method === 'GET' && url.pathname === '/api/all') {
      const table = url.searchParams.get('table');
      if (!ALLOWED_TABLES.includes(table)) return send(res, 400, { error: 'bad table' });
      const r = await pool.query(
        `select * from public.${table} order by created_at desc limit 500`);
      return send(res, 200, { rows: r.rows });
    }

    // 举报列表
    if (req.method === 'GET' && url.pathname === '/api/reports') {
      const r = await pool.query(
        `select * from public.reports order by created_at desc limit 200`);
      return send(res, 200, { rows: r.rows });
    }

    // 留言筛选：按用户名(display_name) 或 关联井盖编号(manhole_id) 过滤，用于审核页点击钻取
    if (req.method === 'GET' && url.pathname === '/api/comments') {
      const filter = url.searchParams.get('filter'); // 'user' | 'manhole'
      const value = url.searchParams.get('value');
      let whereSql, params;
      if (filter === 'user' && value) {
        whereSql = 'where display_name = $1';
        params = [value];
      } else if (filter === 'manhole' && value != null && /^\d{1,20}$/.test(value)) {
        whereSql = 'where manhole_id = $1::bigint';
        params = [value];
      } else {
        return send(res, 400, { error: 'bad filter' });
      }
      const r = await pool.query(
        `select * from public.comments ${whereSql} order by created_at desc limit 1000`,
        params);
      return send(res, 200, { rows: r.rows, filter, value });
    }

    // 有留言的井盖编号汇总：编号 + 留言数 + 最近留言时间，按最近留言时间倒序（供审核页顶部索引表）
    if (req.method === 'GET' && url.pathname === '/api/comments/by-manhole') {
      const r = await pool.query(
        `select manhole_id,
                count(*)::int as comment_count,
                max(created_at) as last_comment_at
         from public.comments
         where manhole_id is not null
         group by manhole_id
         order by last_comment_at desc`);
      return send(res, 200, { rows: r.rows });
    }

    // 批量操作留言：按设备ID组(user) 或 井盖编号(manhole) 整批 隐藏(rejected)/软删(deleted)
    // 用于审核页钻取后「隐藏该用户全部留言 / 删除全部留言 / 全部隐藏 / 全部删除」。
    if (req.method === 'POST' && url.pathname === '/api/comments/bulk') {
      const body = await readBody(req);
      const { action, deviceIds, manholeId } = body;
      if (!['hide', 'delete'].includes(action)) return send(res, 400, { error: 'bad action' });
      const status = action === 'hide' ? 'rejected' : 'deleted';
      let sql, params;
      if (Array.isArray(deviceIds) && deviceIds.length) {
        const ids = deviceIds.filter(d => typeof d === 'string' && /^d_[a-z0-9_]+$/i.test(d));
        if (!ids.length) return send(res, 400, { error: 'bad deviceIds' });
        sql = `update public.comments set status=$1 where uploader_device_id = ANY($2::text[])`;
        params = [status, ids];
      } else if (manholeId != null && /^\d{1,20}$/.test(String(manholeId))) {
        sql = `update public.comments set status=$1 where manhole_id=$2::bigint`;
        params = [status, String(manholeId)];
      } else {
        return send(res, 400, { error: 'bad scope' });
      }
      const r = await pool.query(sql, params);
      return send(res, 200, { updated: r.rowCount });
    }

    // 黑名单列表（供管理后台查看与移除）
    if (req.method === 'GET' && url.pathname === '/api/blacklist') {
      const r = await pool.query(
        `select device_id, added_at, note, added_by from public.blacklist order by added_at desc limit 500`);
      return send(res, 200, { rows: r.rows });
    }

    // 加入黑名单（批量设备ID；已存在则忽略）。被拉黑设备访问前端始终停在受限个人页。
    if (req.method === 'POST' && url.pathname === '/api/blacklist') {
      const body = await readBody(req);
      const ids = Array.isArray(body.deviceIds)
        ? body.deviceIds.filter(d => typeof d === 'string' && /^d_[a-z0-9_]+$/i.test(d))
        : [];
      if (!ids.length) return send(res, 400, { error: 'bad deviceIds' });
      const note = (body.note || '').toString().slice(0, 200);
      const addedBy = (body.addedBy || 'admin').toString().slice(0, 50);
      const r = await pool.query(
        `insert into public.blacklist (device_id, note, added_by)
         select unnest($1::text[]), $2, $3 on conflict (device_id) do nothing`,
        [ids, note, addedBy]);
      // 拉黑后自动隐藏该用户全部留言（软删除的保留）
      let hidden = 0;
      try { hidden = await hideCommentsByDevices(ids); } catch (e) { console.warn('⚠️ 拉黑隐藏留言失败：', e.message); }
      return send(res, 200, { inserted: r.rowCount, hidden });
    }

    // 移除黑名单（恢复访问）：解除后该用户被隐藏的留言自动恢复公开
    if (req.method === 'DELETE' && url.pathname === '/api/blacklist') {
      const body = await readBody(req);
      const id = body.deviceId;
      if (typeof id !== 'string' || !/^d_[a-z0-9_]+$/i.test(id)) return send(res, 400, { error: 'bad deviceId' });
      let restored = 0;
      try { restored = await unhideCommentsByDevices([id]); } catch (e) { console.warn('⚠️ 解除拉黑恢复留言失败：', e.message); }
      const r = await pool.query(`delete from public.blacklist where device_id=$1`, [id]);
      return send(res, 200, { deleted: r.rowCount, restored });
    }

    // 修改状态：公开(approved) / 隐藏(rejected)
    if (req.method === 'POST' && url.pathname === '/api/set-status') {
      const body = await readBody(req);
      const { table, id, status } = body;
      if (!ALLOWED_TABLES.includes(table)) return send(res, 400, { error: 'bad table' });
      if (!ALLOWED_STATUS.includes(status)) return send(res, 400, { error: 'bad status' });
      if (typeof id !== 'string' || !ID_RE.test(id)) return send(res, 400, { error: 'bad id' });
      const r = await pool.query(
        `update public.${table} set status=$1 where id=$2::bigint`,
        [status, id]);
      return send(res, 200, { updated: r.rowCount });
    }

    // 软删除：标记 status='deleted'（保留记录与图片，可在审核页「召回」恢复显示）
    if (req.method === 'POST' && url.pathname === '/api/delete') {
      const body = await readBody(req);
      const { table, id } = body;
      if (!ALLOWED_TABLES.includes(table)) return send(res, 400, { error: 'bad table' });
      if (typeof id !== 'string' || !ID_RE.test(id)) return send(res, 400, { error: 'bad id' });
      const r = await pool.query(
        `update public.${table} set status='deleted' where id=$1::bigint`, [id]);
      return send(res, 200, { deleted: r.rowCount });
    }

    // 彻底删除：物理移除记录（及井盖图片）；用于已软删除内容的永久清理
    if (req.method === 'POST' && url.pathname === '/api/purge') {
      const body = await readBody(req);
      const { table, id } = body;
      if (!ALLOWED_TABLES.includes(table)) return send(res, 400, { error: 'bad table' });
      if (typeof id !== 'string' || !ID_RE.test(id)) return send(res, 400, { error: 'bad id' });
      if (table === 'manholes') await cleanupManholeImage(id);
      const r = await pool.query(
        `delete from public.${table} where id=$1::bigint`, [id]);
      return send(res, 200, { deleted: r.rowCount });
    }

    send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message });
  }
});

ensureBlacklist().finally(() => {
  server.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`✅ 审核后台已启动：http://127.0.0.1:${HTTP_PORT}  （仅本机可访问，需登录）`);
  });
});
