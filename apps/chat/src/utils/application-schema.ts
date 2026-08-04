import { CUSTOM_APP_SCHEMA_ID } from '../constants/application-schema';

interface QuickAppSchemaLike {
  id?: string;
  displayName?: string;
}

export const isCustomAppSchema = (schema?: QuickAppSchemaLike): boolean =>
  !!schema && schema.id === CUSTOM_APP_SCHEMA_ID;

/* TODO: this matches on schema id suffix / display name because DIAL Core
   does not yet expose a stable capability/type field for schemas. Replace
   with a proper identifier once one is available — don't keep relying on
   schema id or display name string matching. */
export const isQuickAppSchema = (schema?: QuickAppSchemaLike): boolean =>
  !!schema &&
  (!!schema.id?.endsWith('quickapps2') ||
    schema.displayName === 'Quick app 2.0');
