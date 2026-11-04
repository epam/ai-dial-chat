import { SEMVER_VERSION_PATTERN } from '@epam/ai-dial-builder-form';
import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import {
  SaveVersionMode,
  toFolderPathKey,
  type FolderDestination,
  type PublicationRule,
} from '@epam/ai-dial-publish-panel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceSavePanelI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import type {
  PublishSavedResource,
  ResourceSaveAdapter,
  ResourceSaveResult,
} from '../../models/resource-save';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import {
  ResourceSaveOutcome,
  SaveDestinationRoot,
} from '../../types/resource-save';
import { getPublishFolderLabel } from '../../utils/publish';
import { ResourceSaveError, runResourceSave } from '../../utils/resource-save';
import { useOperationNotification } from '../useOperationNotification';

/** Parameters for {@link useResourceSavePanel}. */
export interface UseResourceSavePanelParams {
  /** Whether the panel is open; every opening starts from the resource's current location and version. */
  isOpen: boolean;
  /** The resource-specific save operations. */
  adapter: ResourceSaveAdapter;
  /** Full id of the resource being edited. */
  resourceId: string;
  /** Its current Personal folder. */
  currentFolderPath: string[];
  /** Display name, interpolated into notifications. */
  resourceName: string;
  /** Current version; omit for an unversioned resource. */
  currentVersion?: string;
  /** Entity the success notifications name. */
  notifiableEntity: NotifiableEntity;
  /** Schema display name, for `NotifiableEntity.SchemaApp` copy. */
  notificationType?: string;
  /** Sends the publish request for an Organization destination. */
  publish: PublishSavedResource;
  /** Records an Organization folder a publish succeeded to. */
  rememberPublishFolder: (folderPath: string[]) => void;
  /** Called once a save whose first step succeeded has finished. */
  onSaved: (result: ResourceSaveResult) => void;
  /** Fetches the access rules already configured on an Organization folder. */
  fetchRules?: (folderPath: string[]) => Promise<PublicationRule[]>;
}

/** Result of {@link useResourceSavePanel}. */
export interface UseResourceSavePanelResult {
  /** The confirmed destination. */
  destination: FolderDestination;
  /** Replaces the confirmed destination. */
  setDestination: (destination: FolderDestination) => void;
  /** The selected version mode. */
  versionMode: SaveVersionMode;
  /** Selects a version mode. */
  setVersionMode: (mode: SaveVersionMode) => void;
  /** Value of the new version input. */
  newVersion: string;
  /** Updates the new version input and clears a backend conflict. */
  setNewVersion: (version: string) => void;
  /** Marks the new version input as visited, so its error shows. */
  markNewVersionTouched: () => void;
  /** Translated error of the new version input, shown once visited or submitted. */
  newVersionError?: string;
  /** Whether a save is in flight. */
  isSubmitting: boolean;
  /** Translated error of the last failed save. */
  submitError?: string;
  /** Whether Save must stay disabled. */
  isSubmitDisabled: boolean;
  /** Runs the save for the current choice. */
  submit: () => Promise<void>;
  /** Access rules of the Organization folder being chosen or confirmed. */
  rules: PublicationRule[];
  /** Replaces the access rules. */
  setRules: (rules: PublicationRule[]) => void;
  /** Whether that folder's existing rules are being fetched. */
  isRulesLoading: boolean;
  /** Whether the last existing-rules fetch failed. */
  hasRulesLoadError: boolean;
  /** Reports the folder view's pending destination; a new Organization folder loads its rules. */
  setPendingDestination: (destination: FolderDestination | undefined) => void;
}

/**
 * Owns the Save panel's choice — destination, version mode, new version —
 * and runs it, because every editor that saves through the panel needs the
 * same validation, sequencing and notifications; only the adapter differs.
 */
