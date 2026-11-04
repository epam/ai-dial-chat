import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToolsBottomSheet } from '../ToolsBottomSheet';

const items: ToolMenuItem[] = [
  { id: 'web', label: 'Web search', icon: null, isSelected: true },
  { id: 'research', label: 'Deep Research', icon: null, isSelected: false },
];

const renderSheet = (onToolToggle = vi.fn()) =>
  render(
    <ToolsBottomSheet
      isOpen
      onBack={vi.fn()}
      onClose={vi.fn()}
      items={items}
      onToolToggle={onToolToggle}
      colors={{ selectedIconText: 'red' }}
    />,
  );

describe('ToolsBottomSheet', () => {
  it('renders each tool as a menuitemcheckbox inside a named menu', async () => {
    renderSheet();

    expect(await screen.findByRole('menu', { name: 'Tools' })).toBeTruthy();
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Web search' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Deep Research' })
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('draws the trailing check only on the selected row, inside the themable hook', async () => {
    renderSheet();

    const selected = await screen.findByRole('menuitemcheckbox', {
      name: 'Web search',
    });
    const unselected = screen.getByRole('menuitemcheckbox', {
      name: 'Deep Research',
    });

    /*
     * The check is a decorative, aria-hidden icon whose color comes from a
     * module class — a CSS-level check with no semantic query available.
     */
    // eslint-disable-next-line testing-library/no-node-access -- see comment above
    const check = selected.querySelector('svg.tabler-icon-check');
    expect(check?.parentElement?.className).toMatch(/selectedIcon/);
    // eslint-disable-next-line testing-library/no-node-access -- see comment above
    expect(unselected.querySelector('svg.tabler-icon-check')).toBeNull();
    expect(
      screen
        .getByRole('menu', { name: 'Tools' })
        .style.getPropertyValue('--tbs-selected-icon-text'),
    ).toBe('red');
  });

  it('calls onToolToggle with the tool id when a row is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    const onToolToggle = vi.fn();
    renderSheet(onToolToggle);

    await user.click(
      await screen.findByRole('menuitemcheckbox', { name: 'Deep Research' }),
    );

    expect(onToolToggle).toHaveBeenCalledWith('research');
  });
});
