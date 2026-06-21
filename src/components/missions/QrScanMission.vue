<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseMission from './BaseMission.vue'
import QrScanner from '@/components/ui/QrScanner.vue'
import { useSound } from '@/composables/useSound'

const { t, locale } = useI18n()
const { playCorrect, playWrong } = useSound()

const props = defineProps({
  checkpoint: { type: Object, required: true },
  question:   { type: Object, required: true },
  config:     { type: Object, default: () => ({}) },
})
const emit = defineEmits(['correct', 'wrong'])

const showScanner = ref(false)
const scanned     = ref(false)
const scanOk      = ref(false)
const solved      = ref(false)

const clean = s => s.trim().toLowerCase()

const checkAnswer = (value) => {
  const hePool = (props.question.answer   ?? '').split(',').map(clean).filter(Boolean)
  const enPool = (props.question.answerEn ?? '').split(',').map(clean).filter(Boolean)
  // Accept any match from either pool — QR value is language-neutral
  return [...hePool, ...enPool].includes(clean(value))
}

const onQrDecoded = (value) => {
  showScanner.value = false
  const ok = checkAnswer(value)
  scanned.value = true
  scanOk.value = ok
  if (ok) {
    solved.value = true
    playCorrect()
    emit('correct', 0)
  } else {
    playWrong()
    emit('wrong')
    setTimeout(() => { scanned.value = false }, 2200)
  }
}
</script>

<template>
  <BaseMission :checkpoint="checkpoint" :config="config" :show-title="false">

    <!-- Question text -->
    <div v-if="question.question || question.questionEn"
         class="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-700 text-center">
      <p class="text-white font-bold text-base leading-snug whitespace-pre-line">
        {{ (locale === 'en' && question.questionEn) ? question.questionEn : question.question }}
      </p>
    </div>

    <!-- Feedback after scan -->
    <Transition name="feedback">
      <div v-if="scanned"
           :class="['flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold',
             scanOk
               ? 'bg-green-500/15 border border-green-500/30 text-green-400'
               : 'bg-red-500/15 border border-red-500/30 text-red-400']">
        {{ scanOk ? '✅ ' + t('missions.qrScan.correct') : '❌ ' + t('missions.qrScan.wrong') }}
      </div>
    </Transition>

    <!-- Solved state -->
    <div v-if="solved"
         class="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-semibold text-sm">
      ✅ {{ t('missions.qrScan.correct') }}
    </div>

    <!-- Scan button -->
    <button
      v-if="!solved"
      @click="showScanner = true"
      class="btn-primary w-full py-5 flex items-center justify-center gap-3 text-base"
    >
      <svg class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
      </svg>
      {{ t('missions.qrScan.scanBtn') }}
    </button>

    <p v-if="!solved" class="text-center text-xs text-slate-500">{{ t('missions.qrScan.scanHint') }}</p>

    <!-- QR Scanner overlay -->
    <QrScanner v-if="showScanner" @decoded="onQrDecoded" @close="showScanner = false" />

  </BaseMission>
</template>

<style scoped>
.feedback-enter-active, .feedback-leave-active { transition: all 0.3s; }
.feedback-enter-from, .feedback-leave-to { opacity: 0; transform: translateY(-5px); }
</style>
