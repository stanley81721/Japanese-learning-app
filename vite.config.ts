import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 部署在 https://<user>.github.io/Japanese-learning-app/
export default defineConfig({
  base: '/Japanese-learning-app/',
  plugins: [
    vue(),
    VitePWA({
      // 有新版本時先詢問使用者，避免學習到一半頁面被重新載入
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '日文單字卡',
        short_name: '日文單字卡',
        description: '日文單字與文法的單字卡學習 App，支援記憶演算法與離線使用。',
        lang: 'zh-Hant',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // data/ 的每個 JSON 會被打包成 JS chunk，所以這裡會一併預先快取，離線也能載入所有資料集
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // hash 路由只有一個 index.html
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
    },
  },
})
