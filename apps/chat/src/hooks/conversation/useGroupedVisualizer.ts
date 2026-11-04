import {
  findVisualizerForApplication,
  groupedVisualizerCanvasKey,
  partitionAttachmentsForApplicationVisualizer,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import { resolveGroupedVisualizerCanvasContent } from '@epam/ai-dial-chat-hooks';
import { useIsMobile } from '@epam/ai-dial-chat-shared';
import { useCallback, useMemo } from 'react';
import type { ConversationMessageItemProps } from '../../components/ConversationView/ConversationMessageItem';
import { useTheme } from '../../context/ThemeContext';
import { useApplicationVisualizers } from '../../hooks/attachment/useApplicationVisualizers';
import { resolveAbsoluteDialUrl } from '../../utils/dial-file';
import type { useMessageAttachments } from './useMessageAttachments';

const DEFAULT_VISUALIZER_HEIGHT = 400;

interface UseGroupedVisualizerParams extends Pick<
  ConversationMessageItemProps,
  'effectiveDeploymentId' | 'index'
> {
  nonReferenceDisplayAttachments: ReturnType<
    typeof useMessageAttachments
  >['nonReferenceDisplayAttachments'];
}

/**
 * The grouped application visualizer for one message: which visualizer
 * renders its attachments (memoized, keyed by theme and viewport), the
 * attachments left for the bubble, and expanding the visualizer into the
 * canvas under a message-scoped key. Reads the theme, visualizer, viewport
 * and canvas contexts itself.
 */
export const useGroupedVisualizer = ({
  effectiveDeploymentId,
  index,
  nonReferenceDisplayAttachments,
}: UseGroupedVisualizerParams) => {
  const { currentTheme } = useTheme();
  const applicationVisualizers = useApplicationVisualizers();
  const isMobile = useIsMobile();
  const { openCanvas } = useAttachmentCanvas();

  /*
   * An application visualizer claims some or all of this message's
   * attachments and renders them together in one iframe. Resolved in a single
   * memo so the entry lookup, the partition, and the payload object all share
   * one identity per render — `VisualizerCanvasRenderer` keys its iframe on
   * the payload's `url`/`visualizerName`/`requestTimeout`, but a fresh
   * `content` object on every parent render would still churn its props.
   */
  const groupedVisualizer = useMemo(() => {
    const entry = findVisualizerForApplication(
      effectiveDeploymentId,
      applicationVisualizers,
    );
    if (entry == null) return null;

    const { claimed } = partitionAttachmentsForApplicationVisualizer(
      nonReferenceDisplayAttachments,
      entry,
    );
    if (claimed.length === 0) return null;

    const { content, resolved } = resolveGroupedVisualizerCanvasContent(
      claimed,
      resolveAbsoluteDialUrl,
      entry,
      currentTheme,
    );
    if (content == null) return null;

    /* Derived from the full list rather than the partition's `unclaimed`, so a
     * claimed attachment the host could not resolve a URL for falls back to an
     * ordinary tile instead of disappearing from the message entirely. */
    const resolvedSet = new Set(resolved);

    return {
      content,
      unclaimed: nonReferenceDisplayAttachments.filter(
        (attachment) => !resolvedSet.has(attachment),
      ),
      /* The registry carries both heights; picking between them is the host's
       * job, so the lib never reads a breakpoint. A mobile viewport prefers
       * `mobileHeight` but falls back to `height` when the entry declares
       * only the desktop one. */
      height:
        (isMobile ? (entry.mobileHeight ?? entry.height) : entry.height) ??
        DEFAULT_VISUALIZER_HEIGHT,
      isBorderless: entry.borderless === true,
      isTitleHidden: entry.withoutTitle === true,
    };
  }, [
    effectiveDeploymentId,
    applicationVisualizers,
    nonReferenceDisplayAttachments,
    currentTheme,
    isMobile,
  ]);

  /* Claimed attachments are rendered by the visualizer, so they must not also
   * appear as tray tiles. */
  const bubbleAttachments =
    groupedVisualizer?.unclaimed ?? nonReferenceDisplayAttachments;

  /* Opens the canvas with the very object the inline frame was given, so
   * expanding never rebuilds the grouped payload. */
  const handleExpandGroupedVisualizer = useCallback(() => {
    if (groupedVisualizer == null) return;
    const panelTitle = groupedVisualizer.content.visualizerName.trim();
    openCanvas(
      groupedVisualizer.content,
      panelTitle === '' ? undefined : panelTitle,
      groupedVisualizerCanvasKey(index),
    );
  }, [groupedVisualizer, openCanvas, index]);

  return {
    groupedVisualizer,
    bubbleAttachments,
    handleExpandGroupedVisualizer,
  };
};
