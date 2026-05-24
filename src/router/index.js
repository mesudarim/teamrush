import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  // ─── Player routes ──────────────────────────────────────────────────────────
  {
    path: '/',
    name: 'Login',
    component: () => import('@/views/player/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/intro',
    name: 'Intro',
    component: () => import('@/views/player/IntroView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/game',
    name: 'Game',
    component: () => import('@/views/player/GameView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/leaderboard',
    name: 'Leaderboard',
    component: () => import('@/views/player/LeaderboardView.vue'),
  },

  // ─── Admin routes ───────────────────────────────────────────────────────────
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/admin/AdminView.vue'),
    meta: { admin: true },
    children: [
      {
        path: '',
        redirect: '/admin/tracks',
      },
      {
        path: 'tracks',
        name: 'AdminTracks',
        component: () => import('@/views/admin/TracksTab.vue'),
      },
      {
        path: 'checkpoints',
        name: 'AdminCheckpoints',
        component: () => import('@/views/admin/CheckpointsTab.vue'),
      },
      {
        path: 'monitor',
        name: 'AdminMonitor',
        component: () => import('@/views/admin/MonitorTab.vue'),
      },
      {
        path: 'settings',
        name: 'AdminSettings',
        component: () => import('@/views/admin/SettingsTab.vue'),
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Restore session on first navigation
  if (!auth.isLoggedIn) {
    await auth.restoreSession()
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'Login' }
  }

  if (to.meta.guest && auth.isLoggedIn) {
    return { name: 'Game' }
  }

  // Admin: simple localStorage password guard
  if (to.meta.admin) {
    const adminKey = localStorage.getItem('teamrush_admin')
    if (adminKey !== 'teamrush_admin_2024') {
      const key = prompt('Admin password:')
      if (key !== 'teamrush_admin_2024') return { name: 'Login' }
      localStorage.setItem('teamrush_admin', key)
    }
  }
})
