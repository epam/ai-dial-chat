import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';
import type { Request, Response } from 'express';
import {
  acceptedQuality,
  parseAcceptEncoding,
} from '../common/utils/accept-encoding';
import {
  CELEBRATION_SVG_CONTENT_SECURITY_POLICY,
  GZIP_LEVEL,
} from './constants/celebrations.constants';
import {
  CelebrationContentEncoding,
  CelebrationMediaType,
} from './types/celebration';

const brotliCompressAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/* Lottie JSON and SVG compress 5–8×; PNG and WebP are already compressed. */
const COMPRESSIBLE_MEDIA_TYPES = new Set<string>([
  CelebrationMediaType.Json,
  CelebrationMediaType.Svg,
]);

/**
 * Returns the encoding to serve: `br` when the client accepts it, else `gzip`,
 * else `undefined` for identity. PNG and WebP are always identity.
 */
export const negotiateCelebrationEncoding = (
  acceptEncoding: string | undefined,
  mediaType: string,
): CelebrationContentEncoding | undefined => {
  if (!acceptEncoding || !COMPRESSIBLE_MEDIA_TYPES.has(mediaType)) {
    return undefined;
  }
  const codings = parseAcceptEncoding(acceptEncoding);
  if (acceptedQuality(codings, CelebrationContentEncoding.Brotli) > 0) {
    return CelebrationContentEncoding.Brotli;
  }
  if (acceptedQuality(codings, CelebrationContentEncoding.Gzip) > 0) {
    return CelebrationContentEncoding.Gzip;
  }
  return undefined;
};

/** Returns `true` when a response of this media type varies by `Accept-Encoding`. */
export const isCompressibleCelebrationMediaType = (mediaType: string) =>
  COMPRESSIBLE_MEDIA_TYPES.has(mediaType);

/** Compresses a body off the event loop with Node `zlib`. */
export const compressCelebrationBody = async (
  body: Buffer,
  encoding: CelebrationContentEncoding,
  brotliQuality: number,
): Promise<Buffer> =>
  encoding === CelebrationContentEncoding.Brotli
    ? brotliCompressAsync(body, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: brotliQuality,
          [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
        },
      })
    : gzipAsync(body, { level: GZIP_LEVEL });

/** A celebrations response body and how to compress it. */
export interface CelebrationResponseBody {
  /** Identity bytes. */
  body: Buffer;
  /** Media type served as `Content-Type`. */
  mediaType: string;
  /** `Cache-Control` value. */
  cacheControl: string;
  /** Returns the body in the negotiated encoding. */
  encode: (encoding: CelebrationContentEncoding) => Promise<Buffer>;
}

const contentType = (mediaType: string) =>
  mediaType === CelebrationMediaType.Json
    ? `${mediaType}; charset=utf-8`
    : mediaType;

/**
 * Sends a celebrations body with its negotiated `Content-Encoding`, `Vary`,
 * `Cache-Control`, `nosniff` and, for SVG, the sandboxing CSP. Express adds
 * the `ETag` and answers a matching `If-None-Match` with `304`.
 */
export const sendCelebrationResponse = async (
  request: Request,
  response: Response,
  { body, mediaType, cacheControl, encode }: CelebrationResponseBody,
): Promise<void> => {
  const encoding = negotiateCelebrationEncoding(
    request.headers['accept-encoding'],
    mediaType,
  );
  /* Compressed before any header is set, so a failure leaves the error
   * response free of this body's headers. */
  const payload = encoding ? await encode(encoding) : body;
  response.setHeader('Content-Type', contentType(mediaType));
  response.setHeader('Cache-Control', cacheControl);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (isCompressibleCelebrationMediaType(mediaType)) {
    response.setHeader('Vary', 'Accept-Encoding');
  }
  if (mediaType === CelebrationMediaType.Svg) {
    response.setHeader(
      'Content-Security-Policy',
      CELEBRATION_SVG_CONTENT_SECURITY_POLICY,
    );
  }
  if (encoding) response.setHeader('Content-Encoding', encoding);
  response.send(payload);
};
