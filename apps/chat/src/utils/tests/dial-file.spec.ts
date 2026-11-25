import {
  AttachmentType,
  RequestStatus,
  type DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import {
  getDestinationPanelTexts,
  isAttachmentDownloadable,
  resolveAttachmentDownloadUrl,
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

describe('resolveAttachmentDownloadUrl', () => {
  it('resolves a DIAL file id to the files download route', () => {
    expect(resolveAttachmentDownloadUrl('files/b/docs/report.txt')).toBe(
      '/api/v1/files/download?bucket=b&path=docs%2Freport.txt',
    );
  });

  it('resolves a project file id to the project route, ignoring a fragment', () => {
    expect(
      resolveAttachmentDownloadUrl(
        'projects/b/q4/files/artifacts/report.pdf#page=2',
      ),
    ).toBe('/api/v1/projects/projects%2Fb%2Fq4/artifacts/report.pdf');
  });

  it('resolves anything else to nothing', () => {
    expect(
      resolveAttachmentDownloadUrl('https://example.com/a.pdf'),
    ).toBeUndefined();
    expect(
      resolveAttachmentDownloadUrl('projects/b/q4/files/tmp/x.csv'),
    ).toBeUndefined();
  });
});

describe('isAttachmentDownloadable', () => {
  it('offers a download for a project file a route serves', () => {
    expect(
      isAttachmentDownloadable(
        makeAttachment({ url: 'projects/b/q4/files/artifacts/run-1/data.csv' }),
      ),
    ).toBe(true);
  });

  it('offers no download for a project file outside context and artifacts', () => {
    expect(
      isAttachmentDownloadable(
        makeAttachment({ url: 'projects/b/q4/files/tmp/x.csv' }),
      ),
    ).toBe(false);
  });

  it('keeps ruling out a DIAL folder and allowing an inline attachment', () => {
    expect(
      isAttachmentDownloadable(
        makeAttachment({ url: 'files/b/New%20folder/' }),
      ),
    ).toBe(false);
    expect(isAttachmentDownloadable(makeAttachment({ url: undefined }))).toBe(
      true,
    );
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

  it('encodes every segment of the locator the way DIAL Core writes the id', () => {
    expect(toProjectContextFileUrl('projects/b/Q4 launch', 'Plan #2.md')).toBe(
      'projects/b/Q4%20launch/files/context/Plan%20%232.md',
    );
    expect(toProjectArtifactUrl('projects/b/Q4 launch', 'run-1/a#b.csv')).toBe(
      'projects/b/Q4%20launch/files/artifacts/run-1/a%23b.csv',
    );
  });

  /* Regression: a plain locator lost everything after `#` to fragment
   * stripping, so the canvas asked for `files/Plan%20` and got 400. */
  it('keeps a `#` in a file name instead of reading it as a fragment', () => {
    const attachment = makeAttachment({
      name: 'Plan #2.md',
      url: toProjectContextFileUrl(PROJECT_ID, 'Plan #2.md'),
    });

    expect(resolveDialUrl(attachment)).toBe(
      '/api/v1/projects/projects%2Fbucket-1%2Fmarketing%2Fq4/files/Plan%20%232.md',
    );
    expect(isAttachmentDownloadable(attachment)).toBe(true);
    expect(
      resolveProjectFileDownloadUrl(
        toProjectArtifactUrl(PROJECT_ID, 'report #1.md'),
      ),
    ).toBe(
      '/api/v1/projects/projects%2Fbucket-1%2Fmarketing%2Fq4/artifacts/report%20%231.md',
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

  /* `files` is a name DIAL Core reserves, so no project path holds a `files`
   * segment and the first one always ends the project id. */
  it('ends the project id at the first files segment', () => {
    expect(
      resolveProjectFileDownloadUrl(
        'projects/b/p/files/artifacts/files/artifacts/x.csv',
      ),
    ).toBe(
      '/api/v1/projects/projects%2Fb%2Fp/artifacts/files%2Fartifacts%2Fx.csv',
    );
  });

  it('maps a nested output to the artifact route with its whole relative path', () => {
    expect(
      resolveProjectFileDownloadUrl(
        'projects/bucket-1/support/files/artifacts/run-1/data.csv',
      ),
    ).toBe(
      '/api/v1/projects/projects%2Fbucket-1%2Fsupport/artifacts/run-1%2Fdata.csv',
    );
  });

  it.each([
    ['an output locator with no file name', 'projects/b/p/files/artifacts/'],
    [
      'an output locator with an empty segment',
      'projects/b/p/files/artifacts/run-1//data.csv',
    ],
    ['an output locator with no project', 'projects//files/artifacts/a.csv'],
    ['a file outside context and artifacts', 'projects/b/p/files/tmp/x.csv'],
    [
      'a locator with a malformed escape',
      'projects/b/p/files/artifacts/%E0%A4%A.csv',
    ],
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

  describe('DIAL Core percent-encoded project file ids', () => {
    it('does not encode an output id twice', () => {
      expect(
        resolveProjectFileDownloadUrl(
          'projects/bucket-1/Q4%20launch/files/artifacts/report%20v2.md',
        ),
      ).toBe(
        '/api/v1/projects/projects%2Fbucket-1%2FQ4%20launch/artifacts/report%20v2.md',
      );
    });

    it('maps the same output written unencoded to the same URL', () => {
      expect(
        resolveProjectFileDownloadUrl(
          'projects/bucket-1/Q4 launch/files/artifacts/report v2.md',
        ),
      ).toBe(
        resolveProjectFileDownloadUrl(
          'projects/bucket-1/Q4%20launch/files/artifacts/report%20v2.md',
        ),
      );
    });

    it('does not encode a context file id twice', () => {
      expect(
        resolveProjectFileDownloadUrl(
          'projects/bucket-1/Q4%20launch/files/context/Q4%20tickets.csv',
        ),
      ).toBe(
        '/api/v1/projects/projects%2Fbucket-1%2FQ4%20launch/files/Q4%20tickets.csv',
      );
    });

    it('lets resolveDialUrl resolve a generated attachment of a project chat', () => {
      expect(
        resolveDialUrl(
          makeAttachment({
            name: 'report v2.md',
            url: 'projects/a1b2c3/Q4%20launch/files/artifacts/report%20v2.md',
          }),
        ),
      ).toBe(
        '/api/v1/projects/projects%2Fa1b2c3%2FQ4%20launch/artifacts/report%20v2.md',
      );
    });
  });

  it('keeps resolving a DIAL file id exactly as before', () => {
    expect(
      resolveDialUrl(makeAttachment({ url: 'files/bucket-1/docs/report.txt' })),
    ).toBe('/api/v1/files/download?bucket=bucket-1&path=docs%2Freport.txt');
  });
});

describe('getDestinationPanelTexts', () => {
  it('keeps the {query} placeholder the destination panel fills', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: 'en',
      resources: {
        en: {
          translation: {
            catalog: {
              publishFolderEmptyState: 'No folders match "{{query}}".',
            },
          },
        },
      },
    });

    expect(getDestinationPanelTexts(i18n.t).folderEmptyStateLabel).toBe(
      'No folders match "{query}".',
    );
  });
});
