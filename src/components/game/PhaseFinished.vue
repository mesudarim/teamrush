<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'

const { t } = useI18n()
const router = useRouter()
const game = useGameStore()

// ── Confetti ──────────────────────────────────────────────────────────────────
const confettiPieces = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 3,
  duration: 2.5 + Math.random() * 2.5,
  color: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#f97316', '#a855f7'][i % 6],
  size: 6 + Math.random() * 8,
  rotate: Math.random() * 360,
}))

// ── Time bonus counter animation ───────────────────────────────────────────────
const displayBonus = ref(0)
const bonusFinished = ref(false)
const coins = ref([])   // flying coins
let countInterval = null
let coinInterval = null
let coinId = 0

const timeSaved = game.formatTime(Math.max(0, 3600 - game.elapsedSeconds))

const spawnCoin = () => {
  coins.value.push({
    id: coinId++,
    left: 30 + Math.random() * 40,
    delay: 0,
  })
  // remove after animation
  setTimeout(() => {
    coins.value = coins.value.filter(c => c.id !== coinId - 1)
  }, 1200)
}

onMounted(() => {
  const target = game.timeBonus
  if (target <= 0) { bonusFinished.value = true; return }

  const DURATION = 2800
  const STEPS = 80
  let step = 0

  coinInterval = setInterval(spawnCoin, DURATION / 12)

  countInterval = setInterval(() => {
    step++
    // ease-out: fast at start, slows toward end
    const progress = 1 - Math.pow(1 - step / STEPS, 3)
    displayBonus.value = Math.round(progress * target)
    if (step >= STEPS) {
      displayBonus.value = target
      bonusFinished.value = true
      clearInterval(countInterval)
      clearInterval(coinInterval)
    }
  }, DURATION / STEPS)
})

onUnmounted(() => {
  clearInterval(countInterval)
  clearInterval(coinInterval)
})
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full relative overflow-hidden">

    <!-- Confetti layer -->
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

    <!-- Flying coins -->
    <div class="coin-container" aria-hidden="true">
      <div
        v-for="c in coins"
        :key="c.id"
        class="flying-coin"
        :style="{ left: c.left + '%' }"
      >🪙</div>
    </div>

    <div class="w-full text-center animate-bounce-in relative z-10">
      <div class="card-glow space-y-5">

        <!-- Trophy -->
        <div class="text-7xl animate-bounce">🏆</div>

        <div>
          <h1 class="text-3xl font-black text-shimmer mb-1">{{ t('game.finished.title') }}</h1>
          <p class="text-slate-400 text-sm">{{ t('game.finished.subtitle') }}</p>
        </div>

        <!-- Stats grid -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
            <div class="text-xs text-slate-400 mb-1">{{ t('game.finished.totalTime') }}</div>
            <div class="text-2xl font-black text-blue-400">{{ game.formatTime(game.elapsedSeconds) }}</div>
          </div>
          <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
            <div class="text-xs text-slate-400 mb-1">{{ t('game.finished.totalPoints') }}</div>
            <div class="text-2xl font-black text-amber-400">{{ game.totalPoints }}</div>
          </div>
        </div>

        <!-- Time bonus section -->
        <div v-if="game.timeBonus > 0" class="rounded-2xl overflow-hidden border border-amber-500/40">
          <div class="bg-amber-400 px-4 py-2 text-center">
            <span class="text-black font-black text-xs tracking-[0.2em] uppercase">
              ⏱ {{ $i18n.locale === 'en' ? 'TIME BONUS' : 'בונוס זמן' }}
            </span>
          </div>
          <div class="bg-black px-4 py-4 text-center space-y-1">
            <p class="text-slate-400 text-xs">
              {{ $i18n.locale === 'en' ? `${timeSaved} saved from 60 min` : `נחסכו ${timeSaved} מתוך 60 דקות` }}
            </p>
            <div class="flex items-center justify-center gap-2">
              <span class="text-4xl font-black text-amber-400 tabular-nums">+{{ displayBonus }}</span>
              <span class="text-2xl">🪙</span>
            </div>
            <p v-if="bonusFinished" class="text-amber-400/60 text-xs animate-pulse">
              {{ $i18n.locale === 'en' ? 'added to your score!' : 'נוסף לניקוד שלכם!' }}
            </p>
          </div>
        </div>

        <button @click="router.push({ name: 'Leaderboard' })" class="btn-primary w-full text-lg py-4">
          {{ t('game.finished.leaderboardBtn') }}
          <span class="ms-2">📊</span>
        </button>
      </div>
    </div>
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
  animation: confetti-fall linear infinite;
}
@keyframes confetti-fall {
  0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

.coin-container {
  position: fixed;
  bottom: 40%;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 20;
}
.flying-coin {
  position: absolute;
  font-size: 1.6rem;
  animation: coin-fly 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes coin-fly {
  0%   { transform: translateY(0)    scale(0.6); opacity: 1; }
  60%  { transform: translateY(-120px) scale(1.2); opacity: 1; }
  100% { transform: translateY(-200px) scale(0.8); opacity: 0; }
}
</style>
