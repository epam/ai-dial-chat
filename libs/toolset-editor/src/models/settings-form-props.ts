import type { AuthSectionLabels } from './auth-section-props';
import type {
  ToolsetAuthActions,
  ToolsetAuthFormData,
  ToolsetFormData,
  ToolsetFormErrors,
} from './toolset-form';
import type { ToolsetOAuthLoginHandler } from './toolset-oauth-login';

/** Pre-translated labels for the Connect section, all optional with English defaults. */
export interface ConnectMcpUrlContentLabels {
  /** Section title. Defaults to `'Connect toolset'`. */
  title?: string;
  /** Section description. Defaults to `'Copy endpoint URL to easily integrate toolset into your workflows'`. */
  description?: string;
  /** Label for the copy action. Defaults to `'Copy URL'`. */
  copyLabel?: string;
  /** Transient feedback shown after copying. Defaults to `'Copied!'`. */
  copiedLabel?: string;
}

/** Pre-translated labels for the Setup section, all optional with English defaults. */
export interface SettingsFormLabels {
  /** Label for the endpoint field. Defaults to `'Endpoint'`. */
  endpointLabel?: string;
  /** Caption under the endpoint field. Defaults to `'The HTTPS address where the server accepts MCP requests. Choose the transport under Protocol below.'`. */
  endpointCaption?: string;
  /** Placeholder for the endpoint field. Defaults to `'https://...'`. */
  endpointPlaceholder?: string;
  /** Label for the protocol radio group. Defaults to `'Protocol'`. */
  protocolLabel?: string;
  /** Label for the allowed tools field. Defaults to `'Allowed tools'`. */
  allowedToolsLabel?: string;
  /** Placeholder for the allowed tools tag input. Defaults to `'Add tools, comma separated'`. */
  allowedToolsPlaceholder?: string;
  /** Placeholder for the allowed tools select. Defaults to `'Select allowed tools'`. */
  allowedToolsSelectPlaceholder?: string;
  /** Labels threaded to the embedded Connect section. */
  connect?: ConnectMcpUrlContentLabels;
  /** Labels threaded to the embedded auth block. */
  auth?: AuthSectionLabels;
}

/** Color overrides for the Setup section form, applied as CSS custom properties. */
export interface SettingsFormColors {
  /** Text color of the "Connect toolset" title. Defaults to `--text-primary`. */
  connectTitle?: string;
  /** Text color of the "Connect toolset" description. Defaults to `--text-secondary`. */
  connectDescription?: string;
  /** Color of the divider above the "Connect toolset" block. Defaults to `--stroke-tertiary`. */
  connectDivider?: string;
  /** Text color of the open-access ("None" auth) description. Defaults to `--text-secondary`. */
  openAccessDescription?: string;
}

/** Typography class overrides for the Setup section form. */
export interface SettingsFormTypography {
  /** Typography class of the "Authentication" heading. Defaults to `'dial-h3-text'`. */
  authTitleClassName?: string;
  /** Typography class of the open-access ("None" auth) description. Defaults to `'dial-small-text'`. */
  openAccessDescriptionClassName?: string;
  /** Typography class of the "Connect toolset" title. Defaults to `'dial-body-semi-text'`. */
  connectTitleClassName?: string;
  /** Typography class of the "Connect toolset" description. Defaults to `'dial-small-text'`. */
  connectDescriptionClassName?: string;
}

/** Props of the internal Setup section form. */
export interface SettingsFormProps {
  /** Current toolset form state. */
  form: ToolsetFormData;
  /** Field error messages keyed by field name. */
  errors: ToolsetFormErrors;
  /** Whether the editor is currently saving. */
  isSaving: boolean;
  /** Persisted toolset id, or empty before the first save in create mode. */
  toolsetId: string;
  /** Whether an existing toolset is being edited. */
  isEditMode: boolean;
  /**
   * MCP endpoint URL to show in the Connect section, already resolved by the
   * host from its external-core URL. Empty/omitted hides the section.
   */
  connectUrl?: string;
  /**
   * Resolves the tool names offered by the "Allowed tools" picker from the
   * toolset's own MCP `tools/list`. When omitted or when it resolves to an
   * empty list, the free-text tag input renders instead.
   */
  listToolNames?: (toolsetId: string) => Promise<string[]>;
  /** Backend calls for login/logout/auth-settings reads, injected by the host. */
  authActions: ToolsetAuthActions;
  /** Runs the host's OAuth login flow and reports how it settled. */
  onOAuthLogin: ToolsetOAuthLoginHandler;
  /** Shows a success notification with the given message. */
  onNotifySuccess: (message: string) => void;
  /** Shows an error notification with the given message and optional trace id. */
  onNotifyError: (message: string, requestId?: string) => void;
  /** Called with the changed subset of toolset form state. */
  onChange: (patch: Partial<ToolsetFormData>) => void;
  /** Called with the changed subset of auth form state. */
  onAuthChange: (patch: Partial<ToolsetAuthFormData>) => void;
  /**
   * Persists the form when it changed since the last save and resolves the
   * toolset id, or `false` when persisting failed.
   */
  onEnsureSaved: () => Promise<string | false>;
  /** Pre-translated labels, all optional with English defaults. */
  labels?: SettingsFormLabels;
  /** Color overrides. */
  colors?: SettingsFormColors;
  /** Typography class overrides. */
  typography?: SettingsFormTypography;
}
