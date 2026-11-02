import {
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const STREAMED_UPLOAD_CONTENT_TYPE = 'application/octet-stream';
const DECIMAL_INTEGER_PATTERN = /^\d+$/;

/**
 * Validates the headers of a raw-body upload before any body byte is read
 * and returns the declared size: `415` for a request type other than
 * `application/octet-stream` (any other type could be consumed by a body
 * parser), `411` without a decimal `Content-Length` (chunked bodies have no
 * size to forward to DIAL Core), `413` above `maxBytes`.
 */
export const readStreamedUploadSize = (
  req: Request,
  maxBytes: number,
): number => {
  const mediaType = (req.headers['content-type'] ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (mediaType !== STREAMED_UPLOAD_CONTENT_TYPE) {
    throw new UnsupportedMediaTypeException(
      `Content-Type must be ${STREAMED_UPLOAD_CONTENT_TYPE}`,
    );
  }

  const contentLength = req.headers['content-length'];
  if (
    req.headers['transfer-encoding'] != null ||
    contentLength == null ||
    !DECIMAL_INTEGER_PATTERN.test(contentLength)
  ) {
    throw new HttpException(
      'Content-Length is required',
      HttpStatus.LENGTH_REQUIRED,
    );
  }

  const size = Number(contentLength);
  if (size > maxBytes) {
    throw new PayloadTooLargeException('File too large');
  }
  return size;
};

export interface ClientDisconnectWatch {
  /** Aborts when the connection closes before the whole body has arrived. */
  signal: AbortSignal;
  dispose: () => void;
}

export const watchClientDisconnect = (req: Request): ClientDisconnectWatch => {
  const controller = new AbortController();
  const onClose = (): void => {
    if (!req.complete) {
      controller.abort();
    }
  };
  req.on('close', onClose);
  return {
    signal: controller.signal,
    dispose: () => req.off('close', onClose),
  };
};

/**
 * Answers a request whose body was not read to the end without pulling the
 * rest of it: `Connection: close` stops Node from keeping the socket for the
 * next request, and destroying the request once the response is flushed
 * stops it from draining a body that may be hundreds of megabytes.
 */
export const closeConnectionAfterResponse = (
  req: Request,
  res: Response,
): void => {
  if (req.complete || req.destroyed || res.headersSent) {
    return;
  }
  res.setHeader('Connection', 'close');
  res.once('finish', () => req.destroy());
};
