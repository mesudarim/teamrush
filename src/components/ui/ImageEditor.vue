<!--
  ImageEditor — canvas-based photo annotator.
  Admin can draw on the image before using it as a clue.
  Tools: freehand pen, ellipse (circle), arrow, white mask (hide area).
  Emits: confirm(blob)  cancel()
-->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({ src: { type: String, required: true } })
const emit = defineEmits(['confirm', 'cancel'])

const MAX_W = 900
const canvasRef = ref(null)

const tool  = ref('pen')       // 'pen' | 'ellipse' | 'arrow' | 'mask'
const color = ref('#ef4444')   // active stroke color
const annotations = ref([])    // committed shapes for undo

let img = null
let drawing = false
let startX = 0, startY = 0
let currentPath = []           // for pen tool

// ── Canvas setup ────────────────────────────────────────────────────────────

const initCanvas = () => {
  img = new Image()
  img.onload = () => {
    const scale = Math.min(MAX_W / img.width, 1)
    const canvas = canvasRef.value
    canvas.width  = Math.round(img.width  * scale)
    canvas.height = Math.round(img.height * scale)
    redraw()
  }
  img.src = props.src
}

// ── Drawing helpers ──────────────────────────────────────────────────────────

const getPos = (e) => {
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const sx = canvas.width  / rect.width
  const sy = canvas.height / rect.height
  const src = e.touches?.[0] ?? e
  return {
    x: (src.clientX - rect.left) * sx,
    y: (src.clientY - rect.top)  * sy,
  }
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
  ctx.lineWidth   = ann.lw ?? 4
  ctx.strokeStyle = ann.color ?? '#ef4444'
  ctx.fillStyle   = ann.color ?? '#ef4444'
  ctx.lineCap     = 'round'
  ctx.lineJoin    = 'round'

  if (ann.type === 'pen') {
    if (!ann.pts?.length) return
    ctx.beginPath()
    ctx.moveTo(ann.pts[0].x, ann.pts[0].y)
    for (const p of ann.pts) ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  else if (ann.type === 'ellipse') {
    const rx = Math.abs(ann.x2 - ann.x1) / 2
    const ry = Math.abs(ann.y2 - ann.y1) / 2
    if (rx < 2 && ry < 2) return
    const cx = (ann.x1 + ann.x2) / 2
    const cy = (ann.y1 + ann.y2) / 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  else if (ann.type === 'arrow') {
    const dx = ann.x2 - ann.x1, dy = ann.y2 - ann.y1
    const len = Math.hypot(dx, dy)
    if (len < 8) return
    const angle = Math.atan2(dy, dx)
    const hw = Math.min(20, len * 0.4)
    ctx.beginPath()
    ctx.moveTo(ann.x1, ann.y1)
    ctx.lineTo(ann.x2, ann.y2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ann.x2, ann.y2)
    ctx.lineTo(ann.x2 - hw * Math.cos(angle - 0.45), ann.y2 - hw * Math.sin(angle - 0.45))
    ctx.lineTo(ann.x2 - hw * Math.cos(angle + 0.45), ann.y2 - hw * Math.sin(angle + 0.45))
    ctx.closePath()
    ctx.fill()
  }

  else if (ann.type === 'mask') {
    const x = Math.min(ann.x1, ann.x2)
    const y = Math.min(ann.y1, ann.y2)
    const w = Math.abs(ann.x2 - ann.x1)
    const h = Math.abs(ann.y2 - ann.y1)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, w, h)
  }

  ctx.restore()
}

// ── Pointer events ───────────────────────────────────────────────────────────

const onDown = (e) => {
  e.preventDefault()
  const { x, y } = getPos(e)
  drawing = true; startX = x; startY = y
  if (tool.value === 'pen') currentPath = [{ x, y }]
}

const onMove = (e) => {
  e.preventDefault()
  if (!drawing) return
  const { x, y } = getPos(e)
  if (tool.value === 'pen') {
    currentPath.push({ x, y })
    redraw({ type: 'pen', color: color.value, lw: 4, pts: currentPath })
  } else {
    redraw({ type: tool.value, color: color.value, lw: 4, x1: startX, y1: startY, x2: x, y2: y })
  }
}

const onUp = (e) => {
  e.preventDefault()
  if (!drawing) return
  drawing = false
  const { x, y } = getPos(e)
  if (tool.value === 'pen') {
    if (currentPath.length > 1)
      annotations.value.push({ type: 'pen', color: color.value, lw: 4, pts: [...currentPath] })
  } else {
    const dx = Math.abs(x - startX), dy = Math.abs(y - startY)
    if (dx > 3 || dy > 3)
      annotations.value.push({ type: tool.value, color: color.value, lw: 4, x1: startX, y1: startY, x2: x, y2: y })
  }
  redraw()
}

const undo = () => { annotations.value.pop(); redraw() }
const clearAll = () => { annotations.value = []; redraw() }

// ── Export ───────────────────────────────────────────────────────────────────

const confirming = ref(false)
const confirm = () => {
  confirming.value = true
  canvasRef.value.toBlob(blob => {
    confirming.value = false
    emit('confirm', blob)
  }, 'image/jpeg', 0.88)
}

onMounted(() => {
  initCanvas()
  window.addEventListener('pointerup', onUp)
})
onUnmounted(() => {
  window.removeEventListener('pointerup', onUp)
})
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/85 flex flex-col" @click.self="emit('cancel')">

    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-700 overflow-x-auto shrink-0">

      <!-- Tools -->
      <div class="flex gap-1 shrink-0">
        <button
          v-for="(label, key) in { pen: '✏️', ellipse: '⭕', arrow: '➡️', mask: '⬜' }"
          :key="key"
          @click="tool = key"
          :title="key"
          :class="['w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors', tool === key ? 'bg-amber-500/30 ring-2 ring-amber-400' : 'bg-slate-700 hover:bg-slate-600']"
        >{{ label }}</button>
      </div>

      <div class="w-px h-7 bg-slate-700 shrink-0" />

      <!-- Colors -->
      <div class="flex gap-1.5 shrink-0">
        <button
          v-for="c in ['#ef4444','#fbbf24','#22c55e','#3b82f6','#ffffff','#000000']"
          :key="c"
          @click="color = c"
          :class="['w-7 h-7 rounded-full border-2 transition-transform', color === c ? 'scale-125 border-amber-400' : 'border-slate-600']"
          :style="{ background: c }"
        />
      </div>

      <div class="w-px h-7 bg-slate-700 shrink-0" />

      <!-- Undo / Clear -->
      <button @click="undo" class="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm flex items-center justify-center" title="Undo">↩</button>
      <button @click="clearAll" class="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-red-400 text-sm flex items-center justify-center" title="Clear all">🗑</button>

      <div class="ms-auto text-xs text-slate-500 shrink-0 hidden sm:block">
        ⬜ = masque blanc (cache la réponse)
      </div>
    </div>

    <!-- Canvas area -->
    <div class="flex-1 overflow-auto flex items-center justify-center p-3 bg-slate-950">
      <canvas
        ref="canvasRef"
        class="max-w-full rounded-lg shadow-2xl cursor-crosshair"
        style="touch-action: none;"
        @pointerdown="onDown"
        @pointermove="onMove"
      />
    </div>

    <!-- Footer -->
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
