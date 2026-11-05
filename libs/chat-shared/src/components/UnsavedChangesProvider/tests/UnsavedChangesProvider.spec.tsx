import { render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useUnsavedChanges,
  useUnsavedChangesInternal,
} from '../unsaved-changes-context';
import { UnsavedChangesProvider } from '../UnsavedChangesProvider';

const TITLE = 'Discard unsaved changes?';
const MESSAGE = 'You have unsaved changes. Leaving now will discard them.';
const CONFIRM = 'Discard changes';
const CANCEL = 'Keep editing';

const Status: FC = () => {
  const { hasUnsavedChanges } = useUnsavedChanges();
  return <p>{hasUnsavedChanges ? 'dirty' : 'clean'}</p>;
};

const Registrar: FC<{ isDirty: boolean }> = ({ isDirty }) => {
  const { register } = useUnsavedChangesInternal();
  useEffect(() => register(isDirty), [register, isDirty]);
  return null;
};

const DiscardTrigger: FC<{ onDiscard: () => void }> = ({ onDiscard }) => {
  const { requestDiscard } = useUnsavedChanges();
  return (
    <button type="button" onClick={() => requestDiscard(onDiscard)}>
      Leave
    </button>
  );
};

const openDialog = async (onDiscard = vi.fn()) => {
  const user = userEvent.setup();
  render(
    <UnsavedChangesProvider>
      <DiscardTrigger onDiscard={onDiscard} />
    </UnsavedChangesProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Leave' }));
  return { user, onDiscard };
};

describe('UnsavedChangesProvider', () => {
  afterEach(() => {
    document.documentElement.dir = '';
  });

  it('throws a provider-naming error when useUnsavedChanges is used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useUnsavedChanges())).toThrow(
      /UnsavedChangesProvider/,
    );
  });

  it('reports no unsaved changes when nothing is registered', () => {
    render(
      <UnsavedChangesProvider>
        <Status />
      </UnsavedChangesProvider>,
    );

    expect(screen.getByText('clean')).toBeTruthy();
  });

  it('follows the registered dirty state and clears it on unregister', () => {
    const { rerender } = render(
      <UnsavedChangesProvider>
        <Registrar isDirty />
        <Status />
      </UnsavedChangesProvider>,
    );
    expect(screen.getByText('dirty')).toBeTruthy();

    rerender(
      <UnsavedChangesProvider>
        <Registrar isDirty={false} />
        <Status />
      </UnsavedChangesProvider>,
    );
    expect(screen.getByText('clean')).toBeTruthy();

    rerender(
      <UnsavedChangesProvider>
        <Status />
      </UnsavedChangesProvider>,
    );
    expect(screen.getByText('clean')).toBeTruthy();
  });

  it('names the dialog by its title and offers exactly two actions', async () => {
    await openDialog();

    const dialog = screen.getByRole('dialog', {
      name: TITLE,
    });
    expect(dialog).toBeTruthy();
    expect(screen.getByText(MESSAGE)).toBeTruthy();
    expect(screen.getByRole('button', { name: CONFIRM })).toBeTruthy();
    expect(screen.getByRole('button', { name: CANCEL })).toBeTruthy();
  });

  it('renders the host labels and keeps the English default of an omitted one', async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider
        labels={{
          title: 'Verwerfen?',
          message: 'Ungespeichert.',
          confirmLabel: 'Verwerfen',
        }}
      >
        <DiscardTrigger onDiscard={vi.fn()} />
      </UnsavedChangesProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Leave' }));

    expect(screen.getByRole('dialog', { name: 'Verwerfen?' })).toBeTruthy();
    expect(screen.getByText('Ungespeichert.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verwerfen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: CANCEL })).toBeTruthy();
  });

  it('runs the discard callback once when Discard changes is chosen', async () => {
    const { user, onDiscard } = await openDialog();

    await user.click(screen.getByRole('button', { name: CONFIRM }));

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('runs nothing when Keep editing is chosen', async () => {
    const { user, onDiscard } = await openDialog();

    await user.click(screen.getByRole('button', { name: CANCEL }));

    expect(onDiscard).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('runs nothing when the dialog is dismissed with Escape', async () => {
    const { user, onDiscard } = await openDialog();

    await user.keyboard('{Escape}');

    expect(onDiscard).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lays out under rtl without flipping any glyph', async () => {
    document.documentElement.dir = 'rtl';
    await openDialog();

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('button', { name: CONFIRM })).toBeTruthy();
    expect(dialog.getByRole('button', { name: CANCEL })).toBeTruthy();
    for (const button of dialog.getAllByRole('button')) {
      expect(button.className).not.toMatch(/scale-x-/);
    }
  });
});
