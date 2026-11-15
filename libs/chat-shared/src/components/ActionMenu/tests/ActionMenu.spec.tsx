import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionMenu } from '../ActionMenu';

const stubPhone = (isPhone: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: isPhone,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
};

const renderMenu = (onDelete = vi.fn(), onOpenChange = vi.fn()) =>
  render(
    <ActionMenu
      title="More actions"
      closeLabel="Close sheet"
      onOpenChange={onOpenChange}
      items={[
        { key: 'rename', label: 'Rename', onClick: vi.fn() },
        { key: 'delete', label: 'Delete', danger: true, onClick: onDelete },
      ]}
    >
      <button type="button">Open menu</button>
    </ActionMenu>,
  );

describe('ActionMenu', () => {
  beforeEach(() => {
    /* The kit dropdown observes its trigger; jsdom has no IntersectionObserver. */
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('opens a bottom sheet on a phone and runs the chosen action', async () => {
    stubPhone(true);
    const onDelete = vi.fn();
    const onOpenChange = vi.fn();
    renderMenu(onDelete, onOpenChange);
    const user = userEvent.setup();

    const trigger = screen.getByRole('button', { name: 'Open menu' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await user.click(trigger);
    expect(
      await screen.findByRole('dialog', { name: 'More actions' }),
    ).toBeTruthy();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('opens the anchored dropdown off a phone', async () => {
    stubPhone(false);
    renderMenu();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(await screen.findByRole('menu')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
