import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { validateOperatorDataset } from '../src/shared/operatorData.ts'

const path = join(
  process.cwd(),
  'resources',
  'bundled-data',
  'operators',
  'operators.json',
)
const dataset = JSON.parse(await readFile(path, 'utf8')) as unknown
const result = validateOperatorDataset(dataset, { requireSourceCommits: true })

for (const warning of result.warnings) console.warn('Warning:', warning)

if (!result.valid) {
  for (const error of result.errors) console.error('Error:', error)
  process.exitCode = 1
} else {
  const operators = (dataset as { operators: unknown[] }).operators.length
  console.log('Bundled operator dataset valid:', operators, 'operators')
}
