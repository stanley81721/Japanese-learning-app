import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView, meta: { title: '首頁' } },
  {
    path: '/study',
    name: 'study',
    component: () => import('@/views/StudyView.vue'),
    meta: { title: '學習' },
  },
  {
    path: '/quiz',
    name: 'quiz',
    component: () => import('@/views/QuizView.vue'),
    meta: { title: '測驗' },
  },
  {
    path: '/browse',
    name: 'browse',
    component: () => import('@/views/BrowseView.vue'),
    meta: { title: '瀏覽' },
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('@/views/StatsView.vue'),
    meta: { title: '統計' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: '設定' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

// GitHub Pages 沒有伺服器端 rewrite，所以使用 hash 模式
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title}｜日文單字卡` : '日文單字卡'
})

export default router
