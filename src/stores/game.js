import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getTrack, getCheckpoint, updateTeamProgress, startCheckpointTimer, markTeamFinished, subscribeToTeam, adjustPoints } from '@/firebase/firestore'
import { useAuthStore } from './auth'

export const useGameStore = defineStore('game', () => {
  const authStore = useAuthStore()

  const track = ref(null)
  const checkpoints = ref([])
  const currentCheckpoint = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  // Game phase: 'envelope1' | 'stage1' | 'bravo' | 'envelope2' | 'stage2' | 'result' | 'finished'
  const phase = ref('envelope1')
  const stage2Result = ref(null)
  const lastPointsDelta = ref(0)
  const checkpointDelta = ref(0)

  // Multiple questions per checkpoint
  const currentQuestionIndex = ref(0)

  // Elapsed time tracking
  const elapsedSeconds = ref(0)
  const timeBonus = ref(0)
  const TIME_BASE_SECONDS = 3600
  let timerInterval = null
  let teamUnsubscribe = null

  const currentIndex = computed(() => authStore.team?.currentCheckpointIndex ?? 0)
  const totalPoints = computed(() => authStore.team?.points ?? 0)
  const isFinished = computed(() => authStore.team?.isFinished ?? false)
  const progress = computed(() =>
    checkpoints.value.length ? (currentIndex.value / checkpoints.value.length) * 100 : 0
  )

  // Normalize questions from missionConfig (supports old single-question format)
  const questions = computed(() => {
    const cp = currentCheckpoint.value
    const mc = cp?.missionConfig
    const type = cp?.missionType ?? 'MultipleChoice'
    if (!mc) return []
    // These mission types are self-contained — no question array needed
    if (type === 'PhotoCapture' || type === 'PuzzleMission') {
      return [{ type }]
    }
    if (Array.isArray(mc.questions) && mc.questions.length > 0) {
      return mc.questions.map(q => ({ ...q, type }))
    }
    // backward compat: single question at root level
    return [{
      type,
      question:   mc.question   ?? '',
      questionEn: mc.questionEn ?? '',
      choices:    mc.choices    ?? [],
      answer:     mc.answer     ?? '',
    }]
  })

  const currentQuestion = computed(() => questions.value[currentQuestionIndex.value] ?? null)

  const loadTrack = async () => {
    if (!authStore.trackId) return
    isLoading.value = true
    try {
      track.value = await getTrack(authStore.trackId)
      if (!track.value) throw new Error('Track not found')

      const cpIds = track.value.checkpointIds ?? []
      const loaded = await Promise.all(cpIds.map((id) => getCheckpoint(id)))
      checkpoints.value = loaded.filter(Boolean)

      await loadCurrentCheckpoint()

      if (authStore.pseudo) {
        teamUnsubscribe?.()
        teamUnsubscribe = subscribeToTeam(authStore.pseudo, (data) => {
          authStore.team = data
        })
      }

      startElapsedTimer()
    } catch (e) {
      error.value = e.message
    } finally {
      isLoading.value = false
    }
  }

  const loadCurrentCheckpoint = async () => {
    const idx = authStore.team?.currentCheckpointIndex ?? 0
    if (idx >= checkpoints.value.length) {
      phase.value = 'finished'
      return
    }
    currentCheckpoint.value = checkpoints.value[idx]
    phase.value = 'envelope1'
    currentQuestionIndex.value = 0
    checkpointDelta.value = 0
    lastPointsDelta.value = 0
    stage2Result.value = null

    if (currentCheckpoint.value?.id && authStore.pseudo) {
      startCheckpointTimer(authStore.pseudo, currentCheckpoint.value.id).catch(() => {})
    }
  }

  const openEnvelope1 = () => { phase.value = 'stage1' }

  const validateStage1 = (input) => {
    const keyword = currentCheckpoint.value?.stage1Keyword ?? ''
    const correct = input.trim().toLowerCase() === keyword.trim().toLowerCase()
    if (correct) {
      setTimeout(() => { phase.value = 'bravo' }, 600)
    }
    return correct
  }

  const advanceToBravo = () => { phase.value = 'envelope2' }
  const openEnvelope2 = () => { phase.value = 'stage2' }

  // Called per question attempt (correct or wrong)
  const answerQuestion = async (isCorrect) => {
    const cp = currentCheckpoint.value
    if (!cp || !authStore.pseudo) return
    const pts = isCorrect ? (cp.pointsCorrect ?? 100) : -(cp.pointsWrong ?? 50)
    lastPointsDelta.value = pts
    checkpointDelta.value += pts
    await adjustPoints(authStore.pseudo, pts)
    await authStore.refreshTeam()
  }

  // Advance to next question
  const advanceQuestion = () => {
    currentQuestionIndex.value++
  }

  // All questions answered correctly — finalise checkpoint
  const finishAllQuestions = async () => {
    const cp = currentCheckpoint.value
    if (!cp || !authStore.pseudo) return
    await updateTeamProgress(authStore.pseudo, cp.id, { missionAnswer: 'completed' })
    await authStore.refreshTeam()
    currentQuestionIndex.value = 0
    stage2Result.value = checkpointDelta.value >= 0 ? 'correct' : 'wrong'
    phase.value = 'result'
  }

  const advanceToNext = async () => {
    error.value = null
    try {
      await authStore.refreshTeam()
      const nextIndex = authStore.team?.currentCheckpointIndex ?? 0
      if (nextIndex >= checkpoints.value.length) {
        clearInterval(timerInterval)
        const bonus = Math.max(0, Math.round((TIME_BASE_SECONDS - elapsedSeconds.value) / 6))
        timeBonus.value = bonus
        await markTeamFinished(authStore.pseudo, bonus)
        await authStore.refreshTeam()
        phase.value = 'finished'
      } else {
        await loadCurrentCheckpoint()
      }
    } catch (e) {
      error.value = e.message
    }
  }

  const startElapsedTimer = () => {
    clearInterval(timerInterval)
    const startedAt = authStore.team?.startedAt?.toDate?.() ?? new Date()
    timerInterval = setInterval(() => {
      elapsedSeconds.value = Math.floor((Date.now() - startedAt.getTime()) / 1000)
    }, 1000)
  }

  const cleanup = () => {
    clearInterval(timerInterval)
    teamUnsubscribe?.()
  }

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return {
    track, checkpoints, currentCheckpoint, isLoading, error,
    phase, stage2Result, lastPointsDelta, checkpointDelta,
    questions, currentQuestion, currentQuestionIndex,
    elapsedSeconds, timeBonus, currentIndex, totalPoints, isFinished, progress,
    loadTrack, loadCurrentCheckpoint, openEnvelope1, validateStage1,
    advanceToBravo, openEnvelope2, answerQuestion, advanceQuestion,
    finishAllQuestions, advanceToNext, cleanup, formatTime,
  }
})
