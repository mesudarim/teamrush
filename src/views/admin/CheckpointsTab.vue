<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import { useGameContextStore } from '@/stores/gameContext'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import MapPicker from '@/components/ui/MapPicker.vue'
import QrCodeDisplay from '@/components/ui/QrCodeDisplay.vue'
import PuzzleCropper from '@/components/ui/PuzzleCropper.vue'
import ImageEditor from '@/components/ui/ImageEditor.vue'
import FreeCropper from '@/components/ui/FreeCropper.vue'
import { uploadMissingWordImage } from '@/firebase/storage'

const { t } = useI18n()
const admin   = useAdminStore()
const gameCtx = useGameContextStore()

const showForm = ref(false)
const editingId = ref(null)
const confirmDeleteId = ref(null)
const saving   = ref(false)
const saveError = ref('')
const imageFile = ref(null)
const imagePreview = ref('')
const puzzleImageBlob = ref(null)
const puzzleRawSrc = ref('')
const showCropper = ref(false)
const showMissionQr = ref(false)

// ─── Stage 1 image (missingWord mode) ────────────────────────────────────────
const stage1ImageBlob = ref(null)
const showFreeCropperS1  = ref(false)
const freeCropperS1Src   = ref('')
const showStage1ImageEditor = ref(false)
const stage1ImageEditorSrc = ref('')

const form = ref(emptyForm())

function emptyQuestion() {
  return { question: '', questionEn: '', answer: '', answerEn: '', timerEnabled: false, timerSeconds: 60, choices: [{ text: '', textEn: '', isCorrect: false }] }
}

function emptyForm() {
  return {
    title: '', titleEn: '',
    description: '', descriptionEn: '',
    youtubeUrl: '',
    showVideo: false,
    mapType: 'coordinates',
    showMap: false,
    mapImageUrl: '',
    mapLat: '', mapLng: '', mapZoom: 15, mapTileType: 'street',
    envelopeBrand: gameCtx.gameName || 'המירוץ לצפון',
    envelope1Label: 'יעד',
    envelope2Label: 'משימה',
    stage1Mode: 'text',
    stage1Instruction: '',
    stage1InstructionEn: '',
    stage1Keyword: '',
    stage1KeywordEn: '',
    stage1Keywords: [],
    stage1MultiOrdered: false,
    stage1ImageUrl: '',
    missionType: 'MultipleChoice',
    missionConfig: {
      instruction: '', instructionEn: '',
      questions: [emptyQuestion()],
      puzzleImageUrl: '',
    },
    pointsCorrect: 5,
    pointsWrong: 1,
  }
}

const missionTypes = ['TextValidation', 'QrScanMission', 'MultipleChoice', 'MultiSelect', 'MissingWord', 'PhotoCapture', 'CompassMission', 'PuzzleMission', 'AudioRecorder', 'HarpMission']

// ─── Puzzle image ────────────────────────────────────────────────────────────

const onPuzzleFilePick = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  const reader = new FileReader()
  reader.onload = (ev) => {
    puzzleRawSrc.value = ev.target.result
    showCropper.value = true
  }
  reader.readAsDataURL(file)
}

const onCropConfirm = (blob) => {
  puzzleImageBlob.value = blob
  // Show preview
  form.value.missionConfig.puzzleImageUrl = URL.createObjectURL(blob)
  showCropper.value = false
}

const clearPuzzleImage = () => {
  puzzleImageBlob.value = null
  puzzleRawSrc.value = ''
  form.value.missionConfig.puzzleImageUrl = ''
}

// ─── Stage 1 image editor ────────────────────────────────────────────────────

const onStage1FilePick = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  const reader = new FileReader()
  reader.onload = (ev) => {
    freeCropperS1Src.value = ev.target.result
    showFreeCropperS1.value = true
  }
  reader.readAsDataURL(file)
}

const onFreeCropS1Confirm = (blob) => {
  showFreeCropperS1.value = false
  stage1ImageEditorSrc.value = URL.createObjectURL(blob)
  showStage1ImageEditor.value = true
}

const onStage1ImageConfirm = (blob) => {
  showStage1ImageEditor.value = false
  stage1ImageBlob.value = blob
  form.value.stage1ImageUrl = URL.createObjectURL(blob)
}

const clearStage1Image = () => {
  stage1ImageBlob.value = null
  stage1ImageEditorSrc.value = ''
  form.value.stage1ImageUrl = ''
}

// ─── MissingWord image — crop then annotate ──────────────────────────────────

const showFreeCropperMW  = ref(false)
const freeCropperMWSrc   = ref('')
const showImageEditor    = ref(false)
const imageEditorSrc     = ref('')
const imageEditorQIdx    = ref(null)
const missingWordUploading = ref(null)

const onMissingWordFilePick = (e, qIdx) => {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  const reader = new FileReader()
  reader.onload = (ev) => {
    freeCropperMWSrc.value = ev.target.result
    imageEditorQIdx.value = qIdx
    showFreeCropperMW.value = true
  }
  reader.readAsDataURL(file)
}

const onFreeCropMWConfirm = (blob) => {
  showFreeCropperMW.value = false
  // Pass cropped blob to ImageEditor for annotation
  imageEditorSrc.value = URL.createObjectURL(blob)
  showImageEditor.value = true
}

const onImageEditorConfirm = async (blob) => {
  showImageEditor.value = false
  const qIdx = imageEditorQIdx.value
  missingWordUploading.value = qIdx
  try {
    const tempId = editingId.value ?? 'mw_' + Date.now()
    const url = await uploadMissingWordImage(blob, tempId, qIdx)
    form.value.missionConfig.questions[qIdx].imageUrl = url
  } finally {
    missingWordUploading.value = null
  }
}

const startCreate = () => {
  form.value = emptyForm()
  editingId.value = null
  imageFile.value = null
  imagePreview.value = ''
  puzzleImageBlob.value = null
  puzzleRawSrc.value = ''
  stage1ImageBlob.value = null
  stage1ImageEditorSrc.value = ''
  showForm.value = true
}

const startEdit = (cp) => {
  const base = emptyForm()
  form.value = { ...base, ...cp, missionConfig: { ...base.missionConfig, ...(cp.missionConfig ?? {}) } }
  // Default brand to game name if not set on the checkpoint
  if (!form.value.envelopeBrand) form.value.envelopeBrand = gameCtx.gameName || 'המירוץ לצפון'
  // Backward compat: migrate old single-question format to questions array
  const mc = form.value.missionConfig
  const legacy = /** @type {any} */ (mc)
  if (!Array.isArray(mc.questions) || mc.questions.length === 0) {
    mc.questions = [{
      question:   legacy.question   ?? '',
      questionEn: legacy.questionEn ?? '',
      answer:     legacy.answer     ?? '',
      choices:    legacy.choices?.length ? legacy.choices : [{ text: '', textEn: '', isCorrect: false }],
    }]
  }
  // Ensure every question has choices
  mc.questions.forEach(q => {
    if (!Array.isArray(q.choices) || q.choices.length === 0) {
      q.choices = [{ text: '', textEn: '', isCorrect: false }]
    }
  })
  editingId.value = cp.id
  imageFile.value = null
  imagePreview.value = cp.mapImageUrl ?? ''
  puzzleImageBlob.value = null
  puzzleRawSrc.value = ''
  stage1ImageBlob.value = null
  stage1ImageEditorSrc.value = ''
  showForm.value = true
}

const cancelForm = () => { showForm.value = false; editingId.value = null }

const onImageChange = (e) => {
  imageFile.value = e.target.files[0] ?? null
  if (imageFile.value) imagePreview.value = URL.createObjectURL(imageFile.value)
}

