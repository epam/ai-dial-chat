type JsonObject = Record<string, unknown>;

/** JSON Schema keyword DIAL Core reads to mark a property whose value is a DIAL resource reference. */
const DIAL_RESOURCE_KEYWORD = 'dial:resource';

/** Bounds a walk through a recursive `$ref` that no property of the value consumes. */
const MAX_WALK_DEPTH = 50;

const isRecord = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Follows a local `$ref` (`#/$defs/Name` or `#/definitions/Name`) to its
 * definition. Anything else, including a node without a `$ref`, comes back
 * unchanged.
 * @param root - the whole schema
 * @param node - a schema node that may carry a `$ref`
 */
const resolveRef = (root: JsonObject, node: JsonObject): JsonObject => {
  const ref = node.$ref;
  if (typeof ref !== 'string') return node;
  const match = /^#\/(\$defs|definitions)\/(.+)$/.exec(ref);
  if (match == null) return node;
  const definitions = root[match[1]];
  const resolved = isRecord(definitions) ? definitions[match[2]] : undefined;
  return isRecord(resolved) ? resolved : node;
};

/**
 * Whether a `oneOf` / `anyOf` branch can describe `value`: a branch that pins
 * `properties.type` to a const accepts only a value carrying that `type`.
 * @param branch - a resolved branch schema
 * @param value - the object being walked
 */
const branchAccepts = (branch: JsonObject, value: JsonObject): boolean => {
  const properties = branch.properties;
  if (!isRecord(properties)) return true;
  const typeSchema = properties.type;
  if (!isRecord(typeSchema) || !('const' in typeSchema)) return true;
  return typeSchema.const === value.type;
};

const walk = (
  root: JsonObject,
  schemaNode: unknown,
  value: unknown,
  found: string[],
  depth: number,
): void => {
  if (!isRecord(schemaNode) || value == null || depth > MAX_WALK_DEPTH) return;
  const node = resolveRef(root, schemaNode);

  if (
    (schemaNode[DIAL_RESOURCE_KEYWORD] === true ||
      node[DIAL_RESOURCE_KEYWORD] === true) &&
    typeof value === 'string' &&
    value !== ''
  ) {
    found.push(value);
    return;
  }

  /*
   * Composition applies to every kind of value: an optional list or string
   * is `anyOf: [<the type>, null]`, so the array or the marked string sits one
   * level down, inside a branch.
   */
  for (const keyword of ['oneOf', 'anyOf', 'allOf']) {
    const branches = node[keyword];
    if (!Array.isArray(branches)) continue;
    for (const branch of branches) {
      if (!isRecord(branch)) continue;
      const resolved = resolveRef(root, branch);
      if (
        keyword !== 'allOf' &&
        isRecord(value) &&
        !branchAccepts(resolved, value)
      ) {
        continue;
      }
      walk(root, resolved, value, found, depth + 1);
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) walk(root, node.items, item, found, depth + 1);
    return;
  }
  if (!isRecord(value)) return;

  const properties = isRecord(node.properties) ? node.properties : {};
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (key in value) {
      walk(root, propertySchema, value[key], found, depth + 1);
    }
  }
  if (isRecord(node.additionalProperties)) {
    for (const [key, item] of Object.entries(value)) {
      if (!(key in properties)) {
        walk(root, node.additionalProperties, item, found, depth + 1);
      }
    }
  }
};

/**
 * Collects every string held by a property that the application's schema
 * marks `dial:resource`, the same marker DIAL Core reads to find the prompts,
 * skills and deployments an application refers to. Walks the schema alongside
 * the value, following `$ref`, `oneOf` / `anyOf` branches chosen by the
 * discriminating `type`, arrays and nested objects. A `dial:file` property is
 * not collected: DIAL Core copies those files with the application.
 * @param schema - the application type's JSON schema
 * @param value - the application's `application_properties`
 */
export const collectSchemaResources = (
  schema: JsonObject,
  value: unknown,
): string[] => {
  const found: string[] = [];
  walk(schema, schema, value, found, 0);
  return found;
};
