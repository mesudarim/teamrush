<script setup>
import { ref } from 'vue'

const props = defineProps({
  // Small top line inside the black center — e.g. "TeamRush" or "המירוץ"
  brandText: { type: String, default: 'TeamRush' },
  // Large main label — e.g. "יעד" or "משימה"
  label: { type: String, default: 'יעד' },
  tapText: { type: String, default: 'לחצו לפתיחה' },
})
const emit = defineEmits(['opened'])

// States: 'idle' → 'spinning' → 'open'
const state = ref('idle')

const handleClick = () => {
  if (state.value !== 'idle') return
  state.value = 'spinning'
  setTimeout(() => {
    state.value = 'open'
    emit('opened')
  }, 1300)
}
</script>

<template>
  <div class="flex flex-col items-center gap-6">

    <!-- === CLOSED ENVELOPE === -->
    <Transition name="env-out">
      <div
        v-if="state !== 'open'"
        @click="handleClick"
        :class="[
          'relative cursor-pointer select-none w-full max-w-sm',
          'rounded-2xl overflow-hidden shadow-2xl',
          state === 'idle' ? 'animate-env-float' : 'animate-env-spin',
        ]"
        style="aspect-ratio: 1.9 / 1;"
      >
        <!-- Top yellow band -->
        <div class="absolute top-0 left-0 right-0 bg-amber-400" style="height:18%;" />

        <!-- Black center: brand small + label big -->
        <div class="absolute left-0 right-0 flex flex-col items-center justify-center gap-1 bg-black"
             style="top:18%; bottom:22%;">
          <span class="text-amber-400/70 font-bold tracking-[0.25em] uppercase text-center px-4"
                style="font-size: clamp(0.5rem, 2.2vw, 0.7rem);">
            {{ brandText }}
          </span>
          <span class="text-amber-400 font-black tracking-wider leading-none text-center px-4"
                style="font-size: clamp(2rem, 9vw, 3rem);">
            {{ label }}
          </span>
        </div>

        <!-- Bottom yellow band -->
        <div class="absolute bottom-0 left-0 right-0 bg-amber-400 flex items-center justify-center"
             style="height:22%;">
          <span class="text-black font-black tracking-[0.15em] uppercase"
                style="font-size: clamp(0.55rem, 2.5vw, 0.75rem);">
            ◄ ◄ ◄ &nbsp;&nbsp;&nbsp; ► ► ►
          </span>
        </div>

        <!-- Shine overlay on idle -->
        <div v-if="state === 'idle'"
             class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none rounded-2xl" />
      </div>
    </Transition>

    <!-- Tap hint -->
    <p v-if="state === 'idle'" class="text-amber-400/70 text-sm animate-bounce">
      👆 {{ tapText }}
    </p>

    <!-- === OPEN STATE — slot content === -->
    <Transition name="letter-reveal">
      <div v-if="state === 'open'" class="w-full">
        <slot />
      </div>
    </Transition>

  </div>
</template>

<style scoped>
/* Floating idle animation */
@keyframes env-float {
  0%, 100% { transform: translateY(0px) rotate(-1deg); }
  50%       { transform: translateY(-12px) rotate(1deg); }
}
/* 3-full-spin then shrink to zero */
@keyframes env-spin {
  0%   { transform: rotate(0deg)    scale(1);   opacity: 1; }
  75%  { transform: rotate(1080deg) scale(0.85); opacity: 1; }
  100% { transform: rotate(1080deg) scale(0);   opacity: 0; }
}
/* Letter rising from below */
@keyframes letter-rise {
  0%   { transform: translateY(40px) scale(0.9); opacity: 0; }
  60%  { transform: translateY(-6px) scale(1.02); opacity: 1; }
  100% { transform: translateY(0px)  scale(1);   opacity: 1; }
}

.animate-env-float { animation: env-float 3s ease-in-out infinite; }
.animate-env-spin  { animation: env-spin 1.3s cubic-bezier(0.4, 0, 0.6, 1) forwards; }

/* Transition wrappers */
.env-out-leave-active    { transition: none; } /* handled by spin animation */
.letter-reveal-enter-active { animation: letter-rise 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
</style>
