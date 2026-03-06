import { useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getMappedAttachmentUrl } from '@/src/utils/app/attachments';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { GroupedVisualizerRenderer } from '@/src/components/VisualalizerRenderer/GroupedVisualizerRenderer';

import { MessageAttachment } from './MessageAttachment';

import ChevronDown from '@/public/images/icons/chevron-down.svg';
import { Attachment } from '@epam/ai-dial-shared';
import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  attachments: Attachment[] | undefined;
  isInner?: boolean;
  applicationId?: string;
}

export const MessageAttachments = ({
  attachments,
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

  const { hasBorderlessAttachments, hasExpandedAttachments } = useMemo(
    () => ({
      hasBorderlessAttachments: !!attachments?.some((a) =>
        borderlessTypes.includes(a.type),
      ),
      hasExpandedAttachments: !!attachments?.some((a) =>
        expandedTypes.includes(a.type),
      ),
    }),
    [attachments, borderlessTypes, expandedTypes],
  );

  const { groupedAttachments, regularAttachments } = useMemo(() => {
    if (!attachments?.length) {
      return { groupedAttachments: null, regularAttachments: [] };
    }

    if (applicationVisualizerConfig) {
      const visualizerContentType = applicationVisualizerConfig.contentType;
      const visualizerAttachments = attachments.filter(
        (a) => a.type === visualizerContentType && a.url,
      );
      const groupedVisualizerItems = visualizerAttachments.map((a) => ({
        url: getMappedAttachmentUrl(a.url)!,
        mimeType: a.type,
      }));

      if (groupedVisualizerItems.length > 0) {
        return {
          groupedAttachments: {
            config: applicationVisualizerConfig,
            attachments: groupedVisualizerItems,
          },
          regularAttachments: attachments.filter(
            (a) => a.type !== visualizerContentType,
          ),
        };
      }
    }

    return { groupedAttachments: null, regularAttachments: attachments };
  }, [attachments, applicationVisualizerConfig]);

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
            label={t('Attachments')}
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
