import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getTrack, getCheckpoint, updateTeamProgress, startCheckpointTimer, markTeamFinished, markDay1Complete, subscribeToTeam, adjustPoints, saveTeamPhase, getSettings, subscribeToSettings, setPreLaunchDone } from '@/firebase/firestore'
import { useAuthStore } from './auth'

export const useGameStore = defineStore('game', () => {
  const authStore = useAuthStore()

  const track = ref(null)
  const checkpoints = ref([])
  const currentCheckpoint = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  // Game phase: 'envelope1' | 'stage1' | 'bravo' | 'envelope2' | 'stage2' | 'result' | 'finished' | 'day1complete'
  const phase = ref('envelope1')
  const stage2Result = ref(null)
  const lastPointsDelta = ref(0)
  const checkpointDelta = ref(0)
  const pointsAnimation = ref({ pts: 0, seq: 0 })

  // Multiple questions per checkpoint
  const currentQuestionIndex = ref(0)

  // Elapsed time tracking
  const elapsedSeconds = ref(0)
  const timeBonus = ref(0)
  const gameSettings = ref({})
  let timerInterval = null
  let teamUnsubscribe = null
  let settingsUnsubscribe = null

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
    if (type === 'PhotoCapture' || type === 'PuzzleMission' || type === 'AudioRecorder' || type === 'HarpMission') {
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
    isLoading.value = true
    try {
      // Fetch fresh team data before restoring phase, to avoid stale Firestore state
      await authStore.refreshTeam()

      // Subscribe to settings so bonus calculation always uses current values
      settingsUnsubscribe?.()
      settingsUnsubscribe = subscribeToSettings((s) => { gameSettings.value = s })
      // Also fetch immediately (subscription fires async on first snapshot)
      gameSettings.value = await getSettings()

      // Two-day mode: use team's per-day ordered route if available
      const team = authStore.team
      const currentDay = team?.day ?? 1
      const dayOrder = currentDay === 1 ? team?.day1Order : team?.day2Order

      // Load track only if needed (may be absent in two-day route mode)
      track.value = authStore.trackId ? await getTrack(authStore.trackId) : null

      const cpIds = dayOrder?.length ? dayOrder : (track.value?.checkpointIds ?? [])
      if (!cpIds.length) throw new Error('No checkpoints found')
      const loaded = await Promise.all(cpIds.map((id) => getCheckpoint(id)))
      checkpoints.value = loaded.filter(Boolean)

      await loadCurrentCheckpoint()

      if (authStore.pseudo) {
        teamUnsubscribe?.()
        teamUnsubscribe = subscribeToTeam(authStore.pseudo, (data) => {
          const prevDay = authStore.team?.day
          authStore.team = data
          // When admin activates Day 2 while the player is on the waiting screen,
          // automatically reload so Day 2 checkpoints are fetched.
          if (prevDay === 1 && data.day === 2 && phase.value === 'day1complete') {
            loadTrack()
          }
        })
      }

      const teamData = authStore.team
      if (teamData?.isFinished || teamData?.day1Finished) {
        // Team already done — compute final elapsed once, don't start the interval
        const startedAt = teamData.startedAt?.toDate?.() ?? new Date()
        const endedAt   = teamData.finishedAt?.toDate?.() ?? teamData.day1FinishedAt?.toDate?.() ?? new Date()
        elapsedSeconds.value = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)
      } else {
        startElapsedTimer()
      }
    } catch (e) {
      error.value = e.message
    } finally {
      isLoading.value = false
    }
  }

  // Phases that can be safely restored.
  // 'envelope2' intentionally excluded: if the session was interrupted there,
  // the user restarts from envelope1 to avoid skipping verification.
  const RESTORABLE_PHASES = new Set(['stage1', 'bravo', 'stage2', 'tapis'])

  const persistPhase = (p, qIdx = 0) => {
    if (authStore.pseudo) saveTeamPhase(authStore.pseudo, p, qIdx).catch(() => {})
  }

  const loadCurrentCheckpoint = async () => {
    const idx = authStore.team?.currentCheckpointIndex ?? 0
    if (idx >= checkpoints.value.length) {
      // Could be the tapis phase (post-last checkpoint, awaiting final verification)
      const saved = authStore.team?.currentPhase
      currentCheckpoint.value = null
      phase.value = saved === 'tapis' ? 'tapis' : 'finished'
      return
    }
    currentCheckpoint.value = checkpoints.value[idx]

    // Restore saved phase if valid for this checkpoint
    const saved = authStore.team?.currentPhase
    const savedQIdx = authStore.team?.savedQuestionIndex ?? 0
    if (saved && RESTORABLE_PHASES.has(saved)) {
      phase.value = saved
      currentQuestionIndex.value = saved === 'stage2' ? (savedQIdx || 0) : 0
    } else {
      phase.value = 'envelope1'
      currentQuestionIndex.value = 0
    }

    checkpointDelta.value = 0
    lastPointsDelta.value = 0
    stage2Result.value = null

    if (currentCheckpoint.value?.id && authStore.pseudo) {
      startCheckpointTimer(authStore.pseudo, currentCheckpoint.value.id).catch(() => {})
    }
  }

  const openEnvelope1 = () => {
    phase.value = 'stage1'
    persistPhase('stage1')
  }

  const validateStage1 = async (input) => {
    const cp = currentCheckpoint.value
    const clean = s => s.trim().toLowerCase()
    const inputClean = clean(input)
    const allAnswers = [
      ...(cp?.stage1Keyword   ?? '').split(','),
      ...(cp?.stage1KeywordEn ?? '').split(','),
    ].map(clean).filter(Boolean)
    const correct = allAnswers.includes(inputClean)
    if (correct) {
      const pts = cp?.pointsCorrect ?? 5
      checkpointDelta.value += pts
      pointsAnimation.value = { pts, seq: pointsAnimation.value.seq + 1 }
      await adjustPoints(authStore.pseudo, pts)
      await authStore.refreshTeam()
      setTimeout(() => {
        phase.value = 'bravo'
        persistPhase('bravo')
      }, 600)
    } else {
      checkpointDelta.value -= 1
      pointsAnimation.value = { pts: -1, seq: pointsAnimation.value.seq + 1 }
      await adjustPoints(authStore.pseudo, -1)
      await authStore.refreshTeam()
    }
    return correct
  }

  const advanceToBravo = () => {
    phase.value = 'envelope2'
    persistPhase('envelope2')
  }

  const awardBonus = async (pts) => {
    if (!pts || !authStore.pseudo) return
    checkpointDelta.value += pts
    pointsAnimation.value = { pts, seq: pointsAnimation.value.seq + 1 }
    await adjustPoints(authStore.pseudo, pts)
    await authStore.refreshTeam()
  }

  const openEnvelope2 = () => {
    phase.value = 'stage2'
    persistPhase('stage2', 0)
  }

  // Called per question attempt (correct or wrong)
  const answerQuestion = async (isCorrect, bonusPoints = 0) => {
    const cp = currentCheckpoint.value
    if (!cp || !authStore.pseudo) return
    const pts = isCorrect ? (cp.pointsCorrect ?? 5) + bonusPoints : -(cp.pointsWrong ?? 1)
    lastPointsDelta.value = pts
    pointsAnimation.value = { pts, seq: pointsAnimation.value.seq + 1 }
    checkpointDelta.value += pts
    await adjustPoints(authStore.pseudo, pts)
    await authStore.refreshTeam()
  }

  // Advance to next question (and persist so a refresh lands on the right question)
  const advanceQuestion = () => {
    currentQuestionIndex.value++
    persistPhase('stage2', currentQuestionIndex.value)
  }

  // All questions answered correctly — finalise checkpoint
  const finishAllQuestions = async () => {
    const cp = currentCheckpoint.value
    if (!cp || !authStore.pseudo) return
    await updateTeamProgress(authStore.pseudo, cp.id, { missionAnswer: 'completed' })
    await authStore.refreshTeam()
    currentQuestionIndex.value = 0
    stage2Result.value = checkpointDelta.value >= 0 ? 'correct' : 'wrong'
    const nextIndex = authStore.team?.currentCheckpointIndex ?? 0
    if (nextIndex >= checkpoints.value.length) {
      // Last checkpoint — go directly to finish, skip intermediate result screen
      await advanceToNext()
    } else {
      phase.value = 'result'
    }
  }

  const SKIP_COST = 30

  const applySkipCost = async () => {
    pointsAnimation.value = { pts: -SKIP_COST, seq: pointsAnimation.value.seq + 1 }
    await adjustPoints(authStore.pseudo, -SKIP_COST)
  }

  // Skip stage 1 → go directly to the mission (stage 2)
  const skipStage1 = async () => {
    if (!authStore.pseudo) return
    await applySkipCost()
    openEnvelope2()  // sets phase to 'stage2'
  }

  // Skip stage 2 → abandon mission, go to next checkpoint
  const skipCheckpoint = async () => {
    const cp = currentCheckpoint.value
    if (!cp || !authStore.pseudo) return
    await applySkipCost()
    await updateTeamProgress(authStore.pseudo, cp.id)
    currentQuestionIndex.value = 0
    await advanceToNext()
  }

  const advanceToNext = async () => {
    error.value = null
    try {
      await authStore.refreshTeam()
      const nextIndex = authStore.team?.currentCheckpointIndex ?? 0
      if (nextIndex >= checkpoints.value.length) {
        // Check the tapis keyword relevant to the current day
        const currentDay = authStore.team?.day ?? 1
        const tapisKw = currentDay === 2
          ? (gameSettings.value.tapiskeywordDay2 ?? '').trim()
          : (gameSettings.value.tapiskeyword    ?? '').trim()
        if (tapisKw) {
          currentCheckpoint.value = null
          phase.value = 'tapis'
          persistPhase('tapis')
          return
        }
        await _finalizeGame()
      } else {
        await loadCurrentCheckpoint()
      }
    } catch (e) {
      error.value = e.message
    }
  }

  // Shared end-game logic (used by advanceToNext and completeTapis)
  const _finalizeGame = async () => {
    clearInterval(timerInterval)
    const parSeconds = Math.max(1, (gameSettings.value.timeBonusPar ?? 90) * 60)
    const maxBonus   = gameSettings.value.timeBonusMax ?? 100
    const bonus = Math.max(0, Math.round(maxBonus * (1 - elapsedSeconds.value / parSeconds)))
    timeBonus.value = bonus
    const currentDay = authStore.team?.day ?? 1
    const hasDay2Route = (authStore.team?.day2Order?.length ?? 0) > 0
    if (currentDay === 1 && authStore.team?.day1Order?.length && hasDay2Route) {
      await markDay1Complete(authStore.pseudo, bonus)
      await authStore.refreshTeam()
      phase.value = 'day1complete'
    } else {
      await markTeamFinished(authStore.pseudo, bonus)
      await authStore.refreshTeam()
      phase.value = 'finished'
    }
  }

  // Multi-field stage1: inputs can be in any order, no duplicates allowed.
  // Uses greedy bipartite matching — sufficient for non-overlapping keyword sets.
  const _matchMultiField = (cleanedInputs, pools) => {
    const used = new Array(pools.length).fill(false)
    for (const inp of cleanedInputs) {
      let matched = false
      for (let j = 0; j < pools.length; j++) {
        if (!used[j] && pools[j].includes(inp)) {
          used[j] = true
          matched = true
          break
        }
      }
      if (!matched) return false
    }
    return used.every(Boolean)
  }

  const validateStage1Multi = async (inputs) => {
    const cp = currentCheckpoint.value
    const clean = s => s.trim().toLowerCase()
    const cleaned = inputs.map(clean)

    if (new Set(cleaned).size !== cleaned.length) return false

    const keywords = cp?.stage1Keywords ?? []
    const pools = keywords.map(kw => [
      ...(kw.he ?? '').split(','),
      ...(kw.en ?? '').split(','),
    ].map(clean).filter(Boolean))

    const correct = _matchMultiField(cleaned, pools)
    if (correct) {
      const pts = cp?.pointsCorrect ?? 5
      checkpointDelta.value += pts
      pointsAnimation.value = { pts, seq: pointsAnimation.value.seq + 1 }
      await adjustPoints(authStore.pseudo, pts)
      await authStore.refreshTeam()
      setTimeout(() => {
        phase.value = 'bravo'
        persistPhase('bravo')
      }, 600)
    } else {
      checkpointDelta.value -= 1
      pointsAnimation.value = { pts: -1, seq: pointsAnimation.value.seq + 1 }
      await adjustPoints(authStore.pseudo, -1)
      await authStore.refreshTeam()
    }
    return correct
  }

  const validateTapis = (input) => {
    const clean = s => s.trim().toLowerCase()
    const isDay2 = (authStore.team?.day ?? 1) === 2
    const kwHe = isDay2 ? (gameSettings.value.tapiskeywordDay2   ?? '') : (gameSettings.value.tapiskeyword   ?? '')
    const kwEn = isDay2 ? (gameSettings.value.tapiskeywordEnDay2 ?? '') : (gameSettings.value.tapiskeywordEn ?? '')
    const pool = [...kwHe.split(','), ...kwEn.split(',')].map(clean).filter(Boolean)
    return pool.includes(clean(input))
  }

  // ── Pre-launch missions ───────────────────────────────────────────────────────
  const answerPreLaunchMission = async (isCorrect, bonusPoints = 0, mission = {}) => {
    if (!authStore.pseudo) return
    const pts = isCorrect
      ? (mission.pointsCorrect ?? 5) + bonusPoints
      : -(mission.pointsWrong ?? 1)
    pointsAnimation.value = { pts, seq: pointsAnimation.value.seq + 1 }
    await adjustPoints(authStore.pseudo, pts)
    await authStore.refreshTeam()
  }

  const completePreLaunch = async () => {
    if (!authStore.pseudo) return
    await setPreLaunchDone(authStore.pseudo)
    await authStore.refreshTeam()
  }

  // True from when completeTapis starts until PhaseFinished/Day1Complete is mounted.
  // GameView uses this to show a bridging overlay so there's no black-screen gap.
  const finishingGame = ref(false)

  const completeTapis = async () => {
    error.value = null
    finishingGame.value = true
    try {
      await authStore.refreshTeam()
      await _finalizeGame()
      finishingGame.value = false
    } catch (e) {
      error.value = e.message
      finishingGame.value = false
    }
  }

  const startElapsedTimer = () => {
    clearInterval(timerInterval)
    const startedAt = authStore.team?.startedAt?.toDate?.() ?? new Date()
    // Set immediately so elapsedSeconds is correct even before the first tick
    elapsedSeconds.value = Math.floor((Date.now() - startedAt.getTime()) / 1000)
    timerInterval = setInterval(() => {
      elapsedSeconds.value = Math.floor((Date.now() - startedAt.getTime()) / 1000)
    }, 1000)
  }

  const cleanup = () => {
    clearInterval(timerInterval)
    teamUnsubscribe?.()
    settingsUnsubscribe?.()
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
    phase, stage2Result, lastPointsDelta, checkpointDelta, pointsAnimation, awardBonus,
    questions, currentQuestion, currentQuestionIndex,
    elapsedSeconds, timeBonus, gameSettings, currentIndex, totalPoints, isFinished, progress,
    finishingGame,
    loadTrack, loadCurrentCheckpoint, openEnvelope1, validateStage1,
    advanceToBravo, openEnvelope2, answerQuestion, advanceQuestion,
    finishAllQuestions, advanceToNext, skipStage1, skipCheckpoint, SKIP_COST, cleanup, formatTime,
    validateStage1Multi, validateTapis, completeTapis,
    answerPreLaunchMission, completePreLaunch,
  }
})
