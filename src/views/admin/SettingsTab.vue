<script setup>
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import { cleanOrphanTeams, getAdminEmails, saveAdminEmails } from '@/firebase/firestore'

const { t } = useI18n()
const admin = useAdminStore()

const form = ref({ eventName: '', introVideoUrl: '', introVideoUrlDay2: '', timeBonusMax: 100, timeBonusPar: 90, isEventLive: false, tapiskeyword: '', tapiskeywordEn: '', tapisInstruction: '', tapisInstructionEn: '', tapisVideoUrl: '', tapiskeywordDay2: '', tapiskeywordEnDay2: '', tapisInstructionDay2: '', tapisInstructionEnDay2: '', tapisVideoUrlDay2: '', tapisManualEntry: false, preLaunchDay1Intro: '', preLaunchDay1IntroEn: '', preLaunchDay1Outro: '', preLaunchDay1OutroEn: '', preLaunchDay1Missions: [], preLaunchDay2Intro: '', preLaunchDay2IntroEn: '', preLaunchDay2Outro: '', preLaunchDay2OutroEn: '', preLaunchDay2Missions: [] })

const preLaunchDay = ref('1')

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
  adminEmails.value = await getAdminEmails()
  adminEmailsLoaded.value = true
})

watch(() => admin.settings, (s) => {
  form.value = { ...form.value, ...s }
}, { deep: true })

const save = async () => {
  saving.value = true
  try {
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
    const n = await cleanOrphanTeams()
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
    await saveAdminEmails(adminEmails.value)
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
  <div class="max-w-lg">
    <h2 class="section-title mb-6">{{ t('admin.settings.title') }}</h2>

    <div class="card-glow space-y-5">
      <div>
        <label class="block text-sm font-semibold text-slate-300 mb-1">{{ t('admin.settings.eventName') }}</label>
        <input v-model="form.eventName" class="input-field" placeholder="המרוץ לצפון 2026" />
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
              <input v-model="form.tapisInstruction" class="input-field" placeholder="מצאו את השטיח..." />
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
              <input v-model="form.tapisInstructionDay2" class="input-field" placeholder="מצאו את השטיח..." />
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
        </div>
      </div>

      <div class="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700">
        <div>
          <div class="font-semibold text-slate-200">{{ t('admin.settings.isLive') }}</div>
          <div class="text-xs text-slate-400 mt-0.5">Enables team registration</div>
        </div>
        <button
          @click="form.isEventLive = !form.isEventLive"
          :class="['relative w-14 h-7 rounded-full transition-colors', form.isEventLive ? 'bg-amber-500' : 'bg-slate-600']"
        >
          <span :class="['absolute top-1.5 w-4 h-4 rounded-full bg-white transition-all', form.isEventLive ? 'start-8' : 'start-1.5']" />
        </button>
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
