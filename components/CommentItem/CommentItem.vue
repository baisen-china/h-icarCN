<template>
  <view>
    <view class="cmt" :class="{ reply: depth > 0 }">
      <text class="cmt-name">{{ node.display_name || '匿名' }}</text>
      <text class="cmt-text">{{ node.content }}</text>
      <view class="cmt-foot">
        <text class="cmt-time">{{ fmt(node.created_at) }}</text>
        <text class="cmt-reply" @click="$emit('reply', node)">回复</text>
      </view>
    </view>

    <!-- 递归渲染所有子回复（支持任意层级） -->
    <view class="replies" v-if="node.replies && node.replies.length">
      <CommentItem
        v-for="r in node.replies"
        :key="r.id"
        :node="r"
        :depth="Math.min(depth + 1, 6)"
        @reply="$emit('reply', $event)"
      />
    </view>
  </view>
</template>

<script>
import { formatBeijing } from '@/utils/time.js'
export default {
  name: 'CommentItem',
  props: {
    node: { type: Object, required: true },
    depth: { type: Number, default: 0 }
  },
  methods: {
    fmt(t) {
      return formatBeijing(t)
    }
  }
}
</script>

<style>
.cmt { border-bottom: 1px solid #f0f0f0; padding: 10px 0; }
.cmt-name { display: block; font-size: 13px; color: #1989fa; font-weight: bold; margin-bottom: 4px; }
.cmt-text { display: block; font-size: 14px; line-height: 1.6; }
.cmt-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.cmt-time { font-size: 11px; color: #999; }
.cmt-reply { font-size: 12px; color: #1989fa; padding: 2px 10px; border: 1px solid #cfe4ff; border-radius: 12px; }
.replies { margin-left: 14px; border-left: 2px solid #f0f0f0; padding-left: 10px; }
.reply { border-bottom: none; border-top: 1px solid #f5f5f5; }
</style>
