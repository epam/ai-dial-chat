import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { NavigationPanelItem } from '../../../models/navigation-item';
import type { NavigationSheetLabels } from '../../../models/navigation-sheet-props';
import type { NavigationUserProfile } from '../../../models/user-profile';
import { NavigationSheet } from '../NavigationSheet';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  BASE_ICON_SIZE: 20,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Standard: 'standard' },
  EllipsisTooltip: ({ text }: { text: string }) => <span>{text}</span>,
  GhostIconButton: ({
    'aria-label': ariaLabel,
    onClick,
  }: {
    'aria-label': string;
    onClick?: () => void;
  }) => <button type="button" aria-label={ariaLabel} onClick={onClick} />,
  CloseButton: ({
    ariaLabel,
    onClose,
  }: {
    ariaLabel: string;
    onClose: () => void;
  }) => <button type="button" aria-label={ariaLabel} onClick={onClose} />,
}));

const HomeIcon = () => <svg />;
const CatalogIcon = () => <svg />;

const items: NavigationPanelItem[] = [
  { id: '/', label: 'Home', icon: HomeIcon },
  { id: '/catalog', label: 'Catalog', icon: CatalogIcon },
];

const labels: NavigationSheetLabels = {
  title: 'Menu',
  close: 'Close',
  back: 'Back',
  profile: 'Profile',
  logOut: 'Log out',
};

const profile: NavigationUserProfile = {
  email: 'john.doe@example.com',
  displayName: 'John Doe',
  shortName: 'JD',
};

const renderSheet = (overrides: Record<string, unknown> = {}) =>
  render(
    <NavigationSheet
      isOpen
      onClose={vi.fn()}
      items={items}
      onSelectItem={vi.fn()}
      labels={labels}
      profile={profile}
      onLogout={vi.fn()}
      {...overrides}
    />,
  );

describe('NavigationSheet', () => {
  it('renders nothing while closed', () => {
    const { container } = renderSheet({ isOpen: false });
    expect(container.innerHTML).toBe('');
  });

  it('lists every destination on the root page', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Catalog' })).toBeTruthy();
  });

  it('closes the sheet and reports the picked destination', async () => {
    const onClose = vi.fn();
    const onSelectItem = vi.fn();
    const user = userEvent.setup();
    renderSheet({ onClose, onSelectItem });

    await user.click(screen.getByRole('button', { name: 'Catalog' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSelectItem).toHaveBeenCalledWith(items[1]);
  });

  it('omits the profile row when no profile is supplied', () => {
    renderSheet({ profile: undefined });
    expect(screen.queryByRole('button', { name: 'Profile' })).toBeNull();
  });

  it('opens the profile page showing the display name and log-out row', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole('button', { name: 'Profile' }));
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
  });

  it('closes the sheet and requests log-out from the profile page', async () => {
    const onClose = vi.fn();
    const onLogout = vi.fn();
    const user = userEvent.setup();
    renderSheet({ onClose, onLogout });

    await user.click(screen.getByRole('button', { name: 'Profile' }));
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('drills into a settings group and applies the chosen option', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderSheet({
      groups: [
        {
          id: 'keyboard-shortcuts',
          label: 'Keyboard shortcuts',
          options: [
            { id: 'enter', label: 'Enter', isActive: true, onSelect: vi.fn() },
            {
              id: 'meta-enter',
              label: 'Cmd + Enter',
              isActive: false,
              onSelect,
            },
          ],
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Profile' }));
    await user.click(
      screen.getByRole('button', { name: 'Keyboard shortcuts' }),
    );
    await user.click(screen.getByRole('button', { name: 'Cmd + Enter' }));

    expect(onSelect).toHaveBeenCalledOnce();
    /* Applying an option pops back to the profile page. */
    expect(
      screen.getByRole('button', { name: 'Keyboard shortcuts' }),
    ).toBeTruthy();
  });

  it('hides the settings section when every group is empty', async () => {
    const user = userEvent.setup();
    renderSheet({
      groups: [
        { id: 'keyboard-shortcuts', label: 'Keyboard shortcuts', options: [] },
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Profile' }));
    expect(
      screen.queryByRole('button', { name: 'Keyboard shortcuts' }),
    ).toBeNull();
  });

  it('renders the footer slot on the root page', () => {
    renderSheet({ footer: <span>footer slot</span> });
    expect(screen.getByText('footer slot')).toBeTruthy();
  });
});
