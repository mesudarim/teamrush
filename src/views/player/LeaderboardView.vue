<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useLeaderboardStore } from '@/stores/leaderboard'
import { useAuthStore } from '@/stores/auth'
import PlayerNav from '@/components/layout/PlayerNav.vue'

const { t } = useI18n()
const router = useRouter()
const lb = useLeaderboardStore()
const auth = useAuthStore()

onMounted(() => lb.subscribe())
onUnmounted(() => lb.cleanup())
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col">
    <PlayerNav />

    <div class="flex-1 p-4 max-w-2xl mx-auto w-full">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6 mt-2">
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
            <h1 class="text-2xl font-black text-white">{{ t('leaderboard.title') }}</h1>
            <div class="flex items-center gap-2 mt-1">
              <span class="pulse-dot" />
              <span class="text-xs text-slate-400">{{ t('leaderboard.live') }}</span>
            </div>
          </div>
        </div>
        <div class="badge-amber">{{ lb.teams.length }} {{ t('admin.monitor.total') }}</div>
      </div>

      <!-- Empty state -->
      <div v-if="lb.teams.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
        <div class="text-6xl mb-4">🏁</div>
        <p class="text-slate-400">{{ t('leaderboard.empty') }}</p>
      </div>

      <!-- Rankings -->
      <div v-else class="space-y-2">
        <div
          v-for="(team, idx) in lb.rankedTeams"
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
              'w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0',
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
            <div class="flex items-center gap-2">
              <span class="font-bold text-white truncate">{{ team.pseudo }}</span>
              <span v-if="team.pseudo === auth.pseudo" class="badge-amber text-xs">{{ t('leaderboard.team') }}</span>
              <span v-if="team.isFinished" class="badge-green text-xs">{{ t('leaderboard.finished') }}</span>
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>{{ lb.trackMap[team.trackId]?.name ?? team.trackId }}</span>
              <span>·</span>
              <span>{{ t('leaderboard.checkpoint') }} {{ (team.currentCheckpointIndex ?? 0) }}</span>
            </div>
          </div>

          <!-- Points + time -->
          <div class="text-right shrink-0">
            <div class="font-black text-xl" :class="idx === 0 ? 'text-amber-400' : 'text-slate-200'">
              {{ team.points ?? 0 }}
            </div>
            <div class="text-xs text-slate-400">{{ lb.formatTime(lb.elapsedSecondsFor(team)) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
