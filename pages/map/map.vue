<template>
  <view class="page">
    <view class="map-wrap">
      <!-- H5：百度地图 JS API -->
      <!-- #ifdef H5 -->
      <view id="bmap" class="bmap"></view>
      <!-- #endif -->

      <!-- 非 H5：原生 map 组件 + 列表兜底 -->
      <!-- #ifndef H5 -->
      <map
        v-if="mpMarkers.length"
        class="mp-map"
        :latitude="center.lat"
        :longitude="center.lng"
        :scale="zoom"
        :markers="mpMarkers"
        show-location
        @markertap="onMarkerTap"
      ></map>
      <view class="tip" v-if="err">{{ err }}</view>
      <!-- #endif -->

      <!-- 定位按钮（两类端都显示）：定位到我的当前位置 -->
      <view class="locate-fab" @click="locateMe" title="定位我的位置">
        <view class="aim"><view class="aim-ring"></view><view class="aim-h"></view><view class="aim-v"></view></view>
      </view>

      <!-- 非 H5 缩放按钮（原生地图无内置缩放控件，提供 +/- 收放尺） -->
      <!-- #ifndef H5 -->
      <view class="zoom-fab">
        <view class="zbtn" @click="zoomIn">＋</view>
        <view class="zbtn" @click="zoomOut">－</view>
      </view>
      <!-- #endif -->
    </view>

    <view class="legend">
      <text class="lg">👑 最老</text>
      <text class="lg">🥈 第二</text>
      <text class="lg">🥉 第三</text>
    </view>

    <view class="mlist">
      <view class="mcard" v-for="m in displayList" :key="m.id" @click="goDetail(m)">
        <text class="mi">{{ medalIcon(m) }}</text>
        <view class="mc">
          <text class="mt">📍 {{ m.province || '未知' }} {{ m.city || '' }} {{ m.district || '' }}</text>
          <text class="ms">年份：{{ m.install_year || '未知' }} ｜ 年龄：{{ m.install_year ? (currentYear - m.install_year) : '?' }} 年</text>
        </view>
      </view>
    </view>
    <view class="empty" v-if="!displayList.length">暂无已审核的井盖</view>
  </view>
</template>

<script>
import { supabase } from '@/utils/supabase.js'
import { computeMedals } from '@/utils/medal.js'
import { locateBaiduPoint } from '@/utils/geo.js'
// #ifdef H5
import { loadBMap } from '@/utils/mapConfig.js'
// #endif

