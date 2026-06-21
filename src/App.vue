<script setup>
import { watch } from 'vue'
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
</script>

<template>
  <RouterView />
</template>
