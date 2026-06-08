<script setup>
import { ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const bursts = ref([])
let uid = 0

watch(() => game.pointsAnimation, ({ pts }) => {
  if (!pts) return
  const id = ++uid
  bursts.value.push({ id, pts })
  setTimeout(() => {
    bursts.value = bursts.value.filter(b => b.id !== id)
  }, 1400)
}, { deep: true })
</script>

<template>
  <div class="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
    <div
      v-for="burst in bursts"
      :key="burst.id"
      class="absolute"
      style="bottom: 100px; inset-inline-end: 20px;"
    >
      <!-- Main floating label -->
      <div
        :class="[
          'font-black text-4xl leading-none select-none points-label',
          burst.pts > 0 ? 'text-amber-300' : 'text-red-400'
        ]"
      >
        {{ burst.pts > 0 ? '+' : '' }}{{ burst.pts }}
      </div>

      <!-- Coin / star particles (positive only) -->
      <template v-if="burst.pts > 0">
        <span class="particle particle-1">🪙</span>
        <span class="particle particle-2">⭐</span>
        <span class="particle particle-3">🪙</span>
        <span class="particle particle-4">⭐</span>
        <span class="particle particle-5">🪙</span>
        <span class="particle particle-6">⭐</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ── Main label ── */
.points-label {
  animation: pts-float 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  text-shadow: 0 0 16px currentColor, 0 2px 8px rgba(0,0,0,0.6);
  transform-origin: center bottom;
}

@keyframes pts-float {
  0%   { opacity: 0;   transform: translateY(0)    scale(0.4); }
  18%  { opacity: 1;   transform: translateY(-14px) scale(1.35); }
  55%  { opacity: 1;   transform: translateY(-52px) scale(1); }
  100% { opacity: 0;   transform: translateY(-88px) scale(0.75); }
}

/* ── Particles ── */
.particle {
  position: absolute;
  top: 8px;
  left: 50%;
  font-size: 1rem;
  animation: particle-fly 1.1s ease-out forwards;
}

.particle-1 { animation-delay: 0.00s; --tx: -44px; --ty: -56px; }
.particle-2 { animation-delay: 0.04s; --tx:  12px; --ty: -72px; }
.particle-3 { animation-delay: 0.08s; --tx: -24px; --ty: -80px; }
.particle-4 { animation-delay: 0.03s; --tx:  48px; --ty: -48px; }
.particle-5 { animation-delay: 0.06s; --tx: -60px; --ty: -36px; }
.particle-6 { animation-delay: 0.02s; --tx:  28px; --ty: -64px; }

@keyframes particle-fly {
  0%   { opacity: 1; transform: translate(-50%, 0) scale(0.3) rotate(0deg); }
  50%  { opacity: 1; }
  100% { opacity: 0; transform: translate(calc(-50% + var(--tx)), var(--ty)) scale(1.1) rotate(280deg); }
}
</style>
