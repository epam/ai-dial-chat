import type { Annotation } from '@epam/ai-dial-chat-shared';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CitationCardProvider } from '../../../context/CitationCardContext';
import type { AnnotationGroup } from '../../../utils/group-annotations-by-source';
import { useCitationCard } from '../../../utils/useCitationCard';
import type { UseCitationMarkdownComponentsCallbacks } from '../../useCitationMarkdownComponents/useCitationMarkdownComponents';
import { useCitationTagRenderer } from '../useCitationTagRenderer';

const makeCitGroup = (
  id: string,
  url = 'https://example.com/doc.pdf',
  sourceName = 'doc.pdf',
): AnnotationGroup => {
  const annotation: Annotation = {
    target: { selector: { type: 'html_tag', tag: 'cit', id } },
    body: {
      title: sourceName,
      source: {
        type: 'attachment',
        attachment: { type: 'application/pdf', url },
      },
    },
  };
  return {
    groupKey: `cit:${id}`,
    sourceUrl: url,
    sourceName,
    annotations: [annotation],
    primaryAnnotation: annotation,
  };
};

const makeOffsetGroup = (): AnnotationGroup => {
  const annotation: Annotation = {
    target: { selector: { type: 'text_character_range', start: 0, end: 3 } },
    body: {
      source: {
        type: 'attachment',
        attachment: { type: 'text/markdown', url: 'https://example.com/a' },
      },
    },
  };
  return {
    groupKey: 'https://example.com/a',
    sourceUrl: 'https://example.com/a',
    sourceName: 'example.com',
    annotations: [annotation],
    primaryAnnotation: annotation,
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
    showMore: 'Show more',
    showLess: 'Show less',
  },
  markerLabels: {
    ariaLabel: `Citation from ${group.sourceName}`,
    label: group.sourceName,
    labelWithOverflow: `${group.sourceName} +${group.annotations.length - 1}`,
  },
});

const makeCallbacks = (): UseCitationMarkdownComponentsCallbacks => ({
  onPreview: vi.fn(),
  onOpenInBrowser: vi.fn(),
  buildLabels: vi.fn(buildLabelsForGroup),
});

interface HostProps {
  dataId: string | undefined;
  groups: AnnotationGroup[];
  callbacks: UseCitationMarkdownComponentsCallbacks;
  fallbackGroups?: AnnotationGroup[];
}

const Host = ({ dataId, groups, callbacks, fallbackGroups }: HostProps) => {
  const citationCard = useCitationCard();
  // eslint-disable-next-line testing-library/render-result-naming-convention -- a hook named *Renderer, not a Testing Library render result
  const citationRenderer = useCitationTagRenderer(
    groups,
    callbacks,
    fallbackGroups,
  );
  return (
    <CitationCardProvider value={citationCard}>
      <p>Claim{citationRenderer(dataId, null)}.</p>
    </CitationCardProvider>
  );
};

describe('useCitationTagRenderer', () => {
  it('renders a citation marker for a claimed id and delegates preview to onPreview', async () => {
    const group = makeCitGroup('c1');
    const callbacks = makeCallbacks();
    render(<Host dataId="c1" groups={[group]} callbacks={callbacks} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Citation from doc.pdf' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(callbacks.onPreview).toHaveBeenCalledWith(
      group.primaryAnnotation,
      group,
    );
  });

  it('renders the pooled group when the message groups lack the id', () => {
    const poolGroup = makeCitGroup(
      'c2',
      'https://example.com/pool.pdf',
      'pool.pdf',
    );
    render(
      <Host
        dataId="c2"
        groups={[]}
        fallbackGroups={[poolGroup]}
        callbacks={makeCallbacks()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Citation from pool.pdf' }),
    ).toBeTruthy();
  });

  it("prefers the message's own group over a colliding pooled id", () => {
    const messageGroup = makeCitGroup(
      'c1',
      'https://example.com/message.pdf',
      'message.pdf',
    );
    const poolGroup = makeCitGroup(
      'c1',
      'https://example.com/pool.pdf',
      'pool.pdf',
    );
    render(
      <Host
        dataId="c1"
        groups={[messageGroup]}
        fallbackGroups={[poolGroup]}
        callbacks={makeCallbacks()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Citation from message.pdf' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Citation from pool.pdf' }),
    ).toBeNull();
  });

  it('renders an unclaimed id as literal text', () => {
    render(<Host dataId="zz" groups={[]} callbacks={makeCallbacks()} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Claim<cit data-id="zz"></cit>.')).toBeTruthy();
  });

  it('renders an element without a data-id as literal text', () => {
    render(
      <Host
        dataId={undefined}
        groups={[makeCitGroup('c1')]}
        callbacks={makeCallbacks()}
      />,
    );

    expect(screen.getByText('Claim<cit></cit>.')).toBeTruthy();
  });

  it('ignores offset-based groups', () => {
    const callbacks = makeCallbacks();
    render(
      <Host dataId="c1" groups={[makeOffsetGroup()]} callbacks={callbacks} />,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(callbacks.buildLabels).not.toHaveBeenCalled();
  });

  it('returns the same renderer across re-renders with unchanged inputs', () => {
    const groups = [makeCitGroup('c1')];
    const callbacks = makeCallbacks();
    const { result, rerender } = renderHook(() =>
      useCitationTagRenderer(groups, callbacks),
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('returns a new renderer when the groups reference changes', () => {
    const callbacks = makeCallbacks();
    const { result, rerender } = renderHook(
      ({ groups }) => useCitationTagRenderer(groups, callbacks),
      { initialProps: { groups: [makeCitGroup('c1')] } },
    );
    const first = result.current;

    rerender({ groups: [makeCitGroup('c1')] });

    expect(result.current).not.toBe(first);
  });
});
