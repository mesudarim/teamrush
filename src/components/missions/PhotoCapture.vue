<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { uploadPhoto } from '@/firebase/storage'
import { savePhotoRecord } from '@/firebase/firestore'
import BaseMission from './BaseMission.vue'

const { t } = useI18n()

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
    await savePhotoRecord({
      teamPseudo: auth.pseudo,
      checkpointId: props.checkpoint.id,
      checkpointTitle: props.checkpoint.title ?? '',
      url,
    })
    uploaded.value = true
    emit('correct')
  } catch {
    error.value = t('missions.photoCapture.errorUpload')
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <BaseMission :checkpoint="checkpoint" :config="config">
    <div class="space-y-4">

      <!-- Preview -->
      <div v-if="preview" class="relative rounded-2xl overflow-hidden border-2 border-amber-500/40">
        <img :src="preview" class="w-full max-h-64 object-cover" />
        <button
          v-if="!uploaded"
          @click="retake"
          class="absolute top-2 right-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm"
        >
          {{ t('missions.photoCapture.retake') }}
        </button>
      </div>

      <!-- Success -->
      <div
        v-if="uploaded"
        class="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-semibold text-sm"
      >
        <span class="text-xl">✅</span> {{ t('missions.photoCapture.success') }}
      </div>

      <!-- Error -->
      <p v-if="error" class="text-red-400 text-sm text-center">{{ error }}</p>

      <!-- Camera button (no preview yet) -->
      <label
        v-if="!preview && !uploaded"
        class="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-2xl border-2 border-dashed border-slate-600 bg-slate-800/50 hover:border-amber-500/60 hover:bg-amber-500/5 transition-all cursor-pointer active:scale-[0.98]"
      >
        <span class="text-5xl">📷</span>
        <span class="font-bold text-slate-200">{{ t('missions.photoCapture.cameraBtn') }}</span>
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

      <!-- Confirm button -->
      <button
        v-if="preview && !uploaded"
        @click="confirmPhoto"
        :disabled="uploading"
        class="w-full btn-primary py-3 text-base font-bold disabled:opacity-50"
      >
        <span v-if="uploading" class="flex items-center justify-center gap-2">
          <span class="inline-block animate-spin">⏳</span>
          {{ t('missions.photoCapture.uploading') }}
        </span>
        <span v-else>{{ t('missions.photoCapture.confirm', { points: checkpoint.pointsCorrect ?? 100 }) }}</span>
      </button>
    </div>
  </BaseMission>
</template>
