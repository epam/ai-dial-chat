import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../../../models/catalog-item';
import { CatalogEntityType } from '../../../../../types/entity-type';
import { DeleteButton } from '../DeleteButton';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  DialSpinner: () => <svg />,
  NeutralButton: ({
    label,
    iconBefore,
    onClick,
    disabled,
  }: {
    label: string;
    iconBefore?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {iconBefore}
      {label}
    </button>
  ),
}));
vi.mock('@tabler/icons-react', () => ({
  IconTrash: () => <svg />,
}));

const makeItem = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: '1',
  type: CatalogEntityType.Toolset,
  name: 'My toolset',
  version: '1',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
  isMyApp: true,
  ...overrides,
});

describe('DeleteButton', () => {
  it('does not render when the item is not owned by the current user', () => {
    render(<DeleteButton item={makeItem({ isMyApp: false })} />);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('does not render for entity types other than Application and Toolset', () => {
    render(
      <DeleteButton
        item={makeItem({ isMyApp: true, type: CatalogEntityType.Model })}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('renders for an owned application', () => {
    render(
      <DeleteButton
        item={makeItem({
          isMyApp: true,
          type: CatalogEntityType.Agent,
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('renders for an owned toolset', () => {
    render(
      <DeleteButton
        item={makeItem({ isMyApp: true, type: CatalogEntityType.Toolset })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('uses deleteActionLabel for the button label', () => {
    render(
      <DeleteButton
        item={makeItem()}
        texts={{ deleteActionLabel: 'Remove' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('calls onDelete with the item immediately on click, with no confirmation step', async () => {
    const item = makeItem();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DeleteButton item={item} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(item);
  });

  it('calls onDeleted after onDelete resolves', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(
      <DeleteButton
        item={makeItem()}
        onDelete={onDelete}
        onDeleted={onDeleted}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it('does not call onDeleted when onDelete rejects', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('boom'));
    const onDeleted = vi.fn();
    render(
      <DeleteButton
        item={makeItem()}
        onDelete={onDelete}
        onDeleted={onDeleted}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('does not throw when onDelete rejects', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('boom'));
    render(<DeleteButton item={makeItem()} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const button = screen.getByRole('button', {
      name: 'Delete',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('shows a loading indicator while onDelete is pending, and keeps a stable accessible name', async () => {
    let resolveDelete: (() => void) | undefined;
    const onDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    render(<DeleteButton item={makeItem()} onDelete={onDelete} />);
    const button = screen.getByRole('button', { name: 'Delete' });

    await userEvent.click(button);
    expect(screen.getByText('Deleting')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBe(button);

    await act(async () => {
      resolveDelete?.();
    });
  });
});
