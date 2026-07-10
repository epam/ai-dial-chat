import {
  DeploymentCreationFieldErrorCode,
  validateDeploymentCreationFields,
} from '@epam/ai-dial-deployment-creation-form';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { ToolsetLoginBodyDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { ToolsetEditorQuery } from '../../constants/toolsets';
import { ToolsetEditorI18nKeys } from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
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
  isValidEndpointUrl,
  toolsetDtoToForm,
} from '../../utils/toolsets';
import ToolsetEditorHeader from './ToolsetEditorHeader';
import ToolsetEditorView from './ToolsetEditorView';

const ToolsetEditor: FC = () => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const { refetchToolsets } = useDeployments();
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

  const handleNext = useCallback(() => {
    if (!form) return;
    if (!form.name.trim()) {
      setErrors({ name: t(ToolsetEditorI18nKeys.NameRequired) });
      return;
    }
    setErrors({});
    setEditorStep(ToolsetEditorSteps.Settings);
  }, [form, t, setEditorStep]);

  const handleChangeStep = useCallback(
    (stepId: string) => {
      if (!isEditMode && stepId === ToolsetEditorSteps.Settings) {
        handleNext();
        return;
      }
      setEditorStep(stepId);
    },
    [isEditMode, handleNext, setEditorStep],
  );

  const handleCancel = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const validate = useCallback(
    (data: ToolsetFormData): ToolsetFormErrors => {
      const nextErrors: ToolsetFormErrors = {};
      const generalCodes = validateDeploymentCreationFields(data);
      if (generalCodes.name === DeploymentCreationFieldErrorCode.Required) {
        nextErrors.name = t(ToolsetEditorI18nKeys.NameRequired);
      }
      if (generalCodes.intro === DeploymentCreationFieldErrorCode.TooLong) {
        nextErrors.intro = t(ToolsetEditorI18nKeys.IntroTooLong);
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
      if (nextErrors.name || nextErrors.intro) {
        setEditorStep(ToolsetEditorSteps.General);
      } else if (
        nextErrors.endpoint ||
        nextErrors.keyHeader ||
        nextErrors.apiKey ||
        nextErrors.clientId ||
        nextErrors.clientSecret
      ) {
        setEditorStep(ToolsetEditorSteps.Settings);
      }
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      const body = formToToolsetBody(form);
      const result = isEditMode
        ? await updateToolset(toolsetId, body)
        : await createToolset(body);
      await refetchToolsets();
      try {
        await runPostSaveAuth(result.id, form);
        navigate(returnUrl);
      } catch {
        showNotification({
          variant: NotificationVariant.Error,
          message: t(ToolsetEditorI18nKeys.ErrorLoginFailed),
        });
      }
    } catch {
      showNotification({
        variant: NotificationVariant.Error,
        message: t(
          isEditMode
            ? ToolsetEditorI18nKeys.ErrorUpdateFailed
            : ToolsetEditorI18nKeys.ErrorCreateFailed,
        ),
      });
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
    showNotification,
    setEditorStep,
    runPostSaveAuth,
    refetchToolsets,
  ]);

  if (isLoading || !form) {
    return <RouteFallback />;
  }

  return (
    <div className="flex size-full flex-col">
      <ToolsetEditorHeader
        step={step}
        isSaving={isSaving}
        canOpenSettings={Boolean(form.name.trim())}
        onChangeStep={handleChangeStep}
        onCancel={handleCancel}
        onSave={handleSave}
      />
      <ToolsetEditorView
        step={step}
        form={form}
        errors={errors}
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
