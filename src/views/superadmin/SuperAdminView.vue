<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminAuthStore } from '@/stores/adminAuth'
import { listGames, createGame, updateGameName, deleteGame, getGameAdminEmails, setGameAdminEmails } from '@/firebase/superadmin'

const router    = useRouter()
const adminAuth = useAdminAuthStore()

const games       = ref([])
const loading     = ref(true)
const error       = ref('')

// Create game form
const newGameId   = ref('')
const newGameName = ref('')
const creating    = ref(false)
const createError = ref('')

// Edit game name
const editingId   = ref(null)
const editingName = ref('')
const saving      = ref(false)

// Edit game admins
const adminGameId   = ref(null)
const adminEmails   = ref('')
const savingAdmins  = ref(false)
const adminMsg      = ref('')

const logout = async () => {
  await adminAuth.logout()
  router.replace({ name: 'SuperAdminLogin' })
}

const loadGames = async () => {
  loading.value = true
  error.value = ''
  try {
    games.value = await listGames()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const slugify = (v) => v.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-_]/g, '')

const submitCreate = async () => {
  createError.value = ''
  const id   = slugify(newGameId.value)
  const name = newGameName.value.trim()
  if (!id)   { createError.value = 'L\'identifiant est requis.'; return }
  if (!name) { createError.value = 'Le nom est requis.'; return }
  creating.value = true
  try {
    await createGame(id, name)
    newGameId.value = ''
    newGameName.value = ''
    await loadGames()
  } catch (e) {
    createError.value = e.message
  } finally {
    creating.value = false
  }
}

const startEdit = (game) => {
  editingId.value   = game.id
  editingName.value = game.name
}

const cancelEdit = () => { editingId.value = null; editingName.value = '' }

