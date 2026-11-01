import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://etxxigwpnhjjbebybdoz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_T1_-nzc4lAerAdUEY00ReA_LS38yxV-'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// 生成终端唯一ID
export function getDeviceId() {
  const key = 'manhole_device_id'
  let id = uni.getStorageSync(key)
  if (!id) {
    id = 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
    uni.setStorageSync(key, id)
  }
  return id
}