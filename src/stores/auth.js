import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createTeam, getTeam, findParticipantByIdentifier, updateParticipant } from '@/firebase/firestore'

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
      // 1. Find participant in the pre-registered list
      const found = await findParticipantByIdentifier(identifier)
      if (!found) {
        throw new Error('NOT_ON_LIST')
      }

      // 2. Use participant ID as the team pseudo for uniqueness
      const teamPseudo = found.id
      participant.value = found

      // 3. Create or rejoin team
      let existing = await getTeam(teamPseudo)
      if (existing) {
        team.value = existing
      } else {
        await createTeam(teamPseudo, trackId)
        team.value = await getTeam(teamPseudo)
      }

      // 4. Mark participant as logged in
      await updateParticipant(found.id, { loggedIn: true, teamId: teamPseudo, lastLoginAt: new Date() })

      sessionStorage.setItem('teamrush_pseudo', teamPseudo)
      sessionStorage.setItem('teamrush_participant', JSON.stringify(found))
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
    sessionStorage.removeItem('teamrush_pseudo')
    sessionStorage.removeItem('teamrush_participant')
  }

  const restoreSession = async () => {
    const savedPseudo = sessionStorage.getItem('teamrush_pseudo')
    const savedParticipant = sessionStorage.getItem('teamrush_participant')
    if (savedPseudo) {
      const data = await getTeam(savedPseudo)
      if (data) {
        team.value = data
        if (savedParticipant) participant.value = JSON.parse(savedParticipant)
      }
    }
  }

  const refreshTeam = async () => {
    if (!pseudo.value) return
    team.value = await getTeam(pseudo.value)
  }

  return { team, participant, isLoading, error, isLoggedIn, pseudo, trackId, login, logout, restoreSession, refreshTeam }
})
