<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getSettings } from '@/firebase/firestore'
import LanguageToggle from '@/components/ui/LanguageToggle.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const identifier = ref('')
const formError  = ref('')
const settings   = ref({})

onMounted(async () => {
  settings.value = await getSettings()
})

const submit = async () => {
  formError.value = ''
  if (!identifier.value.trim()) { formError.value = t('login.errors.emptyIdentifier'); return }

  const ok = await auth.login(identifier.value.trim(), '')
  if (ok) {
    router.push({ name: 'Intro', state: { settings: JSON.stringify(settings.value) } })
  } else if (auth.error === 'NOT_ON_LIST') {
    formError.value = t('login.notOnList')
  } else {
    formError.value = auth.error
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col">
    <!-- Header -->
    <div class="flex justify-between items-center px-6 py-4">
      <div class="flex items-center gap-2">
        <div class="w-10 h-10 rounded-full overflow-hidden shrink-0">
          <img src="@/assets/logoMerotz.png" alt="logo" class="w-full h-full object-cover" />
        </div>
        <span class="font-bold text-amber-400 text-xl" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">{{ t('app.name') }}</span>
      </div>
      <LanguageToggle />
    </div>

    <!-- Hero -->
    <div class="flex-1 flex flex-col items-center justify-center px-4 py-8">
      <div class="mb-8 text-center animate-fade-in">
        <!-- ISA logo -->
        <img src="@/assets/Logo_israel_securities_authority.png"
             alt="Israel Securities Authority"
             class="mx-auto mb-5"
             style="max-width: 220px; height: auto;" />
        <h1 class="text-3xl font-bold text-white mb-1"
            style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
          {{ t('login.title') }}
        </h1>
        <p class="text-slate-400 text-sm">{{ settings.eventName || t('app.tagline') }}</p>
      </div>

      <!-- Login card -->
      <div class="w-full max-w-sm animate-slide-up">
        <div class="card-glow space-y-5">

          <!-- Identifier input -->
          <div>
            <label class="block text-sm font-semibold text-slate-300 mb-2">{{ t('login.identifierLabel') }}</label>
            <input
              v-model="identifier"
              type="tel"
              inputmode="numeric"
              class="input-field text-lg font-semibold"
              :placeholder="t('login.identifierPlaceholder')"
              @keyup.enter="submit"
              maxlength="20"
              autocomplete="tel"
            />
          </div>

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
            <span v-else>{{ t('login.submit') }}</span>
          </button>
        </div>

        <!-- Admin link -->
        <div class="text-center mt-4">
          <RouterLink to="/admin" class="text-xs text-slate-600 hover:text-slate-400 transition-colors">Admin</RouterLink>
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
