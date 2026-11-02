import {
  AttachmentContentType,
  AttachmentErrorType,
} from '@epam/ai-dial-attachment-canvas';
import { resolveTextCanvasContent } from '@epam/ai-dial-chat-hooks';
import {
  AttachmentType,
  RequestStatus,
  type Attachment,
} from '@epam/ai-dial-chat-shared';
import type { ProjectContextFile } from '@epam/ai-dial-projects';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachmentCanvasUrlResolvers } from '../attachment-display-resolvers';
import {
  fromProjectOutputCardId,
  fromProjectPreviewKey,
  toProjectContextFileAttachment,
  toProjectOutputAttachment,
  toProjectOutputCardId,
  toProjectPreviewKey,
  toStoredProjectFileAttachment,
} from '../project-file-preview';

const PROJECT_ID = 'projects/b/q4';

describe('project preview keys', () => {
  it('prefixes the card id with its scope', () => {
    expect(toProjectPreviewKey(PROJECT_ID, 'tickets.csv')).toBe(
      'projects/b/q4::tickets.csv',
    );
  });

  it('reads the card id back for the same scope', () => {
    expect(
      fromProjectPreviewKey(PROJECT_ID, 'projects/b/q4::tickets.csv'),
    ).toBe('tickets.csv');
  });

  it('keeps a card id that itself contains the separator', () => {
    expect(fromProjectPreviewKey('new', 'new::stored:a::b.csv')).toBe(
      'stored:a::b.csv',
    );
  });

  it.each([
    ['another scope', 'projects/b/other::tickets.csv'],
    ['a key that is not a project key', '0:abc'],
    ['no key', undefined],
  ])('returns nothing for %s', (_, key) => {
    expect(fromProjectPreviewKey(PROJECT_ID, key)).toBeUndefined();
  });
});

describe('project output cards', () => {
  it('prefixes an output name so it never matches a context file name', () => {
    const key = toProjectPreviewKey(
      PROJECT_ID,
      toProjectOutputCardId('notes.md'),
    );

    expect(key).toBe('projects/b/q4::artifacts/notes.md');
    expect(fromProjectPreviewKey(PROJECT_ID, key)).not.toBe('notes.md');
    expect(
      fromProjectOutputCardId(fromProjectPreviewKey(PROJECT_ID, key)),
    ).toBe('notes.md');
  });

  it.each([
    ['a context file card id', 'notes.md'],
    ['no card id', undefined],
  ])('reads no output name from %s', (_, cardId) => {
    expect(fromProjectOutputCardId(cardId)).toBeUndefined();
  });

  it('builds an idle attachment whose url is the output locator', () => {
    expect(
      toProjectOutputAttachment(
        { name: 'report.pdf', contentType: 'application/pdf' },
        PROJECT_ID,
      ),
    ).toEqual({
      id: 'report.pdf',
      name: 'report.pdf',
      contentType: 'application/pdf',
      type: AttachmentType.File,
      status: RequestStatus.Idle,
      url: 'projects/b/q4/files/artifacts/report.pdf',
    });
  });
});

describe('toStoredProjectFileAttachment', () => {
  it('builds an idle attachment whose url is the context file locator', () => {
    expect(
      toStoredProjectFileAttachment(
        { id: 'tickets.csv', name: 'tickets.csv', contentType: 'text/csv' },
        PROJECT_ID,
      ),
    ).toEqual({
      id: 'tickets.csv',
      name: 'tickets.csv',
      contentType: 'text/csv',
      type: AttachmentType.File,
      status: RequestStatus.Idle,
      url: 'projects/b/q4/files/context/tickets.csv',
    });
  });
});

describe('toProjectContextFileAttachment', () => {
  const newFile: Attachment = {
    id: 'new-1',
    name: 'new.txt',
    contentType: 'text/plain',
    type: AttachmentType.File,
    status: RequestStatus.Idle,
    file: new File(['x'], 'new.txt', { type: 'text/plain' }),
  };
  const storedFile: ProjectContextFile = {
    id: 'stored:old.csv',
    name: 'old.csv',
    size: 10,
    contentType: 'text/csv',
    type: AttachmentType.File,
    status: RequestStatus.Idle,
    isStored: true,
  };

  it('hands a file added in this session over as it is, with its File', () => {
    expect(toProjectContextFileAttachment(newFile, null)).toBe(newFile);
  });

  it('builds a stored file from its project, under its card id', () => {
    expect(
      toProjectContextFileAttachment(storedFile, PROJECT_ID),
    ).toMatchObject({
      id: 'stored:old.csv',
      name: 'old.csv',
      url: 'projects/b/q4/files/context/old.csv',
    });
  });

  it('has nothing to open for a stored file without a project', () => {
    expect(toProjectContextFileAttachment(storedFile, null)).toBeUndefined();
  });
});

/*
 * The point of building a locator instead of loading the bytes in the page:
 * the shared canvas content resolvers the chat uses fetch it, and classify
 * its failures the way they do for any DIAL file.
 */
describe('a stored project file through the shared canvas resolvers', () => {
  const attachment = toStoredProjectFileAttachment(
    { id: 'notes.txt', name: 'notes.txt', contentType: 'text/plain' },
    PROJECT_ID,
  );

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches the project file endpoint and returns its text', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('hello', { status: 200 }));

    const content = await resolveTextCanvasContent(
      attachment,
      attachmentCanvasUrlResolvers,
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/projects/projects%2Fb%2Fq4/files/notes.txt',
    );
    expect(content).toEqual({
      type: AttachmentContentType.PlainText,
      text: 'hello',
    });
  });

  it('answers 403 with the forbidden state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 403 }),
    );

    expect(
      await resolveTextCanvasContent(attachment, attachmentCanvasUrlResolvers),
    ).toMatchObject({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.Forbidden,
    });
  });

  it.each([
    [
      'a 502 response',
      () => Promise.resolve(new Response('', { status: 502 })),
    ],
    ['a network failure', () => Promise.reject(new TypeError('offline'))],
  ])('answers %s with the load-error state', async (_, respond) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(respond);

    expect(
      await resolveTextCanvasContent(attachment, attachmentCanvasUrlResolvers),
    ).toMatchObject({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.LoadFailed,
    });
  });
});
