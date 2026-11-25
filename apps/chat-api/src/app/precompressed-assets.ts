import { existsSync, readdirSync } from 'fs';
import { extname, join, posix, relative, sep } from 'path';
import type { RequestHandler, Response } from 'express';
import { PrecompressedContentEncoding } from '../common/types/content-encoding';
import {
  acceptedQuality,
  parseAcceptEncoding,
} from '../common/utils/accept-encoding';

/* Order of preference: Brotli is 15–25% smaller than gzip on the bundle. */
const ENCODING_SUFFIXES: ReadonlyArray<
  readonly [PrecompressedContentEncoding, string]
> = [
  [PrecompressedContentEncoding.Brotli, '.br'],
  [PrecompressedContentEncoding.Gzip, '.gz'],
];

/* `res.locals` key the rewrite leaves for `setPrecompressedHeaders`. */
const ENCODING_LOCAL = 'precompressedEncoding';

/**
 * Maps the URL path of every file under `rootPath` that has a `.br` or `.gz`
 * sibling (`/assets/index-abc.js`) to the encodings available for it. The
 * frontend build writes those siblings (`tools/vite/precompress-assets.mjs`);
 * a build without them yields an empty map, and every file is served as is.
 */
export const collectPrecompressedFiles = (
  rootPath: string,
): Map<string, Set<PrecompressedContentEncoding>> => {
  const files = new Map<string, Set<PrecompressedContentEncoding>>();
  if (!existsSync(rootPath)) return files;
  const entries = readdirSync(rootPath, {
    withFileTypes: true,
    recursive: true,
  });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = ENCODING_SUFFIXES.find(([, suffix]) =>
      entry.name.endsWith(suffix),
    );
    if (match == null) continue;
    const [encoding, suffix] = match;
    const filePath = join(entry.parentPath, entry.name);
    const urlPath =
      `/${relative(rootPath, filePath).split(sep).join('/')}`.slice(
        0,
        -suffix.length,
      );
    const encodings = files.get(urlPath) ?? new Set();
    encodings.add(encoding);
    files.set(urlPath, encodings);
  }
  return files;
};

/** Returns the preferred encoding of `available` that `acceptEncoding` allows, or `undefined` for identity. */
export const negotiatePrecompressedEncoding = (
  acceptEncoding: string | undefined,
  available: ReadonlySet<PrecompressedContentEncoding>,
): PrecompressedContentEncoding | undefined => {
  if (!acceptEncoding) return undefined;
  const codings = parseAcceptEncoding(acceptEncoding);
  return ENCODING_SUFFIXES.map(([encoding]) => encoding).find(
    (encoding) =>
      available.has(encoding) && acceptedQuality(codings, encoding) > 0,
  );
};

/**
 * Points a GET or HEAD for a file with precompressed siblings at the variant
 * the client accepts, so the `express.static` that follows sends those bytes.
 * `setPrecompressedHeaders` then labels them with the original file's type.
 * A request for a file without siblings, or from a client that accepts
 * neither encoding, is left alone. Every response for such a file varies by
 * `Accept-Encoding`, so a shared cache keeps the variants apart.
 */
export const createPrecompressedAssetMiddleware = (
  precompressed: Map<string, Set<PrecompressedContentEncoding>>,
): RequestHandler => {
  return (req, res, next) => {
    if (
      precompressed.size === 0 ||
      (req.method !== 'GET' && req.method !== 'HEAD')
    ) {
      next();
      return;
    }
    let path: string;
    try {
      path = posix.normalize(decodeURIComponent(req.path));
    } catch {
      next();
      return;
    }
    const available = precompressed.get(path);
    if (available == null) {
      next();
      return;
    }
    res.vary('Accept-Encoding');
    const encoding = negotiatePrecompressedEncoding(
      req.headers['accept-encoding'],
      available,
    );
    if (encoding != null) {
      const suffix = ENCODING_SUFFIXES.find(
        ([value]) => value === encoding,
      )?.[1];
      const queryIndex = req.url.indexOf('?');
      const query = queryIndex === -1 ? '' : req.url.slice(queryIndex);
      req.url = `${path}${suffix}${query}`;
      res.locals[ENCODING_LOCAL] = encoding;
    }
    next();
  };
};

/**
 * `express.static` `setHeaders` step for a rewritten request: sends the
 * variant with `Content-Encoding` and the original file's `Content-Type`
 * instead of the type of its `.br`/`.gz` extension.
 */
export const setPrecompressedHeaders = (
  res: Response,
  filePath: string,
): void => {
  const encoding = res.locals[ENCODING_LOCAL] as
    PrecompressedContentEncoding | undefined;
  if (encoding == null) return;
  const suffix = ENCODING_SUFFIXES.find(([value]) => value === encoding)?.[1];
  if (suffix == null || !filePath.endsWith(suffix)) return;
  res.setHeader('Content-Encoding', encoding);
  res.type(extname(filePath.slice(0, -suffix.length)));
};
