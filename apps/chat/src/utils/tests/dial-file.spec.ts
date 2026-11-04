import {
  AttachmentType,
  RequestStatus,
  type DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  resolveDialFileDownloadUrl,
  resolveDialFileMetadataUrl,
  resolveDialUrl,
  resolveProjectFileDownloadUrl,
  toProjectArtifactUrl,
  toProjectContextFileUrl,
} from '../dial-file';

const makeAttachment = (
  overrides: Partial<DisplayAttachment>,
): DisplayAttachment => ({
  id: 'attachment-1',
  name: 'report.txt',
  contentType: 'text/plain',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  ...overrides,
});

describe('resolveDialUrl', () => {
  it('resolves a file id to its download URL', () => {
    expect(
      resolveDialUrl(makeAttachment({ url: 'files/bucket-1/docs/report.txt' })),
    ).toBe('/api/v1/files/download?bucket=bucket-1&path=docs%2Freport.txt');
  });

  it('returns undefined for a folder id, which has no download', () => {
    expect(
      resolveDialUrl(
        makeAttachment({
          name: 'New folder',
          url: 'files/bucket-1/New%20folder/',
        }),
      ),
    ).toBeUndefined();
  });

  it('falls back to a file referenceUrl when url is a folder id', () => {
    expect(
      resolveDialUrl(
        makeAttachment({
          url: 'files/bucket-1/docs/',
          referenceUrl: 'files/bucket-1/docs/report.txt#page=2',
        }),
      ),
    ).toBe('/api/v1/files/download?bucket=bucket-1&path=docs%2Freport.txt');
  });
});

describe('resolveDialFileDownloadUrl', () => {
  it('builds a /api/v1/files/download URL from a files/{bucket}/{path} id', () => {
    expect(
      resolveDialFileDownloadUrl('files/bucket-1/generated/report.txt'),
    ).toBe(
      '/api/v1/files/download?bucket=bucket-1&path=generated%2Freport.txt',
    );
  });

  it('returns undefined when the input is not a files/ id', () => {
    expect(
      resolveDialFileDownloadUrl('https://example.com/report.txt'),
    ).toBeUndefined();
  });
});

describe('resolveDialFileMetadataUrl', () => {
  it('builds a /api/v1/files/metadata URL from a files/{bucket}/{path} id', () => {
    expect(
      resolveDialFileMetadataUrl('files/bucket-1/generated/report.txt'),
    ).toBe(
      '/api/v1/files/metadata?bucket=bucket-1&path=generated%2Freport.txt',
    );
  });

  it('returns undefined when the input is not a files/ id', () => {
    expect(
      resolveDialFileMetadataUrl('https://example.com/report.txt'),
    ).toBeUndefined();
  });
});

describe('project context file URLs', () => {
  const PROJECT_ID = 'projects/bucket-1/marketing/q4';

  it('builds the locator of a context file from its project id and name', () => {
    expect(toProjectContextFileUrl(PROJECT_ID, 'tickets.csv')).toBe(
      'projects/bucket-1/marketing/q4/files/context/tickets.csv',
    );
  });

  it('resolves a locator to the BFF project file endpoint with the id and name encoded', () => {
    expect(
      resolveProjectFileDownloadUrl(
        toProjectContextFileUrl(PROJECT_ID, 'Q4 tickets (1).csv'),
      ),
    ).toBe(
      '/api/v1/projects/projects%2Fbucket-1%2Fmarketing%2Fq4/files/Q4%20tickets%20(1).csv',
    );
  });

  it.each([
    ['a conversation id of the project', 'projects/b/p/conversations/c1'],
    ['a plain DIAL file id', 'files/bucket-1/docs/report.txt'],
    ['a locator with no file name', 'projects/b/p/files/context/'],
    ['a locator whose name has a path', 'projects/b/p/files/context/a/b.csv'],
    ['a locator with no project', 'projects//files/context/a.csv'],
    ['an external URL', 'https://example.com/projects/b/p/files/context/a.csv'],
  ])('does not resolve %s', (_, url) => {
    expect(resolveProjectFileDownloadUrl(url)).toBeUndefined();
  });

  it('lets resolveDialUrl return the project file endpoint for an attachment carrying a locator', () => {
    expect(
      resolveDialUrl(
        makeAttachment({
          name: 'tickets.csv',
          url: toProjectContextFileUrl(PROJECT_ID, 'tickets.csv'),
        }),
      ),
    ).toBe(
      '/api/v1/projects/projects%2Fbucket-1%2Fmarketing%2Fq4/files/tickets.csv',
    );
  });

  it('builds the locator of an output from its project id and name', () => {
    expect(toProjectArtifactUrl(PROJECT_ID, 'report.pdf')).toBe(
      'projects/bucket-1/marketing/q4/files/artifacts/report.pdf',
    );
  });

  it('resolves an output locator to the BFF artifact endpoint', () => {
    expect(
      resolveProjectFileDownloadUrl(
        'projects/bucket-1/support/files/artifacts/Q4 deck.pptx',
      ),
    ).toBe(
      '/api/v1/projects/projects%2Fbucket-1%2Fsupport/artifacts/Q4%20deck.pptx',
    );
  });

  it('uses the last folder segment when the project path contains one', () => {
    expect(
      resolveProjectFileDownloadUrl(
        'projects/b/files/context/team/files/artifacts/report.pdf',
      ),
    ).toBe(
      '/api/v1/projects/projects%2Fb%2Ffiles%2Fcontext%2Fteam/artifacts/report.pdf',
    );
  });

  it.each([
    ['an output locator with no file name', 'projects/b/p/files/artifacts/'],
    [
      'an output locator whose name has a path',
      'projects/b/p/files/artifacts/run-1/data.csv',
    ],
    ['an output locator with no project', 'projects//files/artifacts/a.csv'],
  ])('does not resolve %s', (_, url) => {
    expect(resolveProjectFileDownloadUrl(url)).toBeUndefined();
  });

  it('lets resolveDialUrl return the artifact endpoint for an output attachment', () => {
    expect(
      resolveDialUrl(
        makeAttachment({
          name: 'report.pdf',
          url: toProjectArtifactUrl(PROJECT_ID, 'report.pdf'),
        }),
      ),
    ).toBe(
      '/api/v1/projects/projects%2Fbucket-1%2Fmarketing%2Fq4/artifacts/report.pdf',
    );
  });

  it('keeps resolving a DIAL file id exactly as before', () => {
    expect(
      resolveDialUrl(makeAttachment({ url: 'files/bucket-1/docs/report.txt' })),
    ).toBe('/api/v1/files/download?bucket=bucket-1&path=docs%2Freport.txt');
  });
});
