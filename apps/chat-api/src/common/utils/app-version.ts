import packageJson from '../../../package.json';

/**
 * Version of the running build, taken from `apps/chat-api/package.json`.
 *
 * Imported statically (`resolveJsonModule`) rather than read from disk at
 * runtime: the value is inlined by the bundler, so it does not depend on the
 * `src` vs `dist` directory layout and cannot silently degrade to a
 * placeholder when a path guess misses.
 */
export const PACKAGE_VERSION: string = packageJson.version;

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
