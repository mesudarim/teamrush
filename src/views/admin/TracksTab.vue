<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import { getCheckpoints } from '@/firebase/firestore'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'

const { t } = useI18n()
const route = useRoute()
const admin = useAdminStore()
const gid = () => route.params.gameId

const showForm = ref(false)
const editingId = ref(null)
const confirmDeleteId = ref(null)
const saving = ref(false)

const form = ref(emptyForm())

function emptyForm() {
  return { name: '', nameEn: '', description: '', checkpointIds: [], isActive: true }
}

const allCheckpoints = computed(() => admin.checkpoints)

const startCreate = () => {
  form.value = emptyForm()
  editingId.value = null
  showForm.value = true
}

const startEdit = (track) => {
  form.value = { ...track, checkpointIds: [...(track.checkpointIds ?? [])] }
  editingId.value = track.id
  showForm.value = true
}

const cancelForm = () => { showForm.value = false; editingId.value = null }

const saveTrack = async () => {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    await admin.saveTrack({ ...form.value }, editingId.value)
    cancelForm()
  } finally {
    saving.value = false
  }
}

const deleteTrack = async () => {
  if (!confirmDeleteId.value) return
  await admin.removeTrack(confirmDeleteId.value)
  confirmDeleteId.value = null
}

const toggleCheckpoint = (cpId) => {
  const idx = form.value.checkpointIds.indexOf(cpId)
  if (idx === -1) form.value.checkpointIds.push(cpId)
  else form.value.checkpointIds.splice(idx, 1)
}

const moveUp = (idx) => {
  if (idx === 0) return
  const arr = form.value.checkpointIds
  ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
}

const moveDown = (idx) => {
  const arr = form.value.checkpointIds
  if (idx === arr.length - 1) return
  ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
}

const cpName = (id) => admin.checkpoints.find((c) => c.id === id)?.title ?? id

// ── Open Mode Routing ─────────────────────────────────────────────────────────
const normalizeOpenRouting = (r) => ({
  zones: r?.zones ?? [],
  paths: r?.paths ?? [],
  finalCheckpointId: r?.finalCheckpointId ?? '',
})

const routingForm = ref(normalizeOpenRouting(null))
const routingCheckpoints = ref([])

const savingRouting = ref(false)
const savedRouting  = ref(false)
const savingPaths   = ref(false)
const savedPaths    = ref(false)

onMounted(async () => {
  routingForm.value = normalizeOpenRouting(admin.settings?.openModeRouting)
  routingCheckpoints.value = await getCheckpoints(gid())
})

watch(() => admin.settings?.openModeRouting, (r) => {
  routingForm.value = normalizeOpenRouting(r)
}, { deep: true })

const addZone = () => {
  const zoneNum = routingForm.value.zones.length + 1
  routingForm.value.zones.push({ id: 'z_' + Date.now(), name: `Zone ${zoneNum}`, checkpointIds: [], pickCount: 1 })
}
const removeZone = (zi) => {
  const zoneId = routingForm.value.zones[zi].id
  routingForm.value.zones.splice(zi, 1)
  for (const path of routingForm.value.paths) {
    path.zoneOrder = path.zoneOrder.filter(id => id !== zoneId)
  }
}
const toggleZoneCheckpoint = (zone, cpId) => {
  const idx = zone.checkpointIds.indexOf(cpId)
  if (idx === -1) zone.checkpointIds.push(cpId)
  else zone.checkpointIds.splice(idx, 1)
}
const cpUsedElsewhere = (zone, cpId) =>
  routingForm.value.zones.some(z => z !== zone && z.checkpointIds.includes(cpId))
const addPath = () => {
  routingForm.value.paths.push({ id: 'p_' + Date.now(), name: '', zoneOrder: [] })
}
const removePath = (pi) => { routingForm.value.paths.splice(pi, 1) }
const moveZoneInPath = (path, zIdx, dir) => {
  const j = zIdx + dir
  if (j < 0 || j >= path.zoneOrder.length) return
  ;[path.zoneOrder[zIdx], path.zoneOrder[j]] = [path.zoneOrder[j], path.zoneOrder[zIdx]]
}
const addZoneToPath  = (path, zoneId) => { if (!path.zoneOrder.includes(zoneId)) path.zoneOrder.push(zoneId) }
const removeZoneFromPath = (path, idx) => { path.zoneOrder.splice(idx, 1) }

