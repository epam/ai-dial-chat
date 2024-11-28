import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { Spinner } from '../Common/Spinner';
import { ModelDescription } from './ModelDescription';

interface Props {
  conv: Conversation;
  modelsLoaded: boolean;
  appName: string;
  onShowChangeModel: (show: boolean) => void;
  onShowSettings: (show: boolean) => void;
}

export const EmptyChatDescription = ({
  conv,
  modelsLoaded,
  appName,
  onShowChangeModel,
  onShowSettings,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const model = useAppSelector((state) =>
    ModelsSelectors.selectModel(state, conv.model.id),
  );
  const showAppName = !model;

  const handleOpenChangeModel = useCallback(
    () => onShowChangeModel(true),
    [onShowChangeModel],
  );

  const handleOpenSettings = useCallback(
    () => onShowSettings(true),
    [onShowSettings],
  );

  return (
    <div className="flex size-full flex-col items-center p-0 md:px-5 md:pt-5">
      <div className="flex size-full flex-col items-center gap-px rounded">
        {!modelsLoaded ? (
          <div className="flex w-full items-center justify-center rounded-t p-4">
            <Spinner size={16} className="mx-auto" />
          </div>
        ) : (
          <div className="flex size-full flex-col items-center gap-5 rounded-t py-4 lg:max-w-3xl">
            <div
              data-qa="app-name"
              className={classNames(
                'flex size-full justify-center whitespace-pre text-center',
                showAppName ? 'text-[40px]' : 'text-sm',
              )}
            >
              {showAppName ? (
                appName
              ) : (
                <ModelDescription
                  model={model}
                  className="flex-col justify-center !gap-5 text-3xl leading-10"
                  hideMoreInfo
                  isShortDescription
                  iconSize={48}
                  hideIconTooltip
                />
              )}
            </div>
            <div className="flex gap-3 divide-x divide-primary leading-4">
              <button
                className={classNames(
                  'text-left text-accent-primary disabled:cursor-not-allowed',
                )}
                data-qa="change-model"
                onClick={handleOpenChangeModel}
              >
                {t('Change model')}
              </button>
              <button
                className={classNames(
                  'text-left text-accent-primary disabled:cursor-not-allowed', // TODO: add `pl-3`
                )}
                data-qa="configure-settings"
                onClick={handleOpenSettings}
              >
                {t('Configure settings')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
