import {
  DialFileManagerTabs,
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOrgUnitsContext } from '../../../context/OrgUnitsContext';
import { useOrgUnitFolderPredicate } from '../useOrgUnitFolderPredicate';

vi.mock('../../../context/OrgUnitsContext', () => ({
  useOrgUnitsContext: vi.fn(),
}));

const SECTIONS = [
  { tab: DialFileManagerTabs.MyFiles, rootLabel: 'My files' },
  { tab: DialFileManagerTabs.Organization, rootLabel: 'Organization' },
];

const folder = (path: string): DialFile =>
  ({
    path,
    name: path,
    folderId: path,
    nodeType: DialFileNodeType.FOLDER,
  }) as DialFile;

describe('useOrgUnitFolderPredicate', () => {
  const ensureUnits = vi.fn();
  const isOrgUnitFolder = vi.fn((path: string) => path === 'Acme/');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOrgUnitsContext).mockReturnValue({
      ensureUnits,
      isOrgUnitFolder,
    } as unknown as ReturnType<typeof useOrgUnitsContext>);
  });

  it('starts the shared org-unit read on mount', () => {
    renderHook(() => useOrgUnitFolderPredicate(SECTIONS));

    expect(ensureUnits).toHaveBeenCalledOnce();
  });

  it('matches a unit folder under the Organization root', () => {
    const { result } = renderHook(() => useOrgUnitFolderPredicate(SECTIONS));

    expect(result.current(folder('/Organization/Acme/'))).toBe(true);
    expect(isOrgUnitFolder).toHaveBeenCalledWith('Acme/');
  });

  it('does not mark a same-named folder in My files', () => {
    const { result } = renderHook(() => useOrgUnitFolderPredicate(SECTIONS));

    expect(result.current(folder('/My files/Acme/'))).toBe(false);
    expect(isOrgUnitFolder).not.toHaveBeenCalled();
  });

  it('resolves the Organization root under the tab id when its label is not routable', () => {
    const { result } = renderHook(() =>
      useOrgUnitFolderPredicate([
        { tab: DialFileManagerTabs.Organization, rootLabel: '' },
      ]),
    );

    expect(
      result.current(folder(`/${DialFileManagerTabs.Organization}/Acme/`)),
    ).toBe(true);
  });
});
