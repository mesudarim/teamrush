<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import EnvelopeAnimation from './EnvelopeAnimation.vue'

const { t, locale } = useI18n()
const game = useGameStore()

const envelopeOpened = ref(false)
const cp = computed(() => game.currentCheckpoint)
const instruction = computed(() =>
  locale.value === 'en' && cp.value?.missionConfig?.instructionEn
    ? cp.value.missionConfig.instructionEn
    : cp.value?.missionConfig?.instruction ?? ''
)
const youtubeEmbedUrl = computed(() => {
  const url = cp.value?.youtubeUrl
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([^&\n?#]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1` : null
})
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

    <!-- Animated envelope (mission) -->
    <EnvelopeAnimation
      :brand-text="cp?.envelopeBrand || 'TeamRush'"
      :label="cp?.envelope2Label || ($i18n.locale === 'en' ? 'MISSION' : 'משימה')"
      :tap-text="t('game.envelope2.tapToOpen')"
      @opened="envelopeOpened = true"
      class="w-full"
    >
      <!-- Revealed mission content -->
      <div class="space-y-4">

        <!-- Mission card — same yellow/black style -->
        <div class="rounded-2xl overflow-hidden shadow-xl border border-amber-500/40">
          <div class="bg-amber-400 px-4 py-2 text-center">
            <span class="text-black font-black text-xs tracking-[0.2em] uppercase">
              ◄ {{ $i18n.locale === 'en' ? 'YOUR MISSION' : 'המשימה שלכם' }} ►
            </span>
          </div>
          <div class="bg-black px-5 py-5 space-y-3">
            <!-- Optional video -->
            <div v-if="youtubeEmbedUrl" class="relative w-full rounded-xl overflow-hidden bg-black" style="padding-bottom:56.25%;">
              <iframe :src="youtubeEmbedUrl" class="absolute inset-0 w-full h-full" frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen />
            </div>

            <!-- Instructions -->
            <p v-if="instruction" class="text-amber-100 text-sm leading-relaxed text-center">{{ instruction }}</p>
          </div>
          <!-- Points warning -->
          <div class="bg-amber-400 px-4 py-3">
            <p class="text-black text-xs font-bold text-center leading-snug">
              ⚠️
              {{ $i18n.locale === 'en'
                ? `Correct: +${cp?.pointsCorrect ?? 100}pts · Wrong: -${cp?.pointsWrong ?? 50}pts`
                : `תשובה נכונה: +${cp?.pointsCorrect ?? 100} · תשובה שגויה: -${cp?.pointsWrong ?? 50}` }}
            </p>
          </div>
        </div>

        <!-- Start mission button -->
        <button @click="game.openEnvelope2()" class="btn-primary w-full py-4 text-base font-black">
          🎯 {{ t('game.envelope2.startMission') }}
        </button>
      </div>
    </EnvelopeAnimation>
  </div>
</template>
