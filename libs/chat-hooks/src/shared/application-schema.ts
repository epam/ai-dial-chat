/*
 * Mirrors `apps/chat/src/constants/application-schema.ts`'s `CUSTOM_APP_SCHEMA_ID`
 * literal — a stable DIAL Core schema id, not app-owned configuration.
 */
const CUSTOM_APP_SCHEMA_ID = 'custom_app';

/** Shape of an application schema sufficient to classify it. */
export interface QuickAppSchemaLike {
  id?: string;
  displayName?: string;
}

/** True when `schema` is the custom-app (code app) schema. */
export const isCustomAppSchema = (schema?: QuickAppSchemaLike): boolean =>
  !!schema && schema.id === CUSTOM_APP_SCHEMA_ID;

/*
 * TODO: this matches on schema id suffix / display name because DIAL Core
 * does not yet expose a stable capability/type field for schemas. Replace
 * with a proper identifier once one is available — don't keep relying on
 * schema id or display name string matching.
 */
/** True when `schema` is a Quick App 2.0 schema. */
export const isQuickAppSchema = (schema?: QuickAppSchemaLike): boolean =>
  !!schema &&
  (!!schema.id?.endsWith('quickapps2') ||
    schema.displayName === 'Quick app 2.0');
