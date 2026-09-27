/* The workspace root manifest is the only one the release pipeline stamps
 * (`npm version <next> --no-git-tag-version` at the repo root, before the image
 * is built); every `apps/*` and `libs/*` manifest keeps its scaffold version
 * forever, so reading this project's own `package.json` reported `0.0.1` on
 * every deployment that did not set `CHAT_VERSION`. Nx's boundary rule polices
 * cross-project *source* imports; this reads build metadata, not another
 * project's code. */
// eslint-disable-next-line @nx/enforce-module-boundaries
import { version } from '../../../../../package.json';

/**
 * Version of the running build, taken from the workspace root `package.json`.
 *
 * Imported statically (`resolveJsonModule`) rather than read from disk at
 * runtime: the value is inlined by the bundler, so it does not depend on the
 * `src` vs `dist` directory layout and cannot silently degrade to a
 * placeholder when a path guess misses.
 */
export const PACKAGE_VERSION: string = version;

/**
 * Single precedence rule for the version string this service reports.
 * A CI/CD-stamped override (`CHAT_VERSION`, or the `app.version` config key
 * that reads it) wins; a missing or blank override falls back to
 * {@link PACKAGE_VERSION}, so the result is never empty.
 *
 * Every surface that exposes a version — the client config response, the
 * `%%VERSION%%` footer token, `GET /health` — must resolve it through here so
 * a deployment cannot report two different versions on two endpoints.
 */
export const resolveAppVersion = (override?: string | null): string => {
  const trimmed = override?.trim();
  return trimmed ? trimmed : PACKAGE_VERSION;
};
