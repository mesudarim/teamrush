<!--
  ImageEditor — canvas-based photo annotator.
  Tools: freehand pen, ellipse, arrow, white mask, eyedropper.
  Pen thickness: 4 sizes. Color: preset + eyedropper from image.
  Emits: confirm(blob)  cancel()
-->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({ src: { type: String, required: true } })
const emit = defineEmits(['confirm', 'cancel'])

const MAX_W = 400
const canvasRef    = ref(null)
const eyedropRef   = ref(null)  // off-screen canvas for color sampling from original image

const tool       = ref('pen')
const color      = ref('#ef4444')
const lineWidth  = ref(4)
const annotations = ref([])

// Eyedropper state
const isEyedropping  = ref(false)
const eyedropColor   = ref(null)   // color being hovered
const eyedropPos     = ref(null)   // { left, top } in canvas-element space

let prevTool = 'pen'
let img = null
let drawing = false
let startX = 0, startY = 0
let currentPath = []

// ── Canvas setup ─────────────────────────────────────────────────────────────

const initCanvas = () => {
  img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const s = Math.min(MAX_W / img.width, 1)
    const canvas = canvasRef.value
    canvas.width  = Math.round(img.width  * s)
    canvas.height = Math.round(img.height * s)

    // Off-screen canvas for clean pixel sampling (original image only)
    const ec = document.createElement('canvas')
    ec.width  = canvas.width
    ec.height = canvas.height
    ec.getContext('2d').drawImage(img, 0, 0, ec.width, ec.height)
    eyedropRef.value = ec

    redraw()
  }
  img.src = props.src
}

// ── Draw ─────────────────────────────────────────────────────────────────────

const getPos = (e) => {
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const sx = canvas.width  / rect.width
  const sy = canvas.height / rect.height
  const src = e.touches?.[0] ?? e
  return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy }
}

const redraw = (live = null) => {
  const canvas = canvasRef.value
  if (!canvas || !img) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  for (const ann of annotations.value) drawShape(ctx, ann)
  if (live) drawShape(ctx, live)
}

