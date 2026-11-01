<template>
  <view class="blk">
    <view class="blk-head">
      <view class="avatar">{{ initial }}</view>
      <view class="nick">{{ name }}</view>
      <view class="vtag">个人中心</view>
    </view>

    <view class="stats">
      <view class="stat"><view class="num">—</view><view class="lab">我的井盖</view></view>
      <view class="stat"><view class="num">—</view><view class="lab">我的留言</view></view>
    </view>

    <view class="box">
      <view class="box-t">账号状态</view>
      <view class="box-st">功能受限</view>
      <view class="box-d">您的访问权限已被限制，当前仅可查看此个人页，暂无法浏览与发布内容。若需恢复，请联系管理员解除限制。</view>
    </view>

    <view class="foot">© 井盖龙虎榜</view>
  </view>
</template>

<script>
import { getIdentity } from '@/utils/identity.js'
import { checkBlocked, onBlockedChange } from '@/utils/blocked.js'

export default {
  data() {
    return { name: '', initial: '客' }
  },
  onLoad() {
    const id = getIdentity()
    this.name = id.name || '访客'
    this.initial = (this.name[0] || '客')
    // 被移除黑名单后自动恢复正常访问（无需手动刷新）
    this._unsub = onBlockedChange((b) => {
      if (!b) uni.reLaunch({ url: '/pages/index/index' })
    })
  },
  onShow() {
    checkBlocked()
  },
  onUnload() {
    if (this._unsub) this._unsub()
  }
}
</script>

<style>
.blk { min-height: 100vh; background: #f2f3f5; padding: 0 0 30px; }
.blk-head { background: linear-gradient(135deg, #1989fa, #4cb3ff); padding: 40px 20px 28px; text-align: center; color: #fff; }
.avatar { width: 72px; height: 72px; border-radius: 50%; background: rgba(255,255,255,.25); margin: 0 auto 12px; line-height: 72px; font-size: 30px; font-weight: bold; }
.nick { font-size: 18px; font-weight: bold; }
.vtag { display: inline-block; margin-top: 6px; font-size: 12px; background: rgba(255,255,255,.2); padding: 2px 10px; border-radius: 10px; }
.stats { display: flex; margin: 14px; background: #fff; border-radius: 12px; overflow: hidden; }
.stat { flex: 1; text-align: center; padding: 16px 0; }
.stat + .stat { border-left: 1px solid #f0f0f0; }
.num { font-size: 22px; font-weight: bold; color: #333; }
.lab { font-size: 12px; color: #999; margin-top: 4px; }
.box { margin: 14px; background: #fff; border-radius: 12px; padding: 16px; }
.box-t { font-size: 13px; color: #999; }
.box-st { font-size: 18px; font-weight: bold; color: #ee0a24; margin: 6px 0; }
.box-d { font-size: 13px; color: #666; line-height: 1.7; }
.foot { text-align: center; color: #bbb; font-size: 12px; margin-top: 24px; }
</style>
