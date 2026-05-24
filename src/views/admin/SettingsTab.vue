<script setup>
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'

const { t } = useI18n()
const admin = useAdminStore()

const form = ref({ eventName: '', introVideoUrl: '', isEventLive: false })
const saved = ref(false)
const saving = ref(false)

onMounted(() => {
  form.value = { ...form.value, ...admin.settings }
})

watch(() => admin.settings, (s) => {
  form.value = { ...form.value, ...s }
}, { deep: true })

const save = async () => {
  saving.value = true
  try {
    await admin.saveSettings({ ...form.value })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2500)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-lg">
    <h2 class="section-title mb-6">{{ t('admin.settings.title') }}</h2>

    <div class="card-glow space-y-5">
      <div>
        <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.settings.eventName') }}</label>
        <input v-model="form.eventName" class="input-field" placeholder="TeamRush 2024" />
      </div>

      <div>
        <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.settings.introVideo') }}</label>
        <input v-model="form.introVideoUrl" class="input-field" placeholder="https://youtube.com/shorts/..." />
        <p class="text-xs text-slate-500 mt-1">YouTube Shorts, standard, or embed URL</p>
      </div>

      <div class="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700">
        <div>
          <div class="font-semibold text-slate-200">{{ t('admin.settings.isLive') }}</div>
          <div class="text-xs text-slate-400 mt-0.5">Enables team registration</div>
        </div>
        <button
          @click="form.isEventLive = !form.isEventLive"
          :class="['relative w-14 h-7 rounded-full transition-colors', form.isEventLive ? 'bg-amber-500' : 'bg-slate-600']"
        >
          <span :class="['absolute top-1.5 w-4 h-4 rounded-full bg-white transition-all', form.isEventLive ? 'start-8' : 'start-1.5']" />
        </button>
      </div>

      <Transition name="saved">
        <div v-if="saved" class="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm font-semibold">
          ✅ {{ t('admin.settings.saved') }}
        </div>
      </Transition>

      <button @click="save" :disabled="saving" class="btn-primary w-full">
        {{ saving ? t('common.loading') : t('admin.settings.save') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.saved-enter-active, .saved-leave-active { transition: all 0.3s; }
.saved-enter-from, .saved-leave-to { opacity: 0; transform: translateY(-5px); }
</style>
