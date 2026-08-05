import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SidebarOrientation } from '../../../types/orientation';
import { SidebarPanel } from '../SidebarPanel';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { LG: 24 },
  GhostIconButton: ({
    'aria-label': ariaLabel,
    onClick,
  }: {
    'aria-label': string;
    onClick: () => void;
  }) => <button type="button" aria-label={ariaLabel} onClick={onClick} />,
  DialEllipsisTooltip: ({ text }: { text: React.ReactNode }) => (
    <span>{text}</span>
  ),
  ResizableContainerSide: {
    Left: 'left',
    Right: 'right',
  },
  DialConditionalResizableContainer: ({
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

describe('SidebarPanel', () => {
  it('renders children in the body', () => {
    render(
      <SidebarPanel {...defaultProps}>
        <p>body content</p>
      </SidebarPanel>,
    );
    expect(screen.getByText('body content')).toBeTruthy();
  });

  it('has role=complementary and aria-label', () => {
    const { container } = render(
      <SidebarPanel {...defaultProps}>
        <span />
      </SidebarPanel>,
    );
    const aside = container.querySelector('aside');
    expect(aside?.getAttribute('role')).toBe('complementary');
    expect(aside?.getAttribute('aria-label')).toBe('Test panel');
  });

  it('renders leftActions in the left header group', () => {
    render(
      <SidebarPanel
        {...defaultProps}
        leftActions={<button aria-label="search" />}
      >
        <span />
      </SidebarPanel>,
    );
    expect(screen.getByRole('button', { name: 'search' })).toBeTruthy();
  });

  it('renders rightActions in the right header group', () => {
    render(
      <SidebarPanel
        {...defaultProps}
        rightActions={<button aria-label="download" />}
      >
        <span />
      </SidebarPanel>,
    );
    expect(screen.getByRole('button', { name: 'download' })).toBeTruthy();
  });

  // --- side='right' close placement ---
  it('side=right: close button is in the right group (last button)', () => {
    render(
      <SidebarPanel
        {...defaultProps}
        orientation={SidebarOrientation.Right}
        rightActions={<button aria-label="download" />}
      >
        <span />
      </SidebarPanel>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[buttons.length - 1].getAttribute('aria-label')).toBe(
      'Close',
    );
  });

  it('side=right: applies border-s divider', () => {
    const { container } = render(
      <SidebarPanel {...defaultProps} orientation={SidebarOrientation.Right}>
        <span />
      </SidebarPanel>,
    );
    expect(
      container.querySelector('aside')?.classList.contains('border-s'),
    ).toBe(true);
    expect(
      container.querySelector('aside')?.classList.contains('border-e'),
    ).toBe(false);
  });

  // --- side='left' close placement ---
  it('side=left: close button is rendered after right actions (last button)', () => {
    render(
      <SidebarPanel
        {...defaultProps}
        orientation={SidebarOrientation.Left}
        rightActions={<button aria-label="download" />}
      >
        <span />
      </SidebarPanel>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[buttons.length - 1].getAttribute('aria-label')).toBe(
      'Close',
    );
  });

  it('side=left: applies border-e divider', () => {
    const { container } = render(
      <SidebarPanel {...defaultProps} orientation={SidebarOrientation.Left}>
        <span />
      </SidebarPanel>,
    );
    expect(
      container.querySelector('aside')?.classList.contains('border-e'),
    ).toBe(true);
    expect(
      container.querySelector('aside')?.classList.contains('border-s'),
    ).toBe(false);
  });

  it('close button calls onClose', async () => {
    const onClose = vi.fn();
    render(
      <SidebarPanel {...defaultProps} onClose={onClose}>
        <span />
      </SidebarPanel>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('colors prop emits CSS custom properties', () => {
    const { container } = render(
      <SidebarPanel
        {...defaultProps}
        styles={{ colors: { background: '#ff0000' } }}
      >
        <span />
      </SidebarPanel>,
    );
    const style = container.querySelector('aside')?.getAttribute('style') ?? '';
    expect(style).toContain('--sb-bg: #ff0000');
  });

  it('no inline style when colors and typography are omitted', () => {
    const { container } = render(
      <SidebarPanel {...defaultProps}>
        <span />
      </SidebarPanel>,
    );
    const style = container.querySelector('aside')?.getAttribute('style') ?? '';
    expect(style).not.toContain('--sb-bg');
  });

  it('w-full className overrides inline width', () => {
    const { container } = render(
      <SidebarPanel
        {...defaultProps}
        styles={{ className: 'w-full' }}
        defaultWidth={360}
      >
        <span />
      </SidebarPanel>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('w-full')).toBe(true);
    expect(wrapper.style.width).toBe('');
  });

  it('applies inline width when w-full className is absent', () => {
    const { container } = render(
      <SidebarPanel {...defaultProps} defaultWidth={360}>
        <span />
      </SidebarPanel>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.width).toBe('360px');
  });
});
