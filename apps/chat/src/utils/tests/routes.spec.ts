import { describe, expect, it } from 'vitest';
import { ROUTES } from '../../types/routes';
import { SettingsTabs } from '../../types/settings-tabs';
import { buildSettingsTabPath } from '../routes';

/** Reads the tab segment back out of a built path, the way the router does. */
const readTabSegment = (path: string): string => {
  const segments = new URL(path, 'https://example.test').pathname.split('/');

  return decodeURIComponent(segments[segments.length - 1]);
};

const allTabs = Object.values(SettingsTabs);

describe('buildSettingsTabPath', () => {
  it('builds a concrete path under the settings route', () => {
    expect(buildSettingsTabPath(SettingsTabs.Usage)).toBe('/settings/usage');
  });

  it('leaves no unsubstituted parameter in the pattern', () => {
    for (const tab of allTabs) {
      expect(buildSettingsTabPath(tab)).not.toContain(':');
    }
  });

  it('stays under the settings route for every tab', () => {
    for (const tab of allTabs) {
      expect(buildSettingsTabPath(tab).startsWith(`${ROUTES.Settings}/`)).toBe(
        true,
      );
    }
  });

  /*
   * The guard that matters: the path is built by substitution, with no
   * encoding, so a future tab id carrying a space or a slash would silently
   * produce a path that does not resolve back to it.
   */
  it.each(allTabs)('round-trips the %s tab through its path', (tab) => {
    expect(readTabSegment(buildSettingsTabPath(tab))).toBe(tab);
  });
});
