<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGameStore } from '@/stores/game'
import LanguageToggle from '@/components/ui/LanguageToggle.vue'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const game = useGameStore()

const showExitModal = ref(false)
const exiting = ref(false)

const confirmExit = async () => {
  exiting.value = true
  game.cleanup()
  await auth.resetAndLogout()
  exiting.value = false
  showExitModal.value = false
  router.push({ name: 'Login' })
}
</script>

<template>
  <nav class="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-700/50 px-4 py-3">
    <div class="max-w-lg mx-auto flex items-center justify-between gap-3">
      <!-- Logo -->
      <div class="flex items-center gap-2">
        <div class="w-10 h-10 rounded-full overflow-hidden shrink-0">
          <img src="@/assets/logoMerotz.png" alt="logo" class="w-full h-full object-cover" />
        </div>
        <span class="font-bold text-amber-400 text-lg hidden sm:block">{{ t('app.name') }}</span>
      </div>

      <!-- Center: team name -->
      <div v-if="auth.isLoggedIn" class="flex flex-col items-center">
        <span class="text-sm font-semibold text-slate-300">{{ auth.team?.displayName || auth.pseudo }}</span>
      </div>

      <!-- Right: language + nav links -->
      <div class="flex items-center gap-2">
        <RouterLink to="/leaderboard" class="btn-ghost py-1.5 px-3 flex items-center gap-1.5">
          <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
          <span class="text-sm hidden sm:inline">{{ t('nav.leaderboard') }}</span>
        </RouterLink>
        <a href="tel:+972526630434"
           class="btn-ghost py-1.5 px-2 flex items-center justify-center text-green-400 hover:text-green-300"
           aria-label="Call organiser">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V21a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.01l-2.2 2.21z"/>
          </svg>
        </a>
        <LanguageToggle />
        <button v-if="auth.isLoggedIn" @click="showExitModal = true"
                class="btn-ghost text-sm py-1.5 px-3 text-red-400 hover:text-red-300">
          {{ t('nav.logout') }}
        </button>
      </div>
    </div>
  </nav>

  <!-- Exit warning modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showExitModal"
           class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
           @click.self="showExitModal = false">
        <div class="card max-w-sm w-full text-center space-y-4">
          <div class="text-4xl">⚠️</div>
          <h3 class="font-black text-white text-lg">
            {{ $i18n.locale === 'en' ? 'Exit the game?' : 'לצאת מהמשחק?' }}
          </h3>
          <p class="text-slate-300 text-sm leading-relaxed">
            {{ $i18n.locale === 'en'
              ? 'If you exit, your progress will be reset and you will have to start the game from the beginning.'
              : 'אם תצאו, ההתקדמות שלכם תאופס ותצטרכו להתחיל את המשחק מחדש מההתחלה.' }}
          </p>
          <div class="flex gap-3">
            <button @click="showExitModal = false" class="btn-secondary flex-1">
              {{ $i18n.locale === 'en' ? 'Stay' : 'המשך משחק' }}
            </button>
            <button @click="confirmExit" :disabled="exiting" class="btn-danger flex-1">
              {{ exiting
                ? ($i18n.locale === 'en' ? 'Exiting...' : 'יוצא...')
                : ($i18n.locale === 'en' ? 'Exit & reset' : 'צא ואפס') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
