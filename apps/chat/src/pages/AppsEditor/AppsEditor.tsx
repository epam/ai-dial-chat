import {
  DialNotification,
  NotificationVariant,
  StepStatus,
} from '@epam/ai-dial-ui-kit';
import type { ApplicationSchemaSummaryDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EditorHeader from '../../components/EditorHeader/EditorHeader';
import {
  AppsEditorI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  EditorI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { AppsEditorQuery, AppsEditorStep } from '../../types/apps-editor';
import { ROUTES } from '../../types/routes';
import type {
  GeneralFormHandle,
  GeneralFormInitialValues,
} from './GeneralForm';
import GeneralForm from './GeneralForm';
import type { SettingsStepHandle } from './SettingsStep';
import SettingsStep from './SettingsStep';

const AppsEditor: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { schemas, items: deployments } = useDeployments();

  const [createdAppId, setCreatedAppId] = useState<string | null>(null);
  const [submittedAppInfo, setSubmittedAppInfo] = useState<{
    displayName?: string;
    iconUrl?: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [pendingSaveAction, setPendingSaveAction] = useState<
    'save' | 'preview' | null
  >(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const generalFormRef = useRef<GeneralFormHandle>(null);
  const settingsStepRef = useRef<SettingsStepHandle>(null);

  const step = searchParams.get(AppsEditorQuery.Step) ?? AppsEditorStep.General;
  const schemaId = searchParams.get(AppsEditorQuery.Schema) ?? '';
  const returnUrl = useMemo(
    () => searchParams.get(AppsEditorQuery.ReturnUrl) ?? ROUTES.Catalog,
    [searchParams],
  );

  const schema = useMemo<ApplicationSchemaSummaryDto | undefined>(
    () => schemas.find((s) => s.id === schemaId),
    [schemas, schemaId],
  );

  const existingAppId = searchParams.get(AppsEditorQuery.AppId);
  const isEditingExistingApp = !createdAppId && !!existingAppId;

  const existingDeployment = useMemo(
    () =>
      isEditingExistingApp
        ? deployments.find((d) => d.id === existingAppId)
        : undefined,
    [deployments, isEditingExistingApp, existingAppId],
  );

  const generalFormInitialValues = useMemo<
    GeneralFormInitialValues | undefined
  >(
    () =>
      existingDeployment
        ? {
            name: existingDeployment.displayName,
            description: existingDeployment.description,
            iconUrl: existingDeployment.iconUrl,
            version: existingDeployment.displayVersion,
            topics: existingDeployment.topics,
          }
        : undefined,
    [existingDeployment],
  );

  const handleCreated = useCallback(
    (appId: string, displayName?: string, iconUrl?: string) => {
      setCreatedAppId(appId);
      setSubmittedAppInfo({ displayName, iconUrl });
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(AppsEditorQuery.Step, AppsEditorStep.Settings);
        next.set(AppsEditorQuery.AppId, appId);
        return next;
      });
    },
    [setSearchParams],
  );

  const handleCancel = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const handleChangeStep = useCallback(
    (stepId: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(AppsEditorQuery.Step, stepId);
        return next;
      });
    },
    [setSearchParams],
  );

  const isGeneralStep = step === AppsEditorStep.General;
  const [hasVisitedGeneralStep, setHasVisitedGeneralStep] =
    useState(isGeneralStep);

  useEffect(() => {
    if (isGeneralStep) setHasVisitedGeneralStep(true);
  }, [isGeneralStep]);

  const handleSave = useCallback(() => {
    if (isGeneralStep) {
      setIsSaving(true);
      void generalFormRef.current?.submit().finally(() => setIsSaving(false));
      return;
    }
    setSaveError('');
    setIsSaving(true);
    setPendingSaveAction('save');
    settingsStepRef.current?.triggerSave();
  }, [isGeneralStep]);

  const handlePreview = useCallback(() => {
    if (isPreviewing) {
      setIsPreviewing(false);
      return;
    }
    setSaveError('');
    setIsSaving(true);
    setPendingSaveAction('preview');
    settingsStepRef.current?.triggerSave();
  }, [isPreviewing]);

  const handleSaveSuccess = useCallback(() => {
    if (isPreviewing) return;
    setIsSaving(false);
    if (pendingSaveAction === 'preview') {
      setIsPreviewing(true);
    } else {
      navigate(returnUrl);
    }
    setPendingSaveAction(null);
  }, [isPreviewing, pendingSaveAction, navigate, returnUrl]);

  const handleSaveError = useCallback(
    (error: string) => {
      if (isPreviewing) return;
      setIsSaving(false);
      setSaveError(error || t(AppsEditorI18nKeys.ErrorSaveFailed));
      setPendingSaveAction(null);
    },
    [isPreviewing, t],
  );

  const saveButtonLabel = isGeneralStep
    ? t(EditorI18nKeys.NextButton)
    : t(EditorI18nKeys.SaveButton);

  const appIdForSettings =
    createdAppId ?? searchParams.get(AppsEditorQuery.AppId) ?? '';

  const appDisplayName =
    submittedAppInfo?.displayName ??
    existingDeployment?.displayName ??
    schema?.displayName;
  const appIconUrl =
    submittedAppInfo?.iconUrl ?? existingDeployment?.iconUrl ?? schema?.iconUrl;

  const steps = useMemo(
    () => [
      {
        id: AppsEditorStep.General,
        name: t(EditorI18nKeys.StepGeneral),
        status: appIdForSettings ? StepStatus.VALID : undefined,
      },
      {
        id: AppsEditorStep.Settings,
        name: t(BasicI18nKeys.Settings),
        status: appIdForSettings ? StepStatus.VALID : undefined,
      },
    ],
    [t, appIdForSettings],
  );

  const canPreview =
    !isGeneralStep && !!appIdForSettings && !!schema?.editorUrl;

  return (
    <div className="flex size-full flex-col">
      <EditorHeader
        title={schema?.displayName}
        steps={steps}
        currentStep={step}
        navAriaLabel={t(EditorI18nKeys.StepsNavAriaLabel)}
        isSaving={isSaving}
        cancelButtonLabel={t(ButtonsI18nKeys.Cancel)}
        saveButtonLabel={saveButtonLabel}
        onChangeStep={handleChangeStep}
        onCancel={handleCancel}
        onSave={handleSave}
        previewButtonLabel={t(BasicI18nKeys.Preview)}
        exitPreviewButtonLabel={t(AppsEditorI18nKeys.ExitPreviewButton)}
        isPreviewing={isPreviewing}
        onPreview={canPreview ? handlePreview : undefined}
      />

      {!isGeneralStep && saveError && (
        <div className="p-2">
          <DialNotification
            variant={NotificationVariant.Error}
            message={saveError}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {hasVisitedGeneralStep && (
          <div className={isGeneralStep ? 'h-full' : 'hidden'}>
            <GeneralForm
              ref={generalFormRef}
              schemaId={schemaId}
              appId={
                isEditingExistingApp ? (existingAppId ?? undefined) : undefined
              }
              initialValues={generalFormInitialValues}
              onCreated={handleCreated}
            />
          </div>
        )}
        {!isGeneralStep && (
          <SettingsStep
            ref={settingsStepRef}
            schema={schema}
            appId={appIdForSettings}
            appDisplayName={appDisplayName}
            appIconUrl={appIconUrl}
            isPreviewing={isPreviewing}
            onSaveSuccess={handleSaveSuccess}
            onSaveError={handleSaveError}
          />
        )}
      </div>
    </div>
  );
};

export default memo(AppsEditor);
