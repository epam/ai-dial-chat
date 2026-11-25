import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const brotliCompressAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/*
 * Text formats a browser fetches as static files. Fonts (woff2), images and
 * `.lottie` archives are already compressed; `index.html` is excluded because
 * chat-api serves it from a template with a fresh CSP nonce per response.
 */
export const PRECOMPRESSED_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.css',
  '.svg',
  '.json',
  '.wasm',
  '.txt',
]);

/* Below this size gzip saves less than one TCP packet. */
export const PRECOMPRESS_MIN_BYTES = 1024;

/* A variant that saves less than this share is not worth a second file. */
const MAX_COMPRESSED_RATIO = 0.9;

/** The encodings written next to each file, by their file suffix. */
export const PrecompressedEncoding = Object.freeze({
  Brotli: 'br',
  Gzip: 'gz',
});

const listFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name));
};

const compress = (body, encoding) =>
  encoding === PrecompressedEncoding.Brotli
    ? brotliCompressAsync(body, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
          [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
        },
      })
    : gzipAsync(body, { level: 9 });

/**
 * Writes `<file>.br` and `<file>.gz` next to every compressible file of
 * `outDir` that is at least `PRECOMPRESS_MIN_BYTES`, keeping a variant only
 * when it is under 90% of the original. Returns the number of variants
 * written and the original and Brotli byte totals.
 */
export const precompressDirectory = async (outDir) => {
  const files = (await listFiles(outDir)).filter((file) =>
    PRECOMPRESSED_EXTENSIONS.has(extname(file).toLowerCase()),
  );
  const totals = { variants: 0, originalBytes: 0, brotliBytes: 0 };
  await Promise.all(
    files.map(async (file) => {
      const body = await readFile(file);
      if (body.length < PRECOMPRESS_MIN_BYTES) return;
      totals.originalBytes += body.length;
      let brotliBytes = body.length;
      for (const encoding of Object.values(PrecompressedEncoding)) {
        const compressed = await compress(body, encoding);
        if (compressed.length > body.length * MAX_COMPRESSED_RATIO) continue;
        await writeFile(`${file}.${encoding}`, compressed);
        totals.variants += 1;
        if (encoding === PrecompressedEncoding.Brotli) {
          brotliBytes = compressed.length;
        }
      }
      totals.brotliBytes += brotliBytes;
    }),
  );
  return totals;
};

/**
 * Build-only: writes Brotli (quality 11) and gzip (level 9) copies of the
 * built text assets next to them, so chat-api serves a compressed response
 * without compressing at request time (`createPrecompressedAssetMiddleware`
 * in `apps/chat-api/src/app/precompressed-assets.ts`). It runs after the
 * bundle is written, so it sees every emitted and `public/` file.
 */
export const precompressAssetsPlugin = () => {
  let outDir;
  let logger;

  return {
    name: 'dial-precompress-assets',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      logger = config.logger;
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      handler: async () => {
        const { variants, originalBytes, brotliBytes } =
          await precompressDirectory(outDir);
        logger.info(
          `dial-precompress-assets: ${variants} variants, ${Math.round(originalBytes / 1024)} KB → ${Math.round(brotliBytes / 1024)} KB Brotli`,
        );
      },
    },
  };
};
