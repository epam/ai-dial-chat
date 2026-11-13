/*
 * How many storage paths a create-only request tries before giving up with
 * 409: the original `name__version`, then `name-2__version` up to this count.
 * Applications and toolsets share the limit so the two stay in step.
 */
export const MAX_CREATE_PATH_ATTEMPTS = 20;

/** Separates a resource's name from its version in its storage path. */
export const RESOURCE_VERSION_SEPARATOR = '__';

/**
 * Plain (not encoded) last path segment of the `attempt`-th (1-based)
 * create-only candidate: `name__version`, then `name-2__version`, and so on.
 * A storage path never follows a later rename, so a path can be held by an
 * entity the user now sees under another name; the next candidate leaves that
 * entity untouched.
 * @param name - displayed name the caller supplied
 * @param version - version the entity is written with
 * @param attempt - 1-based candidate number
 */
export const buildNextFreeLeaf = (
  name: string,
  version: string,
  attempt: number,
): string => {
  const baseName = attempt === 1 ? name : `${name}-${attempt}`;
  return `${baseName}${RESOURCE_VERSION_SEPARATOR}${version}`;
};
