import App from './App.vue'

import { createSSRApp } from 'vue'
import blockedGuard from '@/utils/blockedGuard.js'
export function createApp() {
	const app = createSSRApp(App)
	app.mixin(blockedGuard)
	return {
		app
	}
}