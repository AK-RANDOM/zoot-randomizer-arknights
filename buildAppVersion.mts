import { execFileSync } from 'node:child_process'
import { version } from './package.json'

function gitRevision(...args: string[]): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return undefined
  }
}

export function buildAppVersion(mode: string): string {
  const devBranch = process.env.GITHUB_REF
    ? process.env.GITHUB_REF === 'refs/heads/dev'
    : gitRevision('--symbolic-full-name', 'HEAD') === 'refs/heads/dev'
  if (mode !== 'development' && !devBranch) return version

  const commit = (process.env.GITHUB_SHA || gitRevision('HEAD'))?.slice(0, 7) ?? 'unknown'
  return version + '-dev-' + commit
}
