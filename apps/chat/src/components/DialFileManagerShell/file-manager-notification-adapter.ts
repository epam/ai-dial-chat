import {
  FileManagerNotificationReason,
  FileNameValidationErrorReason,
  FileOperationKind,
  type FileManagerNotification,
  type FileNameValidationError,
  type FileOperationSuccessEvent,
} from '@epam/ai-dial-chat-hooks';
import { FileUploadFailureReason } from '@epam/ai-dial-chat-shared';
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

/** Host-resolved values `buildFileManagerNotificationOptions` interpolates into its copy. */
interface FileManagerNotificationContext {
  /** Configured maximum upload size, already formatted (e.g. `512 MB`); `undefined` when no limit is configured. */
  maxUploadSize?: string;
}

/** Body of the `UploadFailed` toast for the reason every failed file shared; `undefined` means mixed reasons. */
const buildUploadFailedMessage = (
  t: TFunction,
  failureReason: FileUploadFailureReason | undefined,
  maxUploadSize: string | undefined,
): string => {
  switch (failureReason) {
    case FileUploadFailureReason.Network:
      return t(DialFileManagerI18nKeys.CheckInternetConnection);
    case FileUploadFailureReason.TooLarge:
      return maxUploadSize != null
        ? t(DialFileManagerI18nKeys.UploadFileTooLarge, {
            maxSize: maxUploadSize,
          })
        : t(DialFileManagerI18nKeys.UploadFailedTooLarge);
    case FileUploadFailureReason.Conflict:
      return t(DialFileManagerI18nKeys.UploadConflict);
    case FileUploadFailureReason.Forbidden:
      return t(DialFileManagerI18nKeys.NoPermissionToCreate);
    case FileUploadFailureReason.Unavailable:
      return t(DialFileManagerI18nKeys.UploadFailedUnavailable);
    default:
      return t(DialFileManagerI18nKeys.UploadFailedSeeQueue);
  }
};

/** Reasons whose toast is a single message with no interpolated values. */
const MESSAGE_ONLY_NOTIFICATION_KEYS: Partial<
  Record<FileManagerNotificationReason, DialFileManagerI18nKeys>
> = {
  [FileManagerNotificationReason.FolderLoadFailed]:
    DialFileManagerI18nKeys.FolderLoadError,
  [FileManagerNotificationReason.MetadataLoadFailed]:
    DialFileManagerI18nKeys.GetInfoError,
  [FileManagerNotificationReason.FolderCreateFailed]:
    DialFileManagerI18nKeys.FolderCreateError,
  [FileManagerNotificationReason.DownloadFileFailed]:
    DialFileManagerI18nKeys.DownloadFileError,
  [FileManagerNotificationReason.DownloadFilesFailed]:
    DialFileManagerI18nKeys.DownloadFilesError,
  [FileManagerNotificationReason.DeleteFailed]:
    DialFileManagerI18nKeys.DeleteFilesError,
  [FileManagerNotificationReason.RenameFailed]:
    DialFileManagerI18nKeys.RenameError,
  [FileManagerNotificationReason.MoveFailed]: DialFileManagerI18nKeys.MoveError,
  [FileManagerNotificationReason.CopyFailed]: DialFileManagerI18nKeys.CopyError,
  [FileManagerNotificationReason.UnshareFailed]:
    DialFileManagerI18nKeys.UnshareError,
  [FileManagerNotificationReason.RemoveAccessFailed]:
    DialFileManagerI18nKeys.RemoveAccessError,
  [FileManagerNotificationReason.UploadArchiveRequestFailed]:
    DialFileManagerI18nKeys.UploadArchiveError,
  [FileManagerNotificationReason.CrossSectionTransferUnsupported]:
    DialFileManagerI18nKeys.CrossSectionTransferUnsupported,
};

/** Partial-failure reasons whose message interpolates only the failed item count. */
const COUNT_MESSAGE_NOTIFICATION_KEYS: Partial<
  Record<FileManagerNotificationReason, DialFileManagerI18nKeys>
> = {
  [FileManagerNotificationReason.RenamePartiallyFailed]:
    DialFileManagerI18nKeys.RenamePartialError,
  [FileManagerNotificationReason.MovePartiallyFailed]:
    DialFileManagerI18nKeys.MovePartialError,
  [FileManagerNotificationReason.CopyPartiallyFailed]:
    DialFileManagerI18nKeys.CopyPartialError,
};

