<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useGameStore } from '@/stores/game'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const game = useGameStore()

const missionRegistry = {
  TextValidation:  defineAsyncComponent(() => import('@/components/missions/TextValidation.vue')),
  MultipleChoice:  defineAsyncComponent(() => import('@/components/missions/MultipleChoice.vue')),
  PhotoCapture:    defineAsyncComponent(() => import('@/components/missions/PhotoCapture.vue')),
  CompassMission:  defineAsyncComponent(() => import('@/components/missions/CompassMission.vue')),
  PuzzleMission:   defineAsyncComponent(() => import('@/components/missions/PuzzleMission.vue')),
}

const currentQuestion = computed(() => game.currentQuestion)
const MissionComponent = computed(() => {
  const type = currentQuestion.value?.type
  return type && missionRegistry[type] ? missionRegistry[type] : null
})
const isMulti = computed(() => game.questions.length > 1)

const onCorrect = async () => {
  await game.answerQuestion(true)
  const isLast = game.currentQuestionIndex >= game.questions.length - 1
  if (isLast) {
    await game.finishAllQuestions()
  } else {
    game.advanceQuestion()
  }
}

const onWrong = async () => {
  await game.answerQuestion(false)
}
</script>

<template>
  <div class="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full">

    <!-- Question progress dots (only for multiple questions) -->
    <div v-if="isMulti" class="flex items-center gap-1.5 mb-4">
      <div
        v-for="(_, i) in game.questions"
        :key="i"
        :class="[
          'h-1.5 flex-1 rounded-full transition-colors duration-300',
          i < game.currentQuestionIndex  ? 'bg-green-500' :
          i === game.currentQuestionIndex ? 'bg-amber-400 animate-pulse' :
          'bg-slate-700'
        ]"
      />
      <span class="text-xs text-slate-400 ms-2 shrink-0">
        {{ game.currentQuestionIndex + 1 }}/{{ game.questions.length }}
      </span>
    </div>

    <Transition name="phase" mode="out-in">
      <div :key="game.currentQuestionIndex" class="w-full animate-slide-up">
        <Suspense>
          <template #default>
            <component
              v-if="MissionComponent && currentQuestion"
              :is="MissionComponent"
              :checkpoint="game.currentCheckpoint"
              :question="currentQuestion"
              :config="game.currentCheckpoint?.missionConfig ?? {}"
              @correct="onCorrect"
              @wrong="onWrong"
            />
            <div v-else class="card text-center text-slate-400 py-8">
              Unknown mission type
            </div>
          </template>
          <template #fallback>
            <div class="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          </template>
        </Suspense>
      </div>
    </Transition>
  </div>
</template>
