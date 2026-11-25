import { Injectable, Logger } from '@nestjs/common';
import {
  ContentProvider,
  ProviderContext,
  ProviderListing,
} from '../content-provider';
import {
  ContentSource,
  ContentSourceDateMode,
} from '../content-sources-registry.service';
import { ContentSourcesUpstreamService } from '../content-sources-upstream.service';
import { parseUpstreamJson } from '../upstream-fetch';

const PAGE_SIZE = 100;
/** Bounds a listing at 5,000 entries; reaching it is reported as truncated. */
const MAX_TREE_PAGES = 50;
const PAGE_MAX_BYTES = 4 * 1024 * 1024;
const JSON_MAX_BYTES = 1024 * 1024;

interface GitLabTreeEntry {
  path?: string;
  type?: string;
}

interface GitLabCommit {
  committed_date?: string;
  created_at?: string;
}

const encodePath = (path: string): string =>
  path.split('/').map(encodeURIComponent).join('/');

/** GitLab REST v4 adapter. */
@Injectable()
export class GitLabProvider implements ContentProvider {
  private readonly logger = new Logger(GitLabProvider.name);

  constructor(private readonly upstream: ContentSourcesUpstreamService) {}

  async listDocuments(
    source: ContentSource,
    context: ProviderContext,
  ): Promise<ProviderListing> {
    const files: string[] = [];
    let page: string | undefined = '1';
    let pages = 0;

    while (page) {
      if (pages >= MAX_TREE_PAGES) {
        this.logger.warn(
          `Content source "${source.id}" tree listing stopped at ${MAX_TREE_PAGES} pages`,
        );
        return { files, truncated: true };
      }
      pages += 1;
      const query: Record<string, string> = {
        ref: source.ref,
        recursive: 'true',
        per_page: String(PAGE_SIZE),
        page,
      };
      if (source.path) query.path = source.path;

      const response = await this.get(
        source,
        this.projectUrl(source, '/repository/tree', query),
        context,
        PAGE_MAX_BYTES,
      );
      const entries = parseUpstreamJson<GitLabTreeEntry[]>(response.body);
      if (!Array.isArray(entries)) break;
      for (const entry of entries) {
        if (entry.type === 'blob' && typeof entry.path === 'string') {
          files.push(entry.path);
        }
      }
      page = response.headers.get('x-next-page')?.trim() || undefined;
    }
    return { files, truncated: false };
  }

  async readFile(
    source: ContentSource,
    path: string,
    maxBytes: number,
    context: ProviderContext,
  ): Promise<Buffer> {
    const { body } = await this.get(
      source,
      this.projectUrl(
        source,
        `/repository/files/${encodeURIComponent(path)}/raw`,
        { ref: source.ref },
      ),
      context,
      maxBytes,
    );
    return body;
  }

  async fileDate(
    source: ContentSource,
    path: string,
    mode: Exclude<ContentSourceDateMode, ContentSourceDateMode.None>,
    context: ProviderContext,
  ): Promise<Date | null> {
    const query = { ref_name: source.ref, path, per_page: '1' };
    const first = await this.get(
      source,
      this.projectUrl(source, '/repository/commits', query),
      context,
      JSON_MAX_BYTES,
    );
    let commits = parseUpstreamJson<GitLabCommit[]>(first.body);

    if (mode === ContentSourceDateMode.Created) {
      const totalPages = Number(first.headers.get('x-total-pages'));
      if (Number.isInteger(totalPages) && totalPages > 1) {
        const last = await this.get(
          source,
          this.projectUrl(source, '/repository/commits', {
            ...query,
            page: String(totalPages),
          }),
          context,
          JSON_MAX_BYTES,
        );
        commits = parseUpstreamJson<GitLabCommit[]>(last.body);
      } else if (first.headers.get('x-next-page')?.trim()) {
        /* GitLab omits the page count on very long histories: the date is unknown. */
        return null;
      }
    }

    const raw = Array.isArray(commits)
      ? (commits[0]?.committed_date ?? commits[0]?.created_at)
      : undefined;
    const date = raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  webUrl(source: ContentSource, path?: string, isFile = false): string {
    /* A numeric id has no path form; GitLab redirects /projects/:id to the project. */
    const project = /^\d+$/.test(source.repository)
      ? `${source.baseUrl}/projects/${source.repository}`
      : `${source.baseUrl}/${source.repository}`;
    const target = path ?? source.path;
    if (/^\d+$/.test(source.repository)) return project;
    if (!target) return `${project}/-/tree/${encodePath(source.ref)}`;
    return `${project}/-/${isFile ? 'blob' : 'tree'}/${encodePath(source.ref)}/${encodePath(target)}`;
  }

  private projectUrl(
    source: ContentSource,
    suffix: string,
    query: Record<string, string>,
  ): URL {
    const url = new URL(
      `${source.baseUrl}/api/v4/projects/${encodeURIComponent(source.repository)}${suffix}`,
    );
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    return url;
  }

  private get(
    source: ContentSource,
    url: URL,
    context: ProviderContext,
    maxBytes: number,
  ) {
    return this.upstream.fetch(
      source,
      {
        url,
        headers: {
          Accept: '*/*',
          'User-Agent': 'ai-dial-chat-content-sources',
          ...(source.token ? { 'PRIVATE-TOKEN': source.token } : {}),
        },
        maxBytes,
      },
      context,
    );
  }
}
