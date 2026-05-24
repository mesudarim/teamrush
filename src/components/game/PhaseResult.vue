<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'

const { t } = useI18n()
const game = useGameStore()

const correct = computed(() => game.stage2Result === 'correct')
const points = computed(() => Math.abs(game.lastPointsDelta))
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full">
    <div class="w-full text-center animate-bounce-in">
      <div class="card space-y-6">
        <!-- Big icon -->
        <div
          :class="[
            'w-24 h-24 mx-auto rounded-full flex items-center justify-center text-5xl',
            correct ? 'bg-green-500/20 border-2 border-green-500/40' : 'bg-red-500/20 border-2 border-red-500/40'
          ]"
        >
          {{ correct ? '🏆' : '😬' }}
        </div>

        <!-- Message -->
        <div>
          <h2
            :class="['text-2xl font-black mb-2', correct ? 'text-green-400' : 'text-red-400']"
          >
            {{ correct
              ? t('game.stage2.correct', { points })
              : t('game.stage2.wrong', { points }) }}
          </h2>
          <p class="text-slate-400 text-sm">{{ t('game.points') }}: {{ game.totalPoints }}</p>
        </div>

        <!-- Next button -->
        <button @click="game.advanceToNext()" class="btn-primary w-full text-lg py-4">
          {{ t('game.stage2.next') }} →
        </button>
      </div>
    </div>
  </div>
</template>
