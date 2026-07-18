<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { uploadPhoto } from '@/firebase/storage'
import { savePhotoRecord } from '@/firebase/firestore'
import { useGameContextStore } from '@/stores/gameContext'
import BaseMission from './BaseMission.vue'
import { useSound } from '@/composables/useSound'

const { t } = useI18n()
const { playCorrect } = useSound()
const gameCtx = useGameContextStore()

const props = defineProps({
  checkpoint: { type: Object, required: true },
  question:   { type: Object, required: true },
  config:     { type: Object, default: () => ({}) },
})
const emit = defineEmits(['correct'])

const auth = useAuthStore()

const fileInput = ref(null)
const preview = ref(null)
const selectedBlob = ref(null)
const uploading = ref(false)
const uploaded = ref(false)
const error = ref(null)

const resizeToBlob = (file, maxWidth = 600) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const w = Math.min(img.width, maxWidth)
      const h = Math.round(img.height * (w / img.width))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Resize failed'))),
        'image/jpeg',
        0.85
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Load failed')) }
    img.src = url
  })

const onFileChange = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  error.value = null
  try {
    const blob = await resizeToBlob(file)
    selectedBlob.value = blob
    preview.value = URL.createObjectURL(blob)
  } catch {
    error.value = t('missions.photoCapture.errorLoad')
  }
}

const retake = () => {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = null
  selectedBlob.value = null
  error.value = null
  if (fileInput.value) fileInput.value.value = ''
}

const confirmPhoto = async () => {
  if (!selectedBlob.value || uploading.value) return
  uploading.value = true
  error.value = null
  try {
    const url = await uploadPhoto(selectedBlob.value, props.checkpoint.id, auth.pseudo)
    await savePhotoRecord(gameCtx.gameId, {
      teamPseudo:      auth.pseudo,
      teamName:        auth.participant?.name ?? auth.pseudo,
      checkpointId:    props.checkpoint.id,
      checkpointTitle: props.checkpoint.title ?? '',
      url,
    })
    uploaded.value = true
    playCorrect()
    emit('correct')
  } catch {
    error.value = t('missions.photoCapture.errorUpload')
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <BaseMission :checkpoint="checkpoint" :config="config" :show-title="false">
    <div class="space-y-5">

      <!-- ── No photo yet ── -->
      <label
        v-if="!preview && !uploaded"
        class="w-full flex flex-col items-center justify-center gap-2 px-4 py-10 rounded-2xl border-2 border-dashed border-slate-600 bg-slate-800/50 hover:border-amber-500/60 hover:bg-amber-500/5 transition-all cursor-pointer active:scale-[0.98]"
      >
        <span class="text-6xl">📷</span>
        <span class="font-bold text-slate-200 text-lg">{{ t('missions.photoCapture.cameraBtn') }}</span>
        <span class="text-xs text-slate-500">{{ t('missions.photoCapture.cameraHint') }}</span>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="onFileChange"
        />
      </label>

      <!-- ── Preview screen ── -->
      <template v-if="preview && !uploaded">
        <!-- Photo — shown in its natural aspect ratio, bounded by screen size -->
        <div class="rounded-2xl overflow-hidden border-2 border-amber-500/40 flex justify-center bg-slate-900">
          <img :src="preview" class="block w-auto h-auto max-w-full" style="max-height: 55vh;" />
        </div>

        <!-- Error -->
        <p v-if="error" class="text-red-400 text-sm text-center">{{ error }}</p>

        <!-- Two clear action buttons -->
        <div class="grid grid-cols-2 gap-3">
          <button
            @click="retake"
            :disabled="uploading"
            class="py-3.5 rounded-2xl font-bold text-sm border-2 border-slate-600 text-slate-300 bg-slate-800 hover:bg-slate-700 active:scale-[0.97] transition-all disabled:opacity-40"
          >
            ↺ {{ t('missions.photoCapture.retake') }}
          </button>
          <button
            @click="confirmPhoto"
            :disabled="uploading"
            class="py-3.5 rounded-2xl font-bold text-sm btn-primary disabled:opacity-50"
          >
            <span v-if="uploading" class="flex items-center justify-center gap-1.5">
              <span class="inline-block animate-spin text-base">⏳</span>
              {{ t('missions.photoCapture.uploading') }}
            </span>
            <span v-else>
              ✅ {{ t('missions.photoCapture.sendBtn', { points: checkpoint.pointsCorrect ?? 100 }) }}
            </span>
          </button>
        </div>
      </template>

      <!-- ── Success ── -->
      <template v-if="uploaded">
        <div class="rounded-2xl overflow-hidden border border-green-500/30 flex justify-center bg-slate-900">
          <img :src="preview" class="block w-auto h-auto max-w-full opacity-70" style="max-height: 40vh;" />
        </div>
        <div class="flex items-center justify-center gap-2 p-4 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-semibold">
          <span class="text-2xl">✅</span> {{ t('missions.photoCapture.success') }}
        </div>
      </template>

      <!-- Error (no preview) -->
      <p v-if="error && !preview" class="text-red-400 text-sm text-center">{{ error }}</p>

    </div>
  </BaseMission>
</template>
