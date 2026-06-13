import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { subscribeToAllTeams, getTracks } from '@/firebase/firestore'

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const teams  = ref([])
  const tracks = ref([])
  let unsubscribe = null

  const trackMap = computed(() => {
    const map = {}
    tracks.value.forEach((t) => { map[t.id] = t })
    return map
  })

  // Whether any team is in Day 2 (signals 2-day mode is active)
  const isTwoDay = computed(() => teams.value.some(t => t.day === 2 || t.day1Points != null))

  // Points for the current day (legacy helper, still used when not in 2-day mode)
  const currentDayPoints = (team) => team.points ?? 0

  // Day 1 points: final score if day2 started, otherwise current running score
  const day1PointsFor = (team) => team.day1Points ?? team.points ?? 0

  // Day 2 points: only meaningful once the team has reached day 2
  const day2PointsFor = (team) => team.day === 2 ? team.points ?? 0 : 0

  // Total points across both days
  const totalPoints = (team) => (team.day1Points ?? 0) + (team.points ?? 0)

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
    unsubscribe?.()
    unsubscribe = subscribeToAllTeams((data) => { teams.value = data })
  }

  const cleanup = () => { unsubscribe?.() }

  return {
    teams, tracks, trackMap,
    isTwoDay,
    currentDayPoints, day1PointsFor, day2PointsFor, totalPoints,
    rankedTeams, rankedTeamsDay1, rankedTeamsDay2, rankedTeamsTotal,
    elapsedSecondsFor, formatTime,
    subscribe, cleanup,
  }
})
