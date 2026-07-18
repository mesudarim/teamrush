import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import { db } from './config'

export const MIGRATION_GAME_ID = 'merotzLaTsafon2026'

async function copyCollection(fromColName, gameId, toColName, onProgress) {
  const snap = await getDocs(collection(db, fromColName))
  const docs = snap.docs
  onProgress?.(`  ${fromColName}: ${docs.length} docs`)
  if (!docs.length) return 0

  const BATCH_SIZE = 400
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    docs.slice(i, i + BATCH_SIZE).forEach(d => {
      batch.set(doc(db, 'games', gameId, toColName, d.id), d.data())
    })
    await batch.commit()
  }
  return docs.length
}

export async function migrateToMultiGame(onProgress) {
  const gameId = MIGRATION_GAME_ID
  const report = {}

  const cols = ['participants', 'teams', 'checkpoints', 'tracks', 'photos', 'audioRecordings']
  for (const col of cols) {
    onProgress?.(`Migrating ${col}...`)
    report[col] = await copyCollection(col, gameId, col, onProgress)
  }

  // settings/global
  onProgress?.('Migrating settings...')
  const settingsSnap = await getDoc(doc(db, 'settings', 'global'))
  if (settingsSnap.exists()) {
    const data = settingsSnap.data()
    await setDoc(doc(db, 'games', gameId, 'settings', 'global'), {
      ...data,
      gameName: data.eventName ?? 'TeamRush',
    })
    onProgress?.('  settings/global: 1 doc')
    report['settings/global'] = 1
  }

  // config/adminEmails
  onProgress?.('Migrating admin emails...')
  const emailsSnap = await getDoc(doc(db, 'config', 'adminEmails'))
  if (emailsSnap.exists()) {
    await setDoc(doc(db, 'games', gameId, 'config', 'adminEmails'), emailsSnap.data())
    onProgress?.('  config/adminEmails: 1 doc')
    report['config/adminEmails'] = 1
  }

  // Game metadata doc
  onProgress?.('Creating game metadata doc...')
  const settings = settingsSnap.exists() ? settingsSnap.data() : {}
  await setDoc(doc(db, 'games', gameId), {
    id: gameId,
    name: settings.eventName ?? 'Merotz La Tsafon 2026',
    slug: gameId,
    createdAt: new Date(),
  }, { merge: true })

  // Superadmins doc (seed admin always included)
  onProgress?.('Initializing superadmins...')
  const superSnap = await getDoc(doc(db, 'superadmins', 'list'))
  if (!superSnap.exists()) {
    await setDoc(doc(db, 'superadmins', 'list'), {
      emails: ['ephraimichael@gmail.com'],
    })
  }

  onProgress?.('✓ Migration complete!')
  return report
}

export async function verifyMigration() {
  const gameId = MIGRATION_GAME_ID
  const cols = ['participants', 'teams', 'checkpoints', 'tracks', 'photos', 'audioRecordings']
  const results = {}

  await Promise.all(cols.map(async col => {
    const [origSnap, newSnap] = await Promise.all([
      getDocs(collection(db, col)),
      getDocs(collection(db, 'games', gameId, col)),
    ])
    results[col] = {
      original: origSnap.docs.length,
      migrated: newSnap.docs.length,
      ok: origSnap.docs.length === newSnap.docs.length,
    }
  }))

  return results
}
