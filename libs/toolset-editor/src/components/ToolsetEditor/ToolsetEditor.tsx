import {
  DeploymentCreationFieldErrorCode,
  EntityEditor,
  MetadataField,
  useMetadataForm,
  type DeploymentCreationFormValidationOptions,
} from '@epam/ai-dial-builder-form';
import {
  getApiErrorDetails,
  ToolsetAuthTypes,
  WithLogin,
} from '@epam/ai-dial-chat-hooks';
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TOOLSET_EDITOR_CLASS } from '../../constants/public-class-names';
import type { ToolsetEditorProps } from '../../models/toolset-editor-props';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
  ToolsetFormErrors,
} from '../../models/toolset-form';
import {
  isToolsetFormValid,
  isValidEndpointUrl,
  pickToolsetMetadata,
  splitToolsetFormPatch,
} from '../../utils/toolsets';
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

/* Setup-section fields; Metadata errors are owned by `useMetadataForm`. */
const SETUP_ERROR_FIELDS: (keyof ToolsetFormErrors)[] = [
  'endpoint',
  ...AUTH_ERROR_FIELDS,
];

const SETUP_ERROR_FIELD_SET = new Set<string>(SETUP_ERROR_FIELDS);

const METADATA_VALIDATION_OPTIONS: DeploymentCreationFormValidationOptions = {
  validateVersionPattern: true,
};

type ToolsetDirtyFields = Partial<Record<keyof ToolsetFormErrors, true>>;

