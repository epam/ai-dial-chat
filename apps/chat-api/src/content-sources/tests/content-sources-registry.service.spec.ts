import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import {
  ContentSourcesRegistryService,
  parseContentSourcesCredentials,
  parseContentSourcesRegistry,
} from '../content-sources-registry.service';

const GITHUB = {
  id: 'release-notes',
  title: 'Release notes',
  provider: 'github',
  repository: 'epam/ai-dial',
  ref: 'main',
  kind: 'directory',
  path: 'docs/releases',
};
const GITLAB = {
  id: 'guide',
  title: 'Guide',
  provider: 'gitlab',
  baseUrl: 'https://gitlab.example.com',
  repository: 'group/sub/project',
  ref: 'v1.0',
  kind: 'file',
  path: 'docs/guide.md',
};

const config = (...sources: unknown[]) =>
  JSON.stringify({ version: 1, sources });

const create = (
  values: Record<string, string | number | undefined>,
): ContentSourcesRegistryService =>
  new ContentSourcesRegistryService({
    get: (key: string) => values[key],
  } as unknown as ConfigService<never>);

describe('parseContentSourcesRegistry', () => {
  it.each([undefined, '', '  ', '\n'])('is empty for %p', (value) => {
    expect(parseContentSourcesRegistry(value).size).toBe(0);
  });

  it('applies defaults for a GitHub directory source', () => {
    const source = parseContentSourcesRegistry(config(GITHUB)).get(GITHUB.id);
    expect(source).toMatchObject({
      baseUrl: 'https://api.github.com',
      include: '**/*.md',
      assetsPath: 'docs/releases',
      sort: 'name-asc',
      date: 'none',
      feed: {},
    });
  });

  it('defaults assetsPath to the folder of a file source', () => {
    const source = parseContentSourcesRegistry(config(GITLAB)).get(GITLAB.id);
    expect(source?.assetsPath).toBe('docs');
  });

  it('accepts a numeric GitLab project id and explicit options', () => {
    const source = parseContentSourcesRegistry(
      config({
        ...GITLAB,
        repository: '42',
        assetsPath: 'docs/img',
        sort: 'date-desc',
        date: 'created',
        feed: { summaryHeading: 'Summary' },
      }),
    ).get(GITLAB.id);
    expect(source).toMatchObject({
      repository: '42',
      assetsPath: 'docs/img',
      sort: 'date-desc',
      date: 'created',
      feed: { summaryHeading: 'Summary' },
    });
  });

  it('rejects a duplicate id', () => {
    expect(() => parseContentSourcesRegistry(config(GITHUB, GITHUB))).toThrow(
      /duplicate/,
    );
  });

  it.each([
    'http://gitlab.example.com',
    'https://gitlab.example.com/sub',
    'https://user:pw@gitlab.example.com',
    'https://gitlab.example.com?x=1',
    'gitlab.example.com',
  ])('rejects baseUrl %s', (baseUrl) => {
    expect(() =>
      parseContentSourcesRegistry(config({ ...GITLAB, baseUrl })),
    ).toThrow(/baseUrl/);
  });

  it('requires a GitLab baseUrl', () => {
    const { baseUrl: _omitted, ...rest } = GITLAB;
    expect(() => parseContentSourcesRegistry(config(rest))).toThrow(/baseUrl/);
  });

  it('rejects unknown fields and bad enums', () => {
    expect(() =>
      parseContentSourcesRegistry(config({ ...GITHUB, extra: 1 })),
    ).toThrow(/unknown field "extra"/);
    expect(() =>
      parseContentSourcesRegistry(config({ ...GITHUB, provider: 'bitbucket' })),
    ).toThrow(/provider/);
    expect(() =>
      parseContentSourcesRegistry(config({ ...GITHUB, sort: 'random' })),
    ).toThrow(/sort/);
  });

  it.each(['Bad_ID', '-lead', 'a'.repeat(65), ''])('rejects id %p', (id) => {
    expect(() =>
      parseContentSourcesRegistry(config({ ...GITHUB, id })),
    ).toThrow(/id is invalid/);
  });

  it.each(['/abs', 'a\\b', '../x', 'a/../../x', 'a\u0000b'])(
    'rejects path %p',
    (path) => {
      expect(() =>
        parseContentSourcesRegistry(config({ ...GITHUB, path })),
      ).toThrow(/path/);
      expect(() =>
        parseContentSourcesRegistry(config({ ...GITHUB, assetsPath: path })),
      ).toThrow(/assetsPath/);
    },
  );

  it('rejects a GitHub repository without an owner', () => {
    expect(() =>
      parseContentSourcesRegistry(config({ ...GITHUB, repository: 'repo' })),
    ).toThrow(/repository/);
  });

  it('rejects malformed JSON, wrong version and wrong shapes', () => {
    expect(() => parseContentSourcesRegistry('{')).toThrow(/malformed/);
    expect(() =>
      parseContentSourcesRegistry('{"version":2,"sources":[]}'),
    ).toThrow(/version/);
    expect(() =>
      parseContentSourcesRegistry('{"version":1,"sources":{}}'),
    ).toThrow(/array/);
    expect(() => parseContentSourcesRegistry('[]')).toThrow(/object/);
  });

  describe('credentials', () => {
    const credentials = parseContentSourcesCredentials('{"gh":"tok-1"}');

    it('resolves the referenced token', () => {
      const source = parseContentSourcesRegistry(
        config({ ...GITHUB, credentialId: 'gh' }),
        credentials,
      ).get(GITHUB.id);
      expect(source?.token).toBe('tok-1');
      expect(source?.credentialId).toBe('gh');
    });

    it('omits credentialId for an anonymous source', () => {
      const source = parseContentSourcesRegistry(config(GITHUB)).get(GITHUB.id);
      expect(source).not.toHaveProperty('credentialId');
    });

    it('fails when the credential is missing, without a token or id in the message', () => {
      let message = '';
      try {
        parseContentSourcesRegistry(
          config({ ...GITHUB, credentialId: 'nope-id' }),
          credentials,
        );
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(
        /credentialId references a credential that is not configured/,
      );
      expect(message).not.toContain('nope-id');
    });

    it('rejects malformed credential JSON and invalid entries', () => {
      expect(() => parseContentSourcesCredentials('{')).toThrow(/malformed/);
      expect(() => parseContentSourcesCredentials('{"a":1}')).toThrow(
        /invalid entry/,
      );
      expect(() => parseContentSourcesCredentials('{"a":"x\\ny"}')).toThrow(
        /invalid entry/,
      );
    });
  });
});

describe('ContentSourcesRegistryService', () => {
  it('applies runtime defaults', () => {
    const service = create({});
    expect(service.cacheTtlMs).toBe(30 * 60 * 1000);
    expect(service.timeoutMs).toBe(10_000);
    expect(service.upstreamConcurrency).toBe(8);
    expect(service.upstreamQueueSize).toBe(64);
    expect(service.principalMissConcurrency).toBe(8);
    expect(service.get('anything')).toBeUndefined();
  });

  it('honours configured TTL, timeout and admission limits', () => {
    const service = create({
      CONTENT_SOURCES_CACHE_TTL_MS: 5000,
      CONTENT_SOURCES_TIMEOUT_MS: 2000,
      CONTENT_SOURCES_UPSTREAM_CONCURRENCY: 2,
      CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE: 0,
      CONTENT_SOURCES_PRINCIPAL_MISS_CONCURRENCY: 3,
    });
    expect(service.cacheTtlMs).toBe(5000);
    expect(service.timeoutMs).toBe(2000);
    expect(service.upstreamConcurrency).toBe(2);
    expect(service.upstreamQueueSize).toBe(0);
    expect(service.principalMissConcurrency).toBe(3);
  });

  it('fails construction without leaking secrets', () => {
    const secret = 'ghp_supersecret';
    let message = '';
    try {
      create({
        CONTENT_SOURCES_CONFIG: config({ ...GITHUB, credentialId: 'x' }),
        CONTENT_SOURCES_CREDENTIALS: `{"y":"${secret}"`,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/CONTENT_SOURCES_CREDENTIALS is malformed/);
    expect(message).not.toContain(secret);
  });

  it('loads a configured source', () => {
    const service = create({
      CONTENT_SOURCES_CONFIG: config(GITHUB),
    });
    expect(service.get(GITHUB.id)?.title).toBe('Release notes');
  });
});
