#!/usr/bin/env node
/**
 * Walks the static import closure of one lazy chunk in a source-mapped
 * `apps/chat` build and reports the chunks and npm packages a cold load of
 * that route must download before it renders. Chunks the entry already holds
 * (the `index.html` script, its preloads and their static imports) are
 * skipped, because they are paid for anyway.
 *
 * Fails (exit 1) when a forbidden package is reachable. Build with
 * `npx vite build --sourcemap` in `apps/chat` first: packages are read from
 * each chunk's source map.
 *
 * Usage:
 *   node scripts/check-route-graph.mjs [--dist apps/chat/dist]
 *     [--chunk Conversation-] [--forbid zod,@mcp-ui/client,@modelcontextprotocol/]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export const DEFAULT_FORBIDDEN = [
  'zod',
  '@mcp-ui/client',
  '@modelcontextprotocol/',
];

/* Static `import … from "./x.js"`, side-effect `import "./x.js"` and
 * `export … from "./x.js"`; a dynamic `import("./x.js")` never matches,
 * because the quote must follow the keyword or the `from` clause. */
const STATIC_IMPORT =
  /(?:^|[^.\w$])(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?["']\.\/([^"']+\.js)["']/g;

export const readStaticImports = (code) => [
  ...new Set([...code.matchAll(STATIC_IMPORT)].map((match) => match[1])),
];

const closureOf = (assetsDir, roots, skip = new Set()) => {
  const seen = new Set();
  const stack = [...roots];
  while (stack.length > 0) {
    const file = stack.pop();
    if (seen.has(file) || skip.has(file)) continue;
    const path = join(assetsDir, file);
    if (!existsSync(path)) continue;
    seen.add(file);
    readStaticImports(readFileSync(path, 'utf8')).forEach((dep) =>
      stack.push(dep),
    );
  }
  return seen;
};

/** Returns the npm package of a source-map source path, or `null` for app code. */
export const packageOf = (source) => {
  const match = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(source);
  return match ? match[1] : null;
};

const packagesOf = (assetsDir, file) => {
  const mapPath = join(assetsDir, `${file}.map`);
  if (!existsSync(mapPath)) return null;
  const { sources = [] } = JSON.parse(readFileSync(mapPath, 'utf8'));
  return [...new Set(sources.map(packageOf).filter(Boolean))];
};

const isForbidden = (pkg, forbidden) =>
  forbidden.some((entry) =>
    entry.endsWith('/') ? pkg.startsWith(entry) : pkg === entry,
  );

/**
 * Returns the route closure report for `chunkPrefix` in `distDir`: its
 * chunks with gzip sizes and packages, and the forbidden packages found.
 */
export const checkRouteGraph = ({
  distDir,
  chunkPrefix,
  forbidden = DEFAULT_FORBIDDEN,
}) => {
  const assetsDir = join(distDir, 'assets');
  const html = readFileSync(join(distDir, 'index.html'), 'utf8');
  const entryRefs = [
    ...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g),
  ].map((match) => match[1]);
  const initial = closureOf(assetsDir, entryRefs);

  const roots = readdirSync(assetsDir).filter(
    (file) => file.startsWith(chunkPrefix) && file.endsWith('.js'),
  );
  if (roots.length === 0) {
    throw new Error(`No chunk starting with "${chunkPrefix}" in ${assetsDir}`);
  }

  const chunks = [...closureOf(assetsDir, roots, initial)].map((file) => {
    const packages = packagesOf(assetsDir, file);
    return {
      file,
      gzip: gzipSync(readFileSync(join(assetsDir, file))).length,
      packages,
      forbidden: (packages ?? []).filter((pkg) => isForbidden(pkg, forbidden)),
    };
  });
  chunks.sort((a, b) => b.gzip - a.gzip);

  return {
    roots,
    chunks,
    totalGzip: chunks.reduce((sum, chunk) => sum + chunk.gzip, 0),
    hasSourceMaps: chunks.every((chunk) => chunk.packages != null),
    forbidden: [...new Set(chunks.flatMap((chunk) => chunk.forbidden))],
  };
};

const readFlag = (args, name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};

const main = (args) => {
  const distDir = resolve(readFlag(args, 'dist', join('apps', 'chat', 'dist')));
  const chunkPrefix = readFlag(args, 'chunk', 'Conversation-');
  const forbidden = readFlag(args, 'forbid', DEFAULT_FORBIDDEN.join(','))
    .split(',')
    .filter(Boolean);

  const report = checkRouteGraph({ distDir, chunkPrefix, forbidden });
  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
  console.log(
    `${report.roots.join(', ')}: ${report.chunks.length} chunks, ${kb(report.totalGzip)} gzip beyond the entry`,
  );
  report.chunks.forEach((chunk) => {
    const flag =
      chunk.forbidden.length > 0
        ? `  FORBIDDEN: ${chunk.forbidden.join(', ')}`
        : '';
    console.log(`  ${kb(chunk.gzip).padStart(9)}  ${chunk.file}${flag}`);
  });
  if (!report.hasSourceMaps) {
    console.error('Some chunks have no source map; build with --sourcemap.');
    return 2;
  }
  if (report.forbidden.length > 0) {
    console.error(
      `Forbidden packages reachable: ${report.forbidden.join(', ')}`,
    );
    return 1;
  }
  console.log('No forbidden package reachable.');
  return 0;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.argv.slice(2));
}
