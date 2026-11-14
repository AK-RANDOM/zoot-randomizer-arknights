export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function checkKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: string[],
): void {
  const allowedKeys = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) errors.push(`${path}.${key} is not supported.`)
  }
}

export function validateStringList(
  value: unknown,
  path: string,
  errors: string[],
  requireValue = true,
): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`)
    return
  }
  if (requireValue && value.length === 0) errors.push(`${path} must be a non-empty array.`)
  const seen = new Set<string>()
  for (const [index, item] of value.entries()) {
    if (!nonEmptyString(item)) errors.push(`${path}[${index}] must be a non-empty string.`)
    else if (seen.has(item)) errors.push(`${path} must not contain duplicate value ${item}.`)
    else seen.add(item)
  }
}
