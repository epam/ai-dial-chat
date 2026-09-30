import { HttpException, HttpStatus } from '@nestjs/common';

/** Scheduler rate-limit error carrying a validated HTTP retry delay. */
export class ScheduledTaskRateLimitException extends HttpException {
  /** Valid delay-seconds or normalized HTTP date; omitted for invalid/missing headers. */
  readonly retryAfter?: string;

  constructor(response: string | object, retryAfter: string | null) {
    super(response, HttpStatus.TOO_MANY_REQUESTS);
    if (!retryAfter) return;
    const value = retryAfter.trim();
    if (/^\d+$/.test(value)) {
      this.retryAfter = value;
    } else {
      const timestamp = Date.parse(value);
      if (Number.isFinite(timestamp)) {
        this.retryAfter = new Date(timestamp).toUTCString();
      }
    }
  }
}
