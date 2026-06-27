import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { subscribeToAllTeams, getTracks, subscribeToCheckpoints } from '@/firebase/firestore'

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const teams       = ref([])
  const tracks      = ref([])
  const checkpoints = ref([])
  let unsubTeams        = null
  let unsubCheckpoints  = null

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

  // Whether any team is in Day 2 (signals 2-day mode is active)
  const isTwoDay = computed(() => teams.value.some(t => t.day === 2 || t.day1Points != null))

  // Points for the current day (legacy helper, still used when not in 2-day mode)
  const currentDayPoints = (team) => team.points ?? 0

  // Average puzzle-bonus earned on Day 2 by clean teams (computed from actual data).
  // Applied only to finished messy teams to approximate their mission bonus points.
  const AVG_EXTRA_J2 = 239

  // Derive J2 points for messy teams (day1Points not set).
  // Primary: classify checkpoints by comparing completedAt vs day2StartedAt timestamp.
  // Fallback: use day2Order set if timestamps are missing.
  // Adds timeBonusPoints + AVG_EXTRA_J2 (for finished teams).
  // Result is capped at team.points to handle Day-2-only teams (no J1).
  const _day2FromCheckpoints = (team) => {
    if (!checkpoints.value.length) return null  // not yet loaded — don't compute with empty map

    const extra = team.isFinished ? AVG_EXTRA_J2 : 0
    const total = team.points ?? 0

    const day2Start = team.day2StartedAt?.toDate?.()
    if (day2Start) {
      const times = team.checkpointTimes ?? {}
      let score = 0
      for (const cpId of (team.completedCheckpoints ?? [])) {
        const completedAt = times[cpId]?.completedAt?.toDate?.()
        if (completedAt && completedAt > day2Start) {
          score += checkpointScoreMap.value[cpId] ?? 0
        }
      }
      score += (team.timeBonusPoints ?? 0) + extra
      return Math.min(score, total)
    }

    // Fallback: use per-team day2Order route
    const day2Set = new Set(team.day2Order ?? [])
    if (!day2Set.size) return null
    let score = 0
    for (const cpId of (team.completedCheckpoints ?? [])) {
      if (day2Set.has(cpId)) score += checkpointScoreMap.value[cpId] ?? 0
    }
    score += (team.timeBonusPoints ?? 0) + extra
    return Math.min(score, total)
  }

  // Day 1 points
  const day1PointsFor = (team) => {
    if (team.day1Points != null) return team.day1Points
    if (team.day !== 2 && !team.isFinished) return team.points ?? 0
    const d2 = _day2FromCheckpoints(team)
    return d2 != null ? Math.max(0, (team.points ?? 0) - d2) : 0
  }

  // Day 2 points
  const day2PointsFor = (team) => {
    if (team.day !== 2 && !team.isFinished) return 0
    if (team.day1Points != null) return team.points ?? 0  // clean: points = J2 only
    const d2 = _day2FromCheckpoints(team)
    return d2 ?? (team.points ?? 0)
  }

  // Total points across both days
  const totalPoints = (team) => {
    if (team.day1Points != null) return (team.day1Points ?? 0) + (team.points ?? 0)
    return team.points ?? 0
  }

  // Sort by current day points first, then time as tiebreaker
  const rankedTeams = computed(() =>
    [...teams.value].sort((a, b) => {
      const aP = currentDayPoints(a)
      const bP = currentDayPoints(b)
      if (bP !== aP) return bP - aP
      return elapsedSecondsFor(a) - elapsedSecondsFor(b)
    })
  )

  // Ranked by Day 1 points only
  const rankedTeamsDay1 = computed(() =>
    [...teams.value].sort((a, b) => {
      const aP = day1PointsFor(a), bP = day1PointsFor(b)
      if (bP !== aP) return bP - aP
      return elapsedSecondsFor(a) - elapsedSecondsFor(b)
    })
  )

  // Ranked by Day 2 points only (teams not yet on day 2 sit at the bottom with 0)
  const rankedTeamsDay2 = computed(() =>
    [...teams.value].sort((a, b) => {
      const aP = day2PointsFor(a), bP = day2PointsFor(b)
      if (bP !== aP) return bP - aP
      return elapsedSecondsFor(a) - elapsedSecondsFor(b)
    })
  )

  // Ranked by total (day1 + day2)
  const rankedTeamsTotal = computed(() =>
    [...teams.value].sort((a, b) => {
      const aT = totalPoints(a)
      const bT = totalPoints(b)
      if (bT !== aT) return bT - aT
      return elapsedSecondsFor(a) - elapsedSecondsFor(b)
    })
  )

  const elapsedSecondsFor = (team) => {
    const start = team.startedAt?.toDate?.()
    const end = team.isFinished ? team.finishedAt?.toDate?.() ?? new Date() : new Date()
    if (!start) return 0
    return Math.floor((end - start) / 1000)
  }

  const formatTime = (seconds) => {
    if (!seconds) return '00:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const subscribe = async () => {
    tracks.value = await getTracks()
    unsubTeams?.()
    unsubCheckpoints?.()
    unsubCheckpoints = subscribeToCheckpoints((data) => { checkpoints.value = data })
    unsubTeams = subscribeToAllTeams((data) => { teams.value = data })
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
