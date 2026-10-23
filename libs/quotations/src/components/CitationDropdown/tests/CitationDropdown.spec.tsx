import type { Annotation } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUOTATIONS_CLASS } from '../../../constants/public-class-names';
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
  showMore: 'Show more',
  showLess: 'Show less',
};

const markerLabels = {
  ariaLabel: 'Citation from livescience.com',
  label: 'livescience.com',
  labelWithOverflow: 'livescience.com +1',
};

const Wrapper = (props: {
  group: AnnotationGroup;
  onPreview?: (annotation: Annotation) => void;
  isPreviewable?: (annotation: Annotation) => boolean;
  onOpenInBrowser: (annotation: Annotation) => void;
  isPreviewOpen?: boolean;
  previewFilesOnMarkerClick?: boolean;
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
  it('updates preview availability and the secondary action for the selected annotation', async () => {
    const group = makeGroup();
    const webAnnotation: Annotation = {
      body: {
        source: {
          type: 'attachment',
          attachment: { type: 'text/html', url: 'https://example.com/page' },
        },
      },
    };
    const pdfAnnotation: Annotation = {
      body: {
        source: {
          type: 'attachment',
          attachment: {
            type: 'application/pdf',
            url: 'https://example.com/report.pdf',
          },
        },
      },
    };
    group.annotations = [webAnnotation, pdfAnnotation];
    group.primaryAnnotation = webAnnotation;
    const onPreview = vi.fn();
    const onOpenInBrowser = vi.fn();
    render(
      <Wrapper
        group={group}
        onPreview={onPreview}
        isPreviewable={(annotation) => annotation === pdfAnnotation}
        onOpenInBrowser={onOpenInBrowser}
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Open in browser' }),
    );
    expect(onOpenInBrowser).toHaveBeenLastCalledWith(webAnnotation);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onOpenInBrowser).toHaveBeenLastCalledWith(pdfAnnotation);

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Open in browser' }),
    ).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(onPreview).toHaveBeenCalledExactlyOnceWith(pdfAnnotation);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('previews directly on marker click without showing the card when the preview panel is open', async () => {
    const group = makeGroup();
    const onPreview = vi.fn();
    render(
      <Wrapper
        group={group}
        onPreview={onPreview}
        onOpenInBrowser={vi.fn()}
        isPreviewOpen
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onPreview).toHaveBeenCalledExactlyOnceWith(group.primaryAnnotation);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  describe('with a multi-citation group while the preview panel is open', () => {
    const makeMultiGroup = (): AnnotationGroup => {
      const group = makeGroup();
      const second: Annotation = {
        body: { ...group.primaryAnnotation.body, quote: 'Second quote' },
      };
      return { ...group, annotations: [group.primaryAnnotation, second] };
    };

    it.each([false, true])(
      'opens the card instead of previewing directly (previewFilesOnMarkerClick: %s)',
      async (previewFilesOnMarkerClick) => {
        const onPreview = vi.fn();
        render(
          <Wrapper
            group={makeMultiGroup()}
            onPreview={onPreview}
            onOpenInBrowser={vi.fn()}
            isPreviewOpen
            previewFilesOnMarkerClick={previewFilesOnMarkerClick}
          />,
        );
        await userEvent.click(screen.getByRole('button'));
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(onPreview).not.toHaveBeenCalled();
      },
    );

    it('previews the citation chosen with Next', async () => {
      const group = makeMultiGroup();
      const onPreview = vi.fn();
      render(
        <Wrapper
          group={group}
          onPreview={onPreview}
          onOpenInBrowser={vi.fn()}
          isPreviewOpen
        />,
      );
      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
      expect(onPreview).toHaveBeenCalledExactlyOnceWith(group.annotations[1]);
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('with previewFilesOnMarkerClick', () => {
    const makeSourceGroup = (type: string): AnnotationGroup => {
      const group = makeGroup();
      const annotation: Annotation = {
        body: {
          ...group.primaryAnnotation.body,
          title: 'report.pdf',
          source: {
            type: 'attachment',
            attachment: { type, url: 'files/bucket/report' },
          },
        },
      };
      return {
        ...group,
        annotations: [annotation],
        primaryAnnotation: annotation,
      };
    };

    it('previews a file source directly without showing the card', async () => {
      const group = makeSourceGroup('application/pdf');
      const onPreview = vi.fn();
      render(
        <Wrapper
          group={group}
          onPreview={onPreview}
          onOpenInBrowser={vi.fn()}
          previewFilesOnMarkerClick
        />,
      );
      await userEvent.click(screen.getByRole('button'));
      expect(onPreview).toHaveBeenCalledExactlyOnceWith(
        group.primaryAnnotation,
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('previews a file source when the marker is activated from the keyboard', async () => {
      const group = makeSourceGroup('application/pdf');
      const onPreview = vi.fn();
      render(
        <Wrapper
          group={group}
          onPreview={onPreview}
          onOpenInBrowser={vi.fn()}
          previewFilesOnMarkerClick
        />,
      );
      screen.getByRole('button').focus();
      await userEvent.keyboard('{Enter}');
      expect(onPreview).toHaveBeenCalledExactlyOnceWith(
        group.primaryAnnotation,
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('still opens the card for a web-link source', async () => {
      const onPreview = vi.fn();
      render(
        <Wrapper
          group={makeSourceGroup('text/html')}
          onPreview={onPreview}
          onOpenInBrowser={vi.fn()}
          previewFilesOnMarkerClick
        />,
      );
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(onPreview).not.toHaveBeenCalled();
    });

    it('still opens the card when the file source is not previewable', async () => {
      render(
        <Wrapper
          group={makeSourceGroup('application/pdf')}
          onPreview={vi.fn()}
          isPreviewable={() => false}
          onOpenInBrowser={vi.fn()}
          previewFilesOnMarkerClick
        />,
      );
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('still opens the card for a file group with several citations', async () => {
      const single = makeSourceGroup('application/pdf');
      const second: Annotation = {
        body: { ...single.primaryAnnotation.body, quote: 'Second quote' },
      };
      const onPreview = vi.fn();
      render(
        <Wrapper
          group={{ ...single, annotations: [single.primaryAnnotation, second] }}
          onPreview={onPreview}
          onOpenInBrowser={vi.fn()}
          previewFilesOnMarkerClick
        />,
      );
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(onPreview).not.toHaveBeenCalled();
    });

    it('opens the card for a file source when the flag is omitted', async () => {
      const onPreview = vi.fn();
      render(
        <Wrapper
          group={makeSourceGroup('application/pdf')}
          onPreview={onPreview}
          onOpenInBrowser={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(onPreview).not.toHaveBeenCalled();
    });
  });

  it('still opens the card when the preview panel is open but the annotation is not previewable', async () => {
    render(
      <Wrapper
        group={makeGroup()}
        onPreview={vi.fn()}
        isPreviewable={() => false}
        onOpenInBrowser={vi.fn()}
        isPreviewOpen
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

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

/*
 * Walking up to the panel is the only way to assert a class on it: it carries
 * no role or text of its own, and querying *by* the class would still pass
 * with the class on the wrong node.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  from.closest(`.${className}`);

describe('CitationDropdown — public class names', () => {
  /*
   * The panel is the only citation surface whose class travels as a prop into
   * the kit's dropdown rather than onto an element this component renders, so
   * a lost class here would not even show up as a changed stylesheet — only as
   * a host's rule that silently stops applying.
   */
  it('stamps the floating panel it reveals', async () => {
    render(<Wrapper group={makeGroup()} onOpenInBrowser={vi.fn()} />);
    await userEvent.click(screen.getByRole('button'));

    const panel = screen.getByRole('dialog');
    expect(
      closestWithClass(panel, QUOTATIONS_CLASS.citationDropdown),
    ).toBeTruthy();
  });
});

describe('CitationDropdown — touch-only device', () => {
  /* A touch-only device reports `hover: none`, the query the kit's tooltips
     use to render nothing — the card must still open from a tap there. */
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('hover: none'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the citation card when the marker is tapped', async () => {
    render(<Wrapper group={makeGroup()} onOpenInBrowser={vi.fn()} />);
    await userEvent.click(
      screen.getByRole('button', { name: markerLabels.ariaLabel }),
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
