<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGameStore } from '@/stores/game'
import { useGameContextStore } from '@/stores/gameContext'
import { getSettings, saveTeamPhase } from '@/firebase/firestore'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import LanguageToggle from '@/components/ui/LanguageToggle.vue'
import MultipleChoice from '@/components/missions/MultipleChoice.vue'
import TextValidation from '@/components/missions/TextValidation.vue'
import defaultLogo from '@/assets/logoMerotz.png'

const { t, locale } = useI18n()
const router  = useRouter()
const auth    = useAuthStore()
const game    = useGameStore()
const gameCtx = useGameContextStore()

// ── State ─────────────────────────────────────────────────────────────────────
const settings   = ref({})
const loading    = ref(true)
// stage: 'intro' | 'missions' | 'outro'
const stage      = ref('intro')
const missionIdx = ref(0)
// key bumped each time we advance so mission component fully remounts
const missionKey = ref(0)

// ── Derived settings ──────────────────────────────────────────────────────────
const isDay2 = computed(() => (auth.team?.day ?? 1) === 2)
const dayKey = computed(() => isDay2.value ? '2' : '1')

const missions   = computed(() => settings.value?.[`preLaunchDay${dayKey.value}Missions`] ?? [])
const plEnabled  = computed(() => settings.value?.[`preLaunchDay${dayKey.value}Enabled`] ?? true)
const showIntro  = computed(() => plEnabled.value && (settings.value?.[`preLaunchDay${dayKey.value}ShowIntro`] ?? true))
const showVideo  = computed(() => plEnabled.value && (settings.value?.[`preLaunchDay${dayKey.value}ShowVideo`] ?? false))
const showOutro  = computed(() => plEnabled.value && (settings.value?.[`preLaunchDay${dayKey.value}ShowOutro`] ?? true))
const plVideoUrl = computed(() => settings.value?.[`preLaunchDay${dayKey.value}VideoUrl`] ?? '')

const loc = (he, en) => (locale.value === 'en' && en) ? en : (he || '')

const introText = computed(() => showIntro.value ? loc(
  settings.value?.[`preLaunchDay${dayKey.value}Intro`],
  settings.value?.[`preLaunchDay${dayKey.value}IntroEn`],
) : '')
const outroText = computed(() => showOutro.value ? loc(
  settings.value?.[`preLaunchDay${dayKey.value}Outro`],
  settings.value?.[`preLaunchDay${dayKey.value}OutroEn`],
) : '')

const currentMission = computed(() => missions.value[missionIdx.value] ?? null)

// Synthetic props for mission components
const fakeCheckpoint = computed(() => ({
  id: currentMission.value?.id ?? 'pre',
  pointsCorrect: currentMission.value?.pointsCorrect ?? 5,
  pointsWrong:   currentMission.value?.pointsWrong   ?? 1,
}))
const fakeConfig = computed(() => ({
  instruction:   currentMission.value?.instruction   ?? '',
  instructionEn: currentMission.value?.instructionEn ?? '',
}))
const fakeQuestion = computed(() => {
  const m = currentMission.value ?? {}
  return {
    question:      m.question      ?? m.instruction   ?? '',
    questionEn:    m.questionEn    ?? m.instructionEn ?? '',
    answer:        m.answer        ?? '',
    answerEn:      m.answerEn      ?? '',
    choices:       m.choices       ?? [],
    timerEnabled:  m.timerEnabled  ?? false,
    timerSeconds:  m.timerSeconds  ?? 60,
  }
})

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
  const passed = history.state?.settings
  if (passed) {
    try { settings.value = JSON.parse(passed) } catch {}
  } else {
    settings.value = await getSettings(gameCtx.gameId)
  }

  // Pre-launch entirely disabled → auto-complete and go to game
  if (!plEnabled.value) {
    await game.completePreLaunch()
    router.replace({ name: 'Game', params: { gameId: gameCtx.gameId } })
    return
  }

  // Restore position if player was already in pre-launch
  const saved = auth.team?.currentPhase
  const savedIdx = auth.team?.savedQuestionIndex ?? 0
  if (saved === 'preLaunch') {
    missionIdx.value = Math.min(savedIdx, Math.max(0, missions.value.length - 1))
    stage.value = 'missions'
  } else if (!introText.value) {
    // No intro text → skip to video or missions
    if (showVideo.value && plVideoUrl.value) {
      stage.value = 'video'
    } else {
      stage.value = missions.value.length > 0 ? 'missions' : 'outro'
      if (stage.value === 'missions') persist(0)
    }
  }

  loading.value = false
})

// ── Navigation ────────────────────────────────────────────────────────────────
const persist = (idx) => {
  if (auth.pseudo) saveTeamPhase(gameCtx.gameId, auth.pseudo, 'preLaunch', idx).catch(() => {})
}

const scrollTop = () => window.scrollTo({ top: 0 })

// Called after intro text → go to video if enabled, else missions/outro
const afterIntro = () => {
  if (showVideo.value && plVideoUrl.value) {
    stage.value = 'video'
  } else {
    startMissions()
  }
  scrollTop()
}

