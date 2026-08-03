import type { Annotation } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CitationCardProvider } from '../../../context/CitationCardContext';
import type { AnnotationGroup } from '../../../utils/group-annotations-by-source';
import { useCitationCard } from '../../../utils/useCitationCard';
import { CitationDropdown } from '../CitationDropdown';

const makeGroup = (): AnnotationGroup => {
  const annotation: Annotation = {
    body: {
      title: 'livescience.com',
      quote: 'Dinosaurs first appeared in the Triassic',
      source: {
        type: 'attachment',
        attachment: { type: 'text/markdown', url: 'https://example.com/a' },
      },
    },
  };
  return {
    sourceUrl: 'https://example.com/a',
    sourceName: 'livescience.com',
    annotations: [annotation],
    primaryAnnotation: annotation,
  };
};

const cardLabels = {
  ariaLabel: 'Citation from livescience.com',
  previousCitation: 'Previous',
  nextCitation: 'Next',
  formatSwitcherText: (current: number, total: number) =>
    `${current} / ${total}`,
  preview: 'Preview',
  openInBrowser: 'Open in browser',
  download: 'Download',
};

const markerLabels = {
  ariaLabel: 'Citation from livescience.com',
  label: 'livescience.com',
  labelWithOverflow: 'livescience.com +1',
};

const Wrapper = (props: {
  group: AnnotationGroup;
  onPreview?: (annotation: Annotation) => void;
  onOpenInBrowser: (annotation: Annotation) => void;
}) => {
  const citationCard = useCitationCard();
  return (
    <CitationCardProvider value={citationCard}>
      <CitationDropdown
        {...props}
        cardLabels={cardLabels}
        markerLabels={markerLabels}
      />
    </CitationCardProvider>
  );
};

describe('CitationDropdown', () => {
  it('opens the popup with a Preview button when onPreview is provided', async () => {
    render(
      <Wrapper
        group={makeGroup()}
        onPreview={vi.fn()}
        onOpenInBrowser={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
  });

  it('opens the popup without a Preview button when onPreview is omitted', async () => {
    render(<Wrapper group={makeGroup()} onOpenInBrowser={vi.fn()} />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeFalsy();
  });
});
