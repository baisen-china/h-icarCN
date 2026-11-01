<template>
  <view class="page">
    <image v-if="item.image_url" :src="item.image_url" mode="widthFix" class="hero" @error="onImgError" />
    <view v-else class="hero hero-empty">无图</view>

    <view class="meta-box">
      <text class="title"><text v-if="medalIcon">{{ medalIcon }} </text>📍 {{ item.province }} {{ item.city }} {{ item.district }}</text>
      <text class="row">年份：{{ item.install_year || '未知' }} ｜ 材质：{{ item.material || '未知' }}</text>
      <text class="row age" v-if="item.install_year">年龄：{{ currentYear - item.install_year }} 年</text>
      <text class="row">上传时间：{{ item.created_at ? fmtTime(item.created_at) : '' }}</text>
    </view>

    <!-- 地理位置展示：让访问者一眼看出照片位置 -->
    <view class="geo-box" v-if="item && (item.province || item.city || item.district || hasCoord)">
      <view class="geo-title">📍 拍摄位置</view>
      <view class="geo-addr">{{ item.province || '' }} {{ item.city || '' }} {{ item.district || '' }} {{ item.address || '' }}</view>
      <view class="geo-coord" v-if="hasCoord">坐标：{{ item.latitude }}, {{ item.longitude }}</view>
      <view class="geo-coord muted" v-else>（未采集精确坐标，仅显示地址）</view>
      <view class="detail-map-wrap" v-if="hasCoord && isH5">
        <view id="detailMap" class="detail-map"></view>
        <view class="detail-locate" @click="locateMe" title="定位我的位置">
          <view class="aim"><view class="aim-ring"></view><view class="aim-h"></view><view class="aim-v"></view></view>
        </view>
      </view>
      <view class="geo-actions">
        <button class="geo-btn" @click="goBigMap">在地图查看 ›</button>
      </view>
    </view>

    <!-- 留言区 -->
    <view class="comment-section">
      <view class="section-head">
        <text class="section-title">留言（{{ topLevelCount }}）</text>
        <IdentityBar @change="load" />
      </view>

      <CommentItem
        v-for="c in comments"
        :key="c.id"
        :node="c"
        :depth="0"
        @reply="goReply"
      />

      <view class="empty" v-if="!comments.length">还没有留言，来抢沙发吧～</view>

      <button class="comment-btn" @click="goComment">我要留言</button>
    </view>
  </view>
</template>

<script>
import { supabase } from '@/utils/supabase.js'
import IdentityBar from '@/components/IdentityBar/IdentityBar.vue'
import CommentItem from '@/components/CommentItem/CommentItem.vue'
import { computeMedals } from '@/utils/medal.js'
import { loadBMap } from '@/utils/mapConfig.js'
import { locateBaiduPoint } from '@/utils/geo.js'
import { formatBeijing } from '@/utils/time.js'

