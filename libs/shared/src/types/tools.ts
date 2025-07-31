import { JSONSchemaBase, JSONSchemaPropertyBase } from './json-schema';

export interface ToolSchemaProperty extends JSONSchemaPropertyBase {
  default?: unknown;
}

export type ToolSchema = JSONSchemaBase<ToolSchemaProperty>;

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface Tool {
  name: string;
  title?: string;
  description?: string;

  inputSchema: ToolSchema;
  outputSchema?: ToolSchema;
  annotations?: ToolAnnotations;

  _meta?: Record<string, unknown>;
}
