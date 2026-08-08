<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { getCheckpoints } from '@/firebase/firestore'
import { useGameContextStore } from '@/stores/gameContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import defaultLogo from '@/assets/logoMerotz.png'

const { t, locale } = useI18n()
const route   = useRoute()
const gameCtx = useGameContextStore()

const checkpoints = ref([])
const loading     = ref(true)
const idx         = ref(0)

const gameId = computed(() => route.params.gameId ?? gameCtx.gameId)

onMounted(async () => {
  checkpoints.value = await getCheckpoints(gameId.value)
  loading.value = false
})

const cp   = computed(() => checkpoints.value[idx.value] ?? null)
const prev = () => { if (idx.value > 0) idx.value-- }
const next = () => { if (idx.value < checkpoints.value.length - 1) idx.value++ }

const loc = (he, en) => (locale.value === 'en' && en) ? en : (he || en || '')

const stage1ModeLabel = (mode) => ({
  text:        locale.value === 'en' ? 'Text'          : 'טקסט',
  qr:          locale.value === 'en' ? 'QR Code'       : 'QR קוד',
  missingWord: locale.value === 'en' ? 'Missing Word'  : 'מילה חסרה',
  multiField:  locale.value === 'en' ? 'Multiple Fields': 'מספר שדות',
}[mode] ?? mode)

