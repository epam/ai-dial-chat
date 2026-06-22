import { useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getMappedAttachmentUrl } from '@/src/utils/app/attachments';
import { parseCommaSeparatedList } from '@/src/utils/app/common';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { GroupedVisualizerRenderer } from '@/src/components/VisualalizerRenderer/GroupedVisualizerRenderer';

import { MessageAttachment } from './MessageAttachment';

import ChevronDown from '@/public/images/icons/chevron-down.svg';
import { Attachment, MessageAnnotation } from '@epam/ai-dial-shared';
import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  attachments: Attachment[] | undefined;
  annotations?: MessageAnnotation[];
  isInner?: boolean;
  applicationId?: string;
}

export const MessageAttachments = ({
  attachments,
  annotations,
  isInner,
  applicationId,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const { expandedTypes, borderlessTypes } = useAppSelector(
    SettingsSelectors.selectAttachmentsSettings,
  );

  const applicationVisualizerConfig = useAppSelector((state) =>
    SettingsSelectors.selectApplicationVisualizerConfig(state, applicationId),
  );

  const { hasBorderlessAttachments, hasExpandedAttachments } = useMemo(() => {
    if (applicationVisualizerConfig) {
      return {
        hasBorderlessAttachments: !!applicationVisualizerConfig.borderless,
        hasExpandedAttachments: !!applicationVisualizerConfig.expanded,
      };
    }
    return {
      hasBorderlessAttachments: !!attachments?.some((a) =>
        borderlessTypes.includes(a.type),
      ),
      hasExpandedAttachments: !!attachments?.some((a) =>
        expandedTypes.includes(a.type),
      ),
    };
  }, [
    applicationVisualizerConfig,
    attachments,
    borderlessTypes,
    expandedTypes,
  ]);

  const { groupedAttachments, regularAttachments } = useMemo(() => {
    if (!attachments?.length) {
      return { groupedAttachments: null, regularAttachments: [] };
    }

    if (applicationVisualizerConfig) {
      const allowedMimeTypes = parseCommaSeparatedList(
        applicationVisualizerConfig.contentType,
      );
      const useMimeFilter = allowedMimeTypes.length > 0;

      const isAttachmentForGroupedVisualizer = (a: Attachment) => {
        if (!a.url) {
          return false;
        }
        if (!useMimeFilter) {
          return true;
        }
        return allowedMimeTypes.includes(a.type);
      };

      const atachmentsForGrouped = attachments.filter(
        isAttachmentForGroupedVisualizer,
      );
      const atachmentsForRegular = attachments.filter(
        (a) => !isAttachmentForGroupedVisualizer(a),
      );

      const groupedVisualizerItems = atachmentsForGrouped.map((a) => ({
        url: getMappedAttachmentUrl(a.url)!,
        mimeType: a.type,
      }));

      if (groupedVisualizerItems.length > 0) {
        return {
          groupedAttachments: {
            config: applicationVisualizerConfig,
            attachments: groupedVisualizerItems,
          },
          regularAttachments: atachmentsForRegular,
        };
      }
    }

    return { groupedAttachments: null, regularAttachments: attachments };
  }, [attachments, applicationVisualizerConfig]);

  const indexedAnnotations = useMemo(() => {
    const annotationsMap = new Map<number, MessageAnnotation[]>();

    annotations?.forEach((annotation) => {
      if (typeof annotation.target?.source?.attachment_index === 'number') {
        annotationsMap.set(
          annotation.target.source.attachment_index,
          (
            annotationsMap.get(annotation.target?.source?.attachment_index) ??
            []
          ).concat(annotation),
        );
      }
    });

    return annotationsMap;
  }, [annotations]);

  const getAttachmentAnnotations = (attachment: Attachment) => {
    if (typeof attachment.index !== 'number') return undefined;

    return indexedAnnotations.get(attachment.index);
  };

  const isUnderSection = useMemo(() => {
    return regularAttachments.length > 3 && !hasBorderlessAttachments;
  }, [regularAttachments, hasBorderlessAttachments]);

  const [isSectionOpened, setIsSectionOpened] = useState(
    hasExpandedAttachments,
  );

  if (!attachments?.length) {
    return null;
  }

  const renderGroupedVisualizer = () => {
    if (!groupedAttachments || groupedAttachments.attachments.length === 0) {
      return null;
    }

    return (
      <div className="mb-3">
        <GroupedVisualizerRenderer
          attachments={groupedAttachments.attachments}
          visualizerConfig={groupedAttachments.config}
        />
      </div>
    );
  };

  const renderRegularAttachments = () => {
    if (!regularAttachments.length) {
      return null;
    }

    if (isUnderSection && !isInner) {
      return (
        <div
          data-no-context-menu
          className="rounded border border-secondary bg-layer-1"
        >
          <DialButton
            className="flex w-full items-center justify-between gap-2 p-2"
            textClassName="text-sm font-normal"
            onClick={() => setIsSectionOpened((val) => !val)}
            data-qa="grouped-attachments"
            label={t(ChatI18nKeys.Attachment)}
            iconAfter={
              <ChevronDown
                height={18}
                width={18}
                className={classNames(
                  'shrink-0 text-secondary transition',
                  isSectionOpened && 'rotate-180',
                )}
              />
            }
          />
          {isSectionOpened && (
            <div className="grid max-w-full grid-cols-1 gap-1 border-t border-secondary p-2 sm:grid-cols-2 md:grid-cols-3">
              {regularAttachments.map((attachment) => (
                <MessageAttachment
                  key={attachment.url || attachment.title}
                  attachment={attachment}
                  annotations={getAttachmentAnnotations(attachment)}
                  isInner
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="grid max-w-full grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
        {regularAttachments.map((attachment) => (
          <MessageAttachment
            key={attachment.url || attachment.title}
            attachment={attachment}
            isInner={isInner}
            forceDefaultView={isInner}
            annotations={getAttachmentAnnotations(attachment)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      {renderGroupedVisualizer()}
      {renderRegularAttachments()}
    </>
  );
};
