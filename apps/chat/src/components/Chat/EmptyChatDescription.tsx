import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { Spinner } from '../Common/Spinner';
import { ModelDescription } from './ModelDescription';

interface Props {
  conv: Conversation;
  modelsLoaded: boolean;
  appName: string;
}

export const EmptyChatDescription = ({
  conv,
  modelsLoaded,
  appName,
}: Props) => {
  const model = useAppSelector((state) =>
    ModelsSelectors.selectModel(state, conv.model.id),
  );
  const showAppName = !model;

  return (
    <div className="flex size-full flex-col items-center p-0 md:px-5 md:pt-5">
      <div className="flex size-full flex-col items-center gap-px rounded">
        {!modelsLoaded ? (
          <div className="flex w-full items-center justify-center rounded-t p-4">
            <Spinner size={16} className="mx-auto" />
          </div>
        ) : (
          <div className="flex size-full flex-col justify-center gap-4 rounded-t py-4 lg:max-w-3xl">
            <div
              data-qa="app-name"
              className={classNames(
                'flex size-full items-center whitespace-pre text-center',
                showAppName ? 'text-[40px]' : 'text-sm',
              )}
            >
              {showAppName ? (
                appName
              ) : (
                <ModelDescription
                  model={model}
                  className="!gap-4 text-[40px]"
                  hideMoreInfo
                  isShortDescription
                  iconSize={48}
                  hideIconTooltip
                />
              )}
            </div>
            <div className="text-accent-primary">
              Change model | Configure parameters
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
