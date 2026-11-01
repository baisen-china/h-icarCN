<template>
  <view class="page">
    <view class="form">
      <!-- 图片 -->
      <view class="field">
        <text class="label">井盖照片</text>
        <view class="img-box" @click="chooseImage">
          <image v-if="imagePath" :src="imagePath" mode="aspectFill" class="preview" />
          <text v-else class="placeholder">点击拍照或选图</text>
        </view>
      </view>

      <!-- 省市县 -->
      <view class="field">
        <text class="label">所在省份</text>
        <picker mode="selector" :range="provinces" @change="onProvince">
          <view class="picker-val">{{ form.province || '请选择省份' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">所在城市</text>
        <input v-model="form.city" placeholder="如：重庆市" />
      </view>
      <view class="field">
        <text class="label">所在区县</text>
        <input v-model="form.district" placeholder="如：渝中区" />
      </view>

      <!-- 定位（选填，用于地图展示） -->
      <view class="field">
        <text class="label">精确位置（H5端选点最准，选填）</text>
        <view class="loc-box" @click="chooseLocation">
          <text v-if="form.address" class="loc-text">{{ form.address }}</text>
          <text v-else class="placeholder">📍 点击在地图上选择位置</text>
        </view>
      </view>

      <!-- 年份 -->
      <view class="field">
        <text class="label">估计生成年份</text>
        <input v-model="form.install_year" type="number" placeholder="如：1998" />
      </view>

      <!-- 材质 -->
      <view class="field">
        <text class="label">材质</text>
        <picker mode="selector" :range="materials" @change="onMaterial">
          <view class="picker-val">{{ form.material || '请选择' }}</view>
        </picker>
      </view>

      <button class="submit" :loading="uploading" @click="submit">上传</button>
    </view>
  </view>
</template>

<script>
import { supabase, getDeviceId } from '@/utils/supabase.js'
import { submitModerated } from '@/utils/moderate.js'
import { getBlocked } from '@/utils/blocked.js'

const PROVINCES = ['北京','天津','上海','重庆','河北','山西','内蒙古','辽宁','吉林','黑龙江','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','台湾','香港','澳门']

// 跨端读取本地图片为二进制（supabase-js 的 upload 需要二进制，而非本地路径字符串）
async function pathToBytes(path) {
  // #ifdef H5
  const resp = await fetch(path)
  if (!resp.ok) throw new Error('读取图片失败')
  return new Uint8Array(await resp.arrayBuffer())
  // #endif
  // #ifndef H5
  // #ifdef APP-PLUS
  return await new Promise((resolve, reject) => {
    plus.io.resolveLocalFileSystemURL(path, (entry) => {
      entry.file((file) => {
        const reader = new plus.io.FileReader()
        reader.onloadend = (e) => resolve(new Uint8Array(e.target.result))
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
      }, reject)
    }, reject)
  })
  // #endif
  // #ifndef APP-PLUS
  return await new Promise((resolve, reject) => {
    uni.getFileSystemManager().readFile({
      filePath: path,
      success: (r) => resolve(new Uint8Array(r.data)),
      fail: reject
    })
  })
  // #endif
  // #endif
}

export default {
  data() {
    return {
      imagePath: '',
      uploading: false,
      provinces: PROVINCES,
      materials: ['铸铁', '水泥', '复合材料', '球墨铸铁', '其他'],
      form: { province: '', city: '', district: '', install_year: '', material: '', latitude: null, longitude: null, address: '' }
    }
  },
  methods: {
    chooseImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: (res) => { this.imagePath = res.tempFilePaths[0] }
      })
    },
    chooseLocation() {
      // #ifdef H5
      // H5 端 uni.chooseLocation 对百度地图不兼容（白屏），改用自建百度选点页
      uni.$once('locationPicked', (data) => {
        this.form.latitude = data.latitude
        this.form.longitude = data.longitude
        this.form.address = data.address || ''
      })
      uni.navigateTo({ url: '/pages/pickLocation/pickLocation' })
      // #endif
      // #ifndef H5
      uni.chooseLocation({
        success: (res) => {
          this.form.latitude = res.latitude
          this.form.longitude = res.longitude
          this.form.address = res.address || res.name || ''
        },
        fail: () => {}
      })
      // #endif
    },
    onProvince(e) {
      this.form.province = this.provinces[e.detail.value]
    },
    onMaterial(e) {
      this.form.material = this.materials[e.detail.value]
    },
    async submit() {
      if (getBlocked()) return uni.showToast({ title: '您已被限制访问，无法发布', icon: 'none' })
      if (!this.imagePath) return uni.showToast({ title: '请先选照片', icon: 'none' })
      if (!this.form.province) return uni.showToast({ title: '请选择省份', icon: 'none' })

      const curYear = new Date().getFullYear()
      if (this.form.install_year) {
        const y = parseInt(this.form.install_year)
        if (isNaN(y) || y < 1900 || y > curYear) {
          return uni.showToast({ title: `年份需在 1900~${curYear} 之间`, icon: 'none' })
        }
      }

      this.uploading = true
      try {
        // 1. 读取图片二进制
        const bytes = await pathToBytes(this.imagePath)
        const ext = (this.imagePath.split('.').pop() || 'jpg').toLowerCase()
        const fileExt = ['png','jpg','jpeg','gif','webp'].includes(ext) ? ext.replace('jpg', 'jpeg') : 'jpeg'
        const fileName = `m_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`

        // 2. 上传图片
        const { error: upErr } = await supabase.storage
          .from('manhole-images')
          .upload(fileName, bytes, { contentType: `image/${fileExt}` })
        if (upErr) throw new Error('图片上传失败：' + upErr.message)

        const { data: urlData } = supabase.storage
          .from('manhole-images')
          .getPublicUrl(fileName)
        const imageUrl = urlData.publicUrl

        // 3. 提交走人工审核：直接入库，force_pending 触发器置为 pending，
        //    等待管理后台人工审核（通过/隐藏/删除/召回）。
        const { status, error: dbErr } = await submitModerated('manhole', {
          image_url: imageUrl,
          province: this.form.province,
          city: this.form.city,
          district: this.form.district,
          install_year: this.form.install_year ? parseInt(this.form.install_year) : null,
          material: this.form.material,
          latitude: this.form.latitude != null ? Number(this.form.latitude) : null,
          longitude: this.form.longitude != null ? Number(this.form.longitude) : null,
          uploader_device_id: getDeviceId()
        })
        if (dbErr) throw new Error('信息保存失败：' + (dbErr.message || dbErr))

        uni.showToast({ title: '已提交，等待人工审核', icon: 'none' })
        setTimeout(() => uni.switchTab({ url: '/pages/index/index' }), 1500)
      } catch (e) {
        console.error(e)
        uni.showToast({ title: '上传失败：' + (e && e.message ? e.message : e), icon: 'none' })
      } finally {
        this.uploading = false
      }
    }
  }
}
</script>

<style>
.page { padding: 16px; background: #f5f5f5; min-height: 100vh; }
.form { background: #fff; border-radius: 12px; padding: 16px; }
.field { margin-bottom: 16px; }
.label { display: block; font-size: 14px; color: #666; margin-bottom: 6px; }
input { border: 1px solid #eee; border-radius: 8px; padding: 10px; font-size: 15px; }
.img-box { border: 2px dashed #ccc; border-radius: 12px; height: 180px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.loc-box { border: 1px solid #eee; border-radius: 8px; padding: 12px; min-height: 44px; display: flex; align-items: center; }
.preview { width: 100%; height: 100%; }
.placeholder { color: #999; }
.picker-val { border: 1px solid #eee; border-radius: 8px; padding: 10px; }
.submit { background: #1989fa; color: #fff; border-radius: 8px; margin-top: 10px; }
</style>
