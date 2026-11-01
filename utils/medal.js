// 计算「最老井盖」勋章：按安装年份算出年龄，年龄最大的前 3 名分别获得 👑 / 🥈 / 🥉
// 输入：已审核井盖数组（含 install_year、created_at）
// 输出：{ [id]: { rank, icon, age } }
export function computeMedals(list, currentYear) {
  const yr = currentYear || new Date().getFullYear()
  const icons = { 1: '👑', 2: '🥈', 3: '🥉' }
  const ranked = (list || [])
    .filter(m => m && m.install_year)
    .map(m => ({ m, age: yr - Number(m.install_year) }))
    .sort((a, b) => {
      if (b.age !== a.age) return b.age - a.age          // 年龄大的在前
      if (a.m.install_year !== b.m.install_year) return a.m.install_year - b.m.install_year
      return (a.m.created_at < b.m.created_at) ? -1 : 1
    })
  const out = {}
  ranked.slice(0, 3).forEach(({ m, age }, i) => {
    out[m.id] = { rank: i + 1, icon: icons[i + 1], age }
  })
  return out
}
