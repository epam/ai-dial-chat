import { FC, useCallback, useEffect, useMemo } from 'react';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

import { sortItemsVersions } from '@/src/utils/app/common';
import { isMyApplication } from '@/src/utils/app/id';
import { getGroupMarketplaceEntityKey } from '@/src/utils/app/marketplace';

import { EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';

import { ConversationsActions, ModelsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors, WidgetsSelectors } from '@/src/store/selectors';

import { MarketplaceQueryParams } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { Modal } from '@/src/components/Common/Modal';

import { ApplicationDetailsContent } from './ApplicationContent';
import { ApplicationDetailsFooter } from './ApplicationFooter';
import { ApplicationDetailsHeader } from './ApplicationHeader';

export interface ApplicationDetailsFooterProps {
  entity: DialAIEntityModel;
  allVersions: DialAIEntityModel[];
  onChangeVersion: (entity: DialAIEntityModel) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
  onUseEntity?: () => void;
  onRemove?: (entity: DialAIEntityModel) => void;
}

interface Props {
  entity: DialAIEntityModel;
  allEntities: DialAIEntityModel[];
  isMyAppsTab?: boolean;
  isSuggested?: boolean;
  onClose: () => void;
  onChangeVersion: (entity: DialAIEntityModel) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
  onRemove?: (entity: DialAIEntityModel) => void;
  FooterComponent?: FC<ApplicationDetailsFooterProps>;
  isPreview?: boolean;
}

export function ApplicationDetails({
  entity,
  allEntities,
  isMyAppsTab,
  isSuggested,
  onClose,
  onChangeVersion,
  onBookmarkClick,
  onRemove,
  FooterComponent = ApplicationDetailsFooter,
  isPreview,
}: Props) {
  const dispatch = useAppDispatch();

  const router = useRouter();

  const searchParams = useSearchParams();

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const widgetsSchemaIds = useAppSelector(
    WidgetsSelectors.selectWidgetsSchemaIds,
  );

  const filteredEntities = useMemo(() => {
    const filtered = allEntities.filter(
      (e) =>
        getGroupMarketplaceEntityKey(entity) ===
          getGroupMarketplaceEntityKey(e) &&
        (!isMyAppsTab || installedModelIds.has(e.reference) || isSuggested),
    );

    return isMyApplication(entity) ? sortItemsVersions(filtered) : filtered;
  }, [allEntities, entity, installedModelIds, isMyAppsTab, isSuggested]);

  const handleUseEntity = useCallback(() => {
    if (widgetsSchemaIds.has(entity.applicationTypeSchemaId as string)) {
      return router
        .push(Routes.SelectedWidget.replace('[slug]', entity.reference))
        .then(() => {
          if (!installedModelIds.has(entity.reference)) {
            dispatch(
              ModelsActions.addInstalledModels({
                references: [entity.reference],
              }),
            );
          }
        });
    }

    dispatch(
      ConversationsActions.applyMarketplaceModel({
        targetConversationId:
          searchParams.get(MarketplaceQueryParams.fromConversation) ??
          undefined,
        selectedModelId: entity.reference,
      }),
    );
    dispatch(ConversationsActions.setIsStartedCustomViewerConversation(true));
  }, [
    dispatch,
    entity.applicationTypeSchemaId,
    entity.reference,
    installedModelIds,
    router,
    searchParams,
    widgetsSchemaIds,
  ]);

  useEffect(() => {
    if (entity.type === EntityType.Model) {
      dispatch(ModelsActions.getUsageStats({ id: entity.id }));
    }
  }, [dispatch, entity.id, entity.type]);

  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa="marketplace-entity-details"
      overlayClassName="!z-40"
      containerClassName="flex w-full flex-col divide-y divide-tertiary xl:max-w-[720px] max-w-[700px]"
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col divide-y divide-tertiary">
        <ApplicationDetailsHeader entity={entity} isPreview={isPreview} />
        <div className="min-h-0 flex-1 overflow-auto">
          <ApplicationDetailsContent entity={entity} />
        </div>
        <FooterComponent
          onUseEntity={handleUseEntity}
          onChangeVersion={onChangeVersion}
          entity={entity}
          allVersions={filteredEntities}
          onBookmarkClick={onBookmarkClick}
          onRemove={onRemove}
        />
      </div>
    </Modal>
  );
}
