import { IconPlayerPlay } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useAgentMenuItems } from '@/src/hooks/useAgentMenuItems';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getApplicationSimpleStatus,
  isApplicationPublic,
  isExecutableApp,
} from '@/src/utils/app/application';

import {
  ApplicationStatus,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { AuthSelectors } from '@/src/store/auth/auth.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { IconButton } from '@/src/components/Common/IconButton';
import Tooltip from '@/src/components/Common/Tooltip';
import { AgentBookmark } from '@/src/components/Marketplace/AgentBookmark';
import { AgentContextMenu } from '@/src/components/Marketplace/AgentContextMenu';

const getDisabledTooltip = (entity: DialAIEntityModel, normal: string) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.UNDEPLOYING:
    case ApplicationStatus.DEPLOYING:
      return `Application is ${entity.functionStatus.toLowerCase()}`;
    case ApplicationStatus.DEPLOYED:
      return `Undeploy application to ${normal.toLowerCase()}`;
    default:
      return normal;
  }
};

interface Props {
  entity: DialAIEntityModel;
  allVersions: DialAIEntityModel[];
  onChangeVersion: (entity: DialAIEntityModel) => void;
  onUseEntity: () => void;
  onBookmarkClick: (entity: DialAIEntityModel) => void;
}

export const ApplicationDetailsFooter = ({
  entity,
  allVersions,
  onChangeVersion,
  onUseEntity,
  onBookmarkClick,
}: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const screenState = useScreenState();

  const agentMenuItemsParams = useMemo(
    () => ({
      entity,
      disabledActions: {
        copyLink: screenState !== ScreenState.SM,
      },
    }),
    [entity, screenState],
  );

  const menuItems = useAgentMenuItems(agentMenuItemsParams);

  const showContextMenu =
    entity.reference !== entity.id && screenState === ScreenState.SM;
  const isPublicApp = isApplicationPublic(entity);
  const playerStatus = getApplicationSimpleStatus(entity);

  return (
    <section className="flex px-3 py-4 md:px-6">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {showContextMenu ? (
            <button className="icon-button">
              <AgentContextMenu
                className="xl:invisible group-hover:xl:visible"
                triggerIconSize={24}
                entity={entity}
              />
            </button>
          ) : (
            menuItems.map(({ display, name, disabled, ...props }) =>
              display ? (
                <IconButton
                  key={name}
                  name={disabled ? getDisabledTooltip(entity, name) : name}
                  disabled={disabled}
                  {...props}
                />
              ) : null,
            )
          )}
          <AgentBookmark
            entity={entity}
            size={24}
            className="icon-button group/bookmark"
            onBookmarkClick={onBookmarkClick}
          />
        </div>
        <div className="flex w-full min-w-0 items-center justify-end gap-4">
          <ModelVersionSelect
            className="truncate"
            entities={allVersions}
            currentEntity={entity}
            showVersionPrefix
            onSelect={onChangeVersion}
          />
          <Tooltip
            hideTooltip={
              !isExecutableApp(entity) ||
              playerStatus === SimpleApplicationStatus.UNDEPLOY
            }
            tooltip={t(
              isPublicApp && !isAdmin
                ? 'Ask your administrator to deploy this application to be able to use it'
                : 'Deploy the application to be able to use it',
            )}
          >
            <button
              onClick={onUseEntity}
              className="button button-primary flex shrink-0 items-center gap-2 font-theme text-sm"
              data-qa="use-button"
              disabled={
                isExecutableApp(entity) &&
                playerStatus !== SimpleApplicationStatus.UNDEPLOY
              }
            >
              <IconPlayerPlay size={18} />
              <span className="hidden md:block">
                {t('Use {{modelType}}', {
                  modelType: entity.type,
                })}
              </span>
              <span className="block md:hidden">{t('Use')}</span>
            </button>
          </Tooltip>
        </div>
      </div>
    </section>
  );
};
