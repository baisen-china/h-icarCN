<template>
  <view class="page">
    <!-- 上下文 -->
    <view class="context">
      <text v-if="parentName" class="ctx-reply">回复 @{{ parentName }}</text>
      <text v-else class="ctx-reply">发表留言</text>
      <text v-if="manholeTitle" class="ctx-title">📍 {{ manholeTitle }}</text>
    </view>

    <!-- 身份条：可改昵称 -->
    <view class="id-row">
      <IdentityBar @change="onNameChange" />
    </view>

    <!-- 输入区 -->
    <view class="editor">
      <textarea
        v-model="content"
        class="textarea"
        placeholder="说点什么…（提交后将进入人工审核）"
        maxlength="500"
        :focus="!parentName"
      />
      <text class="counter">{{ content.length }}/500</text>
    </view>

    <button class="submit" :loading="submitting" @click="submit">提交留言</button>
  </view>
</template>

<script>
import { supabase } from '@/utils/supabase.js'
import { getIdentity } from '@/utils/identity.js'
import { submitModerated } from '@/utils/moderate.js'
import { getBlocked } from '@/utils/blocked.js'
import IdentityBar from '@/components/IdentityBar/IdentityBar.vue'

export default {
  components: { IdentityBar },
  data() {
    return {
      manholeId: null,
      parentId: null,
      parentName: '',
      manholeTitle: '',
      content: '',
      submitting: false
    }
  },
  onLoad(opt) {
    this.manholeId = opt.manhole_id ? parseInt(opt.manhole_id) : null
    this.parentId = opt.parent_id ? parseInt(opt.parent_id) : null
    this.parentName = opt.parent_name || ''
    if (this.manholeId) this.loadTitle()
  },
  methods: {
    async loadTitle() {
      const { data } = await supabase
        .from('manholes')
        .select('province,city,district')
        .eq('id', this.manholeId)
        .single()
      if (data) {
        this.manholeTitle = [data.province, data.city, data.district].filter(Boolean).join(' ')
      }
    },
    onNameChange() {},
    async submit() {
      if (getBlocked()) return uni.showToast({ title: '您已被限制访问，无法发布', icon: 'none' })
      const text = this.content.trim()
      if (!text) return uni.showToast({ title: '请输入留言内容', icon: 'none' })
      if (!this.manholeId) return uni.showToast({ title: '缺少井盖信息', icon: 'none' })

      const { deviceId, name } = getIdentity()
      this.submitting = true
      try {
        // 提交走人工审核：直接入库，force_pending 触发器置为 pending，
        // 等待管理后台人工审核。
        const { status, error } = await submitModerated('comment', {
          manhole_id: this.manholeId,
          content: text,
          parent_id: this.parentId, // 顶层为 null，回复时指向父留言
          display_name: name,
          uploader_device_id: deviceId
        })
        if (error) throw new Error(error.message)

        uni.showToast({ title: '已提交，等待人工审核', icon: 'none' })

        // 提交成功后返回详情页
        setTimeout(() => {
          uni.navigateBack({
            delta: 1,
            fail: () => uni.switchTab({ url: '/pages/index/index' })
          })
        }, 1200)
      } catch (e) {
        console.error(e)
        uni.showToast({ title: '提交失败：' + (e && e.message ? e.message : e), icon: 'none' })
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style>
.page { padding: 16px; background: #f5f5f5; min-height: 100vh; }
.context { margin-bottom: 12px; }
.ctx-reply { font-size: 16px; font-weight: bold; display: block; }
.ctx-title { font-size: 13px; color: #666; margin-top: 4px; display: block; }
.id-row { margin-bottom: 12px; }
.editor { background: #fff; border-radius: 12px; padding: 12px; position: relative; }
.textarea { width: 100%; min-height: 160px; font-size: 15px; line-height: 1.5; box-sizing: border-box; }
.counter { position: absolute; right: 12px; bottom: 8px; font-size: 12px; color: #bbb; }
.submit { background: #1989fa; color: #fff; border-radius: 8px; margin-top: 16px; }
</style>
