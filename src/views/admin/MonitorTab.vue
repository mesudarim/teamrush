<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'

const { t } = useI18n()
const admin = useAdminStore()

const trackMap = computed(() => {
  const map = {}
  admin.tracks.forEach((tr) => { map[tr.id] = tr })
  return map
})

const trackCheckpointCount = (trackId) => trackMap.value[trackId]?.checkpointIds?.length ?? 0

const sorted = computed(() =>
  [...admin.teams].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
)

const totalActive = computed(() => admin.teams.filter((t) => !t.isFinished).length)
const totalFinished = computed(() => admin.teams.filter((t) => t.isFinished).length)

const formatTime = (team) => {
  const start = team.startedAt?.toDate?.()
  if (!start) return '—'
  const end = team.isFinished ? (team.finishedAt?.toDate?.() ?? new Date()) : new Date()
  const secs = Math.floor((end - start) / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="section-title">{{ t('admin.monitor.title') }}</h2>
        <div class="flex items-center gap-2 mt-1">
          <span class="pulse-dot" />
          <span class="text-xs text-slate-400">{{ t('leaderboard.live') }}</span>
        </div>
      </div>
      <div class="flex gap-3 text-center">
        <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
          <div class="text-2xl font-black text-white">{{ admin.teams.length }}</div>
          <div class="text-xs text-slate-400">Total</div>
        </div>
        <div class="bg-slate-800 rounded-xl p-3 border border-green-500/30">
          <div class="text-2xl font-black text-green-400">{{ totalActive }}</div>
          <div class="text-xs text-slate-400">{{ t('admin.monitor.active') }}</div>
        </div>
        <div class="bg-slate-800 rounded-xl p-3 border border-amber-500/30">
          <div class="text-2xl font-black text-amber-400">{{ totalFinished }}</div>
          <div class="text-xs text-slate-400">{{ t('admin.monitor.finished') }}</div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="card overflow-x-auto p-0">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-700">
            <th class="text-start px-4 py-3 text-slate-400 font-semibold">#</th>
            <th class="text-start px-4 py-3 text-slate-400 font-semibold">{{ t('admin.monitor.team') }}</th>
            <th class="text-start px-4 py-3 text-slate-400 font-semibold">{{ t('admin.monitor.track') }}</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">{{ t('admin.monitor.checkpoint') }}</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">{{ t('admin.monitor.points') }}</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">{{ t('admin.monitor.elapsed') }}</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">{{ t('admin.monitor.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(team, idx) in sorted"
            :key="team.id"
            class="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
          >
            <td class="px-4 py-3 text-slate-500 font-bold">{{ idx + 1 }}</td>
            <td class="px-4 py-3">
              <span class="font-semibold text-white">{{ team.pseudo }}</span>
            </td>
            <td class="px-4 py-3 text-slate-300">
              {{ trackMap[team.trackId]?.name ?? team.trackId }}
            </td>
            <td class="px-4 py-3 text-center">
              <span class="font-semibold text-slate-200">
                {{ team.currentCheckpointIndex ?? 0 }}
                <span class="text-slate-500">/{{ trackCheckpointCount(team.trackId) }}</span>
              </span>
            </td>
            <td class="px-4 py-3 text-center">
              <span class="font-black text-amber-400 text-base">{{ team.points ?? 0 }}</span>
            </td>
            <td class="px-4 py-3 text-center text-slate-300 font-mono">
              {{ formatTime(team) }}
            </td>
            <td class="px-4 py-3 text-center">
              <span :class="team.isFinished ? 'badge-green' : 'badge-blue'">
                {{ team.isFinished ? t('admin.monitor.finished') : t('admin.monitor.active') }}
              </span>
            </td>
          </tr>
          <tr v-if="admin.teams.length === 0">
            <td colspan="7" class="text-center text-slate-500 py-12">{{ t('leaderboard.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
