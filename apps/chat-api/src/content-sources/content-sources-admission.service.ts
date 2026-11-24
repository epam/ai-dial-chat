import { Injectable, Logger } from '@nestjs/common';

/** Hard ceiling on in-flight content-source requests across the whole process. */
export const CONTENT_SOURCES_MAX_TOTAL_IN_FLIGHT = 32;
/** Hard ceiling on in-flight content-source requests for one verified user. */
export const CONTENT_SOURCES_MAX_PRINCIPAL_IN_FLIGHT = 4;

/**
 * Local, per-process admission control, modelled on CustomApiAdmissionService.
 * Bounds upstream fan-out and memory, not the hosting provider's own quotas:
 * no queue, no cross-replica coordination. A principal's counter exists only
 * while it has active requests, so storage is bounded by current concurrency.
 */
@Injectable()
export class ContentSourcesAdmissionService {
  private readonly logger = new Logger(ContentSourcesAdmissionService.name);
  private totalInFlight = 0;
  private readonly principalInFlight = new Map<string, number>();

  /** Reserves one slot, or returns false without reserving when a ceiling is reached. */
  tryAcquire(principalKey: string): boolean {
    if (this.totalInFlight >= CONTENT_SOURCES_MAX_TOTAL_IN_FLIGHT) {
      this.logger.warn('Content sources global in-flight capacity exhausted');
      return false;
    }
    const current = this.principalInFlight.get(principalKey) ?? 0;
    if (current >= CONTENT_SOURCES_MAX_PRINCIPAL_IN_FLIGHT) {
      this.logger.warn(
        'Content sources per-principal in-flight capacity exhausted',
      );
      return false;
    }
    this.totalInFlight += 1;
    this.principalInFlight.set(principalKey, current + 1);
    return true;
  }

  /** Releases a slot acquired by `tryAcquire`; call from a `finally`. */
  release(principalKey: string): void {
    this.totalInFlight = Math.max(0, this.totalInFlight - 1);
    const current = this.principalInFlight.get(principalKey) ?? 0;
    if (current <= 1) {
      this.principalInFlight.delete(principalKey);
    } else {
      this.principalInFlight.set(principalKey, current - 1);
    }
  }

  get totalInFlightCount(): number {
    return this.totalInFlight;
  }

  get trackedPrincipalCount(): number {
    return this.principalInFlight.size;
  }
}
