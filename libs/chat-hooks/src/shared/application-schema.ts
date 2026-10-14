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

const MIND_MAP_SCHEMA_TOKEN = 'mindmap';

const normalizeSchemaToken = (value?: string): string =>
  value?.toLocaleLowerCase().replace(/[^a-z0-9]/g, '') ?? '';

/*
 * TODO: like `isQuickAppSchema`, this matches on schema id / display name
 * because DIAL Core does not yet expose a stable capability/type field.
 */
/** True when `schema` is the Mind Map schema (its id or display name contains "mind map", ignoring case and separators). */
export const isMindMapSchema = (schema?: QuickAppSchemaLike): boolean =>
  !!schema &&
  (normalizeSchemaToken(schema.id).includes(MIND_MAP_SCHEMA_TOKEN) ||
    normalizeSchemaToken(schema.displayName).includes(MIND_MAP_SCHEMA_TOKEN));

/** An application schema with a resolved id, as returned by {@link getRunnerSchemas}. */
export type RunnerSchema<T extends QuickAppSchemaLike> = T & { id: string };

/** Returns the schemas that create schema-based apps: unique by id, without id-less entries or the custom-app schema. */
export const getRunnerSchemas = <T extends QuickAppSchemaLike>(
  schemas: T[],
): RunnerSchema<T>[] => {
  const seenIds = new Set<string>();
  return schemas.filter((schema): schema is RunnerSchema<T> => {
    if (!schema.id || isCustomAppSchema(schema) || seenIds.has(schema.id)) {
      return false;
    }
    seenIds.add(schema.id);
    return true;
  });
};
