<script setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGameStore } from '@/stores/game'
import LanguageToggle from '@/components/ui/LanguageToggle.vue'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const game = useGameStore()

const logout = () => {
  game.cleanup()
  auth.logout()
  router.push({ name: 'Login' })
}
</script>

<template>
  <nav class="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-700/50 px-4 py-3">
    <div class="max-w-lg mx-auto flex items-center justify-between gap-3">
      <!-- Logo -->
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center font-black text-slate-900 text-sm">TR</div>
        <span class="font-bold text-amber-400 text-lg hidden sm:block">TeamRush</span>
      </div>

      <!-- Center: team info -->
      <div v-if="auth.isLoggedIn" class="flex flex-col items-center">
        <span class="text-xs text-slate-400">{{ auth.pseudo }}</span>
        <div class="flex items-center gap-2 text-sm font-semibold text-amber-400">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          {{ game.totalPoints }}
        </div>
      </div>

      <!-- Right: language + nav links -->
      <div class="flex items-center gap-2">
        <RouterLink to="/leaderboard" class="btn-ghost py-1.5 px-3 flex items-center gap-1.5">
          <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
          <span class="text-sm hidden sm:inline">{{ t('nav.leaderboard') }}</span>
        </RouterLink>
        <LanguageToggle />
        <button v-if="auth.isLoggedIn" @click="logout" class="btn-ghost text-sm py-1.5 px-3 text-red-400 hover:text-red-300">
          {{ t('nav.logout') }}
        </button>
      </div>
    </div>
  </nav>
</template>
