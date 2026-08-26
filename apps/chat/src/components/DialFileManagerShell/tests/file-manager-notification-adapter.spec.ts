import {
  FileManagerNotificationReason,
  FileNameValidationErrorReason,
  FileOperationKind,
} from '@epam/ai-dial-chat-hooks';
import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { describe, expect, it, vi } from 'vitest';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../../types/entity-notification';
import {
  buildFileManagerNotificationOptions,
  buildValidationErrorMessage,
  handleFileOperationSuccess,
} from '../file-manager-notification-adapter';

const t = ((key: string) => key) as unknown as Parameters<
  typeof buildFileManagerNotificationOptions
>[0];

describe('handleFileOperationSuccess', () => {
  it('reports a renamed file as NotifiableEntity.File', () => {
    const notifyOperationSuccess = vi.fn();
    const showSuccessNotification = vi.fn();

    handleFileOperationSuccess(
      t,
      notifyOperationSuccess,
      showSuccessNotification,
      {
        kind: FileOperationKind.FileRenamed,
        name: 'a.pdf',
        isFolder: false,
      },
    );

    expect(notifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.File,
      EntityOperation.Renamed,
      { name: 'a.pdf' },
    );
  });

  it('reports a renamed folder as NotifiableEntity.Folder', () => {
    const notifyOperationSuccess = vi.fn();
    const showSuccessNotification = vi.fn();

    handleFileOperationSuccess(
      t,
      notifyOperationSuccess,
      showSuccessNotification,
      {
        kind: FileOperationKind.FileRenamed,
        name: 'renamed-folder',
        isFolder: true,
      },
    );

    expect(notifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.Folder,
      EntityOperation.Renamed,
      { name: 'renamed-folder' },
    );
  });

  it('defaults to NotifiableEntity.File when isFolder is omitted', () => {
    const notifyOperationSuccess = vi.fn();
    const showSuccessNotification = vi.fn();

    handleFileOperationSuccess(
      t,
      notifyOperationSuccess,
      showSuccessNotification,
      {
        kind: FileOperationKind.FileRenamed,
        name: 'a.pdf',
      },
    );

    expect(notifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.File,
      EntityOperation.Renamed,
      { name: 'a.pdf' },
    );
  });

  it('reports a created folder as NotifiableEntity.Folder', () => {
    const notifyOperationSuccess = vi.fn();
    const showSuccessNotification = vi.fn();

    handleFileOperationSuccess(
      t,
      notifyOperationSuccess,
      showSuccessNotification,
      { kind: FileOperationKind.FolderCreated, name: 'reports' },
    );

    expect(notifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.Folder,
      EntityOperation.Created,
      { name: 'reports' },
    );
  });

  it('reports a single downloaded file as NotifiableEntity.File', () => {
    const notifyOperationSuccess = vi.fn();
    const showSuccessNotification = vi.fn();

    handleFileOperationSuccess(
      t,
      notifyOperationSuccess,
      showSuccessNotification,
      { kind: FileOperationKind.FileDownloaded, name: 'a.pdf', count: 1 },
    );

    expect(notifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.File,
      EntityOperation.Downloaded,
      { name: 'a.pdf', count: 1 },
    );
  });

  it('reports a downloaded folder archive as NotifiableEntity.Folder', () => {
    const notifyOperationSuccess = vi.fn();
    const showSuccessNotification = vi.fn();

    handleFileOperationSuccess(
      t,
      notifyOperationSuccess,
      showSuccessNotification,
      { kind: FileOperationKind.FileDownloaded, name: 'reports' },
    );

    expect(notifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.Folder,
      EntityOperation.Downloaded,
      { name: 'reports' },
    );
  });

  it('reports a multi-item download as a count-only NotifiableEntity.File', () => {
    const notifyOperationSuccess = vi.fn();
    const showSuccessNotification = vi.fn();

    handleFileOperationSuccess(
      t,
      notifyOperationSuccess,
      showSuccessNotification,
      { kind: FileOperationKind.FilesDownloaded, count: 3 },
    );

    expect(notifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.File,
      EntityOperation.Downloaded,
      { name: '', count: 3 },
    );
  });

  it('builds a single-item copy toast with the destination folder', () => {
    const notifyOperationSuccess = vi.fn();
    const showSuccessNotification = vi.fn();

    handleFileOperationSuccess(
      t,
      notifyOperationSuccess,
      showSuccessNotification,
      {
        kind: FileOperationKind.FileCopied,
        name: 'a.pdf',
        count: 1,
        destinationFolderName: 'reports',
      },
    );

    expect(showSuccessNotification).toHaveBeenCalledWith({
      title: 'dialFileManager.itemCopiedSuccessfully',
      message: 'dialFileManager.itemCopiedToFolder',
    });
  });

  it('builds a multi-item copy toast with the plural wording', () => {
    const notifyOperationSuccess = vi.fn();
    const showSuccessNotification = vi.fn();

    handleFileOperationSuccess(
      t,
      notifyOperationSuccess,
      showSuccessNotification,
      {
        kind: FileOperationKind.FilesCopied,
        count: 3,
        destinationFolderName: 'reports',
      },
    );

    expect(showSuccessNotification).toHaveBeenCalledWith({
      title: 'dialFileManager.itemsCopiedSuccessfully',
      message: 'dialFileManager.itemsCopiedToFolder',
    });
  });

  it('builds a single-item move toast with the destination folder', () => {
    const notifyOperationSuccess = vi.fn();
    const showSuccessNotification = vi.fn();

    handleFileOperationSuccess(
      t,
      notifyOperationSuccess,
      showSuccessNotification,
      {
        kind: FileOperationKind.FileMoved,
        name: 'a.pdf',
        count: 1,
        destinationFolderName: 'reports',
      },
    );

    expect(showSuccessNotification).toHaveBeenCalledWith({
      title: 'dialFileManager.itemMovedSuccessfully',
      message: 'dialFileManager.itemMovedToFolder',
    });
  });

  it('builds a multi-item move toast with the plural wording', () => {
    const notifyOperationSuccess = vi.fn();
    const showSuccessNotification = vi.fn();

    handleFileOperationSuccess(
      t,
      notifyOperationSuccess,
      showSuccessNotification,
      {
        kind: FileOperationKind.FilesMoved,
        count: 3,
        destinationFolderName: 'reports',
      },
    );

    expect(showSuccessNotification).toHaveBeenCalledWith({
      title: 'dialFileManager.itemsMovedSuccessfully',
      message: 'dialFileManager.itemsMovedToFolder',
    });
  });
});

