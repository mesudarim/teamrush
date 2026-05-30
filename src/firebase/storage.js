import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './config'

export const uploadMapImage = async (file, checkpointId) => {
  const storageRef = ref(storage, `maps/${checkpointId}/${Date.now()}_${file.name}`)
  const snap = await uploadBytes(storageRef, file)
  return getDownloadURL(snap.ref)
}

export const deleteFile = async (url) => {
  const fileRef = ref(storage, url)
  await deleteObject(fileRef)
}

export const uploadPhoto = async (blob, checkpointId, pseudo) => {
  const storageRef = ref(storage, `photos/${checkpointId}/${pseudo}_${Date.now()}.jpg`)
  const snap = await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(snap.ref)
}

export const uploadPuzzleImage = async (blob, checkpointId) => {
  const storageRef = ref(storage, `puzzles/${checkpointId}/${Date.now()}.jpg`)
  const snap = await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(snap.ref)
}

export const uploadAudioRecording = async (blob, checkpointId, pseudo, ext, mimeType) => {
  const storageRef = ref(storage, `recordings/${checkpointId}/${pseudo}_${Date.now()}.${ext}`)
  const snap = await uploadBytes(storageRef, blob, { contentType: mimeType || 'audio/webm' })
  return getDownloadURL(snap.ref)
}

export const uploadMissingWordImage = async (blob, checkpointId, qIdx) => {
  const storageRef = ref(storage, `missing-words/${checkpointId}/q${qIdx}_${Date.now()}.jpg`)
  const snap = await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(snap.ref)
}
