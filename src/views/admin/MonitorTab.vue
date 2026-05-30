<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import { subscribeToPhotos, subscribeToAudioRecordings } from '@/firebase/firestore'

const { t } = useI18n()
const admin = useAdminStore()

const photos = ref([])
const lightbox = ref(null)
const recordings = ref([])
let photosUnsubscribe = null
let recordingsUnsubscribe = null

const formatDuration = (s) => {
  if (!s) return '—'
  const m = Math.floor(s / 60), sec = s % 60
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`
}

onMounted(() => {
  photosUnsubscribe    = subscribeToPhotos((list) => { photos.value = list })
  recordingsUnsubscribe = subscribeToAudioRecordings((list) => { recordings.value = list })
})
onUnmounted(() => {
  photosUnsubscribe?.()
  recordingsUnsubscribe?.()
})

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
              <span class="font-semibold text-white">{{ team.displayName || team.pseudo }}</span>
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

    <!-- Photos gallery -->
    <div class="mt-10">
      <div class="flex items-center justify-between mb-4">
        <h2 class="section-title">📷 {{ t('admin.monitor.photos') }}</h2>
        <span class="text-sm text-slate-400">{{ t('admin.monitor.photosCount', { n: photos.length }) }}</span>
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

    <!-- Audio Recordings gallery -->
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
          <!-- Info -->
          <div class="min-w-0 flex-1">
            <p class="font-bold text-white truncate">{{ rec.teamName || rec.teamPseudo }}</p>
            <p class="text-slate-400 text-xs truncate">{{ rec.checkpointTitle }}</p>
          </div>
          <!-- Duration badge -->
          <span class="text-xs text-slate-400 tabular-nums shrink-0">{{ formatDuration(rec.durationSeconds) }}</span>
          <!-- Audio player -->
          <audio
            :src="rec.url"
            controls
            class="h-8 flex-1 min-w-[180px]"
            style="accent-color: #f59e0b;"
            preload="none"
          />
          <!-- Download -->
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

    <!-- Lightbox -->
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
