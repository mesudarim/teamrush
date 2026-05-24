<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import MapPicker from '@/components/ui/MapPicker.vue'
import QrCodeDisplay from '@/components/ui/QrCodeDisplay.vue'

const { t } = useI18n()
const admin = useAdminStore()

const showForm = ref(false)
const editingId = ref(null)
const confirmDeleteId = ref(null)
const saving = ref(false)
const imageFile = ref(null)
const imagePreview = ref('')

const form = ref(emptyForm())

function emptyForm() {
  return {
    title: '', titleEn: '',
    description: '', descriptionEn: '',
    youtubeUrl: '',
    mapType: 'coordinates',
    showMap: true,
    mapImageUrl: '',
    mapLat: '', mapLng: '', mapZoom: 15,
    envelopeBrand: 'TeamRush',
    envelope1Label: 'יעד',
    envelope2Label: 'משימה',
    stage1Keyword: '',
    stage1Mode: 'text',
    missionType: 'MultipleChoice',
    missionConfig: {
      instruction: '', instructionEn: '',
      question: '', questionEn: '',
      answer: '',
      choices: [{ text: '', textEn: '', isCorrect: false }],
    },
    pointsCorrect: 100,
    pointsWrong: 50,
  }
}

const missionTypes = ['TextValidation', 'MultipleChoice']

const startCreate = () => {
  form.value = emptyForm()
  editingId.value = null
  imageFile.value = null
  imagePreview.value = ''
  showForm.value = true
}

const startEdit = (cp) => {
  form.value = {
    ...emptyForm(),
    ...cp,
    missionConfig: { ...emptyForm().missionConfig, ...(cp.missionConfig ?? {}) },
  }
  if (!form.value.missionConfig.choices?.length) {
    form.value.missionConfig.choices = [{ text: '', textEn: '', isCorrect: false }]
  }
  editingId.value = cp.id
  imageFile.value = null
  imagePreview.value = cp.mapImageUrl ?? ''
  showForm.value = true
}

const cancelForm = () => { showForm.value = false; editingId.value = null }

const onImageChange = (e) => {
  imageFile.value = e.target.files[0] ?? null
  if (imageFile.value) imagePreview.value = URL.createObjectURL(imageFile.value)
}

const saveCheckpoint = async () => {
  if (!form.value.title.trim()) return
  saving.value = true
  try {
    const payload = { ...form.value }
    if (payload.mapType === 'coordinates') {
      payload.mapLat = Number(payload.mapLat)
      payload.mapLng = Number(payload.mapLng)
      payload.mapZoom = Number(payload.mapZoom)
    }
    await admin.saveCheckpoint(payload, imageFile.value, editingId.value)
    cancelForm()
  } finally {
    saving.value = false
  }
}

const deleteCheckpoint = async () => {
  if (!confirmDeleteId.value) return
  await admin.removeCheckpoint(confirmDeleteId.value)
  confirmDeleteId.value = null
}

// Multiple choice helpers
const addChoice = () => {
  form.value.missionConfig.choices.push({ text: '', textEn: '', isCorrect: false })
}

const removeChoice = (idx) => {
  form.value.missionConfig.choices.splice(idx, 1)
}

