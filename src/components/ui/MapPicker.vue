<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  lat:      { type: [Number, String], default: 31.7683 },
  lng:      { type: [Number, String], default: 35.2137 },
  zoom:     { type: [Number, String], default: 13 },
  tileType: { type: String, default: 'street' },  // 'street' | 'satellite'
})

const emit = defineEmits(['update:lat', 'update:lng', 'update:zoom', 'update:tileType'])

const TILES = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Maxar, GeoEye, Earthstar Geographics',
  },
}

const mapContainer = ref(null)
let leafletMap = null
let marker     = null
let tileLayer  = null
let L          = null

const setTileLayer = (type) => {
  if (!leafletMap || !L) return
  if (tileLayer) { tileLayer.remove(); tileLayer = null }
  const cfg = TILES[type] ?? TILES.street
  tileLayer = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19 }).addTo(leafletMap)
}

onMounted(async () => {
  L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })

  const initLat  = Number(props.lat)  || 31.7683
  const initLng  = Number(props.lng)  || 35.2137
  const initZoom = Number(props.zoom) || 13

  leafletMap = L.map(mapContainer.value).setView([initLat, initLng], initZoom)
  setTileLayer(props.tileType)

  if (props.lat && props.lng) {
    marker = L.marker([initLat, initLng]).addTo(leafletMap)
  }

  leafletMap.on('click', (e) => {
    const { lat, lng } = e.latlng
    if (marker) { marker.setLatLng([lat, lng]) }
    else         { marker = L.marker([lat, lng]).addTo(leafletMap) }
    emit('update:lat', parseFloat(lat.toFixed(6)))
    emit('update:lng', parseFloat(lng.toFixed(6)))
  })

  leafletMap.on('zoomend', () => {
    emit('update:zoom', leafletMap.getZoom())
  })
})

watch([() => props.lat, () => props.lng], ([newLat, newLng]) => {
  if (!leafletMap || !newLat || !newLng) return
  const lat = Number(newLat), lng = Number(newLng)
  if (marker) { marker.setLatLng([lat, lng]) }
  leafletMap.setView([lat, lng], leafletMap.getZoom())
})

watch(() => props.tileType, (type) => setTileLayer(type))

onUnmounted(() => { leafletMap?.remove() })

const onManualLat = (val) => {
  const v = parseFloat(val)
  if (!isNaN(v)) emit('update:lat', parseFloat(v.toFixed(6)))
}
const onManualLng = (val) => {
  const v = parseFloat(val)
  if (!isNaN(v)) emit('update:lng', parseFloat(v.toFixed(6)))
}
const switchTile = (type) => emit('update:tileType', type)
</script>

<template>
  <div class="space-y-2">

    <!-- Manual coords input -->
    <div class="flex gap-2">
      <div class="flex-1">
        <label class="block text-xs text-slate-500 mb-1">{{ t('admin.checkpoints.mapLat') }}</label>
        <input
          :value="lat || ''"
          @change="onManualLat($event.target.value)"
          type="number" step="0.000001"
          :placeholder="t('admin.checkpoints.mapLatPlaceholder')"
          class="input-field text-sm py-1.5 font-mono w-full"
        />
      </div>
      <div class="flex-1">
        <label class="block text-xs text-slate-500 mb-1">{{ t('admin.checkpoints.mapLng') }}</label>
        <input
          :value="lng || ''"
          @change="onManualLng($event.target.value)"
          type="number" step="0.000001"
          :placeholder="t('admin.checkpoints.mapLngPlaceholder')"
          class="input-field text-sm py-1.5 font-mono w-full"
        />
      </div>
    </div>

    <!-- Tile type toggle + hint -->
    <div class="flex items-center justify-between">
      <p class="text-xs text-slate-400 flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
        </svg>
        {{ t('admin.checkpoints.mapPickerHint') }}
      </p>

      <!-- Street / Satellite toggle -->
      <div class="flex rounded-lg overflow-hidden border border-slate-600 shrink-0">
        <button
          v-for="type in ['street', 'satellite']"
          :key="type"
          @click="switchTile(type)"
          :class="['px-3 py-1 text-xs font-semibold transition-colors',
            tileType === type
              ? 'bg-amber-500 text-slate-900'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600']"
        >
          {{ type === 'street' ? t('admin.checkpoints.mapTileStreet') : t('admin.checkpoints.mapTileSatellite') }}
        </button>
      </div>
    </div>

    <!-- Map -->
    <div
      ref="mapContainer"
      class="w-full rounded-xl border-2 border-slate-600 overflow-hidden"
      style="height: 300px; cursor: crosshair;"
    />

    <!-- Zoom -->
    <div class="flex justify-end">
      <div class="bg-slate-900/60 rounded-lg px-3 py-1.5 border border-slate-700 font-mono text-xs">
        <span class="text-slate-500">{{ t('admin.checkpoints.mapZoom') }} </span>
        <span class="text-slate-300">{{ zoom }}</span>
      </div>
    </div>
  </div>
</template>
