import { FilterTab } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationRow } from '../ConversationRow';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Small: 'small', Standard: 'standard', Large: 'large' },
  SkeletonVariant: { Circular: 'circular' },
  Skeleton: ({
    variant,
    width,
    height,
    'aria-hidden': ariaHidden,
  }: {
    variant: string;
    width: number;
    height: number;
    'aria-hidden'?: boolean;
  }) => (
    <div
      data-testid="dial-skeleton"
      data-variant={variant}
      data-width={width}
      data-height={height}
      aria-hidden={ariaHidden ? 'true' : undefined}
    />
  ),
  Highlight: ({ text, className }: { text: string; className?: string }) => (
    <span className={className}>{text}</span>
  ),
  Button: ({
    iconBefore,
    label,
    iconAfter,
    'aria-current': ariaCurrent,
    onClick,
    className,
  }: {
    iconBefore?: React.ReactNode;
    label?: React.ReactNode;
    iconAfter?: React.ReactNode;
    'aria-current'?: React.AriaAttributes['aria-current'];
    onClick?: () => void;
    className?: string;
    [key: string]: unknown;
  }) => (
    <button aria-current={ariaCurrent} onClick={onClick} className={className}>
      {iconBefore}
      {label}
      {iconAfter}
    </button>
  ),
  EllipsisTooltip: ({ text }: { text: string }) => <span>{text}</span>,
  Dropdown: ({
    children,
    onOpenChange,
  }: {
    children: React.ReactElement<{ onClick?: () => void }>;
    onOpenChange?: (isOpen: boolean) => void;
  }) =>
    React.cloneElement(children, {
      onClick: () => onOpenChange?.(true),
    }),
  GhostIconButton: React.forwardRef<
    HTMLButtonElement,
    { 'aria-label'?: string; onClick?: () => void }
  >(({ 'aria-label': ariaLabel, onClick }, ref) => (
    <button ref={ref} aria-label={ariaLabel} onClick={onClick} />
  )),
}));

