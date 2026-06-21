<script setup>
import { ref } from 'vue'

const props = defineProps({
  brandText:  { type: String,  default: 'המרוץ לצפון' },
  label:      { type: String,  default: 'יעד' },
  tapText:    { type: String,  default: 'לחצו לפתיחה' },
  alwaysFlip: { type: Boolean, default: false },
  flipReveal: { type: Boolean, default: false },
})
const emit = defineEmits(['opened'])

const state    = ref('idle')
const animType = ref('burst')

const ANIM_DURATIONS = { flip: 800, burst: 650, flyup: 750 }

const handleClick = () => {
  if (state.value !== 'idle') return
  const types = ['flip', 'burst', 'flyup']
  animType.value = props.alwaysFlip ? 'flip' : types[Math.floor(Math.random() * 3)]
  state.value = 'spinning'
  setTimeout(() => {
    state.value = 'open'
    emit('opened')
  }, ANIM_DURATIONS[animType.value])
}
</script>

<template>
  <div class="flex flex-col items-center gap-6 relative">

    <!-- === CLOSED ENVELOPE === -->
    <Transition name="env-out">
      <div
        v-if="state !== 'open'"
        @click="handleClick"
        :class="[
          'env-card relative cursor-pointer select-none w-full max-w-sm overflow-hidden',
          state === 'spinning' && animType === 'flip'  ? 'animate-env-flip'  :
          state === 'spinning' && animType === 'burst' ? 'animate-env-burst' :
          state === 'spinning' && animType === 'flyup' ? 'animate-env-flyup' : '',
        ]"
        style="aspect-ratio: 1.9 / 1;"
      >
        <!-- Blue gradient background -->
        <div class="env-bg absolute inset-0" />

        <!-- Top gold band -->
        <div class="env-gold absolute top-0 left-0 right-0 z-10" style="height: 15%;" />

        <!-- Bottom gold band -->
        <div class="env-gold absolute bottom-0 left-0 right-0 z-10" style="height: 15%;" />

        <!-- Content layer -->
        <div class="absolute z-20 flex flex-col items-center justify-between w-full"
             style="top: 15%; bottom: 15%; padding: 2% 4%;">

          <!-- Big label — יעד / משימה -->
          <div class="flex flex-1 items-center justify-center w-full">
            <span class="env-label">{{ label }}</span>
          </div>

          <!-- Badge: hexagon shape with white border -->
          <div class="env-badge-outer">
            <div class="env-badge-inner">
              <span class="env-badge-text">{{ brandText }}</span>
            </div>
          </div>
        </div>

        <!-- Shine sweep on idle -->
        <div v-if="state === 'idle'" class="shine-sweep absolute inset-0 pointer-events-none z-30" />
      </div>
    </Transition>

    <!-- Tap hint -->
    <p v-if="state === 'idle'" class="text-yellow-400/80 text-sm animate-bounce">
      👆 {{ tapText }}
    </p>

    <!-- === OPEN STATE — slot content === -->
    <Transition :name="flipReveal ? 'env-back-reveal' : 'letter-reveal'">
      <div v-if="state === 'open'" class="w-full">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@700;900&display=swap');

/* ── Card shell ── */
.env-card {
  border-radius: 1rem;
  box-shadow: 0 20px 60px rgba(6, 24, 80, 0.7), 0 4px 16px rgba(0,0,0,0.4);
}

