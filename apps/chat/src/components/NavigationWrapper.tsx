import {
  IconCube,
  IconHome2,
  IconLayoutGrid,
  IconMessage2,
  TablerIconsProps,
} from '@tabler/icons-react';
import { JSX, ReactNode, useCallback } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useWidgets } from '../hooks/useWidgets';
import { useTranslation } from '@/src/hooks/useTranslation';

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

import { DEFAULT_CONVERSATION_NAME } from '../constants/default-ui-settings';
import { MarketplaceTabs } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { Chatbar } from '@/src/components/Chatbar/Chatbar';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import Tooltip from '@/src/components/Common/Tooltip';
import { MarketplaceFilterbar } from '@/src/components/Marketplace/MarketplaceFilterbar';
import { Promptbar } from '@/src/components/Promptbar';
import { Widgetbar } from '@/src/components/Widgetbar';

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
        'flex max-h-[52px] min-w-[72px] shrink-0 cursor-pointer select-none flex-col items-center justify-center gap-[2px] rounded border border-transparent transition-colors duration-200 active:bg-accent-primary-alpha active:disabled:bg-transparent md:min-w-min md:p-[9px] md:hover:bg-accent-primary-alpha md:active:bg-transparent md:hover:disabled:bg-transparent md:active:disabled:bg-transparent',
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
        caption={t('Apps')}
      />
      <NavigationButton
        onClick={handleMyAppsClick}
        tooltip={t('My workspace')}
        Icon={IconHome2}
        selected={
          isMarketplace &&
          selectedMarketplaceTab === MarketplaceTabs.MY_WORKSPACE
        }
        dataQa="my-workspace"
        caption={t('Home')}
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

const Navigation = () => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const router = useRouter();

  const isMarketplaceEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Marketplace),
  );
  const widgetsSchemaIds = useAppSelector(
    SettingsSelectors.selectWidgetsSchemaIds,
  );
  const selectedWidget = useAppSelector(
    ApplicationSelectors.selectSelectedWidget,
  );

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

  return (
    <div
      className={classNames(
        'order-last h-[52px] w-full shrink-0 flex-row items-center justify-around gap-2 border-tertiary bg-layer-3 md:z-40 md:order-none md:h-full md:w-[60px] md:flex-col md:justify-start md:border-r md:py-2',
        !isMarketplaceEnabled && !widgetsSchemaIds.size ? 'hidden' : 'flex',
      )}
      data-qa="navigation-panel"
    >
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
    </div>
  );
};

interface NavigationWrapperProps {
  children: ReactNode;
}

export const NavigationWrapper = ({ children }: NavigationWrapperProps) => {
  const router = useRouter();

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  return (
    <div className="size-full">
      <Widgetbar />

      <div className="flex size-full flex-col md:flex-row ">
        <Navigation />
        {router.route === Routes.Chat &&
          enabledFeatures.has(Feature.ConversationsSection) && <Chatbar />}
        {router.route === Routes.Marketplace && <MarketplaceFilterbar />}
        <div className="grow overflow-hidden">{children}</div>
        {router.route === Routes.Chat &&
          enabledFeatures.has(Feature.PromptsSection) && <Promptbar />}
      </div>
    </div>
  );
};
