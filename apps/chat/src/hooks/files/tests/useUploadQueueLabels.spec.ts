import { FileUploadFailureReason } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialFileManagerI18nKeys } from '../../../constants/translation-keys';
import { useUploadQueueLabels } from '../useUploadQueueLabels';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

vi.mock('../../useTransferQueueLabels', () => ({
  useTransferQueueLabels: () => ({}),
}));

const appConfig = vi.hoisted(() => ({
  maxAttachmentFileSizeBytes: 536_870_912 as number | undefined,
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({ config: appConfig }),
}));

describe('useUploadQueueLabels', () => {
  beforeEach(() => {
    appConfig.maxAttachmentFileSizeBytes = 536_870_912;
  });

  it('names the configured maximum size on a too-large row', () => {
    const { result } = renderHook(() => useUploadQueueLabels());

    expect(
      result.current.uploadFailureMessages?.[FileUploadFailureReason.TooLarge],
    ).toBe(
      `${DialFileManagerI18nKeys.UploadFileTooLarge}:{"maxSize":"512 MB"}`,
    );
  });

  it('falls back to the generic too-large message when no limit is configured', () => {
    appConfig.maxAttachmentFileSizeBytes = 0;

    const { result } = renderHook(() => useUploadQueueLabels());

    expect(
      result.current.uploadFailureMessages?.[FileUploadFailureReason.TooLarge],
    ).toBe(DialFileManagerI18nKeys.UploadFailedTooLarge);
  });

  it('titles the queue for uploads, downloads, or both', () => {
    const { result } = renderHook(() => useUploadQueueLabels());
    const title = result.current.getTransferQueueTitle;

    expect(title?.({ uploads: 2, downloads: 0 })).toBe(
      `${DialFileManagerI18nKeys.UploadQueueTitle}:{"count":2}`,
    );
    expect(title?.({ uploads: 0, downloads: 1 })).toBe(
      `${DialFileManagerI18nKeys.DownloadQueueTitle}:{"count":1}`,
    );
    expect(title?.({ uploads: 2, downloads: 1 })).toBe(
      `${DialFileManagerI18nKeys.TransferQueueTitle}:{"count":3}`,
    );
  });

  it('words download rows as downloads', () => {
    const { result } = renderHook(() => useUploadQueueLabels());

    expect(
      result.current.downloadQueueLabels?.cancelItemAriaLabel?.('a.pdf'),
    ).toBe(
      `${DialFileManagerI18nKeys.DownloadQueueCancelFileAriaLabel}:{"fileName":"a.pdf"}`,
    );
    expect(result.current.transferQueueProgressAriaLabel).toBe(
      DialFileManagerI18nKeys.TransferQueueProgressAriaLabel,
    );
  });
});
