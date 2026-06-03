<!--
  FreeCropper — free-form (non-square) crop tool.
  Drag the center to move, drag any corner to resize freely.
  Output: JPEG blob, max 500px wide (aspect ratio preserved).
  Emits: confirm(blob)  cancel()
-->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({ src: { type: String, required: true } })
const emit  = defineEmits(['confirm', 'cancel'])

const MAX_OUT_W = 500
const MIN_SIZE  = 20   // minimum crop dimension in natural pixels

// ── Display size (fit inside 350×420 box) ────────────────────────────────────
const natW  = ref(1), natH  = ref(1)
const dispW = ref(1), dispH = ref(1)

const containerRef = ref(null)

// ── Crop rectangle (natural pixel coords) ────────────────────────────────────
const cropX = ref(0), cropY = ref(0)
const cropW = ref(0), cropH = ref(0)

const scale = computed(() => dispW.value / natW.value)

const ov = computed(() => ({
  left:   Math.round(cropX.value * scale.value),
  top:    Math.round(cropY.value * scale.value),
  width:  Math.round(cropW.value * scale.value),
  height: Math.round(cropH.value * scale.value),
}))

onMounted(() => {
  const img = new Image()
  img.onload = () => {
    natW.value = img.naturalWidth
    natH.value = img.naturalHeight
    const s = Math.min(350 / img.naturalWidth, 420 / img.naturalHeight, 1)
    dispW.value = Math.round(img.naturalWidth  * s)
    dispH.value = Math.round(img.naturalHeight * s)
    cropX.value = 0; cropY.value = 0
    cropW.value = img.naturalWidth; cropH.value = img.naturalHeight
  }
  img.src = props.src
})

// ── Drag logic ────────────────────────────────────────────────────────────────
let dragMode   = null   // 'move' | 'nw' | 'ne' | 'sw' | 'se'
let dragAnchor = null

const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const mouseNat = (e) => {
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return { x: (e.clientX - rect.left) / scale.value, y: (e.clientY - rect.top) / scale.value }
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
  const ox = cropX.value, oy = cropY.value, ow = cropW.value, oh = cropH.value
  // anchor = opposite corner (fixed point)
  if (corner === 'nw') dragAnchor = { ax: ox + ow, ay: oy + oh }
  if (corner === 'ne') dragAnchor = { ax: ox,      ay: oy + oh }
  if (corner === 'sw') dragAnchor = { ax: ox + ow, ay: oy      }
  if (corner === 'se') dragAnchor = { ax: ox,      ay: oy      }
}

const onPointerMove = (e) => {
  if (!dragMode || !dragAnchor) return
  const m = mouseNat(e)

  if (dragMode === 'move') {
    cropX.value = clamp(dragAnchor.cx + (m.x - dragAnchor.mx), 0, natW.value - cropW.value)
    cropY.value = clamp(dragAnchor.cy + (m.y - dragAnchor.my), 0, natH.value - cropH.value)
    return
  }

  const { ax, ay } = dragAnchor
  let nx, ny, nw, nh

  if (dragMode === 'nw') {
    nx = clamp(Math.min(m.x, ax - MIN_SIZE), 0, ax - MIN_SIZE)
    ny = clamp(Math.min(m.y, ay - MIN_SIZE), 0, ay - MIN_SIZE)
    nw = ax - nx;  nh = ay - ny
  } else if (dragMode === 'ne') {
    nx = ax
    ny = clamp(Math.min(m.y, ay - MIN_SIZE), 0, ay - MIN_SIZE)
    nw = clamp(m.x - ax, MIN_SIZE, natW.value - ax)
    nh = ay - ny
  } else if (dragMode === 'sw') {
    nx = clamp(Math.min(m.x, ax - MIN_SIZE), 0, ax - MIN_SIZE)
    ny = ay
    nw = ax - nx
    nh = clamp(m.y - ay, MIN_SIZE, natH.value - ay)
  } else {  // se
    nx = ax;  ny = ay
    nw = clamp(m.x - ax, MIN_SIZE, natW.value - ax)
    nh = clamp(m.y - ay, MIN_SIZE, natH.value - ay)
  }

  if (nw >= MIN_SIZE && nh >= MIN_SIZE) {
    cropX.value = Math.round(nx); cropY.value = Math.round(ny)
    cropW.value = Math.round(nw); cropH.value = Math.round(nh)
  }
}

const onPointerUp = () => { dragMode = null; dragAnchor = null }

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})
onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

// ── Output size display ───────────────────────────────────────────────────────
const outputLabel = computed(() => {
  if (!cropW.value) return ''
  const outW = Math.min(cropW.value, MAX_OUT_W)
  const outH = Math.round(cropH.value * outW / cropW.value)
  return `${outW} × ${outH} px`
})