const saveCheckpoint = async () => {
  saveError.value = ''
  if (!form.value.title.trim()) return

  // MultipleChoice / MultiSelect: every question must have at least one correct choice
  if (['MultipleChoice', 'MultiSelect'].includes(form.value.missionType)) {
    const bad = form.value.missionConfig.questions.findIndex(
      q => !q.choices?.some(c => c.isCorrect)
    )
    if (bad !== -1) {
      saveError.value = t('admin.checkpoints.errorNoCorrectChoice', { n: bad + 1 })
      return
    }
  }

  saving.value = true
  try {
    const payload = { ...form.value }
    if (payload.mapType === 'coordinates') {
      payload.mapLat = Number(payload.mapLat)
      payload.mapLng = Number(payload.mapLng)
      payload.mapZoom = Number(payload.mapZoom)
    }
    await admin.saveCheckpoint(payload, imageFile.value, editingId.value, puzzleImageBlob.value, stage1ImageBlob.value)
    cancelForm()
  } finally {
    saving.value = false
  }
}

const deleteCheckpoint = async () => {
  if (!confirmDeleteId.value) return
  await admin.removeCheckpoint(confirmDeleteId.value)
  confirmDeleteId.value = null
}

// Question helpers
const addQuestion = () => {
  form.value.missionConfig.questions.push(emptyQuestion())
}
const removeQuestion = (qIdx) => {
  form.value.missionConfig.questions.splice(qIdx, 1)
}

// Choice helpers (per question)
const addChoice = (qIdx) => {
  form.value.missionConfig.questions[qIdx].choices.push({ text: '', textEn: '', isCorrect: false })
}
const removeChoice = (qIdx, cIdx) => {
  form.value.missionConfig.questions[qIdx].choices.splice(cIdx, 1)
}
const setCorrect = (qIdx, cIdx) => {
  form.value.missionConfig.questions[qIdx].choices.forEach((c, i) => { c.isCorrect = i === cIdx })
}
const toggleCorrect = (qIdx, cIdx) => {
  const c = form.value.missionConfig.questions[qIdx].choices[cIdx]
  c.isCorrect = !c.isCorrect
}

const viewMode = ref(localStorage.getItem('cp_view') ?? 'card')
const setView = (v) => { viewMode.value = v; localStorage.setItem('cp_view', v) }

// ── Section collapse state ────────────────────────────────────────────────────
const sections = ref({ nameDesc: true, envelope: false, validation: true, mission: true, points: true })
const toggle = (key) => { sections.value[key] = !sections.value[key] }

// ── Overview map ──────────────────────────────────────────────────────────────
const MAP_TILES = {
  street:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',  attribution: '© OpenStreetMap contributors' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri, Maxar, GeoEye' },
}

const mapOverviewRef    = ref(null)
const overviewTileType  = ref(localStorage.getItem('cp_overview_tile') ?? 'street')
let overviewMap         = null
let overviewTileLayer   = null
let overviewL           = null

const initOverviewMap = async () => {
  if (!mapOverviewRef.value) return
  if (overviewMap) { overviewMap.remove(); overviewMap = null }

  overviewL = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  overviewMap = overviewL.map(mapOverviewRef.value)

  const cfg = MAP_TILES[overviewTileType.value] ?? MAP_TILES.street
  overviewTileLayer = overviewL.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19 }).addTo(overviewMap)

  const cps = sortedCheckpoints.value.filter(cp => cp.mapLat && cp.mapLng)

  if (cps.length === 0) {
    overviewMap.setView([31.7683, 35.2137], 8)
    return
  }

  cps.forEach((cp, idx) => {
    const icon = overviewL.divIcon({
      className: '',
      html: `<div style="width:30px;height:30px;border-radius:50%;background:#f59e0b;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-weight:900;font-size:13px;color:#1e293b;box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:pointer">${idx + 1}</div>`,
      iconSize:   [30, 30],
      iconAnchor: [15, 15],
    })
    const marker = overviewL.marker([Number(cp.mapLat), Number(cp.mapLng)], { icon }).addTo(overviewMap)
    marker.bindTooltip(cp.title || `#${idx + 1}`, { direction: 'top', offset: [0, -18] })
    marker.on('click', () => startEdit(cp))
  })

  if (cps.length === 1) {
    overviewMap.setView([Number(cps[0].mapLat), Number(cps[0].mapLng)], 15)
  } else {
    overviewMap.fitBounds(
      overviewL.latLngBounds(cps.map(cp => [Number(cp.mapLat), Number(cp.mapLng)])),
      { padding: [40, 40] }
    )
  }
}

const switchOverviewTile = (type) => {
  overviewTileType.value = type
  localStorage.setItem('cp_overview_tile', type)
  if (!overviewMap || !overviewL) return
  if (overviewTileLayer) { overviewTileLayer.remove(); overviewTileLayer = null }
  const cfg = MAP_TILES[type] ?? MAP_TILES.street
  overviewTileLayer = overviewL.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19 }).addTo(overviewMap)
}

watch([viewMode, showForm], async ([mode, formShown]) => {
  if (mode === 'map' && !formShown) {
    await nextTick()
    initOverviewMap()
  } else if (overviewMap) {
    overviewMap.remove(); overviewMap = null; overviewTileLayer = null
  }
})

// ── Sorting ───────────────────────────────────────────────────────────────────
const sortCol = ref('')   // '' | 'title' | 'stage1Mode' | 'missionType'
const sortDir = ref('asc')

const toggleSort = (col) => {
  if (sortCol.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = col
    sortDir.value = 'asc'
  }
}

