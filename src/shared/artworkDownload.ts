export const MAX_ARTWORK_BYTES = 24 * 1024 * 1024
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  return value >>> 0
})

/** Check complete PNG chunk structure and CRCs before a file becomes reusable cache data. */
export function validArtworkPng(data: Uint8Array): boolean {
  if (
    data.length < 57 ||
    [137, 80, 78, 71, 13, 10, 26, 10].some((byte, index) => data[index] !== byte)
  )
    return false
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 8,
    imageData = false,
    first = true
  while (offset + 12 <= data.length) {
    const length = view.getUint32(offset)
    if (length > data.length - offset - 12) return false
    const type = String.fromCharCode(...data.subarray(offset + 4, offset + 8))
    if (
      first &&
      (type !== 'IHDR' ||
        length !== 13 ||
        !view.getUint32(offset + 8) ||
        !view.getUint32(offset + 12) ||
        view.getUint32(offset + 8) > 32768 ||
        view.getUint32(offset + 12) > 32768)
    )
      return false
    first = false
    let crc = 0xffffffff
    for (let index = offset + 4; index < offset + 8 + length; index++) {
      crc = CRC_TABLE[(crc ^ data[index]) & 255] ^ (crc >>> 8)
    }
    if ((crc ^ 0xffffffff) >>> 0 !== view.getUint32(offset + 8 + length)) return false
    if (type === 'IDAT') imageData = true
    offset += length + 12
    if (type === 'IEND') return length === 0 && imageData && offset === data.length
  }
  return false
}

export async function fetchArtworkBytes(
  url: string,
  options: {
    signal: AbortSignal
    fetchImpl?: typeof fetch
    attempts?: number
    retryDelayMs?: number
  },
): Promise<
  | { status: 'downloaded'; bytes: Uint8Array }
  | { status: 'unavailable' | 'failed'; message: string }
> {
  const attempts = options.attempts ?? 3
  for (let attempt = 0; attempt < attempts; attempt++) {
    options.signal.throwIfAborted()
    try {
      const response = await (options.fetchImpl ?? fetch)(url, {
        signal: AbortSignal.any([options.signal, AbortSignal.timeout(60_000)]),
      })
      if (response.status === 404 || response.status === 410)
        return { status: 'unavailable', message: `HTTP ${response.status}` }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error('Empty artwork response')
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = []
      let length = 0
      try {
        for (;;) {
          const part = await reader.read()
          if (part.done) break
          length += part.value.length
          if (length > MAX_ARTWORK_BYTES) throw new Error('Artwork exceeds its size limit')
          chunks.push(part.value)
        }
      } catch (error) {
        await reader.cancel().catch(() => undefined)
        throw error
      } finally {
        reader.releaseLock()
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      if (!validArtworkPng(bytes)) throw new Error('Invalid or incomplete PNG')
      options.signal.throwIfAborted()
      return { status: 'downloaded', bytes }
    } catch (error) {
      options.signal.throwIfAborted()
      if (attempt === attempts - 1)
        return { status: 'failed', message: error instanceof Error ? error.message : String(error) }
      await new Promise<void>((accept, reject) => {
        const finish = () => {
          options.signal.removeEventListener('abort', cancel)
          accept()
        }
        const timer = setTimeout(finish, (options.retryDelayMs ?? 300) * (attempt + 1))
        const cancel = () => {
          clearTimeout(timer)
          options.signal.removeEventListener('abort', cancel)
          reject(options.signal.reason)
        }
        options.signal.addEventListener('abort', cancel, { once: true })
        if (options.signal.aborted) cancel()
      })
    }
  }
  return { status: 'failed', message: 'Artwork unavailable' }
}
