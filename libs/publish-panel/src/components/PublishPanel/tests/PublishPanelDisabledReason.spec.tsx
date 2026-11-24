import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublishPanelView } from '../../../types/publish-panel';
import { PublishPanel } from '../PublishPanel';

const treeProps = vi.fn();

vi.mock('../../PublishFoldersTree/PublishFoldersTree', () => ({
  PublishFoldersTree: (props: unknown) => {
    treeProps(props);
    return <div role="tree" aria-label="Folders" />;
  },
}));

describe('PublishPanel getDisabledReason', () => {
  it('forwards getDisabledReason to the folder view tree', () => {
    const getDisabledReason = vi.fn();

    render(
      <PublishPanel
        view={PublishPanelView.ChangeFolder}
        resource={{ title: 'Agent', version: '1.0.0' }}
        folderItems={[]}
        onChangeFolderClick={vi.fn()}
        onPendingFolderPathChange={vi.fn()}
        onCreateFolder={vi.fn()}
        getDisabledReason={getDisabledReason}
        hasExistingPublicationInFolder={false}
        hasWriteAccess
        isSubmitting={false}
        author=""
        onAuthorChange={vi.fn()}
      />,
    );

    expect(treeProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ getDisabledReason }),
    );
  });
});