export default {
  data() {
    return {
      all: [],
      medals: {},
      currentYear: new Date().getFullYear(),
      center: { lat: 35, lng: 104 },
      zoom: 12,
      mpMarkers: [],
      err: '',
      displayList: [],
      focusId: null,
      _map: null,
      _BMap: null
    }
  },
  onLoad(opt) {
    this.focusId = opt && opt.id ? opt.id : null
    this.load()
  },
  methods: {
    medalIcon(m) {
      const md = this.medals[m.id]
      return md ? md.icon : '📍'
    },
    async load() {
      const { data } = await supabase
        .from('manholes').select('*').eq('status', 'approved').limit(1000)
      this.all = data || []
      this.medals = computeMedals(this.all, this.currentYear)
      this.displayList = this.all.slice().sort((a, b) => {
        const ra = this.medals[a.id] ? this.medals[a.id].rank : 99
        const rb = this.medals[b.id] ? this.medals[b.id].rank : 99
        return ra - rb || (a.install_year || 9999) - (b.install_year || 9999)
      })
      // #ifdef H5
      this.initBaidu()
      // #endif
      // #ifndef H5
      this.buildMpMarkers()
      // #endif
    },
    goDetail(m) {
      uni.navigateTo({ url: '/pages/detail/detail?id=' + m.id })
    },

    // —— 非 H5（小程序/App）原生地图 ——
    // #ifndef H5
    // 说明：百度地图为 BD-09 坐标系；微信/App 原生 map 组件使用 GCJ-02，此处直传会有数百米偏移。
    // 建议优先使用 H5 端查看百度地图，或在上传时用 H5 端选点（坐标已统一为 BD-09）。
    buildMpMarkers() {
      const markers = []
      let i = 0
      for (const m of this.all) {
        if (m.latitude == null || m.longitude == null) continue
        const medal = this.medals[m.id]
        markers.push({
          id: i,
          latitude: +m.latitude,
          longitude: +m.longitude,
          iconPath: medal ? `/static/medal-${medal.rank}.png` : '/static/pin.png',
          width: 32,
          height: 32,
          _mid: m.id
        })
        i++
      }
      if (markers.length) this.center = { lat: markers[0].latitude, lng: markers[0].longitude }
      this.mpMarkers = markers
      if (!markers.length) this.err = '暂无可定位的井盖（请先在「上传」时选择位置）'
      if (this.focusId) {
        const fm = this.all.find(x => String(x.id) === String(this.focusId))
        if (fm && fm.latitude != null && fm.longitude != null) {
          this.center = { lat: +fm.latitude, lng: +fm.longitude }
        }
      }
    },
    zoomIn() { this.zoom = Math.min(20, this.zoom + 1) },
    zoomOut() { this.zoom = Math.max(3, this.zoom - 1) },
    onMarkerTap(e) {
      const mk = this.mpMarkers.find(x => x.id === e.detail.markerId)
      if (mk) this.goDetail({ id: mk._mid })
    },
    // #endif

    // —— 定位按钮：两类端通用 ——
    locateMe() {
      // #ifdef H5
      if (!this._map || !this._BMap) {
        return uni.showToast({ title: '地图尚未就绪', icon: 'none' })
      }
      uni.showLoading({ title: '定位中…' })
      locateBaiduPoint(this._BMap).then(({ lng, lat }) => {
        const BMap = this._BMap
        const pt = new BMap.Point(lng, lat)
        this._map.centerAndZoom(pt, 16)
        const mk = new BMap.Marker(pt)
        const label = new BMap.Label('我', { offset: new BMap.Size(-8, -28) })
        label.setStyle({ background: '#1989fa', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '8px', fontSize: '12px' })
        mk.setLabel(label)
        this._map.addOverlay(mk)
        uni.hideLoading()
      }).catch((e) => {
        uni.hideLoading()
        uni.showToast({ title: '定位失败：' + (e && e.message ? e.message : e), icon: 'none' })
      })
      // #endif
      // #ifndef H5
      uni.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.center = { lat: res.latitude, lng: res.longitude }
          this.zoom = Math.max(this.zoom, 14)
        },
        fail: () => uni.showToast({ title: '定位失败', icon: 'none' })
      })
      // #endif
    },

    // —— H5：百度地图 JS API ——
    // #ifdef H5
    async initBaidu() {
      try {
        const BMap = await loadBMap()
        const el = document.getElementById('bmap')
        if (!el) return
        const map = new BMap.Map(el)
        map.centerAndZoom(new BMap.Point(104, 35), 5)
        map.enableScrollWheelZoom(true)
        // 收放尺：缩放控件（+/- 按钮）
        try {
          const Small = (typeof BMAP_NAVIGATION_CONTROL_SMALL !== 'undefined') ? BMAP_NAVIGATION_CONTROL_SMALL : undefined
          map.addControl(new BMap.NavigationControl(Small !== undefined ? { type: Small } : {}))
        } catch (e) { /* 控件不可用不影响打点 */ }
        this._map = map
        this._BMap = BMap
        const myGeo = new BMap.Geocoder()
        let placed = 0
        const points = []

        for (const m of this.all) {
          let lng = (m.longitude != null) ? +m.longitude : null
          let lat = (m.latitude != null) ? +m.latitude : null
          let approx = false
          if (lng == null || lat == null) {
            const addr = [m.province, m.city, m.district].filter(Boolean).join('')
            const pt = await geocodeBaidu(myGeo, addr, m.province || m.city)
            if (!pt) continue
            lng = pt.lng; lat = pt.lat; approx = true
          }

          const medal = this.medals[m.id]
          const icon = medal ? medal.icon : (approx ? '📌' : '📍')
          const age = m.install_year ? (this.currentYear - m.install_year) : '?'
          const point = new BMap.Point(lng, lat)
          points.push(point)
          const marker = new BMap.Marker(point)
          // 用 Label 承载 emoji 图标，去掉默认白底
          const label = new BMap.Label(icon, { offset: new BMap.Size(-12, -24) })
          label.setStyle({
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            lineHeight: '1',
            color: '#000',
            padding: '0',
            boxShadow: 'none'
          })
          marker.setLabel(label)

          const html = `<div style="padding:8px;max-width:220px;font-size:13px">
            <div style="font-weight:bold;margin-bottom:4px">${icon} ${escapeHtml(m.province || '')} ${escapeHtml(m.city || '')}</div>
            <div style="color:#666;margin-bottom:6px">年龄：${age} 年${approx ? '（按地址估算）' : ''}</div>
            <div style="color:#1e88e5;cursor:pointer" data-go="${m.id}">查看详情 ›</div>
          </div>`
          marker.addEventListener('click', () => {
            const info = new BMap.InfoWindow(html, { width: 230, height: 92 })
            map.openInfoWindow(info, point)
          })
          map.addOverlay(marker)
          placed++
        }

        // 自动缩放到刚好包住所有井盖：单个点放大到街区级，多个点用 setViewport 自适应
        if (points.length === 1) {
          map.centerAndZoom(points[0], 15)
        } else if (points.length > 1) {
          map.setViewport(points, { enableAnimation: false })
        }
        // 若从详情页「在地图查看」带 id 进入，则聚焦到该井盖
        if (this.focusId) {
          const fm = this.all.find(x => String(x.id) === String(this.focusId))
          if (fm && fm.latitude != null && fm.longitude != null) {
            map.centerAndZoom(new BMap.Point(+fm.longitude, +fm.latitude), 16)
          }
        }
        // 信息窗内「查看详情」事件委托
        el.addEventListener('click', (ev) => {
          const t = ev.target.closest && ev.target.closest('[data-go]')
          if (t) uni.navigateTo({ url: '/pages/detail/detail?id=' + t.getAttribute('data-go') })
        })
        if (placed === 0) this.err = '暂无可定位的井盖：请先在「上传」时用「精确位置」选点（带坐标的井盖会直接上图并自动缩放）；旧的无坐标记录需到百度控制台为该 AK 启用「地理编码服务」后才能按地址定位。'
      } catch (e) {
        this.err = e.message || '地图加载失败'
      }
    }
    // #endif
  }
}
</script>

