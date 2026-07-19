import {
  IconCheck,
  IconCopy,
  IconExclamationCircle,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useCopy } from '@/src/hooks/useCopy';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getDownLoadCurrentDate } from '@/src/utils/app/import-export';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { Spinner } from '@/src/components/Common/Spinner';
import { ChatMDComponent } from '@/src/components/Markdown/ChatMDComponent';

import { MessageAttachments } from './MessageAttachments';

import ChevronDown from '@/public/images/icons/chevron-down.svg';
import CircleCheck from '@/public/images/icons/circle-check.svg';
import Download from '@/public/images/icons/download.svg';
import { Stage } from '@epam/ai-dial-shared';
import { DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';

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

interface DownloadStageViewProps {
  content: string;
  limit: number;
}

const DownloadStageView = ({ content, limit }: DownloadStageViewProps) => {
  const { t } = useTranslation(Translation.Chat);

  const { copied: isCopied, onCopy: copyToClipboard } = useCopy(content, true);

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
    <div data-no-context-menu className="flex justify-between gap-1 ps-1">
      {t(ChatI18nKeys.ContentTooLarge, { limit })}
      <div className="flex items-center gap-2 text-secondary">
        <DialGhostIconButton
          tooltipProps={{
            tooltip: isCopied
              ? t(ChatI18nKeys.Copied)
              : t(ChatI18nKeys.CopyStageContent),
            isTriggerClickable: !isCopied,
          }}
          onClick={copyToClipboard}
          size={ElementSize.Small}
          disabled={isCopied}
          icon={isCopied ? <IconCheck size={18} /> : <IconCopy size={18} />}
        />
        <DialGhostIconButton
          tooltipProps={{
            tooltip: t(ChatI18nKeys.Download),
            isTriggerClickable: true,
          }}
          size={ElementSize.Small}
          onClick={downloadAsFile}
          icon={<Download width={18} height={18} />}
        />
      </div>
    </div>
  );
};

const StageView = ({ content }: { content: string }) => {
  // Calculate byte size of the string
  const size = useMemo(() => new Blob([content]).size, [content]);
  const stageContentLimit = useAppSelector(
    SettingsSelectors.selectStageContentLimit,
  );

  // in bytes
  if (size > stageContentLimit * 1024) {
    return <DownloadStageView content={content} limit={stageContentLimit} />;
  }
  return (
    <span className="inline-block overflow-auto">
      <ChatMDComponent isShowResponseLoader={false} content={content} isInner />
    </span>
  );
};

interface MessageStageProps {
  stage: Stage;
}

export const MessageStage = ({ stage }: MessageStageProps) => {
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
          data-no-context-menu
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
          data-qa="stage-content"
        >
          {isOpened && stage.content && <StageView content={stage.content} />}
          <MessageAttachments attachments={stage.attachments} isInner />
        </div>
      )}
    </div>
  );
};
