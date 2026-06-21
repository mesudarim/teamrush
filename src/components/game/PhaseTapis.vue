<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'
import { useSound } from '@/composables/useSound'
import QrScanner from '@/components/ui/QrScanner.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const { t, locale } = useI18n()
const game = useGameStore()
const auth = useAuthStore()
const { playCorrect, playWrong } = useSound()

const isDay2 = computed(() => (auth.team?.day ?? 1) === 2)

const instruction = computed(() => {
  const s = game.gameSettings
  if (isDay2.value) {
    if (locale.value === 'en' && s.tapisInstructionEnDay2) return s.tapisInstructionEnDay2
    return s.tapisInstructionDay2 || t('game.tapis.instruction')
  }
  if (locale.value === 'en' && s.tapisInstructionEn) return s.tapisInstructionEn
  return s.tapisInstruction || t('game.tapis.instruction')
})

const bravoVideoUrl = computed(() => {
  const s = game.gameSettings
  return isDay2.value ? (s.tapisVideoUrlDay2 ?? '') : (s.tapisVideoUrl ?? '')
})

const showScanner = ref(false)
const scanned = ref(false)
const scanOk = ref(false)
const showBravoVideo = ref(false)
const completing = ref(false)
const manualInput = ref('')

const allowManual = computed(() => !!game.gameSettings?.tapisManualEntry)

const onQrDecoded = async (value) => {
  showScanner.value = false
  const ok = game.validateTapis(value)
  scanned.value = true
  scanOk.value = ok
  if (ok) {
    playCorrect()
    if (embedUrl.value) {
      // Valid YouTube URL found — show video overlay
      showBravoVideo.value = true
    } else {
      // No video configured (or unrecognised URL) — go straight to score
      completing.value = true
      await game.completeTapis()
      completing.value = false
    }
  } else {
    playWrong()
    setTimeout(() => { scanned.value = false }, 2200)
  }
}

const finishAfterVideo = async () => {
  completing.value = true
  await game.completeTapis()
  completing.value = false
  showBravoVideo.value = false
}

// Build embeddable URL from any YouTube link
const embedUrl = computed(() => {
  const url = bravoVideoUrl.value
  if (!url) return ''
  // youtu.be short links
  const shortLinkMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]+)/)
  if (shortLinkMatch) return `https://www.youtube.com/embed/${shortLinkMatch[1]}?autoplay=1&playsinline=1&rel=0`
  // youtube.com/shorts/
  const shortsMatch = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]+)/)
  if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}?autoplay=1&playsinline=1&rel=0`
  // youtube.com/watch?v=
  const watchMatch = url.match(/[?&]v=([A-Za-z0-9_-]+)/)
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1&playsinline=1&rel=0`
  // already an embed URL
  if (url.includes('youtube.com/embed/')) return url
  return ''  // unrecognised format → skip video
})
</script>

