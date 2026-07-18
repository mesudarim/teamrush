<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import { getCheckpoints, getParticipants, assignRoutesToParticipants, activateDay2, activateDay1, getSettings, updateSettings } from '@/firebase/firestore'
import { generateRoutes } from '@/utils/routeGenerator'

const { t } = useI18n()
const route = useRoute()
const admin = useAdminStore()
const gid   = () => route.params.gameId

// ── State ──────────────────────────────────────────────────────────────────────
const checkpoints            = ref([])
const participants           = ref([])
const checkpointsPerDay      = ref(10)
const finalCheckpointDay1Id  = ref('')   // pinned last on every Day 1 route
const finalCheckpointDay2Id  = ref('')   // pinned last on every Day 2 route
const activeDay              = ref(1)
const isLoading              = ref(false)
const isAssigning            = ref(false)
const isActivating           = ref(false)
const assigned               = ref(false)
const error                  = ref('')
const successMsg             = ref('')

const generatedRoutes = ref([])  // [{ participantId, name, day1Order, day2Order }]

// Detect active day from admin.teams (real-time listener) — teams.day is updated by activateDay2()
const currentGameDay = computed(() =>
  admin.teams.some(t => t.day === 2) ? 2 : 1
)

onMounted(async () => {
  isLoading.value = true
  try {
    const [cps, parts, settings] = await Promise.all([
      getCheckpoints(gid()),
      getParticipants(gid()),
      getSettings(gid()),
    ])
    checkpoints.value  = cps
    participants.value = parts
    if (settings.finalCheckpointDay1Id) finalCheckpointDay1Id.value = settings.finalCheckpointDay1Id
    if (settings.finalCheckpointDay2Id) finalCheckpointDay2Id.value = settings.finalCheckpointDay2Id
    // backward compat: promote old single finalCheckpointId to day1 if new fields absent
    if (!settings.finalCheckpointDay1Id && settings.finalCheckpointId) {
      finalCheckpointDay1Id.value = settings.finalCheckpointId
    }
    if (participants.value.some(p => p.day1Order?.length)) {
      buildRoutesFromParticipants()
      assigned.value = true
    }
  } finally {
    isLoading.value = false
  }
})

const saveFinalCheckpoint = async () => {
  await updateSettings(gid(), {
    finalCheckpointDay1Id: finalCheckpointDay1Id.value,
    finalCheckpointDay2Id: finalCheckpointDay2Id.value,
  })
}

// ── Derived ────────────────────────────────────────────────────────────────────

// For each day's dropdown: exclude the other day's final to prevent reuse
const cpOptionsDay1 = computed(() =>
  finalCheckpointDay2Id.value
    ? checkpoints.value.filter(cp => cp.id !== finalCheckpointDay2Id.value)
    : checkpoints.value
)
const cpOptionsDay2 = computed(() =>
  finalCheckpointDay1Id.value
    ? checkpoints.value.filter(cp => cp.id !== finalCheckpointDay1Id.value)
    : checkpoints.value
)

// Which final is active for the currently displayed day (for table header highlight)
const activeDayFinalId = computed(() =>
  activeDay.value === 1 ? finalCheckpointDay1Id.value : finalCheckpointDay2Id.value
)

const checkpointMap = computed(() => {
  const m = {}
  checkpoints.value.forEach(cp => { m[cp.id] = cp })
  return m
})

const sortedParticipants = computed(() =>
  [...participants.value].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
)

