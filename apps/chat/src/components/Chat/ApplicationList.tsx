import { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getApplicationIcon } from '@/src/utils/app/applications';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { stopBubbling } from '@/src/constants/chat';

import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import Tooltip from '@/src/components/Common/Tooltip';

import { FavoriteIcon } from '@/src/icons';

interface ApplicationProps {
  application: DialAIEntityModel;
  isFavorite: boolean;
  onFavoriteClick: (modelId: string, isFavorite: boolean) => void;
  onAppClick: (modelId: string) => void;
}

export const Application = ({
  application,
  isFavorite,
  onFavoriteClick,
  onAppClick,
}: ApplicationProps) => {
  const { t } = useTranslation(Translation.Chat);
  const [isOpened, setIsOpened] = useState(false);
  const AppIcon = getApplicationIcon(application.id, true);
  const appDescription = application.description || '';
  const indexOfDelimiter = useMemo(
    () => appDescription.indexOf('\n\n'),
    [appDescription],
  );
  const isShortDescription = useMemo(
    () => indexOfDelimiter === -1,
    [indexOfDelimiter],
  );

  return (
    <div>
      <div
        onClick={() => onAppClick(application.id)}
        className={classNames(
          'relative flex min-h-[190px] min-w-[calc(100%-20px)] flex-col items-center rounded-secondary border border-secondary bg-layer-2 shadow-secondary hover:cursor-pointer hover:border-tertiary md:w-[420px]',
          isOpened ? 'h-full' : 'h-[190px]',
        )}
      >
        <div className="flex w-full items-center self-start border-secondary pr-10">
          <div className="self-start px-4 pt-4">
            <AppIcon />
          </div>
          <div className="flex size-full flex-col items-start gap-2 text-left text-pr-primary-700">
            <div className="flex items-center pt-3 text-xl font-semibold">
              {application.name}
            </div>
            <div className="overflow-hidden overflow-ellipsis text-xs leading-4 text-pr-primary-700">
              {isShortDescription ? (
                appDescription
              ) : (
                <span>{appDescription.slice(0, indexOfDelimiter)}</span>
              )}
            </div>
          </div>
        </div>
        {!isShortDescription && (
          <div className="additional-description flex w-full flex-col overflow-hidden px-6 pb-4 pt-2 text-xs">
            <div
              className=" self-start leading-4  text-pr-primary-700"
              onClick={(e) => {
                if ((e.target as HTMLAnchorElement)?.tagName === 'A') {
                  e.stopPropagation();
                }
              }}
            >
              <EntityMarkdownDescription isShortDescription={!isOpened}>
                {appDescription.slice(indexOfDelimiter + 2)}
              </EntityMarkdownDescription>
            </div>
            <button
              className="self-end pt-2 font-semibold text-secondary-bg-dark hover:text-pr-primary-700"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpened(!isOpened);
              }}
              data-qa="expand-group-entity"
            >
              {isOpened ? t('Read less') : t('Read more')}
            </button>
          </div>
        )}
        <Tooltip
          placement="top"
          tooltip={t('Add to Favorites')}
          triggerClassName="absolute right-3 top-3 hover:cursor-pointer"
        >
          <FavoriteIcon
            // TODO Add #FFD440 as color variable
            color={isFavorite ? '#FFD440' : 'var(--bg-layer-2)'}
            onClick={(e) => {
              stopBubbling(e);
              onFavoriteClick(application.id, !isFavorite);
            }}
          />
        </Tooltip>
      </div>
    </div>
  );
};

interface ApplicationListProps {
  onCreateNewConversation: (modelId: string) => void;
  onUpdateFavoriteApp: (modelId: string, isFavorite: boolean) => void;
}

export const ApplicationList = ({
  onCreateNewConversation,
  onUpdateFavoriteApp,
}: ApplicationListProps) => {
  const { t } = useTranslation(Translation.Chat);
  const allApplications = useAppSelector(ModelsSelectors.selectAppsOnly);
  const favoriteAppIds = useAppSelector(
    ModelsSelectors.selectFavoriteApplicationsIds,
  );

  return (
    <div className="flex size-full flex-col items-center py-14">
      <h3 className="font-weave text-3xl font-bold text-pr-primary-700">
        {t('Applications')}
      </h3>
      <div className="flex flex-wrap justify-center gap-10 px-4 py-14 md:px-2">
        {allApplications.map((app) => (
          <Application
            onAppClick={onCreateNewConversation}
            key={app.id}
            application={app}
            isFavorite={favoriteAppIds.includes(app.id)}
            onFavoriteClick={onUpdateFavoriteApp}
          />
        ))}
      </div>
    </div>
  );
};
