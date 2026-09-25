import { render, screen } from '@testing-library/react';
import type { FC } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../types/routes';
import { SettingsTabs } from '../../types/settings-tabs';
import { buildSettingsTabPath } from '../../utils/routes';
import { renderSettingsRoutes } from '../settings-routes';

const SETTINGS_MARKER = 'settings-page';
const ROOT_MARKER = 'root-page';
const LOCATION_LABEL = 'location';

/*
 * The real page pulls in the whole settings shell and its contexts, none of
 * which this suite is about: it covers which paths resolve, and whether the
 * feature gate sends them to the root instead.
 */
vi.mock('../../pages/SettingsPage/SettingsPage', () => ({
  default: () => <span>{SETTINGS_MARKER}</span>,
}));

const LocationProbe: FC = () => (
  <span data-location={useLocation().pathname}>{LOCATION_LABEL}</span>
);

const renderAt = (initialPath: string, isSettingsPageHidden: boolean) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LocationProbe />
      <Routes>
        <Route path={ROUTES.Root} element={<span>{ROOT_MARKER}</span>} />
        {renderSettingsRoutes(isSettingsPageHidden)}
      </Routes>
    </MemoryRouter>,
  );

const currentPath = () =>
  screen.getByText(LOCATION_LABEL).getAttribute('data-location');

const settingsPaths = [
  ROUTES.Settings,
  buildSettingsTabPath(SettingsTabs.Usage),
  buildSettingsTabPath(SettingsTabs.Preferences),
];

describe('renderSettingsRoutes', () => {
  describe('with the settings page available', () => {
    it.each(settingsPaths)('mounts the settings shell at %s', async (path) => {
      renderAt(path, false);

      expect(await screen.findByText(SETTINGS_MARKER)).toBeTruthy();
    });

    /* Two registrations cover every tab: the bare path and one dynamic
       pattern. A per-tab route would make adding a tab a routing change. */
    it('covers every tab with a single dynamic pattern', () => {
      expect(
        renderSettingsRoutes(false).map((route) => route.props.path),
      ).toEqual([ROUTES.Settings, ROUTES.SettingsTab]);
    });
  });

  describe('with the settings page hidden', () => {
    it.each(settingsPaths)('redirects %s to the root', (path) => {
      renderAt(path, true);

      expect(screen.getByText(ROOT_MARKER)).toBeTruthy();
      expect(currentPath()).toBe(ROUTES.Root);
    });

    it.each(settingsPaths)('never mounts the shell at %s', (path) => {
      renderAt(path, true);

      expect(screen.queryByText(SETTINGS_MARKER)).toBeNull();
    });
  });
});
