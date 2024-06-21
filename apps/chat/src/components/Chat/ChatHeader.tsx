import { useMemo } from 'react';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ModelListSelector } from '@/src/components/Chat/ModelListSelector';

interface Props {
  conversation: Conversation;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
  onSelectAssistantSubModel?: (modelId: string) => void;
}

export const ChatHeader = ({
  conversation,
  onChangeTemperature,
  onSelectModel,
}: Props) => {
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const modelId = useMemo(() => conversation.model.id, [conversation]);

  return (
    <>
      <div
        className={classNames(
          'sticky top-0 z-10 flex w-full min-w-0 items-center p-3 md:flex-wrap md:px-0 lg:flex-row',
          {
            'px-3 md:px-5 lg:flex-nowrap': isChatFullWidth,
          },
        )}
        data-qa="chat-header"
      >
        <div className="flex size-full items-center md:max-w-[180px] ">
          <ModelListSelector
            modelId={modelId}
            onModelSelect={(modelId: string) => {
              onSelectModel(modelId);
            }}
            temperature={conversation.temperature}
            onChangeTemperature={onChangeTemperature}
          />
        </div>
      </div>
    </>
  );
};
