import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QUOTATIONS_CLASS } from '../../../constants/public-class-names';
import { CitationMarker } from '../CitationMarker';

const defaultLabels = {
  ariaLabel: 'Citation from Wikipedia',
  label: 'Wikipedia',
  labelWithOverflow: 'Wikipedia +2',
};

const renderMarker = (
  props: Partial<Parameters<typeof CitationMarker>[0]> = {},
) =>
  render(
    <CitationMarker
      sourceName="Wikipedia"
      annotationCount={1}
      onOpen={vi.fn()}
      labels={defaultLabels}
      {...props}
    />,
  );

/*
 * The kit button's text box carries the truncation but has no role or text of
 * its own, so a test can only reach it from the label inside it.
 */
const parentOf = (element: Element): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  element.parentElement;

describe('CitationMarker', () => {
  it('uses the single label when annotationCount is 1', () => {
    renderMarker({ annotationCount: 1 });
    expect(screen.getByText('Wikipedia')).toBeTruthy();
  });

  it('uses the overflow label when annotationCount > 1', () => {
    renderMarker({ annotationCount: 3 });
    expect(screen.getByText('Wikipedia +2')).toBeTruthy();
  });

  it('calls onOpen when clicked', async () => {
    const onOpen = vi.fn();
    renderMarker({ onOpen });
    await userEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('renders without an icon by default', () => {
    renderMarker();
    expect(screen.queryByRole('img', { name: 'link icon' })).toBeFalsy();
  });

  it('renders the provided icon before the label', () => {
    renderMarker({
      icon: <svg role="img" aria-label="link icon" />,
    });
    expect(screen.getByRole('img', { name: 'link icon' })).toBeTruthy();
  });

  it('caps the marker width and ellipsises a long source name', () => {
    const longName =
      'Expertise publications/ep_en_digital-adoption-in-personal-pc-insurance-in-southern-asia-webb.pdf, page 3';
    renderMarker({
      labels: { ...defaultLabels, label: longName },
    });

    expect(screen.getByRole('button').className).toContain('max-w-[240px]');

    /*
     * The truncation lives on the text box the kit button wraps the label in,
     * which has no role or text of its own — the label inside it is the only
     * thing a query can reach, so the assertion walks up one level.
     */
    const labelWrapper = parentOf(screen.getByText(longName));
    expect(labelWrapper?.className).toContain('truncate');
    expect(labelWrapper?.className).toContain('min-w-0');
  });

  it('keeps the descriptive aria-label rather than the raw source name', () => {
    renderMarker();
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe(
      'Citation from Wikipedia',
    );
  });
});

describe('CitationMarker — public class names', () => {
  it('stamps the marker pill', () => {
    renderMarker();

    expect(screen.getByRole('button').classList).toContain(
      QUOTATIONS_CLASS.citationMarker,
    );
  });

  it('keeps the class on the overflow variant', () => {
    renderMarker({ annotationCount: 3 });

    expect(screen.getByRole('button').classList).toContain(
      QUOTATIONS_CLASS.citationMarker,
    );
  });
});
