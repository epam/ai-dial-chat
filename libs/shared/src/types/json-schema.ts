export enum JSONSchemaPropertyType {
  array = 'array',
  number = 'number',
  type = 'integer',
  string = 'string',
  boolean = 'boolean',
}

export interface JSONSchemaPropertyBase {
  type: JSONSchemaPropertyType;

  title?: string;
  description?: string;
}

export interface JSONSchemaBase<T = JSONSchemaPropertyBase> {
  type: 'object';
  properties: Record<string, T>;
  required?: string[];
}
