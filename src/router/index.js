import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminAuthStore } from '@/stores/adminAuth'
import { switchTeamDay } from '@/firebase/firestore'

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
    path: '/pre-launch',
    name: 'PreLaunch',
    component: () => import('@/views/player/PreLaunchView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/game',
    name: 'Game',
    component: () => import('@/views/player/GameView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/day2',
    name: 'LoginDay2',
    component: () => import('@/views/player/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/leaderboard',
    name: 'Leaderboard',
    component: () => import('@/views/player/LeaderboardView.vue'),
  },
  {
    path: '/resultats',
    name: 'Day1Results',
    component: () => import('@/views/player/ResultsView.vue'),
    props: { mode: 'day1' },
  },
  {
    path: '/resultats/jour2',
    name: 'Day2Results',
    component: () => import('@/views/player/ResultsView.vue'),
    props: { mode: 'day2' },
  },
  {
    path: '/resultats/total',
    name: 'TotalResults',
    component: () => import('@/views/player/ResultsView.vue'),
    props: { mode: 'total' },
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
      { path: 'routes',       name: 'AdminRoutes',       component: () => import('@/views/admin/RoutesTab.vue') },
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

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    const loginDay = localStorage.getItem('teamrush_login_day')
    if (loginDay === '2') {
      localStorage.removeItem('teamrush_login_day')
      return { name: 'LoginDay2' }
    }
    return { name: 'Login' }
  }

  if (to.meta.guest && auth.isLoggedIn) {
    const targetDay = to.name === 'LoginDay2' ? 2 : 1
    const currentDay = auth.team?.day ?? 1

    if (currentDay !== targetDay) {
      try {
        await switchTeamDay(auth.pseudo, targetDay)
      } catch (e) {
        // DAY2_ALREADY_FINISHED — go to game, loadCurrentCheckpoint shows the finished screen
        return { name: 'Game' }
      }
    }

    // Check pre-launch for the target day regardless of whether the day changed.
    // This handles post-reset state (preLaunchDay2Done reset to false while already on Day 2).
    const needsPreLaunch = targetDay === 2
      ? !(auth.team?.preLaunchDay2Done)
      : !(auth.team?.preLaunchDone)
    if (needsPreLaunch) {
      // Refresh so IntroView sees the correct/latest team state.
      await auth.refreshTeam()
      return { name: 'Intro' }
    }
    // Pre-launch already done: go to Game but do NOT call refreshTeam() here when
    // the day changed — the subscribeToTeam callback in game.js needs to see the
    // prevDay change to trigger loadTrack(); calling refreshTeam() would clobber it.

    return { name: 'Game' }
  }

  // Admin: require Google authentication
  if (to.meta.admin) {
    const adminAuth = useAdminAuthStore()
    await adminAuth.init()
    if (!adminAuth.isAuthenticated) return { name: 'AdminLogin' }
  }
})
