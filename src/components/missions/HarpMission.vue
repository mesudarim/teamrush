<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseMission from './BaseMission.vue'
import { useSound } from '@/composables/useSound'

const { t } = useI18n()
const { playCorrect, playWrong } = useSound()

const props = defineProps({
  checkpoint: { type: Object, required: true },
  question:   { type: Object, required: true },
  config:     { type: Object, default: () => ({}) },
})
const emit = defineEmits(['correct', 'wrong'])

// 7 strings: left = low pitch, right = high pitch (C major scale)
const STRINGS = [
  { freq: 261.63, color: '#ef4444' },  // C4
  { freq: 293.66, color: '#f97316' },  // D4
  { freq: 329.63, color: '#eab308' },  // E4
  { freq: 392.00, color: '#22c55e' },  // G4
  { freq: 440.00, color: '#06b6d4' },  // A4
  { freq: 523.25, color: '#3b82f6' },  // C5
  { freq: 587.33, color: '#a855f7' },  // D5
]

// SVG positions for each string (x, top attachment y, bottom y)
const STRING_POS = [
  { x: 75,  topY: 27, botY: 250 },
  { x: 104, topY: 21, botY: 250 },
  { x: 132, topY: 17, botY: 250 },
  { x: 160, topY: 16, botY: 250 },
  { x: 188, topY: 17, botY: 250 },
  { x: 216, topY: 21, botY: 250 },
  { x: 245, topY: 27, botY: 250 },
]

// 10-note melody: [C, E, G, D5, C5, A, G, E, D, C] (ascending + return)
const MELODY = [0, 2, 3, 6, 5, 4, 3, 2, 1, 0]

// Game state
const gameState = ref('idle')      // idle | playing | repeating | done
const activeIdx = ref(-1)          // string currently lit (demo or user)
const wrongIdx = ref(-1)           // string that was wrong (brief red flash)
const userSequence = ref([])

// ─── Audio ───────────────────────────────────────────────────────────────────

let audioCtx = null
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

function pluck(stringIdx) {
  const freq = STRINGS[stringIdx].freq
  const ctx = getAudio()
  const now = ctx.currentTime

  // Fundamental with triangle wave
  const osc1 = ctx.createOscillator()
  const g1 = ctx.createGain()
  osc1.connect(g1); g1.connect(ctx.destination)
  osc1.type = 'triangle'
  osc1.frequency.value = freq
  g1.gain.setValueAtTime(0, now)
  g1.gain.linearRampToValueAtTime(0.28, now + 0.009)
  g1.gain.exponentialRampToValueAtTime(0.001, now + 1.8)
  osc1.start(now); osc1.stop(now + 1.8)

  // Octave harmonic (sine, softer)
  const osc2 = ctx.createOscillator()
  const g2 = ctx.createGain()
  osc2.connect(g2); g2.connect(ctx.destination)
  osc2.type = 'sine'
  osc2.frequency.value = freq * 2
  g2.gain.setValueAtTime(0, now)
  g2.gain.linearRampToValueAtTime(0.08, now + 0.009)
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
  osc2.start(now); osc2.stop(now + 0.8)
}

// ─── Game logic ───────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const playMelody = async () => {
  if (gameState.value === 'playing') return
  gameState.value = 'playing'
  userSequence.value = []

  await sleep(200)
  for (let i = 0; i < MELODY.length; i++) {
    const idx = MELODY[i]
    pluck(idx)
    activeIdx.value = idx
    await sleep(520)
    activeIdx.value = -1
    await sleep(130)
  }
  await sleep(300)
  gameState.value = 'repeating'
}

const onStringClick = async (idx) => {
  if (gameState.value === 'playing') return

  pluck(idx)

  if (gameState.value === 'idle') {
    // Free exploration mode — just flash the string
    activeIdx.value = idx
    setTimeout(() => { activeIdx.value = -1 }, 500)
    return
  }

  if (gameState.value !== 'repeating') return

  const expected = MELODY[userSequence.value.length]

  if (idx === expected) {
    activeIdx.value = idx
    userSequence.value = [...userSequence.value, idx]
    setTimeout(() => { activeIdx.value = -1 }, 500)

    if (userSequence.value.length === MELODY.length) {
      gameState.value = 'done'
      await sleep(700)
      playCorrect()
      emit('correct')
    }
  } else {
    wrongIdx.value = idx
    setTimeout(() => { wrongIdx.value = -1; userSequence.value = [] }, 800)
    playWrong()
    emit('wrong')
  }
}

// ─── Rendering helpers ────────────────────────────────────────────────────────

const stringStyle = (idx) => {
  if (wrongIdx.value === idx) {
    return { stroke: '#ef4444', strokeWidth: '3.5', filter: 'drop-shadow(0 0 8px #ef4444)' }
  }
  if (activeIdx.value === idx) {
    return { stroke: STRINGS[idx].color, strokeWidth: '3.5', filter: `drop-shadow(0 0 8px ${STRINGS[idx].color})` }
  }
  return { stroke: '#94a3b8', strokeWidth: '1.8' }
}

