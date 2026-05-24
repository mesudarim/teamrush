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

const answer = ref('')
const submitted = ref(false)
const isCorrect = ref(null)

const question = computed(() =>
  locale.value === 'en' && props.config.questionEn
    ? props.config.questionEn
    : props.config.question ?? ''
)

const submit = () => {
  if (!answer.value.trim() || submitted.value) return
  const correct = answer.value.trim().toLowerCase() === (props.config.answer ?? '').trim().toLowerCase()
  isCorrect.value = correct
  submitted.value = true
  emit('submit', correct, answer.value.trim())
}
</script>

<template>
  <BaseMission :checkpoint="checkpoint" :config="config" :submitted="submitted" :correct="isCorrect">
    <div class="space-y-4">
      <div v-if="question" class="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-700 text-center">
        <p class="text-white font-bold text-base leading-snug">{{ question }}</p>
      </div>
      <textarea
        v-model="answer"
        rows="3"
        class="input-field resize-none"
        :placeholder="t('missions.textValidation.placeholder')"
        :disabled="submitted"
        @keyup.ctrl.enter="submit"
      />
      <button
        @click="submit"
        :disabled="!answer.trim() || submitted"
        class="btn-primary w-full"
      >
        {{ t('missions.textValidation.submit') }}
      </button>
    </div>
  </BaseMission>
</template>
