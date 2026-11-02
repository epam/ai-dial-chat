import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FileManagerController } from '../../file-manager-controller';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '../../file-manager-variant';
import type { DialFileManagerShellLabels } from '../../labels';
import { DialFileManagerShell } from '../DialFileManagerShell';

/* The grid itself is out of scope here; only the operation overlay is asserted. */
vi.mock('@epam/ai-dial-react-file-manager', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-react-file-manager')>();
  return { ...actual, DialFileManager: () => null };
});

const stubLabel = new Proxy(() => '', { get: () => '' });
const labels = new Proxy(
  { deletingLabel: 'Deleting files' },
  {
    get: (target, key) =>
      key in target ? target[key as keyof typeof target] : stubLabel,
  },
) as unknown as DialFileManagerShellLabels;

const makeController = (isDeleting: boolean): FileManagerController =>
  ({
    items: [],
    isLoading: false,
    error: null,
    path: '/My files',
    retry: vi.fn(),
    isDeleting,
    expandedPaths: new Set<string>(),
    loadedPaths: new Set<string>(),
    folderPopupLoadingPaths: new Set<string>(),
    sharedByMePaths: new Set<string>(),
    visibleColumns: [],
    actionLabels: {},
    dateOptions: {},
  }) as unknown as FileManagerController;

const renderShell = (controller: FileManagerController) => (
  <DialFileManagerShell
    controller={controller}
    labels={labels}
    activeTab={DialFileManagerTabs.MyFiles}
    tabs={[] as never}
    onTabChange={vi.fn()}
    selectedPaths={new Set()}
    onSelectedPathsChange={vi.fn()}
    variant={DialFileManagerVariant.Attach}
    actionProfile={DialFileManagerActionProfile.Attach}
  />
);

describe('DialFileManagerShell — operation overlay', () => {
  it('keeps the overlay status region mounted and fills it when an operation starts', () => {
    const { rerender } = render(renderShell(makeController(false)));
    const status = screen
      .getAllByRole('status')
      .find((element) => element.getAttribute('aria-live') === 'polite');
    expect(status?.textContent).toBe('');

    rerender(renderShell(makeController(true)));

    expect(status?.textContent).toBe('Deleting files');
  });
});
