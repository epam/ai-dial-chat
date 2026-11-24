import { Injectable } from '@nestjs/common';
import {
  ContentProvider,
  ProviderContext,
  ProviderListing,
} from '../content-provider';
import {
  ContentSource,
  ContentSourceDateMode,
} from '../content-sources-registry.service';
import { fetchUpstream, parseUpstreamJson } from '../upstream-fetch';

const API_VERSION = '2022-11-28';
const LIST_MAX_BYTES = 16 * 1024 * 1024;
const JSON_MAX_BYTES = 1024 * 1024;

interface GitHubTree {
  tree?: { path?: string; type?: string }[];
  truncated?: boolean;
}

interface GitHubCommit {
  commit?: { committer?: { date?: string }; author?: { date?: string } };
}

const encodePath = (path: string): string =>
  path.split('/').map(encodeURIComponent).join('/');

/** GitHub REST adapter. `baseUrl` is the API origin (default api.github.com). */
@Injectable()
export class GitHubProvider implements ContentProvider {
  async listDocuments(
    source: ContentSource,
    context: ProviderContext,
  ): Promise<ProviderListing> {
    /* `<ref>:<path>` names the subtree, so a large repository is never listed whole. */
    const treeish = source.path ? `${source.ref}:${source.path}` : source.ref;
    const url = this.url(
      source,
      `/repos/${source.repository}/git/trees/${encodeURIComponent(treeish)}`,
      { recursive: '1' },
    );
    const { body } = await this.get(
      source,
      url,
      context,
      LIST_MAX_BYTES,
      'application/vnd.github+json',
    );
    const tree = parseUpstreamJson<GitHubTree>(body);
    const prefix = source.path ? `${source.path}/` : '';
    const files = (tree.tree ?? [])
      .filter(
        (entry): entry is { path: string; type: string } =>
          entry.type === 'blob' && typeof entry.path === 'string',
      )
      .map((entry) => `${prefix}${entry.path}`);
    return { files, truncated: tree.truncated === true };
  }

  async readFile(
    source: ContentSource,
    path: string,
    maxBytes: number,
    context: ProviderContext,
  ): Promise<Buffer> {
    const url = this.url(
      source,
      `/repos/${source.repository}/contents/${encodePath(path)}`,
      { ref: source.ref },
    );
    const { body } = await this.get(
      source,
      url,
      context,
      maxBytes,
      'application/vnd.github.raw',
    );
    return body;
  }

  async fileDate(
    source: ContentSource,
    path: string,
    mode: Exclude<ContentSourceDateMode, ContentSourceDateMode.None>,
    context: ProviderContext,
  ): Promise<Date | null> {
    const query = { sha: source.ref, path, per_page: '1' };
    const commitsPath = `/repos/${source.repository}/commits`;
    const first = await this.get(
      source,
      this.url(source, commitsPath, query),
      context,
      JSON_MAX_BYTES,
      'application/vnd.github+json',
    );
    let commits = parseUpstreamJson<GitHubCommit[]>(first.body);

    if (mode === ContentSourceDateMode.Created) {
      /* One commit per page, so the last page holds the oldest commit. */
      const lastPage = /[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(
        first.headers.get('link') ?? '',
      )?.[1];
      if (lastPage && Number(lastPage) > 1) {
        const last = await this.get(
          source,
          this.url(source, commitsPath, { ...query, page: lastPage }),
          context,
          JSON_MAX_BYTES,
          'application/vnd.github+json',
        );
        commits = parseUpstreamJson<GitHubCommit[]>(last.body);
      }
    }

    const raw = Array.isArray(commits)
      ? (commits[0]?.commit?.committer?.date ??
        commits[0]?.commit?.author?.date)
      : undefined;
    const date = raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  webUrl(source: ContentSource, path?: string, isFile = false): string {
    const host = new URL(source.baseUrl).hostname;
    const webHost = host.startsWith('api.') ? host.slice(4) : host;
    const base = `https://${webHost}/${source.repository}`;
    const target = path ?? source.path;
    if (!target) return `${base}/tree/${encodePath(source.ref)}`;
    return `${base}/${isFile ? 'blob' : 'tree'}/${encodePath(source.ref)}/${encodePath(target)}`;
  }

  private url(
    source: ContentSource,
    pathname: string,
    query: Record<string, string>,
  ): URL {
    const url = new URL(`${source.baseUrl}${pathname}`);
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
    accept: string,
  ) {
    return fetchUpstream({
      url,
      origin: new URL(source.baseUrl).origin,
      headers: {
        Accept: accept,
        'X-GitHub-Api-Version': API_VERSION,
        'User-Agent': 'ai-dial-chat-content-sources',
        ...(source.token ? { Authorization: `Bearer ${source.token}` } : {}),
      },
      timeoutMs: context.timeoutMs,
      maxBytes,
      sourceId: source.id,
    });
  }
}
