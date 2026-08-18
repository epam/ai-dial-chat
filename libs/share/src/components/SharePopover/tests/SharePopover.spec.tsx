import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  cloneElement,
  type ReactElement,
  type ReactNode,
  useState,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharePopoverProps } from '../../../models/share-popover-props';
import { ShareLinkAccess } from '../../../types/share';
import SharePopover from '../SharePopover';

const { mockCopy } = vi.hoisted(() => ({ mockCopy: vi.fn() }));

/*
 * `useCodeCopy` is a real, separately-tested hook from `chat-shared`; this
 * fake reproduces just enough of its stateful shape (isCopied flips true on
 * copy()) so SharePopover's own copy-confirm UI can be exercised without
 * depending on the real clipboard write succeeding in jsdom.
 */
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    useCodeCopy: (_value: string) => {
      const [isCopied, setIsCopied] = useState(false);
      return {
        isCopied,
        copy: () => {
          mockCopy();
          setIsCopied(true);
        },
      };
    },
  };
});

/*
 * Mirrors the `Dropdown` mock convention used across this repo — renders
 * the trigger and (when open) the overlay content inline, so tests can
 * interact with real button/menu elements instead of Dropdown's own
 * floating/positioning internals. The child trigger is cloned with a click
 * handler that toggles `open`, standing in for the real component's default
 * click-to-open behavior.
 */
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    Dropdown: ({
      children,
      open,
      onOpenChange,
      renderOverlay,
    }: {
      children: ReactElement<{ onClick?: () => void }>;
      open?: boolean;
      onOpenChange?: (next: boolean) => void;
      renderOverlay?: () => ReactNode;
    }) => (
      <>
        {cloneElement(children, {
          onClick: () => onOpenChange?.(!open),
        })}
        {open && renderOverlay?.()}
      </>
    ),
  };
});

const ITEM_URL = 'https://example.com/marketplace/share/gpt-4o';
const EXPIRY_NOTE = 'This link is active for 3 days.';

const makeProps = (
  overrides: Partial<SharePopoverProps> = {},
): SharePopoverProps => ({
  url: ITEM_URL,
  isLoading: false,
  error: null,
  access: [ShareLinkAccess.View],
  canEditAccess: true,
  onAccessChange: vi.fn(),
  onClose: vi.fn(),
  labels: { expiryNote: EXPIRY_NOTE },
  ...overrides,
});

