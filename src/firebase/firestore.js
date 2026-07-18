/**
 * Firestore service layer — all DB operations go through here.
 *
 * Multi-game schema:
 *   /games/{gameId}/participants/{id}
 *   /games/{gameId}/teams/{pseudo}
 *   /games/{gameId}/tracks/{trackId}
 *   /games/{gameId}/checkpoints/{checkpointId}
 *   /games/{gameId}/photos/{photoId}
 *   /games/{gameId}/audioRecordings/{recordingId}
 *   /games/{gameId}/settings/global
 *   /games/{gameId}/config/adminEmails
 *
 *   /games/{gameId}         → { id, name, slug, createdAt }
 *   /superadmins/list       → { emails: [] }
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
  writeBatch,
  deleteField,
} from 'firebase/firestore'
import { db } from './config'

// ─── Path helpers ─────────────────────────────────────────────────────────────

const gcol = (gameId, colName) => collection(db, 'games', gameId, colName)
const gdoc = (gameId, colName, docId) => doc(db, 'games', gameId, colName, docId)

// ─── Participants ─────────────────────────────────────────────────────────────

export const getParticipants = async (gameId) => {
  const snap = await getDocs(query(gcol(gameId, 'participants'), orderBy('createdAt', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const createParticipant = async (gameId, data) => {
  const ref = await addDoc(gcol(gameId, 'participants'), {
    name: data.name?.trim() ?? '',
    email: data.email?.trim().toLowerCase() ?? '',
    phone: data.phone?.trim().replace(/[\s\-\.]/g, '') ?? '',
    loggedIn: false,
    teamId: null,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export const bulkCreateParticipants = async (gameId, list) => {
  const batch = writeBatch(db)
  list.forEach((data) => {
    const ref = doc(gcol(gameId, 'participants'))
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

export const updateParticipant = async (gameId, id, data) => {
  await updateDoc(gdoc(gameId, 'participants', id), data)
}

export const deleteParticipant = async (gameId, id) => {
  const participantSnap = await getDoc(gdoc(gameId, 'participants', id))
  const teamPseudo = participantSnap.exists() ? participantSnap.data().teamId : null

  await deleteDoc(gdoc(gameId, 'participants', id))

  if (teamPseudo) {
    await deleteDoc(gdoc(gameId, 'teams', teamPseudo))
  }
}

export const subscribeToParticipants = (gameId, callback) =>
  onSnapshot(query(gcol(gameId, 'participants'), orderBy('createdAt', 'asc')), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

export const findParticipantByIdentifier = async (gameId, query_) => {
  const raw        = query_.trim()
  const normalized = raw.replace(/[\s\-\.]/g, '')
  const isDigitsOnly = /^\d+$/.test(normalized)

  if (isDigitsOnly) {
    const phoneSnap = await getDocs(query(gcol(gameId, 'participants'), where('phone', '==', normalized)))
    if (phoneSnap.docs.length > 0) {
      const d = phoneSnap.docs[0]
      return { id: d.id, ...d.data() }
    }
  } else {
    const lower = raw.toLowerCase()
    const [nameSnap, emailSnap] = await Promise.all([
      getDocs(query(gcol(gameId, 'participants'), where('name', '==', raw))),
      getDocs(query(gcol(gameId, 'participants'), where('email', '==', lower))),
    ])
    const fastDoc = [...nameSnap.docs, ...emailSnap.docs][0]
    if (fastDoc) return { id: fastDoc.id, ...fastDoc.data() }
  }

  const lower = raw.toLowerCase()
  const snap = await getDocs(gcol(gameId, 'participants'))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .find(p =>
      p.phone?.replace(/[\s\-\.]/g, '') === normalized ||
      p.name?.trim().toLowerCase() === lower ||
      p.email?.toLowerCase().replace(/[\s\-\.]/g, '') === normalized
    ) ?? null
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export const createTeam = async (gameId, pseudo, trackId, displayName = '', participant = null, day = 1) => {
  const ref = gdoc(gameId, 'teams', pseudo)
  const existing = await getDoc(ref)

  const resolvedTrackId = participant?.assignedTrackId ?? trackId

  if (existing.exists()) {
    const existingData = existing.data()

    if (day === 1 && existingData.day1Finished) throw new Error('DAY1_ALREADY_FINISHED')
    if (day === 2 && existingData.day === 2 && existingData.isFinished) throw new Error('DAY2_ALREADY_FINISHED')

    const updateData = { displayName, updatedAt: serverTimestamp() }

    if (participant?.day1Order?.length && !existingData.day1Order?.length) {
      updateData.day1Order = participant.day1Order
      updateData.day2Order = participant.day2Order
      updateData.trackId = resolvedTrackId
    }

    if (day !== (existingData.day ?? 1)) {
      updateData.day = day
      updateData.currentCheckpointIndex = 0
      updateData.currentPhase = null
      updateData.isFinished = false
    }

    await updateDoc(ref, updateData)
    return { id: pseudo, ...existingData, ...updateData, updatedAt: new Date() }
  }

  const teamData = {
    pseudo,
    trackId: resolvedTrackId,
    displayName,
    day,
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
  }

  await setDoc(ref, teamData)
  return { id: pseudo, ...teamData, startedAt: new Date(), updatedAt: new Date() }
}

export const getTeam = async (gameId, pseudo) => {
  const snap = await getDoc(gdoc(gameId, 'teams', pseudo))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const switchTeamDay = async (gameId, pseudo, day) => {
  const ref = gdoc(gameId, 'teams', pseudo)
  const snap = await getDoc(ref)
  if (!snap.exists()) return

  const data = snap.data()
  if (day === 2 && data.isFinished) throw new Error('DAY2_ALREADY_FINISHED')

  const currentDay = data.day ?? 1
  if (currentDay === day) return

  const updates = { day, updatedAt: serverTimestamp() }

  if (currentDay === 1 && day === 2) {
    updates.day1SavedIndex = data.currentCheckpointIndex ?? 0
    updates.day1SavedPhase = data.currentPhase ?? null
    if (!data.day1Points) updates.day1Points = data.points ?? 0
    updates.currentCheckpointIndex = data.day2SavedIndex ?? 0
    updates.currentPhase = data.day2SavedPhase ?? null
    updates.points = 0
    updates.isFinished = false
  } else if (currentDay === 2 && day === 1) {
    updates.day2SavedIndex = data.currentCheckpointIndex ?? 0
    updates.day2SavedPhase = data.currentPhase ?? null
    updates.day2Points = data.points ?? 0
    updates.currentCheckpointIndex = data.day1SavedIndex ?? 0
    updates.currentPhase = data.day1SavedPhase ?? null
    updates.points = data.day1Points ?? 0
  }

  await updateDoc(ref, updates)
}

export const resetTeamDay2 = async (gameId, pseudo) => {
  await updateDoc(gdoc(gameId, 'teams', pseudo), {
    day:                    2,
    currentCheckpointIndex: 0,
    currentPhase:           null,
    savedQuestionIndex:     0,
    isFinished:             false,
    preLaunchDay2Done:      false,
    points:                 0,
    day2SavedIndex:         0,
    day2SavedPhase:         null,
    day2StartedAt:          deleteField(),
    finishedAt:             deleteField(),
    resetToken:             serverTimestamp(),
    updatedAt:              serverTimestamp(),
  })
}

export const adjustPoints = async (gameId, pseudo, delta) => {
  await updateDoc(gdoc(gameId, 'teams', pseudo), {
    points: increment(delta),
    updatedAt: serverTimestamp(),
  })
}

export const resetAllTeams = async (gameId) => {
  const [teamsSnap, participantsSnap] = await Promise.all([
    getDocs(gcol(gameId, 'teams')),
    getDocs(gcol(gameId, 'participants')),
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

export const resetTeamProgress = async (gameId, pseudo, trackId) => {
  await updateDoc(gdoc(gameId, 'teams', pseudo), {
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

export const saveTeamPhase = async (gameId, pseudo, phase, questionIndex = 0) => {
  await updateDoc(gdoc(gameId, 'teams', pseudo), {
    currentPhase: phase,
    savedQuestionIndex: questionIndex,
    updatedAt: serverTimestamp(),
  })
}

export const saveTeamDayOrder = async (gameId, pseudo, day, order) => {
  const field = day === 2 ? 'day2Order' : 'day1Order'
  await updateDoc(gdoc(gameId, 'teams', pseudo), { [field]: order })
}

export const setPreLaunchDone = async (gameId, pseudo, day = 1) => {
  const updates = {
    currentPhase: 'envelope1',
    savedQuestionIndex: 0,
    updatedAt: serverTimestamp(),
  }
  if (day === 2) {
    updates.preLaunchDay2Done = true
    updates.day2StartedAt = serverTimestamp()
  } else {
    updates.preLaunchDone = true
  }
  await updateDoc(gdoc(gameId, 'teams', pseudo), updates)
}

export const updateTeamProgress = async (gameId, pseudo, checkpointId, { missionAnswer } = {}) => {
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
  await updateDoc(gdoc(gameId, 'teams', pseudo), update)
}

export const startCheckpointTimer = async (gameId, pseudo, checkpointId) => {
  await updateDoc(gdoc(gameId, 'teams', pseudo), {
    [`checkpointTimes.${checkpointId}.startedAt`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export const markTeamFinished = async (gameId, pseudo, timeBonusPoints = 0) => {
  await updateDoc(gdoc(gameId, 'teams', pseudo), {
    isFinished: true,
    finishedAt: serverTimestamp(),
    timeBonusPoints,
    points: increment(timeBonusPoints),
    currentPhase: null,
    updatedAt: serverTimestamp(),
  })
  const pRef = gdoc(gameId, 'participants', pseudo)
  const pSnap = await getDoc(pRef)
  if (pSnap.exists()) await updateDoc(pRef, { loggedIn: false, finished: true })
}

export const subscribeToTeam = (gameId, pseudo, callback) =>
  onSnapshot(gdoc(gameId, 'teams', pseudo), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
  })

export const subscribeToAllTeams = (gameId, callback) =>
  onSnapshot(
    query(gcol(gameId, 'teams'), orderBy('points', 'desc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

export const getAllTeams = async (gameId) => {
  const snap = await getDocs(gcol(gameId, 'teams'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const deleteTeam = async (gameId, id) => {
  await deleteDoc(gdoc(gameId, 'teams', id))
}

// ─── Two-day system ───────────────────────────────────────────────────────────

export const assignRoutesToParticipants = async (gameId, assignments) => {
  const BATCH_SIZE = 400
  for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    assignments.slice(i, i + BATCH_SIZE).forEach(({ participantId, trackId, day1Order, day2Order }) => {
      batch.update(gdoc(gameId, 'participants', participantId), {
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

export const assignRoutes = assignRoutesToParticipants

export const activateDay1 = async (gameId) => {
  const snap = await getDocs(gcol(gameId, 'teams'))
  const teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const BATCH_SIZE = 400
  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    teams.slice(i, i + BATCH_SIZE).forEach((team) => {
      batch.update(gdoc(gameId, 'teams', team.id), {
        day: 1,
        points: team.day1Points ?? 0,
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

export const markDay1Complete = async (gameId, pseudo, timeBonusPoints = 0) => {
  await updateDoc(gdoc(gameId, 'teams', pseudo), {
    day1Finished: true,
    day1BonusPoints: timeBonusPoints,
    day1FinishedAt: serverTimestamp(),
    points: increment(timeBonusPoints),
    currentPhase: null,
    updatedAt: serverTimestamp(),
  })
  const pRef = gdoc(gameId, 'participants', pseudo)
  const pSnap = await getDoc(pRef)
  if (pSnap.exists()) await updateDoc(pRef, { loggedIn: false, day1Finished: true })
}

export const activateDay2 = async (gameId) => {
  const snap = await getDocs(gcol(gameId, 'teams'))
  const teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const BATCH_SIZE = 400
  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    teams.slice(i, i + BATCH_SIZE).forEach((team) => {
      batch.update(gdoc(gameId, 'teams', team.id), {
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

export const getTracks = async (gameId) => {
  const snap = await getDocs(query(gcol(gameId, 'tracks'), orderBy('createdAt', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getActiveTracks = async (gameId) => {
  const snap = await getDocs(query(gcol(gameId, 'tracks'), where('isActive', '==', true)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getTrack = async (gameId, trackId) => {
  const snap = await getDoc(gdoc(gameId, 'tracks', trackId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const createTrack = async (gameId, data) => {
  const ref = await addDoc(gcol(gameId, 'tracks'), { ...data, createdAt: serverTimestamp() })
  return ref.id
}

export const updateTrack = async (gameId, trackId, data) => {
  await updateDoc(gdoc(gameId, 'tracks', trackId), { ...data, updatedAt: serverTimestamp() })
}

export const deleteTeamDoc = async (gameId, pseudo) => {
  await deleteDoc(gdoc(gameId, 'teams', pseudo))
}

export const cleanOrphanTeams = async (gameId) => {
  const [teamsSnap, participantsSnap] = await Promise.all([
    getDocs(gcol(gameId, 'teams')),
    getDocs(gcol(gameId, 'participants')),
  ])
  const participantIds = new Set(participantsSnap.docs.map(d => d.id))
  const orphans = teamsSnap.docs.filter(d => !participantIds.has(d.id))
  await Promise.all(orphans.map(d => deleteDoc(d.ref)))
  return orphans.length
}

export const deleteTrack = async (gameId, trackId) => {
  await deleteDoc(gdoc(gameId, 'tracks', trackId))
}

export const subscribeToTracks = (gameId, callback) =>
  onSnapshot(query(gcol(gameId, 'tracks'), orderBy('createdAt', 'asc')), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

// ─── Checkpoints ──────────────────────────────────────────────────────────────

export const getCheckpoints = async (gameId) => {
  const snap = await getDocs(query(gcol(gameId, 'checkpoints'), orderBy('createdAt', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getCheckpoint = async (gameId, checkpointId) => {
  const snap = await getDoc(gdoc(gameId, 'checkpoints', checkpointId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const createCheckpoint = async (gameId, data) => {
  const ref = await addDoc(gcol(gameId, 'checkpoints'), { ...data, createdAt: serverTimestamp() })
  return ref.id
}

export const updateCheckpoint = async (gameId, checkpointId, data) => {
  await updateDoc(gdoc(gameId, 'checkpoints', checkpointId), { ...data, updatedAt: serverTimestamp() })
}

export const deleteCheckpoint = async (gameId, checkpointId) => {
  await deleteDoc(gdoc(gameId, 'checkpoints', checkpointId))
}

export const subscribeToCheckpoints = (gameId, callback) =>
  onSnapshot(query(gcol(gameId, 'checkpoints'), orderBy('createdAt', 'asc')), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

// ─── Photos ───────────────────────────────────────────────────────────────────

export const savePhotoRecord = async (gameId, data) => {
  await addDoc(gcol(gameId, 'photos'), {
    teamPseudo:      data.teamPseudo,
    teamName:        data.teamName ?? data.teamPseudo,
    checkpointId:    data.checkpointId,
    checkpointTitle: data.checkpointTitle ?? '',
    url:             data.url,
    uploadedAt:      serverTimestamp(),
  })
}

export const subscribeToPhotos = (gameId, callback) =>
  onSnapshot(
    query(gcol(gameId, 'photos'), orderBy('uploadedAt', 'desc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

// ─── Audio Recordings ─────────────────────────────────────────────────────────

export const saveAudioRecord = async (gameId, data) => {
  await addDoc(gcol(gameId, 'audioRecordings'), {
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

export const subscribeToAudioRecordings = (gameId, callback) =>
  onSnapshot(
    query(gcol(gameId, 'audioRecordings'), orderBy('uploadedAt', 'desc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = async (gameId) => {
  const snap = await getDoc(doc(db, 'games', gameId, 'settings', 'global'))
  return snap.exists() ? snap.data() : {}
}

export const updateSettings = async (gameId, data) => {
  await setDoc(doc(db, 'games', gameId, 'settings', 'global'), data, { merge: true })
}

export const subscribeToSettings = (gameId, callback) =>
  onSnapshot(doc(db, 'games', gameId, 'settings', 'global'), (snap) => {
    if (snap.exists()) callback(snap.data())
  })

// ─── Admin Emails ──────────────────────────────────────────────────────────────

export const getAdminEmails = async (gameId) => {
  const snap = await getDoc(doc(db, 'games', gameId, 'config', 'adminEmails'))
  return snap.exists() ? (snap.data().emails ?? []) : []
}

export const saveAdminEmails = async (gameId, emails) => {
  await setDoc(doc(db, 'games', gameId, 'config', 'adminEmails'), { emails })
}
