import {
  Icon,
  IconBrowser,
  IconHomeRibbon,
  IconLayoutGrid,
  IconMessage2,
  IconProps,
} from '@tabler/icons-react';
import { JSX, ReactNode, useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';
import { useWidgets } from '@/src/hooks/useWidgets';

import { Translation } from '@/src/types/translation';

import { UISelectors } from '../store/ui/ui.selectors';
import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceActions } from '@/src/store/marketplace/marketplace.reducers';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.selectors';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { DEFAULT_CONVERSATION_NAME } from '../constants/default-ui-settings';
import { MarketplaceTabs } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { PromptDialogs } from './Promptbar/components/PromptDialogs';
import { Chatbar } from '@/src/components/Chatbar/Chatbar';
import { ModelIcon, ModelTooltip } from '@/src/components/Chatbar/ModelIcon';
import Loader from '@/src/components/Common/Loader';
import Tooltip from '@/src/components/Common/Tooltip';
import { MarketplaceFilterbar } from '@/src/components/Marketplace/MarketplaceFilterbar';
import { Promptbar } from '@/src/components/Promptbar';

import { ChatModalsManager } from './Chat/ChatModalsManager';
import { withRenderWhen } from './Common/RenderWhen';

import { Feature } from '@epam/ai-dial-shared';

interface NavigationButtonProps {
  onClick: () => void;
  Icon?: Icon;
  ModelIcon?: () => JSX.Element;
  selected?: boolean;
  tooltip?: ReactNode;
  dataQa?: string;
  caption?: string;
  rounded?: boolean;
  allowClickSelected?: boolean;
}