vi.mock('@epam/ai-dial-chat-shared', () => ({
  FilterTab: {
    All: 'all',
    Pinned: 'pinned',
    MyChats: 'my-chats',
    Shared: 'shared',
    Organization: 'organization',
  },
  mergeClasses: (...classes: (string | undefined | null | false)[]) =>
    classes.filter(Boolean).join(' '),
  DeploymentIcon: ({ src, tooltip }: { src?: string; tooltip?: string }) => (
    <img
      data-testid="deployment-icon"
      src={src}
      alt={tooltip ?? 'deployment-icon'}
    />
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconDotsVertical: () => <span>dots</span>,
}));

const baseItem = {
  id: 'c1',
  title: 'My chat',
  source: FilterTab.MyChats,
};

describe('ConversationRow', () => {
  it('renders a skeleton when isIconLoading is true', () => {
    render(
      <ConversationRow
        item={{ ...baseItem, isIconLoading: true }}
        isActive={false}
        onSelectConversation={vi.fn()}
      />,
    );
    expect(screen.getByTestId('dial-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('deployment-icon')).toBeNull();
  });

  it('skeleton has aria-hidden="true"', () => {
    render(
      <ConversationRow
        item={{ ...baseItem, isIconLoading: true }}
        isActive={false}
        onSelectConversation={vi.fn()}
      />,
    );
    const skeleton = screen.getByTestId('dial-skeleton');
    expect(skeleton.getAttribute('aria-hidden')).toBe('true');
  });

  it('skeleton is rendered with Circular variant at DIAL_ICON_SIZE.LG dimensions', () => {
    render(
      <ConversationRow
        item={{ ...baseItem, isIconLoading: true }}
        isActive={false}
        onSelectConversation={vi.fn()}
      />,
    );
    const skeleton = screen.getByTestId('dial-skeleton');
    expect(skeleton.getAttribute('data-variant')).toBe('circular');
    expect(skeleton.getAttribute('data-width')).toBe('24');
    expect(skeleton.getAttribute('data-height')).toBe('24');
  });

  it('renders DeploymentIcon when isIconLoading is false and iconUrl is set', () => {
    render(
      <ConversationRow
        item={{
          ...baseItem,
          isIconLoading: false,
          iconUrl: 'https://example.com/icon.png',
        }}
        isActive={false}
        onSelectConversation={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('dial-skeleton')).toBeNull();
    const icon = screen.getByTestId('deployment-icon');
    expect(icon.getAttribute('src')).toBe('https://example.com/icon.png');
  });

  it('renders DeploymentIcon when isIconLoading is omitted', () => {
    render(
      <ConversationRow
        item={{ ...baseItem, iconUrl: 'https://example.com/icon.png' }}
        isActive={false}
        onSelectConversation={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('dial-skeleton')).toBeNull();
    expect(screen.getByTestId('deployment-icon')).toBeTruthy();
  });

  it('renders DeploymentIcon fallback when isIconLoading is false and iconUrl is absent', () => {
    render(
      <ConversationRow
        item={{ ...baseItem, isIconLoading: false }}
        isActive={false}
        onSelectConversation={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('dial-skeleton')).toBeNull();
    expect(screen.getByTestId('deployment-icon')).toBeTruthy();
  });

  it('exposes the action trigger when its menu opens', () => {
    const onActionMenuOpen = vi.fn();
    render(
      <ConversationRow
        item={baseItem}
        isActive={false}
        onSelectConversation={vi.fn()}
        getActions={() => [{ key: 'publish', label: 'Publish' }]}
        onActionMenuOpen={onActionMenuOpen}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'More actions' });
    fireEvent.click(trigger);

    expect(onActionMenuOpen).toHaveBeenCalledWith(baseItem, trigger);
  });

  describe('leading icon', () => {
    const taskIcon = <svg data-testid="task-icon" aria-hidden="true" />;

    it('renders the leading icon instead of the deployment icon', () => {
      render(
        <ConversationRow
          item={{
            ...baseItem,
            leadingIcon: taskIcon,
            iconUrl: 'https://example.com/icon.png',
          }}
          isActive={false}
          onSelectConversation={vi.fn()}
        />,
      );

      expect(screen.getByTestId('task-icon')).toBeTruthy();
      expect(screen.queryByTestId('deployment-icon')).toBeNull();
    });

    it('renders the leading icon even while deployment icons are loading', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, leadingIcon: taskIcon, isIconLoading: true }}
          isActive={false}
          onSelectConversation={vi.fn()}
        />,
      );

      expect(screen.getByTestId('task-icon')).toBeTruthy();
      expect(screen.queryByTestId('dial-skeleton')).toBeNull();
    });

    it('keeps the deployment icon when no leading icon is given', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, iconUrl: 'https://example.com/icon.png' }}
          isActive={false}
          onSelectConversation={vi.fn()}
        />,
      );

      expect(screen.getByTestId('deployment-icon')).toBeTruthy();
    });

    it('puts the leading icon in the same 24px slot as the avatar', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, leadingIcon: taskIcon }}
          isActive={false}
          onSelectConversation={vi.fn()}
        />,
      );

      // eslint-disable-next-line testing-library/no-node-access -- the slot wrapper has no role; its size is the contract under test
      const slot = screen.getByTestId('task-icon').parentElement;
      expect(slot?.classList.contains('size-6')).toBe(true);
    });

    it('does not render any TASK pill', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, leadingIcon: taskIcon, isUnread: true }}
          isActive={false}
          onSelectConversation={vi.fn()}
        />,
      );

      expect(screen.queryByText('TASK')).toBeNull();
    });
  });

  describe('unread indicator', () => {
    it('renders the unread dot with an accessible label when isUnread is true', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, isUnread: true }}
          isActive={false}
          onSelectConversation={vi.fn()}
        />,
      );

      expect(screen.getByText('Unread')).toBeTruthy();
    });

    it('does not render the unread dot when isUnread is omitted', () => {
      render(
        <ConversationRow
          item={baseItem}
          isActive={false}
          onSelectConversation={vi.fn()}
        />,
      );

      expect(screen.queryByText('Unread')).toBeNull();
    });

    it('does not render the unread dot when isUnread is false', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, isUnread: false }}
          isActive={false}
          onSelectConversation={vi.fn()}
        />,
      );

      expect(screen.queryByText('Unread')).toBeNull();
    });

    it('uses a custom unreadIndicatorLabel when provided', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, isUnread: true }}
          isActive={false}
          onSelectConversation={vi.fn()}
          unreadIndicatorLabel="New task"
        />,
      );

      expect(screen.getByText('New task')).toBeTruthy();
      expect(screen.queryByText('Unread')).toBeNull();
    });

    it('renders the unread indicator after the title, at the trailing edge', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, isUnread: true }}
          isActive={false}
          onSelectConversation={vi.fn()}
        />,
      );

      const title = screen.getByText('My chat');
      const label = screen.getByText('Unread');
      expect(
        title.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('uses logical spacing only, so the indicator stays at the end in RTL', () => {
      render(
        <div dir="rtl">
          <ConversationRow
            item={{ ...baseItem, isUnread: true }}
            isActive={false}
            onSelectConversation={vi.fn()}
          />
        </div>,
      );

      const button = screen.getByRole('button');
      expect(button.className).not.toMatch(/\b(pl|pr|ml|mr|left|right)-/);
      // eslint-disable-next-line testing-library/no-node-access -- the indicator wrapper has no role
      const indicator = screen.getByText('Unread').parentElement;
      expect(indicator?.className).not.toMatch(/\b(pl|pr|ml|mr|left|right)-/);
    });

    it('sets the title in the semibold style while unread', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, isUnread: true }}
          isActive={false}
          onSelectConversation={vi.fn()}
          itemTitleClassName="dial-small-text"
        />,
      );

      expect(
        screen.getByText('My chat').classList.contains('dial-small-semi-text'),
      ).toBe(true);
    });

    it('keeps the regular title style when read', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, isUnread: false }}
          isActive={false}
          onSelectConversation={vi.fn()}
        />,
      );

      const title = screen.getByText('My chat');
      expect(title.classList.contains('dial-small-text')).toBe(true);
      expect(title.classList.contains('dial-small-semi-text')).toBe(false);
    });

    it('starts a read row with plain start padding and no reserved indicator slot', () => {
      render(
        <ConversationRow
          item={baseItem}
          isActive={false}
          onSelectConversation={vi.fn()}
        />,
      );

      const button = screen.getByRole('button');
      expect(button.classList.contains('ps-3')).toBe(true);
      expect(button.classList.contains('ps-0')).toBe(false);
    });

    it('hides the dot while the actions menu is open but keeps announcing unread', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, isUnread: true }}
          isActive={false}
          onSelectConversation={vi.fn()}
          getActions={() => [{ key: 'rename', label: 'Rename' }]}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

      const label = screen.getByText('Unread');
      // eslint-disable-next-line testing-library/no-node-access -- the dot is aria-hidden and has no accessible handle
      const dot = label.previousElementSibling;
      expect(dot?.classList.contains('opacity-0')).toBe(true);
      expect(label.classList.contains('sr-only')).toBe(true);
    });

    it('hides the dot on hover and focus when the row has actions', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, isUnread: true }}
          isActive={false}
          onSelectConversation={vi.fn()}
          getActions={() => [{ key: 'rename', label: 'Rename' }]}
        />,
      );

      // eslint-disable-next-line testing-library/no-node-access -- the dot is aria-hidden and has no accessible handle
      const dot = screen.getByText('Unread').previousElementSibling;
      expect(dot?.className).toContain('group-hover/conversation:opacity-0');
      expect(dot?.className).toContain(
        'group-focus-within/conversation:opacity-0',
      );
    });

    it('keeps the dot visible when the row has no actions', () => {
      render(
        <ConversationRow
          item={{ ...baseItem, isUnread: true }}
          isActive={false}
          onSelectConversation={vi.fn()}
        />,
      );

      // eslint-disable-next-line testing-library/no-node-access -- the dot is aria-hidden and has no accessible handle
      const dot = screen.getByText('Unread').previousElementSibling;
      expect(dot?.className).not.toContain('opacity-0');
    });

    it('clicking the row with an unread dot still selects the conversation', () => {
      const onSelectConversation = vi.fn();
      render(
        <ConversationRow
          item={{ ...baseItem, isUnread: true }}
          isActive={false}
          onSelectConversation={onSelectConversation}
        />,
      );

      fireEvent.click(screen.getByRole('button'));

      expect(onSelectConversation).toHaveBeenCalledWith(baseItem.id);
    });
  });

  /*
   * The row's corner radius is a CSS custom property read by the stylesheet
   * (--cp-row-radius), so what a DOM test can pin is that the row no longer
   * hardcodes a radius utility while keeping its layout utilities.
   */
  it('sets no radius utility on the row button', () => {
    render(
      <ConversationRow
        item={baseItem}
        isActive={false}
        onSelectConversation={vi.fn()}
      />,
    );

    const button = screen.getByRole('button');
    expect(button.className).not.toMatch(/rounded-/);
    expect(button.classList.contains('h-8')).toBe(true);
    expect(button.classList.contains('w-full')).toBe(true);
  });
});
