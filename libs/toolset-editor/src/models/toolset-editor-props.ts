import type {
  AvatarPickerFileManagerModalProps,
  DeploymentCreationFormLocaleOption,
} from '@epam/ai-dial-builder-form';
import type { ComponentType } from 'react';
import type { GeneralFormLabels } from './general-form-props';
import type { SettingsFormLabels } from './settings-form-props';
import type {
  ToolsetAuthActions,
  ToolsetAuthFormData,
  ToolsetFormData,
} from './toolset-form';

/** Validation messages surfaced under the fields, all optional with English defaults. */
export interface ToolsetEditorValidationLabels {
  /** Message for a missing name. Defaults to `'Name is required'`. */
  nameRequired?: string;
  /** Message for a malformed version. Defaults to `'Version may only contain letters, digits, dots, underscores, and dashes'`. */
  versionInvalid?: string;
  /** Message for a missing endpoint. Defaults to `'Endpoint is required'`. */
  endpointRequired?: string;
  /** Message for a malformed endpoint. Defaults to `'Enter a valid http(s) or sse URL'`. */
  endpointInvalid?: string;
  /** Message for a missing API key parameter name. Defaults to `'Key name is required'`. */
  keyHeaderRequired?: string;
  /** Message for a missing API key value. Defaults to `'API key is required'`. */
  apiKeyRequired?: string;
  /** Message for a missing OAuth client id. Defaults to `'Client ID is required'`. */
  clientIdRequired?: string;
  /** Message for a missing OAuth client secret in create mode. Defaults to `'Client secret is required'`. */
  clientSecretRequired?: string;
}

/** Labels for the editor chrome (header, actions, section titles), all optional with English defaults. */
export interface ToolsetEditorLayoutLabels {
  /** Header title in create mode. Defaults to `'Create toolset'`. */
  createTitle?: string;
  /** Header title in edit mode. Defaults to `'Edit toolset'`. */
  editTitle?: string;
  /** Accessible name of the header back button. Defaults to `'Back to catalog'`. */
  backAriaLabel?: string;
  /** Saving status text shown in the header. Defaults to `'Saving'`. */
  savingStatusLabel?: string;
  /** Title of the Metadata (general) section. Defaults to `'Metadata'`. */
  metadataSectionTitle?: string;
  /** Title of the Setup section. Defaults to `'Setup'`. */
  setupSectionTitle?: string;
  /** Label of the cancel action. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Label of the save action in edit mode. Defaults to `'Save'`. */
  saveLabel?: string;
  /** Label of the save action in create mode. Defaults to `'Create'`. */
  createLabel?: string;
}

/**
 * Pre-translated labels for the whole editor. Each group is optional and
 * replaced as a whole; omitting one falls back to the library's English
 * defaults.
 */
export interface ToolsetEditorLabels {
  /** Header/action/section labels. */
  layout?: ToolsetEditorLayoutLabels;
  /** Labels threaded to the embedded general (metadata) form. */
  general?: GeneralFormLabels;
  /** Labels threaded to the embedded Setup section form. */
  settings?: SettingsFormLabels;
  /** Validation messages keyed by field. */
  validation?: ToolsetEditorValidationLabels;
}

/** Props of the composed Toolset editor. */
export interface ToolsetEditorProps {
  /**
   * Initial form state, loaded by the host. The editor re-seeds its internal
   * state (form, errors, dirty fields, draft id) whenever this prop's
   * identity changes, so the host must memoize it per loaded entity.
   */
  initialForm: ToolsetFormData;
  /** Toolset id from the host route; empty in create mode. */
  toolsetId: string;
  /**
   * Persists the form — creating the toolset when `toolsetId` is empty,
   * updating it otherwise. The host owns the request mapping and its own
   * failure notification; resolves the persisted toolset id, or `null` when
   * the request failed.
   */
  onPersist: (
    form: ToolsetFormData,
    toolsetId: string,
  ) => Promise<string | null>;
  /**
   * Runs the post-save automatic login for an API-key toolset configured
   * "With login". Rejections are surfaced by the editor as a login failure
   * without blocking navigation-independent state.
   */
  onPostSaveLogin: (
    toolsetId: string,
    auth: ToolsetAuthFormData,
  ) => Promise<void>;
  /**
   * Re-syncs the host's shared toolset list. Called after every successful
   * persist and whenever the logged-in status changes.
   */
  onToolsetsChanged: () => Promise<void> | void;
  /**
   * Called with the saved form once persistence succeeded, before the
   * post-save login attempt — the host raises its success toast here.
   */
  onSaveSuccess: (form: ToolsetFormData) => void;
  /** Called after the save and the post-save login both succeeded — the host navigates away. */
  onSaveComplete: () => void;
  /** Called for the Cancel button and the header back action. */
  onBack: () => void;
  /**
   * Builds the MCP endpoint URL shown in the Connect section for a toolset
   * id. Omit when the host has no external core URL configured — the
   * section stays hidden.
   */
  buildMcpUrl?: (toolsetId: string) => string;
  /**
   * Resolves the tool names offered by the "Allowed tools" picker from the
   * toolset's own MCP `tools/list`. When omitted, the free-text tag input
   * renders instead.
   */
  listToolNames?: (toolsetId: string) => Promise<string[]>;
  /** Backend calls for login/logout/auth-settings reads, injected by the host. */
  authActions: ToolsetAuthActions;
  /** Host OAuth callback route the login popup redirects back to. */
  oauthCallbackPath: string;
  /** Shows a success notification with the given message. */
  onNotifySuccess: (message: string) => void;
  /** Shows an error notification with the given message and optional trace id. */
  onNotifyError: (message: string, requestId?: string) => void;
  /** Storage bucket whose files the avatar picker browses. */
  bucket: string;
  /** Host file-manager modal rendered inside the avatar picker. */
  FileManagerModal: ComponentType<AvatarPickerFileManagerModalProps>;
  /** Resolves an icon URL into the previewable URL the form renders. */
  resolveIconUrl: (url: string) => string;
  /** MIME types the avatar picker accepts. */
  allowedMimeTypes: string[];
  /** Maximum avatar file size in bytes. */
  maxFileSizeBytes: number;
  /** Locale options offered by the "Add locale" popup. */
  availableLocaleOptions: DeploymentCreationFormLocaleOption[];
  /** Pre-translated labels; each group falls back to English defaults. */
  labels?: ToolsetEditorLabels;
}
