import {
  compareSchemaVersions,
  parseSchemaVersion,
} from '../../managed-config/managed-config-artifact';
import { createStudioAjv } from './studio-contract.fixtures';

/*
 * The D8 version-bump rules, checked between two consecutive committed
 * schema versions. They are fixture-based checks of the superset rule, not a
 * proof; review stays responsible for semantics.
 */

/* Keywords that never change which payloads are valid. `$id` embeds the
 * version, so it differs between any two versions. */
const ANNOTATION_KEYWORDS = new Set([
  'title',
  'description',
  'dial:meta',
  'isHidden',
  'default',
  '$id',
]);

/* The policy members of a feature state; adding one is always MAJOR, because
 * a reader that ignores it would silently weaken the policy. */
const FEATURE_POLICY_POINTER = '/$defs/featureState/properties';

const stripAnnotations = (node: unknown, key = ''): unknown => {
  if (Array.isArray(node)) {
    return node.map((item) => stripAnnotations(item, key));
  }
  if (node === null || typeof node !== 'object') {
    return node;
  }
  const entries = Object.entries(node).filter(([name]) => {
    if (key === 'properties') return true;
    if (key === 'dial:semanticConstraints') return name !== 'description';
    return !ANNOTATION_KEYWORDS.has(name);
  });
  return Object.fromEntries(
    entries.map(([name, value]) => [name, stripAnnotations(value, name)]),
  );
};

interface SchemaShape {
  /** JSON pointer of every declared property. */
  readonly properties: ReadonlySet<string>;
  /** JSON pointer of every object node → its required member names. */
  readonly required: ReadonlyMap<string, ReadonlySet<string>>;
}

const collectShape = (schema: unknown): SchemaShape => {
  const properties = new Set<string>();
  const required = new Map<string, ReadonlySet<string>>();
  const walk = (node: unknown, pointer: string): void => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${pointer}/${index}`));
      return;
    }
    const record = node as Record<string, unknown>;
    if (Array.isArray(record['required'])) {
      required.set(pointer, new Set(record['required'] as string[]));
    }
    for (const [name, value] of Object.entries(record)) {
      if (name === 'properties' && value && typeof value === 'object') {
        for (const [property, child] of Object.entries(value)) {
          const childPointer = `${pointer}/properties/${property}`;
          properties.add(childPointer);
          walk(child, childPointer);
        }
      } else {
        walk(value, `${pointer}/${name}`);
      }
    }
  };
  walk(schema, '');
  return { properties, required };
};

export enum VersionBump {
  None = 'none',
  Patch = 'patch',
  Minor = 'minor',
  Major = 'major',
}

export const classifyBump = (previous: string, next: string): VersionBump => {
  const [pMajor, pMinor, pPatch] = parseSchemaVersion(previous);
  const [nMajor, nMinor, nPatch] = parseSchemaVersion(next);
  if (compareSchemaVersions(next, previous) <= 0) return VersionBump.None;
  if (nMajor > pMajor) return VersionBump.Major;
  if (nMinor > pMinor) return VersionBump.Minor;
  return nPatch > pPatch ? VersionBump.Patch : VersionBump.None;
};

export interface VersionedSchema {
  readonly schemaVersion: string;
  readonly schema: object;
}

/**
 * Returns one message per D8 rule that `next` breaks relative to
 * `previous`. `previousValidPayloads` are the previous version's valid
 * contract fixtures.
 */
export const findVersionBumpViolations = (
  previous: VersionedSchema,
  next: VersionedSchema,
  previousValidPayloads: readonly unknown[],
): string[] => {
  const bump = classifyBump(previous.schemaVersion, next.schemaVersion);
  if (bump === VersionBump.None) {
    return [
      `${next.schemaVersion} is not higher than ${previous.schemaVersion}`,
    ];
  }

  const violations: string[] = [];
  const isValidityChanged =
    JSON.stringify(stripAnnotations(previous.schema)) !==
    JSON.stringify(stripAnnotations(next.schema));
  if (isValidityChanged && bump === VersionBump.Patch) {
    violations.push(
      'a change outside annotation keywords needs at least a MINOR bump',
    );
  }

  const before = collectShape(previous.schema);
  const after = collectShape(next.schema);
  const removed = [...before.properties].filter(
    (pointer) => !after.properties.has(pointer),
  );
  const newlyRequired = [...after.required].flatMap(([pointer, names]) => {
    const was = before.required.get(pointer);
    if (!was && !before.properties.has(pointer) && pointer !== '') return [];
    return [...names]
      .filter((name) => !was?.has(name))
      .map((name) => `${pointer}/required/${name}`);
  });
  const addedPolicy = [...after.properties].filter(
    (pointer) =>
      pointer.startsWith(`${FEATURE_POLICY_POINTER}/`) &&
      pointer.split('/').length ===
        FEATURE_POLICY_POINTER.split('/').length + 1 &&
      !before.properties.has(pointer),
  );
  if (bump !== VersionBump.Major) {
    violations.push(
      ...removed.map((pointer) => `removed ${pointer} needs a MAJOR bump`),
      ...newlyRequired.map(
        (pointer) => `newly required ${pointer} needs a MAJOR bump`,
      ),
      ...addedPolicy.map(
        (pointer) => `new feature-policy member ${pointer} needs a MAJOR bump`,
      ),
    );
  }

  if (bump === VersionBump.Minor || bump === VersionBump.Patch) {
    const validate = createStudioAjv().compile(next.schema);
    previousValidPayloads.forEach((payload, index) => {
      if (!validate(payload)) {
        violations.push(
          `previous valid fixture ${index} is rejected under ${next.schemaVersion}`,
        );
      }
    });
  }

  return violations;
};
