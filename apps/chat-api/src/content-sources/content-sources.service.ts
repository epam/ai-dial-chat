import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ContentProvider,
  UpstreamError,
  UpstreamFailure,
} from './content-provider';
import {
  ContentSourcesCacheService,
  ContentSourcesCacheStore,
  mapWithConcurrency,
} from './content-sources-cache.service';
import { documentTitle, fileNameTitle } from './content-sources-markdown';
import {
  compileIncludeGlob,
  ContentSourcePathError,
  isWithinRoot,
  normalizeContentPath,
  relativeToRoot,
} from './content-sources-path';
import {
  CONTENT_SOURCES_MAX_ASSET_BYTES,
  CONTENT_SOURCES_MAX_CACHED_ENTRY_BYTES,
  CONTENT_SOURCES_MAX_DOCUMENT_BYTES,
  CONTENT_SOURCES_MAX_DOCUMENTS,
  ContentSource,
  ContentSourceDateMode,
  ContentSourceKind,
  ContentSourceProvider,
  ContentSourceSort,
  ContentSourcesRegistryService,
} from './content-sources-registry.service';
import { GitHubProvider } from './providers/github.provider';
import { GitLabProvider } from './providers/gitlab.provider';

/** Upstream fan-out bound for dates and title reads. */
export const CONTENT_SOURCES_UPSTREAM_CONCURRENCY = 4;

export const ASSET_CONTENT_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export interface ContentDocumentSummary {
  path: string;
  title: string;
  date: string | null;
}

export interface ContentSourceListing {
  id: string;
  title: string;
  kind: ContentSourceKind;
  feed: { summaryHeading?: string };
  webUrl: string;
  documents: ContentDocumentSummary[];
}

export interface ContentDocument {
  path: string;
  title: string;
  date: string | null;
  markdown: string;
  webUrl: string;
}

export interface ContentAsset {
  bytes: Buffer;
  contentType: string;
}

type DatedMode = Exclude<ContentSourceDateMode, ContentSourceDateMode.None>;

const collator = new Intl.Collator('en', { numeric: true });

/** A 502 whose cause is a rejected credential, so telemetry can tell it apart. */
export class UpstreamCredentialsException extends BadGatewayException {
  constructor() {
    super('Content source returned an error');
  }
}

/** Maps a provider failure to the HTTP status the API contract defines. */
export const toHttpException = (error: unknown): unknown => {
  if (!(error instanceof UpstreamError)) return error;
  switch (error.failure) {
    case UpstreamFailure.NotFound:
      return new NotFoundException('Not found in the content source');
    case UpstreamFailure.Unavailable:
      return new ServiceUnavailableException('Content source is unavailable');
    case UpstreamFailure.Credentials:
      return new UpstreamCredentialsException();
    case UpstreamFailure.TooLarge:
    case UpstreamFailure.BadResponse:
      return new BadGatewayException('Content source returned an error');
  }
};

@Injectable()
export class ContentSourcesService {
  private readonly logger = new Logger(ContentSourcesService.name);

  constructor(
    private readonly registry: ContentSourcesRegistryService,
    private readonly cache: ContentSourcesCacheService,
    private readonly github: GitHubProvider,
    private readonly gitlab: GitLabProvider,
  ) {}

  /** Resolves a configured source; unknown ids are 404. */
  resolve(sourceId: string): ContentSource {
    const source = this.registry.get(sourceId);
    if (!source) throw new NotFoundException('Unknown content source');
    return source;
  }