/* ── Blue gradient background ── */
.env-bg {
  background: radial-gradient(ellipse at 50% 35%, #3d72d8 0%, #1e4dbf 35%, #0e2e90 65%, #071a60 100%);
}

/* ── Gold bands ── */
.env-gold {
  background: linear-gradient(180deg, #ffe84d 0%, #f5a500 55%, #e09000 100%);
}

/* ── Big label text ── */
.env-label {
  font-family: 'Rubik', 'Arial Black', 'Impact', Arial, sans-serif;
  font-weight: 900;
  font-size: clamp(2.4rem, 10vw, 3.6rem);
  color: #ffe033;
  line-height: 1;
  letter-spacing: 0.03em;
  text-shadow:
    0 3px 0 rgba(100, 50, 0, 0.7),
    0 6px 16px rgba(0, 0, 0, 0.55);
}

/* ── Badge — hexagon (arrow) shape with white border ── */
/* Technique: white outer hexagon + red inner hexagon, stacked via clip-path */
.env-badge-outer {
  background: #ffffff;
  clip-path: polygon(16px 0%, calc(100% - 16px) 0%, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0% 50%);
  padding: 3px;
  margin-bottom: 2%;
}
.env-badge-inner {
  background: #cc0010;
  clip-path: polygon(13px 0%, calc(100% - 13px) 0%, 100% 50%, calc(100% - 13px) 100%, 13px 100%, 0% 50%);
  padding: 4px 18px;
  min-width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.env-badge-text {
  font-family: 'Rubik', 'Arial Black', Arial, sans-serif;
  font-weight: 900;
  font-size: clamp(0.5rem, 2vw, 0.75rem);
  color: #ffffff;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

/* ── Shine sweep ── */
.shine-sweep {
  background: linear-gradient(
    105deg,
    transparent 25%,
    rgba(255, 255, 255, 0.2) 50%,
    transparent 75%
  );
  transform: translateX(-160%);
  animation: shine-move 3.5s ease-in-out infinite;
}
@keyframes shine-move {
  0%    { transform: translateX(-160%); }
  35%   { transform: translateX(160%); }
  100%  { transform: translateX(160%); }
}

/* ── Open/close animations ── */
@keyframes env-flip {
  0%   { transform: perspective(600px) rotateY(0deg)   scale(1);    opacity: 1; }
  45%  { transform: perspective(600px) rotateY(90deg)  scale(0.95); opacity: 1; }
  100% { transform: perspective(600px) rotateY(90deg)  scale(0);    opacity: 0; }
}
.animate-env-flip { animation: env-flip 0.8s cubic-bezier(0.4, 0, 0.6, 1) forwards; }

@keyframes env-burst {
  0%   { transform: scale(1);    opacity: 1; }
  35%  { transform: scale(1.35); opacity: 1; }
  65%  { transform: scale(1.1);  opacity: 0.4; }
  100% { transform: scale(0.1);  opacity: 0; }
}
.animate-env-burst { animation: env-burst 0.65s cubic-bezier(0.4, 0, 1, 1) forwards; }

@keyframes env-flyup {
  0%   { transform: translateY(0)      rotate(0deg);   opacity: 1; }
  20%  { transform: translateY(-18px)  rotate(-3deg);  opacity: 1; }
  100% { transform: translateY(-150%)  rotate(-14deg); opacity: 0; }
}
.animate-env-flyup { animation: env-flyup 0.75s cubic-bezier(0.4, 0, 0.6, 1) forwards; }

/* ── Content reveal ── */
@keyframes letter-rise {
  0%   { transform: translateY(30px) scale(0.95); opacity: 0; }
  60%  { transform: translateY(-4px) scale(1.01); opacity: 1; }
  100% { transform: translateY(0)    scale(1);    opacity: 1; }
}
/* Remove from layout flow instantly so it can't push slot content down */
.env-out-leave-active {
  position: absolute;
  pointer-events: none;
  transition: none;
}
.letter-reveal-enter-active { animation: letter-rise 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

/* ── Flip reveal: back of envelope comes in from the other side ── */
@keyframes flip-in-back {
  0%   { transform: perspective(700px) rotateY(-90deg); opacity: 0; }
  40%  { opacity: 1; }
  100% { transform: perspective(700px) rotateY(0deg);   opacity: 1; }
}
.env-back-reveal-enter-active { animation: flip-in-back 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
</style>
