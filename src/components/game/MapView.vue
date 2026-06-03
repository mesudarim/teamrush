<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  checkpoint: { type: Object, required: true },
})

const mapContainer = ref(null)
let leafletMap = null

const initMap = async () => {
  if (props.checkpoint.mapType !== 'coordinates') return
  if (!mapContainer.value) return

  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  // Fix default icon paths
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })

  const lat = props.checkpoint.mapLat
  const lng = props.checkpoint.mapLng
  const zoom = props.checkpoint.mapZoom ?? 15

  leafletMap = L.map(mapContainer.value).setView([lat, lng], zoom)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
  }).addTo(leafletMap)
  L.marker([lat, lng]).addTo(leafletMap)
}

onMounted(() => { if (props.checkpoint.mapType === 'coordinates') initMap() })
onUnmounted(() => { leafletMap?.remove() })
</script>

<template>
  <div>
    <!-- Image map -->
    <div v-if="checkpoint.mapType === 'image' && checkpoint.mapImageUrl" class="relative">
      <img
        :src="checkpoint.mapImageUrl"
        alt="Map"
        class="w-full rounded-xl object-contain max-h-64"
      />
    </div>

    <!-- Leaflet map -->
    <div
      v-else-if="checkpoint.mapType === 'coordinates'"
      ref="mapContainer"
      class="w-full rounded-xl"
      style="height: 250px;"
    />
  </div>
</template>
