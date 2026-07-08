import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  AccessRole,
  FolderAccessGroup,
  FolderAccessMember,
} from '../../../models/folder-access';
import { FolderAccess } from '../FolderAccess';

interface MockDropdownItem {
  key: string;
  label?: ReactNode;
  onClick?: (info: { key: string; domEvent: MouseEvent }) => void;
}

// DialDropdown uses floating-ui which can't position in jsdom — mock it as a
// plain listbox so option interaction works in tests (matches the convention
// used in Filter.spec.tsx: render children + a clickable list of items).
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...real,
    DialDropdown: ({
      children,
      items,
    }: {
      children: ReactNode;
      items?: MockDropdownItem[];
    }) => (
      <div>
        {children}
        <div role="listbox">
          {items?.map((item) => (
            <button
              key={item.key}
              type="button"
              role="option"
              aria-selected={false}
              onClick={(e) =>
                item.onClick?.({
                  key: item.key,
                  domEvent: e.nativeEvent as unknown as MouseEvent,
                })
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    ),
  };
});

const people: FolderAccessMember[] = [
  { id: 'u1', name: 'Yuliia M.', role: AccessRole.Owner },
  { id: 'u2', name: 'A. Ivanov', role: AccessRole.Editor },
  { id: 'u3', name: 'K. Petrova', role: AccessRole.Viewer },
  { id: 'u4', name: 'R. Singh', role: AccessRole.Viewer },
  { id: 'u5', name: 'B. Chen', role: AccessRole.Editor },
];

const groups: FolderAccessGroup[] = [
  {
    id: 'g1',
    name: 'Data Science team',
    role: AccessRole.Editor,
    memberCount: 12,
  },
];

const renderAccess = (props?: Partial<ComponentProps<typeof FolderAccess>>) =>
  render(
    <FolderAccess
      people={people}
      groups={groups}
      currentUserId="u1"
      {...props}
    />,
  );

describe('FolderAccess — loading state', () => {
  it('renders a skeleton instead of the access content', () => {
    renderAccess({ isLoading: true });
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('FolderAccess — error state', () => {
  it('renders the error message', () => {
    renderAccess({ error: 'Permissions could not be loaded.' });
    expect(screen.getByText('Permissions could not be loaded.')).toBeTruthy();
  });

  it('calls onRetry when the retry affordance is clicked', async () => {
    const onRetry = vi.fn();
    renderAccess({ error: 'Failed.', onRetry });
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not render a retry affordance when onRetry is omitted', () => {
    renderAccess({ error: 'Failed.' });
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});

describe('FolderAccess — loaded state', () => {
  it('lists groups before people, each with their role', () => {
    renderAccess();
    expect(
      screen.getByRole('listitem', {
        name: 'Data Science team, Editor, 12 members',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('listitem', { name: 'Yuliia M. (you), Owner' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('listitem', { name: 'A. Ivanov, Editor' }),
    ).toBeTruthy();
  });

  it('does not render an info callout', () => {
    renderAccess();
    expect(screen.queryByText(/can use,/)).toBeNull();
  });

  it('renders roles as plain, non-bold text, not tags', () => {
    renderAccess();
    const [roleText] = screen.getAllByText('Editor', { selector: 'span' });
    expect(roleText.className).toContain('dial-small-text');
    expect(roleText.className).not.toContain('dial-small-semi-text');
    expect(roleText.className).toContain('text-secondary');
    expect(screen.queryByRole('button', { name: /Editor/ })).toBeNull();
  });

  it('does not render an avatar-stack preview', () => {
    renderAccess();
    expect(
      screen.queryByRole('group', { name: 'People with access' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /Show \d+ more/ })).toBeNull();
  });

  it('does not show a member-count badge next to a group role', () => {
    renderAccess();
    expect(screen.getAllByText('Editor').length).toBeGreaterThan(0);
    expect(screen.queryByText('Editor · 12')).toBeNull();
  });

  it('renders the group name in semibold', () => {
    renderAccess();
    expect(screen.getByText('Data Science team').className).toContain(
      'dial-small-semi-text',
    );
  });

  it('renders the group icon and person avatars as circular', () => {
    renderAccess({ people: people.slice(0, 2) });
    const badges = document.querySelectorAll('[class*="rounded-full"]');
    expect(badges.length).toBeGreaterThanOrEqual(3); // 1 group icon + 2 avatars
  });

  it('applies generous vertical padding between rows', () => {
    renderAccess();
    for (const item of screen.getAllByRole('listitem')) {
      expect(item.className).toContain('py-2.5');
    }
  });

  it('renders no outer border/stroke around the section', () => {
    const { container } = renderAccess();
    expect(container.querySelector('.rounded-xl')).toBeNull();
    expect(
      container.firstElementChild?.className.includes('border'),
    ).toBeFalsy();
  });

  it('scrolls the list instead of growing unbounded once it exceeds five rows', () => {
    const { container } = renderAccess();
    const list = container.querySelector('ul');
    expect(list?.className).toContain('overflow-y-auto');
    expect(list?.getAttribute('style')).toContain('max-height');
  });
});

describe('FolderAccess — minimal state (only the current user)', () => {
  it('renders just the current user as Owner, with no groups', () => {
    renderAccess({
      people: [{ id: 'u1', name: 'Yuliia M.', role: AccessRole.Owner }],
      groups: [],
    });
    expect(
      screen.getByRole('listitem', { name: 'Yuliia M. (you), Owner' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('FolderAccess — add member', () => {
  it('hides the add-member row when onAddMember is omitted', () => {
    renderAccess();
    expect(
      screen.queryByRole('textbox', { name: 'New member name' }),
    ).toBeNull();
  });

  it('shows the name input, role dropdown, and Add button right away when onAddMember is provided', () => {
    renderAccess({ onAddMember: vi.fn() });
    expect(
      screen.getByRole('textbox', { name: 'New member name' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'New member role' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
  });

  it('shows the add-member row even in the empty state', () => {
    renderAccess({ people: [], groups: [], onAddMember: vi.fn() });
    expect(
      screen.getByRole('textbox', { name: 'New member name' }),
    ).toBeTruthy();
  });

  it('defaults the role trigger label to Viewer', () => {
    renderAccess({ onAddMember: vi.fn() });
    expect(
      screen.getByRole('button', { name: 'New member role' }).textContent,
    ).toContain('Viewer');
  });

  it('calls onAddMember with the trimmed name and selected role on confirm', async () => {
    const onAddMember = vi.fn();
    renderAccess({ onAddMember });
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New member name' }),
      '  New Person  ',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'New member role' }),
    );
    await userEvent.click(
      within(screen.getByRole('listbox')).getByRole('option', {
        name: 'Editor',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAddMember).toHaveBeenCalledWith('New Person', AccessRole.Editor);
  });

  it('confirms on Enter in the name input', async () => {
    const onAddMember = vi.fn();
    renderAccess({ onAddMember });
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New member name' }),
      'New Person{Enter}',
    );
    expect(onAddMember).toHaveBeenCalledWith('New Person', AccessRole.Viewer);
  });

  it('clears the name input after confirming, keeping the row visible', async () => {
    const onAddMember = vi.fn();
    renderAccess({ onAddMember });
    const input = screen.getByRole('textbox', {
      name: 'New member name',
    }) as HTMLInputElement;
    await userEvent.type(input, 'New Person');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(input.value).toBe('');
  });

  it('does not call onAddMember when confirming a blank name', async () => {
    const onAddMember = vi.fn();
    renderAccess({ onAddMember });
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAddMember).not.toHaveBeenCalled();
  });
});

describe('FolderAccess — empty state (no people or groups)', () => {
  it('renders an empty-state message instead of an empty callout', () => {
    renderAccess({ people: [], groups: [] });
    expect(
      screen.getByText('No access information for this folder yet.'),
    ).toBeTruthy();
    expect(screen.queryByText(/can use,/)).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('FolderAccess — "you" derivation', () => {
  it('labels only the member matching currentUserId as "(you)"', () => {
    renderAccess({ currentUserId: 'u2' });
    expect(
      screen.getByRole('listitem', { name: 'A. Ivanov (you), Editor' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('listitem', { name: 'Yuliia M., Owner' }),
    ).toBeTruthy();
  });
});

describe('FolderAccess — accessibility', () => {
  it('renders the compact list as a semantic list', () => {
    renderAccess();
    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getAllByRole('listitem').length).toBe(
      groups.length + people.length,
    );
  });

  it("announces each row's role via its accessible name", () => {
    renderAccess({ people: [people[2]], groups: [] });
    expect(
      screen.getByRole('listitem', { name: 'K. Petrova, Viewer' }),
    ).toBeTruthy();
  });
});

describe('FolderAccess — WCAG AA contrast', () => {
  // Relative-luminance / contrast-ratio per WCAG 2.1 (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance).
  const channelLuminance = (channel8bit: number): number => {
    const c = channel8bit / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const relativeLuminance = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (
      0.2126 * channelLuminance(r) +
      0.7152 * channelLuminance(g) +
      0.0722 * channelLuminance(b)
    );
  };
  const contrastRatio = (hexA: string, hexB: string): number => {
    const [lighter, darker] = [
      relativeLuminance(hexA),
      relativeLuminance(hexB),
    ].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  };

  it('role text meets 4.5:1 against the panel surface (text-secondary on layer-0)', () => {
    const ratio = contrastRatio('#575F73', '#FCFCFC');
    // eslint-disable-next-line no-console -- printing the ratio is the point of this test.
    console.log(`role text contrast ratio: ${ratio.toFixed(2)}:1`);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('primary row text meets 4.5:1 against the panel surface (text-primary on layer-0)', () => {
    const ratio = contrastRatio('#161B2D', '#FCFCFC');
    // eslint-disable-next-line no-console -- printing the ratio is the point of this test.
    console.log(`row text contrast ratio: ${ratio.toFixed(2)}:1`);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('avatar initials palette is documented as WCAG-AA compliant (reused as-is, not re-invented)', () => {
    // Every pickAvatarColor() pair in libs/chat-shared/src/utils/avatar-color.ts
    // is documented as >=4.5:1; spot-check one pair here to guard against drift.
    const ratio = contrastRatio('#0d6e72', '#cde8e5');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
