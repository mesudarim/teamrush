import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createTeam, getTeam } from '@/firebase/firestore'

export const useAuthStore = defineStore('auth', () => {
  const team = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  const isLoggedIn = computed(() => !!team.value)
  const pseudo = computed(() => team.value?.pseudo ?? null)
  const trackId = computed(() => team.value?.trackId ?? null)

  const login = async (pseudo, trackId) => {
    isLoading.value = true
    error.value = null
    try {
      // Try to get existing team first (rejoin support)
      let existing = await getTeam(pseudo)
      if (existing) {
        // Allow rejoin only if same track
        if (existing.trackId !== trackId) throw new Error('PSEUDO_TAKEN')
        team.value = existing
      } else {
        await createTeam(pseudo, trackId)
        team.value = await getTeam(pseudo)
      }
      sessionStorage.setItem('teamrush_pseudo', pseudo)
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      isLoading.value = false
    }
  }

  const logout = () => {
    team.value = null
    sessionStorage.removeItem('teamrush_pseudo')
  }

  const restoreSession = async () => {
    const savedPseudo = sessionStorage.getItem('teamrush_pseudo')
    if (savedPseudo) {
      const data = await getTeam(savedPseudo)
      if (data) team.value = data
    }
  }

  const refreshTeam = async () => {
    if (!pseudo.value) return
    team.value = await getTeam(pseudo.value)
  }

  return { team, isLoading, error, isLoggedIn, pseudo, trackId, login, logout, restoreSession, refreshTeam }
})