const openRoutingZoneTotal = computed(() =>
  routingForm.value.zones.reduce((s, z) => s + (z.pickCount || 0), 0)
)
const openRoutingTotal = computed(() =>
  openRoutingZoneTotal.value + (routingForm.value.finalCheckpointId ? 1 : 0)
)

const cpNumberMap = computed(() =>
  Object.fromEntries(routingCheckpoints.value.map((cp, i) => [cp.id, i + 1]))
)

const _saveOpenRouting = () => admin.saveSettings({ openModeRouting: routingForm.value })

const saveRouting = async () => {
  savingRouting.value = true
  try {
    await _saveOpenRouting()
    savedRouting.value = true
    setTimeout(() => { savedRouting.value = false }, 2500)
  } finally {
    savingRouting.value = false
  }
}

const savePaths = async () => {
  savingPaths.value = true
  try {
    await _saveOpenRouting()
    savedPaths.value = true
    setTimeout(() => { savedPaths.value = false }, 2500)
  } finally {
    savingPaths.value = false
  }
}

// ── Checkpoint overview map (modal) ───────────────────────────────────────────
const ZONE_COLORS = [
  { bg: '#ef4444', border: '#991b1b', text: '#fff' },
  { bg: '#3b82f6', border: '#1e40af', text: '#fff' },
  { bg: '#22c55e', border: '#14532d', text: '#fff' },
  { bg: '#a855f7', border: '#581c87', text: '#fff' },
  { bg: '#f97316', border: '#7c2d12', text: '#fff' },
  { bg: '#06b6d4', border: '#164e63', text: '#fff' },
  { bg: '#ec4899', border: '#831843', text: '#fff' },
  { bg: '#84cc16', border: '#365314', text: '#000' },
  { bg: '#eab308', border: '#713f12', text: '#000' },
  { bg: '#14b8a6', border: '#134e4a', text: '#fff' },
]
const UNASSIGNED_COLOR = { bg: '#6b7280', border: '#374151', text: '#fff' }

const showMapModal = ref(false)
const mapModalRef  = ref(null)
const mapLegend    = ref([])
let _mapInst = null

