<script setup>
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { getSettings } from '@/firebase/firestore'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import LanguageToggle from '@/components/ui/LanguageToggle.vue'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const settings = ref({})
const loading = ref(true)

const toEmbedUrl = (url) => {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([^&\n?#]+)/)
  if (!match) return null
  return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0&modestbranding=1`
}

const youtubeEmbedUrl = computed(() => {
  const isDay2 = auth.team?.day === 2
  const url = isDay2 ? (settings.value.introVideoUrlDay2 || settings.value.introVideoUrl) : settings.value.introVideoUrl
  return toEmbedUrl(url)
})

onMounted(async () => {
  settings.value = await getSettings()
  loading.value = false
})

const proceed = () => router.push({ name: 'Game' })
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col">
    <!-- Header -->
    <div class="flex justify-between items-center px-6 py-4">
      <div class="flex items-center gap-2">
        <div class="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center overflow-hidden">
          <img src="@/assets/harpe.png" alt="logo" class="w-7 h-7 object-contain" style="mix-blend-mode: multiply;" />
        </div>
        <span class="font-bold text-amber-400 text-xl hidden sm:block" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">{{ t('app.name') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-slate-400">{{ auth.team?.displayName || auth.pseudo }}</span>
        <LanguageToggle />
      </div>
    </div>

    <div class="flex-1 flex flex-col items-center justify-center px-4 pb-8">
      <div v-if="loading" class="flex items-center justify-center flex-1">
        <LoadingSpinner size="lg" />
      </div>

      <div v-else class="w-full max-w-2xl animate-fade-in">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold text-white" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">{{ t('intro.title') }}</h1>
          <p class="text-slate-400 text-sm mt-1">{{ t('intro.subtitle') }}</p>
        </div>

        <!-- Video embed -->
        <div v-if="youtubeEmbedUrl" class="relative w-full rounded-2xl overflow-hidden shadow-2xl bg-black mb-6" style="padding-bottom: 56.25%;">
          <iframe
            :src="youtubeEmbedUrl"
            class="absolute inset-0 w-full h-full"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          />
        </div>

        <!-- No video placeholder -->
        <div v-else class="relative w-full rounded-2xl overflow-hidden shadow-2xl bg-slate-800 border border-slate-700 mb-6 flex items-center justify-center" style="min-height:220px;">
          <div class="text-center text-slate-500">
            <svg class="w-16 h-16 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
            <p class="text-sm">No intro video configured</p>
          </div>
        </div>

        <button @click="proceed" class="btn-primary w-full text-lg py-4">
          {{ t('intro.continueBtn') }}
          <span class="ms-2">🚀</span>
        </button>
      </div>
    </div>
  </div>
</template>
