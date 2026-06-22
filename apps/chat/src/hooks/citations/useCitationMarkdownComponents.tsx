import type { Annotation, DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { useCallback, useMemo } from 'react';
import type { Components } from 'react-markdown';
import CitationDropdown from '../../components/Citations/CitationDropdown/CitationDropdown';
import { annotationToDisplayAttachment } from '../../utils/attachment-dto-to-display';
import {
  injectCitationSentinels,
  replaceSentinelsInChildren,
} from '../../utils/citation-injection';
import type { AnnotationGroup } from '../../utils/group-annotations-by-source';
import type { useCitationCard } from './useCitationCard';

type CitationCardHook = ReturnType<typeof useCitationCard>;

/**
 * Builds react-markdown component overrides that inject citation markers into
 * rendered paragraph text at the character offsets stored in each annotation
 * group's primary selector.
 *
 * Returns both the pre-processed content string (with sentinel placeholders
 * injected at the right offsets) and the `Components` map to pass to the
 * markdown renderer.
 */
export const useCitationMarkdownComponents = (
  content: string,
  groups: AnnotationGroup[],
  citationCard: CitationCardHook,
  onAttachmentPreview: (attachment: DisplayAttachment) => void,
): { processedContent: string; markdownComponents: Components } => {
  const onOpenInBrowser = useCallback((annotation: Annotation) => {
    const url = annotation.body?.source?.attachment?.url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const onPreview = useCallback(
    (annotation: Annotation) => {
      const display = annotationToDisplayAttachment(annotation);
      if (display) onAttachmentPreview(display);
    },
    [onAttachmentPreview],
  );

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
      return (
        <CitationDropdown
          key={`citation-${group.sourceUrl}`}
          group={group}
          isOpen={citationCard.isOpen(group.sourceUrl)}
          activeIndex={citationCard.getActiveIndex(group.sourceUrl)}
          onOpen={() => citationCard.openPopup(group.sourceUrl)}
          onClose={citationCard.closePopup}
          onIndexChange={(i) => citationCard.setActiveIndex(group.sourceUrl, i)}
          onPreview={onPreview}
          onOpenInBrowser={onOpenInBrowser}
        />
      );
    };

    return {
      p: ({ children, ...rest }) => (
        <p
          {...rest}
          className="mb-3 max-w-[70ch] break-words leading-[1.625] [overflow-wrap:anywhere] [text-wrap:pretty] last:mb-0"
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
  }, [groups, citationCard, onPreview, onOpenInBrowser]);

  return { processedContent, markdownComponents };
};
