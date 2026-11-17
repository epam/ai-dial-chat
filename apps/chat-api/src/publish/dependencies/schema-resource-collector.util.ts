import { safeDecodeURIComponent } from '../../common/utils/uri';
import { normalizeResourceUrl } from './publish-dependency.util';

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

/** Called with each string held by a `dial:resource` property; returns what to keep in its place. */
type ResourceVisitor = (resource: string) => string;

/**
 * Walks the schema alongside the value and returns the value with each string
 * on a `dial:resource` property passed through `visit`. Objects and arrays are
 * rebuilt only where something changed, and the input is never mutated, so the
 * values read by {@link collectSchemaResources} and the values written by
 * {@link replaceSchemaResources} come from one walk and cannot drift apart.
 */
const walk = (
  root: JsonObject,
  schemaNode: unknown,
  input: unknown,
  visit: ResourceVisitor,
  depth: number,
): unknown => {
  if (!isRecord(schemaNode) || input == null || depth > MAX_WALK_DEPTH) {
    return input;
  }
  const node = resolveRef(root, schemaNode);

  if (
    (schemaNode[DIAL_RESOURCE_KEYWORD] === true ||
      node[DIAL_RESOURCE_KEYWORD] === true) &&
    typeof input === 'string' &&
    input !== ''
  ) {
    return visit(input);
  }

  let value: unknown = input;

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
      value = walk(root, resolved, value, visit, depth + 1);
    }
  }

  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((item) => {
      const next = walk(root, node.items, item, visit, depth + 1);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? items : value;
  }
  if (!isRecord(value)) return value;

  const properties = isRecord(node.properties) ? node.properties : {};
  let result = value;
  const set = (key: string, next: unknown) => {
    if (next === result[key]) return;
    if (result === value) result = { ...value };
    result[key] = next;
  };
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (key in value) {
      set(key, walk(root, propertySchema, value[key], visit, depth + 1));
    }
  }
  if (isRecord(node.additionalProperties)) {
    for (const [key, item] of Object.entries(value)) {
      if (!(key in properties)) {
        set(key, walk(root, node.additionalProperties, item, visit, depth + 1));
      }
    }
  }
  return result;
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
  walk(
    schema,
    schema,
    value,
    (resource) => {
      found.push(resource);
      return resource;
    },
    0,
  );
  return found;
};

/**
 * Returns `value` with every string on a `dial:resource` property that names a
 * key of `replacements` swapped for that key's replacement, using the same
 * walk as {@link collectSchemaResources}. A stored reference may carry a
 * `?query`, a `#fragment` or the legacy `metadata/` prefix, which the resolver
 * strips from the dependency id; matching strips them the same way and
 * compares the percent-decoded forms. Replacements are written exactly as
 * given, so they must already be in the percent-encoded form Core receives:
 * Core parses references leniently and silently drops one it cannot parse.
 * `value` is never mutated.
 * @param schema - the application type's JSON schema
 * @param value - the application's `application_properties`
 * @param replacements - dependency id (as listed by the resolver) to the url that replaces it
 */
export const replaceSchemaResources = (
  schema: JsonObject,
  value: unknown,
  replacements: ReadonlyMap<string, string>,
): unknown => {
  const byDecodedId = new Map(
    [...replacements].map(([id, replacement]) => [
      safeDecodeURIComponent(id),
      replacement,
    ]),
  );
  return walk(
    schema,
    schema,
    value,
    (resource) =>
      byDecodedId.get(safeDecodeURIComponent(normalizeResourceUrl(resource))) ??
      resource,
    0,
  );
};
