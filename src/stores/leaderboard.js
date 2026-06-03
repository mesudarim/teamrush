import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { subscribeToAllTeams, getTracks } from '@/firebase/firestore'

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const teams = ref([])
  const tracks = ref([])
  let unsubscribe = null

  const trackMap = computed(() => {
    const map = {}
    tracks.value.forEach((t) => { map[t.id] = t })
    return map
  })

  const rankedTeams = computed(() =>
    [...teams.value].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      // Secondary sort: fewer seconds is better
      const aTime = elapsedSecondsFor(a)
      const bTime = elapsedSecondsFor(b)
      return aTime - bTime
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

  return { teams, tracks, trackMap, rankedTeams, elapsedSecondsFor, formatTime, subscribe, cleanup }
})
