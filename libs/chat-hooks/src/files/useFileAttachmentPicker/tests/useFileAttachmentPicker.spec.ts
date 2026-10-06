import type { FileManagerSelectableNode } from '@epam/ai-dial-chat-shared';
import { DialFileManagerVariant } from '@epam/ai-dial-chat-shared';
import {
  DialFileManagerTabs,
  DialFileNodeType,
} from '@epam/ai-dial-react-file-manager';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseDialFileManagerResult } from '../../dial-file-manager.types';
import { useDialFileManagerSections } from '../../useDialFileManagerSections/useDialFileManagerSections';
import {
  useFileAttachmentPicker,
  type UseFileAttachmentPickerOptions,
} from '../useFileAttachmentPicker';

vi.mock('../../useDialFileManagerSections/useDialFileManagerSections', () => ({
  useDialFileManagerSections: vi.fn(),
}));

const mockUseDialFileManagerSections = vi.mocked(useDialFileManagerSections);

const STUB_CONTROLLER = {
  marker: 'stub-controller',
  sectionTab: DialFileManagerTabs.MyFiles,
} as unknown as UseDialFileManagerResult;

const TAB_LABELS: Record<DialFileManagerTabs, string> = {
  [DialFileManagerTabs.All]: 'All',
  [DialFileManagerTabs.MyFiles]: 'My files',
  [DialFileManagerTabs.Shared]: 'Shared with me',
  [DialFileManagerTabs.Organization]: 'Organization',
  [DialFileManagerTabs.Review]: '',
};

const buildOptions = (
  overrides: Partial<UseFileAttachmentPickerOptions> = {},
): UseFileAttachmentPickerOptions => ({
  fileManagerOptions:
    {} as UseFileAttachmentPickerOptions['fileManagerOptions'],
  bucket: 'my-bucket',
  tabLabels: TAB_LABELS,
  ...overrides,
});

const buildRow = (
  overrides: Partial<FileManagerSelectableNode> = {},
): FileManagerSelectableNode => ({
  path: '/My files/report.pdf',
  nodeType: DialFileNodeType.ITEM,
  ...overrides,
});

