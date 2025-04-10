import {
  IconCube,
  IconHomeRibbon,
  IconLayoutGrid,
  IconMessage2,
  TablerIconsProps,
} from '@tabler/icons-react';
import { JSX, useCallback } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useWidgets } from '@/src/hooks/useWidgets';

import { ScreenState } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceActions,
  MarketplaceSelectors,
} from '@/src/store/marketplace/marketplace.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { MarketplaceTabs } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import Tooltip from '@/src/components/Common/Tooltip';
import { UserDesktop } from '@/src/components/Profile/User/UserDesktop';
import { UserMobile } from '@/src/components/Profile/User/UserMobile';

import { Feature } from '@epam/ai-dial-shared';

interface NavigationButtonProps {
  onClick: () => void;
  Icon?: (props: TablerIconsProps) => JSX.Element;
  ModelIcon?: () => JSX.Element;
  selected?: boolean;
  tooltip?: string;
  dataQa?: string;
  caption?: string;
  rounded?: boolean;
}

const NavigationButton = ({
  onClick,
  Icon,
  selected,
  tooltip,
  dataQa,
  caption,
  rounded = false,
}: NavigationButtonProps) => {
  return (
    <button
      data-qa={dataQa}
      onClick={onClick}
      className={classNames(
        'flex max-h-[52px] min-w-[72px] shrink-0 cursor-pointer select-none flex-col items-center justify-center gap-[2px] rounded border border-transparent transition-colors duration-200 hover:bg-accent-primary-alpha active:bg-accent-primary-alpha hover:disabled:bg-transparent md:min-w-min md:p-[9px]',
        rounded && 'rounded-full',
        rounded && selected && '!border-accent-primary',
      )}
    >
      {Icon && (
        <Tooltip tooltip={tooltip} isTriggerClickable>
          <Icon
            className={selected ? 'text-accent-primary' : 'text-secondary'}
            width={24}
            height={24}
          />
        </Tooltip>
      )}

      <span
        className={classNames(
          'text-xs leading-[15px] md:hidden',
          selected ? 'text-accent-primary' : 'text-secondary',
        )}
      >
        {caption}
      </span>
    </button>
  );
};

const MarketplaceNavigation = () => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const router = useRouter();

  const selectedMarketplaceTab = useAppSelector(
    MarketplaceSelectors.selectSelectedTab,
  );

  const isMarketplace = router.route === Routes.Marketplace;

  const handleChangeTab = useCallback(
    (tab: MarketplaceTabs) => {
      if (!isMarketplace) {
        router
          .push(Routes.Marketplace)
          .then(() => dispatch(MarketplaceActions.setSelectedTab(tab)));
      } else {
        dispatch(MarketplaceActions.setSelectedTab(tab));
      }
      dispatch(ApplicationActions.selectWidget(undefined));
    },
    [dispatch, isMarketplace, router],
  );

  const handleHomeClick = useCallback(
    () => handleChangeTab(MarketplaceTabs.HOME),
    [handleChangeTab],
  );

  const handleMyAppsClick = useCallback(
    () => handleChangeTab(MarketplaceTabs.MY_WORKSPACE),
    [handleChangeTab],
  );

  return (
    <>
      <NavigationButton
        onClick={handleHomeClick}
        tooltip={t('DIAL Marketplace')}
        Icon={IconLayoutGrid}
        selected={
          isMarketplace && selectedMarketplaceTab === MarketplaceTabs.HOME
        }
        dataQa="marketplace-home-page"
        caption={t('Agents')}
      />
      <NavigationButton
        onClick={handleMyAppsClick}
        tooltip={t('My workspace')}
        Icon={IconHomeRibbon}
        selected={
          isMarketplace &&
          selectedMarketplaceTab === MarketplaceTabs.MY_WORKSPACE
        }
        dataQa="my-workspace"
        caption={t('Workspace')}
      />
    </>
  );
};

