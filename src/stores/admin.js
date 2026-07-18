import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  subscribeToCheckpoints, subscribeToTracks, subscribeToAllTeams,
  createCheckpoint, updateCheckpoint, deleteCheckpoint,
  createTrack, updateTrack, deleteTrack,
  getSettings, updateSettings,
  resetAllTeams,
} from '@/firebase/firestore'
import { uploadMapImage, uploadPuzzleImage, uploadStage1Image } from '@/firebase/storage'
import { useGameContextStore } from './gameContext'

export const useAdminStore = defineStore('admin', () => {
  const checkpoints = ref([])
  const tracks      = ref([])
  const teams       = ref([])
  const settings    = ref({})
  const isLoading   = ref(false)

  let unsubs = []

  const _gid = () => useGameContextStore().gameId

  const init = () => {
    const gid = _gid()
    unsubs.push(subscribeToCheckpoints(gid, (data) => { checkpoints.value = data }))
    unsubs.push(subscribeToTracks(gid, (data) => { tracks.value = data }))
    unsubs.push(subscribeToAllTeams(gid, (data) => { teams.value = data }))
    loadSettings()
  }

  const loadSettings = async () => {
    settings.value = await getSettings(_gid())
  }

  // ─── Checkpoints ─────────────────────────────────────────────────────────────

  const saveCheckpoint = async (data, imageFile, existingId = null, puzzleImageBlob = null, stage1ImageBlob = null) => {
    const gid = _gid()
    isLoading.value = true
    try {
      const tempId = existingId ?? 'new_' + Date.now()
      let mapImageUrl = data.mapImageUrl ?? ''
      if (imageFile) mapImageUrl = await uploadMapImage(imageFile, tempId, gid)

      let missionConfig = { ...(data.missionConfig ?? {}) }
      if (puzzleImageBlob) {
        missionConfig.puzzleImageUrl = await uploadPuzzleImage(puzzleImageBlob, tempId, gid)
      }

      let stage1ImageUrl = data.stage1ImageUrl ?? ''
      if (stage1ImageBlob) stage1ImageUrl = await uploadStage1Image(stage1ImageBlob, tempId, gid)

      const payload = { ...data, mapImageUrl, missionConfig, stage1ImageUrl }
      if (existingId) {
        await updateCheckpoint(gid, existingId, payload)
        return existingId
      } else {
        return await createCheckpoint(gid, payload)
      }
    } finally {
      isLoading.value = false
    }
  }

  const removeCheckpoint = async (id) => {
    const gid = _gid()
    for (const track of tracks.value) {
      if (track.checkpointIds?.includes(id)) {
        await updateTrack(gid, track.id, {
          checkpointIds: track.checkpointIds.filter((cid) => cid !== id),
        })
      }
    }
    await deleteCheckpoint(gid, id)
  }

  // ─── Tracks ──────────────────────────────────────────────────────────────────

  const saveTrack = async (data, existingId = null) => {
    const gid = _gid()
    isLoading.value = true
    try {
      if (existingId) {
        await updateTrack(gid, existingId, data)
        return existingId
      } else {
        return await createTrack(gid, data)
      }
    } finally {
      isLoading.value = false
    }
  }

  const removeTrack = async (id) => {
    await deleteTrack(_gid(), id)
  }

  // ─── Settings ────────────────────────────────────────────────────────────────

  const saveSettings = async (data) => {
    const gid = _gid()
    await updateSettings(gid, data)
    settings.value = { ...settings.value, ...data }
  }

  const resetAll = async () => {
    await resetAllTeams(_gid())
  }

  const cleanup = () => {
    unsubs.forEach((u) => u())
    unsubs = []
  }

  return {
    checkpoints, tracks, teams, settings, isLoading,
    init, saveCheckpoint, removeCheckpoint, saveTrack, removeTrack,
    saveSettings, resetAll, cleanup, loadSettings,
  }
})
