import { AttachmentType } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { ClipboardEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClipboardPaste } from '../useClipboardPaste';

const makeTextEvent = (text: string) =>
  ({
    clipboardData: {
      items: [] as unknown as DataTransferItemList,
      getData: () => text,
    },
    preventDefault: vi.fn(),
  }) as unknown as ClipboardEvent<HTMLTextAreaElement>;

const makeImageEvent = () => {
  const blob = new Blob(['img'], { type: 'image/png' });
  const item = { kind: 'file', type: 'image/png', getAsFile: () => blob };
  return {
    clipboardData: {
      items: [item] as unknown as DataTransferItemList,
      getData: () => '',
    },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent<HTMLTextAreaElement>;
};

const makeImageWithTextEvent = (text: string) => {
  const blob = new Blob(['img'], { type: 'image/png' });
  const item = { kind: 'file', type: 'image/png', getAsFile: () => blob };
  return {
    clipboardData: {
      items: [item] as unknown as DataTransferItemList,
      getData: () => text,
    },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent<HTMLTextAreaElement>;
};

describe('useClipboardPaste', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('handles null clipboardData without throwing', () => {
    const { result } = renderHook(() => useClipboardPaste(vi.fn(), 100));
    expect(() =>
      result.current.handlePaste({
        clipboardData: null,
      } as unknown as ClipboardEvent<HTMLTextAreaElement>),
    ).not.toThrow();
  });

  it('image paste creates an Image attachment and prevents default', () => {
    const onAttachments = vi.fn();
    const { result } = renderHook(() => useClipboardPaste(onAttachments, 100));
    const event = makeImageEvent();
    result.current.handlePaste(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onAttachments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: AttachmentType.Image,
          previewUrl: 'blob:mock',
        }),
      ]),
    );
  });

  it('long text creates a Pasted attachment with preview name', () => {
    const onAttachments = vi.fn();
    const { result } = renderHook(() => useClipboardPaste(onAttachments, 10));
    const text = 'This text is longer than ten characters';
    const event = makeTextEvent(text);
    result.current.handlePaste(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onAttachments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: AttachmentType.Pasted, name: text }),
      ]),
    );
  });

  it('preview name is truncated to 80 chars with ellipsis when text is very long', () => {
    const onAttachments = vi.fn();
    const { result } = renderHook(() => useClipboardPaste(onAttachments, 5));
    result.current.handlePaste(makeTextEvent('a'.repeat(100)));
    const attachment = onAttachments.mock.calls[0][0][0];
    expect(attachment.name.endsWith('…')).toBe(true);
    expect([...attachment.name].length).toBe(81); // 80 chars + ellipsis character
  });

  it('ignores the image and pastes text when clipboard contains both image and text', () => {
    const onAttachments = vi.fn();
    const { result } = renderHook(() => useClipboardPaste(onAttachments, 10));
    const event = makeImageWithTextEvent('This text is longer than ten characters');
    result.current.handlePaste(event);
    expect(onAttachments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: AttachmentType.Pasted }),
      ]),
    );
    expect(onAttachments).not.toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: AttachmentType.Image }),
      ]),
    );
  });

  it('short text does not create an attachment', () => {
    const onAttachments = vi.fn();
    const { result } = renderHook(() => useClipboardPaste(onAttachments, 100));
    result.current.handlePaste(makeTextEvent('short'));
    expect(onAttachments).not.toHaveBeenCalled();
  });
});
