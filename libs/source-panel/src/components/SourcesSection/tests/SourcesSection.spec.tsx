import { render, screen } from '@testing-library/react';
import { MouseEventHandler, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QuotationSource } from '../../../models/quotation-source';
import SourcesSection from '../SourcesSection';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16 },
  ElementSize: { Small: 'small' },
  mergeClasses: (...classes: (string | undefined)[]) =>
    classes.filter(Boolean).join(' '),
  GhostIconButton: ({ 'aria-label': ariaLabel }: { 'aria-label': string }) => (
    <button type="button" aria-label={ariaLabel} />
  ),
  Highlight: ({ text, query }: { text: string; query: string }) => (
    <span data-testid="highlight" data-query={query}>
      {text}
    </span>
  ),
  LinkButton: ({
    href,
    target,
    label,
    onClick,
  }: {
    href?: string;
    target?: string;
    label?: ReactNode;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a href={href} target={target} onClick={onClick}>
      {label}
    </a>
  ),
}));

const makeSource = (
  url: string,
  title: string,
  quote?: string,
): QuotationSource => ({
  url,
  title,
  contentType: 'application/pdf',
  quote,
});

describe('SourcesSection', () => {
  it('renders nothing when sources is empty', () => {
    render(<SourcesSection title="Sources" sources={[]} copyLabel="Copy" />);
    expect(screen.queryByText('Sources')).toBeNull();
  });

  it('renders the title when sources are present', () => {
    render(
      <SourcesSection
        title="Sources"
        sources={[makeSource('https://example.com', 'Example')]}
        copyLabel="Copy"
      />,
    );
    expect(screen.getByText('Sources')).toBeTruthy();
  });

  it('renders a link per source', () => {
    render(
      <SourcesSection
        title="Sources"
        sources={[
          makeSource('https://a.com', 'Site A'),
          makeSource('https://b.com', 'Site B'),
        ]}
        copyLabel="Copy"
      />,
    );
    expect(screen.getByText('Site A')).toBeTruthy();
    expect(screen.getByText('Site B')).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('renders quote text when present', () => {
    render(
      <SourcesSection
        title="Sources"
        sources={[makeSource('https://a.com', 'Site A', 'Quoted text here')]}
        copyLabel="Copy"
      />,
    );
    expect(screen.getByText('Quoted text here')).toBeTruthy();
  });

  it('does not render quote paragraph when quote is absent', () => {
    render(
      <SourcesSection
        title="Sources"
        sources={[makeSource('https://a.com', 'Site A')]}
        copyLabel="Copy"
      />,
    );
    expect(screen.queryByRole('paragraph')).toBeNull();
  });

  it('renders a copy button per source', () => {
    render(
      <SourcesSection
        title="Sources"
        sources={[makeSource('https://a.com', 'Site A')]}
        copyLabel="Copy source"
      />,
    );
    expect(screen.getByRole('button', { name: 'Copy source' })).toBeTruthy();
  });

  it('renders the title through Highlight when there is no search query', () => {
    render(
      <SourcesSection
        title="Sources"
        sources={[makeSource('https://a.com', 'A very long document name')]}
        copyLabel="Copy"
      />,
    );
    const highlight = screen.getByTestId('highlight');
    expect(highlight.textContent).toBe('A very long document name');
    expect(highlight.getAttribute('data-query')).toBe('');
  });

  it('forwards the search query to Highlight', () => {
    render(
      <SourcesSection
        title="Sources"
        sources={[makeSource('https://a.com', 'A very long document name')]}
        copyLabel="Copy"
        searchQuery="long"
      />,
    );
    expect(screen.getByTestId('highlight').getAttribute('data-query')).toBe(
      'long',
    );
  });
});
