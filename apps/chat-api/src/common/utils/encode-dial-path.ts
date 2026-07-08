import { safeDecodeURIComponent } from './uri';

// TODO: Remove this once the DIAL SDK encodes resource path segments internally.
export const encodeDialResourcePath = (path: string): string =>
  path
    .split('/')
    .map((segment) => encodeURIComponent(safeDecodeURIComponent(segment)))
    .join('/');
