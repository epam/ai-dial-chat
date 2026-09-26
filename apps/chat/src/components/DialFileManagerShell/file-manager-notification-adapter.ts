import {
  FileManagerNotificationReason,
  FileNameValidationErrorReason,
  FileOperationKind,
  type FileManagerNotification,
  type FileNameValidationError,
  type FileOperationSuccessEvent,
} from '@epam/ai-dial-chat-hooks';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import {
  NOT_ALLOWED_SYMBOLS,
  type NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import type { TFunction } from 'i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import type { useOperationNotification } from '../../hooks/useOperationNotification';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';

/** `notifyOperationSuccess` returned by `useOperationNotification`. */
type NotifyOperationSuccess = ReturnType<
  typeof useOperationNotification
>['notifyOperationSuccess'];

/** Options accepted by `showSuccessNotification` (from `useNotification`). */
type ShowSuccessNotification = (options: {
  title?: string;
  message: string;
}) => void;

/**
 * Translates a `FileManagerNotification`'s library-owned `reason` into the
 * `{variant, title?, message}` shape `useNotification`'s `showNotification`
 * expects, reproducing the exact copy the pre-extraction hooks built inline.
 */
export const buildFileManagerNotificationOptions = (
  t: TFunction,
  notification: FileManagerNotification,
): { variant: NotificationVariant; title?: string; message: string } => {
  const { variant, reason, count, name, folder, names, restCount } =
    notification;

  const buildNamesWithRest = (): string => {
    const joined = (names ?? []).join(', ');
    if (restCount == null || restCount <= 0) return joined;
    return `${joined}${t(DialFileManagerI18nKeys.AndOtherItems, { count: restCount })}`;
  };

  switch (reason) {
    case FileManagerNotificationReason.FolderLoadFailed:
      return { variant, message: t(DialFileManagerI18nKeys.FolderLoadError) };
    case FileManagerNotificationReason.MetadataLoadFailed:
      return { variant, message: t(DialFileManagerI18nKeys.GetInfoError) };
    case FileManagerNotificationReason.FolderCreateFailed:
      return {
        variant,
        message: t(DialFileManagerI18nKeys.FolderCreateError),
      };
    case FileManagerNotificationReason.DownloadFileFailed:
      return {
        variant,
        message: t(DialFileManagerI18nKeys.DownloadFileError),
      };
    case FileManagerNotificationReason.DownloadFilesFailed:
      return {
        variant,
        message: t(DialFileManagerI18nKeys.DownloadFilesError),
      };
    case FileManagerNotificationReason.FilesDeleted:
      return {
        variant,
        title: t(
          count === 1
            ? DialFileManagerI18nKeys.ItemDeletedSuccessfully
            : DialFileManagerI18nKeys.ItemsDeletedSuccessfully,
        ),
        message: t(
          count === 1
            ? DialFileManagerI18nKeys.ItemDeletedFromFolder
            : DialFileManagerI18nKeys.ItemsDeletedFromFolder,
          { count, fileName: name, folder },
        ),
      };
    case FileManagerNotificationReason.FilesDeletePartiallyFailed:
      return {
        variant,
        title: t(DialFileManagerI18nKeys.ItemsDeletingFailed),
        message: t(DialFileManagerI18nKeys.SomeItemsNotDeleted, {
          files: (names ?? []).join(', '),
          rest:
            restCount != null && restCount > 0
              ? t(DialFileManagerI18nKeys.AndOtherItems, { count: restCount })
              : '',
        }),
      };
    case FileManagerNotificationReason.DeleteFailed:
      return { variant, message: t(DialFileManagerI18nKeys.DeleteFilesError) };
    case FileManagerNotificationReason.RenameFailed:
      return { variant, message: t(DialFileManagerI18nKeys.RenameError) };
    case FileManagerNotificationReason.RenamePartiallyFailed:
      return {
        variant,
        message: t(DialFileManagerI18nKeys.RenamePartialError, { count }),
      };
    case FileManagerNotificationReason.MoveFailed:
      return { variant, message: t(DialFileManagerI18nKeys.MoveError) };
    case FileManagerNotificationReason.MovePartiallyFailed:
      return {
        variant,
        message: t(DialFileManagerI18nKeys.MovePartialError, { count }),
      };
    case FileManagerNotificationReason.CopyFailed:
      return { variant, message: t(DialFileManagerI18nKeys.CopyError) };
    case FileManagerNotificationReason.CopyPartiallyFailed:
      return {
        variant,
        message: t(DialFileManagerI18nKeys.CopyPartialError, { count }),
      };
    case FileManagerNotificationReason.UnshareFailed:
      return { variant, message: t(DialFileManagerI18nKeys.UnshareError) };
    case FileManagerNotificationReason.RemoveAccessFailed:
      return {
        variant,
        message: t(DialFileManagerI18nKeys.RemoveAccessError),
      };
    case FileManagerNotificationReason.UploadFailed:
      return {
        variant,
        title: t(DialFileManagerI18nKeys.UploadFailed),
        message: t(DialFileManagerI18nKeys.CheckInternetConnection),
      };
    case FileManagerNotificationReason.UploadCompleted:
      return {
        variant,
        message: t(DialFileManagerI18nKeys.UploadSuccess, {
          parentPath: folder,
        }),
      };
    case FileManagerNotificationReason.UploadArchiveFailed:
      return {
        variant,
        message: t(DialFileManagerI18nKeys.UploadArchiveFilesError, {
          count: (names ?? []).length + (restCount ?? 0),
          files: buildNamesWithRest(),
        }),
      };
    case FileManagerNotificationReason.UploadArchivePartiallyFailed:
      return {
        variant,
        message: t(DialFileManagerI18nKeys.UploadArchivePartialError, {
          count,
          files: buildNamesWithRest(),
        }),
      };
    case FileManagerNotificationReason.UploadArchiveRequestFailed:
      return {
        variant,
        message: t(DialFileManagerI18nKeys.UploadArchiveError),
      };
    default:
      return { variant, message: notification.message ?? '' };
  }
};

interface TransferNotificationKeys {
  fileTitle: DialFileManagerI18nKeys;
  folderTitle: DialFileManagerI18nKeys;
  itemsTitle: DialFileManagerI18nKeys;
  message: DialFileManagerI18nKeys;
  itemsMessage: DialFileManagerI18nKeys;
}

const COPY_NOTIFICATION_KEYS: TransferNotificationKeys = {
  fileTitle: DialFileManagerI18nKeys.FileCopiedSuccessfully,
  folderTitle: DialFileManagerI18nKeys.FolderCopiedSuccessfully,
  itemsTitle: DialFileManagerI18nKeys.ItemsCopiedSuccessfully,
  message: DialFileManagerI18nKeys.CopiedToFolder,
  itemsMessage: DialFileManagerI18nKeys.CopiedToFolder,
};

const MOVE_NOTIFICATION_KEYS: TransferNotificationKeys = {
  fileTitle: DialFileManagerI18nKeys.FileMovedSuccessfully,
  folderTitle: DialFileManagerI18nKeys.FolderMovedSuccessfully,
  itemsTitle: DialFileManagerI18nKeys.ItemsMovedSuccessfully,
  message: DialFileManagerI18nKeys.MovedToFolder,
  itemsMessage: DialFileManagerI18nKeys.MovedToFolder,
};

const DUPLICATE_NOTIFICATION_KEYS: TransferNotificationKeys = {
  fileTitle: DialFileManagerI18nKeys.FileDuplicatedSuccessfully,
  folderTitle: DialFileManagerI18nKeys.FolderDuplicatedSuccessfully,
  itemsTitle: DialFileManagerI18nKeys.ItemsDuplicatedSuccessfully,
  message: DialFileManagerI18nKeys.DuplicatedToSameFolder,
  itemsMessage: DialFileManagerI18nKeys.ItemsDuplicatedToSameFolder,
};

const getTransferNotificationKeys = (
  kind: FileOperationKind,
): TransferNotificationKeys => {
  switch (kind) {
    case FileOperationKind.FileMoved:
    case FileOperationKind.FilesMoved:
      return MOVE_NOTIFICATION_KEYS;
    case FileOperationKind.FileDuplicated:
    case FileOperationKind.FilesDuplicated:
      return DUPLICATE_NOTIFICATION_KEYS;
    default:
      return COPY_NOTIFICATION_KEYS;
  }
};

const isSingleItemTransfer = (kind: FileOperationKind): boolean =>
  kind === FileOperationKind.FileCopied ||
  kind === FileOperationKind.FileMoved ||
  kind === FileOperationKind.FileDuplicated;

/* `My files/reports/q1` → `My files / reports / q1`, as the toast shows it. */
const formatDestinationFolderPath = (folder?: string): string =>
  (folder ?? '').split('/').filter(Boolean).join(' / ');

/**
 * Builds the copy/move/duplicate success toast: the title names the single
 * file or folder (or the item count), and the message names the destination
 * folder path — or, for a duplicate, says the copy stays in the same folder.
 */
const buildTransferNotification = (
  t: TFunction,
  event: FileOperationSuccessEvent,
): { title: string; message: string } => {
  const keys = getTransferNotificationKeys(event.kind);
  const isSingle = isSingleItemTransfer(event.kind);

  let titleKey = keys.itemsTitle;
  if (isSingle) {
    titleKey = event.isFolder ? keys.folderTitle : keys.fileTitle;
  }

  return {
    title: t(titleKey, { name: event.name, count: event.count }),
    message: t(isSingle ? keys.message : keys.itemsMessage, {
      folder: formatDestinationFolderPath(event.destinationFolderName),
    }),
  };
};

/**
 * Translates a `FileOperationSuccessEvent` into the existing
 * `useOperationNotification`/`showSuccessNotification` calls, reproducing the
 * exact copy the pre-extraction `useDialFileMutations` produced for each
 * mutation's success toast.
 */
export const handleFileOperationSuccess = (
  t: TFunction,
  notifyOperationSuccess: NotifyOperationSuccess,
  showSuccessNotification: ShowSuccessNotification,
  event: FileOperationSuccessEvent,
): void => {
  switch (event.kind) {
    case FileOperationKind.FolderCreated:
      notifyOperationSuccess(NotifiableEntity.Folder, EntityOperation.Created, {
        name: event.name ?? '',
      });
      return;
    case FileOperationKind.FileDownloaded:
      if (event.count === 1) {
        notifyOperationSuccess(
          NotifiableEntity.File,
          EntityOperation.Downloaded,
          { name: event.name ?? '', count: 1 },
        );
      } else {
        notifyOperationSuccess(
          NotifiableEntity.Folder,
          EntityOperation.Downloaded,
          { name: event.name ?? '' },
        );
      }
      return;
    case FileOperationKind.FilesDownloaded:
      notifyOperationSuccess(
        NotifiableEntity.File,
        EntityOperation.Downloaded,
        {
          name: '',
          count: event.count ?? 0,
        },
      );
      return;
    case FileOperationKind.FileRenamed:
      notifyOperationSuccess(
        event.isFolder ? NotifiableEntity.Folder : NotifiableEntity.File,
        EntityOperation.Renamed,
        { name: event.name ?? '' },
      );
      return;
    case FileOperationKind.FileCopied:
    case FileOperationKind.FilesCopied:
    case FileOperationKind.FileMoved:
    case FileOperationKind.FilesMoved:
    case FileOperationKind.FileDuplicated:
    case FileOperationKind.FilesDuplicated:
      showSuccessNotification(buildTransferNotification(t, event));
      return;
  }
};

/**
 * Translates a structured `FileNameValidationError` into the exact message
 * text the pre-extraction `onCreateFolderValidate`/`onRenameValidate`
 * produced. `item` is passed for a rename (so folder vs. file wording can
 * differ, matching the original's `nodeType` branch) and omitted for folder
 * creation, which always used the folder wording.
 */
export const buildValidationErrorMessage = (
  t: TFunction,
  error: FileNameValidationError,
  item?: DialFile,
): string => {
  const isRename = item != null;
  const isFolder = item != null && item.nodeType === DialFileNodeType.FOLDER;

  switch (error.reason) {
    case FileNameValidationErrorReason.Empty:
      return t(
        isRename
          ? DialFileManagerI18nKeys.RenameNameEmpty
          : DialFileManagerI18nKeys.FolderNameEmpty,
      );
    case FileNameValidationErrorReason.ForbiddenSymbols:
      return t(
        isRename && !isFolder
          ? DialFileManagerI18nKeys.ForbiddenSymbolsTooltip
          : DialFileManagerI18nKeys.FolderNameInvalidChars,
        { notAllowedSymbols: error.symbols ?? NOT_ALLOWED_SYMBOLS },
      );
    case FileNameValidationErrorReason.LeadingDot:
      return t(DialFileManagerI18nKeys.FolderNameHidden);
    case FileNameValidationErrorReason.ReservedName:
      return t(
        isRename
          ? DialFileManagerI18nKeys.RenameReservedName
          : DialFileManagerI18nKeys.FolderNameReserved,
      );
    case FileNameValidationErrorReason.TooLong:
      return t(
        isRename
          ? DialFileManagerI18nKeys.RenameNameTooLong
          : DialFileManagerI18nKeys.FolderNameTooLong,
      );
    case FileNameValidationErrorReason.DuplicateName:
      return t(
        isRename
          ? DialFileManagerI18nKeys.RenameDuplicateName
          : DialFileManagerI18nKeys.FolderNameDuplicate,
      );
  }
};
