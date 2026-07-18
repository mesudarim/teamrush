<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGameContextStore } from '@/stores/gameContext'
import { getSettings } from '@/firebase/firestore'
import LanguageToggle from '@/components/ui/LanguageToggle.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import defaultLogo from '@/assets/logoMerotz.png'

const { t, locale } = useI18n()
const router  = useRouter()
const route   = useRoute()
const auth    = useAuthStore()
const gameCtx = useGameContextStore()

const isDay2   = computed(() => route.name === 'LoginDay2')
const dayLabel = computed(() => isDay2.value
  ? (locale.value === 'en' ? 'Day 2' : 'יום 2')
  : (locale.value === 'en' ? 'Day 1' : 'יום 1')
)

const identifier = ref('')  // used for list mode (phone)
const pseudo     = ref('')  // used for open mode
const formError  = ref('')
const settings   = ref({})

const isOpenMode = computed(() => settings.value.registrationMode === 'open')

// List mode: phone digits only
const onPhoneInput = (e) => {
  const raw    = e.target.value
  const digits = raw.replace(/\D/g, '')
  identifier.value = digits
  if (digits.length < raw.length) {
    formError.value = t('login.errors.digitsOnly')
  } else if (formError.value === t('login.errors.digitsOnly')) {
    formError.value = ''
  }
}

onMounted(async () => {
  settings.value = await getSettings(gameCtx.gameId)
})

const goToGame = () => {
  router.push({ name: 'Intro', params: { gameId: gameCtx.gameId }, state: { settings: JSON.stringify(settings.value) } })
}

// List mode submit
const submitList = async () => {
  formError.value = ''
  if (!identifier.value.trim()) { formError.value = t('login.errors.emptyIdentifier'); return }
  const ok = await auth.login(identifier.value.trim(), '', isDay2.value ? 2 : 1)
  if (ok) {
    goToGame()
  } else if (auth.error === 'NOT_ON_LIST') {
    formError.value = t('login.notOnList')
  } else if (auth.error === 'DAY1_ALREADY_FINISHED') {
    formError.value = t('login.errors.day1AlreadyFinished')
  } else if (auth.error === 'DAY2_ALREADY_FINISHED') {
    formError.value = t('login.errors.day2AlreadyFinished')
  } else {
    formError.value = auth.error
  }
}

// Open mode submit
const submitOpen = async () => {
  formError.value = ''
  if (!pseudo.value.trim()) { formError.value = t('login.errors.emptyPseudo'); return }
  if (pseudo.value.trim().length < 2) { formError.value = t('login.errors.pseudoTooShort'); return }
  const ok = await auth.loginOpen(pseudo.value, isDay2.value ? 2 : 1)
  if (ok) {
    goToGame()
  } else if (auth.error === 'INVALID_PSEUDO') {
    formError.value = t('login.errors.invalidPseudo')
  } else if (auth.error === 'DAY1_ALREADY_FINISHED') {
    formError.value = t('login.errors.day1AlreadyFinished')
  } else if (auth.error === 'DAY2_ALREADY_FINISHED') {
    formError.value = t('login.errors.day2AlreadyFinished')
  } else {
    formError.value = auth.error
  }
}

const submit = () => isOpenMode.value ? submitOpen() : submitList()
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col">
    <!-- Header -->
    <div class="flex justify-between items-center px-6 py-4">
      <div class="flex items-center gap-2">
        <div class="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-slate-800 flex items-center justify-center">
          <img :src="gameCtx.logoUrl || defaultLogo" alt="logo" class="w-full h-full object-contain p-0.5" />
        </div>
        <span class="font-bold text-amber-400 text-xl" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
          {{ (locale === 'en' ? gameCtx.appTitleEn : gameCtx.appTitle) || gameCtx.gameName || t('app.name') }}
        </span>
      </div>
      <LanguageToggle />
    </div>

    <!-- Hero -->
    <div class="flex-1 flex flex-col items-center justify-center px-4 py-8">
      <div class="mb-8 text-center animate-fade-in">
        <img v-if="gameCtx.logoUrl"
             :src="gameCtx.logoUrl"
             alt="logo"
             class="mx-auto mb-5"
             style="max-width: 180px; max-height: 120px; object-fit: contain;" />
        <h1 class="text-3xl font-bold text-white"
            style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
          {{ t('login.title') }}
        </h1>
        <p class="text-slate-400 text-sm mt-2">{{ settings.eventName || t('app.tagline') }}</p>
        <div class="flex items-center justify-center mt-4">
          <span class="px-4 py-1 rounded-full text-sm font-bold"
                :class="isDay2 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'">
            {{ dayLabel }}
          </span>
        </div>
      </div>

      <!-- Login card -->
      <div class="w-full max-w-sm animate-slide-up">
        <div class="card-glow space-y-5">

          <!-- ── Open mode: pseudo libre ── -->
          <template v-if="isOpenMode">
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-2">
                {{ t('login.openPseudoLabel') }}
              </label>
              <input
                v-model="pseudo"
                @keyup.enter="submit"
                type="text"
                class="input-field text-lg font-semibold"
                :placeholder="t('login.openPseudoPlaceholder')"
                maxlength="40"
                autocomplete="off"
              />
              <p class="text-xs text-slate-500 mt-1.5">{{ t('login.openPseudoHint') }}</p>
            </div>
          </template>

          <!-- ── List mode: identifiant (téléphone) ── -->
          <template v-else>
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-2">{{ t('login.identifierLabel') }}</label>
              <input
                :value="identifier"
                @input="onPhoneInput"
                @keyup.enter="submit"
                type="tel"
                inputmode="numeric"
                pattern="[0-9]*"
                class="input-field text-lg font-semibold"
                :placeholder="t('login.identifierPlaceholder')"
                maxlength="15"
                autocomplete="tel"
              />
            </div>
          </template>

          <!-- Error -->
          <Transition name="slide-down">
            <div v-if="formError" class="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              {{ formError }}
            </div>
          </Transition>

          <!-- Submit -->
          <button
            @click="submit"
            :disabled="auth.isLoading"
            class="btn-primary w-full text-base py-4"
          >
            <span v-if="auth.isLoading" class="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" /> {{ t('login.loading') }}
            </span>
            <span v-else>{{ t(isOpenMode ? 'login.joinBtn' : 'login.submit') }}</span>
          </button>
        </div>

        <!-- Admin link -->
        <div class="text-center mt-4">
          <RouterLink
            :to="`/g/${gameCtx.gameId}/admin`"
            class="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Admin
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-center py-4">
      <a href="https://eifoany.web.app/" target="_blank" rel="noopener noreferrer"
         class="text-sm text-slate-500 hover:text-slate-300 transition-colors">
        by eifoany
      </a>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.2s; }
.slide-down-enter-from, .slide-down-leave-to { transform: translateY(-8px); opacity: 0; }
</style>
