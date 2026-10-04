import { describe, expect, it } from 'vitest'
import {
  KERNEL_CUTOFF_BY_SERVER,
  SUBCLASS_LABELS,
  operatorEraForRelease,
} from './operatorMetadata'

describe('operator metadata', () => {
  it('tracks all 72 current branch labels', () => {
    expect(Object.keys(SUBCLASS_LABELS)).toHaveLength(72)
  })

  it('uses inclusive region-specific Kernel cutoffs', () => {
    expect(operatorEraForRelease(KERNEL_CUTOFF_BY_SERVER.global, 'global')).toBe('kernel')
    expect(operatorEraForRelease('2022-07-01', 'global')).toBe('postKernel')
    expect(operatorEraForRelease(KERNEL_CUTOFF_BY_SERVER.cn, 'cn')).toBe('kernel')
    expect(operatorEraForRelease('2022-07-06', 'cn')).toBe('postKernel')
  })
})
