import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'

export const useGameContextStore = defineStore('gameContext', () => {
  const gameId     = ref('')
  const gameName   = ref('')
  const logoUrl    = ref('')   // custom logo URL from settings
  const appTitle   = ref('')   // custom display title (he)
  const appTitleEn = ref('')   // custom display title (en)

  let unsub         = null
  let unsubSettings = null

  const setGame = (id) => {
    if (!id || id === gameId.value) return
    gameId.value = id
    unsub?.()
    unsubSettings?.()

    unsub = onSnapshot(doc(db, 'games', id), (snap) => {
      if (snap.exists()) gameName.value = snap.data().name ?? id
      else gameName.value = id
    })

    unsubSettings = onSnapshot(doc(db, 'games', id, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        logoUrl.value    = d.logoUrl    ?? ''
        appTitle.value   = d.appTitle   ?? ''
        appTitleEn.value = d.appTitleEn ?? ''
      }
    })
  }

  const cleanup = () => {
    unsub?.(); unsubSettings?.()
    unsub = null; unsubSettings = null
  }

  return { gameId, gameName, logoUrl, appTitle, appTitleEn, setGame, cleanup }
})
