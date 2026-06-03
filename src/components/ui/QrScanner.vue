<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits(['decoded', 'error', 'close'])

const videoEl = ref(null)
const canvasEl = ref(null)
const status = ref('starting') // 'starting' | 'scanning' | 'error'
const errorMsg = ref('')

let stream = null
let animFrame = null
let jsQR = null

onMounted(async () => {
  // Load jsQR dynamically
  jsQR = (await import('jsqr')).default

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    })
    videoEl.value.srcObject = stream
    await videoEl.value.play()
    status.value = 'scanning'
    tick()
  } catch (e) {
    status.value = 'error'
    errorMsg.value = e.name === 'NotAllowedError'
      ? 'Accès caméra refusé. Autorisez la caméra dans les paramètres du navigateur.'
      : 'Impossible d\'accéder à la caméra.'
    emit('error', errorMsg.value)
  }
})

const tick = () => {
  if (!videoEl.value || videoEl.value.readyState < 2) {
    animFrame = requestAnimationFrame(tick)
    return
  }
  const canvas = canvasEl.value
  const ctx = canvas.getContext('2d')
  canvas.width = videoEl.value.videoWidth
  canvas.height = videoEl.value.videoHeight
  ctx.drawImage(videoEl.value, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert',
  })
  if (code?.data) {
    stop()
    emit('decoded', code.data)
    return
  }
  animFrame = requestAnimationFrame(tick)
}

const stop = () => {
  cancelAnimationFrame(animFrame)
  stream?.getTracks().forEach((t) => t.stop())
}

onUnmounted(stop)
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur">
      <span class="text-white font-semibold">Scanner le QR Code</span>
      <button @click="stop(); $emit('close')" class="text-slate-400 hover:text-white p-1">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Camera view -->
    <div class="flex-1 relative overflow-hidden">
      <video ref="videoEl" class="absolute inset-0 w-full h-full object-cover" playsinline muted />
      <canvas ref="canvasEl" class="hidden" />

      <!-- Scanning overlay -->
      <div v-if="status === 'scanning'" class="absolute inset-0 flex items-center justify-center">
        <!-- Dark overlay with cutout -->
        <div class="absolute inset-0 bg-black/50" />

        <!-- Viewfinder -->
        <div class="relative z-10 w-64 h-64">
          <!-- Corner markers -->
          <div class="absolute top-0 start-0 w-8 h-8 border-t-4 border-s-4 border-amber-400 rounded-ss-lg" />
          <div class="absolute top-0 end-0 w-8 h-8 border-t-4 border-e-4 border-amber-400 rounded-se-lg" />
          <div class="absolute bottom-0 start-0 w-8 h-8 border-b-4 border-s-4 border-amber-400 rounded-es-lg" />
          <div class="absolute bottom-0 end-0 w-8 h-8 border-b-4 border-e-4 border-amber-400 rounded-ee-lg" />

          <!-- Scan line animation -->
          <div class="absolute inset-x-2 h-0.5 bg-amber-400/80 animate-scan-line" />
        </div>
      </div>

      <!-- Error state -->
      <div v-if="status === 'error'" class="absolute inset-0 flex items-center justify-center p-6">
        <div class="bg-slate-800 rounded-2xl p-6 text-center max-w-sm space-y-4">
          <div class="text-4xl">📷</div>
          <p class="text-slate-300 text-sm">{{ errorMsg }}</p>
          <button @click="$emit('close')" class="btn-secondary w-full">Fermer</button>
        </div>
      </div>

      <!-- Starting -->
      <div v-if="status === 'starting'" class="absolute inset-0 flex items-center justify-center">
        <div class="text-white text-center space-y-3">
          <svg class="w-8 h-8 animate-spin text-amber-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p class="text-sm text-slate-400">Démarrage de la caméra…</p>
        </div>
      </div>
    </div>

    <!-- Footer hint -->
    <div v-if="status === 'scanning'" class="px-4 py-3 text-center bg-black/80">
      <p class="text-slate-400 text-sm">Placez le QR code dans le cadre</p>
    </div>
  </div>
</template>

<style scoped>
@keyframes scan-line {
  0%   { top: 4px; opacity: 1; }
  48%  { opacity: 1; }
  50%  { top: calc(100% - 4px); opacity: 0; }
  52%  { opacity: 0; }
  54%  { opacity: 1; }
  100% { top: 4px; opacity: 1; }
}
.animate-scan-line { animation: scan-line 2s ease-in-out infinite; }
</style>
