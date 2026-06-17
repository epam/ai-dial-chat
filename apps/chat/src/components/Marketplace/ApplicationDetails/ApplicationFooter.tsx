import { IconExternalLink } from '@tabler/icons-react';
import { useMemo } from 'react';

import Link from 'next/link';

import classNames from 'classnames';

import { useAgentMenuItems } from '@/src/hooks/useAgentMenuItems';
import { useApplicationDeployment } from '@/src/hooks/useApplicationDeployment';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isExternalApp } from '@/src/utils/app/application';

import { ApplicationStatus, ExternalAppConfig } from '@/src/types/applications';
import { EntityType, ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors } from '@/src/store/selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { IconButton } from '@/src/components/Common/IconButton';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { ApplicationDetailsFooterProps } from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { MarketplaceEntityContextMenu } from '@/src/components/Marketplace/EntityContextMenu/MarketplaceEntityContextMenu';
import { MarketplaceEntityBookmark } from '@/src/components/Marketplace/MarketplaceEntityBookmark';

import { DialPrimaryButton } from '@epam/ai-dial-ui-kit';

const getEntityTypeLabel = (
  entityType: EntityType,
  isMobile: boolean,
  t: (key: string) => string,
): string => {
  switch (entityType) {
    case EntityType.Application: {
      return isMobile
        ? t(MarketplaceI18nKeys.AppEntity)
        : t(MarketplaceI18nKeys.ApplicationEntity);
    }
    case EntityType.Model: {
      const model = t(MarketplaceI18nKeys.ModelEntity);
      if (model !== MarketplaceI18nKeys.ModelEntity) {
        return model;
      }

      return t(MarketplaceI18nKeys.ModelEntity);
    }
    case EntityType.Toolset: {
      const toolset = t(MarketplaceI18nKeys.ToolsetEntity);
      if (toolset !== MarketplaceI18nKeys.ToolsetEntity) {
        return toolset;
      }

      return entityType;
    }
    default:
      return entityType;
  }
};

const getDisabledTooltip = (entity: DialAIEntityModel, normal: string) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.UNDEPLOYING:
    case ApplicationStatus.DEPLOYING:
    case ApplicationStatus.REDEPLOYING:
      return `Application is ${entity.functionStatus.toLowerCase()}`;
    case ApplicationStatus.DEPLOYED:
      return `Undeploy application to ${normal.toLowerCase()}`;
    default:
      return normal;
  }
};

export const ApplicationDetailsFooter = ({
  entity,
  allVersions,
  onChangeVersion,
  onUseEntity,
  onBookmarkClick,
}: ApplicationDetailsFooterProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const isAppLoading = useAppSelector(
    ApplicationSelectors.selectIsApplicationLoading,
  );
  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const screenState = useScreenState();

  const isScreenSmall = screenState === ScreenState.SM;
  const showContextMenu = entity.reference !== entity.id && isScreenSmall;

  const {
    showAsUseButton,
    isButtonDisabled,
    buttonTooltip,
    createButtonClickHandler,
    DeployIcon,
  } = useApplicationDeployment(entity);

  const agentMenuItemsParams = useMemo(
    () => ({
      entity,
      disabledActions: {
        copyLink: !isScreenSmall,
        share: !showContextMenu,
        unshare: !entity?.sharedWithMe,
        deploy: ApplicationStatus.DEPLOYED !== entity.functionStatus,
      },
    }),
    [entity, isScreenSmall, showContextMenu],
  );

  const menuItems = useAgentMenuItems(agentMenuItemsParams);
  const filteredMenuItems = useMemo(
    () => menuItems.filter((item) => item.display),
    [menuItems],
  );

  const translatedEntityTypeLabel = useMemo(
    () => getEntityTypeLabel(entity.type, isScreenSmall, t),
    [entity.type, isScreenSmall, t],
  );

  const buttonLabel = showAsUseButton
    ? isScreenSmall
      ? t(MarketplaceI18nKeys.UseMarketplace)
      : t(MarketplaceI18nKeys.UseModelType, {
          ns: Translation.Marketplace,
          modelType: translatedEntityTypeLabel,
        })
    : t(MarketplaceI18nKeys.DeployMarketplace);

  return (
    <section className="flex px-3 py-4 md:px-6">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {showContextMenu ? (
            <button className="icon-button">
              <MarketplaceEntityContextMenu
                className="xl:invisible group-hover:xl:visible"
                triggerIconSize={DEFAULT_ICON_SIZES.STANDARD}
                entity={entity}
              />
            </button>
          ) : (
            filteredMenuItems.map(
              ({ name, disabled, className, iconClassName, ...props }) => (
                <IconButton
                  key={name}
                  name={disabled ? getDisabledTooltip(entity, name) : name}
                  disabled={disabled}
                  className={classNames(iconClassName, className)}
                  {...props}
                />
              ),
            )
          )}
          {onBookmarkClick && (
            <MarketplaceEntityBookmark
              entity={entity}
              size={DEFAULT_ICON_SIZES.STANDARD}
              className="icon-button group/bookmark"
              onBookmarkClick={onBookmarkClick}
            />
          )}
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
            hideTooltip={!buttonTooltip}
            triggerClassName="shrink-0"
            tooltip={buttonTooltip}
          >
            {!isExternalApp(entity) ? (
              <DialPrimaryButton
                onClick={createButtonClickHandler(onUseEntity)}
                data-qa="use-button"
                disabled={isButtonDisabled}
                iconBefore={<DeployIcon size={18} />}
                label={buttonLabel}
              />
            ) : (
              <Link
                href={
                  (appDetails?.applicationProperties as ExternalAppConfig)
                    ?.external_url ?? ''
                }
                target="_blank"
                className={classNames(
                  'button button-primary flex shrink-0 items-center gap-2 font-theme text-sm',
                  isAppLoading && 'cursor-not-allowed',
                )}
                data-qa="external-link"
              >
                <IconExternalLink size={18} />
                <span className="hidden md:block">
                  {t(MarketplaceI18nKeys.OpenInNewTab)}
                </span>
                <span className="block md:hidden">
                  {t(MarketplaceI18nKeys.OpenMarketplace)}
                </span>
              </Link>
            )}
          </Tooltip>
        </div>
      </div>
    </section>
  );
};
