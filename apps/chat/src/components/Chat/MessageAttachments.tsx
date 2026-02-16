import { useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { MessageAttachment } from './MessageAttachment';

import ChevronDown from '@/public/images/icons/chevron-down.svg';
import { Attachment } from '@epam/ai-dial-shared';
import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  attachments: Attachment[] | undefined;
  isInner?: boolean;
}

export const MessageAttachments = ({ attachments, isInner }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const { expandedTypes, borderlessTypes } = useAppSelector(
    SettingsSelectors.selectAttachmentsSettings,
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

  const isUnderSection = useMemo(() => {
    return !!attachments && attachments.length > 3 && !hasBorderlessAttachments;
  }, [attachments, hasBorderlessAttachments]);

  const [isSectionOpened, setIsSectionOpened] = useState(
    hasExpandedAttachments,
  );

  if (!attachments?.length) {
    return null;
  }

  return isUnderSection && !isInner ? (
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
          {attachments?.map((attachment) => (
            <MessageAttachment
              key={attachment.url || attachment.title}
              attachment={attachment}
              isInner
            />
          ))}
        </div>
      )}
    </div>
  ) : (
    <div className="grid max-w-full grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
      {attachments?.map((attachment) => (
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
