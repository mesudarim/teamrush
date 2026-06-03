<!--
  PuzzleCropper — drag the box to move, drag corners to resize (stays square).
  Output: 500×500 JPEG blob.
  Emits: confirm(blob)  cancel()
-->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({ src: { type: String, required: true } })
const emit  = defineEmits(['confirm', 'cancel'])

const DISPLAY_MAX = 380
const OUTPUT_SIZE = 500
const MIN_CROP    = 60   // minimum selection size in natural pixels

// ── Image dimensions ──────────────────────────────────────────────────────────
const natW  = ref(1)
const natH  = ref(1)
const dispW = ref(DISPLAY_MAX)
const dispH = ref(DISPLAY_MAX)

// ── Crop state (natural pixel coords) ────────────────────────────────────────
const cropX    = ref(0)
const cropY    = ref(0)
const cropSize = ref(0)

const scale = computed(() => dispW.value / natW.value)

const ov = computed(() => ({
  left: Math.round(cropX.value    * scale.value),
  top:  Math.round(cropY.value    * scale.value),
  size: Math.round(cropSize.value * scale.value),
}))

onMounted(() => {
  const img = new Image()
  img.onload = () => {
    natW.value = img.naturalWidth
    natH.value = img.naturalHeight
    const init = Math.min(natW.value, natH.value)
    if (img.naturalWidth > DISPLAY_MAX) {
      dispW.value = DISPLAY_MAX
      dispH.value = Math.round(img.naturalHeight * DISPLAY_MAX / img.naturalWidth)
    } else {
      dispW.value = img.naturalWidth
      dispH.value = img.naturalHeight
    }
    cropSize.value = init
    cropX.value = Math.round((natW.value - init) / 2)
    cropY.value = Math.round((natH.value - init) / 2)
  }
  img.src = props.src
})

// ── Drag logic ────────────────────────────────────────────────────────────────
const containerRef = ref(null)
let dragMode = null   // 'move' | 'nw' | 'ne' | 'sw' | 'se'
let dragAnchor = null

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const mouseNat = (e) => {
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return {
    x: (e.clientX - rect.left)  / scale.value,
    y: (e.clientY - rect.top)   / scale.value,
  }
}

const onBoxDown = (e) => {
  e.preventDefault(); e.stopPropagation()
  dragMode = 'move'
  const m = mouseNat(e)
  dragAnchor = { mx: m.x, my: m.y, cx: cropX.value, cy: cropY.value }
}

const onCornerDown = (corner, e) => {
  e.preventDefault(); e.stopPropagation()
  dragMode = corner
  const ox = cropX.value, oy = cropY.value, os = cropSize.value
  // Store the FIXED anchor corner (opposite of the dragged corner)
  if (corner === 'se') dragAnchor = { ax: ox,      ay: oy      }
  if (corner === 'sw') dragAnchor = { ax: ox + os, ay: oy      }
  if (corner === 'ne') dragAnchor = { ax: ox,      ay: oy + os }
  if (corner === 'nw') dragAnchor = { ax: ox + os, ay: oy + os }
}

const onPointerMove = (e) => {
  if (!dragMode || !dragAnchor) return
  const m = mouseNat(e)

  if (dragMode === 'move') {
    const dx = m.x - dragAnchor.mx
    const dy = m.y - dragAnchor.my
    cropX.value = clamp(dragAnchor.cx + dx, 0, natW.value - cropSize.value)
    cropY.value = clamp(dragAnchor.cy + dy, 0, natH.value - cropSize.value)
    return
  }

  const { ax, ay } = dragAnchor
  let newSize, newX, newY

  if (dragMode === 'se') {
    newSize = Math.max(MIN_CROP, Math.max(m.x - ax, m.y - ay))
    newX = ax; newY = ay
  } else if (dragMode === 'sw') {
    newSize = Math.max(MIN_CROP, Math.max(ax - m.x, m.y - ay))
    newX = ax - newSize; newY = ay
  } else if (dragMode === 'ne') {
    newSize = Math.max(MIN_CROP, Math.max(m.x - ax, ay - m.y))
    newX = ax; newY = ay - newSize
  } else {  // nw
    newSize = Math.max(MIN_CROP, Math.max(ax - m.x, ay - m.y))
    newX = ax - newSize; newY = ay - newSize
  }

  // Clamp to image bounds
  newX = clamp(newX, 0, natW.value - MIN_CROP)
  newY = clamp(newY, 0, natH.value - MIN_CROP)
  newSize = Math.min(newSize, natW.value - newX, natH.value - newY)

  if (newSize >= MIN_CROP) {
    cropX.value    = Math.round(newX)
    cropY.value    = Math.round(newY)
    cropSize.value = Math.round(newSize)
  }
}

