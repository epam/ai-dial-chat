import type { UseDialFileManagerOptions } from '@epam/ai-dial-chat-hooks';
import { DialFileManagerActions } from '@epam/ai-dial-react-file-manager';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  DialFileManagerI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import { dialFilesApiAdapter } from '../../server-api/dial-files-api.adapter';
import {
  prepareDownloadDestination,
  triggerBrowserDownload,
} from '../../utils/file-download';
import {
  buildFileManagerNotificationOptions,
  buildValidationErrorMessage,
  handleFileOperationSuccess,
} from './file-manager-notification-adapter';

/** Options `useDialFileManager` needs beyond the per-call-site `bucket`/`activeTab`/`rootLabel`/`variant`/`actionProfile`/`forbiddenSymbolsRegExp` values. */
type DialFileManagerHostOptions = Pick<
  UseDialFileManagerOptions,
  | 'filesApi'
  | 'labels'
  | 'locale'
  | 'disabledNewButtonTooltip'
  | 'downloadDestination'
  | 'buildValidationErrorMessage'
  | 'onNotification'
  | 'onOperationSuccess'
>;

/**
 * Builds the host-owned portion of `useDialFileManager`'s options —
 * translated action labels, the `DialFilesApi` adapter, the browser
 * download seam, and the structured-event-to-toast adapters — shared by
 * `DialFileManagerModal` and `DialFileManagerPage` so the wiring lives once.
 */
export const useDialFileManagerHostOptions = (): DialFileManagerHostOptions => {
  const { t, i18n } = useTranslation();
  const { showNotification, showSuccessNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();

  const labels = useMemo(
    (): Partial<Record<DialFileManagerActions, string>> => ({
      [DialFileManagerActions.Download]: t(ButtonsI18nKeys.Download),
      [DialFileManagerActions.Delete]: t(ButtonsI18nKeys.Delete),
      [DialFileManagerActions.Rename]: t(ButtonsI18nKeys.Rename),
      [DialFileManagerActions.Copy]: t(ButtonsI18nKeys.Copy),
      [DialFileManagerActions.Move]: t(DialFileManagerI18nKeys.MoveAction),
      [DialFileManagerActions.Duplicate]: t(ButtonsI18nKeys.Duplicate),
      [DialFileManagerActions.RemoveAccess]: t(
        DialFileManagerI18nKeys.RemoveAccessAction,
      ),
      [DialFileManagerActions.Unshare]: t(
        DialFileManagerI18nKeys.UnshareAction,
      ),
      [DialFileManagerActions.Info]: t(DialFileManagerI18nKeys.InfoAction),
    }),
    [t],
  );

  const downloadDestination = useMemo(
    () => ({
      resolveDestination: prepareDownloadDestination,
      triggerDownload: triggerBrowserDownload,
    }),
    [],
  );

  const onNotification = useCallback<
    NonNullable<DialFileManagerHostOptions['onNotification']>
  >(
    (notification) =>
      showNotification(buildFileManagerNotificationOptions(t, notification)),
    [t, showNotification],
  );

  const onOperationSuccess = useCallback<
    NonNullable<DialFileManagerHostOptions['onOperationSuccess']>
  >(
    (event) =>
      handleFileOperationSuccess(
        t,
        notifyOperationSuccess,
        showSuccessNotification,
        event,
      ),
    [t, notifyOperationSuccess, showSuccessNotification],
  );

  const buildValidationErrorMessageOption = useCallback<
    DialFileManagerHostOptions['buildValidationErrorMessage']
  >((error, item) => buildValidationErrorMessage(t, error, item), [t]);

  return {
    filesApi: dialFilesApiAdapter,
    labels,
    locale: i18n.language,
    disabledNewButtonTooltip: t(DialFileManagerI18nKeys.NoPermissionToCreate),
    downloadDestination,
    buildValidationErrorMessage: buildValidationErrorMessageOption,
    onNotification,
    onOperationSuccess,
  };
};
