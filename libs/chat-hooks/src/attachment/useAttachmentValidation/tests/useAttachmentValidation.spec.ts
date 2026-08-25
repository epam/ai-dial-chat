import {
  AttachmentErrorReason,
  type Attachment,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AttachmentValidationErrorReason,
  useAttachmentValidation,
} from '../useAttachmentValidation';

const makeAttachment = (contentType: string): Attachment =>
  ({ contentType, name: 'file', file: new File([], 'file') }) as Attachment;

describe('useAttachmentValidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows a supported file', () => {
    const { result } = renderHook(() =>
      useAttachmentValidation({ allowedMimeTypes: ['image/png'] }),
    );

    expect(result.current.validateAttachment(makeAttachment('image/png'))).toBe(
      undefined,
    );
    expect(result.current.isAttachmentsAllowed).toBe(true);
  });

  it('rejects an unsupported file and reports it after the debounce window', () => {
    const onValidationError = vi.fn();
    const { result } = renderHook(() =>
      useAttachmentValidation({
        allowedMimeTypes: ['image/png'],
        onValidationError,
      }),
    );

    const reason = result.current.validateAttachment(
      makeAttachment('application/pdf'),
    );
    expect(reason).toBe(AttachmentErrorReason.UnsupportedType);
    expect(onValidationError).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onValidationError).toHaveBeenCalledOnce();
    expect(onValidationError).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: AttachmentValidationErrorReason.UnsupportedType,
        allowedMimeTypes: ['image/png'],
      }),
    );
  });

  it('reports NoTypesAllowed when no MIME types are allowed', () => {
    const onValidationError = vi.fn();
    const { result } = renderHook(() =>
      useAttachmentValidation({ allowedMimeTypes: [], onValidationError }),
    );

    result.current.validateAttachment(makeAttachment('image/png'));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isAttachmentsAllowed).toBe(false);
    expect(onValidationError).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: AttachmentValidationErrorReason.NoTypesAllowed,
      }),
    );
  });

  it('replaces a pending timer instead of firing once per rejected file', () => {
    const onValidationError = vi.fn();
    const { result } = renderHook(() =>
      useAttachmentValidation({
        allowedMimeTypes: ['image/png'],
        onValidationError,
      }),
    );

    result.current.validateAttachment(makeAttachment('application/pdf'));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    result.current.validateAttachment(makeAttachment('text/csv'));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onValidationError).toHaveBeenCalledOnce();
  });

  it('clears the pending timer on unmount so no callback fires afterward', () => {
    const onValidationError = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAttachmentValidation({
        allowedMimeTypes: ['image/png'],
        onValidationError,
      }),
    );

    result.current.validateAttachment(makeAttachment('application/pdf'));
    unmount();
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onValidationError).not.toHaveBeenCalled();
  });

  it('derives fileAccept from allowed MIME types, undefined when any type accepts everything', () => {
    const { result: constrained } = renderHook(() =>
      useAttachmentValidation({ allowedMimeTypes: ['image/png', 'text/csv'] }),
    );
    expect(constrained.current.fileAccept).toBe('image/png,text/csv');

    const { result: wildcard } = renderHook(() =>
      useAttachmentValidation({ allowedMimeTypes: ['*'] }),
    );
    expect(wildcard.current.fileAccept).toBeUndefined();
  });

  it('recomputes fileAccept/isAttachmentsAllowed when allowedMimeTypes changes', () => {
    const { result, rerender } = renderHook(
      ({ allowedMimeTypes }: { allowedMimeTypes: string[] }) =>
        useAttachmentValidation({ allowedMimeTypes }),
      { initialProps: { allowedMimeTypes: [] as string[] } },
    );

    expect(result.current.isAttachmentsAllowed).toBe(false);

    rerender({ allowedMimeTypes: ['image/png'] });

    expect(result.current.isAttachmentsAllowed).toBe(true);
    expect(result.current.fileAccept).toBe('image/png');
  });

  it('keeps validateAttachment stable across re-renders with unchanged props', () => {
    const onValidationError = vi.fn();
    const allowedMimeTypes = ['image/png'];
    const { result, rerender } = renderHook(() =>
      useAttachmentValidation({
        allowedMimeTypes,
        onValidationError,
      }),
    );

    const first = result.current.validateAttachment;
    rerender();
    expect(result.current.validateAttachment).toBe(first);
  });
});