const cpCount = computed(() => checkpoints.value.length)

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
  const cpIds    = checkpoints.value.map(cp => cp.id)
  const ppd      = checkpointsPerDay.value
  const final1   = finalCheckpointDay1Id.value || null
  const final2   = finalCheckpointDay2Id.value || null
  const finalsSet = new Set([final1, final2].filter(Boolean))
  const poolSize  = cpIds.length - finalsSet.size
  const randomDay1 = ppd - (final1 ? 1 : 0)
  const randomDay2 = ppd - (final2 ? 1 : 0)
  if (ppd < 1 || randomDay1 < 0 || randomDay2 < 0 || randomDay1 + randomDay2 > poolSize) {
    error.value = t('admin.routes.errorTooFew', { ppd, ppd_x2: ppd * 2, total: cpIds.length })
    return
  }
  if (!sortedParticipants.value.length) {
    error.value = t('admin.routes.errorNoTeams')
    return
  }

  isAssigning.value = true
  try {
    await saveFinalCheckpoint()
    const routes = generateRoutes(cpIds, sortedParticipants.value.length, ppd, final1, final2)
    const assignments = sortedParticipants.value.map((p, i) => ({
      participantId: p.id,
      trackId:   '',
      day1Order: routes[i].day1Order,
      day2Order: routes[i].day2Order,
    }))
    await assignRoutesToParticipants(gid(), assignments)

    assignments.forEach(a => {
      const p = participants.value.find(x => x.id === a.participantId)
      if (p) { p.day1Order = a.day1Order; p.day2Order = a.day2Order; p.day = 1 }
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
    await activateDay2(gid())
    participants.value = await getParticipants(gid())
    buildRoutesFromParticipants()
    successMsg.value = t('admin.routes.successDay2')
  } catch (e) {
    error.value = e.message
  } finally {
    isActivating.value = false
  }
}

async function handleActivateDay1() {
  if (!confirm(t('admin.routes.activateDay1Confirm'))) return
  error.value = ''
  successMsg.value = ''
  isActivating.value = true
  try {
    await activateDay1(gid())
    participants.value = await getParticipants(gid())
    buildRoutesFromParticipants()
    successMsg.value = t('admin.routes.successDay1')
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

      <!-- Day toggle -->
      <div v-if="assigned" class="flex bg-slate-800 rounded-2xl p-1 gap-1 border border-slate-700">

        <!-- Day 1 segment -->
        <div
          v-if="currentGameDay === 1"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-slate-900 shadow"
        >
          ☀️ {{ t('admin.routes.day1Label') }}
        </div>
        <button
          v-else
          @click="handleActivateDay1"
          :disabled="isActivating"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-700/60 text-slate-400 hover:bg-slate-600 hover:text-white transition-all disabled:opacity-40"
        >
          <span v-if="isActivating" class="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ☀️ {{ t('admin.routes.day1Activate') }}
        </button>

        <!-- Day 2 segment -->
        <button
          v-if="currentGameDay === 1"
          @click="handleActivateDay2"
          :disabled="isActivating"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-700/60 text-slate-400 hover:bg-slate-600 hover:text-white transition-all disabled:opacity-40"
        >
          <span v-if="isActivating" class="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          {{ t('admin.routes.day2Activate') }} 🌅
        </button>
        <div
          v-else
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-green-500 text-white shadow"
        >
          🌅 {{ t('admin.routes.day2Label') }}
        </div>

      </div>
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
        <div class="space-y-4">
          <div class="flex flex-wrap gap-4 items-end justify-between">
            <!-- Left: stats + checkpoints per day -->
            <div class="flex flex-wrap gap-5 items-end">
              <div class="text-sm text-slate-400 space-y-1">
                <div>📍 <strong class="text-white">{{ cpCount }}</strong> {{ t('admin.routes.statsCheckpoints') }}</div>
                <div>👥 <strong class="text-white">{{ sortedParticipants.length }}</strong> {{ t('admin.routes.statsParticipants') }}</div>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">{{ t('admin.routes.checkpointsPerDay') }}</label>
                <input
                  v-model.number="checkpointsPerDay"
                  type="number"
                  min="1"
                  :max="cpCount"
                  class="input-field w-24 text-center font-bold text-white text-lg"
                />
              </div>
            </div>

            <!-- Generate button -->
            <button
              @click="generateAndAssign"
              :disabled="isAssigning || cpCount === 0"
              class="btn-primary flex items-center gap-2 disabled:opacity-40"
            >
              <span v-if="isAssigning" class="w-4 h-4 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
              ⚡ {{ t('admin.routes.generateBtn') }}
            </button>
          </div>

          <!-- Final checkpoints (one per day) -->
          <div class="border-t border-slate-700 pt-4 grid sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1.5">
                🏁 Checkpoint final — Jour 1
              </label>
              <select v-model="finalCheckpointDay1Id" class="input-field text-sm">
                <option value="">— Aucun —</option>
                <option v-for="cp in cpOptionsDay1" :key="cp.id" :value="cp.id">
                  {{ cp.title }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1.5">
                🏁 Checkpoint final — Jour 2
              </label>
              <select v-model="finalCheckpointDay2Id" class="input-field text-sm">
                <option value="">— Aucun —</option>
                <option v-for="cp in cpOptionsDay2" :key="cp.id" :value="cp.id">
                  {{ cp.title }}
                </option>
              </select>
            </div>
            <p class="sm:col-span-2 text-xs text-slate-500">
              Ce checkpoint sera placé en dernier sur chaque parcours du jour correspondant et exclu du pool aléatoire de l'autre jour.
            </p>
          </div>
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
                  v-for="n in checkpointsPerDay" :key="n"
                  :class="[
                    'px-3 py-2 text-center font-semibold whitespace-nowrap min-w-[110px]',
                    activeDayFinalId && n === checkpointsPerDay ? 'text-amber-300 bg-amber-500/10' : 'text-amber-400'
                  ]"
                >
                  {{ activeDayFinalId && n === checkpointsPerDay ? '🏁' : `CP${n}` }}
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
          {{ tableRows.filter(r => r.cols.length).length }} / {{ sortedParticipants.length }} participants · {{ checkpointsPerDay }} CP/{{ t('game.timer').toLowerCase() }} · {{ t('leaderboard.day1') }} {{ activeDay }}
        </p>
      </div>

      <!-- Empty state -->
      <div v-else-if="!assigned" class="text-center py-12 text-slate-500">
        <div class="text-5xl mb-3">🗺️</div>
        <p>{{ t('admin.routes.noRoutes') }}</p>
      </div>
    </template>

  </div>
</template>
