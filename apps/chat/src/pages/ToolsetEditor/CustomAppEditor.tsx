import type {
  CreateApplicationBodyDto,
  DeploymentDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import {
  DeploymentCreationFieldErrorCode,
  validateDeploymentCreationFields,
} from '@epam/ai-dial-deployment-creation-form';
import {
  ConfirmationPopup,
  NotificationVariant,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import {
  DEFAULT_CUSTOM_APP_GENERAL_FORM,
  DEFAULT_CUSTOM_APP_SETTINGS_FORM,
  MIME_TYPE_REGEX,
} from '../../constants/custom-apps';
import {
  ToolsetEditorQuery,
  ToolsetEditorSteps,
} from '../../constants/toolsets';
import {
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
  CustomAppI18nKeys,
  EditorI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import type {
  CustomAppFormData,
  CustomAppFormErrors,
  CustomAppGeneralFormData,
} from '../../models/custom-apps';
import { getApiErrorDetails } from '../../server-api/api-error';
import {
  createApplication,
  updateApplication,
} from '../../server-api/applications';
import { getDeploymentDetails } from '../../server-api/deployments';
import { ROUTES } from '../../types/routes';
import {
  isValidAbsoluteUrl,
  isValidFeaturesData,
  parseFeaturesData,
} from '../../utils/custom-apps';
import { findDeploymentByIdOrReference } from '../../utils/deployment-id';
import {
  composeLocalePayload,
  decomposeLocalizedFields,
  PRIMARY_LOCALE,
  resolveLocalizedText,
} from '../../utils/locale';
import CustomAppEditorView from './CustomAppEditorView';
import ToolsetEditorHeader from './ToolsetEditorHeader';

const CustomAppEditor: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    items: deployments,
    refetchDeployments,
    isLoading: isDeploymentsLoading,
  } = useDeployments();
  const { showNotification } = useNotification();

  const step =
    (searchParams.get(ToolsetEditorQuery.Step) as ToolsetEditorSteps) ??
    ToolsetEditorSteps.General;
  const customAppId = searchParams.get(ToolsetEditorQuery.Id) ?? '';
  const isEditMode = Boolean(customAppId);
  const returnUrl = useMemo(() => {
    const raw = searchParams.get(ToolsetEditorQuery.ReturnUrl);
    return raw?.startsWith('/') && !raw.startsWith('//') ? raw : ROUTES.Catalog;
  }, [searchParams]);

  const [generalForm, setGeneralForm] = useState<CustomAppGeneralFormData>(
    DEFAULT_CUSTOM_APP_GENERAL_FORM,
  );
  const [settingsForm, setSettingsForm] = useState<CustomAppFormData>(
    DEFAULT_CUSTOM_APP_SETTINGS_FORM,
  );
  const [generalErrors, setGeneralErrors] = useState<Record<string, string>>(
    {},
  );
  const [settingsErrors, setSettingsErrors] = useState<CustomAppFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [loadedDto, setLoadedDto] = useState<DeploymentDetailsDto | null>(null);
  const [isGeneralFormReady, setIsGeneralFormReady] = useState(!isEditMode);
  const appliedDeploymentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!customAppId) return;
    let cancelled = false;
    setIsLoading(true);

    getDeploymentDetails(customAppId)
      .then((dto) => {
        if (!cancelled) setLoadedDto(dto);
      })
      .catch(() => {
        if (!cancelled) {
          showNotification({
            variant: NotificationVariant.Error,
            message: t(CustomAppI18nKeys.ErrorLoadFailed),
          });
          navigate(returnUrl, { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // one-shot mount load — customAppId is stable (URL param) and re-fetching on deployments change would overwrite in-progress edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Populates settingsForm from the fetched dto as soon as it arrives —
   * these fields don't depend on the deployment list resolving.
   */
  useEffect(() => {
    if (!loadedDto) return;
    const appProps = (loadedDto.applicationDetails?.applicationProperties ??
      {}) as Record<string, unknown>;
    const deployment = customAppId
      ? findDeploymentByIdOrReference(deployments, customAppId)
      : undefined;

    setSettingsForm({
      completionUrl: loadedDto.applicationDetails?.endpoint ?? '',
      featuresData: appProps.features
        ? JSON.stringify(appProps.features, null, '\t')
        : '',
      inputAttachmentTypes:
        loadedDto.applicationDetails?.inputAttachmentTypes ??
        deployment?.inputAttachmentTypes ??
        [],
      maxInputAttachments:
        loadedDto.applicationDetails?.maxInputAttachments ??
        deployment?.maxInputAttachments ??
        '',
    });
    // deployment fallback only matters the first time settingsForm is populated from the dto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedDto]);

  /*
   * Populates generalForm from the matching deployment entry. Re-runs if
   * `deployments` resolves the matching entry *after* the dto load (e.g. a
   * freshly-accepted share still propagating through DeploymentsContext), so
   * the shared-context fields (icon/name/topics) aren't stuck on
   * placeholders. Applies once per resolved deployment id so it never
   * clobbers in-progress edits.
   */
  useEffect(() => {
    if (!loadedDto || !customAppId) return;
    const deployment = findDeploymentByIdOrReference(deployments, customAppId);
    if (!deployment || appliedDeploymentIdRef.current === deployment.id) {
      return;
    }
    appliedDeploymentIdRef.current = deployment.id;

    setGeneralForm({
      ...DEFAULT_CUSTOM_APP_GENERAL_FORM,
      name: resolveLocalizedText(deployment.displayName, PRIMARY_LOCALE),
      description: resolveLocalizedText(deployment.description, PRIMARY_LOCALE),
      iconUrl: deployment.iconUrl ?? '',
      version: deployment.displayVersion ?? '',
      topics: deployment.topics ?? [],
      otherLocales: decomposeLocalizedFields(
        deployment.displayName,
        deployment.description,
        PRIMARY_LOCALE,
      ),
    });
    setIsGeneralFormReady(true);
  }, [loadedDto, deployments, customAppId]);

  /*
   * Stops waiting once DeploymentsContext finishes loading its list without
   * ever finding a match, instead of leaving the loading overlay up forever.
   */
  useEffect(() => {
    if (isGeneralFormReady || isDeploymentsLoading) return;
    setIsGeneralFormReady(true);
  }, [isGeneralFormReady, isDeploymentsLoading]);

  const isResolvingContext = isEditMode && !isLoading && !isGeneralFormReady;

  const canOpenSettings = Boolean(generalForm.name.trim());

  const setEditorStep = useCallback(
    (stepId: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(ToolsetEditorQuery.Step, stepId);
        return next;
      });
    },
    [setSearchParams],
  );

  const handleGeneralChange = useCallback(
    (patch: Partial<CustomAppGeneralFormData>) => {
      setGeneralForm((prev) => ({ ...prev, ...patch }));
      setGeneralErrors((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(patch)) delete next[key];
        return next;
      });
    },
    [],
  );

  const handleSettingsChange = useCallback(
    (patch: Partial<CustomAppFormData>) => {
      setSettingsForm((prev) => ({ ...prev, ...patch }));
      setSettingsErrors((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(patch)) {
          delete next[key as keyof CustomAppFormErrors];
        }
        return next;
      });
    },
    [],
  );

  const computeGeneralErrors = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!generalForm.name.trim()) {
      errors.name = t(EditorI18nKeys.NameRequired);
    }

    const generalCodes = validateDeploymentCreationFields(generalForm, {
      validateVersionPattern: true,
    });
    if (
      generalCodes.version === DeploymentCreationFieldErrorCode.InvalidFormat
    ) {
      errors.version = t(AppsEditorI18nKeys.GeneralFormVersionInvalid);
    }

    return errors;
  }, [generalForm, t]);

  const validateGeneralForm = useCallback((): boolean => {
    const errors = computeGeneralErrors();
    setGeneralErrors(errors);
    return Object.keys(errors).length === 0;
  }, [computeGeneralErrors]);

  const handleNameBlur = useCallback(() => {
    setGeneralErrors((prev) => {
      const next = { ...prev };
      const errors = computeGeneralErrors();
      if (errors.name) next.name = errors.name;
      else delete next.name;
      return next;
    });
  }, [computeGeneralErrors]);

  const handleVersionBlur = useCallback(() => {
    setGeneralErrors((prev) => {
      const next = { ...prev };
      const errors = computeGeneralErrors();
      if (errors.version) next.version = errors.version;
      else delete next.version;
      return next;
    });
  }, [computeGeneralErrors]);

  const handleNext = useCallback(() => {
    if (!validateGeneralForm()) return;
    setEditorStep(ToolsetEditorSteps.Settings);
  }, [validateGeneralForm, setEditorStep]);

  const handleChangeStep = useCallback(
    (stepId: string) => {
      if (
        stepId === ToolsetEditorSteps.Settings &&
        step === ToolsetEditorSteps.General
      ) {
        handleNext();
        return;
      }
      setEditorStep(stepId);
    },
    [step, handleNext, setEditorStep],
  );

  const handleCancel = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const doSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const locales = composeLocalePayload(
        generalForm.otherLocales,
        PRIMARY_LOCALE,
      );
      if (isEditMode) {
        const parsedFeatures = parseFeaturesData(settingsForm.featuresData);
        await updateApplication(customAppId, {
          name: generalForm.name,
          description: generalForm.description || undefined,
          iconUrl: generalForm.iconUrl || undefined,
          version: generalForm.version || undefined,
          topics: generalForm.topics,
          endpoint: settingsForm.completionUrl.trim() || undefined,
          features: parsedFeatures,
          inputAttachmentTypes:
            settingsForm.inputAttachmentTypes.length > 0
              ? settingsForm.inputAttachmentTypes
              : undefined,
          maxInputAttachments:
            typeof settingsForm.maxInputAttachments === 'number'
              ? settingsForm.maxInputAttachments
              : undefined,
          locales,
          primaryLocale: locales ? PRIMARY_LOCALE : undefined,
        });
      } else {
        const appProperties: Record<string, unknown> = {
          endpoint: settingsForm.completionUrl,
          inputAttachmentTypes:
            settingsForm.inputAttachmentTypes.length > 0
              ? settingsForm.inputAttachmentTypes
              : undefined,
          maxInputAttachments:
            settingsForm.maxInputAttachments !== ''
              ? settingsForm.maxInputAttachments
              : undefined,
        };
        const parsedFeatures = parseFeaturesData(settingsForm.featuresData);
        if (parsedFeatures !== undefined) {
          appProperties.features = parsedFeatures;
        }
        const body: CreateApplicationBodyDto = {
          name: generalForm.name,
          description: generalForm.description || undefined,
          iconUrl: generalForm.iconUrl || undefined,
          version: generalForm.version || undefined,
          topics: generalForm.topics,
          applicationProperties: appProperties,
          locales,
          primaryLocale: locales ? PRIMARY_LOCALE : undefined,
        };
        await createApplication(body);
      }
      await refetchDeployments();
      navigate(returnUrl);
    } catch (err) {
      const { message, traceId } = await getApiErrorDetails(err);
      showNotification({
        variant: NotificationVariant.Error,
        message:
          message ??
          t(
            isEditMode
              ? CustomAppI18nKeys.ErrorSaveFailed
              : CustomAppI18nKeys.ErrorCreateFailed,
          ),
        requestId: traceId,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    isEditMode,
    customAppId,
    generalForm,
    settingsForm,
    refetchDeployments,
    navigate,
    returnUrl,
    showNotification,
    t,
  ]);

  const handleSave = useCallback(() => {
    if (!validateGeneralForm()) {
      setEditorStep(ToolsetEditorSteps.General);
      return;
    }

    const trimmedUrl = settingsForm.completionUrl.trim();
    if (!trimmedUrl) {
      setSettingsErrors({
        completionUrl: t(CustomAppI18nKeys.CompletionUrlRequired),
      });
      return;
    }
    if (!isValidAbsoluteUrl(trimmedUrl)) {
      setSettingsErrors({
        completionUrl: t(CustomAppI18nKeys.CompletionUrlInvalid),
      });
      return;
    }
    setSettingsErrors({});

    const hasMimeError = settingsForm.inputAttachmentTypes.some(
      (tag) => !MIME_TYPE_REGEX.test(tag),
    );
    const hasFeaturesDataError = !isValidFeaturesData(
      settingsForm.featuresData,
    );
    if (hasMimeError || hasFeaturesDataError) {
      setIsConfirmSaveOpen(true);
      return;
    }

    void doSave();
  }, [validateGeneralForm, settingsForm, t, setEditorStep, doSave]);

  const handleConfirmSave = useCallback(() => {
    setIsConfirmSaveOpen(false);
    void doSave();
  }, [doSave]);

  if (isLoading) return <RouteFallback />;

  const isNextDisabled =
    isSaving || Object.keys(computeGeneralErrors()).length > 0;

  const isSaveDisabled =
    isSaving ||
    step !== ToolsetEditorSteps.Settings ||
    !isValidAbsoluteUrl(settingsForm.completionUrl.trim());

  return (
    <div className="flex h-full flex-col">
      <ToolsetEditorHeader
        step={step}
        isSaving={isSaving}
        isSaveDisabled={isSaveDisabled}
        canOpenSettings={canOpenSettings}
        onChangeStep={handleChangeStep}
        onCancel={handleCancel}
        onSave={handleSave}
      />
      <div className="relative min-h-0 flex-1">
        <div className="size-full" inert={isSaving || isResolvingContext}>
          <CustomAppEditorView
            step={step}
            generalForm={generalForm}
            generalErrors={generalErrors}
            settingsForm={settingsForm}
            settingsErrors={settingsErrors}
            isSaving={isSaving}
            isNextDisabled={isNextDisabled}
            onNext={handleNext}
            onCancel={handleCancel}
            onNameBlur={handleNameBlur}
            onVersionBlur={handleVersionBlur}
            onGeneralChange={handleGeneralChange}
            onSettingsChange={handleSettingsChange}
          />
        </div>
        {(isSaving || isResolvingContext) && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-backdrop"
            aria-label={t(
              isSaving
                ? CustomAppI18nKeys.SavingOverlayLabel
                : CustomAppI18nKeys.LoadingOverlayLabel,
            )}
            aria-live="polite"
          >
            <div className="flex items-center gap-3 rounded-lg bg-layer-sunken px-4 py-3 shadow-lg">
              <Spinner />
              <span className="dial-small-text text-primary">
                {t(
                  isSaving
                    ? CustomAppI18nKeys.SavingOverlayLabel
                    : CustomAppI18nKeys.LoadingOverlayLabel,
                )}
              </span>
            </div>
          </div>
        )}
      </div>
      <ConfirmationPopup
        open={isConfirmSaveOpen}
        header={t(CustomAppI18nKeys.SaveConfirmTitle)}
        description={t(CustomAppI18nKeys.SaveConfirmDescription)}
        confirmLabel={t(CustomAppI18nKeys.SaveConfirmLabel)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        onConfirm={handleConfirmSave}
        onCancel={() => setIsConfirmSaveOpen(false)}
        onClose={() => setIsConfirmSaveOpen(false)}
      />
    </div>
  );
};

export default memo(CustomAppEditor);
