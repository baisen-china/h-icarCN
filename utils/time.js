// 时间格式化（时区安全，适配 H5 / 小程序 / App）
// Supabase timestamptz 返回的是带 UTC 偏移的 ISO 字符串（如 …Z 或 …+00:00）。
// 若不转换直接展示，中国用户会看到比北京时间慢 8 小时的 UTC 时间。
// 这里把时间戳换算成北京时间（UTC+8）后再取出「时/分/秒」字段，
// 完全不依赖 Intl/timeZone，小程序环境也能稳定工作。

export function formatBeijing(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) {
    // 解析失败则原样截断，避免整段报错
    return String(iso).slice(0, 16).replace('T', ' ')
  }
  // 把 UTC 瞬间整体 +8 小时，再用 UTC 字段读出 → 即北京时间墙钟时间
  const bj = new Date(d.getTime() + 8 * 3600 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return (
    bj.getUTCFullYear() +
    '-' + p(bj.getUTCMonth() + 1) +
    '-' + p(bj.getUTCDate()) +
    ' ' + p(bj.getUTCHours()) +
    ':' + p(bj.getUTCMinutes())
  )
}

export function formatBeijingDate(iso) {
  const s = formatBeijing(iso)
  return s ? s.slice(0, 10) : ''
}
