import {
  AttachmentType,
  RequestStatus,
  type Attachment,
} from '@epam/ai-dial-chat-shared';
import type { ProjectContextFile } from '@epam/ai-dial-projects';
import { describe, expect, it, vi } from 'vitest';
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
/* A host-owned locator scheme: the lib only passes the project id and file name through. */
const toLocator = vi.fn(
  (projectId: string, name: string) => `${projectId}/locator/${name}`,
);

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

  it('builds an idle attachment whose url is the locator the host built', () => {
    expect(
      toProjectOutputAttachment(
        { name: 'report.pdf', contentType: 'application/pdf' },
        PROJECT_ID,
        toLocator,
      ),
    ).toEqual({
      id: 'report.pdf',
      name: 'report.pdf',
      contentType: 'application/pdf',
      type: AttachmentType.File,
      status: RequestStatus.Idle,
      url: 'projects/b/q4/locator/report.pdf',
    });
    expect(toLocator).toHaveBeenCalledWith(PROJECT_ID, 'report.pdf');
  });
});

describe('toStoredProjectFileAttachment', () => {
  it('builds an idle attachment whose url is the locator the host built and whose type follows the content type', () => {
    expect(
      toStoredProjectFileAttachment(
        { id: 'chart.png', name: 'chart.png', contentType: 'image/png' },
        PROJECT_ID,
        toLocator,
      ),
    ).toEqual({
      id: 'chart.png',
      name: 'chart.png',
      contentType: 'image/png',
      type: AttachmentType.Image,
      status: RequestStatus.Idle,
      url: 'projects/b/q4/locator/chart.png',
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

  it('hands a file added in this session over as it is, with its File and no locator call', () => {
    toLocator.mockClear();

    expect(toProjectContextFileAttachment(newFile, null, toLocator)).toBe(
      newFile,
    );
    expect(toLocator).not.toHaveBeenCalled();
  });

  it('builds a stored file from its project, under its card id', () => {
    expect(
      toProjectContextFileAttachment(storedFile, PROJECT_ID, toLocator),
    ).toMatchObject({
      id: 'stored:old.csv',
      name: 'old.csv',
      url: 'projects/b/q4/locator/old.csv',
    });
  });

  it('has nothing to open for a stored file without a project', () => {
    expect(
      toProjectContextFileAttachment(storedFile, null, toLocator),
    ).toBeUndefined();
  });
});
