import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';

/* Mirrors `static/celebrations/` of the themes repository; every hash is real. */
const FIXTURE_ROOT = join(__dirname, 'fixtures', 'celebrations');

export const THEMES_URL = 'http://themes.test';
export const CELEBRATIONS_URL = `${THEMES_URL}/celebrations/`;

/** Returns the bytes of a fixture path relative to the celebrations directory. */
export const readFixture = (path: string): Buffer =>
  readFileSync(join(FIXTURE_ROOT, path));

/** Returns a parsed JSON fixture. */
export const readJsonFixture = <T = Record<string, unknown>>(path: string): T =>
  JSON.parse(readFixture(path).toString('utf8')) as T;

export const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

export const NEW_YEAR_MANIFEST = 'new-year-default/1.0.0/manifest.json';
export const ANNIVERSARY_MANIFEST = 'company-anniversary/1.0.0/manifest.json';

interface FixtureAsset {
  assetId: string;
  file: string;
  mediaType: string;
  bytes: number;
  sha256: string;
}

/** Returns a declared asset of a fixture manifest by its file-name stem. */
export const fixtureAsset = (manifestPath: string, stem: string) => {
  const manifest = readJsonFixture<{ assets: FixtureAsset[] }>(manifestPath);
  const asset = manifest.assets.find(({ file }) => file.startsWith(`${stem}.`));
  if (!asset) throw new Error(`No ${stem} asset in ${manifestPath}`);
  const directory = manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1);
  return { ...asset, path: `${directory}${asset.file}` };
};

/* Serves an index whose new-year entry points at a rewritten manifest, with
 * the hash and size the index must declare for it. */
export const indexWithManifest = (
  manifestPath: string,
  manifest: unknown,
  overrides: Record<string, unknown> = {},
) => {
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const index = readJsonFixture<{ packs: Record<string, unknown>[] }>(
    'index.json',
  );
  index.packs = index.packs.map((pack) =>
    pack.packId === 'new-year-default'
      ? {
          ...pack,
          manifest: {
            path: manifestPath,
            bytes: manifestBytes.length,
            sha256: sha256(manifestBytes),
          },
        }
      : pack,
  );
  return {
    'index.json': JSON.stringify({ ...index, ...overrides }),
    [manifestPath]: manifestBytes,
  };
};

/** What the fake themes host answers for one path: bytes, a status, or a thrown error. */
export type FakeUpstreamAnswer = Uint8Array | string | Response | Error;

/**
 * Replaces `fetch` with a themes host that serves the fixture tree. `answers`
 * overrides individual paths (relative to the celebrations directory); every
 * other path is read from the fixtures, and a missing file answers 404.
 */
export const mockThemesHost = (
  answers: Record<string, FakeUpstreamAnswer | (() => FakeUpstreamAnswer)> = {},
) => {
  const requests: string[] = [];
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input) => {
      const url = String(input);
      requests.push(url);
      const path = url.startsWith(CELEBRATIONS_URL)
        ? url.slice(CELEBRATIONS_URL.length)
        : url;
      const configured = answers[path];
      const answer =
        typeof configured === 'function' ? configured() : configured;
      if (answer instanceof Error) throw answer;
      if (answer instanceof Response) return answer;
      if (answer !== undefined) return new Response(answer);
      try {
        return new Response(readFixture(path));
      } catch {
        return new Response('not found', { status: 404 });
      }
    });
  return { fetchMock, requests };
};

/** A `ConfigService` stub that reads the given environment. */
export const configWith = (
  env: Partial<EnvironmentVariables>,
): ConfigService<EnvironmentVariables> =>
  ({
    get: (key: keyof EnvironmentVariables) => env[key],
  }) as unknown as ConfigService<EnvironmentVariables>;

/** The default environment: the fake themes host and a 5 s timeout. */
export const THEMES_ENV: Partial<EnvironmentVariables> = {
  THEMES_CONFIG_URL: THEMES_URL,
  THEMES_SERVICE_TIMEOUT_MS: 5000,
};
