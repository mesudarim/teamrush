<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'
import { useSound } from '@/composables/useSound'

const { t } = useI18n()
const router = useRouter()
const game = useGameStore()
const auth = useAuthStore()
const { playEndOfGame } = useSound()

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

// ── Points breakdown ──────────────────────────────────────────────────────────
// timeBonusPoints is persisted in Firestore → survives page refresh
const timeBonusPts  = computed(() => auth.team?.timeBonusPoints ?? game.timeBonus ?? 0)
const totalPts      = computed(() => game.totalPoints)
const questionPts   = computed(() => totalPts.value - timeBonusPts.value)

// ── Time bonus counter animation ───────────────────────────────────────────────
const displayBonus = ref(0)
const bonusFinished = ref(false)
const coins = ref([])
let countInterval = null
let coinInterval = null
let coinId = 0

const spawnCoin = () => {
  const id = coinId++
  coins.value.push({ id, left: 30 + Math.random() * 40 })
  setTimeout(() => { coins.value = coins.value.filter(c => c.id !== id) }, 1200)
}

onMounted(() => {
  game.finishingGame = false   // Remove the bridging overlay from GameView
  playEndOfGame()
  const target = timeBonusPts.value
  if (target <= 0) { bonusFinished.value = true; displayBonus.value = 0; return }

  const DURATION = 2800
  const STEPS = 80
  let step = 0

  coinInterval = setInterval(spawnCoin, DURATION / 12)

  countInterval = setInterval(() => {
    step++
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

const goHome = async () => {
  game.cleanup()
  await auth.logoutAndSetInactive()
  router.push({ name: 'Login' })
}
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
          <h1 class="text-3xl font-bold text-shimmer mb-1" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">{{ t('game.finished.title') }}</h1>
          <p class="text-slate-400 text-sm">{{ t('game.finished.subtitle') }}</p>
        </div>

        <!-- Score breakdown — receipt style -->
        <div class="bg-slate-900/60 rounded-2xl border border-slate-700 overflow-hidden">

          <!-- Question points row -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span class="text-slate-400 text-sm">🎯 {{ t('game.finished.questionPoints') }}</span>
            <span class="font-black text-green-400 tabular-nums text-lg">+{{ questionPts }}</span>
          </div>

          <!-- Time row -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span class="text-slate-400 text-sm">⏱ {{ t('game.finished.totalTime') }}</span>
            <span class="font-black text-blue-400 tabular-nums text-lg">{{ game.formatTime(game.elapsedSeconds) }}</span>
          </div>

          <!-- Time bonus row (animated counter) -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-amber-500/30 bg-amber-500/5 relative overflow-hidden">
            <span class="text-amber-300/80 text-sm">⚡ {{ t('game.finished.timeBonus') }}</span>
            <div class="flex items-center gap-1.5">
              <span class="font-black text-amber-400 tabular-nums text-lg">+{{ displayBonus }}</span>
              <span class="text-base">🪙</span>
            </div>
          </div>

          <!-- Total row -->
          <div class="flex items-center justify-between px-4 py-4 bg-amber-500/10">
            <span class="text-amber-300 font-bold text-sm">⭐ {{ t('game.finished.totalPoints') }}</span>
            <span class="text-3xl font-black text-amber-400 tabular-nums">{{ totalPts }}</span>
          </div>
        </div>

        <button @click="router.push({ name: 'Leaderboard' })" class="btn-primary w-full text-lg py-4">
          {{ t('game.finished.leaderboardBtn') }}
          <span class="ms-2">📊</span>
        </button>

        <button @click="goHome" class="w-full py-3.5 rounded-2xl font-bold text-sm border border-slate-600 text-slate-300 bg-slate-800/60 hover:bg-slate-700 active:scale-[0.97] transition-all">
          🏠 {{ t('game.finished.homeBtn') }}
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
