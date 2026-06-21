<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import EnvelopeAnimation from './EnvelopeAnimation.vue'
import MapView from './MapView.vue'

const { t, locale } = useI18n()
const game = useGameStore()

const envelopeOpened = ref(false)
const showMap = ref(false)

const cp = computed(() => game.currentCheckpoint)
const title = computed(() =>
  locale.value === 'en' && cp.value?.titleEn ? cp.value.titleEn : (cp.value?.title ?? t('app.name'))
)
const description = computed(() =>
  locale.value === 'en' && cp.value?.descriptionEn ? cp.value.descriptionEn : cp.value?.description ?? ''
)
const hasMap = computed(() => {
  if (cp.value?.showMap === false) return false
  return cp.value?.mapType === 'image' ? !!cp.value.mapImageUrl : !!(cp.value?.mapLat && cp.value?.mapLng)
})

const onEnvelopeOpened = () => { envelopeOpened.value = true }
const proceed = () => game.openEnvelope1()
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-sm mx-auto">

    <!-- Checkpoint counter above envelope -->
    <div class="text-center mb-4 animate-fade-in">
      <div class="badge-amber" style="font-size: 1rem; padding: 0.4rem 1rem;">
        {{ t('game.checkpoint') }} {{ game.currentIndex + 1 }} / {{ game.checkpoints.length }}
      </div>
    </div>

    <!-- Animated envelope — always flip so the back reveal is coordinated -->
    <EnvelopeAnimation
      :brand-text="cp?.envelopeBrand || t('app.name')"
      :label="cp?.envelope1Label || ($i18n.locale === 'en' ? 'DESTINATION' : 'יעד')"
      :tap-text="t('game.envelope1.tapToOpen')"
      :always-flip="true"
      :flip-reveal="true"
      @opened="onEnvelopeOpened"
      class="w-full"
    >
      <!-- ── Back of the envelope ── -->
      <div class="space-y-4">

        <!-- Card: same style as the front but showing the destination -->
        <div class="env-back relative overflow-hidden w-full" style="aspect-ratio: 1.9 / 1;">
          <!-- Blue gradient -->
          <div class="env-back-bg absolute inset-0" />
          <!-- Gold bands -->
          <div class="env-back-gold absolute top-0 left-0 right-0 z-10" style="height: 15%;" />
          <div class="env-back-gold absolute bottom-0 left-0 right-0 z-10" style="height: 15%;" />
          <!-- Content -->
          <div class="absolute z-20 inset-0 flex flex-col items-center justify-center px-4"
               style="top: 15%; bottom: 15%;">
            <p class="env-back-sub">
              {{ $i18n.locale === 'en' ? '▼ YOUR DESTINATION ▼' : '▼ היעד שלכם ▼' }}
            </p>
            <h2 class="env-back-title">{{ title }}</h2>
            <p v-if="description" class="env-back-desc">{{ description }}</p>
          </div>
        </div>

        <!-- Map (optional) -->
        <button v-if="hasMap" @click="showMap = !showMap"
                class="btn-secondary w-full flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
          </svg>
          {{ showMap ? t('game.envelope1.closeMap') : t('game.envelope1.mapBtn') }}
        </button>

        <Transition name="map-slide">
          <MapView v-if="showMap && hasMap" :checkpoint="cp" class="rounded-xl overflow-hidden" />
        </Transition>

        <!-- CTA -->
        <button @click="proceed" class="btn-primary w-full py-4 text-xl font-bold">
          📍 {{ t('game.envelope1.arrivedBtn') }}
        </button>
      </div>
    </EnvelopeAnimation>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@700;900&display=swap');

/* ── Back-of-envelope card ── */
.env-back {
  border-radius: 1rem;
  box-shadow: 0 20px 60px rgba(6, 24, 80, 0.7), 0 4px 16px rgba(0,0,0,0.4);
}
.env-back-bg {
  background: radial-gradient(ellipse at 50% 65%, #3d72d8 0%, #1e4dbf 35%, #0e2e90 65%, #071a60 100%);
}
.env-back-gold {
  background: linear-gradient(180deg, #ffe84d 0%, #f5a500 55%, #e09000 100%);
}
.env-back-sub {
  font-family: 'Rubik', 'Arial Black', Arial, sans-serif;
  font-weight: 700;
  font-size: clamp(0.55rem, 2vw, 0.7rem);
  color: rgba(255, 224, 51, 0.65);
  letter-spacing: 0.2em;
  margin-bottom: 4px;
  text-align: center;
}
.env-back-title {
  font-family: 'Rubik', 'Arial Black', Arial, sans-serif;
  font-weight: 900;
  font-size: clamp(1.5rem, 7vw, 2.4rem);
  color: #ffe033;
  line-height: 1.05;
  text-align: center;
  text-shadow: 0 3px 0 rgba(100, 50, 0, 0.7), 0 6px 16px rgba(0, 0, 0, 0.55);
}
.env-back-desc {
  font-family: 'Rubik', 'Segoe UI', Arial, sans-serif;
  font-weight: 700;
  font-size: clamp(0.85rem, 3.5vw, 1.05rem);
  color: rgba(255, 255, 255, 0.88);
  text-align: center;
  margin-top: 4px;
  line-height: 1.3;
}

.map-slide-enter-active, .map-slide-leave-active { transition: all 0.3s ease; }
.map-slide-enter-from, .map-slide-leave-to { opacity: 0; transform: scaleY(0.8); transform-origin: top; }
</style>
