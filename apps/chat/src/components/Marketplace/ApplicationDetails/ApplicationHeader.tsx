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
import { ApplicationTopic } from '../ApplicationTopic';
import { ApplicationCopyLink } from './ApplicationCopyLink';

import { Feature } from '@epam/ai-dial-shared';

interface Props {
  entity: DialAIEntityModel;
}

export const ApplicationDetailsHeader = ({ entity }: Props) => {
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
      <div className="flex items-center gap-2 overflow-hidden md:gap-4">
        <ShareIcon
          {...entity}
          isHighlighted={false}
          size={shareIconSize}
          featureType={FeatureType.Application}
          iconClassName="bg-layer-3 !stroke-[0.6] !rounded-[4px]"
          iconWrapperClassName="!rounded-[4px]"
        >
          <ModelIcon
            enableShrinking
            isCustomTooltip
            entity={entity}
            entityId={entity.id}
            size={iconSize}
          />
        </ShareIcon>
        <div className="flex min-w-0 shrink flex-col justify-center gap-1 md:gap-3">
          <div className="flex justify-between">
            <div className="flex w-full flex-col gap-2">
              <div
                className={classNames(
                  'flex flex-wrap gap-2 overflow-hidden truncate',
                  entity.topics?.length ? 'block' : 'hidden',
                )}
              >
                {entity.topics?.map((topic) => (
                  <ApplicationTopic key={topic} topic={topic} />
                ))}
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
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
        screenState !== ScreenState.MOBILE && (
          <button
            className="flex gap-2 px-3 py-1.5 text-sm text-accent-primary"
            onClick={handleOpenSharing}
          >
            <IconUserShare size={18} />
            <span>{t('Share')}</span>
          </button>
        )}
      {isPublicApp && screenState !== ScreenState.MOBILE && (
        <ApplicationCopyLink reference={entity.reference} withText />
      )}
    </header>
  );
};
