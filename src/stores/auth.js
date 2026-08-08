import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  createTeam, getTeam, findParticipantByIdentifier,
  updateParticipant, deleteTeamDoc,
} from '@/firebase/firestore'
import { useGameContextStore } from './gameContext'

// localStorage keys are gameId-scoped to avoid cross-game conflicts
const pseudoKey      = (gid) => `tr_${gid}_pseudo`
const participantKey = (gid) => `tr_${gid}_participant`
const loginDayKey    = (gid) => `tr_${gid}_login_day`

export const useAuthStore = defineStore('auth', () => {
  const team        = ref(null)
  const participant = ref(null)
  const isLoading   = ref(false)
  const error       = ref(null)

  const isLoggedIn = computed(() => !!team.value)
  const pseudo     = computed(() => team.value?.pseudo ?? null)
  const trackId    = computed(() => team.value?.trackId ?? null)

  const _gameId = () => useGameContextStore().gameId

  // Mode liste : login par téléphone / nom / email (liste préchargée)
  const login = async (identifier, trackId, day = 1, isVerif = false) => {
    isLoading.value = true
    error.value = null
    const gid = _gameId()
    try {
      const found = await findParticipantByIdentifier(gid, identifier)
      if (!found) throw new Error('NOT_ON_LIST')

      const teamPseudo = found.id
      participant.value = found
      team.value = await createTeam(gid, teamPseudo, trackId, found.name ?? '', found, day, isVerif)

      updateParticipant(gid, found.id, { loggedIn: true, teamId: teamPseudo, lastLoginAt: new Date() }).catch(() => {})

      localStorage.setItem(pseudoKey(gid), teamPseudo)
      localStorage.setItem(participantKey(gid), JSON.stringify(found))
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Mode ouvert : inscription libre avec un pseudo choisi par le joueur
  const loginOpen = async (chosenPseudo, day = 1, isVerif = false) => {
    isLoading.value = true
    error.value = null
    const gid = _gameId()
    const slug = chosenPseudo.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '')
    if (!slug) { error.value = 'INVALID_PSEUDO'; isLoading.value = false; return false }
    try {
      // createTeam handles both new teams and returning players with the same pseudo
      team.value = await createTeam(gid, slug, '', chosenPseudo.trim(), null, day, isVerif)
      participant.value = null  // pas de participant doc en mode ouvert
      localStorage.setItem(pseudoKey(gid), slug)
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      isLoading.value = false
    }
  }

  const logout = (gid) => {
    const id = gid ?? _gameId()
    team.value = null
    participant.value = null
    localStorage.removeItem(pseudoKey(id))
    localStorage.removeItem(participantKey(id))
  }

  const logoutAndSetInactive = async () => {
    const gid = _gameId()
    if (participant.value?.id) {
      await updateParticipant(gid, participant.value.id, { loggedIn: false }).catch(() => {})
    }
    logout(gid)
  }

  const resetAndLogout = async () => {
    const gid = _gameId()
    if (team.value?.pseudo) await deleteTeamDoc(gid, team.value.pseudo)
    if (participant.value?.id) {
      await updateParticipant(gid, participant.value.id, { loggedIn: false, finished: false })
    }
    logout(gid)
  }

  const restoreSession = async (gid) => {
    if (!gid) return
    const savedPseudo      = localStorage.getItem(pseudoKey(gid))
    const savedParticipant = localStorage.getItem(participantKey(gid))
    if (!savedPseudo) return

    const data = await getTeam(gid, savedPseudo)
    if (data) {
      if (data.day === 2 && data.resetToken && !data.preLaunchDay2Done) {
        localStorage.removeItem(pseudoKey(gid))
        localStorage.removeItem(participantKey(gid))
        localStorage.setItem(loginDayKey(gid), '2')
        return
      }
      team.value = data
      if (savedParticipant) participant.value = JSON.parse(savedParticipant)
    } else {
      localStorage.removeItem(pseudoKey(gid))
      localStorage.removeItem(participantKey(gid))
    }
  }

  const refreshTeam = async () => {
    if (!pseudo.value) return
    team.value = await getTeam(_gameId(), pseudo.value)
  }

  const getLoginDayKey = (gid) => loginDayKey(gid ?? _gameId())

  return {
    team, participant, isLoading, error,
    isLoggedIn, pseudo, trackId,
    login, loginOpen, logout, logoutAndSetInactive, resetAndLogout,
    restoreSession, refreshTeam, getLoginDayKey,
  }
})
