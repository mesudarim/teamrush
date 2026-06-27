import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyAwMRnfZanx-N0t8PzZ_LrI2Ka4KerAWos',
  authDomain: 'teamrush.firebaseapp.com',
  projectId: 'teamrush',
  storageBucket: 'teamrush.firebasestorage.app',
  messagingSenderId: '453542664871',
  appId: '1:453542664871:web:ef9c5309210d660f065982',
}

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

const AVG_EXTRA = 239  // moyenne calculée sur les 10 équipes propres

async function main() {
  const [teamsSnap, cpSnap] = await Promise.all([
    getDocs(collection(db, 'teams')),
    getDocs(collection(db, 'checkpoints')),
  ])

  const teams       = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const checkpoints = cpSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  const cpScore = {}
  checkpoints.forEach(cp => { cpScore[cp.id] = cp.pointsCorrect ?? 10 })

  // ── Équipes MIXTES : day1Points null, ont joué J2 ─────────────────────────
  const messy = teams.filter(t => t.day1Points == null && (t.isFinished || t.day === 2))
  messy.sort((a, b) => (b.points ?? 0) - (a.points ?? 0))

  console.log(`\nÉquipes mixtes (sans day1Points, J2 joué) : ${messy.length}\n`)
  console.log('=== J2 ESTIMÉ (bonus_temps + pts_corrects_j2 + 239) ===\n')

  const rows = []
  for (const team of messy) {
    const name       = team.displayName || team.pseudo || team.id
    const total      = team.points ?? 0
    const timeBonus  = team.timeBonusPoints ?? 0
    const day2Order  = team.day2Order ?? []

    const correctJ2 = day2Order.reduce((s, cpId) => s + (cpScore[cpId] ?? 10), 0)
    const j2Est     = timeBonus + correctJ2 + (team.isFinished ? AVG_EXTRA : 0)
    const j1Est     = Math.max(0, total - j2Est)

    rows.push({ name, total, timeBonus, correctJ2, j2Est, j1Est, finished: !!team.isFinished })

    console.log(`${name}${team.isFinished ? '' : ' (en cours)'}`)
    console.log(`  Total (Firestore)       = ${total}`)
    console.log(`  Bonus temps J2          = ${timeBonus}`)
    console.log(`  Pts corrects J2         = ${correctJ2}  (${day2Order.length} checkpoints)`)
    console.log(`  + Moyenne extra         = ${team.isFinished ? AVG_EXTRA : 0}`)
    console.log(`  J2 estimé               = ${j2Est}`)
    console.log(`  J1 estimé (total - J2)  = ${j1Est}`)
    console.log()
  }

  // Classement J2 toutes équipes confondues (propres + mixtes)
  const clean = teams.filter(t => t.day1Points != null && t.isFinished)
  const allJ2 = [
    ...clean.map(t => ({ name: t.displayName || t.pseudo || t.id, j2: t.points ?? 0, type: 'propre' })),
    ...rows.map(r => ({ name: r.name, j2: r.j2Est, type: r.finished ? 'mixte' : 'mixte (en cours)' })),
  ]
  allJ2.sort((a, b) => b.j2 - a.j2)

  console.log('\n=== CLASSEMENT FINAL J2 (toutes équipes) ===\n')
  allJ2.forEach((r, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${r.name.padEnd(24)} J2 = ${r.j2}  [${r.type}]`)
  })

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
