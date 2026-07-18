/**
 * Superadmin Firestore operations.
 * Games collection: /games/{gameId}  → { id, name, slug, createdAt }
 * Superadmins:      /superadmins/list → { emails: [] }
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from './config'

// ─── Superadmin auth ──────────────────────────────────────────────────────────

export const getSuperAdminEmails = async () => {
  const snap = await getDoc(doc(db, 'superadmins', 'list'))
  return snap.exists() ? (snap.data().emails ?? []) : []
}

export const saveSuperAdminEmails = async (emails) => {
  await setDoc(doc(db, 'superadmins', 'list'), { emails })
}

// ─── Games CRUD ────────────────────────────────────────────────────────────────

export const listGames = async () => {
  const snap = await getDocs(query(collection(db, 'games'), orderBy('createdAt', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getGame = async (gameId) => {
  const snap = await getDoc(doc(db, 'games', gameId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const createGame = async (gameId, name) => {
  const slug = gameId.trim()
  if (!slug) throw new Error('gameId is required')
  const existing = await getDoc(doc(db, 'games', slug))
  if (existing.exists()) throw new Error(`Game "${slug}" already exists`)

  await setDoc(doc(db, 'games', slug), {
    id: slug,
    name: name.trim(),
    slug,
    createdAt: serverTimestamp(),
  })

  // Create empty settings doc so subscribeToSettings doesn't error
  await setDoc(doc(db, 'games', slug, 'settings', 'global'), {
    gameName: name.trim(),
    eventName: name.trim(),
    isEventLive: false,
  })

  return slug
}

export const updateGameName = async (gameId, name) => {
  await updateDoc(doc(db, 'games', gameId), { name: name.trim(), updatedAt: serverTimestamp() })
  // Keep settings/global.gameName in sync
  await setDoc(doc(db, 'games', gameId, 'settings', 'global'), { gameName: name.trim() }, { merge: true })
}

export const deleteGame = async (gameId) => {
  // Only deletes the metadata doc; subcollection data remains (Firestore doesn't cascade delete)
  await deleteDoc(doc(db, 'games', gameId))
}

// ─── Game admin management (per game) ─────────────────────────────────────────

export const getGameAdminEmails = async (gameId) => {
  const snap = await getDoc(doc(db, 'games', gameId, 'config', 'adminEmails'))
  return snap.exists() ? (snap.data().emails ?? []) : []
}

export const setGameAdminEmails = async (gameId, emails) => {
  await setDoc(doc(db, 'games', gameId, 'config', 'adminEmails'), { emails })
}