<style>
.page { background: #f5f5f5; min-height: 100vh; }
.map-wrap { position: relative; }
.bmap, .mp-map { width: 100%; height: 55vh; }
/* 定位按钮 */
.locate-fab {
  position: absolute; right: 12px; bottom: 92px;
  width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  background: #fff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,.25);
  font-size: 20px; z-index: 10;
}
/* 瞄准（crosshair）图标 */
.aim { position: relative; width: 22px; height: 22px; }
.aim-ring { position: absolute; left: 5px; top: 5px; width: 12px; height: 12px; border: 2px solid #333; border-radius: 50%; box-sizing: border-box; }
.aim-h { position: absolute; left: 0; top: 10px; width: 22px; height: 2px; background: #333; }
.aim-v { position: absolute; left: 10px; top: 0; width: 2px; height: 22px; background: #333; }
/* 非 H5 缩放按钮 */
.zoom-fab { position: absolute; right: 12px; bottom: 24px; z-index: 10; display: flex; flex-direction: column; }
.zbtn {
  width: 40px; height: 40px; line-height: 38px; text-align: center;
  background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.25);
  font-size: 22px; margin-bottom: 8px; color: #333;
}
.legend { display: flex; gap: 16px; padding: 10px 14px; font-size: 13px; color: #666; background: #fff; border-bottom: 1px solid #eee; }
.mlist { padding: 10px; }
.mcard { background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
.mi { font-size: 22px; }
.mc { display: flex; flex-direction: column; }
.mt { font-size: 14px; font-weight: bold; }
.ms { font-size: 12px; color: #666; }
.tip { color: #e67e22; font-size: 13px; padding: 10px 14px; }
.empty { text-align: center; color: #999; margin-top: 40px; }
</style>
