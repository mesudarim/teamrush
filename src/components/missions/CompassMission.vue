<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseMission from './BaseMission.vue'

const { t, locale } = useI18n()

const props = defineProps({
  checkpoint: { type: Object, required: true },
  question:   { type: Object, required: true },
  config:     { type: Object, default: () => ({}) },
})
const emit = defineEmits(['correct', 'wrong'])

// ─── Compass ────────────────────────────────────────────────────────────────

const heading = ref(null)
const needsPermission = ref(false)
const compassUnavailable = ref(false)

// Rotate the compass FACE by -heading so N always points to physical North
// The fixed amber triangle at the top indicates where the phone is pointing
const faceRotation = computed(() =>
  heading.value !== null ? -heading.value : 0
)

const cardinal = computed(() => {
  if (heading.value === null) return ''
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(heading.value / 45) % 8]
})

// Tick marks: 36 ticks every 10°, longer at 45° multiples
const ticks = Array.from({ length: 36 }, (_, i) => {
  const deg = i * 10
  const isCardinal = deg % 90 === 0
  const isIntercardinal = deg % 45 === 0
  const rad = (deg * Math.PI) / 180
  const r1 = isCardinal ? 78 : isIntercardinal ? 80 : 84
  const r2 = 92
  return {
    x1: 100 + r1 * Math.sin(rad),
    y1: 100 - r1 * Math.cos(rad),
    x2: 100 + r2 * Math.sin(rad),
    y2: 100 - r2 * Math.cos(rad),
    isCardinal,
    isIntercardinal,
    isNorth: deg === 0,
  }
})

const handleOrientation = (e) => {
  // iOS: webkitCompassHeading is true compass heading (0=North)
  if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
    heading.value = Math.round(e.webkitCompassHeading)
  } else if (e.alpha !== null) {
    // Android / others: alpha is degrees from North counterclockwise
    // For absolute events this gives true heading; non-absolute gives arbitrary heading
    heading.value = Math.round((360 - e.alpha) % 360)
  }
}

const startListening = () => {
  window.addEventListener('deviceorientationabsolute', handleOrientation, true)
  window.addEventListener('deviceorientation', handleOrientation, true)
}

const requestCompassPermission = async () => {
  try {
    const perm = await DeviceOrientationEvent.requestPermission()
    if (perm === 'granted') {
      needsPermission.value = false
      startListening()
    }
  } catch {
    compassUnavailable.value = true
    needsPermission.value = false
  }
}

onMounted(() => {
  if (typeof DeviceOrientationEvent === 'undefined') {
    compassUnavailable.value = true
    return
  }
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS 13+ requires explicit user gesture
    needsPermission.value = true
  } else {
    startListening()
  }
})

onUnmounted(() => {
  window.removeEventListener('deviceorientationabsolute', handleOrientation, true)
  window.removeEventListener('deviceorientation', handleOrientation, true)
})

// ─── Answer ────────────────────────────────────────────────────────────────

const answer = ref('')
const wrongAttempts = ref(0)
const solved = ref(false)
const showError = ref(false)

const questionText = computed(() =>
  locale.value === 'en' && props.question.questionEn
    ? props.question.questionEn
    : props.question.question ?? ''
)

const checkAnswer = (input) => {
  const expected = (props.question.answer ?? '').trim()
  // Numeric tolerance: ±15° for degree answers
  const numExpected = Number(expected)
  if (!isNaN(numExpected) && expected !== '') {
    const numInput = Number(input.trim())
    if (!isNaN(numInput)) {
      // Handle wraparound (e.g. expected=5, input=350 → diff=15)
      const diff = Math.abs(numInput - numExpected)
      return Math.min(diff, 360 - diff) <= 15
    }
  }
  return input.trim().toLowerCase() === expected.toLowerCase()
}

const submit = () => {
  if (!answer.value.trim() || solved.value) return
  if (checkAnswer(answer.value)) {
    solved.value = true
    emit('correct')
  } else {
    wrongAttempts.value++
    showError.value = true
    answer.value = ''
    emit('wrong')
    setTimeout(() => { showError.value = false }, 1600)
  }
}
</script>