// ── Export ────────────────────────────────────────────────────────────────────
const confirming = ref(false)
const confirm = () => {
  confirming.value = true
  const outW = Math.min(Math.round(cropW.value), MAX_OUT_W)
  const outH = Math.round(cropH.value * outW / cropW.value)
  const canvas = document.createElement('canvas')
  canvas.width = outW; canvas.height = outH
  const img = new Image()
  img.onload = () => {
    canvas.getContext('2d').drawImage(
      img,
      Math.round(cropX.value), Math.round(cropY.value),
      Math.round(cropW.value), Math.round(cropH.value),
      0, 0, outW, outH
    )
    canvas.toBlob(blob => { emit('confirm', blob); confirming.value = false }, 'image/jpeg', 0.88)
  }
  img.src = props.src
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" @click.self="emit('cancel')">
    <div class="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 class="font-bold text-white text-sm">✂️ {{ t('admin.checkpoints.freeCropTitle') }}</h3>
        <button @click="emit('cancel')" class="text-slate-400 hover:text-white text-lg leading-none">✕</button>
      </div>

      <!-- Image + overlay -->
      <div class="flex justify-center p-4 bg-slate-900/40">
        <div
          ref="containerRef"
          class="relative select-none overflow-hidden rounded-lg"
          :style="{ width: dispW + 'px', height: dispH + 'px' }"
        >
          <img :src="src" :width="dispW" :height="dispH"
               class="absolute inset-0 pointer-events-none"
               style="object-fit:fill; user-select:none; -webkit-user-drag:none;"
               draggable="false" />

          <!-- Dark overlay — 4 rects around selection -->
          <div class="absolute bg-black/55 pointer-events-none"
               :style="{ left:0, top:0, width: dispW+'px', height: ov.top+'px' }" />
          <div class="absolute bg-black/55 pointer-events-none"
               :style="{ left:0, top:(ov.top+ov.height)+'px', width: dispW+'px', height:(dispH-ov.top-ov.height)+'px' }" />
          <div class="absolute bg-black/55 pointer-events-none"
               :style="{ left:0, top:ov.top+'px', width:ov.left+'px', height:ov.height+'px' }" />
          <div class="absolute bg-black/55 pointer-events-none"
               :style="{ left:(ov.left+ov.width)+'px', top:ov.top+'px', width:(dispW-ov.left-ov.width)+'px', height:ov.height+'px' }" />

          <!-- Crop rectangle -->
          <div
            class="absolute border-2 border-amber-400 cursor-move"
            :style="{ left:ov.left+'px', top:ov.top+'px', width:ov.width+'px', height:ov.height+'px', boxSizing:'border-box', touchAction:'none' }"
            @pointerdown="onBoxDown"
          >
            <!-- 4 corner handles -->
            <div class="absolute bg-amber-400 rounded-sm cursor-nw-resize"
                 style="top:-8px;left:-8px;width:16px;height:16px;touch-action:none;"
                 @pointerdown="onCornerDown('nw',$event)" />
            <div class="absolute bg-amber-400 rounded-sm cursor-ne-resize"
                 style="top:-8px;right:-8px;width:16px;height:16px;touch-action:none;"
                 @pointerdown="onCornerDown('ne',$event)" />
            <div class="absolute bg-amber-400 rounded-sm cursor-sw-resize"
                 style="bottom:-8px;left:-8px;width:16px;height:16px;touch-action:none;"
                 @pointerdown="onCornerDown('sw',$event)" />
            <div class="absolute bg-amber-400 rounded-sm cursor-se-resize"
                 style="bottom:-8px;right:-8px;width:16px;height:16px;touch-action:none;"
                 @pointerdown="onCornerDown('se',$event)" />
          </div>
        </div>
      </div>

      <!-- Size + hint -->
      <div class="text-center px-4 pb-1 space-y-0.5">
        <p class="text-xs text-amber-400 font-semibold tabular-nums">{{ outputLabel }}</p>
        <p class="text-xs text-slate-500">{{ t('admin.checkpoints.freeCropHint') }}</p>
      </div>

      <!-- Actions -->
      <div class="flex gap-3 p-4 pt-3">
        <button @click="emit('cancel')" class="btn-secondary flex-1 text-sm py-2">{{ t('common.cancel') }}</button>
        <button @click="confirm" :disabled="confirming" class="btn-primary flex-1 text-sm py-2">
          {{ confirming ? t('common.loading') : t('admin.checkpoints.freeCropConfirm') }}
        </button>
      </div>
    </div>
  </div>
</template>
