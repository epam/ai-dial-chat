import {
  ACCEPTED_RESOURCE_VERSIONS,
  ACCEPTED_STORED_RESOURCE_VERSIONS,
  REJECTED_RESOURCE_VERSIONS,
  REJECTED_STORED_RESOURCE_VERSIONS,
} from './resource-version.corpus';
import {
  RESOURCE_VERSION_PATTERN,
  STORED_RESOURCE_VERSION_PATTERN,
} from './resource-version.pattern';

describe('RESOURCE_VERSION_PATTERN', () => {
  it.each(ACCEPTED_RESOURCE_VERSIONS)('accepts %s', (version) => {
    expect(RESOURCE_VERSION_PATTERN.test(version)).toBe(true);
  });

  it.each(REJECTED_RESOURCE_VERSIONS)('rejects "%s"', (version) => {
    expect(RESOURCE_VERSION_PATTERN.test(version)).toBe(false);
  });
});

describe('STORED_RESOURCE_VERSION_PATTERN', () => {
  it.each(ACCEPTED_STORED_RESOURCE_VERSIONS)('accepts %s', (version) => {
    expect(STORED_RESOURCE_VERSION_PATTERN.test(version)).toBe(true);
  });

  it.each(REJECTED_STORED_RESOURCE_VERSIONS)('rejects "%s"', (version) => {
    expect(STORED_RESOURCE_VERSION_PATTERN.test(version)).toBe(false);
  });

  it.each(ACCEPTED_RESOURCE_VERSIONS)(
    'accepts %s, which the strict rule accepts',
    (version) => {
      expect(STORED_RESOURCE_VERSION_PATTERN.test(version)).toBe(true);
    },
  );
});
