<script setup>
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'

const { t } = useI18n()
const game = useGameStore()
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">

    <!-- Trophy -->
    <div class="text-8xl mb-6">🌙</div>

    <!-- Title -->
    <h1 class="text-3xl font-bold text-amber-400 mb-3"
        style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
      {{ t('game.day1complete.title') }}
    </h1>

    <p class="text-slate-300 text-lg mb-6 leading-relaxed"
       style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
      {{ t('game.day1complete.subtitle') }}
    </p>

    <!-- Day 1 score -->
    <div class="bg-slate-800 border border-amber-500/30 rounded-2xl px-8 py-5 mb-6">
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
</template>
