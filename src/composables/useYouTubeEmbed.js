import { computed } from 'vue'

export function useYouTubeEmbed(urlRef) {
  return computed(() => {
    const url = typeof urlRef === 'function' ? urlRef() : urlRef?.value
    if (!url) return null
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([^&\n?#]+)/)
    if (!match) return null
    return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`
  })
}
