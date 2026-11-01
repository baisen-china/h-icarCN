// 百度地图（Baidu Map）Web 端配置
// 申请地址：https://lbsyun.baidu.com/apiconsole/key
//   → 创建应用 → 应用类型选「浏览器端」→ 勾选「JavaScript API」与「地理编码服务」
// ⚠️ 请替换为你的真实 AK 后再使用地图功能。
//    百度 JS API 基础配额免费，但必须注册 AK；未填 AK 时地图页会提示加载失败（勋章功能不受影响）。
export const BAIDU_AK = 'uUFMSAUZJInybo9NwLD3YteojJvpQJb9'

let _p = null
// 动态加载百度地图 JS API（仅 H5 可用），返回 window.BMap
export function loadBMap() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('当前环境不支持百度地图 JS API（仅 H5 可用）'))
  }
  if (window.BMap) return Promise.resolve(window.BMap)
  if (_p) return _p

  _p = new Promise((resolve, reject) => {
    window.__bmapInit = () => {
      if (window.BMap) resolve(window.BMap)
      else reject(new Error('百度地图初始化失败'))
    }
    const s = document.createElement('script')
    s.type = 'text/javascript'
    s.src = `https://api.map.baidu.com/api?v=3.0&ak=${BAIDU_AK}&callback=__bmapInit`
    s.onerror = () => reject(new Error('百度地图脚本加载失败，请检查 AK 或网络'))
    document.head.appendChild(s)
  })
  return _p
}