const missionTypeLabel = (type) => t('admin.missions.' + type, type)
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col">

    <!-- Header -->
    <div class="flex items-center gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
      <div class="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-slate-800">
        <img :src="gameCtx.logoUrl || defaultLogo" class="w-full h-full object-contain p-0.5" alt="logo" />
      </div>
      <span class="font-bold text-amber-400 text-base hidden sm:block">
        {{ (locale === 'en' ? gameCtx.appTitleEn : gameCtx.appTitle) || gameCtx.gameName }}
      </span>
      <span class="ms-auto text-xs text-slate-500 font-semibold uppercase tracking-wider">
        {{ locale === 'en' ? 'Checkpoint Review' : 'סקירת נקודות' }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else-if="!checkpoints.length" class="flex-1 flex items-center justify-center text-slate-400">
      {{ locale === 'en' ? 'No checkpoints found.' : 'לא נמצאו נקודות.' }}
    </div>

    <template v-else>

      <!-- Progress bar -->
      <div class="flex gap-0.5 px-0">
        <div
          v-for="(_, i) in checkpoints"
          :key="i"
          :class="['h-1 flex-1 transition-colors', i === idx ? 'bg-amber-400' : i < idx ? 'bg-amber-700/60' : 'bg-slate-700']"
        />
      </div>

      <!-- Nav + counter -->
      <div class="flex items-center justify-between px-5 py-3">
        <button @click="prev" :disabled="idx === 0"
                class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 text-sm font-semibold transition-colors">
          ← {{ locale === 'en' ? 'Prev' : 'הקודם' }}
        </button>
        <span class="text-sm font-bold text-slate-300">
          {{ idx + 1 }} / {{ checkpoints.length }}
        </span>
        <button @click="next" :disabled="idx === checkpoints.length - 1"
                class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 text-sm font-semibold transition-colors">
          {{ locale === 'en' ? 'Next' : 'הבא' }} →
        </button>
      </div>

      <!-- Checkpoint card -->
      <div v-if="cp" class="flex-1 px-4 pb-8 max-w-lg mx-auto w-full space-y-4">

        <!-- Title -->
        <div class="card space-y-1">
          <div class="flex items-center gap-3">
            <span class="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-sm flex items-center justify-center shrink-0">
              {{ idx + 1 }}
            </span>
            <h2 class="text-xl font-black text-white">{{ cp.title || cp.id }}</h2>
          </div>
          <p v-if="cp.description || cp.descriptionEn" class="text-slate-400 text-sm leading-relaxed">
            {{ loc(cp.description, cp.descriptionEn) }}
          </p>
        </div>

        <!-- Stage 1 — Verification -->
        <div class="card space-y-3">
          <div class="flex items-center gap-2">
            <span class="badge-blue text-xs">📍 {{ locale === 'en' ? 'Verification' : 'וידוא' }}</span>
            <span class="text-xs text-slate-400 font-semibold">{{ stage1ModeLabel(cp.stage1Mode ?? 'text') }}</span>
          </div>

          <p v-if="cp.stage1Instruction || cp.stage1InstructionEn" class="text-slate-200 text-sm leading-relaxed whitespace-pre-line">
            {{ loc(cp.stage1Instruction, cp.stage1InstructionEn) }}
          </p>

          <!-- Text / Missing Word -->
          <div v-if="['text', 'missingWord', undefined].includes(cp.stage1Mode) && (cp.stage1Keyword || cp.stage1KeywordEn)"
               class="grid grid-cols-2 gap-2">
            <div class="rounded-xl bg-slate-800 px-3 py-2">
              <p class="text-xs text-slate-500 mb-1">עברית</p>
              <p class="text-amber-300 font-bold text-sm font-mono">{{ cp.stage1Keyword }}</p>
            </div>
            <div class="rounded-xl bg-slate-800 px-3 py-2">
              <p class="text-xs text-slate-500 mb-1">English</p>
              <p class="text-amber-300 font-bold text-sm font-mono">{{ cp.stage1KeywordEn }}</p>
            </div>
          </div>

          <!-- Multi-field keywords -->
          <div v-else-if="cp.stage1Mode === 'multiField' && cp.stage1Keywords?.length" class="space-y-1">
            <div v-for="(kw, i) in cp.stage1Keywords" :key="i" class="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2">
              <span class="text-slate-500 text-xs font-mono w-4 shrink-0">{{ i + 1 }}</span>
              <span class="text-amber-300 font-bold text-sm font-mono flex-1">{{ kw.he }}</span>
              <span class="text-slate-400 text-sm font-mono flex-1 text-end">{{ kw.en }}</span>
            </div>
            <p v-if="cp.stage1MultiOrdered" class="text-xs text-amber-400/70 font-semibold">
              ↕ {{ locale === 'en' ? 'Order required' : 'סדר נדרש' }}
            </p>
          </div>

          <!-- QR -->
          <p v-else-if="cp.stage1Mode === 'qr'" class="text-xs text-slate-400 italic">
            {{ locale === 'en' ? 'QR code scan' : 'סריקת קוד QR' }}
          </p>
        </div>

        <!-- Mission -->
        <div class="card space-y-3">
          <div class="flex items-center gap-2">
            <span class="badge-amber text-xs">🎯 {{ locale === 'en' ? 'Mission' : 'משימה' }}</span>
            <span class="text-xs text-slate-400 font-semibold">{{ missionTypeLabel(cp.missionType) }}</span>
          </div>

          <p v-if="cp.missionConfig?.instruction || cp.missionConfig?.instructionEn"
             class="text-slate-200 text-sm leading-relaxed whitespace-pre-line">
            {{ loc(cp.missionConfig.instruction, cp.missionConfig.instructionEn) }}
          </p>

          <!-- Questions loop -->
          <div v-if="cp.missionConfig?.questions?.length" class="space-y-3">
            <div
              v-for="(q, qi) in cp.missionConfig.questions"
              :key="qi"
              class="rounded-xl bg-slate-800/60 border border-slate-700 p-3 space-y-2"
            >
              <p v-if="q.question || q.questionEn" class="text-slate-200 text-sm font-semibold">
                {{ loc(q.question, q.questionEn) }}
              </p>

              <!-- Text answer -->
              <div v-if="cp.missionType === 'TextValidation' && (q.answer || q.answerEn)" class="grid grid-cols-2 gap-2">
                <div class="rounded-lg bg-green-500/10 border border-green-500/20 px-2 py-1.5">
                  <p class="text-xs text-slate-500 mb-0.5">עברית</p>
                  <p class="text-green-300 font-mono text-xs">{{ q.answer }}</p>
                </div>
                <div class="rounded-lg bg-green-500/10 border border-green-500/20 px-2 py-1.5">
                  <p class="text-xs text-slate-500 mb-0.5">English</p>
                  <p class="text-green-300 font-mono text-xs">{{ q.answerEn }}</p>
                </div>
              </div>

              <!-- Multiple choice -->
              <div v-if="['MultipleChoice', 'MultiSelect'].includes(cp.missionType) && q.choices?.length" class="space-y-1">
                <div
                  v-for="(c, ci) in q.choices"
                  :key="ci"
                  :class="['flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs',
                    c.isCorrect ? 'bg-green-500/15 border border-green-500/30 text-green-300'
                                : 'bg-slate-700/50 border border-slate-600 text-slate-400']"
                >
                  <span>{{ c.isCorrect ? '✓' : '○' }}</span>
                  <span class="flex-1">{{ loc(c.text, c.textEn) }}</span>
                </div>
              </div>

              <!-- MultipleFields keywords -->
              <div v-if="cp.missionType === 'MultipleFields' && cp.missionConfig?.keywords?.length" class="space-y-1">
                <div v-for="(kw, ki) in cp.missionConfig.keywords" :key="ki"
                     class="flex items-center gap-2 rounded-lg bg-slate-700/50 border border-slate-600 px-2 py-1.5">
                  <span class="text-slate-500 text-xs font-mono w-4 shrink-0">{{ ki + 1 }}</span>
                  <span class="text-amber-300 text-xs font-mono flex-1">{{ kw.he }}</span>
                  <span class="text-slate-400 text-xs font-mono flex-1 text-end">{{ kw.en }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Points -->
          <div class="flex gap-4 text-xs">
            <span class="text-green-400 font-semibold">+{{ cp.pointsCorrect ?? 100 }} pts correct</span>
            <span class="text-red-400 font-semibold">−{{ cp.pointsWrong ?? 50 }} pts wrong</span>
          </div>
        </div>

      </div>

      <!-- Bottom nav (duplicate for easy access) -->
      <div class="flex items-center justify-between px-5 py-4 border-t border-slate-800 sticky bottom-0 bg-slate-900/90 backdrop-blur">
        <button @click="prev" :disabled="idx === 0"
                class="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 text-sm font-semibold transition-colors">
          ← {{ locale === 'en' ? 'Previous' : 'הקודם' }}
        </button>
        <div class="flex gap-1">
          <div v-for="(_, i) in checkpoints" :key="i"
               @click="idx = i"
               :class="['w-2 h-2 rounded-full cursor-pointer transition-colors', i === idx ? 'bg-amber-400' : 'bg-slate-600 hover:bg-slate-500']" />
        </div>
        <button @click="next" :disabled="idx === checkpoints.length - 1"
                class="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 text-sm font-semibold transition-colors">
          {{ locale === 'en' ? 'Next' : 'הבא' }} →
        </button>
      </div>

    </template>
  </div>
</template>
