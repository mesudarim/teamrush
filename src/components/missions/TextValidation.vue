<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseMission from './BaseMission.vue'
import { useGameStore } from '@/stores/game'

const { t, locale } = useI18n()
const game = useGameStore()

const props = defineProps({
  checkpoint: { type: Object, required: true },
  question:   { type: Object, required: true },
  config:     { type: Object, default: () => ({}) },
})
const emit = defineEmits(['correct', 'wrong'])

const answer      = ref('')
const wrongAttempts = ref(0)
const solved      = ref(false)
const showError   = ref(false)
const bonusEarned = ref(0)

// ── Question text ─────────────────────────────────────────────────────────────

const questionText = computed(() =>
  locale.value === 'en' && props.question.questionEn
    ? props.question.questionEn
    : props.question.question ?? ''
)

// ── Multi-answer matching ──────────────────────────────────────────────────────

const clean = s => s.trim().toLowerCase()

const checkAnswer = (input) => {
  const val = clean(input)
  // Choose answer pool based on locale (EN fallback to HE if empty)
  const enPool = (props.question.answerEn ?? '').split(',').map(clean).filter(Boolean)
  const hePool = (props.question.answer   ?? '').split(',').map(clean).filter(Boolean)
  const pool   = (locale.value === 'en' && enPool.length) ? enPool : hePool
  return pool.includes(val)
}

// ── Timer ─────────────────────────────────────────────────────────────────────

const timerEnabled  = computed(() => !!(props.question.timerEnabled && props.question.timerSeconds > 0))
const timerTotal    = computed(() => props.question.timerSeconds ?? 60)
const remaining     = ref(0)
const missionStarted = ref(false)   // false = pre-start screen shown

let interval = null

const startTimer = () => {
  remaining.value = timerTotal.value
  interval = setInterval(() => {
    if (remaining.value > 0) remaining.value--
  }, 1000)
}

const stopTimer = () => {
  if (interval) { clearInterval(interval); interval = null }
}

const startMission = () => {
  missionStarted.value = true
  startTimer()
}

onMounted(() => {
  // Non-timed missions start immediately; timed missions wait for user click
  if (!timerEnabled.value) missionStarted.value = true
})
onUnmounted(() => stopTimer())

// Duration display for pre-start screen
const totalDisplay = computed(() => {
  const total = timerTotal.value
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}min`
  return `${m}min ${s}s`
})

const timerDisplay = computed(() => {
  const m = Math.floor(remaining.value / 60)
  const s = remaining.value % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

const timerRatio = computed(() => timerTotal.value > 0 ? remaining.value / timerTotal.value : 1)

const timerColor = computed(() => {
  if (timerRatio.value > 0.5) return 'text-green-400'
  if (timerRatio.value > 0.2) return 'text-amber-400'
  return 'text-red-400 animate-pulse'
})

// ── Coin sound ────────────────────────────────────────────────────────────────

let audioCtx = null
const getAudio = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

const playCoinSound = () => {
  const ctx = getAudio()
  const freqs = [880, 1046, 1318, 1568]
  freqs.forEach((freq, i) => {
    const delay = i * 0.11
    const now = ctx.currentTime + delay
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 0.12)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.22, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    osc.start(now); osc.stop(now + 0.3)
  })
}

// ── Submit ────────────────────────────────────────────────────────────────────

const submit = async () => {
  if (!answer.value.trim() || solved.value) return

  if (checkAnswer(answer.value)) {
    solved.value = true
    stopTimer()

    // Award time bonus
    if (timerEnabled.value && remaining.value > 0) {
      bonusEarned.value = remaining.value
      playCoinSound()
      await game.awardBonus(remaining.value)
    }

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
    <div class="space-y-4">

      <!-- ── Pre-start screen (timed missions only) ── -->
      <Transition name="fade" mode="out-in">
        <div v-if="timerEnabled && !missionStarted" key="prestart" class="text-center space-y-5 py-2">
          <div class="text-5xl">⏱</div>
          <div>
            <h3 class="font-bold text-white text-lg mb-1" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">{{ t('missions.textValidation.timedTitle') }}</h3>
            <p class="text-slate-300 text-sm leading-relaxed">{{ t('missions.textValidation.timedBody') }}</p>
          </div>
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-base">
            ⏳ {{ totalDisplay }}
          </div>
          <button @click="startMission" class="btn-primary w-full py-4 text-base font-black">
            {{ t('missions.textValidation.startBtn') }}
          </button>
        </div>

        <!-- ── Active mission ── -->
        <div v-else key="active" class="space-y-4">

      <!-- ── Timer ── -->
      <Transition name="fade">
        <div v-if="timerEnabled && !solved" class="text-center">
          <div :class="['font-black tabular-nums leading-none transition-colors', timerColor]"
               style="font-size: clamp(3rem, 15vw, 5rem);">
            {{ timerDisplay }}
          </div>
          <p v-if="remaining > 0" class="text-xs text-slate-400 mt-1">
            {{ t('missions.textValidation.timerHint', { n: remaining }) }}
          </p>
          <p v-else class="text-xs text-red-400 font-semibold mt-1">
            {{ t('missions.textValidation.timerExpired') }}
          </p>
          <!-- Progress bar -->
          <div class="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-1000"
              :class="timerRatio > 0.5 ? 'bg-green-400' : timerRatio > 0.2 ? 'bg-amber-400' : 'bg-red-400'"
              :style="{ width: (timerRatio * 100) + '%' }"
            />
          </div>
        </div>
      </Transition>

      <!-- Question text -->
      <div v-if="questionText" class="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-700 text-center">
        <p class="text-white font-bold text-base leading-snug">{{ questionText }}</p>
      </div>

      <!-- Bonus earned celebration -->
      <Transition name="feedback">
        <div v-if="bonusEarned > 0 && solved"
             class="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-sm">
          ⚡ {{ t('missions.textValidation.timerBonus', { n: bonusEarned }) }}
        </div>
      </Transition>

      <!-- Success state -->
      <div v-if="solved && !bonusEarned"
           class="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-semibold text-sm">
        ✅ {{ t('game.stage1.correct') }}
      </div>

      <!-- Input (hidden once solved) -->
      <template v-else-if="!solved">
        <textarea
          v-model="answer"
          rows="3"
          class="input-field resize-none"
          :placeholder="t('missions.textValidation.placeholder')"
          @keyup.ctrl.enter="submit"
        />

        <Transition name="feedback">
          <div v-if="showError"
               class="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold">
            ❌ {{ t('missions.textValidation.wrong') }}
            <span class="ms-auto text-xs opacity-70">−{{ checkpoint.pointsWrong ?? 1 }} pts</span>
          </div>
        </Transition>

        <div class="flex items-center gap-3">
          <button @click="submit" :disabled="!answer.trim()" class="btn-primary flex-1">
            {{ t('missions.textValidation.submit') }}
          </button>
          <span v-if="wrongAttempts > 0" class="text-red-400 text-xs font-semibold whitespace-nowrap">
            −{{ wrongAttempts * (checkpoint.pointsWrong ?? 1) }} pts
          </span>
        </div>
      </template>

        </div><!-- end active mission div -->
      </Transition><!-- end pre-start / active transition -->

    </div>
  </BaseMission>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active   { transition: all 0.3s; }
.fade-enter-from, .fade-leave-to         { opacity: 0; transform: translateY(-6px); }
.feedback-enter-active, .feedback-leave-active { transition: all 0.3s; }
.feedback-enter-from, .feedback-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
