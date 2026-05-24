<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

defineProps({
  message: { type: String, required: true },
  isOpen: { type: Boolean, default: false },
})
const emit = defineEmits(['confirm', 'cancel'])
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" @click.self="$emit('cancel')">
        <div class="card max-w-sm w-full animate-bounce-in text-center">
          <p class="text-slate-200 text-lg mb-6">{{ message }}</p>
          <div class="flex gap-3 justify-center">
            <button class="btn-danger" @click="$emit('confirm')">{{ t('common.yes') }}</button>
            <button class="btn-secondary" @click="$emit('cancel')">{{ t('common.no') }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
