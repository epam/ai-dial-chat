import {
  AttachmentCanvasProvider,
  AttachmentContentType,
} from '@epam/ai-dial-attachment-canvas';
import {
  DialFileNodeType,
  type DialFile,
  type FileManagerGridRow,
} from '@epam/ai-dial-react-file-manager';
import { act, renderHook as render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DIAL_FILE_PREVIEW_EXTENSIONS,
  useDialFilePreview,
} from '../useDialFilePreview';

const renderHook: typeof render = (callback, options) =>
  render(callback, { ...options, wrapper: AttachmentCanvasProvider });

const openAttachmentCanvas = vi.fn();
const openCanvas = vi.fn();

vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>()),
  useOpenAttachmentCanvas: () => ({ openAttachmentCanvas }),
  useAttachmentCanvas: () => ({ openCanvas }),
}));

vi.mock('../../attachment/useAttachmentCanvasResolvers', () => ({
  useAttachmentCanvasResolvers: () => ({ resolvers: {}, options: {} }),
}));

const readme: DialFile = {
  id: 'readme',
  name: 'readme.md',
  path: 'My files/docs/readme.md',
  parentPath: 'My files/docs',
  nodeType: DialFileNodeType.ITEM,
  folderId: 'docs',
  url: 'files/bucket/docs/readme.md',
  contentType: 'text/markdown',
};

const docsFolder: DialFile = {
  id: 'docs',
  name: 'docs',
  path: 'My files/docs',
  parentPath: 'My files',
  nodeType: DialFileNodeType.FOLDER,
  folderId: 'root',
  items: [readme],
};

const items: DialFile[] = [
  {
    id: 'root',
    name: 'My files',
    path: 'My files',
    nodeType: DialFileNodeType.FOLDER,
    folderId: 'root',
    items: [docsFolder],
  },
];

const searchHit: DialFile = {
  id: 'hit',
  name: 'report.pdf',
  path: 'My files/archive/2024/report.pdf',
  parentPath: 'My files/archive/2024',
  nodeType: DialFileNodeType.ITEM,
  folderId: 'archive',
  url: 'files/bucket/archive/2024/report.pdf',
  contentType: 'application/pdf',
};

const toRow = (file: DialFile): FileManagerGridRow => ({
  id: file.id ?? file.path,
  name: file.name,
  path: file.path,
  parentPath: file.parentPath,
  nodeType: file.nodeType,
});

const renderPreview = (searchResults: DialFile[] | null = null) =>
  renderHook(() => useDialFilePreview(items, 'bucket', searchResults));

