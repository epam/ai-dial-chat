import type { ResourceFoldersResponseDto } from '@epam/ai-dial-chat-api-client';
import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import {
  SaveVersionMode,
  toFolderPathKey,
  type FolderDestination,
  type FolderDestinationRoot,
  type PublicationRule,
  type PublishDependency,
  type PublishAccessRulesLabels,
  type SaveToFolderAccessRulesProps,
  type SaveToFolderVersionProps,
  type StandaloneSaveToFolderPanelProps,
} from '@epam/ai-dial-publish-panel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiErrorDetails } from '../../api-error/api-error';
import { getDependencyOrgUnitNamespaces } from '../../org-units/org-unit-guards';
import type { PublishApiClient } from '../create-publish-api';
import {
  createPublishSavedResource,
  ResourceSaveError,
  ResourceSaveVersionError,
  runResourceSave,
  SaveDestinationRoot,
  toSaveDestinationRoot,
  type ResourceSaveAdapter,
  type ResourceSaveChoice,
  type ResourceSaveResult,
} from '../resource-save';
import type { UsePublishFoldersResult } from '../usePublishFolders/usePublishFolders';
import { useResourceFolders } from '../useResourceFolders/useResourceFolders';

const EMPTY_DEPENDENCIES: PublishDependency[] = [];

/** Translated copy the Save flow puts into the panel's state; the panel's own labels stay with the host. */
export interface UseResourceSavePanelLabels {
  /** Name of the Personal root node. */
  personalRoot: string;
  /** Name of the Organization root node. */
  organizationRoot: string;
  /** Error shown above the tree when the Personal folders fail to load. */
  foldersLoadError: string;
  /** Submit error used when a failed save carries no backend message. */
  saveError: string;
  /** Returns the error shown under the new version input for `error` and the typed `version`. */
  getVersionError: (error: ResourceSaveVersionError, version: string) => string;
  /** Text overrides for the access-rules section. */
  accessRules?: PublishAccessRulesLabels;
}

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
  /** Current version; omit for an unversioned resource. */
  currentVersion?: string;
  /** Pattern a new version must match. */
  versionPattern: RegExp;
  /** Lists one level of the resource type's Personal folders. */
  listPersonalFolders: (path: string) => Promise<ResourceFoldersResponseDto>;
  /** The Organization folder tree state; omit when the user may not publish, which hides that root. */
  organizationFolders?: UsePublishFoldersResult;
  /** Publish operations used for an Organization destination. */
  publishClient: Pick<
    PublishApiClient,
    'publishCatalogEntity' | 'getPublishRules'
  >;
  /** Whether an Organization destination takes a direct write into an org unit (the user may write there); omit while the org-unit rule does not apply, which keeps every Organization destination on the publish path. */
  canSaveDirectlyTo?: (
    folderPath: string[],
    root: SaveDestinationRoot,
  ) => boolean;
  /** Reason a folder is unavailable as a destination in the given root, or `undefined` when usable; omit while the org-unit rule does not apply. A committed destination with a reason shows it and disables Save. */
  getDisabledReason?: (
    folderPath: string[],
    root: SaveDestinationRoot,
  ) => string | undefined;
  /**
   * Reads the private dependencies of what is being saved, already mapped to the panel's model; omit for a resource that has none to list. Called when the panel is open and the destination is under the Organization root, whichever way the save then goes (a publication request or a direct write); the list is advisory, so a failed read leaves it empty. The host reads the values it saves when called, so it should return the form's state at that moment.
   */
  loadDependencies?: () => Promise<PublishDependency[]>;
  /** The namespaces, among those asked, in which the user may not write straight into the unit that owns the folder; omit while the org-unit rule does not apply. Used for the dependencies the panel lists and for the icon's `files` namespace, on a destination that takes a direct write. */
  getMissingNamespaces?: (
    folderPath: string[],
    namespaces: OrgUnitNamespace[],
  ) => OrgUnitNamespace[];
  /** Reason shown for a folder where the dependencies' namespaces are missing; receives the missing namespaces. Without it a missing namespace disables nothing. */
  getMissingNamespacesReason?: (missing: OrgUnitNamespace[]) => string;
  /** One sentence for the dependencies section while the panel cannot list them (an application whose form state is inside an embedded editor); passed through only under the Organization root. */
  dependenciesNote?: string;
  /** Notice about the application's uploaded icon, shown under the committed destination when it is a unit folder where the user may not write `files`; pass it only when the saved resource has an uploaded icon. */
  iconNote?: string;
  /** Options offered in the access-rules editor's source picker. */
  ruleSourceOptions: string[];
  /** Translated copy. */
  labels: UseResourceSavePanelLabels;
  /** Called once a save whose first step succeeded has finished, with the choice it ran. */
  onSaved: (result: ResourceSaveResult, choice: ResourceSaveChoice) => void;
}

