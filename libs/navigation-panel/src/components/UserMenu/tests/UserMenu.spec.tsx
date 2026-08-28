import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { NavigationMenuGroup } from '../../../models/navigation-menu';
import type { NavigationUserProfile } from '../../../models/user-profile';
import { UserMenu } from '../UserMenu';

interface MockDropdownItem {
  key: string;
  label?: ReactNode;
  onClick?: () => void;
  children?: MockDropdownItem[];
}

/* The real Dropdown renders its items in a floating overlay on open; the mock
   renders them inline so assertions stay about content, not positioning. */
vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16 },
  DropdownItemType: { PlainText: 'plainText', Divider: 'divider' },
  Tooltip: ({ children }: { children: ReactNode }) => children,
  EllipsisTooltip: ({ text }: { text: ReactNode }) => <span>{text}</span>,
  Dropdown: ({
    children,
    items,
  }: {
    children: ReactNode;
    items: MockDropdownItem[];
  }) => (
    <>
      {children}
      <ul>
        {items.map(({ children: subItems, ...item }) => (
          <li key={item.key}>
            <button type="button" onClick={item.onClick}>
              {item.label}
            </button>
            {subItems && (
              <ul>
                {subItems.map((child) => (
                  <li key={child.key}>
                    <button type="button" onClick={child.onClick}>
                      {child.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </>
  ),
}));

const labels = {
  trigger: 'Signed in as john.doe@example.com',
  avatarAlt: 'User avatar',
  logOut: 'Log out',
};

const profile: NavigationUserProfile = {
  email: 'john.doe@example.com',
  displayName: 'John Doe',
  shortName: 'JD',
};

describe('UserMenu', () => {
  it('labels the avatar trigger', () => {
    render(<UserMenu profile={profile} labels={labels} onLogout={vi.fn()} />);
    expect(screen.getByRole('button', { name: labels.trigger })).toBeTruthy();
  });

  it('renders the avatar image when an image URL is supplied', () => {
    render(
      <UserMenu
        profile={{ ...profile, imageUrl: 'https://example.com/a.png' }}
        labels={labels}
        onLogout={vi.fn()}
      />,
    );
    const avatar = screen.getByRole('img', { name: labels.avatarAlt });
    expect(avatar.getAttribute('src')).toBe('https://example.com/a.png');
  });

  it('falls back to initials when no image URL is supplied', () => {
    render(<UserMenu profile={profile} labels={labels} onLogout={vi.fn()} />);
    expect(screen.queryByRole('img', { name: labels.avatarAlt })).toBeNull();
    expect(screen.getAllByText('JD').length).toBeGreaterThan(0);
  });

  it('reports a broken avatar image through onImageError', () => {
    const onImageError = vi.fn();
    render(
      <UserMenu
        profile={{
          ...profile,
          imageUrl: 'https://example.com/broken.png',
          onImageError,
        }}
        labels={labels}
        onLogout={vi.fn()}
      />,
    );
    fireEvent.error(screen.getByRole('img', { name: labels.avatarAlt }));
    expect(onImageError).toHaveBeenCalledOnce();
  });

  it('renders each settings group with its options', () => {
    const groups: NavigationMenuGroup[] = [
      {
        id: 'language',
        label: 'Language',
        options: [
          { id: 'en', label: 'English', isActive: true, onSelect: vi.fn() },
          { id: 'de', label: 'Deutsch', isActive: false, onSelect: vi.fn() },
        ],
      },
    ];
    render(
      <UserMenu
        profile={profile}
        labels={labels}
        groups={groups}
        onLogout={vi.fn()}
      />,
    );
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('Deutsch')).toBeTruthy();
  });

  it('applies an option through its onSelect callback', () => {
    const onSelect = vi.fn();
    render(
      <UserMenu
        profile={profile}
        labels={labels}
        groups={[
          {
            id: 'language',
            label: 'Language',
            options: [
              { id: 'de', label: 'Deutsch', isActive: false, onSelect },
            ],
          },
        ]}
        onLogout={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Deutsch'));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('skips groups that have no options', () => {
    render(
      <UserMenu
        profile={profile}
        labels={labels}
        groups={[{ id: 'language', label: 'Language', options: [] }]}
        onLogout={vi.fn()}
      />,
    );
    expect(screen.queryByText('Language')).toBeNull();
  });

  it('calls onLogout when the log-out entry is clicked', () => {
    const onLogout = vi.fn();
    render(<UserMenu profile={profile} labels={labels} onLogout={onLogout} />);
    fireEvent.click(screen.getByText(labels.logOut));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('renders a settings entry when onSettings is provided', () => {
    render(
      <UserMenu
        profile={profile}
        labels={{ ...labels, settings: 'Settings' }}
        onLogout={vi.fn()}
        onSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('does not render a settings entry when onSettings is omitted', () => {
    render(<UserMenu profile={profile} labels={labels} onLogout={vi.fn()} />);
    expect(screen.queryByText('Settings')).toBeNull();
  });

  it('calls onSettings when the settings entry is clicked', () => {
    const onSettings = vi.fn();
    render(
      <UserMenu
        profile={profile}
        labels={{ ...labels, settings: 'Settings' }}
        onLogout={vi.fn()}
        onSettings={onSettings}
      />,
    );
    fireEvent.click(screen.getByText('Settings'));
    expect(onSettings).toHaveBeenCalledOnce();
  });
});
