import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SidebarOrientation } from '../../../types/orientation';
import { SidebarPanel } from '../SidebarPanel';

// Minimal mock so DialGhostIconButton passes through aria-label and calls onClick.
vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { LG: 24 },
  DialGhostIconButton: ({
    'aria-label': ariaLabel,
    onClick,
  }: {
    'aria-label': string;
    onClick: () => void;
  }) => <button type="button" aria-label={ariaLabel} onClick={onClick} />,
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
  ariaLabel: 'Test panel',
  closeLabel: 'Close',
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

  it('side=right: applies border-l divider', () => {
    const { container } = render(
      <SidebarPanel {...defaultProps} orientation={SidebarOrientation.Right}>
        <span />
      </SidebarPanel>,
    );
    expect(
      container.querySelector('aside')?.classList.contains('border-l'),
    ).toBe(true);
    expect(
      container.querySelector('aside')?.classList.contains('border-r'),
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

  it('side=left: applies border-r divider', () => {
    const { container } = render(
      <SidebarPanel {...defaultProps} orientation={SidebarOrientation.Left}>
        <span />
      </SidebarPanel>,
    );
    expect(
      container.querySelector('aside')?.classList.contains('border-r'),
    ).toBe(true);
    expect(
      container.querySelector('aside')?.classList.contains('border-l'),
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
});
