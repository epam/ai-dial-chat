export enum AppsEditorQuery {
  Step = 'step',
  Schema = 'schema',
  ReturnUrl = 'returnUrl',
  IsCreating = 'isCreating',
  AppId = 'appId',
}

export enum AppsEditorStep {
  General = 'general',
  Settings = 'settings',
}

export enum AppsEditorEvent {
  ReadyToInteract = 'readyToInteract',
  UpdatedSuccess = 'updatedApplicationSuccess',
  TriggerSave = 'TRIGGER_SAVE',
  SaveSuccess = 'SAVE_SUCCESS',
  SaveError = 'SAVE_ERROR',
}
