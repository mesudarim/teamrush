<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import { cleanOrphanTeams, getAdminEmails, saveAdminEmails, getCheckpoints } from '@/firebase/firestore'
import { uploadGameLogo } from '@/firebase/storage'
import QrCodeDisplay from '@/components/ui/QrCodeDisplay.vue'

const { t } = useI18n()
const route = useRoute()
const admin = useAdminStore()
const gid   = () => route.params.gameId

// ── Branding ──────────────────────────────────────────────────────────────────
const logoFile    = ref(null)   // File object if new logo selected
const logoPreview = ref('')     // local preview URL before upload

const onLogoFile = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  logoFile.value    = file
  logoPreview.value = URL.createObjectURL(file)
}

const normalizeOpenRouting = (r) => ({
  zones: r?.zones ?? [],
  paths: r?.paths ?? [],
  finalCheckpointId: r?.finalCheckpointId ?? '',
})

const form = ref({
  // ── Branding ────────────────────────────────────────
  logoUrl: '', appTitle: '', appTitleEn: '',
  // ── Structure du jeu ────────────────────────────────
  registrationMode: 'list',
  openModeRouting: normalizeOpenRouting(null),
  gameDays: 1,
  // Pre-launch Day 1
  preLaunchDay1Enabled:   false,
  preLaunchDay1ShowIntro: true,
  preLaunchDay1ShowVideo: false,
  preLaunchDay1VideoUrl:  '',
  preLaunchDay1ShowOutro: true,
  // Pre-launch Day 2
  preLaunchDay2Enabled:   false,
  preLaunchDay2ShowIntro: true,
  preLaunchDay2ShowVideo: false,
  preLaunchDay2VideoUrl:  '',
  preLaunchDay2ShowOutro: true,
  // ── Contenu ──────────────────────────────────────────
  eventName: '', introVideoUrl: '', introVideoUrlDay2: '',
  timeBonusMax: 100, timeBonusPar: 90, isEventLive: false,
  tapiskeyword: '', tapiskeywordEn: '', tapisInstruction: '', tapisInstructionEn: '', tapisVideoUrl: '',
  tapiskeywordDay2: '', tapiskeywordEnDay2: '', tapisInstructionDay2: '', tapisInstructionEnDay2: '', tapisVideoUrlDay2: '',
  tapisManualEntry: false,
  preLaunchDay1Intro: '', preLaunchDay1IntroEn: '', preLaunchDay1Outro: '', preLaunchDay1OutroEn: '', preLaunchDay1Missions: [],
  preLaunchDay2Intro: '', preLaunchDay2IntroEn: '', preLaunchDay2Outro: '', preLaunchDay2OutroEn: '', preLaunchDay2Missions: [],
})

const preLaunchDay = ref('1')
const availableDays = computed(() => Array.from({ length: form.value.gameDays }, (_, i) => String(i + 1)))

const showTapisQr = ref({ day1: false, day2: false })
const tapisQrValue = (day) => {
  const kw = day === 1 ? form.value.tapiskeyword : form.value.tapiskeywordDay2
  return (kw || '').split(',')[0].trim()
}

const copiedUrl = ref('')
const base = computed(() => `${window.location.origin}/g/${gid()}`)
const playerUrls = computed(() => [
  { label: 'Jour 1',          url: `${base.value}` },
  { label: 'Jour 2',          url: `${base.value}/day2` },
  { label: 'Résultats J1',    url: `${base.value}/resultats` },
  { label: 'Résultats J2',    url: `${base.value}/resultats/jour2` },
  { label: 'Résultats Total', url: `${base.value}/resultats/total` },
])
const copyUrl = (url) => {
  navigator.clipboard.writeText(url).then(() => {
    copiedUrl.value = url
    setTimeout(() => { copiedUrl.value = '' }, 2000)
  })
}

function emptyPreLaunchMission() {
  return {
    id: Date.now() + '_' + Math.random(),
    type: 'MultipleChoice',
    instruction: '', instructionEn: '',
    pointsCorrect: 5, pointsWrong: 1,
    question: '', questionEn: '',
    choices: [{ text: '', textEn: '', isCorrect: false }, { text: '', textEn: '', isCorrect: false }],
    answer: '', answerEn: '',
    timerEnabled: false, timerSeconds: 60,
  }
}

const plMissions = (day) => form.value[`preLaunchDay${day}Missions`]
const addPlMission = (day) => { if (!form.value[`preLaunchDay${day}Missions`]) form.value[`preLaunchDay${day}Missions`] = []; form.value[`preLaunchDay${day}Missions`].push(emptyPreLaunchMission()) }
const removeChoice = (mission, i) => mission.choices.splice(i, 1)
const addChoice = (mission) => mission.choices.push({ text: '', textEn: '', isCorrect: false })
const moveMission = (day, i, dir) => {
  const arr = form.value[`preLaunchDay${day}Missions`]
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}
const removeMission = (day, i) => form.value[`preLaunchDay${day}Missions`].splice(i, 1)
const saved = ref(false)
const saving = ref(false)
const confirmReset = ref(false)

// ── Open Mode Routing ─────────────────────────────────────────────────────────
const allCheckpoints = ref([])

