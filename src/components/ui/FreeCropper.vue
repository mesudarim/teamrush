<!--
  FreeCropper — crop tool with optional locked aspect ratio.
  When aspectRatio is set (e.g. 4/3), corners maintain that ratio.
  Emits: confirm(blob)  cancel()
-->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  src:         { type: String, required: true },
  aspectRatio: { type: Number, default: null },   // e.g. 4/3 — null = free
})
const emit = defineEmits(['confirm', 'cancel'])

const MAX_OUT_W = 400
const MIN_SIZE  = 20

const natW  = ref(1), natH  = ref(1)
const dispW = ref(1), dispH = ref(1)
const containerRef = ref(null)

const cropX = ref(0), cropY = ref(0)
const cropW = ref(0), cropH = ref(0)

const scale = computed(() => dispW.value / natW.value)

const ov = computed(() => ({
  left:   Math.round(cropX.value * scale.value),
  top:    Math.round(cropY.value * scale.value),
  width:  Math.round(cropW.value * scale.value),
  height: Math.round(cropH.value * scale.value),
}))

// ── Init ─────────────────────────────────────────────────────────────────────

const initCrop = (imgW, imgH) => {
  const ratio = props.aspectRatio
  if (ratio) {
    let cw, ch
    if (imgW / imgH > ratio) { ch = imgH; cw = Math.round(ch * ratio) }
    else                      { cw = imgW; ch = Math.round(cw / ratio) }
    cropX.value = Math.round((imgW - cw) / 2)
    cropY.value = Math.round((imgH - ch) / 2)
    cropW.value = cw; cropH.value = ch
  } else {
    cropX.value = 0; cropY.value = 0
    cropW.value = imgW; cropH.value = imgH
  }
}

onMounted(() => {
  const img = new Image()
  img.onload = () => {
    natW.value = img.naturalWidth
    natH.value = img.naturalHeight
    const s = Math.min(350 / img.naturalWidth, 420 / img.naturalHeight, 1)
    dispW.value = Math.round(img.naturalWidth  * s)
    dispH.value = Math.round(img.naturalHeight * s)
    initCrop(img.naturalWidth, img.naturalHeight)
  }
  img.src = props.src
})

// ── Drag ─────────────────────────────────────────────────────────────────────

let dragMode = null
let dragAnchor = null

const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const mouseNat = (e) => {
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  const src = e.touches?.[0] ?? e
  return {
    x: (src.clientX - rect.left) / scale.value,
    y: (src.clientY - rect.top)  / scale.value,
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
  const ox = cropX.value, oy = cropY.value, ow = cropW.value, oh = cropH.value
  if (corner === 'nw') dragAnchor = { ax: ox + ow, ay: oy + oh }
  if (corner === 'ne') dragAnchor = { ax: ox,      ay: oy + oh }
  if (corner === 'sw') dragAnchor = { ax: ox + ow, ay: oy      }
  if (corner === 'se') dragAnchor = { ax: ox,      ay: oy      }
}

const onPointerMove = (e) => {
  if (!dragMode || !dragAnchor) return
  const m = mouseNat(e)
  const ratio = props.aspectRatio
  const W = natW.value, H = natH.value

  if (dragMode === 'move') {
    cropX.value = clamp(dragAnchor.cx + (m.x - dragAnchor.mx), 0, W - cropW.value)
    cropY.value = clamp(dragAnchor.cy + (m.y - dragAnchor.my), 0, H - cropH.value)
    return
  }

  const { ax, ay } = dragAnchor
  let nx = 0, ny = 0, nw = MIN_SIZE, nh = MIN_SIZE

  if (ratio) {
    // ── Ratio-locked: width from x-movement, height = width / ratio ─────────
    // Height clamped to image bounds → re-derive width if needed.

    if (dragMode === 'nw') {                     // anchor: bottom-right
      nw = clamp(ax - m.x, MIN_SIZE, ax)
      nh = nw / ratio
      if (ay - nh < 0) { nh = ay; nw = nh * ratio }
      nx = ax - nw; ny = ay - nh

    } else if (dragMode === 'ne') {              // anchor: bottom-left
      nw = clamp(m.x - ax, MIN_SIZE, W - ax)
      nh = nw / ratio
      if (ay - nh < 0) { nh = ay; nw = nh * ratio }
      nx = ax; ny = ay - nh

    } else if (dragMode === 'sw') {              // anchor: top-right
      nw = clamp(ax - m.x, MIN_SIZE, ax)
      nh = nw / ratio
      if (ay + nh > H) { nh = H - ay; nw = nh * ratio }
      nx = ax - nw; ny = ay

    } else {                                     // se — anchor: top-left
      nw = clamp(m.x - ax, MIN_SIZE, W - ax)
      nh = nw / ratio
      if (ay + nh > H) { nh = H - ay; nw = nh * ratio }
      nx = ax; ny = ay
    }

  } else {
    // ── Free mode ────────────────────────────────────────────────────────────
    if (dragMode === 'nw') {
      nx = clamp(m.x, 0, ax - MIN_SIZE); ny = clamp(m.y, 0, ay - MIN_SIZE)
      nw = ax - nx; nh = ay - ny
    } else if (dragMode === 'ne') {
      nx = ax;  ny = clamp(m.y, 0, ay - MIN_SIZE)
      nw = clamp(m.x - ax, MIN_SIZE, W - ax); nh = ay - ny
    } else if (dragMode === 'sw') {
      nx = clamp(m.x, 0, ax - MIN_SIZE); ny = ay
      nw = ax - nx; nh = clamp(m.y - ay, MIN_SIZE, H - ay)
    } else {
      nx = ax; ny = ay
      nw = clamp(m.x - ax, MIN_SIZE, W - ax); nh = clamp(m.y - ay, MIN_SIZE, H - ay)
    }
  }

  nx = Math.round(Math.max(0, nx))
  ny = Math.round(Math.max(0, ny))
  nw = Math.round(Math.max(MIN_SIZE, nw))
  nh = Math.round(Math.max(MIN_SIZE, nh))

  if (nx + nw <= W && ny + nh <= H) {
    cropX.value = nx; cropY.value = ny
    cropW.value = nw; cropH.value = nh
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

// ── Output label ─────────────────────────────────────────────────────────────

const outputLabel = computed(() => {
  if (!cropW.value) return ''
  const outW = Math.min(cropW.value, MAX_OUT_W)
  const outH = Math.round(cropH.value * outW / cropW.value)
  return `${outW} × ${outH} px`
})

// ── Export ───────────────────────────────────────────────────────────────────

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
    canvas.toBlob(blob => { emit('confirm', blob); confirming.value = false }, 'image/jpeg', 0.9)
  }
  img.src = props.src
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" @click.self="emit('cancel')">
    <div class="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div class="flex items-center gap-2">
          <h3 class="font-bold text-white text-sm">✂️ {{ t('admin.checkpoints.freeCropTitle') }}</h3>
          <span v-if="aspectRatio" class="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
            4:3 verrouillé
          </span>
        </div>
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

          <!-- Dark overlay around selection -->
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
            <!-- Grid lines -->
            <div class="absolute inset-0 pointer-events-none" style="background: repeating-linear-gradient(0deg,transparent,transparent calc(33.3% - 0.5px),rgba(255,200,50,0.25) calc(33.3% - 0.5px),rgba(255,200,50,0.25) 33.3%) , repeating-linear-gradient(90deg,transparent,transparent calc(33.3% - 0.5px),rgba(255,200,50,0.25) calc(33.3% - 0.5px),rgba(255,200,50,0.25) 33.3%)" />
            <!-- Corners -->
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

      <!-- Size info -->
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
