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
  const passed = history.state?.settings
  if (passed) {
    try { settings.value = JSON.parse(passed) } catch {}
    loading.value = false
  } else {
    settings.value = await getSettings()
    loading.value = false
  }
})

const proceed = () => {
  const isDay2 = auth.team?.day === 2
  const missionKey = isDay2 ? 'preLaunchDay2Missions' : 'preLaunchDay1Missions'
  const missions = settings.value?.[missionKey] ?? []
  // Use per-day flags: Day 1 uses preLaunchDone, Day 2 uses preLaunchDay2Done
  const done = isDay2 ? (auth.team?.preLaunchDay2Done ?? false) : (auth.team?.preLaunchDone ?? false)
  if (missions.length > 0 && !done) {
    router.push({ name: 'PreLaunch' })
  } else {
    router.push({ name: 'Game' })
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
        <span class="font-bold text-amber-400 text-xl hidden sm:block" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">{{ t('app.name') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-slate-400">{{ auth.team?.displayName || auth.pseudo }}</span>
        <LanguageToggle />
      </div>
    </div>

      <!-- Loading -->
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>

      <!-- Fullscreen video overlay -->
      <div v-else-if="youtubeEmbedUrl"
           class="fixed inset-0 z-50 bg-black flex flex-col">
        <!-- iframe fills the whole screen -->
        <iframe
          :src="youtubeEmbedUrl"
          class="flex-1 w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        />
        <!-- Continue button pinned at bottom -->
        <div class="shrink-0 p-4 bg-black">
          <button @click="proceed" class="btn-primary w-full text-lg py-4">
            {{ t('intro.continueBtn') }} 🚀
          </button>
        </div>
      </div>

      <!-- No video: show normal card -->
      <div v-else class="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <div class="w-full max-w-sm animate-fade-in text-center space-y-6">
          <div>
            <h1 class="text-2xl font-bold text-white">{{ t('intro.title') }}</h1>
            <p class="text-slate-400 text-sm mt-1">{{ t('intro.subtitle') }}</p>
          </div>
          <button @click="proceed" class="btn-primary w-full text-lg py-4">
            {{ t('intro.continueBtn') }} 🚀
          </button>
        </div>
      </div>
  </div>
</template>