/** The {@link StandaloneSaveToFolderPanelProps} the Save flow owns; the host adds the open state, resource summary and labels. */
export type ResourceSavePanelStateProps = Pick<
  StandaloneSaveToFolderPanelProps,
  | 'onSubmit'
  | 'isSubmitDisabled'
  | 'isSubmitting'
  | 'submitError'
  | 'roots'
  | 'destination'
  | 'onDestinationChange'
  | 'onCreateFolder'
  | 'getDisabledReason'
  | 'version'
  | 'accessRules'
  | 'onPendingDestinationChange'
  | 'foldersError'
  | 'onRetryFolders'
  | 'dependencies'
  | 'dependenciesNote'
  | 'destinationNote'
>;

/** Result of {@link useResourceSavePanel}. */
export interface UseResourceSavePanelResult {
  /** Props to spread on `StandaloneSaveToFolderPanel`. */
  panelProps: ResourceSavePanelStateProps;
  /** Runs the save for the current choice. */
  submit: () => Promise<void>;
}

/**
 * Owns the Save panel's flow for one resource — the Personal and
 * Organization destination tree, the version choice, the Organization
 * folder's access rules — and runs the choice through the resource's
 * adapter. Notifications stay with the host through `onSaved`. For a resource
 * with private dependencies it also reads them while an Organization
 * destination is chosen and returns them as `panelProps.dependencies`.
 */
