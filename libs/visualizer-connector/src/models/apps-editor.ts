import type {
  AppsEditorEvents,
  AppsEditorMessages,
} from '../types/visualizer-connector';

/** Host request to persist the editor's model, optionally merging host-owned General values. */
export interface AppsEditorTriggerSaveMessage<TGeneral = unknown> {
  /** Unprefixed save request. */
  type: AppsEditorMessages.TriggerSave;
  /** Application-defined General values; their validation belongs to the receiving application. */
  general?: TGeneral;
}

/** Host response containing a toolset login/logout outcome and optional application-defined status. */
export interface AppsEditorToolsetResultMessage<TCredentials = unknown> {
  /** Unprefixed result of the corresponding toolset request. */
  type:
    | AppsEditorMessages.ToolsetLoginResult
    | AppsEditorMessages.ToolsetLogoutResult;
  /** The toolset identifier from the request. */
  toolsetId: string;
  /** Whether the requested action succeeded. */
  success: boolean;
  /** Application-defined credentials scope. */
  credentialsLevel?: string;
  /** Failure reason, when available. */
  reason?: string;
  /** Application-defined credential status; the receiver validates its structure. */
  credentials?: TCredentials;
}

/** Host response containing the outcome of an external-service login. */
export interface AppsEditorExternalServiceLoginResultMessage {
  /** Unprefixed result of the external-service login request. */
  type: AppsEditorMessages.ExternalServiceLoginResult;
  /** The application identifier from the request, as sent. */
  appId: string;
  /** The external-service identifier from the request, as sent. */
  serviceId: string;
  /** Whether the person is now signed in to the service. */
  success: boolean;
  /** Failure reason, when available; its vocabulary belongs to the host. */
  reason?: string;
}

/** Messages the host may send to an application editor. Domain bodies remain application-owned. */
export type AppsEditorHostMessage<TGeneral = unknown, TCredentials = unknown> =
  | AppsEditorTriggerSaveMessage<TGeneral>
  | AppsEditorToolsetResultMessage<TCredentials>
  | AppsEditorExternalServiceLoginResultMessage;

/** Editor lifecycle notification; the wire type is prefixed with the application name. */
export interface AppsEditorLifecycleMessage {
  /** UI readiness, model readiness, or signed-out state; these signals are independent. */
  type:
    | AppsEditorEvents.ReadyToInteract
    | AppsEditorEvents.ReadyToSave
    | AppsEditorEvents.LoggedOut;
}

/** Editor notification that its application was updated. */
export interface AppsEditorUpdatedMessage {
  /** Namespaced on the wire, unprefixed in typed callbacks. */
  type: AppsEditorEvents.UpdatedApplicationSuccess;
  /** Optional application-defined update data. */
  payload?: {
    /** The updated application; its structure is owned by the application. */
    application?: unknown;
  };
}

/** Successful editor save; older editors omit the change indicator. */
export interface AppsEditorSaveSuccessMessage {
  /** Unprefixed save completion. */
  type: AppsEditorMessages.SaveSuccess;
  /** Whether user-editable values changed. Missing or invalid inbound values normalize to false. */
  hasChanges?: boolean;
}

/** Failed editor save. */
export interface AppsEditorSaveErrorMessage {
  /** Unprefixed save failure. */
  type: AppsEditorMessages.SaveError;
  /** Failure description; an omitted inbound description normalizes to an empty string. */
  error: string;
}

/** Current validity of the editor form, independent of model readiness and dirty state. */
export interface AppsEditorValidityMessage {
  /** Unprefixed validity notification. */
  type: AppsEditorMessages.ValidityState;
  /** Form validity. */
  payload: {
    /** Whether the form is valid. */
    isValid: boolean;
  };
}

/** Current unsaved-change state of the editor form. */
export interface AppsEditorDirtyMessage {
  /** Unprefixed dirty-state notification. */
  type: AppsEditorMessages.DirtyState;
  /** Form change state. */
  payload: {
    /** Whether the editor has unsaved edits. */
    isDirty: boolean;
  };
}

/** Editor request for the host to perform a toolset login or logout. */
export interface AppsEditorToolsetRequestMessage {
  /** Unprefixed toolset action request. */
  type:
    | AppsEditorMessages.RequestToolsetLogin
    | AppsEditorMessages.RequestToolsetLogout;
  /** Nonempty toolset identifier, interpreted by the host application. */
  toolsetId: string;
}

/** Editor request to open host-owned credential forms. */
export interface AppsEditorCredentialsRequestMessage {
  /** Unprefixed credentials-form request. */
  type: AppsEditorMessages.RequestApplicationCredentials;
  /** Nonempty application identifier; no credential material is sent. */
  appId: string;
}

/** Editor request for the host to sign the person in to one external service of an application. */
export interface AppsEditorExternalServiceLoginRequestMessage {
  /** Unprefixed external-service login request. */
  type: AppsEditorMessages.RequestExternalServiceLogin;
  /** Nonempty application identifier; no credential material is sent. */
  appId: string;
  /** Nonempty external-service identifier within the application. */
  serviceId: string;
  /** The person's own choice, collected by the editor, to let the application use the sign-in while they are away. */
  offlineUsageConsent: boolean;
}

/** Validated editor-to-host messages, with normalized lifecycle names and payload placement. */
export type AppsEditorClientMessage =
  | AppsEditorLifecycleMessage
  | AppsEditorUpdatedMessage
  | AppsEditorSaveSuccessMessage
  | AppsEditorSaveErrorMessage
  | AppsEditorValidityMessage
  | AppsEditorDirtyMessage
  | AppsEditorToolsetRequestMessage
  | AppsEditorCredentialsRequestMessage
  | AppsEditorExternalServiceLoginRequestMessage;
