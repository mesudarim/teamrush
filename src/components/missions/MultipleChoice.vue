<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseMission from './BaseMission.vue'

const { locale } = useI18n()

const props = defineProps({
  checkpoint: { type: Object, required: true },
  question:   { type: Object, required: true },
  config:     { type: Object, default: () => ({}) },
})
const emit = defineEmits(['correct', 'wrong'])

const wrongIndices = ref(new Set())
const solved = ref(false)

const choices = computed(() => props.question.choices ?? [])

const questionText = computed(() =>
  locale.value === 'en' && props.question.questionEn
    ? props.question.questionEn
    : props.question.question ?? ''
)

const choiceLabel = (choice) =>
  locale.value === 'en' && choice.textEn ? choice.textEn : choice.text

const stateOf = (idx) => {
  if (solved.value && choices.value[idx]?.isCorrect) return 'correct'
  if (wrongIndices.value.has(idx)) return 'wrong'
  return 'idle'
}

const handleChoice = (idx) => {
  if (solved.value || wrongIndices.value.has(idx)) return
  if (choices.value[idx]?.isCorrect) {
    solved.value = true
    emit('correct')
  } else {
    wrongIndices.value = new Set([...wrongIndices.value, idx])
    emit('wrong')
  }
}
</script>

<template>
  <BaseMission :checkpoint="checkpoint" :config="config">
    <div class="space-y-3">

      <!-- Question text -->
      <div v-if="questionText" class="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-700 text-center">
        <p class="text-white font-bold text-base leading-snug">{{ questionText }}</p>
      </div>

      <!-- Choices -->
      <div class="space-y-2">
        <button
          v-for="(choice, idx) in choices"
          :key="idx"
          @click="handleChoice(idx)"
          :disabled="solved || wrongIndices.has(idx)"
          :class="[
            'w-full text-start px-4 py-3 rounded-xl border-2 transition-all font-medium text-sm',
            stateOf(idx) === 'correct'
              ? 'border-green-500 bg-green-500/10 text-green-400 cursor-default'
              : stateOf(idx) === 'wrong'
                ? 'border-red-600 bg-red-500/10 text-red-400 cursor-not-allowed opacity-60'
                : solved
                  ? 'border-slate-700 bg-slate-800 text-slate-500 cursor-default'
                  : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-amber-500/50 hover:bg-amber-500/5 active:scale-[0.98]'
          ]"
        >
          <div class="flex items-center gap-3">
            <div :class="[
              'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0',
              stateOf(idx) === 'correct' ? 'border-green-500 bg-green-500 text-white' :
              stateOf(idx) === 'wrong'   ? 'border-red-600 text-red-400' :
              'border-slate-500 text-slate-400'
            ]">
              {{ stateOf(idx) === 'correct' ? '✓' : stateOf(idx) === 'wrong' ? '✕' : String.fromCharCode(65 + idx) }}
            </div>
            <span>{{ choiceLabel(choice) }}</span>
          </div>
        </button>
      </div>

      <!-- Live penalty counter -->
      <Transition name="feedback">
        <div v-if="wrongIndices.size > 0 && !solved"
             class="text-center text-red-400 text-xs font-semibold py-1">
          {{ wrongIndices.size }} mauvaise{{ wrongIndices.size > 1 ? 's' : '' }} réponse{{ wrongIndices.size > 1 ? 's' : '' }}
          · −{{ wrongIndices.size * (checkpoint.pointsWrong ?? 50) }} pts
        </div>
      </Transition>
    </div>
  </BaseMission>
</template>

<style scoped>
.feedback-enter-active, .feedback-leave-active { transition: all 0.3s; }
.feedback-enter-from, .feedback-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
