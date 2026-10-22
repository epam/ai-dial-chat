import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/environment.config';

/** The HTTP methods an operation may be configured with. */
export enum CustomApiMethod {
  Get = 'GET',
  Post = 'POST',
  Put = 'PUT',
  Delete = 'DELETE',
}

/** What an operation accepts as a request body. */
export enum CustomApiBody {
  None = 'none',
  Json = 'json',
}

/** One allowlisted Core call. See CUSTOM_CORE_API_CONFIG in environment.config.ts. */
export interface CustomApiOperation {
  readonly id: string;
  readonly method: CustomApiMethod;
  readonly corePath: string;
  /** Query parameter names the caller may pass, in the order they are forwarded. */
  readonly query: readonly string[];
  readonly body: CustomApiBody;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
}

/** Hard ceiling for the raw CUSTOM_CORE_API_CONFIG value, measured as UTF-8 bytes. */
export const CUSTOM_API_CONFIG_MAX_BYTES = 16 * 1024;
/** Hard ceiling for the number of configured operations. */
export const CUSTOM_API_MAX_OPERATIONS = 64;
/** Deadline of an entry without `timeoutMs`. */
export const CUSTOM_API_DEFAULT_TIMEOUT_MS = 10_000;
/*
 * Hard ceiling for an entry's explicit `timeoutMs`. Above the default so one
 * named operation (a repository clone behind a Core Route) can opt in; every
 * other entry keeps the 10 s default.
 */
export const CUSTOM_API_MAX_TIMEOUT_MS = 300_000;
/** Hard ceiling an entry's optional `maxResponseBytes` may only lower, never exceed. */
export const CUSTOM_API_MAX_RESPONSE_BYTES = 1_048_576;
/** Hard ceiling for the number of query parameter names one entry may allow. */
export const CUSTOM_API_MAX_QUERY_NAMES = 16;

const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const QUERY_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const METHODS: ReadonlySet<string> = new Set(Object.values(CustomApiMethod));
const BODY_METHODS: ReadonlySet<CustomApiMethod> = new Set([
  CustomApiMethod.Post,
  CustomApiMethod.Put,
]);
/*
 * One leading slash, nonempty ASCII letter/digit/underscore/hyphen segments
 * separated by single slashes, no trailing slash. The restricted alphabet
 * alone rejects dots (`..`), percent encodings, backslashes, absolute/
 * protocol-relative URLs and query/fragment syntax; the "nonempty segment"
 * requirement rejects doubled and trailing slashes.
 */
const CORE_PATH_PATTERN = /^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;

const ALLOWED_ROOT_KEYS = new Set(['version', 'operations']);
const ALLOWED_OPERATION_KEYS = new Set([
  'id',
  'method',
  'corePath',
  'query',
  'body',
  'timeoutMs',
  'maxResponseBytes',
]);

/** Thrown only with field-identifying messages — never with the raw config value. */
class CustomApiConfigError extends Error {}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertNoUnknownKeys = (
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  context: string,
): void => {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new CustomApiConfigError(
        `${context} has an unknown field "${key}"`,
      );
    }
  }
};

const parseOptionalLimit = (
  value: unknown,
  ceiling: number,
  field: string,
  fallback = ceiling,
): number => {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > ceiling
  ) {
    throw new CustomApiConfigError(
      `${field} must be a positive integer at most ${ceiling}`,
    );
  }
  return value;
};

const parseQueryNames = (value: unknown, context: string): string[] => {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > CUSTOM_API_MAX_QUERY_NAMES ||
    value.some(
      (name) => typeof name !== 'string' || !QUERY_NAME_PATTERN.test(name),
    )
  ) {
    throw new CustomApiConfigError(
      `${context}.query must be at most ${CUSTOM_API_MAX_QUERY_NAMES} valid parameter names`,
    );
  }
  if (new Set(value).size !== value.length) {
    throw new CustomApiConfigError(`${context}.query has a duplicate name`);
  }
  return value as string[];
};

const parseBody = (
  value: unknown,
  method: CustomApiMethod,
  context: string,
): CustomApiBody => {
  if (value === undefined) return CustomApiBody.None;
  if (value !== CustomApiBody.Json || !BODY_METHODS.has(method)) {
    throw new CustomApiConfigError(
      `${context}.body must be "json", and only on POST or PUT`,
    );
  }
  return CustomApiBody.Json;
};

const parseOperation = (entry: unknown, index: number): CustomApiOperation => {
  const context = `operations[${index}]`;
  if (!isPlainObject(entry)) {
    throw new CustomApiConfigError(`${context} must be an object`);
  }
  assertNoUnknownKeys(entry, ALLOWED_OPERATION_KEYS, context);

  const { id, method, corePath, query, body, timeoutMs, maxResponseBytes } =
    entry;

  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new CustomApiConfigError(`${context}.id is invalid`);
  }
  if (typeof method !== 'string' || !METHODS.has(method)) {
    throw new CustomApiConfigError(
      `${context}.method must be one of GET, POST, PUT, DELETE`,
    );
  }
  const verb = method as CustomApiMethod;
  if (typeof corePath !== 'string' || !CORE_PATH_PATTERN.test(corePath)) {
    throw new CustomApiConfigError(`${context}.corePath is invalid`);
  }

  return {
    id,
    method: verb,
    corePath,
    query: parseQueryNames(query, context),
    body: parseBody(body, verb, context),
    timeoutMs: parseOptionalLimit(
      timeoutMs,
      CUSTOM_API_MAX_TIMEOUT_MS,
      `${context}.timeoutMs`,
      CUSTOM_API_DEFAULT_TIMEOUT_MS,
    ),
    maxResponseBytes: parseOptionalLimit(
      maxResponseBytes,
      CUSTOM_API_MAX_RESPONSE_BYTES,
      `${context}.maxResponseBytes`,
    ),
  };
};