describe('SharePopover', () => {
  const user = userEvent.setup({ delay: null });
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the link view by default with Can view access', () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.getByDisplayValue(ITEM_URL)).toBeTruthy();
    expect(screen.getByText(EXPIRY_NOTE)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Can view' })).toBeTruthy();
  });

  it('shows the view-access visibility note by default', () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    expect(
      screen.getByText(
        'This deployment and its updates will be visible to users with the link.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Anyone with the link will be able to view and edit this deployment.',
      ),
    ).toBeNull();
  });

  it('shows the edit-access visibility note in both the link and QR views', async () => {
    render(
      <SharePopover
        {...makeProps({
          onClose,
          access: [ShareLinkAccess.View, ShareLinkAccess.Edit],
        })}
      />,
    );

    expect(
      screen.getByText(
        'Anyone with the link will be able to view and edit this deployment.',
      ),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'QR' }));

    expect(
      screen.getByText(
        'Anyone with the link will be able to view and edit this deployment.',
      ),
    ).toBeTruthy();
  });

  it('calls onAccessChange with Edit when an access option is selected', async () => {
    const onAccessChange = vi.fn();
    render(<SharePopover {...makeProps({ onClose, onAccessChange })} />);

    await user.click(screen.getByRole('button', { name: 'Can view' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Can edit' }));

    expect(onAccessChange).toHaveBeenCalledWith([
      ShareLinkAccess.View,
      ShareLinkAccess.Edit,
    ]);
  });

  it('shows Can edit as the selected trigger label and checkmark when access starts as Edit', async () => {
    render(
      <SharePopover
        {...makeProps({
          onClose,
          access: [ShareLinkAccess.View, ShareLinkAccess.Edit],
        })}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Can edit' });
    expect(trigger).toBeTruthy();

    await user.click(trigger);

    const editOption = screen.getByRole('menuitemradio', { name: 'Can edit' });
    expect(editOption.getAttribute('aria-checked')).toBe('true');
  });

  it('moves focus between access menu options with Arrow keys', async () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    await user.click(screen.getByRole('button', { name: 'Can view' }));
    const viewOption = screen.getByRole('menuitemradio', { name: 'Can view' });
    const editOption = screen.getByRole('menuitemradio', { name: 'Can edit' });
    viewOption.focus();

    await user.keyboard('{ArrowDown}');
    expect(editOption.matches(':focus')).toBe(true);

    await user.keyboard('{ArrowDown}');
    expect(viewOption.matches(':focus')).toBe(true);

    await user.keyboard('{ArrowUp}');
    expect(editOption.matches(':focus')).toBe(true);
  });

  it('traps Tab within the open access menu', async () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    await user.click(screen.getByRole('button', { name: 'Can view' }));
    const viewOption = screen.getByRole('menuitemradio', { name: 'Can view' });
    const editOption = screen.getByRole('menuitemradio', { name: 'Can edit' });
    editOption.focus();

    await user.tab();
    expect(viewOption.matches(':focus')).toBe(true);

    await user.tab({ shift: true });
    expect(editOption.matches(':focus')).toBe(true);
  });

  it('shows the interactive access dropdown when canEditAccess is true', () => {
    render(<SharePopover {...makeProps({ onClose, canEditAccess: true })} />);

    expect(screen.getByRole('button', { name: 'Can view' })).toBeTruthy();
  });

  it('hides the access dropdown and shows a static Can view label when canEditAccess is false', () => {
    render(<SharePopover {...makeProps({ onClose, canEditAccess: false })} />);

    expect(screen.queryByRole('button', { name: 'Can view' })).toBeNull();
    expect(screen.getByText('Can view')).toBeTruthy();
  });

  it('never shows the edit-access visibility note when canEditAccess is false', () => {
    render(
      <SharePopover
        {...makeProps({
          onClose,
          canEditAccess: false,
          access: [ShareLinkAccess.View, ShareLinkAccess.Edit],
        })}
      />,
    );

    expect(
      screen.getByText(
        'This deployment and its updates will be visible to users with the link.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Anyone with the link will be able to view and edit this deployment.',
      ),
    ).toBeNull();
  });

  it('shows a transient Copied confirmation after clicking Copy', async () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    const copyButton = screen.getByRole('button', { name: 'Copy' });
    await user.click(copyButton);

    expect(mockCopy).toHaveBeenCalledOnce();
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('announces Copied via an aria-live region after clicking Copy', async () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion.textContent).toBe('');

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(liveRegion.textContent).toBe('Copied');
  });

  it('swaps to the QR view and back, moving focus each time', async () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    await user.click(screen.getByRole('button', { name: 'QR' }));

    expect(
      screen.getByRole('img', { name: 'QR code for the share link' }),
    ).toBeTruthy();
    expect(screen.queryByDisplayValue(ITEM_URL)).toBeNull();
    expect(screen.getByRole('button', { name: 'Link' }).matches(':focus')).toBe(
      true,
    );

    await user.click(screen.getByRole('button', { name: 'Link' }));

    expect(screen.getByDisplayValue(ITEM_URL)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'QR' }).matches(':focus')).toBe(
      true,
    );
  });

  it('keeps the access control and expiry note visible in the QR view', async () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    await user.click(screen.getByRole('button', { name: 'QR' }));

    expect(screen.getByRole('button', { name: 'Can view' })).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'QR code for the share link' }),
    ).toBeTruthy();
    expect(screen.getByText(EXPIRY_NOTE)).toBeTruthy();
  });

  it('closes only the access dropdown on Escape while in the QR view', async () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    await user.click(screen.getByRole('button', { name: 'QR' }));
    await user.click(screen.getByRole('button', { name: 'Can view' }));
    expect(screen.getByRole('menu')).toBeTruthy();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(
      screen.getByRole('img', { name: 'QR code for the share link' }),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('returns to the link view on Escape from the QR view without closing', async () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    await user.click(screen.getByRole('button', { name: 'QR' }));
    await user.keyboard('{Escape}');

    expect(screen.getByDisplayValue(ITEM_URL)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape from the link view', async () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('traps Tab within the popover, wrapping from the last control back to the first', async () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    const qrButton = screen.getByRole('button', { name: 'QR' });
    const copyButton = screen.getByRole('button', { name: 'Copy' });

    copyButton.focus();
    await user.tab();
    expect(qrButton.matches(':focus')).toBe(true);

    await user.tab({ shift: true });
    expect(copyButton.matches(':focus')).toBe(true);
  });

  it('moves Tab focus explicitly through every interior control, reaching Copy', async () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    const qrButton = screen.getByRole('button', { name: 'QR' });
    const accessTrigger = screen.getByRole('button', { name: 'Can view' });
    const linkInput = screen.getByRole('textbox', { name: 'Share link' });
    const copyButton = screen.getByRole('button', { name: 'Copy' });

    qrButton.focus();
    await user.tab();
    expect(accessTrigger.matches(':focus')).toBe(true);

    await user.tab();
    expect(linkInput.matches(':focus')).toBe(true);

    await user.tab();
    expect(copyButton.matches(':focus')).toBe(true);
  });

  it('moves focus to the first control in the popover when it mounts', () => {
    render(<SharePopover {...makeProps({ onClose })} />);

    expect(screen.getByRole('button', { name: 'QR' }).matches(':focus')).toBe(
      true,
    );
  });

  it('moves focus into the popover when it mounts without a link', () => {
    render(
      <SharePopover
        {...makeProps({ onClose, url: undefined, isLoading: true })}
      />,
    );

    expect(screen.getByRole('button', { name: 'QR' }).matches(':focus')).toBe(
      true,
    );
  });

  it('shows a skeleton loading state while the link is not ready', () => {
    const { container } = render(
      <SharePopover
        {...makeProps({ onClose, url: undefined, isLoading: true })}
      />,
    );

    const status = screen.getByRole('status', {
      name: 'Creating share link…',
    });
    expect(status).toBeTruthy();
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- checking for decorative aria-hidden skeleton placeholders, which by definition carry no accessible role/name
      container.querySelectorAll('[aria-hidden]').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByDisplayValue(ITEM_URL)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
  });

  it('shows an error state when the link could not be created', () => {
    render(
      <SharePopover
        {...makeProps({
          onClose,
          url: undefined,
          isLoading: false,
          error: new Error('network down'),
        })}
      />,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByDisplayValue(ITEM_URL)).toBeNull();
  });
});
