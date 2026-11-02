import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileManagerController } from '../../file-manager-controller';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '../../file-manager-variant';
import type { DialFileManagerShellLabels } from '../../labels';
import { DialFileManagerShell } from '../DialFileManagerShell';

/* Every label the error path does not assert resolves to a stub that works
   both as a formatter (`getUploadQueueTitle(...)`) and a per-tab map. */
const stubLabel = new Proxy(() => '', { get: () => '' });
const labels = new Proxy(
  { errorMessage: 'Could not load files.', retryLabel: 'Retry' },
  {
    get: (target, key) =>
      key in target ? target[key as keyof typeof target] : stubLabel,
  },
) as unknown as DialFileManagerShellLabels;

const makeController = (retry = vi.fn()): FileManagerController =>
  ({
    items: [],
    isLoading: false,
    error: new Error('boom'),
    path: '/My files',
    retry,
    expandedPaths: new Set<string>(),
    loadedPaths: new Set<string>(),
    folderPopupLoadingPaths: new Set<string>(),
    sharedByMePaths: new Set<string>(),
    visibleColumns: [],
    actionLabels: {},
    dateOptions: {},
  }) as unknown as FileManagerController;

const renderShell = (controller: FileManagerController) =>
  render(
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
    />,
  );

describe('DialFileManagerShell — load error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('announces the load error assertively through role="alert"', () => {
    renderShell(makeController());

    expect(screen.getByRole('alert').textContent).toContain(
      'Could not load files.',
    );
  });

  it('calls retry when Retry is clicked', async () => {
    const retry = vi.fn();
    renderShell(makeController(retry));

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(retry).toHaveBeenCalledOnce();
  });
});
