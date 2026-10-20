import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

describe('useUploadQueueLabels', () => {
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
