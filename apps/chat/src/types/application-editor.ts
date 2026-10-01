/** Application kinds rendered by the generic `ApplicationEditorPage`. */
export enum ApplicationEditorKind {
  Toolset = 'toolset',
  CustomApp = 'custom-app',
  QuickApp = 'quick-app',
  /** Schema-based application configured through a form rendered from its JSON schema. */
  SchemaApp = 'schema-app',
}

/** How an application kind persists a new application. */
export enum ApplicationCreateStrategy {
  /** One request carries metadata and setup, then the editor exits. */
  AllAtOnce = 'all-at-once',
  /** Metadata is created first; the editor switches to edit mode in place and setup saves separately. */
  MetadataFirst = 'metadata-first',
}
