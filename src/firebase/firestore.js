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
  arrayUnion,
  runTransaction,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'

// ─── Participants ─────────────────────────────────────────────────────────────

export const getParticipants = async () => {
  const snap = await getDocs(query(collection(db, 'participants'), orderBy('createdAt', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const createParticipant = async (data) => {
  const ref = await addDoc(collection(db, 'participants'), {
    name: data.name?.trim() ?? '',
    email: data.email?.trim().toLowerCase() ?? '',
    phone: data.phone?.trim().replace(/[\s\-\.]/g, '') ?? '',
    loggedIn: false,
    teamId: null,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export const bulkCreateParticipants = async (list) => {
  const batch = writeBatch(db)
  list.forEach((data) => {
    const ref = doc(collection(db, 'participants'))
    batch.set(ref, {
      name: data.name?.trim() ?? '',
      email: data.email?.trim().toLowerCase() ?? '',
      phone: data.phone?.trim().replace(/[\s\-\.]/g, '') ?? '',
      loggedIn: false,
      teamId: null,
      createdAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

export const updateParticipant = async (id, data) => {
  await updateDoc(doc(db, 'participants', id), data)
}

export const deleteParticipant = async (id) => {
  await deleteDoc(doc(db, 'participants', id))
  // Also remove the team document if it exists (team ID = participant ID)
  const teamRef = doc(db, 'teams', id)
  const teamSnap = await getDoc(teamRef)
  if (teamSnap.exists()) await deleteDoc(teamRef)
}

export const subscribeToParticipants = (callback) =>
  onSnapshot(query(collection(db, 'participants'), orderBy('createdAt', 'asc')), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

// Find a participant by name, email or phone (client-side filter — fine for <1000 people)
export const findParticipantByIdentifier = async (query_) => {
  const raw        = query_.trim()
  const lower      = raw.toLowerCase()
  const normalized = lower.replace(/[\s\-\.]/g, '')

  // Fast path: three targeted queries in parallel — covers name, email, and phone
  const [nameSnap, emailSnap, phoneSnap] = await Promise.all([
    getDocs(query(collection(db, 'participants'), where('name', '==', raw))),
    getDocs(query(collection(db, 'participants'), where('email', '==', lower))),
    getDocs(query(collection(db, 'participants'), where('phone', '==', normalized))),
  ])
  const fastDoc = [...nameSnap.docs, ...emailSnap.docs, ...phoneSnap.docs][0]
  if (fastDoc) return { id: fastDoc.id, ...fastDoc.data() }

  // Fallback: full scan for case-insensitive name or alternate email casing
  const snap = await getDocs(collection(db, 'participants'))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .find(p =>
      p.name?.trim().toLowerCase() === lower ||
      p.email?.toLowerCase().replace(/[\s\-\.]/g, '') === normalized ||
      p.phone?.replace(/[\s\-\.]/g, '') === normalized
    ) ?? null
}

// ─── Teams ────────────────────────────────────────────────────────────────────

// participant is the full participant document — used to copy pre-assigned routes on first login
export const createTeam = async (pseudo, trackId, displayName = '', participant = null) => {
  const ref = doc(db, 'teams', pseudo)
  const existing = await getDoc(ref)

  // Use participant's pre-assigned trackId if available
  const resolvedTrackId = participant?.assignedTrackId ?? trackId

  if (existing.exists()) {
    const updateData = { displayName, updatedAt: serverTimestamp() }
    // Copy routes if team doesn't have them yet but participant does
    if (participant?.day1Order?.length && !existing.data().day1Order?.length) {
      updateData.day1Order = participant.day1Order
      updateData.day2Order = participant.day2Order
      updateData.day = participant.day ?? 1
      updateData.trackId = resolvedTrackId
    }
    await updateDoc(ref, updateData)
    // Return merged data (updatedAt approximated locally; refreshTeam() will fetch exact value)
    return { id: pseudo, ...existing.data(), ...updateData, updatedAt: new Date() }
  }

  const teamData = {
    pseudo,
    trackId: resolvedTrackId,
    displayName,
    currentCheckpointIndex: 0,
    points: 0,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    checkpointTimes: {},
    completedCheckpoints: [],
    isFinished: false,
  }

  if (participant?.day1Order?.length) {
    teamData.day1Order = participant.day1Order
    teamData.day2Order = participant.day2Order
    teamData.day = participant.day ?? 1
  }

  await setDoc(ref, teamData)
  // Return local copy with Date approximations (refreshTeam() replaces with server Timestamps)
  return { id: pseudo, ...teamData, startedAt: new Date(), updatedAt: new Date() }
}

export const getTeam = async (pseudo) => {
  const snap = await getDoc(doc(db, 'teams', pseudo))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const adjustPoints = async (pseudo, delta) => {
  await updateDoc(doc(db, 'teams', pseudo), {
    points: increment(delta),
    updatedAt: serverTimestamp(),
  })
}

// Admin: reset ALL teams + participants to pre-game state (keeps routes + names)
export const resetAllTeams = async () => {
  const [teamsSnap, participantsSnap] = await Promise.all([
    getDocs(collection(db, 'teams')),
    getDocs(collection(db, 'participants')),
  ])

  const BATCH_SIZE = 400
  const allOps = [
    ...teamsSnap.docs.map(d => ({ ref: d.ref, op: 'delete' })),
    ...participantsSnap.docs.map(d => ({ ref: d.ref, op: 'update', data: { loggedIn: false, finished: false } })),
  ]

  for (let i = 0; i < allOps.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    allOps.slice(i, i + BATCH_SIZE).forEach(({ ref, op, data }) => {
      if (op === 'delete') batch.delete(ref)
      else batch.update(ref, data)
    })
    await batch.commit()
  }
}

// Persist the in-checkpoint phase so players can resume exactly where they left off
export const resetTeamProgress = async (pseudo, trackId) => {
  await updateDoc(doc(db, 'teams', pseudo), {
    currentCheckpointIndex: 0,
    points: 0,
    completedCheckpoints: [],
    checkpointTimes: {},
    isFinished: false,
    currentPhase: 'envelope1',
    savedQuestionIndex: 0,
    trackId,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export const saveTeamPhase = async (pseudo, phase, questionIndex = 0) => {
  await updateDoc(doc(db, 'teams', pseudo), {
    currentPhase: phase,
    savedQuestionIndex: questionIndex,
    updatedAt: serverTimestamp(),
  })
}

export const setPreLaunchDone = async (pseudo) => {
  await updateDoc(doc(db, 'teams', pseudo), {
    preLaunchDone: true,
    currentPhase: 'envelope1',
    savedQuestionIndex: 0,
    updatedAt: serverTimestamp(),
  })
}

export const updateTeamProgress = async (pseudo, checkpointId, { missionAnswer } = {}) => {
  const update = {
    currentCheckpointIndex: increment(1),
    completedCheckpoints: arrayUnion(checkpointId),
    [`checkpointTimes.${checkpointId}.completedAt`]: serverTimestamp(),
    currentPhase: null,
    savedQuestionIndex: 0,
    updatedAt: serverTimestamp(),
  }
  if (missionAnswer) {
    update[`checkpointTimes.${checkpointId}.missionAnswer`] = missionAnswer
  }
  await updateDoc(doc(db, 'teams', pseudo), update)
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
    currentPhase: null,
    updatedAt: serverTimestamp(),
  })
  // Sync participant status so the admin panel reflects the correct state
  const pRef = doc(db, 'participants', pseudo)
  const pSnap = await getDoc(pRef)
  if (pSnap.exists()) await updateDoc(pRef, { loggedIn: false, finished: true })
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

export const getAllTeams = async () => {
  const snap = await getDocs(collection(db, 'teams'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const deleteTeam = async (id) => {
  await deleteDoc(doc(db, 'teams', id))
}

// ─── Two-day system ───────────────────────────────────────────────────────────

// Assign unique routes to participants (stored BEFORE login, copied to team on login)
// assignments = [{ participantId, trackId, day1Order, day2Order }, ...]
export const assignRoutesToParticipants = async (assignments) => {
  const BATCH_SIZE = 400
  for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    assignments.slice(i, i + BATCH_SIZE).forEach(({ participantId, trackId, day1Order, day2Order }) => {
      batch.update(doc(db, 'participants', participantId), {
        day1Order,
        day2Order,
        assignedTrackId: trackId,
        day: 1,
        updatedAt: serverTimestamp(),
      })
    })
    await batch.commit()
  }
}

// Legacy alias kept for teams that already exist
export const assignRoutes = assignRoutesToParticipants

// Admin: switch back to Day 1 — restores archived day1Points, resets day 2 progress
export const activateDay1 = async () => {
  const snap = await getDocs(collection(db, 'teams'))
  const teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const BATCH_SIZE = 400
  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    teams.slice(i, i + BATCH_SIZE).forEach((team) => {
      batch.update(doc(db, 'teams', team.id), {
        day: 1,
        points: team.day1Points ?? 0,   // restore archived Day 1 points
        currentCheckpointIndex: 0,
        isFinished: false,
        day1Finished: false,
        currentPhase: null,
        savedQuestionIndex: 0,
        completedCheckpoints: [],
        checkpointTimes: {},
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })
    await batch.commit()
  }
}

// Mark a team as having finished Day 1 (waiting for Day 2 activation)
export const markDay1Complete = async (pseudo, timeBonusPoints = 0) => {
  await updateDoc(doc(db, 'teams', pseudo), {
    day1Finished: true,
    day1BonusPoints: timeBonusPoints,
    day1FinishedAt: serverTimestamp(),
    points: increment(timeBonusPoints),
    currentPhase: null,
    updatedAt: serverTimestamp(),
  })
  // Mirror to participant so admin panels show correct status
  const pRef = doc(db, 'participants', pseudo)
  const pSnap = await getDoc(pRef)
  if (pSnap.exists()) await updateDoc(pRef, { loggedIn: false, day1Finished: true })
}

// Admin: activate Day 2 for all teams (archive Day 1 points, reset for Day 2)
export const activateDay2 = async () => {
  const snap = await getDocs(collection(db, 'teams'))
  const teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const BATCH_SIZE = 400
  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    teams.slice(i, i + BATCH_SIZE).forEach((team) => {
      batch.update(doc(db, 'teams', team.id), {
        day: 2,
        day1Points: team.points ?? 0,
        points: 0,
        currentCheckpointIndex: 0,
        isFinished: false,
        day1Finished: false,
        currentPhase: null,
        savedQuestionIndex: 0,
        completedCheckpoints: [],
        checkpointTimes: {},
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })
    await batch.commit()
  }
}

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

// Player exit: delete the team entirely so the participant returns to 'waiting' state
export const deleteTeamDoc = async (pseudo) => {
  await deleteDoc(doc(db, 'teams', pseudo))
}

// Admin: delete team documents that have no matching participant (leftover from testing)
export const cleanOrphanTeams = async () => {
  const [teamsSnap, participantsSnap] = await Promise.all([
    getDocs(collection(db, 'teams')),
    getDocs(collection(db, 'participants')),
  ])
  const participantIds = new Set(participantsSnap.docs.map(d => d.id))
  const orphans = teamsSnap.docs.filter(d => !participantIds.has(d.id))
  await Promise.all(orphans.map(d => deleteDoc(d.ref)))
  return orphans.length
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

// ─── Photos ───────────────────────────────────────────────────────────────────

export const savePhotoRecord = async (data) => {
  await addDoc(collection(db, 'photos'), {
    teamPseudo:      data.teamPseudo,
    teamName:        data.teamName ?? data.teamPseudo,
    checkpointId:    data.checkpointId,
    checkpointTitle: data.checkpointTitle ?? '',
    url:             data.url,
    uploadedAt:      serverTimestamp(),
  })
}

export const subscribeToPhotos = (callback) =>
  onSnapshot(
    query(collection(db, 'photos'), orderBy('uploadedAt', 'desc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

// ─── Audio Recordings ─────────────────────────────────────────────────────────

export const saveAudioRecord = async (data) => {
  await addDoc(collection(db, 'audioRecordings'), {
    teamPseudo:      data.teamPseudo,
    teamName:        data.teamName ?? data.teamPseudo,
    checkpointId:    data.checkpointId,
    checkpointTitle: data.checkpointTitle ?? '',
    url:             data.url,
    mimeType:        data.mimeType ?? '',
    durationSeconds: data.durationSeconds ?? 0,
    uploadedAt:      serverTimestamp(),
  })
}

export const subscribeToAudioRecordings = (callback) =>
  onSnapshot(
    query(collection(db, 'audioRecordings'), orderBy('uploadedAt', 'desc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
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

// ─── Admin Emails ──────────────────────────────────────────────────────────────

export const getAdminEmails = async () => {
  const snap = await getDoc(doc(db, 'config', 'adminEmails'))
  return snap.exists() ? (snap.data().emails ?? []) : []
}

export const saveAdminEmails = async (emails) => {
  await setDoc(doc(db, 'config', 'adminEmails'), { emails })
}
