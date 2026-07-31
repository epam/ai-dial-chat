import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import type { Annotation, DisplayAttachment } from '@epam/ai-dial-chat-shared';
import {
  CitationDropdown,
  injectCitationSentinels,
  replaceSentinelsInChildren,
  type AnnotationGroup,
} from '@epam/ai-dial-quotations';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Components } from 'react-markdown';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  CitationsI18nKeys,
} from '../../constants/translation-keys';
import { openAnnotationAttachment } from '../../utils/annotation';
import { annotationToPdfCanvasContent } from '../../utils/attachment-canvas';
import { annotationToDisplayAttachment } from '../../utils/attachment-dto-to-display';

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
 */
export const useCitationMarkdownComponents = (
  content: string,
  groups: AnnotationGroup[],
  onAttachmentPreview: (attachment: DisplayAttachment) => void,
): { processedContent: string; markdownComponents: Components } => {
  const { t } = useTranslation();
  const { openCanvas } = useAttachmentCanvas();

  const onOpenInBrowser = useCallback((annotation: Annotation) => {
    const attachment = annotation.body?.source?.attachment;
    if (attachment) openAnnotationAttachment(attachment);
  }, []);

  const onPreview = useCallback(
    (annotation: Annotation) => {
      const pdfContent = annotationToPdfCanvasContent(annotation, groups);
      if (pdfContent != null) {
        const attachment = annotation.body?.source?.attachment;
        const rawSegment = attachment?.url?.split('/').pop() ?? '';
        const fileName = attachment?.title ?? decodeURIComponent(rawSegment);
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

      const cardLabels = {
        ariaLabel: t(CitationsI18nKeys.MarkerAriaLabel, {
          source: group.sourceName,
        }),
        previousCitation: t(CitationsI18nKeys.PopupPreviousCitation),
        nextCitation: t(CitationsI18nKeys.PopupNextCitation),
        formatSwitcherText: (current: number, total: number) =>
          t(CitationsI18nKeys.PopupSwitcher, { current, total }),
        preview: t(BasicI18nKeys.Preview),
        openInBrowser: t(CitationsI18nKeys.PopupOpenInBrowser),
        download: t(ButtonsI18nKeys.Download),
      };
      const markerLabels = {
        ariaLabel: t(CitationsI18nKeys.MarkerAriaLabel, {
          source: group.sourceName,
        }),
        label: t(CitationsI18nKeys.MarkerLabel, { source: group.sourceName }),
        labelWithOverflow: t(CitationsI18nKeys.MarkerLabelWithOverflow, {
          source: group.sourceName,
          count: group.annotations.length - 1,
        }),
      };

      return (
        <CitationDropdown
          key={`citation-${group.sourceUrl}`}
          group={group}
          onPreview={onPreview}
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
          className="dial-body-paragraph-text mb-3 [overflow-wrap:anywhere] [text-wrap:pretty] last:mb-0"
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
  }, [groups, onPreview, onOpenInBrowser, t]);

  return { processedContent, markdownComponents };
};