// Called after video → go to missions/outro
const afterVideo = () => {
  startMissions()
  scrollTop()
}

const startMissions = () => {
  if (missions.value.length === 0) {
    stage.value = 'outro'
    scrollTop()
    return
  }
  missionIdx.value = 0
  missionKey.value++
  stage.value = 'missions'
  persist(0)
  scrollTop()
}

// ── MultipleFields inline logic ───────────────────────────────────────────────
const multiValues      = ref([])
const multiSubmitted   = ref(false)
const multiCorrect     = ref(false)

watch(missionKey, () => {
  multiValues.value    = []
  multiSubmitted.value = false
  multiCorrect.value   = false
  if (currentMission.value?.type === 'MultipleFields') {
    multiValues.value = Array(currentMission.value.keywords?.length ?? 0).fill('')
  }
})

const multiPools = computed(() => {
  const clean = s => s.trim().toLowerCase()
  return (currentMission.value?.keywords ?? []).map(kw =>
    [...(kw.he ?? '').split(','), ...(kw.en ?? '').split(',')]
      .map(clean).filter(Boolean)
  )
})

const fieldSlotMatch = computed(() => {
  const clean = s => s.trim().toLowerCase()
  const used = new Set()
  return multiValues.value.map(v => {
    const c = clean(v)
    if (!c) return -1
    const idx = multiPools.value.findIndex((pool, i) => !used.has(i) && pool.includes(c))
    if (idx !== -1) used.add(idx)
    return idx
  })
})

const fieldIsGreen   = computed(() => fieldSlotMatch.value.map(s => s !== -1))
const allFieldsGreen = computed(() => fieldIsGreen.value.length > 0 && fieldIsGreen.value.every(Boolean))

const submitMulti = () => {
  if (multiValues.value.some(v => !v?.trim())) return
  multiSubmitted.value = true
  if (allFieldsGreen.value) {
    multiCorrect.value = true
    onCorrect()
  } else {
    multiCorrect.value = false
    onWrong()
    setTimeout(() => { multiSubmitted.value = false }, 1800)
  }
}

const onCorrect = (bonusPoints = 0) => {
  game.answerPreLaunchMission(true, bonusPoints, currentMission.value).catch(() => {})
  // Short delay so the player sees the green answer before the component remounts
  setTimeout(advanceMission, 700)
}

const onWrong = () => {
  game.answerPreLaunchMission(false, 0, currentMission.value).catch(() => {})
  // Mission component handles retry internally — don't advance
}

const advanceMission = () => {
  const next = missionIdx.value + 1
  if (next < missions.value.length) {
    missionIdx.value = next
    missionKey.value++
    persist(next)
  } else {
    if (outroText.value) {
      stage.value = 'outro'
    } else {
      launchGame()
    }
  }
  scrollTop()
}

