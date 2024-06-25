import classNames from 'classnames';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { Spinner } from '../Common/Spinner';
import { ModelDescription } from './ModelDescription';

interface Props {
  modelsLoaded: boolean;
  appName: string;
}

export const EmptyChatDescription = ({ modelsLoaded, appName }: Props) => {
  const model = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsModels,
  )[0];
  const Tag = model ? 'div' : 'h4';
  const showAppName = !model;

  return (
    <div className="flex size-full flex-col items-center p-0 md:px-5 md:pt-5">
      <div className="flex size-full max-w-[500px] flex-col items-center gap-[1px] rounded">
        {!modelsLoaded ? (
          <div className="flex w-full items-center justify-center rounded-t p-4">
            <Spinner size={16} className="mx-auto" />
          </div>
        ) : (
          <div className="flex size-full items-center justify-center rounded-t p-4">
            <Tag
              data-qa="app-name"
              className={classNames(
                'flex size-full items-center justify-center whitespace-pre text-center',
                showAppName ? 'text-xl' : 'text-sm',
              )}
            >
              {showAppName ? (
                appName
              ) : (
                <ModelDescription
                  iconSize={48}
                  model={model}
                  className="flex-col justify-center !gap-4"
                  hideMoreInfo
                  isShortDescription
                />
              )}
            </Tag>
          </div>
        )}
      </div>
    </div>
  );
};
