import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import type { Annotation, DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { useCallback, useMemo } from 'react';
import type { Components } from 'react-markdown';
import CitationDropdown from '../../components/Citations/CitationDropdown/CitationDropdown';
import { annotationToPdfCanvasContent } from '../../utils/attachment-canvas';
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
  const { openCanvas } = useAttachmentCanvas();

  const onOpenInBrowser = useCallback((annotation: Annotation) => {
    const url = annotation.body?.source?.attachment?.url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const onPreview = useCallback(
    (annotation: Annotation) => {
      const pdfContent = annotationToPdfCanvasContent(annotation, groups);
      if (pdfContent != null) {
        const fileName =
          annotation.body?.source?.attachment?.url?.split('/').pop() ?? '';
        openCanvas(pdfContent, fileName);
        return;
      }
      const display = annotationToDisplayAttachment(annotation);
      if (display) onAttachmentPreview(display);
    },
    [groups, openCanvas, onAttachmentPreview],
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
          className="dial-body-paragraph-text mb-3 break-words [overflow-wrap:anywhere] [text-wrap:pretty] last:mb-0"
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
