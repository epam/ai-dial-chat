import {
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useDialFilePreview } from '../useDialFilePreview';

const file: DialFile = {
  id: 'files/bucket/a',
  name: 'a.txt',
  path: '/a',
  folderId: '',
  nodeType: DialFileNodeType.ITEM,
  contentType: 'text/plain',
};
const setup = () => {
  let generation = 0;
  return {
    bucket: 'bucket',
    previewExtensions: ['.txt'],
    startRequest: () => {
      const token = ++generation;
      return () => token === generation;
    },
    openAttachment: vi.fn().mockResolvedValue(false),
    openUnsupported: vi.fn(),
    resolveUrl: vi.fn(() => 'download'),
  };
};

it('reads current tree and search hits through stable callbacks', async () => {
  const options = setup();
  const { result, rerender } = renderHook(
    ({ items, searchResults }) =>
      useDialFilePreview({ ...options, items, searchResults }),
    { initialProps: { items: [file], searchResults: [] as DialFile[] } },
  );
  const callback = result.current.onPreview;
  await act(async () => callback('/a'));
  expect(options.openUnsupported).toHaveBeenCalledWith(
    'a.txt',
    expect.any(String),
    'download',
  );
  rerender({ items: [], searchResults: [{ ...file, path: '/b' }] });
  expect(result.current.onPreview).toBe(callback);
  await act(async () => callback('/b'));
  expect(options.openAttachment).toHaveBeenCalledTimes(2);
});

it('ignores folders, absent paths and missing files', () => {
  const options = setup();
  const { result } = renderHook(() =>
    useDialFilePreview({
      ...options,
      items: [{ ...file, nodeType: DialFileNodeType.FOLDER }],
    }),
  );
  result.current.onPreview();
  result.current.onPreview('/missing');
  result.current.onPreview('/a');
  expect(options.openAttachment).not.toHaveBeenCalled();
});

it.each(['superseded', 'unmounted'])(
  'does not open a fallback after %s completion',
  async (mode) => {
    const options = setup();
    let finish!: (opened: boolean) => void;
    options.openAttachment.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, unmount } = renderHook(() =>
      useDialFilePreview({ ...options, items: [file] }),
    );
    result.current.onPreview('/a');
    if (mode === 'unmounted') unmount();
    else options.startRequest();
    await act(async () => finish(false));
    expect(options.openUnsupported).not.toHaveBeenCalled();
  },
);