const getDirtyFieldsFromPatch = (patch: object): ToolsetDirtyFields => {
  const dirtyFields: ToolsetDirtyFields = {};
  for (const key of Object.keys(patch)) {
    if (SETUP_ERROR_FIELD_SET.has(key)) {
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
  onOAuthLogin,
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

  /*
   * A new `initialForm` identity is a new load. Counting identities gives
   * `useMetadataForm` a re-seed key, so it resets in the same render in which
   * the Setup state below resets.
   */
  const [seed, setSeed] = useState({ initialForm, key: 0 });
  if (seed.initialForm !== initialForm) {
    setSeed({ initialForm, key: seed.key + 1 });
  }

  const metadataInitialValues = useMemo(
    () => pickToolsetMetadata(initialForm),
    [initialForm],
  );
  const metadata = useMetadataForm({
    initialValues: metadataInitialValues,
    validationOptions: METADATA_VALIDATION_OPTIONS,
    reseedKey: seed.key,
  });
  const {
    values: metadataValues,
    setValues: setMetadataValues,
    markTouched: markMetadataTouched,
    visibleErrorCodes: metadataErrorCodes,
    attemptSubmit: attemptMetadataSubmit,
  } = metadata;

  // Holds the Setup fields; its Metadata fields are superseded by `metadataValues`.
  const [setupForm, setSetupForm] = useState<ToolsetFormData>(initialForm);
  const form = useMemo<ToolsetFormData>(
    () => ({ ...setupForm, ...metadataValues }),
    [setupForm, metadataValues],
  );

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
    setSetupForm(initialForm);
    lastPersistedFormRef.current = initialForm;
    setErrors({});
    setDirtyFields({});
    setDraftToolsetId('');
  }, [initialForm]);

  const handleChange = useCallback(
    (patch: Partial<ToolsetFormData>) => {
      const { metadata: metadataPatch, setup: setupPatch } =
        splitToolsetFormPatch(patch);

      if (Object.keys(metadataPatch).length > 0) {
        setMetadataValues(metadataPatch);
        // Metadata errors show as soon as a field is edited, as they always have here.
        if ('name' in metadataPatch) markMetadataTouched(MetadataField.Name);
        if ('version' in metadataPatch) {
          markMetadataTouched(MetadataField.Version);
        }
      }

      if (Object.keys(setupPatch).length === 0) return;

      setSetupForm((prev) => ({ ...prev, ...setupPatch }));
      setDirtyFields((prev) => ({
        ...prev,
        ...getDirtyFieldsFromPatch(setupPatch),
      }));
      setErrors((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(setupPatch)) {
          delete next[key as keyof ToolsetFormErrors];
        }
        return next;
      });
    },
    [setMetadataValues, markMetadataTouched],
  );

  const handleAuthChange = useCallback(
    (patch: Partial<ToolsetAuthFormData>) => {
      setSetupForm((prev) => ({ ...prev, auth: { ...prev.auth, ...patch } }));
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

  /** Validates the Setup section; Metadata is validated by `useMetadataForm`. */
  const validateSetup = useCallback(
    (data: ToolsetFormData): ToolsetFormErrors => {
      const validationLabels = labels?.validation;
      const nextErrors: ToolsetFormErrors = {};
      if (!data.endpoint.trim()) {
        nextErrors.endpoint =
          validationLabels?.endpointRequired ?? 'Endpoint is required';
      } else if (!isValidEndpointUrl(data.endpoint)) {
        nextErrors.endpoint =
          validationLabels?.endpointInvalid ?? 'Enter a valid http(s) URL';
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
              validationLabels?.endpointInvalid ?? 'Enter a valid http(s) URL';
          }
          if (
            data.auth.tokenEndpoint?.trim() &&
            !isValidEndpointUrl(data.auth.tokenEndpoint)
          ) {
            nextErrors.tokenEndpoint =
              validationLabels?.endpointInvalid ?? 'Enter a valid http(s) URL';
          }
        }
      }
      return nextErrors;
    },
    [labels, isEditMode],
  );

  const handleSave = useCallback(async () => {
    const isMetadataValid = attemptMetadataSubmit();
    const nextErrors = validateSetup(form);
    if (!isMetadataValid || Object.keys(nextErrors).length > 0) {
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
    attemptMetadataSubmit,
    form,
    validateSetup,
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
    const validationLabels = labels?.validation;
    const validationErrors = validateSetup(form);
    const nextErrors = { ...errors };
    for (const key of SETUP_ERROR_FIELDS) {
      if (!dirtyFields[key]) continue;

      const message = validationErrors[key];
      if (message) {
        nextErrors[key] = message;
      } else {
        delete nextErrors[key];
      }
    }

    if (metadataErrorCodes.name === DeploymentCreationFieldErrorCode.Required) {
      nextErrors.name = validationLabels?.nameRequired ?? 'Name is required';
    }
    if (
      metadataErrorCodes.version ===
      DeploymentCreationFieldErrorCode.InvalidFormat
    ) {
      nextErrors.version =
        validationLabels?.versionInvalid ??
        'Version may only contain letters, digits, dots, underscores, and dashes';
    }
    return nextErrors;
  }, [dirtyFields, errors, form, labels, metadataErrorCodes, validateSetup]);

  const connectUrl =
    buildMcpUrl && persistedToolsetId
      ? buildMcpUrl(persistedToolsetId)
      : undefined;

  return (
    <EntityEditor
      title={
        isEditMode
          ? (labels?.layout?.editTitle ?? 'Edit toolset')
          : (labels?.layout?.createTitle ?? 'Create toolset')
      }
      onBack={onBack}
      onCancel={onBack}
      onSubmit={handleSave}
      submitLabel={
        isEditMode
          ? (labels?.layout?.saveLabel ?? 'Save')
          : (labels?.layout?.createLabel ?? 'Create')
      }
      isSubmitting={isSaving}
      isSubmitDisabled={isSaveDisabled}
      metadataSectionClassName={TOOLSET_EDITOR_CLASS.metadataSection}
      setupSectionClassName={TOOLSET_EDITOR_CLASS.setupSection}
      labels={{
        backAriaLabel: labels?.layout?.backAriaLabel ?? 'Back to catalog',
        savingStatusLabel: labels?.layout?.savingStatusLabel ?? 'Saving',
        metadataTitle: labels?.layout?.metadataSectionTitle ?? 'Metadata',
        setupTitle: labels?.layout?.setupSectionTitle ?? 'Setup',
        cancelLabel: labels?.layout?.cancelLabel ?? 'Cancel',
      }}
      metadata={
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
      }
      setup={
        <SettingsForm
          form={form}
          errors={visibleErrors}
          isSaving={isSaving}
          toolsetId={persistedToolsetId}
          isEditMode={isEditMode}
          connectUrl={connectUrl}
          listToolNames={listToolNames}
          authActions={authActions}
          onOAuthLogin={onOAuthLogin}
          onNotifySuccess={onNotifySuccess}
          onNotifyError={onNotifyError}
          onChange={handleChange}
          onAuthChange={handleAuthChange}
          onEnsureSaved={handleEnsureSaved}
          labels={labels?.settings}
        />
      }
    />
  );
};
