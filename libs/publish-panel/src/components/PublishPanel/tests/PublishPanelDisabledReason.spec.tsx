import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublishPanelView } from '../../../types/publish-panel';
import { PublishPanel } from '../PublishPanel';

const bodyProps = vi.fn();

vi.mock('@epam/ai-dial-react-file-manager', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-react-file-manager')>();
  return {
    ...actual,
    FolderDestinationPanelBody: (props: unknown) => {
      bodyProps(props);
      return <div role="tree" aria-label="Folders" />;
    },
  };
});

describe('PublishPanel getDisabledReason', () => {
  it('forwards getDisabledReason to the folder view body', () => {
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
        rules={[]}
        onRulesChange={vi.fn()}
        ruleSourceOptions={[]}
      />,
    );

    expect(bodyProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ getDisabledReason }),
    );
  });
});
