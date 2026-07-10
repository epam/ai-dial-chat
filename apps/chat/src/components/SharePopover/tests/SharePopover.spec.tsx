import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  cloneElement,
  type ReactElement,
  type ReactNode,
  useState,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareI18nKeys } from '../../../constants/translation-keys';
import { useShareLink } from '../../../hooks/useShareLink/useShareLink';
import type { UseShareLinkResult } from '../../../hooks/useShareLink/useShareLink';
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
 * Mirrors the `DialDropdown` mock convention used by
 * libs/catalog/.../Header.spec.tsx — renders the trigger and (when open) the
 * overlay content inline, so tests can interact with real button/menu
 * elements instead of DialDropdown's own floating/positioning internals.
 * The child trigger is cloned with a click handler that toggles `open`,
 * standing in for the real component's default click-to-open behavior
 * (SharePopover's access trigger relies on that default, the same way
 * Filter.tsx's own trigger button does, rather than managing its own click).
 */
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    DialDropdown: ({
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

vi.mock('../../../hooks/useShareLink/useShareLink', () => ({
  useShareLink: vi.fn(),
}));

const ITEM_URL = 'https://chat.dialx.ai/marketplace/share/gpt-4o';

const makeItem = (
  type: CatalogEntityType = CatalogEntityType.Agent,
): CatalogItem => ({
  id: 'gpt-4o',
  type,
  name: 'GPT-4o',
  version: '1.0',
  lastUsed: '',
  description: '',
  folder: [],
  topics: [],
});

const makeResult = (
  overrides: Partial<UseShareLinkResult> = {},
): UseShareLinkResult => ({
  data: {
    url: ITEM_URL,
    expiresInDays: 3,
    access: ShareLinkAccess.View,
  },
  isLoading: false,
  error: null,
  setAccess: vi.fn(),
  ...overrides,
});

describe('SharePopover', () => {
  const user = userEvent.setup({ delay: null });
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the link view by default with Can view access', () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    expect(screen.getByText(ShareI18nKeys.Title)).toBeTruthy();
    expect(screen.getByDisplayValue(ITEM_URL)).toBeTruthy();
    expect(screen.getByText(ShareI18nKeys.ExpiryNote)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: ShareI18nKeys.AccessViewLabel }),
    ).toBeTruthy();
  });

  it('shows the view-access visibility note by default', () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    expect(screen.getByText(ShareI18nKeys.VisibilityNote)).toBeTruthy();
    expect(screen.queryByText(ShareI18nKeys.VisibilityNoteEdit)).toBeNull();
  });

  it('shows the edit-access visibility note in both the link and QR views', async () => {
    vi.mocked(useShareLink).mockReturnValue(
      makeResult({
        data: { url: ITEM_URL, expiresInDays: 3, access: ShareLinkAccess.Edit },
      }),
    );
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    expect(screen.getByText(ShareI18nKeys.VisibilityNoteEdit)).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: ShareI18nKeys.QrButtonLabel }),
    );

    expect(screen.getByText(ShareI18nKeys.VisibilityNoteEdit)).toBeTruthy();
  });

  it('calls setAccess with Edit when an access option is selected', async () => {
    const setAccess = vi.fn();
    vi.mocked(useShareLink).mockReturnValue(makeResult({ setAccess }));
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    await user.click(
      screen.getByRole('button', { name: ShareI18nKeys.AccessViewLabel }),
    );
    await user.click(
      screen.getByRole('menuitemradio', {
        name: ShareI18nKeys.AccessEditLabel,
      }),
    );

    expect(setAccess).toHaveBeenCalledWith(ShareLinkAccess.Edit);
  });

  it('shows Can edit as the selected trigger label and checkmark when access starts as Edit', async () => {
    vi.mocked(useShareLink).mockReturnValue(
      makeResult({
        data: { url: ITEM_URL, expiresInDays: 3, access: ShareLinkAccess.Edit },
      }),
    );
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    const trigger = screen.getByRole('button', {
      name: ShareI18nKeys.AccessEditLabel,
    });
    expect(trigger).toBeTruthy();

    await user.click(trigger);

    const editOption = screen.getByRole('menuitemradio', {
      name: ShareI18nKeys.AccessEditLabel,
    });
    expect(editOption.getAttribute('aria-checked')).toBe('true');
  });

  it('moves focus between access menu options with Arrow keys', async () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    await user.click(
      screen.getByRole('button', { name: ShareI18nKeys.AccessViewLabel }),
    );
    const viewOption = screen.getByRole('menuitemradio', {
      name: ShareI18nKeys.AccessViewLabel,
    });
    const editOption = screen.getByRole('menuitemradio', {
      name: ShareI18nKeys.AccessEditLabel,
    });
    viewOption.focus();

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(editOption);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(viewOption);

    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(editOption);
  });

  it('traps Tab within the open access menu', async () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    await user.click(
      screen.getByRole('button', { name: ShareI18nKeys.AccessViewLabel }),
    );
    const viewOption = screen.getByRole('menuitemradio', {
      name: ShareI18nKeys.AccessViewLabel,
    });
    const editOption = screen.getByRole('menuitemradio', {
      name: ShareI18nKeys.AccessEditLabel,
    });
    editOption.focus();

    await user.tab();
    expect(document.activeElement).toBe(viewOption);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(editOption);
  });

  it.each([
    CatalogEntityType.Agent,
    CatalogEntityType.Application,
    CatalogEntityType.Skill,
  ])('shows the interactive access dropdown for a %s item', (type) => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem(type)} onClose={onClose} />);

    expect(
      screen.getByRole('button', { name: ShareI18nKeys.AccessViewLabel }),
    ).toBeTruthy();
  });

  it.each([CatalogEntityType.Model, CatalogEntityType.Toolset])(
    'hides the access dropdown and shows a static Can view label for a %s item',
    (type) => {
      vi.mocked(useShareLink).mockReturnValue(makeResult());
      render(<SharePopover item={makeItem(type)} onClose={onClose} />);

      expect(
        screen.queryByRole('button', { name: ShareI18nKeys.AccessViewLabel }),
      ).toBeNull();
      expect(screen.getByText(ShareI18nKeys.AccessViewLabel)).toBeTruthy();
    },
  );

  it('never shows the edit-access visibility note for a Model item', () => {
    vi.mocked(useShareLink).mockReturnValue(
      makeResult({
        data: { url: ITEM_URL, expiresInDays: 3, access: ShareLinkAccess.Edit },
      }),
    );
    render(
      <SharePopover
        item={makeItem(CatalogEntityType.Model)}
        onClose={onClose}
      />,
    );

    expect(screen.getByText(ShareI18nKeys.VisibilityNote)).toBeTruthy();
    expect(screen.queryByText(ShareI18nKeys.VisibilityNoteEdit)).toBeNull();
  });

  it('shows a transient Copied confirmation after clicking Copy', async () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    const copyButton = screen.getByRole('button', {
      name: ShareI18nKeys.CopyButtonLabel,
    });
    await user.click(copyButton);

    expect(mockCopy).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole('button', {
        name: ShareI18nKeys.CopiedButtonLabel,
      }),
    ).toBeTruthy();
  });

  it('announces Copied via an aria-live region after clicking Copy', async () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion.textContent).toBe('');

    await user.click(
      screen.getByRole('button', { name: ShareI18nKeys.CopyButtonLabel }),
    );

    expect(liveRegion.textContent).toBe(ShareI18nKeys.CopiedButtonLabel);
  });

  it('swaps to the QR view and back, moving focus each time', async () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    await user.click(
      screen.getByRole('button', { name: ShareI18nKeys.QrButtonLabel }),
    );

    expect(
      screen.getByRole('img', { name: ShareI18nKeys.QrCodeAriaLabel }),
    ).toBeTruthy();
    expect(screen.queryByDisplayValue(ITEM_URL)).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: ShareI18nKeys.LinkButtonLabel }),
    );

    await user.click(
      screen.getByRole('button', { name: ShareI18nKeys.LinkButtonLabel }),
    );

    expect(screen.getByDisplayValue(ITEM_URL)).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: ShareI18nKeys.QrButtonLabel }),
    );
  });

  it('keeps the access control and expiry note visible in the QR view', async () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    await user.click(
      screen.getByRole('button', { name: ShareI18nKeys.QrButtonLabel }),
    );

    expect(
      screen.getByRole('button', { name: ShareI18nKeys.AccessViewLabel }),
    ).toBeTruthy();
    expect(
      screen.getByRole('img', { name: ShareI18nKeys.QrCodeAriaLabel }),
    ).toBeTruthy();
    expect(screen.getByText(ShareI18nKeys.ExpiryNote)).toBeTruthy();
  });

  it('closes only the access dropdown on Escape while in the QR view', async () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    await user.click(
      screen.getByRole('button', { name: ShareI18nKeys.QrButtonLabel }),
    );
    await user.click(
      screen.getByRole('button', { name: ShareI18nKeys.AccessViewLabel }),
    );
    expect(screen.getByRole('menu')).toBeTruthy();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(
      screen.getByRole('img', { name: ShareI18nKeys.QrCodeAriaLabel }),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('returns to the link view on Escape from the QR view without closing', async () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    await user.click(
      screen.getByRole('button', { name: ShareI18nKeys.QrButtonLabel }),
    );
    await user.keyboard('{Escape}');

    expect(screen.getByDisplayValue(ITEM_URL)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape from the link view', async () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('traps Tab within the popover, wrapping from the last control back to the first', async () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    const qrButton = screen.getByRole('button', {
      name: ShareI18nKeys.QrButtonLabel,
    });
    const copyButton = screen.getByRole('button', {
      name: ShareI18nKeys.CopyButtonLabel,
    });

    copyButton.focus();
    await user.tab();
    expect(document.activeElement).toBe(qrButton);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(copyButton);
  });

  it('moves focus into the popover when it mounts', () => {
    vi.mocked(useShareLink).mockReturnValue(makeResult());
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    expect(document.activeElement).toBe(
      screen.getByRole('dialog', { name: ShareI18nKeys.Title }),
    );
  });

  it('shows a skeleton loading state while the link is not ready', () => {
    vi.mocked(useShareLink).mockReturnValue(
      makeResult({ data: undefined, isLoading: true }),
    );
    const { container } = render(
      <SharePopover item={makeItem()} onClose={onClose} />,
    );

    const status = screen.getByRole('status', {
      name: ShareI18nKeys.LoadingLabel,
    });
    expect(status).toBeTruthy();
    expect(container.querySelectorAll('[aria-hidden]').length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByDisplayValue(ITEM_URL)).toBeNull();
    expect(
      screen.queryByRole('button', { name: ShareI18nKeys.CopyButtonLabel }),
    ).toBeNull();
  });

  it('shows an error state when the link could not be created', () => {
    vi.mocked(useShareLink).mockReturnValue(
      makeResult({
        data: undefined,
        isLoading: false,
        error: new Error('network down'),
      }),
    );
    render(<SharePopover item={makeItem()} onClose={onClose} />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByDisplayValue(ITEM_URL)).toBeNull();
  });
});
