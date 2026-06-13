<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useLeaderboardStore } from '@/stores/leaderboard'
import { useAuthStore } from '@/stores/auth'
import PlayerNav from '@/components/layout/PlayerNav.vue'

const { t } = useI18n()
const router = useRouter()
const lb   = useLeaderboardStore()
const auth = useAuthStore()

// 'day1' | 'day2' | 'total'
const activeTab = ref('day1')

const displayedTeams = computed(() => {
  if (!lb.isTwoDay) return lb.rankedTeams
  if (activeTab.value === 'day2')  return lb.rankedTeamsDay2
  if (activeTab.value === 'total') return lb.rankedTeamsTotal
  return lb.rankedTeamsDay1
})

const pointsFor = (team) => {
  if (!lb.isTwoDay) return lb.currentDayPoints(team)
  if (activeTab.value === 'day2')  return lb.day2PointsFor(team)
  if (activeTab.value === 'total') return lb.totalPoints(team)
  return lb.day1PointsFor(team)
}

onMounted(() => lb.subscribe())
onUnmounted(() => lb.cleanup())
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col">
    <PlayerNav />

    <div class="flex-1 p-4 max-w-2xl mx-auto w-full">

      <!-- Header -->
      <div class="flex items-center justify-between mb-4 mt-2">
        <div class="flex items-center gap-3">
          <button
            v-if="auth.isLoggedIn"
            @click="router.push({ name: 'Game' })"
            class="w-9 h-9 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors shrink-0"
          >
            <svg class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-white"
                style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
              {{ t('leaderboard.title') }}
            </h1>
            <div class="flex items-center gap-2 mt-1">
              <span class="pulse-dot" />
              <span class="text-xs text-slate-400">{{ t('leaderboard.live') }}</span>
            </div>
          </div>
        </div>
        <div class="badge-amber">{{ lb.teams.length }} {{ t('admin.monitor.total') }}</div>
      </div>

      <!-- Day tabs (only in 2-day mode) -->
      <div v-if="lb.isTwoDay" class="flex gap-1.5 mb-4 bg-slate-800 p-1 rounded-2xl">
        <button
          v-for="tab in ['day1', 'day2', 'total']"
          :key="tab"
          @click="activeTab = tab"
          :class="[
            'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
            activeTab === tab
              ? 'bg-amber-500 text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          ]"
        >
          {{ tab === 'day1' ? t('leaderboard.day1') : tab === 'day2' ? t('leaderboard.day2') : t('leaderboard.total') }}
        </button>
      </div>

      <!-- Empty state -->
      <div v-if="lb.teams.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
        <div class="text-6xl mb-4">🏁</div>
        <p class="text-slate-400">{{ t('leaderboard.empty') }}</p>
      </div>

      <!-- Rankings -->
      <div v-else class="space-y-2">
        <div
          v-for="(team, idx) in displayedTeams"
          :key="team.id"
          :class="[
            'flex items-center gap-4 p-4 rounded-2xl border transition-all',
            team.pseudo === auth.pseudo
              ? 'bg-amber-500/10 border-amber-500/40'
              : 'bg-slate-800 border-slate-700',
            idx === 0 ? 'shadow-lg shadow-amber-500/10' : ''
          ]"
        >
          <!-- Rank -->
          <div
            :class="[
              'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0',
              idx === 0 ? 'bg-amber-500 text-slate-900' :
              idx === 1 ? 'bg-slate-400 text-slate-900' :
              idx === 2 ? 'bg-amber-700 text-white' :
              'bg-slate-700 text-slate-400'
            ]"
          >
            {{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1 }}
          </div>

          <!-- Team info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-white truncate"
                    style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
                {{ team.displayName || team.pseudo }}
              </span>
              <span v-if="team.pseudo === auth.pseudo" class="badge-amber text-xs">{{ t('leaderboard.team') }}</span>
              <span v-if="team.isFinished" class="badge-green text-xs">{{ t('leaderboard.finished') }}</span>
              <span v-else-if="team.day1Finished" class="badge-orange text-xs">{{ t('leaderboard.day1') }} ✓</span>
              <span v-else-if="team.day === 2" class="badge-blue text-xs">{{ t('leaderboard.day2') }}</span>
            </div>
            <!-- Sub-label: breakdown in total view -->
            <div v-if="activeTab === 'total' && lb.isTwoDay" class="flex items-center gap-2 text-xs mt-0.5">
              <span class="text-slate-500">
                J1: <span class="text-slate-300">{{ lb.day1PointsFor(team) }}</span>
              </span>
              <span class="text-slate-600">+</span>
              <span class="text-slate-500">
                J2: <span class="text-slate-300">{{ lb.day2PointsFor(team) }}</span>
              </span>
            </div>
            <div v-else class="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>{{ t('leaderboard.checkpoint') }} {{ (team.currentCheckpointIndex ?? 0) }}</span>
            </div>
          </div>

          <!-- Points + time -->
          <div class="text-right shrink-0">
            <div class="font-bold text-xl"
                 :class="idx === 0 ? 'text-amber-400' : 'text-slate-200'"
                 style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
              {{ pointsFor(team) }}
            </div>
            <div class="text-xs text-slate-400">{{ lb.formatTime(lb.elapsedSecondsFor(team)) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
