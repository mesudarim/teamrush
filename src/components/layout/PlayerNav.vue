<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGameStore } from '@/stores/game'
import { useGameContextStore } from '@/stores/gameContext'
import LanguageToggle from '@/components/ui/LanguageToggle.vue'
import TutorialOverlay from '@/components/ui/TutorialOverlay.vue'
import { useTutorial } from '@/composables/useTutorial'
import defaultLogo from '@/assets/logoMerotz.png'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const game = useGameStore()
const gameCtx = useGameContextStore()

const showMenu        = ref(false)
const showExitModal   = ref(false)
const showInfoModal   = ref(false)
const showTutorial    = ref(false)
const exiting         = ref(false)

const { getSteps } = useTutorial()
const tutorialSteps = computed(() => getSteps(game.phase))
watch(() => game.phase, () => { showTutorial.value = false })

const closeMenu = () => { showMenu.value = false }

const openInfo     = () => { closeMenu(); showInfoModal.value  = true }
const openExit     = () => { closeMenu(); showExitModal.value  = true }
const openTutorial = () => { closeMenu(); showTutorial.value   = true }

const confirmExit = async () => {
  exiting.value = true
  const currentDay = auth.team?.day ?? 1
  game.cleanup()
  await auth.resetAndLogout()
  exiting.value = false
  showExitModal.value = false
  router.push({ name: currentDay === 2 ? 'LoginDay2' : 'Login' })
}
</script>

<template>
  <!-- ── Sticky bar ─────────────────────────────────────────────────────────── -->
  <nav class="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-700/50">
    <div class="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">

      <!-- Hamburger -->
      <button
        @click="showMenu = !showMenu"
        :class="['w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                 showMenu ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-300']"
        aria-label="Menu"
      >
        <!-- X when open, bars when closed -->
        <svg v-if="showMenu" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>

      <!-- Participant name (center) -->
      <div v-if="auth.isLoggedIn" class="flex-1 text-center">
        <span class="text-sm font-semibold text-slate-300 truncate">
          {{ auth.team?.displayName || auth.pseudo }}
        </span>
      </div>
      <div v-else class="flex-1" />

      <!-- Logo -->
      <div class="w-10 h-10 shrink-0">
        <img :src="gameCtx.logoUrl || defaultLogo" alt="logo" class="w-full h-full object-contain" />
      </div>

    </div>

    <!-- ── Dropdown menu (slides down below the bar) ─────────────────────── -->
    <Transition name="menu-slide">
      <div v-if="showMenu" class="border-t border-slate-700/60 bg-slate-900/98">
        <div class="max-w-lg mx-auto px-4 py-2 space-y-0.5">

          <!-- Leaderboard -->
          <RouterLink
            to="/leaderboard"
            @click="closeMenu"
            class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <svg class="w-5 h-5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            <span class="font-semibold">{{ t('nav.leaderboard') }}</span>
          </RouterLink>

          <!-- Language -->
          <div class="flex items-center gap-3 px-4 py-3 rounded-xl">
            <svg class="w-5 h-5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>
            </svg>
            <span class="font-semibold text-slate-300">{{ $i18n.locale === 'en' ? 'Language' : 'שפה' }}</span>
            <div class="ms-auto"><LanguageToggle /></div>
          </div>

          <!-- Phone -->
          <a
            href="tel:+972526630434"
            @click="closeMenu"
            class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-green-400 hover:text-green-300 transition-colors"
          >
            <svg class="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V21a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.01l-2.2 2.21z"/>
            </svg>
            <span class="font-semibold">{{ $i18n.locale === 'en' ? 'Call for help' : 'התקשר לעזרה' }}</span>
          </a>

          <!-- Info tip -->
          <button
            @click="openInfo"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="font-semibold">{{ $i18n.locale === 'en' ? 'Game tip' : 'טיפ למשחק' }}</span>
          </button>

          <!-- Screen tutorial (only shown when there are steps for the current phase) -->
          <button
            v-if="tutorialSteps.length"
            @click="openTutorial"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="font-semibold">{{ $i18n.locale === 'en' ? 'How does this screen work?' : 'מה עושים פה?' }}</span>
          </button>

          <!-- Divider -->
          <div class="border-t border-slate-700 !my-2" />

          <!-- Exit (hidden on end screens — scores are locked, no reset allowed) -->
          <button
            v-if="auth.isLoggedIn && game.phase !== 'day1complete' && game.phase !== 'finished'"
            @click="openExit"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors mb-1"
          >
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            <span class="font-semibold">{{ t('nav.logout') }}</span>
          </button>

        </div>
      </div>
    </Transition>
  </nav>

  <!-- ── Click-outside backdrop (closes menu) ──────────────────────────────── -->
  <Teleport to="body">
    <div
      v-if="showMenu"
      class="fixed inset-0 z-30"
      @click="closeMenu"
    />
  </Teleport>

  <!-- ── Tutorial overlay ─────────────────────────────────────────────────── -->
  <Teleport to="body">
    <TutorialOverlay
      v-if="showTutorial"
      :steps="tutorialSteps"
      :locale="$i18n.locale"
      @close="showTutorial = false"
    />
  </Teleport>

  <!-- ── Info modal ────────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showInfoModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
        @click.self="showInfoModal = false"
      >
        <div class="card max-w-sm w-full space-y-4">
          <div class="flex items-center gap-3">
            <span class="text-3xl">💡</span>
            <h3 class="font-black text-white text-lg" dir="rtl">טיפ חשוב למשחק</h3>
          </div>
          <p
            class="text-slate-200 text-base leading-relaxed"
            dir="rtl"
            style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;"
          >
            במהלך המשימות אתם תתבקשו להגיע למקומות שונים ומפתיעים שאתם לא מכירים ברחבי המלון. אל תתביישו – אתם תצטרכו לשאול אנשים בדרך כדי למצוא את הנתיב הנכון! כל המשחק מתרחש אך ורק בתוך שטחי המלון ובאזורים הצמודים אליו.
          </p>
          <button @click="showInfoModal = false" class="btn-primary w-full">
            {{ $i18n.locale === 'en' ? 'Got it!' : '!הבנתי' }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Exit confirmation modal ───────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showExitModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
        @click.self="showExitModal = false"
      >
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
                ? ($i18n.locale === 'en' ? 'Exiting...' : '...יוצא')
                : ($i18n.locale === 'en' ? 'Exit & reset' : 'צא ואפס') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.menu-slide-enter-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.menu-slide-leave-active { transition: opacity 0.14s ease, transform 0.14s ease; }
.menu-slide-enter-from, .menu-slide-leave-to { opacity: 0; transform: translateY(-6px); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
