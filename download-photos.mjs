/**
 * Download all TeamRush photos from Firebase Storage into a ZIP.
 * Run with:  node download-photos.mjs
 * Output:    teamrush-photos-YYYY-MM-DD.zip  (in the current directory)
 *
 * Node.js has no CORS restrictions — fetch works on any public URL.
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, orderBy, query } from 'firebase/firestore'
import { createWriteStream, writeFileSync } from 'fs'
import JSZip from 'jszip'

const firebaseConfig = {
  apiKey:            'AIzaSyAwMRnfZanx-N0t8PzZ_LrI2Ka4KerAWos',
  authDomain:        'teamrush.firebaseapp.com',
  projectId:         'teamrush',
  storageBucket:     'teamrush.firebasestorage.app',
  messagingSenderId: '453542664871',
  appId:             '1:453542664871:web:ef9c5309210d660f065982',
}

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

async function main() {
  console.log('📷 Récupération des photos depuis Firestore...')
  const snap   = await getDocs(query(collection(db, 'photos'), orderBy('uploadedAt', 'desc')))
  const photos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  console.log(`   ${photos.length} photos trouvées\n`)

  const zip   = new JSZip()
  let   ok    = 0
  let   fails = 0

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    const label = `${i + 1}/${photos.length}`
    const team  = (photo.teamName || photo.teamPseudo || 'equipe').replace(/[/\\?%*:|"<>]/g, '-')
    const cp    = (photo.checkpointTitle || '').replace(/[/\\?%*:|"<>]/g, '-')

    process.stdout.write(`[${label}] ${team} — ${cp} ... `)

    try {
      const res  = await fetch(photo.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf  = Buffer.from(await res.arrayBuffer())
      const ext  = photo.url.includes('.png') ? 'png' : 'jpg'
      const name = `${String(i + 1).padStart(3, '0')}_${team}_${cp}.${ext}`
      zip.file(name, buf)
      ok++
      console.log('✅')
    } catch (err) {
      fails++
      console.log(`❌ ${err.message}`)
    }
  }

  const date     = new Date().toISOString().slice(0, 10)
  const filename = `teamrush-photos-${date}.zip`

  console.log(`\n📦 Création du ZIP (${ok} photos)...`)
  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  writeFileSync(filename, content)

  console.log(`\n✅ Terminé ! ${ok} photos téléchargées, ${fails} échecs.`)
  console.log(`📁 Fichier sauvegardé : ${filename}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
