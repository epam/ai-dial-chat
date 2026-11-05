import { useUnsavedChanges } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesI18nKeys } from '../../constants/translation-keys';
import en from '../../i18n/locales/en.json';
import { UnsavedChangesProvider } from '../UnsavedChangesContext';

const DiscardTrigger: FC = () => {
  const { requestDiscard } = useUnsavedChanges();
  return (
    <button type="button" onClick={() => requestDiscard(() => undefined)}>
      Leave
    </button>
  );
};

describe('UnsavedChangesProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fills every dialog label with a translated unsavedChanges key', async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider>
        <DiscardTrigger />
      </UnsavedChangesProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Leave' }));

    expect(
      screen.getByRole('dialog', { name: UnsavedChangesI18nKeys.Title }),
    ).toBeTruthy();
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
      confirmLabelMobile: 'Discard',
      cancelLabel: 'Keep editing',
    });
  });
  it('shortens the confirming action on a mobile screen', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider>
        <DiscardTrigger />
      </UnsavedChangesProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Leave' }));

    expect(
      screen.getByRole('button', {
        name: UnsavedChangesI18nKeys.ConfirmLabelMobile,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: UnsavedChangesI18nKeys.ConfirmLabel,
      }),
    ).toBeNull();
  });
});
