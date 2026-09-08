import type { AttachResult } from '@epam/ai-dial-chat-shared';
import { DialFileNodeType } from '@epam/ai-dial-ui-kit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AvatarPickerFileManagerModalProps } from '../../../models/avatar-picker-modal';
import { AvatarPickerModal } from '../AvatarPickerModal';

const labels = {
  title: 'Add avatar',
  attachLabel: 'Attach',
  emptyTitle: 'No files',
  emptyDescription: '',
  errorMessage: 'Error',
  retryLabel: 'Retry',
  hiddenFilesLabel: 'Hidden files',
  showHiddenFilesLabel: 'Show hidden files',
  hideHiddenFilesLabel: 'Hide hidden files',
  getSelectionLabel: (count: number) => `${count} selected`,
  uploadFilesLabel: 'Upload',
  newFolderLabel: 'New folder',
  downloadLabel: 'Download',
  downloadingLabel: 'Downloading',
  deleteLabel: 'Delete',
  deletingLabel: 'Deleting',
  deleteConfirmTitleSingle: 'Delete file?',
  deleteConfirmTitleMultiple: 'Delete files?',
  deleteConfirmSingleText: 'Are you sure you want to delete',
  deleteConfirmMultipleText: 'Are you sure you want to delete',
  deleteConfirmItemsLabel: 'items?',
  deleteConfirmLabel: 'Delete',
  deleteCancelLabel: 'Cancel',
  uploadProgressTitle: 'Uploading',
  cancelLabel: 'Cancel',
};

const ATTACH_RESULT: AttachResult = {
  files: [
    {
      id: 'files/bucket/avatar.png',
      name: 'avatar.png',
      nodeType: DialFileNodeType.ITEM,
      contentType: 'image/png',
      path: 'avatar.png',
      folderId: '',
    },
  ],
  folderPaths: [],
};

const FakeFileManagerModal: FC<AvatarPickerFileManagerModalProps> = ({
  onAttach,
  title,
}) => <button onClick={() => onAttach(ATTACH_RESULT)}>{title}</button>;

describe('AvatarPickerModal', () => {
  const renderModal = (
    props?: Partial<Parameters<typeof AvatarPickerModal>[0]>,
  ) =>
    render(
      <AvatarPickerModal
        isOpen
        onClose={vi.fn()}
        onAttach={vi.fn()}
        bucket="bucket"
        FileManagerModal={FakeFileManagerModal}
        allowedMimeTypes={['image/png']}
        maxFileSizeBytes={1024}
        labels={labels}
        {...props}
      />,
    );

  it('renders the host file manager modal when open', () => {
    renderModal();

    expect(screen.getByRole('button', { name: 'Add avatar' })).toBeTruthy();
  });

  it('does not render the host file manager modal when closed', () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole('button', { name: 'Add avatar' })).toBeNull();
  });

  it('forwards the file manager attach result to onAttach', async () => {
    const onAttach = vi.fn();
    renderModal({ onAttach });

    await userEvent.click(screen.getByRole('button', { name: 'Add avatar' }));

    expect(onAttach).toHaveBeenCalledWith(ATTACH_RESULT);
  });
});
