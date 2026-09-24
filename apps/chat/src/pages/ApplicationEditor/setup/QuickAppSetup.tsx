import type { DeploymentCreationFormValues } from '@epam/ai-dial-builder-form';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { ErrorMessageNotification } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import {
  AppsEditorI18nKeys,
  ApplicationEditorI18nKeys,
} from '../../../constants/translation-keys';
import { useDeployments } from '../../../context/DeploymentsContext';
import type {
  ApplicationSetupProps,
  EmptyApplicationSetup,
} from '../../../models/application-editor';
import { updateApplication } from '../../../server-api/applications';
import {
  AppsEditorQuery,
  type TriggerSaveGeneralPayload,
} from '../../../types/apps-editor';
import { toTriggerSaveGeneral } from '../../../utils/application-editor';
import type { AppEditorIframeHandle } from './AppEditorIframe';
import AppEditorIframe from './AppEditorIframe';
import AppPreviewChat from './AppPreviewChat';

/**
 * Safety-net timeout for a triggered save. If neither `SaveSuccess` nor
 * `SaveError` arrives from the embedded editor within this window, the save
 * is treated as failed so the actions never stay stuck disabled.
 */
const SETUP_SAVE_TIMEOUT_MS = 20000;

/**
 * Safety-net timeout for the embedded editor's initial `ReadyToSave` signal,
 * distinct from `SETUP_SAVE_TIMEOUT_MS`, which covers a save already in flight.
 */
const SETUP_READY_TIMEOUT_MS = 60000;

type Props = ApplicationSetupProps<EmptyApplicationSetup>;

interface PendingSave {
  resolve: (hasChanges: boolean) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

const QuickAppSetup: FC<Props> = ({
  appId,
  metadata,
  isPreviewing,
  onReadyChange,
  ref,
}) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { schemas, refetchDeployments } = useDeployments();
  const schemaId = searchParams.get(AppsEditorQuery.Schema) ?? '';
  const schema = useMemo(
    () => schemas.find((item) => item.id === schemaId),
    [schemas, schemaId],
  );
  const hasEditor = Boolean(appId && schema?.editorUrl);

  const iframeRef = useRef<AppEditorIframeHandle>(null);
  const pendingSaveRef = useRef<PendingSave | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const [saveError, setSaveError] = useState('');
  /*
   * Bumped whenever a save reports a real configuration change, remounting
   * the preview pane so the next preview starts a fresh session.
   */
  const [previewResetKey, setPreviewResetKey] = useState(0);

  // Without an app there is nothing to save yet, so the page's Create stays available.
  const isReady = appId ? hasEditor && isEditorReady : true;
  useEffect(() => {
    onReadyChange(isReady);
  }, [isReady, onReadyChange]);

  /*
   * Re-gates readiness when the editor is (re)loaded for a different app or
   * schema — including the in-place switch after Create. Seeded from the
   * current values so it only resets on a later change: on mount, the
   * iframe's own effects may already have reported readiness.
   */
  const readyKeyRef = useRef(`${schema?.id ?? ''}|${appId ?? ''}`);
  useEffect(() => {
    const key = `${schema?.id ?? ''}|${appId ?? ''}`;
    if (readyKeyRef.current === key) return;
    readyKeyRef.current = key;
    setIsEditorReady(false);
    setIsLoggedOut(false);
  }, [schema, appId]);

  // Read by the readiness timeout so a LoggedOut signal arriving at any point before it fires is honored.
  const isLoggedOutRef = useRef(isLoggedOut);
  useEffect(() => {
    isLoggedOutRef.current = isLoggedOut;
  }, [isLoggedOut]);

  // A logged-out editor never becomes ready, so the generic "not ready" error would mislead.
  useEffect(() => {
    if (!isLoggedOut) return;
    setSaveError((prev) =>
      prev === t(AppsEditorI18nKeys.ErrorSettingsNotReady) ? '' : prev,
    );
  }, [isLoggedOut, t]);

