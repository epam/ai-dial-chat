import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationSource } from '../../../types/conversation-source';
import { ConversationRow } from '../ConversationRow';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ButtonAppearance: { Ghost: 'ghost' },
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
  DialButton: ({
    iconBefore,
    label,
    'aria-current': ariaCurrent,
    onClick,
  }: {
    iconBefore?: React.ReactNode;
    label?: React.ReactNode;
    'aria-current'?: React.AriaAttributes['aria-current'];
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button aria-current={ariaCurrent} onClick={onClick}>
      {iconBefore}
      {label}
    </button>
  ),
  DialEllipsisTooltip: ({ text }: { text: string }) => <span>{text}</span>,
  DialDropdown: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DialIconButton: ({ 'aria-label': ariaLabel }: { 'aria-label'?: string }) => (
    <button aria-label={ariaLabel} />
  ),
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
}));

const baseItem = {
  id: 'c1',
  title: 'My chat',
  source: ConversationSource.MyChats,
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
});
