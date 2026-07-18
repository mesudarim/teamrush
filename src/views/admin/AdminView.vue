<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import { useAdminAuthStore } from '@/stores/adminAuth'
import { useGameContextStore } from '@/stores/gameContext'
import LanguageToggle from '@/components/ui/LanguageToggle.vue'

const { t }       = useI18n()
const route       = useRoute()
const router      = useRouter()
const admin       = useAdminStore()
const adminAuth   = useAdminAuthStore()
const gameContext = useGameContextStore()

const gameId   = computed(() => route.params.gameId)
const basePath = computed(() => `/g/${gameId.value}/admin`)

const logout = async () => {
  await adminAuth.logout()
  router.replace({ name: 'AdminLogin', params: { gameId: gameId.value } })
}

onMounted(() => admin.init())
onUnmounted(() => admin.cleanup())

const tabs = computed(() => [
  { key: 'AdminParticipants', label: () => t('admin.tabs.participants'), icon: '👥', path: `${basePath.value}/participants` },
  { key: 'AdminTracks',       label: () => t('admin.tabs.tracks'),       icon: '🗺️',  path: `${basePath.value}/tracks` },
  { key: 'AdminCheckpoints',  label: () => t('admin.tabs.checkpoints'),  icon: '📍',  path: `${basePath.value}/checkpoints` },
  { key: 'AdminMonitor',      label: () => t('admin.tabs.monitor'),      icon: '📊',  path: `${basePath.value}/monitor` },
  { key: 'AdminRoutes',       label: () => t('admin.tabs.routes'),       icon: '🗓️',  path: `${basePath.value}/routes` },
  { key: 'AdminSettings',     label: () => t('admin.tabs.settings'),     icon: '⚙️',  path: `${basePath.value}/settings` },
])

const isActive = (tab) => route.name === tab.key
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col">
    <!-- Admin nav -->
    <header class="bg-slate-800 border-b border-slate-700 px-4 py-3 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full overflow-hidden shrink-0">
            <img src="@/assets/logoMerotz.png" alt="logo" class="w-full h-full object-cover" />
          </div>
          <div>
            <span class="font-black text-amber-400 text-lg">{{ gameContext.gameName || t('app.name') }}</span>
            <span class="ms-2 text-xs text-slate-500">Admin</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <LanguageToggle />
          <RouterLink
            v-if="adminAuth.isSuperAdmin"
            to="/superadmin"
            class="text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded border border-amber-700 hover:border-amber-500 transition-colors"
          >
            Superadmin
          </RouterLink>
          <div v-if="adminAuth.isAuthenticated" class="flex items-center gap-2">
            <img
              v-if="adminAuth.photoURL"
              :src="adminAuth.photoURL"
              :alt="adminAuth.displayName"
              class="w-8 h-8 rounded-full ring-2 ring-slate-600"
            />
            <span class="text-sm text-slate-300 hidden sm:block">{{ adminAuth.displayName }}</span>
          </div>
          <button
            @click="logout"
            class="btn-ghost text-xs py-1.5 px-3 text-slate-400 hover:text-red-400"
          >
            {{ t('nav.logout') }}
          </button>
        </div>
      </div>
    </header>

    <!-- Tab bar -->
    <nav class="bg-slate-800 border-b border-slate-700 px-4 sticky top-[61px] z-30">
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
