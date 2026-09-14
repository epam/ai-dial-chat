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

const makeMultiImageEvent = (count: number) => {
  const items = Array.from({ length: count }, () => ({
    kind: 'file',
    type: 'image/png',
    getAsFile: () => new Blob(['img'], { type: 'image/png' }),
  }));
  return {
    clipboardData: {
      items: items as unknown as DataTransferItemList,
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

  it('stamps a pasted image name with the paste time, keeping base and extension', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 14, 9, 5, 3));
    const onAttachments = vi.fn();
    const { result } = renderHook(() => useClipboardPaste(onAttachments, 100));

    result.current.handlePaste(makeImageEvent());

    expect(onAttachments.mock.calls[0][0][0].name).toBe(
      'Screenshot 2026-09-14 09-05-03.png',
    );
    vi.useRealTimers();
  });

  it('gives each image of a multi-image paste a distinct name', () => {
    const onAttachments = vi.fn();
    const { result } = renderHook(() => useClipboardPaste(onAttachments, 100));

    result.current.handlePaste(makeMultiImageEvent(2));

    const [first, second] = onAttachments.mock.calls[0][0];
    expect(first.name).not.toBe(second.name);
    expect(second.name).toContain(' (2).png');
  });

  it('gives images pasted at different times distinct names', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 14, 9, 5, 3));
    const onAttachments = vi.fn();
    const { result } = renderHook(() => useClipboardPaste(onAttachments, 100));

    result.current.handlePaste(makeImageEvent());
    vi.setSystemTime(new Date(2026, 8, 14, 9, 5, 4));
    result.current.handlePaste(makeImageEvent());

    expect(onAttachments.mock.calls[0][0][0].name).not.toBe(
      onAttachments.mock.calls[1][0][0].name,
    );
    vi.useRealTimers();
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
    const event = makeImageWithTextEvent(
      'This text is longer than ten characters',
    );
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
