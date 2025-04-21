import {
  IconBrowser,
  IconHomeRibbon,
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
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceActions,
  MarketplaceSelectors,
} from '@/src/store/marketplace/marketplace.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { DEFAULT_CONVERSATION_NAME } from '../constants/default-ui-settings';
import {
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { Chatbar } from '@/src/components/Chatbar/Chatbar';
import { ModelIcon, ModelTooltip } from '@/src/components/Chatbar/ModelIcon';
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
  tooltip?: ReactNode;
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
  const disabled = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  return (
    <Tooltip
      tooltip={tooltip}
      isTriggerClickable
      triggerClassName={classNames(
        'flex   shrink-0 select-none rounded transition-colors duration-200 md:min-w-min',
        rounded && 'rounded-full border border-transparent',
        rounded && selected && '!border-accent-primary',
        isOverlay ? 'max-h-[36px] min-w-[44px]' : 'max-h-[52px] min-w-[72px]',
        isOverlay && rounded && 'md:my-0',
        disabled
          ? 'cursor-not-allowed'
          : 'cursor-pointer hover:bg-accent-primary-alpha active:bg-accent-primary-alpha',
      )}
    >
      <button
        data-qa={dataQa}
        onClick={!selected && !disabled ? onClick : undefined}
        className={classNames(
          'flex size-full flex-col items-center justify-center gap-[2px]',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          !isOverlay ? (rounded ? 'md:p-[9px]' : 'md:p-[10px]') : 'md:p-1',
        )}
      >
        {Icon && (
          <Icon
            className={classNames(
              'min-h-[24px] min-w-[24px]',
              selected ? 'text-accent-primary' : 'text-secondary',
            )}
            width={24}
            height={24}
            size={24}
          />
        )}

        {!isOverlay && (
          <span
            className={classNames(
              'text-xs leading-[15px] md:hidden',
              selected ? 'text-accent-primary' : 'text-secondary',
            )}
          >
            {caption}
          </span>
        )}
      </button>
    </Tooltip>
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
        const query =
          tab === MarketplaceTabs.MY_WORKSPACE
            ? `?${MarketplaceQueryParams.tab}=${MarketplaceTabs.MY_WORKSPACE}`
            : '';
        router.push(`${Routes.Marketplace}${query}`).then(() => {
          dispatch(MarketplaceActions.setSelectedTab(tab));
          dispatch(ApplicationActions.selectWidget(undefined));
        });
      } else {
        dispatch(MarketplaceActions.setSelectedTab(tab));
        dispatch(ApplicationActions.selectWidget(undefined));
      }
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
      <div className="no-scrollbar hidden w-full flex-col items-center gap-2 overflow-y-auto border-t border-tertiary pt-2 empty:border-transparent md:flex">
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
                isCustomTooltip
              />
            )}
            tooltip={<ModelTooltip entity={model} entityId={model.id} />}
          />
        ))}
      </div>

      <div className="md:hidden">
        <NavigationButton
          onClick={handleOpenWidgetsClick}
          Icon={IconBrowser}
          selected={!!selectedWidget && router.route === Routes.Chat}
          dataQa="widgets-sidebar-trigger"
          caption={t('Widgets')}
          tooltip={t('Widgets')}
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
  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const handleChatClick = useCallback(() => {
    return router.push(Routes.Chat).then(() => {
      dispatch(
        ConversationsActions.setIsStartedCustomViewerConversation(false),
      );
      dispatch(ApplicationActions.selectWidget(undefined));
      if (!selectedConversationIds.length) {
        dispatch(
          ConversationsActions.createNewConversations({
            names: [DEFAULT_CONVERSATION_NAME],
          }),
        );
      }
    });
  }, [dispatch, router, selectedConversationIds.length]);

  return (
    <div
      className={classNames(
        'order-last w-full shrink-0 flex-row items-center justify-around gap-2 border-tertiary bg-layer-3 md:z-40 md:order-none md:h-full md:flex-col md:justify-start md:border-r md:py-2',
        !isMarketplaceEnabled && !widgetsSchemaIds.size ? 'hidden' : 'flex',
        isOverlay ? 'h-[36px] md:w-[44px]' : 'h-[52px] md:w-[60px]',
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
        {(router.route === Routes.Chat ||
          router.route === Routes.Marketplace) && <Navigation />}
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
