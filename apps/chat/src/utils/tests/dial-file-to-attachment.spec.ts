import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { DialFileNodeType, type DialFile } from '@epam/ai-dial-ui-kit';
import { describe, expect, it } from 'vitest';
import {
  dialFileToAttachment,
  dialFilesToAttachments,
} from '../dial-file-to-attachment';

const makeFile = (overrides: Partial<DialFile> = {}): DialFile => ({
  id: 'reports/q1.pdf',
  name: 'q1.pdf',
  path: '/My files/reports/q1.pdf',
  folderId: 'bucket',
  nodeType: DialFileNodeType.ITEM,
  contentType: 'application/pdf',
  ...overrides,
});

describe('dialFileToAttachment', () => {
  it('maps a selected storage file to an already-uploaded attachment', () => {
    expect(dialFileToAttachment(makeFile(), 'my-bucket')).toEqual(
      expect.objectContaining({
        id: 'files/my-bucket/reports/q1.pdf',
        name: 'q1.pdf',
        contentType: 'application/pdf',
        type: AttachmentType.File,
        status: RequestStatus.Idle,
        url: 'files/my-bucket/reports/q1.pdf',
      }),
    );
  });

  it('keeps the DIAL URL returned by file storage', () => {
    expect(
      dialFileToAttachment(
        makeFile({ url: 'files/my-bucket/reports/q1.pdf' }),
        'my-bucket',
      )?.url,
    ).toBe('files/my-bucket/reports/q1.pdf');
  });

  it('skips folders', () => {
    expect(
      dialFilesToAttachments(
        [makeFile({ nodeType: DialFileNodeType.FOLDER })],
        'my-bucket',
      ),
    ).toEqual([]);
  });
});