/**
 * Translates a `FileManagerNotification`'s library-owned `reason` into the
 * `{variant, title?, message}` shape `useNotification`'s `showNotification`
 * expects, reproducing the exact copy the pre-extraction hooks built inline.
 */
export const buildFileManagerNotificationOptions = (
  t: TFunction,
  notification: FileManagerNotification,
  { maxUploadSize }: FileManagerNotificationContext = {},
): { variant: NotificationVariant; title?: string; message: string } => {
  const {
    variant,
    reason,
    count,
    name,
    folder,
    names,
    restCount,
    failureReason,
  } = notification;

  const buildNamesWithRest = (): string => {
    const joined = (names ?? []).join(', ');
    if (restCount == null || restCount <= 0) return joined;
    return `${joined}${t(DialFileManagerI18nKeys.AndOtherItems, { count: restCount })}`;
  };

  if (reason != null) {
    const messageKey = MESSAGE_ONLY_NOTIFICATION_KEYS[reason];
    if (messageKey != null) {
      return { variant, message: t(messageKey) };
    }
    const countMessageKey = COUNT_MESSAGE_NOTIFICATION_KEYS[reason];
    if (countMessageKey != null) {
      return { variant, message: t(countMessageKey, { count }) };
    }
  }

  switch (reason) {
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
    case FileManagerNotificationReason.UploadFailed:
      return {
        variant,
        title: t(DialFileManagerI18nKeys.UploadFailed),
        message: buildUploadFailedMessage(t, failureReason, maxUploadSize),
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

/** Move and duplicate kinds; every other transfer kind uses the copy keys. */
const TRANSFER_NOTIFICATION_KEYS: Partial<
  Record<FileOperationKind, TransferNotificationKeys>
> = {
  [FileOperationKind.FileMoved]: MOVE_NOTIFICATION_KEYS,
  [FileOperationKind.FilesMoved]: MOVE_NOTIFICATION_KEYS,
  [FileOperationKind.FileDuplicated]: DUPLICATE_NOTIFICATION_KEYS,
  [FileOperationKind.FilesDuplicated]: DUPLICATE_NOTIFICATION_KEYS,
};

const getTransferNotificationKeys = (
  kind: FileOperationKind,
): TransferNotificationKeys =>
  TRANSFER_NOTIFICATION_KEYS[kind] ?? COPY_NOTIFICATION_KEYS;

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
    case FileOperationKind.FilesUnshared:
      showSuccessNotification({
        title: t(DialFileManagerI18nKeys.UnshareSuccessTitle),
        message: t(
          event.count === 1
            ? DialFileManagerI18nKeys.UnshareSuccessMessageSingle
            : DialFileManagerI18nKeys.UnshareSuccessMessageMultiple,
          { name: event.name, count: event.count },
        ),
      });
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

/** Rename and create-folder wording of the validation errors that interpolate nothing. */
interface ValidationErrorKeys {
  rename: DialFileManagerI18nKeys;
  create: DialFileManagerI18nKeys;
}

const VALIDATION_ERROR_KEYS: Record<
  Exclude<
    FileNameValidationErrorReason,
    FileNameValidationErrorReason.ForbiddenSymbols
  >,
  ValidationErrorKeys
> = {
  [FileNameValidationErrorReason.Empty]: {
    rename: DialFileManagerI18nKeys.RenameNameEmpty,
    create: DialFileManagerI18nKeys.FolderNameEmpty,
  },
  [FileNameValidationErrorReason.ReservedName]: {
    rename: DialFileManagerI18nKeys.RenameReservedName,
    create: DialFileManagerI18nKeys.FolderNameReserved,
  },
  [FileNameValidationErrorReason.TooLong]: {
    rename: DialFileManagerI18nKeys.RenameNameTooLong,
    create: DialFileManagerI18nKeys.FolderNameTooLong,
  },
  [FileNameValidationErrorReason.DuplicateName]: {
    rename: DialFileManagerI18nKeys.RenameDuplicateName,
    create: DialFileManagerI18nKeys.FolderNameDuplicate,
  },
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

  if (error.reason === FileNameValidationErrorReason.ForbiddenSymbols) {
    return t(
      isRename && !isFolder
        ? DialFileManagerI18nKeys.ForbiddenSymbolsTooltip
        : DialFileManagerI18nKeys.FolderNameInvalidChars,
      { notAllowedSymbols: error.symbols ?? NOT_ALLOWED_SYMBOLS },
    );
  }
  const keys = VALIDATION_ERROR_KEYS[error.reason];
  return t(isRename ? keys.rename : keys.create);
};
