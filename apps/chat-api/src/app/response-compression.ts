import compression from 'compression';
import type { Request, RequestHandler, Response } from 'express';
import { isResponseCompressionSkipped } from '../common/utils/compression-passthrough';

/**
 * Content types the BFF compresses: JSON and `+json` media types. Everything
 * else passes through as it is, notably `text/event-stream` (a compressed
 * stream would wait for the compressor's buffer to fill before a chunk
 * reaches the browser), proxied files and the frontend's static assets.
 */
const JSON_CONTENT_TYPE = /^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i;

/**
 * Bodies under this size go out as they are: below one TCP packet, gzip
 * saves nothing and only costs CPU.
 */
export const RESPONSE_COMPRESSION_THRESHOLD_BYTES = 1024;

/**
 * Whether `res` is a JSON body worth compressing. A proxied DIAL Core file
 * (marked by `pipeWebBody`) passes through even when it is a `.json` file,
 * keeping its upstream bytes and `Content-Length`. A ranged response is left
 * alone because compressing it would invalidate its `Content-Range`. A body
 * the handler already encoded (the celebration assets) is skipped by
 * `compression` itself.
 */
export const shouldCompressResponse = (
  req: Request,
  res: Response,
): boolean => {
  if (isResponseCompressionSkipped(res)) return false;
  const contentType = res.getHeader('Content-Type');
  if (typeof contentType !== 'string' || !JSON_CONTENT_TYPE.test(contentType)) {
    return false;
  }
  if (res.getHeader('Content-Range') != null) return false;
  return compression.filter(req, res);
};

/**
 * Compresses JSON API responses with Brotli (quality 4), gzip or deflate, as
 * the request's `Accept-Encoding` allows. The model, toolset and prompt lists
 * the chat loads on every page are megabytes of JSON, and gzip alone shrinks
 * them 3–15×.
 */
export const createResponseCompressionMiddleware = (): RequestHandler =>
  compression({
    filter: shouldCompressResponse,
    threshold: RESPONSE_COMPRESSION_THRESHOLD_BYTES,
  });
