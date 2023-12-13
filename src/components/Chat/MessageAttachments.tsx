import { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Attachment } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import ChevronDown from '../../../public/images/icons/chevron-down.svg';
import { MessageAttachment } from './MessageAttachment';

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

  if (!attachments?.length) {
    return null;
  }

  return isUnderSection && !isInner ? (
    <div className="border-gray-400 rounded border bg-layer-1">
      <button
        className="flex w-full items-center gap-2 p-2 text-sm"
        onClick={() => setIsSectionOpened((val) => !val)}
      >
        {t('Attachments')}
        <ChevronDown
          height={18}
          width={18}
          className={`shrink-0 text-secondary transition ${
            isSectionOpened ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isSectionOpened && (
        <div className="border-gray-400 grid max-w-full grid-cols-1 gap-1 border-t p-2 sm:grid-cols-2 md:grid-cols-3">
          {attachments?.map((attachment) => (
            <MessageAttachment
              key={attachment.index}
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
          key={attachment.index}
          attachment={attachment}
          isInner={isInner}
        />
      ))}
    </div>
  );
};
