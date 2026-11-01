// 坐标与定位工具
// 百度地图为 BD-09 坐标系；浏览器/手机 GPS 返回 WGS-84，需转换后才能在百度地图上准确打点。

const PI = Math.PI
const A = 6378245.0 // 长半轴
const EE = 0.00669342162296594323 // 偏心率平方

function outOfChina(lng, lat) {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55)
}
function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
  return ret
}
function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
  return ret
}

export function wgs84ToGcj02(lng, lat) {
  if (outOfChina(lng, lat)) return [lng, lat]
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = lat / 180.0 * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI)
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI)
  return [lng + dLng, lat + dLat]
}

export function gcj02ToBd09(lng, lat) {
  const x = lng, y = lat
  const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * PI)
  const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * PI)
  return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006]
}

export function wgs84ToBd09(lng, lat) {
  const [glng, glat] = wgs84ToGcj02(lng, lat)
  return gcj02ToBd09(glng, glat)
}

// 定位到「我的当前位置」，返回 BD-09 经纬度 { lng, lat }
// 优先使用百度地图自带的 BMap.Geolocation（直接返回 BD-09，且自带 IP 兜底，
// 比裸浏览器 navigator.geolocation 稳定得多，尤其在非 HTTPS 环境下）。
// 当且仅当百度定位不可用时，才退回浏览器 HTML5 定位并自行做 WGS-84→BD-09 转换。
export function locateBaiduPoint(BMap) {
  return new Promise((resolve, reject) => {
    if (BMap && typeof BMap.Geolocation === 'function') {
      try {
        const geo = new BMap.Geolocation()
        geo.getCurrentPosition(function (r) {
          // 注意：用普通函数，让 this 指向 geolocation 实例以读取 getStatus()
          const status = (this && this.getStatus) ? this.getStatus() : -1
          if (status === 0 && r && r.point) {
            resolve({ lng: r.point.lng, lat: r.point.lat })
          } else {
            // 百度定位失败（权限/超时/不支持）→ 退回浏览器定位
            fallbackBrowser(resolve, reject)
          }
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
        return
      } catch (e) {
        /* 落到下面的浏览器定位 */
      }
    }
    fallbackBrowser(resolve, reject)
  })
}

function fallbackBrowser(resolve, reject) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return reject(new Error('当前环境不支持定位（需 HTTPS 或百度定位）'))
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { longitude, latitude } = pos.coords
      const [lng, lat] = wgs84ToBd09(longitude, latitude)
      resolve({ lng, lat })
    },
    (err) => reject(new Error('定位失败：' + geoErrMsg(err))),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  )
}

function geoErrMsg(err) {
  if (!err) return '未知原因'
  if (err.code === 1) return '权限被拒绝'
  if (err.code === 2) return '位置不可用'
  if (err.code === 3) return '超时（请检查网络或重试）'
  return err.message || '未知原因'
}
