import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { signInWithGoogle, signOutAdmin, onAdminAuthChange } from '@/firebase/auth'
import { getAdminEmails } from '@/firebase/firestore'
import { getSuperAdminEmails } from '@/firebase/superadmin'

const SEED_ADMIN = 'ephraimichael@gmail.com'

const isSuperAdminEmail = async (email) => {
  if (email.toLowerCase() === SEED_ADMIN) return true
  try {
    const emails = await getSuperAdminEmails()
    return emails.map(e => e.toLowerCase()).includes(email.toLowerCase())
  } catch { return false }
}

const isGameAdminEmail = async (email, gameId) => {
  if (!gameId) return false
  try {
    const emails = await getAdminEmails(gameId)
    return emails.map(e => e.toLowerCase()).includes(email.toLowerCase())
  } catch { return false }
}

export const useAdminAuthStore = defineStore('adminAuth', () => {
  const user         = ref(null)
  const loading      = ref(true)
  const error        = ref(null)
  const isSuperAdmin = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const displayName     = computed(() => user.value?.displayName ?? '')
  const email           = computed(() => user.value?.email ?? '')
  const photoURL        = computed(() => user.value?.photoURL ?? '')

  let resolved = false

  /**
   * Init with optional gameId to check game-specific access.
   * If gameId is omitted (superadmin routes), only checks superadmin list.
   */
  const init = (gameId) =>
    new Promise((resolve) => {
      if (resolved) { resolve(user.value); return }
      onAdminAuthChange(async (u) => {
        if (u) {
          const superAdmin = await isSuperAdminEmail(u.email)
          const gameAdmin  = gameId ? await isGameAdminEmail(u.email, gameId) : false
          if (superAdmin || gameAdmin) {
            user.value = u
            isSuperAdmin.value = superAdmin
          } else {
            user.value = null
            isSuperAdmin.value = false
            await signOutAdmin()
          }
        } else {
          user.value = null
          isSuperAdmin.value = false
        }
        loading.value = false
        if (!resolved) { resolved = true; resolve(user.value) }
      })
    })

  /**
   * Check access for a specific gameId after init (e.g., when navigating between games).
   */
  const checkGameAccess = async (gameId) => {
    if (!user.value) return false
    if (isSuperAdmin.value) return true
    return isGameAdminEmail(user.value.email, gameId)
  }

  const login = async (gameId) => {
    error.value = null
    try {
      const result = await signInWithGoogle()
      const superAdmin = await isSuperAdminEmail(result.user.email)
      const gameAdmin  = gameId ? await isGameAdminEmail(result.user.email, gameId) : false
      if (!superAdmin && !gameAdmin) {
        await signOutAdmin()
        error.value = "Ce compte Google n'est pas autorisé à accéder à l'administration."
        return false
      }
      user.value = result.user
      isSuperAdmin.value = superAdmin
      return true
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') error.value = e.message
      return false
    }
  }

  const logout = async () => {
    await signOutAdmin()
    user.value = null
    isSuperAdmin.value = false
    resolved = false
  }

  return {
    user, loading, error, isSuperAdmin,
    isAuthenticated, displayName, email, photoURL,
    init, login, logout, checkGameAccess,
  }
})
