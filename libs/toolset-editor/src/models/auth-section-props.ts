import type { ToolsetAuthActions, ToolsetAuthFormData, ToolsetFormErrors } from './toolset-form';

/** Pre-translated labels for the auth block, all optional with English defaults. */
export interface AuthSectionLabels {
  /** Heading of the authentication section. Defaults to `'Authentication'`. */
  sectionTitle?: string;
  /** Segment label for OAuth authentication. Defaults to `'OAuth'`. */
  typeOAuth?: string;
  /** Segment label for API-key authentication. Defaults to `'API Key'`. */
  typeApiKey?: string;
  /** Segment label for no authentication. Defaults to `'Open access'`. */
  typeNone?: string;
  /** Radio label for the API-key "with login" mode. Defaults to `'With login'`. */
  withLoginLabel?: string;
  /** Radio label for the API-key "without login" mode. Defaults to `'Without login'`. */
  withoutLoginLabel?: string;
  /** Radio label for the OAuth standard-login mode. Defaults to `'Standard login'`. */
  withLoginOAuthLabel?: string;
  /** Radio label for the OAuth custom-config mode. Defaults to `'Custom login'`. */
  withConfigOAuthLabel?: string;
  /** Text shown when no authentication is selected. Defaults to `'Open endpoint, no credentials'`. */
  openAccessDescription?: string;
  /** Label for the API key parameter name field. Defaults to `'API Key parameter name'`. */
  keyHeaderLabel?: string;
  /** Placeholder for the API key parameter name field. Defaults to `'Enter API key parameter name'`. */
  keyHeaderPlaceholder?: string;
  /** Label for the API key value field. Defaults to `'API key'`. */
  apiKeyLabel?: string;
  /** Placeholder for the API key value field. Defaults to `'Enter API key'`. */
  apiKeyPlaceholder?: string;
  /** Label for the OAuth client id field. Defaults to `'Client ID'`. */
  clientIdLabel?: string;
  /** Placeholder for the OAuth client id field. Defaults to `'Enter client ID'`. */
  clientIdPlaceholder?: string;
  /** Label for the OAuth client secret field. Defaults to `'Client secret'`. */
  clientSecretLabel?: string;
  /** Placeholder for the OAuth client secret field. Defaults to `'Enter client secret'`. */
  clientSecretPlaceholder?: string;
  /** Label for the OAuth authorization endpoint field. Defaults to `'Authorization endpoint'`. */
  authorizationEndpointLabel?: string;
  /** Placeholder for the OAuth authorization endpoint field. Defaults to `'Enter authorization endpoint'`. */
  authorizationEndpointPlaceholder?: string;
  /** Label for the OAuth token endpoint field. Defaults to `'Token endpoint'`. */
  tokenEndpointLabel?: string;
  /** Placeholder for the OAuth token endpoint field. Defaults to `'Enter token endpoint'`. */
  tokenEndpointPlaceholder?: string;
  /** Label for the OAuth scopes field. Defaults to `'Scopes'`. */
  scopesLabel?: string;
  /** Placeholder for the OAuth scopes field. Defaults to `'Enter scopes'`. */
  scopesPlaceholder?: string;
  /** Label for the log-in action. Defaults to `'Log in'`. */
  logInLabel?: string;
  /** Label for the log-out action. Defaults to `'Log out'`. */
  logOutLabel?: string;
  /** Label for the logout confirmation cancel action. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Success message shown after a login. Defaults to `'Successfully logged in.'`. */
  loginSuccessMessage?: string;
  /** Success message shown after a logout. Defaults to `'Successfully logged out.'`. */
  logoutSuccessMessage?: string;
  /** Title of the logout confirmation popup. Defaults to `'Log out?'`. */
  logoutConfirmTitle?: string;
  /** Body of the logout confirmation popup. Defaults to `'Are you sure you want to log out? You will need to re-enter your credentials to use this toolset again.'`. */
  logoutConfirmDescription?: string;
  /** Error message for a failed login. Defaults to `'Failed to log in. Please check your credentials and try again.'`. */
  errorLoginFailed?: string;
  /** Error message for a failed logout. Defaults to `'Failed to log out. Please try again.'`. */
  errorLogoutFailed?: string;
  /** Error message for a browser-blocked login popup. Defaults to `'The login popup was blocked by your browser. Please allow popups for this site and try again.'`. */
  errorPopupBlocked?: string;
  /** Error message for an unusable OAuth client configuration. Defaults to `'The OAuth provider did not return a valid client configuration. Please check the endpoint or contact your administrator.'`. */
  errorOAuthConfigMissing?: string;
}

/** Props of the internal authentication block of the Setup section. */
export interface AuthSectionProps {
  /** Current auth form state. */
  auth: ToolsetAuthFormData;
  /** Field error messages keyed by field name; only the auth subset is read. */
  errors: ToolsetFormErrors;
  /** Whether the editor is currently saving. */
  isSaving: boolean;
  /** Persisted toolset id, or empty before the first save in create mode. */
  toolsetId: string;
  /** Whether an existing toolset is being edited. */
  isEditMode: boolean;
  /** Current MCP endpoint URL value, used to gate the log-in action. */
  endpoint: string;
  /** Backend calls for login/logout/auth-settings reads, injected by the host. */
  authActions: ToolsetAuthActions;
  /** Host OAuth callback route the popup redirects back to. */
  oauthCallbackPath: string;
  /** Shows a success notification with the given message. */
  onNotifySuccess: (message: string) => void;
  /** Shows an error notification with the given message and optional trace id. */
  onNotifyError: (message: string, requestId?: string) => void;
  /** Called with the changed subset of auth form state. */
  onAuthChange: (patch: Partial<ToolsetAuthFormData>) => void;
  /**
   * Persists the form when it changed since the last save and resolves the
   * toolset id, or `false` when persisting failed.
   */
  onEnsureSaved: () => Promise<string | false>;
  /** Pre-translated labels, all optional with English defaults. */
  labels?: AuthSectionLabels;
}
