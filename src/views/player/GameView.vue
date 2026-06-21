<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'
import PlayerNav from '@/components/layout/PlayerNav.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import PointsPopup from '@/components/ui/PointsPopup.vue'
import PhaseEnvelope1    from '@/components/game/PhaseEnvelope1.vue'
import PhaseStage1       from '@/components/game/PhaseStage1.vue'
import CelebrationScreen from '@/components/game/CelebrationScreen.vue'
import PhaseEnvelope2    from '@/components/game/PhaseEnvelope2.vue'
import PhaseStage2       from '@/components/game/PhaseStage2.vue'
import PhaseResult       from '@/components/game/PhaseResult.vue'
import PhaseFinished     from '@/components/game/PhaseFinished.vue'
import PhaseDay1Complete from '@/components/game/PhaseDay1Complete.vue'
import PhaseTapis        from '@/components/game/PhaseTapis.vue'

const { t } = useI18n()
const game = useGameStore()
const auth = useAuthStore()

// ── Back button prevention ────────────────────────────────────────────────────
const blockBack = () => {
  history.pushState(null, '', window.location.pathname)
}

watch(() => game.phase, () => { window.scrollTo({ top: 0 }) })

onMounted(() => {
  game.loadTrack()
  history.pushState(null, '', window.location.pathname)
  window.addEventListener('popstate', blockBack)
})

onUnmounted(() => {
  window.removeEventListener('popstate', blockBack)
  game.cleanup()
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col pb-24">
    <PointsPopup />
    <PlayerNav />

    <!-- Bridging overlay: stays visible between PhaseTapis unmount and PhaseFinished mount -->
    <Transition name="finish-overlay">
      <div v-if="game.finishingGame"
           class="fixed inset-0 z-40 bg-slate-900 flex items-center justify-center pointer-events-none">
        <LoadingSpinner size="lg" />
      </div>
    </Transition>

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
        <Transition name="phase">
          <PhaseEnvelope1    v-if="game.phase === 'envelope1'"  :key="'env1-' + game.currentIndex" />
          <PhaseStage1       v-else-if="game.phase === 'stage1'"    :key="'st1-' + game.currentIndex" />
          <CelebrationScreen v-else-if="game.phase === 'bravo'"     :key="'bravo-' + game.currentIndex" />
          <PhaseEnvelope2    v-else-if="game.phase === 'envelope2'"  :key="'env2-' + game.currentIndex" />
          <PhaseStage2       v-else-if="game.phase === 'stage2'"    :key="'st2-' + game.currentIndex" />
          <PhaseResult       v-else-if="game.phase === 'result'"    :key="'res-' + game.currentIndex" />
          <PhaseTapis        v-else-if="game.phase === 'tapis'"        key="tapis" />
          <PhaseFinished     v-else-if="game.phase === 'finished'"     key="finished" />
          <PhaseDay1Complete v-else-if="game.phase === 'day1complete'" key="day1complete" />
        </Transition>
      </template>
    </div>

    <!-- ── Fixed bottom bar ── -->
    <div
      v-if="!game.isLoading && game.checkpoints.length && game.phase !== 'finished'"
      class="fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 backdrop-blur border-t border-slate-700/60"
    >
      <div class="max-w-lg mx-auto px-4 pt-2 pb-3">

        <!-- Timer · Checkpoint name · Points -->
        <div class="flex items-center justify-between gap-2 mb-1.5">

          <!-- Timer -->
          <div class="text-center shrink-0">
            <div class="tabular-nums font-black text-white leading-none"
                 style="font-size: clamp(1.4rem, 5.5vw, 1.9rem); letter-spacing: 0.03em;">
              {{ game.formatTime(game.elapsedSeconds) }}
            </div>
            <div class="text-xs text-slate-500 tracking-wider uppercase">⏱ {{ t('game.timer') }}</div>
          </div>

          <!-- Checkpoint name — hidden during envelope1 (spoiler) -->
          <div v-if="game.currentCheckpoint && game.phase !== 'envelope1'" class="flex-1 text-center min-w-0 px-1">
            <div class="font-bold text-amber-400 leading-tight truncate"
                 style="font-size: clamp(1.2rem, 5vw, 1.7rem); font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
              {{ ($i18n.locale === 'en' && game.currentCheckpoint.titleEn)
                  ? game.currentCheckpoint.titleEn
                  : game.currentCheckpoint.title }}
            </div>
          </div>

          <!-- Points -->
          <div class="text-end shrink-0">
            <div class="font-black text-amber-400 tabular-nums leading-none"
                 style="font-size: clamp(1.4rem, 5.5vw, 1.9rem);">
              {{ game.totalPoints }}
            </div>
            <div class="text-xs text-slate-500 tracking-wider uppercase">⭐ {{ t('game.points') }}</div>
          </div>

        </div>

        <!-- Progress bar -->
        <div class="flex justify-between text-xs text-slate-500 mb-1">
          <span>{{ t('game.checkpoint') }} {{ game.currentIndex + 1 }} / {{ game.checkpoints.length }}</span>
          <span>{{ Math.round(game.progress) }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: game.progress + '%' }" />
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.phase-enter-active { animation: slide-up 0.35s ease-out; }
.phase-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.phase-leave-to { opacity: 0; transform: translateY(-10px); }

/* Bridging overlay fades out once PhaseFinished is mounted */
.finish-overlay-leave-active { transition: opacity 0.5s ease; }
.finish-overlay-leave-to { opacity: 0; }
</style>
