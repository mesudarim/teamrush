import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'

export const useGameContextStore = defineStore('gameContext', () => {
  const gameId     = ref('')
  const gameName   = ref('')
  const logoUrl      = ref('')
  const appTitle     = ref('')
  const appTitleEn   = ref('')
  const loginTitle   = ref('')
  const loginTitleEn = ref('')
  const settingsLoaded = ref(false)

  let unsub         = null
  let unsubSettings = null

  const setGame = (id) => {
    if (!id || id === gameId.value) return
    gameId.value = id
    settingsLoaded.value = false
    unsub?.()
    unsubSettings?.()

    unsub = onSnapshot(doc(db, 'games', id), (snap) => {
      if (snap.exists()) gameName.value = snap.data().name ?? id
      else gameName.value = id
    })

    unsubSettings = onSnapshot(doc(db, 'games', id, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        logoUrl.value      = d.logoUrl      ?? ''
        appTitle.value     = d.appTitle     ?? ''
        appTitleEn.value   = d.appTitleEn   ?? ''
        loginTitle.value   = d.loginTitle   ?? ''
        loginTitleEn.value = d.loginTitleEn ?? ''
      }
      settingsLoaded.value = true
    })
  }

  const cleanup = () => {
    unsub?.(); unsubSettings?.()
    unsub = null; unsubSettings = null
  }

  return { gameId, gameName, logoUrl, appTitle, appTitleEn, loginTitle, loginTitleEn, settingsLoaded, setGame, cleanup }
})
