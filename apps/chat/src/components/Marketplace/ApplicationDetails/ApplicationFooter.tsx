import {
  IconCloudUpload,
  IconExternalLink,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import classNames from 'classnames';

import { useAgentMenuItems } from '@/src/hooks/useAgentMenuItems';
import { useApplicationStatusActions } from '@/src/hooks/useApplicationStatusActions';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getApplicationSimpleStatus,
  isExecutableApp,
  isExternalApp,
  isMarketplaceEntityPublic,
} from '@/src/utils/app/application';

import {
  ApplicationStatus,
  ExternalAppConfig,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors, AuthSelectors } from '@/src/store/selectors';

import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { IconButton } from '@/src/components/Common/IconButton';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { ApplicationDetailsFooterProps } from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { MarketplaceEntityContextMenu } from '@/src/components/Marketplace/EntityContextMenu/MarketplaceEntityContextMenu';
import { MarketplaceEntityBookmark } from '@/src/components/Marketplace/MarketplaceEntityBookmark';

import { DialPrimaryButton } from '@epam/ai-dial-ui-kit';

const useApplicationDeployment = (entity: DialAIEntityModel) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const { handleDeploy } = useApplicationStatusActions(entity.id);

  const [wasDeployClicked, setWasDeployClicked] = useState(false);

  const simpleStatus = getApplicationSimpleStatus(entity);
  const isDeployed = simpleStatus === SimpleApplicationStatus.UNDEPLOY;
  const isUpdating = simpleStatus === SimpleApplicationStatus.UPDATING;
  const isUndeploying = entity.functionStatus === ApplicationStatus.UNDEPLOYING;

  const isExecutable = isExecutableApp(entity);
  const isPublicApp = isMarketplaceEntityPublic(entity);

  const showAsUseButton =
    !isUndeploying && (isDeployed || isUpdating || wasDeployClicked);

  const isButtonDisabled =
    isExecutable &&
    ((!isDeployed && isPublicApp && !isAdmin) ||
      isUpdating ||
      isUndeploying ||
      (wasDeployClicked && !isDeployed));

  const buttonTooltip = useMemo(() => {
    if (!isExecutable) {
      return;
    }
    if (wasDeployClicked && !isDeployed) {
      return t(`Application is deploying`);
    }
    if (isUpdating || isUndeploying) {
      return t(`Application is ${entity.functionStatus?.toLowerCase()}`);
    }
    if (isButtonDisabled && isExecutable) {
      return t(
        isPublicApp && !isAdmin
          ? 'Ask your administrator to deploy this application to be able to use it'
          : 'Ask author to deploy the application to be able to use it',
      );
    }
    return '';
  }, [
    isUpdating,
    isUndeploying,
    isButtonDisabled,
    isExecutable,
    isPublicApp,
    isAdmin,
    t,
    entity.functionStatus,
  ]);

  const handleButtonClick = useCallback(
    (onUseEntity?: () => void) => (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isExecutable && !isDeployed) {
        setWasDeployClicked(true);
        handleDeploy();
      } else {
        onUseEntity?.();
      }
    },
    [isDeployed, handleDeploy],
  );

  useEffect(() => {
    if (isUndeploying || (!isDeployed && !isUpdating)) {
      setWasDeployClicked(false);
    }
  }, [isUndeploying, isDeployed, isUpdating]);

  useEffect(() => {
    if (isExternalApp(entity)) {
      dispatch(ApplicationActions.get({ applicationId: entity.id }));
    }
  }, [dispatch, entity.id]);

  return {
    isExecutable,
    isPublicApp,
    isDeployed,
    isUpdating,
    isUndeploying,
    showAsUseButton,
    isButtonDisabled,
    buttonTooltip,
    handleButtonClick,
  };
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
    handleButtonClick,
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

  const buttonLabel = showAsUseButton
    ? isScreenSmall
      ? t('Use')
      : t('Use {{modelType}}', {
          ns: Translation.Marketplace,
          modelType: entity.type,
        })
    : t('Deploy');

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
                onClick={handleButtonClick(onUseEntity)}
                data-qa="use-button"
                disabled={isButtonDisabled}
                iconBefore={
                  showAsUseButton ? (
                    <IconPlayerPlay size={18} />
                  ) : (
                    <IconCloudUpload size={18} />
                  )
                }
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
                <span className="hidden md:block">{t('Open in New Tab')}</span>
                <span className="block md:hidden">{t('Open')}</span>
              </Link>
            )}
          </Tooltip>
        </div>
      </div>
    </section>
  );
};
