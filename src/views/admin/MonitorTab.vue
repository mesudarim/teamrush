<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import { subscribeToPhotos, subscribeToAudioRecordings, resetTeamDay2, activateDay2 } from '@/firebase/firestore'
import { ref as storageRef, getBlob } from 'firebase/storage'
import { storage } from '@/firebase/config'
import JSZip from 'jszip'

const { t } = useI18n()
const admin = useAdminStore()

const photos = ref([])
const lightbox = ref(null)
const recordings = ref([])
let photosUnsubscribe = null
let recordingsUnsubscribe = null

const downloadingPhotos = ref(false)
const downloadProgress  = ref(0)

// Extract the Firebase Storage path from a download URL.
// Format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/ENCODED_PATH?alt=media&token=...
const _storagePath = (url) => {
  try {
    const match = url.match(/\/o\/([^?]+)/)
    return match ? decodeURIComponent(match[1]) : null
  } catch { return null }
}

const downloadAllPhotos = async () => {
  if (!photos.value.length || downloadingPhotos.value) return
  downloadingPhotos.value = true
  downloadProgress.value  = 0
  try {
    const zip   = new JSZip()
    const total = photos.value.length
    let done    = 0

    for (const photo of photos.value) {
      const path = _storagePath(photo.url)
      console.log(`[download] ${done + 1}/${total} path="${path}" url="${photo.url.slice(0, 80)}…"`)
      try {
        let blob
        if (path) {
          blob = await Promise.race([
            getBlob(storageRef(storage, path)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout 15s')), 15000)),
          ])
        } else {
          blob = await fetch(photo.url).then(r => r.blob())
        }
        const ext  = blob.type.includes('png') ? 'png' : 'jpg'
        const team = (photo.teamName || photo.teamPseudo || 'equipe').replace(/[/\\?%*:|"<>]/g, '-')
        const cp   = (photo.checkpointTitle || '').replace(/[/\\?%*:|"<>]/g, '-')
        zip.file(`${String(done + 1).padStart(3, '0')}_${team}_${cp}.${ext}`, blob)
        console.log(`[download] ✅ ok`)
      } catch (err) {
        console.error(`[download] ❌ failed:`, err.message)
      } finally {
        done++
        downloadProgress.value = Math.round((done / total) * 100)
      }
    }

    const content = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href     = URL.createObjectURL(content)
    a.download = `teamrush-photos-${new Date().toISOString().slice(0, 10)}.zip`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  } finally {
    downloadingPhotos.value = false
    downloadProgress.value  = 0
  }
}

onMounted(() => {
  photosUnsubscribe    = subscribeToPhotos((list) => { photos.value = list })
  recordingsUnsubscribe = subscribeToAudioRecordings((list) => { recordings.value = list })
})
onUnmounted(() => {
  photosUnsubscribe?.()
  recordingsUnsubscribe?.()
})

// ── Sub-tabs ──────────────────────────────────────────────────────────────────
const activeTab = ref('day1') // 'day1' | 'day2' | 'total'

// ── Helpers ───────────────────────────────────────────────────────────────────
const trackMap = computed(() => {
  const map = {}
  admin.tracks.forEach((tr) => { map[tr.id] = tr })
  return map
})

const trackCheckpointCount = (trackId) => trackMap.value[trackId]?.checkpointIds?.length ?? 0

const formatDuration = (s) => {
  if (!s) return '—'
  const m = Math.floor(s / 60), sec = s % 60
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`
}

const fmtSecs = (secs) => {
  if (secs == null || isNaN(secs)) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

const MAX_SECS = 180 * 60 // 3 h cap for ongoing players

// Day 1 elapsed: start → day1FinishedAt (frozen) or now (capped at 3h)
const day1Elapsed = (team) => {
  const start = team.startedAt?.toDate?.()
  if (!start) return null
  if (team.day1Finished || team.isFinished || team.day === 2) {
    const end = team.day1FinishedAt?.toDate?.() ?? team.finishedAt?.toDate?.()
    if (end) return Math.floor((end - start) / 1000)
  }
  return Math.min(Math.floor((Date.now() - start.getTime()) / 1000), MAX_SECS)
}

// Day 2 elapsed: day2StartedAt → finishedAt (frozen) or now (capped at 3h)
const day2Elapsed = (team) => {
  const start = team.day2StartedAt?.toDate?.()
  if (!start) return null
  if (team.isFinished) {
    const end = team.finishedAt?.toDate?.()
    if (end) return Math.floor((end - start) / 1000)
  }
  return Math.min(Math.floor((Date.now() - start.getTime()) / 1000), MAX_SECS)
}

// Total elapsed: J1 duration + J2 duration (not the raw 24h span between days)
const totalElapsed = (team) => {
  const d1 = day1Elapsed(team)
  const d2 = day2Elapsed(team)
  if (d1 == null && d2 == null) return null
  return (d1 ?? 0) + (d2 ?? 0)
}

// ── DAY 1 TAB ─────────────────────────────────────────────────────────────────
const teamPriority = (t) => t.isFinished ? 2 : t.day1Finished ? 1 : 0

const sortedDay1 = computed(() =>
  [...admin.teams].sort((a, b) => {
    const pa = teamPriority(a), pb = teamPriority(b)
    if (pa !== pb) return pa - pb
    return (b.points ?? 0) - (a.points ?? 0)
  })
)

const totalActive   = computed(() => admin.teams.filter((t) => !t.isFinished && !t.day1Finished).length)
const totalDay1Done = computed(() => admin.teams.filter((t) => t.day1Finished && !t.isFinished).length)
const totalFinished = computed(() => admin.teams.filter((t) => t.isFinished).length)

// ── JOUR 2 ACTIVATION GUARD ───────────────────────────────────────────────────
// True when: it's a 2-day game (day2Order assigned), at least one team finished Day 1,
// and activateDay2() was never called (day1Points null on all teams).
const needsDay2Activation = computed(() =>
  admin.teams.length > 0 &&
  admin.teams.some(t => (t.day1Finished || t.isFinished) && (t.day2Order?.length > 0)) &&
  admin.teams.every(t => t.day1Points == null)
)

const activatingDay2 = ref(false)
const activateDay2Error = ref('')

const handleActivateDay2 = async () => {
  if (!confirm('Activer le Jour 2 pour TOUTES les équipes ?\nLes points du Jour 1 seront archivés et la progression réinitialisée.')) return
  activatingDay2.value = true
  activateDay2Error.value = ''
  try {
    await activateDay2()
  } catch (e) {
    activateDay2Error.value = e.message
  } finally {
    activatingDay2.value = false
  }
}

// ── DAY 2 / TOTAL POINTS ──────────────────────────────────────────────────────
// For teams with day1Points set: activateDay2() reset points → points = J2 only.
// For messy teams: classify by completedAt > day2StartedAt, add timeBonusPoints
// and AVG_EXTRA_J2 (average puzzle bonus from clean teams). Cap at team.points.

const AVG_EXTRA_J2 = 239  // average puzzle bonus on J2 derived from clean teams

const checkpointScoreMap = computed(() => {
  const map = {}
  admin.checkpoints.forEach((cp) => { map[cp.id] = cp.pointsCorrect ?? 0 })
  return map
})

const day2PtsOf = (team) => {
  if (team.day1Points != null) return team.points ?? 0  // clean: points = J2 only
  if (team.day !== 2 && !team.isFinished) return 0

  const extra = team.isFinished ? AVG_EXTRA_J2 : 0
  const total = team.points ?? 0

  // Primary: use checkpoint timestamps vs day2StartedAt
  const day2Start = team.day2StartedAt?.toDate?.()
  if (day2Start) {
    const times = team.checkpointTimes ?? {}
    let score = 0
    for (const cpId of (team.completedCheckpoints ?? [])) {
      const completedAt = times[cpId]?.completedAt?.toDate?.()
      if (completedAt && completedAt > day2Start) {
        score += checkpointScoreMap.value[cpId] ?? 0
      }
    }
    score += (team.timeBonusPoints ?? 0) + extra
    return Math.min(score, total)
  }

  // Fallback: use per-team day2Order route
  const day2Set = new Set(team.day2Order ?? [])
  if (!day2Set.size) return Math.min((team.timeBonusPoints ?? 0) + extra, total)
  let score = 0
  for (const cpId of (team.completedCheckpoints ?? [])) {
    if (day2Set.has(cpId)) score += checkpointScoreMap.value[cpId] ?? 0
  }
  score += (team.timeBonusPoints ?? 0) + extra
  return Math.min(score, total)
}

const day1PointsOf = (t) => {
  if (t.day1Points != null) return t.day1Points
  if (t.day !== 2 && !t.isFinished) return t.points ?? 0
  return Math.max(0, (t.points ?? 0) - day2PtsOf(t))
}

const sortedDay2 = computed(() =>
  [...admin.teams]
    .filter((t) => t.day === 2 || t.isFinished)
    .sort((a, b) => {
      if (a.isFinished && !b.isFinished) return 1
      if (!a.isFinished && b.isFinished) return -1
      return day2PtsOf(b) - day2PtsOf(a)
    })
)

// ── TOTAL TAB ─────────────────────────────────────────────────────────────────
const totalPts = (t) => {
  if (t.day1Points != null) return (t.day1Points ?? 0) + (t.points ?? 0)
  return t.points ?? 0  // combined: no double-count
}

const sortedTotal = computed(() =>
  [...admin.teams]
    .filter((t) => t.day1Finished || t.isFinished || t.day1Points != null)
    .sort((a, b) => totalPts(b) - totalPts(a))
)

// ── J2 BREAKDOWN DEBUG ────────────────────────────────────────────────────────
const expandedDebug = ref(null)

const day2Breakdown = (team) => {
  if (team.day1Points != null) {
    return {
      method: 'clean',
      lines: [
        `day1Points = ${team.day1Points} (archivé par activateDay2)`,
        `points (J2 seulement) = ${team.points ?? 0}`,
      ],
      timeBonusPoints: null,
      total: team.points ?? 0,
    }
  }
  const day2Start = team.day2StartedAt?.toDate?.()
  const times = team.checkpointTimes ?? {}
  const cpNameMap = {}
  admin.checkpoints.forEach(cp => { cpNameMap[cp.id] = cp.title ?? cp.id })

  if (day2Start) {
    const lines = []
    let checkpointTotal = 0
    for (const cpId of (team.completedCheckpoints ?? [])) {
      const completedAt = times[cpId]?.completedAt?.toDate?.()
      const pts = checkpointScoreMap.value[cpId] ?? 0
      const isJ2 = completedAt && completedAt > day2Start
      const tag = isJ2 ? '✅ J2' : '⬛ J1'
      const time = completedAt ? completedAt.toLocaleTimeString('fr-FR') : '?'
      lines.push(`${tag} [${time}] ${cpNameMap[cpId] ?? cpId} = +${isJ2 ? pts : 0} pts`)
      if (isJ2) checkpointTotal += pts
    }
    const bonus = team.timeBonusPoints ?? 0
    return {
      method: 'timestamp (day2StartedAt = ' + day2Start.toLocaleTimeString('fr-FR') + ')',
      lines,
      timeBonusPoints: bonus,
      total: checkpointTotal + bonus,
    }
  }

  // Fallback: day2Order
  const day2Set = new Set(team.day2Order ?? [])
  const lines = []
  let checkpointTotal = 0
  for (const cpId of (team.completedCheckpoints ?? [])) {
    const pts = checkpointScoreMap.value[cpId] ?? 0
    const isJ2 = day2Set.has(cpId)
    lines.push(`${isJ2 ? '✅ J2' : '⬛ J1'} ${cpNameMap[cpId] ?? cpId} = +${isJ2 ? pts : 0} pts`)
    if (isJ2) checkpointTotal += pts
  }
  const bonus = team.timeBonusPoints ?? 0
  return {
    method: day2Set.size ? 'day2Order (fallback)' : '⚠️ aucun day2StartedAt ni day2Order → total utilisé',
    lines,
    timeBonusPoints: bonus,
    total: day2Set.size ? checkpointTotal + bonus : (team.points ?? 0),
  }
}

// ── RESET DAY 2 ───────────────────────────────────────────────────────────────
const resetState = ref({})
const askReset    = (pseudo) => { resetState.value = { ...resetState.value, [pseudo]: 'confirm' } }
const cancelReset = (pseudo) => { resetState.value = { ...resetState.value, [pseudo]: 'idle'    } }
const confirmReset = async (pseudo) => {
  resetState.value = { ...resetState.value, [pseudo]: 'loading' }
  try {
    await resetTeamDay2(pseudo)
    resetState.value = { ...resetState.value, [pseudo]: 'idle' }
  } catch (e) {
    console.error('resetTeamDay2 failed:', e)
    resetState.value = { ...resetState.value, [pseudo]: 'error' }
    setTimeout(() => { resetState.value = { ...resetState.value, [pseudo]: 'idle' } }, 3000)
  }
}
</script>

<template>
  <div>
    <!-- ── Header stats ─────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="section-title">{{ t('admin.monitor.title') }}</h2>
        <div class="flex items-center gap-2 mt-1">
          <span class="pulse-dot" />
          <span class="text-xs text-slate-400">{{ t('leaderboard.live') }}</span>
        </div>
      </div>
      <div class="flex gap-3 text-center flex-wrap">
        <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
          <div class="text-2xl font-black text-white">{{ admin.teams.length }}</div>
          <div class="text-xs text-slate-400">Total</div>
        </div>
        <div class="bg-slate-800 rounded-xl p-3 border border-blue-500/30">
          <div class="text-2xl font-black text-blue-400">{{ totalActive }}</div>
          <div class="text-xs text-slate-400">{{ t('admin.monitor.active') }}</div>
        </div>
        <div class="bg-slate-800 rounded-xl p-3 border border-orange-500/30">
          <div class="text-2xl font-black text-orange-400">{{ totalDay1Done }}</div>
          <div class="text-xs text-slate-400">{{ t('admin.monitor.day1done') }}</div>
        </div>
        <div class="bg-slate-800 rounded-xl p-3 border border-green-500/30">
          <div class="text-2xl font-black text-green-400">{{ totalFinished }}</div>
          <div class="text-xs text-slate-400">{{ t('admin.monitor.finished') }}</div>
        </div>
      </div>
    </div>

    <!-- ── ALERTE : Activer Jour 2 ────────────────────────────────────────── -->
    <div
      v-if="needsDay2Activation"
      class="mb-6 rounded-2xl border-2 border-amber-500 bg-amber-500/10 p-5 flex flex-col sm:flex-row items-center gap-4"
    >
      <div class="text-4xl shrink-0">🚨</div>
      <div class="flex-1 text-center sm:text-left">
        <div class="text-amber-400 font-black text-lg">Activer le Jour 2 avant de continuer !</div>
        <div class="text-slate-300 text-sm mt-0.5">
          Des équipes ont terminé le Jour 1 mais <strong>activateDay2</strong> n'a pas encore été appelé.
          Sans ça, les points J1 et J2 seront mélangés dans le même compteur.
        </div>
        <div v-if="activateDay2Error" class="text-red-400 text-xs mt-1">{{ activateDay2Error }}</div>
      </div>
      <button
        @click="handleActivateDay2"
        :disabled="activatingDay2"
        class="shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl font-black text-slate-900 bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all disabled:opacity-50 text-base shadow-lg shadow-amber-500/30"
      >
        <span v-if="activatingDay2" class="w-4 h-4 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
        🌅 Activer le Jour 2
      </button>
    </div>

    <!-- ── Sub-tabs ─────────────────────────────────────────────────────────── -->
    <div class="flex gap-1 mb-4 bg-slate-800/60 p-1 rounded-xl w-fit">
      <button
        v-for="tab in ['day1', 'day2', 'total']"
        :key="tab"
        @click="activeTab = tab"
        :class="[
          'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
          activeTab === tab
            ? 'bg-amber-500 text-slate-900'
            : 'text-slate-400 hover:text-white'
        ]"
      >
        {{ tab === 'day1' ? 'Jour 1' : tab === 'day2' ? 'Jour 2' : 'Total' }}
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- DAY 1 TAB                                                              -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'day1'" class="card overflow-x-auto p-0">
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
            v-for="(team, idx) in sortedDay1"
            :key="team.id"
            :class="[
              'border-b border-slate-700/50 transition-colors',
              team.day1Finished && !team.isFinished
                ? 'bg-orange-950/20 hover:bg-orange-950/30'
                : 'hover:bg-slate-700/30'
            ]"
          >
            <td class="px-4 py-3 text-slate-500 font-bold">{{ idx + 1 }}</td>
            <td class="px-4 py-3">
              <span class="font-semibold text-white">{{ team.displayName || team.pseudo }}</span>
            </td>
            <td class="px-4 py-3 text-slate-300">{{ trackMap[team.trackId]?.name ?? team.trackId }}</td>
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
              {{ fmtSecs(day1Elapsed(team)) }}
            </td>
            <td class="px-4 py-3 text-center">
              <span :class="team.isFinished ? 'badge-green' : team.day1Finished ? 'badge-orange' : 'badge-blue'">
                {{ team.isFinished ? t('admin.monitor.finished') : team.day1Finished ? t('admin.monitor.day1done') : t('admin.monitor.active') }}
              </span>
            </td>
          </tr>
          <tr v-if="sortedDay1.length === 0">
            <td colspan="7" class="text-center text-slate-500 py-12">{{ t('leaderboard.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- DAY 2 TAB                                                              -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeTab === 'day2'" class="card overflow-x-auto p-0">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-700">
            <th class="text-start px-4 py-3 text-slate-400 font-semibold">#</th>
            <th class="text-start px-4 py-3 text-slate-400 font-semibold">{{ t('admin.monitor.team') }}</th>
            <th class="text-start px-4 py-3 text-slate-400 font-semibold">{{ t('admin.monitor.track') }}</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">{{ t('admin.monitor.checkpoint') }}</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">Pts J2</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">Temps J2</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">{{ t('admin.monitor.status') }}</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">Reset J2</th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="(team, idx) in sortedDay2"
            :key="team.id"
          >
            <tr
              class="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
              @click="expandedDebug = expandedDebug === team.pseudo ? null : team.pseudo"
            >
              <td class="px-4 py-3 text-slate-500 font-bold">{{ idx + 1 }}</td>
              <td class="px-4 py-3">
                <span class="font-semibold text-white">{{ team.displayName || team.pseudo }}</span>
                <span class="ml-1 text-slate-500 text-xs">{{ expandedDebug === team.pseudo ? '▲' : '▼' }}</span>
              </td>
              <td class="px-4 py-3 text-slate-300">{{ trackMap[team.trackId]?.name ?? team.trackId }}</td>
              <td class="px-4 py-3 text-center">
                <span class="font-semibold text-slate-200">
                  {{ team.currentCheckpointIndex ?? 0 }}
                  <span class="text-slate-500">/{{ team.day2Order?.length ?? trackCheckpointCount(team.trackId) }}</span>
                </span>
              </td>
              <td class="px-4 py-3 text-center">
                <span class="font-black text-amber-400 text-base">{{ day2PtsOf(team) }}</span>
              </td>
              <td class="px-4 py-3 text-center text-slate-300 font-mono">
                {{ fmtSecs(day2Elapsed(team)) }}
              </td>
              <td class="px-4 py-3 text-center">
                <span :class="team.isFinished ? 'badge-green' : !team.preLaunchDay2Done ? 'badge-orange' : 'badge-blue'">
                  {{ team.isFinished ? t('admin.monitor.finished') : !team.preLaunchDay2Done ? 'Pré-lancement' : t('admin.monitor.active') }}
                </span>
              </td>
              <!-- Reset Day 2 -->
              <td class="px-4 py-3 text-center" @click.stop>
                <button
                  v-if="!resetState[team.pseudo] || resetState[team.pseudo] === 'idle'"
                  @click="askReset(team.pseudo)"
                  class="text-xs px-2.5 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-red-500/50 hover:text-red-400 transition-colors"
                >↺ J2</button>
                <div v-else-if="resetState[team.pseudo] === 'confirm'" class="flex items-center justify-center gap-1">
                  <button @click="confirmReset(team.pseudo)"
                          class="text-xs px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors">OK</button>
                  <button @click="cancelReset(team.pseudo)"
                          class="text-xs px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">✕</button>
                </div>
                <span v-else-if="resetState[team.pseudo] === 'loading'" class="text-xs text-slate-500 animate-pulse">…</span>
                <span v-else class="text-xs text-red-400 font-bold">✕ err</span>
              </td>
            </tr>
            <!-- Debug breakdown row -->
            <tr v-if="expandedDebug === team.pseudo" class="bg-slate-900/60">
              <td colspan="8" class="px-6 py-3">
                <div class="font-mono text-xs text-slate-300 space-y-0.5">
                  <div class="text-slate-500 mb-1">Méthode : <span class="text-blue-400">{{ day2Breakdown(team).method }}</span></div>
                  <div v-for="line in day2Breakdown(team).lines" :key="line"
                       :class="line.startsWith('✅') ? 'text-green-400' : 'text-slate-500'">
                    {{ line }}
                  </div>
                  <div v-if="day2Breakdown(team).timeBonusPoints != null" class="text-yellow-400 mt-1">
                    + Bonus temps = {{ day2Breakdown(team).timeBonusPoints }} pts
                  </div>
                  <div class="text-amber-400 font-bold mt-1 border-t border-slate-700 pt-1">
                    = Total J2 calculé : {{ day2Breakdown(team).total }} pts
                    &nbsp;|&nbsp; points (Firestore) = {{ team.points ?? 0 }}
                    &nbsp;|&nbsp; day1Points = {{ team.day1Points ?? 'null' }}
                    &nbsp;|&nbsp; timeBonusPoints = {{ team.timeBonusPoints ?? 0 }}
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="sortedDay2.length === 0">
            <td colspan="8" class="text-center text-slate-500 py-12">Aucun joueur sur le jour 2</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- TOTAL TAB                                                              -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div v-else class="card overflow-x-auto p-0">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-700">
            <th class="text-start px-4 py-3 text-slate-400 font-semibold">#</th>
            <th class="text-start px-4 py-3 text-slate-400 font-semibold">{{ t('admin.monitor.team') }}</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">Pts J1</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">Pts J2</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">Total</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">Temps total</th>
            <th class="text-center px-4 py-3 text-slate-400 font-semibold">{{ t('admin.monitor.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(team, idx) in sortedTotal"
            :key="team.id"
            class="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
          >
            <td class="px-4 py-3 text-slate-500 font-bold">{{ idx + 1 }}</td>
            <td class="px-4 py-3">
              <span class="font-semibold text-white">{{ team.displayName || team.pseudo }}</span>
            </td>
            <td class="px-4 py-3 text-center text-slate-300">{{ day1PointsOf(team) }}</td>
            <td class="px-4 py-3 text-center text-slate-300">
              {{ (team.day === 2 || team.isFinished) ? day2PtsOf(team) : '—' }}
            </td>
            <td class="px-4 py-3 text-center">
              <span class="font-black text-amber-400 text-base">{{ totalPts(team) }}</span>
            </td>
            <td class="px-4 py-3 text-center text-slate-300 font-mono">
              {{ fmtSecs(totalElapsed(team)) }}
            </td>
            <td class="px-4 py-3 text-center">
              <span :class="team.isFinished ? 'badge-green' : team.day1Finished ? 'badge-orange' : 'badge-blue'">
                {{ team.isFinished ? t('admin.monitor.finished') : team.day1Finished ? t('admin.monitor.day1done') : t('admin.monitor.active') }}
              </span>
            </td>
          </tr>
          <tr v-if="sortedTotal.length === 0">
            <td colspan="7" class="text-center text-slate-500 py-12">{{ t('leaderboard.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Photos gallery ───────────────────────────────────────────────────── -->
    <div class="mt-10">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 class="section-title">📷 {{ t('admin.monitor.photos') }}</h2>
          <span class="text-sm text-slate-400">{{ t('admin.monitor.photosCount', { n: photos.length }) }}</span>
        </div>
        <button
          v-if="photos.length > 0"
          @click="downloadAllPhotos"
          :disabled="downloadingPhotos"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-600 text-slate-300 hover:border-amber-500/60 hover:text-amber-400 transition-colors disabled:opacity-50"
        >
          <span v-if="downloadingPhotos" class="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          <span v-else>⬇</span>
          {{ downloadingPhotos ? `${downloadProgress}%` : `Tout télécharger (${photos.length})` }}
        </button>
      </div>

      <div v-if="photos.length === 0" class="card text-center text-slate-500 py-10">
        {{ t('admin.monitor.photosEmpty') }}
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        <div
          v-for="photo in photos"
          :key="photo.id"
          class="group relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-800 cursor-pointer hover:border-amber-500/50 transition-colors"
          @click="lightbox = photo"
        >
          <img :src="photo.url" :alt="photo.teamName || photo.teamPseudo" class="w-full h-full object-cover" loading="lazy" />
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <p class="text-white text-xs font-bold truncate">{{ photo.teamName || photo.teamPseudo }}</p>
            <p class="text-slate-400 text-xs truncate">{{ photo.checkpointTitle }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Audio Recordings ─────────────────────────────────────────────────── -->
    <div class="mt-10">
      <div class="flex items-center justify-between mb-4">
        <h2 class="section-title">🎤 {{ t('admin.monitor.recordings') }}</h2>
        <span class="text-sm text-slate-400">{{ t('admin.monitor.recordingsCount', { n: recordings.length }) }}</span>
      </div>

      <div v-if="recordings.length === 0" class="card text-center text-slate-500 py-10">
        {{ t('admin.monitor.recordingsEmpty') }}
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="rec in recordings"
          :key="rec.id"
          class="card p-4 flex items-center gap-4 flex-wrap"
        >
          <div class="min-w-0 flex-1">
            <p class="font-bold text-white truncate">{{ rec.teamName || rec.teamPseudo }}</p>
            <p class="text-slate-400 text-xs truncate">{{ rec.checkpointTitle }}</p>
          </div>
          <span class="text-xs text-slate-400 tabular-nums shrink-0">{{ formatDuration(rec.durationSeconds) }}</span>
          <audio
            :src="rec.url"
            controls
            class="h-8 flex-1 min-w-[180px]"
            style="accent-color: #f59e0b;"
            preload="none"
          />
          <a
            :href="rec.url"
            target="_blank"
            download
            class="btn-secondary text-xs py-1.5 px-3 shrink-0"
            @click.stop
          >
            ↓ {{ t('admin.monitor.download') }}
          </a>
        </div>
      </div>
    </div>

    <!-- ── Lightbox ─────────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="lightbox"
          class="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 gap-4"
          @click.self="lightbox = null"
        >
          <button @click="lightbox = null" class="absolute top-4 right-4 text-white text-2xl font-black leading-none bg-slate-700 w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-600">✕</button>
          <img :src="lightbox.url" class="max-w-full max-h-[75vh] rounded-2xl object-contain shadow-2xl" />
          <div class="text-center space-y-1">
            <p class="text-white font-bold">{{ lightbox.teamName || lightbox.teamPseudo }}</p>
            <p class="text-slate-400 text-sm">{{ lightbox.checkpointTitle }}</p>
          </div>
          <a
            :href="lightbox.url"
            target="_blank"
            download
            class="btn-primary text-sm py-2 px-6"
            @click.stop
          >
            ↓ {{ t('admin.monitor.download') }}
          </a>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
