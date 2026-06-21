import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createTeam, getTeam, findParticipantByIdentifier, updateParticipant, deleteTeamDoc } from '@/firebase/firestore'

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
      // Returns local team data directly — avoids an extra getDoc round-trip
      team.value = await createTeam(teamPseudo, trackId, found.name ?? '', found)

      // Fire-and-forget — admin visibility only, not needed for game to start
      updateParticipant(found.id, { loggedIn: true, teamId: teamPseudo, lastLoginAt: new Date() }).catch(() => {})

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

  const logoutAndSetInactive = async () => {
    // Keeps the team doc (score preserved) but marks participant as no longer logged in
    if (participant.value?.id) {
      await updateParticipant(participant.value.id, { loggedIn: false }).catch(() => {})
    }
    logout()
  }

  const resetAndLogout = async () => {
    // Delete the team document entirely → participant returns to 'waiting' in Monitor & Participants
    if (team.value?.pseudo) {
      await deleteTeamDoc(team.value.pseudo)
    }
    if (participant.value?.id) {
      await updateParticipant(participant.value.id, { loggedIn: false, finished: false })
    }
    logout()
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

  return { team, participant, isLoading, error, isLoggedIn, pseudo, trackId, login, logout, logoutAndSetInactive, resetAndLogout, restoreSession, refreshTeam }
})