describe('useFileAttachmentPicker', () => {
  beforeEach(() => {
    mockUseDialFileManagerSections.mockClear();
    mockUseDialFileManagerSections.mockReturnValue(STUB_CONTROLLER as never);
  });

  it('forwards the composed controller and section configuration', () => {
    renderHook(() => useFileAttachmentPicker(buildOptions()));

    expect(mockUseDialFileManagerSections).toHaveBeenCalledOnce();
    const [callOptions] = mockUseDialFileManagerSections.mock.calls[0];
    expect(callOptions.bucket).toBe('my-bucket');
    expect(callOptions.activeTab).toBe(DialFileManagerTabs.MyFiles);
    expect(callOptions.sections).toEqual([
      { tab: DialFileManagerTabs.MyFiles, rootLabel: 'My files' },
      { tab: DialFileManagerTabs.Shared, rootLabel: 'Shared with me' },
      { tab: DialFileManagerTabs.Organization, rootLabel: 'Organization' },
    ]);
    expect(callOptions.variant).toBe(DialFileManagerVariant.Attach);
  });

  it('filters the composed sections using the allowed tabs', () => {
    renderHook(() =>
      useFileAttachmentPicker(
        buildOptions({
          allowedTabs: [
            DialFileManagerTabs.All,
            DialFileManagerTabs.Shared,
            DialFileManagerTabs.Organization,
          ],
        }),
      ),
    );

    expect(mockUseDialFileManagerSections.mock.calls[0][0].sections).toEqual([
      { tab: DialFileManagerTabs.Shared, rootLabel: 'Shared with me' },
      { tab: DialFileManagerTabs.Organization, rootLabel: 'Organization' },
    ]);
  });

  it('returns the mocked controller reference unchanged', () => {
    const { result } = renderHook(() =>
      useFileAttachmentPicker(buildOptions()),
    );

    expect(result.current.controller).toBe(STUB_CONTROLLER);
  });

  it('defensively copies an incoming selection instead of storing the reference', () => {
    const { result } = renderHook(() =>
      useFileAttachmentPicker(buildOptions()),
    );
    const incoming = new Set(['/My files/a.txt']);

    act(() => {
      result.current.onSelectedPathsChange(incoming);
    });

    expect(result.current.selectedPaths).toEqual(incoming);
    expect(result.current.selectedPaths).not.toBe(incoming);
  });

  it('clears the selection when the active tab changes', () => {
    const { result } = renderHook(() =>
      useFileAttachmentPicker(buildOptions()),
    );

    act(() => {
      result.current.onSelectedPathsChange(new Set(['/My files/a.txt']));
    });
    expect(result.current.selectedPaths.size).toBe(1);

    act(() => {
      result.current.onTabChange(DialFileManagerTabs.Shared);
    });

    expect(result.current.selectedPaths.size).toBe(0);
    expect(result.current.activeTab).toBe(DialFileManagerTabs.Shared);
  });

  it('offers All first when the configuration allows it', () => {
    const { result } = renderHook(() =>
      useFileAttachmentPicker(
        buildOptions({
          allowedTabs: ['all', 'my_files', 'shared', 'organization'],
        }),
      ),
    );

    expect(result.current.tabs?.map((tab) => tab.value)).toEqual([
      DialFileManagerTabs.All,
      DialFileManagerTabs.MyFiles,
      DialFileManagerTabs.Shared,
      DialFileManagerTabs.Organization,
    ]);
    expect(result.current.activeTab).toBe(DialFileManagerTabs.MyFiles);
  });

  it('keeps All active and composes only enabled source sections', () => {
    const { result } = renderHook(() =>
      useFileAttachmentPicker(
        buildOptions({
          initialTab: DialFileManagerTabs.All,
          allowedTabs: ['all', 'shared', 'organization'],
        }),
      ),
    );

    expect(result.current.activeTab).toBe(DialFileManagerTabs.All);
    expect(
      mockUseDialFileManagerSections.mock.calls[0][0].sections.map(
        ({ tab }) => tab,
      ),
    ).toEqual([DialFileManagerTabs.Shared, DialFileManagerTabs.Organization]);
  });

  it('filters the tab list down to allowedTabs', () => {
    const { result } = renderHook(() =>
      useFileAttachmentPicker(
        buildOptions({ allowedTabs: [DialFileManagerTabs.MyFiles] }),
      ),
    );

    expect(result.current.tabs?.map((tab) => tab.value)).toEqual([
      DialFileManagerTabs.MyFiles,
    ]);
  });

  describe('isRowSelectable', () => {
    it('rejects a row inside a hidden folder', () => {
      const { result } = renderHook(() =>
        useFileAttachmentPicker(buildOptions()),
      );

      expect(
        result.current.isRowSelectable({
          data: buildRow({ path: '/My files/.hidden/child.txt' }),
        }),
      ).toBe(false);
    });

    it('rejects a disallowed MIME type', () => {
      const { result } = renderHook(() =>
        useFileAttachmentPicker(buildOptions({ allowedTypes: ['image/*'] })),
      );

      expect(
        result.current.isRowSelectable({
          data: buildRow({ contentType: 'application/pdf' }),
        }),
      ).toBe(false);
    });

    it('accepts a wildcard-matching MIME type', () => {
      const { result } = renderHook(() =>
        useFileAttachmentPicker(buildOptions({ allowedTypes: ['image/*'] })),
      );

      expect(
        result.current.isRowSelectable({
          data: buildRow({ contentType: 'image/png' }),
        }),
      ).toBe(true);
    });

    it('treats absent MIME/size metadata as permissive', () => {
      const { result } = renderHook(() =>
        useFileAttachmentPicker(
          buildOptions({
            allowedTypes: ['image/*'],
            maxSelectableFileSize: 10,
          }),
        ),
      );

      expect(
        result.current.isRowSelectable({
          data: buildRow({ contentType: undefined, contentLength: undefined }),
        }),
      ).toBe(true);
    });

    it('accepts a file exactly at the size limit', () => {
      const { result } = renderHook(() =>
        useFileAttachmentPicker(buildOptions({ maxSelectableFileSize: 100 })),
      );

      expect(
        result.current.isRowSelectable({
          data: buildRow({ contentLength: 100 }),
        }),
      ).toBe(true);
    });

    it('rejects a file over the size limit', () => {
      const { result } = renderHook(() =>
        useFileAttachmentPicker(buildOptions({ maxSelectableFileSize: 100 })),
      );

      expect(
        result.current.isRowSelectable({
          data: buildRow({ contentLength: 101 }),
        }),
      ).toBe(false);
    });

    it('follows the folder-selection policy', () => {
      const folder = buildRow({
        path: '/My files/reports',
        nodeType: DialFileNodeType.FOLDER,
      });

      const { result: disallowed } = renderHook(() =>
        useFileAttachmentPicker(buildOptions({ canAttachFolders: false })),
      );
      expect(disallowed.current.isRowSelectable({ data: folder })).toBe(false);

      const { result: allowed } = renderHook(() =>
        useFileAttachmentPicker(buildOptions({ canAttachFolders: true })),
      );
      expect(allowed.current.isRowSelectable({ data: folder })).toBe(true);
    });

    it('rejects a null row', () => {
      const { result } = renderHook(() =>
        useFileAttachmentPicker(buildOptions()),
      );

      expect(result.current.isRowSelectable({ data: null })).toBe(false);
    });
  });

  describe('isFileTypeAllowed', () => {
    it('allows every type when allowedTypes is empty or absent', () => {
      const { result } = renderHook(() =>
        useFileAttachmentPicker(buildOptions()),
      );

      expect(result.current.isFileTypeAllowed('application/pdf')).toBe(true);
    });

    it('rejects a type outside allowedTypes', () => {
      const { result } = renderHook(() =>
        useFileAttachmentPicker(buildOptions({ allowedTypes: ['image/png'] })),
      );

      expect(result.current.isFileTypeAllowed('application/pdf')).toBe(false);
    });
  });
});
