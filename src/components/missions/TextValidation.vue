<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseMission from './BaseMission.vue'

const { t, locale } = useI18n()

const props = defineProps({
  checkpoint: { type: Object, required: true },
  question:   { type: Object, required: true },
  config:     { type: Object, default: () => ({}) },
})
const emit = defineEmits(['correct', 'wrong'])

const answer = ref('')
const wrongAttempts = ref(0)
const solved = ref(false)
const showError = ref(false)

const questionText = computed(() =>
  locale.value === 'en' && props.question.questionEn
    ? props.question.questionEn
    : props.question.question ?? ''
)

const submit = () => {
  if (!answer.value.trim() || solved.value) return
  const correct = answer.value.trim().toLowerCase() === (props.question.answer ?? '').trim().toLowerCase()
  if (correct) {
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
    <div class="space-y-4">

      <!-- Question text -->
      <div v-if="questionText" class="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-700 text-center">
        <p class="text-white font-bold text-base leading-snug">{{ questionText }}</p>
      </div>

      <!-- Success state -->
      <div v-if="solved" class="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-semibold text-sm">
        ✅ {{ t('game.stage1.correct') }}
      </div>

      <!-- Input (hidden once solved) -->
      <template v-else>
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
            ❌ Mauvaise réponse — essayez encore
            <span class="ms-auto text-xs opacity-70">−{{ checkpoint.pointsWrong ?? 50 }} pts</span>
          </div>
        </Transition>

        <div class="flex items-center gap-3">
          <button
            @click="submit"
            :disabled="!answer.trim()"
            class="btn-primary flex-1"
          >
            {{ t('missions.textValidation.submit') }}
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