const saveName = async (gameId) => {
  const name = editingName.value.trim()
  if (!name) return
  saving.value = true
  try {
    await updateGameName(gameId, name)
    const g = games.value.find(g => g.id === gameId)
    if (g) g.name = name
    editingId.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

const confirmDelete = async (game) => {
  if (!confirm(`Supprimer le jeu "${game.name}" ? Les données dans les sous-collections ne seront PAS supprimées.`)) return
  try {
    await deleteGame(game.id)
    games.value = games.value.filter(g => g.id !== game.id)
  } catch (e) {
    error.value = e.message
  }
}

const openAdminEditor = async (game) => {
  adminGameId.value = game.id
  adminMsg.value = ''
  const emails = await getGameAdminEmails(game.id)
  adminEmails.value = emails.join('\n')
}

const saveAdmins = async () => {
  savingAdmins.value = true
  adminMsg.value = ''
  try {
    const emails = adminEmails.value.split('\n').map(e => e.trim()).filter(Boolean)
    await setGameAdminEmails(adminGameId.value, emails)
    adminMsg.value = '✓ Sauvegardé'
  } catch (e) {
    adminMsg.value = '✗ ' + e.message
  } finally {
    savingAdmins.value = false
  }
}

onMounted(loadGames)
</script>

<template>
  <div class="min-h-screen bg-slate-900">
    <!-- Header -->
    <header class="bg-slate-800 border-b border-slate-700 px-4 py-3 sticky top-0 z-40">
      <div class="max-w-4xl mx-auto flex items-center justify-between">
        <h1 class="text-lg font-black text-amber-400">Superadmin — Gestion des jeux</h1>
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-400">{{ adminAuth.displayName }}</span>
          <button @click="logout" class="text-xs text-slate-400 hover:text-red-400 transition-colors px-3 py-1.5">
            Déconnexion
          </button>
        </div>
      </div>
    </header>

    <div class="max-w-4xl mx-auto p-6 space-y-8">

      <!-- Error -->
      <div v-if="error" class="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
        {{ error }}
      </div>

      <!-- Create game -->
      <section class="card-glow space-y-4">
        <h2 class="text-base font-bold text-white">Créer un nouveau jeu</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">Identifiant (slug URL)</label>
            <input
              v-model="newGameId"
              type="text"
              placeholder="ex: teamrush2027"
              class="input w-full"
              @input="newGameId = slugify(newGameId)"
            />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Nom du jeu (affiché partout)</label>
            <input
              v-model="newGameName"
              type="text"
              placeholder="ex: TeamRush — Tel Aviv 2027"
              class="input w-full"
            />
          </div>
        </div>
        <p v-if="newGameId" class="text-xs text-slate-500">
          URL joueur : <span class="text-amber-400">/g/{{ newGameId }}</span> &nbsp;|&nbsp;
          Admin : <span class="text-amber-400">/g/{{ newGameId }}/admin</span>
        </p>
        <p v-if="createError" class="text-red-400 text-sm">{{ createError }}</p>
        <button @click="submitCreate" :disabled="creating" class="btn-primary px-6 py-2 disabled:opacity-50">
          {{ creating ? 'Création...' : 'Créer le jeu' }}
        </button>
      </section>

      <!-- Games list -->
      <section class="space-y-3">
        <h2 class="text-base font-bold text-white">Jeux existants</h2>
        <div v-if="loading" class="text-slate-400 text-sm">Chargement...</div>

        <div
          v-for="game in games"
          :key="game.id"
          class="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3"
        >
          <!-- Game header -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <!-- Inline name edit -->
              <div v-if="editingId === game.id" class="flex items-center gap-2">
                <input
                  v-model="editingName"
                  class="input flex-1 text-sm"
                  @keyup.enter="saveName(game.id)"
                  @keyup.escape="cancelEdit"
                />
                <button @click="saveName(game.id)" :disabled="saving" class="btn-primary text-xs px-3 py-1.5">
                  {{ saving ? '...' : 'Sauv.' }}
                </button>
                <button @click="cancelEdit" class="text-slate-400 hover:text-white text-xs px-2">Annuler</button>
              </div>
              <div v-else class="flex items-center gap-2">
                <span class="font-semibold text-white">{{ game.name }}</span>
                <button @click="startEdit(game)" class="text-slate-500 hover:text-amber-400 text-xs transition-colors">
                  ✏️ Renommer
                </button>
              </div>
              <div class="flex items-center gap-3 mt-1">
                <code class="text-xs text-slate-500">{{ game.id }}</code>
                <RouterLink
                  :to="`/g/${game.id}/admin`"
                  class="text-xs text-blue-400 hover:text-blue-300"
                >
                  → Admin
                </RouterLink>
                <a
                  :href="`/g/${game.id}`"
                  target="_blank"
                  class="text-xs text-green-400 hover:text-green-300"
                >
                  → Joueurs ↗
                </a>
              </div>
            </div>
            <button
              @click="confirmDelete(game)"
              class="text-xs text-red-500 hover:text-red-400 shrink-0 transition-colors"
            >
              Supprimer
            </button>
          </div>

          <!-- Admin email editor (expandable) -->
          <div v-if="adminGameId === game.id" class="border-t border-slate-700 pt-3 space-y-2">
            <label class="block text-xs text-slate-400">
              Admins du jeu (un email par ligne)
            </label>
            <textarea
              v-model="adminEmails"
              rows="4"
              class="input w-full text-xs font-mono"
              placeholder="admin@example.com&#10;autre@example.com"
            />
            <div class="flex items-center gap-3">
              <button @click="saveAdmins" :disabled="savingAdmins" class="btn-primary text-xs px-4 py-1.5 disabled:opacity-50">
                {{ savingAdmins ? 'Sauvegarde...' : 'Sauvegarder' }}
              </button>
              <button @click="adminGameId = null" class="text-xs text-slate-400 hover:text-white">Fermer</button>
              <span v-if="adminMsg" :class="adminMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'" class="text-xs">
                {{ adminMsg }}
              </span>
            </div>
          </div>
          <button
            v-else
            @click="openAdminEditor(game)"
            class="text-xs text-slate-400 hover:text-amber-400 transition-colors"
          >
            ⚙️ Gérer les admins du jeu
          </button>
        </div>

        <div v-if="!loading && !games.length" class="text-slate-500 text-sm text-center py-8">
          Aucun jeu — créez-en un ci-dessus.
        </div>
      </section>

      <!-- Superadmin info -->
      <section class="card-glow space-y-2 text-sm">
        <h2 class="text-base font-bold text-white">Votre accès superadmin</h2>
        <p class="text-slate-400">
          En tant que superadmin, vous pouvez accéder au panel admin de n'importe quel jeu.
        </p>
        <p class="text-slate-500 text-xs">
          Email : <span class="text-slate-300">{{ adminAuth.email }}</span>
        </p>
      </section>
    </div>
  </div>
</template>
