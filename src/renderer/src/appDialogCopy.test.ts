import { describe, expect, it } from 'vitest'
import { resolveAppDialogCopy } from './appDialogCopy'

describe('app dialog headings', () => {
  it('promotes the first line without duplicating it in the content', () => {
    expect(
      resolveAppDialogCopy(
        'Invalid operator release range\n\nThe maximum bound is earlier.\nAdjust a bound.',
      ),
    ).toEqual({
      title: 'Invalid operator release range',
      message: 'The maximum bound is earlier.\nAdjust a bound.',
    })
  })

  it('preserves explicit titles and content for single-line confirmations', () => {
    expect(
      resolveAppDialogCopy({
        title: 'Delete preset “Test”?',
        message: 'Delete “Test” from your saved presets.',
      }),
    ).toEqual({
      title: 'Delete preset “Test”?',
      message: 'Delete “Test” from your saved presets.',
    })
  })
})
