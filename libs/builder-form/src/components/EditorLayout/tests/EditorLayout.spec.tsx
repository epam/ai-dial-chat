import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorLayoutProps } from '../../../models/editor-layout-props';
import { EditorLayout } from '../EditorLayout';

const PHYSICAL_DIRECTION_CLASS =
  /\b(ml-|mr-|pl-|pr-|left-|right-|text-left|text-right|border-l|border-r)/;

const renderLayout = (props: Partial<EditorLayoutProps> = {}) =>
  render(
    <EditorLayout
      title="Create skill"
      onBack={vi.fn()}
      leftContent={<p>left column</p>}
      centerContent={<p>right column</p>}
      {...props}
    />,
  );

/* The side column is a plain wrapper with no role, so the only way to reach it is to walk up from its content. */
const getPanel = (): HTMLElement =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  screen.getByText('quality check').parentElement as HTMLElement;

describe('EditorLayout rightContent', () => {
  it('renders nothing for the side column without rightContent', () => {
    renderLayout();

    expect(screen.queryByText('quality check')).toBeNull();
  });

  it('renders the host content after the other columns', () => {
    renderLayout({ rightContent: <p>quality check</p> });

    const order = [
      screen.getByText('left column'),
      screen.getByText('right column'),
      screen.getByText('quality check'),
    ];
    order.slice(1).forEach((node, index) => {
      expect(
        order[index].compareDocumentPosition(node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it('adds no landmark of its own', () => {
    renderLayout({ rightContent: <p>quality check</p> });

    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('keeps the existing two-column markup when the panel is absent', () => {
    renderLayout();

    expect(screen.getByText('left column')).toBeTruthy();
    expect(screen.getByText('right column')).toBeTruthy();
  });

  it('uses logical direction classes only on the panel', () => {
    renderLayout({ rightContent: <p>quality check</p> });

    const panel = getPanel();
    // `w-[400px]` is a size, not a direction.
    const utilityClasses = panel.className.replace(/\[[^\]]*\]/g, '');
    expect(utilityClasses).not.toMatch(PHYSICAL_DIRECTION_CLASS);
    expect(panel.className).toContain('desktop:border-s');
  });
});

describe('EditorLayout resizableLeftColumn', () => {
  beforeEach(() => {
    /* jsdom has no PointerEvent, so fireEvent.pointer* would drop clientX and button. */
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        pointerId: number;

        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 0;
        }
      },
    );
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => true);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderResizable = (
    props: Partial<EditorLayoutProps> = {},
    width = 400,
  ) => {
    const onWidthChange = vi.fn();
    renderLayout({
      resizableLeftColumn: { width, onWidthChange },
      ...props,
    });

    return { onWidthChange, handle: screen.getByRole('separator') };
  };

  it('renders no separator without the prop', () => {
    renderLayout();

    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('renders no separator without a center column', () => {
    renderLayout({
      resizableLeftColumn: { width: 400, onWidthChange: vi.fn() },
      centerContent: undefined,
    });

    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('exposes separator semantics with the current limits', () => {
    const { handle } = renderResizable({}, 500);

    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-valuenow')).toBe('500');
    expect(handle.getAttribute('aria-valuemin')).toBe('280');
    expect(handle.getAttribute('aria-valuemax')).toBe('640');
    expect(handle.tabIndex).toBe(0);
    expect(handle.getAttribute('aria-label')).toBe('Resize columns');
  });

  it('uses the host-provided label', () => {
    renderResizable({ labels: { resizeHandleLabel: 'Resize panels' } });

    expect(
      screen.getByRole('separator', { name: 'Resize panels' }),
    ).toBeTruthy();
  });

  it('widens the column when dragged toward the inline end', () => {
    const { handle, onWidthChange } = renderResizable();

    fireEvent.pointerDown(handle, { clientX: 400, button: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 500, pointerId: 1 });

    expect(onWidthChange).toHaveBeenLastCalledWith(500);
  });

  it('clamps a drag at the maximum and the minimum', () => {
    const { handle, onWidthChange } = renderResizable();

    fireEvent.pointerDown(handle, { clientX: 400, button: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 5000, pointerId: 1 });
    expect(onWidthChange).toHaveBeenLastCalledWith(640);
    fireEvent.pointerMove(handle, { clientX: -5000, pointerId: 1 });
    expect(onWidthChange).toHaveBeenLastCalledWith(280);
  });

  it('mirrors the drag direction in RTL', () => {
    const { handle, onWidthChange } = renderResizable({ dir: 'rtl' });

    fireEvent.pointerDown(handle, { clientX: 400, button: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 300, pointerId: 1 });

    expect(onWidthChange).toHaveBeenLastCalledWith(500);
  });

  it('ignores pointer moves after release', () => {
    const { handle, onWidthChange } = renderResizable();

    fireEvent.pointerDown(handle, { clientX: 400, button: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 500, pointerId: 1 });

    expect(onWidthChange).not.toHaveBeenCalled();
  });

  it('resizes with the arrow keys', () => {
    const { handle, onWidthChange } = renderResizable();

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onWidthChange).toHaveBeenLastCalledWith(416);
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onWidthChange).toHaveBeenLastCalledWith(384);
  });

  it('mirrors the arrow keys in RTL', () => {
    const { handle, onWidthChange } = renderResizable({ dir: 'rtl' });

    fireEvent.keyDown(handle, { key: 'ArrowLeft' });

    expect(onWidthChange).toHaveBeenLastCalledWith(416);
  });

  it('jumps to the limits with Home and End', () => {
    const { handle, onWidthChange } = renderResizable();

    fireEvent.keyDown(handle, { key: 'Home' });
    expect(onWidthChange).toHaveBeenLastCalledWith(280);
    fireEvent.keyDown(handle, { key: 'End' });
    expect(onWidthChange).toHaveBeenLastCalledWith(640);
  });

  it('resets to the default width on double-click', () => {
    const { handle, onWidthChange } = renderResizable({}, 600);

    fireEvent.doubleClick(handle);

    expect(onWidthChange).toHaveBeenCalledWith(400);
  });

  it('uses logical direction classes only on the handle', () => {
    const { handle } = renderResizable();

    const utilityClasses = handle.className.replace(/\[[^\]]*\]/g, '');
    expect(utilityClasses).not.toMatch(PHYSICAL_DIRECTION_CLASS);
  });
});
