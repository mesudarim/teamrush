<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  value: { type: String, default: '' },
  label: { type: String, default: '' },
  title: { type: String, default: '' },
  brand: { type: String, default: '' },
})

const canvasEl = ref(null)
const QRCode   = ref(null)

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

const download = async () => {
  if (!canvasEl.value) return

  // Wait for Rubik font to be available in canvas
  await document.fonts.load('900 32px Rubik')

  const SCALE = 2          // retina
  const W = 380, H = 520   // logical px
  const BAND = 44
  const RADIUS = 18

  const c = document.createElement('canvas')
  c.width = W * SCALE
  c.height = H * SCALE
  const ctx = c.getContext('2d')
  ctx.scale(SCALE, SCALE)

  // Helper: rounded rect path
  const rRect = (x, y, w, h, r) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }

  // ── Blue gradient background ──
  const bgGrad = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.85)
  bgGrad.addColorStop(0,    '#3d72d8')
  bgGrad.addColorStop(0.35, '#1e4dbf')
  bgGrad.addColorStop(0.65, '#0e2e90')
  bgGrad.addColorStop(1,    '#071a60')
  rRect(0, 0, W, H, RADIUS)
  ctx.fillStyle = bgGrad
  ctx.fill()

  // ── Gold bands ──
  const goldTop = ctx.createLinearGradient(0, 0, 0, BAND)
  goldTop.addColorStop(0,    '#ffe84d')
  goldTop.addColorStop(0.55, '#f5a500')
  goldTop.addColorStop(1,    '#e09000')
  rRect(0, 0, W, BAND, RADIUS)
  ctx.save(); ctx.clip()
  ctx.fillStyle = goldTop; ctx.fillRect(0, 0, W, BAND)
  ctx.restore()

  const goldBot = ctx.createLinearGradient(0, H - BAND, 0, H)
  goldBot.addColorStop(0,    '#ffe84d')
  goldBot.addColorStop(0.55, '#f5a500')
  goldBot.addColorStop(1,    '#e09000')
  rRect(0, H - BAND, W, BAND, RADIUS)
  ctx.save(); ctx.clip()
  ctx.fillStyle = goldBot; ctx.fillRect(0, H - BAND, W, BAND)
  ctx.restore()

  // ── "SCAN ME" text ──
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '900 34px Rubik, Arial Black, Arial'
  ctx.fillStyle = '#ffe033'
  ctx.shadowColor  = 'rgba(100,50,0,0.7)'
  ctx.shadowOffsetY = 3
  ctx.shadowBlur    = 10
  ctx.fillText(props.title || '', W / 2, BAND + 34)
  ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0

  // ── QR code (white rounded card) ──
  const QR = 210
  const qrX = (W - QR) / 2
  const qrY = BAND + 78
  ctx.fillStyle = '#ffffff'
  rRect(qrX - 10, qrY - 10, QR + 20, QR + 20, 14)
  ctx.fill()
  ctx.drawImage(canvasEl.value, qrX, qrY, QR, QR)

  // ── Hexagon badge ──
  const BW = 190, BH = 34
  const bx = (W - BW) / 2
  const by = qrY + QR + 28
  const tip = 16

  const hexPath = (x, y, w, h, t) => {
    ctx.beginPath()
    ctx.moveTo(x + t, y)
    ctx.lineTo(x + w - t, y)
    ctx.lineTo(x + w, y + h / 2)
    ctx.lineTo(x + w - t, y + h)
    ctx.lineTo(x + t, y + h)
    ctx.lineTo(x, y + h / 2)
    ctx.closePath()
  }

  // white outer
  hexPath(bx, by, BW, BH, tip)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  // red inner
  const P = 3
  hexPath(bx + P, by + P, BW - P * 2, BH - P * 2, tip - P)
  ctx.fillStyle = '#cc0010'
  ctx.fill()

  // badge text
  ctx.font = '900 11px Rubik, Arial Black, Arial'
  ctx.fillStyle = '#ffffff'
  ctx.letterSpacing = '0.12em'
  ctx.fillText(props.brand, W / 2, by + BH / 2)
  ctx.letterSpacing = '0'

  // ── Download ──
  const link = document.createElement('a')
  link.download = `QR_${props.label || 'card'}.png`
  link.href = c.toDataURL('image/png')
  link.click()
}
</script>

<template>
  <!-- Empty state -->
  <div v-if="!value"
       class="flex items-center justify-center p-4 bg-slate-900/50 rounded-xl border border-dashed border-slate-600 text-slate-500 text-xs">
    Entrez le mot de passe pour générer le QR
  </div>

  <!-- QR card — same style as the envelope -->
  <div v-else class="flex flex-col items-center gap-3">
    <div class="qr-card relative overflow-hidden rounded-2xl w-full max-w-[220px]"
         style="box-shadow: 0 16px 48px rgba(6,24,80,0.6), 0 4px 12px rgba(0,0,0,0.4);">

      <!-- Blue gradient background -->
      <div class="absolute inset-0 qr-bg" />

      <!-- Top gold band -->
      <div class="absolute top-0 left-0 right-0 z-10 qr-gold" style="height: 40px;" />

      <!-- Bottom gold band -->
      <div class="absolute bottom-0 left-0 right-0 z-10 qr-gold" style="height: 40px;" />

      <!-- Content -->
      <div class="relative z-20 flex flex-col items-center pt-12 pb-12 px-4 gap-3">

        <!-- Top label -->
        <div v-if="title" class="text-center">
          <span class="qr-label">{{ title }}</span>
        </div>

        <!-- QR code on white background -->
        <div class="rounded-xl overflow-hidden p-2 bg-white shadow-lg">
          <canvas ref="canvasEl" class="block" />
        </div>

        <!-- Hexagon badge -->
        <div class="qr-badge-outer">
          <div class="qr-badge-inner">
            <span class="qr-badge-text">{{ brand }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Download button (outside the card) -->
    <button
      @click="download"
      class="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2 rounded-xl transition-colors"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
      Télécharger PNG
    </button>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@700;900&display=swap');

.qr-bg {
  background: radial-gradient(ellipse at 50% 35%, #3d72d8 0%, #1e4dbf 35%, #0e2e90 65%, #071a60 100%);
}
.qr-gold {
  background: linear-gradient(180deg, #ffe84d 0%, #f5a500 55%, #e09000 100%);
}
.qr-label {
  font-family: 'Rubik', 'Arial Black', Arial, sans-serif;
  font-weight: 900;
  font-size: clamp(1.1rem, 5vw, 1.5rem);
  color: #ffe033;
  line-height: 1.1;
  text-shadow: 0 2px 0 rgba(100, 50, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.5);
  text-align: center;
}

/* Hexagon badge — same as envelope */
.qr-badge-outer {
  background: #ffffff;
  clip-path: polygon(16px 0%, calc(100% - 16px) 0%, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0% 50%);
  padding: 3px;
}
.qr-badge-inner {
  background: #cc0010;
  clip-path: polygon(13px 0%, calc(100% - 13px) 0%, 100% 50%, calc(100% - 13px) 100%, 13px 100%, 0% 50%);
  padding: 4px 18px;
  min-width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-badge-text {
  font-family: 'Rubik', 'Arial Black', Arial, sans-serif;
  font-weight: 900;
  font-size: 0.65rem;
  color: #ffffff;
  letter-spacing: 0.12em;
  white-space: nowrap;
}
</style>
