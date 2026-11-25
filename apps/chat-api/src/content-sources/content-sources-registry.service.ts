import { posix } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/environment.config';
import {
  ContentSourcePathError,
  normalizeContentPath,
} from './content-sources-path';

export enum ContentSourceProvider {
  GitHub = 'github',
  GitLab = 'gitlab',
}

export enum ContentSourceKind {
  File = 'file',
  Directory = 'directory',
}

export enum ContentSourceSort {
  NameDesc = 'name-desc',
  NameAsc = 'name-asc',
  DateDesc = 'date-desc',
}

export enum ContentSourceDateMode {
  Created = 'created',
  Updated = 'updated',
  None = 'none',
}

export interface ContentSourceFeed {
  readonly summaryHeading?: string;
}

/** One validated, defaulted source. `token` is resolved server-side only. */
export interface ContentSource {
  readonly id: string;
  readonly title: string;
  readonly provider: ContentSourceProvider;
  /** https origin without trailing slash. */
  readonly baseUrl: string;
  readonly repository: string;
  readonly ref: string;
  readonly kind: ContentSourceKind;
  /** Normalized repository-relative path of the file or root folder. */
  readonly path: string;
  readonly include: string;
  /** Normalized repository-relative folder assets may be read from. */
  readonly assetsPath: string;
  readonly sort: ContentSourceSort;
  readonly date: ContentSourceDateMode;
  readonly feed: ContentSourceFeed;
  /** Validated, non-secret credential id; keys the upstream pool only, never logged. */
  readonly credentialId?: string;
  readonly token?: string;
}

export const CONTENT_SOURCES_CONFIG_MAX_BYTES = 64 * 1024;
export const CONTENT_SOURCES_MAX_SOURCES = 64;
export const CONTENT_SOURCES_MAX_DOCUMENTS = 200;
export const CONTENT_SOURCES_MAX_DOCUMENT_BYTES = 1024 * 1024;
export const CONTENT_SOURCES_MAX_ASSET_BYTES = 10 * 1024 * 1024;
/** Documents and assets above this size are served without being cached. */
export const CONTENT_SOURCES_MAX_CACHED_ENTRY_BYTES = 512 * 1024;
export const CONTENT_SOURCES_DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;
export const CONTENT_SOURCES_DEFAULT_TIMEOUT_MS = 10_000;
export const CONTENT_SOURCES_DEFAULT_UPSTREAM_CONCURRENCY = 8;
export const CONTENT_SOURCES_DEFAULT_UPSTREAM_QUEUE_SIZE = 64;
export const CONTENT_SOURCES_DEFAULT_PRINCIPAL_MISS_CONCURRENCY = 8;
export const GITHUB_DEFAULT_BASE_URL = 'https://api.github.com';
export const DEFAULT_INCLUDE_GLOB = '**/*.md';

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CREDENTIAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const GITLAB_REPOSITORY_PATTERN =
  /^(?:\d+|[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+)$/;
const REF_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_./-]{0,255}$/;
const TITLE_MAX_LENGTH = 200;
const SUMMARY_HEADING_MAX_LENGTH = 100;
const INCLUDE_MAX_LENGTH = 200;

const ALLOWED_ROOT_KEYS = new Set(['version', 'sources']);
const ALLOWED_SOURCE_KEYS = new Set([
  'id',
  'title',
  'provider',
  'baseUrl',
  'repository',
  'ref',
  'kind',
  'path',
  'include',
  'assetsPath',
  'sort',
  'date',
  'feed',
  'credentialId',
]);
const ALLOWED_FEED_KEYS = new Set(['summaryHeading']);

/** Thrown only with field-identifying messages — never with raw config. */
export class ContentSourcesConfigError extends Error {}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertNoUnknownKeys = (
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  context: string,
): void => {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new ContentSourcesConfigError(
        `${context} has an unknown field "${key}"`,
      );
    }
  }
};

const parseEnum = <T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
  fallback?: T,
): T => {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new ContentSourcesConfigError(
      `${field} must be one of ${values.join(', ')}`,
    );
  }
  return value as T;
};

