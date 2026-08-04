import {
  DialSpinner,
  ErrorMessageNotification,
  StepStatus,
} from '@epam/ai-dial-ui-kit';
import type { ApplicationSchemaSummaryDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
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

/**
 * Safety-net timeout for a triggered Settings-step save/preview. If neither
 * `SaveSuccess` nor `SaveError` arrives from the embedded editor within this
 * window, the action is treated as failed so the Save/Preview buttons never
 * stay stuck disabled indefinitely.
 */
const SETTINGS_SAVE_TIMEOUT_MS = 20000;

/**
 * Safety-net timeout for the Settings step's initial `ReadyToSave` signal —
 * distinct from `SETTINGS_SAVE_TIMEOUT_MS`, which covers a save already in
 * flight. If the embedded editor never reports it is ready to save within
 * this window, Save/Preview would otherwise stay disabled forever with no
 * explanation.
 */
const SETTINGS_READY_TIMEOUT_MS = 60000;

const AppsEditor: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { schemas, items: deployments, refetchDeployments } = useDeployments();

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
  const [isSettingsReady, setIsSettingsReady] = useState(false);
  /**
   * Whether the embedded Settings-step editor reported the user is logged
   * out (`AppsEditorEvent.LoggedOut`). In that case `ReadyToSave` will never
   * arrive, so the readiness timeout below must not surface its generic
   * "not ready" error — being logged out is an expected state, not a
   * readiness failure.
   */
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  /**
   * Bumped whenever a Settings-step save reports a real configuration
   * change (`SaveSuccessMessage.hasChanges === true`). Passed to
   * `SettingsStep` as `AppPreviewChat`'s `key`, so the preview pane
   * remounts and starts a fresh session the next time it is shown.
   */
  const [previewResetKey, setPreviewResetKey] = useState(0);

  const generalFormRef = useRef<GeneralFormHandle>(null);
  const settingsStepRef = useRef<SettingsStepHandle>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  /**
   * Captures, once, whether this editor session started against an app that
   * already existed (as opposed to one created fresh in this session).
   * `isEditingExistingApp` flips to false once `handleCreated` sets
   * `createdAppId` after advancing past the General step, so it can't be used
   * to gate Save & Exit's persist step, which runs after that transition.
   */
  const hasExistingAppOnMountRef = useRef(!!existingAppId);

  const appIdForSettings =
    createdAppId ?? searchParams.get(AppsEditorQuery.AppId) ?? '';

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
            intro: existingDeployment.intro,
          }
        : undefined,
    [existingDeployment],
  );

  useEffect(() => {
    setIsPreviewing(false);
  }, [step]);

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

  /* Re-gate readiness whenever the embedded editor is (re)loaded for a
   * different app or schema, so switching apps or re-entering the Settings
   * step doesn't inherit a stale ready state. The key is seeded from the
   * current values so this only resets on an actual later change — on
   * mount, child effects (which may report readiness synchronously) always
   * run before this one, and a reset here on mount would otherwise wipe out
   * that just-reported readiness. */
  const settingsReadyKeyRef = useRef(`${schema?.id ?? ''}|${appIdForSettings}`);
  useEffect(() => {
    const key = `${schema?.id ?? ''}|${appIdForSettings}`;
    if (settingsReadyKeyRef.current === key) return;
    settingsReadyKeyRef.current = key;
    setIsSettingsReady(false);
    setIsLoggedOut(false);
  }, [schema, appIdForSettings]);

  /* Read inside the readiness-timeout callback below so a LoggedOut signal
   * that arrives at any point before the timeout fires is honored, without
   * having to re-arm the timeout every time isLoggedOut changes. */
  const isLoggedOutRef = useRef(isLoggedOut);
  useEffect(() => {
    isLoggedOutRef.current = isLoggedOut;
  }, [isLoggedOut]);

  /* Clears an already-surfaced readiness-timeout error once the Settings
   * step reports the user is logged out — that explains why ReadyToSave
   * never arrived, so the generic "not ready" error is misleading. */
  useEffect(() => {
    if (!isLoggedOut) return;
    setSaveError((prev) =>
      prev === t(AppsEditorI18nKeys.ErrorSettingsNotReady) ? '' : prev,
    );
  }, [isLoggedOut, t]);

  /* Safety net for the initial ReadyToSave signal itself (see
   * SETTINGS_READY_TIMEOUT_MS above) — armed whenever the Settings step is
   * visible and not yet ready, and re-armed whenever schema/appId change (a
   * fresh iframe load). Cleared as soon as isSettingsReady flips true. Skips
   * surfacing the error if the Settings step reported the user is logged
   * out, since ReadyToSave is then expected to never arrive. */
  useEffect(() => {
    if (isGeneralStep || isSettingsReady) return;
    const timeoutId = setTimeout(() => {
      if (isLoggedOutRef.current) return;
      setSaveError(t(AppsEditorI18nKeys.ErrorSettingsNotReady));
    }, SETTINGS_READY_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [isGeneralStep, isSettingsReady, appIdForSettings, schema, t]);

  const clearSaveTimeout = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearSaveTimeout, [clearSaveTimeout]);

  const handleSettingsUpdated = useCallback(() => {
    /* Best-effort intermediate refresh — a definitive Save always follows,
     * so briefly stale data here is corrected by that later refetch and
     * doesn't need to bypass the 30s server-side cache. */
    void refetchDeployments(false);
  }, [refetchDeployments]);

  const handleSaveSuccess = useCallback(
    async (hasChanges: boolean) => {
      clearSaveTimeout();
      if (isPreviewing) return;

      if (hasChanges) {
        setPreviewResetKey((prev) => prev + 1);
      }

      if (pendingSaveAction === 'preview') {
        /* Fire-and-forget: nothing should block before showing the preview
         * pane. `DeploymentsContext` is a shared reactive source, so once
         * the refetch resolves, any reader re-renders on its own. */
        void refetchDeployments().catch(() => undefined);
        setIsSaving(false);
        setIsPreviewing(true);
      } else {
        /* Save & Exit: wait for the deployments list to be fresh so the
         * catalog reflects the updated app as soon as the user lands there. */
        try {
          await refetchDeployments();
        } catch (error) {
          console.error('Failed to refetch deployments after save:', error);
        } finally {
          setIsSaving(false);
        }
        navigate(returnUrl);
      }

      setPendingSaveAction(null);
    },
    [
      clearSaveTimeout,
      isPreviewing,
      pendingSaveAction,
      refetchDeployments,
      navigate,
      returnUrl,
    ],
  );

  const handleSaveError = useCallback(
    (error: string) => {
      clearSaveTimeout();
      if (isPreviewing) return;
      setIsSaving(false);
      setSaveError(error || t(AppsEditorI18nKeys.ErrorSaveFailed));
      setPendingSaveAction(null);
    },
    [clearSaveTimeout, isPreviewing, t],
  );

  const startSaveTimeout = useCallback(() => {
    clearSaveTimeout();
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      handleSaveError(t(AppsEditorI18nKeys.ErrorSaveTimeout));
    }, SETTINGS_SAVE_TIMEOUT_MS);
  }, [clearSaveTimeout, handleSaveError, t]);

  const handleSave = useCallback(() => {
    if (isGeneralStep) {
      setIsSaving(true);
      void generalFormRef.current?.submit().finally(() => setIsSaving(false));
      return;
    }

    setSaveError('');
    setIsSaving(true);
    setPendingSaveAction('save');
    startSaveTimeout();
    const general = hasExistingAppOnMountRef.current
      ? generalFormRef.current?.getValues()
      : undefined;
    settingsStepRef.current?.triggerSave(general);
  }, [isGeneralStep, startSaveTimeout]);

  const handlePreview = useCallback(() => {
    if (isPreviewing) {
      setIsPreviewing(false);
      return;
    }
    setSaveError('');
    setIsSaving(true);
    setPendingSaveAction('preview');
    startSaveTimeout();
    settingsStepRef.current?.triggerSave();
  }, [isPreviewing, startSaveTimeout]);

  const saveButtonLabel = isGeneralStep
    ? t(EditorI18nKeys.NextButton)
    : t(EditorI18nKeys.SaveButton);

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
    !isGeneralStep &&
    !!appIdForSettings &&
    !!schema?.editorUrl &&
    isSettingsReady;

  const isSaveDisabled = !isGeneralStep && !isSettingsReady;

  return (
    <div className="flex size-full flex-col">
      <EditorHeader
        title={schema?.displayName}
        steps={steps}
        currentStep={step}
        navAriaLabel={t(EditorI18nKeys.StepsNavAriaLabel)}
        isSaving={isSaving}
        isSaveDisabled={isSaveDisabled}
        cancelButtonLabel={t(ButtonsI18nKeys.Cancel)}
        saveButtonLabel={saveButtonLabel}
        onChangeStep={handleChangeStep}
        onCancel={handleCancel}
        onSave={handleSave}
        previewButtonLabel={t(BasicI18nKeys.Preview)}
        exitPreviewButtonLabel={t(AppsEditorI18nKeys.ExitPreviewButton)}
        isPreviewing={isPreviewing}
        onPreview={step === AppsEditorStep.Settings ? handlePreview : undefined}
        isPreviewDisabled={!canPreview}
      />

      {!isGeneralStep && saveError && (
        <div className="p-2">
          <ErrorMessageNotification message={saveError} />
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-auto">
        <div className="size-full" inert={isSaving}>
          {hasVisitedGeneralStep && (
            <div className={isGeneralStep ? 'h-full' : 'hidden'}>
              <GeneralForm
                ref={generalFormRef}
                schemaId={schemaId}
                appId={appIdForSettings || undefined}
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
              onUpdated={handleSettingsUpdated}
              onSaveSuccess={handleSaveSuccess}
              onSaveError={handleSaveError}
              onReadyChange={setIsSettingsReady}
              onLoggedOutChange={setIsLoggedOut}
              previewResetKey={previewResetKey}
            />
          )}
        </div>
        {isSaving && (
          <div
            className="bg-blackout absolute inset-0 flex items-center justify-center"
            aria-label={t(AppsEditorI18nKeys.SavingOverlayLabel)}
            aria-live="polite"
          >
            <div className="flex items-center gap-3 rounded-lg bg-layer-2 px-4 py-3 shadow-lg">
              <DialSpinner />
              <span className="text-sm text-primary">
                {t(AppsEditorI18nKeys.SavingOverlayLabel)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(AppsEditor);
