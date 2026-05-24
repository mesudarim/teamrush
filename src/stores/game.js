import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getTrack, getCheckpoint, updateTeamProgress, startCheckpointTimer, markTeamFinished, subscribeToTeam } from '@/firebase/firestore'
import { useAuthStore } from './auth'

export const useGameStore = defineStore('game', () => {
  const authStore = useAuthStore()

  const track = ref(null)
  const checkpoints = ref([])
  const currentCheckpoint = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  // Game phase: 'envelope1' | 'stage1' | 'envelope2' | 'stage2' | 'result' | 'finished'
  const phase = ref('envelope1')
  const stage1Result = ref(null)   // null | 'correct' | 'wrong'
  const stage2Result = ref(null)   // null | 'correct' | 'wrong'
  const lastPointsDelta = ref(0)

  // Elapsed time tracking
  const elapsedSeconds = ref(0)
  const timeBonus = ref(0)
  const TIME_BASE_SECONDS = 3600 // 60 minutes
  let timerInterval = null
  let teamUnsubscribe = null

  const currentIndex = computed(() => authStore.team?.currentCheckpointIndex ?? 0)
  const totalPoints = computed(() => authStore.team?.points ?? 0)
  const isFinished = computed(() => authStore.team?.isFinished ?? false)
  const progress = computed(() =>
    checkpoints.value.length ? (currentIndex.value / checkpoints.value.length) * 100 : 0
  )

  const loadTrack = async () => {
    if (!authStore.trackId) return
    isLoading.value = true
    try {
      track.value = await getTrack(authStore.trackId)
      if (!track.value) throw new Error('Track not found')

      // Load all checkpoints for this track in order
      const cpIds = track.value.checkpointIds ?? []
      const loaded = await Promise.all(cpIds.map((id) => getCheckpoint(id)))
      checkpoints.value = loaded.filter(Boolean)

      await loadCurrentCheckpoint()

      // Subscribe to team updates
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
    // Reset phase state first so UI reacts immediately
    stage1Result.value = null
    stage2Result.value = null
    lastPointsDelta.value = 0
    phase.value = 'envelope1'

    // Non-blocking — timer is informational, must not block game flow
    if (currentCheckpoint.value?.id && authStore.pseudo) {
      startCheckpointTimer(authStore.pseudo, currentCheckpoint.value.id).catch(() => {})
    }
  }

  const openEnvelope1 = () => {
    phase.value = 'stage1'
  }

  const validateStage1 = (input) => {
    const keyword = currentCheckpoint.value?.stage1Keyword ?? ''
    const correct = input.trim().toLowerCase() === keyword.trim().toLowerCase()
    stage1Result.value = correct ? 'correct' : 'wrong'
    if (correct) {
      // Small delay so the ✅ feedback is visible before transition
      setTimeout(() => { phase.value = 'bravo' }, 600)
    }
    return correct
  }

  const advanceToBravo = () => {
    phase.value = 'envelope2'
  }

  const openEnvelope2 = () => {
    phase.value = 'stage2'
  }

  const submitMission = async (correct, answer) => {
    if (!currentCheckpoint.value || !authStore.pseudo) return
    const cp = currentCheckpoint.value
    const pointsDelta = correct ? (cp.pointsCorrect ?? 100) : -(cp.pointsWrong ?? 50)
    lastPointsDelta.value = pointsDelta
    stage2Result.value = correct ? 'correct' : 'wrong'

    await updateTeamProgress(authStore.pseudo, cp.id, {
      correct,
      pointsDelta,
      missionAnswer: answer,
    })
    await authStore.refreshTeam()
    phase.value = 'result'
  }

  const advanceToNext = async () => {
    error.value = null
    try {
      // Always refresh before advancing to get the latest index from Firestore
      await authStore.refreshTeam()
      const nextIndex = authStore.team?.currentCheckpointIndex ?? 0
      if (nextIndex >= checkpoints.value.length) {
        clearInterval(timerInterval) // freeze timer before saving
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
    phase, stage1Result, stage2Result, lastPointsDelta,
    elapsedSeconds, timeBonus, currentIndex, totalPoints, isFinished, progress,
    loadTrack, loadCurrentCheckpoint, openEnvelope1, validateStage1,
    advanceToBravo, openEnvelope2, submitMission, advanceToNext, cleanup, formatTime,
  }
})
