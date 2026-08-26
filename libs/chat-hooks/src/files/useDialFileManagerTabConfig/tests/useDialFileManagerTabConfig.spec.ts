import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';
import type { TabModel } from '@epam/ai-dial-ui-kit';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDialFileManagerTabConfig } from '../useDialFileManagerTabConfig';

const ALL_TABS: TabModel[] = [
  { id: DialFileManagerTabs.MyFiles, label: 'My files' },
  { id: DialFileManagerTabs.Shared, label: 'Shared' },
  { id: DialFileManagerTabs.Organization, label: 'Organization' },
];

describe('useDialFileManagerTabConfig', () => {
  it('preserves the default 3-tab set and never fires the reset', () => {
    const onTabChange = vi.fn();

    const { result } = renderHook(() =>
      useDialFileManagerTabConfig(
        DialFileManagerTabs.MyFiles,
        onTabChange,
        ALL_TABS,
        ['my_files', 'shared', 'organization'],
      ),
    );

    expect(result.current.tabs?.map((tab) => tab.id)).toEqual([
      'my_files',
      'shared',
      'organization',
    ]);
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('hides a tab excluded by a narrowed config', () => {
    const onTabChange = vi.fn();

    const { result } = renderHook(() =>
      useDialFileManagerTabConfig(
        DialFileManagerTabs.MyFiles,
        onTabChange,
        ALL_TABS,
        ['my_files', 'organization'],
      ),
    );

    expect(result.current.tabs?.map((tab) => tab.id)).toEqual([
      'my_files',
      'organization',
    ]);
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('resets the active tab on mount when my_files is excluded', () => {
    const onTabChange = vi.fn();

    renderHook(() =>
      useDialFileManagerTabConfig(
        DialFileManagerTabs.MyFiles,
        onTabChange,
        ALL_TABS,
        ['shared', 'organization'],
      ),
    );

    expect(onTabChange).toHaveBeenCalledWith(DialFileManagerTabs.Shared);
  });

  it('resets the active tab when config arrives after mount with a narrower set', () => {
    const onTabChange = vi.fn();

    const { rerender } = renderHook(
      ({ fileManagerTabs }: { fileManagerTabs: string[] | undefined }) =>
        useDialFileManagerTabConfig(
          DialFileManagerTabs.Shared,
          onTabChange,
          ALL_TABS,
          fileManagerTabs,
        ),
      {
        initialProps: {
          fileManagerTabs: ['my_files', 'shared', 'organization'],
        },
      },
    );

    expect(onTabChange).not.toHaveBeenCalled();

    rerender({ fileManagerTabs: ['my_files', 'organization'] });

    expect(onTabChange).toHaveBeenCalledWith(DialFileManagerTabs.MyFiles);
  });

  it('ignores unrecognized ids from config when intersected against allTabs', () => {
    const onTabChange = vi.fn();

    const { result } = renderHook(() =>
      useDialFileManagerTabConfig(
        DialFileManagerTabs.MyFiles,
        onTabChange,
        ALL_TABS,
        ['my_files', 'review', 'bogus'],
      ),
    );

    expect(result.current.tabs?.map((tab) => tab.id)).toEqual(['my_files']);
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('treats an undefined fileManagerTabs as unrestricted and never resets', () => {
    const onTabChange = vi.fn();

    const { result } = renderHook(() =>
      useDialFileManagerTabConfig(
        DialFileManagerTabs.Shared,
        onTabChange,
        ALL_TABS,
        undefined,
      ),
    );

    expect(result.current.tabs?.map((tab) => tab.id)).toEqual([
      'my_files',
      'shared',
      'organization',
    ]);
    expect(onTabChange).not.toHaveBeenCalled();
  });
});
