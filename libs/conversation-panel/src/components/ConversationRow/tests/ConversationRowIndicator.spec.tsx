import { FilterTab } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationRowVariant } from '../../../types/conversation-row-variant';
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
      role="progressbar"
      aria-label="loading skeleton"
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
    items,
    onOpenChange,
  }: {
    children: React.ReactElement<{ onClick?: () => void }>;
    items?: Array<{ key: string; label: React.ReactNode }>;
    onOpenChange?: (isOpen: boolean) => void;
  }) => (
    <>
      {React.cloneElement(children, {
        onClick: () => onOpenChange?.(true),
      })}
      <ul aria-label="menu items">
        {items?.map((menuItem) => (
          <li key={menuItem.key}>{menuItem.label}</li>
        ))}
      </ul>
    </>
  ),
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
    <img src={src} alt={tooltip ?? 'deployment-icon'} />
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconDotsVertical: () => <span>dots</span>,
}));

const baseItem = {
  id: 'c1',
  title: 'My chat',
  source: FilterTab.MyChats,
  iconUrl: 'https://example.com/icon.svg',
  iconTooltip: 'GPT',
};

const renderIndicator = (
  item: Partial<typeof baseItem> & {
    isUnread?: boolean;
    leadingIcon?: React.ReactNode;
  } = {},
  props: { isActive?: boolean } = {},
) =>
  render(
    <ConversationRow
      item={{ ...baseItem, ...item }}
      isActive={props.isActive ?? false}
      onSelectConversation={vi.fn()}
      variant={ConversationRowVariant.Indicator}
      getActions={() => [{ key: 'delete', label: 'Delete' }]}
    />,
  );

describe('ConversationRow — Indicator variant', () => {
  it('renders neither the deployment avatar nor the loading skeleton', () => {
    renderIndicator({ isIconLoading: true } as never);

    expect(screen.queryByRole('img', { name: 'deployment-icon' })).toBeNull();
    expect(
      screen.queryByRole('progressbar', {
        name: 'loading skeleton',
        hidden: true,
      }),
    ).toBeNull();
  });

  it('ignores a host-supplied leading icon', () => {
    renderIndicator({ leadingIcon: <span>task-glyph</span> });

    expect(screen.queryByText('task-glyph')).toBeNull();
  });

  it('names the row by its title only for a read conversation', () => {
    renderIndicator();

    expect(screen.getByRole('button', { name: 'My chat' })).toBeTruthy();
    expect(screen.queryByText('Unread')).toBeNull();
  });

  it('announces the unread state and sets the title semi-bold', () => {
    renderIndicator({ isUnread: true });

    expect(screen.getByText('Unread')).toBeTruthy();
    expect(screen.getByText('My chat').className).toContain(
      'dial-small-semi-text',
    );
  });

  it('marks the active conversation as the current page', () => {
    renderIndicator({}, { isActive: true });

    expect(
      screen
        .getByRole('button', { name: 'My chat' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('keeps the row actions trigger', () => {
    renderIndicator();

    expect(screen.getByRole('button', { name: 'More actions' })).toBeTruthy();
  });

  it('keeps the deployment avatar in the default variant', () => {
    render(
      <ConversationRow
        item={baseItem}
        isActive={false}
        onSelectConversation={vi.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: 'deployment-icon' })).toBeTruthy();
  });
});
