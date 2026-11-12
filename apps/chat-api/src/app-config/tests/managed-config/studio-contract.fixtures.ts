import Ajv2020 from 'ajv/dist/2020';
import { SCHEMA_VERSION_PATTERN } from '../../managed-config/managed-config-artifact';

/*
 * Config Studio's schema checks, reproduced from its upload contract so the
 * artifact is proven acceptable without a running Studio. Studio validates
 * with Ajv 2020 and these options: unknown keywords are annotations and
 * `format` is not enforced.
 */
export const STUDIO_AJV_OPTIONS = {
  strict: false,
  allErrors: true,
  validateFormats: false,
} as const;

export const JSON_SCHEMA_2020_12 =
  'https://json-schema.org/draft/2020-12/schema';

export const createStudioAjv = (): Ajv2020 => new Ajv2020(STUDIO_AJV_OPTIONS);

const collectViolations = (
  node: unknown,
  pointer: string,
  violations: string[],
): void => {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((item, index) =>
      collectViolations(item, `${pointer}/${index}`, violations),
    );
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    const childPointer = `${pointer}/${key}`;
    if (
      (key === '$ref' || key === '$dynamicRef') &&
      !(typeof value === 'string' && value.startsWith('#'))
    ) {
      violations.push(`${childPointer}: external reference`);
    }
    if (key === '$id' && pointer !== '') {
      violations.push(`${childPointer}: nested $id`);
    }
    collectViolations(value, childPointer, violations);
  }
};

/**
 * Studio's structural rules: an object root, a 2020-12 `$schema` when one is
 * declared, references only inside the document, and no nested `$id`.
 * Returns one message per violation.
 */
export const findStudioStructuralViolations = (schema: unknown): string[] => {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    return ['schema is not an object'];
  }
  const root = schema as Record<string, unknown>;
  const violations: string[] = [];
  if (root['type'] !== 'object') {
    violations.push('root type is not object');
  }
  if ('$schema' in root && root['$schema'] !== JSON_SCHEMA_2020_12) {
    violations.push('$schema is not draft 2020-12');
  }
  collectViolations(schema, '', violations);
  return violations;
};

/** Studio's checks on the upload body fields other than the schema. */
export const findStudioUploadViolations = (
  body: Readonly<Record<string, unknown>>,
  instanceAppId: string,
): string[] => {
  const violations: string[] = [];
  if (body['appId'] !== instanceAppId) {
    violations.push('appId differs from the instance');
  }
  if (
    typeof body['schemaVersion'] !== 'string' ||
    !SCHEMA_VERSION_PATTERN.test(body['schemaVersion'])
  ) {
    violations.push('schemaVersion is not MAJOR.MINOR.PATCH');
  }
  return [...violations, ...findStudioStructuralViolations(body['schema'])];
};
