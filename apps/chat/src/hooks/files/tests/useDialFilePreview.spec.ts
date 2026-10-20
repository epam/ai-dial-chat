import { AttachmentContentType } from '@epam/ai-dial-attachment-canvas';
import {
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DIAL_FILE_PREVIEW_EXTENSIONS,
  useDialFilePreview,
} from '../useDialFilePreview';

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

const renderPreview = () =>
  renderHook(() => useDialFilePreview(items, 'bucket'));

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
