import type {
  DeploymentCreationFormLabels,
  DeploymentCreationFormValidationOptions,
  DeploymentCreationFormValues,
} from '@epam/ai-dial-builder-form';
import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import type { ParseKeys, TFunction } from 'i18next';
import type { ComponentType, ReactNode } from 'react';
import type {
  ApplicationCreateStrategy,
  ApplicationEditorKind,
} from '../types/application-editor';
import type { NotifiableEntity } from '../types/entity-notification';

/** Setup-field error messages, keyed by setup field. */
export type ApplicationSetupErrors<TSetup> = Partial<
  Record<Extract<keyof TSetup, string>, string>
>;

/** Props every kind's Setup component receives from `ApplicationEditorPage`. */
export interface ApplicationSetupProps<TSetup> {
  /** Current setup values. */
  value: TSetup;
  /** Setup errors to show, already translated. */
  errors: ApplicationSetupErrors<TSetup>;
  /** Merges a patch into the setup values. */
  onChange: (patch: Partial<TSetup>) => void;
  /** Re-validates one setup field when it loses focus. */
  onFieldBlur: (field: Extract<keyof TSetup, string>) => void;
  /** Whether an existing application is being edited. */
  isEditMode: boolean;
}

/** A key of the app's translation resources. */
export type ApplicationEditorI18nKey = ParseKeys<'translation'>;

/** Notifiable entities an application editor reports on. */
export type ApplicationNotifiableEntity =
  | NotifiableEntity.CustomApp
  | NotifiableEntity.QuickApp
  | NotifiableEntity.Toolset;

/** i18n keys of the confirmation popup a kind may show before persisting. */
export interface ApplicationEditorConfirmation {
  titleKey: ApplicationEditorI18nKey;
  descriptionKey: ApplicationEditorI18nKey;
  confirmKey: ApplicationEditorI18nKey;
}

/** i18n keys a kind supplies for its page-level messages. */
export interface ApplicationEditorMessageKeys {
  createTitle: ApplicationEditorI18nKey;
  editTitle: ApplicationEditorI18nKey;
  createFailed: ApplicationEditorI18nKey;
  saveFailed: ApplicationEditorI18nKey;
  loadFailed: ApplicationEditorI18nKey;
  savingOverlay: ApplicationEditorI18nKey;
  loadingOverlay: ApplicationEditorI18nKey;
}

/** An application kind rendered through the shared Metadata | Setup page. */
export interface ApplicationEditorFormDefinition<TSetup> {
  kind: ApplicationEditorKind;
  notifiableEntity: ApplicationNotifiableEntity;
  createStrategy: ApplicationCreateStrategy;
  /** Query param holding the edited application's id. */
  idQueryParam: string;
  /** Query param holding the URL to return to. */
  returnUrlQueryParam: string;
  messageKeys: ApplicationEditorMessageKeys;
  /** Pattern checks applied to the Metadata section. */
  metadataValidation: DeploymentCreationFormValidationOptions;
  /** Per-field Metadata label overrides, e.g. kind-specific placeholders. */
  getMetadataLabelOverrides?: (
    t: TFunction,
  ) => Partial<DeploymentCreationFormLabels>;
  defaultMetadata: DeploymentCreationFormValues;
  defaultSetup: TSetup;
  /** Loads the setup of an edited application; absent when setup comes from the deployment list. */
  loadSetup?: (
    appId: string,
    deployment: DeploymentItemDto | undefined,
  ) => Promise<TSetup>;
  /** Returns the setup errors that block persisting. */
  validateSetup: (
    setup: TSetup,
    t: TFunction,
  ) => ApplicationSetupErrors<TSetup>;
  /** Whether the valid setup still needs the user's confirmation before persisting. */
  needsConfirmation?: (setup: TSetup) => boolean;
  confirmation?: ApplicationEditorConfirmation;
  Setup: ComponentType<ApplicationSetupProps<TSetup>>;
  /** Creates the application. Calls `apps/chat/src/server-api` wrappers only. */
  create: (
    metadata: DeploymentCreationFormValues,
    setup: TSetup,
  ) => Promise<unknown>;
  /** Updates the application. Calls `apps/chat/src/server-api` wrappers only. */
  update: (
    appId: string,
    metadata: DeploymentCreationFormValues,
    setup: TSetup,
  ) => Promise<unknown>;
}

/** An application kind that renders its own page body (the toolset's auth flow). */
export interface ApplicationEditorPageDefinition {
  kind: ApplicationEditorKind;
  renderPage: () => ReactNode;
}

/** Setup values as the page handles them once a kind's own type is erased. */
export type ApplicationSetupValues = object;

/** Any registered application kind. */
export type ApplicationEditorDefinition =
  | ApplicationEditorFormDefinition<ApplicationSetupValues>
  | ApplicationEditorPageDefinition;
