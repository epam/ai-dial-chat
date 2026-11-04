import {
  type DeploymentCreationFormValues,
  EntityEditor,
  MetadataField,
  MetadataForm,
  useMetadataForm,
} from '@epam/ai-dial-builder-form';
import { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import {
  createEmbeddedApplicationSaveAdapter,
  createHostApplicationSaveAdapter,
  getApiErrorDetails,
  parseResourceFolderPath,
  type ResourceSaveAdapter,
  type ResourceSaveResult,
} from '@epam/ai-dial-chat-hooks';
import {
  CatalogEntityType,
  mergeClasses,
  TextRefinementField,
  useTextRefinement,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopup,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostButton,
  Spinner,
  LiveRegion,
  LiveRegionElement,
} from '@epam/ai-dial-ui-kit';
import { IconEye } from '@tabler/icons-react';
import type { FC, ReactNode } from 'react';
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import {
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  EditorI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useApplicationAvatarPicker } from '../../hooks/application-editor/useApplicationAvatarPicker';
import { useEditedApplication } from '../../hooks/application-editor/useEditedApplication';
import { useMetadataLabels } from '../../hooks/application-editor/useMetadataLabels';
import { useCatalogCreationDecision } from '../../hooks/catalog/useCatalogCreationDecision';
import { useBuilderLeaveGuard } from '../../hooks/unsaved-changes/useBuilderLeaveGuard';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import { useTextRefinementCallback } from '../../hooks/useTextRefinementCallback';
import { useTextRefinementLabels } from '../../hooks/useTextRefinementLabels';
import type {
  ApplicationEditorContext,
  ApplicationEditorFormDefinition,
  ApplicationSetupErrors,
  ApplicationSetupHandle,
  ApplicationSetupValues,
} from '../../models/application-editor';
import type { CatalogCreationCheck } from '../../models/catalog-creation';
import { applicationsApi } from '../../server-api/api-client';
import { listApplicationFolders } from '../../server-api/applications';
import { ApplicationCreateStrategy } from '../../types/application-editor';
import { CatalogCreationDecision } from '../../types/catalog-creation';
import { EntityOperation } from '../../types/entity-notification';
import { ROUTES } from '../../types/routes';
import {
  areSetupValuesEqual,
  deploymentToMetadata,
} from '../../utils/application-editor';
import { translateDeploymentCreationErrors } from '../../utils/entity-field-validation';
import { buildAdditionalLocaleOptions } from '../../utils/locale';

/* Loaded on the first Save of an edit session, so opening the editor fetches no folder listing. */
const ResourceSavePanelContainer = lazy(
  async () =>
    import('../../components/ResourceSavePanelContainer/ResourceSavePanelContainer'),
);

interface Props {
  definition: ApplicationEditorFormDefinition<ApplicationSetupValues>;
  /** What creating a new application is checked against, re-read right before each create. */
  creationCheck: CatalogCreationCheck;
}

type SetupErrors = ApplicationSetupErrors<Record<string, unknown>>;

/* Matches the fixed Metadata column width the editor had before it became resizable. */
const DEFAULT_METADATA_COLUMN_WIDTH = 400;

const ApplicationFormEditor: FC<Props> = ({ definition, creationCheck }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refetchDeployments, schemas } = useDeployments();
  const { showErrorNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();

  const appId = searchParams.get(definition.idQueryParam) ?? '';
  const isEditMode = Boolean(appId);
  const isMetadataFirst =
    definition.createStrategy === ApplicationCreateStrategy.MetadataFirst;
  const creationDecision = useCatalogCreationDecision(creationCheck);
  const returnUrl = ROUTES.Catalog;
  const context = useMemo<ApplicationEditorContext>(
    () => ({ searchParams, schemas, t }),
    [searchParams, schemas, t],
  );
  const { entity: notifiableEntity, type: notificationType } = useMemo(
    () =>
      definition.getNotificationTarget?.(context) ?? {
        entity: definition.notifiableEntity,
      },
    [context, definition],
  );

  /*
   * True once a metadata-first create has switched this session into edit
   * mode in place. `switchToCreatedApp`'s deployments-list refetch is
   * fire-and-forget and does not gate the form as busy, so the user can keep
   * typing while it is in flight; freezing the reseed key at `undefined` from
   * that point on (below) means the resolved deployment, whenever it arrives,
   * never overwrites those in-progress edits. A fresh mount (e.g. a reload)
   * always starts `false`, so edit mode entered that way still reseeds once
   * from the resolved deployment as usual.
   */
  const [wasCreatedThisSession, setWasCreatedThisSession] = useState(false);
  const { deployment, isResolving } = useEditedApplication(appId);
  const metadataInitialValues = useMemo(
    () =>
      deployment
        ? deploymentToMetadata(deployment, definition.defaultMetadata)
        : definition.defaultMetadata,
    [deployment, definition.defaultMetadata],
  );
  const metadata = useMetadataForm({
    initialValues: metadataInitialValues,
    validationOptions: definition.metadataValidation,
    reseedKey: wasCreatedThisSession ? undefined : deployment?.id,
  });

  const [setup, setSetup] = useState<ApplicationSetupValues>(
    definition.defaultSetup,
  );
  /*
   * The Setup values the editor was opened with — defaults, the loaded setup,
   * or what the Setup applied while initialising itself — against which
   * unsaved changes are measured.
   */
  const [setupBaseline, setSetupBaseline] = useState<ApplicationSetupValues>(
    definition.defaultSetup,
  );
  // Latest setup values, so a blur in the same event cycle as a change validates the new value.
  const latestSetupRef = useRef(setup);
  const [setupErrors, setSetupErrors] = useState<SetupErrors>({});
  const [isLoadingSetup, setIsLoadingSetup] = useState(
    isEditMode && Boolean(definition.loadSetup),
  );
  const [isSetupReady, setIsSetupReady] = useState(true);
  const [isEmbeddedEditorLoaded, setIsEmbeddedEditorLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  /*
   * Bumped whenever a save reports a real configuration change, remounting
   * the preview so the next preview starts a fresh session.
   */
  const [previewResetKey, setPreviewResetKey] = useState(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const setupRef = useRef<ApplicationSetupHandle>(null);

  // Read once by the load below, which must not re-run when the deployment list updates.
  const deploymentRef = useRef(deployment);
  useLayoutEffect(() => {
    deploymentRef.current = deployment;
  });

  useEffect(() => {
    const { loadSetup } = definition;
    if (!appId || !loadSetup) return;
    let cancelled = false;

    const load = async () => {
      try {
        const loaded = await loadSetup(appId, deploymentRef.current);
        if (!cancelled) {
          latestSetupRef.current = loaded;
          setSetup(loaded);
          setSetupBaseline(loaded);
        }
      } catch {
        if (!cancelled) {
          showErrorNotification({
            message: t(definition.messageKeys.loadFailed),
          });
          navigate(returnUrl, { replace: true });
        }
      } finally {
        if (!cancelled) setIsLoadingSetup(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // one-shot load per edited id — re-fetching on other changes would overwrite in-progress edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, definition]);

  const { avatarPicker, avatarPickerLabels } = useApplicationAvatarPicker();
  /* View preference only: it is not persisted, so every editor open starts at the default. */
  const [metadataWidth, setMetadataWidth] = useState(
    DEFAULT_METADATA_COLUMN_WIDTH,
  );
  const resizableMetadata = useMemo(
    () => ({ width: metadataWidth, onWidthChange: setMetadataWidth }),
    [metadataWidth],
  );
  const metadataFormLabels = useMetadataLabels(
    definition.getMetadataLabelOverrides,
  );
  const metadataLabels = useMemo(
    () => ({ form: metadataFormLabels, avatarPicker: avatarPickerLabels }),
    [metadataFormLabels, avatarPickerLabels],
  );
  const localeOptions = useMemo(() => buildAdditionalLocaleOptions(), []);

  const onRefineDescription = useTextRefinementCallback(
    TextRefinementPurpose.ApplicationDescription,
  );
  const refinementLabels = useTextRefinementLabels();
  const { setValues: setMetadataValues } = metadata;
  const descriptionRefinement = useTextRefinement({
    value: metadata.values.description,
    onChange: (description) => setMetadataValues({ description }),
    onRefine: onRefineDescription,
    disabled: isSaving,
    resetKey: appId,
  });
  const renderRefinableDescription = onRefineDescription
    ? (textarea: ReactNode, fieldId: string) => (
        <TextRefinementField
          isEnabled
          fieldId={fieldId}
          label={metadataFormLabels.description.label}
          labels={refinementLabels}
          refinement={descriptionRefinement}
          disabled={descriptionRefinement.isPending || isSaving}
        >
          {textarea}
        </TextRefinementField>
      )
    : undefined;

  /*
   * The name/version pair a create was rejected for with 409. The conflict
   * error stays on the Name field until the user changes either value.
   */
  const [conflictedIdentity, setConflictedIdentity] = useState<{
    name: string;
    version: string;
  } | null>(null);
  const isNameConflicted =
    conflictedIdentity != null &&
    conflictedIdentity.name === metadata.values.name.trim() &&
    conflictedIdentity.version === metadata.values.version.trim();

  const metadataErrors = useMemo(() => {
    const errors = translateDeploymentCreationErrors(
      metadata.visibleErrorCodes,
      t,
    );
    if (isNameConflicted && !errors.name) {
      errors.name = t(AppsEditorI18nKeys.ErrorNameConflict);
    }
    return errors;
  }, [isNameConflicted, metadata.visibleErrorCodes, t]);

  const { markTouched } = metadata;
  const handleNameBlur = useCallback(
    () => markTouched(MetadataField.Name),
    [markTouched],
  );
  const handleVersionBlur = useCallback(
    () => markTouched(MetadataField.Version),
    [markTouched],
  );

  const handleSetupChange = useCallback(
    (patch: Partial<ApplicationSetupValues>) => {
      const nextSetup = { ...latestSetupRef.current, ...patch };
      latestSetupRef.current = nextSetup;
      setSetup(nextSetup);
      setSetupErrors((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(patch)) delete next[key];
        return next;
      });
    },
    [],
  );

  const handleSetupInitialize = useCallback(
    (patch: Partial<ApplicationSetupValues>) => {
      handleSetupChange(patch);
      setSetupBaseline((prev) => ({ ...prev, ...patch }));
    },
    [handleSetupChange],
  );

  /* Unsaved edits a Setup tracks outside `setup`: the Quick App iframe's. */
  const [isSetupEditorDirty, setIsSetupEditorDirty] = useState(false);
  const isSetupDirty = useMemo(
    () => !areSetupValuesEqual(setup, setupBaseline),
    [setup, setupBaseline],
  );
  const { allowNextNavigation } = useBuilderLeaveGuard({
    isDirty: metadata.isDirty || isSetupDirty || isSetupEditorDirty,
  });

  const handleSetupFieldBlur = useCallback(
    (field: string) => {
      const fieldError = (
        definition.validateSetup(latestSetupRef.current, t) as SetupErrors
      )[field];
      setSetupErrors((prev) => {
        const next = { ...prev };
        if (fieldError) next[field] = fieldError;
        else delete next[field];
        return next;
      });
    },
    [definition, t],
  );

  const handleCancel = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const { reset: resetMetadata } = metadata;
  const switchToCreatedApp = useCallback(
    (newAppId: string, createdMetadata: DeploymentCreationFormValues) => {
      setWasCreatedThisSession(true);
      /* What was just created is the new baseline: the session goes on in
       * edit mode, so leaving without further edits must not ask. */
      resetMetadata(createdMetadata);
      setSetupBaseline(latestSetupRef.current);
      allowNextNavigation();
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(definition.idQueryParam, newAppId);
          return next;
        },
        { replace: true },
      );
      // Best-effort: brings the new deployment into the list for the preview and the catalog.
      void refetchDeployments().catch(() => undefined);
    },
    [
      allowNextNavigation,
      definition.idQueryParam,
      refetchDeployments,
      resetMetadata,
      setSearchParams,
    ],
  );

  /* The form may have opened under a permission the current config no
   * longer grants; nothing is created then. */
  const isCreationBlocked = useCallback(() => {
    if (isEditMode || creationDecision === CatalogCreationDecision.Allowed) {
      return false;
    }
    showErrorNotification({
      message: t(
        creationDecision === CatalogCreationDecision.Denied
          ? CatalogI18nKeys.CreationDenied
          : CatalogI18nKeys.CreationUnavailable,
      ),
    });
    return true;
  }, [creationDecision, isEditMode, showErrorNotification, t]);

  const persist = useCallback(async () => {
    if (isCreationBlocked()) return;
    setIsSaving(true);
    try {
      if (!isEditMode) {
        const result = await definition.create(metadata.values, setup, context);
        if (isMetadataFirst) {
          const newAppId = result?.id;
          if (!newAppId) throw new Error('Created application has no id');
          notifyOperationSuccess(notifiableEntity, EntityOperation.Created, {
            name: metadata.values.name,
            type: notificationType,
          });
          switchToCreatedApp(newAppId, metadata.values);
          return;
        }
      } else if (definition.update) {
        await definition.update(appId, metadata.values, setup);
      } else {
        try {
          await setupRef.current?.save(metadata.values);
        } catch {
          // The Setup component shows its own save error inline.
          return;
        }
      }
      await refetchDeployments();
      notifyOperationSuccess(
        notifiableEntity,
        isEditMode ? EntityOperation.Edited : EntityOperation.Created,
        { name: metadata.values.name, type: notificationType },
      );
      allowNextNavigation();
      navigate(returnUrl);
    } catch (error) {
      const { message, status, traceId } = await getApiErrorDetails(error);
      if (!isEditMode && status === 409) {
        /* Inline on Name, plus a notification: an all-at-once create may be
         * submitted from the Setup step, where the Name field is not visible. */
        setConflictedIdentity({
          name: metadata.values.name.trim(),
          version: metadata.values.version.trim(),
        });
        showErrorNotification({
          message: t(AppsEditorI18nKeys.ErrorNameConflict),
          requestId: traceId,
        });
        return;
      }
      showErrorNotification({
        message:
          message ??
          t(
            isEditMode
              ? definition.messageKeys.saveFailed
              : definition.messageKeys.createFailed,
          ),
        requestId: traceId,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    allowNextNavigation,
    appId,
    context,
    definition,
    isCreationBlocked,
    isEditMode,
    isMetadataFirst,
    metadata.values,
    navigate,
    notifiableEntity,
    notificationType,
    notifyOperationSuccess,
    refetchDeployments,
    returnUrl,
    setup,
    showErrorNotification,
    switchToCreatedApp,
    t,
  ]);

  /*
   * Save of a kind that opts in goes through the Save panel, which picks the
   * folder and may also move, fork or publish the application. A new
   * application always qualifies; an existing one only when it is the user's
   * own, because moving and forking act on the caller's bucket, so a shared
   * application keeps saving in place.
   */
  const isSavePanelFlow =
    definition.savePanel != null &&
    (!isEditMode || wasCreatedThisSession || deployment?.isMy === true);
  /* A metadata-first create only starts the application; it is set up, and can be published, once it exists. */
  const canPublishFromPanel = isEditMode || !isMetadataFirst;
  const [isSavePanelOpen, setIsSavePanelOpen] = useState(false);
  const savedVersion = metadata.values.version;
  /*
   * Built when the panel opens, never during render: its save reads the Setup
   * handle ref. The panel is modal, so the Metadata it captures cannot change
   * while it is open.
   */
  const [saveAdapter, setSaveAdapter] = useState<ResourceSaveAdapter>();
  const openSavePanel = useCallback(() => {
    const values = metadata.values;
    const { update } = definition;
    if (!isEditMode) {
      setSaveAdapter({
        publishEntityType: 'application',
        isVersioned: false,
        createIn: async (folderPath) => {
          const created = await definition.create(values, setup, context, {
            folderPath,
          });
          if (!created?.id) throw new Error('Created application has no id');
          return { id: created.id };
        },
      });
      setIsSavePanelOpen(true);
      return;
    }
    setSaveAdapter(
      update
        ? createHostApplicationSaveAdapter({
            applicationsApi,
            applicationId: appId,
            update: () => update(appId, values, setup),
            createVersion: (version, folderPath) =>
              definition.create({ ...values, version }, setup, context, {
                folderPath,
              }),
          })
        : createEmbeddedApplicationSaveAdapter({
            applicationsApi,
            applicationId: appId,
            // The embedded editor is the single writer; it shows its own save error inline.
            runEmbeddedSave: async () => {
              await setupRef.current?.save(values);
            },
            getCommitFailedMessage: (version) =>
              t(ResourceSavePanelI18nKeys.CommitFailed, {
                version,
                currentVersion: values.version,
              }),
          }),
    );
    setIsSavePanelOpen(true);
  }, [appId, context, definition, isEditMode, metadata.values, setup, t]);
  const handleSavePanelClose = useCallback(() => setIsSavePanelOpen(false), []);
  const currentFolderPath = useMemo(
    () => parseResourceFolderPath(appId),
    [appId],
  );
  const savePanelIconUrl = useMemo(
    () => avatarPicker?.resolveIconUrl?.(metadata.values.iconUrl),
    [avatarPicker, metadata.values.iconUrl],
  );

  /* Every outcome reaching here saved the application; the panel has already notified. */
  const handleSavePanelSaved = useCallback(
    (result: ResourceSaveResult) => {
      if (result.isCreated && isMetadataFirst) {
        setIsSavePanelOpen(false);
        switchToCreatedApp(result.savedId, metadata.values);
        return;
      }
      const leaveEditor = async () => {
        // Best-effort: brings the saved application into the catalog list.
        await refetchDeployments().catch(() => undefined);
        setIsSavePanelOpen(false);
        allowNextNavigation();
        navigate(returnUrl);
      };
      void leaveEditor();
    },
    [
      allowNextNavigation,
      isMetadataFirst,
      metadata.values,
      navigate,
      refetchDeployments,
      returnUrl,
      switchToCreatedApp,
    ],
  );

  const proceedWithSave = useCallback(() => {
    if (isSavePanelFlow) {
      if (isCreationBlocked()) return;
      openSavePanel();
      return;
    }
    void persist();
  }, [isCreationBlocked, isSavePanelFlow, openSavePanel, persist]);

  const { attemptSubmit } = metadata;
  const handleSubmit = useCallback(() => {
    if (!attemptSubmit()) return;

    const errors = definition.validateSetup(setup, t) as SetupErrors;
    if (Object.values(errors).some(Boolean)) {
      setSetupErrors(errors);
      return;
    }
    setSetupErrors({});

    if (definition.needsConfirmation?.(setup)) {
      setIsConfirmOpen(true);
      return;
    }
    proceedWithSave();
  }, [attemptSubmit, definition, proceedWithSave, setup, t]);

  const handleConfirm = useCallback(() => {
    setIsConfirmOpen(false);
    proceedWithSave();
  }, [proceedWithSave]);

  const handleConfirmClose = useCallback(() => setIsConfirmOpen(false), []);

  const handlePreviewReset = useCallback(
    () => setPreviewResetKey((prev) => prev + 1),
    [],
  );

  const handleExitPreview = useCallback(() => setIsPreviewing(false), []);

  /*
   * The layout renders its actions twice (header and mobile bar) and hides one
   * with CSS, so every rendered Preview button is tracked and the visible one
   * gets focus back when the preview closes.
   */
  const previewButtonsRef = useRef(new Set<HTMLButtonElement>());
  const registerPreviewButton = useCallback(
    (node: HTMLButtonElement | null) => {
      if (!node) return;
      const buttons = previewButtonsRef.current;
      buttons.add(node);
      return () => {
        buttons.delete(node);
      };
    },
    [],
  );

  const wasPreviewingRef = useRef(isPreviewing);
  useEffect(() => {
    const wasPreviewing = wasPreviewingRef.current;
    wasPreviewingRef.current = isPreviewing;
    if (!wasPreviewing || isPreviewing) return;
    const buttons = [...previewButtonsRef.current];
    const target =
      buttons.find((button) => button.getClientRects().length > 0) ??
      buttons[0];
    target?.focus();
  }, [isPreviewing]);

  const handlePreviewStart = useCallback(async () => {
    const startPreview = setupRef.current?.startPreview;
    if (!startPreview) return;

    setIsSaving(true);
    try {
      await startPreview(metadata.values);
      setIsPreviewing(true);
    } catch {
      // The Setup component shows its own save error inline.
    } finally {
      setIsSaving(false);
    }
  }, [metadata.values]);

  const { Setup, Preview, confirmation } = definition;
  const previewKey = definition.messageKeys.preview;
  const hasPreview =
    isEditMode &&
    Boolean(Preview) &&
    Boolean(previewKey) &&
    (definition.isPreviewAvailable?.(context) ?? true);
  const extraActions =
    hasPreview && previewKey ? (
      <GhostButton
        ref={registerPreviewButton}
        label={t(previewKey)}
        iconBefore={
          <IconEye
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
            aria-hidden
          />
        }
        disabled={!isSetupReady}
        onClick={() => void handlePreviewStart()}
      />
    ) : undefined;

  const metadataFieldState = definition.getMetadataFieldState?.(isEditMode);
  const isLoading = isLoadingSetup || isResolving;
  const isBusy = isSaving || isLoading;
  const overlayLabel = t(
    isSaving
      ? definition.messageKeys.savingOverlay
      : definition.messageKeys.loadingOverlay,
  );
  const title =
    definition.getTitle?.(context, isEditMode) ??
    t(
      isEditMode
        ? definition.messageKeys.editTitle
        : definition.messageKeys.createTitle,
    );
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Hidden, not unmounted, while previewing, so the embedded editor keeps its state. */}
      <div
        className={mergeClasses(
          'min-h-0 flex-1 flex-col',
          isPreviewing ? 'hidden' : 'flex',
        )}
        hidden={isPreviewing}
        inert={isBusy || isPreviewing}
      >
        <EntityEditor
          title={title}
          onBack={handleCancel}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
          submitLabel={t(
            isEditMode ? ButtonsI18nKeys.Save : ButtonsI18nKeys.Create,
          )}
          isSubmitting={isSaving}
          isSubmitDisabled={!isSetupReady || descriptionRefinement.isPending}
          extraActions={extraActions}
          resizableLeftColumn={resizableMetadata}
          labels={{
            backAriaLabel: t(EditorI18nKeys.BackAriaLabel),
            savingStatusLabel: t(ButtonsI18nKeys.Saving),
            metadataTitle: t(EditorI18nKeys.MetadataSectionTitle),
            setupTitle: t(EditorI18nKeys.SetupSectionTitle),
            resizeHandleLabel: t(EditorI18nKeys.ResizeHandleAriaLabel),
            resizeHandleTooltip: t(EditorI18nKeys.ResizeHandleTooltip),
            cancelLabel: t(ButtonsI18nKeys.Cancel),
          }}
          setupTitle={
            definition.isSetupEmbedded?.(context, appId || undefined)
              ? null
              : undefined
          }
          hasSetupSectionPadding={!isEmbeddedEditorLoaded}
          metadata={
            <MetadataForm
              values={metadata.values}
              errors={metadataErrors}
              onChange={metadata.setValues}
              onNameBlur={handleNameBlur}
              onVersionBlur={handleVersionBlur}
              isVersionReadOnly={metadataFieldState?.isVersionReadOnly}
              versionReadOnlyTooltip={t(
                ResourceSavePanelI18nKeys.VersionReadOnlyTooltip,
              )}
              avatarPicker={avatarPicker}
              availableLocaleOptions={localeOptions}
              renderDescription={renderRefinableDescription}
              labels={metadataLabels}
              focusRequestKey={metadata.submitAttemptCount}
            />
          }
          setup={
            <Setup
              ref={setupRef}
              value={setup}
              errors={setupErrors}
              onChange={handleSetupChange}
              onInitialize={handleSetupInitialize}
              onDirtyChange={setIsSetupEditorDirty}
              onFieldBlur={handleSetupFieldBlur}
              isEditMode={isEditMode}
              appId={appId || undefined}
              metadata={metadata.values}
              onPreviewReset={handlePreviewReset}
              onSubmit={handleSubmit}
              isSubmitting={isSaving}
              onReadyChange={setIsSetupReady}
              onEmbeddedEditorLoadedChange={setIsEmbeddedEditorLoaded}
            />
          }
        />
      </div>
      {hasPreview && Preview && (
        /* Kept mounted while hidden, so a preview session survives going back to the editor. */
        <div
          className={mergeClasses(
            'min-h-0 flex-1 flex-col',
            isPreviewing ? 'flex' : 'hidden',
          )}
          hidden={!isPreviewing}
          inert={isBusy || !isPreviewing}
        >
          <Preview
            key={previewResetKey}
            appId={appId}
            metadata={metadata.values}
            isVisible={isPreviewing}
            onExit={handleExitPreview}
          />
        </div>
      )}
      {/* Always mounted so screen readers announce the label when it is filled in. */}
      <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
        {isBusy ? overlayLabel : ''}
      </LiveRegion>
      {isBusy && (
        /* The LiveRegion above announces the state, so the overlay is visual only. */
        <div className="absolute inset-0 bg-backdrop" aria-hidden="true">
          <Spinner fullWidth ariaLabel={overlayLabel} />
        </div>
      )}
      {saveAdapter && definition.savePanel && (
        <Suspense fallback={null}>
          <ResourceSavePanelContainer
            isOpen={isSavePanelOpen}
            onClose={handleSavePanelClose}
            adapter={saveAdapter}
            listPersonalFolders={listApplicationFolders}
            resourceId={appId}
            currentFolderPath={currentFolderPath}
            resourceName={metadata.values.name}
            currentVersion={savedVersion}
            resourceType={CatalogEntityType.Agent}
            iconUrl={savePanelIconUrl}
            typeLabel={definition.savePanel.getTypeLabel(context)}
            notifiableEntity={notifiableEntity}
            notificationType={notificationType}
            canPublish={canPublishFromPanel}
            onSaved={handleSavePanelSaved}
          />
        </Suspense>
      )}
      {confirmation && (
        <ConfirmationPopup
          open={isConfirmOpen}
          header={t(confirmation.titleKey)}
          description={t(confirmation.descriptionKey)}
          confirmLabel={t(confirmation.confirmKey)}
          cancelLabel={t(ButtonsI18nKeys.Cancel)}
          onConfirm={handleConfirm}
          onCancel={handleConfirmClose}
          onClose={handleConfirmClose}
        />
      )}
    </div>
  );
};

export default memo(ApplicationFormEditor);
