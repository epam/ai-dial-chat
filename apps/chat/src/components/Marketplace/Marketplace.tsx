import { useEffect, useMemo } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { MarketplaceActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceSelectors,
  ModelsSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import {
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { Spinner } from '@/src/components/Common/Spinner';
import { AgentsTabRenderer } from '@/src/components/Marketplace/AgentsTabRenderer';

import { TabHeader } from './TabHeader';
import { ToolsTabRenderer } from './ToolsTabRenderer';

import { UploadStatus } from '@epam/ai-dial-shared';

export const Marketplace = () => {
  const dispatch = useAppDispatch();

  const router = useRouter();

  const isModelsLoading = useAppSelector(
    ModelsSelectors.selectAreModelsLoading,
  );
  const isToolsetsEntitiesLoading = useAppSelector(
    ModelsSelectors.selectAreModelsLoading,
  );
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);
  const isInstalledModelsInitialized = useAppSelector(
    ModelsSelectors.selectIsInstalledModelsInitialized,
  );

  const isInstalledToolsetsInitialized = useAppSelector(
    ToolsetSelectors.selectIsInstalledToolsetsInitialized,
  );

  const applyModelStatus = useAppSelector(
    MarketplaceSelectors.selectApplyModelStatus,
  );
  const isBannerVisible = useAppSelector(
    MarketplaceSelectors.selectIsBannerVisible,
  );

  const selectedEntitiesTab = useAppSelector(
    MarketplaceSelectors.selectSelectedEntitiesTab,
  );

  const isMarketplaceLoading = useAppSelector(
    MarketplaceSelectors.selectShowLoader,
  );

  const isAgentsTab = selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;

  const isLoading = useMemo(() => {
    const isWorkspaceTab = selectedTab === MarketplaceTabs.MY_WORKSPACE;
    const isAgentsLoading = isWorkspaceTab
      ? isModelsLoading || !isInstalledModelsInitialized
      : isModelsLoading;

    const isToolsetsLoading = isWorkspaceTab
      ? isToolsetsEntitiesLoading || !isInstalledToolsetsInitialized
      : isToolsetsEntitiesLoading;
    const showLoader = isAgentsTab ? isAgentsLoading : isToolsetsLoading;
    return showLoader || isMarketplaceLoading;
  }, [
    isAgentsTab,
    isInstalledModelsInitialized,
    isInstalledToolsetsInitialized,
    isMarketplaceLoading,
    isModelsLoading,
    isToolsetsEntitiesLoading,
    selectedTab,
  ]);

  useEffect(() => {
    if (applyModelStatus === UploadStatus.LOADED) {
      dispatch(
        MarketplaceActions.setApplyModelStatus(UploadStatus.UNINITIALIZED),
      );
      router.push(Routes.Chat);
    }
  }, [applyModelStatus, router, dispatch]);

  return (
    <div
      className="flex grow flex-col overflow-auto py-4 md:py-5 xl:py-6"
      data-qa="marketplace"
    >
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner size={45} className="mx-auto" />
        </div>
      ) : (
        <>
          <TabHeader isBannerVisible={isBannerVisible} />
          <div
            className={classNames('flex min-h-0 grow flex-col', {
              hidden: !isAgentsTab,
            })}
          >
            <AgentsTabRenderer />
          </div>
          <div
            className={classNames('flex min-h-0 grow flex-col', {
              hidden: isAgentsTab,
            })}
          >
            <ToolsTabRenderer />
          </div>
        </>
      )}
    </div>
  );
};
