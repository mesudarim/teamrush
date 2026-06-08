<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import MapPicker from '@/components/ui/MapPicker.vue'
import QrCodeDisplay from '@/components/ui/QrCodeDisplay.vue'
import PuzzleCropper from '@/components/ui/PuzzleCropper.vue'
import ImageEditor from '@/components/ui/ImageEditor.vue'
import FreeCropper from '@/components/ui/FreeCropper.vue'
import { uploadMissingWordImage } from '@/firebase/storage'

const { t } = useI18n()
const admin = useAdminStore()

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
    mapLat: '', mapLng: '', mapZoom: 15,
    envelopeBrand: 'מרוץ הנבל',
    envelope1Label: 'יעד',
    envelope2Label: 'משימה',
    stage1Mode: 'text',
    stage1Instruction: '',
    stage1InstructionEn: '',
    stage1Keyword: '',
    stage1KeywordEn: '',
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

const missionTypes = ['TextValidation', 'MultipleChoice', 'MissingWord', 'PhotoCapture', 'CompassMission', 'PuzzleMission', 'AudioRecorder', 'HarpMission']

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

  // MultipleChoice: every question must have at least one correct choice
  if (form.value.missionType === 'MultipleChoice') {
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

const viewMode = ref(localStorage.getItem('cp_view') ?? 'card')
const setView = (v) => { viewMode.value = v; localStorage.setItem('cp_view', v) }

const stageModeLabel = (cp) => {
  const mode = cp.stage1Mode ?? 'text'
  if (mode === 'qr')          return t('game.stage1.modeQr')
  if (mode === 'missingWord') return t('game.stage1.modeMissingWord')
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
            title="Vue liste"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>
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
    <div v-if="!showForm && viewMode === 'card'" class="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
      <div
        v-for="cp in admin.checkpoints"
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

    <!-- ── LIST VIEW ── -->
    <div v-if="!showForm && viewMode === 'list'" class="mb-6 rounded-xl border border-slate-700 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-800 border-b border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <th class="px-4 py-2.5 text-start">#</th>
            <th class="px-4 py-2.5 text-start">{{ t('admin.checkpoints.sectionName') }}</th>
            <th class="px-4 py-2.5 text-start hidden md:table-cell">{{ t('admin.checkpoints.sectionVerification') }}</th>
            <th class="px-4 py-2.5 text-start hidden md:table-cell">{{ t('admin.checkpoints.sectionMission') }}</th>
            <th class="px-4 py-2.5 text-end"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(cp, idx) in admin.checkpoints"
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

    <!-- Checkpoint form -->
    <Transition name="slide-down">
      <div v-if="showForm" class="card-glow space-y-6 max-w-3xl">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-xl text-amber-400">
            {{ editingId ? t('admin.checkpoints.edit') : t('admin.checkpoints.create') }}
          </h3>
          <button @click="cancelForm" class="btn-ghost">✕</button>
        </div>

        <!-- ── NOM ── -->
        <fieldset class="space-y-3">
          <legend class="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">{{ t('admin.checkpoints.sectionName') }}</legend>
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
        </fieldset>

        <!-- ── DESCRIPTION ── -->
        <fieldset class="space-y-3">
          <legend class="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">{{ t('admin.checkpoints.sectionDescription') }}</legend>
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
          <!-- Video toggle + URL -->
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <div
              @click="form.showVideo = !form.showVideo"
              :class="['relative w-11 h-6 rounded-full transition-colors', form.showVideo ? 'bg-amber-500' : 'bg-slate-600']"
            >
              <div :class="['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', form.showVideo ? 'translate-x-5' : 'translate-x-0']" />
            </div>
            <span class="text-sm font-semibold text-slate-300">{{ t('admin.checkpoints.showVideo') }}</span>
          </label>
          <div v-if="form.showVideo">
            <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.youtubeUrl') }}</label>
            <input v-model="form.youtubeUrl" class="input-field" placeholder="https://youtube.com/..." />
          </div>
        </fieldset>

        <!-- Map settings -->
        <fieldset class="space-y-4">
          <legend class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">{{ t('admin.checkpoints.mapType') }}</legend>

          <!-- Show map toggle -->
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <div
              @click="form.showMap = !form.showMap"
              :class="['relative w-11 h-6 rounded-full transition-colors', form.showMap ? 'bg-amber-500' : 'bg-slate-600']"
            >
              <div :class="['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', form.showMap ? 'translate-x-5' : 'translate-x-0']" />
            </div>
            <span class="text-sm font-semibold text-slate-300">{{ t('admin.checkpoints.showMap') }}</span>
            <span class="text-xs text-slate-500">{{ t('admin.checkpoints.showMapHint') }}</span>
          </label>

          <template v-if="form.showMap">
            <div class="flex gap-3">
              <button
                v-for="type in ['coordinates', 'image']"
                :key="type"
                @click="form.mapType = type"
                :class="['px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-colors', form.mapType === type ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-600 bg-slate-700 text-slate-400']"
              >
                {{ type === 'coordinates' ? t('admin.checkpoints.mapTypeCoords') : t('admin.checkpoints.mapTypeImage') }}
              </button>
            </div>

            <div v-if="form.mapType === 'coordinates'">
              <MapPicker
                :lat="form.mapLat"
                :lng="form.mapLng"
                :zoom="form.mapZoom"
                @update:lat="form.mapLat = $event"
                @update:lng="form.mapLng = $event"
                @update:zoom="form.mapZoom = $event"
              />
            </div>

            <div v-else>
              <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.mapImage') }}</label>
              <input type="file" accept="image/*" @change="onImageChange" class="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-500/20 file:text-amber-400 hover:file:bg-amber-500/30 cursor-pointer" />
              <img v-if="imagePreview" :src="imagePreview" class="mt-2 w-full max-h-40 object-contain rounded-lg bg-slate-900" />
            </div>
          </template>
        </fieldset>

        <!-- Envelope display -->
        <fieldset class="space-y-4">
          <legend class="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">{{ t('admin.checkpoints.envelopeSection') }}</legend>
          <p class="text-xs text-slate-500 -mt-2">{{ t('admin.checkpoints.envelopeSectionHint') }}</p>
          <div class="grid md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.envelopeBrand') }}</label>
              <input v-model="form.envelopeBrand" class="input-field text-center font-mono tracking-widest" placeholder="מרוץ הנבל" />
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
          <!-- Live preview -->
          <div class="flex gap-4 justify-center">
            <div v-for="(lbl, i) in [form.envelope1Label || 'יעד', form.envelope2Label || 'משימה']" :key="i"
                 class="rounded-xl overflow-hidden shadow-lg border border-amber-500/30 flex-1 max-w-[160px]"
                 style="aspect-ratio: 1.9 / 1; position: relative;">
              <div class="absolute top-0 left-0 right-0 bg-amber-400" style="height:18%;" />
              <div class="absolute left-0 right-0 bg-black flex flex-col items-center justify-center gap-0.5"
                   style="top:18%; bottom:22%;">
                <span class="text-amber-400/70 font-bold uppercase tracking-widest text-center"
                      style="font-size:0.4rem;">{{ form.envelopeBrand || 'מרוץ הנבל' }}</span>
                <span class="text-amber-400 font-black leading-none text-center"
                      style="font-size:1.1rem;">{{ lbl }}</span>
              </div>
              <div class="absolute bottom-0 left-0 right-0 bg-amber-400 flex items-center justify-center"
                   style="height:22%;">
                <span class="text-black font-black" style="font-size:0.4rem;">◄ ◄ ◄ &nbsp; ► ► ►</span>
              </div>
            </div>
          </div>
        </fieldset>

        <!-- ── VÉRIFICATION (Stage 1) ── -->
        <fieldset class="space-y-4">
          <legend class="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">{{ t('admin.checkpoints.sectionVerification') }}</legend>

          <!-- 3 mode buttons -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="mode in ['text', 'qr', 'missingWord']"
              :key="mode"
              @click="form.stage1Mode = mode"
              :class="['px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-colors',
                form.stage1Mode === mode
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-slate-600 bg-slate-700 text-slate-400']"
            >
              {{ mode === 'text' ? '⌨️ ' + t('game.stage1.modeText')
               : mode === 'qr'   ? '📷 ' + t('game.stage1.modeQr')
               :                   '🔍 ' + t('game.stage1.modeMissingWord') }}
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
              <QrCodeDisplay :value="form.stage1Keyword" :label="form.title" />
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
        </fieldset>

        <!-- ── MISSION (Stage 2) ── -->
        <fieldset class="space-y-4">
          <legend class="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">{{ t('admin.checkpoints.sectionMission') }}</legend>

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

          <!-- ── Questions loop: MultipleChoice, MissingWord, CompassMission ── -->
          <div v-if="['MultipleChoice', 'MissingWord', 'CompassMission'].includes(form.missionType)" class="space-y-4">
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

              <!-- MultipleChoice: choices -->
              <div v-if="form.missionType === 'MultipleChoice'" class="space-y-2">
                <div
                  v-for="(choice, cIdx) in q.choices"
                  :key="cIdx"
                  class="flex items-center gap-2 bg-slate-800 rounded-xl p-2 border border-slate-700"
                >
                  <button
                    @click="setCorrect(qIdx, cIdx)"
                    :class="['w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors', choice.isCorrect ? 'bg-green-500 border-green-500 text-white' : 'border-slate-500']"
                    title="Mark as correct"
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
              v-if="['MultipleChoice', 'MissingWord'].includes(form.missionType)"
              @click="addQuestion"
              class="btn-secondary w-full text-sm py-2.5 border-dashed"
            >
              {{ t('admin.checkpoints.addQuestion') }}
            </button>
          </div>
        </fieldset>

        <!-- Points -->

        <fieldset>
          <legend class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Points</legend>
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
        </fieldset>

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
      </div>
    </Transition>

    <PuzzleCropper
      v-if="showCropper && puzzleRawSrc"
      :src="puzzleRawSrc"
      @confirm="onCropConfirm"
      @cancel="showCropper = false"
    />

    <!-- Free crop for MissingWord images -->
    <FreeCropper
      v-if="showFreeCropperMW && freeCropperMWSrc"
      :src="freeCropperMWSrc"
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
