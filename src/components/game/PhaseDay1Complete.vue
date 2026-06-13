<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'

const { t } = useI18n()
const game = useGameStore()

// ── Confetti ──────────────────────────────────────────────────────────────────
const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 2,
  duration: 2.5 + Math.random() * 2.5,
  color: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#f97316', '#a855f7'][i % 6],
  size: 6 + Math.random() * 8,
  rotate: Math.random() * 360,
}))

// ── Congrats message then fade to waiting screen ──────────────────────────────
const showCongrats = ref(true)

let hideTimeout = null
onMounted(() => {
  hideTimeout = setTimeout(() => { showCongrats.value = false }, 3500)
})
onUnmounted(() => clearTimeout(hideTimeout))
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in relative overflow-hidden">

    <!-- Confetti -->
    <div class="confetti-container" aria-hidden="true">
      <div
        v-for="p in confettiPieces"
        :key="p.id"
        class="confetti-piece"
        :style="{
          left: p.left + '%',
          width: p.size + 'px',
          height: p.size * 0.4 + 'px',
          backgroundColor: p.color,
          animationDelay: p.delay + 's',
          animationDuration: p.duration + 's',
          transform: `rotate(${p.rotate}deg)`,
        }"
      />
    </div>

    <!-- Congrats overlay -->
    <Transition name="congrats">
      <div v-if="showCongrats" class="absolute inset-0 flex flex-col items-center justify-center z-10 px-6">
        <div class="text-8xl mb-4 animate-bounce">🎉</div>
        <h1 class="text-4xl font-bold text-amber-400 mb-3"
            style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
          {{ $i18n.locale === 'he' ? 'כל הכבוד!' : 'Well done!' }}
        </h1>
        <p class="text-white text-xl font-bold"
           style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
          {{ $i18n.locale === 'he' ? 'סיימתם את יום 1!' : 'Day 1 complete!' }}
        </p>
      </div>
    </Transition>

    <!-- Waiting screen (fades in after congrats) -->
    <Transition name="waiting">
      <div v-if="!showCongrats" class="w-full space-y-6 relative z-10">

        <!-- Trophy -->
        <div class="text-8xl">🌙</div>

        <!-- Title -->
        <h1 class="text-3xl font-bold text-amber-400"
            style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
          {{ t('game.day1complete.title') }}
        </h1>

        <p class="text-slate-300 text-lg leading-relaxed"
           style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
          {{ t('game.day1complete.subtitle') }}
        </p>

        <!-- Day 1 score -->
        <div class="bg-slate-800 border border-amber-500/30 rounded-2xl px-8 py-5 inline-block">
          <div class="text-xs text-slate-400 uppercase tracking-widest mb-1">
            {{ t('game.day1complete.scoreLabel') }}
          </div>
          <div class="text-5xl font-bold text-amber-400 tabular-nums"
               style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
            {{ game.totalPoints }}
          </div>
          <div class="text-sm text-slate-400 mt-1">{{ t('game.points') }}</div>
        </div>

        <!-- Waiting message -->
        <div class="flex items-center gap-3 px-5 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
          <span class="text-xl animate-pulse">⏳</span>
          <span style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
            {{ t('game.day1complete.waiting') }}
          </span>
        </div>

      </div>
    </Transition>

  </div>
</template>

<style scoped>
.confetti-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}
.confetti-piece {
  position: absolute;
  top: -20px;
  border-radius: 2px;
  animation: confetti-fall linear forwards;
}
@keyframes confetti-fall {
  0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

/* Congrats screen: stays, then fades out */
.congrats-leave-active { transition: opacity 0.6s ease, transform 0.6s ease; }
.congrats-leave-to     { opacity: 0; transform: scale(1.05); }

/* Waiting screen: fades in */
.waiting-enter-active { transition: opacity 0.7s ease, transform 0.7s ease; }
.waiting-enter-from   { opacity: 0; transform: translateY(20px); }
</style>
