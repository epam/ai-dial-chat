import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublishPanelView } from '../../../types/publish-panel';
import { PublishPanel } from '../PublishPanel';

describe('PublishPanel getDisabledReason', () => {
  it('disables the folder view rows the host gives a reason for', () => {
    render(
      <PublishPanel
        view={PublishPanelView.ChangeFolder}
        resource={{ title: 'Agent', version: '1.0.0' }}
        folderItems={[{ path: ['Shared'], name: 'Shared' }]}
        onChangeFolderClick={vi.fn()}
        onPendingFolderPathChange={vi.fn()}
        onCreateFolder={vi.fn()}
        getDisabledReason={({ path }) =>
          path[0] === 'Shared' ? 'No access' : undefined
        }
        hasExistingPublicationInFolder={false}
        hasWriteAccess
        isSubmitting={false}
        author=""
        onAuthorChange={vi.fn()}
        rules={[]}
        onRulesChange={vi.fn()}
        ruleSourceOptions={[]}
      />,
    );

    expect(
      screen
        .getByRole('treeitem', { name: /Shared/ })
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });
});