const setCorrect = (idx) => {
  form.value.missionConfig.choices.forEach((c, i) => { c.isCorrect = i === idx })
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="section-title">{{ t('admin.checkpoints.title') }}</h2>
      <button @click="startCreate" class="btn-primary py-2 px-4 text-sm">
        + {{ t('admin.checkpoints.create') }}
      </button>
    </div>

    <!-- Checkpoint list -->
    <div v-if="admin.checkpoints.length === 0 && !showForm" class="card text-center text-slate-400 py-12">
      {{ t('admin.checkpoints.empty') }}
    </div>

    <div v-if="!showForm" class="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
      <div
        v-for="cp in admin.checkpoints"
        :key="cp.id"
        class="card hover:border-amber-500/30 transition-colors"
      >
        <div class="flex items-start justify-between gap-2 mb-2">
          <h3 class="font-bold text-white leading-tight">{{ cp.title }}</h3>
          <span class="badge-blue shrink-0">{{ t('admin.missions.' + cp.missionType) }}</span>
        </div>
        <p v-if="cp.description" class="text-slate-400 text-xs mb-3 line-clamp-2">{{ cp.description }}</p>
        <div class="flex flex-wrap gap-2 text-xs mb-4">
          <span class="badge-amber">📍 {{ cp.stage1Keyword }}</span>
          <span :class="cp.mapType === 'coordinates' ? 'badge-blue' : 'badge-green'">
            {{ cp.mapType === 'coordinates' ? '🗺️ GPS' : '🖼️ Image' }}
          </span>
          <span class="badge-green">+{{ cp.pointsCorrect }}</span>
          <span class="badge-red">-{{ cp.pointsWrong }}</span>
        </div>
        <div class="flex gap-2">
          <button @click="startEdit(cp)" class="btn-secondary text-xs py-1.5 px-3 flex-1">{{ t('admin.checkpoints.edit') }}</button>
          <button @click="confirmDeleteId = cp.id" class="btn-danger text-xs py-1.5 px-3">{{ t('common.delete') }}</button>
        </div>
      </div>
    </div>

    <!-- Checkpoint form -->
    <Transition name="slide-down">
      <div v-if="showForm" class="card-glow space-y-6 max-w-3xl">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-xl text-amber-400">
            {{ editingId ? t('admin.checkpoints.edit') : t('admin.checkpoints.create') }}
          </h3>
          <button @click="cancelForm" class="btn-ghost">✕</button>
        </div>

        <!-- Basic info -->
        <fieldset class="space-y-4">
          <legend class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Basic Info</legend>
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.titleField') }} *</label>
              <input v-model="form.title" class="input-field" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.titleEnField') }}</label>
              <input v-model="form.titleEn" class="input-field" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.description') }}</label>
              <textarea v-model="form.description" rows="2" class="input-field resize-none" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.descriptionEn') }}</label>
              <textarea v-model="form.descriptionEn" rows="2" class="input-field resize-none" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.youtubeUrl') }}</label>
            <input v-model="form.youtubeUrl" class="input-field" placeholder="https://youtube.com/..." />
          </div>
        </fieldset>

        <!-- Map settings -->
        <fieldset class="space-y-4">
          <legend class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">{{ t('admin.checkpoints.mapType') }}</legend>

          <!-- Show map toggle -->
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <div
              @click="form.showMap = !form.showMap"
              :class="['relative w-11 h-6 rounded-full transition-colors', form.showMap ? 'bg-amber-500' : 'bg-slate-600']"
            >
              <div :class="['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', form.showMap ? 'translate-x-5' : 'translate-x-0']" />
            </div>
            <span class="text-sm font-semibold text-slate-300">Afficher le bouton carte aux joueurs</span>
            <span class="text-xs text-slate-500">(désactiver en intérieur / hôtel)</span>
          </label>

          <template v-if="form.showMap">
            <div class="flex gap-3">
              <button
                v-for="type in ['coordinates', 'image']"
                :key="type"
                @click="form.mapType = type"
                :class="['px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-colors', form.mapType === type ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-600 bg-slate-700 text-slate-400']"
              >
                {{ type === 'coordinates' ? t('admin.checkpoints.mapTypeCoords') : t('admin.checkpoints.mapTypeImage') }}
              </button>
            </div>

            <div v-if="form.mapType === 'coordinates'">
              <MapPicker
                :lat="form.mapLat"
                :lng="form.mapLng"
                :zoom="form.mapZoom"
                @update:lat="form.mapLat = $event"
                @update:lng="form.mapLng = $event"
                @update:zoom="form.mapZoom = $event"
              />
            </div>

            <div v-else>
              <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.mapImage') }}</label>
              <input type="file" accept="image/*" @change="onImageChange" class="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-500/20 file:text-amber-400 hover:file:bg-amber-500/30 cursor-pointer" />
              <img v-if="imagePreview" :src="imagePreview" class="mt-2 w-full max-h-40 object-contain rounded-lg bg-slate-900" />
            </div>
          </template>
        </fieldset>

        <!-- Envelope display -->
        <fieldset class="space-y-4">
          <legend class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Envelopes — Texte affiché</legend>
          <p class="text-xs text-slate-500 -mt-2">Ce que les joueurs voient sur l'enveloppe <strong>avant</strong> de l'ouvrir. Ne pas mettre la destination ici.</p>
          <div class="grid md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">Marque (petite ligne)</label>
              <input v-model="form.envelopeBrand" class="input-field text-center font-mono tracking-widest" placeholder="TeamRush" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-amber-400 mb-1">Enveloppe 1 — grand texte</label>
              <input v-model="form.envelope1Label" class="input-field text-center font-black text-lg" placeholder="יעד" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-amber-400 mb-1">Enveloppe 2 — grand texte</label>
              <input v-model="form.envelope2Label" class="input-field text-center font-black text-lg" placeholder="משימה" />
            </div>
          </div>
          <!-- Live preview -->
          <div class="flex gap-4 justify-center">
            <div v-for="(lbl, i) in [form.envelope1Label || 'יעד', form.envelope2Label || 'משימה']" :key="i"
                 class="rounded-xl overflow-hidden shadow-lg border border-amber-500/30 flex-1 max-w-[160px]"
                 style="aspect-ratio: 1.9 / 1; position: relative;">
              <div class="absolute top-0 left-0 right-0 bg-amber-400" style="height:18%;" />
              <div class="absolute left-0 right-0 bg-black flex flex-col items-center justify-center gap-0.5"
                   style="top:18%; bottom:22%;">
                <span class="text-amber-400/70 font-bold uppercase tracking-widest text-center"
                      style="font-size:0.4rem;">{{ form.envelopeBrand || 'TeamRush' }}</span>
                <span class="text-amber-400 font-black leading-none text-center"
                      style="font-size:1.1rem;">{{ lbl }}</span>
              </div>
              <div class="absolute bottom-0 left-0 right-0 bg-amber-400 flex items-center justify-center"
                   style="height:22%;">
                <span class="text-black font-black" style="font-size:0.4rem;">◄ ◄ ◄ &nbsp; ► ► ►</span>
              </div>
            </div>
          </div>
        </fieldset>

        <!-- Stage 1 -->
        <fieldset class="space-y-3">
          <legend class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Stage 1 — {{ t('admin.checkpoints.stage1Keyword') }}</legend>

          <!-- Stage 1 Mode -->
          <div>
            <label class="block text-sm font-semibold text-slate-300 mb-2">Player validation method</label>
            <div class="flex gap-3">
              <button
                v-for="mode in ['text', 'qr']"
                :key="mode"
                @click="form.stage1Mode = mode"
                :class="['px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-colors', form.stage1Mode === mode ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-600 bg-slate-700 text-slate-400']"
              >
                {{ mode === 'text' ? '⌨️ ' + t('game.stage1.modeText') : '📷 ' + t('game.stage1.modeQr') }}
              </button>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              {{ form.stage1Mode === 'qr' ? 'Player scans a QR code. Print the code below and place it at the location.' : 'Player types the keyword manually.' }}
            </p>
          </div>

          <div class="grid md:grid-cols-2 gap-4 items-start">
            <div class="space-y-2">
              <input v-model="form.stage1Keyword" class="input-field font-mono tracking-widest text-center text-lg" placeholder="Word to find · מילה למצוא" />
            </div>
            <QrCodeDisplay :value="form.stage1Keyword" :label="form.title" />
          </div>
        </fieldset>

        <!-- Stage 2 mission -->
        <fieldset class="space-y-4">
          <legend class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Stage 2 — Mission</legend>

          <!-- Mission type selector -->
          <div>
            <label class="block text-sm font-semibold text-slate-300 mb-2">{{ t('admin.checkpoints.missionType') }}</label>
            <div class="flex gap-3">
              <button
                v-for="type in missionTypes"
                :key="type"
                @click="form.missionType = type"
                :class="['px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-colors', form.missionType === type ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-600 bg-slate-700 text-slate-400']"
              >
                {{ t('admin.missions.' + type) }}
              </button>
            </div>
          </div>

          <!-- Instructions -->
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.missionInstruction') }}</label>
              <textarea v-model="form.missionConfig.instruction" rows="3" class="input-field resize-none" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.checkpoints.missionInstructionEn') }}</label>
              <textarea v-model="form.missionConfig.instructionEn" rows="3" class="input-field resize-none" />
            </div>
          </div>

          <!-- TextValidation question + answer -->
          <template v-if="form.missionType === 'TextValidation'">
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-slate-300 mb-1">Question <span class="text-amber-400">*</span></label>
                <textarea v-model="form.missionConfig.question" rows="2" class="input-field resize-none" placeholder="Décrivez le lieu ou posez une question ouverte..." />
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-300 mb-1">Question (English)</label>
                <textarea v-model="form.missionConfig.questionEn" rows="2" class="input-field resize-none" placeholder="Describe the place or ask an open question..." />
              </div>
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">Correct Answer</label>
              <input v-model="form.missionConfig.answer" class="input-field font-mono" placeholder="exact answer (case-insensitive)" />
            </div>
          </template>

          <!-- MultipleChoice question -->
          <div v-if="form.missionType === 'MultipleChoice'" class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">Question <span class="text-amber-400">*</span></label>
              <textarea v-model="form.missionConfig.question" rows="2" class="input-field resize-none" placeholder="Quelle est la hauteur de la Tour Eiffel ?" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-300 mb-1">Question (English)</label>
              <textarea v-model="form.missionConfig.questionEn" rows="2" class="input-field resize-none" placeholder="What is the height of the Eiffel Tower?" />
            </div>
          </div>

          <!-- MultipleChoice choices -->
          <div v-if="form.missionType === 'MultipleChoice'" class="space-y-3">
            <div
              v-for="(choice, idx) in form.missionConfig.choices"
              :key="idx"
              class="flex items-start gap-3 bg-slate-900/50 rounded-xl p-3 border border-slate-700"
            >
              <div class="flex flex-col gap-1">
                <button
                  @click="setCorrect(idx)"
                  :class="['w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors', choice.isCorrect ? 'bg-green-500 border-green-500 text-white' : 'border-slate-500']"
                  title="Mark as correct"
                >
                  <svg v-if="choice.isCorrect" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                </button>
                <span class="text-xs text-slate-500 text-center">{{ String.fromCharCode(65 + idx) }}</span>
              </div>
              <div class="flex-1 grid sm:grid-cols-2 gap-2">
                <input v-model="choice.text" class="input-field text-sm py-2" placeholder="Hebrew text" />
                <input v-model="choice.textEn" class="input-field text-sm py-2" placeholder="English text" />
              </div>
              <button @click="removeChoice(idx)" class="text-red-400 hover:text-red-300 mt-1">✕</button>
            </div>
            <button @click="addChoice" class="btn-secondary text-sm py-2">+ Add Choice</button>
          </div>
        </fieldset>

        <!-- Points -->
        <fieldset>
          <legend class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Points</legend>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-green-400 mb-1">{{ t('admin.checkpoints.pointsCorrect') }}</label>
              <input v-model="form.pointsCorrect" type="number" min="0" class="input-field text-green-400 font-bold" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-red-400 mb-1">{{ t('admin.checkpoints.pointsWrong') }}</label>
              <input v-model="form.pointsWrong" type="number" min="0" class="input-field text-red-400 font-bold" />
            </div>
          </div>
        </fieldset>

        <!-- Actions -->
        <div class="flex gap-3 pt-2">
          <button @click="saveCheckpoint" :disabled="saving || !form.title.trim()" class="btn-primary flex-1">
            {{ saving ? t('common.loading') : t('admin.checkpoints.save') }}
          </button>
          <button @click="cancelForm" class="btn-secondary">{{ t('common.cancel') }}</button>
        </div>
      </div>
    </Transition>

    <ConfirmModal
      :is-open="!!confirmDeleteId"
      :message="t('admin.checkpoints.confirmDelete')"
      @confirm="deleteCheckpoint"
      @cancel="confirmDeleteId = null"
    />
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
