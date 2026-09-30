/** `Id` intentionally matches `EditorQuery`'s value; kept as its own enum for the toolset-editor-only `Step` member. */
export enum ToolsetEditorQuery {
  Id = 'id',
  Step = 'step',
}

export enum ToolsetEditorSteps {
  General = 'general',
  Settings = 'settings',
}