const sortedCheckpoints = computed(() => {
  if (!sortCol.value) return admin.checkpoints
  return [...admin.checkpoints].sort((a, b) => {
    let va = '', vb = ''
    if (sortCol.value === 'title')       { va = a.title ?? '';        vb = b.title ?? '' }
    if (sortCol.value === 'stage1Mode')  { va = a.stage1Mode ?? 'text'; vb = b.stage1Mode ?? 'text' }
    if (sortCol.value === 'missionType') { va = a.missionType ?? '';  vb = b.missionType ?? '' }
    const cmp = va.localeCompare(vb, undefined, { sensitivity: 'base' })
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})

// ── Checkpoint navigation (while form is open) ────────────────────────────────
const currentEditIndex = computed(() =>
  editingId.value ? sortedCheckpoints.value.findIndex(cp => cp.id === editingId.value) : -1
)
const prevCheckpoint = computed(() =>
  currentEditIndex.value > 0 ? sortedCheckpoints.value[currentEditIndex.value - 1] : null
)
const nextCheckpoint = computed(() =>
  currentEditIndex.value >= 0 && currentEditIndex.value < sortedCheckpoints.value.length - 1
    ? sortedCheckpoints.value[currentEditIndex.value + 1]
    : null
)
const navigateTo = (cp) => { if (cp) startEdit(cp) }

const stageModeLabel = (cp) => {
  const mode = cp.stage1Mode ?? 'text'
  if (mode === 'qr')          return t('game.stage1.modeQr')
  if (mode === 'missingWord') return t('game.stage1.modeMissingWord')
  if (mode === 'multiField')  return t('game.stage1.modeMultiField')
  return t('game.stage1.modeText')
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="section-title">{{ t('admin.checkpoints.title') }}</h2>
      <div class="flex items-center gap-2">
        <!-- View toggle -->
        <div class="flex rounded-xl overflow-hidden border border-slate-600">
          <button
            @click="setView('card')"
            :class="['px-2.5 py-1.5 text-sm transition-colors', viewMode === 'card' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400 hover:text-slate-200']"
            title="Vue cartes"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h7v7H3zm0 11h7v7H3zm11-11h7v7h-7zm0 11h7v7h-7z"/></svg>
          </button>
          <button
            @click="setView('list')"
            :class="['px-2.5 py-1.5 text-sm transition-colors', viewMode === 'list' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400 hover:text-slate-200']"
            :title="t('admin.checkpoints.viewList')"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>
          </button>
          <button
            @click="setView('map')"
            :class="['px-2.5 py-1.5 text-sm transition-colors', viewMode === 'map' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400 hover:text-slate-200']"
            :title="t('admin.checkpoints.viewMap')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
          </button>
        </div>
        <button @click="startCreate" class="btn-primary py-2 px-4 text-sm">
          + {{ t('admin.checkpoints.create') }}
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="admin.checkpoints.length === 0 && !showForm" class="card text-center text-slate-400 py-12">
      {{ t('admin.checkpoints.empty') }}
    </div>

    <!-- ── CARD VIEW ── -->
    <div v-if="!showForm && viewMode === 'card'">
      <!-- Sort bar -->
      <div class="flex flex-wrap items-center gap-2 mb-3 text-xs text-slate-400">
        <span class="font-semibold">Trier :</span>
        <button
          v-for="col in [['title', t('admin.checkpoints.sectionName')], ['stage1Mode', t('admin.checkpoints.sectionVerification')], ['missionType', t('admin.checkpoints.sectionMission')]]"
          :key="col[0]"
          @click="toggleSort(col[0])"
          :class="['flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors',
            sortCol === col[0]
              ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
              : 'border-slate-600 bg-slate-800 hover:border-slate-500']"
        >
          {{ col[1] }}
          <span v-if="sortCol === col[0]">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
        </button>
        <button v-if="sortCol" @click="sortCol = ''" class="px-2 py-1 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-500 hover:text-slate-300 transition-colors">✕</button>
      </div>
      <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
      <div
        v-for="cp in sortedCheckpoints"
        :key="cp.id"
        class="card hover:border-amber-500/30 transition-colors space-y-2"
      >
        <div class="flex items-baseline gap-2">
          <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0 w-20">{{ t('admin.checkpoints.sectionName') }}</span>
          <span class="font-bold text-white text-sm leading-snug">{{ cp.title }}</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0 w-20">{{ t('admin.checkpoints.sectionVerification') }}</span>
          <span class="text-slate-300 text-xs">
            {{ stageModeLabel(cp) }}
            <span v-if="cp.stage1Keyword" class="text-slate-500"> · {{ cp.stage1Keyword }}</span>
          </span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0 w-20">{{ t('admin.checkpoints.sectionMission') }}</span>
          <span class="text-slate-300 text-xs">{{ t('admin.missions.' + cp.missionType) }}</span>
        </div>
        <div class="flex gap-2 pt-2 border-t border-slate-700/60">
          <button @click="startEdit(cp)"
            class="flex-1 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-xs font-semibold py-1.5 px-3 rounded-xl transition-colors">
            {{ t('admin.checkpoints.edit') }}
          </button>
          <button @click="confirmDeleteId = cp.id" class="btn-danger text-xs py-1.5 px-3">✕</button>
        </div>
      </div>
    </div>
    </div>

    <!-- ── LIST VIEW ── -->
    <div v-if="!showForm && viewMode === 'list'" class="mb-6 rounded-xl border border-slate-700 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-800 border-b border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <th class="px-4 py-2.5 text-start">#</th>
            <th class="px-4 py-2.5 text-start cursor-pointer select-none hover:text-amber-400 transition-colors" @click="toggleSort('title')">
              <span class="flex items-center gap-1">
                {{ t('admin.checkpoints.sectionName') }}
                <span :class="sortCol === 'title' ? 'text-amber-400' : 'text-slate-600'">{{ sortCol === 'title' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
              </span>
            </th>
            <th class="px-4 py-2.5 text-start hidden md:table-cell cursor-pointer select-none hover:text-amber-400 transition-colors" @click="toggleSort('stage1Mode')">
              <span class="flex items-center gap-1">
                {{ t('admin.checkpoints.sectionVerification') }}
                <span :class="sortCol === 'stage1Mode' ? 'text-amber-400' : 'text-slate-600'">{{ sortCol === 'stage1Mode' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
              </span>
            </th>
            <th class="px-4 py-2.5 text-start hidden md:table-cell cursor-pointer select-none hover:text-amber-400 transition-colors" @click="toggleSort('missionType')">
              <span class="flex items-center gap-1">
                {{ t('admin.checkpoints.sectionMission') }}
                <span :class="sortCol === 'missionType' ? 'text-amber-400' : 'text-slate-600'">{{ sortCol === 'missionType' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
              </span>
            </th>
            <th class="px-4 py-2.5 text-end"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(cp, idx) in sortedCheckpoints"
            :key="cp.id"
            class="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/40 transition-colors"
          >
            <td class="px-4 py-2.5 text-slate-500 font-mono text-xs">{{ idx + 1 }}</td>
            <td class="px-4 py-2.5">
              <span class="font-semibold text-white">{{ cp.title }}</span>
              <span v-if="cp.titleEn" class="text-slate-500 text-xs ms-2">{{ cp.titleEn }}</span>
            </td>
            <td class="px-4 py-2.5 hidden md:table-cell text-slate-300 text-xs">
              {{ stageModeLabel(cp) }}
              <span v-if="cp.stage1Keyword" class="text-slate-500"> · {{ cp.stage1Keyword }}</span>
            </td>
            <td class="px-4 py-2.5 hidden md:table-cell text-slate-300 text-xs">
              {{ t('admin.missions.' + cp.missionType) }}
            </td>
            <td class="px-4 py-2.5">
              <div class="flex gap-2 justify-end">
                <button @click="startEdit(cp)"
                  class="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold py-1 px-3 rounded-lg transition-colors">
                  {{ t('admin.checkpoints.edit') }}
                </button>
                <button @click="confirmDeleteId = cp.id" class="btn-danger text-xs py-1 px-2">✕</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── MAP VIEW ── -->
    <div v-if="!showForm && viewMode === 'map'" class="space-y-3">
      <!-- Toolbar -->
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-slate-400 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/></svg>
          {{ t('admin.checkpoints.mapOverviewClickHint') }}
        </p>
        <div class="flex rounded-lg overflow-hidden border border-slate-600 shrink-0">
          <button
            v-for="type in ['street', 'satellite']" :key="type"
            @click="switchOverviewTile(type)"
            :class="['px-3 py-1 text-xs font-semibold transition-colors',
              overviewTileType === type ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-400 hover:bg-slate-600']"
          >
            {{ type === 'street' ? t('admin.checkpoints.mapTileStreet') : t('admin.checkpoints.mapTileSatellite') }}
          </button>
        </div>
      </div>

      <!-- No GPS data -->
      <div v-if="!sortedCheckpoints.some(cp => cp.mapLat && cp.mapLng)"
           class="card text-center text-slate-400 py-12">
        {{ t('admin.checkpoints.mapOverviewEmpty') }}
      </div>

      <!-- Map -->
      <div v-else ref="mapOverviewRef" class="w-full rounded-2xl border border-slate-700 overflow-hidden" style="height:560px;" />

      <!-- Checkpoints without coords -->
      <div v-if="sortedCheckpoints.some(cp => !cp.mapLat || !cp.mapLng)" class="text-xs text-slate-500 pt-1">
        {{ t('admin.checkpoints.mapOverviewNoCoords') }}:
        {{ sortedCheckpoints.filter(cp => !cp.mapLat || !cp.mapLng).map(cp => cp.title).join(' · ') }}
      </div>
    </div>

    <!-- Checkpoint form -->
    <Transition name="slide-down">
      <div v-if="showForm" class="max-w-3xl space-y-4">

        <!-- ── En-tête du formulaire ── -->
        <div class="card-glow flex items-center justify-between py-3 px-5">
          <h3 class="font-bold text-xl text-amber-400">
            {{ editingId ? t('admin.checkpoints.edit') : t('admin.checkpoints.create') }}
          </h3>
          <button @click="cancelForm" class="btn-ghost">✕</button>
        </div>

        <!-- ── Navigation entre checkpoints (mode édition) ── -->
        <div v-if="editingId" class="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700">
          <button @click="navigateTo(prevCheckpoint)" :disabled="!prevCheckpoint"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-300">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            <span class="hidden sm:inline truncate max-w-[120px]">{{ prevCheckpoint?.title ?? '' }}</span>
            <span class="sm:hidden">Préc.</span>
          </button>
          <span class="text-xs text-slate-500 tabular-nums shrink-0">{{ currentEditIndex + 1 }} / {{ sortedCheckpoints.length }}</span>
          <button @click="navigateTo(nextCheckpoint)" :disabled="!nextCheckpoint"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-300">
            <span class="hidden sm:inline truncate max-w-[120px]">{{ nextCheckpoint?.title ?? '' }}</span>
            <span class="sm:hidden">Suiv.</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>

        <!-- ══════════════════════════════════════════════════════
             CARTE 1 — Nom & Description
        ══════════════════════════════════════════════════════ -->
        <div class="rounded-2xl border border-slate-700 overflow-hidden">
          <button type="button" @click="toggle('nameDesc')" class="w-full flex items-center justify-between gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700/80 transition-colors text-start">
            <div class="flex items-center gap-2">
              <span>📝</span>
              <h3 class="text-xs font-black text-amber-400 uppercase tracking-wider">{{ t('admin.checkpoints.sectionName') }} / {{ t('admin.checkpoints.sectionDescription') }}</h3>
            </div>
            <svg class="w-4 h-4 text-slate-400 transition-transform shrink-0" :class="sections.nameDesc ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div v-show="sections.nameDesc" class="bg-slate-800/40 p-5 space-y-4">
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.titleField') }} *</label>
                <input v-model="form.title" class="input-field" />
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.titleEnField') }}</label>
                <input v-model="form.titleEn" class="input-field" />
              </div>
            </div>
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.description') }}</label>
                <textarea v-model="form.description" rows="2" class="input-field resize-none" />
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.descriptionEn') }}</label>
                <textarea v-model="form.descriptionEn" rows="2" class="input-field resize-none" />
              </div>
            </div>
            <label class="flex items-center gap-3 cursor-pointer select-none">
              <div @click="form.showVideo = !form.showVideo"
                :class="['relative w-11 h-6 rounded-full transition-colors', form.showVideo ? 'bg-amber-500' : 'bg-slate-600']">
                <div :class="['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', form.showVideo ? 'translate-x-5' : 'translate-x-0']" />
              </div>
              <span class="text-sm font-semibold text-slate-300">{{ t('admin.checkpoints.showVideo') }}</span>
            </label>
            <div v-if="form.showVideo">
              <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.youtubeUrl') }}</label>
              <input v-model="form.youtubeUrl" class="input-field" placeholder="https://youtube.com/..." />
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════════
             CARTE 2 — Enveloppes — Texte d'affichage
        ══════════════════════════════════════════════════════ -->
        <div class="rounded-2xl border border-slate-700 overflow-hidden">
          <button type="button" @click="toggle('envelope')" class="w-full flex items-center justify-between gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700/80 transition-colors text-start">
            <div class="flex items-center gap-2">
              <span>✉️</span>
              <h3 class="text-xs font-black text-amber-400 uppercase tracking-wider">{{ t('admin.checkpoints.envelopeSection') }}</h3>
            </div>
            <svg class="w-4 h-4 text-slate-400 transition-transform shrink-0" :class="sections.envelope ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div v-show="sections.envelope" class="bg-slate-800/40 p-5 space-y-5">

            <!-- Carte (optionnelle) -->
            <div class="space-y-3">
              <label class="flex items-center gap-3 cursor-pointer select-none">
                <div @click="form.showMap = !form.showMap"
                  :class="['relative w-11 h-6 rounded-full transition-colors', form.showMap ? 'bg-blue-500' : 'bg-slate-600']">
                  <div :class="['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', form.showMap ? 'translate-x-5' : 'translate-x-0']" />
                </div>
                <span class="text-sm font-semibold text-slate-300">{{ t('admin.checkpoints.showMap') }}</span>
                <span class="text-xs text-slate-500">{{ t('admin.checkpoints.showMapHint') }}</span>
              </label>
              <template v-if="form.showMap">
                <div class="flex gap-3">
                  <button v-for="type in ['coordinates', 'image']" :key="type" @click="form.mapType = type"
                    :class="['px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-colors', form.mapType === type ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-600 bg-slate-700 text-slate-400']">
                    {{ type === 'coordinates' ? t('admin.checkpoints.mapTypeCoords') : t('admin.checkpoints.mapTypeImage') }}
                  </button>
                </div>
                <div v-if="form.mapType === 'coordinates'">
                  <MapPicker :lat="form.mapLat" :lng="form.mapLng" :zoom="form.mapZoom" :tileType="form.mapTileType"
                    @update:lat="form.mapLat = $event" @update:lng="form.mapLng = $event" @update:zoom="form.mapZoom = $event" @update:tileType="form.mapTileType = $event" />
                </div>
                <div v-else>
                  <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.mapImage') }}</label>
                  <input type="file" accept="image/*" @change="onImageChange" class="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500/30 cursor-pointer" />
                  <img v-if="imagePreview" :src="imagePreview" class="mt-2 w-full max-h-40 object-contain rounded-lg bg-slate-900" />
                </div>
              </template>
            </div>

            <div class="border-t border-slate-700/60 pt-4 space-y-4">
              <p class="text-xs text-slate-500">{{ t('admin.checkpoints.envelopeSectionHint') }}</p>
              <div class="grid md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-semibold text-slate-300 mb-1">
                    {{ t('admin.checkpoints.envelopeBrand') }}
                    <span class="text-xs text-slate-500 font-normal ms-1">(défaut : nom du jeu)</span>
                  </label>
                  <input v-model="form.envelopeBrand" class="input-field text-center font-mono tracking-widest"
                    :placeholder="gameCtx.gameName || 'המירוץ לצפון'" />
                </div>
                <div>
                  <label class="block text-sm font-semibold text-amber-400 mb-1">{{ t('admin.checkpoints.envelope1Label') }}</label>
                  <input v-model="form.envelope1Label" class="input-field text-center font-black text-lg" placeholder="יעד" />
                </div>
                <div>
                  <label class="block text-sm font-semibold text-amber-400 mb-1">{{ t('admin.checkpoints.envelope2Label') }}</label>
                  <input v-model="form.envelope2Label" class="input-field text-center font-black text-lg" placeholder="משימה" />
                </div>
              </div>
              <!-- Aperçu live -->
              <div class="flex gap-4 justify-center">
                <div v-for="(lbl, i) in [form.envelope1Label || 'יעד', form.envelope2Label || 'משימה']" :key="i"
                     class="rounded-xl overflow-hidden shadow-xl flex-1 max-w-[180px]"
                     style="aspect-ratio: 1.9 / 1; position: relative;">
                  <div class="absolute inset-0" style="background: radial-gradient(ellipse at 50% 35%, #3d72d8 0%, #1e4dbf 35%, #0e2e90 65%, #071a60 100%);" />
                  <div class="absolute top-0 left-0 right-0 z-10" style="height:15%; background: linear-gradient(180deg,#ffe84d 0%,#f5a500 55%,#e09000 100%);" />
                  <div class="absolute bottom-0 left-0 right-0 z-10" style="height:15%; background: linear-gradient(0deg,#ffe84d 0%,#f5a500 55%,#e09000 100%);" />
                  <div class="absolute z-20 flex flex-col items-center justify-between w-full" style="top:15%; bottom:15%; padding:2% 4%;">
                    <div class="flex flex-1 items-center justify-center">
                      <span style="font-family:'Rubik','Arial Black',Arial,sans-serif; font-weight:900; font-size:1.2rem; color:#ffe033; line-height:1; text-shadow:0 2px 0 rgba(100,50,0,0.6),0 4px 8px rgba(0,0,0,0.5);">{{ lbl }}</span>
                    </div>
                    <div style="background:#fff; clip-path:polygon(9px 0%,calc(100% - 9px) 0%,100% 50%,calc(100% - 9px) 100%,9px 100%,0% 50%); padding:2px; margin-bottom:2%;">
                      <div style="background:#cc0010; clip-path:polygon(7px 0%,calc(100% - 7px) 0%,100% 50%,calc(100% - 7px) 100%,7px 100%,0% 50%); padding:2px 10px; display:flex; align-items:center; justify-content:center; min-width:50px;">
                        <span style="font-family:'Rubik','Arial Black',Arial,sans-serif; font-weight:900; font-size:0.38rem; color:#fff; letter-spacing:0.08em; white-space:nowrap;">
                          {{ form.envelopeBrand || gameCtx.gameName || 'המירוץ לצפון' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Quick save -->
              <div class="flex justify-end pt-1">
                <button
                  @click="saveCheckpoint"
                  :disabled="saving || !form.title.trim()"
                  class="btn-primary text-sm py-2 px-5 flex items-center gap-2"
                >
                  <svg v-if="!saving" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                  <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  {{ saving ? t('common.loading') : t('admin.checkpoints.save') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════════
             CARTE 3 — Validation sur place (Stage 1)
        ══════════════════════════════════════════════════════ -->
        <div class="rounded-2xl border border-slate-700 overflow-hidden">
          <button type="button" @click="toggle('validation')" class="w-full flex items-center justify-between gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700/80 transition-colors text-start">
            <div class="flex items-center gap-2">
              <span>📍</span>
              <h3 class="text-xs font-black text-amber-400 uppercase tracking-wider">Validation sur place</h3>
            </div>
            <svg class="w-4 h-4 text-slate-400 transition-transform shrink-0" :class="sections.validation ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div v-show="sections.validation" class="bg-slate-800/40 p-5 space-y-4">

          <!-- mode buttons -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="mode in ['text', 'qr', 'missingWord', 'multiField']"
              :key="mode"
              @click="form.stage1Mode = mode; if (mode === 'multiField' && !form.stage1Keywords.length) form.stage1Keywords = [{ he: '', en: '' }]"
              :class="['px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-colors',
                form.stage1Mode === mode
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-slate-600 bg-slate-700 text-slate-400']"
            >
              {{ mode === 'text'       ? '⌨️ ' + t('game.stage1.modeText')
               : mode === 'qr'         ? '📷 ' + t('game.stage1.modeQr')
               : mode === 'missingWord' ? '🔍 ' + t('game.stage1.modeMissingWord')
               :                         '📋 ' + t('game.stage1.modeMultiField') }}
            </button>
          </div>

          <!-- ── Mode TEXT ── -->
          <template v-if="form.stage1Mode === 'text'">
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.stage1Instruction') }}</label>
                <textarea v-model="form.stage1Instruction" rows="2" class="input-field resize-none text-sm" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.stage1InstructionEn') }}</label>
                <textarea v-model="form.stage1InstructionEn" rows="2" class="input-field resize-none text-sm" />
              </div>
            </div>
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.stage1KeywordHe') }}</label>
                <input v-model="form.stage1Keyword" class="input-field text-sm" :placeholder="t('admin.checkpoints.keywordPlaceholderHe')" />
                <p class="text-xs text-slate-500 mt-1">{{ t('admin.checkpoints.keywordMultiHint') }}</p>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.stage1KeywordEn') }}</label>
                <input v-model="form.stage1KeywordEn" class="input-field text-sm" :placeholder="t('admin.checkpoints.keywordPlaceholderEn')" />
                <p class="text-xs text-slate-500 mt-1">{{ t('admin.checkpoints.keywordMultiHint') }}</p>
              </div>
            </div>
          </template>

          <!-- ── Mode QR ── -->
          <template v-else-if="form.stage1Mode === 'qr'">
            <p class="text-xs text-slate-500">{{ t('admin.checkpoints.stage1ModeQrHint') }}</p>
            <div class="grid md:grid-cols-2 gap-4 items-start">
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.stage1Keyword') }}</label>
                <input v-model="form.stage1Keyword" class="input-field font-mono tracking-widest text-center text-lg" placeholder="keyword" />
              </div>
              <QrCodeDisplay :value="form.stage1Keyword" :label="form.title" :brand="form.envelopeBrand || 'המירוץ לצפון'" />
            </div>
          </template>

          <!-- ── Mode MISSING WORD ── -->
          <template v-else-if="form.stage1Mode === 'missingWord'">
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.stage1Instruction') }}</label>
                <textarea v-model="form.stage1Instruction" rows="2" class="input-field resize-none text-sm" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.stage1InstructionEn') }}</label>
                <textarea v-model="form.stage1InstructionEn" rows="2" class="input-field resize-none text-sm" />
              </div>
            </div>

            <!-- Image upload -->
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.stage1Image') }}</label>
              <div v-if="form.stage1ImageUrl" class="flex items-start gap-3">
                <img :src="form.stage1ImageUrl" class="w-28 h-20 object-cover rounded-xl border border-amber-500/40" />
                <div class="flex flex-col gap-2">
                  <label class="btn-secondary text-xs py-1.5 px-3 cursor-pointer">
                    {{ t('admin.checkpoints.missingWordChangeBtn') }}
                    <input type="file" accept="image/*" class="hidden" @change="onStage1FilePick" />
                  </label>
                  <button @click="clearStage1Image" class="btn-danger text-xs py-1.5 px-3">✕</button>
                </div>
              </div>
              <label v-else class="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/50 hover:border-amber-500/50 transition-colors cursor-pointer w-full">
                <span class="text-xl">🔍</span>
                <span class="text-sm font-semibold text-slate-300">{{ t('admin.checkpoints.missingWordUploadBtn') }}</span>
                <input type="file" accept="image/*" class="hidden" @change="onStage1FilePick" />
              </label>
            </div>

            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.stage1KeywordHe') }}</label>
                <input v-model="form.stage1Keyword" class="input-field text-sm" :placeholder="t('admin.checkpoints.keywordPlaceholderHe')" />
                <p class="text-xs text-slate-500 mt-1">{{ t('admin.checkpoints.keywordMultiHint') }}</p>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.stage1KeywordEn') }}</label>
                <input v-model="form.stage1KeywordEn" class="input-field text-sm" :placeholder="t('admin.checkpoints.keywordPlaceholderEn')" />
                <p class="text-xs text-slate-500 mt-1">{{ t('admin.checkpoints.keywordMultiHint') }}</p>
              </div>
            </div>
          </template>

          <!-- ── Mode MULTI-FIELD ── -->
          <template v-else-if="form.stage1Mode === 'multiField'">
            <!-- Instructions -->
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.stage1Instruction') }}</label>
                <textarea v-model="form.stage1Instruction" rows="2" class="input-field resize-none text-sm" :placeholder="t('admin.checkpoints.multiFieldInstructionHint')" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.stage1InstructionEn') }}</label>
                <textarea v-model="form.stage1InstructionEn" rows="2" class="input-field resize-none text-sm" :placeholder="t('admin.checkpoints.multiFieldInstructionHint')" />
              </div>
            </div>

            <!-- Keyword rows -->
            <div class="space-y-2">
              <div class="flex items-baseline justify-between">
                <label class="block text-xs font-semibold text-slate-400">{{ t('admin.checkpoints.multiFieldKeywords') }}</label>
                <span v-if="form.stage1MultiOrdered" class="text-xs text-amber-400 font-semibold">
                  ↕ {{ t('admin.checkpoints.multiFieldOrderedPositions') }}
                </span>
              </div>
              <div
                v-for="(kw, i) in form.stage1Keywords"
                :key="i"
                :class="['flex items-center gap-2 p-2 rounded-xl border transition-colors',
                  form.stage1MultiOrdered
                    ? 'bg-amber-500/5 border-amber-500/30'
                    : 'bg-slate-900/60 border-slate-700']"
              >
                <div class="shrink-0 flex flex-col items-center w-7">
                  <span :class="['text-xs font-bold tabular-nums', form.stage1MultiOrdered ? 'text-amber-400' : 'text-slate-500']">
                    {{ i + 1 }}
                  </span>
                  <span v-if="form.stage1MultiOrdered" class="text-amber-600/60 text-[10px] leading-none">pos</span>
                </div>
                <input
                  v-model="kw.he"
                  class="input-field input-sm flex-1 text-sm"
                  :placeholder="t('admin.checkpoints.keywordPlaceholderHe')"
                />
                <input
                  v-model="kw.en"
                  class="input-field input-sm flex-1 text-sm"
                  :placeholder="t('admin.checkpoints.keywordPlaceholderEn')"
                />
                <div class="flex flex-col gap-0.5 shrink-0" v-if="form.stage1MultiOrdered">
                  <button
                    @click="i > 0 && form.stage1Keywords.splice(i - 1, 0, form.stage1Keywords.splice(i, 1)[0])"
                    :disabled="i === 0"
                    class="text-slate-400 hover:text-amber-300 disabled:opacity-20 text-xs leading-none px-1"
                  >▲</button>
                  <button
                    @click="i < form.stage1Keywords.length - 1 && form.stage1Keywords.splice(i + 1, 0, form.stage1Keywords.splice(i, 1)[0])"
                    :disabled="i === form.stage1Keywords.length - 1"
                    class="text-slate-400 hover:text-amber-300 disabled:opacity-20 text-xs leading-none px-1"
                  >▼</button>
                </div>
                <button
                  @click="form.stage1Keywords.splice(i, 1)"
                  class="text-red-400 hover:text-red-300 shrink-0 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                >✕</button>
              </div>

              <button
                @click="form.stage1Keywords.push({ he: '', en: '' })"
                class="w-full py-2 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:text-amber-400 hover:border-amber-500/50 text-sm font-semibold transition-colors"
              >
                + {{ t('admin.checkpoints.multiFieldAddKeyword') }}
              </button>
            </div>
            <p class="text-xs text-slate-500">{{ t('admin.checkpoints.multiFieldHint') }}</p>

            <!-- Ordered mode: explicit order preview -->
            <div v-if="form.stage1MultiOrdered && form.stage1Keywords.some(k => k.he || k.en)"
                 class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
              <p class="text-xs font-bold text-amber-400">{{ t('admin.checkpoints.multiFieldOrderPreviewTitle') }}</p>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="(kw, i) in form.stage1Keywords"
                  :key="i"
                  class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40"
                >
                  <span class="text-amber-300 font-bold text-xs">{{ i + 1 }}.</span>
                  <span class="text-slate-200 text-sm font-semibold">{{ kw.he || kw.en || '?' }}</span>
                </div>
              </div>
              <p class="text-xs text-amber-600/80">{{ t('admin.checkpoints.multiFieldOrderPreviewHint') }}</p>
            </div>

            <!-- Ordering toggle -->
            <label class="flex items-center gap-3 cursor-pointer group">
              <div class="relative">
                <input
                  type="checkbox"
                  v-model="form.stage1MultiOrdered"
                  class="sr-only"
                />
                <div :class="['w-10 h-6 rounded-full transition-colors', form.stage1MultiOrdered ? 'bg-amber-500' : 'bg-slate-600']" />
                <div :class="['absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform', form.stage1MultiOrdered ? 'translate-x-4' : '']" />
              </div>
              <div>
                <span class="text-sm font-semibold text-slate-200">{{ t('admin.checkpoints.multiFieldOrdered') }}</span>
                <p class="text-xs text-slate-500">{{ t('admin.checkpoints.multiFieldOrderedHint') }}</p>
              </div>
            </label>
          </template>
          </div><!-- /bg-slate-800/40 validation -->
        </div><!-- /carte validation -->

        <!-- ══════════════════════════════════════════════════════
             CARTE 4 — Mission (Stage 2)
        ══════════════════════════════════════════════════════ -->
        <div class="rounded-2xl border border-slate-700 overflow-hidden">
          <button type="button" @click="toggle('mission')" class="w-full flex items-center justify-between gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700/80 transition-colors text-start">
            <div class="flex items-center gap-2">
              <span>🎯</span>
              <h3 class="text-xs font-black text-amber-400 uppercase tracking-wider">{{ t('admin.checkpoints.sectionMission') }}</h3>
            </div>
            <svg class="w-4 h-4 text-slate-400 transition-transform shrink-0" :class="sections.mission ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div v-show="sections.mission" class="bg-slate-800/40 p-5 space-y-4">

          <!-- Mission type selector -->
          <div>
            <label class="block text-sm font-semibold text-slate-300 mb-2">{{ t('admin.checkpoints.missionType') }}</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="type in missionTypes"
                :key="type"
                @click="form.missionType = type"
                :class="['px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-colors', form.missionType === type ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-600 bg-slate-700 text-slate-400']"
              >
                {{ t('admin.missions.' + type) }}
              </button>
            </div>
          </div>

          <!-- Instruction shown in envelope 2 -->
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.missionInstruction') }}</label>
              <textarea v-model="form.missionConfig.instruction" rows="2" class="input-field resize-none" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.missionInstructionEn') }}</label>
              <textarea v-model="form.missionConfig.instructionEn" rows="2" class="input-field resize-none" />
            </div>
          </div>

          <!-- Audio recorder note -->
          <div v-if="form.missionType === 'AudioRecorder'"
               class="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-rose-300 text-sm space-y-1">
            <p class="font-bold">🎤 {{ t('admin.missions.AudioRecorder') }}</p>
            <p class="text-rose-400/80">{{ t('admin.missions.audioNoteBody') }}</p>
          </div>

          <!-- Missing word note -->
          <div v-if="form.missionType === 'MissingWord'"
               class="rounded-xl bg-blue-500/10 border border-blue-500/30 px-4 py-3 text-blue-300 text-sm space-y-1">
            <p class="font-bold">🔍 {{ t('admin.missions.MissingWord') }}</p>
            <p class="text-blue-400/80">{{ t('admin.missions.missingWordNoteBody') }}</p>
          </div>

          <!-- Compass mission note -->
          <div v-if="form.missionType === 'CompassMission'"
               class="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-amber-300 text-sm space-y-1">
            <p class="font-bold">🧭 {{ t('admin.missions.CompassMission') }}</p>
            <p class="text-amber-400/80">{{ t('admin.missions.compassNoteBody') }}</p>
          </div>

          <!-- Puzzle mission UI -->
          <div v-if="form.missionType === 'PuzzleMission'" class="space-y-3">
            <div class="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-amber-300 text-sm space-y-1">
              <p class="font-bold">🧩 {{ t('admin.missions.PuzzleMission') }}</p>
              <p class="text-amber-400/80">{{ t('admin.missions.puzzleNoteBody') }}</p>
            </div>
            <!-- Image upload + preview -->
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-2">{{ t('admin.checkpoints.puzzleImage') }}</label>
              <div v-if="form.missionConfig.puzzleImageUrl" class="flex items-start gap-3">
                <img :src="form.missionConfig.puzzleImageUrl" class="w-24 h-24 rounded-xl object-cover border border-amber-500/40" />
                <div class="flex flex-col gap-2">
                  <label class="btn-secondary text-xs py-1.5 px-3 cursor-pointer">
                    {{ t('admin.checkpoints.puzzleChangeBtn') }}
                    <input type="file" accept="image/*" class="hidden" @change="onPuzzleFilePick" />
                  </label>
                  <button @click="clearPuzzleImage" class="btn-danger text-xs py-1.5 px-3">✕</button>
                </div>
              </div>
              <label v-else class="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/50 hover:border-amber-500/50 transition-colors cursor-pointer w-full">
                <span class="text-2xl">🧩</span>
                <span class="text-sm font-semibold text-slate-300">{{ t('admin.checkpoints.puzzleCropBtn') }}</span>
                <input type="file" accept="image/*" class="hidden" @change="onPuzzleFilePick" />
              </label>
            </div>
          </div>

          <!-- Harp mission note -->
          <div v-if="form.missionType === 'HarpMission'"
               class="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-amber-300 text-sm space-y-1">
            <p class="font-bold">🎵 {{ t('admin.missions.HarpMission') }}</p>
            <p class="text-amber-400/80">{{ t('admin.missions.harpNoteBody') }}</p>
          </div>

          <!-- Photo mission note -->
          <div v-if="form.missionType === 'PhotoCapture'"
               class="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-amber-300 text-sm space-y-1">
            <p class="font-bold">📷 {{ t('admin.missions.photoMissionNote') }}</p>
            <p class="text-amber-400/80">{{ t('admin.missions.photoMissionNoteBody') }}</p>
          </div>

          <!-- ── TextValidation: simple explanation + answer + timer ── -->
          <div v-if="form.missionType === 'TextValidation'" class="space-y-3">
            <!-- Explanation -->
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.questionLabel') }}</label>
                <textarea v-model="form.missionConfig.questions[0].question" rows="2" class="input-field resize-none text-sm" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.questionEnLabel') }}</label>
                <textarea v-model="form.missionConfig.questions[0].questionEn" rows="2" class="input-field resize-none text-sm" />
              </div>
            </div>

            <!-- Answers -->
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">
                  {{ t('admin.checkpoints.correctAnswer') }} (עברית) *
                </label>
                <input v-model="form.missionConfig.questions[0].answer" class="input-field font-mono text-sm"
                       :placeholder="t('admin.checkpoints.keywordPlaceholderHe')" />
                <p class="text-xs text-slate-500 mt-1">{{ t('admin.checkpoints.keywordMultiHint') }}</p>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">
                  {{ t('admin.checkpoints.correctAnswer') }} (English)
                  <span class="text-slate-600 font-normal ms-1">{{ t('admin.checkpoints.answerEnFallback') }}</span>
                </label>
                <input v-model="form.missionConfig.questions[0].answerEn" class="input-field font-mono text-sm"
                       :placeholder="t('admin.checkpoints.keywordPlaceholderEn')" />
                <p class="text-xs text-slate-500 mt-1">{{ t('admin.checkpoints.keywordMultiHint') }}</p>
              </div>
            </div>

            <!-- Timer toggle -->
            <div class="rounded-xl border border-slate-700 bg-slate-900/30 p-3 space-y-3">
              <label class="flex items-center gap-3 cursor-pointer select-none">
                <div
                  @click="form.missionConfig.questions[0].timerEnabled = !form.missionConfig.questions[0].timerEnabled"
                  :class="['relative w-11 h-6 rounded-full transition-colors', form.missionConfig.questions[0].timerEnabled ? 'bg-amber-500' : 'bg-slate-600']"
                >
                  <div :class="['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', form.missionConfig.questions[0].timerEnabled ? 'translate-x-5' : 'translate-x-0']" />
                </div>
                <span class="text-sm font-semibold text-slate-300">⏱ {{ t('admin.checkpoints.timerLabel') }}</span>
              </label>

              <Transition name="slide-down">
                <div v-if="form.missionConfig.questions[0].timerEnabled" class="flex items-center gap-3">
                  <div class="flex-1">
                    <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.timerSeconds') }}</label>
                    <input
                      v-model.number="form.missionConfig.questions[0].timerSeconds"
                      type="number" min="10" max="600" step="5"
                      class="input-field text-sm w-28"
                    />
                  </div>
                  <p class="text-xs text-slate-500 mt-4">{{ t('admin.checkpoints.timerHint') }}</p>
                </div>
              </Transition>
            </div>
          </div>

          <!-- ── QrScanMission: instruction + expected QR value ── -->
          <div v-if="form.missionType === 'QrScanMission'" class="space-y-3">
            <div class="flex items-start gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
              <span class="text-base shrink-0">📷</span>
              <span>{{ t('admin.missions.qrScanNoteBody') }}</span>
            </div>

            <!-- Optional question text -->
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">
                  {{ t('admin.checkpoints.questionLabel') }}
                  <span class="text-slate-600 font-normal ms-1">({{ t('admin.missions.optional') }})</span>
                </label>
                <textarea v-model="form.missionConfig.questions[0].question" rows="2" class="input-field resize-none text-sm" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">
                  {{ t('admin.checkpoints.questionEnLabel') }}
                  <span class="text-slate-600 font-normal ms-1">({{ t('admin.missions.optional') }})</span>
                </label>
                <textarea v-model="form.missionConfig.questions[0].questionEn" rows="2" class="input-field resize-none text-sm" />
              </div>
            </div>

            <!-- QR expected value -->
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1">
                {{ t('admin.missions.qrScanAnswerLabel') }}
              </label>
              <input v-model="form.missionConfig.questions[0].answer" class="input-field font-mono text-sm"
                     :placeholder="t('admin.missions.qrScanAnswerPlaceholder')" />
              <p class="text-xs text-slate-500 mt-1">{{ t('admin.missions.qrScanAnswerHint') }}</p>
            </div>

            <!-- QR code generator -->
            <div>
              <button
                @click="showMissionQr = !showMissionQr"
                :disabled="!form.missionConfig.questions[0].answer?.trim()"
                class="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors disabled:opacity-40"
                :class="showMissionQr ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-slate-600 bg-slate-800 text-slate-300 hover:text-amber-400'"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                </svg>
                {{ showMissionQr ? 'Masquer le QR' : 'Générer le QR code' }}
              </button>
              <div v-if="showMissionQr" class="mt-3 flex justify-center">
                <QrCodeDisplay
                  :value="form.missionConfig.questions[0].answer"
                  :label="form.title || 'mission'"
                  :brand="form.envelopeBrand || 'נופש רשות 2026'"
                />
              </div>
            </div>
          </div>

          <!-- ── Questions loop: MultipleChoice, MultiSelect, MissingWord, CompassMission ── -->
          <div v-if="['MultipleChoice', 'MultiSelect', 'MissingWord', 'CompassMission'].includes(form.missionType)" class="space-y-4">
            <div
              v-for="(q, qIdx) in form.missionConfig.questions"
              :key="qIdx"
              class="rounded-2xl border border-slate-600 bg-slate-900/40 p-4 space-y-3"
            >
              <!-- Question header -->
              <div class="flex items-center justify-between">
                <span class="text-xs font-black text-amber-400 uppercase tracking-widest">
                  Question {{ qIdx + 1 }}
                </span>
                <button
                  v-if="form.missionConfig.questions.length > 1"
                  @click="removeQuestion(qIdx)"
                  class="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded"
                >
                  {{ t('admin.checkpoints.removeQuestion') }}
                </button>
              </div>

              <!-- Per-question clue image (MissingWord only) -->
              <div v-if="form.missionType === 'MissingWord'">
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.missingWordImage') }}</label>
                <p class="text-xs text-slate-500 mb-2">{{ t('admin.checkpoints.missingWordImageHint') }}</p>
                <div v-if="missingWordUploading === qIdx" class="flex items-center gap-2 text-slate-400 text-sm py-2">
                  <span class="animate-spin">⏳</span> {{ t('common.loading') }}
                </div>
                <div v-else-if="q.imageUrl" class="flex items-start gap-3">
                  <img :src="q.imageUrl" class="w-28 h-20 object-cover rounded-xl border border-blue-500/40" />
                  <label class="btn-secondary text-xs py-1.5 px-3 cursor-pointer">
                    {{ t('admin.checkpoints.missingWordChangeBtn') }}
                    <input type="file" accept="image/*" class="hidden" @change="onMissingWordFilePick($event, qIdx)" />
                  </label>
                </div>
                <label v-else class="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/50 hover:border-blue-500/50 transition-colors cursor-pointer w-full">
                  <span class="text-xl">🔍</span>
                  <span class="text-sm font-semibold text-slate-300">{{ t('admin.checkpoints.missingWordUploadBtn') }}</span>
                  <input type="file" accept="image/*" class="hidden" @change="onMissingWordFilePick($event, qIdx)" />
                </label>
              </div>

              <!-- Question text -->
              <div class="grid md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.questionLabel') }} *</label>
                  <textarea v-model="q.question" rows="2" class="input-field resize-none text-sm" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.questionEnLabel') }}</label>
                  <textarea v-model="q.questionEn" rows="2" class="input-field resize-none text-sm" />
                </div>
              </div>

              <!-- MissingWord: single answer -->
              <div v-if="form.missionType === 'MissingWord'">
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.checkpoints.correctAnswer') }}</label>
                <input v-model="q.answer" class="input-field font-mono text-sm" />
              </div>

              <!-- CompassMission: answer HE + EN -->
              <div v-if="form.missionType === 'CompassMission'" class="grid md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-400 mb-1">
                    {{ t('admin.checkpoints.correctAnswer') }} (עברית) *
                  </label>
                  <input v-model="q.answer" class="input-field font-mono text-sm"
                         :placeholder="t('admin.checkpoints.compassAnswerHint')" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-400 mb-1">
                    {{ t('admin.checkpoints.correctAnswer') }} (English)
                    <span class="text-slate-600 font-normal ms-1">{{ t('admin.checkpoints.answerEnFallback') }}</span>
                  </label>
                  <input v-model="q.answerEn" class="input-field font-mono text-sm"
                         :placeholder="t('admin.checkpoints.compassAnswerHint')" />
                </div>
              </div>

              <!-- MultipleChoice / MultiSelect: choices -->
              <div v-if="['MultipleChoice', 'MultiSelect'].includes(form.missionType)" class="space-y-2">
                <p v-if="form.missionType === 'MultiSelect'" class="text-xs text-amber-400/80 font-semibold">
                  {{ t('admin.checkpoints.multiSelectHint') }}
                </p>
                <div
                  v-for="(choice, cIdx) in q.choices"
                  :key="cIdx"
                  class="flex items-center gap-2 bg-slate-800 rounded-xl p-2 border border-slate-700"
                >
                  <button
                    @click="form.missionType === 'MultiSelect' ? toggleCorrect(qIdx, cIdx) : setCorrect(qIdx, cIdx)"
                    :class="['w-6 h-6 flex items-center justify-center shrink-0 transition-colors border-2',
                      form.missionType === 'MultiSelect' ? 'rounded-md' : 'rounded-full',
                      choice.isCorrect ? 'bg-green-500 border-green-500 text-white' : 'border-slate-500']"
                    :title="form.missionType === 'MultiSelect' ? 'Basculer correcte' : 'Marquer comme correcte'"
                  >
                    <svg v-if="choice.isCorrect" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                  </button>
                  <span class="text-xs text-slate-500 w-4 text-center">{{ String.fromCharCode(65 + cIdx) }}</span>
                  <input v-model="choice.text" class="input-field text-sm py-1.5 flex-1" placeholder="Texte" />
                  <input v-model="choice.textEn" class="input-field text-sm py-1.5 flex-1" placeholder="English" />
                  <button @click="removeChoice(qIdx, cIdx)" class="text-red-400 hover:text-red-300 text-sm px-1">✕</button>
                </div>
                <button @click="addChoice(qIdx)" class="btn-secondary text-xs py-1.5 px-3">{{ t('admin.checkpoints.addChoice') }}</button>
              </div>
            </div>

            <!-- Add question button (not for CompassMission which is always single) -->
            <button
              v-if="['MultipleChoice', 'MultiSelect', 'MissingWord'].includes(form.missionType)"
              @click="addQuestion"
              class="btn-secondary w-full text-sm py-2.5 border-dashed"
            >
              {{ t('admin.checkpoints.addQuestion') }}
            </button>
          </div>
          </div><!-- /bg-slate-800/40 mission -->
        </div><!-- /carte mission -->

        <!-- ══════════════════════════════════════════════════════
             CARTE 5 — Points
        ══════════════════════════════════════════════════════ -->
        <div class="rounded-2xl border border-slate-700 overflow-hidden">
          <button type="button" @click="toggle('points')" class="w-full flex items-center justify-between gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700/80 transition-colors text-start">
            <div class="flex items-center gap-2">
              <span>⭐</span>
              <h3 class="text-xs font-black text-amber-400 uppercase tracking-wider">Points</h3>
            </div>
            <svg class="w-4 h-4 text-slate-400 transition-transform shrink-0" :class="sections.points ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div v-show="sections.points" class="bg-slate-800/40 p-5">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-green-400 mb-1">{{ t('admin.checkpoints.pointsCorrect') }}</label>
                <input v-model="form.pointsCorrect" type="number" min="0" class="input-field text-green-400 font-bold" />
              </div>
              <div v-if="!['PhotoCapture', 'PuzzleMission', 'AudioRecorder'].includes(form.missionType)">
                <label class="block text-sm font-semibold text-red-400 mb-1">{{ t('admin.checkpoints.pointsWrong') }}</label>
                <input v-model="form.pointsWrong" type="number" min="0" class="input-field text-red-400 font-bold" />
              </div>
            </div>
          </div>
        </div><!-- /carte points -->

        <!-- Validation error -->
        <Transition name="feedback">
          <div v-if="saveError"
               class="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold">
            ⚠️ {{ saveError }}
          </div>
        </Transition>

        <!-- Actions -->
        <div class="flex gap-3 pt-2">
          <button @click="saveCheckpoint" :disabled="saving || !form.title.trim()" class="btn-primary flex-1">
            {{ saving ? t('common.loading') : t('admin.checkpoints.save') }}
          </button>
          <button @click="cancelForm" class="btn-secondary">{{ t('common.cancel') }}</button>
        </div>

        <!-- Bottom navigation arrows (edit mode only) -->
        <div v-if="editingId" class="flex items-center justify-between gap-3 px-1 py-1 rounded-xl bg-slate-800/60 border border-slate-700">
          <button
            @click="navigateTo(prevCheckpoint)"
            :disabled="!prevCheckpoint"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-300"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            <span class="hidden sm:inline truncate max-w-[120px]">{{ prevCheckpoint?.title ?? '' }}</span>
            <span class="sm:hidden">Préc.</span>
          </button>
          <span class="text-xs text-slate-500 tabular-nums shrink-0">
            {{ currentEditIndex + 1 }} / {{ sortedCheckpoints.length }}
          </span>
          <button
            @click="navigateTo(nextCheckpoint)"
            :disabled="!nextCheckpoint"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-300"
          >
            <span class="hidden sm:inline truncate max-w-[120px]">{{ nextCheckpoint?.title ?? '' }}</span>
            <span class="sm:hidden">Suiv.</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </Transition>

    <PuzzleCropper
      v-if="showCropper && puzzleRawSrc"
      :src="puzzleRawSrc"
      @confirm="onCropConfirm"
      @cancel="showCropper = false"
    />

    <!-- Free crop for MissingWord images — 4:3 locked -->
    <FreeCropper
      v-if="showFreeCropperMW && freeCropperMWSrc"
      :src="freeCropperMWSrc"
      :aspectRatio="4/3"
      @confirm="onFreeCropMWConfirm"
      @cancel="showFreeCropperMW = false"
    />

    <ImageEditor
      v-if="showImageEditor && imageEditorSrc"
      :src="imageEditorSrc"
      @confirm="onImageEditorConfirm"
      @cancel="showImageEditor = false"
    />

    <!-- Free crop for Stage 1 verification image -->
    <FreeCropper
      v-if="showFreeCropperS1 && freeCropperS1Src"
      :src="freeCropperS1Src"
      @confirm="onFreeCropS1Confirm"
      @cancel="showFreeCropperS1 = false"
    />

    <ImageEditor
      v-if="showStage1ImageEditor && stage1ImageEditorSrc"
      :src="stage1ImageEditorSrc"
      @confirm="onStage1ImageConfirm"
      @cancel="showStage1ImageEditor = false"
    />

    <ConfirmModal
      :is-open="!!confirmDeleteId"
      :message="t('admin.checkpoints.confirmDelete')"
      @confirm="deleteCheckpoint"
      @cancel="confirmDeleteId = null"
    />
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
