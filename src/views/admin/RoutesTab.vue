<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTracks, getCheckpoints, getParticipants, assignRoutesToParticipants, activateDay2 } from '@/firebase/firestore'
import { generateRoutes } from '@/utils/routeGenerator'

const { t } = useI18n()

// ── State ──────────────────────────────────────────────────────────────────────
const tracks       = ref([])
const checkpoints  = ref([])
const participants = ref([])
const selectedTrackId = ref('')
const activeDay    = ref(1)
const isLoading    = ref(false)
const isAssigning  = ref(false)
const isActivating = ref(false)
const assigned     = ref(false)
const error        = ref('')
const successMsg   = ref('')

const generatedRoutes = ref([])  // [{ participantId, name, day1Order, day2Order }]

onMounted(async () => {
  isLoading.value = true
  try {
    [tracks.value, checkpoints.value, participants.value] = await Promise.all([
      getTracks(),
      getCheckpoints(),
      getParticipants(),
    ])
    if (tracks.value.length) selectedTrackId.value = tracks.value[0].id
    // If participants already have routes, show them
    if (participants.value.some(p => p.day1Order?.length)) {
      buildRoutesFromParticipants()
      assigned.value = true
    }
  } finally {
    isLoading.value = false
  }
})

// ── Derived ────────────────────────────────────────────────────────────────────
const selectedTrack = computed(() => tracks.value.find(t => t.id === selectedTrackId.value))

const checkpointMap = computed(() => {
  const m = {}
  checkpoints.value.forEach(cp => { m[cp.id] = cp })
  return m
})

// Sorted participants list (by name)
const sortedParticipants = computed(() =>
  [...participants.value].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
)

// Number of checkpoints in the selected track
const cpCount = computed(() => selectedTrack.value?.checkpointIds?.length ?? 0)
const half = computed(() => cpCount.value / 2)

// Table: one row per participant, columns = CP1..CP10 for the active day
const tableRows = computed(() => {
  if (!generatedRoutes.value.length) return []
  return sortedParticipants.value.map(p => {
    const route = generatedRoutes.value.find(r => r.participantId === p.id)
    if (!route) return { participant: p, cols: [] }
    const order = activeDay.value === 1 ? route.day1Order : route.day2Order
    return {
      participant: p,
      cols: order.map(cpId => checkpointMap.value[cpId]?.title ?? cpId),
    }
  })
})

// ── Actions ────────────────────────────────────────────────────────────────────
function buildRoutesFromParticipants() {
  generatedRoutes.value = participants.value
    .filter(p => p.day1Order?.length)
    .map(p => ({
      participantId: p.id,
      name:      p.name ?? p.id,
      day1Order: p.day1Order ?? [],
      day2Order: p.day2Order ?? [],
    }))
}

async function generateAndAssign() {
  error.value = ''
  successMsg.value = ''
  if (!selectedTrack.value) { error.value = t('admin.routes.selectTrack'); return }
  const cpIds = selectedTrack.value.checkpointIds ?? []
  if (cpIds.length < 2 || cpIds.length % 2 !== 0) {
    error.value = t('admin.routes.errorEvenRequired', { count: cpIds.length })
    return
  }
  if (!sortedParticipants.value.length) {
    error.value = t('admin.routes.errorNoTeams')
    return
  }

  isAssigning.value = true
  try {
    const routes = generateRoutes(cpIds, sortedParticipants.value.length)
    const assignments = sortedParticipants.value.map((p, i) => ({
      participantId: p.id,
      trackId:   selectedTrackId.value,
      day1Order: routes[i].day1Order,
      day2Order: routes[i].day2Order,
    }))
    await assignRoutesToParticipants(assignments)

    // Update local state
    assignments.forEach(a => {
      const p = participants.value.find(x => x.id === a.participantId)
      if (p) { p.day1Order = a.day1Order; p.day2Order = a.day2Order; p.assignedTrackId = a.trackId; p.day = 1 }
    })
    buildRoutesFromParticipants()
    assigned.value = true
    successMsg.value = t('admin.routes.successAssigned', { count: assignments.length })
  } catch (e) {
    error.value = e.message
  } finally {
    isAssigning.value = false
  }
}

async function handleActivateDay2() {
  if (!confirm(t('admin.routes.activateDay2Confirm'))) return
  error.value = ''
  successMsg.value = ''
  isActivating.value = true
  try {
    await activateDay2()
    participants.value = await getParticipants()
    buildRoutesFromParticipants()
    successMsg.value = t('admin.routes.successDay2')
  } catch (e) {
    error.value = e.message
  } finally {
    isActivating.value = false
  }
}
</script>

