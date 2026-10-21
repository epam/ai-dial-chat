/**
 * Requests the host sends to the visualizer iframe. Posted as
 * `${visualizerName}/${value}`; the iframe answers `${visualizerName}/${value}/RESPONSE`.
 */
export enum VisualizerConnectorRequests {
  SendVisualizeData = 'SEND_VISUALIZE_DATA',
  SendGroupedVisualizeData = 'SEND_GROUPED_VISUALIZE_DATA',
  SetVisualizerOptions = 'SET_VISUALIZER_OPTIONS',
}

/** Unsolicited messages the visualizer iframe posts to the host, as `${visualizerName}/${value}`. */
export enum VisualizerConnectorEvents {
  InitReady = 'INIT_READY',
  Ready = 'READY',
  ReadyToInteract = 'READY_TO_INTERACT',
  SendMessage = 'SEND_MESSAGE',
  CreatedConversationSuccess = 'CREATED_CONVERSATION_SUCCESS',
  UpdatedConversationSuccess = 'UPDATED_CONVERSATION_SUCCESS',
  UpdatedApplicationSuccess = 'UPDATED_APPLICATION_SUCCESS',
}

/**
 * Messages an application-editor iframe posts to DIAL Chat's application editor, as
 * `${applicationName}/${value}`. The camelCase wire values are the ones the editor host matches on;
 * they are not the visualizer events above.
 */
export enum AppsEditorEvents {
  /** The editor's UI has rendered; the host drops its loading overlay. */
  ReadyToInteract = 'readyToInteract',
  /** The editor's own model is loaded and valid, so a `TRIGGER_SAVE` saves correctly. May repeat. */
  ReadyToSave = 'readyToSave',
  /** The editor's session resolved signed out, so `ReadyToSave` will not arrive. */
  LoggedOut = 'loggedOut',
  /** The editor saved the application; the host refreshes its own copy. */
  UpdatedApplicationSuccess = 'updatedApplicationSuccess',
}

/**
 * The application editor's save and auth messages, posted WITHOUT the `${applicationName}/` prefix.
 * Field placement follows what DIAL Chat's application editor reads (top level unless noted).
 */
export enum AppsEditorMessages {
  /** Host → editor: save now. Carries the General step as `general` when the host owns it. */
  TriggerSave = 'TRIGGER_SAVE',
  /** Editor → host: the save landed; `hasChanges: boolean`. */
  SaveSuccess = 'SAVE_SUCCESS',
  /** Editor → host: the save failed or was refused; `error: string`. */
  SaveError = 'SAVE_ERROR',
  /** Editor → host: the form's validity; `payload.isValid: boolean`. */
  ValidityState = 'VALIDITY_STATE',
  /** Editor → host: unsaved edits; `payload.isDirty: boolean` (top-level `isDirty` also read). */
  DirtyState = 'DIRTY_STATE',
  /** Editor → host: start a toolset OAuth login; `toolsetId: string`. */
  RequestToolsetLogin = 'REQUEST_TOOLSET_LOGIN',
  /** Host → editor: outcome of `RequestToolsetLogin`. */
  ToolsetLoginResult = 'TOOLSET_LOGIN_RESULT',
  /** Editor → host: log a toolset out; `toolsetId: string`. */
  RequestToolsetLogout = 'REQUEST_TOOLSET_LOGOUT',
  /** Host → editor: outcome of `RequestToolsetLogout`. */
  ToolsetLogoutResult = 'TOOLSET_LOGOUT_RESULT',
  /** Editor → host: open the host's credential forms; `appId: string`. No credential crosses the frame. */
  RequestApplicationCredentials = 'REQUEST_APPLICATION_CREDENTIALS',
}
