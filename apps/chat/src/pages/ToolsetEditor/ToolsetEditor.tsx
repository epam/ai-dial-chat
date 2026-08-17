import type { ToolsetLoginBodyDto } from '@epam/ai-dial-chat-api-client';
import {
  DeploymentCreationFieldErrorCode,
  validateDeploymentCreationFields,
} from '@epam/ai-dial-deployment-creation-form';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import {
  ToolsetEditorQuery,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetEditorSteps,
  WithLogin,
} from '../../constants/toolsets';
import {
  ToolsetEditorI18nKeys,
  EditorI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
  ToolsetFormErrors,
} from '../../models/toolsets';
import { getApiErrorDetails } from '../../server-api/api-error';
import {
  createToolset,
  getToolset,
  listToolsets,
  loginToolset,
  updateToolset,
} from '../../server-api/toolsets';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { ROUTES } from '../../types/routes';
import { PRIMARY_LOCALE, resolveLocalizedText } from '../../utils/locale';
import {
  extractToolsetApiErrorMessage,
  formToToolsetBody,
  getDefaultToolsetForm,
  getToolsetRedirectUri,
  isToolsetFormValid,
  isValidEndpointUrl,
  toolsetDtoToForm,
} from '../../utils/toolsets';
import ToolsetEditorHeader from './ToolsetEditorHeader';
import ToolsetEditorView from './ToolsetEditorView';

const AUTH_ERROR_FIELDS: (keyof ToolsetFormErrors)[] = [
  'keyHeader',
  'apiKey',
  'clientId',
  'clientSecret',
  'authorizationEndpoint',
  'tokenEndpoint',
];

const ERROR_FIELDS: (keyof ToolsetFormErrors)[] = [
  'name',
  'version',
  'endpoint',
  ...AUTH_ERROR_FIELDS,
];

const ERROR_FIELD_SET = new Set<string>(ERROR_FIELDS);

type ToolsetDirtyFields = Partial<Record<keyof ToolsetFormErrors, true>>;

const getDirtyFieldsFromPatch = (patch: object): ToolsetDirtyFields => {
  const dirtyFields: ToolsetDirtyFields = {};
  for (const key of Object.keys(patch)) {
    if (ERROR_FIELD_SET.has(key)) {
      dirtyFields[key as keyof ToolsetFormErrors] = true;
    }
  }
  return dirtyFields;
};