const launchGame = async () => {
  await game.completePreLaunch()
  router.push({ name: 'Game', params: { gameId: gameCtx.gameId } })
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col">

    <!-- Header -->
    <div class="flex justify-between items-center px-6 py-4 border-b border-slate-800">
      <div class="flex items-center gap-2">
        <div class="w-10 h-10 rounded-full overflow-hidden shrink-0">
          <img :src="gameCtx.logoUrl || defaultLogo" alt="logo" class="w-full h-full object-cover" />
        </div>
        <span class="font-bold text-amber-400 text-base hidden sm:block">{{ (locale === 'en' ? gameCtx.appTitleEn : gameCtx.appTitle) || gameCtx.gameName || t('app.name') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-slate-400">{{ auth.team?.displayName || auth.pseudo }}</span>
        <LanguageToggle />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else>

      <!-- Progress dots -->
      <div v-if="missions.length > 1 && stage === 'missions'"
           class="flex justify-center gap-2 pt-4">
        <div
          v-for="(_, i) in missions"
          :key="i"
          :class="['w-2 h-2 rounded-full transition-colors',
            i < missionIdx ? 'bg-green-500' :
            i === missionIdx ? 'bg-amber-400' : 'bg-slate-600']"
        />
      </div>

      <!-- ── INTRO STAGE ── -->
      <Transition name="slide-up" mode="out-in">
        <div v-if="stage === 'intro'" key="intro"
             class="flex-1 flex flex-col items-center justify-center p-6">
          <div class="w-full max-w-sm space-y-6 animate-fade-in">

            <div class="text-center space-y-3">
              <div class="text-5xl">🎯</div>
              <h1 class="text-2xl font-bold text-white">{{ t('preLaunch.title') }}</h1>
            </div>

            <div v-if="introText"
                 class="card text-slate-200 text-base leading-relaxed text-center whitespace-pre-line">
              {{ introText }}
            </div>

            <button @click="afterIntro" class="btn-primary w-full py-4 text-lg font-bold">
              {{ t('preLaunch.startBtn') }}
            </button>
          </div>
        </div>
      </Transition>

      <!-- ── VIDEO STAGE ── -->
      <Transition name="slide-up" mode="out-in">
        <div v-if="stage === 'video'" key="video"
             class="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
          <div class="w-full max-w-lg">
            <div class="aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl">
              <iframe
                :src="plVideoUrl.replace('watch?v=', 'embed/').replace('shorts/', 'embed/')"
                class="w-full h-full"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              />
            </div>
          </div>
          <button @click="afterVideo" class="btn-primary px-10 py-4 text-lg font-bold">
            {{ locale === 'en' ? 'Continue' : 'המשך' }}
          </button>
        </div>
      </Transition>

      <!-- ── MISSIONS STAGE ── -->
      <Transition name="slide-up" mode="out-in">
        <div v-if="stage === 'missions' && currentMission" key="missions"
             class="flex-1 flex flex-col">

          <!-- Mission counter -->
          <div class="text-center py-3">
            <span class="badge-amber text-sm px-4 py-1.5">
              {{ t('preLaunch.missionLabel', { current: missionIdx + 1, total: missions.length }) }}
            </span>
          </div>

          <!-- Mission component -->
          <div class="flex-1 overflow-y-auto">

            <!-- MultipleFields — inline rendering -->
            <div v-if="currentMission.type === 'MultipleFields'"
                 class="p-6 max-w-sm mx-auto w-full space-y-4 animate-slide-up">

              <!-- Instruction -->
              <div v-if="currentMission.instruction || currentMission.instructionEn"
                   class="text-slate-200 text-base font-semibold text-center leading-snug whitespace-pre-line">
                {{ locale === 'en' ? (currentMission.instructionEn || currentMission.instruction) : (currentMission.instruction || currentMission.instructionEn) }}
              </div>

              <p class="text-xs text-slate-400 text-center">{{ t('game.stage1.multiFieldHint') }}</p>

              <!-- Input fields -->
              <div v-for="(_, i) in (currentMission.keywords ?? [])" :key="i" class="flex items-center gap-2">
                <span class="text-slate-500 text-xs font-mono w-5 text-center shrink-0">{{ i + 1 }}</span>
                <input
                  v-model="multiValues[i]"
                  type="text"
                  class="input-field text-center font-bold tracking-widest flex-1 transition-all"
                  :class="fieldIsGreen[i] ? 'border-green-500 ring-2 ring-green-500/30'
                        : (multiSubmitted && !multiCorrect ? 'border-red-500 ring-2 ring-red-500/30' : '')"
                  :placeholder="t('game.stage1.placeholder')"
                  @keyup.enter="submitMulti"
                  :disabled="multiCorrect"
                  autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                />
                <span v-if="fieldIsGreen[i]" class="text-green-400 text-lg shrink-0">✓</span>
                <span v-else class="w-5 shrink-0" />
              </div>

              <!-- Feedback -->
              <div v-if="multiSubmitted && !multiCorrect"
                   class="flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold bg-red-500/15 border border-red-500/30 text-red-400">
                ❌ {{ t('game.stage1.multiFieldWrong') }}
              </div>

              <button
                @click="submitMulti"
                :disabled="multiValues.some(v => !v?.trim()) || multiCorrect"
                class="btn-primary w-full"
              >
                {{ t('game.stage1.submit') }}
              </button>
            </div>

            <!-- Standard mission component (MultipleChoice / TextValidation) -->
            <component
              v-else
              :is="currentMission.type === 'MultipleChoice' ? MultipleChoice : TextValidation"
              :key="missionKey"
              :checkpoint="fakeCheckpoint"
              :question="fakeQuestion"
              :config="fakeConfig"
              @correct="onCorrect"
              @wrong="onWrong"
            />
          </div>

          <!-- Skip question -->
          <div class="text-center py-3">
            <button @click="advanceMission"
                    class="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors">
              {{ locale === 'en' ? 'Skip this question' : 'דלג על שאלה זו' }}
            </button>
          </div>
        </div>
      </Transition>

      <!-- ── OUTRO STAGE ── -->
      <Transition name="slide-up" mode="out-in">
        <div v-if="stage === 'outro'" key="outro"
             class="flex-1 flex flex-col items-center justify-center p-6">
          <div class="w-full max-w-sm space-y-6 animate-fade-in">

            <div class="text-center space-y-3">
              <div class="text-5xl">🚀</div>
              <h1 class="text-2xl font-bold text-white">{{ t('preLaunch.outroTitle') }}</h1>
            </div>

            <div v-if="outroText"
                 class="card text-slate-200 text-base leading-relaxed text-center whitespace-pre-line">
              {{ outroText }}
            </div>

            <button @click="launchGame" class="btn-primary w-full py-4 text-lg font-bold">
              {{ t('preLaunch.launchBtn') }} 🏁
            </button>
          </div>
        </div>
      </Transition>

    </template>
  </div>
</template>

<style scoped>
.slide-up-enter-active { transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.slide-up-enter-from   { opacity: 0; transform: translateY(24px); }
.slide-up-leave-active { transition: all 0.2s ease; }
.slide-up-leave-to     { opacity: 0; transform: translateY(-12px); }
</style>