describe('useDialFilePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openAttachmentCanvas.mockResolvedValue(true);
  });

  it('opens the canvas with an attachment for a file found anywhere in the tree', () => {
    const { result } = renderPreview();

    result.current.onPreview('My files/docs/readme.md');

    expect(openAttachmentCanvas).toHaveBeenCalledOnce();
    expect(openAttachmentCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'readme.md',
        url: 'files/bucket/docs/readme.md',
        contentType: 'text/markdown',
      }),
      undefined,
      expect.any(Function),
    );
  });

  it('does nothing when no path is given', () => {
    const { result } = renderPreview();

    result.current.onPreview(undefined);

    expect(openAttachmentCanvas).not.toHaveBeenCalled();
  });

  it('does nothing when the path is not in the loaded tree', () => {
    const { result } = renderPreview();

    result.current.onPreview('My files/missing.md');

    expect(openAttachmentCanvas).not.toHaveBeenCalled();
  });

  it('does nothing for a folder', () => {
    const { result } = renderPreview();

    result.current.onPreview('My files/docs');

    expect(openAttachmentCanvas).not.toHaveBeenCalled();
  });

  it('shows the canvas unsupported state, with a download URL, when the canvas cannot open the file', async () => {
    openAttachmentCanvas.mockResolvedValue(false);
    const { result } = renderPreview();

    result.current.onPreview('My files/docs/readme.md');

    await waitFor(() => expect(openCanvas).toHaveBeenCalledOnce());
    const [content, fileName] = openCanvas.mock.calls[0];
    expect(content).toMatchObject({
      type: AttachmentContentType.Unsupported,
      url: expect.stringContaining('readme.md'),
    });
    expect(fileName).toBe('readme.md');
  });

  it('shows the canvas unsupported state without a download URL when the file has no URL', () => {
    const { result } = renderHook(() =>
      useDialFilePreview(
        [{ ...readme, url: undefined, id: undefined }],
        'bucket',
      ),
    );

    result.current.onPreview('My files/docs/readme.md');

    expect(openAttachmentCanvas).not.toHaveBeenCalled();
    expect(openCanvas).toHaveBeenCalledOnce();
    expect(openCanvas.mock.calls[0][0]).toEqual({
      type: AttachmentContentType.Unsupported,
    });
  });

  it('does not touch the canvas when it opens the file', async () => {
    const { result } = renderPreview();

    result.current.onPreview('My files/docs/readme.md');

    await waitFor(() => expect(openAttachmentCanvas).toHaveBeenCalledOnce());
    expect(openCanvas).not.toHaveBeenCalled();
  });

  it('finds a search hit that is not in the loaded tree', () => {
    const { result } = renderPreview([searchHit]);

    result.current.onPreview(searchHit.path);

    expect(openAttachmentCanvas).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'report.pdf' }),
      undefined,
      expect.any(Function),
    );
  });

  it('ignores search hits when the grid is not showing a search', () => {
    const { result } = renderPreview(null);

    result.current.onPreview(searchHit.path);

    expect(openAttachmentCanvas).not.toHaveBeenCalled();
  });

  describe('onFileClick', () => {
    it('opens the clicked file in the canvas', () => {
      const { result } = renderPreview();

      result.current.onFileClick(toRow(readme));

      expect(openAttachmentCanvas).toHaveBeenCalledOnce();
      expect(openAttachmentCanvas).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'readme.md' }),
        undefined,
        expect.any(Function),
      );
    });

    it('opens a file whose extension is not in the preview list and lets the canvas decide', () => {
      const archive: DialFile = {
        ...readme,
        id: 'zip',
        name: 'backup.zip',
        path: 'My files/docs/backup.zip',
        url: 'files/bucket/docs/backup.zip',
        contentType: 'application/zip',
      };
      const { result } = renderHook(() =>
        useDialFilePreview([{ ...docsFolder, items: [archive] }], 'bucket'),
      );

      result.current.onFileClick(toRow(archive));

      expect(openAttachmentCanvas).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'backup.zip' }),
        undefined,
        expect.any(Function),
      );
    });

    it('opens a clicked search hit', () => {
      const { result } = renderPreview([searchHit]);

      result.current.onFileClick(toRow(searchHit));

      expect(openAttachmentCanvas).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'report.pdf' }),
        undefined,
        expect.any(Function),
      );
    });

    it('does nothing for a folder row', () => {
      const { result } = renderPreview();

      result.current.onFileClick(toRow(docsFolder));

      expect(openAttachmentCanvas).not.toHaveBeenCalled();
    });
  });

  describe('overlapping previews', () => {
    const shouldCommitOf = (call: number): (() => boolean) =>
      openAttachmentCanvas.mock.calls[call][2];

    it('lets only the latest preview commit to the canvas', () => {
      const { result } = renderPreview([searchHit]);

      result.current.onPreview('My files/docs/readme.md');
      result.current.onPreview(searchHit.path);

      expect(shouldCommitOf(0)()).toBe(false);
      expect(shouldCommitOf(1)()).toBe(true);
    });

    it('stops a pending preview from committing once the page is gone', () => {
      const { result, unmount } = renderPreview();

      result.current.onPreview('My files/docs/readme.md');
      unmount();

      expect(shouldCommitOf(0)()).toBe(false);
    });

    it('does not show the unsupported state for a preview that a later one superseded', async () => {
      let finishFirst: (opened: boolean) => void = () => undefined;
      openAttachmentCanvas.mockReturnValueOnce(
        new Promise<boolean>((resolve) => {
          finishFirst = resolve;
        }),
      );
      const { result } = renderPreview([searchHit]);

      result.current.onPreview('My files/docs/readme.md');
      result.current.onPreview(searchHit.path);
      await act(async () => {
        finishFirst(false);
      });

      expect(openCanvas).not.toHaveBeenCalled();
    });
  });

  describe('callback stability', () => {
    it('keeps the same callbacks when the listing refreshes', () => {
      const { result, rerender } = renderHook(
        ({ tree }) => useDialFilePreview(tree, 'bucket', null),
        { initialProps: { tree: items } },
      );
      const { onPreview, onFileClick } = result.current;

      rerender({ tree: [...items] });

      expect(result.current.onPreview).toBe(onPreview);
      expect(result.current.onFileClick).toBe(onFileClick);
    });

    it('reads the refreshed listing, not the one it was created with', () => {
      const { result, rerender } = renderHook(
        ({ tree }) => useDialFilePreview(tree, 'bucket', null),
        { initialProps: { tree: [] as DialFile[] } },
      );

      rerender({ tree: items });
      result.current.onPreview('My files/docs/readme.md');

      expect(openAttachmentCanvas).toHaveBeenCalledOnce();
    });
  });

  it('lists each previewable format in lower, upper and capitalized case', () => {
    const { result } = renderPreview();

    expect(result.current.previewExtensions).toBe(DIAL_FILE_PREVIEW_EXTENSIONS);
    expect(DIAL_FILE_PREVIEW_EXTENSIONS).toEqual(
      expect.arrayContaining(['.md', '.MD', '.Md', '.jpg', '.JPG', '.Jpg']),
    );
  });

  it('lists every extension once, with a leading dot', () => {
    expect(new Set(DIAL_FILE_PREVIEW_EXTENSIONS).size).toBe(
      DIAL_FILE_PREVIEW_EXTENSIONS.length,
    );
    expect(
      DIAL_FILE_PREVIEW_EXTENSIONS.every((ext) => /^\.[A-Za-z0-9]+$/.test(ext)),
    ).toBe(true);
  });
});
