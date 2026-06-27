<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useLeaderboardStore } from '@/stores/leaderboard'

const props = defineProps({
  mode: { type: String, default: 'day1' }, // 'day1' | 'day2' | 'total'
})

const lb = useLeaderboardStore()

// ── Config per mode ───────────────────────────────────────────────────────────
const config = computed(() => ({
  day1:  { title: 'תוצאות יום 1',  subtitle: 'תוצאות סופיות · מירוץ לצפון',     icon: '🏆' },
  day2:  { title: 'תוצאות יום 2',  subtitle: 'ניקוד יום 2 · מירוץ לצפון',        icon: '🎯' },
  total: { title: 'דירוג כולל',    subtitle: 'יום 1 + יום 2 · מירוץ לצפון',      icon: '⭐' },
})[props.mode])

// ── Teams to display ──────────────────────────────────────────────────────────
const rankedTeams = computed(() => {
  if (props.mode === 'day1')
    // Include teams that finished Day 1 OR have a Day 1 points snapshot
    return lb.rankedTeamsDay1.filter(t => t.day1Finished || t.day1Points != null)
  if (props.mode === 'day2')
    return lb.rankedTeamsDay2.filter(t => t.preLaunchDay2Done || t.isFinished)
  // total: anyone who finished (day 2 end) or has data for both days
  return lb.rankedTeamsTotal.filter(t => t.isFinished || (t.day1Finished && (t.preLaunchDay2Done || t.day === 2)))
})

const pointsFor = (team) => {
  if (props.mode === 'day2')  return lb.day2PointsFor(team)
  if (props.mode === 'total') return lb.totalPoints(team)
  return lb.day1PointsFor(team)
}

// ── Elapsed time per mode ─────────────────────────────────────────────────────
const elapsedFor = (team) => {
  if (props.mode === 'day1') {
    const s = team.startedAt?.toDate?.()
    const e = team.day1FinishedAt?.toDate?.()
    if (!s || !e) return 0
    return Math.floor((e - s) / 1000)
  }
  if (props.mode === 'day2') {
    const s = team.day2StartedAt?.toDate?.()
    const e = team.isFinished ? team.finishedAt?.toDate?.() : null
    if (!s || !e) return 0
    return Math.floor((e - s) / 1000)
  }
  // total: Day 1 start → Day 2 finish
  const s = team.startedAt?.toDate?.()
  const e = team.isFinished ? team.finishedAt?.toDate?.() : null
  if (!s || !e) return 0
  return Math.floor((e - s) / 1000)
}

