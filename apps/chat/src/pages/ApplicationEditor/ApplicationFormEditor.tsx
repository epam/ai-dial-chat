import {
  EntityEditor,
  MetadataField,
  MetadataForm,
  useMetadataForm,
} from '@epam/ai-dial-builder-form';
import { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import {
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
} from '@epam/ai-dial-ui-kit';
import { IconEye } from '@tabler/icons-react';
import type { FC, ReactNode } from 'react';
import {
  memo,
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
  ButtonsI18nKeys,
  EditorI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useApplicationAvatarPicker } from '../../hooks/application-editor/useApplicationAvatarPicker';
import { useEditedApplication } from '../../hooks/application-editor/useEditedApplication';
import { useMetadataLabels } from '../../hooks/application-editor/useMetadataLabels';
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
import { ApplicationCreateStrategy } from '../../types/application-editor';
import { EntityOperation } from '../../types/entity-notification';
import { ROUTES } from '../../types/routes';
import { deploymentToMetadata } from '../../utils/application-editor';
import { translateDeploymentCreationErrors } from '../../utils/entity-field-validation';
import { buildAdditionalLocaleOptions } from '../../utils/locale';

interface Props {
  definition: ApplicationEditorFormDefinition<ApplicationSetupValues>;
}

type SetupErrors = ApplicationSetupErrors<Record<string, unknown>>;

const ApplicationFormEditor: FC<Props> = ({ definition }) => {
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
  // Latest setup values, so a blur in the same event cycle as a change validates the new value.
  const latestSetupRef = useRef(setup);
  const [setupErrors, setSetupErrors] = useState<SetupErrors>({});
  const [isLoadingSetup, setIsLoadingSetup] = useState(
    isEditMode && Boolean(definition.loadSetup),
  );
  const [isSetupReady, setIsSetupReady] = useState(true);
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

  const metadataErrors = useMemo(
    () => translateDeploymentCreationErrors(metadata.visibleErrorCodes, t),
    [metadata.visibleErrorCodes, t],
  );

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

  const switchToCreatedApp = useCallback(
    (newAppId: string) => {
      setWasCreatedThisSession(true);
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
    [definition.idQueryParam, refetchDeployments, setSearchParams],
  );

  const persist = useCallback(async () => {
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
          switchToCreatedApp(newAppId);
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
      navigate(returnUrl);
    } catch (error) {
      const { message, traceId } = await getApiErrorDetails(error);
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
    appId,
    context,
    definition,
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
    void persist();
  }, [attemptSubmit, definition, persist, setup, t]);

  const handleConfirm = useCallback(() => {
    setIsConfirmOpen(false);
    void persist();
  }, [persist]);

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
          labels={{
            backAriaLabel: t(EditorI18nKeys.BackAriaLabel),
            savingStatusLabel: t(EditorI18nKeys.SavingStatus),
            metadataTitle: t(EditorI18nKeys.MetadataSectionTitle),
            setupTitle: t(EditorI18nKeys.SetupSectionTitle),
            cancelLabel: t(ButtonsI18nKeys.Cancel),
          }}
          setupTitle={
            definition.isSetupEmbedded?.(context, appId || undefined)
              ? null
              : undefined
          }
          metadata={
            <MetadataForm
              values={metadata.values}
              errors={metadataErrors}
              onChange={metadata.setValues}
              onNameBlur={handleNameBlur}
              onVersionBlur={handleVersionBlur}
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
              onFieldBlur={handleSetupFieldBlur}
              isEditMode={isEditMode}
              appId={appId || undefined}
              metadata={metadata.values}
              onPreviewReset={handlePreviewReset}
              onSubmit={handleSubmit}
              isSubmitting={isSaving}
              onReadyChange={setIsSetupReady}
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
      <span role="status" aria-live="polite" className="sr-only">
        {isBusy ? overlayLabel : ''}
      </span>
      {isBusy && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-backdrop"
          aria-hidden="true"
        >
          <div className="flex items-center gap-3 rounded-lg bg-layer-sunken px-4 py-3 shadow-lg">
            <Spinner />
            <span className="dial-small-text text-primary">{overlayLabel}</span>
          </div>
        </div>
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
