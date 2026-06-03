<!--
  BaseMission.vue — base wrapper every mission component should use.
  Provides consistent card layout, instruction header, and submission state.

  Mission components emit: submit(correct: boolean, answer: any)
-->
<script setup>
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

const props = defineProps({
  checkpoint: { type: Object, required: true },
  config: { type: Object, default: () => ({}) },
  submitted: { type: Boolean, default: false },
  correct: { type: Boolean, default: null },
})

const instruction = computed(() =>
  locale.value === 'en' && props.config.instructionEn
    ? props.config.instructionEn
    : props.config.instruction ?? ''
)

import { computed } from 'vue'
</script>

<template>
  <div class="card space-y-5">
    <!-- Mission header -->
    <div class="text-center">
      <div class="badge-amber mb-2">{{ t('game.envelope2.title') }}</div>
      <p v-if="instruction" class="text-slate-200 text-base leading-relaxed font-medium">{{ instruction }}</p>
    </div>

    <!-- Mission-specific content injected via slot -->
    <slot />

    <!-- Result feedback (shown after submit) -->
    <Transition name="feedback">
      <div
        v-if="submitted && correct !== null"
        :class="[
          'flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold',
          correct
            ? 'bg-green-500/15 border border-green-500/30 text-green-400'
            : 'bg-red-500/15 border border-red-500/30 text-red-400'
        ]"
      >
        <span class="text-lg">{{ correct ? '✅' : '❌' }}</span>
        <slot name="feedback">
          {{ correct
            ? t('game.stage2.correct', { points: checkpoint.pointsCorrect ?? 100 })
            : t('game.stage2.wrong', { points: checkpoint.pointsWrong ?? 50 }) }}
        </slot>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.feedback-enter-active, .feedback-leave-active { transition: all 0.3s; }
.feedback-enter-from, .feedback-leave-to { opacity: 0; transform: translateY(-5px); }
</style>