describe('buildFileManagerNotificationOptions', () => {
  it('maps a folder-load failure to the FolderLoadError message', () => {
    const result = buildFileManagerNotificationOptions(t, {
      variant: NotificationVariant.Error,
      reason: FileManagerNotificationReason.FolderLoadFailed,
    });

    expect(result).toEqual({
      variant: NotificationVariant.Error,
      message: 'dialFileManager.folderLoadError',
    });
  });

  it('maps a delete-request failure to the DeleteFilesError message', () => {
    const result = buildFileManagerNotificationOptions(t, {
      variant: NotificationVariant.Error,
      reason: FileManagerNotificationReason.DeleteFailed,
    });

    expect(result).toEqual({
      variant: NotificationVariant.Error,
      message: 'dialFileManager.deleteFilesError',
    });
  });

  it('maps a partial delete failure to the SomeItemsNotDeleted message', () => {
    const result = buildFileManagerNotificationOptions(t, {
      variant: NotificationVariant.Warning,
      reason: FileManagerNotificationReason.FilesDeletePartiallyFailed,
      names: ['a.pdf', 'b.pdf'],
      restCount: 0,
    });

    expect(result).toEqual({
      variant: NotificationVariant.Warning,
      title: 'dialFileManager.itemsDeletingFailed',
      message: 'dialFileManager.someItemsNotDeleted',
    });
  });

  it('maps an upload-batch success to the UploadSuccess message', () => {
    const result = buildFileManagerNotificationOptions(t, {
      variant: NotificationVariant.Success,
      reason: FileManagerNotificationReason.UploadCompleted,
      folder: 'reports',
    });

    expect(result).toEqual({
      variant: NotificationVariant.Success,
      message: 'dialFileManager.uploadSuccess',
    });
  });

  it('falls back to the notification message when reason is absent', () => {
    const result = buildFileManagerNotificationOptions(t, {
      variant: NotificationVariant.Error,
      message: 'custom message',
    });

    expect(result).toEqual({
      variant: NotificationVariant.Error,
      message: 'custom message',
    });
  });
});

describe('buildValidationErrorMessage', () => {
  it('uses folder wording when creating a folder (no item)', () => {
    const message = buildValidationErrorMessage(t, {
      reason: FileNameValidationErrorReason.Empty,
    });
    expect(message).toBe('dialFileManager.folderNameEmpty');
  });

  it('uses rename wording when renaming a file', () => {
    const message = buildValidationErrorMessage(
      t,
      { reason: FileNameValidationErrorReason.Empty },
      { nodeType: DialFileNodeType.ITEM } as never,
    );
    expect(message).toBe('dialFileManager.renameNameEmpty');
  });

  it('uses the rename-tooltip wording for forbidden symbols when renaming a file', () => {
    const message = buildValidationErrorMessage(
      t,
      {
        reason: FileNameValidationErrorReason.ForbiddenSymbols,
        symbols: '/:*',
      },
      { nodeType: DialFileNodeType.ITEM } as never,
    );
    expect(message).toBe('dialFileManager.forbiddenSymbolsTooltip');
  });

  it('uses the folder-invalid-chars wording for forbidden symbols when renaming a folder', () => {
    const message = buildValidationErrorMessage(
      t,
      {
        reason: FileNameValidationErrorReason.ForbiddenSymbols,
        symbols: '/:*',
      },
      { nodeType: DialFileNodeType.FOLDER } as never,
    );
    expect(message).toBe('dialFileManager.folderNameInvalidChars');
  });

  it('uses the folder-hidden wording for a leading dot', () => {
    const message = buildValidationErrorMessage(t, {
      reason: FileNameValidationErrorReason.LeadingDot,
    });
    expect(message).toBe('dialFileManager.folderNameHidden');
  });

  it('uses folder wording for a reserved name (no item)', () => {
    const message = buildValidationErrorMessage(t, {
      reason: FileNameValidationErrorReason.ReservedName,
    });
    expect(message).toBe('dialFileManager.folderNameReserved');
  });

  it('uses rename wording for a name that is too long', () => {
    const message = buildValidationErrorMessage(
      t,
      { reason: FileNameValidationErrorReason.TooLong, maxLength: 255 },
      { nodeType: DialFileNodeType.ITEM } as never,
    );
    expect(message).toBe('dialFileManager.renameNameTooLong');
  });

  it('uses folder wording for a duplicate name (no item)', () => {
    const message = buildValidationErrorMessage(t, {
      reason: FileNameValidationErrorReason.DuplicateName,
      existingName: 'report.pdf',
    });
    expect(message).toBe('dialFileManager.folderConflict');
  });
});
