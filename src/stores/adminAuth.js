import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { signInWithGoogle, signOutAdmin, onAdminAuthChange } from '@/firebase/auth'
import { getAdminEmails } from '@/firebase/firestore'

const SEED_ADMIN = 'ephraimichael@gmail.com'

const isEmailAllowed = async (email) => {
  if (email.toLowerCase() === SEED_ADMIN) return true
  try {
    const emails = await getAdminEmails()
    if (emails.length > 0) {
      return emails.map(e => e.toLowerCase()).includes(email.toLowerCase())
    }
  } catch {}
  return false
}

export const useAdminAuthStore = defineStore('adminAuth', () => {
  const user = ref(null)
  const loading = ref(true)
  const error = ref(null)

  const isAuthenticated = computed(() => !!user.value)
  const displayName = computed(() => user.value?.displayName ?? '')
  const email = computed(() => user.value?.email ?? '')
  const photoURL = computed(() => user.value?.photoURL ?? '')

  let resolved = false
  const init = () =>
    new Promise((resolve) => {
      if (resolved) { resolve(user.value); return }
      onAdminAuthChange(async (u) => {
        if (u) {
          const allowed = await isEmailAllowed(u.email)
          if (allowed) {
            user.value = u
          } else {
            user.value = null
            await signOutAdmin()
          }
        } else {
          user.value = null
        }
        loading.value = false
        if (!resolved) { resolved = true; resolve(user.value) }
      })
    })

  const login = async () => {
    error.value = null
    try {
      const result = await signInWithGoogle()
      const allowed = await isEmailAllowed(result.user.email)
      if (!allowed) {
        await signOutAdmin()
        error.value = "Ce compte Google n'est pas autorisé à accéder à l'administration."
        return false
      }
      user.value = result.user
      return true
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        error.value = e.message
      }
      return false
    }
  }

  const logout = async () => {
    await signOutAdmin()
    user.value = null
  }

  return { user, loading, error, isAuthenticated, displayName, email, photoURL, init, login, logout }
})