const drawShape = (ctx, ann) => {
  ctx.save()
  ctx.lineWidth   = ann.lw   ?? 4
  ctx.strokeStyle = ann.color ?? '#ef4444'
  ctx.fillStyle   = ann.color ?? '#ef4444'
  ctx.lineCap  = 'round'
  ctx.lineJoin = 'round'

  if (ann.type === 'pen') {
    if (!ann.pts?.length) return
    ctx.beginPath()
    ctx.moveTo(ann.pts[0].x, ann.pts[0].y)
    for (const p of ann.pts) ctx.lineTo(p.x, p.y)
    ctx.stroke()
  } else if (ann.type === 'ellipse') {
    const rx = Math.abs(ann.x2 - ann.x1) / 2
    const ry = Math.abs(ann.y2 - ann.y1) / 2
    if (rx < 2 && ry < 2) return
    ctx.beginPath()
    ctx.ellipse((ann.x1 + ann.x2) / 2, (ann.y1 + ann.y2) / 2, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (ann.type === 'arrow') {
    const dx = ann.x2 - ann.x1, dy = ann.y2 - ann.y1
    const len = Math.hypot(dx, dy)
    if (len < 8) return
    const angle = Math.atan2(dy, dx)
    const hw = Math.min(20, len * 0.4)
    ctx.beginPath()
    ctx.moveTo(ann.x1, ann.y1); ctx.lineTo(ann.x2, ann.y2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ann.x2, ann.y2)
    ctx.lineTo(ann.x2 - hw * Math.cos(angle - 0.45), ann.y2 - hw * Math.sin(angle - 0.45))
    ctx.lineTo(ann.x2 - hw * Math.cos(angle + 0.45), ann.y2 - hw * Math.sin(angle + 0.45))
    ctx.closePath(); ctx.fill()
  } else if (ann.type === 'mask') {
    const x = Math.min(ann.x1, ann.x2), y = Math.min(ann.y1, ann.y2)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, Math.abs(ann.x2 - ann.x1), Math.abs(ann.y2 - ann.y1))
  }

  ctx.restore()
}

// ── Eyedropper helpers ───────────────────────────────────────────────────────

const samplePixel = (e) => {
  if (!eyedropRef.value) return '#000000'
  const { x, y } = getPos(e)
  const px = eyedropRef.value.getContext('2d').getImageData(
    Math.max(0, Math.floor(x)), Math.max(0, Math.floor(y)), 1, 1
  ).data
  return `#${px[0].toString(16).padStart(2,'0')}${px[1].toString(16).padStart(2,'0')}${px[2].toString(16).padStart(2,'0')}`
}

const activateEyedropper = () => {
  prevTool = tool.value !== 'eyedropper' ? tool.value : prevTool
  isEyedropping.value = true
  tool.value = 'eyedropper'
}

const cancelEyedropper = () => {
  isEyedropping.value = false
  eyedropColor.value  = null
  eyedropPos.value    = null
  tool.value = prevTool
}

// ── Pointer events ───────────────────────────────────────────────────────────

const onDown = (e) => {
  e.preventDefault()
  if (tool.value === 'eyedropper') {
    color.value = samplePixel(e)
    cancelEyedropper()
    return
  }
  const { x, y } = getPos(e)
  drawing = true; startX = x; startY = y
  if (tool.value === 'pen') currentPath = [{ x, y }]
}

const onMove = (e) => {
  e.preventDefault()
  if (tool.value === 'eyedropper') {
    const { x, y } = getPos(e)
    const rect = canvasRef.value.getBoundingClientRect()
    const sx = rect.width  / canvasRef.value.width
    const sy = rect.height / canvasRef.value.height
    eyedropPos.value = { left: x * sx, top: y * sy }
    eyedropColor.value = samplePixel(e)
    return
  }
  if (!drawing) return
  const { x, y } = getPos(e)
  const lw = lineWidth.value
  if (tool.value === 'pen') {
    currentPath.push({ x, y })
    redraw({ type: 'pen', color: color.value, lw, pts: currentPath })
  } else {
    redraw({ type: tool.value, color: color.value, lw, x1: startX, y1: startY, x2: x, y2: y })
  }
}

const onUp = (e) => {
  if (tool.value === 'eyedropper') return
  e.preventDefault()
  if (!drawing) return
  drawing = false
  const { x, y } = getPos(e)
  const lw = lineWidth.value
  if (tool.value === 'pen') {
    if (currentPath.length > 1)
      annotations.value.push({ type: 'pen', color: color.value, lw, pts: [...currentPath] })
  } else {
    if (Math.abs(x - startX) > 3 || Math.abs(y - startY) > 3)
      annotations.value.push({ type: tool.value, color: color.value, lw, x1: startX, y1: startY, x2: x, y2: y })
  }
  redraw()
}

const undo     = () => { annotations.value.pop(); redraw() }
const clearAll = () => { annotations.value = []; redraw() }

// ── Export ───────────────────────────────────────────────────────────────────

const confirming = ref(false)
const confirm = () => {
  confirming.value = true
  canvasRef.value.toBlob(blob => {
    confirming.value = false
    emit('confirm', blob)
  }, 'image/jpeg', 0.9)
}

onMounted(() => {
  initCanvas()
  window.addEventListener('pointerup', onUp)
})
onUnmounted(() => {
  window.removeEventListener('pointerup', onUp)
})

const PRESETS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#000000']
const SIZES   = [2, 4, 8, 14]
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/85 flex flex-col" @click.self="emit('cancel')">

    <!-- ── Toolbar ── -->
    <div class="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-700 overflow-x-auto shrink-0 flex-wrap gap-y-2">

      <!-- Drawing tools -->
      <div class="flex gap-1 shrink-0">
        <button
          v-for="(label, key) in { pen: '✏️', ellipse: '⭕', arrow: '➡️', mask: '⬜' }"
          :key="key"
          @click="tool = key; isEyedropping = false"
          :class="['w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors',
            tool === key && !isEyedropping ? 'bg-amber-500/30 ring-2 ring-amber-400' : 'bg-slate-700 hover:bg-slate-600']"
          :title="key"
        >{{ label }}</button>
      </div>

      <div class="w-px h-7 bg-slate-700 shrink-0" />

      <!-- Pen thickness -->
      <div class="flex items-center gap-1 shrink-0">
        <button
          v-for="lw in SIZES"
          :key="lw"
          @click="lineWidth = lw"
          :class="['w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
            lineWidth === lw ? 'bg-amber-500/30 ring-2 ring-amber-400' : 'bg-slate-700 hover:bg-slate-600']"
          :title="`${lw}px`"
        >
          <div
            class="rounded-full"
            :style="{
              width:  Math.min(lw * 2.2, 22) + 'px',
              height: Math.min(lw * 2.2, 22) + 'px',
              background: color,
              outline: '1.5px solid rgba(255,255,255,0.3)'
            }"
          />
        </button>
      </div>

      <div class="w-px h-7 bg-slate-700 shrink-0" />

      <!-- Preset colors -->
      <div class="flex gap-1.5 shrink-0">
        <button
          v-for="c in PRESETS"
          :key="c"
          @click="color = c"
          :class="['w-7 h-7 rounded-full border-2 transition-transform',
            color === c && !isEyedropping ? 'scale-125 border-amber-400' : 'border-slate-600 hover:scale-110']"
          :style="{ background: c }"
        />
      </div>

      <!-- Eyedropper -->
      <button
        @click="activateEyedropper"
        :class="['w-9 h-9 rounded-lg flex items-center justify-center transition-colors text-sm font-bold shrink-0',
          isEyedropping ? 'bg-amber-500/30 ring-2 ring-amber-400' : 'bg-slate-700 hover:bg-slate-600']"
        title="Pipette — choisir une couleur de l'image"
      >
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 3L6 6l-2 5 1 1 5-2 3-3-4-4z"/>
          <path d="M6 6l4 4"/>
          <circle cx="19" cy="19" r="2"/>
          <path d="M10 10l7 7"/>
        </svg>
      </button>

      <!-- Active color indicator -->
      <div class="flex items-center gap-1.5 shrink-0 ms-1">
        <div class="w-6 h-6 rounded-full border-2 border-slate-500 shadow"
             :style="{ background: isEyedropping && eyedropColor ? eyedropColor : color }" />
        <span class="text-xs text-slate-400 font-mono">{{ isEyedropping && eyedropColor ? eyedropColor : color }}</span>
      </div>

      <div class="w-px h-7 bg-slate-700 shrink-0" />

      <!-- Undo / Clear -->
      <button @click="undo"     class="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm flex items-center justify-center" title="Undo">↩</button>
      <button @click="clearAll" class="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-red-400 text-sm flex items-center justify-center" title="Clear">🗑</button>

      <!-- Eyedropper hint -->
      <span v-if="isEyedropping" class="text-xs text-amber-400 font-semibold animate-pulse shrink-0 ms-2">
        Cliquez sur l'image pour choisir une couleur · <button @click="cancelEyedropper" class="underline hover:text-amber-200">Annuler</button>
      </span>
      <span v-else class="ms-auto text-xs text-slate-500 shrink-0 hidden sm:block">
        ⬜ = masque blanc
      </span>
    </div>

    <!-- ── Canvas area ── -->
    <div class="flex-1 overflow-auto flex items-center justify-center p-3 bg-slate-950">
      <div class="relative inline-block">
        <canvas
          ref="canvasRef"
          class="max-w-full rounded-lg shadow-2xl"
          :class="isEyedropping ? 'cursor-crosshair' : 'cursor-crosshair'"
          style="touch-action: none;"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerleave="isEyedropping && (eyedropColor = null, eyedropPos = null)"
        />

        <!-- Eyedropper preview bubble -->
        <div
          v-if="isEyedropping && eyedropColor && eyedropPos"
          class="absolute pointer-events-none z-10"
          :style="{ left: (eyedropPos.left + 12) + 'px', top: (eyedropPos.top - 44) + 'px' }"
        >
          <div class="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-xl px-2 py-1.5 shadow-2xl">
            <div class="w-6 h-6 rounded-full border-2 border-white shadow"
                 :style="{ background: eyedropColor }" />
            <span class="text-xs font-mono text-white">{{ eyedropColor }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Footer ── -->
    <div class="flex gap-3 px-4 py-3 bg-slate-900 border-t border-slate-700 shrink-0">
      <button @click="emit('cancel')" class="btn-secondary flex-1 text-sm py-2.5">
        {{ t('common.cancel') }}
      </button>
      <button @click="confirm" :disabled="confirming" class="btn-primary flex-1 text-sm py-2.5">
        {{ confirming ? t('common.loading') : t('admin.checkpoints.missingWordEditorConfirm') }}
      </button>
    </div>
  </div>
</template>
