<script setup>
import { ref } from 'vue'

const props = defineProps({
  brandText: { type: String, default: 'מרוץ הנבל' },
  label:     { type: String, default: 'יעד' },
  tapText:   { type: String, default: 'לחצו לפתיחה' },
})
const emit = defineEmits(['opened'])

// States: 'idle' → 'spinning' → 'open'
const state    = ref('idle')
const animType = ref('burst')

const ANIM_DURATIONS = { flip: 800, burst: 650, flyup: 750 }

const handleClick = () => {
  if (state.value !== 'idle') return
  const types = ['flip', 'burst', 'flyup']
  animType.value = types[Math.floor(Math.random() * 3)]
  state.value = 'spinning'
  setTimeout(() => {
    state.value = 'open'
    emit('opened')
  }, ANIM_DURATIONS[animType.value])
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
          state === 'idle'     ? 'animate-env-float' :
          animType === 'flip'  ? 'animate-env-flip'  :
          animType === 'burst' ? 'animate-env-burst'  :
                                 'animate-env-flyup',
        ]"
        style="aspect-ratio: 1.9 / 1;"
      >
        <!-- Top yellow band -->
        <div class="absolute top-0 left-0 right-0 bg-amber-400" style="height:18%;" />

        <!-- Black center: brand small + label big -->
        <div class="absolute left-0 right-0 flex flex-col items-center justify-center gap-1 bg-black"
             style="top:18%; bottom:22%;">
          <span class="font-sans text-amber-400/70 font-bold tracking-[0.25em] uppercase text-center px-4"
                style="font-size: clamp(0.5rem, 2.2vw, 0.7rem); font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
            {{ brandText }}
          </span>
          <span class="font-sans text-amber-400 font-bold tracking-wider leading-none text-center px-4"
                style="font-size: clamp(2rem, 9vw, 3rem); font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
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
/* ── Idle float ── */
@keyframes env-float {
  0%, 100% { transform: translateY(0px) rotate(-1deg); }
  50%       { transform: translateY(-12px) rotate(1deg); }
}
.animate-env-float { animation: env-float 3s ease-in-out infinite; }

/* ── Option 1 : Flip (retournement sur l'axe Y) ── */
@keyframes env-flip {
  0%   { transform: perspective(600px) rotateY(0deg)  scale(1);   opacity: 1; }
  45%  { transform: perspective(600px) rotateY(90deg) scale(0.95); opacity: 1; }
  100% { transform: perspective(600px) rotateY(90deg) scale(0);   opacity: 0; }
}
.animate-env-flip { animation: env-flip 0.8s cubic-bezier(0.4, 0, 0.6, 1) forwards; }

/* ── Option 2 : Burst (éclatement) ── */
@keyframes env-burst {
  0%   { transform: scale(1);    opacity: 1; }
  35%  { transform: scale(1.35); opacity: 1; }
  65%  { transform: scale(1.1);  opacity: 0.4; }
  100% { transform: scale(0.1);  opacity: 0; }
}
.animate-env-burst { animation: env-burst 0.65s cubic-bezier(0.4, 0, 1, 1) forwards; }

/* ── Option 3 : Fly-up (envol vers le haut) ── */
@keyframes env-flyup {
  0%   { transform: translateY(0)     rotate(0deg);   opacity: 1; }
  20%  { transform: translateY(-18px) rotate(-3deg);  opacity: 1; }
  100% { transform: translateY(-150%) rotate(-14deg); opacity: 0; }
}
.animate-env-flyup { animation: env-flyup 0.75s cubic-bezier(0.4, 0, 0.6, 1) forwards; }

/* ── Content reveal ── */
@keyframes letter-rise {
  0%   { transform: translateY(30px) scale(0.95); opacity: 0; }
  60%  { transform: translateY(-4px) scale(1.01); opacity: 1; }
  100% { transform: translateY(0)    scale(1);    opacity: 1; }
}

/* Transition wrappers */
.env-out-leave-active       { transition: none; }
.letter-reveal-enter-active { animation: letter-rise 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
</style>
