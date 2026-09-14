/** `Id`/`ReturnUrl` intentionally match `EditorQuery`'s values; kept as their own enum for the toolset-editor-only `Step` member. */
export enum ToolsetEditorQuery {
  Id = 'id',
  Step = 'step',
  ReturnUrl = 'returnUrl',
}

export enum ToolsetEditorSteps {
  General = 'general',
  Settings = 'settings',
}
