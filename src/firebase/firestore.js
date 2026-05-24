/**
 * Firestore service layer — all DB operations go through here.
 *
 * Schema overview:
 *   /teams/{pseudo}
 *     pseudo: string (unique, doc ID)
 *     trackId: string
 *     currentCheckpointIndex: number
 *     points: number
 *     startedAt: Timestamp
 *     updatedAt: Timestamp
 *     checkpointTimes: { [checkpointId]: { startedAt, completedAt } }
 *     completedCheckpoints: string[]
 *     isFinished: boolean
 *
 *   /tracks/{trackId}
 *     name: string
 *     nameEn: string
 *     description: string
 *     checkpointIds: string[]   // ordered list of checkpoint doc IDs
 *     isActive: boolean
 *     createdAt: Timestamp
 *
 *   /checkpoints/{checkpointId}
 *     title: string
 *     titleEn: string
 *     description: string
 *     descriptionEn: string
 *     youtubeUrl: string
 *     mapType: 'image' | 'coordinates'
 *     mapImageUrl: string
 *     mapLat: number
 *     mapLng: number
 *     mapZoom: number
 *     stage1Keyword: string
 *     missionType: 'TextValidation' | 'MultipleChoice'
 *     missionConfig: object   // varies by missionType
 *     pointsCorrect: number
 *     pointsWrong: number
 *     order: number
 *     createdAt: Timestamp
 *
 *   /settings/global
 *     introVideoUrl: string
 *     eventName: string
 *     isEventLive: boolean
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  increment,
  runTransaction,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'

// ─── Teams ────────────────────────────────────────────────────────────────────

export const createTeam = async (pseudo, trackId) => {
  const ref = doc(db, 'teams', pseudo)
  const existing = await getDoc(ref)
  if (existing.exists()) throw new Error('PSEUDO_TAKEN')
  await setDoc(ref, {
    pseudo,
    trackId,
    currentCheckpointIndex: 0,
    points: 0,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    checkpointTimes: {},
    completedCheckpoints: [],
    isFinished: false,
  })
  return pseudo
}

export const getTeam = async (pseudo) => {
  const snap = await getDoc(doc(db, 'teams', pseudo))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const updateTeamProgress = async (pseudo, checkpointId, { correct, pointsDelta, missionAnswer }) => {
  const ref = doc(db, 'teams', pseudo)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Team not found')
    const data = snap.data()
    const newIndex = data.currentCheckpointIndex + 1
    const completedCheckpoints = [...data.completedCheckpoints, checkpointId]
    const checkpointTimes = {
      ...data.checkpointTimes,
      [checkpointId]: {
        ...data.checkpointTimes?.[checkpointId],
        completedAt: serverTimestamp(),
        correct,
        missionAnswer,
      },
    }
    tx.update(ref, {
      points: increment(pointsDelta),
      currentCheckpointIndex: newIndex,
      completedCheckpoints,
      checkpointTimes,
      updatedAt: serverTimestamp(),
    })
  })
}

export const startCheckpointTimer = async (pseudo, checkpointId) => {
  await updateDoc(doc(db, 'teams', pseudo), {
    [`checkpointTimes.${checkpointId}.startedAt`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export const markTeamFinished = async (pseudo, timeBonusPoints = 0) => {
  await updateDoc(doc(db, 'teams', pseudo), {
    isFinished: true,
    finishedAt: serverTimestamp(),
    timeBonusPoints,
    points: increment(timeBonusPoints),
    updatedAt: serverTimestamp(),
  })
}

export const subscribeToTeam = (pseudo, callback) =>
  onSnapshot(doc(db, 'teams', pseudo), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
  })

export const subscribeToAllTeams = (callback) =>
  onSnapshot(
    query(collection(db, 'teams'), orderBy('points', 'desc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

// ─── Tracks ───────────────────────────────────────────────────────────────────

export const getTracks = async () => {
  const snap = await getDocs(query(collection(db, 'tracks'), orderBy('createdAt', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getActiveTracks = async () => {
  const snap = await getDocs(query(collection(db, 'tracks'), where('isActive', '==', true)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getTrack = async (trackId) => {
  const snap = await getDoc(doc(db, 'tracks', trackId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const createTrack = async (data) => {
  const ref = await addDoc(collection(db, 'tracks'), { ...data, createdAt: serverTimestamp() })
  return ref.id
}

export const updateTrack = async (trackId, data) => {
  await updateDoc(doc(db, 'tracks', trackId), { ...data, updatedAt: serverTimestamp() })
}

export const deleteTrack = async (trackId) => {
  await deleteDoc(doc(db, 'tracks', trackId))
}

export const subscribeToTracks = (callback) =>
  onSnapshot(query(collection(db, 'tracks'), orderBy('createdAt', 'asc')), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

// ─── Checkpoints ──────────────────────────────────────────────────────────────

export const getCheckpoints = async () => {
  const snap = await getDocs(query(collection(db, 'checkpoints'), orderBy('createdAt', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getCheckpoint = async (checkpointId) => {
  const snap = await getDoc(doc(db, 'checkpoints', checkpointId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const createCheckpoint = async (data) => {
  const ref = await addDoc(collection(db, 'checkpoints'), { ...data, createdAt: serverTimestamp() })
  return ref.id
}

export const updateCheckpoint = async (checkpointId, data) => {
  await updateDoc(doc(db, 'checkpoints', checkpointId), { ...data, updatedAt: serverTimestamp() })
}

export const deleteCheckpoint = async (checkpointId) => {
  await deleteDoc(doc(db, 'checkpoints', checkpointId))
}

export const subscribeToCheckpoints = (callback) =>
  onSnapshot(query(collection(db, 'checkpoints'), orderBy('createdAt', 'asc')), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = async () => {
  const snap = await getDoc(doc(db, 'settings', 'global'))
  return snap.exists() ? snap.data() : {}
}

export const updateSettings = async (data) => {
  await setDoc(doc(db, 'settings', 'global'), data, { merge: true })
}

export const subscribeToSettings = (callback) =>
  onSnapshot(doc(db, 'settings', 'global'), (snap) => {
    if (snap.exists()) callback(snap.data())
  })
