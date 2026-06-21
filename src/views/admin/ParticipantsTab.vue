<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { createParticipant, bulkCreateParticipants, deleteParticipant, subscribeToParticipants } from '@/firebase/firestore'
import { useAdminStore } from '@/stores/admin'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'

const { t } = useI18n()
const admin = useAdminStore()

const participants = ref([])
const search = ref('')
const showAddForm = ref(false)
const showBulkForm = ref(false)
const confirmDeleteId = ref(null)
const saving = ref(false)
const bulkSaving = ref(false)
const bulkText = ref('')
const bulkResult = ref(null)

const form = ref({ name: '', email: '', phone: '' })

let unsubscribe = null

onMounted(() => {
  unsubscribe = subscribeToParticipants((data) => { participants.value = data })
})
onUnmounted(() => unsubscribe?.())

const sortCol = ref('status')  // default: active first
const sortDir = ref('desc')

// Cross-reference with team data for accurate status
const teamMap = computed(() => {
  const map = {}
  admin.teams.forEach(t => { map[t.id] = t })
  return map
})

// 'finished' | 'day1done' | 'inGame' | 'waiting'
// Source of truth: teams collection (same as Monitor), NOT participant.loggedIn
// loggedIn goes stale when users close their browser without logging out
const teamStatus = (p) => {
  const team = teamMap.value[p.id]
  if (team?.isFinished || p.finished) return 'finished'
  if (team?.day1Finished) return 'day1done'
  if (team) return 'inGame'   // team exists = participant logged in at some point and is playing
  return 'waiting'             // no team = never logged in
}

// Sort priority: inGame (3) > waiting (2) > day1done (1) > finished (0)
const statusOrder = { inGame: 3, waiting: 2, day1done: 1, finished: 0 }

function toggleSort(col) {
  if (sortCol.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = col
    sortDir.value = col === 'status' ? 'desc' : 'asc'
  }
}

function sortIcon(col) {
  if (sortCol.value !== col) return '⇅'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const base = q
    ? participants.value.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.includes(q)
      )
    : [...participants.value]

  return base.sort((a, b) => {
    let cmp = 0
    if (sortCol.value === 'name') {
      cmp = (a.name ?? '').localeCompare(b.name ?? '')
    } else if (sortCol.value === 'email') {
      cmp = (a.email ?? '').localeCompare(b.email ?? '')
    } else if (sortCol.value === 'phone') {
      cmp = (a.phone ?? '').localeCompare(b.phone ?? '')
    } else if (sortCol.value === 'status') {
      cmp = (statusOrder[teamStatus(a)] ?? 0) - (statusOrder[teamStatus(b)] ?? 0)
    }
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})

const loggedInCount = computed(() => participants.value.filter(p => teamStatus(p) === 'inGame').length)

const addOne = async () => {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    await createParticipant(form.value)
    form.value = { name: '', email: '', phone: '' }
    showAddForm.value = false
  } finally {
    saving.value = false
  }
}

const parseBulk = (text) => {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const parts = line.split(',').map(p => p.trim())
      return { name: parts[0] ?? '', email: parts[1] ?? '', phone: parts[2] ?? '' }
    })
    .filter(p => p.name)
}

const importBulk = async () => {
  const list = parseBulk(bulkText.value)
  if (!list.length) return
  bulkSaving.value = true
  try {
    await bulkCreateParticipants(list)
    bulkResult.value = t('admin.participants.importSuccess', { n: list.length })
    bulkText.value = ''
    setTimeout(() => { bulkResult.value = null; showBulkForm.value = false }, 2500)
  } finally {
    bulkSaving.value = false
  }
}

const confirmDelete = async () => {
  if (!confirmDeleteId.value) return
  await deleteParticipant(confirmDeleteId.value)
  confirmDeleteId.value = null
}

