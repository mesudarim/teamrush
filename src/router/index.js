import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminAuthStore } from '@/stores/adminAuth'
import { useGameContextStore } from '@/stores/gameContext'
import { switchTeamDay } from '@/firebase/firestore'

const LEGACY_GAME = 'merotzLaTsafon2026'

const routes = [
  // ─── Legacy redirects (old single-game URLs) ────────────────────────────────
  { path: '/',      redirect: `/g/${LEGACY_GAME}` },
  { path: '/day2',  redirect: `/g/${LEGACY_GAME}/day2` },
  { path: '/admin', redirect: `/g/${LEGACY_GAME}/admin` },
  { path: '/admin/login', redirect: `/g/${LEGACY_GAME}/admin/login` },

  // ─── Player routes (/g/:gameId/…) ───────────────────────────────────────────
  {
    path: '/g/:gameId',
    name: 'Login',
    component: () => import('@/views/player/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/g/:gameId/day2',
    name: 'LoginDay2',
    component: () => import('@/views/player/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/g/:gameId/intro',
    name: 'Intro',
    component: () => import('@/views/player/IntroView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/g/:gameId/pre-launch',
    name: 'PreLaunch',
    component: () => import('@/views/player/PreLaunchView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/g/:gameId/game',
    name: 'Game',
    component: () => import('@/views/player/GameView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/g/:gameId/leaderboard',
    name: 'Leaderboard',
    component: () => import('@/views/player/LeaderboardView.vue'),
  },
  {
    path: '/g/:gameId/resultats',
    name: 'Day1Results',
    component: () => import('@/views/player/ResultsView.vue'),
    props: { mode: 'day1' },
  },
  {
    path: '/g/:gameId/resultats/jour2',
    name: 'Day2Results',
    component: () => import('@/views/player/ResultsView.vue'),
    props: { mode: 'day2' },
  },
  {
    path: '/g/:gameId/resultats/total',
    name: 'TotalResults',
    component: () => import('@/views/player/ResultsView.vue'),
    props: { mode: 'total' },
  },

  // ─── Game admin routes (/g/:gameId/admin/…) ──────────────────────────────────
  {
    path: '/g/:gameId/admin/login',
    name: 'AdminLogin',
    component: () => import('@/views/admin/AdminLoginView.vue'),
  },
  {
    path: '/g/:gameId/admin',
    name: 'Admin',
    component: () => import('@/views/admin/AdminView.vue'),
    meta: { admin: true },
    children: [
      { path: '', redirect: to => `/g/${to.params.gameId}/admin/tracks` },
      { path: 'participants', name: 'AdminParticipants', component: () => import('@/views/admin/ParticipantsTab.vue') },
      { path: 'tracks',       name: 'AdminTracks',       component: () => import('@/views/admin/TracksTab.vue') },
      { path: 'checkpoints',  name: 'AdminCheckpoints',  component: () => import('@/views/admin/CheckpointsTab.vue') },
      { path: 'monitor',      name: 'AdminMonitor',      component: () => import('@/views/admin/MonitorTab.vue') },
      { path: 'routes',       name: 'AdminRoutes',       component: () => import('@/views/admin/RoutesTab.vue') },
      { path: 'settings',     name: 'AdminSettings',     component: () => import('@/views/admin/SettingsTab.vue') },
      { path: 'migrate',      name: 'AdminMigrate',      component: () => import('@/views/admin/MigrateView.vue') },
    ],
  },

  // ─── Superadmin routes ───────────────────────────────────────────────────────
  {
    path: '/superadmin/login',
    name: 'SuperAdminLogin',
    component: () => import('@/views/admin/AdminLoginView.vue'),
    props: { superAdmin: true },
  },
  {
    path: '/superadmin',
    name: 'SuperAdmin',
    component: () => import('@/views/superadmin/SuperAdminView.vue'),
    meta: { superAdmin: true },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const gameId = to.params.gameId ?? ''

  // Set game context before any auth check
  if (gameId) {
    useGameContextStore().setGame(gameId)
  }

  // ── Player auth ──────────────────────────────────────────────────────────────
  if (to.meta.requiresAuth || to.meta.guest) {
    const auth = useAuthStore()
    if (!auth.isLoggedIn) {
      await auth.restoreSession(gameId)
    }

    if (to.meta.requiresAuth && !auth.isLoggedIn) {
      const loginDayKey = auth.getLoginDayKey(gameId)
      if (localStorage.getItem(loginDayKey) === '2') {
        localStorage.removeItem(loginDayKey)
        return { name: 'LoginDay2', params: { gameId } }
      }
      return { name: 'Login', params: { gameId } }
    }

    if (to.meta.guest && auth.isLoggedIn) {
      const targetDay  = to.name === 'LoginDay2' ? 2 : 1
      const currentDay = auth.team?.day ?? 1

      if (currentDay !== targetDay) {
        try {
          await switchTeamDay(gameId, auth.pseudo, targetDay)
        } catch {
          return { name: 'Game', params: { gameId } }
        }
      }

      const needsPreLaunch = targetDay === 2
        ? !(auth.team?.preLaunchDay2Done)
        : !(auth.team?.preLaunchDone)
      if (needsPreLaunch) {
        await auth.refreshTeam()
        return { name: 'Intro', params: { gameId } }
      }

      return { name: 'Game', params: { gameId } }
    }
  }

  // ── Game admin auth ──────────────────────────────────────────────────────────
  if (to.meta.admin) {
    const adminAuth = useAdminAuthStore()
    await adminAuth.init(gameId)
    if (!adminAuth.isAuthenticated) {
      return { name: 'AdminLogin', params: { gameId } }
    }
    // Superadmins can access any game's admin
    if (!adminAuth.isSuperAdmin) {
      const hasAccess = await adminAuth.checkGameAccess(gameId)
      if (!hasAccess) return { name: 'AdminLogin', params: { gameId } }
    }
  }

  // ── Superadmin auth ──────────────────────────────────────────────────────────
  if (to.meta.superAdmin) {
    const adminAuth = useAdminAuthStore()
    await adminAuth.init()
    if (!adminAuth.isAuthenticated || !adminAuth.isSuperAdmin) {
      return { name: 'SuperAdminLogin' }
    }
  }
})