  async listSource(sourceId: string): Promise<ContentSourceListing> {
    const source = this.resolve(sourceId);
    try {
      /* A degraded listing (a title or date fell back) is served, not stored. */
      const { documents } = await this.cache.getOrLoad(
        this.key(source, 'list', source.path),
        () => this.assembleListing(source),
        {
          sourceId: source.id,
          store: ContentSourcesCacheStore.Meta,
          cacheable: (listing) => !listing.isDegraded,
        },
      );
      return {
        id: source.id,
        title: source.title,
        kind: source.kind,
        feed: source.feed.summaryHeading
          ? { summaryHeading: source.feed.summaryHeading }
          : {},
        webUrl: this.provider(source).webUrl(
          source,
          undefined,
          source.kind === ContentSourceKind.File,
        ),
        documents,
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  async getDocument(
    sourceId: string,
    rawPath: string,
  ): Promise<ContentDocument> {
    const source = this.resolve(sourceId);
    const path = this.normalize(rawPath);
    if (!this.isDocumentPath(source, path)) {
      throw new NotFoundException('Document not found in the content source');
    }

    try {
      const markdown = (await this.readDocument(source, path)).toString('utf8');
      const date = await this.documentDate(source, path);
      return {
        path,
        title: documentTitle(markdown, path),
        date: date?.toISOString() ?? null,
        markdown,
        webUrl: this.provider(source).webUrl(source, path, true),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  async getAsset(sourceId: string, rawPath: string): Promise<ContentAsset> {
    const source = this.resolve(sourceId);
    const path = this.normalize(rawPath);

    const extension = path.includes('.')
      ? path.slice(path.lastIndexOf('.') + 1).toLowerCase()
      : '';
    const contentType = ASSET_CONTENT_TYPES[extension];
    if (!contentType) {
      throw new BadRequestException('Unsupported asset type');
    }
    if (!isWithinRoot(path, source.assetsPath)) {
      throw new NotFoundException('Asset not found in the content source');
    }

    try {
      const bytes = await this.cache.getOrLoad(
        this.key(source, 'asset', path),
        () =>
          this.provider(source).readFile(
            source,
            path,
            CONTENT_SOURCES_MAX_ASSET_BYTES,
            {
              timeoutMs: this.registry.timeoutMs,
            },
          ),
        {
          sourceId: source.id,
          store: ContentSourcesCacheStore.Content,
          cacheable: (value) =>
            value.byteLength <= CONTENT_SOURCES_MAX_CACHED_ENTRY_BYTES,
        },
      );
      return { bytes, contentType };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  private normalize(rawPath: string): string {
    try {
      return normalizeContentPath(rawPath);
    } catch (error) {
      if (error instanceof ContentSourcePathError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private isDocumentPath(source: ContentSource, path: string): boolean {
    if (source.kind === ContentSourceKind.File) return path === source.path;
    return (
      path !== source.path &&
      isWithinRoot(path, source.path) &&
      compileIncludeGlob(source.include).test(relativeToRoot(path, source.path))
    );
  }

  private provider(source: ContentSource): ContentProvider {
    return source.provider === ContentSourceProvider.GitHub
      ? this.github
      : this.gitlab;
  }

  /** `source:ref:kind:path`, built only from validated config and a normalized path. */
  private key(source: ContentSource, kind: string, path: string): string {
    return `content-sources:${source.id}:${source.ref}:${kind}:${path}`;
  }

  /** Document bytes for a document view; cached when small enough. */
  private readDocument(source: ContentSource, path: string): Promise<Buffer> {
    return this.cache.getOrLoad(
      this.key(source, 'doc', path),
      () => this.fetchDocument(source, path),
      {
        sourceId: source.id,
        store: ContentSourcesCacheStore.Content,
        cacheable: (value) =>
          value.byteLength <= CONTENT_SOURCES_MAX_CACHED_ENTRY_BYTES,
      },
    );
  }

  private fetchDocument(source: ContentSource, path: string): Promise<Buffer> {
    return this.provider(source).readFile(
      source,
      path,
      CONTENT_SOURCES_MAX_DOCUMENT_BYTES,
      { timeoutMs: this.registry.timeoutMs },
    );
  }

  private datedMode(source: ContentSource): DatedMode | undefined {
    return source.date === ContentSourceDateMode.None ? undefined : source.date;
  }

  /**
   * Cached per path. A failure that means "date unknown" degrades to null,
   * is reported through `onDegraded` and is never cached.
   */
  private async documentDate(
    source: ContentSource,
    path: string,
    onDegraded?: () => void,
  ): Promise<Date | null> {
    const mode = this.datedMode(source);
    if (!mode) return null;
    try {
      const stamp = await this.cache.getOrLoad(
        this.key(source, `date-${mode}`, path),
        async () =>
          (
            await this.provider(source).fileDate(source, path, mode, {
              timeoutMs: this.registry.timeoutMs,
            })
          )?.toISOString() ?? null,
        { sourceId: source.id, store: ContentSourcesCacheStore.Meta },
      );
      return stamp ? new Date(stamp) : null;
    } catch (error) {
      if (this.isFatal(error)) throw error;
      onDegraded?.();
      this.logger.warn(
        `Date lookup failed for source "${source.id}": ${(error as Error).message}`,
      );
      return null;
    }
  }

  /** Credential and availability failures abort a listing; others degrade one entry. */
  private isFatal(error: unknown): boolean {
    return (
      !(error instanceof UpstreamError) ||
      error.failure === UpstreamFailure.Credentials ||
      error.failure === UpstreamFailure.Unavailable
    );
  }

  private async assembleListing(
    source: ContentSource,
  ): Promise<{ documents: ContentDocumentSummary[]; isDegraded: boolean }> {
    let isDegraded = false;
    const markDegraded = () => {
      isDegraded = true;
    };
    let paths: string[];
    if (source.kind === ContentSourceKind.File) {
      paths = [source.path];
    } else {
      const listing = await this.provider(source).listDocuments(source, {
        timeoutMs: this.registry.timeoutMs,
      });
      if (listing.truncated) {
        this.logger.warn(
          `Content source "${source.id}" listing is partial: the upstream truncated the tree`,
        );
      }
      const include = compileIncludeGlob(source.include);
      paths = listing.files.filter(
        (file) =>
          isWithinRoot(file, source.path) &&
          file !== source.path &&
          include.test(relativeToRoot(file, source.path)),
      );
      paths.sort((a, b) => this.byName(a, b, true));
      if (paths.length > CONTENT_SOURCES_MAX_DOCUMENTS) {
        this.logger.warn(
          `Content source "${source.id}" has ${paths.length} documents; listing the first ${CONTENT_SOURCES_MAX_DOCUMENTS} by name (newest names first)`,
        );
        paths = paths.slice(0, CONTENT_SOURCES_MAX_DOCUMENTS);
      }
    }

    const documents = await mapWithConcurrency(
      paths,
      CONTENT_SOURCES_UPSTREAM_CONCURRENCY,
      async (path): Promise<ContentDocumentSummary & { time: number }> => {
        /* Sequential, so a worker never holds more than one upstream call. */
        const title = await this.listingTitle(source, path, markDegraded);
        const date = await this.documentDate(source, path, markDegraded);
        return {
          path,
          title,
          date: date?.toISOString() ?? null,
          time: date?.getTime() ?? Number.NEGATIVE_INFINITY,
        };
      },
    );

    documents.sort((a, b) => this.compare(source, a, b));
    return {
      documents: documents.map(({ path, title, date }) => ({
        path,
        title,
        date,
      })),
      isDegraded,
    };
  }

  /*
   * Read straight from the provider, not through the content cache: a listing
   * touches every document once per refresh, and caching them all would evict
   * the documents readers actually open. The title lands in the listing entry.
   */
  private async listingTitle(
    source: ContentSource,
    path: string,
    onDegraded: () => void,
  ): Promise<string> {
    try {
      return documentTitle(
        (await this.fetchDocument(source, path)).toString('utf8'),
        path,
      );
    } catch (error) {
      if (this.isFatal(error)) throw error;
      onDegraded();
      this.logger.warn(
        `Title read failed for source "${source.id}"; using the file name: ${(error as Error).message}`,
      );
      return fileNameTitle(path);
    }
  }

  private byName(a: string, b: string, descending: boolean): number {
    const result = collator.compare(a, b);
    return descending ? -result : result;
  }

  private compare(
    source: ContentSource,
    a: { path: string; time: number },
    b: { path: string; time: number },
  ): number {
    switch (source.sort) {
      case ContentSourceSort.NameDesc:
        return this.byName(a.path, b.path, true);
      case ContentSourceSort.DateDesc:
        return b.time - a.time || this.byName(a.path, b.path, true);
      default:
        return this.byName(a.path, b.path, false);
    }
  }
}
