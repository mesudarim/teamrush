<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseMission from './BaseMission.vue'

const { t } = useI18n()

const props = defineProps({
  checkpoint: { type: Object, required: true },
  question:   { type: Object, required: true },
  config:     { type: Object, default: () => ({}) },
})
const emit = defineEmits(['correct'])

const MAX_MOVES = 20

const pieces   = ref([])  // pieces[cellIndex] = imageIndex (0-8)
const selected = ref(null)
const count    = ref(0)
const solved   = ref(false)
const completed = ref(false)
const failed    = ref(false)

const imageUrl = computed(() => props.config?.puzzleImageUrl ?? '')

// bgPosition for a piece: its image index determines which 1/3 of the image
const bgPos = (pieceIndex) => {
  const col = pieceIndex % 3
  const row = Math.floor(pieceIndex / 3)
  return `${col * 50}% ${row * 50}%`
}

const initPuzzle = () => {
  const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  // 12 random swaps → always solvable, never pre-solved
  for (let k = 0; k < 12; k++) {
    const i = Math.floor(Math.random() * 9)
    let j; do { j = Math.floor(Math.random() * 9) } while (j === i)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  if (arr.every((v, idx) => v === idx)) return initPuzzle()
  pieces.value = arr
}

onMounted(initPuzzle)

// Detect win
watch(pieces, (newPieces) => {
  if (newPieces.length === 9 && newPieces.every((v, i) => v === i) && !completed.value && !failed.value) {
    onVictory()
  }
}, { deep: true })

const selectPiece = (cellIdx) => {
  if (completed.value || failed.value || solved.value) return
  if (selected.value === null) {
    selected.value = cellIdx
    return
  }
  if (selected.value === cellIdx) {
    selected.value = null
    return
  }
  // Swap
  const arr = [...pieces.value]
  ;[arr[selected.value], arr[cellIdx]] = [arr[cellIdx], arr[selected.value]]
  pieces.value = arr
  count.value++
  selected.value = null

  if (count.value >= MAX_MOVES && !completed.value) {
    failed.value = true
    setTimeout(() => emit('correct'), 2200)
  }
}

const onVictory = () => {
  solved.value = true
  // Show complete image 2.5s then success card
  setTimeout(() => {
    completed.value = true
    setTimeout(() => emit('correct'), 2000)
  }, 2500)
}

const skip = () => {
  if (completed.value || failed.value) return
  emit('correct')
}

const movesPercent = computed(() => Math.min((count.value / MAX_MOVES) * 100, 100))
const movesOverHalf = computed(() => count.value > MAX_MOVES * 0.75)
</script>

<template>
  <BaseMission :checkpoint="checkpoint" :config="config">
    <div class="space-y-4" style="direction: ltr;">

      <!-- Instruction -->
      <p class="text-center text-slate-300 text-sm font-medium">
        {{ t('missions.puzzleMission.hint') }}
      </p>

      <!-- Moves bar -->
      <div class="space-y-1">
        <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="movesOverHalf ? 'bg-red-500' : 'bg-amber-400'"
            :style="{ width: movesPercent + '%' }"
          />
        </div>
        <div class="flex items-baseline justify-center gap-1">
          <span class="text-xl font-black tabular-nums" :class="movesOverHalf ? 'text-red-400' : 'text-white'">
            {{ count }}
          </span>
          <span class="text-slate-500 text-sm">/ {{ MAX_MOVES }}</span>
          <span class="text-slate-400 text-xs ms-1">{{ t('missions.puzzleMission.swaps') }}</span>
        </div>
      </div>

      <!-- Puzzle grid -->
      <div v-if="imageUrl" class="relative">
        <!-- Solved: show full image -->
        <div
          v-if="solved"
          class="w-full rounded-2xl overflow-hidden border-4 border-green-500"
          style="aspect-ratio:1; box-shadow: 0 0 0 4px rgba(34,197,94,0.4);"
        >
          <img :src="imageUrl" class="w-full h-full object-cover" />
        </div>

        <!-- Active puzzle grid -->
        <div
          v-else
          class="grid gap-0.5 rounded-2xl overflow-hidden"
          style="grid-template-columns: repeat(3, 1fr); aspect-ratio: 1;"
        >
          <div
            v-for="(piece, cellIdx) in pieces"
            :key="cellIdx"
            class="relative cursor-pointer transition-transform duration-100 active:scale-95"
            :class="{ 'brightness-125 ring-2 ring-amber-400 ring-inset z-10': selected === cellIdx }"
            :style="{
              backgroundImage: 'url(' + imageUrl + ')',
              backgroundSize: '300% 300%',
              backgroundPosition: bgPos(piece),
            }"
            @click="selectPiece(cellIdx)"
          >
            <!-- Selection highlight -->
            <div
              v-if="selected === cellIdx"
              class="absolute inset-0 bg-amber-400/20 pointer-events-none"
            />
            <!-- Correct indicator -->
            <div
              v-if="piece === cellIdx && !solved"
              class="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-green-400/70 pointer-events-none"
            />
          </div>
        </div>
      </div>

      <!-- No image fallback -->
      <div v-else class="aspect-square bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 text-sm">
        🧩 {{ t('missions.puzzleMission.noImage') }}
      </div>

      <!-- Skip button -->
      <button
        v-if="!completed && !failed"
        @click="skip"
        class="w-full text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
      >
        {{ t('missions.puzzleMission.skip') }}
      </button>

      <!-- ─── Success overlay ─── -->
      <Teleport to="body">
        <Transition name="overlay">
          <div v-if="completed" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
            <div class="relative bg-gradient-to-br from-green-700 to-emerald-500 rounded-3xl p-8 text-center shadow-2xl overflow-hidden max-w-xs w-full">
              <!-- Confetti dots -->
              <div class="pointer-events-none absolute inset-0">
                <span
                  v-for="n in 12" :key="n"
                  class="confetti-dot"
                  :style="{ '--i': n }"
                />
              </div>
              <div class="text-6xl mb-3">🏆</div>
              <div class="text-2xl font-black text-white mb-1">{{ t('missions.puzzleMission.bravo') }}</div>
              <div class="text-green-200 text-sm">{{ t('missions.puzzleMission.solved', { count }) }}</div>
              <div class="text-3xl font-black text-amber-300 mt-3">+{{ checkpoint.pointsCorrect ?? 100 }} pts</div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- ─── Failed overlay ─── -->
      <Teleport to="body">
        <Transition name="overlay">
          <div v-if="failed" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
            <div class="bg-slate-800 border border-slate-600 rounded-3xl p-8 text-center shadow-2xl max-w-xs w-full">
              <div class="text-6xl mb-3">💪</div>
              <div class="text-xl font-black text-white">{{ t('missions.puzzleMission.nextTime') }}</div>
            </div>
          </div>
        </Transition>
      </Teleport>

    </div>
  </BaseMission>
</template>

<style scoped>
.overlay-enter-active { transition: opacity 0.3s, transform 0.4s cubic-bezier(0.34,1.56,0.64,1); }
.overlay-enter-from { opacity: 0; transform: scale(0.7); }

.confetti-dot {
  position: absolute;
  width: 10px; height: 10px;
  border-radius: 50%;
  top: calc(50% - 5px); left: calc(50% - 5px);
  background: hsl(calc(var(--i) * 30), 100%, 65%);
  animation: confettiFly 1.4s calc(var(--i) * 0.07s) ease-out both;
  transform-origin: 5px 5px;
}

@keyframes confettiFly {
  0%   { transform: rotate(calc(var(--i) * 30deg)) translateY(0) scale(0);    opacity: 1; }
  60%  { opacity: 1; }
  100% { transform: rotate(calc(var(--i) * 30deg)) translateY(-120px) scale(1.3); opacity: 0; }
}
</style>
