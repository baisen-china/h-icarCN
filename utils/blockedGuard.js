// 全局页面守卫 mixin：每个页面 onShow 时检查黑名单状态并拦截。
import { guardIfBlocked } from './blocked.js'

export default {
  onShow() {
    guardIfBlocked()
  }
}
