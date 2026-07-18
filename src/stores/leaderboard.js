import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { subscribeToAllTeams, getTracks, subscribeToCheckpoints } from '@/firebase/firestore'
import { useGameContextStore } from './gameContext'

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const teams       = ref([])
  const tracks      = ref([])
  const checkpoints = ref([])
  let unsubTeams       = null
  let unsubCheckpoints = null

  const _gid = () => useGameContextStore().gameId

  const trackMap = computed(() => {
    const map = {}
    tracks.value.forEach((t) => { map[t.id] = t })
    return map
  })

  const checkpointScoreMap = computed(() => {
    const map = {}
    checkpoints.value.forEach((cp) => { map[cp.id] = cp.pointsCorrect ?? 0 })
    return map
  })

  const isTwoDay = computed(() => teams.value.some(t => t.day === 2 || t.day1Points != null))

  const currentDayPoints = (team) => team.points ?? 0

  const AVG_EXTRA_J2 = 239

  const _day2FromCheckpoints = (team) => {
    if (!checkpoints.value.length) return null
    const extra = team.isFinished ? AVG_EXTRA_J2 : 0
    const total = team.points ?? 0
    const day2Start = team.day2StartedAt?.toDate?.()
    if (day2Start) {
      const times = team.checkpointTimes ?? {}
      let score = 0
      for (const cpId of (team.completedCheckpoints ?? [])) {
        const completedAt = times[cpId]?.completedAt?.toDate?.()
        if (completedAt && completedAt > day2Start) score += checkpointScoreMap.value[cpId] ?? 0
      }
      score += (team.timeBonusPoints ?? 0) + extra
      return Math.min(score, total)
    }
    const day2Set = new Set(team.day2Order ?? [])
    if (!day2Set.size) return null
    let score = 0
    for (const cpId of (team.completedCheckpoints ?? [])) {
      if (day2Set.has(cpId)) score += checkpointScoreMap.value[cpId] ?? 0
    }
    score += (team.timeBonusPoints ?? 0) + extra
    return Math.min(score, total)
  }

  const day1PointsFor = (team) => {
    if (team.day1Points != null) return team.day1Points
    if (team.day !== 2 && !team.isFinished) return team.points ?? 0
    const d2 = _day2FromCheckpoints(team)
    return d2 != null ? Math.max(0, (team.points ?? 0) - d2) : 0
  }

  const day2PointsFor = (team) => {
    if (team.day !== 2 && !team.isFinished) return 0
    if (team.day1Points != null) return team.points ?? 0
    const d2 = _day2FromCheckpoints(team)
    return d2 ?? (team.points ?? 0)
  }

  const totalPoints = (team) => {
    if (team.day1Points != null) return (team.day1Points ?? 0) + (team.points ?? 0)
    return team.points ?? 0
  }

  const elapsedSecondsFor = (team) => {
    const start = team.startedAt?.toDate?.()
    const end   = team.isFinished ? team.finishedAt?.toDate?.() ?? new Date() : new Date()
    if (!start) return 0
    return Math.floor((end - start) / 1000)
  }

  const rankedTeams = computed(() =>
    [...teams.value].sort((a, b) => {
      const diff = currentDayPoints(b) - currentDayPoints(a)
      return diff !== 0 ? diff : elapsedSecondsFor(a) - elapsedSecondsFor(b)
    })
  )

  const rankedTeamsDay1 = computed(() =>
    [...teams.value].sort((a, b) => {
      const diff = day1PointsFor(b) - day1PointsFor(a)
      return diff !== 0 ? diff : elapsedSecondsFor(a) - elapsedSecondsFor(b)
    })
  )

  const rankedTeamsDay2 = computed(() =>
    [...teams.value].sort((a, b) => {
      const diff = day2PointsFor(b) - day2PointsFor(a)
      return diff !== 0 ? diff : elapsedSecondsFor(a) - elapsedSecondsFor(b)
    })
  )

  const rankedTeamsTotal = computed(() =>
    [...teams.value].sort((a, b) => {
      const diff = totalPoints(b) - totalPoints(a)
      return diff !== 0 ? diff : elapsedSecondsFor(a) - elapsedSecondsFor(b)
    })
  )

  const formatTime = (seconds) => {
    if (!seconds) return '00:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const subscribe = async () => {
    const gid = _gid()
    tracks.value = await getTracks(gid)
    unsubTeams?.()
    unsubCheckpoints?.()
    unsubCheckpoints = subscribeToCheckpoints(gid, (data) => { checkpoints.value = data })
    unsubTeams       = subscribeToAllTeams(gid, (data) => { teams.value = data })
  }

  const cleanup = () => {
    unsubTeams?.()
    unsubCheckpoints?.()
    unsubTeams = null
    unsubCheckpoints = null
  }

  return {
    teams, tracks, trackMap,
    isTwoDay,
    currentDayPoints, day1PointsFor, day2PointsFor, totalPoints,
    rankedTeams, rankedTeamsDay1, rankedTeamsDay2, rankedTeamsTotal,
    elapsedSecondsFor, formatTime,
    subscribe, cleanup,
  }
})
