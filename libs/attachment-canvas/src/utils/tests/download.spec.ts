import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AttachmentContentType,
  OoxmlFileType,
} from '../../types/attachment-canvas';
import { downloadAttachmentContent, isDownloadable } from '../download';

const { mockTriggerAnchorDownload, mockTriggerBlobDownload } = vi.hoisted(
  () => ({
    mockTriggerAnchorDownload: vi.fn(),
    mockTriggerBlobDownload: vi.fn(),
  }),
);

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    triggerAnchorDownload: mockTriggerAnchorDownload,
    triggerBlobDownload: mockTriggerBlobDownload,
  };
});

const ooxmlContent = (format = OoxmlFileType.Docx) => ({
  type: AttachmentContentType.Ooxml as const,
  url: 'blob:office-url',
  format,
});

describe('OOXML download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([OoxmlFileType.Docx, OoxmlFileType.Xlsx, OoxmlFileType.Pptx])(
    'reports %s content as downloadable',
    (format) => {
      expect(isDownloadable(ooxmlContent(format))).toBe(true);
    },
  );

  it('downloads OOXML content through an anchor download of its url', () => {
    downloadAttachmentContent(ooxmlContent(), 'report.docx');

    expect(mockTriggerAnchorDownload).toHaveBeenCalledWith(
      'blob:office-url',
      'report.docx',
    );
    expect(mockTriggerBlobDownload).not.toHaveBeenCalled();
  });

  it('falls back to a default file name when none is supplied', () => {
    downloadAttachmentContent(ooxmlContent());

    expect(mockTriggerAnchorDownload).toHaveBeenCalledWith(
      'blob:office-url',
      'attachment',
    );
  });
});
