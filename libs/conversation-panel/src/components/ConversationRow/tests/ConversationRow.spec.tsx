import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FilterTab } from '../../../types/conversation-classification';
import { ConversationRow } from '../ConversationRow';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Small: 'small', Standard: 'standard', Large: 'large' },
  DialSkeletonVariant: { Circular: 'circular' },
  DialSkeleton: ({
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
  Highlight: ({ text }: { text: string }) => <span>{text}</span>,
  Button: ({
    iconBefore,
    label,
    iconAfter,
    'aria-current': ariaCurrent,
    onClick,
  }: {
    iconBefore?: React.ReactNode;
    label?: React.ReactNode;
    iconAfter?: React.ReactNode;
    'aria-current'?: React.AriaAttributes['aria-current'];
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button aria-current={ariaCurrent} onClick={onClick}>
      {iconBefore}
      {label}
      {iconAfter}
    </button>
  ),
  DialEllipsisTooltip: ({ text }: { text: string }) => <span>{text}</span>,
  DialDropdown: ({
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
  IconClock: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="task-badge-icon" aria-hidden={props['aria-hidden']} />
  ),
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

  it('renders the task badge when showTaskBadge is true', () => {
    render(
      <ConversationRow
        item={{ ...baseItem, showTaskBadge: true, taskBadgeLabel: 'TASK' }}
        isActive={false}
        onSelectConversation={vi.fn()}
      />,
    );

    expect(screen.getByText('TASK')).toBeTruthy();
    expect(screen.getByTestId('task-badge-icon')).toBeTruthy();
  });

  it('does not render the task badge when showTaskBadge is omitted', () => {
    render(
      <ConversationRow
        item={baseItem}
        isActive={false}
        onSelectConversation={vi.fn()}
      />,
    );

    expect(screen.queryByText('TASK')).toBeNull();
    expect(screen.queryByTestId('task-badge-icon')).toBeNull();
  });

  it('does not render the task badge when showTaskBadge is false', () => {
    render(
      <ConversationRow
        item={{ ...baseItem, showTaskBadge: false, taskBadgeLabel: 'TASK' }}
        isActive={false}
        onSelectConversation={vi.fn()}
      />,
    );

    expect(screen.queryByText('TASK')).toBeNull();
  });

  it('marks the task badge icon as aria-hidden', () => {
    render(
      <ConversationRow
        item={{ ...baseItem, showTaskBadge: true, taskBadgeLabel: 'TASK' }}
        isActive={false}
        onSelectConversation={vi.fn()}
      />,
    );

    expect(
      screen.getByTestId('task-badge-icon').getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('clicking the task badge selects the conversation like any other row click', () => {
    const onSelectConversation = vi.fn();
    render(
      <ConversationRow
        item={{ ...baseItem, showTaskBadge: true, taskBadgeLabel: 'TASK' }}
        isActive={false}
        onSelectConversation={onSelectConversation}
      />,
    );

    fireEvent.click(screen.getByText('TASK'));

    expect(onSelectConversation).toHaveBeenCalledWith(baseItem.id);
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
});