const parsePlainText = (
  value: unknown,
  field: string,
  maxLength: number,
): string => {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maxLength ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f<>]/.test(value)
  ) {
    throw new ContentSourcesConfigError(
      `${field} must be plain text of at most ${maxLength} characters`,
    );
  }
  return value.trim();
};

const parseConfigPath = (value: unknown, field: string): string => {
  if (typeof value !== 'string') {
    throw new ContentSourcesConfigError(`${field} must be a string`);
  }
  /* An empty string denotes the repository root for a directory source. */
  if (value === '' || value === '.') return '';
  try {
    return normalizeContentPath(value);
  } catch (error) {
    if (error instanceof ContentSourcePathError) {
      throw new ContentSourcesConfigError(`${field} is an invalid path`);
    }
    throw error;
  }
};

const parseBaseUrl = (
  value: unknown,
  provider: ContentSourceProvider,
  field: string,
): string => {
  if (value === undefined && provider === ContentSourceProvider.GitHub) {
    return GITHUB_DEFAULT_BASE_URL;
  }
  if (typeof value !== 'string') {
    throw new ContentSourcesConfigError(`${field} is required for gitlab`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ContentSourcesConfigError(`${field} must be an https origin`);
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '') ||
    value.replace(/\/$/, '') !== url.origin
  ) {
    throw new ContentSourcesConfigError(`${field} must be an https origin`);
  }
  return url.origin;
};

const parseFeed = (value: unknown, context: string): ContentSourceFeed => {
  if (value === undefined) return {};
  if (!isPlainObject(value)) {
    throw new ContentSourcesConfigError(`${context}.feed must be an object`);
  }
  assertNoUnknownKeys(value, ALLOWED_FEED_KEYS, `${context}.feed`);
  if (value.summaryHeading === undefined) return {};
  return {
    summaryHeading: parsePlainText(
      value.summaryHeading,
      `${context}.feed.summaryHeading`,
      SUMMARY_HEADING_MAX_LENGTH,
    ),
  };
};

