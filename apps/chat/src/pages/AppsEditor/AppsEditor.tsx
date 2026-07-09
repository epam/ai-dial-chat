import { DialSteps } from '@epam/ai-dial-ui-kit';
import type { ApplicationSchemaSummaryDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppsEditorI18nKeys } from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { AppsEditorQuery, AppsEditorStep } from '../../types/apps-editor';
import { ROUTES } from '../../types/routes';
import GeneralForm from './GeneralForm';
import SettingsStep from './SettingsStep';

const AppsEditor: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { schemas } = useDeployments();

  const [createdAppId, setCreatedAppId] = useState<string | null>(null);

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

  const steps = useMemo(
    () => [
      { id: AppsEditorStep.General, name: t(AppsEditorI18nKeys.StepGeneral) },
      { id: AppsEditorStep.Settings, name: t(AppsEditorI18nKeys.StepSettings) },
    ],
    [t],
  );

  const isGeneralStep = step === AppsEditorStep.General;
  const appIdForSettings =
    createdAppId ?? searchParams.get(AppsEditorQuery.AppId) ?? '';

  return (
    <div className="flex size-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-b-tertiary bg-layer-2 px-4 pb-1">
        <div className="flex items-center gap-3">
          {schema?.displayName && (
            <h1 className="dial-caption-text justify-start text-primary">
              {schema.displayName}
            </h1>
          )}
          <nav
            role="navigation"
            aria-label={t(AppsEditorI18nKeys.StepsNavAriaLabel)}
            className="flex items-center gap-2 text-sm"
          >
            <DialSteps
              steps={steps}
              currentStep={step}
              onChangeStep={handleChangeStep}
            />
          </nav>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {isGeneralStep ? (
          <GeneralForm
            schemaId={schemaId}
            onCreated={handleCreated}
            onCancel={handleCancel}
          />
        ) : (
          <SettingsStep schema={schema} appId={appIdForSettings} />
        )}
      </div>
    </div>
  );
};

export default memo(AppsEditor);
