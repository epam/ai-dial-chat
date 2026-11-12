import {
  ACCEPTED_RESOURCE_VERSIONS,
  REJECTED_RESOURCE_VERSIONS,
} from './resource-version.corpus';
import { RESOURCE_VERSION_PATTERN } from './resource-version.pattern';

describe('RESOURCE_VERSION_PATTERN', () => {
  it.each(ACCEPTED_RESOURCE_VERSIONS)('accepts %s', (version) => {
    expect(RESOURCE_VERSION_PATTERN.test(version)).toBe(true);
  });

  it.each(REJECTED_RESOURCE_VERSIONS)('rejects "%s"', (version) => {
    expect(RESOURCE_VERSION_PATTERN.test(version)).toBe(false);
  });
});
