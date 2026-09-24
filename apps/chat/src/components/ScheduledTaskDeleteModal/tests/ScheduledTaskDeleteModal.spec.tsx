import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScheduledTaskDeleteModal from '../ScheduledTaskDeleteModal';
import styles from '../ScheduledTaskDeleteModal.module.scss';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ButtonVariant: { Danger: 'danger', Neutral: 'neutral' },
  ButtonAppearance: { Ghost: 'ghost' },
  /* Mirrors the real popup: body children plus the footer buttons declared
     as data. The test i18n mock returns keys, so labels render as their
     translation keys. */
  Popup: ({
    open,
    className,
    header,
    children,
    mainButtons,
  }: {
    open: boolean;
    className?: string;
    header: React.ReactNode;
    children?: React.ReactNode;
    mainButtons?: {
      label?: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }[];
  }) =>
    open ? (
      <div
        role="dialog"
        className={className}
        aria-labelledby="delete-dialog-title"
      >
        <h2 id="delete-dialog-title">{header}</h2>
        {children}
        {mainButtons?.map((button, index) => (
          <button
            key={index + '-' + String(button.label)}
            onClick={button.onClick}
            disabled={button.disabled}
          >
            {button.label}
          </button>
        ))}
      </div>
    ) : null,
}));

const renderModal = (
  props?: Partial<React.ComponentProps<typeof ScheduledTaskDeleteModal>>,
) =>
  render(
    <ScheduledTaskDeleteModal
      open
      taskName="Daily summary"
      onConfirm={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );

describe('ScheduledTaskDeleteModal', () => {
  it('renders the task name, warning sentence, and consequences list when open', () => {
    renderModal();

    expect(
      screen.getByRole('dialog', {
        name: 'scheduledTasks.detail.deleteConfirmTitle',
      }),
    ).toBeTruthy();
    expect(screen.getByRole('dialog').classList.contains(styles.modal)).toBe(
      true,
    );
    expect(screen.getByText('Daily summary')).toBeTruthy();
    /* The test Trans mock renders the i18nKey itself. */
    expect(
      screen.getByText('scheduledTasks.detail.deleteConfirmDescription'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'scheduledTasks.detail.deleteConsequenceConversationsAccessible',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('scheduledTasks.detail.deleteConsequenceCannotBeUndone'),
    ).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    renderModal({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fires onConfirm when the confirm action is activated', async () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.delete' }),
    );

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('fires onClose when the cancel action is activated', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.cancel' }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows the busy label and disables the confirm action while deleting', () => {
    renderModal({ isDeleting: true });

    const confirmButton = screen.getByRole('button', {
      name: 'scheduledTasks.detail.deleteConfirmingLabel',
    }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    /* Cancel freezes too — dismissing the dialog mid-request would leave
       the page state contradicting the in-flight delete. */
    const cancelButton = screen.getByRole('button', {
      name: 'buttons.cancel',
    }) as HTMLButtonElement;
    expect(cancelButton.disabled).toBe(true);
  });
});
