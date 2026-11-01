<template>
  <view class="page">
    <!-- 身份条 + 地图入口 -->
    <view class="topbar">
      <button class="mapbtn" @click="goMap">🗺️ 地图</button>
      <IdentityBar @change="onNameChange" />
    </view>

    <!-- 筛选 -->
    <view class="filter">
      <picker mode="selector" :range="provinces" @change="onProvinceChange">
        <view class="picker">{{ province || '全部省份' }}</view>
      </picker>
      <picker mode="selector" :range="years" @change="onYearChange">
        <view class="picker">{{ year || '全部年份' }}</view>
      </picker>
      <picker mode="selector" :range="sortOptions" @change="onSortChange">
        <view class="picker">{{ sortLabel }}</view>
      </picker>
    </view>

    <!-- 列表 -->
    <view class="list" v-if="list.length">
      <view class="card" v-for="item in list" :key="item.id" @click="goDetail(item)">
        <image v-if="item.image_url" :src="item.image_url" mode="aspectFill" class="thumb" @error="onImgError(item)" />
        <view v-else class="thumb thumb-empty">无图</view>
        <view class="info">
          <text class="title"><text v-if="medals[item.id] && medals[item.id].icon">{{ medals[item.id].icon }} </text>📍 {{ item.province || '未知' }} {{ item.city || '' }} {{ item.district || '' }}</text>
          <text class="meta">年份：{{ item.install_year || '未知' }} ｜ 材质：{{ item.material || '未知' }}</text>
          <text class="meta">上传者：{{ item.display_name || '匿名' }}</text>
          <text class="age" v-if="item.install_year">年龄：{{ currentYear - item.install_year }} 年</text>
        </view>
      </view>
    </view>
    <view class="empty" v-else>暂无数据，去上传第一个井盖吧～</view>

    <view class="visit">🌐 累计访问 {{ visitCount }} 次</view>
    <view class="sale">本域名待价而沽，有心者请联系QQ:495727171</view>
  </view>
</template>

<script>
import { supabase } from '@/utils/supabase.js'
import IdentityBar from '@/components/IdentityBar/IdentityBar.vue'
import { computeMedals } from '@/utils/medal.js'

export default {
  components: { IdentityBar },
  data() {
    return {
      list: [],
      medals: {},
      provinces: ['全部省份'],
      province: '',
      years: ['全部年份'],
      year: '',
      sort: 'age_desc',
      sortOptions: ['最老优先', '最新优先', '最近上传'],
      sortLabel: '最老优先',
      currentYear: new Date().getFullYear(),
      visitCount: 0
    }
  },
  onShow() {
    this.loadProvinces()
    this.loadYears()
    this.loadList()
    this.loadVisit()
  },
  methods: {
    onNameChange() {},
    async loadProvinces() {
      const { data } = await supabase
        .from('manholes')
        .select('province')
        .eq('status', 'approved')
        .not('province', 'is', null)
      if (data) {
        const set = [...new Set(data.map(r => r.province).filter(Boolean))]
        this.provinces = ['全部省份', ...set]
      }
    },
    async loadList() {
      let q = supabase.from('manholes').select('*').eq('status', 'approved')
      if (this.province && this.province !== '全部省份') {
        q = q.eq('province', this.province)
      }
      if (this.year && this.year !== '全部年份') {
        q = q.eq('install_year', Number(this.year))
      }
      if (this.sort === 'age_desc') {
        q = q.order('install_year', { ascending: true, nullsFirst: false })
      } else if (this.sort === 'age_asc') {
        q = q.order('install_year', { ascending: false })
      } else {
        q = q.order('created_at', { ascending: false })
      }
      const { data } = await q.limit(200)
      this.list = data || []
      this.medals = computeMedals(this.list, this.currentYear)
    },
    medalIcon(item) {
      const md = this.medals[item.id]
      return md ? md.icon : ''
    },
    async loadYears() {
      const { data } = await supabase
        .from('manholes')
        .select('install_year')
        .eq('status', 'approved')
        .not('install_year', 'is', null)
      if (data) {
        const set = [...new Set(data.map(r => r.install_year).filter(Boolean))]
          .sort((a, b) => Number(b) - Number(a))
        this.years = ['全部年份', ...set.map(String)]
      }
    },
    onProvinceChange(e) {
      this.province = this.provinces[e.detail.value]
      this.loadList()
    },
    onYearChange(e) {
      this.year = this.years[e.detail.value]
      this.loadList()
    },
    onSortChange(e) {
      this.sortLabel = this.sortOptions[e.detail.value]
      const map = { '最老优先': 'age_desc', '最新优先': 'age_asc', '最近上传': 'created' }
      this.sort = map[this.sortLabel]
      this.loadList()
    },
    goDetail(item) {
      uni.navigateTo({ url: '/pages/detail/detail?id=' + item.id })
    },
    goMap() {
      uni.navigateTo({ url: '/pages/map/map' })
    },
    goUpload() {
      uni.switchTab({ url: '/pages/upload/upload' })
    },
    onImgError(item) {
      item.image_url = ''
    },
    async loadVisit() {
      const key = 'visit_counted_home'
      try {
        const { data } = !uni.getStorageSync(key)
          ? await supabase.rpc('bump_visit', { p_page: 'home' })
          : await supabase.rpc('get_visit', { p_page: 'home' })
        if (data != null) this.visitCount = Number(data)
        if (!uni.getStorageSync(key)) uni.setStorageSync(key, '1')
      } catch (e) {
        // 表/RPC 未建好时静默失败，不影响主页其余功能
      }
    }
  }
}
</script>

<style>
.page { padding: 12px; background: #f5f5f5; min-height: 100vh; }
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.mapbtn { background: #1989fa; color: #fff; border: none; border-radius: 16px; font-size: 13px; padding: 4px 12px; margin: 0; line-height: 1.8; }
.filter { display: flex; gap: 10px; margin-bottom: 12px; }
.picker { flex: 1; background: #fff; padding: 10px; border-radius: 8px; text-align: center; font-size: 14px; }
.card { background: #fff; border-radius: 12px; overflow: hidden; margin-bottom: 12px; display: flex; }
.thumb { width: 100px; height: 100px; flex-shrink: 0; }
.thumb-empty { display: flex; align-items: center; justify-content: center; background: #eee; color: #999; font-size: 12px; }
.info { padding: 10px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
.title { font-size: 15px; font-weight: bold; }
.meta { font-size: 12px; color: #666; }
.age { font-size: 13px; color: #ff6b00; font-weight: bold; }
.empty { text-align: center; color: #999; margin-top: 60px; }
.visit { text-align: center; color: #999; font-size: 12px; margin-top: 16px; }
.sale { text-align: left; color: #bbb; font-size: 11px; margin-top: 6px; padding-left: 4px; }
</style>
