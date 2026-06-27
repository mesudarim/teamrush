<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  steps:  { type: Array,  default: () => [] },
  locale: { type: String, default: 'he' },
})
const emit = defineEmits(['close'])

const current = ref(0)
const step    = computed(() => props.steps[current.value] ?? null)
const isLast  = computed(() => current.value === props.steps.length - 1)
const text    = computed(() => props.locale === 'en' ? step.value?.en : step.value?.he)

watch(() => props.steps, () => { current.value = 0 })

const next  = () => { if (!isLast.value) current.value++ }
const prev  = () => { if (current.value > 0) current.value-- }
</script>

<template>
  <Transition name="tut-fade">
    <div v-if="steps.length" class="fixed inset-0 z-50 flex flex-col">

      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60" @click="emit('close')" />

      <!-- ── arrow=up : card at bottom, triangle points UP toward screen top ── -->
      <div v-if="step?.arrow === 'up'" class="relative mt-auto mx-4 mb-28">
        <div class="flex justify-center">
          <svg width="28" height="14" viewBox="0 0 28 14" class="relative z-10 -mb-px">
            <polygon points="14,0 28,14 0,14" fill="#1e293b"/>
          </svg>
        </div>
        <!-- card -->
        <div class="relative z-10 bg-slate-800 rounded-2xl border border-slate-600 shadow-2xl p-5 space-y-4">
          <p class="text-white text-base leading-relaxed font-medium text-center" :dir="locale === 'he' ? 'rtl' : 'ltr'"
             style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
            {{ text }}
          </p>
          <div class="flex items-center justify-between">
            <!-- Step dots -->
            <div class="flex gap-1.5">
              <div v-for="(_, i) in steps" :key="i"
                   :class="['w-2 h-2 rounded-full transition-colors', i === current ? 'bg-amber-400' : 'bg-slate-600']" />
            </div>
            <!-- Buttons -->
            <div class="flex gap-2">
              <button v-if="current > 0" @click="prev"
                      class="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold transition-colors">
                ←
              </button>
              <button v-if="!isLast" @click="next"
                      class="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold transition-colors">
                {{ locale === 'en' ? 'Next' : 'הבא' }} →
              </button>
              <button v-else @click="emit('close')"
                      class="px-4 py-1.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-bold transition-colors">
                {{ locale === 'en' ? 'Got it!' : '!הבנתי' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── arrow=down : card at top, triangle points DOWN toward screen bottom ── -->
      <div v-else-if="step?.arrow === 'down'" class="relative mt-20 mx-4">
        <!-- card -->
        <div class="relative z-10 bg-slate-800 rounded-2xl border border-slate-600 shadow-2xl p-5 space-y-4">
          <p class="text-white text-base leading-relaxed font-medium text-center" :dir="locale === 'he' ? 'rtl' : 'ltr'"
             style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
            {{ text }}
          </p>
          <div class="flex items-center justify-between">
            <div class="flex gap-1.5">
              <div v-for="(_, i) in steps" :key="i"
                   :class="['w-2 h-2 rounded-full transition-colors', i === current ? 'bg-amber-400' : 'bg-slate-600']" />
            </div>
            <div class="flex gap-2">
              <button v-if="current > 0" @click="prev"
                      class="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold transition-colors">
                ←
              </button>
              <button v-if="!isLast" @click="next"
                      class="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold transition-colors">
                {{ locale === 'en' ? 'Next' : 'הבא' }} →
              </button>
              <button v-else @click="emit('close')"
                      class="px-4 py-1.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-bold transition-colors">
                {{ locale === 'en' ? 'Got it!' : '!הבנתי' }}
              </button>
            </div>
          </div>
        </div>
        <div class="flex justify-center">
          <svg width="28" height="14" viewBox="0 0 28 14" class="relative z-10 -mt-px">
            <polygon points="0,0 28,0 14,14" fill="#1e293b"/>
          </svg>
        </div>
      </div>

      <!-- ── no arrow : card centered ── -->
      <div v-else class="relative m-auto mx-4 w-full max-w-sm">
        <div class="relative z-10 bg-slate-800 rounded-2xl border border-slate-600 shadow-2xl p-5 space-y-4">
          <p class="text-white text-base leading-relaxed font-medium text-center" :dir="locale === 'he' ? 'rtl' : 'ltr'"
             style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
            {{ text }}
          </p>
          <div class="flex items-center justify-between">
            <div class="flex gap-1.5">
              <div v-for="(_, i) in steps" :key="i"
                   :class="['w-2 h-2 rounded-full transition-colors', i === current ? 'bg-amber-400' : 'bg-slate-600']" />
            </div>
            <div class="flex gap-2">
              <button v-if="current > 0" @click="prev"
                      class="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold transition-colors">
                ←
              </button>
              <button v-if="!isLast" @click="next"
                      class="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold transition-colors">
                {{ locale === 'en' ? 'Next' : 'הבא' }} →
              </button>
              <button v-else @click="emit('close')"
                      class="px-4 py-1.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-bold transition-colors">
                {{ locale === 'en' ? 'Got it!' : '!הבנתי' }}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </Transition>
</template>

<style scoped>
.tut-fade-enter-active, .tut-fade-leave-active { transition: opacity 0.2s ease; }
.tut-fade-enter-from, .tut-fade-leave-to { opacity: 0; }
</style>