// Click rect boundaries (non-overlapping, midpoints between consecutive strings)
const CLICK_ZONES = (() => {
  const midpoints = [0]  // start from left edge of SVG
  for (let i = 0; i < STRING_POS.length - 1; i++) {
    midpoints.push(Math.round((STRING_POS[i].x + STRING_POS[i + 1].x) / 2))
  }
  midpoints.push(320)   // end at right edge of SVG
  return STRING_POS.map((_, i) => ({ x: midpoints[i], width: midpoints[i + 1] - midpoints[i] }))
})()

const statusMsg = computed(() => {
  if (gameState.value === 'idle')      return t('missions.harp.statusIdle')
  if (gameState.value === 'playing')   return t('missions.harp.statusPlaying')
  if (gameState.value === 'repeating') return t('missions.harp.statusRepeat')
  return ''
})

const progressFilled = computed(() => userSequence.value.length)
</script>

<template>
  <BaseMission :checkpoint="checkpoint" :config="config" :show-title="false">
    <div class="flex flex-col items-center gap-5 select-none">

      <!-- Status message -->
      <Transition name="fade" mode="out-in">
        <p :key="gameState" class="text-center text-sm font-semibold text-amber-300 min-h-[1.25rem]">
          {{ statusMsg }}
        </p>
      </Transition>

      <!-- Progress dots (visible while repeating) -->
      <Transition name="fade">
        <div v-if="gameState === 'repeating'" class="flex items-center gap-1.5">
          <div
            v-for="(_, i) in MELODY"
            :key="i"
            :class="[
              'w-2 h-2 rounded-full transition-all duration-200',
              i < progressFilled ? 'bg-green-400 scale-110' : 'bg-slate-600'
            ]"
          />
          <span class="text-xs text-slate-400 ms-1">{{ progressFilled }}/{{ MELODY.length }}</span>
        </div>
      </Transition>

      <!-- Wrong-note flash banner -->
      <Transition name="fade">
        <div v-if="wrongIdx !== -1"
             class="text-red-400 text-xs font-bold tracking-wide">
          {{ t('missions.harp.wrongNote') }}
        </div>
      </Transition>

      <!-- ─── Harp SVG ──────────────────────────────────────────────────── -->
      <svg
        viewBox="0 0 320 285"
        xmlns="http://www.w3.org/2000/svg"
        class="w-full max-w-[260px]"
        :class="gameState === 'playing' ? 'pointer-events-none' : 'cursor-pointer'"
      >
        <!-- Glow filter -->
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <!-- ── Frame ── -->

        <!-- Left arm -->
        <path
          d="M 40,252 C 6,212 -2,148 20,84 C 32,50 52,30 72,27"
          stroke="#c9960a" stroke-width="9" fill="none" stroke-linecap="round"
        />
        <!-- Right arm -->
        <path
          d="M 280,252 C 314,212 322,148 300,84 C 288,50 268,30 248,27"
          stroke="#c9960a" stroke-width="9" fill="none" stroke-linecap="round"
        />

        <!-- Top crosspiece ornament -->
        <path
          d="M 72,27 C 100,16 130,13 160,13 C 190,13 220,16 248,27"
          stroke="#c9960a" stroke-width="7" fill="none" stroke-linecap="round"
        />
        <!-- Knobs at arm tips -->
        <circle cx="72"  cy="27" r="5" fill="#c9960a"/>
        <circle cx="248" cy="27" r="5" fill="#c9960a"/>
        <!-- Crown tip -->
        <circle cx="160" cy="12" r="4" fill="#d4a017"/>

        <!-- Bottom soundboard -->
        <path
          d="M 34,252 Q 160,272 286,252"
          stroke="#c9960a" stroke-width="11" fill="none" stroke-linecap="round"
        />
        <!-- Inner lip -->
        <path
          d="M 42,256 Q 160,275 278,256"
          stroke="#d4a017" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.45"
        />

        <!-- ── Strings ── -->
        <line
          v-for="(pos, idx) in STRING_POS"
          :key="'s' + idx"
          :x1="pos.x" :y1="pos.topY"
          :x2="pos.x" :y2="pos.botY"
          v-bind="stringStyle(idx)"
          stroke-linecap="round"
        />

        <!-- ── Click areas (transparent, wider than strings for touch) ── -->
        <rect
          v-for="(zone, idx) in CLICK_ZONES"
          :key="'c' + idx"
          :x="zone.x"
          y="10"
          :width="zone.width"
          height="248"
          fill="transparent"
          @click="onStringClick(idx)"
          @touchstart.prevent="onStringClick(idx)"
          class="cursor-pointer"
        />
      </svg>

      <!-- ─── Play button ──────────────────────────────────────────────── -->
      <Transition name="fade">
        <button
          v-if="gameState === 'idle'"
          @click="playMelody"
          class="btn-primary w-full max-w-[220px] py-3 text-sm font-bold flex items-center justify-center gap-2"
        >
          <span class="text-lg">🎵</span>
          {{ t('missions.harp.playPiece') }}
        </button>
      </Transition>

      <!-- Replay button (after first listen, let user hear again) -->
      <Transition name="fade">
        <button
          v-if="gameState === 'repeating'"
          @click="playMelody"
          class="btn-secondary py-2 px-4 text-xs font-semibold flex items-center gap-1.5"
        >
          <span>🔁</span> {{ t('missions.harp.replay') }}
        </button>
      </Transition>

    </div>
  </BaseMission>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s, transform 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
