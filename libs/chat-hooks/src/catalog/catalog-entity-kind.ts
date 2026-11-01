import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import {
  isQuickAppSchema,
  type QuickAppSchemaLike,
} from '../shared/application-schema';

/** What a catalog item is, with an `Agent` item narrowed by its application schema. */
export enum CatalogEntityKind {
  /** A model deployment. */
  Model = 'model',
  /** An application whose kind cannot be told: unknown deployment, or a schema that is not loaded. */
  Agent = 'agent',
  /** An application of the QuickApp schema. */
  QuickApp = 'quickApp',
  /** An application of another known schema, named by that schema's display name. */
  SchemaApp = 'schemaApp',
  /** An application with no schema. */
  CustomApp = 'customApp',
  /** A toolset. */
  Toolset = 'toolset',
  /** A skill. */
  Skill = 'skill',
  /** A prompt. */
  Prompt = 'prompt',
}

/** Minimal deployment shape needed to tell the kind of an `Agent` catalog item. */
export interface CatalogEntityKindDeployment {
  /** Id of the application schema driving the application; absent or `null` for a custom app. */
  applicationTypeSchemaId?: string | null;
}

const CATALOG_TYPE_TO_KIND: Record<CatalogEntityType, CatalogEntityKind> = {
  [CatalogEntityType.Model]: CatalogEntityKind.Model,
  [CatalogEntityType.Agent]: CatalogEntityKind.Agent,
  [CatalogEntityType.Toolset]: CatalogEntityKind.Toolset,
  [CatalogEntityType.Skill]: CatalogEntityKind.Skill,
  [CatalogEntityType.Prompt]: CatalogEntityKind.Prompt,
};

/** Returns the display name of the schema with `schemaId`, or `undefined` when it is not in `schemas` or has none. */
export const findSchemaDisplayName = (
  schemas: QuickAppSchemaLike[],
  schemaId: string | null | undefined,
): string | undefined =>
  schemaId
    ? schemas.find((schema) => schema.id === schemaId)?.displayName
    : undefined;

/** Returns the kind of a catalog item, telling a quick, schema or custom app apart by its deployment's schema. */
export const resolveCatalogEntityKind = (
  type: CatalogEntityType,
  deployment?: CatalogEntityKindDeployment,
  schemas: QuickAppSchemaLike[] = [],
): CatalogEntityKind => {
  if (type !== CatalogEntityType.Agent) return CATALOG_TYPE_TO_KIND[type];
  /* Unknown deployment: report the generic kind rather than guess. */
  if (deployment == null) return CatalogEntityKind.Agent;
  const schemaId = deployment.applicationTypeSchemaId;
  if (!schemaId) return CatalogEntityKind.CustomApp;
  // The full schema, so a QuickApp schema matched only by its display name gets the same kind as in the editor.
  const schema = schemas.find((item) => item.id === schemaId) ?? {
    id: schemaId,
  };
  if (isQuickAppSchema(schema)) return CatalogEntityKind.QuickApp;
  return schema.displayName
    ? CatalogEntityKind.SchemaApp
    : CatalogEntityKind.Agent;
};
