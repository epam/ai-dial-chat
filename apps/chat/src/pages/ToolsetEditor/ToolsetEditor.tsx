import type { ToolsetLoginBodyDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { ToolsetEditorQuery } from '../../constants/toolsets';
import { ToolsetEditorI18nKeys } from '../../constants/translation-keys';
import {
  createToolset,
  getToolset,
  listToolsets,
  loginToolset,
  updateToolset,
} from '../../server-api/toolsets';
import { ROUTES } from '../../types/routes';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
  ToolsetFormErrors,
} from '../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetEditorSteps,
  WithLogin,
} from '../../types/toolsets';
import {
  formToToolsetBody,
  getDefaultToolsetForm,
  initiateOAuthLogin,
  isValidEndpointUrl,
  toolsetDtoToForm,
} from '../../utils/toolsets';
import ToolsetEditorHeader from './ToolsetEditorHeader';
import ToolsetEditorView from './ToolsetEditorView';

const ToolsetEditor: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const toolsetId = searchParams.get(ToolsetEditorQuery.Id) ?? '';
  const isEditMode = Boolean(toolsetId);
  const step =
    (searchParams.get(ToolsetEditorQuery.Step) as ToolsetEditorSteps) ??
    ToolsetEditorSteps.General;
  const returnUrl = useMemo(
    () => searchParams.get(ToolsetEditorQuery.ReturnUrl) ?? ROUTES.Catalog,
    [searchParams],
  );

  const [form, setForm] = useState<ToolsetFormData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ToolsetFormErrors>({});
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (isEditMode) {
        setIsLoading(true);
        try {
          const dto = await getToolset(toolsetId);
          if (!cancelled) setForm(toolsetDtoToForm(dto));
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
              (data ?? []).map((item) => item.displayName ?? ''),
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
  }, [isEditMode, toolsetId, navigate, returnUrl]);

  const handleChange = useCallback((patch: Partial<ToolsetFormData>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
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
    },
    [],
  );

  const handleNext = useCallback(() => {
    if (!form) return;
    if (!form.name.trim()) {
      setErrors({ name: t(ToolsetEditorI18nKeys.NameRequired) });
      return;
    }
    setErrors({});
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(ToolsetEditorQuery.Step, ToolsetEditorSteps.Settings);
      return next;
    });
  }, [form, t, setSearchParams]);

  const handleChangeStep = useCallback(
    (stepId: string) => {
      if (!isEditMode && stepId === ToolsetEditorSteps.Settings) {
        handleNext();
        return;
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(ToolsetEditorQuery.Step, stepId);
        return next;
      });
    },
    [setSearchParams, isEditMode, handleNext],
  );

  const handleCancel = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const validate = useCallback(
    (data: ToolsetFormData): ToolsetFormErrors => {
      const nextErrors: ToolsetFormErrors = {};
      if (!data.name.trim()) {
        nextErrors.name = t(ToolsetEditorI18nKeys.NameRequired);
      }
      if (!data.endpoint.trim()) {
        nextErrors.endpoint = t(ToolsetEditorI18nKeys.EndpointRequired);
      } else if (!isValidEndpointUrl(data.endpoint)) {
        nextErrors.endpoint = t(ToolsetEditorI18nKeys.EndpointInvalid);
      }
      if (!data.auth.isLoggedIn) {
        if (
          data.auth.authenticationType === ToolsetAuthTypes.ApiKey &&
          data.auth.withLogin === WithLogin.WithLogin
        ) {
          if (!data.auth.keyHeader?.trim()) {
            nextErrors.keyHeader = t(ToolsetEditorI18nKeys.KeyHeaderRequired);
          }
          if (!data.auth.apiKey?.trim()) {
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
          if (!data.auth.clientSecret?.trim()) {
            nextErrors.clientSecret = t(
              ToolsetEditorI18nKeys.ClientSecretRequired,
            );
          }
        }
      }
      return nextErrors;
    },
    [t],
  );

  const buildEditorCallbackUrl = useCallback(
    (savedToolsetId: string): string => {
      const params = new URLSearchParams({
        [ToolsetEditorQuery.Id]: savedToolsetId,
        [ToolsetEditorQuery.Step]: ToolsetEditorSteps.Settings,
        [ToolsetEditorQuery.ReturnUrl]: returnUrl,
      });
      return `${ROUTES.ToolsetEditor}?${params.toString()}`;
    },
    [returnUrl],
  );

  const runPostSaveAuth = useCallback(
    async (savedToolsetId: string, data: ToolsetFormData): Promise<boolean> => {
      if (data.auth.isLoggedIn) return false;

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
        return false;
      }

      if (
        data.auth.authenticationType === ToolsetAuthTypes.OAuth &&
        data.auth.withLogin === WithLogin.WithConfig
      ) {
        const started = initiateOAuthLogin(
          data.auth,
          savedToolsetId,
          buildEditorCallbackUrl(savedToolsetId),
        );
        if (!started) throw new Error('OAuth authorization URL is invalid.');
        return true;
      }

      return false;
    },
    [buildEditorCallbackUrl],
  );

  const handleSave = useCallback(async () => {
    if (!form) return;
    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      // Surface the General-step error first by switching to it when needed.
      if (nextErrors.name) handleChangeStep(ToolsetEditorSteps.General);
      else if (
        nextErrors.endpoint ||
        nextErrors.keyHeader ||
        nextErrors.apiKey ||
        nextErrors.clientId ||
        nextErrors.clientSecret
      ) {
        handleChangeStep(ToolsetEditorSteps.Settings);
      }
      return;
    }

    setErrors({});
    setSaveError('');
    setIsSaving(true);
    try {
      const body = formToToolsetBody(form);
      const result = isEditMode
        ? await updateToolset(toolsetId, body)
        : await createToolset(body);
      try {
        const isRedirecting = await runPostSaveAuth(result.id, form);
        if (!isRedirecting) navigate(returnUrl);
      } catch {
        setSaveError(t(ToolsetEditorI18nKeys.ErrorLoginFailed));
      }
    } catch {
      setSaveError(
        isEditMode
          ? t(ToolsetEditorI18nKeys.ErrorUpdateFailed)
          : t(ToolsetEditorI18nKeys.ErrorCreateFailed),
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    form,
    validate,
    isEditMode,
    toolsetId,
    navigate,
    returnUrl,
    t,
    handleChangeStep,
    runPostSaveAuth,
  ]);

  if (isLoading || !form) {
    return <RouteFallback />;
  }

  return (
    <div className="flex size-full flex-col">
      <ToolsetEditorHeader
        step={step}
        isSaving={isSaving}
        onChangeStep={handleChangeStep}
        onCancel={handleCancel}
        onSave={handleSave}
      />
      <ToolsetEditorView
        step={step}
        form={form}
        errors={errors}
        saveError={saveError}
        isSaving={isSaving}
        toolsetId={toolsetId}
        onNext={handleNext}
        onCancel={handleCancel}
        onChange={handleChange}
        onAuthChange={handleAuthChange}
      />
    </div>
  );
};

export default memo(ToolsetEditor);
