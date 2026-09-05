<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseMission from './BaseMission.vue'
import { useSound } from '@/composables/useSound'

const { t, locale } = useI18n()
const { playCorrect, playWrong } = useSound()

const props = defineProps({
  checkpoint: { type: Object, required: true },
  question:   { type: Object, required: true },
  config:     { type: Object, default: () => ({}) },
})
const emit = defineEmits(['correct', 'wrong'])

const keywords  = computed(() => props.config.keywords ?? props.question.keywords ?? [])
const isOrdered = computed(() => !!(props.config.ordered ?? props.question.ordered))

const questionText = computed(() => {
  const q   = props.question.question   ?? ''
  const qEn = props.question.questionEn ?? ''
  return (locale.value === 'en' && qEn) ? qEn : (q || qEn)
})

// ── State ─────────────────────────────────────────────────────────────────────
const multiValues    = ref(keywords.value.map(() => ''))
const submitted      = ref(false)
const isCorrect      = ref(false)

watch(() => keywords.value.length, (n) => { multiValues.value = Array(n).fill('') })

// ── Pool matching ─────────────────────────────────────────────────────────────
const clean = s => s.trim().toLowerCase()

const multiPools = computed(() =>
  keywords.value.map(kw =>
    [...(kw.he ?? '').split(','), ...(kw.en ?? '').split(',')]
      .map(clean).filter(Boolean)
  )
)

const fieldSlotMatch = computed(() => {
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

// ── Ordering stage ────────────────────────────────────────────────────────────
const showOrdering      = ref(false)
const orderItems        = ref([])
const selectedOrderIdx  = ref(null)
const orderWrong        = ref(false)

watch(allFieldsGreen, async (v) => {
  if (!v || !isOrdered.value || showOrdering.value || submitted.value) return
  await new Promise(r => setTimeout(r, 500))
  orderItems.value = fieldSlotMatch.value
    .map((slotIdx, i) => ({ label: multiValues.value[i], slotIndex: slotIdx }))
    .sort(() => Math.random() - 0.5)
  showOrdering.value = true
})

const orderItemStatus = computed(() => orderItems.value.map((item, i) => item.slotIndex === i))
const allOrderCorrect = computed(() => orderItems.value.length > 0 && orderItemStatus.value.every(Boolean))

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

const submitOrder = () => {
  if (!allOrderCorrect.value) {
    orderWrong.value = true
    playWrong()
    setTimeout(() => { orderWrong.value = false }, 1800)
    return
  }
  submitted.value = true
  isCorrect.value = true
  playCorrect()
  emit('correct')
}

// ── Submit (non-ordered) ──────────────────────────────────────────────────────
const submitMulti = () => {
  if (multiValues.value.some(v => !v?.trim()) || (submitted.value && isCorrect.value)) return
  submitted.value = true
  if (allFieldsGreen.value) {
    isCorrect.value = true
    playCorrect()
    emit('correct')
  } else {
    isCorrect.value = false
    playWrong()
    emit('wrong')
    setTimeout(() => { submitted.value = false }, 1800)
  }
}
</script>

<template>
  <BaseMission :checkpoint="checkpoint" :question="question" :config="config">
    <template #default>

      <!-- Phase 1: find the words -->
      <template v-if="!showOrdering">
        <p v-if="questionText" class="text-slate-200 text-base font-semibold text-center leading-snug whitespace-pre-line mb-2">
          {{ questionText }}
        </p>
        <p class="text-xs text-slate-400 text-center">{{ t('game.stage1.multiFieldHint') }}</p>

        <div v-for="(_, i) in keywords" :key="i" class="flex items-center gap-2">
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
            @keyup.enter="isOrdered ? null : submitMulti()"
            :disabled="(submitted && isCorrect) || (allFieldsGreen && isOrdered)"
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          />
          <Transition name="check-pop">
            <span v-if="fieldIsGreen[i]" class="text-green-400 text-lg shrink-0 leading-none">✓</span>
            <span v-else class="w-5 shrink-0" />
          </Transition>
        </div>

        <Transition name="feedback">
          <div v-if="submitted && !isCorrect"
               class="flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold bg-red-500/15 border border-red-500/30 text-red-400">
            ❌ {{ t('game.stage1.multiFieldWrong') }}
          </div>
          <div v-else-if="allFieldsGreen && isOrdered"
               class="flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold text-green-400">
            {{ t('game.stage1.multiFieldAllFound') }}
          </div>
        </Transition>

        <button
          v-if="!isOrdered"
          @click="submitMulti"
          :disabled="multiValues.some(v => !v?.trim()) || (submitted && isCorrect)"
          class="btn-primary w-full"
        >
          {{ t('game.stage1.submit') }}
        </button>
      </template>

      <!-- Phase 2: ordering -->
      <template v-else>
        <p class="text-sm font-bold text-slate-200 text-center">{{ t('game.stage1.multiFieldOrderTitle') }}</p>
        <p class="text-xs text-slate-400 text-center">{{ t('game.stage1.multiFieldOrderHint') }}</p>

        <div class="flex flex-col gap-2 py-2">
          <button
            v-for="(item, i) in orderItems"
            :key="i"
            @click="selectOrderItem(i)"
            :class="['order-card', selectedOrderIdx === i ? 'order-card-selected' : '', orderItemStatus[i] ? 'order-card-correct' : '']"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="flex gap-2 justify-center">
          <div v-for="(ok, i) in orderItemStatus" :key="i"
               :class="['w-2 h-2 rounded-full transition-colors', ok ? 'bg-green-400' : 'bg-slate-600']" />
        </div>

        <Transition name="feedback">
          <div v-if="orderWrong"
               class="flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold bg-red-500/15 border border-red-500/30 text-red-400">
            ❌ {{ t('game.stage1.multiFieldOrderWrong') }}
          </div>
        </Transition>

        <button @click="submitOrder" class="btn-primary w-full">
          {{ t('game.stage1.submit') }}
        </button>
      </template>

    </template>
  </BaseMission>
</template>

<style scoped>
.feedback-enter-active, .feedback-leave-active { transition: all 0.3s; }
.feedback-enter-from, .feedback-leave-to { opacity: 0; transform: translateY(-5px); }
.check-pop-enter-active { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.check-pop-enter-from { opacity: 0; transform: scale(0.3); }
.order-card {
  padding: 0.45rem 1rem; border-radius: 0.6rem;
  border: 2px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.07);
  color: #e2e8f0; font-size: 0.95rem; font-weight: 700;
  letter-spacing: 0.04em; cursor: pointer; transition: all 0.18s; touch-action: manipulation;
}
.order-card:active { transform: scale(0.95); }
.order-card-selected { border-color: #f59e0b; background: rgba(245,158,11,0.18); color: #fcd34d; transform: scale(1.08); box-shadow: 0 0 0 3px rgba(245,158,11,0.25); }
.order-card-correct  { border-color: #22c55e; background: rgba(34,197,94,0.15); color: #86efac; }
</style>
