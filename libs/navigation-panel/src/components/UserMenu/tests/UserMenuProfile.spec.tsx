import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { NavigationUserProfile } from '../../../models/user-profile';
import { UserMenuTriggerVariant } from '../../../types/user-menu-trigger-variant';
import { UserMenu } from '../UserMenu';

const dropdownProps = vi.hoisted(() => ({
  placement: undefined as string | undefined,
  className: undefined as string | undefined,
  onOpenChange: undefined as ((isOpen: boolean) => void) | undefined,
}));

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const { Avatar, Button } =
    await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    Avatar,
    Button,
    DIAL_KIT_ICON_STROKE: 1.5,
    DIAL_ICON_SIZE: { SM: 16 },
    DropdownItemType: { PlainText: 'plainText', Divider: 'divider' },
    MenuItemMark: { Check: 'check', Highlight: 'highlight' },
    EllipsisTooltip: ({ text }: { text: ReactNode }) => <span>{text}</span>,
    Dropdown: ({
      children,
      className,
      placement,
      onOpenChange,
    }: {
      children: ReactNode;
      className?: string;
      placement?: string;
      onOpenChange?: (isOpen: boolean) => void;
    }) => {
      dropdownProps.placement = placement;
      dropdownProps.className = className;
      dropdownProps.onOpenChange = onOpenChange;
      return <>{children}</>;
    },
  };
});

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

describe('UserMenu — Profile trigger', () => {
  it('lets the profile trigger fill the room its neighbours leave, so a long name truncates', () => {
    render(
      <UserMenu
        profile={profile}
        labels={labels}
        onLogout={vi.fn()}
        triggerVariant={UserMenuTriggerVariant.Profile}
      />,
    );

    /* The wrapper has no role; it is the parent of the trigger button. */
    /* eslint-disable testing-library/no-node-access */
    const wrapper = screen.getByRole('button', {
      name: 'John Doe Signed in as john.doe@example.com',
    }).parentElement;
    /* eslint-enable testing-library/no-node-access */

    expect(wrapper?.classList.contains('flex-1')).toBe(true);
    expect(wrapper?.classList.contains('min-w-0')).toBe(true);
    /* The kit's trigger wrapper is a flex item too, and must be able to shrink. */
    expect(dropdownProps.className).toContain('min-w-0');
  });

  it('names the trigger with the visible display name followed by the trigger label', () => {
    render(
      <UserMenu
        profile={profile}
        labels={labels}
        onLogout={vi.fn()}
        triggerVariant={UserMenuTriggerVariant.Profile}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'John Doe Signed in as john.doe@example.com',
      }),
    ).toBeTruthy();
  });

  it('opens the menu at the start edge', () => {
    render(
      <UserMenu
        profile={profile}
        labels={labels}
        onLogout={vi.fn()}
        triggerVariant={UserMenuTriggerVariant.Profile}
      />,
    );

    expect(dropdownProps.placement).toBe('top-start');
  });

  it('flips the chevron while the menu is open', () => {
    render(
      <UserMenu
        profile={profile}
        labels={labels}
        onLogout={vi.fn()}
        triggerVariant={UserMenuTriggerVariant.Profile}
      />,
    );
    const trigger = screen.getByRole('button', { name: /^John Doe/ });
    // eslint-disable-next-line testing-library/no-node-access -- the chevron is aria-hidden, so only its icon class distinguishes the state
    const chevronBefore = trigger.querySelector('.tabler-icon-chevron-down');
    expect(chevronBefore).not.toBeNull();

    act(() => dropdownProps.onOpenChange?.(true));

    // eslint-disable-next-line testing-library/no-node-access -- see above
    expect(trigger.querySelector('.tabler-icon-chevron-up')).not.toBeNull();
  });

  it('draws only the avatar and opens at the start edge for the compact variant', () => {
    render(
      <UserMenu
        profile={profile}
        labels={labels}
        onLogout={vi.fn()}
        triggerVariant={UserMenuTriggerVariant.Compact}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Signed in as john.doe@example.com' })
        .textContent,
    ).not.toContain('John Doe');
    expect(dropdownProps.placement).toBe('top-start');
  });

  it('keeps the avatar-only trigger by default', () => {
    render(<UserMenu profile={profile} labels={labels} onLogout={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Signed in as john.doe@example.com' })
        .textContent,
    ).not.toContain('John Doe');
    expect(dropdownProps.placement).toBe('top-end');
  });
});

describe('UserMenu — open-state colour', () => {
  it('exposes triggerOpenBackground as its own custom property', () => {
    render(
      <UserMenu
        profile={profile}
        labels={labels}
        onLogout={vi.fn()}
        triggerVariant={UserMenuTriggerVariant.Compact}
        styles={{
          colors: {
            triggerHoverBackground: 'red',
            triggerOpenBackground: 'blue',
          },
        }}
      />,
    );

    /* The wrapper has no role; it is the parent of the trigger button and
       carries the theming custom properties. */
    /* eslint-disable testing-library/no-node-access -- see above */
    const wrapper = screen.getByRole('button', {
      name: 'Signed in as john.doe@example.com',
    }).parentElement;
    /* eslint-enable testing-library/no-node-access */

    expect(wrapper?.style.getPropertyValue('--np-trigger-open-bg')).toBe(
      'blue',
    );
    expect(wrapper?.style.getPropertyValue('--np-trigger-hover-bg')).toBe(
      'red',
    );
  });
});
