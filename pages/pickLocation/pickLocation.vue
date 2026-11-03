<template>
  <view class="page">
    <!-- H5：自建百度地图选点（规避 uni.chooseLocation 在 H5 端对百度不兼容导致白屏） -->
    <!-- #ifdef H5 -->
    <view class="pm-wrap">
      <view id="pickmap" class="pickmap"></view>
      <view class="locate-fab" @click="locateMe" title="定位我的位置">
        <view class="aim"><view class="aim-ring"></view><view class="aim-h"></view><view class="aim-v"></view></view>
      </view>
    </view>
    <view class="search">
      <input class="sinput" v-model="kw" placeholder="搜索地点（如：渝中区）" @confirm="search" />
      <text class="sbtn" @click="search">搜索</text>
    </view>
    <!-- #endif -->

    <view class="bar">
      <view class="addr">{{ address || '点击地图选择位置' }}</view>
      <button class="ok" :disabled="!picked" @click="confirm">确定</button>
    </view>
  </view>
</template>

<script>
// #ifdef H5
import { loadBMap } from '@/utils/mapConfig.js'
import { locateBaiduPoint } from '@/utils/geo.js'
// #endif

export default {
  data() {
    return {
      kw: '',
      address: '',
      latitude: null,
      longitude: null,
      picked: false,
      _BMap: null,
      _map: null,
      _geo: null,
      _marker: null,
      _search: null
    }
  },
  onReady() {
    // #ifdef H5
    this.initBaidu()
    // #endif
    // #ifndef H5
    this.useNative()
    // #endif
  },
  methods: {
    // —— H5：百度地图选点 ——
    // #ifdef H5
    async initBaidu() {
      try {
        const BMap = await loadBMap()
        const el = document.getElementById('pickmap')
        if (!el) return
        const map = new BMap.Map(el)
        map.centerAndZoom(new BMap.Point(104, 35), 4)
        map.enableScrollWheelZoom(true)
        // 收放尺：缩放控件
        try {
          const Small = (typeof BMAP_NAVIGATION_CONTROL_SMALL !== 'undefined') ? BMAP_NAVIGATION_CONTROL_SMALL : undefined
          map.addControl(new BMap.NavigationControl(Small !== undefined ? { type: Small } : {}))
        } catch (e) { /* 控件不可用不影响选点 */ }
        const geo = new BMap.Geocoder()
        const self = this
        map.addEventListener('click', (e) => {
          self.setPoint(BMap, map, geo, e.point)
        })
        this._BMap = BMap
        this._map = map
        this._geo = geo
        try {
          this._search = new BMap.LocalSearch(map, {
            onSearchComplete: (r) => {
              if (r && r.getNumPois && r.getNumPois() > 0) {
                const p = r.getPoi(0).point
                map.centerAndZoom(p, 15)
                self.setPoint(BMap, map, geo, p)
              }
            }
          })
        } catch (e) { /* 搜索不可用不影响点击选点 */ }
      } catch (err) {
        uni.showToast({ title: '地图加载失败：' + (err && err.message ? err.message : err), icon: 'none' })
      }
    },
    setPoint(BMap, map, geo, pt) {
      if (this._marker) map.removeOverlay(this._marker)
      const marker = new BMap.Marker(pt)
      map.addOverlay(marker)
      this._marker = marker
      map.panTo(pt)
      this.latitude = pt.lat
      this.longitude = pt.lng
      this.picked = true
      const self = this
      geo.getLocation(pt, (rs) => {
        self.address = (rs && rs.address) ? rs.address : ('已选点（' + pt.lng.toFixed(5) + ',' + pt.lat.toFixed(5) + '）')
      })
    },
    search() {
      const k = (this.kw || '').trim()
      if (!k) return
      if (this._search) this._search.search(k)
      else uni.showToast({ title: '搜索暂不可用', icon: 'none' })
    },
    // 定位我的位置：H5 用浏览器定位并直接选为当前点；非 H5 唤起系统选点
    locateMe() {
      // #ifdef H5
      if (!this._map || !this._BMap) return uni.showToast({ title: '地图尚未就绪', icon: 'none' })
      uni.showLoading({ title: '定位中…' })
      locateBaiduPoint(this._BMap).then(({ lng, lat }) => {
        const BMap = this._BMap
        const pt = new BMap.Point(lng, lat)
        this._map.centerAndZoom(pt, 16)
        this.setPoint(BMap, this._map, this._geo, pt)
        uni.hideLoading()
        uni.showToast({ title: '已定位到当前位置', icon: 'none' })
      }).catch((e) => {
        uni.hideLoading()
        uni.showToast({ title: '定位失败：' + (e && e.message ? e.message : e), icon: 'none' })
      })
      // #endif
      // #ifndef H5
      this.useNative()
      // #endif
    },
    // #endif

    // —— 非 H5：仍用系统原生选点（小程序/App 原生地图正常）——
    // #ifndef H5
    useNative() {
      uni.chooseLocation({
        success: (res) => {
          this.latitude = res.latitude
          this.longitude = res.longitude
          this.address = res.address || res.name || ''
          this.picked = true
        },
        fail: () => {}
      })
    },
    // #endif

    confirm() {
      if (!this.picked) {
        return uni.showToast({ title: '请先在地图上选点', icon: 'none' })
      }
      uni.$emit('locationPicked', {
        latitude: this.latitude,
        longitude: this.longitude,
        address: this.address
      })
      uni.navigateBack()
    }
  }
}
</script>

<style>
.page { height: 100vh; height: 100dvh; display: flex; flex-direction: column; background: #fff; }
.pm-wrap { position: relative; flex: 1; width: 100%; min-height: 0; }
.pickmap { width: 100%; height: 100%; }
.locate-fab {
  position: absolute; right: 12px; bottom: 16px;
  width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  background: #fff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,.25);
  font-size: 20px; z-index: 10;
}
/* 瞄准（crosshair）图标 */
.aim { position: relative; width: 22px; height: 22px; }
.aim-ring { position: absolute; left: 5px; top: 5px; width: 12px; height: 12px; border: 2px solid #333; border-radius: 50%; box-sizing: border-box; }
.aim-h { position: absolute; left: 0; top: 10px; width: 22px; height: 2px; background: #333; }
.aim-v { position: absolute; left: 10px; top: 0; width: 2px; height: 22px; background: #333; }
.search { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #eee; }
.sinput { flex: 1; border: 1px solid #eee; border-radius: 8px; padding: 8px 10px; font-size: 14px; }
.sbtn { color: #1989fa; font-size: 14px; padding: 8px; }
.bar { padding: 10px 14px; padding-bottom: calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid #eee; display: flex; align-items: center; gap: 10px; }
.addr { flex: 1; font-size: 13px; color: #333; }
.ok { background: #1989fa; color: #fff; font-size: 14px; margin: 0; padding: 0 18px; }
</style>
