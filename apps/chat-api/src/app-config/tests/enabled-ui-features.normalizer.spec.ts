import { describe, expect, it } from 'vitest';
import { normalizeEnabledUiFeatures } from '../enabled-ui-features.normalizer';
import {
  DEPRECATED_UI_FEATURE_ALIASES,
  KNOWN_UI_FEATURES,
} from '../known-ui-features.constants';

const makeWarnCollector = () => {
  const warnings: string[] = [];
  return { warnings, warn: (message: string) => warnings.push(message) };
};

describe('normalizeEnabledUiFeatures', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a non-array value', 'not-an-array'],
    ['an empty array', []],
  ])('returns null with no warning for %s', (_label, value) => {
    const { warnings, warn } = makeWarnCollector();

    const result = normalizeEnabledUiFeatures(value, warn);

    expect(result).toBeNull();
    expect(warnings).toEqual([]);
  });

  it('keeps recognized entries in their input order without warning', () => {
    const { warnings, warn } = makeWarnCollector();

    const result = normalizeEnabledUiFeatures(
      ['likes', 'header', 'prompts'],
      warn,
    );

    expect(result).toEqual(['likes', 'header', 'prompts']);
    expect(warnings).toEqual([]);
  });

  it('resolves a deprecated alias to its replacement with an exact deprecation warning', () => {
    const { warnings, warn } = makeWarnCollector();

    const result = normalizeEnabledUiFeatures(
      ['likes', 'custom-applications'],
      warn,
    );

    expect(result).toEqual(['likes', 'schema-apps']);
    expect(warnings).toEqual([
      'ENABLED_UI_FEATURES entry "custom-applications" is deprecated; using "schema-apps" instead',
    ]);
  });

  it('collapses a deprecated alias and its canonical name to the first occurrence', () => {
    const { warn } = makeWarnCollector();

    const result = normalizeEnabledUiFeatures(
      ['schema-apps', 'custom-applications'],
      warn,
    );

    expect(result).toEqual(['schema-apps']);
  });

  it('filters unrecognized entries while keeping known ones, warning once per drop', () => {
    const { warnings, warn } = makeWarnCollector();

    const result = normalizeEnabledUiFeatures(
      ['likes', 'not-a-real-feature'],
      warn,
    );

    expect(result).toEqual(['likes']);
    expect(warnings).toEqual([
      'Ignoring unrecognized ENABLED_UI_FEATURES entry: "not-a-real-feature"',
    ]);
  });

  it('falls back to null with an additional warning when every entry is unrecognized', () => {
    const { warnings, warn } = makeWarnCollector();

    const result = normalizeEnabledUiFeatures(['totally-invalid'], warn);

    expect(result).toBeNull();
    expect(warnings).toEqual([
      'Ignoring unrecognized ENABLED_UI_FEATURES entry: "totally-invalid"',
      'ENABLED_UI_FEATURES contained only unrecognized entries; falling back to compiled-in defaults',
    ]);
  });

  it('warns once per occurrence, in input order, for a repeated unrecognized entry', () => {
    const { warnings, warn } = makeWarnCollector();

    const result = normalizeEnabledUiFeatures(
      ['bogus', 'likes', 'bogus'],
      warn,
    );

    expect(result).toEqual(['likes']);
    expect(warnings).toEqual([
      'Ignoring unrecognized ENABLED_UI_FEATURES entry: "bogus"',
      'Ignoring unrecognized ENABLED_UI_FEATURES entry: "bogus"',
    ]);
  });

  it('warns once per occurrence, in input order, for a repeated deprecated alias', () => {
    const { warnings, warn } = makeWarnCollector();

    const result = normalizeEnabledUiFeatures(
      ['custom-applications', 'custom-applications'],
      warn,
    );

    expect(result).toEqual(['schema-apps']);
    expect(warnings).toEqual([
      'ENABLED_UI_FEATURES entry "custom-applications" is deprecated; using "schema-apps" instead',
      'ENABLED_UI_FEATURES entry "custom-applications" is deprecated; using "schema-apps" instead',
    ]);
  });

  it('coerces a non-string entry with String() before reporting it', () => {
    const { warnings, warn } = makeWarnCollector();

    const result = normalizeEnabledUiFeatures([42], warn);

    expect(result).toBeNull();
    expect(warnings).toEqual([
      'Ignoring unrecognized ENABLED_UI_FEATURES entry: "42"',
      'ENABLED_UI_FEATURES contained only unrecognized entries; falling back to compiled-in defaults',
    ]);
  });

  it('does not mutate its input array or the allowlist/alias constants', () => {
    const { warn } = makeWarnCollector();
    const input = ['likes', 'custom-applications', 'not-a-real-feature'];
    const inputSnapshot = [...input];
    const knownFeaturesSizeBefore = KNOWN_UI_FEATURES.size;
    const aliasesSnapshot = { ...DEPRECATED_UI_FEATURE_ALIASES };

    normalizeEnabledUiFeatures(input, warn);

    expect(input).toEqual(inputSnapshot);
    expect(KNOWN_UI_FEATURES.size).toBe(knownFeaturesSizeBefore);
    expect(DEPRECATED_UI_FEATURE_ALIASES).toEqual(aliasesSnapshot);
  });
});
