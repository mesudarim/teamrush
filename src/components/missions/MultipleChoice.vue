<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseMission from './BaseMission.vue'

const { t, locale } = useI18n()

const props = defineProps({
  checkpoint: { type: Object, required: true },
  config: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['submit'])

const selected = ref(null)
const submitted = ref(false)
const isCorrect = ref(null)

// choices: [{ text: string, textEn?: string, isCorrect: boolean }]
const choices = computed(() => props.config.choices ?? [])
const question = computed(() =>
  locale.value === 'en' && props.config.questionEn
    ? props.config.questionEn
    : props.config.question ?? ''
)

const choiceLabel = (choice) =>
  locale.value === 'en' && choice.textEn ? choice.textEn : choice.text

const submit = () => {
  if (selected.value === null || submitted.value) return
  const correct = choices.value[selected.value]?.isCorrect === true
  isCorrect.value = correct
  submitted.value = true
  emit('submit', correct, selected.value)
}
</script>

<template>
  <BaseMission :checkpoint="checkpoint" :config="config" :submitted="submitted" :correct="isCorrect">
    <div class="space-y-3">
      <!-- Question -->
      <div v-if="question" class="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-700 text-center">
        <p class="text-white font-bold text-base leading-snug">{{ question }}</p>
      </div>
      <p v-else class="text-sm text-slate-400 text-center font-medium">{{ t('missions.multipleChoice.title') }}</p>
      <div class="space-y-2">
        <button
          v-for="(choice, idx) in choices"
          :key="idx"
          @click="!submitted && (selected = idx)"
          :class="[
            'w-full text-start px-4 py-3 rounded-xl border-2 transition-all font-medium text-sm',
            submitted && choice.isCorrect
              ? 'border-green-500 bg-green-500/10 text-green-400'
              : submitted && selected === idx && !choice.isCorrect
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : selected === idx
                  ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                  : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
          ]"
        >
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0',
                selected === idx ? 'border-current bg-current text-slate-900' : 'border-slate-500'
              ]"
            >
              {{ String.fromCharCode(65 + idx) }}
            </div>
            <span>{{ choiceLabel(choice) }}</span>
            <!-- Show result icons after submit -->
            <span v-if="submitted" class="ms-auto">
              {{ choice.isCorrect ? '✅' : (selected === idx ? '❌' : '') }}
            </span>
          </div>
        </button>
      </div>

      <button
        @click="submit"
        :disabled="selected === null || submitted"
        class="btn-primary w-full mt-2"
      >
        {{ t('missions.multipleChoice.submit') }}
      </button>
    </div>
  </BaseMission>
</template>