const deleteAll = async () => {
  if (!confirm(t('admin.participants.deleteAllConfirm', { n: participants.value.length }))) return
  for (const p of participants.value) await deleteParticipant(p.id)
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h2 class="section-title">{{ t('admin.participants.title') }}</h2>
        <p class="text-slate-400 text-sm mt-0.5">
          {{ t('admin.participants.stats', { n: participants.length, logged: loggedInCount }) }}
        </p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button @click="showBulkForm = !showBulkForm; showAddForm = false" class="btn-secondary py-2 px-4 text-sm">
          📋 {{ t('admin.participants.importList') }}
        </button>
        <button @click="showAddForm = !showAddForm; showBulkForm = false" class="btn-primary py-2 px-4 text-sm">
          + {{ t('admin.participants.addOne') }}
        </button>
      </div>
    </div>

    <!-- Add one form -->
    <Transition name="slide-down">
      <div v-if="showAddForm" class="card-glow mb-6 space-y-4 max-w-lg">
        <h3 class="font-bold text-amber-400">{{ t('admin.participants.addFormTitle') }}</h3>
        <div class="grid sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.participants.name') }} *</label>
            <input v-model="form.name" class="input-field" placeholder="David Cohen" @keyup.enter="addOne" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.participants.email') }}</label>
            <input v-model="form.email" class="input-field" placeholder="david@example.com" type="email" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.participants.phone') }}</label>
            <input v-model="form.phone" class="input-field" placeholder="+972501234567" type="tel" />
          </div>
        </div>
        <div class="flex gap-2">
          <button @click="addOne" :disabled="saving || !form.name.trim()" class="btn-primary text-sm py-2 px-4">
            {{ saving ? t('admin.participants.saving') : t('admin.participants.add') }}
          </button>
          <button @click="showAddForm = false" class="btn-secondary text-sm py-2 px-3">{{ t('common.cancel') }}</button>
        </div>
      </div>
    </Transition>

    <!-- Bulk import form -->
    <Transition name="slide-down">
      <div v-if="showBulkForm" class="card-glow mb-6 space-y-4 max-w-2xl">
        <div>
          <h3 class="font-bold text-amber-400 mb-1">{{ t('admin.participants.importFormTitle') }}</h3>
          <p class="text-slate-400 text-xs">
            {{ t('admin.participants.importFormats') }}<br>
            <code class="text-amber-400/80">Name</code> &nbsp;·&nbsp;
            <code class="text-amber-400/80">Name, email</code> &nbsp;·&nbsp;
            <code class="text-amber-400/80">Name, email, phone</code>
          </p>
        </div>
        <textarea
          v-model="bulkText"
          rows="10"
          class="input-field font-mono text-sm resize-y"
          placeholder="David Cohen
Sarah Levy, sarah@example.com
Mike Ben-David, mike@example.com, +972501234567"
        />
        <div class="flex items-center gap-3">
          <button @click="importBulk" :disabled="bulkSaving || !bulkText.trim()" class="btn-primary text-sm py-2 px-4">
            {{ bulkSaving ? t('admin.participants.importing') : t('admin.participants.importBtn', { n: parseBulk(bulkText).length || 0 }) }}
          </button>
          <button @click="showBulkForm = false" class="btn-secondary text-sm py-2 px-3">{{ t('common.cancel') }}</button>
          <span v-if="bulkResult" class="text-green-400 text-sm font-semibold">{{ bulkResult }}</span>
        </div>
      </div>
    </Transition>

    <!-- Search -->
    <div class="mb-4 flex gap-3 items-center">
      <input
        v-model="search"
        class="input-field max-w-xs"
        :placeholder="'🔍 ' + t('admin.participants.search')"
      />
      <button v-if="participants.length > 0" @click="deleteAll" class="btn-danger text-xs py-2 px-3 ms-auto opacity-60 hover:opacity-100">
        {{ t('admin.participants.deleteAll') }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="participants.length === 0" class="card text-center text-slate-400 py-16">
      <p class="text-4xl mb-3">👥</p>
      <p class="font-semibold">{{ t('admin.participants.empty') }}</p>
      <p class="text-sm mt-1">{{ t('admin.participants.emptySubtitle') }}</p>
    </div>

    <!-- No search results -->
    <div v-else-if="filtered.length === 0" class="card text-center text-slate-400 py-8">
      {{ t('admin.participants.noResults', { q: search }) }}
    </div>

    <!-- Participants table -->
    <div v-else class="card overflow-hidden p-0">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
            <th class="text-start px-4 py-3 font-semibold cursor-pointer hover:text-white select-none" @click="toggleSort('name')">
              {{ t('admin.participants.colName') }} <span class="opacity-60">{{ sortIcon('name') }}</span>
            </th>
            <th class="text-start px-4 py-3 font-semibold hidden sm:table-cell cursor-pointer hover:text-white select-none" @click="toggleSort('email')">
              {{ t('admin.participants.colEmail') }} <span class="opacity-60">{{ sortIcon('email') }}</span>
            </th>
            <th class="text-start px-4 py-3 font-semibold hidden md:table-cell cursor-pointer hover:text-white select-none" @click="toggleSort('phone')">
              {{ t('admin.participants.colPhone') }} <span class="opacity-60">{{ sortIcon('phone') }}</span>
            </th>
            <th class="text-center px-4 py-3 font-semibold cursor-pointer hover:text-white select-none" @click="toggleSort('status')">
              {{ t('admin.participants.colStatus') }} <span class="opacity-60">{{ sortIcon('status') }}</span>
            </th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in filtered"
            :key="p.id"
            class="border-b border-slate-800 hover:bg-slate-800/40 transition-colors"
          >
            <td class="px-4 py-3 font-semibold text-white">{{ p.name }}</td>
            <td class="px-4 py-3 text-slate-400 hidden sm:table-cell">{{ p.email || '—' }}</td>
            <td class="px-4 py-3 text-slate-400 hidden md:table-cell">{{ p.phone || '—' }}</td>
            <td class="px-4 py-3 text-center">
              <span :class="[
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold',
                teamStatus(p) === 'finished'  ? 'bg-green-500/15 text-green-400' :
                teamStatus(p) === 'day1done'  ? 'bg-orange-500/15 text-orange-400' :
                teamStatus(p) === 'inGame'    ? 'bg-blue-500/15 text-blue-400' :
                'bg-slate-700 text-slate-400'
              ]">
                {{ teamStatus(p) === 'finished' ? '✓ ' + t('admin.monitor.finished') :
                   teamStatus(p) === 'day1done' ? '◑ ' + t('admin.monitor.day1done') :
                   teamStatus(p) === 'inGame'   ? '● ' + t('admin.participants.inGame') :
                   '○ ' + t('admin.participants.waiting') }}
              </span>
            </td>
            <td class="px-4 py-3 text-end">
              <button @click="confirmDeleteId = p.id" class="text-slate-500 hover:text-red-400 transition-colors text-xs px-2 py-1">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmModal
      :is-open="!!confirmDeleteId"
      :message="t('admin.participants.deleteConfirm')"
      @confirm="confirmDelete"
      @cancel="confirmDeleteId = null"
    />
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.25s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
