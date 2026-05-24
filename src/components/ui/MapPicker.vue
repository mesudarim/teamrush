<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  lat: { type: [Number, String], default: 31.7683 },
  lng: { type: [Number, String], default: 35.2137 },
  zoom: { type: [Number, String], default: 13 },
})

const emit = defineEmits(['update:lat', 'update:lng', 'update:zoom'])

const mapContainer = ref(null)
let leafletMap = null
let marker = null

onMounted(async () => {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })

  const initLat = Number(props.lat) || 31.7683
  const initLng = Number(props.lng) || 35.2137
  const initZoom = Number(props.zoom) || 13

  leafletMap = L.map(mapContainer.value).setView([initLat, initLng], initZoom)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(leafletMap)

  // Place initial marker if coords are set
  if (props.lat && props.lng) {
    marker = L.marker([initLat, initLng]).addTo(leafletMap)
  }

  // Click to place/move marker
  leafletMap.on('click', (e) => {
    const { lat, lng } = e.latlng
    if (marker) {
      marker.setLatLng([lat, lng])
    } else {
      marker = L.marker([lat, lng]).addTo(leafletMap)
    }
    emit('update:lat', parseFloat(lat.toFixed(6)))
    emit('update:lng', parseFloat(lng.toFixed(6)))
  })

  // Track zoom changes
  leafletMap.on('zoomend', () => {
    emit('update:zoom', leafletMap.getZoom())
  })
})

// If parent updates lat/lng externally, move the marker
watch([() => props.lat, () => props.lng], ([newLat, newLng]) => {
  if (!leafletMap || !newLat || !newLng) return
  const lat = Number(newLat)
  const lng = Number(newLng)
  if (marker) {
    marker.setLatLng([lat, lng])
  }
  leafletMap.setView([lat, lng], leafletMap.getZoom())
})

onUnmounted(() => { leafletMap?.remove() })
</script>

<template>
  <div class="space-y-2">
    <!-- Instruction -->
    <p class="text-xs text-slate-400 flex items-center gap-1.5">
      <svg class="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
      </svg>
      Cliquez sur la carte pour placer le marqueur
    </p>

    <!-- Map -->
    <div
      ref="mapContainer"
      class="w-full rounded-xl border-2 border-slate-600 overflow-hidden"
      style="height: 320px; cursor: crosshair;"
    />

    <!-- Coords display -->
    <div class="flex gap-3 text-xs">
      <div class="flex-1 bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-700 font-mono">
        <span class="text-slate-500">Lat </span>
        <span :class="lat ? 'text-amber-400' : 'text-slate-600'">{{ lat || '—' }}</span>
      </div>
      <div class="flex-1 bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-700 font-mono">
        <span class="text-slate-500">Lng </span>
        <span :class="lng ? 'text-amber-400' : 'text-slate-600'">{{ lng || '—' }}</span>
      </div>
      <div class="bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-700 font-mono">
        <span class="text-slate-500">Zoom </span>
        <span class="text-slate-300">{{ zoom }}</span>
      </div>
    </div>
  </div>
</template>
