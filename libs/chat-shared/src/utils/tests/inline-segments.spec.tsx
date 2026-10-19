import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from '../../components/MarkdownRenderer/MarkdownRenderer';
import type { TextSegment } from '../../models/inline-segment';
import {
  buildInlineSegmentSource,
  createInlineSegmentComponents,
  createRehypeInlineSegments,
} from '../inline-segments';

vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: string }) => (
    <pre>
      <code>{children}</code>
    </pre>
  ),
}));

/* The private-use character the segment tokens are built from. */
const TOKEN_CHARACTER = String.fromCharCode(0xe000);

const chip = (name: string): TextSegment => ({
  text: `/${name}`,
  node: (
    <button key={name} type="button">
      chip {name}
    </button>
  ),
});

const renderSegments = (segments: TextSegment[]) => {
  const { source, inlineSegments } = buildInlineSegmentSource(segments);
  return render(
    <MarkdownRenderer
      content={source}
      rehypePlugins={[createRehypeInlineSegments(inlineSegments)]}
      components={createInlineSegmentComponents(inlineSegments)}
    />,
  );
};

describe('buildInlineSegmentSource', () => {
  it('returns the source unchanged when there are no inline segments', () => {
    expect(buildInlineSegmentSource(['**a**', ' b'])).toEqual({
      source: '**a** b',
      inlineSegments: [],
    });
  });

  it('falls back to plain text when a string run already contains a token character', () => {
    const result = buildInlineSegmentSource([
      `odd ${TOKEN_CHARACTER} text `,
      chip('review'),
    ]);

    expect(result.inlineSegments).toEqual([]);
    expect(result.source).toBe(`odd ${TOKEN_CHARACTER} text /review`);
  });
});

describe('createRehypeInlineSegments', () => {
  it('renders an inline segment inside a paragraph', () => {
    renderSegments([chip('review'), ' this please']);

    const button = screen.getByRole('button', { name: 'chip review' });
    // eslint-disable-next-line testing-library/no-node-access -- the paragraph has no role
    expect(button.closest('p')?.textContent).toBe('chip review this please');
  });

  it('renders an inline segment inside a list item', () => {
    renderSegments(['- ', chip('review'), ' item']);

    expect(
      within(screen.getByRole('listitem')).getByRole('button', {
        name: 'chip review',
      }),
    ).toBeTruthy();
  });

  it('renders an inline segment inside bold text', () => {
    renderSegments(['**', chip('review'), ' now**']);

    const button = screen.getByRole('button', { name: 'chip review' });
    // eslint-disable-next-line testing-library/no-node-access -- strong has no role
    expect(button.closest('strong')).toBeTruthy();
  });

  it('does not parse underscores in a mention as emphasis', () => {
    renderSegments([chip('my_skill_name'), ' and _x']);

    expect(
      screen.getByRole('button', { name: 'chip my_skill_name' }),
    ).toBeTruthy();
    expect(screen.queryByText('skill', { selector: 'em' })).toBeNull();
  });

  it('renders a segment inside inline code as its literal text', () => {
    renderSegments(['`', chip('review'), '`']);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('/review').tagName).toBe('CODE');
  });

  it('renders a segment inside a fenced block as its literal text', () => {
    renderSegments(['```\n', chip('review'), ' run\n```']);

    expect(screen.queryByRole('button', { name: 'chip review' })).toBeNull();
    expect(screen.getByText('/review run')).toBeTruthy();
  });

  it('renders a segment inside link text as its literal text', () => {
    renderSegments(['[', chip('review'), '](https://example.com)']);

    const link = screen.getByRole('link', { name: '/review' });
    expect(within(link).queryByRole('button')).toBeNull();
  });

  it('restores a segment that lands inside an autolinked URL', () => {
    renderSegments(['https://example.com', chip('review')]);

    expect(screen.getByRole('link').getAttribute('href')).toBe(
      'https://example.com/review',
    );
  });

  it('renders two adjacent segments in order', () => {
    renderSegments([chip('a'), chip('b'), ' go']);

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'chip a',
      'chip b',
    ]);
  });
});