export const useResourceSavePanel = ({
  isOpen,
  adapter,
  resourceId,
  currentFolderPath,
  resourceName,
  currentVersion,
  notifiableEntity,
  notificationType,
  publish,
  rememberPublishFolder,
  onSaved,
  fetchRules,
}: UseResourceSavePanelParams): UseResourceSavePanelResult => {
  const { t } = useTranslation();
  const { showErrorNotification, showSuccessNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();

  const initialDestination = useMemo<FolderDestination>(
    () => ({ rootKey: SaveDestinationRoot.Personal, path: currentFolderPath }),
    [currentFolderPath],
  );
  const [destination, setDestination] = useState(initialDestination);
  const [versionMode, setVersionMode] = useState(SaveVersionMode.Keep);
  const [newVersion, setNewVersionValue] = useState('');
  const [isNewVersionTouched, setIsNewVersionTouched] = useState(false);
  const [conflictedVersion, setConflictedVersion] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [rules, setRules] = useState<PublicationRule[]>([]);
  const [isRulesLoading, setIsRulesLoading] = useState(false);
  const [hasRulesLoadError, setHasRulesLoadError] = useState(false);
  /* Folder the current rules belong to, so returning to it keeps the user's edits; also guards stale fetches. */
  const rulesFolderKeyRef = useRef<string | undefined>(undefined);

  const clearRules = useCallback(() => {
    rulesFolderKeyRef.current = undefined;
    setRules([]);
    setIsRulesLoading(false);
    setHasRulesLoadError(false);
  }, []);

  const setPendingDestination = useCallback(
    (pending: FolderDestination | undefined) => {
      /* Rules apply only to Organization folders; browsing Personal keeps the last ones untouched. */
      if (pending?.rootKey !== SaveDestinationRoot.Organization) return;
      const folderKey = toFolderPathKey(pending.path);
      if (folderKey === rulesFolderKeyRef.current) return;
      rulesFolderKeyRef.current = folderKey;
      setRules([]);
      setHasRulesLoadError(false);
      if (!fetchRules) return;
      setIsRulesLoading(true);
      const loadRules = async () => {
        try {
          const fetched = await fetchRules(pending.path);
          if (rulesFolderKeyRef.current === folderKey) setRules(fetched);
        } catch {
          if (rulesFolderKeyRef.current === folderKey) {
            setHasRulesLoadError(true);
          }
        } finally {
          if (rulesFolderKeyRef.current === folderKey) {
            setIsRulesLoading(false);
          }
        }
      };
      void loadRules();
    },
    [fetchRules],
  );

  useEffect(() => {
    if (!isOpen) return;
    clearRules();
    setDestination(initialDestination);
    setVersionMode(SaveVersionMode.Keep);
    setNewVersionValue('');
    setIsNewVersionTouched(false);
    setConflictedVersion(undefined);
    setSubmitError(undefined);
    // Reset only when the panel opens, never while the user is choosing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isNewVersion =
    adapter.isVersioned && versionMode === SaveVersionMode.New;
  const trimmedNewVersion = newVersion.trim();

  const versionValidationError = useMemo(() => {
    if (!isNewVersion) return undefined;
    if (!SEMVER_VERSION_PATTERN.test(trimmedNewVersion)) {
      return t(ResourceSavePanelI18nKeys.VersionInvalid);
    }
    if (trimmedNewVersion === currentVersion) {
      return t(ResourceSavePanelI18nKeys.VersionUnchanged, {
        version: currentVersion,
      });
    }
    if (trimmedNewVersion === conflictedVersion) {
      return t(ResourceSavePanelI18nKeys.VersionExists, {
        version: trimmedNewVersion,
      });
    }
    return undefined;
  }, [isNewVersion, trimmedNewVersion, currentVersion, conflictedVersion, t]);

  const setNewVersion = useCallback((version: string) => {
    setNewVersionValue(version);
    setSubmitError(undefined);
  }, []);
  const markNewVersionTouched = useCallback(
    () => setIsNewVersionTouched(true),
    [],
  );

  const notifySaved = useCallback(
    (result: ResourceSaveResult, folderPath: string[]) => {
      const params = { name: resourceName, type: notificationType };
      if (result.outcome === ResourceSaveOutcome.SavedButMoveFailed) {
        showErrorNotification({
          message: t(ResourceSavePanelI18nKeys.SavedButMoveFailed, {
            name: resourceName,
            folder: getPublishFolderLabel(folderPath, t),
          }),
        });
        return;
      }
      if (result.outcome === ResourceSaveOutcome.SavedButPublishFailed) {
        showErrorNotification({
          message: t(ResourceSavePanelI18nKeys.SavedButPublishFailed, {
            name: resourceName,
          }),
        });
        return;
      }
      if (result.isPublished) {
        notifyOperationSuccess(
          notifiableEntity,
          EntityOperation.PublishRequested,
          { ...params, folder: getPublishFolderLabel(folderPath, t) },
        );
        return;
      }
      if (result.isNewVersion) {
        showSuccessNotification({
          title: t(ResourceSavePanelI18nKeys.NewVersionSavedTitle),
          message: t(ResourceSavePanelI18nKeys.NewVersionSaved, {
            name: resourceName,
            version: trimmedNewVersion,
          }),
        });
        return;
      }
      notifyOperationSuccess(notifiableEntity, EntityOperation.Edited, params);
    },
    [
      notifiableEntity,
      notificationType,
      notifyOperationSuccess,
      resourceName,
      showErrorNotification,
      showSuccessNotification,
      t,
      trimmedNewVersion,
    ],
  );

  const submit = useCallback(async () => {
    setIsNewVersionTouched(true);
    if (versionValidationError) return;
    setIsSubmitting(true);
    setSubmitError(undefined);
    try {
      const result = await runResourceSave(
        adapter,
        {
          resourceId,
          currentFolderPath,
          currentVersion,
          destination,
          versionMode,
          newVersion: trimmedNewVersion,
          rules,
        },
        publish,
      );
      if (result.isPublished) rememberPublishFolder(destination.path);
      notifySaved(result, destination.path);
      onSaved(result);
    } catch (error) {
      if (error instanceof ResourceSaveError) {
        setSubmitError(error.message);
        return;
      }
      const { message, status } = await getApiErrorDetails(error);
      if (isNewVersion && status === 409) {
        setConflictedVersion(trimmedNewVersion);
        return;
      }
      setSubmitError(message ?? t(ResourceSavePanelI18nKeys.SaveFailed));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    adapter,
    currentFolderPath,
    currentVersion,
    destination,
    isNewVersion,
    notifySaved,
    onSaved,
    publish,
    rememberPublishFolder,
    resourceId,
    rules,
    t,
    trimmedNewVersion,
    versionMode,
    versionValidationError,
  ]);

  return {
    destination,
    setDestination,
    versionMode,
    setVersionMode,
    newVersion,
    setNewVersion,
    markNewVersionTouched,
    newVersionError: isNewVersionTouched ? versionValidationError : undefined,
    isSubmitting,
    submitError,
    isSubmitDisabled: isNewVersion && Boolean(versionValidationError),
    submit,
    rules,
    setRules,
    isRulesLoading,
    hasRulesLoadError,
    setPendingDestination,
  };
};
