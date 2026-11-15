import { InlineGroupedVisualizer } from '@epam/ai-dial-attachment-canvas';
import { LiveRegion, LiveRegionElement } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentCanvasI18nKeys } from '../../../constants/translation-keys';
import type { useGroupedVisualizer } from '../../../hooks/conversation/useGroupedVisualizer';
import type { ConversationMessageItemProps } from '../ConversationMessageItem';

interface MessageVisualizerSlotProps extends Pick<
  ConversationMessageItemProps,
  'openedInCanvasLabel' | 'onVisualizerSendMessage'
> {
  groupedVisualizer: ReturnType<
    typeof useGroupedVisualizer
  >['groupedVisualizer'];
  handleExpandGroupedVisualizer: ReturnType<
    typeof useGroupedVisualizer
  >['handleExpandGroupedVisualizer'];
  isGroupedVisualizerOpenedInCanvas: boolean;
}

/**
 * The grouped application visualizer of a message: an always-mounted live
 * region announcing when it moves into the canvas, then either the
 * placeholder left behind or the inline visualizer. Presentational and
 * private to `ConversationMessageItem`.
 */
const MessageVisualizerSlot: FC<MessageVisualizerSlotProps> = ({
  openedInCanvasLabel,
  onVisualizerSendMessage,
  groupedVisualizer,
  handleExpandGroupedVisualizer,
  isGroupedVisualizerOpenedInCanvas,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Always mounted: a live region that mounts in the same render as
          its text is announced unreliably, so only its text toggles
          when the visualizer moves into the canvas. */}
      <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
        {isGroupedVisualizerOpenedInCanvas ? openedInCanvasLabel : ''}
      </LiveRegion>
      {groupedVisualizer != null &&
        (isGroupedVisualizerOpenedInCanvas ? (
          <div
            aria-hidden
            className="bg-layer-2 flex h-[120px] w-[280px] items-center justify-center rounded"
          >
            <span className="dial-body-text text-primary">
              {openedInCanvasLabel}
            </span>
          </div>
        ) : (
          <InlineGroupedVisualizer
            content={groupedVisualizer.content}
            height={groupedVisualizer.height}
            isBorderless={groupedVisualizer.isBorderless}
            isTitleHidden={groupedVisualizer.isTitleHidden}
            onExpand={handleExpandGroupedVisualizer}
            expandAriaLabel={t(AttachmentCanvasI18nKeys.ExpandAppLabel)}
            actionsGroupAriaLabel={t(
              AttachmentCanvasI18nKeys.VisualizerActionsAriaLabel,
            )}
            loadingLabel={t(AttachmentCanvasI18nKeys.VisualizerLoadingLabel)}
            errorLabel={t(AttachmentCanvasI18nKeys.VisualizerLoadErrorLabel)}
            onVisualizerSendMessage={onVisualizerSendMessage}
          />
        ))}
    </>
  );
};

export default MessageVisualizerSlot;
