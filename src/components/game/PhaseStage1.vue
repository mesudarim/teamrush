<script setup>
import { ref, computed, watchEffect, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import QrScanner from '@/components/ui/QrScanner.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { useSound } from '@/composables/useSound'

const { t, locale } = useI18n()
const game = useGameStore()
const { playCorrect, playWrong } = useSound()

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
const checking = ref(false)
const showScanner = ref(false)
const showSkipConfirm = ref(false)
const skipping = ref(false)

// ── Multi-field mode ──────────────────────────────────────────────────────────
const multiValues = ref([])
const initMulti = () => {
  const n = cp.value?.stage1Keywords?.length ?? 0
  multiValues.value = Array(n).fill('')
}
watchEffect(() => { if (mode.value === 'multiField') initMulti() })

const isOrderedMode = computed(() => !!(cp.value?.stage1MultiOrdered))

// Pools of accepted values per slot
const multiPools = computed(() => {
  const clean = s => s.trim().toLowerCase()
  return (cp.value?.stage1Keywords ?? []).map(kw => [
    ...(kw.he ?? '').split(','),
    ...(kw.en ?? '').split(','),
  ].map(clean).filter(Boolean))
})

// For each input field, which slot index does it match? (-1 = none)
// Greedy: first field to claim a slot wins; duplicates don't get a slot
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

const fieldIsGreen = computed(() => fieldSlotMatch.value.map(s => s !== -1))
const allFieldsGreen = computed(() =>
  fieldIsGreen.value.length > 0 && fieldIsGreen.value.every(Boolean)
)

// ── Ordering stage ────────────────────────────────────────────────────────────
const showOrdering = ref(false)
const orderItems = ref([])   // [{ label, slotIndex }]
const selectedOrderIdx = ref(null)
const orderWrong = ref(false)
const completing = ref(false)

const orderItemStatus = computed(() =>
  orderItems.value.map((item, i) => item.slotIndex === i)
)
const allOrderCorrect = computed(() =>
  orderItems.value.length > 0 && orderItemStatus.value.every(Boolean)
)

// Auto-transition to ordering stage when all fields are green
watch(allFieldsGreen, async (v) => {
  if (!v || !isOrderedMode.value || showOrdering.value || submitted.value) return
  await new Promise(r => setTimeout(r, 500))
  // Build shuffled cards from the matched fields
  const items = fieldSlotMatch.value
    .map((slotIdx, i) => ({ label: multiValues.value[i], slotIndex: slotIdx }))
    .sort(() => Math.random() - 0.5)
  orderItems.value = items
  showOrdering.value = true
})

const selectOrderItem = (i) => {
  if (selectedOrderIdx.value === null) {
    selectedOrderIdx.value = i
  } else if (selectedOrderIdx.value === i) {
    selectedOrderIdx.value = null
  } else {
    const a = selectedOrderIdx.value
    const tmp = orderItems.value[a]
    orderItems.value[a] = orderItems.value[i]
    orderItems.value[i] = tmp
    selectedOrderIdx.value = null
    orderWrong.value = false
  }
}

const submitOrder = async () => {
  if (!allOrderCorrect.value) {
    orderWrong.value = true
    playWrong()
    setTimeout(() => { orderWrong.value = false }, 1800)
    return
  }
  // Re-map inputs in slot order so validateStage1Multi always succeeds
  const reordered = new Array(multiValues.value.length)
  orderItems.value.forEach(item => { reordered[item.slotIndex] = item.label })
  completing.value = true
  const ok = await game.validateStage1Multi(reordered)
  completing.value = false
  if (ok) {
    playCorrect()
    submitted.value = true
    isCorrect.value = true
  }
}

const confirmSkip = async () => {
  skipping.value = true
  await game.skipStage1()
  skipping.value = false
  showSkipConfirm.value = false
}

const submit = async (value = input.value) => {
  if (!value.trim() || (submitted.value && isCorrect.value) || checking.value) return
  checking.value = true
  isCorrect.value = await game.validateStage1(value)
  checking.value = false
  submitted.value = true
  if (isCorrect.value) {
    playCorrect()
  } else {
    playWrong()
    setTimeout(() => { submitted.value = false; input.value = '' }, 1800)
  }
}

const onQrDecoded = (value) => {
  showScanner.value = false
  input.value = value
  submit(value)
}

const submitMulti = async () => {
  if (submitted.value && isCorrect.value) return
  if (checking.value) return
  const clean = s => s.trim().toLowerCase()
  const cleaned = multiValues.value.map(clean)
  // Check for empty fields
  if (cleaned.some(v => !v)) return
  checking.value = true
  const ok = await game.validateStage1Multi(multiValues.value)
  checking.value = false
  submitted.value = true
  isCorrect.value = ok
  if (ok) {
    playCorrect()
  } else {
    playWrong()
    setTimeout(() => { submitted.value = false }, 1800)
  }
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
        <p class="text-slate-300 text-xl font-bold leading-snug whitespace-pre-line">{{ instruction }}</p>
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
        <button @click="submit()" :disabled="!input.trim() || (submitted && isCorrect) || checking" class="btn-primary w-full">
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

        <button @click="submit()" :disabled="!input.trim() || (submitted && isCorrect) || checking" class="btn-primary w-full">
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

      <!-- ── MULTI-FIELD MODE ── -->
      <div v-if="mode === 'multiField'" class="space-y-3">

        <!-- Phase 1: Find the words -->
        <template v-if="!showOrdering">
          <p class="text-xs text-slate-400 text-center">{{ t('game.stage1.multiFieldHint') }}</p>

          <div
            v-for="(_, i) in (cp?.stage1Keywords ?? [])"
            :key="i"
            class="flex items-center gap-2"
          >
            <span class="text-slate-500 text-xs font-mono w-5 text-center shrink-0">{{ i + 1 }}</span>
            <input
              v-model="multiValues[i]"
              type="text"
              class="input-field text-center font-bold tracking-widest flex-1 transition-all"
              :class="[
                fieldIsGreen[i]
                  ? 'border-green-500 ring-2 ring-green-500/30'
                  : (submitted && !isCorrect ? 'border-red-500 ring-2 ring-red-500/30' : ''),
              ]"
              :placeholder="t('game.stage1.placeholder')"
              @keyup.enter="isOrderedMode ? null : submitMulti()"
              :disabled="(submitted && isCorrect) || (allFieldsGreen && isOrderedMode)"
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            />
            <Transition name="check-pop">
              <span v-if="fieldIsGreen[i]" class="text-green-400 text-lg shrink-0 leading-none">✓</span>
              <span v-else class="w-5 shrink-0" />
            </Transition>
          </div>

          <!-- Feedback -->
          <Transition name="feedback">
            <div v-if="submitted && !isCorrect"
                 class="flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold bg-red-500/15 border border-red-500/30 text-red-400">
              ❌ {{ t('game.stage1.multiFieldWrong') }}
            </div>
            <div v-else-if="allFieldsGreen && isOrderedMode"
                 class="flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold text-green-400">
              <LoadingSpinner size="sm" /> {{ t('game.stage1.multiFieldAllFound') }}
            </div>
          </Transition>

          <!-- Submit (non-ordered only) -->
          <button
            v-if="!isOrderedMode"
            @click="submitMulti"
            :disabled="multiValues.some(v => !v?.trim()) || (submitted && isCorrect) || checking"
            class="btn-primary w-full"
          >
            {{ t('game.stage1.submit') }}
          </button>
        </template>

        <!-- Phase 2: Order the found words -->
        <template v-else>
          <p class="text-sm font-bold text-slate-200 text-center">{{ t('game.stage1.multiFieldOrderTitle') }}</p>
          <p class="text-xs text-slate-400 text-center">{{ t('game.stage1.multiFieldOrderHint') }}</p>

          <!-- Word cards row -->
          <div class="flex flex-wrap gap-2 justify-center py-2 min-h-[52px]">
            <button
              v-for="(item, i) in orderItems"
              :key="i"
              @click="selectOrderItem(i)"
              :class="[
                'order-card',
                selectedOrderIdx === i ? 'order-card-selected' : '',
                orderItemStatus[i]  ? 'order-card-correct'   : '',
              ]"
            >
              {{ item.label }}
            </button>
          </div>

          <!-- Position indicators -->
          <div class="flex gap-2 justify-center">
            <div
              v-for="(ok, i) in orderItemStatus"
              :key="i"
              :class="['w-2 h-2 rounded-full transition-colors', ok ? 'bg-green-400' : 'bg-slate-600']"
            />
          </div>

          <!-- Feedback -->
          <Transition name="feedback">
            <div v-if="orderWrong"
                 class="flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold bg-red-500/15 border border-red-500/30 text-red-400">
              ❌ {{ t('game.stage1.multiFieldOrderWrong') }}
            </div>
          </Transition>

          <button
            @click="submitOrder"
            :disabled="completing"
            class="btn-primary w-full"
          >
            {{ completing ? t('common.loading') : t('game.stage1.submit') }}
          </button>
        </template>
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

/* ── Check-pop (✓ appear) ── */
.check-pop-enter-active { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.check-pop-enter-from { opacity: 0; transform: scale(0.3); }

/* ── Order word cards ── */
.order-card {
  padding: 0.45rem 1rem;
  border-radius: 0.6rem;
  border: 2px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.07);
  color: #e2e8f0;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.18s;
  touch-action: manipulation;
}
.order-card:active { transform: scale(0.95); }
.order-card-selected {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.18);
  color: #fcd34d;
  transform: scale(1.08);
  box-shadow: 0 0 0 3px rgba(245,158,11,0.25);
}
.order-card-correct {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.15);
  color: #86efac;
}
</style>
