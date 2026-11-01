<template>
  <view class="idbar">
    <view class="id-chip" @click="startEdit">
      <text class="id-label">我是</text>
      <text class="id-name">{{ identity.name }}</text>
      <text class="id-edit">✏️</text>
    </view>

    <view v-if="editing" class="id-edit-box">
      <input
        v-model="draft"
        class="id-input"
        maxlength="20"
        placeholder="输入昵称（最多20字）"
        :focus="true"
        @confirm="save"
      />
      <button class="id-btn save" @click="save">保存</button>
      <button class="id-btn cancel" @click="editing = false">取消</button>
    </view>
  </view>
</template>

<script>
import { getIdentity, setDisplayName, touchName } from '@/utils/identity.js'

export default {
  data() {
    return {
      identity: getIdentity(),
      editing: false,
      draft: ''
    }
  },
  created() {
    // 保活当前昵称（刷新活跃时间，避免被误判为「不再使用」）
    touchName()
  },
  methods: {
    startEdit() {
      this.draft = this.identity.name
      this.editing = true
    },
    async save() {
      const wanted = (this.draft || '').trim()
      if (!wanted) {
        return uni.showToast({ title: '昵称不能为空', icon: 'none' })
      }
      const final = await setDisplayName(this.draft)
      if (!final) {
        return uni.showToast({ title: '昵称不能为空', icon: 'none' })
      }
      this.identity = getIdentity()
      this.editing = false
      if (final === wanted.slice(0, 20)) {
        uni.showToast({ title: '已保存', icon: 'none' })
      } else {
        // 目标昵称被他人占用，已自动加数字尾巴区分
        uni.showToast({ title: '昵称已被占用，已存为「' + final + '」', icon: 'none' })
      }
      this.$emit('change', this.identity.name)
    }
  }
}
</script>

<style>
.idbar { display: inline-flex; flex-direction: column; }
.id-chip {
  display: inline-flex; align-items: center; gap: 4px;
  background: #eaf4ff; border: 1px solid #cfe4ff;
  border-radius: 16px; padding: 4px 12px;
}
.id-label { font-size: 12px; color: #666; }
.id-name { font-size: 13px; color: #1989fa; font-weight: bold; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.id-edit { font-size: 12px; }
.id-edit-box {
  margin-top: 6px; display: flex; align-items: center; gap: 6px;
  background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 6px;
}
.id-input { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 6px 8px; font-size: 14px; }
.id-btn { font-size: 12px; padding: 0 12px; border-radius: 6px; margin: 0; line-height: 2; }
.id-btn.save { background: #1989fa; color: #fff; }
.id-btn.cancel { background: #f2f2f2; color: #666; }
</style>
