<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getActiveTracks, getSettings } from '@/firebase/firestore'
import LanguageToggle from '@/components/ui/LanguageToggle.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const identifier = ref('')
const selectedTrack = ref('')
const tracks = ref([])
const tracksLoading = ref(true)
const formError = ref('')
const settings = ref({})

onMounted(async () => {
  try {
    [tracks.value, settings.value] = await Promise.all([getActiveTracks(), getSettings()])
  } finally {
    tracksLoading.value = false
  }
})

const submit = async () => {
  formError.value = ''
  if (!identifier.value.trim()) { formError.value = t('login.errors.emptyIdentifier'); return }
  if (!selectedTrack.value) { formError.value = t('login.errors.emptyTrack'); return }

  const ok = await auth.login(identifier.value.trim(), selectedTrack.value)
  if (ok) {
    router.push({ name: 'Intro' })
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
        <div class="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center font-black text-slate-900">TR</div>
        <span class="font-black text-amber-400 text-xl">TeamRush</span>
      </div>
      <LanguageToggle />
    </div>

    <!-- Hero -->
    <div class="flex-1 flex flex-col items-center justify-center px-4 py-8">
      <div class="mb-8 text-center animate-fade-in">
        <div class="w-24 h-24 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/30">
          <span class="text-4xl font-black text-slate-900">TR</span>
        </div>
        <h1 class="text-3xl font-black text-white mb-1">{{ t('login.title') }}</h1>
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
              type="text"
              class="input-field text-lg font-semibold"
              :placeholder="t('login.identifierPlaceholder')"
              @keyup.enter="submit"
              maxlength="80"
              autocomplete="name"
            />
          </div>

          <!-- Track selector -->
          <div>
            <label class="block text-sm font-semibold text-slate-300 mb-2">{{ t('login.trackLabel') }}</label>
            <div v-if="tracksLoading" class="flex justify-center py-3">
              <LoadingSpinner size="sm" />
            </div>
            <div v-else-if="tracks.length === 0" class="text-center py-3 text-slate-400 text-sm">
              {{ t('login.noTracks') }}
            </div>
            <div v-else class="grid gap-2">
              <button
                v-for="track in tracks"
                :key="track.id"
                @click="selectedTrack = track.id"
                :class="[
                  'w-full text-start px-4 py-3 rounded-xl border-2 transition-all font-semibold',
                  selectedTrack === track.id
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                ]"
              >
                <div class="flex items-center justify-between">
                  <span>{{ $i18n.locale === 'en' && track.nameEn ? track.nameEn : track.name }}</span>
                  <div v-if="selectedTrack === track.id" class="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                    <svg class="w-3 h-3 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                </div>
                <p v-if="track.description" class="text-xs text-slate-400 mt-0.5 font-normal">{{ track.description }}</p>
              </button>
            </div>
          </div>

          <!-- Error -->
          <Transition name="slide-down">
            <div v-if="formError" class="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
              {{ formError }}
            </div>
          </Transition>

          <!-- Submit -->
          <button
            @click="submit"
            :disabled="auth.isLoading || tracks.length === 0"
            class="btn-primary w-full text-base py-4"
          >
            <span v-if="auth.isLoading" class="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" /> {{ t('login.loading') }}
            </span>
            <span v-else class="flex items-center justify-center gap-2">
              {{ t('login.submit') }}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
              </svg>
            </span>
          </button>
        </div>

        <!-- Admin link -->
        <div class="text-center mt-4">
          <RouterLink to="/admin" class="text-xs text-slate-600 hover:text-slate-400 transition-colors">Admin</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.2s; }
.slide-down-enter-from, .slide-down-leave-to { transform: translateY(-8px); opacity: 0; }
</style>
