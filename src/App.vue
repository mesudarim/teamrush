<script setup>
import { ref, watch, onErrorCaptured } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView } from 'vue-router'

const { locale } = useI18n()

const applyDir = (loc) => {
  const isRtl = loc === 'he'
  document.documentElement.dir  = isRtl ? 'rtl' : 'ltr'
  document.documentElement.lang = loc
}

applyDir(locale.value)
watch(locale, applyDir)

const crashed = ref(false)

onErrorCaptured((err) => {
  console.error('[App] component error:', err)
  crashed.value = true
  return false
})

const reload = () => window.location.reload()
</script>

<template>
  <div v-if="crashed" class="min-h-screen bg-slate-900 flex items-center justify-center p-6">
    <div class="max-w-sm w-full text-center space-y-5 p-6 rounded-2xl border border-slate-700 bg-slate-800">
      <div class="text-5xl">⚠️</div>
      <h2 class="text-white font-bold text-lg" style="font-family: 'Segoe UI', Arial, sans-serif;">
        {{ locale === 'he' ? 'משהו השתבש' : 'Something went wrong' }}
      </h2>
      <p class="text-slate-400 text-sm">
        {{ locale === 'he' ? 'לחצו לטעינה מחדש — ההתקדמות שלכם שמורה' : 'Tap to reload — your progress is saved' }}
      </p>
      <button @click="reload"
              class="w-full py-4 rounded-2xl font-bold text-base bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors">
        🔄 {{ locale === 'he' ? 'טעינה מחדש' : 'Reload' }}
      </button>
    </div>
  </div>
  <RouterView v-else />
</template>
