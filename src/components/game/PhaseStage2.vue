<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useGameStore } from '@/stores/game'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const game = useGameStore()
const cp = computed(() => game.currentCheckpoint)

// Dynamic mission component registry — add new mission types here only
const missionRegistry = {
  TextValidation: defineAsyncComponent(() => import('@/components/missions/TextValidation.vue')),
  MultipleChoice: defineAsyncComponent(() => import('@/components/missions/MultipleChoice.vue')),
}

const MissionComponent = computed(() => {
  const type = cp.value?.missionType
  return type && missionRegistry[type] ? missionRegistry[type] : null
})
</script>

<template>
  <div class="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full">
    <div class="w-full animate-slide-up">
      <Suspense>
        <template #default>
          <component
            v-if="MissionComponent"
            :is="MissionComponent"
            :checkpoint="cp"
            :config="cp?.missionConfig ?? {}"
            @submit="game.submitMission"
          />
          <div v-else class="card text-center text-slate-400">
            Unknown mission type: {{ cp?.missionType }}
          </div>
        </template>
        <template #fallback>
          <div class="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        </template>
      </Suspense>
    </div>
  </div>
</template>
