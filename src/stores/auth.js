import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createTeam, getTeam, findParticipantByIdentifier, updateParticipant } from '@/firebase/firestore'

const PSEUDO_KEY       = 'teamrush_pseudo'
const PARTICIPANT_KEY  = 'teamrush_participant'

export const useAuthStore = defineStore('auth', () => {
  const team = ref(null)
  const participant = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  const isLoggedIn = computed(() => !!team.value)
  const pseudo = computed(() => team.value?.pseudo ?? null)
  const trackId = computed(() => team.value?.trackId ?? null)

  const login = async (identifier, trackId) => {
    isLoading.value = true
    error.value = null
    try {
      const found = await findParticipantByIdentifier(identifier)
      if (!found) throw new Error('NOT_ON_LIST')

      const teamPseudo = found.id
      participant.value = found

      // createTeam handles both new teams and returning players (updates displayName)
      await createTeam(teamPseudo, trackId, found.name ?? '')
      team.value = await getTeam(teamPseudo)

      await updateParticipant(found.id, { loggedIn: true, teamId: teamPseudo, lastLoginAt: new Date() })

      // localStorage so the session survives closing the browser/tab
      localStorage.setItem(PSEUDO_KEY, teamPseudo)
      localStorage.setItem(PARTICIPANT_KEY, JSON.stringify(found))
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
    participant.value = null
    localStorage.removeItem(PSEUDO_KEY)
    localStorage.removeItem(PARTICIPANT_KEY)
  }

  const restoreSession = async () => {
    const savedPseudo      = localStorage.getItem(PSEUDO_KEY)
    const savedParticipant = localStorage.getItem(PARTICIPANT_KEY)
    if (!savedPseudo) return
    // Always fetch fresh data from Firestore so points/phase are current
    const data = await getTeam(savedPseudo)
    if (data) {
      team.value = data
      if (savedParticipant) participant.value = JSON.parse(savedParticipant)
    } else {
      // Team was deleted — clear stale session
      localStorage.removeItem(PSEUDO_KEY)
      localStorage.removeItem(PARTICIPANT_KEY)
    }
  }

  const refreshTeam = async () => {
    if (!pseudo.value) return
    team.value = await getTeam(pseudo.value)
  }

  return { team, participant, isLoading, error, isLoggedIn, pseudo, trackId, login, logout, restoreSession, refreshTeam }
})
