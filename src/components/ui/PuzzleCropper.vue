<!--
  PuzzleCropper — drag the amber square to choose which area becomes the puzzle.
  Emits: confirm(blob)  cancel()
-->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({ src: { type: String, required: true } })
const emit = defineEmits(['confirm', 'cancel'])

const DISPLAY_MAX = 300
const OUTPUT_SIZE = 400

const natW = ref(1)
const natH = ref(1)
const dispW = ref(DISPLAY_MAX)
const dispH = ref(DISPLAY_MAX)

// Crop square size in natural pixels
const cropNat = computed(() => Math.min(natW.value, natH.value))
const maxCropX = computed(() => Math.max(0, natW.value - cropNat.value))
const maxCropY = computed(() => Math.max(0, natH.value - cropNat.value))

const cropX = ref(0)
const cropY = ref(0)

const scale = computed(() => dispW.value / natW.value)

const overlay = computed(() => ({
  left: Math.round(cropX.value * scale.value),
  top:  Math.round(cropY.value * scale.value),
  size: Math.round(cropNat.value * scale.value),
}))

onMounted(() => {
  const img = new Image()
  img.onload = () => {
    natW.value = img.naturalWidth
    natH.value = img.naturalHeight
    if (img.naturalWidth > DISPLAY_MAX) {
      dispW.value = DISPLAY_MAX
      dispH.value = Math.round(img.naturalHeight * DISPLAY_MAX / img.naturalWidth)
    } else {
      dispW.value = img.naturalWidth
      dispH.value = img.naturalHeight
    }
    cropX.value = maxCropX.value / 2
    cropY.value = maxCropY.value / 2
  }
  img.src = props.src
})

// Pointer drag
let dragging = false
let origin = null

const onPointerDown = (e) => {
  e.preventDefault()
  dragging = true
  origin = { px: e.clientX, py: e.clientY, cx: cropX.value, cy: cropY.value }
}

const onPointerMove = (e) => {
  if (!dragging || !origin) return
  const dx = (e.clientX - origin.px) / scale.value
  const dy = (e.clientY - origin.py) / scale.value
  cropX.value = Math.max(0, Math.min(maxCropX.value, origin.cx + dx))
  cropY.value = Math.max(0, Math.min(maxCropY.value, origin.cy + dy))
}

const onPointerUp = () => { dragging = false; origin = null }

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})
onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

const confirming = ref(false)

const confirm = () => {
  confirming.value = true
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const img = new Image()
  img.onload = () => {
    canvas.getContext('2d').drawImage(
      img,
      Math.round(cropX.value), Math.round(cropY.value),
      cropNat.value, cropNat.value,
      0, 0, OUTPUT_SIZE, OUTPUT_SIZE
    )
    canvas.toBlob(blob => emit('confirm', blob), 'image/jpeg', 0.82)
    confirming.value = false
  }
  img.src = props.src
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" @click.self="emit('cancel')">
    <div class="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 class="font-bold text-white text-sm">{{ t('admin.checkpoints.puzzleCropTitle') }}</h3>
        <button @click="emit('cancel')" class="text-slate-400 hover:text-white text-lg leading-none">✕</button>
      </div>

      <!-- Image with overlay -->
      <div class="flex justify-center p-4 bg-slate-900/40">
        <div
          class="relative select-none"
          :style="{ width: dispW + 'px', height: dispH + 'px' }"
        >
          <img
            :src="src"
            :width="dispW"
            :height="dispH"
            class="absolute inset-0 rounded-lg"
            style="object-fit: fill; user-select: none; -webkit-user-drag: none;"
            draggable="false"
          />
          <!-- Selection square -->
          <div
            class="absolute border-2 border-amber-400 cursor-move"
            :style="{
              left: overlay.left + 'px',
              top:  overlay.top  + 'px',
              width:  overlay.size + 'px',
              height: overlay.size + 'px',
              background: 'rgba(251,191,36,0.10)',
              boxSizing: 'border-box',
              touchAction: 'none',
            }"
            @pointerdown="onPointerDown"
          >
            <!-- Corner handles -->
            <div class="absolute -top-1 -left-1  w-2.5 h-2.5 bg-amber-400 rounded-sm" />
            <div class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-sm" />
            <div class="absolute -bottom-1 -left-1  w-2.5 h-2.5 bg-amber-400 rounded-sm" />
            <div class="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-sm" />
          </div>
        </div>
      </div>

      <p class="text-xs text-slate-400 text-center pb-2 px-4">{{ t('admin.checkpoints.puzzleCropHint') }}</p>

      <!-- Actions -->
      <div class="flex gap-3 p-4 pt-0">
        <button @click="emit('cancel')" class="btn-secondary flex-1 text-sm py-2">
          {{ t('common.cancel') }}
        </button>
        <button @click="confirm" :disabled="confirming" class="btn-primary flex-1 text-sm py-2">
          {{ confirming ? t('common.loading') : t('admin.checkpoints.puzzleCropConfirm') }}
        </button>
      </div>
    </div>
  </div>
</template>
