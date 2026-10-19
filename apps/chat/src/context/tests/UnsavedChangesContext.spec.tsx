import { render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesI18nKeys } from '../../constants/translation-keys';
import en from '../../i18n/locales/en.json';
import {
  UnsavedChangesProvider,
  useUnsavedChanges,
  useUnsavedChangesInternal,
} from '../UnsavedChangesContext';

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

describe('UnsavedChangesContext', () => {
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
      name: UnsavedChangesI18nKeys.Title,
    });
    expect(dialog).toBeTruthy();
    expect(screen.getByText(UnsavedChangesI18nKeys.Message)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: UnsavedChangesI18nKeys.ConfirmLabel }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: UnsavedChangesI18nKeys.CancelLabel }),
    ).toBeTruthy();
  });

  it('uses the shared unsaved-changes copy', () => {
    expect(en.unsavedChanges).toEqual({
      title: 'Discard unsaved changes?',
      message: 'You have unsaved changes. Leaving now will discard them.',
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
    });
  });

  it('runs the discard callback once when Discard changes is chosen', async () => {
    const { user, onDiscard } = await openDialog();

    await user.click(
      screen.getByRole('button', { name: UnsavedChangesI18nKeys.ConfirmLabel }),
    );

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('runs nothing when Keep editing is chosen', async () => {
    const { user, onDiscard } = await openDialog();

    await user.click(
      screen.getByRole('button', { name: UnsavedChangesI18nKeys.CancelLabel }),
    );

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
    expect(
      dialog.getByRole('button', { name: UnsavedChangesI18nKeys.ConfirmLabel }),
    ).toBeTruthy();
    expect(
      dialog.getByRole('button', { name: UnsavedChangesI18nKeys.CancelLabel }),
    ).toBeTruthy();
    for (const button of dialog.getAllByRole('button')) {
      expect(button.className).not.toMatch(/scale-x-/);
    }
  });
});
