import { MouseEvent, useCallback, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { MessageAttachment } from './MessageAttachment';

import ChevronDown from '@/public/images/icons/chevron-down.svg';
import { Attachment } from '@epam/ai-dial-shared';

interface Props {
  attachments: Attachment[] | undefined;
  isInner?: boolean;
}

export const MessageAttachments = ({ attachments, isInner }: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const isUnderSection = useMemo(() => {
    return !!attachments && attachments.length > 3;
  }, [attachments]);

  const [isSectionOpened, setIsSectionOpened] = useState(false);
  const handleOpen = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setIsSectionOpened((val) => !val);
  }, []);

  if (!attachments?.length) {
    return null;
  }

  return isUnderSection && !isInner ? (
    <div
      data-no-context-menu
      className="mb-5 rounded border border-secondary bg-layer-1 last:mb-0"
    >
      <button
        className="flex w-full items-center justify-between gap-2 p-2 text-sm"
        onClick={handleOpen}
        data-qa="grouped-attachments"
      >
        {t('Attachments')}
        <ChevronDown
          height={18}
          width={18}
          className={classNames(
            'shrink-0 text-secondary transition',
            isSectionOpened && 'rotate-180',
          )}
        />
      </button>
      {isSectionOpened && (
        <div className="mb-5 grid max-w-full grid-cols-1 gap-1 border-t border-secondary p-2 last:mb-0 sm:grid-cols-2 md:grid-cols-3">
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
    <div className="mb-5 grid max-w-full grid-cols-1 gap-1 last:mb-0 sm:grid-cols-2 md:grid-cols-3">
      {attachments?.map((attachment) => (
        <MessageAttachment
          key={attachment.url || attachment.title}
          attachment={attachment}
          isInner={isInner}
        />
      ))}
    </div>
  );
};