const formatTime = (s) => {
  if (!s) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

const medals = ['🥇', '🥈', '🥉']

const podiumTeams = computed(() => rankedTeams.value.slice(0, 3))
const hasPodium   = computed(() => rankedTeams.value.length >= 3)

onMounted(() => lb.subscribe())
onUnmounted(() => lb.cleanup())
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col" dir="rtl">

    <!-- Header -->
    <div class="bg-slate-800/80 border-b border-slate-700 px-4 py-5 text-center">
      <div class="text-5xl mb-2">{{ config.icon }}</div>
      <h1 class="text-2xl font-black text-white"
          style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
        {{ config.title }}
      </h1>
      <p class="text-slate-400 text-sm mt-1"
         style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
        {{ config.subtitle }}
      </p>
    </div>

    <div class="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">

      <!-- Empty state -->
      <div v-if="rankedTeams.length === 0"
           class="flex flex-col items-center justify-center py-20 text-center">
        <div class="text-6xl mb-4">⏳</div>
        <p class="text-slate-400 text-lg"
           style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
          התוצאות יופיעו כאן בסיום
        </p>
      </div>

      <template v-else>

        <!-- Podium (top 3) -->
        <div v-if="hasPodium" class="mb-8">
          <div class="flex items-end justify-center gap-2">

            <!-- 2nd place -->
            <div class="flex flex-col items-center gap-2 flex-1">
              <div class="text-3xl">🥈</div>
              <div class="bg-slate-700/60 border border-slate-600 rounded-2xl p-3 w-full text-center">
                <div class="font-bold text-white text-sm truncate"
                     style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
                  {{ podiumTeams[1].displayName || podiumTeams[1].pseudo }}
                </div>
                <div class="text-slate-200 font-black text-xl tabular-nums">
                  {{ pointsFor(podiumTeams[1]) }}
                </div>
                <div class="text-slate-500 text-xs">{{ formatTime(elapsedFor(podiumTeams[1])) }}</div>
              </div>
              <div class="bg-slate-600 w-full rounded-t-xl h-16 flex items-center justify-center">
                <span class="font-black text-slate-300 text-xl">2</span>
              </div>
            </div>

            <!-- 1st place -->
            <div class="flex flex-col items-center gap-2 flex-1">
              <div class="text-4xl">🥇</div>
              <div class="bg-amber-500/15 border border-amber-500/50 rounded-2xl p-3 w-full text-center shadow-lg shadow-amber-500/10">
                <div class="font-bold text-amber-300 text-sm truncate"
                     style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
                  {{ podiumTeams[0].displayName || podiumTeams[0].pseudo }}
                </div>
                <div class="text-amber-400 font-black text-2xl tabular-nums">
                  {{ pointsFor(podiumTeams[0]) }}
                </div>
                <div class="text-slate-400 text-xs">{{ formatTime(elapsedFor(podiumTeams[0])) }}</div>
              </div>
              <div class="bg-amber-500 w-full rounded-t-xl h-24 flex items-center justify-center">
                <span class="font-black text-slate-900 text-2xl">1</span>
              </div>
            </div>

            <!-- 3rd place -->
            <div class="flex flex-col items-center gap-2 flex-1">
              <div class="text-3xl">🥉</div>
              <div class="bg-slate-700/60 border border-slate-600 rounded-2xl p-3 w-full text-center">
                <div class="font-bold text-white text-sm truncate"
                     style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
                  {{ podiumTeams[2].displayName || podiumTeams[2].pseudo }}
                </div>
                <div class="text-slate-200 font-black text-xl tabular-nums">
                  {{ pointsFor(podiumTeams[2]) }}
                </div>
                <div class="text-slate-500 text-xs">{{ formatTime(elapsedFor(podiumTeams[2])) }}</div>
              </div>
              <div class="bg-amber-700/60 w-full rounded-t-xl h-10 flex items-center justify-center">
                <span class="font-black text-amber-200 text-xl">3</span>
              </div>
            </div>

          </div>
        </div>

        <!-- Full ranking list -->
        <div class="space-y-2">
          <h2 class="text-slate-400 text-xs font-semibold tracking-widest uppercase mb-3 px-1"
              style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
            דירוג מלא
          </h2>

          <div
            v-for="(team, idx) in rankedTeams"
            :key="team.id"
            :class="[
              'flex items-center gap-4 px-4 py-3.5 rounded-2xl border',
              idx === 0 ? 'bg-amber-500/10 border-amber-500/30' :
              idx === 1 ? 'bg-slate-700/40 border-slate-600' :
              idx === 2 ? 'bg-amber-700/10 border-amber-700/30' :
              'bg-slate-800/60 border-slate-700/60'
            ]"
          >
            <!-- Rank -->
            <div :class="[
              'w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base shrink-0',
              idx === 0 ? 'bg-amber-500 text-slate-900' :
              idx === 1 ? 'bg-slate-400 text-slate-900' :
              idx === 2 ? 'bg-amber-700 text-white' :
              'bg-slate-700 text-slate-400'
            ]">
              {{ idx < 3 ? medals[idx] : idx + 1 }}
            </div>

            <!-- Name + sub-info -->
            <div class="flex-1 min-w-0">
              <div class="font-bold text-white truncate"
                   style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
                {{ team.displayName || team.pseudo }}
              </div>
              <!-- Total mode: show day breakdown -->
              <div v-if="props.mode === 'total'" class="text-xs text-slate-500 mt-0.5">
                יום 1: {{ lb.day1PointsFor(team) }} · יום 2: {{ lb.day2PointsFor(team) }}
              </div>
              <div v-else class="text-xs text-slate-500 tabular-nums mt-0.5">
                {{ formatTime(elapsedFor(team)) }}
              </div>
            </div>

            <!-- Points -->
            <div :class="[
              'font-black text-xl tabular-nums shrink-0',
              idx === 0 ? 'text-amber-400' : 'text-slate-200'
            ]" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
              {{ pointsFor(team) }}
            </div>
          </div>
        </div>

        <p class="text-center text-slate-600 text-xs mt-6"
           style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
          {{ rankedTeams.length }} קבוצות
        </p>

      </template>
    </div>
  </div>
</template>
