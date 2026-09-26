import {
  FileManagerNotificationReason,
  FileNameValidationErrorReason,
  FileOperationKind,
  type FileOperationSuccessEvent,
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

  describe('copy, move, and duplicate toasts', () => {
    const tWithParams = ((key: string, params?: Record<string, unknown>) =>
      params == null ? key : `${key} ${JSON.stringify(params)}`) as typeof t;

    const notify = (event: FileOperationSuccessEvent) => {
      const showSuccessNotification = vi.fn();
      handleFileOperationSuccess(
        tWithParams,
        vi.fn(),
        showSuccessNotification,
        event,
      );
      return showSuccessNotification;
    };

    it.each([
      [FileOperationKind.FileCopied, false, 'fileCopiedSuccessfully'],
      [FileOperationKind.FileCopied, true, 'folderCopiedSuccessfully'],
      [FileOperationKind.FileMoved, false, 'fileMovedSuccessfully'],
      [FileOperationKind.FileMoved, true, 'folderMovedSuccessfully'],
    ])(
      'names the single %s item (isFolder: %s) in the title and the destination path in the message',
      (kind, isFolder, titleKey) => {
        const messageKey =
          kind === FileOperationKind.FileMoved
            ? 'movedToFolder'
            : 'copiedToFolder';

        expect(
          notify({
            kind,
            name: '09document_scan.png',
            count: 1,
            isFolder,
            destinationFolderName: 'My files/DK Test/DK Test with nested',
          }),
        ).toHaveBeenCalledWith({
          title: `dialFileManager.${titleKey} {"name":"09document_scan.png","count":1}`,
          message: `dialFileManager.${messageKey} {"folder":"My files / DK Test / DK Test with nested"}`,
        });
      },
    );

    it.each([
      [
        FileOperationKind.FilesCopied,
        'itemsCopiedSuccessfully',
        'copiedToFolder',
      ],
      [FileOperationKind.FilesMoved, 'itemsMovedSuccessfully', 'movedToFolder'],
    ])(
      'uses the item count for a multi-item %s toast',
      (kind, titleKey, messageKey) => {
        expect(
          notify({
            kind,
            name: 'a.pdf',
            count: 4,
            isFolder: false,
            destinationFolderName: 'My files/reports',
          }),
        ).toHaveBeenCalledWith({
          title: `dialFileManager.${titleKey} {"name":"a.pdf","count":4}`,
          message: `dialFileManager.${messageKey} {"folder":"My files / reports"}`,
        });
      },
    );

    it('builds a single duplicated folder toast that points at the same folder', () => {
      expect(
        notify({
          kind: FileOperationKind.FileDuplicated,
          name: '08folder (1)',
          count: 1,
          isFolder: true,
          destinationFolderName: 'My files',
        }),
      ).toHaveBeenCalledWith({
        title:
          'dialFileManager.folderDuplicatedSuccessfully {"name":"08folder (1)","count":1}',
        message: 'dialFileManager.duplicatedToSameFolder {"folder":"My files"}',
      });
    });

    it('builds a multi-item duplicate toast with the plural same-folder message', () => {
      expect(
        notify({
          kind: FileOperationKind.FilesDuplicated,
          name: 'a (1).pdf',
          count: 4,
          isFolder: false,
          destinationFolderName: 'My files',
        }),
      ).toHaveBeenCalledWith({
        title:
          'dialFileManager.itemsDuplicatedSuccessfully {"name":"a (1).pdf","count":4}',
        message:
          'dialFileManager.itemsDuplicatedToSameFolder {"folder":"My files"}',
      });
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
