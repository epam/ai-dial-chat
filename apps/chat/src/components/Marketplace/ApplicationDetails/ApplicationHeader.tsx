import { IconUserShare } from '@tabler/icons-react';
import { MouseEventHandler, useCallback } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isApplicationPublic } from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';

import { FeatureType, ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';

import { HeaderIconSizes } from '@/src/constants/marketplace';

import { FunctionStatusIndicator } from '@/src/components/Marketplace/FunctionStatusIndicator';

import { ModelIcon } from '../../Chatbar/ModelIcon';
import ShareIcon from '../../Common/ShareIcon';
import { TopicsList } from '../TopicsList';
import { ApplicationCopyLink } from './ApplicationCopyLink';

import { Feature } from '@epam/ai-dial-shared';

interface Props {
  entity: DialAIEntityModel;
  isPreview?: boolean;
}

export const ApplicationDetailsHeader = ({ entity, isPreview }: Props) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();
  const screenState = useScreenState();

  const { iconSize, shareIconSize } = HeaderIconSizes[screenState];

  const isMyApp = isMyApplication(entity);
  const isPublicApp = isApplicationPublic(entity);
  const handleOpenSharing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      dispatch(
        ShareActions.share({
          featureType: FeatureType.Application,
          resourceId: entity.id,
        }),
      );
    }, [dispatch, entity.id]);

  const isApplicationsSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  );

  return (
    <header className="flex items-start justify-between px-3 py-4 md:p-6">
      <div className="flex w-full items-center gap-2 overflow-hidden md:gap-4">
        <ShareIcon
          {...entity}
          isHighlighted={false}
          size={shareIconSize}
          featureType={FeatureType.Application}
          iconClassName="bg-layer-3"
          isMyEntity={isMyApp}
        >
          <ModelIcon
            enableShrinking
            isCustomTooltip
            entity={entity}
            entityId={entity.id}
            size={iconSize}
          />
        </ShareIcon>
        <div className="flex min-w-0 shrink grow flex-col justify-center gap-1 md:gap-3">
          <div className="flex shrink-0 justify-between ">
            <div
              className={classNames(
                'flex w-full flex-col',
                entity.topics?.length ? 'gap-2' : '',
              )}
            >
              {entity.topics && (
                <TopicsList
                  topics={entity.topics}
                  counterMarginRight={screenState === ScreenState.SM ? 18 : 0}
                />
              )}
              <div className="flex items-center gap-[2px] whitespace-nowrap">
                <div
                  className="shrink truncate text-lg font-semibold leading-[18px] md:text-xl md:leading-6"
                  data-qa="agent-name"
                >
                  {entity.name}
                </div>
                <FunctionStatusIndicator entity={entity} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {isMyApp &&
        isApplicationsSharingEnabled &&
        screenState !== ScreenState.SM &&
        !isPreview && (
          <button
            className="flex gap-2 px-3 py-1.5 text-sm text-accent-primary"
            onClick={handleOpenSharing}
          >
            <IconUserShare size={18} />
            <span>{t('Share')}</span>
          </button>
        )}
      {isPublicApp && screenState !== ScreenState.SM && (
        <ApplicationCopyLink entity={entity} withText />
      )}
    </header>
  );
};
