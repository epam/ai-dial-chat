import {
  EntityEditor,
  MetadataField,
  MetadataForm,
  useMetadataForm,
} from '@epam/ai-dial-builder-form';
import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import { ConfirmationPopup, Spinner } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
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
  ToolsetEditorI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useApplicationAvatarPicker } from '../../hooks/application-editor/useApplicationAvatarPicker';
import { useEditedApplication } from '../../hooks/application-editor/useEditedApplication';
import { useMetadataLabels } from '../../hooks/application-editor/useMetadataLabels';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import type {
  ApplicationEditorFormDefinition,
  ApplicationSetupErrors,
  ApplicationSetupValues,
} from '../../models/application-editor';
import { EntityOperation } from '../../types/entity-notification';
import { ROUTES } from '../../types/routes';
import {
  deploymentToMetadata,
  resolveReturnUrl,
  toMetadataErrorMessages,
} from '../../utils/application-editor';
import { buildAdditionalLocaleOptions } from '../../utils/locale';

interface Props {
  definition: ApplicationEditorFormDefinition<ApplicationSetupValues>;
}

type SetupErrors = ApplicationSetupErrors<Record<string, unknown>>;

const ApplicationFormEditor: FC<Props> = ({ definition }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refetchDeployments } = useDeployments();
  const { showErrorNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();

  const appId = searchParams.get(definition.idQueryParam) ?? '';
  const isEditMode = Boolean(appId);
  const returnUrl = useMemo(
    () =>
      resolveReturnUrl(
        searchParams.get(definition.returnUrlQueryParam),
        ROUTES.Catalog,
      ),
    [searchParams, definition.returnUrlQueryParam],
  );

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
    reseedKey: deployment?.id,
  });

  const [setup, setSetup] = useState<ApplicationSetupValues>(
    definition.defaultSetup,
  );
  const [setupErrors, setSetupErrors] = useState<SetupErrors>({});
  const [isLoadingSetup, setIsLoadingSetup] = useState(
    isEditMode && Boolean(definition.loadSetup),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

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
        if (!cancelled) setSetup(loaded);
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

  const metadataErrors = useMemo(
    () => toMetadataErrorMessages(metadata.visibleErrorCodes, t),
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
      setSetup((prev) => ({ ...prev, ...patch }));
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
      const fieldError = (definition.validateSetup(setup, t) as SetupErrors)[
        field
      ];
      setSetupErrors((prev) => {
        const next = { ...prev };
        if (fieldError) next[field] = fieldError;
        else delete next[field];
        return next;
      });
    },
    [definition, setup, t],
  );

  const handleCancel = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const persist = useCallback(async () => {
    setIsSaving(true);
    try {
      if (isEditMode) {
        await definition.update(appId, metadata.values, setup);
      } else {
        await definition.create(metadata.values, setup);
      }
      await refetchDeployments();
      notifyOperationSuccess(
        definition.notifiableEntity,
        isEditMode ? EntityOperation.Edited : EntityOperation.Created,
        { name: metadata.values.name },
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
    definition,
    isEditMode,
    metadata.values,
    navigate,
    notifyOperationSuccess,
    refetchDeployments,
    returnUrl,
    setup,
    showErrorNotification,
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

  const isLoading = isLoadingSetup || isResolving;
  const isBusy = isSaving || isLoading;
  const overlayLabel = t(
    isSaving
      ? definition.messageKeys.savingOverlay
      : definition.messageKeys.loadingOverlay,
  );
  const { Setup, confirmation } = definition;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col" inert={isBusy}>
        <EntityEditor
          title={t(
            isEditMode
              ? definition.messageKeys.editTitle
              : definition.messageKeys.createTitle,
          )}
          onBack={handleCancel}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
          submitLabel={t(
            isEditMode ? ButtonsI18nKeys.Save : ButtonsI18nKeys.Create,
          )}
          isSubmitting={isSaving}
          labels={{
            backAriaLabel: t(ToolsetEditorI18nKeys.BackAriaLabel),
            savingStatusLabel: t(ToolsetEditorI18nKeys.SavingStatus),
            metadataTitle: t(ToolsetEditorI18nKeys.MetadataSectionTitle),
            setupTitle: t(ToolsetEditorI18nKeys.SetupSectionTitle),
            cancelLabel: t(ButtonsI18nKeys.Cancel),
          }}
          metadata={
            <MetadataForm
              values={metadata.values}
              errors={metadataErrors}
              onChange={metadata.setValues}
              onNameBlur={handleNameBlur}
              onVersionBlur={handleVersionBlur}
              avatarPicker={avatarPicker}
              availableLocaleOptions={localeOptions}
              labels={metadataLabels}
            />
          }
          setup={
            <Setup
              value={setup}
              errors={setupErrors}
              onChange={handleSetupChange}
              onFieldBlur={handleSetupFieldBlur}
              isEditMode={isEditMode}
            />
          }
        />
      </div>
      {isBusy && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-backdrop"
          aria-label={overlayLabel}
          aria-live="polite"
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
