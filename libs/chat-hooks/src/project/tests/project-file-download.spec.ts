import {
  AttachmentType,
  RequestStatus,
  triggerAnchorDownload,
  triggerBlobDownload,
  type Attachment,
  type DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadProjectFileAttachment } from '../project-file-preview';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  triggerAnchorDownload: vi.fn(),
  triggerBlobDownload: vi.fn(),
}));

const storedFile: DisplayAttachment = {
  id: 'tickets.csv',
  name: 'tickets.csv',
  contentType: 'text/csv',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  url: 'projects/b/q4/files/context/tickets.csv',
};

const resolveDownloadUrl = vi.fn((locator: string) =>
  locator.startsWith('projects/') ? `/api/${locator}` : undefined,
);

describe('downloadProjectFileAttachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads a stored file from the URL the host resolves for its locator', () => {
    expect(downloadProjectFileAttachment(storedFile, resolveDownloadUrl)).toBe(
      true,
    );

    expect(resolveDownloadUrl).toHaveBeenCalledWith(
      'projects/b/q4/files/context/tickets.csv',
    );
    expect(triggerAnchorDownload).toHaveBeenCalledWith(
      '/api/projects/b/q4/files/context/tickets.csv',
      'tickets.csv',
    );
    expect(triggerBlobDownload).not.toHaveBeenCalled();
  });

  it('downloads a file added in this session from its own File without resolving a URL', () => {
    const file = new File(['a,b'], 'draft.csv', { type: 'text/csv' });
    const added: Attachment = {
      ...storedFile,
      id: 'draft',
      name: 'draft.csv',
      url: undefined,
      file,
    };

    expect(downloadProjectFileAttachment(added, resolveDownloadUrl)).toBe(true);

    expect(triggerBlobDownload).toHaveBeenCalledWith(file, 'draft.csv');
    expect(resolveDownloadUrl).not.toHaveBeenCalled();
    expect(triggerAnchorDownload).not.toHaveBeenCalled();
  });

  it('starts no download when the host resolves no URL', () => {
    expect(
      downloadProjectFileAttachment(
        { ...storedFile, url: 'files/b/other.csv' },
        resolveDownloadUrl,
      ),
    ).toBe(false);
    expect(triggerAnchorDownload).not.toHaveBeenCalled();
  });

  it('starts no download for a stored file when the host passes no resolver', () => {
    expect(downloadProjectFileAttachment(storedFile, undefined)).toBe(false);
    expect(triggerAnchorDownload).not.toHaveBeenCalled();
  });
});
