const PROFILE_AVATAR_BASE_URL =
  'https://raw.githubusercontent.com/fexli/ArknightsResource/main/avatar/DEFAULT'

const avatarCache = new Map<string, string>()

export async function getArknightsProfileAvatar(avatarId: string): Promise<string | null> {
  const cached = avatarCache.get(avatarId)
  if (cached) return cached

  try {
    const response = await fetch(
      `${PROFILE_AVATAR_BASE_URL}/${encodeURIComponent(avatarId)}.png`,
      {
        headers: { 'User-Agent': 'arknights-randomizer' },
        signal: AbortSignal.timeout(60_000),
      },
    )
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? 'image/png'
    const image = `data:${contentType};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`
    avatarCache.set(avatarId, image)
    return image
  } catch {
    return null
  }
}
