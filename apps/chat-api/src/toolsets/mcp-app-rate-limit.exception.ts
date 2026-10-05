import { HttpException, HttpStatus } from '@nestjs/common';

/** DIAL Core rate-limited an MCP App request; carries a validated retry delay. */
export class McpAppRateLimitException extends HttpException {
  /** Valid delay-seconds or normalized HTTP date; omitted for invalid/missing headers. */
  readonly retryAfter?: string;

  constructor(retryAfter: string | null) {
    super('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
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
