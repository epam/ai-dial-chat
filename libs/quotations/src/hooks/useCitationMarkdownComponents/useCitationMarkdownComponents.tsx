import {
  mergeClasses,
  type Annotation,
  type HtmlTagSelector,
} from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import type { Components } from 'react-markdown';
import type { CitationCardLabels } from '../../components/CitationCard/CitationCard';
import { CitationDropdown } from '../../components/CitationDropdown/CitationDropdown';
import type { CitationMarkerLabels } from '../../components/CitationMarker/CitationMarker';
import {
  injectCitationSentinels,
  replaceSentinelsInChildren,
  stripCitTagsWhileStreaming,
} from '../../utils/citation-injection';
import type { AnnotationGroup } from '../../utils/group-annotations-by-source';

/** Host-supplied callbacks and label builder consumed by `useCitationMarkdownComponents`. */
export interface UseCitationMarkdownComponentsCallbacks {
  /** Called when a citation marker's preview action is invoked, with the clicked annotation and its group. */
  onPreview(annotation: Annotation, group: AnnotationGroup): void;
  /** Called when a citation marker's open-in-browser action is invoked. */
  onOpenInBrowser(annotation: Annotation): void;
  /** Builds the translated label bundles used by a given citation group's card and marker. */
  buildLabels(group: AnnotationGroup): {
    cardLabels: CitationCardLabels;
    markerLabels: CitationMarkerLabels;
  };
}

/**
 * Returns the `data-id` this `html_tag` group's `<cit>` element carries, or
 * `undefined` for a non-`html_tag` group. Narrowed via an explicit cast
 * rather than control-flow narrowing, because `AnnotationSelector`'s open
 * catch-all variant (`{ type: string; [key: string]: unknown }`) also
 * satisfies `type === 'html_tag'` and would otherwise widen `.id` to `unknown`.
 */
const citTagId = (group: AnnotationGroup): string | undefined => {
  const selector = group.primaryAnnotation.target?.selector;
  return selector?.type === 'html_tag'
    ? (selector as HtmlTagSelector).id
    : undefined;
};

/**
 * Builds react-markdown component overrides that inject citation markers
 * into rendered assistant message content: a `cit` element override for
 * `<cit data-id="…">` tags (rendered as real elements once `rehype-raw` and
 * the host's `rehype-sanitize` allowlist parse them — see
 * `MarkdownRenderer`'s `baseRehypePlugins`), and `p`/`li` overrides that
 * inject markers at the character offsets of every other annotation
 * group's primary selector.
 *
 * Citation card open/close state is provided via `CitationCardContext` so
 * that state changes do not recreate the component functions, preventing
 * ReactMarkdown from unmounting and remounting the paragraph subtree on
 * every interaction.
 *
 * Returns both the pre-processed content string and the `Components` map to
 * pass to the markdown renderer. While `isStreaming` is true, every `<cit>`
 * tag (complete or still arriving) is hidden from `processedContent` — the
 * model always closes a `<cit>` element immediately, but an SSE chunk
 * boundary can still land between the opening and closing tag, and an HTML
 * parser given only the opening tag would otherwise treat all of the
 * message's subsequent (already-streamed) text as that element's content.
 * Citation pills for `<cit>` tags therefore only appear once the message
 * has finished streaming, matching every other citation family.
 *
 * `isCompactTypography` drops the paragraph class one type-scale step, matching
 * `COMPACT_MARKDOWN_CLASS_NAMES` so cited and uncited paragraphs stay the same
 * size.
 */
export const useCitationMarkdownComponents = (
  content: string,
  groups: AnnotationGroup[],
  callbacks: UseCitationMarkdownComponentsCallbacks,
  isStreaming = false,
  isCompactTypography = false,
): { processedContent: string; markdownComponents: Components } => {
  const { onPreview, onOpenInBrowser, buildLabels } = callbacks;

  const processedContent = useMemo(() => {
    if (isStreaming) return stripCitTagsWhileStreaming(content);
    return groups.length > 0 ? injectCitationSentinels(content, groups) : content;
  }, [content, groups, isStreaming]);

  const markdownComponents = useMemo((): Components => {
    const citGroupsByTagId = new Map<string, AnnotationGroup>();
    for (const group of groups) {
      const tagId = citTagId(group);
      if (tagId != null) citGroupsByTagId.set(tagId, group);
    }

    if (groups.length === 0 && citGroupsByTagId.size === 0) return {};

    const renderGroup = (group: AnnotationGroup) => {
      const { cardLabels, markerLabels } = buildLabels(group);

      return (
        <CitationDropdown
          key={`citation-${group.groupKey}`}
          group={group}
          onPreview={(annotation) => onPreview(annotation, group)}
          onOpenInBrowser={onOpenInBrowser}
          cardLabels={cardLabels}
          markerLabels={markerLabels}
        />
      );
    };

    const renderMarker = (idx: number) => {
      const group = groups[idx];
      return group ? renderGroup(group) : null;
    };

    /*
     * `cit` isn't a known JSX intrinsic element, hence the cast — `data-id`
     * (not `id`) is the lookup attribute because `rehype-sanitize`'s default
     * schema prefixes `id`/`name` with `user-content-` to prevent DOM
     * clobbering; `data-*` attributes are exempt. A tag id with no matching
     * group (annotation never arrived, or doesn't resolve) renders nothing
     * rather than the raw tag.
     */
    const citComponent = {
      cit: (props: { 'data-id'?: string }) => {
        const group = props['data-id'] != null
          ? citGroupsByTagId.get(props['data-id'])
          : undefined;
        return group ? renderGroup(group) : null;
      },
    } as Components;

    return {
      ...citComponent,
      p: ({ children, ...rest }) => (
        <p
          {...rest}
          className={mergeClasses(
            isCompactTypography
              ? 'dial-small-paragraph-text'
              : 'dial-body-paragraph-text',
            'mb-3 [overflow-wrap:anywhere] [text-wrap:pretty] last:mb-0',
          )}
        >
          {replaceSentinelsInChildren(children, renderMarker)}
        </p>
      ),
      li: ({ children, ...rest }) => (
        <li {...rest} className="mb-1.5 last:mb-0">
          {replaceSentinelsInChildren(children, renderMarker)}
        </li>
      ),
    };
  }, [groups, onPreview, onOpenInBrowser, buildLabels, isCompactTypography]);

  return { processedContent, markdownComponents };
};