<template>
  <BaseMission :checkpoint="checkpoint" :config="config">
    <div class="space-y-5">

      <!-- Question text -->
      <div v-if="questionText" class="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-700 text-center">
        <p class="text-white font-bold text-base leading-snug">{{ questionText }}</p>
      </div>

      <!-- Compass -->
      <div class="flex flex-col items-center gap-3">

        <!-- Permission request (iOS) -->
        <button
          v-if="needsPermission"
          @click="requestCompassPermission"
          class="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-sm hover:bg-amber-500/30 transition-colors"
        >
          🧭 {{ t('missions.compassMission.activateBtn') }}
        </button>

        <!-- Unavailable -->
        <div v-else-if="compassUnavailable" class="text-slate-400 text-sm text-center">
          🧭 {{ t('missions.compassMission.unavailable') }}
        </div>

        <!-- Compass display -->
        <template v-else>
          <div class="relative w-52 h-52">
            <svg viewBox="0 0 200 200" class="w-full h-full" style="overflow: visible;">

              <!-- Background -->
              <circle cx="100" cy="100" r="96" fill="#0f172a" stroke="#334155" stroke-width="2"/>

              <!-- Rotating compass face -->
              <g :transform="`rotate(${faceRotation}, 100, 100)`" style="transition: transform 0.1s linear;">

                <!-- Tick marks -->
                <line
                  v-for="(tick, i) in ticks"
                  :key="i"
                  :x1="tick.x1" :y1="tick.y1"
                  :x2="tick.x2" :y2="tick.y2"
                  :stroke="tick.isNorth ? '#f87171' : tick.isCardinal ? '#94a3b8' : tick.isIntercardinal ? '#64748b' : '#334155'"
                  :stroke-width="tick.isCardinal ? 2 : 1"
                />

                <!-- Cardinal labels -->
                <text x="100" y="26" text-anchor="middle" font-size="15" font-weight="900" fill="#f87171" font-family="system-ui, sans-serif">N</text>
                <text x="100" y="181" text-anchor="middle" font-size="13" font-weight="700" fill="#94a3b8" font-family="system-ui, sans-serif">S</text>
                <text x="178" y="105" text-anchor="middle" font-size="13" font-weight="700" fill="#94a3b8" font-family="system-ui, sans-serif">E</text>
                <text x="22" y="105" text-anchor="middle" font-size="13" font-weight="700" fill="#94a3b8" font-family="system-ui, sans-serif">W</text>

                <!-- Intercardinal labels -->
                <text x="155" y="52" text-anchor="middle" font-size="10" fill="#475569" font-family="system-ui, sans-serif">NE</text>
                <text x="45" y="52" text-anchor="middle" font-size="10" fill="#475569" font-family="system-ui, sans-serif">NW</text>
                <text x="155" y="156" text-anchor="middle" font-size="10" fill="#475569" font-family="system-ui, sans-serif">SE</text>
                <text x="45" y="156" text-anchor="middle" font-size="10" fill="#475569" font-family="system-ui, sans-serif">SW</text>
              </g>

              <!-- Fixed phone-direction indicator (always at top = where phone points) -->
              <!-- Upper amber triangle -->
              <polygon points="100,4 93,20 107,20" fill="#f59e0b"/>
              <!-- Lower gray triangle -->
              <polygon points="100,196 93,180 107,180" fill="#475569" opacity="0.5"/>

              <!-- Center -->
              <circle cx="100" cy="100" r="5" fill="#f59e0b"/>
              <circle cx="100" cy="100" r="2.5" fill="#0f172a"/>
            </svg>
          </div>

          <!-- Heading readout -->
          <div class="text-center">
            <div class="text-4xl font-black tabular-nums leading-none" :class="heading !== null ? 'text-amber-400' : 'text-slate-600'">
              {{ heading !== null ? heading + '°' : '—' }}
            </div>
            <div class="text-sm text-slate-400 font-semibold mt-0.5">
              {{ heading !== null ? cardinal : t('missions.compassMission.heading') }}
            </div>
          </div>
        </template>
      </div>

      <!-- Success state -->
      <div v-if="solved" class="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-semibold text-sm">
        ✅ {{ t('game.stage1.correct') }}
      </div>

      <!-- Answer input -->
      <template v-else>
        <input
          v-model="answer"
          type="text"
          class="input-field text-center text-lg font-bold"
          :placeholder="t('missions.compassMission.placeholder')"
          @keyup.enter="submit"
        />

        <Transition name="feedback">
          <div v-if="showError"
               class="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold">
            ❌ {{ t('missions.compassMission.wrongAnswer') }}
            <span class="ms-auto text-xs opacity-70">−{{ checkpoint.pointsWrong ?? 50 }} pts</span>
          </div>
        </Transition>

        <div class="flex items-center gap-3">
          <button
            @click="submit"
            :disabled="!answer.trim()"
            class="btn-primary flex-1"
          >
            {{ t('missions.compassMission.submit') }}
          </button>
          <span v-if="wrongAttempts > 0" class="text-red-400 text-xs font-semibold whitespace-nowrap">
            −{{ wrongAttempts * (checkpoint.pointsWrong ?? 50) }} pts
          </span>
        </div>
      </template>
    </div>
  </BaseMission>
</template>

<style scoped>
.feedback-enter-active, .feedback-leave-active { transition: all 0.3s; }
.feedback-enter-from, .feedback-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
