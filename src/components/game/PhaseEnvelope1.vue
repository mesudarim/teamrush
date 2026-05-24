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
  locale.value === 'en' && cp.value?.titleEn ? cp.value.titleEn : (cp.value?.title ?? 'TeamRush')
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

    <!-- Instruction above envelope -->
    <div class="text-center mb-6 animate-fade-in">
      <div class="badge-amber mb-3">
        {{ t('game.checkpoint') }} {{ game.currentIndex + 1 }} / {{ game.checkpoints.length }}
      </div>
      <Transition name="feedback" mode="out-in">
        <p v-if="!envelopeOpened" key="open" class="text-slate-300 text-base font-medium">
          {{ t('game.envelope1.openInstruction') }}
        </p>
        <p v-else key="hurry" class="text-amber-400 text-base font-black animate-pulse">
          ⚡ {{ t('game.envelope1.hurryUp') }} ⚡
        </p>
      </Transition>
    </div>

    <!-- Animated envelope -->
    <EnvelopeAnimation
      :brand-text="cp?.envelopeBrand || 'TeamRush'"
      :label="cp?.envelope1Label || ($i18n.locale === 'en' ? 'DESTINATION' : 'יעד')"
      :tap-text="t('game.envelope1.tapToOpen')"
      @opened="onEnvelopeOpened"
      class="w-full"
    >
      <!-- Content revealed after opening -->
      <div class="space-y-5 text-center">

        <!-- Destination name -->
        <div class="animate-bounce-in">
          <p class="text-amber-400/60 text-xs font-bold tracking-[0.25em] uppercase mb-1">
            {{ $i18n.locale === 'en' ? '▼ YOUR DESTINATION ▼' : '▼ היעד שלכם ▼' }}
          </p>
          <h2 class="text-amber-400 font-black leading-tight" style="font-size: clamp(1.8rem, 8vw, 2.6rem);">
            {{ title }}
          </h2>
        </div>

        <!-- Map (optional, admin-controlled) -->
        <button v-if="hasMap" @click="showMap = !showMap" class="btn-secondary w-full flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
          </svg>
          {{ showMap ? t('game.envelope1.closeMap') : t('game.envelope1.mapBtn') }}
        </button>

        <Transition name="map-slide">
          <MapView v-if="showMap && hasMap" :checkpoint="cp" class="rounded-xl overflow-hidden" />
        </Transition>

        <!-- CTA -->
        <button @click="proceed" class="btn-primary w-full py-4 text-base font-black">
          📍 {{ t('game.envelope1.arrivedBtn') }}
        </button>
      </div>
    </EnvelopeAnimation>
  </div>
</template>

<style scoped>
.map-slide-enter-active, .map-slide-leave-active { transition: all 0.3s ease; }
.map-slide-enter-from, .map-slide-leave-to { opacity: 0; transform: scaleY(0.8); transform-origin: top; }
</style>
