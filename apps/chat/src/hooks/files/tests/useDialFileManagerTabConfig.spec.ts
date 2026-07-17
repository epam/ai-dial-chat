import { DialFileManagerTabs, type TabModel } from '@epam/ai-dial-ui-kit';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDialFileManagerTabConfig } from '../useDialFileManagerTabConfig';

const { mockUseAppConfig } = vi.hoisted(() => ({
  mockUseAppConfig: vi.fn(),
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: mockUseAppConfig,
}));

const ALL_TABS: TabModel[] = [
  { id: DialFileManagerTabs.MyFiles, label: 'My files' },
  { id: DialFileManagerTabs.Shared, label: 'Shared' },
  { id: DialFileManagerTabs.Organization, label: 'Organization' },
];

const mockConfig = (fileManagerTabs: string[]) =>
  mockUseAppConfig.mockReturnValue({ config: { fileManagerTabs } });

describe('useDialFileManagerTabConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves the default 3-tab set and never fires the reset', () => {
    mockConfig(['my_files', 'shared', 'organization']);
    const onTabChange = vi.fn();

    const { result } = renderHook(() =>
      useDialFileManagerTabConfig(
        DialFileManagerTabs.MyFiles,
        onTabChange,
        ALL_TABS,
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
    mockConfig(['my_files', 'organization']);
    const onTabChange = vi.fn();

    const { result } = renderHook(() =>
      useDialFileManagerTabConfig(
        DialFileManagerTabs.MyFiles,
        onTabChange,
        ALL_TABS,
      ),
    );

    expect(result.current.tabs?.map((tab) => tab.id)).toEqual([
      'my_files',
      'organization',
    ]);
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('resets the active tab on mount when my_files is excluded', () => {
    mockConfig(['shared', 'organization']);
    const onTabChange = vi.fn();

    renderHook(() =>
      useDialFileManagerTabConfig(
        DialFileManagerTabs.MyFiles,
        onTabChange,
        ALL_TABS,
      ),
    );

    expect(onTabChange).toHaveBeenCalledWith(DialFileManagerTabs.Shared);
  });

  it('resets the active tab when config arrives after mount with a narrower set', () => {
    mockConfig(['my_files', 'shared', 'organization']);
    const onTabChange = vi.fn();

    const { rerender } = renderHook(
      ({ activeTab }) =>
        useDialFileManagerTabConfig(activeTab, onTabChange, ALL_TABS),
      { initialProps: { activeTab: DialFileManagerTabs.Shared } },
    );

    expect(onTabChange).not.toHaveBeenCalled();

    mockConfig(['my_files', 'organization']);
    rerender({ activeTab: DialFileManagerTabs.Shared });

    expect(onTabChange).toHaveBeenCalledWith(DialFileManagerTabs.MyFiles);
  });

  it('ignores unrecognized ids from config when intersected against allTabs', () => {
    mockConfig(['my_files', 'review', 'bogus']);
    const onTabChange = vi.fn();

    const { result } = renderHook(() =>
      useDialFileManagerTabConfig(
        DialFileManagerTabs.MyFiles,
        onTabChange,
        ALL_TABS,
      ),
    );

    expect(result.current.tabs?.map((tab) => tab.id)).toEqual(['my_files']);
    expect(onTabChange).not.toHaveBeenCalled();
  });
});
