<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import LanguageToggle from '@/components/ui/LanguageToggle.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const admin = useAdminStore()

onMounted(() => admin.init())
onUnmounted(() => admin.cleanup())

const tabs = [
  { key: 'AdminTracks',      label: () => t('admin.tabs.tracks'),      icon: '🗺️',  path: '/admin/tracks' },
  { key: 'AdminCheckpoints', label: () => t('admin.tabs.checkpoints'), icon: '📍',  path: '/admin/checkpoints' },
  { key: 'AdminMonitor',     label: () => t('admin.tabs.monitor'),     icon: '📊',  path: '/admin/monitor' },
  { key: 'AdminSettings',    label: () => t('admin.tabs.settings'),    icon: '⚙️',  path: '/admin/settings' },
]

const isActive = (tab) => route.name === tab.key
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col">
    <!-- Admin nav -->
    <header class="bg-slate-800 border-b border-slate-700 px-4 py-3 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center font-black text-slate-900 text-sm">TR</div>
          <div>
            <span class="font-black text-amber-400 text-lg">TeamRush</span>
            <span class="ms-2 text-xs text-slate-500">Admin</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <LanguageToggle />
          <RouterLink to="/" class="btn-ghost text-xs py-1.5 px-3 text-slate-400">
            ← {{ t('common.back') }}
          </RouterLink>
        </div>
      </div>
    </header>

    <!-- Tab bar -->
    <nav class="bg-slate-800/50 border-b border-slate-700/50 px-4 sticky top-[61px] z-30">
      <div class="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="router.push(tab.path)"
          :class="[
            'flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors',
            isActive(tab)
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          ]"
        >
          <span>{{ tab.icon }}</span>
          {{ tab.label() }}
        </button>
      </div>
    </nav>

    <!-- Content -->
    <div class="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
      <RouterView />
    </div>
  </div>
</template>
