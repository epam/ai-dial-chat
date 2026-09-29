import type { AttachResult } from '@epam/ai-dial-chat-shared';
import { DialFileNodeType, type DialFile } from '@epam/ai-dial-ui-kit';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
} from '../../../constants/files';
import { EditorI18nKeys } from '../../../constants/translation-keys';
import { useApplicationAvatarPicker } from '../useApplicationAvatarPicker';

vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'user-bucket' } }),
}));

vi.mock(
  '../../../components/DialFileManagerModal/DialFileManagerModal',
  () => ({
    default: () => null,
  }),
);

const attach = (files: unknown[]): AttachResult =>
  ({ files, folderPaths: [] }) as unknown as AttachResult;

describe('useApplicationAvatarPicker', () => {
  it('wires the user bucket and the avatar file limits', () => {
    const { result } = renderHook(() => useApplicationAvatarPicker());

    expect(result.current.avatarPicker.bucket).toBe('user-bucket');
    expect(result.current.avatarPicker.allowedMimeTypes).toBe(
      AVATAR_ALLOWED_MIME_TYPES,
    );
    expect(result.current.avatarPicker.maxFileSizeBytes).toBe(
      AVATAR_MAX_FILE_SIZE_BYTES,
    );
    expect(result.current.avatarPickerLabels.title).toBe(
      EditorI18nKeys.AddAvatarButtonLabel,
    );
  });

  it('resolves a picked absolute-URL file to its URL', () => {
    const { result } = renderHook(() => useApplicationAvatarPicker());
    const file = {
      nodeType: DialFileNodeType.ITEM,
      name: 'icon.png',
      contentType: 'image/png',
      url: 'https://files.example.com/icon.png',
    } as unknown as DialFile;

    expect(
      result.current.avatarPicker.resolveAttachedIconUrl(attach([file])),
    ).toBe('https://files.example.com/icon.png');
  });

  it('resolves nothing when the picker attaches no file', () => {
    const { result } = renderHook(() => useApplicationAvatarPicker());

    expect(
      result.current.avatarPicker.resolveAttachedIconUrl(attach([])),
    ).toBeUndefined();
  });

  it('returns the same wiring across re-renders', () => {
    const { result, rerender } = renderHook(() => useApplicationAvatarPicker());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
