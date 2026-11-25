import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ContentSourcesRegistryService } from './content-sources-registry.service';

export const CONTENT_SOURCES_TOO_MANY_REQUESTS_MESSAGE =
  'Too many concurrent content-source requests';

/** A 429 because the user already has too many requests doing upstream work. */
export class ContentSourcesMissLimitException extends HttpException {
  constructor() {
    super(
      CONTENT_SOURCES_TOO_MANY_REQUESTS_MESSAGE,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/** One request's claim on its user's cache-miss allowance. */
export interface ContentSourcesAdmissionLease {
  /**
   * Takes the request's one slot the first time it is called; a no-op after
   * that and after `release`. Throws `ContentSourcesMissLimitException` when
   * the user already holds every slot.
   */
  ensure(): void;
  /** Frees the slot if one was taken; idempotent. Call from a `finally`. */
  release(): void;
}

/**
 * Per-user fairness for upstream work, local to the process. A request takes
 * a slot only when it starts a cache load (the loader runs), so fresh hits
 * and requests that join another request's load never count, and a listing's
 * nested loads count once. Upstream concurrency itself is bounded by the pool
 * gates of `ContentSourcesUpstreamService`. A principal's counter exists only
 * while it holds slots, so storage is bounded by current concurrency.
 */
@Injectable()
export class ContentSourcesAdmissionService {
  private readonly logger = new Logger(ContentSourcesAdmissionService.name);
  private readonly inFlight = new Map<string, number>();

  constructor(private readonly registry: ContentSourcesRegistryService) {}

  lease(principalKey: string): ContentSourcesAdmissionLease {
    let isHeld = false;
    let isReleased = false;
    return {
      ensure: () => {
        if (isHeld || isReleased) return;
        const current = this.inFlight.get(principalKey) ?? 0;
        if (current >= this.registry.principalMissConcurrency) {
          this.logger.warn(
            'Content sources per-principal cache-miss capacity exhausted',
          );
          throw new ContentSourcesMissLimitException();
        }
        this.inFlight.set(principalKey, current + 1);
        isHeld = true;
      },
      release: () => {
        if (isReleased) return;
        isReleased = true;
        if (!isHeld) return;
        isHeld = false;
        const current = this.inFlight.get(principalKey) ?? 0;
        if (current <= 1) {
          this.inFlight.delete(principalKey);
        } else {
          this.inFlight.set(principalKey, current - 1);
        }
      },
    };
  }

  get trackedPrincipalCount(): number {
    return this.inFlight.size;
  }
}
