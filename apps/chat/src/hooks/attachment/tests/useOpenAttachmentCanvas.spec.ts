import { AttachmentType } from '@epam/ai-dial-chat-shared';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOpenAttachmentCanvas } from '../useOpenAttachmentCanvas';

const mockOpenCanvas = vi.fn();

vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>();
  return {
    ...actual,
    useAttachmentCanvas: () => ({ openCanvas: mockOpenCanvas }),
  };
});

const mockResolveMarkdown = vi.fn();
const mockResolveJson = vi.fn();
const mockResolveText = vi.fn();

vi.mock('../../../utils/attachment-canvas', () => ({
  resolveImageCanvasContent: vi.fn(),
  resolveMarkdownCanvasContent: (...args: unknown[]) =>
    mockResolveMarkdown(...args),
  resolveJsonCanvasContent: (...args: unknown[]) => mockResolveJson(...args),
  resolveTextCanvasContent: (...args: unknown[]) => mockResolveText(...args),
}));

const makeAttachment = (
  name: string,
  contentType = 'text/plain',
): DisplayAttachment =>
  ({
    id: name,
    name,
    contentType,
    type: AttachmentType.File,
    url: `files/bucket/path/${name}`,
  }) as DisplayAttachment;

describe('useOpenAttachmentCanvas routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes .md attachments to the markdown resolver', async () => {
    mockResolveMarkdown.mockResolvedValue({
      type: 'markdown',
      text: '# Hello',
    });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(makeAttachment('readme.md'));

    expect(mockResolveMarkdown).toHaveBeenCalledOnce();
    expect(mockResolveJson).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('routes .markdown attachments to the markdown resolver', async () => {
    mockResolveMarkdown.mockResolvedValue({
      type: 'markdown',
      text: '# Hello',
    });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(makeAttachment('notes.markdown'));

    expect(mockResolveMarkdown).toHaveBeenCalledOnce();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('routes .json attachments to the JSON resolver', async () => {
    mockResolveJson.mockResolvedValue({ type: 'json', value: {} });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(makeAttachment('data.json'));

    expect(mockResolveJson).toHaveBeenCalledOnce();
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('routes .jsonl attachments to the plain-text resolver (not JSON)', async () => {
    mockResolveText.mockResolvedValue({ type: 'plain_text', text: '{}\n{}' });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(makeAttachment('stream.jsonl'));

    expect(mockResolveText).toHaveBeenCalledOnce();
    expect(mockResolveJson).not.toHaveBeenCalled();
  });

  it('opens the canvas with the resolved content', async () => {
    const content = { type: 'markdown' as const, text: '# Doc' };
    mockResolveMarkdown.mockResolvedValue(content);

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('doc.md'),
    );

    expect(opened).toBe(true);
    expect(mockOpenCanvas).toHaveBeenCalledWith(content, 'doc.md');
  });

  it('routes text/markdown MIME type to the markdown resolver (ignores .pdf extension in title)', async () => {
    mockResolveMarkdown.mockResolvedValue({
      type: 'markdown',
      text: '# From stage',
    });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(
      makeAttachment('[1] report.pdf', 'text/markdown'),
    );

    expect(mockResolveMarkdown).toHaveBeenCalledOnce();
    expect(mockResolveJson).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('routes application/json MIME type to the JSON resolver', async () => {
    mockResolveJson.mockResolvedValue({ type: 'json', value: {} });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(
      makeAttachment('[1] report.pdf', 'application/json'),
    );

    expect(mockResolveJson).toHaveBeenCalledOnce();
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('returns false when the markdown resolver returns null (extension routing)', async () => {
    mockResolveMarkdown.mockResolvedValue(null);

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('empty.md'),
    );

    expect(opened).toBe(false);
    expect(mockOpenCanvas).not.toHaveBeenCalled();
  });

  it('opens unsupported canvas when text/markdown MIME resolver returns null (no data, no url)', async () => {
    mockResolveMarkdown.mockResolvedValue(null);

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('[1] report.pdf', 'text/markdown'),
    );

    expect(opened).toBe(true);
    expect(mockOpenCanvas).toHaveBeenCalledOnce();
    expect(mockResolveMarkdown).toHaveBeenCalledOnce();
  });
});
