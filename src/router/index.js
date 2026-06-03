import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminAuthStore } from '@/stores/adminAuth'

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
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('@/views/admin/AdminLoginView.vue'),
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/admin/AdminView.vue'),
    meta: { admin: true },
    children: [
      { path: '', redirect: '/admin/tracks' },
      { path: 'participants', name: 'AdminParticipants', component: () => import('@/views/admin/ParticipantsTab.vue') },
      { path: 'tracks',       name: 'AdminTracks',       component: () => import('@/views/admin/TracksTab.vue') },
      { path: 'checkpoints',  name: 'AdminCheckpoints',  component: () => import('@/views/admin/CheckpointsTab.vue') },
      { path: 'monitor',      name: 'AdminMonitor',      component: () => import('@/views/admin/MonitorTab.vue') },
      { path: 'settings',     name: 'AdminSettings',     component: () => import('@/views/admin/SettingsTab.vue') },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  // Restore player session on first navigation
  const auth = useAuthStore()
  if (!auth.isLoggedIn) {
    await auth.restoreSession()
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) return { name: 'Login' }
  if (to.meta.guest && auth.isLoggedIn) return { name: 'Game' }

  // Admin: require Google authentication
  if (to.meta.admin) {
    const adminAuth = useAdminAuthStore()
    await adminAuth.init()
    if (!adminAuth.isAuthenticated) return { name: 'AdminLogin' }
  }
})