const addZone = () => {
  form.value.openModeRouting.zones.push({ id: 'z_' + Date.now(), name: '', checkpointIds: [], pickCount: 1 })
}
const removeZone = (zi) => {
  const zoneId = form.value.openModeRouting.zones[zi].id
  form.value.openModeRouting.zones.splice(zi, 1)
  for (const path of form.value.openModeRouting.paths) {
    path.zoneOrder = path.zoneOrder.filter(id => id !== zoneId)
  }
}
const toggleZoneCheckpoint = (zone, cpId) => {
  const idx = zone.checkpointIds.indexOf(cpId)
  if (idx === -1) zone.checkpointIds.push(cpId)
  else zone.checkpointIds.splice(idx, 1)
}
const addPath = () => {
  form.value.openModeRouting.paths.push({ id: 'p_' + Date.now(), name: '', zoneOrder: [] })
}
const removePath = (pi) => { form.value.openModeRouting.paths.splice(pi, 1) }
const moveZoneInPath = (path, zIdx, dir) => {
  const j = zIdx + dir
  if (j < 0 || j >= path.zoneOrder.length) return
  ;[path.zoneOrder[zIdx], path.zoneOrder[j]] = [path.zoneOrder[j], path.zoneOrder[zIdx]]
}
const addZoneToPath  = (path, zoneId) => { if (!path.zoneOrder.includes(zoneId)) path.zoneOrder.push(zoneId) }
const removeZoneFromPath = (path, idx) => { path.zoneOrder.splice(idx, 1) }

const openRoutingTotal = computed(() => {
  const r = form.value.openModeRouting
  const fromZones = r.zones.reduce((s, z) => s + (z.pickCount || 0), 0)
  return fromZones + (r.finalCheckpointId ? 1 : 0)
})

// ── Admin Emails ──────────────────────────────────────────────────────────────
const adminEmails = ref([])
const adminEmailsLoaded = ref(false)
const newEmail = ref('')
const adminEmailsSaving = ref(false)
const adminEmailsSaved = ref(false)
const resetting = ref(false)
const resetDone = ref(false)
const cleaning = ref(false)
const cleanMsg = ref('')

onMounted(async () => {
  form.value = { ...form.value, ...admin.settings }
  form.value.openModeRouting = normalizeOpenRouting(admin.settings?.openModeRouting)
  adminEmails.value = await getAdminEmails(gid())
  adminEmailsLoaded.value = true
  allCheckpoints.value = await getCheckpoints(gid())
})

watch(() => admin.settings, (s) => {
  form.value = { ...form.value, ...s }
  form.value.openModeRouting = normalizeOpenRouting(s?.openModeRouting)
}, { deep: true })

const save = async () => {
  saving.value = true
  try {
    if (logoFile.value) {
      form.value.logoUrl = await uploadGameLogo(gid(), logoFile.value)
      logoFile.value = null
    }
    await admin.saveSettings({ ...form.value })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2500)
  } finally {
    saving.value = false
  }
}

const doCleanOrphans = async () => {
  cleaning.value = true
  cleanMsg.value = ''
  try {
    const n = await cleanOrphanTeams(gid())
    cleanMsg.value = n > 0
      ? t('admin.settings.cleanOrphansDone', { n })
      : t('admin.settings.cleanOrphansNone')
    setTimeout(() => { cleanMsg.value = '' }, 4000)
  } finally {
    cleaning.value = false
  }
}

const addAdminEmail = () => {
  const em = newEmail.value.trim().toLowerCase()
  if (!em || adminEmails.value.includes(em)) return
  adminEmails.value.push(em)
  newEmail.value = ''
}

const removeAdminEmail = (i) => {
  adminEmails.value.splice(i, 1)
}

const saveAdminEmailsList = async () => {
  adminEmailsSaving.value = true
  try {
    await saveAdminEmails(gid(), adminEmails.value)
    adminEmailsSaved.value = true
    setTimeout(() => { adminEmailsSaved.value = false }, 2500)
  } finally {
    adminEmailsSaving.value = false
  }
}

