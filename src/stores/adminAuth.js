import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { signInWithGoogle, signOutAdmin, onAdminAuthChange } from '@/firebase/auth'

export const useAdminAuthStore = defineStore('adminAuth', () => {
  const user = ref(null)
  const loading = ref(true)
  const error = ref(null)

  const isAuthenticated = computed(() => !!user.value)
  const displayName = computed(() => user.value?.displayName ?? '')
  const email = computed(() => user.value?.email ?? '')
  const photoURL = computed(() => user.value?.photoURL ?? '')

  // Call once on app boot — resolves after first auth state is known
  let resolved = false
  const init = () =>
    new Promise((resolve) => {
      if (resolved) { resolve(user.value); return }
      onAdminAuthChange((u) => {
        user.value = u
        loading.value = false
        if (!resolved) { resolved = true; resolve(u) }
      })
    })

  const login = async () => {
    error.value = null
    try {
      const result = await signInWithGoogle()
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