const openMapModal = async () => {
  showMapModal.value = true
  await nextTick()
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  if (_mapInst) { _mapInst.remove(); _mapInst = null }
  _mapInst = L.map(mapModalRef.value, { zoomControl: true })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
  }).addTo(_mapInst)

  const zones = routingForm.value?.zones ?? []
  const cpZoneIndex = {}
  zones.forEach((zone, zi) => {
    (zone.checkpointIds ?? []).forEach(id => { cpZoneIndex[id] = zi })
  })

  const withCoords = routingCheckpoints.value.filter(cp => cp.mapLat && cp.mapLng)
  if (!withCoords.length) {
    _mapInst.setView([31.7683, 35.2137], 13)
    mapLegend.value = []
    return
  }

  const hasUnassigned = withCoords.some(cp => cpZoneIndex[cp.id] === undefined)
  mapLegend.value = [
    ...zones.map((z, i) => ({ name: z.name || `Zone ${i + 1}`, color: ZONE_COLORS[i % ZONE_COLORS.length] })),
    ...(hasUnassigned ? [{ name: t('admin.settings.openRouting.unassigned'), color: UNASSIGNED_COLOR }] : []),
  ]

  const bounds = []
  withCoords.forEach(cp => {
    const num      = cpNumberMap.value[cp.id]
    const zoneIdx  = cpZoneIndex[cp.id]
    const color    = zoneIdx !== undefined ? ZONE_COLORS[zoneIdx % ZONE_COLORS.length] : UNASSIGNED_COLOR
    const zoneName = zoneIdx !== undefined
      ? (zones[zoneIdx].name || `Zone ${zoneIdx + 1}`)
      : t('admin.settings.openRouting.unassigned')
    const icon = L.divIcon({
      html: `<div style="background:${color.bg};color:${color.text};border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;border:2px solid ${color.border};box-shadow:0 2px 6px rgba(0,0,0,.6)">${num}</div>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
    L.marker([cp.mapLat, cp.mapLng], { icon })
      .bindTooltip(`<b>#${num}</b> — ${cp.title || cp.id}<br><span style="color:${color.bg}">● ${zoneName}</span>`, { direction: 'top', offset: [0, -16] })
      .addTo(_mapInst)
    bounds.push([cp.mapLat, cp.mapLng])
  })
  _mapInst.fitBounds(bounds, { padding: [50, 50] })
}

const closeMapModal = () => {
  showMapModal.value = false
  if (_mapInst) { _mapInst.remove(); _mapInst = null }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="section-title">{{ t('admin.tracks.title') }}</h2>
      <button @click="startCreate" class="btn-primary py-2 px-4 text-sm">
        + {{ t('admin.tracks.create') }}
      </button>
    </div>

    <!-- Track list -->
    <div v-if="admin.tracks.length === 0 && !showForm" class="card text-center text-slate-400 py-12">
      {{ t('admin.tracks.empty') }}
    </div>

    <div v-else class="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <div
        v-for="track in admin.tracks"
        :key="track.id"
        class="card hover:border-amber-500/30 transition-colors"
      >
        <div class="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 class="font-bold text-white text-lg">{{ track.name }}</h3>
            <p v-if="track.nameEn" class="text-slate-400 text-xs">{{ track.nameEn }}</p>
          </div>
          <span :class="track.isActive ? 'badge-green' : 'badge-red'">
            {{ track.isActive ? t('admin.tracks.active') : t('admin.tracks.inactive') }}
          </span>
        </div>
        <p v-if="track.description" class="text-slate-400 text-sm mb-3 whitespace-pre-line">{{ track.description }}</p>
        <div class="mb-4 space-y-1">
          <div v-if="track.checkpointIds?.length" class="space-y-1">
            <div
              v-for="(cpId, idx) in track.checkpointIds"
              :key="cpId"
              class="flex items-center gap-2 text-xs text-slate-400"
            >
              <span class="w-5 h-5 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-slate-300 shrink-0">{{ idx + 1 }}</span>
              <span class="truncate">{{ cpName(cpId) }}</span>
            </div>
          </div>
          <div v-else class="text-xs text-slate-600 italic">Aucun checkpoint assigné</div>
        </div>
        <div class="flex gap-2">
          <button @click="startEdit(track)" class="btn-secondary text-xs py-1.5 px-3 flex-1">{{ t('admin.tracks.edit') }}</button>
          <button @click="confirmDeleteId = track.id" class="btn-danger text-xs py-1.5 px-3">{{ t('admin.tracks.delete') }}</button>
        </div>
      </div>
    </div>

    <!-- Track form -->
    <Transition name="slide-down">
      <div v-if="showForm" class="card-glow space-y-5">
        <h3 class="font-bold text-lg text-amber-400">
          {{ editingId ? t('admin.tracks.edit') : t('admin.tracks.create') }}
        </h3>

        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.tracks.name') }} *</label>
            <input v-model="form.name" class="input-field" :placeholder="t('admin.tracks.name')" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.tracks.nameEn') }}</label>
            <input v-model="form.nameEn" class="input-field" :placeholder="t('admin.tracks.nameEn')" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.tracks.description') }}</label>
          <input v-model="form.description" class="input-field" />
        </div>

        <div class="flex items-center gap-3">
          <label class="text-sm font-semibold text-slate-300">{{ t('admin.tracks.active') }}</label>
          <button
            @click="form.isActive = !form.isActive"
            :class="['relative w-12 h-6 rounded-full transition-colors', form.isActive ? 'bg-amber-500' : 'bg-slate-600']"
          >
            <span :class="['absolute top-1 w-4 h-4 rounded-full bg-white transition-all', form.isActive ? 'start-7' : 'start-1']" />
          </button>
        </div>

        <!-- Checkpoint selector + reorder -->
        <div>
          <label class="block text-sm font-semibold text-slate-300 mb-2">{{ t('admin.tracks.checkpoints') }}</label>

          <!-- Assigned (ordered) -->
          <div v-if="form.checkpointIds.length" class="mb-3 space-y-1">
            <div
              v-for="(cpId, idx) in form.checkpointIds"
              :key="cpId"
              class="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              <span class="text-slate-400 w-5 text-center font-bold">{{ idx + 1 }}</span>
              <span class="flex-1 text-slate-200 truncate">{{ cpName(cpId) }}</span>
              <div class="flex gap-1">
                <button @click="moveUp(idx)" class="text-slate-400 hover:text-white px-1" :disabled="idx === 0">↑</button>
                <button @click="moveDown(idx)" class="text-slate-400 hover:text-white px-1" :disabled="idx === form.checkpointIds.length - 1">↓</button>
                <button @click="toggleCheckpoint(cpId)" class="text-red-400 hover:text-red-300 px-1">✕</button>
              </div>
            </div>
          </div>

          <!-- Available checkpoints to add -->
          <div class="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
            <button
              v-for="cp in allCheckpoints"
              :key="cp.id"
              @click="toggleCheckpoint(cp.id)"
              :class="[
                'text-start px-3 py-2 rounded-lg border text-sm transition-colors',
                form.checkpointIds.includes(cp.id)
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                  : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
              ]"
            >
              <div class="flex items-center gap-2">
                <span :class="form.checkpointIds.includes(cp.id) ? 'text-amber-400' : 'text-slate-500'">
                  {{ form.checkpointIds.includes(cp.id) ? '✓' : '+' }}
                </span>
                <span class="truncate">{{ cp.title }}</span>
              </div>
            </button>
          </div>
        </div>

        <div class="flex gap-3">
          <button @click="saveTrack" :disabled="saving || !form.name.trim()" class="btn-primary flex-1">
            {{ saving ? t('common.loading') : t('admin.checkpoints.save') }}
          </button>
          <button @click="cancelForm" class="btn-secondary">{{ t('common.cancel') }}</button>
        </div>
      </div>
    </Transition>

    <ConfirmModal
      :is-open="!!confirmDeleteId"
      :message="t('admin.tracks.confirmDelete')"
      @confirm="deleteTrack"
      @cancel="confirmDeleteId = null"
    />

    <!-- ══ Open Mode Routing ════════════════════════════════════════════════════ -->
    <Transition name="saved">
      <div v-if="admin.settings?.registrationMode === 'open'" class="card-glow space-y-5 mt-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-sm font-bold text-white">🗺 {{ t('admin.settings.openRouting.title') }}</h3>
            <p class="text-xs text-slate-400 mt-1">{{ t('admin.settings.openRouting.desc') }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              v-if="routingCheckpoints.length"
              @click="openMapModal"
              class="flex items-center gap-1.5 btn-secondary text-xs px-3 py-1.5"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
              </svg>
              {{ t('admin.settings.openRouting.openMap') }}
            </button>
            <button
              @click="saveRouting"
              :disabled="savingRouting"
              class="flex items-center gap-1.5 btn-primary text-xs px-3 py-1.5"
            >
              <svg v-if="savingRouting" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <svg v-else-if="savedRouting" class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>
              {{ savedRouting ? t('admin.settings.saved') : t('admin.settings.openRouting.saveRouting') }}
            </button>
          </div>
        </div>

        <!-- Final checkpoint -->
        <div>
          <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.settings.openRouting.finalCheckpoint') }}</label>
          <select v-model="routingForm.finalCheckpointId" class="input-field">
            <option value="">{{ t('admin.settings.openRouting.noFinal') }}</option>
            <option v-for="cp in routingCheckpoints" :key="cp.id" :value="cp.id">
              {{ cp.title || cp.id }}
            </option>
          </select>
          <p class="text-xs text-slate-500 mt-1">{{ t('admin.settings.openRouting.finalHint') }}</p>
        </div>

        <!-- Zones -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-sm font-semibold text-slate-200">{{ t('admin.settings.openRouting.zones') }}</span>
              <span v-if="routingForm.zones.length"
                    class="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                {{ openRoutingZoneTotal }} pts
              </span>
            </div>
            <button @click="addZone" class="btn-secondary text-xs px-3 py-1.5">+ {{ t('admin.settings.openRouting.addZone') }}</button>
          </div>

          <p v-if="!routingForm.zones.length" class="text-xs text-slate-500 italic p-3 rounded-xl border border-dashed border-slate-600 text-center">
            {{ t('admin.settings.openRouting.noZones') }}
          </p>

          <div v-for="(zone, zi) in routingForm.zones" :key="zone.id"
               class="p-4 rounded-xl border border-slate-600 bg-slate-800/60 space-y-3">
            <!-- Zone header -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-amber-400 font-bold shrink-0">{{ zi + 1 }}</span>
              <input v-model="zone.name" class="input-field input-sm flex-1 text-sm" :placeholder="t('admin.settings.openRouting.zoneName')" />
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-xs text-slate-400">{{ t('admin.settings.openRouting.pickCount') }}</span>
                <input v-model.number="zone.pickCount" type="number" min="1" :max="Math.max(1, zone.checkpointIds.length)"
                       class="input-field input-sm w-14 text-center text-sm font-bold" />
              </div>
              <button @click="removeZone(zi)" class="text-red-400 hover:text-red-300 px-1 shrink-0 text-sm">✕</button>
            </div>

            <!-- Checkpoint assignment -->
            <div>
              <label class="block text-xs text-slate-400 mb-2">
                {{ t('admin.settings.openRouting.assignCheckpoints') }}
                <span class="text-amber-400 font-semibold ms-1">{{ zone.checkpointIds.length }} {{ t('admin.settings.openRouting.selected') }}</span>
              </label>
              <div v-if="routingCheckpoints.length" class="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto pr-1">
                <label
                  v-for="cp in routingCheckpoints.filter(c => c.id !== routingForm.finalCheckpointId)"
                  :key="cp.id"
                  :class="['flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors select-none',
                    cpUsedElsewhere(zone, cp.id)
                      ? 'opacity-35 cursor-not-allowed bg-slate-800/40 border border-slate-700 text-slate-600'
                      : zone.checkpointIds.includes(cp.id)
                        ? 'cursor-pointer bg-amber-500/15 border border-amber-500/40 text-amber-300'
                        : 'cursor-pointer bg-slate-700/50 border border-slate-600 text-slate-400 hover:border-slate-500']"
                >
                  <input type="checkbox"
                    :checked="zone.checkpointIds.includes(cp.id)"
                    :disabled="cpUsedElsewhere(zone, cp.id)"
                    @change="toggleZoneCheckpoint(zone, cp.id)"
                    class="w-3 h-3 accent-amber-400 shrink-0"
                  />
                  <span class="text-amber-400/70 shrink-0 font-bold">#{{ cpNumberMap[cp.id] }}</span>
                  <span class="truncate">{{ cp.title || cp.id }}</span>
                </label>
              </div>
              <p v-else class="text-xs text-slate-500 italic">{{ t('common.loading') }}</p>
            </div>
          </div>
        </div>

        <!-- Paths -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-slate-200">{{ t('admin.settings.openRouting.paths') }}</span>
            <div class="flex items-center gap-2">
              <button @click="addPath" class="btn-secondary text-xs px-3 py-1.5">+ {{ t('admin.settings.openRouting.addPath') }}</button>
              <button
                @click="savePaths"
                :disabled="savingPaths"
                class="flex items-center gap-1.5 btn-primary text-xs px-3 py-1.5"
              >
                <svg v-if="savingPaths" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <svg v-else-if="savedPaths" class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                </svg>
                {{ savedPaths ? t('admin.settings.saved') : t('admin.settings.openRouting.savePaths') }}
              </button>
            </div>
          </div>

          <p v-if="!routingForm.paths.length" class="text-xs text-slate-500 italic p-3 rounded-xl border border-dashed border-slate-600 text-center">
            {{ t('admin.settings.openRouting.noPaths') }}
          </p>

          <div v-for="(path, pi) in routingForm.paths" :key="path.id"
               class="p-4 rounded-xl border border-slate-600 bg-slate-800/60 space-y-3">
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500 font-bold shrink-0">#{{ pi + 1 }}</span>
              <input v-model="path.name" class="input-field input-sm flex-1 text-sm" :placeholder="t('admin.settings.openRouting.pathName')" />
              <button @click="removePath(pi)" class="text-red-400 hover:text-red-300 px-1 shrink-0 text-sm">✕</button>
            </div>

            <!-- Zone order in this path -->
            <div class="space-y-1">
              <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.openRouting.zoneOrder') }}</label>

              <div v-for="(zoneId, zIdx) in path.zoneOrder" :key="zoneId"
                   class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/60 border border-slate-600">
                <span class="text-xs text-amber-400 font-bold shrink-0 w-4">{{ zIdx + 1 }}</span>
                <span class="text-xs text-slate-200 flex-1 truncate">
                  {{ routingForm.zones.find(z => z.id === zoneId)?.name || t('admin.settings.openRouting.unnamedZone') }}
                </span>
                <button @click="moveZoneInPath(path, zIdx, -1)" :disabled="zIdx === 0"
                        class="text-slate-400 hover:text-amber-300 disabled:opacity-20 px-0.5 text-xs">▲</button>
                <button @click="moveZoneInPath(path, zIdx, 1)" :disabled="zIdx === path.zoneOrder.length - 1"
                        class="text-slate-400 hover:text-amber-300 disabled:opacity-20 px-0.5 text-xs">▼</button>
                <button @click="removeZoneFromPath(path, zIdx)" class="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
              </div>

              <!-- Add available zones to path -->
              <div v-if="routingForm.zones.some(z => !path.zoneOrder.includes(z.id))"
                   class="flex flex-wrap gap-1 pt-1">
                <button
                  v-for="zone in routingForm.zones.filter(z => !path.zoneOrder.includes(z.id))"
                  :key="zone.id"
                  @click="addZoneToPath(path, zone.id)"
                  class="text-xs px-2 py-1 rounded-lg border border-dashed border-slate-500 text-slate-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                >
                  + {{ zone.name || t('admin.settings.openRouting.unnamedZone') }}
                </button>
              </div>
              <p v-if="!path.zoneOrder.length" class="text-xs text-slate-500 italic">
                {{ t('admin.settings.openRouting.noZonesInPath') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div v-if="routingForm.zones.length && routingForm.paths.length"
             class="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-slate-300">
          <span class="text-blue-400">ℹ</span>
          {{ t('admin.settings.openRouting.summaryText', {
            paths: routingForm.paths.length,
            total: openRoutingTotal,
          }) }}
        </div>
      </div>
    </Transition>
  </div>

  <!-- ══ Checkpoint overview map modal ═══════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="showMapModal" class="fixed inset-0 z-[200] flex flex-col bg-black/90">
        <!-- Header bar -->
        <div class="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
          <span class="text-sm font-bold text-white">{{ t('admin.settings.openRouting.mapTitle') }}</span>
          <button
            @click="closeMapModal"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-semibold transition-colors"
          >
            ✕ {{ t('common.close') }}
          </button>
        </div>
        <!-- Map + legend wrapper -->
        <div class="flex-1 relative">
          <div ref="mapModalRef" class="absolute inset-0" />
          <!-- Zone legend -->
          <div v-if="mapLegend.length"
               class="absolute bottom-4 start-4 z-[400] bg-slate-900/90 backdrop-blur rounded-xl border border-slate-700 px-3 py-2.5 space-y-1.5 pointer-events-none">
            <div v-for="item in mapLegend" :key="item.name" class="flex items-center gap-2 text-xs text-slate-200 font-medium">
              <div class="w-4 h-4 rounded-full border-2 shrink-0"
                   :style="{ background: item.color.bg, borderColor: item.color.border }" />
              {{ item.name }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-10px); }
.saved-enter-active, .saved-leave-active { transition: all 0.3s; }
.saved-enter-from, .saved-leave-to { opacity: 0; transform: translateY(-5px); }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
