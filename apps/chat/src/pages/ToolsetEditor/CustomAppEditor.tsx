import {
  DialConfirmationPopup,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import type { CreateApplicationBodyDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import {
  DEFAULT_CUSTOM_APP_GENERAL_FORM,
  DEFAULT_CUSTOM_APP_SETTINGS_FORM,
  MIME_TYPE_REGEX,
} from '../../constants/custom-apps';
import { ToolsetEditorQuery } from '../../constants/toolsets';
import {
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
import { ToolsetEditorSteps } from '../../models/toolsets';
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
import CustomAppEditorView from './CustomAppEditorView';
import ToolsetEditorHeader from './ToolsetEditorHeader';

const CustomAppEditor: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { items: deployments, refetchDeployments } = useDeployments();
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

  useEffect(() => {
    if (!customAppId) return;
    let cancelled = false;
    setIsLoading(true);

    getDeploymentDetails(customAppId)
      .then((dto) => {
        if (cancelled) return;
        const appProps = (dto.applicationDetails?.applicationProperties ??
          {}) as Record<string, unknown>;
        const deployment = deployments.find((d) => d.id === customAppId);

        if (deployment) {
          setGeneralForm({
            ...DEFAULT_CUSTOM_APP_GENERAL_FORM,
            name: deployment.displayName ?? '',
            description: deployment.description ?? '',
            iconUrl: deployment.iconUrl ?? '',
            version: deployment.displayVersion ?? '',
            topics: deployment.topics ?? [],
            intro: deployment.intro ?? '',
          });
        }

        setSettingsForm({
          completionUrl: dto.applicationDetails?.endpoint ?? '',
          featuresData: appProps.features
            ? JSON.stringify(appProps.features, null, '\t')
            : '',
          inputAttachmentTypes:
            dto.applicationDetails?.inputAttachmentTypes ??
            deployment?.inputAttachmentTypes ??
            [],
          maxInputAttachments:
            dto.applicationDetails?.maxInputAttachments ??
            deployment?.maxInputAttachments ??
            '',
        });
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

  const handleNext = useCallback(() => {
    if (!generalForm.name.trim()) {
      setGeneralErrors({ name: t(EditorI18nKeys.NameRequired) });
      return;
    }
    setGeneralErrors({});
    setEditorStep(ToolsetEditorSteps.Settings);
  }, [generalForm.name, t, setEditorStep]);

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
      if (isEditMode) {
        const parsedFeatures = parseFeaturesData(settingsForm.featuresData);
        await updateApplication(customAppId, {
          name: generalForm.name,
          description: generalForm.description || undefined,
          iconUrl: generalForm.iconUrl || undefined,
          version: generalForm.version || undefined,
          topics: generalForm.topics,
          intro: generalForm.intro || undefined,
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
          intro: generalForm.intro || undefined,
          applicationProperties: appProperties,
        };
        await createApplication(body);
      }
      await refetchDeployments();
      navigate(returnUrl);
    } catch {
      showNotification({
        variant: NotificationVariant.Error,
        message: t(
          isEditMode
            ? CustomAppI18nKeys.ErrorSaveFailed
            : CustomAppI18nKeys.ErrorCreateFailed,
        ),
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
    if (!generalForm.name.trim()) {
      setGeneralErrors({ name: t(EditorI18nKeys.NameRequired) });
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
  }, [generalForm.name, settingsForm, t, setEditorStep, doSave]);

  const handleConfirmSave = useCallback(() => {
    setIsConfirmSaveOpen(false);
    void doSave();
  }, [doSave]);

  if (isLoading) return <RouteFallback />;

  const isSaveDisabled =
    isSaving ||
    step !== ToolsetEditorSteps.Settings ||
    !settingsForm.completionUrl.trim();

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
      <CustomAppEditorView
        step={step}
        generalForm={generalForm}
        generalErrors={generalErrors}
        settingsForm={settingsForm}
        settingsErrors={settingsErrors}
        isSaving={isSaving}
        onNext={handleNext}
        onCancel={handleCancel}
        onGeneralChange={handleGeneralChange}
        onSettingsChange={handleSettingsChange}
      />
      <DialConfirmationPopup
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
