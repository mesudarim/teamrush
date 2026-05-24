<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'

const { t } = useI18n()
const admin = useAdminStore()

const showForm = ref(false)
const editingId = ref(null)
const confirmDeleteId = ref(null)
const saving = ref(false)

const form = ref(emptyForm())

function emptyForm() {
  return { name: '', nameEn: '', description: '', checkpointIds: [], isActive: true }
}

const allCheckpoints = computed(() => admin.checkpoints)

const startCreate = () => {
  form.value = emptyForm()
  editingId.value = null
  showForm.value = true
}

const startEdit = (track) => {
  form.value = { ...track, checkpointIds: [...(track.checkpointIds ?? [])] }
  editingId.value = track.id
  showForm.value = true
}

const cancelForm = () => { showForm.value = false; editingId.value = null }

const saveTrack = async () => {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    await admin.saveTrack({ ...form.value }, editingId.value)
    cancelForm()
  } finally {
    saving.value = false
  }
}

const deleteTrack = async () => {
  if (!confirmDeleteId.value) return
  await admin.removeTrack(confirmDeleteId.value)
  confirmDeleteId.value = null
}

const toggleCheckpoint = (cpId) => {
  const idx = form.value.checkpointIds.indexOf(cpId)
  if (idx === -1) form.value.checkpointIds.push(cpId)
  else form.value.checkpointIds.splice(idx, 1)
}

const moveUp = (idx) => {
  if (idx === 0) return
  const arr = form.value.checkpointIds
  ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
}

const moveDown = (idx) => {
  const arr = form.value.checkpointIds
  if (idx === arr.length - 1) return
  ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
}

const cpName = (id) => admin.checkpoints.find((c) => c.id === id)?.title ?? id
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="section-title">{{ t('admin.tracks.title') }}</h2>
      <button @click="startCreate" class="btn-primary py-2 px-4 text-sm">
        + {{ t('admin.tracks.create') }}
      </button>
    </div>

    <!-- Track list -->
    <div v-if="admin.tracks.length === 0 && !showForm" class="card text-center text-slate-400 py-12">
      {{ t('admin.tracks.empty') }}
    </div>

    <div v-else class="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <div
        v-for="track in admin.tracks"
        :key="track.id"
        class="card hover:border-amber-500/30 transition-colors"
      >
        <div class="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 class="font-bold text-white text-lg">{{ track.name }}</h3>
            <p v-if="track.nameEn" class="text-slate-400 text-xs">{{ track.nameEn }}</p>
          </div>
          <span :class="track.isActive ? 'badge-green' : 'badge-red'">
            {{ track.isActive ? t('admin.tracks.active') : t('admin.tracks.inactive') }}
          </span>
        </div>
        <p v-if="track.description" class="text-slate-400 text-sm mb-3">{{ track.description }}</p>
        <div class="mb-4 space-y-1">
          <div v-if="track.checkpointIds?.length" class="space-y-1">
            <div
              v-for="(cpId, idx) in track.checkpointIds"
              :key="cpId"
              class="flex items-center gap-2 text-xs text-slate-400"
            >
              <span class="w-5 h-5 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-slate-300 shrink-0">{{ idx + 1 }}</span>
              <span class="truncate">{{ cpName(cpId) }}</span>
            </div>
          </div>
          <div v-else class="text-xs text-slate-600 italic">Aucun checkpoint assigné</div>
        </div>
        <div class="flex gap-2">
          <button @click="startEdit(track)" class="btn-secondary text-xs py-1.5 px-3 flex-1">{{ t('admin.tracks.edit') }}</button>
          <button @click="confirmDeleteId = track.id" class="btn-danger text-xs py-1.5 px-3">{{ t('admin.tracks.delete') }}</button>
        </div>
      </div>
    </div>

    <!-- Track form -->
    <Transition name="slide-down">
      <div v-if="showForm" class="card-glow space-y-5">
        <h3 class="font-bold text-lg text-amber-400">
          {{ editingId ? t('admin.tracks.edit') : t('admin.tracks.create') }}
        </h3>

        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.tracks.name') }} *</label>
            <input v-model="form.name" class="input-field" :placeholder="t('admin.tracks.name')" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.tracks.nameEn') }}</label>
            <input v-model="form.nameEn" class="input-field" :placeholder="t('admin.tracks.nameEn')" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.tracks.description') }}</label>
          <input v-model="form.description" class="input-field" />
        </div>

        <div class="flex items-center gap-3">
          <label class="text-sm font-semibold text-slate-300">{{ t('admin.tracks.active') }}</label>
          <button
            @click="form.isActive = !form.isActive"
            :class="['relative w-12 h-6 rounded-full transition-colors', form.isActive ? 'bg-amber-500' : 'bg-slate-600']"
          >
            <span :class="['absolute top-1 w-4 h-4 rounded-full bg-white transition-all', form.isActive ? 'start-7' : 'start-1']" />
          </button>
        </div>

        <!-- Checkpoint selector + reorder -->
        <div>
          <label class="block text-sm font-semibold text-slate-300 mb-2">{{ t('admin.tracks.checkpoints') }}</label>

          <!-- Assigned (ordered) -->
          <div v-if="form.checkpointIds.length" class="mb-3 space-y-1">
            <div
              v-for="(cpId, idx) in form.checkpointIds"
              :key="cpId"
              class="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              <span class="text-slate-400 w-5 text-center font-bold">{{ idx + 1 }}</span>
              <span class="flex-1 text-slate-200 truncate">{{ cpName(cpId) }}</span>
              <div class="flex gap-1">
                <button @click="moveUp(idx)" class="text-slate-400 hover:text-white px-1" :disabled="idx === 0">↑</button>
                <button @click="moveDown(idx)" class="text-slate-400 hover:text-white px-1" :disabled="idx === form.checkpointIds.length - 1">↓</button>
                <button @click="toggleCheckpoint(cpId)" class="text-red-400 hover:text-red-300 px-1">✕</button>
              </div>
            </div>
          </div>

          <!-- Available checkpoints to add -->
          <div class="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
            <button
              v-for="cp in allCheckpoints"
              :key="cp.id"
              @click="toggleCheckpoint(cp.id)"
              :class="[
                'text-start px-3 py-2 rounded-lg border text-sm transition-colors',
                form.checkpointIds.includes(cp.id)
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                  : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
              ]"
            >
              <div class="flex items-center gap-2">
                <span :class="form.checkpointIds.includes(cp.id) ? 'text-amber-400' : 'text-slate-500'">
                  {{ form.checkpointIds.includes(cp.id) ? '✓' : '+' }}
                </span>
                <span class="truncate">{{ cp.title }}</span>
              </div>
            </button>
          </div>
        </div>

        <div class="flex gap-3">
          <button @click="saveTrack" :disabled="saving || !form.name.trim()" class="btn-primary flex-1">
            {{ saving ? t('common.loading') : t('admin.checkpoints.save') }}
          </button>
          <button @click="cancelForm" class="btn-secondary">{{ t('common.cancel') }}</button>
        </div>
      </div>
    </Transition>

    <ConfirmModal
      :is-open="!!confirmDeleteId"
      :message="t('admin.tracks.confirmDelete')"
      @confirm="deleteTrack"
      @cancel="confirmDeleteId = null"
    />
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
