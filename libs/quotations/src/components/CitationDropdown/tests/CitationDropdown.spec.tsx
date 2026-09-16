import type { Annotation } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CitationCardProvider,
  type CitationCardHook,
} from '../../../context/CitationCardContext';
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
    groupKey: 'https://example.com/a',
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

const TwoOccurrenceWrapper = (props: {
  group: AnnotationGroup;
  onPreview?: (annotation: Annotation) => void;
  onOpenInBrowser: (annotation: Annotation) => void;
  /** Exposes the shared `citationCard` instance for direct hook-level assertions. */
  onCitationCard?: (citationCard: CitationCardHook) => void;
}) => {
  const { onCitationCard, ...dropdownProps } = props;
  const citationCard = useCitationCard();
  onCitationCard?.(citationCard);
  return (
    <CitationCardProvider value={citationCard}>
      <CitationDropdown
        {...dropdownProps}
        cardLabels={cardLabels}
        markerLabels={markerLabels}
      />
      <CitationDropdown
        {...dropdownProps}
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

  it('activating occurrence B transfers the card from A', async () => {
    render(
      <TwoOccurrenceWrapper
        group={makeGroup()}
        onPreview={vi.fn()}
        onOpenInBrowser={vi.fn()}
      />,
    );
    const markers = screen.getAllByRole('button', {
      name: 'Citation from livescience.com',
    });
    expect(markers).toHaveLength(2);

    await userEvent.click(markers[0]);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await userEvent.click(markers[1]);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('a closePopup aimed at a stale occurrence leaves the active card open', async () => {
    let citationCard: CitationCardHook | undefined;
    render(
      <TwoOccurrenceWrapper
        group={makeGroup()}
        onPreview={vi.fn()}
        onOpenInBrowser={vi.fn()}
        onCitationCard={(hook) => {
          citationCard = hook;
        }}
      />,
    );
    const markers = screen.getAllByRole('button', {
      name: 'Citation from livescience.com',
    });

    await userEvent.click(markers[0]);
    await userEvent.click(markers[1]);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    /* Occurrence B now owns the popup. A `closePopup` call naming a key
       that is not B's own `useId()` value — e.g. a stale dismissal
       delivered late from occurrence A's tooltip — must leave B's card
       open, per the citation-card requirement's owner-scoped `closePopup`. */
    citationCard?.closePopup('some-other-occurrences-key');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('still works after a dismiss-then-reopen cycle', async () => {
    render(
      <Wrapper
        group={makeGroup()}
        onPreview={vi.fn()}
        onOpenInBrowser={vi.fn()}
      />,
    );
    const marker = screen.getByRole('button', {
      name: 'Citation from livescience.com',
    });

    await userEvent.click(marker);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);

    await userEvent.click(marker);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
  });
});