/**
 * Parses CUSTOM_CORE_API_CONFIG into an id-keyed operation map. Unset, empty
 * or whitespace-only input yields an empty registry. Every other failure —
 * oversized value, malformed JSON, invalid root/version/operations shape,
 * unknown keys, duplicate IDs, invalid limits or paths — throws
 * `CustomApiConfigError` with a field-identifying message only.
 */
export const parseCustomApiRegistry = (
  raw: string | undefined,
): ReadonlyMap<string, CustomApiOperation> => {
  const value = raw?.trim();
  if (!value) return new Map();

  const byteLength = Buffer.byteLength(value, 'utf8');
  if (byteLength > CUSTOM_API_CONFIG_MAX_BYTES) {
    throw new CustomApiConfigError(
      `exceeds the ${CUSTOM_API_CONFIG_MAX_BYTES}-byte limit`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new CustomApiConfigError('is malformed JSON');
  }

  if (!isPlainObject(parsed)) {
    throw new CustomApiConfigError('root must be a JSON object');
  }
  assertNoUnknownKeys(parsed, ALLOWED_ROOT_KEYS, 'root');

  if (parsed.version !== 1) {
    throw new CustomApiConfigError('version must equal 1');
  }
  if (!Array.isArray(parsed.operations)) {
    throw new CustomApiConfigError('operations must be an array');
  }
  if (parsed.operations.length > CUSTOM_API_MAX_OPERATIONS) {
    throw new CustomApiConfigError(
      `operations exceeds the ${CUSTOM_API_MAX_OPERATIONS}-entry limit`,
    );
  }

  const operations = new Map<string, CustomApiOperation>();
  parsed.operations.forEach((entry, index) => {
    const operation = parseOperation(entry, index);
    if (operations.has(operation.id)) {
      throw new CustomApiConfigError(
        `operations[${index}].id "${operation.id}" is a duplicate`,
      );
    }
    operations.set(operation.id, operation);
  });

  return operations;
};

/**
 * Resolves a configured `corePath` against the trusted `DIAL_CORE_URL` base,
 * preserving an intentional base path prefix (e.g. a base of
 * `https://core-api.com/dial` plus `/data-products` resolves to
 * `https://core-api.com/dial/data-products`). Never inserts `/v1`, `/openai`,
 * `/api` or an api-version segment, and never carries a fragment. The only
 * query is the one passed in — the operation's allowlisted parameters, already
 * re-encoded by the BFF. Re-parses the assembled URL and asserts its origin,
 * pathname and query match what was intended before returning it, so a caller
 * never dispatches a request whose destination silently diverged from the
 * configured Core base.
 */
export const resolveCustomApiDestination = (
  baseUrl: string,
  corePath: string,
  query: URLSearchParams = new URLSearchParams(),
): URL => {
  const base = new URL(baseUrl);
  const basePath = base.pathname.endsWith('/')
    ? base.pathname.slice(0, -1)
    : base.pathname;
  const expectedPathname = `${basePath}${corePath}`;
  const encodedQuery = query.toString();
  const expectedSearch = encodedQuery ? `?${encodedQuery}` : '';

  const destination = new URL(`${base.origin}${expectedPathname}`);
  destination.search = encodedQuery;
  if (
    destination.origin !== base.origin ||
    destination.pathname !== expectedPathname ||
    destination.search !== expectedSearch ||
    destination.hash !== ''
  ) {
    throw new Error(
      'Resolved custom API destination escaped the configured Core base',
    );
  }

  return destination;
};

/**
 * Immutable, server-only registry of allowlisted Core GET operations, parsed
 * once from CUSTOM_CORE_API_CONFIG at startup. See
 * openspec/changes/archive/2026-10-02-add-configured-core-api-operations/design.md §2.
 */
@Injectable()
export class CustomApiRegistryService {
  private readonly logger = new Logger(CustomApiRegistryService.name);
  private readonly operations: ReadonlyMap<string, CustomApiOperation>;

  constructor(configService: ConfigService<EnvironmentVariables>) {
    const raw = configService.get('CUSTOM_CORE_API_CONFIG', { infer: true });
    try {
      this.operations = parseCustomApiRegistry(raw);
    } catch (error) {
      const reason =
        error instanceof CustomApiConfigError
          ? error.message
          : 'failed to parse';
      /* Never log `raw` or `error` itself here — both may echo configuration
       * contents (parser errors can quote the offending substring). */
      this.logger.error(`CUSTOM_CORE_API_CONFIG ${reason}`);
      throw new Error(`CUSTOM_CORE_API_CONFIG ${reason}`);
    }

    this.logger.log(
      `Custom Core API registry initialized with ${this.operations.size} operation(s)`,
    );
  }

  /** Looks up a configured operation by ID. Returns `undefined` for an unknown ID. */
  get(id: string): CustomApiOperation | undefined {
    return this.operations.get(id);
  }
}
