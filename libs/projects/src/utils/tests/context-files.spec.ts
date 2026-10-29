import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { StoredProjectContextFile } from '../../models/project-context-file';
import { ContextFileRejection } from '../../types/context-file-rejection';
import {
  checkContextFiles,
  filterContextFileItems,
  getContextFilesSize,
  isStoredContextFile,
} from '../context-files';

const limits = {
  allowedExtensions: ['csv', 'pdf', 'xlsx'],
  maxFileBytes: 10,
  maxTotalBytes: 20,
};

const makeFile = (name: string, size: number, type = '') =>
  new File(['x'.repeat(size)], name, { type });

describe('checkContextFiles', () => {
  it('accepts allowed files and shapes them as staged attachments', () => {
    const file = makeFile('tickets.csv', 4, 'text/csv');

    const { accepted, rejected } = checkContextFiles([file], [], limits);

    expect(rejected).toEqual([]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({
      name: 'tickets.csv',
      contentType: 'text/csv',
      status: RequestStatus.Idle,
      file,
    });
    expect(accepted[0].id).toBeTruthy();
  });

  it('infers the content type from the extension when the browser gives none', () => {
    const { accepted } = checkContextFiles(
      [makeFile('report.pdf', 2)],
      [],
      limits,
    );

    expect(accepted[0].contentType).toBe('application/pdf');
  });

  it('matches the extension case-insensitively', () => {
    const { accepted } = checkContextFiles(
      [makeFile('REPORT.PDF', 2)],
      [],
      limits,
    );

    expect(accepted).toHaveLength(1);
  });

  it.each([
    ['notes.docx', 2, ContextFileRejection.UnsupportedType],
    ['noextension', 2, ContextFileRejection.UnsupportedType],
    ['big.csv', 11, ContextFileRejection.TooLarge],
    ['a:b.csv', 2, ContextFileRejection.InvalidName],
    ['files', 2, ContextFileRejection.InvalidName],
    [' padded.csv', 2, ContextFileRejection.InvalidName],
  ])('rejects %s as %s', (name, size, reason) => {
    const { accepted, rejected } = checkContextFiles(
      [makeFile(name, size)],
      [],
      limits,
    );

    expect(accepted).toEqual([]);
    expect(rejected).toEqual([{ name, reason }]);
  });

  it('rejects a name already added', () => {
    const [existing] = checkContextFiles(
      [makeFile('a.csv', 2)],
      [],
      limits,
    ).accepted;

    const { rejected } = checkContextFiles(
      [makeFile('a.csv', 2)],
      [existing],
      limits,
    );

    expect(rejected).toEqual([
      { name: 'a.csv', reason: ContextFileRejection.Duplicate },
    ]);
  });

  it('rejects a duplicate within the same batch', () => {
    const { accepted, rejected } = checkContextFiles(
      [makeFile('a.csv', 2), makeFile('a.csv', 3)],
      [],
      limits,
    );

    expect(accepted).toHaveLength(1);
    expect(rejected).toEqual([
      { name: 'a.csv', reason: ContextFileRejection.Duplicate },
    ]);
  });

  it('counts the running total within one batch against the capacity', () => {
    const { accepted, rejected } = checkContextFiles(
      [makeFile('a.csv', 10), makeFile('b.csv', 10), makeFile('c.csv', 1)],
      [],
      limits,
    );

    expect(accepted.map((attachment) => attachment.name)).toEqual([
      'a.csv',
      'b.csv',
    ]);
    expect(rejected).toEqual([
      { name: 'c.csv', reason: ContextFileRejection.CapacityExceeded },
    ]);
  });

  it('counts the existing files against the capacity', () => {
    const existing = checkContextFiles(
      [makeFile('a.csv', 10), makeFile('b.csv', 9)],
      [],
      limits,
    ).accepted;

    const { rejected } = checkContextFiles(
      [makeFile('c.csv', 2)],
      existing,
      limits,
    );

    expect(getContextFilesSize(existing)).toBe(19);
    expect(rejected[0].reason).toBe(ContextFileRejection.CapacityExceeded);
  });

  it('gives every accepted file a distinct id', () => {
    const { accepted } = checkContextFiles(
      [makeFile('a.csv', 1), makeFile('b.csv', 1)],
      [],
      limits,
    );

    expect(accepted[0].id).not.toBe(accepted[1].id);
  });
});

const stored = (name: string, size: number): StoredProjectContextFile => ({
  id: `stored:${name}`,
  name,
  size,
  contentType: 'text/csv',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  isStored: true,
});

describe('stored context files', () => {
  it('counts a stored file by its stored size', () => {
    const added = checkContextFiles(
      [makeFile('a.csv', 3)],
      [],
      limits,
    ).accepted;

    expect(getContextFilesSize([stored('s.csv', 15), ...added])).toBe(18);
  });

  it('rejects an incoming file that would exceed the capacity with stored files', () => {
    const { rejected } = checkContextFiles(
      [makeFile('more.csv', 6)],
      [stored('s.csv', 15)],
      limits,
    );

    expect(rejected).toEqual([
      { name: 'more.csv', reason: ContextFileRejection.CapacityExceeded },
    ]);
  });

  it('rejects an incoming file named like a stored one', () => {
    const { rejected } = checkContextFiles(
      [makeFile('s.csv', 1)],
      [stored('s.csv', 1)],
      limits,
    );

    expect(rejected[0].reason).toBe(ContextFileRejection.Duplicate);
  });

  it('tells stored files from newly added ones', () => {
    const [added] = checkContextFiles(
      [makeFile('a.csv', 1)],
      [],
      limits,
    ).accepted;

    expect(isStoredContextFile(stored('s.csv', 1))).toBe(true);
    expect(isStoredContextFile(added)).toBe(false);
  });
});

describe('filterContextFileItems', () => {
  const files = [{ name: 'tickets.csv' }, { name: 'Survey.xlsx' }];

  it('keeps names containing the trimmed query, ignoring case', () => {
    expect(filterContextFileItems(files, '  survey ')).toEqual([
      { name: 'Survey.xlsx' },
    ]);
  });

  it('returns every file for a blank query', () => {
    expect(filterContextFileItems(files, '  ')).toBe(files);
  });
});
