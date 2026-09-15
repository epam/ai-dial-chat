import {
  AttachmentCanvasProvider,
  AttachmentContentType,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import type { SkillFileContent } from '@epam/ai-dial-chat-hooks';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillDetailsFilePreview } from '../SkillDetailsFilePreview';

const { onBeforeOpen, resolveTextContent, options } = vi.hoisted(() => {
  const onBeforeOpen = vi.fn();
  return {
    onBeforeOpen,
    resolveTextContent: vi.fn(),
    options: { customVisualizers: [], onBeforeOpen },
  };
});

vi.mock('../../../hooks/attachment/useAttachmentCanvasResolvers', () => {
  const resolvers = { resolveCodeContent: resolveTextContent };
  return { useAttachmentCanvasResolvers: () => ({ resolvers, options }) };
});

vi.mock('../../SkillFilePreview/SkillFilePreview', () => ({
  SkillFilePreview: () => {
    const { content, isLoading, attachmentId } = useAttachmentCanvas();
    return (
      <div aria-label="File preview">
        {isLoading ? 'Loading' : JSON.stringify({ attachmentId, content })}
      </div>
    );
  },
}));

const PageCanvas = () => {
  const { isOpen } = useAttachmentCanvas();
  return <div>{isOpen ? 'Page canvas open' : 'Page canvas closed'}</div>;
};
const fileContent = (text: string): SkillFileContent => ({
  bytes: new TextEncoder().encode(text),
  mimeType: 'text/plain',
});
const readFile = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(file);
  });

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('SkillDetailsFilePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveTextContent.mockImplementation(async ({ file }: { file: File }) => ({
      type: AttachmentContentType.PlainText,
      text: await readFile(file),
    }));
  });

  const renderPreview = (
    onLoadFile = vi.fn().mockResolvedValue(fileContent('first contents')),
  ) => {
    const view = (fileId: string, visible = true) => (
      <AttachmentCanvasProvider>
        <PageCanvas />
        {visible && (
          <SkillDetailsFilePreview
            fileId={fileId}
            fileName="notes.txt"
            onLoadFile={onLoadFile}
          />
        )}
      </AttachmentCanvasProvider>
    );
    return { ...render(view('first/notes.txt')), view };
  };

  it('renders inline without opening or coordinating the page canvas', async () => {
    const { rerender, view } = renderPreview();
    await screen.findByText(/first contents/);
    expect(screen.getByText('Page canvas closed')).toBeTruthy();
    expect(onBeforeOpen).not.toHaveBeenCalled();
    rerender(view('first/notes.txt', false));
    expect(screen.queryByLabelText('File preview')).toBeNull();
    expect(screen.getByText('Page canvas closed')).toBeTruthy();
  });

  it('does not assign the previous contents to a new file with the same basename', async () => {
    const next = deferred<SkillFileContent>();
    const loader = vi
      .fn()
      .mockResolvedValueOnce(fileContent('first contents'))
      .mockReturnValueOnce(next.promise);
    const { rerender, view } = renderPreview(loader);
    await screen.findByText(/first contents/);
    rerender(view('second/notes.txt'));
    expect(screen.queryByText(/first contents/)).toBeNull();
    await act(async () => next.resolve(fileContent('second contents')));
    await screen.findByText(/second contents/);
    expect(screen.getByLabelText('File preview').textContent).toContain(
      'second/notes.txt',
    );
  });

  it('ignores an old preview resolution after another file is selected', async () => {
    const oldPreview = deferred<{
      type: AttachmentContentType.PlainText;
      text: string;
    }>();
    resolveTextContent.mockReturnValueOnce(oldPreview.promise);
    const { rerender, view } = renderPreview(
      vi.fn().mockResolvedValue(fileContent('new contents')),
    );
    await waitFor(() => expect(resolveTextContent).toHaveBeenCalledOnce());
    rerender(view('second/notes.txt'));
    await screen.findByText(/new contents/);
    await act(async () =>
      oldPreview.resolve({
        type: AttachmentContentType.PlainText,
        text: 'stale contents',
      }),
    );
    expect(screen.queryByText(/stale contents/)).toBeNull();
    expect(screen.getByText('Page canvas closed')).toBeTruthy();
  });

  it.each([403, 500])(
    'keeps download errors inline (status %s)',
    async (status) => {
      renderPreview(
        vi
          .fn()
          .mockRejectedValue(Object.assign(new Error('Failed'), { status })),
      );
      await screen.findByText(
        new RegExp(status === 403 ? 'forbidden' : 'load_failed'),
      );
      expect(screen.getByText('Page canvas closed')).toBeTruthy();
    },
  );
});
