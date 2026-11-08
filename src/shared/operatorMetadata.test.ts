import { describe, expect, it } from 'vitest'
import { SUBCLASS_LABELS } from './operatorMetadata'

describe('operator metadata', () => {
  it('tracks all 72 current branch labels', () => {
    expect(Object.keys(SUBCLASS_LABELS)).toHaveLength(72)
  })
})
