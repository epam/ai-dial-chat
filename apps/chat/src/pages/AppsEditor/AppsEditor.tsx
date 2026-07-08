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
  ButtonsI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { AppsEditorQuery, AppsEditorStep } from '../../types/apps-editor';
import { ROUTES } from '../../types/routes';
import type { GeneralFormHandle } from './GeneralForm';
import GeneralForm from './GeneralForm';
import type { SettingsStepHandle } from './SettingsStep';
import SettingsStep from './SettingsStep';

const AppsEditor: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { schemas } = useDeployments();

  const [createdAppId, setCreatedAppId] = useState<string | null>(null);
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

  const handleCreated = useCallback(
    (appId: string) => {
      setCreatedAppId(appId);
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
    ? t(AppsEditorI18nKeys.GeneralFormNextButton)
    : t(AppsEditorI18nKeys.SaveButton);

  const appIdForSettings =
    createdAppId ?? searchParams.get(AppsEditorQuery.AppId) ?? '';

  const steps = useMemo(
    () => [
      { id: AppsEditorStep.General, name: t(AppsEditorI18nKeys.StepGeneral) },
      {
        id: AppsEditorStep.Settings,
        name: t(AppsEditorI18nKeys.StepSettings),
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
        navAriaLabel={t(AppsEditorI18nKeys.StepsNavAriaLabel)}
        isSaving={isSaving}
        cancelButtonLabel={t(ButtonsI18nKeys.Cancel)}
        saveButtonLabel={saveButtonLabel}
        onChangeStep={handleChangeStep}
        onCancel={handleCancel}
        onSave={handleSave}
        previewButtonLabel={t(AppsEditorI18nKeys.PreviewButton)}
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
              onCreated={handleCreated}
            />
          </div>
        )}
        {!isGeneralStep && (
          <SettingsStep
            ref={settingsStepRef}
            schema={schema}
            appId={appIdForSettings}
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
