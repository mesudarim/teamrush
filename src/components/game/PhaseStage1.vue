<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import QrScanner from '@/components/ui/QrScanner.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'

const { t, locale } = useI18n()
const game = useGameStore()

const cp = computed(() => game.currentCheckpoint)
const mode = computed(() => cp.value?.stage1Mode ?? 'text')
const instruction = computed(() => {
  if (locale.value === 'en' && cp.value?.stage1InstructionEn) return cp.value.stage1InstructionEn
  if (cp.value?.stage1Instruction) return cp.value.stage1Instruction
  // fallback for legacy checkpoints that stored instruction in description
  if (locale.value === 'en' && cp.value?.descriptionEn) return cp.value.descriptionEn
  return cp.value?.description || t('game.stage1.instruction')
})
const stage1ImageUrl = computed(() => cp.value?.stage1ImageUrl ?? '')

const input = ref('')
const submitted = ref(false)
const isCorrect = ref(false)
const showScanner = ref(false)
const showSkipConfirm = ref(false)
const skipping = ref(false)

const confirmSkip = async () => {
  skipping.value = true
  await game.skipStage1()
  skipping.value = false
  showSkipConfirm.value = false
}

const submit = async (value = input.value) => {
  if (!value.trim() || (submitted.value && isCorrect.value)) return
  submitted.value = true
  isCorrect.value = await game.validateStage1(value)
  if (!isCorrect.value) {
    setTimeout(() => { submitted.value = false; input.value = '' }, 1800)
  }
}

const onQrDecoded = (value) => {
  showScanner.value = false
  input.value = value
  submit(value)
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center p-4 max-w-sm mx-auto w-full">
    <div class="w-full animate-slide-up card space-y-6">

      <!-- Header -->
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-blue-500/20 border-2 border-blue-500/40 flex items-center justify-center text-3xl">
          {{ mode === 'qr' ? '📷' : '🔐' }}
        </div>
        <div class="badge-blue mb-2 text-base px-4 py-1.5">{{ t('game.stage1.title') }}</div>
        <p class="text-slate-300 text-xl font-bold leading-snug">{{ instruction }}</p>
      </div>

      <!-- ── MISSING WORD MODE ── -->
      <div v-if="mode === 'missingWord'" class="space-y-3">
        <div v-if="stage1ImageUrl" class="rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
          <img :src="stage1ImageUrl" class="w-full object-cover" style="max-height: 260px; object-position: center;" />
        </div>
        <input
          v-model="input"
          type="text"
          class="input-field text-center text-xl font-bold tracking-widest"
          :class="submitted && !isCorrect ? 'border-red-500 ring-2 ring-red-500/30' : ''"
          :placeholder="t('game.stage1.placeholder')"
          @keyup.enter="submit()"
          :disabled="submitted && isCorrect"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        />
        <Transition name="feedback">
          <div v-if="submitted"
               :class="['flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold',
                 isCorrect ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                           : 'bg-red-500/15 border border-red-500/30 text-red-400']">
            {{ isCorrect ? '✅' : '❌' }}
            {{ isCorrect ? t('game.stage1.correct') : t('game.stage1.wrong') }}
          </div>
        </Transition>
        <button @click="submit()" :disabled="!input.trim() || (submitted && isCorrect)" class="btn-primary w-full">
          {{ t('game.stage1.submit') }}
        </button>
      </div>

      <!-- ── TEXT MODE ── -->
      <div v-if="mode === 'text'" class="space-y-3">
        <input
          v-model="input"
          type="text"
          class="input-field text-center text-xl font-bold tracking-widest"
          :placeholder="t('game.stage1.placeholder')"
          @keyup.enter="submit()"
          :disabled="submitted && isCorrect"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        />

        <Transition name="feedback">
          <div v-if="submitted"
               :class="['flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold',
                 isCorrect ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                           : 'bg-red-500/15 border border-red-500/30 text-red-400']">
            {{ isCorrect ? '✅' : '❌' }}
            {{ isCorrect ? t('game.stage1.correct') : t('game.stage1.wrong') }}
          </div>
        </Transition>

        <button @click="submit()" :disabled="!input.trim() || (submitted && isCorrect)" class="btn-primary w-full">
          {{ t('game.stage1.submit') }}
        </button>
      </div>

      <!-- ── QR MODE ── -->
      <div v-else-if="mode === 'qr'" class="space-y-3">
        <Transition name="feedback">
          <div v-if="submitted"
               :class="['flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold',
                 isCorrect ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                           : 'bg-red-500/15 border border-red-500/30 text-red-400']">
            {{ isCorrect ? '✅' : '❌' }}
            {{ isCorrect ? t('game.stage1.correct') : t('game.stage1.wrong') }}
          </div>
        </Transition>

        <button
          @click="showScanner = true"
          :disabled="submitted && isCorrect"
          class="btn-primary w-full py-5 flex items-center justify-center gap-3 text-base"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
          </svg>
          {{ t('game.stage1.scanBtn') }}
        </button>
        <p class="text-center text-xs text-slate-500">{{ t('game.stage1.scanHint') }}</p>

        <!-- QR Scanner — inside single root div -->
        <QrScanner v-if="showScanner" @decoded="onQrDecoded" @close="showScanner = false" />
      </div>

      <!-- Skip button -->
      <div v-if="!(submitted && isCorrect)" class="mt-4 text-center">
        <button @click="showSkipConfirm = true"
                class="text-xs text-slate-500 hover:text-red-400 underline underline-offset-2 transition-colors">
          {{ t('game.skip.btnStage1', { cost: game.SKIP_COST }) }}
        </button>
      </div>

    </div>

    <ConfirmModal
      :is-open="showSkipConfirm"
      :message="t('game.skip.confirmStage1', { cost: game.SKIP_COST })"
      @confirm="confirmSkip"
      @cancel="showSkipConfirm = false"
    />
  </div>
</template>

<style scoped>
.feedback-enter-active, .feedback-leave-active { transition: all 0.3s; }
.feedback-enter-from, .feedback-leave-to { opacity: 0; transform: translateY(-5px); }
</style>