export const useResourceSavePanel = ({
  isOpen,
  adapter,
  resourceId,
  currentFolderPath,
  currentVersion,
  versionPattern,
  listPersonalFolders,
  organizationFolders,
  publishClient,
  canSaveDirectlyTo,
  getDisabledReason: getFolderDisabledReason,
  loadDependencies,
  getMissingNamespaces,
  getMissingNamespacesReason,
  dependenciesNote,
  iconNote,
  ruleSourceOptions,
  labels,
  onSaved,
}: UseResourceSavePanelParams): UseResourceSavePanelResult => {
  const personal = useResourceFolders({
    listFolders: listPersonalFolders,
    isEnabled: isOpen,
  });
  const { getPublishRules } = publishClient;
  const publish = useMemo(
    () => createPublishSavedResource(publishClient),
    [publishClient],
  );

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
  const [isPendingOrganization, setIsPendingOrganization] = useState(false);
  const [rules, setRules] = useState<PublicationRule[]>([]);
  const [isRulesLoading, setIsRulesLoading] = useState(false);
  const [hasRulesLoadError, setHasRulesLoadError] = useState(false);
  /* Folder the current rules belong to, so returning to it keeps the user's edits; also guards stale fetches. */
  const rulesFolderKeyRef = useRef<string | undefined>(undefined);

  /* Only an Organization folder can be a unit; a Personal folder named like one never matches. */
  const isDirectDestination = useCallback(
    (candidate: FolderDestination): boolean =>
      candidate.rootKey === SaveDestinationRoot.Organization &&
      adapter.saveIntoOrgUnit != null &&
      canSaveDirectlyTo?.(candidate.path, SaveDestinationRoot.Organization) ===
        true,
    [adapter.saveIntoOrgUnit, canSaveDirectlyTo],
  );

  const setPendingDestination = useCallback(
    (pending: FolderDestination | undefined) => {
      setIsPendingOrganization(
        pending?.rootKey === SaveDestinationRoot.Organization,
      );
      /* Rules apply only to Organization folders; browsing Personal keeps the last ones untouched. */
      if (pending?.rootKey !== SaveDestinationRoot.Organization) return;
      /* A direct write stores no rules, so none are fetched for it. */
      if (isDirectDestination(pending)) return;
      const folderKey = toFolderPathKey(pending.path);
      if (folderKey === rulesFolderKeyRef.current) return;
      rulesFolderKeyRef.current = folderKey;
      setRules([]);
      setHasRulesLoadError(false);
      setIsRulesLoading(true);
      const loadRules = async () => {
        try {
          const fetched = await getPublishRules(pending.path.join('/'));
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
    [getPublishRules, isDirectDestination],
  );

  useEffect(() => {
    if (!isOpen) return;
    rulesFolderKeyRef.current = undefined;
    setRules([]);
    setIsRulesLoading(false);
    setHasRulesLoadError(false);
    setIsPendingOrganization(false);
    setDestination(initialDestination);
    setVersionMode(SaveVersionMode.Keep);
    setNewVersionValue('');
    setIsNewVersionTouched(false);
    setConflictedVersion(undefined);
    setSubmitError(undefined);
    // Reset only when the panel opens, never while the user is choosing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const [dependencies, setDependencies] =
    useState<PublishDependency[]>(EMPTY_DEPENDENCIES);
  /* The host may pass a new function each render; only an open or a move into the Organization root reads. */
  const loadDependenciesRef = useRef(loadDependencies);
  useEffect(() => {
    loadDependenciesRef.current = loadDependencies;
  }, [loadDependencies]);
  /* Browsing the Organization tree also reads them, so a folder the dependencies cannot be copied into is disabled before it is committed. */
  const shouldListDependencies =
    isOpen &&
    loadDependencies != null &&
    (destination.rootKey === SaveDestinationRoot.Organization ||
      isPendingOrganization);
  useEffect(() => {
    setDependencies(EMPTY_DEPENDENCIES);
    if (!shouldListDependencies) return;
    let isCancelled = false;
    const load = async () => {
      try {
        const loaded = await loadDependenciesRef.current?.();
        if (!isCancelled && loaded) setDependencies(loaded);
      } catch {
        /* Left empty: the list only informs, saving does not depend on it. */
      }
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, [shouldListDependencies]);

  const isNewVersion =
    adapter.isVersioned && versionMode === SaveVersionMode.New;
  const trimmedNewVersion = newVersion.trim();

  const versionError = useMemo(() => {
    if (!isNewVersion) return undefined;
    if (!versionPattern.test(trimmedNewVersion)) {
      return ResourceSaveVersionError.Invalid;
    }
    if (trimmedNewVersion === currentVersion) {
      return ResourceSaveVersionError.Unchanged;
    }
    if (trimmedNewVersion === conflictedVersion) {
      return ResourceSaveVersionError.Exists;
    }
    return undefined;
  }, [
    isNewVersion,
    versionPattern,
    trimmedNewVersion,
    currentVersion,
    conflictedVersion,
  ]);

  const dependencyNamespaces = useMemo(
    () => getDependencyOrgUnitNamespaces(dependencies),
    [dependencies],
  );
  const getDestinationDisabledReason = useMemo(() => {
    if (!getFolderDisabledReason) return undefined;
    return (candidate: FolderDestination) => {
      const root = toSaveDestinationRoot(candidate.rootKey);
      if (!root) return undefined;
      const ownReason = getFolderDisabledReason(candidate.path, root);
      if (ownReason != null) return ownReason;
      if (
        !getMissingNamespaces ||
        !getMissingNamespacesReason ||
        dependencyNamespaces.length === 0 ||
        !isDirectDestination(candidate)
      ) {
        return undefined;
      }
      const missing = getMissingNamespaces(
        candidate.path,
        dependencyNamespaces,
      );
      return missing.length > 0
        ? getMissingNamespacesReason(missing)
        : undefined;
    };
  }, [
    dependencyNamespaces,
    getFolderDisabledReason,
    getMissingNamespaces,
    getMissingNamespacesReason,
    isDirectDestination,
  ]);
  const committedDisabledReason = getDestinationDisabledReason?.(destination);
  const isDirectWrite = isDirectDestination(destination);
  const isOrganizationDestination =
    destination.rootKey === SaveDestinationRoot.Organization;
  const destinationNote =
    iconNote != null &&
    isDirectWrite &&
    getMissingNamespaces?.(destination.path, [OrgUnitNamespace.Files]).length
      ? iconNote
      : undefined;
  /* Publishing before the folder's rules arrive would send `rules: []` and overwrite the folder's existing rules. */
  const isRulesPending =
    destination.rootKey === SaveDestinationRoot.Organization &&
    !isDirectWrite &&
    (isRulesLoading || hasRulesLoadError);

  const setNewVersion = useCallback((version: string) => {
    setNewVersionValue(version);
    setSubmitError(undefined);
  }, []);
  const markNewVersionTouched = useCallback(
    () => setIsNewVersionTouched(true),
    [],
  );

  const rememberPublishFolder = organizationFolders?.rememberPublishFolder;
  const { saveError } = labels;
  const submit = useCallback(async () => {
    setIsNewVersionTouched(true);
    if (versionError || isRulesPending || committedDisabledReason) return;
    setIsSubmitting(true);
    setSubmitError(undefined);
    const choice: ResourceSaveChoice = {
      resourceId,
      currentFolderPath,
      currentVersion,
      destination,
      versionMode,
      newVersion: trimmedNewVersion,
      rules,
      isDirectWrite,
    };
    try {
      const result = await runResourceSave(adapter, choice, publish);
      if (result.isPublished) rememberPublishFolder?.(destination.path);
      onSaved(result, choice);
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
      setSubmitError(message ?? saveError);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    adapter,
    currentFolderPath,
    currentVersion,
    destination,
    isNewVersion,
    isDirectWrite,
    isRulesPending,
    committedDisabledReason,
    onSaved,
    publish,
    rememberPublishFolder,
    resourceId,
    rules,
    saveError,
    trimmedNewVersion,
    versionMode,
    versionError,
  ]);
  const handleSubmit = useCallback(() => void submit(), [submit]);

  const { personalRoot: personalRootLabel, organizationRoot } = labels;
  const roots = useMemo<FolderDestinationRoot[]>(() => {
    const personalRoot: FolderDestinationRoot = {
      key: SaveDestinationRoot.Personal,
      label: personalRootLabel,
      items: personal.folderItems,
      expandedPaths: personal.expandedPaths,
      onExpandedPathsChange: personal.onExpandedPathsChange,
      loadingPaths: personal.loadingPaths,
    };
    if (!organizationFolders) return [personalRoot];
    return [
      personalRoot,
      {
        key: SaveDestinationRoot.Organization,
        label: organizationRoot,
        items: organizationFolders.folderItems,
        expandedPaths: organizationFolders.expandedPaths,
        onExpandedPathsChange: organizationFolders.onExpandedPathsChange,
        loadingPaths: organizationFolders.loadingPaths,
        hasAccessRules: true,
      },
    ];
  }, [
    organizationFolders,
    organizationRoot,
    personal.expandedPaths,
    personal.folderItems,
    personal.loadingPaths,
    personal.onExpandedPathsChange,
    personalRootLabel,
  ]);

  const { onCreateFolder: onCreatePersonalFolder } = personal;
  const onCreatePublishFolder = organizationFolders?.onCreatePublishFolder;
  const handleCreateFolder = useCallback(
    async (rootKey: string, parentPath: string[], name: string) => {
      if (rootKey === SaveDestinationRoot.Organization) {
        await onCreatePublishFolder?.(parentPath, name);
        return;
      }
      await onCreatePersonalFolder(parentPath, name);
    },
    [onCreatePersonalFolder, onCreatePublishFolder],
  );

  const { getVersionError } = labels;
  const version = useMemo<SaveToFolderVersionProps | undefined>(
    () =>
      adapter.isVersioned && currentVersion != null
        ? {
            versionMode,
            onVersionModeChange: setVersionMode,
            currentVersion,
            newVersion,
            onNewVersionChange: setNewVersion,
            onNewVersionBlur: markNewVersionTouched,
            newVersionError:
              isNewVersionTouched && versionError
                ? getVersionError(versionError, trimmedNewVersion)
                : undefined,
          }
        : undefined,
    [
      adapter.isVersioned,
      currentVersion,
      getVersionError,
      isNewVersionTouched,
      markNewVersionTouched,
      newVersion,
      setNewVersion,
      trimmedNewVersion,
      versionError,
      versionMode,
    ],
  );

  const { accessRules: accessRulesLabels } = labels;
  const accessRules = useMemo<SaveToFolderAccessRulesProps>(
    () => ({
      rules,
      onRulesChange: setRules,
      sourceOptions: ruleSourceOptions,
      isLoading: isRulesLoading,
      hasLoadError: hasRulesLoadError,
      labels: accessRulesLabels,
      isHiddenFor: isDirectDestination,
    }),
    [
      accessRulesLabels,
      hasRulesLoadError,
      isDirectDestination,
      isRulesLoading,
      ruleSourceOptions,
      rules,
    ],
  );

  return {
    panelProps: {
      onSubmit: handleSubmit,
      isSubmitDisabled:
        (isNewVersion && Boolean(versionError)) ||
        isRulesPending ||
        committedDisabledReason != null,
      isSubmitting,
      submitError,
      roots,
      destination,
      onDestinationChange: setDestination,
      onCreateFolder: handleCreateFolder,
      getDisabledReason: getDestinationDisabledReason,
      version,
      accessRules,
      onPendingDestinationChange: setPendingDestination,
      foldersError: personal.hasError ? labels.foldersLoadError : undefined,
      onRetryFolders: personal.retry,
      dependencies: isOrganizationDestination
        ? dependencies
        : EMPTY_DEPENDENCIES,
      dependenciesNote: isOrganizationDestination
        ? dependenciesNote
        : undefined,
      destinationNote,
    },
    submit,
  };
};
