import { HttpException } from '@nestjs/common';

/** Non-standard "Client Closed Request" status; never reaches a client. */
export const CLIENT_CLOSED_REQUEST_STATUS = 499;

/**
 * Thrown when the caller disconnected before the work finished. The response
 * is never delivered; a typed exception keeps the global filter from logging a
 * disconnect as an unexpected error and lets controllers classify it.
 */
export class ClientClosedRequestException extends HttpException {
  constructor() {
    super('Client closed request', CLIENT_CLOSED_REQUEST_STATUS);
  }
}
