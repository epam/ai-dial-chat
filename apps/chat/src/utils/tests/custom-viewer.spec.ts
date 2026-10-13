import type {
  ApplicationSchemaSummaryDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';

import { buildCustomViewerUrl, resolveCustomViewer } from '../custom-viewer';

const app = (overrides: Partial<DeploymentItemDto> = {}): DeploymentItemDto =>
  ({
    id: 'applications/bucket/explorer',
    displayName: 'Explorer',
    type: 'application',
    ...overrides,
  }) as DeploymentItemDto;

const schemas: ApplicationSchemaSummaryDto[] = [
  {
    id: 'schema-1',
    displayName: 'Data Explorer',
    viewerUrl: 'https://schema-viewer.example.com/',
  },
];

describe('resolveCustomViewer', () => {
  it('prefers the direct viewer URL over the schema one', () => {
    const viewer = resolveCustomViewer(
      app({
        viewerUrl: 'https://viewer.example.com/',
        applicationTypeSchemaId: 'schema-1',
      }),
      schemas,
    );

    expect(viewer).toEqual({
      url: 'https://viewer.example.com/',
      title: 'Explorer',
      applicationId: 'applications/bucket/explorer',
    });
  });

  it('falls back to the schema viewer URL and title', () => {
    const viewer = resolveCustomViewer(
      app({ applicationTypeSchemaId: 'schema-1' }),
      schemas,
    );

    expect(viewer).toEqual({
      url: 'https://schema-viewer.example.com/',
      title: 'Data Explorer',
      applicationId: 'applications/bucket/explorer',
    });
  });

  it('returns undefined when no viewer is configured', () => {
    expect(resolveCustomViewer(app(), schemas)).toBeUndefined();
    expect(resolveCustomViewer(undefined, schemas)).toBeUndefined();
  });

  it('ignores unsafe or malformed direct URLs and falls through to the schema', () => {
    for (const viewerUrl of ['javascript:alert(1)', 'not a url']) {
      const viewer = resolveCustomViewer(
        app({ viewerUrl, applicationTypeSchemaId: 'schema-1' }),
        schemas,
      );

      expect(viewer?.url).toBe('https://schema-viewer.example.com/');
    }
  });

  it('never resolves a viewer for a model', () => {
    const viewer = resolveCustomViewer(
      app({ type: 'model', viewerUrl: 'https://viewer.example.com/' }),
      schemas,
    );

    expect(viewer).toBeUndefined();
  });

  it('returns undefined when the chosen source has no title', () => {
    const viewer = resolveCustomViewer(
      app({ displayName: '', viewerUrl: 'https://viewer.example.com/' }),
      schemas,
    );

    expect(viewer).toBeUndefined();
  });

  it('keeps the title verbatim', () => {
    const viewer = resolveCustomViewer(
      app({
        displayName: ' My App ',
        viewerUrl: 'https://viewer.example.com/',
      }),
      schemas,
    );

    expect(viewer?.title).toBe(' My App ');
  });
});

describe('buildCustomViewerUrl', () => {
  it('keeps an existing query and encodes the application id', () => {
    const url = buildCustomViewerUrl({
      url: 'https://viewer.example.com/app?tenant=a',
      applicationId: 'applications/abc/my app',
    });
    const parsed = new URL(url ?? '');

    expect(parsed.searchParams.get('tenant')).toBe('a');
    expect(parsed.searchParams.get('id')).toBe('applications/abc/my app');
    expect(parsed.searchParams.has('conversationId')).toBe(false);
  });

  it('omits an empty auth provider instead of leaving an empty parameter', () => {
    const url = buildCustomViewerUrl({
      url: 'https://viewer.example.com/',
      applicationId: 'app',
      authProvider: '',
    });

    expect(url).toBe('https://viewer.example.com/?id=app');
  });

  it('sets every context parameter when available', () => {
    const url = buildCustomViewerUrl({
      url: 'https://viewer.example.com/',
      applicationId: 'app',
      conversationId: 'conversations/bucket/My chat',
      theme: 'dark',
      authProvider: 'keycloak',
    });
    const parsed = new URL(url ?? '');

    expect(parsed.searchParams.get('authProvider')).toBe('keycloak');
    expect(parsed.searchParams.get('conversationId')).toBe(
      'conversations/bucket/My chat',
    );
    expect(parsed.searchParams.get('theme')).toBe('dark');
    expect(parsed.searchParams.has('playback')).toBe(false);
  });

  it('returns undefined for an unsafe URL', () => {
    expect(
      buildCustomViewerUrl({
        url: 'javascript:alert(1)',
        applicationId: 'app',
      }),
    ).toBeUndefined();
  });
});
