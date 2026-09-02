import type { Annotation } from '@epam/ai-dial-chat-shared';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReactMarkdown from 'react-markdown';
import { describe, expect, it, vi } from 'vitest';
import { CitationCardProvider } from '../../../context/CitationCardContext';
import type { AnnotationGroup } from '../../../utils/group-annotations-by-source';
import { useCitationCard } from '../../../utils/useCitationCard';
import {
  useCitationMarkdownComponents,
  type UseCitationMarkdownComponentsCallbacks,
} from '../useCitationMarkdownComponents';

const makeAnnotation = (
  url = 'https://example.com/a',
  end?: number,
): Annotation => ({
  target:
    end != null
      ? { selector: { type: 'text_character_range', start: 0, end } }
      : undefined,
  body: {
    title: 'Example',
    source: {
      type: 'attachment',
      attachment: { type: 'text/markdown', url },
    },
  },
});

const makeGroup = (
  overrides: Partial<AnnotationGroup> = {},
): AnnotationGroup => {
  const annotation = overrides.primaryAnnotation ?? makeAnnotation();
  const sourceUrl = overrides.sourceUrl ?? 'https://example.com/a';
  return {
    groupKey: sourceUrl,
    sourceUrl,
    sourceName: 'example.com',
    annotations: [annotation],
    primaryAnnotation: annotation,
    ...overrides,
  };
};

const buildLabelsForGroup = (group: AnnotationGroup) => ({
  cardLabels: {
    ariaLabel: `Citation from ${group.sourceName}`,
    previousCitation: 'Previous',
    nextCitation: 'Next',
    formatSwitcherText: (current: number, total: number) =>
      `${current} / ${total}`,
    preview: 'Preview',
    openInBrowser: 'Open in browser',
    download: 'Download',
  },
  markerLabels: {
    ariaLabel: `Citation from ${group.sourceName}`,
    label: group.sourceName,
    labelWithOverflow: `${group.sourceName} +${group.annotations.length - 1}`,
  },
});

const makeCallbacks = (
  overrides: Partial<UseCitationMarkdownComponentsCallbacks> = {},
): UseCitationMarkdownComponentsCallbacks => ({
  onPreview: vi.fn(),
  onOpenInBrowser: vi.fn(),
  buildLabels: vi.fn(buildLabelsForGroup),
  ...overrides,
});

interface HostProps {
  content: string;
  groups: AnnotationGroup[];
  callbacks: UseCitationMarkdownComponentsCallbacks;
  isCompactTypography?: boolean;
}

const Host = ({
  content,
  groups,
  callbacks,
  isCompactTypography,
}: HostProps) => {
  const citationCard = useCitationCard();
  const { processedContent, markdownComponents } =
    useCitationMarkdownComponents(
      content,
      groups,
      callbacks,
      isCompactTypography,
    );
  return (
    <CitationCardProvider value={citationCard}>
      <ReactMarkdown components={markdownComponents}>
        {processedContent}
      </ReactMarkdown>
    </CitationCardProvider>
  );
};