<template>
  <!-- Single root required for Vue <Transition mode="out-in"> to work correctly -->
  <div class="flex-1 flex flex-col">

  <!-- ── Bravo video fullscreen overlay ── -->
  <Teleport to="body">
    <div v-if="showBravoVideo" class="fixed inset-0 z-50 bg-black flex flex-col">
      <!-- Loading state: Firestore finishing, phase about to change -->
      <template v-if="completing">
        <div class="flex-1 flex flex-col items-center justify-center gap-4">
          <LoadingSpinner size="lg" />
          <p class="text-white text-sm opacity-70">{{ t('common.loading') }}</p>
        </div>
      </template>
      <!-- Video + button state -->
      <template v-else>
        <iframe
          :src="embedUrl"
          class="flex-1 w-full border-0"
          allow="autoplay; fullscreen; playsinline"
          allowfullscreen
        />
        <div class="shrink-0 p-4 bg-black">
          <button
            @click="finishAfterVideo"
            class="btn-primary w-full py-4 text-lg font-bold"
          >
            {{ t('game.tapis.continueAfterVideo') }}
          </button>
        </div>
      </template>
    </div>
  </Teleport>

  <div class="flex-1 flex flex-col items-center justify-center p-4 max-w-sm mx-auto w-full">
    <div class="w-full animate-slide-up space-y-6">

      <!-- Banner card (blue/gold) -->
      <div class="tapis-card relative overflow-hidden rounded-2xl w-full">
        <div class="tapis-bg absolute inset-0" />
        <div class="tapis-gold absolute top-0 left-0 right-0 z-10" style="height: 14%;" />
        <div class="tapis-gold absolute bottom-0 left-0 right-0 z-10" style="height: 14%;" />
        <div class="relative z-20 flex flex-col items-center justify-center py-10 px-5 gap-4"
             style="min-height: 160px;">
          <span class="tapis-label">{{ t('game.tapis.title') }}</span>
          <div class="tapis-badge-outer">
            <div class="tapis-badge-inner">
              <span class="tapis-badge-text">{{ t('app.name') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Instruction + scan button -->
      <div class="card space-y-5">
        <div class="text-center space-y-2">
          <div class="w-14 h-14 mx-auto rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-3xl">
            🏁
          </div>
          <p class="text-slate-200 text-base font-semibold leading-snug whitespace-pre-line">{{ instruction }}</p>
        </div>

        <!-- Feedback after scan -->
        <Transition name="feedback">
          <div v-if="scanned"
               :class="['flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold',
                 scanOk ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                        : 'bg-red-500/15 border border-red-500/30 text-red-400']">
            {{ scanOk ? '✅' : '❌' }}
            {{ scanOk ? t('game.tapis.correct') : t('game.tapis.wrong') }}
          </div>
        </Transition>

        <!-- QR scan button -->
        <button
          @click="showScanner = true"
          :disabled="scanOk || completing"
          class="btn-primary w-full py-5 flex items-center justify-center gap-3 text-base"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
          </svg>
          {{ t('game.tapis.scanBtn') }}
        </button>

        <p class="text-center text-xs text-slate-500">{{ t('game.tapis.scanHint') }}</p>

        <!-- Manual entry (test mode) -->
        <template v-if="allowManual">
          <div class="border-t border-slate-700 pt-4 space-y-2">
            <p class="text-xs text-amber-400/80 text-center font-semibold">🧪 Mode test</p>
            <input
              v-model="manualInput"
              type="text"
              class="input-field text-center font-bold tracking-widest"
              placeholder="Entrez le code..."
              @keyup.enter="onQrDecoded(manualInput)"
              :disabled="scanOk || completing"
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            />
            <button
              @click="onQrDecoded(manualInput)"
              :disabled="!manualInput.trim() || scanOk || completing"
              class="btn-secondary w-full"
            >
              Envoyer
            </button>
          </div>
        </template>
      </div>

    </div>

    <!-- QR Scanner overlay -->
    <QrScanner v-if="showScanner" @decoded="onQrDecoded" @close="showScanner = false" />
  </div>

  </div><!-- end single root wrapper -->
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@700;900&display=swap');

.tapis-card {
  aspect-ratio: 2.2 / 1;
  box-shadow: 0 20px 60px rgba(6, 24, 80, 0.7), 0 4px 16px rgba(0,0,0,0.4);
  border-radius: 1rem;
}
.tapis-bg {
  background: radial-gradient(ellipse at 50% 35%, #3d72d8 0%, #1e4dbf 35%, #0e2e90 65%, #071a60 100%);
}
.tapis-gold {
  background: linear-gradient(180deg, #ffe84d 0%, #f5a500 55%, #e09000 100%);
}
.tapis-label {
  font-family: 'Rubik', 'Arial Black', Arial, sans-serif;
  font-weight: 900;
  font-size: clamp(2rem, 9vw, 3rem);
  color: #ffe033;
  line-height: 1;
  letter-spacing: 0.03em;
  text-shadow: 0 3px 0 rgba(100, 50, 0, 0.7), 0 6px 16px rgba(0, 0, 0, 0.55);
}
.tapis-badge-outer {
  background: #ffffff;
  clip-path: polygon(16px 0%, calc(100% - 16px) 0%, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0% 50%);
  padding: 3px;
}
.tapis-badge-inner {
  background: #cc0010;
  clip-path: polygon(13px 0%, calc(100% - 13px) 0%, 100% 50%, calc(100% - 13px) 100%, 13px 100%, 0% 50%);
  padding: 4px 18px;
  min-width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tapis-badge-text {
  font-family: 'Rubik', 'Arial Black', Arial, sans-serif;
  font-weight: 900;
  font-size: clamp(0.5rem, 2vw, 0.7rem);
  color: #ffffff;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.feedback-enter-active, .feedback-leave-active { transition: all 0.3s; }
.feedback-enter-from, .feedback-leave-to { opacity: 0; transform: translateY(-5px); }
</style>