const parseSource = (
  entry: unknown,
  index: number,
  credentials: ReadonlyMap<string, string>,
): ContentSource => {
  const context = `sources[${index}]`;
  if (!isPlainObject(entry)) {
    throw new ContentSourcesConfigError(`${context} must be an object`);
  }
  assertNoUnknownKeys(entry, ALLOWED_SOURCE_KEYS, context);

  if (typeof entry.id !== 'string' || !ID_PATTERN.test(entry.id)) {
    throw new ContentSourcesConfigError(`${context}.id is invalid`);
  }
  const provider = parseEnum(
    entry.provider,
    Object.values(ContentSourceProvider),
    `${context}.provider`,
  );
  const kind = parseEnum(
    entry.kind,
    Object.values(ContentSourceKind),
    `${context}.kind`,
  );

  const repositoryPattern =
    provider === ContentSourceProvider.GitHub
      ? GITHUB_REPOSITORY_PATTERN
      : GITLAB_REPOSITORY_PATTERN;
  if (
    typeof entry.repository !== 'string' ||
    !repositoryPattern.test(entry.repository) ||
    entry.repository.split('/').some((part) => part === '.' || part === '..')
  ) {
    throw new ContentSourcesConfigError(`${context}.repository is invalid`);
  }
  if (
    typeof entry.ref !== 'string' ||
    !REF_PATTERN.test(entry.ref) ||
    entry.ref.includes('..')
  ) {
    throw new ContentSourcesConfigError(`${context}.ref is invalid`);
  }

  const path = parseConfigPath(entry.path, `${context}.path`);
  if (kind === ContentSourceKind.File && path === '') {
    throw new ContentSourcesConfigError(
      `${context}.path is required for a file source`,
    );
  }

  const include =
    entry.include === undefined ? DEFAULT_INCLUDE_GLOB : entry.include;
  if (
    typeof include !== 'string' ||
    include.length === 0 ||
    include.length > INCLUDE_MAX_LENGTH ||
    include.includes('\\') ||
    include.startsWith('/') ||
    include.split('/').includes('..')
  ) {
    throw new ContentSourcesConfigError(`${context}.include is invalid`);
  }

  let assetsPath: string;
  if (entry.assetsPath !== undefined) {
    assetsPath = parseConfigPath(entry.assetsPath, `${context}.assetsPath`);
  } else if (kind === ContentSourceKind.Directory) {
    assetsPath = path;
  } else {
    assetsPath = parseConfigPath(posix.dirname(path), `${context}.path`);
  }

  let token: string | undefined;
  if (entry.credentialId !== undefined) {
    if (
      typeof entry.credentialId !== 'string' ||
      !CREDENTIAL_ID_PATTERN.test(entry.credentialId)
    ) {
      throw new ContentSourcesConfigError(`${context}.credentialId is invalid`);
    }
    token = credentials.get(entry.credentialId);
    if (token === undefined) {
      throw new ContentSourcesConfigError(
        `${context}.credentialId references a credential that is not configured`,
      );
    }
  }

  return {
    id: entry.id,
    title: parsePlainText(entry.title, `${context}.title`, TITLE_MAX_LENGTH),
    provider,
    baseUrl: parseBaseUrl(entry.baseUrl, provider, `${context}.baseUrl`),
    repository: entry.repository,
    ref: entry.ref,
    kind,
    path,
    include,
    assetsPath,
    sort: parseEnum(
      entry.sort,
      Object.values(ContentSourceSort),
      `${context}.sort`,
      ContentSourceSort.NameAsc,
    ),
    date: parseEnum(
      entry.date,
      Object.values(ContentSourceDateMode),
      `${context}.date`,
      ContentSourceDateMode.None,
    ),
    feed: parseFeed(entry.feed, context),
    ...(token === undefined
      ? {}
      : { credentialId: entry.credentialId as string, token }),
  };
};

/** Parses CONTENT_SOURCES_CREDENTIALS into an id → token map. */
export const parseContentSourcesCredentials = (
  raw: string | undefined,
): ReadonlyMap<string, string> => {
  const value = raw?.trim();
  if (!value) return new Map();

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ContentSourcesConfigError(
      'CONTENT_SOURCES_CREDENTIALS is malformed JSON',
    );
  }
  if (!isPlainObject(parsed)) {
    throw new ContentSourcesConfigError(
      'CONTENT_SOURCES_CREDENTIALS must be a JSON object',
    );
  }
  const credentials = new Map<string, string>();
  for (const [id, token] of Object.entries(parsed)) {
    if (
      !CREDENTIAL_ID_PATTERN.test(id) ||
      typeof token !== 'string' ||
      token.trim().length === 0 ||
      // eslint-disable-next-line no-control-regex
      /[\r\n\u0000]/.test(token)
    ) {
      throw new ContentSourcesConfigError(
        'CONTENT_SOURCES_CREDENTIALS has an invalid entry',
      );
    }
    credentials.set(id, token.trim());
  }
  return credentials;
};

/**
 * Parses CONTENT_SOURCES_CONFIG into an id-keyed source map. Unset, empty or
 * whitespace-only input yields an empty registry. Every other failure throws
 * `ContentSourcesConfigError` with a field-identifying message only.
 */