describe('useCitationMarkdownComponents', () => {
  it('returns content unchanged and renders no marker for uncited content without calling buildLabels', () => {
    const callbacks = makeCallbacks();
    render(<Host content="Hello world" groups={[]} callbacks={callbacks} />);

    expect(screen.getByText('Hello world')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeFalsy();
    expect(callbacks.buildLabels).not.toHaveBeenCalled();
  });

  it('reports the input content unchanged and empty overrides directly from the hook for uncited content', () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useCitationMarkdownComponents('Hello world', [], callbacks),
    );

    expect(result.current.processedContent).toBe('Hello world');
    expect(result.current.markdownComponents).toEqual({});
  });

  it('strips an unmatched cit tag even with zero groups', () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useCitationMarkdownComponents(
        'See the note<cit id="e1">.',
        [],
        callbacks,
      ),
    );

    expect(result.current.processedContent).toBe('See the note.');
    expect(result.current.markdownComponents).toEqual({});
  });

  it('injects a sentinel and renders a citation marker for cited content', () => {
    const group = makeGroup();
    const callbacks = makeCallbacks();
    render(
      <Host content="Hello world" groups={[group]} callbacks={callbacks} />,
    );

    expect(
      screen.getByRole('button', { name: `Citation from ${group.sourceName}` }),
    ).toBeTruthy();
  });

  it('renders nothing for a sentinel index with no corresponding group entry, without throwing', () => {
    const group = makeGroup();
    const callbacks = makeCallbacks();

    /* The literal "⟦C5⟧" is adversarial/malformed content already present in the
       raw markdown — index 5 has no entry in this single-group array. */
    expect(() =>
      render(
        <Host
          content="Hello ⟦C5⟧ world"
          groups={[group]}
          callbacks={callbacks}
        />,
      ),
    ).not.toThrow();

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('defaults the sentinel injection point to the end of content when the primary annotation has no character-range selector', () => {
    const annotationWithoutSelector = makeAnnotation();
    const group = makeGroup({
      primaryAnnotation: annotationWithoutSelector,
      annotations: [annotationWithoutSelector],
    });
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useCitationMarkdownComponents('Hello world', [group], callbacks),
    );

    expect(result.current.processedContent).toBe('Hello world⟦C0⟧');
  });

  it('keeps the same markdownComponents reference across re-renders with unchanged groups emptiness', () => {
    const group = makeGroup();
    const groups = [group];
    const callbacks = makeCallbacks();
    const { result, rerender } = renderHook(
      (props: { groups: AnnotationGroup[] }) =>
        useCitationMarkdownComponents('Hello world', props.groups, callbacks),
      { initialProps: { groups } },
    );

    const first = result.current.markdownComponents;
    /* Same groups reference, simulating an unrelated re-render of the host component. */
    rerender({ groups });
    expect(result.current.markdownComponents).toBe(first);
  });

  it('recomputes markdownComponents when groups transitions from empty to non-empty', () => {
    const group = makeGroup();
    const callbacks = makeCallbacks();
    const { result, rerender } = renderHook(
      ({ groups }: { groups: AnnotationGroup[] }) =>
        useCitationMarkdownComponents('Hello world', groups, callbacks),
      { initialProps: { groups: [] as AnnotationGroup[] } },
    );

    const empty = result.current.markdownComponents;
    expect(empty).toEqual({});

    rerender({ groups: [group] });
    expect(result.current.markdownComponents).not.toBe(empty);
    expect(result.current.markdownComponents.p).toBeDefined();
  });

  it('recomputes markdownComponents when groups transitions from non-empty to empty', () => {
    const group = makeGroup();
    const callbacks = makeCallbacks();
    const { result, rerender } = renderHook(
      ({ groups }: { groups: AnnotationGroup[] }) =>
        useCitationMarkdownComponents('Hello world', groups, callbacks),
      { initialProps: { groups: [group] } },
    );

    const nonEmpty = result.current.markdownComponents;
    rerender({ groups: [] });
    expect(result.current.markdownComponents).not.toBe(nonEmpty);
    expect(result.current.markdownComponents).toEqual({});
  });

  it('delegates the preview action to onPreview without internal content-type branching', async () => {
    const annotation = makeAnnotation();
    const group = makeGroup({
      primaryAnnotation: annotation,
      annotations: [annotation],
    });
    const callbacks = makeCallbacks();
    render(
      <Host content="Hello world" groups={[group]} callbacks={callbacks} />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: `Citation from ${group.sourceName}` }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(callbacks.onPreview).toHaveBeenCalledWith(annotation, group);
  });

  it('delegates the open-in-browser action to onOpenInBrowser directly', async () => {
    const annotation = makeAnnotation();
    const group = makeGroup({
      primaryAnnotation: annotation,
      annotations: [annotation],
    });
    const callbacks = makeCallbacks();
    render(
      <Host content="Hello world" groups={[group]} callbacks={callbacks} />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: `Citation from ${group.sourceName}` }),
    );
    /* The card's non-preview action is labelled "Download" for a non-HTML
       source with a preview action available, but always triggers onOpenInBrowser. */
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(callbacks.onOpenInBrowser).toHaveBeenCalledWith(annotation);
  });

  it('calls buildLabels once per rendered marker with the correct group', () => {
    const annotationA = makeAnnotation('https://example.com/a', 5);
    const annotationB = makeAnnotation('https://example.com/b', 11);
    const groupA = makeGroup({
      sourceUrl: 'https://example.com/a',
      sourceName: 'a.pdf',
      primaryAnnotation: annotationA,
      annotations: [annotationA],
    });
    const groupB = makeGroup({
      sourceUrl: 'https://example.com/b',
      sourceName: 'b.pdf',
      primaryAnnotation: annotationB,
      annotations: [annotationB],
    });
    const callbacks = makeCallbacks();
    render(
      <Host
        content="Hello world"
        groups={[groupA, groupB]}
        callbacks={callbacks}
      />,
    );

    expect(callbacks.buildLabels).toHaveBeenCalledTimes(2);
    expect(callbacks.buildLabels).toHaveBeenCalledWith(groupA);
    expect(callbacks.buildLabels).toHaveBeenCalledWith(groupB);
  });
});
