<script setup>
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import EnvelopeAnimation from './EnvelopeAnimation.vue'
import { computed, ref } from 'vue'

const { t } = useI18n()
const game = useGameStore()

const envelopeOpened = ref(false)
const cp = computed(() => game.currentCheckpoint)
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-sm mx-auto">

    <!-- Instruction above — hidden once envelope is open -->
    <Transition name="feedback">
      <div v-if="!envelopeOpened" class="text-center mb-6 animate-fade-in">
        <div class="badge-green mb-3">✅ {{ t('game.stage1.correct') }}</div>
        <p class="text-slate-300 text-base font-medium">
          {{ t('game.envelope2.openInstruction') }}
        </p>
      </div>
    </Transition>

    <!-- Animated envelope — opening immediately starts the mission -->
    <EnvelopeAnimation
      :brand-text="cp?.envelopeBrand || t('app.name')"
      :label="cp?.envelope2Label || ($i18n.locale === 'en' ? 'MISSION' : 'משימה')"
      :tap-text="t('game.envelope2.tapToOpen')"
      @opened="envelopeOpened = true; game.openEnvelope2()"
      class="w-full"
    />
  </div>
</template>