const doResetAll = async () => {
  resetting.value = true
  try {
    await admin.resetAll()
    confirmReset.value = false
    resetDone.value = true
    setTimeout(() => { resetDone.value = false }, 4000)
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <div class="max-w-4xl">
    <h2 class="section-title mb-6">{{ t('admin.settings.title') }}</h2>

    <!-- ══ Branding ══════════════════════════════════════════════════════════ -->
    <div class="card mb-6 space-y-5">
      <h3 class="text-sm font-black text-amber-400 uppercase tracking-wider">{{ t('admin.settings.brandingTitle') }}</h3>

      <!-- Logo -->
      <div class="flex items-start gap-5">
        <!-- Preview -->
        <div class="w-20 h-20 rounded-xl border-2 border-slate-600 bg-slate-900/60 flex items-center justify-center overflow-hidden shrink-0">
          <img v-if="logoPreview || form.logoUrl"
               :src="logoPreview || form.logoUrl"
               alt="logo"
               class="w-full h-full object-contain p-1" />
          <svg v-else class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </div>
        <div class="flex-1 space-y-2">
          <label class="block text-sm font-semibold text-slate-300">{{ t('admin.settings.brandingLogoLabel') }}</label>
          <label class="inline-flex items-center gap-2 btn-secondary text-sm py-2 px-4 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            {{ form.logoUrl ? t('admin.settings.brandingLogoChange') : t('admin.settings.brandingLogoUpload') }}
            <input type="file" accept="image/*" class="hidden" @change="onLogoFile" />
          </label>
          <p class="text-xs text-slate-500">{{ t('admin.settings.brandingLogoHint') }}</p>
        </div>
      </div>

      <!-- App title -->
      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.settings.brandingAppTitle') }}</label>
          <input v-model="form.appTitle" class="input-field" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.settings.brandingAppTitleEn') }}</label>
          <input v-model="form.appTitleEn" class="input-field" />
        </div>
      </div>
      <p class="text-xs text-slate-500">{{ t('admin.settings.brandingAppTitleHint') }}</p>
    </div>

    <!-- ══ Structure du jeu ══════════════════════════════════════════════════ -->
    <div class="card-glow space-y-6 mb-6">
      <h3 class="text-sm font-bold text-white">🗓 Structure du jeu</h3>

      <!-- Nombre de jours -->
      <div class="space-y-2">
        <label class="block text-sm font-semibold text-slate-300">Nombre de jours</label>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="n in [1, 2]"
            :key="n"
            type="button"
            @click="form.gameDays = n"
            :class="['px-5 py-2 rounded-xl border-2 text-sm font-semibold transition-colors',
              form.gameDays === n
                ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                : 'border-slate-600 bg-slate-700 text-slate-400 hover:border-slate-500']"
          >
            {{ n }} jour{{ n > 1 ? 's' : '' }}
          </button>
        </div>
      </div>

      <!-- Séparateur -->
      <div class="border-t border-slate-700" />

      <!-- Pré-lancement -->
      <div class="space-y-4">
        <label class="block text-sm font-semibold text-slate-300">Pré-lancement <span class="text-xs text-slate-500 font-normal">(avant le premier checkpoint)</span></label>

        <!-- Onglets jours -->
        <div class="flex gap-2">
          <button
            v-for="d in availableDays"
            :key="d"
            type="button"
            @click="preLaunchDay = d"
            :class="['px-4 py-1.5 rounded-xl text-sm font-semibold border-2 transition-colors',
              preLaunchDay === d
                ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                : 'border-slate-600 text-slate-400 hover:text-slate-200']"
          >
            Jour {{ d }}
          </button>
        </div>

        <!-- Config par jour -->
        <template v-for="d in availableDays" :key="d">
          <div v-show="preLaunchDay === d" class="space-y-4">

            <!-- Toggle principal -->
            <label class="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border border-slate-700 bg-slate-900/30">
              <input
                type="checkbox"
                :checked="form[`preLaunchDay${d}Enabled`]"
                @change="form[`preLaunchDay${d}Enabled`] = $event.target.checked"
                class="w-4 h-4 accent-amber-500 cursor-pointer"
              />
              <div>
                <span class="text-sm font-semibold text-slate-200">Activer le pré-lancement pour le jour {{ d }}</span>
                <p class="text-xs text-slate-500 mt-0.5">
                  Les joueurs verront cette séquence avant d'accéder au premier checkpoint.
                </p>
              </div>
            </label>

            <!-- Éléments (visibles seulement si pré-lancement activé) -->
            <div v-if="form[`preLaunchDay${d}Enabled`]" class="space-y-3 ps-2 border-s-2 border-amber-500/30">

              <!-- ① Texte d'introduction -->
              <div class="rounded-xl border border-slate-700 overflow-hidden">
                <label class="flex items-center gap-3 px-4 py-3 bg-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    :checked="form[`preLaunchDay${d}ShowIntro`]"
                    @change="form[`preLaunchDay${d}ShowIntro`] = $event.target.checked"
                    class="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                  <span class="text-sm font-semibold text-slate-200">① Texte d'introduction</span>
                </label>
                <div v-if="form[`preLaunchDay${d}ShowIntro`]" class="p-4 bg-slate-800/40 grid md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-semibold text-slate-400 mb-1">Hébreu</label>
                    <textarea
                      v-model="form[`preLaunchDay${d}Intro`]"
                      rows="3"
                      class="input-field resize-none text-sm"
                      placeholder="Texte affiché avant les missions…"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-400 mb-1">Anglais</label>
                    <textarea
                      v-model="form[`preLaunchDay${d}IntroEn`]"
                      rows="3"
                      class="input-field resize-none text-sm"
                      placeholder="Text shown before missions…"
                    />
                  </div>
                </div>
              </div>

              <!-- ② Vidéo -->
              <div class="rounded-xl border border-slate-700 overflow-hidden">
                <label class="flex items-center gap-3 px-4 py-3 bg-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    :checked="form[`preLaunchDay${d}ShowVideo`]"
                    @change="form[`preLaunchDay${d}ShowVideo`] = $event.target.checked"
                    class="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                  <span class="text-sm font-semibold text-slate-200">② Vidéo</span>
                </label>
                <div v-if="form[`preLaunchDay${d}ShowVideo`]" class="p-4 bg-slate-800/40">
                  <label class="block text-xs font-semibold text-slate-400 mb-1">URL de la vidéo</label>
                  <input
                    v-model="form[`preLaunchDay${d}VideoUrl`]"
                    class="input-field text-sm"
                    placeholder="https://youtube.com/shorts/..."
                  />
                  <p class="text-xs text-slate-500 mt-1">YouTube Shorts, standard ou embed URL</p>
                </div>
              </div>

              <!-- ③ Texte de clôture -->
              <div class="rounded-xl border border-slate-700 overflow-hidden">
                <label class="flex items-center gap-3 px-4 py-3 bg-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    :checked="form[`preLaunchDay${d}ShowOutro`]"
                    @change="form[`preLaunchDay${d}ShowOutro`] = $event.target.checked"
                    class="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                  <span class="text-sm font-semibold text-slate-200">③ Texte de clôture</span>
                </label>
                <div v-if="form[`preLaunchDay${d}ShowOutro`]" class="p-4 bg-slate-800/40 grid md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-semibold text-slate-400 mb-1">Hébreu</label>
                    <textarea
                      v-model="form[`preLaunchDay${d}Outro`]"
                      rows="3"
                      class="input-field resize-none text-sm"
                      placeholder="Texte affiché après les missions…"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-400 mb-1">Anglais</label>
                    <textarea
                      v-model="form[`preLaunchDay${d}OutroEn`]"
                      rows="3"
                      class="input-field resize-none text-sm"
                      placeholder="Text shown after missions…"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Mode d'inscription -->
    <div class="card-glow space-y-3 mb-6">
      <h3 class="text-sm font-bold text-white">Mode d'inscription des joueurs</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label
          :class="[
            'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
            form.registrationMode === 'list'
              ? 'border-amber-500 bg-amber-500/10'
              : 'border-slate-600 bg-slate-700/40 hover:border-slate-500'
          ]"
        >
          <input type="radio" v-model="form.registrationMode" value="list" class="mt-0.5 accent-amber-500" />
          <div>
            <div class="font-semibold text-white text-sm">Liste préchargée</div>
            <div class="text-xs text-slate-400 mt-0.5">
              Les participants doivent être importés à l'avance. Connexion par numéro de téléphone.
              <span class="text-amber-400 font-medium">Mode actuel du premier jeu.</span>
            </div>
          </div>
        </label>

        <label
          :class="[
            'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
            form.registrationMode === 'open'
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-600 bg-slate-700/40 hover:border-slate-500'
          ]"
        >
          <input type="radio" v-model="form.registrationMode" value="open" class="mt-0.5 accent-blue-500" />
          <div>
            <div class="font-semibold text-white text-sm">Inscription libre</div>
            <div class="text-xs text-slate-400 mt-0.5">
              Chaque joueur choisit son propre pseudo. Pas de liste à préparer.
              Le pseudo apparaît dans le classement et les résultats.
            </div>
          </div>
        </label>
      </div>
    </div>

    <!-- ══ Open Mode Routing ════════════════════════════════════════════════════ -->
    <Transition name="saved">
      <div v-if="form.registrationMode === 'open'" class="card-glow space-y-5 mb-6">
        <div>
          <h3 class="text-sm font-bold text-white">🗺 {{ t('admin.settings.openRouting.title') }}</h3>
          <p class="text-xs text-slate-400 mt-1">{{ t('admin.settings.openRouting.desc') }}</p>
        </div>

        <!-- Final checkpoint -->
        <div>
          <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.settings.openRouting.finalCheckpoint') }}</label>
          <select v-model="form.openModeRouting.finalCheckpointId" class="input-field">
            <option value="">{{ t('admin.settings.openRouting.noFinal') }}</option>
            <option v-for="cp in allCheckpoints" :key="cp.id" :value="cp.id">
              {{ cp.title || cp.id }}
            </option>
          </select>
          <p class="text-xs text-slate-500 mt-1">{{ t('admin.settings.openRouting.finalHint') }}</p>
        </div>

        <!-- Zones -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-slate-200">{{ t('admin.settings.openRouting.zones') }}</span>
            <button @click="addZone" class="btn-secondary text-xs px-3 py-1.5">+ {{ t('admin.settings.openRouting.addZone') }}</button>
          </div>

          <p v-if="!form.openModeRouting.zones.length" class="text-xs text-slate-500 italic p-3 rounded-xl border border-dashed border-slate-600 text-center">
            {{ t('admin.settings.openRouting.noZones') }}
          </p>

          <div v-for="(zone, zi) in form.openModeRouting.zones" :key="zone.id"
               class="p-4 rounded-xl border border-slate-600 bg-slate-800/60 space-y-3">
            <!-- Zone header -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-amber-400 font-bold shrink-0">{{ zi + 1 }}</span>
              <input v-model="zone.name" class="input-field input-sm flex-1 text-sm" :placeholder="t('admin.settings.openRouting.zoneName')" />
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-xs text-slate-400">{{ t('admin.settings.openRouting.pickCount') }}</span>
                <input v-model.number="zone.pickCount" type="number" min="1" :max="Math.max(1, zone.checkpointIds.length)"
                       class="input-field input-sm w-14 text-center text-sm font-bold" />
              </div>
              <button @click="removeZone(zi)" class="text-red-400 hover:text-red-300 px-1 shrink-0 text-sm">✕</button>
            </div>

            <!-- Checkpoint assignment -->
            <div>
              <label class="block text-xs text-slate-400 mb-2">
                {{ t('admin.settings.openRouting.assignCheckpoints') }}
                <span class="text-amber-400 font-semibold ms-1">{{ zone.checkpointIds.length }} {{ t('admin.settings.openRouting.selected') }}</span>
              </label>
              <div v-if="allCheckpoints.length" class="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto pr-1">
                <label
                  v-for="cp in allCheckpoints.filter(c => c.id !== form.openModeRouting.finalCheckpointId)"
                  :key="cp.id"
                  :class="['flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors select-none',
                    zone.checkpointIds.includes(cp.id)
                      ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300'
                      : 'bg-slate-700/50 border border-slate-600 text-slate-400 hover:border-slate-500']"
                >
                  <input type="checkbox"
                    :checked="zone.checkpointIds.includes(cp.id)"
                    @change="toggleZoneCheckpoint(zone, cp.id)"
                    class="w-3 h-3 accent-amber-400 shrink-0"
                  />
                  <span class="truncate">{{ cp.title || cp.id }}</span>
                </label>
              </div>
              <p v-else class="text-xs text-slate-500 italic">{{ t('common.loading') }}</p>
            </div>
          </div>
        </div>

        <!-- Paths -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-slate-200">{{ t('admin.settings.openRouting.paths') }}</span>
            <button @click="addPath" class="btn-secondary text-xs px-3 py-1.5">+ {{ t('admin.settings.openRouting.addPath') }}</button>
          </div>

          <p v-if="!form.openModeRouting.paths.length" class="text-xs text-slate-500 italic p-3 rounded-xl border border-dashed border-slate-600 text-center">
            {{ t('admin.settings.openRouting.noPaths') }}
          </p>

          <div v-for="(path, pi) in form.openModeRouting.paths" :key="path.id"
               class="p-4 rounded-xl border border-slate-600 bg-slate-800/60 space-y-3">
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500 font-bold shrink-0">#{{ pi + 1 }}</span>
              <input v-model="path.name" class="input-field input-sm flex-1 text-sm" :placeholder="t('admin.settings.openRouting.pathName')" />
              <button @click="removePath(pi)" class="text-red-400 hover:text-red-300 px-1 shrink-0 text-sm">✕</button>
            </div>

            <!-- Zone order in this path -->
            <div class="space-y-1">
              <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.openRouting.zoneOrder') }}</label>

              <div v-for="(zoneId, zIdx) in path.zoneOrder" :key="zoneId"
                   class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/60 border border-slate-600">
                <span class="text-xs text-amber-400 font-bold shrink-0 w-4">{{ zIdx + 1 }}</span>
                <span class="text-xs text-slate-200 flex-1 truncate">
                  {{ form.openModeRouting.zones.find(z => z.id === zoneId)?.name || t('admin.settings.openRouting.unnamedZone') }}
                </span>
                <button @click="moveZoneInPath(path, zIdx, -1)" :disabled="zIdx === 0"
                        class="text-slate-400 hover:text-amber-300 disabled:opacity-20 px-0.5 text-xs">▲</button>
                <button @click="moveZoneInPath(path, zIdx, 1)" :disabled="zIdx === path.zoneOrder.length - 1"
                        class="text-slate-400 hover:text-amber-300 disabled:opacity-20 px-0.5 text-xs">▼</button>
                <button @click="removeZoneFromPath(path, zIdx)" class="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
              </div>

              <!-- Add available zones to path -->
              <div v-if="form.openModeRouting.zones.some(z => !path.zoneOrder.includes(z.id))"
                   class="flex flex-wrap gap-1 pt-1">
                <button
                  v-for="zone in form.openModeRouting.zones.filter(z => !path.zoneOrder.includes(z.id))"
                  :key="zone.id"
                  @click="addZoneToPath(path, zone.id)"
                  class="text-xs px-2 py-1 rounded-lg border border-dashed border-slate-500 text-slate-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                >
                  + {{ zone.name || t('admin.settings.openRouting.unnamedZone') }}
                </button>
              </div>
              <p v-if="!path.zoneOrder.length" class="text-xs text-slate-500 italic">
                {{ t('admin.settings.openRouting.noZonesInPath') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div v-if="form.openModeRouting.zones.length && form.openModeRouting.paths.length"
             class="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-slate-300">
          <span class="text-blue-400">ℹ</span>
          {{ t('admin.settings.openRouting.summaryText', {
            paths: form.openModeRouting.paths.length,
            total: openRoutingTotal,
          }) }}
        </div>
      </div>
    </Transition>

    <div class="card-glow space-y-5">
      <div>
        <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.settings.eventName') }}</label>
        <input v-model="form.eventName" class="input-field" placeholder="המירוץ לצפון 2026" />
      </div>

      <div>
        <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.settings.introVideoDay1') }}</label>
        <input v-model="form.introVideoUrl" class="input-field" placeholder="https://youtube.com/shorts/..." />
        <p class="text-xs text-slate-500 mt-1">YouTube Shorts, standard, or embed URL</p>
      </div>

      <div>
        <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.settings.introVideoDay2') }}</label>
        <input v-model="form.introVideoUrlDay2" class="input-field" placeholder="https://youtube.com/shorts/..." />
        <p class="text-xs text-slate-500 mt-1">YouTube Shorts, standard, or embed URL</p>
      </div>

      <!-- Time bonus config -->
      <div class="p-4 bg-slate-900/50 rounded-xl border border-slate-700 space-y-3">
        <div class="font-semibold text-slate-200 text-sm">⏱ {{ t('admin.settings.timeBonusTitle') }}</div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.timeBonusMax') }}</label>
            <input v-model.number="form.timeBonusMax" type="number" min="0" class="input-field text-center font-bold" placeholder="100" />
            <p class="text-xs text-slate-500 mt-1">{{ t('admin.settings.timeBonusMaxHint') }}</p>
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.timeBonusPar') }}</label>
            <input v-model.number="form.timeBonusPar" type="number" min="1" class="input-field text-center font-bold" placeholder="90" />
            <p class="text-xs text-slate-500 mt-1">{{ t('admin.settings.timeBonusParHint') }}</p>
          </div>
        </div>
        <p class="text-xs text-amber-400/80">
          {{ t('admin.settings.timeBonusExample', {
            half: Math.round(form.timeBonusMax * 0.5),
            quarter: Math.round(form.timeBonusMax * 0.75),
            par: form.timeBonusPar,
            halfPar: Math.round(form.timeBonusPar / 2)
          }) }}
        </p>
      </div>

      <!-- Tapis (final carpet) checkpoint -->
      <div class="p-4 bg-slate-900/50 rounded-xl border border-slate-700 space-y-4">
        <div class="font-semibold text-slate-200 text-sm">🏁 {{ t('admin.settings.tapisTitle') }}</div>
        <p class="text-xs text-slate-400 leading-relaxed">{{ t('admin.settings.tapisDesc') }}</p>

        <!-- Manual entry toggle (for testing) — auto-saves immediately -->
        <label class="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            v-model="form.tapisManualEntry"
            @change="admin.saveSettings({ tapisManualEntry: form.tapisManualEntry })"
            class="w-4 h-4 accent-amber-400"
          />
          <span class="text-xs text-amber-400 font-semibold">Mode test — permettre la saisie manuelle du code</span>
        </label>

        <!-- Day 1 -->
        <div class="space-y-3 p-3 rounded-xl border border-slate-600 bg-slate-800/40">
          <div class="text-xs font-bold text-amber-400 uppercase tracking-wide">{{ t('admin.settings.tapisDay1') }}</div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.tapisKeyword') }} (עברית)</label>
              <input v-model="form.tapiskeyword" class="input-field" placeholder="שטיח,סוף" />
              <p class="text-xs text-slate-500 mt-1">{{ t('admin.settings.tapisKeywordHint') }}</p>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.tapisKeyword') }} (English)</label>
              <input v-model="form.tapiskeywordEn" class="input-field" placeholder="carpet,finish" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.tapisInstruction') }} (עברית)</label>
              <textarea v-model="form.tapisInstruction" rows="3" class="input-field resize-none text-sm" placeholder="מצאו את השטיח..." />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.tapisInstruction') }} (English)</label>
              <input v-model="form.tapisInstructionEn" class="input-field" placeholder="Find the carpet..." />
            </div>
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.tapisVideoUrl') }}</label>
            <input v-model="form.tapisVideoUrl" class="input-field" placeholder="https://youtube.com/shorts/..." />
            <p class="text-xs text-slate-500 mt-1">{{ t('admin.settings.tapisVideoUrlHint') }}</p>
          </div>
          <p v-if="!form.tapiskeyword?.trim()" class="text-xs text-amber-400/70">{{ t('admin.settings.tapisEmpty') }}</p>

          <!-- QR code Day 1 -->
          <div class="pt-2">
            <button
              @click="showTapisQr.day1 = !showTapisQr.day1"
              :disabled="!tapisQrValue(1)"
              class="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors disabled:opacity-40"
              :class="showTapisQr.day1 ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-slate-600 bg-slate-800 text-slate-300 hover:text-amber-400'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
              </svg>
              {{ showTapisQr.day1 ? 'Masquer le QR' : 'Générer le QR code' }}
            </button>
            <div v-if="showTapisQr.day1" class="mt-3 flex justify-center">
              <QrCodeDisplay :value="tapisQrValue(1)" label="Tapis-Jour1" brand="נופש רשות 2026" />
            </div>
          </div>
        </div>

        <!-- Day 2 -->
        <div class="space-y-3 p-3 rounded-xl border border-slate-600 bg-slate-800/40">
          <div class="text-xs font-bold text-blue-400 uppercase tracking-wide">{{ t('admin.settings.tapisDay2') }}</div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.tapisKeyword') }} (עברית)</label>
              <input v-model="form.tapiskeywordDay2" class="input-field" placeholder="שטיח,סוף" />
              <p class="text-xs text-slate-500 mt-1">{{ t('admin.settings.tapisKeywordHint') }}</p>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.tapisKeyword') }} (English)</label>
              <input v-model="form.tapiskeywordEnDay2" class="input-field" placeholder="carpet,finish" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.tapisInstruction') }} (עברית)</label>
              <textarea v-model="form.tapisInstructionDay2" rows="3" class="input-field resize-none text-sm" placeholder="מצאו את השטיח..." />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.tapisInstruction') }} (English)</label>
              <input v-model="form.tapisInstructionEnDay2" class="input-field" placeholder="Find the carpet..." />
            </div>
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">{{ t('admin.settings.tapisVideoUrl') }}</label>
            <input v-model="form.tapisVideoUrlDay2" class="input-field" placeholder="https://youtube.com/shorts/..." />
            <p class="text-xs text-slate-500 mt-1">{{ t('admin.settings.tapisVideoUrlHint') }}</p>
          </div>
          <p v-if="!form.tapiskeywordDay2?.trim()" class="text-xs text-amber-400/70">{{ t('admin.settings.tapisEmpty') }}</p>

          <!-- QR code Day 2 -->
          <div class="pt-2">
            <button
              @click="showTapisQr.day2 = !showTapisQr.day2"
              :disabled="!tapisQrValue(2)"
              class="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors disabled:opacity-40"
              :class="showTapisQr.day2 ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-slate-600 bg-slate-800 text-slate-300 hover:text-blue-400'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
              </svg>
              {{ showTapisQr.day2 ? 'Masquer le QR' : 'Générer le QR code' }}
            </button>
            <div v-if="showTapisQr.day2" class="mt-3 flex justify-center">
              <QrCodeDisplay :value="tapisQrValue(2)" label="Tapis-Jour2" brand="נופש רשות 2026" />
            </div>
          </div>
        </div>
      </div>

      <!-- ── Player URLs ── -->
      <div class="p-4 bg-slate-900/50 rounded-xl border border-slate-700 space-y-3">
        <div class="font-semibold text-slate-200 text-sm">🔗 Liens joueurs</div>
        <div class="space-y-2">
          <div v-for="({ label, url }) in playerUrls" :key="url"
               class="flex items-center gap-2">
            <span class="text-xs text-slate-400 w-14 shrink-0">{{ label }}</span>
            <code class="flex-1 text-xs text-amber-300 bg-slate-800 rounded-lg px-3 py-2 truncate">{{ url }}</code>
            <button @click="copyUrl(url)"
                    class="shrink-0 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold transition-colors">
              {{ copiedUrl === url ? '✓' : 'Copier' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── Pre-launch questions ── -->
      <div class="p-4 bg-slate-900/50 rounded-xl border border-slate-700 space-y-4">
        <div class="font-semibold text-slate-200 text-sm">🎯 {{ t('admin.settings.preLaunchTitle') }}</div>
        <p class="text-xs text-slate-400 leading-relaxed">{{ t('admin.settings.preLaunchDesc') }}</p>

        <!-- Day tabs -->
        <div class="flex gap-2">
          <button
            v-for="d in ['1','2']" :key="d"
            @click="preLaunchDay = d"
            :class="['px-4 py-1.5 rounded-xl text-sm font-semibold border-2 transition-colors',
              preLaunchDay === d ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-600 text-slate-400 hover:text-slate-200']"
          >
            {{ t('admin.settings.tapisDay' + d) }}
          </button>
        </div>

        <template v-for="d in ['1','2']" :key="d">
          <div v-show="preLaunchDay === d" class="space-y-4">

            <!-- Intro text -->
            <div class="grid md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.settings.preLaunchIntro') }} (עברית)</label>
                <textarea v-model="form[`preLaunchDay${d}Intro`]" rows="3" class="input-field resize-none text-sm" :placeholder="t('admin.settings.preLaunchIntroHint')" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.settings.preLaunchIntro') }} (English)</label>
                <textarea v-model="form[`preLaunchDay${d}IntroEn`]" rows="3" class="input-field resize-none text-sm" :placeholder="t('admin.settings.preLaunchIntroHint')" />
              </div>
            </div>

            <!-- Mission list -->
            <div class="space-y-3">
              <div
                v-for="(mission, mi) in plMissions(d)"
                :key="mission.id"
                class="p-4 rounded-xl border border-slate-600 bg-slate-800/60 space-y-3"
              >
                <!-- Mission header -->
                <div class="flex items-center gap-2">
                  <span class="text-slate-400 text-sm font-bold shrink-0">#{{ mi + 1 }}</span>
                  <!-- Type selector -->
                  <select v-model="mission.type" class="input-field input-sm text-sm flex-1">
                    <option value="MultipleChoice">QCM (Multiple Choice)</option>
                    <option value="TextValidation">Texte libre (Text Validation)</option>
                  </select>
                  <!-- Move up/down -->
                  <button @click="moveMission(d, mi, -1)" :disabled="mi === 0" class="text-slate-400 hover:text-amber-300 disabled:opacity-20 px-1 text-sm">▲</button>
                  <button @click="moveMission(d, mi, 1)" :disabled="mi === plMissions(d).length - 1" class="text-slate-400 hover:text-amber-300 disabled:opacity-20 px-1 text-sm">▼</button>
                  <button @click="removeMission(d, mi)" class="text-red-400 hover:text-red-300 px-1 text-sm">✕</button>
                </div>

                <!-- Instruction (shown above mission in BaseMission) -->
                <div class="grid md:grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs text-slate-500 mb-1">{{ t('admin.settings.preLaunchInstruction') }} (עברית)</label>
                    <textarea v-model="mission.instruction" rows="2" class="input-field resize-none text-sm" placeholder="הוראה לשחקנים..." />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-500 mb-1">{{ t('admin.settings.preLaunchInstruction') }} (English)</label>
                    <textarea v-model="mission.instructionEn" rows="2" class="input-field resize-none text-sm" placeholder="Instructions for players..." />
                  </div>
                </div>

                <!-- Points -->
                <div class="flex gap-3">
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-green-400 font-semibold">+pts</label>
                    <input v-model.number="mission.pointsCorrect" type="number" min="0" class="input-field input-sm w-16 text-sm text-center" />
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-red-400 font-semibold">−pts</label>
                    <input v-model.number="mission.pointsWrong" type="number" min="0" class="input-field input-sm w-16 text-sm text-center" />
                  </div>
                </div>

                <!-- ── MultipleChoice fields ── -->
                <template v-if="mission.type === 'MultipleChoice'">
                  <div class="grid md:grid-cols-2 gap-2">
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Question (עברית)</label>
                      <input v-model="mission.question" class="input-field text-sm" placeholder="שאלה..." />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Question (English)</label>
                      <input v-model="mission.questionEn" class="input-field text-sm" placeholder="Question..." />
                    </div>
                  </div>
                  <div class="space-y-2">
                    <label class="block text-xs text-slate-500">{{ t('admin.settings.preLaunchChoices') }}</label>
                    <div v-for="(choice, ci) in mission.choices" :key="ci" class="flex items-center gap-2">
                      <input
                        type="checkbox"
                        v-model="choice.isCorrect"
                        class="w-4 h-4 accent-green-400 shrink-0"
                        :title="t('admin.settings.preLaunchCorrect')"
                      />
                      <input v-model="choice.text"   class="input-field input-sm text-sm flex-1" placeholder="תשובה..." />
                      <input v-model="choice.textEn" class="input-field input-sm text-sm flex-1" placeholder="Answer..." />
                      <button @click="removeChoice(mission, ci)" :disabled="mission.choices.length <= 2" class="text-red-400 disabled:opacity-20 shrink-0">✕</button>
                    </div>
                    <button @click="addChoice(mission)" class="text-xs text-amber-400 hover:text-amber-300 font-semibold">+ {{ t('admin.settings.preLaunchAddChoice') }}</button>
                  </div>
                </template>

                <!-- ── TextValidation fields ── -->
                <template v-else-if="mission.type === 'TextValidation'">
                  <div class="grid md:grid-cols-2 gap-2">
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Question (עברית)</label>
                      <input v-model="mission.question" class="input-field text-sm" placeholder="שאלה..." />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Question (English)</label>
                      <input v-model="mission.questionEn" class="input-field text-sm" placeholder="Question..." />
                    </div>
                  </div>
                  <div class="grid md:grid-cols-2 gap-2">
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">{{ t('admin.settings.preLaunchAnswer') }} (עברית)</label>
                      <input v-model="mission.answer" class="input-field text-sm" placeholder="תשובה,תשובה2" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">{{ t('admin.settings.preLaunchAnswer') }} (English)</label>
                      <input v-model="mission.answerEn" class="input-field text-sm" placeholder="answer,answer2" />
                    </div>
                  </div>
                  <div class="flex items-center gap-4">
                    <label class="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                      <input type="checkbox" v-model="mission.timerEnabled" class="w-4 h-4 accent-amber-400" />
                      {{ t('admin.settings.preLaunchTimer') }}
                    </label>
                    <div v-if="mission.timerEnabled" class="flex items-center gap-2">
                      <input v-model.number="mission.timerSeconds" type="number" min="10" class="input-field input-sm w-20 text-sm" />
                      <span class="text-xs text-slate-500">sec</span>
                    </div>
                  </div>
                </template>
              </div>

              <button
                @click="addPlMission(d)"
                class="w-full py-2.5 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:text-amber-400 hover:border-amber-500/50 text-sm font-semibold transition-colors"
              >
                + {{ t('admin.settings.preLaunchAddMission') }}
              </button>
            </div>

            <!-- Outro text -->
            <div class="grid md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.settings.preLaunchOutro') }} (עברית)</label>
                <textarea v-model="form[`preLaunchDay${d}Outro`]" rows="3" class="input-field resize-none text-sm" :placeholder="t('admin.settings.preLaunchOutroHint')" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">{{ t('admin.settings.preLaunchOutro') }} (English)</label>
                <textarea v-model="form[`preLaunchDay${d}OutroEn`]" rows="3" class="input-field resize-none text-sm" :placeholder="t('admin.settings.preLaunchOutroHint')" />
              </div>
            </div>

          </div>
        </template>
      </div>

      <Transition name="saved">
        <div v-if="saved" class="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm font-semibold">
          ✅ {{ t('admin.settings.saved') }}
        </div>
      </Transition>

      <button @click="save" :disabled="saving" class="btn-primary w-full">
        {{ saving ? t('common.loading') : t('admin.settings.save') }}
      </button>
    </div>

    <!-- Admin Emails -->
    <div class="mt-6 card-glow space-y-4">
      <div class="font-bold text-white text-sm">🔐 {{ t('admin.settings.adminEmailsTitle') }}</div>
      <p class="text-xs text-slate-400 leading-relaxed">{{ t('admin.settings.adminEmailsDesc') }}</p>

      <div v-if="adminEmailsLoaded" class="space-y-2">
        <p v-if="!adminEmails.length" class="text-xs text-amber-400/80 italic">
          {{ t('admin.settings.adminEmailsEmpty') }}
        </p>
        <div v-for="(em, i) in adminEmails" :key="em"
             class="flex items-center gap-2 px-3 py-2 bg-slate-900/60 rounded-lg border border-slate-700">
          <span class="flex-1 text-sm text-slate-200">{{ em }}</span>
          <button @click="removeAdminEmail(i)" class="text-red-400 hover:text-red-300 text-sm px-1">✕</button>
        </div>

        <div class="flex gap-2 pt-1">
          <input
            v-model="newEmail"
            @keyup.enter="addAdminEmail"
            type="email"
            class="input-field flex-1 text-sm"
            placeholder="email@example.com"
          />
          <button @click="addAdminEmail" class="btn-secondary px-4 text-sm shrink-0">
            {{ t('admin.settings.adminEmailsAdd') }}
          </button>
        </div>

        <Transition name="saved">
          <div v-if="adminEmailsSaved"
               class="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm font-semibold">
            ✅ {{ t('admin.settings.adminEmailsSaved') }}
          </div>
        </Transition>

        <button @click="saveAdminEmailsList" :disabled="adminEmailsSaving" class="btn-primary w-full">
          {{ adminEmailsSaving ? t('common.loading') : t('admin.settings.adminEmailsSave') }}
        </button>
      </div>
      <div v-else class="text-xs text-slate-500">{{ t('common.loading') }}</div>
    </div>

    <!-- Danger Zone -->
    <div class="mt-8 border border-red-500/40 rounded-xl p-5 bg-red-500/5 space-y-4">
      <div class="flex items-center gap-2 font-bold text-red-400 text-base">
        <span>⚠️</span> {{ t('admin.settings.dangerZone') }}
      </div>

      <!-- Clean orphan teams -->
      <div class="space-y-2">
        <div class="text-sm text-slate-400 leading-relaxed">
          {{ t('admin.settings.cleanOrphansDesc') }}
        </div>
        <Transition name="saved">
          <div v-if="cleanMsg" class="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300 text-sm font-semibold">
            🧹 {{ cleanMsg }}
          </div>
        </Transition>
        <button
          @click="doCleanOrphans"
          :disabled="cleaning"
          class="w-full py-3 rounded-xl font-bold text-sm border border-slate-600 text-slate-300 bg-slate-800/60 hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          {{ cleaning ? t('common.loading') : '🧹 ' + t('admin.settings.cleanOrphans') }}
        </button>
      </div>

      <div class="border-t border-red-500/20 pt-4 text-sm text-slate-400 leading-relaxed">
        {{ t('admin.settings.resetAllDesc') }}
      </div>

      <!-- Success banner -->
      <Transition name="saved">
        <div v-if="resetDone" class="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm font-semibold">
          ✅ {{ t('admin.settings.resetAllDone') }}
        </div>
      </Transition>

      <!-- Step 1: trigger button -->
      <button
        v-if="!confirmReset"
        @click="confirmReset = true"
        class="w-full py-3 rounded-xl font-bold text-sm border border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
      >
        🗑️ {{ t('admin.settings.resetAll') }}
      </button>

      <!-- Step 2: confirmation -->
      <div v-else class="space-y-3">
        <p class="text-red-400 font-semibold text-sm text-center">
          {{ t('admin.settings.resetAllConfirmPrompt') }}
        </p>
        <div class="flex gap-2">
          <button
            @click="confirmReset = false"
            class="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            {{ t('admin.settings.resetAllCancel') }}
          </button>
          <button
            @click="doResetAll"
            :disabled="resetting"
            class="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
          >
            {{ resetting ? t('common.loading') : t('admin.settings.resetAllConfirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.saved-enter-active, .saved-leave-active { transition: all 0.3s; }
.saved-enter-from, .saved-leave-to { opacity: 0; transform: translateY(-5px); }
</style>
