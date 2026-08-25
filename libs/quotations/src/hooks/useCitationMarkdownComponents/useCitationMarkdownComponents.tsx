import { mergeClasses, type Annotation } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import type { Components } from 'react-markdown';
import type { CitationCardLabels } from '../../components/CitationCard/CitationCard';
import { CitationDropdown } from '../../components/CitationDropdown/CitationDropdown';
import type { CitationMarkerLabels } from '../../components/CitationMarker/CitationMarker';
import {
  injectCitationSentinels,
  replaceSentinelsInChildren,
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
 * Builds react-markdown component overrides that inject citation markers into
 * rendered paragraph text at the character offsets stored in each annotation
 * group's primary selector.
 *
 * The `p` and `li` component overrides are stable references — they only
 * change when `groups` transitions between empty and non-empty. Citation card
 * open/close state is provided via `CitationCardContext` so that state changes
 * do not recreate the component functions, preventing ReactMarkdown from
 * unmounting and remounting the paragraph subtree on every interaction.
 *
 * Returns both the pre-processed content string (with sentinel placeholders
 * injected at the right offsets) and the `Components` map to pass to the
 * markdown renderer.
 *
 * `isCompactTypography` drops the paragraph class one type-scale step, matching
 * `COMPACT_MARKDOWN_CLASS_NAMES` so cited and uncited paragraphs stay the same
 * size.
 */
export const useCitationMarkdownComponents = (
  content: string,
  groups: AnnotationGroup[],
  callbacks: UseCitationMarkdownComponentsCallbacks,
  isCompactTypography = false,
): { processedContent: string; markdownComponents: Components } => {
  const { onPreview, onOpenInBrowser, buildLabels } = callbacks;

  const processedContent = useMemo(
    () =>
      groups.length > 0 ? injectCitationSentinels(content, groups) : content,

    [content, groups],
  );

  const markdownComponents = useMemo((): Components => {
    if (groups.length === 0) return {};

    const renderMarker = (idx: number) => {
      const group = groups[idx];
      if (!group) return null;

      const { cardLabels, markerLabels } = buildLabels(group);

      return (
        <CitationDropdown
          key={`citation-${group.sourceUrl}`}
          group={group}
          onPreview={(annotation) => onPreview(annotation, group)}
          onOpenInBrowser={onOpenInBrowser}
          cardLabels={cardLabels}
          markerLabels={markerLabels}
        />
      );
    };

    return {
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
