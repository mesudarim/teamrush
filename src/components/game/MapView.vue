<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  checkpoint: { type: Object, required: true },
})

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
let tileLayer  = null

const initMap = async () => {
  if (props.checkpoint.mapType !== 'coordinates') return
  if (!mapContainer.value) return

  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })

  const lat  = props.checkpoint.mapLat
  const lng  = props.checkpoint.mapLng
  const zoom = props.checkpoint.mapZoom ?? 15
  const type = props.checkpoint.mapTileType ?? 'street'
  const cfg  = TILES[type] ?? TILES.street

  leafletMap = L.map(mapContainer.value).setView([lat, lng], zoom)
  tileLayer  = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19 }).addTo(leafletMap)
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
