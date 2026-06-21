import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { QuotationSource } from '../../../../../models/quotation-source';
import SourcesSection from '../SourcesSection';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16 },
  ElementSize: { Small: 'small' },
  mergeClasses: (...classes: (string | undefined)[]) =>
    classes.filter(Boolean).join(' '),
  DialGhostIconButton: ({
    'aria-label': ariaLabel,
  }: {
    'aria-label': string;
  }) => <button type="button" aria-label={ariaLabel} />,
}));

const makeSource = (
  url: string,
  title: string,
  quote?: string,
): QuotationSource => ({
  url,
  title,
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
});
