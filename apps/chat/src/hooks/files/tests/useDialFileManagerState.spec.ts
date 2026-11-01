import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveCatalogIconUrl } from '../../../utils/icon-path';
import { useDialFileManagerState } from '../useDialFileManagerState';

vi.mock('../../../utils/icon-path', () => ({
  resolveCatalogIconUrl: vi.fn(() => 'preview'),
}));

describe('useDialFileManagerState', () => {
  it('maps files and folders, closes on attach and consumes results before reopening', () => {
    const resolvePreviewUrl = vi.mocked(resolveCatalogIconUrl);
    const { result } = renderHook(() => useDialFileManagerState('bucket'));
    act(() => result.current.openModal());
    expect(result.current.isOpen).toBe(true);
    act(() =>
      result.current.handleAttach({
        files: [
          {
            folderId: '',
            id: 'files/bucket/image.png',
            path: '/image.png',
            name: 'image.png',
            nodeType: DialFileNodeType.ITEM,
            contentType: 'image/png',
          },
        ],
        folderPaths: ['files/bucket/folder'],
      }),
    );
    expect(result.current.isOpen).toBe(false);
    expect(result.current.pendingAttachments).toHaveLength(2);
    expect(result.current.pendingAttachments[0].previewUrl).toBe('preview');
    expect(resolvePreviewUrl).toHaveBeenCalledWith('files/bucket/image.png');
    act(() => result.current.clearPendingAttachments());
    act(() => result.current.openModal());
    expect(result.current.pendingAttachments).toEqual([]);
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.closeModal());
    expect(result.current.isOpen).toBe(false);
  });
});
