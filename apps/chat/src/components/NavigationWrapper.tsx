import {
  IconHome2,
  IconLayoutGrid,
  IconMessage2,
  TablerIconsProps,
} from '@tabler/icons-react';
import { JSX, ReactNode, useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

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
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { MarketplaceTabs } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import Tooltip from '@/src/components/Common/Tooltip';

interface NavigationButtonProps {
  onClick: () => void;
  Icon?: (props: TablerIconsProps) => JSX.Element;
  ModelIcon?: () => JSX.Element;
  selected?: boolean;
  tooltip?: string;
  dataQa?: string;
  rounded?: boolean;
}

const NavigationButton = ({
  onClick,
  Icon,
  selected,
  tooltip,
  dataQa,
  rounded = false,
}: NavigationButtonProps) => {
  return (
    <button
      data-qa={dataQa}
      onClick={onClick}
      className={classNames(
        'flex shrink-0 cursor-pointer select-none items-center justify-center gap-3 rounded border border-transparent p-[10px] transition-colors duration-200 hover:bg-accent-primary-alpha hover:disabled:bg-transparent',
        {
          'rounded-full': rounded,
          '!border-accent-primary': rounded && selected,
        },
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
    </button>
  );
};

const Navigation = () => {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();
  const router = useRouter();

  const selectedMarketplaceTab = useAppSelector(
    MarketplaceSelectors.selectSelectedTab,
  );
  const isMarketplace = router.route === Routes.Marketplace;

  const handleChatClick = useCallback(() => {
    if (router.route !== Routes.Chat) {
      return router.push(Routes.Chat).then(() => {
        dispatch(
          ConversationsActions.setIsStartedCustomViewerConversation(false),
        );
      });
    }
  }, [dispatch, router]);

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
        onClick={handleChatClick}
        tooltip={t(isMarketplace ? 'Back to Chat' : 'Chat')}
        Icon={IconMessage2}
        selected={router.route === Routes.Chat}
        dataQa="marketplace-home-page"
      />
      <NavigationButton
        onClick={handleHomeClick}
        tooltip={t('DIAL Marketplace')}
        Icon={IconLayoutGrid}
        selected={
          isMarketplace && selectedMarketplaceTab === MarketplaceTabs.HOME
        }
        dataQa="marketplace-home-page"
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
      />
    </>
  );
};

const UsedWidgets = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const widgetsSchemaIds = useAppSelector(
    SettingsSelectors.selectWidgetsSchemaIds,
  );
  const models = useAppSelector(ModelsSelectors.selectModels);
  const selectedWidget = useAppSelector(
    ApplicationSelectors.selectSelectedWidget,
  );

  const widgetModels = useMemo(() => {
    return models.filter((m) =>
      widgetsSchemaIds.has(m.applicationTypeSchemaId ?? ''),
    );
  }, [models, widgetsSchemaIds]);

  const handleSelectWidget = useCallback(
    (id: string) => {
      dispatch(ApplicationActions.selectWidget(id));
      dispatch(
        ConversationsActions.selectConversations({
          conversationIds: [],
        }),
      );
    },
    [dispatch],
  );

  const handleClick = useCallback(
    (id: string) => {
      if (router.route !== Routes.Chat) {
        router.push(Routes.Chat).then(() => handleSelectWidget(id));
      } else {
        handleSelectWidget(id);
      }
    },
    [handleSelectWidget, router],
  );

  return (
    <>
      {widgetModels.map((model) => (
        <NavigationButton
          key={model.reference}
          rounded
          onClick={() => handleClick(model.reference)}
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
    </>
  );
};

interface NavigationWrapperProps {
  children: ReactNode;
}

export const NavigationWrapper = ({ children }: NavigationWrapperProps) => {
  return (
    <div className="flex size-full min-h-screen flex-row">
      <div className="flex h-full w-[60px] shrink-0 flex-col justify-start gap-2 border-r border-tertiary bg-layer-3 p-2">
        <Navigation />

        <UsedWidgets />
      </div>

      <div className="grow overflow-hidden">{children}</div>
    </div>
  );
};
