import { safeDecodeURIComponent } from './uri';

// TODO: Remove this once the DIAL SDK encodes resource path segments internally.
export const encodeDialResourcePath = (path: string): string =>
  path
    .split('/')
    .map((segment) => encodeURIComponent(safeDecodeURIComponent(segment)))
    .join('/');

/**
 * Percent-encodes a resource path whose segments are already plain text,
 * segment by segment.
 *
 * Unlike {@link encodeDialResourcePath} it does not decode first. The
 * pre-decode there exists so an already-encoded resource url can be passed
 * through idempotently, but it is lossy for a *plain* name that legitimately
 * contains a percent escape: a folder literally called `test%20folder` would
 * decode to `test folder` and reach DIAL Core as a different resource
 * (Issue #8974). Use this variant wherever the input is known to be plain —
 * a name or folder path that came off a request body, or out of DIAL Core's
 * decoded `name`/`parentPath` metadata fields.
 */
export const encodePlainDialResourcePath = (path: string): string =>
  path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
