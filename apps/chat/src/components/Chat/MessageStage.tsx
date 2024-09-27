import { IconExclamationCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import classNames from 'classnames';

import { DialAIEntityAddon } from '@/src/types/models';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import ChevronDown from '../../../public/images/icons/chevron-down.svg';
import CircleCheck from '../../../public/images/icons/circle-check.svg';
import { Spinner } from '../Common/Spinner';
import ChatMDComponent from '../Markdown/ChatMDComponent';
import { MessageAttachments } from './MessageAttachments';

import { Stage } from '@epam/ai-dial-shared';

interface StageTitleProps {
  isOpened: boolean;
  stage: Stage;
}

const StageTitle = ({ isOpened, stage }: StageTitleProps) => {
  const [addon, setAddon] = useState<DialAIEntityAddon | undefined>();
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);

  const match = stage.name?.match(/^[^(]*/);

  useEffect(() => {
    if (match) {
      setAddon(addonsMap[match[0]]);
    }
  }, [addonsMap, match]);

  return (
    <div className="grid min-w-0 grid-flow-col items-center gap-3 overflow-hidden">
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
      {!!addon && <ModelIcon entity={addon} entityId={addon.id} size={18} />}
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
};

export interface Props {
  stage: Stage;
}

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
          className="flex w-full min-w-0 shrink items-center gap-2 p-2"
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

      {(stage.content || stage.attachments) && (
        <div
          className={classNames(
            'grid max-w-full grid-flow-row overflow-auto',
            isOpened ? 'border-t border-secondary p-2' : 'h-0',
          )}
        >
          {stage.content && (
            <span className="inline-block overflow-auto">
              <ChatMDComponent
                isShowResponseLoader={false}
                content={stage.content}
                isInner
              />
            </span>
          )}
          <MessageAttachments attachments={stage.attachments} isInner />
        </div>
      )}
    </div>
  );
};
