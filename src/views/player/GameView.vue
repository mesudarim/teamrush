<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'
import PlayerNav from '@/components/layout/PlayerNav.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import PhaseEnvelope1    from '@/components/game/PhaseEnvelope1.vue'
import PhaseStage1       from '@/components/game/PhaseStage1.vue'
import CelebrationScreen from '@/components/game/CelebrationScreen.vue'
import PhaseEnvelope2    from '@/components/game/PhaseEnvelope2.vue'
import PhaseStage2       from '@/components/game/PhaseStage2.vue'
import PhaseResult       from '@/components/game/PhaseResult.vue'
import PhaseFinished     from '@/components/game/PhaseFinished.vue'

const { t } = useI18n()
const game = useGameStore()
const auth = useAuthStore()

onMounted(() => game.loadTrack())
onUnmounted(() => game.cleanup())
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col">
    <PlayerNav />

    <!-- Timer + points + progress bar -->
    <div v-if="!game.isLoading && game.checkpoints.length" class="bg-slate-900 border-b border-slate-800">
      <div class="max-w-lg mx-auto px-4 pt-3 pb-2">

        <!-- Timer + Points row -->
        <div class="flex items-end justify-between mb-2">
          <!-- Timer — large and centered -->
          <div class="flex-1 text-center">
            <div class="tabular-nums font-black text-white leading-none" style="font-size: clamp(2.4rem, 10vw, 3.5rem); letter-spacing: 0.04em;">
              {{ game.formatTime(game.elapsedSeconds) }}
            </div>
            <div class="text-xs text-slate-500 mt-0.5 tracking-wider uppercase">⏱ {{ t('game.timer') }}</div>
          </div>
          <!-- Points — right side -->
          <div class="text-end min-w-[70px]">
            <div class="text-2xl font-black text-amber-400 tabular-nums leading-none">{{ game.totalPoints }}</div>
            <div class="text-xs text-slate-500 mt-0.5 tracking-wider uppercase">⭐ {{ t('game.points') }}</div>
          </div>
        </div>

        <!-- Checkpoint label + progress bar -->
        <div class="flex justify-between text-xs text-slate-400 mb-1">
          <span>{{ t('game.checkpoint') }} {{ game.currentIndex + 1 }} / {{ game.checkpoints.length }}</span>
          <span>{{ Math.round(game.progress) }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: game.progress + '%' }" />
        </div>

      </div>
    </div>

    <!-- Main content -->
    <div class="flex-1 flex flex-col">
      <div v-if="game.isLoading" class="flex-1 flex items-center justify-center">
        <div class="text-center space-y-3">
          <LoadingSpinner size="lg" />
          <p class="text-slate-400 text-sm">{{ t('common.loading') }}</p>
        </div>
      </div>

      <div v-else-if="game.error" class="flex-1 flex items-center justify-center p-4">
        <div class="card max-w-sm w-full text-center">
          <p class="text-red-400 mb-4">{{ game.error }}</p>
          <button class="btn-secondary" @click="game.loadTrack()">Retry</button>
        </div>
      </div>

      <template v-else>
        <Transition name="phase" mode="out-in">
          <PhaseEnvelope1    v-if="game.phase === 'envelope1'"  :key="'env1-' + game.currentIndex" />
          <PhaseStage1       v-else-if="game.phase === 'stage1'"    :key="'st1-' + game.currentIndex" />
          <CelebrationScreen v-else-if="game.phase === 'bravo'"     :key="'bravo-' + game.currentIndex" />
          <PhaseEnvelope2    v-else-if="game.phase === 'envelope2'"  :key="'env2-' + game.currentIndex" />
          <PhaseStage2       v-else-if="game.phase === 'stage2'"    :key="'st2-' + game.currentIndex" />
          <PhaseResult       v-else-if="game.phase === 'result'"    :key="'res-' + game.currentIndex" />
          <PhaseFinished     v-else-if="game.phase === 'finished'"  key="finished" />
        </Transition>
      </template>
    </div>
  </div>
</template>

<style scoped>
.phase-enter-active { animation: slide-up 0.35s ease-out; }
.phase-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.phase-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
