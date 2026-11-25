import type {
  ContentSource,
  ContentSourceDateMode,
} from './content-sources-registry.service';

/** Why an upstream call failed, independent of HTTP. Mapped to a status by the service. */
export enum UpstreamFailure {
  NotFound = 'not_found',
  Credentials = 'credentials',
  Unavailable = 'unavailable',
  TooLarge = 'too_large',
  BadResponse = 'bad_response',
}

export class UpstreamError extends Error {
  constructor(
    readonly failure: UpstreamFailure,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Options every provider call receives from the service. */
export interface ProviderContext {
  readonly timeoutMs: number;
}

export interface ProviderListing {
  /** Full repository-relative paths of every file under the source path. */
  readonly files: readonly string[];
  /** True when the upstream truncated or the page cap was hit. */
  readonly truncated: boolean;
}

/** One adapter per hosting provider; see design.md decision 2. */
export interface ContentProvider {
  listDocuments(
    source: ContentSource,
    context: ProviderContext,
  ): Promise<ProviderListing>;
  readFile(
    source: ContentSource,
    path: string,
    maxBytes: number,
    context: ProviderContext,
  ): Promise<Buffer>;
  /** Created (first) or updated (latest) commit date of `path`; null when unknown. */
  fileDate(
    source: ContentSource,
    path: string,
    mode: Exclude<ContentSourceDateMode, ContentSourceDateMode.None>,
    context: ProviderContext,
  ): Promise<Date | null>;
  /** Human-facing repository page for `path` (the source root when omitted). */
  webUrl(source: ContentSource, path?: string, isFile?: boolean): string;
}
