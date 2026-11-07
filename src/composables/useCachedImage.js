import { ref, watch, onMounted } from 'vue'
import { resolveImage } from '@/utils/imageCache'

// Returns a reactive URL that is the cached version (base64) when available,
// or the original URL when not yet cached / network available.
export function useCachedImage(urlRef) {
  const src = ref(typeof urlRef === 'string' ? urlRef : urlRef?.value ?? '')

  async function update(url) {
    if (!url) { src.value = ''; return }
    src.value = await resolveImage(url)
  }

  onMounted(() => update(typeof urlRef === 'string' ? urlRef : urlRef?.value))

  if (typeof urlRef !== 'string') {
    watch(urlRef, (url) => update(url))
  }

  return src
}
