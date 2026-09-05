<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'
import { useGameContextStore } from '@/stores/gameContext'
import { useSound } from '@/composables/useSound'
import { getSettings } from '@/firebase/firestore'

const { t, locale } = useI18n()
const router = useRouter()
const game = useGameStore()
const auth = useAuthStore()
const gameCtx = useGameContextStore()
const { playEndOfGame } = useSound()

const goHome = async () => {
  game.cleanup()
  await auth.logoutAndSetInactive()
  router.push({ name: 'Login' })
}

// ── Settings (configurable content) ──────────────────────────────────────────
const settings = ref({})
const day1Text = computed(() => {
  const en = settings.value.day1CompleteTextEn
  const he = settings.value.day1CompleteText
  return (locale.value === 'en' && en) ? en : (he || en || '')
})

// ── Confetti ──────────────────────────────────────────────────────────────────
const confettiPieces = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 3,
  duration: 3 + Math.random() * 3,
  color: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#f97316', '#a855f7', '#facc15', '#34d399'][i % 8],
  size: 6 + Math.random() * 10,
  rotate: Math.random() * 360,
}))

// ── Points breakdown ──────────────────────────────────────────────────────────
const day1BonusPts = computed(() => auth.team?.day1BonusPoints ?? 0)
const totalPts     = computed(() => game.totalPoints)
const questionPts  = computed(() => totalPts.value - day1BonusPts.value)

// ── Time bonus counter animation (starts after congrats flash) ────────────────
const displayBonus = ref(0)
const coins = ref([])
let bonusInterval = null
let coinInterval  = null
let coinId = 0

const spawnCoin = () => {
  const id = coinId++
  coins.value.push({ id, left: 30 + Math.random() * 40 })
  setTimeout(() => { coins.value = coins.value.filter(c => c.id !== id) }, 1200)
}

const startBonusAnimation = () => {
  const target = day1BonusPts.value
  if (target <= 0) return
  const DURATION = 2800
  const STEPS = 80
  let step = 0
  coinInterval = setInterval(spawnCoin, DURATION / 12)
  bonusInterval = setInterval(() => {
    step++
    const progress = 1 - Math.pow(1 - step / STEPS, 3)
    displayBonus.value = Math.round(progress * target)
    if (step >= STEPS) {
      displayBonus.value = target
      clearInterval(bonusInterval)
      clearInterval(coinInterval)
    }
  }, DURATION / STEPS)
}

// ── Brief congrats flash then reveal main card ────────────────────────────────
const showCongrats = ref(true)
let flashTimer = null
let bonusTimer  = null
onMounted(async () => {
  game.finishingGame = false   // Remove the bridging overlay from GameView
  playEndOfGame()
  flashTimer = setTimeout(() => {
    showCongrats.value = false
    bonusTimer = setTimeout(startBonusAnimation, 600)
  }, 2500)
  settings.value = await getSettings(gameCtx.gameId)
})
onUnmounted(() => {
  clearTimeout(flashTimer)
  clearTimeout(bonusTimer)
  clearInterval(bonusInterval)
  clearInterval(coinInterval)
})
</script>

<template>
  <div class="flex-1 flex flex-col relative overflow-hidden">

    <!-- Confetti -->
    <div class="confetti-container" aria-hidden="true">
      <div
        v-for="p in confettiPieces" :key="p.id"
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

    <!-- Congrats flash overlay -->
    <Transition name="congrats">
      <div v-if="showCongrats"
           class="absolute inset-0 flex flex-col items-center justify-center z-20 px-6 text-center bg-slate-900/80 backdrop-blur-sm">
        <div class="text-8xl mb-4" style="animation: pop 0.5s cubic-bezier(0.34,1.56,0.64,1);">🎉</div>
        <h1 class="text-4xl font-black text-amber-400 mb-2" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
          {{ t('game.day1complete.flashTitle') }}
        </h1>
        <p class="text-white text-xl font-bold" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
          {{ t('game.day1complete.flashSubtitle') }}
        </p>
      </div>
    </Transition>

    <!-- Main festive card -->
    <Transition name="card">
      <div v-if="!showCongrats" class="flex-1 overflow-y-auto px-4 py-6 pb-32 space-y-4 relative z-10">

        <!-- Header -->
        <div class="text-center space-y-2">
          <div class="text-5xl">🎉</div>
          <h1 class="text-2xl font-bold text-shimmer leading-snug" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-weight: 700;">
            {{ t('game.day1complete.headerTitle') }}
            <span class="ms-1">🎉</span>
          </h1>
        </div>

        <!-- Flying coins -->
        <div class="coin-container" aria-hidden="true">
          <div v-for="c in coins" :key="c.id" class="flying-coin" :style="{ left: c.left + '%' }">🪙</div>
        </div>

        <!-- Score breakdown — receipt style -->
        <div class="bg-slate-900/60 rounded-2xl border border-slate-700 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span class="text-slate-400 text-sm">🎯 {{ t('game.day1complete.questionPoints') }}</span>
            <span class="font-bold text-green-400 tabular-nums text-lg">+{{ questionPts }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span class="text-slate-400 text-sm">⏱ {{ t('game.day1complete.totalTime') }}</span>
            <span class="font-bold text-blue-400 tabular-nums text-lg">{{ game.formatTime(game.elapsedSeconds) }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-3 border-b border-amber-500/30 bg-amber-500/5">
            <span class="text-amber-300/80 text-sm">⚡ {{ t('game.day1complete.timeBonus') }}</span>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-amber-400 tabular-nums text-lg">+{{ displayBonus }}</span>
              <span class="text-base">🪙</span>
            </div>
          </div>
          <div class="flex items-center justify-between px-4 py-4 bg-amber-500/10">
            <span class="text-amber-300 font-bold text-sm">⭐ {{ t('game.day1complete.totalPointsLabel') }}</span>
            <span class="text-3xl font-bold text-amber-400 tabular-nums">{{ totalPts }}</span>
          </div>
        </div>

        <!-- Leaderboard button -->
        <button @click="$router.push({ name: 'Leaderboard' })" class="btn-primary w-full py-4 text-base font-bold">
          {{ t('game.day1complete.leaderboardBtn') }} 📊
        </button>

        <!-- Admin-configurable text -->
        <div v-if="day1Text" class="rounded-2xl bg-slate-800/60 border border-slate-700 px-5 py-5">
          <p class="text-slate-200 text-base leading-relaxed whitespace-pre-line text-center">{{ day1Text }}</p>
        </div>

        <!-- Home button -->
        <button @click="goHome" class="w-full py-3.5 rounded-2xl font-bold text-sm border border-slate-600 text-slate-300 bg-slate-800/60 hover:bg-slate-700 active:scale-[0.97] transition-all" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
          🏠 {{ t('game.day1complete.homeBtn') }}
        </button>

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
  100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
}
@keyframes pop {
  0%   { transform: scale(0.3); opacity: 0; }
  100% { transform: scale(1);   opacity: 1; }
}

.congrats-leave-active { transition: opacity 0.7s ease, transform 0.7s ease; }
.congrats-leave-to     { opacity: 0; transform: scale(1.08); }

.card-enter-active { transition: opacity 0.8s ease, transform 0.8s ease; }
.card-enter-from   { opacity: 0; transform: translateY(30px); }

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
  0%   { transform: translateY(0) scale(0.6); opacity: 1; }
  60%  { transform: translateY(-120px) scale(1.2); opacity: 1; }
  100% { transform: translateY(-200px) scale(0.8); opacity: 0; }
}
</style>