<template>
  <div class="space-y-6">

    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-2xl font-bold text-amber-400">🗓️ {{ t('admin.routes.title') }}</h2>
        <p class="text-slate-400 text-sm mt-0.5">{{ t('admin.routes.subtitle') }}</p>
      </div>

      <!-- Activate Day 2 button -->
      <button
        @click="handleActivateDay2"
        :disabled="isActivating || !assigned"
        class="btn-danger flex items-center gap-2 disabled:opacity-40"
      >
        <span v-if="isActivating" class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
        🌅 {{ t('admin.routes.activateDay2Btn') }}
      </button>
    </div>

    <!-- Error / success -->
    <div v-if="error" class="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{{ error }}</div>
    <div v-if="successMsg" class="p-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm">{{ successMsg }}</div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center gap-3 text-slate-400 py-8 justify-center">
      <div class="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      Chargement...
    </div>

    <template v-else>
      <!-- Config panel -->
      <div class="card space-y-4">
        <h3 class="font-bold text-white">{{ t('admin.routes.title') }}</h3>

        <div class="flex flex-wrap gap-4 items-end">
          <!-- Track selector -->
          <div class="flex-1 min-w-[200px]">
            <label class="block text-xs text-slate-400 mb-1">{{ t('admin.routes.masterTrack') }}</label>
            <select v-model="selectedTrackId" class="input-field">
              <option v-for="tr in tracks" :key="tr.id" :value="tr.id">
                {{ tr.name }} ({{ tr.checkpointIds?.length ?? 0 }} CP)
              </option>
            </select>
          </div>

          <!-- Stats -->
          <div class="text-sm text-slate-400 space-y-1">
            <div>📍 <strong class="text-white">{{ cpCount }}</strong> — <strong class="text-amber-400">{{ half }}</strong>/{{ t('leaderboard.day1').toLowerCase() }}</div>
            <div>👥 <strong class="text-white">{{ sortedParticipants.length }}</strong> {{ t('admin.routes.statsTeams', { count: sortedParticipants.length }) }}</div>
          </div>

          <!-- Generate button -->
          <button
            @click="generateAndAssign"
            :disabled="isAssigning || !selectedTrackId || cpCount === 0"
            class="btn-primary flex items-center gap-2 disabled:opacity-40"
          >
            <span v-if="isAssigning" class="w-4 h-4 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
            ⚡ {{ t('admin.routes.generateBtn') }}
          </button>
        </div>
      </div>

      <!-- Table -->
      <div v-if="assigned && tableRows.length" class="card space-y-4">

        <!-- Day tabs -->
        <div class="flex gap-2">
          <button
            v-for="d in [1, 2]" :key="d"
            @click="activeDay = d"
            :class="[
              'px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
              activeDay === d ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            ]"
          >
            ☀️ Jour {{ d }}
          </button>
        </div>

        <!-- Scrollable table -->
        <div class="overflow-x-auto rounded-xl border border-slate-700">
          <table class="w-full text-sm">
            <thead class="bg-slate-800">
              <tr>
                <th class="text-start px-3 py-2 text-slate-400 font-semibold sticky left-0 bg-slate-800 z-10 min-w-[140px]">
                  {{ t('admin.routes.teamCol') }}
                </th>
                <th
                  v-for="n in half" :key="n"
                  class="px-3 py-2 text-center text-amber-400 font-semibold whitespace-nowrap min-w-[110px]"
                >
                  CP{{ n }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in tableRows" :key="row.participant.id"
                :class="['border-t border-slate-700/50 transition-colors hover:bg-slate-800/50', idx % 2 === 0 ? 'bg-slate-900/30' : '']"
              >
                <td class="px-3 py-2 font-semibold text-white sticky left-0 bg-slate-900 z-10">
                  {{ row.participant.name }}
                  <span v-if="row.participant.day === 2" class="ms-1 text-xs text-blue-400">J2</span>
                </td>
                <td
                  v-for="(name, ci) in row.cols" :key="ci"
                  class="px-3 py-2 text-center text-slate-300 text-xs"
                >
                  {{ name }}
                </td>
                <td v-if="!row.cols.length" class="px-3 py-2 text-slate-600 text-xs italic">
                  {{ t('admin.routes.noRoute') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="text-xs text-slate-500">
          {{ tableRows.filter(r => r.cols.length).length }} / {{ sortedParticipants.length }} participants · {{ half }} CP/{{ t('game.timer').toLowerCase() }} · {{ t('leaderboard.day1') }} {{ activeDay }}
        </p>
      </div>

      <!-- Empty state -->
      <div v-else-if="!assigned" class="text-center py-12 text-slate-500">
        <div class="text-5xl mb-3">🗺️</div>
        <p>{{ t('admin.routes.noTrack') }}</p>
      </div>
    </template>

  </div>
</template>
