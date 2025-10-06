import {
  IconCheck,
  IconCopy,
  IconExclamationCircle,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getDownLoadCurrentDate } from '@/src/utils/app/import-export';

import { Translation } from '@/src/types/translation';

import { Spinner } from '@/src/components/Common/Spinner';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { ChatMDComponent } from '@/src/components/Markdown/ChatMDComponent';

import { MessageAttachments } from './MessageAttachments';

import ChevronDown from '@/public/images/icons/chevron-down.svg';
import CircleCheck from '@/public/images/icons/circle-check.svg';
import Download from '@/public/images/icons/download.svg';
import { Stage } from '@epam/ai-dial-shared';

interface StageTitleProps {
  isOpened: boolean;
  stage: Stage;
}

const StageTitle = ({ isOpened, stage }: StageTitleProps) => (
  <div className="relative grid min-w-0 grid-flow-col items-center gap-3 overflow-hidden text-ellipsis">
    {stage.status == null ? (
      <Spinner size={20} />
    ) : stage.status === 'completed' ? (
      <CircleCheck
        height={20}
        width={20}
        className="shrink-0 grow-0 basis-auto text-secondary"
        data-qa="stage-completed"
      />
    ) : (
      <IconExclamationCircle
        size={20}
        className="shrink-0 grow-0 basis-auto text-secondary"
      />
    )}
    <span
      className={classNames(
        'block whitespace-pre text-start',
        isOpened ? 'max-w-full' : 'truncate',
      )}
      data-qa={isOpened ? 'stage-opened' : 'stage-closed'}
    >
      {stage.name}
    </span>
  </div>
);

interface Props {
  stage: Stage;
}

const maxKiloBytes = 40;
const maxBytes = maxKiloBytes * 1024; // in bytes

const DownloadStageView = ({ content }: { content: string }) => {
  const { t } = useTranslation(Translation.Chat);

  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = useCallback(() => {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      return;
    }

    navigator.clipboard.writeText(content).then(() => {
      setIsCopied(true);

      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    });
  }, [content]);

  const downloadAsFile = useCallback(() => {
    const fileName = `ai-chat-stage-${getDownLoadCurrentDate()}.txt`;

    const blob = new Blob([content], { type: 'attachment/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [content]);
  return (
    <div className="flex justify-between gap-1 ps-1">
      {t(`Content is too large to display (exceeds ${maxKiloBytes} KB).`)}
      <div className="flex items-center gap-3 text-secondary">
        <button
          className="flex items-center [&:not(:disabled)]:hover:text-accent-primary"
          onClick={copyToClipboard}
          disabled={isCopied}
        >
          {isCopied ? (
            <Tooltip tooltip={t('Copied!')}>
              <IconCheck size={18} />
            </Tooltip>
          ) : (
            <Tooltip isTriggerClickable tooltip={t('Copy stage content')}>
              <IconCopy size={18} />
            </Tooltip>
          )}
        </button>
        <Tooltip isTriggerClickable tooltip={t('Download')}>
          <button
            className="flex items-center rounded bg-none hover:text-accent-primary"
            onClick={downloadAsFile}
          >
            <Download width={18} height={18} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

const StageView = ({ content }: { content: string }) => {
  // Calculate byte size of the string
  const size = useMemo(() => new Blob([content]).size, [content]);

  if (size > maxBytes) {
    return <DownloadStageView content={content} />;
  }
  return (
    <span className="inline-block overflow-auto">
      <ChatMDComponent isShowResponseLoader={false} content={content} isInner />
    </span>
  );
};

export const MessageStage = ({ stage }: Props) => {
  const [isOpened, setIsOpened] = useState(false);
  const [hasContent, setHasContent] = useState(
    () => !!(stage?.content || stage?.attachments?.length),
  );

  useEffect(() => {
    setHasContent(!!(stage?.content || stage?.attachments?.length));
  }, [stage?.content, stage?.attachments?.length]);

  return (
    <div className="block min-w-0 shrink rounded border border-secondary bg-layer-1">
      {hasContent ? (
        <button
          className="flex w-full min-w-0 shrink items-center justify-between gap-2 p-2"
          onClick={() => {
            setIsOpened((opened) => !opened);
          }}
          data-qa="message-stage"
        >
          <StageTitle isOpened={isOpened} stage={stage} />
          <ChevronDown
            height={20}
            width={20}
            className={classNames(
              'shrink-0 text-secondary transition',
              isOpened && 'rotate-180',
            )}
          />
        </button>
      ) : (
        <div className="flex p-2">
          <StageTitle isOpened={isOpened} stage={stage} />
        </div>
      )}

      {hasContent && (
        <div
          className={classNames(
            'grid max-w-full grid-flow-row overflow-auto',
            isOpened ? 'border-t border-secondary p-2' : 'h-0',
          )}
        >
          {isOpened && stage.content && <StageView content={stage.content} />}
          <MessageAttachments attachments={stage.attachments} isInner />
        </div>
      )}
    </div>
  );
};