export const parseContentSourcesRegistry = (
  raw: string | undefined,
  credentials: ReadonlyMap<string, string> = new Map(),
): ReadonlyMap<string, ContentSource> => {
  const value = raw?.trim();
  if (!value) return new Map();

  if (Buffer.byteLength(value, 'utf8') > CONTENT_SOURCES_CONFIG_MAX_BYTES) {
    throw new ContentSourcesConfigError(
      `CONTENT_SOURCES_CONFIG exceeds the ${CONTENT_SOURCES_CONFIG_MAX_BYTES}-byte limit`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ContentSourcesConfigError(
      'CONTENT_SOURCES_CONFIG is malformed JSON',
    );
  }
  if (!isPlainObject(parsed)) {
    throw new ContentSourcesConfigError(
      'CONTENT_SOURCES_CONFIG root must be a JSON object',
    );
  }
  assertNoUnknownKeys(parsed, ALLOWED_ROOT_KEYS, 'root');
  if (parsed.version !== 1) {
    throw new ContentSourcesConfigError('version must equal 1');
  }
  if (!Array.isArray(parsed.sources)) {
    throw new ContentSourcesConfigError('sources must be an array');
  }
  if (parsed.sources.length > CONTENT_SOURCES_MAX_SOURCES) {
    throw new ContentSourcesConfigError(
      `sources exceeds the ${CONTENT_SOURCES_MAX_SOURCES}-entry limit`,
    );
  }

  const sources = new Map<string, ContentSource>();
  parsed.sources.forEach((entry, index) => {
    const source = parseSource(entry, index, credentials);
    if (sources.has(source.id)) {
      throw new ContentSourcesConfigError(
        `sources[${index}].id "${source.id}" is a duplicate`,
      );
    }
    sources.set(source.id, source);
  });
  return sources;
};

/**
 * Immutable, server-only registry of content sources, parsed once at startup
 * from CONTENT_SOURCES_CONFIG and CONTENT_SOURCES_CREDENTIALS. Construction
 * throws on any invalid value, which fails Nest bootstrap.
 */
@Injectable()
export class ContentSourcesRegistryService {
  private readonly logger = new Logger(ContentSourcesRegistryService.name);
  private readonly sources: ReadonlyMap<string, ContentSource>;
  readonly cacheTtlMs: number;
  readonly timeoutMs: number;
  /** Concurrent upstream calls per `baseUrl` + `credentialId` pool. */
  readonly upstreamConcurrency: number;
  /** Upstream calls that may wait for a slot per pool. */
  readonly upstreamQueueSize: number;
  /** Concurrent requests per user that start upstream work. */
  readonly principalMissConcurrency: number;

  constructor(configService: ConfigService<EnvironmentVariables>) {
    try {
      this.sources = parseContentSourcesRegistry(
        configService.get('CONTENT_SOURCES_CONFIG', { infer: true }),
        parseContentSourcesCredentials(
          configService.get('CONTENT_SOURCES_CREDENTIALS', { infer: true }),
        ),
      );
    } catch (error) {
      const reason =
        error instanceof ContentSourcesConfigError
          ? error.message
          : 'content sources configuration failed to parse';
      /* Never log the raw values or `error` itself: parser errors may quote them. */
      this.logger.error(reason);
      throw new Error(reason);
    }
    this.cacheTtlMs =
      configService.get('CONTENT_SOURCES_CACHE_TTL_MS', { infer: true }) ??
      CONTENT_SOURCES_DEFAULT_CACHE_TTL_MS;
    this.timeoutMs =
      configService.get('CONTENT_SOURCES_TIMEOUT_MS', { infer: true }) ??
      CONTENT_SOURCES_DEFAULT_TIMEOUT_MS;
    this.upstreamConcurrency =
      configService.get('CONTENT_SOURCES_UPSTREAM_CONCURRENCY', {
        infer: true,
      }) ?? CONTENT_SOURCES_DEFAULT_UPSTREAM_CONCURRENCY;
    this.upstreamQueueSize =
      configService.get('CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE', {
        infer: true,
      }) ?? CONTENT_SOURCES_DEFAULT_UPSTREAM_QUEUE_SIZE;
    this.principalMissConcurrency =
      configService.get('CONTENT_SOURCES_PRINCIPAL_MISS_CONCURRENCY', {
        infer: true,
      }) ?? CONTENT_SOURCES_DEFAULT_PRINCIPAL_MISS_CONCURRENCY;

    this.logger.log(
      `Content sources registry initialized with ${this.sources.size} source(s)`,
    );
  }

  get(id: string): ContentSource | undefined {
    return this.sources.get(id);
  }
}
