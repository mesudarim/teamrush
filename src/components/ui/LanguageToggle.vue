<script setup>
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'

const { locale } = useI18n()
const toggle = () => setLocale(locale.value === 'he' ? 'en' : 'he')
</script>

<template>
  <button
    @click="toggle"
    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium text-slate-300 transition-colors"
  >
    <span class="text-base">{{ locale === 'he' ? '🇮🇱' : '🇺🇸' }}</span>
    <span>{{ locale === 'he' ? 'EN' : 'עב' }}</span>
  </button>
</template>