  useEffect(() => {
    if (!hasEditor || isEditorReady) return;
    const timeoutId = setTimeout(() => {
      if (isLoggedOutRef.current) return;
      setSaveError(t(AppsEditorI18nKeys.ErrorSettingsNotReady));
    }, SETUP_READY_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [hasEditor, isEditorReady, appId, schema, t]);

  // Rejects a save still in flight when the component unmounts.
  useEffect(
    () => () => {
      const pending = pendingSaveRef.current;
      if (!pending) return;
      clearTimeout(pending.timeoutId);
      pendingSaveRef.current = null;
      pending.reject(new Error('Quick app setup unmounted'));
    },
    [],
  );

  const runSave = useCallback(
    (general?: TriggerSaveGeneralPayload) =>
      new Promise<boolean>((resolve, reject) => {
        if (!hasEditor) {
          resolve(false);
          return;
        }
        setSaveError('');
        const timeoutId = setTimeout(() => {
          pendingSaveRef.current = null;
          setSaveError(t(AppsEditorI18nKeys.ErrorSaveTimeout));
          reject(new Error('Quick app save timed out'));
        }, SETUP_SAVE_TIMEOUT_MS);
        pendingSaveRef.current = { resolve, reject, timeoutId };
        iframeRef.current?.triggerSave(general);
      }),
    [hasEditor, t],
  );

  const handleSaveSuccess = useCallback((hasChanges: boolean) => {
    const pending = pendingSaveRef.current;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    pendingSaveRef.current = null;
    pending.resolve(hasChanges);
  }, []);

  const handleSaveError = useCallback(
    (error: string) => {
      const pending = pendingSaveRef.current;
      if (!pending) return;
      clearTimeout(pending.timeoutId);
      pendingSaveRef.current = null;
      setSaveError(error || t(AppsEditorI18nKeys.ErrorSaveFailed));
      pending.reject(new Error(error || 'Quick app save failed'));
    },
    [t],
  );

  /*
   * Quick apps have no chat-side control for `features.skills_supported`, and
   * the embedded editor's own save has no reason to know about it. A
   * follow-up update carrying the Metadata already on record triggers the
   * backend to force-set the flag (see the `applications-write-api` spec),
   * and must finish before the save counts as successful.
   */
  const reassertSkillsSupport = useCallback(
    async (values: DeploymentCreationFormValues) => {
      if (!appId) return;
      const general = toTriggerSaveGeneral(values);
      try {
        await updateApplication(appId, {
          name: general.name,
          description: general.description,
          iconUrl: general.iconUrl,
          topics: general.topics,
          locales: general.locales,
          primaryLocale: general.primaryLocale,
        });
      } catch (error) {
        setSaveError(t(AppsEditorI18nKeys.ErrorSaveFailed));
        throw error;
      }
    },
    [appId, t],
  );

  useImperativeHandle(
    ref,
    () => ({
      save: async (values) => {
        const hasChanges = await runSave(toTriggerSaveGeneral(values));
        await reassertSkillsSupport(values);
        if (hasChanges) setPreviewResetKey((prev) => prev + 1);
      },
      startPreview: async (values) => {
        const hasChanges = await runSave();
        await reassertSkillsSupport(values);
        if (hasChanges) {
          setPreviewResetKey((prev) => prev + 1);
          /*
           * The remounted preview pane reads the deployment list on its first
           * render, so wait for fresh data instead of flashing the stale
           * item. A failed refetch must not block the preview.
           */
          try {
            await refetchDeployments();
          } catch (error) {
            console.error(
              'Failed to refetch deployments before preview:',
              error,
            );
          }
        } else {
          void refetchDeployments().catch(() => undefined);
        }
      },
    }),
    [refetchDeployments, reassertSkillsSupport, runSave],
  );

  const handleUpdated = useCallback(() => {
    // Best-effort intermediate refresh; the definitive save refetches again.
    void refetchDeployments(false);
  }, [refetchDeployments]);

  if (!appId) {
    return (
      <p className="dial-small-text text-secondary">
        {t(ApplicationEditorI18nKeys.SetupPendingCreate)}
      </p>
    );
  }

  if (!schema?.editorUrl) {
    return (
      <p className="dial-small-text text-secondary">
        {t(AppsEditorI18nKeys.SettingsStepNoEditorPlaceholder)}
      </p>
    );
  }

  return (
    <div className="flex min-h-[640px] flex-1 flex-col gap-2">
      {saveError && <ErrorMessageNotification message={saveError} />}
      <div className="relative min-h-0 flex-1">
        <div className={mergeClasses('size-full', isPreviewing && 'hidden')}>
          <AppEditorIframe
            ref={iframeRef}
            schema={schema}
            appId={appId}
            onUpdated={handleUpdated}
            onSaveSuccess={handleSaveSuccess}
            onSaveError={handleSaveError}
            onReadyChange={setIsEditorReady}
            onLoggedOutChange={setIsLoggedOut}
          />
        </div>
        {/* Kept mounted and hidden, so a preview session survives toggling back to the editor. */}
        <div
          className={mergeClasses(
            'absolute inset-0 size-full',
            !isPreviewing && 'hidden',
          )}
        >
          <AppPreviewChat
            key={previewResetKey}
            appId={appId}
            appDisplayName={metadata.name || schema.displayName}
            appIconUrl={metadata.iconUrl || schema.iconUrl}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(QuickAppSetup);
