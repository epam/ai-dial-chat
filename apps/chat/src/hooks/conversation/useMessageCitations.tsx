import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import {
  annotationToDisplayAttachment,
  isDialFileId,
  isExternalSourcePreviewable,
  mapStages,
  openAnnotationAttachment,
  prepareStageCitations,
  resolveAnnotationCanvasContent,
} from '@epam/ai-dial-chat-hooks';
import {
  type Annotation,
  COMPACT_MARKDOWN_CLASS_NAMES,
} from '@epam/ai-dial-chat-shared';
import {
  groupAnnotations,
  replaceCitTagsWithSourceNames,
  useAnnotations,
  useCitationCard,
  useCitationMarkdownComponents,
  useCitationTagRenderer,
  type AnnotationGroup,
} from '@epam/ai-dial-quotations';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConversationMessageItemProps } from '../../components/ConversationView/ConversationMessageItem';
import { buildCitationMarkerLabels } from '../../components/ConversationView/utils/citation-labels';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  CitationsI18nKeys,
} from '../../constants/translation-keys';
import { attachmentCanvasUrlResolvers } from '../../utils/attachment-display-resolvers';
import { resolveDialFileDownloadUrl } from '../../utils/dial-file';
import type { useMessageAttachments } from './useMessageAttachments';

const MESSAGE_TEXT_STYLES = {
  typography: { fontClassName: 'dial-body-text' },
};

/* One type-scale step down for narrow viewports: the full-size body copy costs
   too much vertical space on a phone. Desktop keeps the wider scale. */
const COMPACT_MESSAGE_TEXT_STYLES = {
  typography: { fontClassName: 'dial-small-paragraph-text' },
};

const isCitationPreviewable = (annotation: Annotation): boolean => {
  const attachment = annotation.body?.source?.attachment;
  return (
    attachment != null &&
    (isDialFileId(attachment.url) ||
      isExternalSourcePreviewable(attachment.type, attachment.url))
  );
};

interface UseMessageCitationsParams extends Pick<
  ConversationMessageItemProps,
  'msg' | 'isCompactTypography'
> {
  fallbackCitationGroups: NonNullable<
    ConversationMessageItemProps['fallbackCitationGroups']
  >;
  isStreaming: boolean;
  stages: NonNullable<ReturnType<typeof mapStages>>;
  handleAttachmentClick: ReturnType<
    typeof useMessageAttachments
  >['handleAttachmentClick'];
}

/**
 * Citations for one message: its annotations merged with the conversation's
 * fallback pool, the citation card and preview/open-in-browser callbacks,
 * the markdown components and processed content that render citation
 * markers, stage citations, and the copy text. Reads the i18n and canvas
 * contexts itself.
 */
