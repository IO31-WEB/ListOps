/**
 * Server-side age / terms gate. UI redirects are convenience only — THIS is the enforcement,
 * and it is called by every route that creates content or spends money.
 */
import { ApiError } from '@/lib/api-utils'

export function assertAdult(user: { ageConfirmedAt?: Date | null; ageBlockedAt?: Date | null; deletedAt?: Date | null }): void {
  if (user.deletedAt) throw new ApiError(403, 'This account has been closed.')
  if (user.ageBlockedAt) throw new ApiError(403, 'This account is not eligible to use ListOps.')
  if (!user.ageConfirmedAt) {
    throw new ApiError(403, 'Please confirm you are 18 or older and accept the Terms to continue.')
  }
}
