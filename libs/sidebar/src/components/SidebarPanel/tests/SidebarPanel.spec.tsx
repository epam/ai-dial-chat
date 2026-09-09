import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SidebarPanelProps } from '../../../models/panel-props';
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
    render(
      <SidebarPanel {...defaultProps}>
        <span />
      </SidebarPanel>,
    );
    expect(
      screen.getByRole('complementary', { name: 'Test panel' }),
    ).toBeTruthy();
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

  it('side=right: renders without a divider', () => {
    render(
      <SidebarPanel {...defaultProps} orientation={SidebarOrientation.Right}>
        <span />
      </SidebarPanel>,
    );
    const aside = screen.getByRole('complementary');
    expect(aside.classList.contains('border-s')).toBe(false);
    expect(aside.classList.contains('border-e')).toBe(false);
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

  it('side=left, open: applies the border-s divider facing the navigation rail', () => {
    render(
      <SidebarPanel
        {...defaultProps}
        orientation={SidebarOrientation.Left}
        isOpen
      >
        <span />
      </SidebarPanel>,
    );
    const aside = screen.getByRole('complementary');
    expect(aside.classList.contains('border-s')).toBe(true);
    expect(aside.classList.contains('border-e')).toBe(false);
  });

  it('side=left, closed: renders without a divider', () => {
    render(
      <SidebarPanel
        {...defaultProps}
        orientation={SidebarOrientation.Left}
        isOpen={false}
      >
        <span />
      </SidebarPanel>,
    );
    const aside = screen.getByRole('complementary');
    expect(aside.classList.contains('border-s')).toBe(false);
    expect(aside.classList.contains('border-e')).toBe(false);
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
    render(
      <SidebarPanel
        {...defaultProps}
        styles={{ colors: { background: '#ff0000' } }}
      >
        <span />
      </SidebarPanel>,
    );
    const style = screen.getByRole('complementary').getAttribute('style') ?? '';
    expect(style).toContain('--sb-bg: #ff0000');
  });

  it('no inline style when colors and typography are omitted', () => {
    render(
      <SidebarPanel {...defaultProps}>
        <span />
      </SidebarPanel>,
    );
    const style = screen.getByRole('complementary').getAttribute('style') ?? '';
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
    // eslint-disable-next-line testing-library/no-node-access -- the outermost width/style wrapper is a plain div with no accessible role or text
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
    // eslint-disable-next-line testing-library/no-node-access -- the outermost width/style wrapper is a plain div with no accessible role or text
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.width).toBe('360px');
  });
});

describe('SidebarPanel — open/close animation', () => {
  const getPanelWrapper = (props?: Partial<SidebarPanelProps>) => {
    const { container } = render(
      <SidebarPanel {...defaultProps} {...props}>
        <span />
      </SidebarPanel>,
    );

    // eslint-disable-next-line testing-library/no-node-access -- the outermost width/transition wrapper is a plain div with no accessible role or text
    return container.firstChild as HTMLElement;
  };

  it('keeps the stacking context while closed so the closing panel is not painted over', () => {
    expect(getPanelWrapper({ isOpen: false }).classList.contains('z-50')).toBe(
      true,
    );
  });

  it('does not fade the panel region in, which would show the content behind a half-open panel', () => {
    getPanelWrapper();
    expect(screen.getByRole('complementary').getAttribute('class')).not.toMatch(
      /appear/,
    );
  });

  it('overlay mode: keeps full width and sets no inline width, so the content does not reflow', () => {
    const wrapper = getPanelWrapper({
      isOpen: false,
      isOverlay: true,
      defaultWidth: 360,
    });
    expect(wrapper.style.width).toBe('');
    expect(wrapper.classList.contains('w-full')).toBe(true);
  });

  it('overlay mode: animates the transform instead of the layout width', () => {
    const wrapper = getPanelWrapper({ isOverlay: true });
    expect(wrapper.classList.contains('transition-transform')).toBe(true);
    expect(wrapper.classList.contains('transition-[width]')).toBe(false);
  });

  it('overlay mode, left orientation, closed: slides out through the start edge in both directions', () => {
    const wrapper = getPanelWrapper({
      isOpen: false,
      isOverlay: true,
      orientation: SidebarOrientation.Left,
    });
    expect(wrapper.classList.contains('ltr:-translate-x-full')).toBe(true);
    expect(wrapper.classList.contains('rtl:translate-x-full')).toBe(true);
  });

  it('overlay mode, right orientation, closed: slides out through the end edge in both directions', () => {
    const wrapper = getPanelWrapper({
      isOpen: false,
      isOverlay: true,
      orientation: SidebarOrientation.Right,
    });
    expect(wrapper.classList.contains('ltr:translate-x-full')).toBe(true);
    expect(wrapper.classList.contains('rtl:-translate-x-full')).toBe(true);
  });

  it('overlay mode, open: rests at translate-x-0 so both states declare a transform', () => {
    expect(
      getPanelWrapper({ isOverlay: true }).classList.contains('translate-x-0'),
    ).toBe(true);
  });

  it('non-overlay mode: still animates the layout width', () => {
    const wrapper = getPanelWrapper();
    expect(wrapper.classList.contains('transition-[width]')).toBe(true);
    expect(wrapper.classList.contains('transition-transform')).toBe(false);
  });

  it('honours a reduced-motion preference', () => {
    expect(
      getPanelWrapper().classList.contains('motion-reduce:transition-none'),
    ).toBe(true);
  });

  it('keeps the header actions mounted while closed so they do not pop in mid-animation', () => {
    getPanelWrapper({
      isOpen: false,
      leftActions: <button aria-label="search" />,
      rightActions: <button aria-label="download" />,
    });
    expect(screen.getByRole('button', { name: 'search' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'download' })).toBeTruthy();
  });

  it('marks the closed panel region inert so the mounted actions stay out of the tab order', () => {
    getPanelWrapper({ isOpen: false });
    expect(screen.getByRole('complementary').hasAttribute('inert')).toBe(true);
  });
});
