const DB_NAME    = 'teamrush-images'
const STORE_NAME = 'images'
const DB_VERSION = 1
const MAX_WIDTH  = 1200
const QUALITY    = 0.75

let _db = null

function openDB() {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME)
    req.onsuccess = e => { _db = e.target.result; resolve(_db) }
    req.onerror   = e => reject(e.target.error)
  })
}

async function idbGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = e => resolve(e.target.result ?? null)
    req.onerror   = e => reject(e.target.error)
  })
}

async function idbSet(key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror   = e => reject(e.target.error)
  })
}

async function fetchAndResize(url) {
  const res  = await fetch(url, { cache: 'no-store' })
  const blob = await res.blob()

  if (!blob.type.startsWith('image/')) {
    // Non-image (audio, video, etc.) — store as-is base64
    return await blobToBase64(blob)
  }

  const bitmap = await createImageBitmap(blob)
  const scale  = Math.min(1, MAX_WIDTH / bitmap.width)
  const w = Math.round(bitmap.width  * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = new OffscreenCanvas(w, h)
  const ctx    = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const resized = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY })
  return await blobToBase64(resized)
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result)
    reader.onerror = e => reject(e)
    reader.readAsDataURL(blob)
  })
}

// Cache one image URL → returns the base64 data URL
export async function cacheImage(url) {
  if (!url || !url.startsWith('http')) return null
  try {
    const existing = await idbGet(url)
    if (existing) return existing
    const data = await fetchAndResize(url)
    await idbSet(url, data)
    return data
  } catch (e) {
    console.warn('[imageCache] Failed to cache', url, e)
    return null
  }
}

// Get cached version or null
export async function getCachedImage(url) {
  if (!url) return null
  try { return await idbGet(url) } catch { return null }
}

// Returns cached base64 if available, otherwise the original URL
export async function resolveImage(url) {
  if (!url) return url
  const cached = await getCachedImage(url)
  return cached ?? url
}

// Pre-cache all image URLs from a list of checkpoints
export async function precacheCheckpoints(checkpoints, onProgress) {
  const IMAGE_FIELDS = ['stage1ImageUrl', 'imageUrl', 'puzzleImageUrl', 'mapImageUrl']
  const urls = []
  for (const cp of checkpoints) {
    for (const field of IMAGE_FIELDS) {
      const url = cp[field]
      if (url && url.startsWith('http')) urls.push(url)
    }
    // Questions inside checkpoint (MissingWord)
    for (const q of (cp.questions ?? [])) {
      if (q.imageUrl?.startsWith('http')) urls.push(q.imageUrl)
    }
  }

  const unique = [...new Set(urls)]
  let done = 0
  for (const url of unique) {
    await cacheImage(url)
    done++
    onProgress?.(done, unique.length)
  }
  return unique.length
}

export async function clearImageCache() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).clear()
    req.onsuccess = () => resolve()
    req.onerror   = e => reject(e.target.error)
  })
}
