import { posix } from 'node:path';

/** Thrown for a request path that is syntactically unsafe. Maps to HTTP 400. */
export class ContentSourcePathError extends Error {}

/**
 * Normalizes an untrusted repository-relative path. The input is the value the
 * framework already URL-decoded once, so it is taken literally: a `%` is part
 * of a file name, never an escape. Rejects empty, absolute, backslash, NUL and
 * control-character input and any `..` that escapes the repository root. The
 * result never starts with `/`, `./` or `..` and has no empty segments.
 */
export const normalizeContentPath = (raw: string): string => {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new ContentSourcePathError('path is required');
  }
  if (
    raw.includes('\\') ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f]/.test(raw)
  ) {
    throw new ContentSourcePathError('path contains forbidden characters');
  }
  if (raw.startsWith('/')) {
    throw new ContentSourcePathError('path must be relative');
  }

  const normalized = posix.normalize(raw);
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.startsWith('/')
  ) {
    throw new ContentSourcePathError('path escapes the repository root');
  }

  return normalized.replace(/\/+$/, '');
};

/**
 * True when `path` equals `root` or lies strictly beneath it. Both arguments
 * are already-normalized repository-relative paths; an empty `root` means the
 * repository root.
 */
export const isWithinRoot = (path: string, root: string): boolean =>
  root === '' || path === root || path.startsWith(`${root}/`);

const GLOB_SPECIAL = /[.+^$()|[\]\\{}]/g;

/**
 * Compiles an `include` glob into an anchored RegExp over a path relative to
 * the source root. Supports `*` (within a segment), `?`, `**` (any depth;
 * a leading double-star segment also matches no directory), and `{a,b}` alternation. Dotfiles
 * are matched like any other file. Deliberately small: no character classes,
 * no negation.
 */
export const compileIncludeGlob = (glob: string): RegExp => {
  let pattern = '';
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index];
    if (char === '*') {
      if (glob[index + 1] === '*') {
        const followedBySlash = glob[index + 2] === '/';
        pattern += followedBySlash ? '(?:.*/)?' : '.*';
        index += followedBySlash ? 2 : 1;
      } else {
        pattern += '[^/]*';
      }
    } else if (char === '?') {
      pattern += '[^/]';
    } else if (char === '{') {
      const end = glob.indexOf('}', index);
      if (end === -1) {
        pattern += '\\{';
      } else {
        const options = glob
          .slice(index + 1, end)
          .split(',')
          .map((option) => option.replace(GLOB_SPECIAL, '\\$&'));
        pattern += `(?:${options.join('|')})`;
        index = end;
      }
    } else {
      pattern += char.replace(GLOB_SPECIAL, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`);
};

/** Path of `path` relative to `root` (an empty root is the repository root). */
export const relativeToRoot = (path: string, root: string): string =>
  root === '' ? path : path.slice(root.length + 1);