const onPointerUp = () => { dragMode = null; dragAnchor = null }

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup',   onPointerUp)
})
onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup',   onPointerUp)
})

// ── Export ────────────────────────────────────────────────────────────────────
const confirming = ref(false)

const confirm = () => {
  confirming.value = true
  const canvas = document.createElement('canvas')
  canvas.width  = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const img = new Image()
  img.onload = () => {
    canvas.getContext('2d').drawImage(
      img,
      Math.round(cropX.value), Math.round(cropY.value),
      Math.round(cropSize.value), Math.round(cropSize.value),
      0, 0, OUTPUT_SIZE, OUTPUT_SIZE
    )
    canvas.toBlob(blob => { emit('confirm', blob); confirming.value = false }, 'image/jpeg', 0.85)
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

      <!-- Image + crop UI -->
      <div class="flex justify-center p-4 bg-slate-900/40">
        <div
          ref="containerRef"
          class="relative select-none overflow-hidden rounded-lg"
          :style="{ width: dispW + 'px', height: dispH + 'px' }"
        >
          <!-- Base image -->
          <img
            :src="src" :width="dispW" :height="dispH"
            class="absolute inset-0 pointer-events-none"
            style="object-fit:fill; user-select:none; -webkit-user-drag:none;"
            draggable="false"
          />

          <!-- Dark overlay — 4 rectangles surrounding the crop square -->
          <div class="absolute bg-black/55 pointer-events-none"
               :style="{ left:0, top:0, width: dispW+'px', height: ov.top+'px' }" />
          <div class="absolute bg-black/55 pointer-events-none"
               :style="{ left:0, top: (ov.top+ov.size)+'px', width: dispW+'px', height: (dispH-ov.top-ov.size)+'px' }" />
          <div class="absolute bg-black/55 pointer-events-none"
               :style="{ left:0, top: ov.top+'px', width: ov.left+'px', height: ov.size+'px' }" />
          <div class="absolute bg-black/55 pointer-events-none"
               :style="{ left: (ov.left+ov.size)+'px', top: ov.top+'px', width: (dispW-ov.left-ov.size)+'px', height: ov.size+'px' }" />

          <!-- Crop square -->
          <div
            class="absolute border-2 border-amber-400 cursor-move"
            :style="{
              left: ov.left+'px', top: ov.top+'px',
              width: ov.size+'px', height: ov.size+'px',
              boxSizing: 'border-box', touchAction: 'none',
            }"
            @pointerdown="onBoxDown"
          >
            <!-- NW corner -->
            <div
              class="absolute bg-amber-400 rounded-sm cursor-nw-resize"
              style="top:-8px; left:-8px; width:16px; height:16px; touch-action:none;"
              @pointerdown="onCornerDown('nw', $event)"
            />
            <!-- NE corner -->
            <div
              class="absolute bg-amber-400 rounded-sm cursor-ne-resize"
              style="top:-8px; right:-8px; width:16px; height:16px; touch-action:none;"
              @pointerdown="onCornerDown('ne', $event)"
            />
            <!-- SW corner -->
            <div
              class="absolute bg-amber-400 rounded-sm cursor-sw-resize"
              style="bottom:-8px; left:-8px; width:16px; height:16px; touch-action:none;"
              @pointerdown="onCornerDown('sw', $event)"
            />
            <!-- SE corner -->
            <div
              class="absolute bg-amber-400 rounded-sm cursor-se-resize"
              style="bottom:-8px; right:-8px; width:16px; height:16px; touch-action:none;"
              @pointerdown="onCornerDown('se', $event)"
            />
          </div>
        </div>
      </div>

      <!-- Size info + hint -->
      <div class="text-center px-4 pb-1 space-y-0.5">
        <p class="text-xs text-amber-400 font-semibold tabular-nums">
          {{ cropSize }} × {{ cropSize }} px → {{ OUTPUT_SIZE }} × {{ OUTPUT_SIZE }} px
        </p>
        <p class="text-xs text-slate-500">{{ t('admin.checkpoints.puzzleCropHint') }}</p>
      </div>

      <!-- Actions -->
      <div class="flex gap-3 p-4 pt-3">
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
