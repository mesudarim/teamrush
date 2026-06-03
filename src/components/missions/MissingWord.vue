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

const answer      = ref('')
const wrongCount  = ref(0)
const solved      = ref(false)
const showError   = ref(false)

const questionText = computed(() =>
  locale.value === 'en' && props.question.questionEn
    ? props.question.questionEn
    : props.question.question ?? ''
)

const imageUrl = computed(() => props.question.imageUrl ?? '')

// Case-insensitive, whitespace-tolerant comparison
const isMatch = (input) => {
  const clean = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  return clean(input) === clean(props.question.answer ?? '')
}

const submit = () => {
  if (!answer.value.trim() || solved.value) return
  if (isMatch(answer.value)) {
    solved.value = true
    emit('correct')
  } else {
    wrongCount.value++
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

      <!-- Clue image -->
      <div v-if="imageUrl" class="rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
        <img
          :src="imageUrl"
          class="w-full object-cover"
          style="max-height: 280px; object-position: center;"
        />
      </div>

      <!-- Specific question/instruction -->
      <div v-if="questionText" class="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-700 text-center">
        <p class="text-white font-bold text-base leading-snug">{{ questionText }}</p>
      </div>

      <!-- Success -->
      <div
        v-if="solved"
        class="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-semibold text-sm"
      >
        ✅ {{ t('missions.missingWord.success') }}
      </div>

      <!-- Input + submit -->
      <template v-else>
        <div class="flex gap-2">
          <input
            v-model="answer"
            type="text"
            :class="[
              'input-field flex-1 text-center text-lg font-bold transition-all',
              showError ? 'border-red-500 ring-2 ring-red-500/30' : ''
            ]"
            :placeholder="t('missions.missingWord.placeholder')"
            @keyup.enter="submit"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
          <button
            @click="submit"
            :disabled="!answer.trim()"
            class="btn-primary px-4 py-3 rounded-xl disabled:opacity-40"
          >
            →
          </button>
        </div>

        <!-- Error feedback -->
        <Transition name="feedback">
          <div
            v-if="showError"
            class="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold"
          >
            ❌ {{ t('missions.missingWord.wrongAnswer') }}
            <span class="ms-auto text-xs opacity-70">−{{ checkpoint.pointsWrong ?? 50 }} pts</span>
          </div>
        </Transition>

        <!-- Wrong count -->
        <div v-if="wrongCount > 0 && !showError" class="text-center text-red-400 text-xs font-semibold">
          −{{ wrongCount * (checkpoint.pointsWrong ?? 50) }} pts
        </div>
      </template>
    </div>
  </BaseMission>
</template>

<style scoped>
.feedback-enter-active, .feedback-leave-active { transition: all 0.3s; }
.feedback-enter-from, .feedback-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
