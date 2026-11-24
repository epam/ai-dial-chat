import type { DeploymentCreationFormValues } from '@epam/ai-dial-builder-form';
import {
  ApplicationAccessSaveOutcome,
  ResourceSaveError,
  useApplicationAccessSync,
  type ApplicationAccessLoadStatus,
  type ApplicationAccessSaveResult,
  type UseApplicationAccessResult,
} from '@epam/ai-dial-chat-hooks';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AppsEditorI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import {
  getApplicationResourceDependencies,
  updateApplicationAccess,
} from '../../server-api/applications';
import { toApplicationMetadataFields } from '../../utils/application-editor';

interface Params {
  /** Whether the edited kind has the Access section. */
  isEnabled: boolean;
  /** Id of the edited application; empty while a new one is being created. */
  appId: string;
  /** Whether the stored list is read for `appId`; `false` once this session created the application, whose list the editor already holds. */
  shouldLoad: boolean;
  /** Message shown when saving fails for a reason the section has no wording for. */
  failedMessage: string;
}

/** The Access section's draft, its stored-list load and its save step. */
export interface ApplicationAccessEditor {
  /** The draft and its derived state. */
  access: UseApplicationAccessResult;
  /** Where the stored list stands; the section is editable only once `Loaded`. */
  status: ApplicationAccessLoadStatus;
  /** Whether the stored list the editor loaded holds at least one entry. */
  hasStoredEntries: boolean;
  /** Reads the stored list again after a failed read. */
  retry: () => void;
  /**
   * Saves the draft when it differs from the stored list and reports whether
   * the save carries on. Core refusing a non-administrator's change shows a
   * warning, keeps the draft and carries on; any other failure shows its
   * error, keeps the draft and reports `false`.
   */
  save: (
    applicationId: string,
    metadata: DeploymentCreationFormValues,
  ) => Promise<boolean>;
  /**
   * The same step for a save the Save panel runs. Core refusing a
   * non-administrator's change shows the warning, keeps the draft and
   * resolves, so the panel carries on; any other failure rejects with a
   * `ResourceSaveError` carrying the message, which the panel shows inline as
   * a failed save. The draft is kept.
   */
  saveOrThrow: (
    applicationId: string,
    metadata: DeploymentCreationFormValues,
  ) => Promise<void>;
}

const loadStoredList = async (appId: string) =>
  (await getApplicationResourceDependencies(appId)).resourceDependencies;

const saveList = (
  appId: string,
  list: Parameters<typeof updateApplicationAccess>[2],
  metadata: DeploymentCreationFormValues,
) =>
  updateApplicationAccess(appId, toApplicationMetadataFields(metadata), list);

/**
 * Wires the Access state of an application editor to the generated client,
 * and shows the refusal and failure notifications with translated text.
 */
export const useApplicationAccessEditor = ({
  isEnabled,
  appId,
  shouldLoad,
  failedMessage,
}: Params): ApplicationAccessEditor => {
  const { t } = useTranslation();
  const { showErrorNotification, showWarningNotification } = useNotification();
  const {
    access,
    status,
    hasStoredEntries,
    retry,
    save: sync,
  } = useApplicationAccessSync<DeploymentCreationFormValues>({
    isEnabled,
    appId,
    shouldLoad,
    loadStoredList,
    saveList,
  });

  /* Resolves to the message of a failed save, or `undefined` when the save carries on. */
  const report = useCallback(
    (result: ApplicationAccessSaveResult): string | undefined => {
      if (result.outcome === ApplicationAccessSaveOutcome.Refused) {
        showWarningNotification({
          message: t(AppsEditorI18nKeys.AccessAdminOnlyError),
          requestId: result.traceId,
        });
      }
      if (result.outcome === ApplicationAccessSaveOutcome.Failed) {
        return result.message ?? failedMessage;
      }
      return undefined;
    },
    [failedMessage, showWarningNotification, t],
  );

  const save = useCallback(
    async (
      applicationId: string,
      metadata: DeploymentCreationFormValues,
    ): Promise<boolean> => {
      const result = await sync(applicationId, metadata);
      const failedWith = report(result);
      if (failedWith == null) return true;
      showErrorNotification({ message: failedWith, requestId: result.traceId });
      return false;
    },
    [report, showErrorNotification, sync],
  );

  const saveOrThrow = useCallback(
    async (
      applicationId: string,
      metadata: DeploymentCreationFormValues,
    ): Promise<void> => {
      const failedWith = report(await sync(applicationId, metadata));
      if (failedWith != null) throw new ResourceSaveError(failedWith);
    },
    [report, sync],
  );

  return { access, status, hasStoredEntries, retry, save, saveOrThrow };
};
