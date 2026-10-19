import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
