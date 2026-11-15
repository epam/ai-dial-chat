import { referenceAttachmentToPdfCanvasContent } from '@epam/ai-dial-chat-hooks';
import { CitationDropdown } from '@epam/ai-dial-quotations';
import { DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconLink } from '@tabler/icons-react';
import { FC } from 'react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  CitationsI18nKeys,
} from '../../../constants/translation-keys';
import type { useMessageAttachments } from '../../../hooks/conversation/useMessageAttachments';
import { attachmentCanvasUrlResolvers } from '../../../utils/attachment-display-resolvers';
import type { ConversationMessageItemProps } from '../ConversationMessageItem';
import { buildCitationMarkerLabels } from '../utils/citation-labels';

interface MessageReferenceChipsProps extends Pick<
  ConversationMessageItemProps,
  'onPreviewReference'
> {
  referenceGroups: ReturnType<typeof useMessageAttachments>['referenceGroups'];
  handleOpenReferenceInBrowser: ComponentProps<
    typeof CitationDropdown
  >['onOpenInBrowser'];
  isCanvasOpen: boolean;
}

/**
 * The reference chips under an assistant message: one citation dropdown
 * per reference group, previewable in the canvas when the reference is a
 * PDF page. Presentational and private to `ConversationMessageItem`.
 */
const MessageReferenceChips: FC<MessageReferenceChipsProps> = ({
  onPreviewReference,
  referenceGroups,
  handleOpenReferenceInBrowser,
  isCanvasOpen,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex w-full flex-wrap gap-2">
      {referenceGroups.map((group) => {
        const isPdfPagePreviewable =
          group.primaryAnnotation.body?.source?.attachment != null &&
          referenceAttachmentToPdfCanvasContent(
            group.primaryAnnotation.body.source.attachment,
            attachmentCanvasUrlResolvers,
          ) != null;
        const markerLabels = buildCitationMarkerLabels(t, group);
        return (
          <CitationDropdown
            key={group.groupKey}
            group={group}
            onPreview={isPdfPagePreviewable ? onPreviewReference : undefined}
            onOpenInBrowser={handleOpenReferenceInBrowser}
            isPreviewOpen={isCanvasOpen}
            icon={
              <IconLink size={14} aria-hidden stroke={DIAL_KIT_ICON_STROKE} />
            }
            cardLabels={{
              ariaLabel: markerLabels.ariaLabel,
              previousCitation: t(CitationsI18nKeys.PopupPreviousCitation),
              nextCitation: t(CitationsI18nKeys.PopupNextCitation),
              formatSwitcherText: (current, total) =>
                t(CitationsI18nKeys.PopupSwitcher, {
                  current,
                  total,
                }),
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
            }}
            markerLabels={markerLabels}
          />
        );
      })}
    </div>
  );
};

export default MessageReferenceChips;
