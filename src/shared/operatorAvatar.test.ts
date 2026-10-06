import { describe, expect, it } from 'vitest'
import { operatorAvatarSourceFilename } from './operatorAvatar'

describe('operator avatar source filenames', () => {
  it('uses the canonical operator ID filename for normal operators and Guard Amiya', () => {
    expect(operatorAvatarSourceFilename('char_103_angel')).toBe('char_103_angel.png')
    expect(operatorAvatarSourceFilename('char_1001_amiya2')).toBe('char_1001_amiya2.png')
  })

  it('uses the playable Medic Amiya phase-2 avatar source', () => {
    expect(operatorAvatarSourceFilename('char_1037_amiya3')).toBe('char_1037_amiya3_2.png')
  })
})
