/*
 * Guard tests for this package's public `dial-*` class contract — see the
 * "Public class names" section of openspec/lib-styling-guide.md.
 *
 * A styling hook sits on an unlabeled wrapper with no accessible role or text
 * of its own, so asserting one is inherently a DOM-level check and Testing
 * Library has no semantic equivalent of "is this class on that element's
 * ancestor". Every test still locates a real element by role, label or text
 * first and only then walks to the container under test, so a class landing on
 * the wrong node fails rather than passes. Hence the rule exemption below.
 */
/* eslint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SIDEBAR_CLASS } from '../../../constants/public-class-names';
import { SidebarOrientation } from '../../../types/orientation';
import { SidebarPanel } from '../SidebarPanel';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { LG: 24 },
  GhostIconButton: ({
    'aria-label': ariaLabel,
    onClick,
  }: {
    'aria-label': string;
    onClick: () => void;
  }) => <button type="button" aria-label={ariaLabel} onClick={onClick} />,
  EllipsisTooltip: ({ text }: { text: React.ReactNode }) => <span>{text}</span>,
  ResizableContainerSide: {
    Left: 'left',
    Right: 'right',
  },
  ConditionalResizableContainer: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div>{children}</div>,
}));

const defaultProps = {
  isOpen: true,
  orientation: SidebarOrientation.Right,
  onClose: vi.fn(),
  labels: { ariaLabel: 'Test panel', closeLabel: 'Close' },
};

describe('SidebarPanel — public class names', () => {
  it('marks the aside element found by its role', () => {
    render(
      <SidebarPanel {...defaultProps} title="Conversations">
        <span />
      </SidebarPanel>,
    );

    expect(
      screen.getByRole('complementary', { name: 'Test panel' }).classList,
    ).toContain(SIDEBAR_CLASS.aside);
  });

  it('marks the header bar that carries the title', () => {
    render(
      <SidebarPanel {...defaultProps} title="Conversations">
        <span />
      </SidebarPanel>,
    );

    expect(
      screen.getByText('Conversations').closest(`.${SIDEBAR_CLASS.header}`),
    ).toBeTruthy();
  });

  it('keeps the aside addressable when the host localises its label', () => {
    render(
      <SidebarPanel
        {...defaultProps}
        labels={{ ariaLabel: 'Панель', closeLabel: 'Закрыть' }}
      >
        <span />
      </SidebarPanel>,
    );

    expect(
      screen.getByRole('complementary', { name: 'Панель' }).classList,
    ).toContain(SIDEBAR_CLASS.aside);
  });
});

describe('SidebarPanel — host style hooks', () => {
  it('merges headerClassName onto the header bar, replacing its own height', () => {
    render(
      <SidebarPanel
        {...defaultProps}
        title="Conversations"
        styles={{ headerClassName: 'h-[64px]' }}
      >
        <span />
      </SidebarPanel>,
    );

    const header = screen
      .getByText('Conversations')
      .closest(`.${SIDEBAR_CLASS.header}`);

    expect(header?.classList).toContain('h-[64px]');
    expect(header?.classList).not.toContain('h-12');
  });

  it('merges headerActionsClassName onto the cluster holding the end actions', () => {
    render(
      <SidebarPanel
        {...defaultProps}
        rightActions={<button type="button" aria-label="Download" />}
        styles={{ headerActionsClassName: 'gap-4' }}
      >
        <span />
      </SidebarPanel>,
    );

    const cluster = screen.getByRole('button', {
      name: 'Download',
    }).parentElement;

    expect(cluster?.classList).toContain('gap-4');
    /* The close button shares the cluster, so it is the trailing group. */
    expect(cluster?.querySelectorAll('button')).toHaveLength(2);
  });

  it('leaves the action cluster untouched when the host passes no class', () => {
    render(
      <SidebarPanel
        {...defaultProps}
        rightActions={<button type="button" aria-label="Download" />}
      >
        <span />
      </SidebarPanel>,
    );

    expect(
      screen.getByRole('button', { name: 'Download' }).parentElement?.className,
    ).toBe('flex items-center gap-1');
  });
});
