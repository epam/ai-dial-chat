/**
 * Non-enumerable property of the validated environment that holds the names
 * present in the raw input. Non-enumerable, so Nest's ConfigModule never copies
 * it into `process.env`; it is read back through `ConfigService.get`.
 */
export const EXPLICIT_ENVIRONMENT_PROPERTY = '__explicitEnvironment';

const READ_ONLY_SET_METHODS = ['add', 'delete', 'clear'] as const;

const toReadOnlySet = (names: Iterable<string>): ReadonlySet<string> => {
  const frozen = new Set(names);
  for (const method of READ_ONLY_SET_METHODS) {
    Object.defineProperty(frozen, method, {
      value: () => {
        throw new TypeError('The explicit environment is read-only');
      },
    });
  }
  return Object.freeze(frozen);
};

/**
 * Returns the names of the variables an operator actually set: every entry of
 * the raw environment (process variables merged with loaded `.env` files)
 * whose value is defined, before class initializers apply. An empty string
 * counts as set. The returned set cannot be modified.
 */
export const collectExplicitEnvironment = (
  raw: Readonly<Record<string, unknown>>,
): ReadonlySet<string> =>
  toReadOnlySet(Object.keys(raw).filter((name) => raw[name] !== undefined));

/**
 * Stores the explicit names on the validated environment object returned by
 * `validate()`, as the non-enumerable `EXPLICIT_ENVIRONMENT_PROPERTY`.
 */
export const attachExplicitEnvironment = <T extends object>(
  validated: T,
  names: ReadonlySet<string>,
): T =>
  Object.defineProperty(validated, EXPLICIT_ENVIRONMENT_PROPERTY, {
    value: names,
    enumerable: false,
    writable: false,
    configurable: false,
  });

const isStringSet = (value: unknown): value is ReadonlySet<string> =>
  value instanceof Set &&
  [...(value as Set<unknown>)].every((name) => typeof name === 'string');

/**
 * The part of Nest's `ConfigService` presence capture reads, whatever its
 * environment type parameter.
 */
export interface ConfigValueReader {
  get(propertyPath: string): unknown;
}

/**
 * Tells an explicitly set environment variable apart from one that only has a
 * typed default. Providers inject it instead of reading `process.env`, which
 * Nest's ConfigModule fills with those defaults after validation.
 */
export class ExplicitEnvironment {
  private constructor(private readonly test: (name: string) => boolean) {}

  /** An environment in which exactly `names` are set. */
  static of(names: Iterable<string>): ExplicitEnvironment {
    const set = toReadOnlySet(names);
    return new ExplicitEnvironment((name) => set.has(name));
  }

  /**
   * Reads the names `validate()` captured. A ConfigModule configured without
   * `validate()` applies no typed defaults, so there every value
   * `ConfigService` holds was set explicitly and counts as such.
   */
  static fromConfigService(
    configService: ConfigValueReader,
  ): ExplicitEnvironment {
    const captured: unknown = configService.get(EXPLICIT_ENVIRONMENT_PROPERTY);
    if (isStringSet(captured)) {
      return new ExplicitEnvironment((name) => captured.has(name));
    }
    return new ExplicitEnvironment(
      (name) => configService.get(name) !== undefined,
    );
  }

  /** Whether `name` was present in the raw environment. */
  isExplicit(name: string): boolean {
    return this.test(name);
  }
}