export default {
  components: { IdentityBar, CommentItem },
  data() {
    return {
      id: null,
      item: {},
      comments: [],
      topLevelCount: 0,
      currentYear: new Date().getFullYear(),
      medalIcon: '',
      hasCoord: false,
      isH5: (typeof window !== 'undefined' && typeof window.document !== 'undefined'),
      _dmap: null,
      _dBMap: null
    }
  },
  onLoad(opt) {
    this.id = opt.id
    this.load()
  },
  methods: {
    fmtTime(t) {
      return formatBeijing(t)
    },
    async load() {
      const { data } = await supabase.from('manholes').select('*').eq('id', this.id).single()
      if (data) this.item = data
      this.hasCoord = !!(this.item.latitude != null && this.item.longitude != null)

      // 计算「最老井盖」勋章（基于全部已审核井盖）
      const { data: all } = await supabase
        .from('manholes').select('id,install_year,created_at').eq('status', 'approved')
      const medals = computeMedals(all || [], this.currentYear)
      this.medalIcon = medals[this.id] ? medals[this.id].icon : ''

      const { data: cmts } = await supabase
        .from('comments')
        .select('*')
        .eq('manhole_id', this.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: true })
      this.comments = this.buildTree(cmts || [])
      this.topLevelCount = this.comments.length

      // 有坐标且为 H5 时，渲染详情页小地图
      this.$nextTick(() => this.initDetailMap())
    },
    // 详情页小地图（仅 H5 可用；百度 BD-09 坐标系，与存储坐标系一致）
    async initDetailMap() {
      if (!this.isH5 || !this.hasCoord) return
      try {
        const BMap = await loadBMap()
        const el = document.getElementById('detailMap')
        if (!el) return
        const map = new BMap.Map(el)
        const pt = new BMap.Point(+this.item.longitude, +this.item.latitude)
        map.centerAndZoom(pt, 16)
        if (map.enableScrollWheelZoom) map.enableScrollWheelZoom(true)
        // 收放尺：缩放控件
        try {
          const Small = (typeof BMAP_NAVIGATION_CONTROL_SMALL !== 'undefined') ? BMAP_NAVIGATION_CONTROL_SMALL : undefined
          map.addControl(new BMap.NavigationControl(Small !== undefined ? { type: Small } : {}))
        } catch (e) { /* 控件不可用不影响打点 */ }
        this._dmap = map
        this._dBMap = BMap
        const marker = new BMap.Marker(pt)
        const label = new BMap.Label(this.medalIcon || '📍', { offset: new BMap.Size(-12, -24) })
        label.setStyle({ background: 'transparent', border: 'none', fontSize: '22px', padding: '0', boxShadow: 'none' })
        marker.setLabel(label)
        map.addOverlay(marker)
      } catch (e) {
        console.warn('详情地图加载失败：', e && e.message)
      }
    },
    // 定位我的位置（仅 H5 百度地图）
    locateMe() {
      if (!this.isH5) return
      if (!this._dmap || !this._dBMap) {
        return uni.showToast({ title: '地图尚未就绪', icon: 'none' })
      }
      uni.showLoading({ title: '定位中…' })
      locateBaiduPoint(this._dBMap).then(({ lng, lat }) => {
        const BMap = this._dBMap
        const pt = new BMap.Point(lng, lat)
        this._dmap.centerAndZoom(pt, 16)
        const mk = new BMap.Marker(pt)
        const label = new BMap.Label('我', { offset: new BMap.Size(-8, -28) })
        label.setStyle({ background: '#1989fa', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '8px', fontSize: '12px' })
        mk.setLabel(label)
        this._dmap.addOverlay(mk)
        uni.hideLoading()
      }).catch((e) => {
        uni.hideLoading()
        uni.showToast({ title: '定位失败：' + (e && e.message ? e.message : e), icon: 'none' })
      })
    },
    goBigMap() {
      uni.navigateTo({ url: '/pages/map/map?id=' + this.id })
    },
    buildTree(flat) {
      const map = {}
      flat.forEach(c => { c.replies = []; map[c.id] = c })
      const roots = []
      flat.forEach(c => {
        if (c.parent_id && map[c.parent_id]) {
          map[c.parent_id].replies.push(c)
        } else {
          roots.push(c)
        }
      })
      const byTime = (a, b) => (a.created_at < b.created_at ? -1 : 1)
      const sortRec = (nodes) => {
        nodes.sort(byTime)
        nodes.forEach(n => sortRec(n.replies))
      }
      sortRec(roots)
      return roots
    },
    goComment() {
      uni.navigateTo({ url: '/pages/comment/comment?manhole_id=' + this.id })
    },
    goReply(c) {
      const name = encodeURIComponent(c.display_name || '匿名')
      uni.navigateTo({
        url: `/pages/comment/comment?manhole_id=${this.id}&parent_id=${c.id}&parent_name=${name}`
      })
    },
    onImgError() {
      this.item.image_url = ''
    }
  }
}
</script>

<style>
.page { background: #f5f5f5; min-height: 100vh; }
.hero { width: 100%; display: block; background: #eee; }
.hero-empty { height: 200px; line-height: 200px; text-align: center; color: #999; }
.meta-box { background: #fff; padding: 16px; margin-bottom: 10px; }
.title { font-size: 17px; font-weight: bold; display: block; margin-bottom: 8px; }
.row { display: block; font-size: 14px; color: #555; line-height: 1.8; }
.age { color: #ff6b00; font-weight: bold; }
.geo-box { background: #fff; padding: 16px; margin-bottom: 10px; }
.geo-title { font-size: 15px; font-weight: bold; margin-bottom: 8px; }
.geo-addr { font-size: 14px; color: #333; line-height: 1.6; word-break: break-all; }
.geo-coord { font-size: 12px; color: #1e88e5; margin-top: 4px; }
.geo-coord.muted { color: #999; }
.detail-map-wrap { position: relative; margin-top: 10px; }
.detail-map { width: 100%; height: 200px; border-radius: 10px; overflow: hidden; background: #eef; }
.detail-locate {
  position: absolute; right: 10px; top: 10px;
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  background: #fff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,.25);
  z-index: 5;
}
.geo-actions { margin-top: 10px; }
.geo-btn { background: #1989fa; color: #fff; border-radius: 20px; font-size: 14px; }
/* 瞄准（crosshair）图标 */
.aim { position: relative; width: 22px; height: 22px; }
.aim-ring { position: absolute; left: 5px; top: 5px; width: 12px; height: 12px; border: 2px solid #333; border-radius: 50%; box-sizing: border-box; }
.aim-h { position: absolute; left: 0; top: 10px; width: 22px; height: 2px; background: #333; }
.aim-v { position: absolute; left: 10px; top: 0; width: 2px; height: 22px; background: #333; }
.comment-section { background: #fff; padding: 16px; padding-bottom: 80px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.section-title { font-size: 15px; font-weight: bold; }
.empty { text-align: center; color: #999; padding: 30px 0; font-size: 13px; }
.comment-btn {
  position: fixed; left: 16px; right: 16px; bottom: 16px;
  background: #1989fa; color: #fff; border-radius: 24px;
}
</style>
