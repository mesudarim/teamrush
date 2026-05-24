import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  subscribeToCheckpoints, subscribeToTracks, subscribeToAllTeams,
  createCheckpoint, updateCheckpoint, deleteCheckpoint,
  createTrack, updateTrack, deleteTrack,
  getSettings, updateSettings,
} from '@/firebase/firestore'
import { uploadMapImage } from '@/firebase/storage'

export const useAdminStore = defineStore('admin', () => {
  const checkpoints = ref([])
  const tracks = ref([])
  const teams = ref([])
  const settings = ref({})
  const isLoading = ref(false)

  let unsubs = []

  const init = () => {
    unsubs.push(subscribeToCheckpoints((data) => { checkpoints.value = data }))
    unsubs.push(subscribeToTracks((data) => { tracks.value = data }))
    unsubs.push(subscribeToAllTeams((data) => { teams.value = data }))
    loadSettings()
  }

  const loadSettings = async () => {
    settings.value = await getSettings()
  }

  // ─── Checkpoints ────────────────────────────────────────────────────────────

  const saveCheckpoint = async (data, imageFile, existingId = null) => {
    isLoading.value = true
    try {
      let mapImageUrl = data.mapImageUrl ?? ''
      if (imageFile) {
        const tempId = existingId ?? 'new_' + Date.now()
        mapImageUrl = await uploadMapImage(imageFile, tempId)
      }
      const payload = { ...data, mapImageUrl }
      if (existingId) {
        await updateCheckpoint(existingId, payload)
        return existingId
      } else {
        return await createCheckpoint(payload)
      }
    } finally {
      isLoading.value = false
    }
  }

  const removeCheckpoint = async (id) => {
    // Remove from all tracks first
    for (const track of tracks.value) {
      if (track.checkpointIds?.includes(id)) {
        await updateTrack(track.id, {
          checkpointIds: track.checkpointIds.filter((cid) => cid !== id),
        })
      }
    }
    await deleteCheckpoint(id)
  }

  // ─── Tracks ──────────────────────────────────────────────────────────────────

  const saveTrack = async (data, existingId = null) => {
    isLoading.value = true
    try {
      if (existingId) {
        await updateTrack(existingId, data)
        return existingId
      } else {
        return await createTrack(data)
      }
    } finally {
      isLoading.value = false
    }
  }

  const removeTrack = async (id) => {
    await deleteTrack(id)
  }

  // ─── Settings ────────────────────────────────────────────────────────────────

  const saveSettings = async (data) => {
    await updateSettings(data)
    settings.value = { ...settings.value, ...data }
  }

  const cleanup = () => {
    unsubs.forEach((u) => u())
    unsubs = []
  }

  return {
    checkpoints, tracks, teams, settings, isLoading,
    init, saveCheckpoint, removeCheckpoint, saveTrack, removeTrack, saveSettings, cleanup,
  }
})
