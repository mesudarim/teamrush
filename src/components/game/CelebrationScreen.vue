<script setup>
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'

const { t } = useI18n()
const game = useGameStore()

// Auto-advance to envelope2 after 3.5s
onMounted(() => setTimeout(() => game.advanceToBravo(), 3500))
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">

    <!-- Stars burst -->
    <div class="relative mb-4">
      <div class="star star-1">⭐</div>
      <div class="star star-2">✨</div>
      <div class="star star-3">⭐</div>
      <div class="star star-4">✨</div>
      <div class="star star-5">🌟</div>

      <!-- Trophy -->
      <div class="text-8xl animate-trophy-bounce">🏅</div>
    </div>

    <!-- BRAVO text -->
    <h1 class="bravo-text font-black mb-2">BRAVO !</h1>
    <p class="text-slate-300 text-lg mb-8">{{ t('game.stage1.correct') }}</p>

    <!-- Progress dots -->
    <div class="flex gap-2 mb-8">
      <div v-for="i in game.checkpoints.length" :key="i"
           :class="['w-3 h-3 rounded-full transition-all',
             i <= game.currentIndex ? 'bg-amber-400' : 'bg-slate-600']" />
    </div>

    <button @click="game.advanceToBravo()" class="btn-primary px-8 py-3">
      {{ t('game.bravo.continueBtn') }} →
    </button>

    <!-- Auto-advance hint -->
    <p class="text-slate-500 text-xs mt-4">{{ t('game.bravo.autoHint') }}</p>
  </div>
</template>

<style scoped>
.bravo-text {
  font-size: clamp(3rem, 15vw, 5rem);
  background: linear-gradient(135deg, #f59e0b, #fcd34d, #f59e0b);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer-text 1.5s linear infinite;
}
@keyframes shimmer-text {
  0%   { background-position: 0% center; }
  100% { background-position: 200% center; }
}

@keyframes trophy-bounce {
  0%, 100% { transform: translateY(0) scale(1) rotate(-5deg); }
  30%       { transform: translateY(-20px) scale(1.15) rotate(5deg); }
  60%       { transform: translateY(-8px) scale(1.05) rotate(-3deg); }
}
.animate-trophy-bounce { animation: trophy-bounce 1.2s ease-in-out infinite; }

/* Floating stars */
.star {
  position: absolute;
  font-size: 1.5rem;
  animation: star-fly 2s ease-in-out infinite;
}
.star-1 { top: -10px; left: -30px; animation-delay: 0s; }
.star-2 { top: -20px; right: -20px; animation-delay: 0.3s; }
.star-3 { bottom: 0px; left: -40px; animation-delay: 0.6s; }
.star-4 { bottom: 10px; right: -35px; animation-delay: 0.9s; }
.star-5 { top: 10px; left: 50%; animation-delay: 1.2s; }

@keyframes star-fly {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 1; }
  50%       { transform: translate(0, -10px) scale(1.3); opacity: 0.7; }
}
</style>
