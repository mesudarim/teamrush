<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import { useGameContextStore } from '@/stores/gameContext'
import { getCheckpoint, getSettings } from '@/firebase/firestore'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import PointsPopup from '@/components/ui/PointsPopup.vue'
import LanguageToggle from '@/components/ui/LanguageToggle.vue'
import PhaseEnvelope1    from '@/components/game/PhaseEnvelope1.vue'
import PhaseStage1       from '@/components/game/PhaseStage1.vue'
import CelebrationScreen from '@/components/game/CelebrationScreen.vue'
import PhaseEnvelope2    from '@/components/game/PhaseEnvelope2.vue'
import PhaseStage2       from '@/components/game/PhaseStage2.vue'
import PhaseResult       from '@/components/game/PhaseResult.vue'

const { t, locale } = useI18n()
const route = useRoute()
const game = useGameStore()
const gameCtx = useGameContextStore()

const isLoading = ref(true)
const loadError = ref(null)
const checkpoint = ref(null)

const initStore = (cp) => {
  game.checkpoints = [cp]
  game.currentCheckpoint = cp
  game.phase = 'envelope1'
  game.currentQuestionIndex = 0
  game.checkpointDelta = 0
  game.lastPointsDelta = 0
  game.stage2Result = null
  game.isLoading = false
  game.error = null
}

const restart = () => {
  if (checkpoint.value) initStore(checkpoint.value)
}

onMounted(async () => {
  const gameId = route.params.gameId
  const cpId   = route.params.cpId
  gameCtx.setGame(gameId)
  try {
    const [cp, settings] = await Promise.all([
      getCheckpoint(gameId, cpId),
      getSettings(gameId),
    ])
    if (!cp) { loadError.value = 'Checkpoint not found'; return }
    checkpoint.value = cp
    game.gameSettings = settings
    initStore(cp)
  } catch (e) {
    loadError.value = e.message
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => game.cleanup())
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col pb-24">

    <!-- Preview banner -->
    <div class="sticky top-0 z-50 flex items-center justify-between gap-2 px-4 py-2 bg-amber-500 text-slate-900 text-xs font-black shrink-0">
      <span>🔬 PREVIEW — ללא שמירה בפיירבייס</span>
      <div class="flex items-center gap-2">
        <LanguageToggle />
        <button @click="restart"
                class="px-3 py-1 rounded-lg bg-slate-900/20 hover:bg-slate-900/30 transition-colors whitespace-nowrap">
          ↺ אתחל
        </button>
      </div>
    </div>

    <PointsPopup />

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="flex-1 flex items-center justify-center p-4">
      <div class="card max-w-sm w-full text-center">
        <p class="text-red-400 mb-2">⚠️ {{ loadError }}</p>
        <p class="text-xs text-slate-500 mt-1">{{ route.params.cpId }}</p>
      </div>
    </div>

    <!-- Game phases — identical to GameView -->
    <template v-else>
      <div class="flex-1 flex flex-col">
        <Transition name="phase">
          <PhaseEnvelope1    v-if="game.phase === 'envelope1'"            key="env1" />
          <PhaseStage1       v-else-if="game.phase === 'stage1'"          key="st1" />
          <CelebrationScreen v-else-if="game.phase === 'bravo'"           key="bravo" />
          <PhaseEnvelope2    v-else-if="game.phase === 'envelope2'"        key="env2" />
          <PhaseStage2       v-else-if="game.phase === 'stage2'"          key="st2" />
          <PhaseResult       v-else-if="game.phase === 'result'"          key="res" />
          <!-- End state: preview complete -->
          <div v-else
               class="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4"
               key="done">
            <div class="text-5xl">✅</div>
            <p class="text-xl font-black text-green-400">Preview terminé</p>
            <p class="text-slate-400 text-sm">Aucune donnée n'a été sauvegardée</p>
            <button @click="restart" class="btn-primary px-8 mt-2">↺ Recommencer</button>
          </div>
        </Transition>
      </div>

      <!-- Bottom bar — same as GameView -->
      <div v-if="game.checkpoints.length"
           class="fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 backdrop-blur border-t border-slate-700/60">
        <div class="max-w-lg mx-auto px-4 pt-2 pb-3">

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
            <div v-if="game.currentCheckpoint && game.phase !== 'envelope1'"
                 class="flex-1 text-center min-w-0 px-1">
              <div class="font-bold text-amber-400 leading-tight truncate"
                   style="font-size: clamp(1.2rem, 5vw, 1.7rem);">
                {{ (locale === 'en' && game.currentCheckpoint.titleEn)
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
            <span>{{ t('game.checkpoint') }} 1 / 1</span>
            <span>{{ game.phase === 'envelope1' ? 0 : 100 }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill"
                 :style="{ width: game.phase === 'envelope1' ? '0%' : '100%' }" />
          </div>

        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.phase-enter-active { animation: slide-up 0.35s ease-out; }
.phase-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.phase-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
