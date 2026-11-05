import {
  DialFileManagerTabs,
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileManagerController } from '../../file-manager-controller';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '../../file-manager-variant';
import type { DialFileManagerShellLabels } from '../../labels';
import { DialFileManagerShell } from '../DialFileManagerShell';

type GetItemIcon = (item: DialFile) => ReactNode | undefined;

const captured: {
  gridIcon?: GetItemIcon;
  treeIcon?: GetItemIcon;
} = {};

vi.mock('@epam/ai-dial-react-file-manager', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-react-file-manager')>();
  return {
    ...actual,
    DialFileManager: (props: {
      gridOptions?: { getItemIcon?: GetItemIcon };
      treeOptions?: { getItemIcon?: GetItemIcon };
    }) => {
      captured.gridIcon = props.gridOptions?.getItemIcon;
      captured.treeIcon = props.treeOptions?.getItemIcon;
      return null;
    },
  };
});

const stubLabel = new Proxy(() => '', { get: () => '' });
/* Every label but `orgUnit` resolves to a stub that works as a formatter and a per-tab map. */
const makeLabels = (orgUnit?: string): DialFileManagerShellLabels =>
  new Proxy(
    {},
    {
      get: (_target, key) => (key === 'orgUnit' ? orgUnit : stubLabel),
    },
  ) as unknown as DialFileManagerShellLabels;

const controller = {
  items: [],
  isLoading: false,
  path: '/Organization',
  expandedPaths: new Set<string>(),
  loadedPaths: new Set<string>(),
  folderPopupLoadingPaths: new Set<string>(),
  sharedByMePaths: new Set<string>(),
  visibleColumns: [],
  actionLabels: {},
  dateOptions: {},
} as unknown as FileManagerController;

const folder = (path: string): DialFile =>
  ({
    path,
    name: path.split('/').pop() ?? path,
    folderId: path,
    nodeType: DialFileNodeType.FOLDER,
  }) as DialFile;

const file = (path: string): DialFile =>
  ({ ...folder(path), nodeType: DialFileNodeType.ITEM }) as DialFile;

const renderShell = (props: {
  isOrgUnitFolder?: (item: DialFile) => boolean;
  orgUnit?: string;
}) =>
  render(
    <DialFileManagerShell
      controller={controller}
      labels={makeLabels(props.orgUnit)}
      activeTab={DialFileManagerTabs.Organization}
      tabs={[] as never}
      onTabChange={vi.fn()}
      selectedPaths={new Set()}
      onSelectedPathsChange={vi.fn()}
      variant={DialFileManagerVariant.Standalone}
      actionProfile={DialFileManagerActionProfile.Browse}
      isOrgUnitFolder={props.isOrgUnitFolder}
    />,
  );

const renderIcon = (getItemIcon: GetItemIcon | undefined, item: DialFile) =>
  render(<>{getItemIcon?.(item)}</>);

describe('DialFileManagerShell — org-unit folders', () => {
  beforeEach(() => {
    captured.gridIcon = undefined;
    captured.treeIcon = undefined;
  });

  const isUnit = (item: DialFile) => item.path === '/Organization/Acme';

  it.each(['grid', 'tree'] as const)(
    'shows the org-unit icon on a unit folder in the %s',
    (where) => {
      renderShell({ isOrgUnitFolder: isUnit, orgUnit: 'Organization unit' });
      const getItemIcon =
        where === 'grid' ? captured.gridIcon : captured.treeIcon;

      renderIcon(getItemIcon, folder('/Organization/Acme'));

      expect(
        screen.getByRole('img', { name: 'Organization unit' }),
      ).toBeTruthy();
    },
  );

  it('keeps the default icon for a plain folder and for a file', () => {
    renderShell({ isOrgUnitFolder: isUnit });

    expect(captured.gridIcon?.(folder('/Organization/Other'))).toBeUndefined();
    expect(captured.gridIcon?.(file('/Organization/Acme'))).toBeUndefined();
  });

  it('marks nothing when the host passes no predicate', () => {
    renderShell({});

    expect(captured.treeIcon?.(folder('/Organization/Acme'))).toBeUndefined();
  });

  it('uses the host label as the icon name', () => {
    renderShell({ isOrgUnitFolder: isUnit, orgUnit: 'وحدة المؤسسة' });

    renderIcon(captured.treeIcon, folder('/Organization/Acme'));

    expect(screen.getByRole('img', { name: 'وحدة المؤسسة' })).toBeTruthy();
  });
});
