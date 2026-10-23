import { useIsMobile } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SkillEditorDialogProps } from '../../../models/skill-editor-dialog-props';
import { SkillEditorDialog } from '../SkillEditorDialog';

vi.mock('@epam/ai-dial-chat-shared', () => ({
  buildCssVars: (vars: Record<string, string | undefined>) =>
    Object.fromEntries(
      Object.entries(vars).filter(([, value]) => value != null),
    ),
  mergeClasses: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
  useIsMobile: vi.fn(() => false),
}));

interface MockButtonProps {
  label?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  ButtonVariant: { Primary: 'primary', Neutral: 'neutral' },
  ButtonAppearance: { Solid: 'solid', Ghost: 'ghost' },
  PopupSize: { Sm: 'sm' },
  Popup: ({
    open,
    header,
    children,
    mainButtons,
  }: {
    open: boolean;
    header: string;
    children: ReactNode;
    mainButtons?: MockButtonProps[];
  }) =>
    open ? (
      <div role="dialog" aria-label={header} data-kind="popup">
        {children}
        {mainButtons?.map((button, index) => (
          <button
            key={index}
            onClick={button.onClick}
            disabled={button.disabled}
          >
            {button.label}
          </button>
        ))}
      </div>
    ) : null,
  BottomSheet: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={title} data-kind="sheet">
        {children}
      </div>
    ) : null,
  PrimaryButton: ({ label, onClick, disabled }: MockButtonProps) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
  NeutralButton: ({ label, onClick }: MockButtonProps) => (
    <button onClick={onClick}>{label}</button>
  ),
  Spinner: () => <span role="status" />,
}));

describe('SkillEditorDialog', () => {
  beforeEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  const renderDialog = (props?: Partial<SkillEditorDialogProps>) =>
    render(
      <SkillEditorDialog
        isOpen
        title="Create folder"
        closeAriaLabel="Close"
        onClose={vi.fn()}
        confirmLabel="Create"
        onConfirm={vi.fn()}
        cancelLabel="Cancel"
        onCancel={vi.fn()}
        {...props}
      >
        <p>Body</p>
      </SkillEditorDialog>,
    );

  it('renders a popup on desktop', () => {
    renderDialog();

    expect(
      screen
        .getByRole('dialog', { name: 'Create folder' })
        .getAttribute('data-kind'),
    ).toBe('popup');
  });

  it('renders a bottom sheet with its own Confirm and Cancel below the desktop breakpoint', async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const user = userEvent.setup({ delay: null });
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderDialog({ onConfirm, onCancel });

    expect(
      screen
        .getByRole('dialog', { name: 'Create folder' })
        .getAttribute('data-kind'),
    ).toBe('sheet');
    expect(screen.getByText('Body')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Create' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables the confirming button when isConfirmDisabled is set', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    renderDialog({ isConfirmDisabled: true });

    expect(
      screen.getByRole('button', { name: 'Create' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('sets the footer color overrides as CSS vars on the sheet footer', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    renderDialog({
      colors: { footerBackground: '#111111', footerBorder: '#222222' },
    });

    // eslint-disable-next-line testing-library/no-node-access -- the vars sit on the footer row, which has no role of its own
    const footer = screen.getByRole('button', { name: 'Create' }).parentElement;

    expect(footer?.style.getPropertyValue('--se-dialog-footer-bg')).toBe(
      '#111111',
    );
    expect(footer?.style.getPropertyValue('--se-dialog-footer-border')).toBe(
      '#222222',
    );
  });
});
