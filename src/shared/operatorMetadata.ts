import { SHARED_KERNEL_OPERATOR_IDS } from './dataCorrections.ts'
export { SUBCLASS_LABELS } from './dataCorrections.ts'
import type { Operator, ReleaseServer, StandardAcquisitionGroup } from './operator'

const KERNEL_OPERATOR_IDS_BY_SERVER: Record<ReleaseServer, ReadonlySet<string>> = {
  global: SHARED_KERNEL_OPERATOR_IDS,
  cn: SHARED_KERNEL_OPERATOR_IDS,
}

export function standardAcquisitionGroup(
  operator: Pick<Operator, 'id' | 'rarity'>,
  server: ReleaseServer,
): StandardAcquisitionGroup {
  if (operator.rarity <= 4) return 'lowRarity'
  return KERNEL_OPERATOR_IDS_BY_SERVER[server].has(operator.id) ? 'kernel' : 'postKernel'
}
