import {
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DIAL_FILE_PREVIEW_EXTENSIONS,
  useDialFilePreview,
} from '../useDialFilePreview';

const openAttachmentCanvas = vi.fn();

vi.mock('@epam/ai-dial-attachment-canvas', () => ({
  useOpenAttachmentCanvas: () => ({ openAttachmentCanvas }),
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

  it('offers only dotted, lowercase extensions', () => {
    const { result } = renderPreview();

    expect(result.current.previewExtensions).toBe(DIAL_FILE_PREVIEW_EXTENSIONS);
    expect(
      DIAL_FILE_PREVIEW_EXTENSIONS.every((ext) => /^\.[a-z0-9]+$/.test(ext)),
    ).toBe(true);
    expect(DIAL_FILE_PREVIEW_EXTENSIONS).toContain('.md');
  });
});
