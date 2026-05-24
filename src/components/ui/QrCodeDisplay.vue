<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  value: { type: String, default: '' },
  label: { type: String, default: '' },
})

const canvasEl = ref(null)
const QRCode = ref(null)

const render = async () => {
  if (!props.value || !canvasEl.value) return
  if (!QRCode.value) {
    QRCode.value = (await import('qrcode')).default
  }
  await QRCode.value.toCanvas(canvasEl.value, props.value, {
    width: 200,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
  })
}

onMounted(render)
watch(() => props.value, render)

const download = () => {
  if (!canvasEl.value) return
  const link = document.createElement('a')
  link.download = `QR_${props.label || props.value}.png`
  link.href = canvasEl.value.toDataURL('image/png')
  link.click()
}
</script>

<template>
  <div v-if="value" class="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border-2 border-dashed border-slate-300">
    <canvas ref="canvasEl" class="rounded-lg" />
    <p class="text-slate-900 text-xs font-mono font-bold text-center">{{ value }}</p>
    <button
      @click="download"
      class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
      Télécharger PNG
    </button>
  </div>
  <div v-else class="flex items-center justify-center p-4 bg-slate-900/50 rounded-xl border border-dashed border-slate-600 text-slate-500 text-xs">
    Entrez le mot de passe pour générer le QR
  </div>
</template>
