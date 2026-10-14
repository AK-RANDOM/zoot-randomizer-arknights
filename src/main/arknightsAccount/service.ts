import type {
  ArknightsAccountServer,
  ImportedArknightsAccount,
} from '../../shared/arknightsAccount'
import { importAccountSyncData } from './accountSnapshotService'
import { ArknightsAccountProtocol } from './protocol'
import { AccountSnapshotStore } from './snapshotStore'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface AccountSyncResult {
  snapshot: ImportedArknightsAccount
  warnings: string[]
}

export class ArknightsAccountService {
  constructor(
    private readonly store: AccountSnapshotStore,
    private readonly protocol = new ArknightsAccountProtocol(),
  ) {}

  async requestLoginCode(server: ArknightsAccountServer, email: string): Promise<void> {
    await this.protocol.requestLoginCode(server, requireEmail(email))
  }

  async syncWithEmailCode(
    server: ArknightsAccountServer,
    email: string,
    code: string,
  ): Promise<AccountSyncResult> {
    const normalizedEmail = requireEmail(email)
    const normalizedCode = requireVerificationCode(code)
    const syncData = await this.protocol.fetchSyncDataWithEmailCode(
      server,
      normalizedEmail,
      normalizedCode,
    )
    return importAccountSyncData(this.store, syncData, server)
  }

  getSnapshot(): Promise<ImportedArknightsAccount | null> {
    return this.store.load()
  }

  clearSnapshot(): Promise<void> {
    return this.store.clear()
  }
}

function requireEmail(value: string): string {
  const email = value.trim()
  if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
    throw new TypeError('Invalid YoStar account email.')
  }
  return email
}

function requireVerificationCode(value: string): string {
  const code = value.trim()
  if (!/^\d{6}$/.test(code)) throw new TypeError('Invalid YoStar verification code.')
  return code
}
