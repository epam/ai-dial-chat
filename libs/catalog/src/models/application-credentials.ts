import type {
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../types/toolset-auth';
import type { ItemDetailsTexts } from './item-details-props';

/** Host-resolved presentation of one application's credentials. */
export interface ApplicationCredential {
  /** Stable service identifier. */
  id: string;
  /** Display name of the service. */
  name: string;
  /** Optional service description. */
  description?: string;
  /** API-key input or redirect-based login presentation. */
  authenticationType: ToolsetAuthenticationType;
  /** Current personal connection status. */
  status: CredentialStatus;
  /** Whether a shared credential is available while personal credentials are absent. */
  hasSharedCredentials?: boolean;
  /** Whether the connected credential can be removed here. Defaults to false. */
  canLogout?: boolean;
  /** Whether to offer the optional offline-use checkbox. Defaults to false. */
  canConsentToOfflineUsage?: boolean;
  /** Host-provided explanation of any additional login requirements. */
  hint?: string;
}

/** Values submitted by an application credentials form. */
export interface ApplicationCredentialLoginParams {
  /** Entered API key, present only for API-key forms. */
  apiKey?: string;
  /** Explicit user consent, initially false for each form. */
  offlineUsageConsent: boolean;
}

/** Localizable application form copy, alongside the shared toolset credentials labels. */
export interface ApplicationCredentialsTexts extends ItemDetailsTexts {
  /** Section title. Defaults to 'Credentials'. */
  title?: string;
  /** Initial loading status. Defaults to 'Loading…'. */
  loading?: string;
  /** Metadata error message. Defaults to 'Unable to load credentials'. */
  loadError?: string;
  /** Retry action. Defaults to 'Retry'. */
  retry?: string;
  /** Empty-state message. Defaults to 'No credentials required'. */
  empty?: string;
  /** Shared-credentials explanation. Defaults to 'Shared credentials are available for this service.'. */
  sharedCredentials?: string;
  /** Consent checkbox label. Defaults to 'Allow offline use'. */
  offlineUsageConsent?: string;
  /** Optional consent explanation. */
  offlineUsageConsentHint?: string;
}

/** Props for the reusable application credentials forms. */
export interface ApplicationCredentialsProps {
  /** Host-resolved service presentations in display order. */
  services: ApplicationCredential[];
  /** Whether metadata is being loaded. Defaults to false. */
  isLoading?: boolean;
  /** Whether metadata loading failed. Defaults to false. */
  hasError?: boolean;
  /** Whether to show the empty-state message. Defaults to false. */
  showEmptyState?: boolean;
  /** Reloads metadata after a load failure. */
  onRetry: () => Promise<void> | void;
  /** Performs login and refreshes metadata; false preserves the draft after cancellation. Rejections must contain a user-facing error. */
  onLogin: (
    serviceId: string,
    params: ApplicationCredentialLoginParams,
  ) => Promise<boolean>;
  /** Removes only a removable credential and refreshes metadata. Rejections must contain a user-facing error. */
  onLogout: (serviceId: string) => Promise<void>;
  /** Text overrides; omitted values use English defaults. */
  texts?: ApplicationCredentialsTexts;
}
