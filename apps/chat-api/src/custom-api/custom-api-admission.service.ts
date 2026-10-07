import { Injectable, Logger } from '@nestjs/common';

/** Hard ceiling on in-flight custom API calls across the whole BFF process. */
export const CUSTOM_API_MAX_TOTAL_IN_FLIGHT = 32;
/** Hard ceiling on in-flight custom API calls for one verified provider/subject. */
export const CUSTOM_API_MAX_PRINCIPAL_IN_FLIGHT = 4;

/**
 * Local, per-process admission control for custom API calls (see
 * openspec/changes/archive/2026-10-02-add-configured-core-api-operations/design.md §6). Bounds
 * BFF memory, not Core's own business rate quotas: no queue, no cross-replica
 * coordination. A principal's counter entry exists only while it has active
 * calls and is deleted as soon as the count returns to zero, so storage is
 * bounded by current concurrency, never by how many distinct principals have
 * ever called.
 */
@Injectable()
export class CustomApiAdmissionService {
  private readonly logger = new Logger(CustomApiAdmissionService.name);
  private totalInFlight = 0;
  private readonly principalInFlight = new Map<string, number>();

  /**
   * Attempts to reserve one in-flight slot for `principalKey`. Returns `false`
   * without reserving anything when the global or per-principal ceiling is
   * already reached — callers must return 429 and must not dispatch upstream.
   */
  tryAcquire(principalKey: string): boolean {
    if (this.totalInFlight >= CUSTOM_API_MAX_TOTAL_IN_FLIGHT) {
      this.logger.warn('Custom API global in-flight capacity exhausted');
      return false;
    }

    const current = this.principalInFlight.get(principalKey) ?? 0;
    if (current >= CUSTOM_API_MAX_PRINCIPAL_IN_FLIGHT) {
      this.logger.warn('Custom API per-principal in-flight capacity exhausted');
      return false;
    }

    this.totalInFlight += 1;
    this.principalInFlight.set(principalKey, current + 1);
    return true;
  }

  /**
   * Releases a previously acquired slot. Must run on every exit path
   * (success, error, cancellation) from a call admitted by `tryAcquire`,
   * typically from a `finally` block.
   */
  release(principalKey: string): void {
    this.totalInFlight = Math.max(0, this.totalInFlight - 1);

    const current = this.principalInFlight.get(principalKey) ?? 0;
    if (current <= 1) {
      this.principalInFlight.delete(principalKey);
    } else {
      this.principalInFlight.set(principalKey, current - 1);
    }
  }

  /** Current global in-flight count. Exposed for tests only. */
  get totalInFlightCount(): number {
    return this.totalInFlight;
  }

  /** Number of distinct principals with at least one in-flight call. Exposed for tests only. */
  get trackedPrincipalCount(): number {
    return this.principalInFlight.size;
  }
}
