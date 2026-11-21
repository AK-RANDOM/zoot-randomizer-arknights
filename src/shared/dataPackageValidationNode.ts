import type { OperatorDataset } from './operator.ts'
import { validateDataPackageWithHash } from './dataPackageValidation.ts'
import { dataSha256 } from './dataPackageJson.ts'

export function validatePreparedDataPackage(value: unknown, previous?: OperatorDataset) {
  try {
    return validateDataPackageWithHash(value, dataSha256, previous)
  } catch {
    return { valid: false, errors: ['Malformed data package contents.'], warnings: [] as string[] }
  }
}