const UsedWidgets = () => {
  const { t } = useTranslation(Translation.SideBar);

  const router = useRouter();

  const dispatch = useAppDispatch();

  const selectedWidget = useAppSelector(
    ApplicationSelectors.selectSelectedWidget,
  );

  const { widgetModels, handleWidgetClick } = useWidgets();

  const handleOpenWidgetsClick = useCallback(() => {
    dispatch(UIActions.setShowWidgetbar(true));
  }, [dispatch]);

  return (
    <>
      <div className="no-scrollbar hidden w-full flex-col items-center gap-2 overflow-y-auto md:flex">
        {widgetModels.map((model) => (
          <NavigationButton
            key={model.reference}
            rounded
            onClick={() => handleWidgetClick(model.reference)}
            selected={
              model.reference === selectedWidget && router.route === Routes.Chat
            }
            Icon={({ height }) => (
              <ModelIcon
                entity={model}
                entityId={model.id}
                size={height as number}
              />
            )}
          />
        ))}
      </div>

      <div className="md:hidden">
        <NavigationButton
          onClick={handleOpenWidgetsClick}
          Icon={IconCube}
          selected={!!selectedWidget && router.route === Routes.Chat}
          dataQa="widgets-sidebar-trigger"
          caption={t('Widgets')}
        />
      </div>
    </>
  );
};

const NavigationView = () => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const router = useRouter();

  const isMarketplaceEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Marketplace),
  );
  const isProfileEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ShowProfile),
  );
  const isHeaderEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Header),
  );
  const widgetsSchemaIds = useAppSelector(
    SettingsSelectors.selectWidgetsSchemaIds,
  );
  const selectedWidget = useAppSelector(
    ApplicationSelectors.selectSelectedWidget,
  );
  const screenState = useScreenState();

  const handleChatClick = useCallback(() => {
    if (router.route !== Routes.Chat) {
      return router.push(Routes.Chat).then(() => {
        dispatch(
          ConversationsActions.setIsStartedCustomViewerConversation(false),
        );
      });
    } else {
      dispatch(
        ConversationsActions.createNewConversations({
          names: [DEFAULT_CONVERSATION_NAME],
        }),
      );
    }
  }, [dispatch, router]);

  const handleUserMobileClick = useCallback(() => {
    return router.push(Routes.Profile, undefined, { shallow: true });
  }, [router]);

  // TODO: remove isHeaderEnabled it one of the next releases
  const showProfile = isHeaderEnabled || isProfileEnabled;

  return (
    <div
      className="order-last flex h-[52px] w-full shrink-0 flex-row items-center justify-between gap-2 border-tertiary bg-layer-3 md:z-40 md:order-none md:h-full md:w-[60px] md:flex-col md:justify-start md:border-r md:py-2"
      data-qa="navigation-panel"
    >
      <div className="no-scrollbar flex grow flex-row items-center justify-around overflow-y-auto md:flex-col md:justify-start">
        <NavigationButton
          onClick={handleChatClick}
          tooltip={t('Chat')}
          Icon={IconMessage2}
          selected={router.route === Routes.Chat && !selectedWidget}
          dataQa="back-to-chat"
          caption={t('Chat')}
        />
        {isMarketplaceEnabled && <MarketplaceNavigation />}
        {!!widgetsSchemaIds.size && <UsedWidgets />}
        {screenState === ScreenState.SM && showProfile && (
          <div className="flex items-center justify-center">
            <NavigationButton
              onClick={handleUserMobileClick}
              tooltip={t('User')}
              Icon={UserMobile}
              selected={router.route === Routes.Profile}
              dataQa="user-settings"
              caption={t('User')}
            />
          </div>
        )}
      </div>
      {screenState !== ScreenState.SM && showProfile && (
        <div className="flex items-center justify-center p-[10px]">
          <UserDesktop />
        </div>
      )}
    </div>
  );
};

export const Navigation = () => {
  const isMarketplaceEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Marketplace),
  );
  const isProfileEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ShowProfile),
  );
  const isHeaderEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Header),
  );
  const widgetsSchemaIds = useAppSelector(
    SettingsSelectors.selectWidgetsSchemaIds,
  );

  if (
    !isMarketplaceEnabled &&
    !isProfileEnabled &&
    !isHeaderEnabled &&
    !widgetsSchemaIds.size
  ) {
    return null;
  }

  return <NavigationView />;
};