export const useMessageCitations = ({
  msg,
  isStreaming,
  stages,
  fallbackCitationGroups,
  isCompactTypography,
  handleAttachmentClick,
}: UseMessageCitationsParams) => {
  const { t } = useTranslation();
  const { openCanvas, isOpen: isCanvasOpen } = useAttachmentCanvas();

  const annotations = useAnnotations(msg, isStreaming);
  const citationGroups = useMemo(
    () => groupAnnotations(annotations),
    [annotations],
  );
  /*
   * Union used only for Preview/Open-in-browser lookups (design D7), so
   * `annotationToPdfCanvasContent`/`annotationToOoxmlCanvasContent` can find
   * a pooled annotation's siblings. Never passed as the citation hook's
   * `groups` — that stays message-scoped (design D6).
   */
  const citationGroupsWithFallback = useMemo(
    () => [...citationGroups, ...fallbackCitationGroups],
    [citationGroups, fallbackCitationGroups],
  );
  const annotationsWithFallback = useMemo(
    () => [
      ...annotations,
      ...fallbackCitationGroups.flatMap((group) => group.annotations),
    ],
    [annotations, fallbackCitationGroups],
  );
  const citationCard = useCitationCard();
  const messageTextStyles = isCompactTypography
    ? COMPACT_MESSAGE_TEXT_STYLES
    : MESSAGE_TEXT_STYLES;
  const markdownClassNames = isCompactTypography
    ? COMPACT_MARKDOWN_CLASS_NAMES
    : undefined;
  const handleCitationPreview = useCallback(
    (annotation: Annotation) => {
      const canvas = resolveAnnotationCanvasContent(
        annotation,
        citationGroupsWithFallback,
        annotationsWithFallback,
        attachmentCanvasUrlResolvers,
      );
      if (canvas != null) {
        openCanvas(canvas.content, canvas.fileName);
        return;
      }
      const display = annotationToDisplayAttachment(annotation);
      if (display) handleAttachmentClick(display);
    },
    [
      citationGroupsWithFallback,
      annotationsWithFallback,
      openCanvas,
      handleAttachmentClick,
    ],
  );
  const handleCitationOpenInBrowser = useCallback((annotation: Annotation) => {
    const attachment = annotation.body?.source?.attachment;
    if (attachment)
      openAnnotationAttachment(attachment, resolveDialFileDownloadUrl);
  }, []);
  const buildCitationLabels = useCallback(
    (group: AnnotationGroup) => {
      const markerLabels = buildCitationMarkerLabels(t, group);
      const cardLabels = {
        ariaLabel: markerLabels.ariaLabel,
        previousCitation: t(CitationsI18nKeys.PopupPreviousCitation),
        nextCitation: t(CitationsI18nKeys.PopupNextCitation),
        formatSwitcherText: (current: number, total: number) =>
          t(CitationsI18nKeys.PopupSwitcher, { current, total }),
        preview: t(BasicI18nKeys.Preview),
        openInBrowser: t(CitationsI18nKeys.PopupOpenInBrowser),
        download: t(ButtonsI18nKeys.Download),
        showMore: t(ButtonsI18nKeys.ShowMore),
        showLess: t(ButtonsI18nKeys.ShowLess),
        codeBlockCopyLabel: t(ButtonsI18nKeys.Copy),
        codeBlockCopiedLabel: t(ButtonsI18nKeys.Copied),
        codeBlockDownloadLabel: t(ButtonsI18nKeys.Download),
        tableScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableTable),
        mathScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableFormula),
      };
      return { cardLabels, markerLabels };
    },
    [t],
  );
  const citationCallbacks = useMemo(
    () => ({
      onPreview: handleCitationPreview,
      isPreviewable: isCitationPreviewable,
      onOpenInBrowser: handleCitationOpenInBrowser,
      isPreviewOpen: isCanvasOpen,
      previewFilesOnMarkerClick: true,
      buildLabels: buildCitationLabels,
    }),
    [
      handleCitationPreview,
      handleCitationOpenInBrowser,
      isCanvasOpen,
      buildCitationLabels,
    ],
  );
  const { processedContent, markdownComponents } =
    useCitationMarkdownComponents(
      msg.content,
      citationGroups,
      citationCallbacks,
      isStreaming,
      isCompactTypography,
      fallbackCitationGroups,
    );
  /* Stage markers resolve against the same message-level annotations as the
   body: producers send annotations on the message, never on a stage. */
  const renderStageCitation = useCitationTagRenderer(
    citationGroups,
    citationCallbacks,
    fallbackCitationGroups,
  );
  const displayStages = useMemo(
    () => prepareStageCitations(stages, isStreaming),
    [stages, isStreaming],
  );
  /* The Copy actions serialize markdown outside the renderer, so a `<cit>`
   element has to be swapped for the label its marker shows — a
   references-table title cell is otherwise copied empty (issue #9245). */
  const copyContent = useMemo(
    () =>
      replaceCitTagsWithSourceNames(
        msg.content,
        citationGroups,
        fallbackCitationGroups,
        (group) => buildCitationMarkerLabels(t, group).label,
      ),
    [msg.content, citationGroups, fallbackCitationGroups, t],
  );

  return {
    citationCard,
    messageTextStyles,
    markdownClassNames,
    processedContent,
    markdownComponents,
    renderStageCitation,
    displayStages,
    copyContent,
  };
};
