import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BUILDER_FORM_CLASS } from '../../../constants/public-class-names';
import { EditorLayout } from '../../EditorLayout/EditorLayout';
import { EditorSection } from '../EditorSection';

/*
 * The public class names are this package's styling contract. A lost class
 * fails silently — the build passes and a host's stylesheet simply stops
 * applying — so both are asserted here rather than left to review.
 *
 * Neither element carries a role of its own, so each case locates content by
 * text or heading first and walks up to the stamped element.
 */

/*
 * Walking up to an unlabeled container is the only way to assert a class on it:
 * the element has no role or text of its own, and querying *by* the class would
 * still pass with the class on the wrong node.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  from.closest(`.${className}`);

describe('builder-form — public class names', () => {
  it('stamps every editor section, titled or not', () => {
    render(
      <>
        <EditorSection title="Metadata">
          <p>Named body</p>
        </EditorSection>
        <EditorSection>
          <p>Untitled body</p>
        </EditorSection>
      </>,
    );

    for (const text of ['Named body', 'Untitled body']) {
      expect(
        closestWithClass(screen.getByText(text), BUILDER_FORM_CLASS.section),
      ).toBeTruthy();
    }
  });

  it('stamps the editor layout root', () => {
    render(
      <EditorLayout
        title="Create toolset"
        onBack={vi.fn()}
        leftContent={<p>Left column</p>}
      />,
    );

    expect(
      closestWithClass(
        screen.getByText('Left column'),
        BUILDER_FORM_CLASS.layout,
      ),
    ).toBeTruthy();
  });

  it('keeps a caller className alongside the section class', () => {
    render(
      <EditorSection className="host-section">
        <p>Body</p>
      </EditorSection>,
    );

    const section = closestWithClass(
      screen.getByText('Body'),
      BUILDER_FORM_CLASS.section,
    );
    expect(section!.classList).toContain('host-section');
  });
});