const ToolsetEditor: FC = () => {
  const { t } = useTranslation();
  const { showErrorNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();
  const { refetchToolsets } = useDeployments();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const routeToolsetId = searchParams.get(ToolsetEditorQuery.Id) ?? '';
  const isEditMode = Boolean(routeToolsetId);
  const [draftToolsetId, setDraftToolsetId] = useState('');
  const persistedToolsetId = routeToolsetId || draftToolsetId;
  const step =
    (searchParams.get(ToolsetEditorQuery.Step) as ToolsetEditorSteps) ??
    ToolsetEditorSteps.General;
  const returnUrl = useMemo(() => {
    const raw = searchParams.get(ToolsetEditorQuery.ReturnUrl);
    return raw?.startsWith('/') && !raw.startsWith('//') ? raw : ROUTES.Catalog;
  }, [searchParams]);

  const [form, setForm] = useState<ToolsetFormData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ToolsetFormErrors>({});
  const [dirtyFields, setDirtyFields] = useState<ToolsetDirtyFields>({});
  const lastPersistedFormRef = useRef<ToolsetFormData | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (isEditMode) {
        setIsLoading(true);
        try {
          const dto = await getToolset(routeToolsetId);
          const loadedForm = toolsetDtoToForm(dto);
          if (!cancelled) {
            setForm(loadedForm);
            lastPersistedFormRef.current = loadedForm;
          }
        } catch {
          // Edit target missing/unreachable — leave the editor.
          if (!cancelled) navigate(returnUrl, { replace: true });
        } finally {
          if (!cancelled) setIsLoading(false);
        }
        return;
      }

      try {
        const { data } = await listToolsets();
        if (!cancelled) {
          setForm(
            getDefaultToolsetForm(
              (data ?? []).map((item) =>
                resolveLocalizedText(item.displayName, PRIMARY_LOCALE),
              ),
            ),
          );
        }
      } catch {
        if (!cancelled) setForm(getDefaultToolsetForm());
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, routeToolsetId, navigate, returnUrl]);

  const handleChange = useCallback((patch: Partial<ToolsetFormData>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirtyFields((prev) => ({
      ...prev,
      ...getDirtyFieldsFromPatch(patch),
    }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) {
        delete next[key as keyof ToolsetFormErrors];
      }
      return next;
    });
  }, []);

  const handleAuthChange = useCallback(
    (patch: Partial<ToolsetAuthFormData>) => {
      setForm((prev) =>
        prev ? { ...prev, auth: { ...prev.auth, ...patch } } : prev,
      );
      setDirtyFields((prev) => ({
        ...prev,
        ...getDirtyFieldsFromPatch(patch),
      }));
      setErrors((prev) => {
        const next = { ...prev };
        const shouldClearAllAuthErrors =
          'authenticationType' in patch ||
          'withLogin' in patch ||
          'isLoggedIn' in patch;

        if (shouldClearAllAuthErrors) {
          for (const key of AUTH_ERROR_FIELDS) delete next[key];
        } else {
          for (const key of Object.keys(patch)) {
            delete next[key as keyof ToolsetFormErrors];
          }
        }
        return next;
      });

      /*
       * AuthSection only includes isLoggedIn in a patch after a login or
       * logout request has actually resolved (or a successful OAuth login
       * has been recovered) — never speculatively. Keep the shared toolset
       * list in sync with that confirmed status in either direction so
       * returning to the Catalog never shows a stale pre-change snapshot.
       */
      if ('isLoggedIn' in patch) {
        void refetchToolsets();
      }
    },
    [refetchToolsets],
  );

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

  /**
   * Creates the toolset (if it has no id yet) or updates it (if the form has
   * changed since it was last persisted), so the backend reflects whatever
   * the user has typed so far. Returns the toolset id on success — including
   * when nothing needed to be sent — or `null` if a create/update call
   * failed. Shared by "Next" (advancing past General) and by Log In (which
   * must not authenticate against stale endpoint/auth settings).
   */
  const persistFormIfChanged = useCallback(async (): Promise<string | null> => {
    if (!form) return null;

    const isUnchangedSincePersist =
      persistedToolsetId &&
      lastPersistedFormRef.current != null &&
      JSON.stringify(lastPersistedFormRef.current) === JSON.stringify(form);
    if (isUnchangedSincePersist) return persistedToolsetId;

    setIsSaving(true);
    try {
      const body = formToToolsetBody(form, getToolsetRedirectUri());
      let id: string;
      if (persistedToolsetId) {
        const result = await updateToolset(persistedToolsetId, body);
        id = result.id;
      } else {
        const result = await createToolset(body);
        setDraftToolsetId(result.id);
        id = result.id;
      }
      lastPersistedFormRef.current = form;
      await refetchToolsets();
      return id;
    } catch (err) {
      const { traceId } = await getApiErrorDetails(err);
      const upstreamMessage = await extractToolsetApiErrorMessage(err);
      showErrorNotification({
        message:
          upstreamMessage ??
          t(
            persistedToolsetId
              ? ToolsetEditorI18nKeys.ErrorUpdateFailed
              : ToolsetEditorI18nKeys.ErrorCreateFailed,
          ),
        requestId: traceId,
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [form, persistedToolsetId, t, showErrorNotification, refetchToolsets]);

  const handleNext = useCallback(async () => {
    if (!form) return;
    if (!form.name.trim()) {
      setErrors({ name: t(EditorI18nKeys.NameRequired) });
      return;
    }
    setErrors({});

    const id = await persistFormIfChanged();
    if (id != null) {
      setEditorStep(ToolsetEditorSteps.Settings);
    }
  }, [form, t, persistFormIfChanged, setEditorStep]);

  const handleEnsureSaved = useCallback(
    async () => (await persistFormIfChanged()) ?? false,
    [persistFormIfChanged],
  );

  const handleChangeStep = useCallback(
    (stepId: string) => {
      if (
        stepId === ToolsetEditorSteps.Settings &&
        step === ToolsetEditorSteps.General
      ) {
        void handleNext();
        return;
      }
      setEditorStep(stepId);
    },
    [step, handleNext, setEditorStep],
  );

  const handleCancel = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const validate = useCallback(
    (data: ToolsetFormData): ToolsetFormErrors => {
      const nextErrors: ToolsetFormErrors = {};
      const generalCodes = validateDeploymentCreationFields(data);
      if (generalCodes.name === DeploymentCreationFieldErrorCode.Required) {
        nextErrors.name = t(EditorI18nKeys.NameRequired);
      }
      if (!data.endpoint.trim()) {
        nextErrors.endpoint = t(ToolsetEditorI18nKeys.EndpointRequired);
      } else if (!isValidEndpointUrl(data.endpoint)) {
        nextErrors.endpoint = t(ToolsetEditorI18nKeys.EndpointInvalid);
      }
      if (!data.auth.isLoggedIn) {
        if (data.auth.authenticationType === ToolsetAuthTypes.ApiKey) {
          if (!data.auth.keyHeader?.trim()) {
            nextErrors.keyHeader = t(ToolsetEditorI18nKeys.KeyHeaderRequired);
          }
          if (
            data.auth.withLogin === WithLogin.WithLogin &&
            !data.auth.apiKey?.trim()
          ) {
            nextErrors.apiKey = t(ToolsetEditorI18nKeys.ApiKeyRequired);
          }
        }
        if (
          data.auth.authenticationType === ToolsetAuthTypes.OAuth &&
          data.auth.withLogin === WithLogin.WithConfig
        ) {
          if (!data.auth.clientId?.trim()) {
            nextErrors.clientId = t(ToolsetEditorI18nKeys.ClientIdRequired);
          }
          if (!isEditMode && !data.auth.clientSecret?.trim()) {
            nextErrors.clientSecret = t(
              ToolsetEditorI18nKeys.ClientSecretRequired,
            );
          }
          if (
            data.auth.authorizationEndpoint?.trim() &&
            !isValidEndpointUrl(data.auth.authorizationEndpoint)
          ) {
            nextErrors.authorizationEndpoint = t(
              ToolsetEditorI18nKeys.EndpointInvalid,
            );
          }
          if (
            data.auth.tokenEndpoint?.trim() &&
            !isValidEndpointUrl(data.auth.tokenEndpoint)
          ) {
            nextErrors.tokenEndpoint = t(ToolsetEditorI18nKeys.EndpointInvalid);
          }
        }
      }
      return nextErrors;
    },
    [t, isEditMode],
  );

  const runPostSaveAuth = useCallback(
    async (savedToolsetId: string, data: ToolsetFormData): Promise<void> => {
      if (data.auth.isLoggedIn) return;

      if (
        data.auth.authenticationType === ToolsetAuthTypes.ApiKey &&
        data.auth.withLogin === WithLogin.WithLogin
      ) {
        const body: ToolsetLoginBodyDto = {
          url: savedToolsetId,
          credentialsLevel:
            ToolsetCredentialsLevel.User as ToolsetLoginBodyDto['credentialsLevel'],
          authenticationType:
            ToolsetAuthTypes.ApiKey as ToolsetLoginBodyDto['authenticationType'],
          apiKey: data.auth.apiKey?.trim(),
        };
        await loginToolset(savedToolsetId, body);
      }
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!form) return;
    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      // Surface the General-step error first by switching to it when needed.
      if (nextErrors.name) {
        setEditorStep(ToolsetEditorSteps.General);
      } else if (
        nextErrors.endpoint ||
        nextErrors.keyHeader ||
        nextErrors.apiKey ||
        nextErrors.clientId ||
        nextErrors.clientSecret ||
        nextErrors.authorizationEndpoint ||
        nextErrors.tokenEndpoint
      ) {
        setEditorStep(ToolsetEditorSteps.Settings);
      }
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      const body = formToToolsetBody(form, getToolsetRedirectUri());
      const result = persistedToolsetId
        ? await updateToolset(persistedToolsetId, body)
        : await createToolset(body);
      await refetchToolsets();
      /*
       * Reported before the post-save auth attempt: the toolset is persisted at this
       * point, so a failing connection must not read as a failed save. The operation
       * follows `isEditMode`, not the request kind — a toolset authored in this
       * session is saved through `updateToolset` once its draft exists, but the user
       * created it.
       */
      notifyOperationSuccess(
        NotifiableEntity.Toolset,
        isEditMode ? EntityOperation.Edited : EntityOperation.Created,
        { name: form.name.trim() },
      );
      try {
        await runPostSaveAuth(result.id, form);
        navigate(returnUrl);
      } catch (error) {
        const { traceId } = await getApiErrorDetails(error);
        showErrorNotification({
          message: t(ToolsetEditorI18nKeys.ErrorLoginFailed),
          requestId: traceId,
        });
      }
    } catch (err) {
      const { traceId } = await getApiErrorDetails(err);
      const upstreamMessage = await extractToolsetApiErrorMessage(err);
      showErrorNotification({
        message:
          upstreamMessage ??
          t(
            persistedToolsetId
              ? ToolsetEditorI18nKeys.ErrorUpdateFailed
              : ToolsetEditorI18nKeys.ErrorCreateFailed,
          ),
        requestId: traceId,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    form,
    validate,
    persistedToolsetId,
    isEditMode,
    navigate,
    returnUrl,
    t,
    showErrorNotification,
    notifyOperationSuccess,
    setEditorStep,
    runPostSaveAuth,
    refetchToolsets,
  ]);

  const isSaveDisabled = useMemo(
    () => !form || !isToolsetFormValid(form, isEditMode),
    [form, isEditMode],
  );

  const visibleErrors = useMemo(() => {
    if (!form) return errors;

    const validationErrors = validate(form);
    const nextErrors = { ...errors };
    for (const key of ERROR_FIELDS) {
      if (!dirtyFields[key]) continue;

      const message = validationErrors[key];
      if (message) {
        nextErrors[key] = message;
      } else {
        delete nextErrors[key];
      }
    }
    return nextErrors;
  }, [dirtyFields, errors, form, validate]);

  if (isLoading || !form) {
    return <RouteFallback />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolsetEditorHeader
        step={step}
        isSaving={isSaving}
        isSaveDisabled={isSaveDisabled}
        canOpenSettings={Boolean(form.name.trim())}
        onChangeStep={handleChangeStep}
        onCancel={handleCancel}
        onSave={handleSave}
      />
      <ToolsetEditorView
        step={step}
        form={form}
        errors={visibleErrors}
        isSaving={isSaving}
        toolsetId={persistedToolsetId}
        isEditMode={isEditMode}
        onNext={handleNext}
        onCancel={handleCancel}
        onEnsureSaved={handleEnsureSaved}
        onChange={handleChange}
        onAuthChange={handleAuthChange}
      />
    </div>
  );
};

export default memo(ToolsetEditor);
