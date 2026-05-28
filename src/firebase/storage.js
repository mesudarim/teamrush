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
