import {
  DeploymentCreationFieldErrorCode,
  EditorLayout,
  EditorSection,
  validateDeploymentCreationFields,
} from '@epam/ai-dial-builder-form';
import {
  getApiErrorDetails,
  ToolsetAuthTypes,
  WithLogin,
} from '@epam/ai-dial-chat-hooks';
import { NeutralButton, PrimaryButton } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ToolsetEditorProps } from '../../models/toolset-editor-props';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
  ToolsetFormErrors,
} from '../../models/toolset-form';
import { isToolsetFormValid, isValidEndpointUrl } from '../../utils/toolsets';
import { GeneralForm } from '../GeneralForm/GeneralForm';
import { SettingsForm } from '../SettingsForm/SettingsForm';

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

/** Host-agnostic composed editor for authoring a DIAL MCP toolset: metadata form, Setup section, validation, and save/persist orchestration via injected callbacks. */
export const ToolsetEditor: FC<ToolsetEditorProps> = ({
  initialForm,
  toolsetId,
  onPersist,
  onPostSaveLogin,
  onToolsetsChanged,
  onSaveSuccess,
  onSaveComplete,
  onBack,
  buildMcpUrl,
  listToolNames,
  authActions,
  oauthCallbackPath,
  onNotifySuccess,
  onNotifyError,
  bucket,
  FileManagerModal,
  resolveIconUrl,
  allowedMimeTypes,
  maxFileSizeBytes,
  availableLocaleOptions,
  labels,
}) => {
  const isEditMode = Boolean(toolsetId);
  const [draftToolsetId, setDraftToolsetId] = useState('');
  const persistedToolsetId = toolsetId || draftToolsetId;

  const [form, setForm] = useState<ToolsetFormData>(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ToolsetFormErrors>({});
  const [dirtyFields, setDirtyFields] = useState<ToolsetDirtyFields>({});
  const lastPersistedFormRef = useRef<ToolsetFormData | null>(null);

  /*
   * Re-seeds the editor whenever the host supplies a differently-identified
   * `initialForm` (a new load), resetting every piece of edit-session state
   * so a reused mount behaves like a fresh one.
   */
  useEffect(() => {
    setForm(initialForm);
    lastPersistedFormRef.current = initialForm;
    setErrors({});
    setDirtyFields({});
    setDraftToolsetId('');
  }, [initialForm]);

  const handleChange = useCallback((patch: Partial<ToolsetFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
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
      setForm((prev) => ({ ...prev, auth: { ...prev.auth, ...patch } }));
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
       * The auth block only includes isLoggedIn in a patch after a login or
       * logout request has actually resolved (or a successful OAuth login
       * has been recovered) — never speculatively. Keep the shared toolset
       * list in sync with that confirmed status in either direction so
       * returning to the Catalog never shows a stale pre-change snapshot.
       */
      if ('isLoggedIn' in patch) {
        void onToolsetsChanged();
      }
    },
    [onToolsetsChanged],
  );

  /**
   * Persists the form (if it has no id yet: creates it; if the form has
   * changed since it was last persisted: updates it), so the backend
   * reflects whatever the user has typed so far. Returns the toolset id on
   * success — including when nothing needed to be sent — or `null` if a
   * create/update call failed (the host surfaces the failure). Used by
   * Log In (which must not authenticate against stale endpoint/auth
   * settings).
   */
  const persistFormIfChanged = useCallback(async (): Promise<string | null> => {
    const isUnchangedSincePersist =
      persistedToolsetId &&
      lastPersistedFormRef.current != null &&
      JSON.stringify(lastPersistedFormRef.current) === JSON.stringify(form);
    if (isUnchangedSincePersist) return persistedToolsetId;

    setIsSaving(true);
    try {
      const id = await onPersist(form, persistedToolsetId);
      if (!id) return null;
      if (!persistedToolsetId) {
        setDraftToolsetId(id);
      }
      lastPersistedFormRef.current = form;
      await onToolsetsChanged();
      return id;
    } catch {
      // The host adapter already surfaced the failure notification.
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [form, persistedToolsetId, onPersist, onToolsetsChanged]);

  const handleEnsureSaved = useCallback(
    async () => (await persistFormIfChanged()) ?? false,
    [persistFormIfChanged],
  );

  const validate = useCallback(
    (data: ToolsetFormData): ToolsetFormErrors => {
      const validationLabels = labels?.validation;
      const nextErrors: ToolsetFormErrors = {};
      const generalCodes = validateDeploymentCreationFields(data, {
        validateVersionPattern: true,
      });
      if (generalCodes.name === DeploymentCreationFieldErrorCode.Required) {
        nextErrors.name = validationLabels?.nameRequired ?? 'Name is required';
      }
      if (
        generalCodes.version === DeploymentCreationFieldErrorCode.InvalidFormat
      ) {
        nextErrors.version =
          validationLabels?.versionInvalid ??
          'Version may only contain letters, digits, dots, underscores, and dashes';
      }
      if (!data.endpoint.trim()) {
        nextErrors.endpoint =
          validationLabels?.endpointRequired ?? 'Endpoint is required';
      } else if (!isValidEndpointUrl(data.endpoint)) {
        nextErrors.endpoint =
          validationLabels?.endpointInvalid ??
          'Enter a valid http(s) or sse URL';
      }
      if (!data.auth.isLoggedIn) {
        if (data.auth.authenticationType === ToolsetAuthTypes.ApiKey) {
          if (!data.auth.keyHeader?.trim()) {
            nextErrors.keyHeader =
              validationLabels?.keyHeaderRequired ?? 'Key name is required';
          }
          if (
            data.auth.withLogin === WithLogin.WithLogin &&
            !data.auth.apiKey?.trim()
          ) {
            nextErrors.apiKey =
              validationLabels?.apiKeyRequired ?? 'API key is required';
          }
        }
        if (
          data.auth.authenticationType === ToolsetAuthTypes.OAuth &&
          data.auth.withLogin === WithLogin.WithConfig
        ) {
          if (!data.auth.clientId?.trim()) {
            nextErrors.clientId =
              validationLabels?.clientIdRequired ?? 'Client ID is required';
          }
          if (!isEditMode && !data.auth.clientSecret?.trim()) {
            nextErrors.clientSecret =
              validationLabels?.clientSecretRequired ??
              'Client secret is required';
          }
          if (
            data.auth.authorizationEndpoint?.trim() &&
            !isValidEndpointUrl(data.auth.authorizationEndpoint)
          ) {
            nextErrors.authorizationEndpoint =
              validationLabels?.endpointInvalid ??
              'Enter a valid http(s) or sse URL';
          }
          if (
            data.auth.tokenEndpoint?.trim() &&
            !isValidEndpointUrl(data.auth.tokenEndpoint)
          ) {
            nextErrors.tokenEndpoint =
              validationLabels?.endpointInvalid ??
              'Enter a valid http(s) or sse URL';
          }
        }
      }
      return nextErrors;
    },
    [labels, isEditMode],
  );

  const handleSave = useCallback(async () => {
    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      const id = await onPersist(form, persistedToolsetId);
      if (!id) return;
      await onToolsetsChanged();
      /*
       * Reported before the post-save auth attempt: the toolset is persisted at this
       * point, so a failing connection must not read as a failed save. The
       * operation follows edit mode, not the request kind — a toolset authored
       * in this session is saved through an update once its draft exists, but
       * the user created it.
       */
      onSaveSuccess(form);
      try {
        await onPostSaveLogin(id, form.auth);
        onSaveComplete();
      } catch (error) {
        const { traceId } = await getApiErrorDetails(error);
        onNotifyError(
          labels?.settings?.auth?.errorLoginFailed ??
            'Failed to log in. Please check your credentials and try again.',
          traceId,
        );
      }
    } catch {
      // The host adapter already surfaced the failure notification.
    } finally {
      setIsSaving(false);
    }
  }, [
    form,
    validate,
    persistedToolsetId,
    onPersist,
    onToolsetsChanged,
    onSaveSuccess,
    onSaveComplete,
    onPostSaveLogin,
    onNotifyError,
    labels,
  ]);

  const isSaveDisabled = useMemo(
    () => !isToolsetFormValid(form, isEditMode),
    [form, isEditMode],
  );

  const visibleErrors = useMemo(() => {
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

  const connectUrl =
    buildMcpUrl && persistedToolsetId
      ? buildMcpUrl(persistedToolsetId)
      : undefined;

  return (
    <EditorLayout
      title={
        isEditMode
          ? (labels?.layout?.editTitle ?? 'Edit toolset')
          : (labels?.layout?.createTitle ?? 'Create toolset')
      }
      onBack={onBack}
      backAriaLabel={labels?.layout?.backAriaLabel ?? 'Back to catalog'}
      isSaving={isSaving}
      labels={{
        savingStatusLabel: labels?.layout?.savingStatusLabel ?? 'Saving',
      }}
      actions={
        <>
          <NeutralButton
            label={labels?.layout?.cancelLabel ?? 'Cancel'}
            onClick={onBack}
          />
          <PrimaryButton
            label={
              isEditMode
                ? (labels?.layout?.saveLabel ?? 'Save')
                : (labels?.layout?.createLabel ?? 'Create')
            }
            disabled={isSaveDisabled}
            onClick={handleSave}
          />
        </>
      }
      leftContent={
        <EditorSection
          title={labels?.layout?.metadataSectionTitle ?? 'Metadata'}
          className="border-0 p-4 desktop:p-6"
        >
          <GeneralForm
            form={form}
            errors={visibleErrors}
            bucket={bucket}
            FileManagerModal={FileManagerModal}
            resolveIconUrl={resolveIconUrl}
            allowedMimeTypes={allowedMimeTypes}
            maxFileSizeBytes={maxFileSizeBytes}
            availableLocaleOptions={availableLocaleOptions}
            onChange={handleChange}
            labels={labels?.general}
          />
        </EditorSection>
      }
      rightContent={
        <EditorSection
          title={labels?.layout?.setupSectionTitle ?? 'Setup'}
          className="border-0 p-4 desktop:p-6"
        >
          <SettingsForm
            form={form}
            errors={visibleErrors}
            isSaving={isSaving}
            toolsetId={persistedToolsetId}
            isEditMode={isEditMode}
            connectUrl={connectUrl}
            listToolNames={listToolNames}
            authActions={authActions}
            oauthCallbackPath={oauthCallbackPath}
            onNotifySuccess={onNotifySuccess}
            onNotifyError={onNotifyError}
            onChange={handleChange}
            onAuthChange={handleAuthChange}
            onEnsureSaved={handleEnsureSaved}
            labels={labels?.settings}
          />
        </EditorSection>
      }
    />
  );
};