const NavigationButton = ({
  onClick,
  Icon,
  selected,
  tooltip,
  dataQa,
  caption,
  rounded = false,
  allowClickSelected = false,
}: NavigationButtonProps) => {
  const isLoading = useAppSelector(ModelsSelectors.selectAreModelsLoading);
  const streaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const disabled = isLoading || streaming;
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
      contentClassName="max-w-[300px] break-words"
    >
      <button
        data-qa={dataQa}
        onClick={
          (!selected || allowClickSelected) && !disabled ? onClick : undefined
        }
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
            data-qa="caption"
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

  const currentTab = useMemo(() => {
    return (router.query?.tab as MarketplaceTabs) ?? selectedMarketplaceTab;
  }, [router.query, selectedMarketplaceTab]);

  const handleChangeTab = useCallback(
    (tab: MarketplaceTabs) => {
      if (!isMarketplace) {
        router.push({
          pathname: Routes.Marketplace,
          query: { tab },
        });
      } else {
        dispatch(MarketplaceActions.setSelectedTab(tab));
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
        selected={isMarketplace && currentTab === MarketplaceTabs.HOME}
        dataQa="marketplace-home-page"
        caption={t('Apps')}
      />
      <NavigationButton
        onClick={handleMyAppsClick}
        tooltip={t('My workspace')}
        Icon={IconHomeRibbon}
        selected={isMarketplace && currentTab === MarketplaceTabs.MY_WORKSPACE}
        dataQa="my-workspace"
        caption={t('Workspace')}
      />
    </>
  );
};

const UsedWidgets = () => {
  const { t } = useTranslation(Translation.SideBar);

  const router = useRouter();

  const selectedWidgetId = useAppSelector(
    ApplicationSelectors.selectSelectedWidget,
  );
  const isApplicationsInitialised = useAppSelector(
    ApplicationSelectors.selectInitialized,
  );

  const areModelsLoading = useAppSelector(
    ModelsSelectors.selectAreModelsLoading,
  );

  const widgetsSchemaIds = useAppSelector(
    SettingsSelectors.selectWidgetsSchemaIds,
  );

  const { widgetModels, handleWidgetClick } = useWidgets();

  const handleOpenWidgetsClick = useCallback(() => {
    if (router.route === Routes.SelectedWidget) return;
    if (selectedWidgetId && router.route !== Routes.SelectedWidget) {
      handleWidgetClick(selectedWidgetId);
    } else {
      router.push(Routes.Widgets);
    }
  }, [handleWidgetClick, router, selectedWidgetId]);

  const selectedWidget = useMemo(
    () => widgetModels.find((model) => model.reference === selectedWidgetId),
    [widgetModels, selectedWidgetId],
  );

  const WidgetBarIcon = useMemo(() => {
    if (areModelsLoading || !isApplicationsInitialised)
      // eslint-disable-next-line react/display-name
      return ({ height }: IconProps) => <Loader size={height as number} />;

    return selectedWidget
      ? ({ height }: IconProps) => (
          <ModelIcon
            entity={selectedWidget}
            entityId={selectedWidget.reference}
            size={height as number}
          />
        )
      : IconBrowser;
  }, [isApplicationsInitialised, areModelsLoading, selectedWidget]);

  if ((!widgetModels.length && !areModelsLoading) || !widgetsSchemaIds.size)
    return null;

  return (
    <>
      <div className="no-scrollbar hidden w-full flex-col items-center gap-2 overflow-y-auto border-t border-tertiary pt-2 empty:border-transparent md:flex">
        {widgetModels.map((model) => (
          <NavigationButton
            key={model.reference}
            rounded
            onClick={() => handleWidgetClick(model.reference)}
            selected={
              model.reference === selectedWidgetId &&
              router.route === Routes.SelectedWidget
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
          Icon={WidgetBarIcon}
          selected={
            router.route === Routes.Widgets ||
            router.route === Routes.SelectedWidget
          }
          dataQa="widgets-sidebar-trigger"
          caption={t('Widgets')}
          tooltip={t('Widgets')}
          allowClickSelected={router.route === Routes.SelectedWidget}
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
  const widgetsSchemaIds = useAppSelector(
    SettingsSelectors.selectWidgetsSchemaIds,
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
        'order-last flex w-full shrink-0 flex-row items-center justify-around gap-2 border-tertiary bg-layer-3 md:z-40 md:order-none md:h-full md:flex-col md:justify-start md:border-r md:py-2',
        isOverlay ? 'h-[36px] md:w-[44px]' : 'h-[52px] md:w-[60px]',
      )}
      data-qa="navigation-panel"
    >
      <NavigationButton
        onClick={handleChatClick}
        tooltip={t('Chat')}
        Icon={IconMessage2}
        selected={router.route === Routes.Chat}
        dataQa="back-to-chat"
        caption={t('Chat')}
      />
      {isMarketplaceEnabled && <MarketplaceNavigation />}
      {!!widgetsSchemaIds.size && <UsedWidgets />}
    </div>
  );
};

const Navigation = withRenderWhen(UISelectors.selectIsNavigationVisible)(
  NavigationView,
);

interface NavigationWrapperProps {
  children: ReactNode;
}

export const NavigationWrapper = ({ children }: NavigationWrapperProps) => {
  const router = useRouter();

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const isIsolatedView = useAppSelector(SettingsSelectors.selectIsIsolatedView);

  return (
    <div className="size-full">
      <div className="flex size-full flex-col md:flex-row ">
        {!isIsolatedView &&
          (router.route === Routes.Chat ||
            router.route === Routes.Marketplace ||
            router.route === Routes.Widgets ||
            router.route === Routes.SelectedWidget) && <Navigation />}
        {router.route === Routes.Chat &&
          enabledFeatures.has(Feature.ConversationsSection) && <Chatbar />}
        {router.route === Routes.Marketplace && <MarketplaceFilterbar />}
        <div className="grow overflow-hidden">{children}</div>
        {router.route === Routes.Chat &&
          enabledFeatures.has(Feature.PromptsSection) && (
            <>
              <Promptbar />
              <PromptDialogs />
            </>
          )}
      </div>
      <ChatModalsManager />
    </div>
  );
};
