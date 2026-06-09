<script setup>
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'

const { locale } = useI18n()
const toggle = () => setLocale(locale.value === 'he' ? 'en' : 'he')
</script>

<template>
  <button
    @click="toggle"
    class="px-2 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-xl leading-none"
    :title="locale === 'he' ? 'Switch to English' : 'עבור לעברית'"
  >
    {{ locale === 'he' ? '🇬🇧' : '🇮🇱' }}
  </button>
</template>
