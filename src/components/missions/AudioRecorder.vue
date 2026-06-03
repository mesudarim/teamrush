<script setup>
import { ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { uploadAudioRecording } from '@/firebase/storage'
import { saveAudioRecord } from '@/firebase/firestore'
import BaseMission from './BaseMission.vue'

const { t } = useI18n()
const auth = useAuthStore()

const props = defineProps({
  checkpoint: { type: Object, required: true },
  question:   { type: Object, required: true },
  config:     { type: Object, default: () => ({}) },
})
const emit = defineEmits(['correct'])

const MAX_SECONDS = 180

// state: idle | requesting | recording | recorded | uploading | done
const state    = ref('idle')
const error    = ref(null)
const elapsed  = ref(0)
const audioUrl = ref(null)
const mimeType = ref('audio/webm')

let mediaRecorder = null
let stream = null
let chunks = []
let timerInterval = null

const formatTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

const getExtension = (mime) => {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

const getSupportedMime = () => {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ]
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

const stopStream = () => {
  stream?.getTracks().forEach(t => t.stop())
  stream = null
}

const startRecording = async () => {
  error.value = null
  if (typeof MediaRecorder === 'undefined') {
    error.value = t('missions.audioRecorder.unavailable')
    return
  }

  state.value = 'requesting'
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  } catch {
    state.value = 'idle'
    error.value = t('missions.audioRecorder.permissionDenied')
    return
  }

  const mime = getSupportedMime()
  mimeType.value = mime || 'audio/webm'
  chunks = []

  try {
    mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
  } catch {
    mediaRecorder = new MediaRecorder(stream)
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data?.size > 0) chunks.push(e.data)
  }

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType.value })
    if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = URL.createObjectURL(blob)
    // Store blob reference for upload
    mediaRecorder._blob = blob
    state.value = 'recorded'
    stopStream()
  }

  mediaRecorder.start(100)
  state.value = 'recording'
  elapsed.value = 0

  timerInterval = setInterval(() => {
    elapsed.value++
    if (elapsed.value >= MAX_SECONDS) stopRecording()
  }, 1000)
}

const stopRecording = () => {
  clearInterval(timerInterval)
  if (mediaRecorder?.state !== 'inactive') mediaRecorder?.stop()
}

const retake = () => {
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
  audioUrl.value = null
  mediaRecorder = null
  elapsed.value = 0
  error.value = null
  state.value = 'idle'
}

const submit = async () => {
  const blob = mediaRecorder?._blob
  if (!blob) return
  state.value = 'uploading'
  error.value = null
  try {
    const ext = getExtension(mimeType.value)
    const url = await uploadAudioRecording(blob, props.checkpoint.id, auth.pseudo, ext, mimeType.value)
    await saveAudioRecord({
      teamPseudo:      auth.pseudo,
      teamName:        auth.participant?.name ?? auth.pseudo,
      checkpointId:    props.checkpoint.id,
      checkpointTitle: props.checkpoint.title ?? '',
      url,
      mimeType:        mimeType.value,
      durationSeconds: elapsed.value,
    })
    state.value = 'done'
    emit('correct')
  } catch {
    error.value = t('missions.audioRecorder.uploadError')
    state.value = 'recorded'
  }
}

onUnmounted(() => {
  clearInterval(timerInterval)
  stopStream()
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
})
</script>

<template>
  <BaseMission :checkpoint="checkpoint" :config="config">
    <div class="space-y-5">

      <!-- Success -->
      <div v-if="state === 'done'"
           class="flex items-center justify-center gap-2 p-4 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-semibold">
        <span class="text-2xl">✅</span>
        {{ t('missions.audioRecorder.success') }}
      </div>

      <!-- Error -->
      <p v-if="error" class="text-red-400 text-sm text-center px-2">{{ error }}</p>

      <!-- ── IDLE ── -->
      <div v-if="state === 'idle'" class="flex flex-col items-center gap-4">
        <p class="text-slate-400 text-sm text-center">{{ t('missions.audioRecorder.tapToStart') }}</p>
        <button
          @click="startRecording"
          class="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95 transition-transform"
        >
          <svg viewBox="0 0 24 24" class="w-10 h-10 fill-white">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 1 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h3v2H8v-2h3v-2.08A7 7 0 0 1 5 12z"/>
          </svg>
        </button>
      </div>

      <!-- ── REQUESTING PERMISSION ── -->
      <div v-if="state === 'requesting'" class="flex flex-col items-center gap-3 py-4">
        <div class="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
        <p class="text-slate-400 text-sm">{{ t('missions.audioRecorder.requesting') }}</p>
      </div>

      <!-- ── RECORDING ── -->
      <div v-if="state === 'recording'" class="flex flex-col items-center gap-4">

        <!-- Animated waveform -->
        <div class="flex items-center justify-center gap-1.5 h-12">
          <span v-for="i in 7" :key="i" class="waveBar" :style="{ '--i': i }" />
        </div>

        <!-- Timer -->
        <div class="text-3xl font-black tabular-nums text-red-400">
          {{ formatTime(elapsed) }}
        </div>
        <p class="text-xs text-slate-500">{{ t('missions.audioRecorder.maxDuration', { max: formatTime(MAX_SECONDS) }) }}</p>

        <!-- Stop button -->
        <button
          @click="stopRecording"
          class="flex items-center gap-2 px-6 py-3 rounded-2xl bg-red-500/15 border-2 border-red-500 text-red-400 font-bold hover:bg-red-500/25 transition-colors"
        >
          <span class="w-3 h-3 rounded-sm bg-red-400 inline-block" />
          {{ t('missions.audioRecorder.stopBtn') }}
        </button>
      </div>

      <!-- ── RECORDED (preview) ── -->
      <div v-if="state === 'recorded'" class="space-y-4">
        <div class="rounded-xl bg-slate-900/60 border border-slate-700 p-4 space-y-2">
          <div class="flex items-center gap-2 text-green-400 text-sm font-semibold">
            <span>🎙️</span>
            {{ t('missions.audioRecorder.preview') }}
            <span class="ms-auto text-slate-400 text-xs tabular-nums">{{ formatTime(elapsed) }}</span>
          </div>
          <audio :src="audioUrl" controls class="w-full h-10" style="accent-color: #f59e0b;" />
        </div>

        <button
          @click="retake"
          class="w-full btn-secondary text-sm py-2.5"
        >
          ↺ {{ t('missions.audioRecorder.retakeBtn') }}
        </button>

        <button
          @click="submit"
          class="w-full btn-primary py-3 font-bold"
        >
          {{ t('missions.audioRecorder.submitBtn', { points: checkpoint.pointsCorrect ?? 100 }) }}
        </button>
      </div>

      <!-- ── UPLOADING ── -->
      <div v-if="state === 'uploading'" class="flex flex-col items-center gap-3 py-4">
        <div class="w-10 h-10 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
        <p class="text-slate-400 text-sm">{{ t('missions.audioRecorder.uploading') }}</p>
      </div>

    </div>
  </BaseMission>
</template>

<style scoped>
.waveBar {
  display: inline-block;
  width: 5px;
  border-radius: 3px;
  background: #f87171;
  animation: waveAnim 0.7s ease-in-out infinite alternate;
  animation-delay: calc(var(--i) * 0.09s);
  min-height: 4px;
}

@keyframes waveAnim {
  from { height: 4px; }
  to   { height: calc(8px + var(--i) * 5px); }
}
</style>
