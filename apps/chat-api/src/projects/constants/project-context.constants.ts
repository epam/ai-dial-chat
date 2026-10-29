/** Default `PROJECT_CONTEXT_FILE_MAX_BYTES`: 1 MiB per context file. */
export const DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES = 1_048_576;

/** Default `PROJECT_CONTEXT_TOTAL_MAX_BYTES`: 10 MiB for all context files. */
export const DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES = 10_485_760;

/** Default `PROJECT_CONTEXT_ALLOWED_EXTENSIONS`. */
export const DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS = [
  'csv',
  'pdf',
  'xlsx',
];

/** One allowed extension: lower-case alphanumerics, no dot. */
export const PROJECT_CONTEXT_EXTENSION_PATTERN = /^[a-z0-9]{1,16}$/;

/*
 * Bounds the number of context files one create request may carry. A BFF
 * constant rather than an env var: at 1 MiB per file and 10 MiB in total
 * the count is not a practical operator concern, and it stays well below
 * DIAL Core's 1,000-file project limit.
 */
export const PROJECT_CONTEXT_MAX_FILES = 100;

/**
 * Parses `PROJECT_CONTEXT_ALLOWED_EXTENSIONS`: a comma-separated list,
 * trimmed, lower-cased, with a leading `.` stripped and empty entries
 * dropped. An unset or empty value yields the defaults. Entries are not
 * validated here — `EnvironmentVariables` rejects any that fail
 * `PROJECT_CONTEXT_EXTENSION_PATTERN`, so a bad list fails boot.
 */
export const parseProjectContextExtensions = (value: unknown): string[] => {
  if (Array.isArray(value)) return value as string[];
  if (value == null || value === '') {
    return [...DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS];
  }
  const parts = String(value)
    .split(',')
    .map((part) => part.trim().toLowerCase().replace(/^\./, ''))
    .filter((part) => part.length > 0);
  return parts.length > 0
    ? parts
    : [...DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS];
};

/*
 * Upper bound of a project archive the BFF buffers to read sizes and the
 * manifest: DIAL Core's own default per-project total
 * (`complexResource.types.projects`). Chat-created projects stay far below it
 * (10 MiB of context by default).
 */
export const PROJECT_ARCHIVE_READ_MAX_BYTES = 64 * 1_048_576;

/* `PROJECT.md` larger than this is treated as absent rather than inflated;
 * the instructions purpose caps the body at 32,000 characters. */
export const PROJECT_MANIFEST_MAX_BYTES = 1_048_576;

/*
 * Archive snapshot reads one BFF process runs at once; a further read waits
 * for a slot (or for its own abort). It bounds the archive bytes being
 * buffered at a time to this many × PROJECT_ARCHIVE_READ_MAX_BYTES (256 MiB
 * at the defaults), so a burst of project views cannot exhaust memory.
 * Downloads stream through and are not counted.
 */
export const PROJECT_ARCHIVE_READ_CONCURRENCY = 4;
