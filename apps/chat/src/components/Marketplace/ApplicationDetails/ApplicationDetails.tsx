import { useCallback, useMemo } from 'react';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

import { sortItemsVersions } from '@/src/utils/app/common';
import { isMyApplication } from '@/src/utils/app/id';
import { getGroupModelKey } from '@/src/utils/app/models';

import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsActions } from '@/src/store/models/models.reducers';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { MarketplaceQueryParams } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { Modal } from '../../Common/Modal';
import { ApplicationDetailsContent } from './ApplicationContent';
import { ApplicationDetailsFooter } from './ApplicationFooter';
import { ApplicationDetailsHeader } from './ApplicationHeader';

interface Props {
  entity: DialAIEntityModel;
  allEntities: DialAIEntityModel[];
  isMyAppsTab: boolean;
  isSuggested?: boolean;
  onClose: () => void;
  onChangeVersion: (entity: DialAIEntityModel) => void;
  onBookmarkClick: (entity: DialAIEntityModel) => void;
}

export const ApplicationDetails = ({
  entity,
  allEntities,
  isMyAppsTab,
  isSuggested,
  onClose,
  onChangeVersion,
  onBookmarkClick,
}: Props) => {
  const dispatch = useAppDispatch();

  const router = useRouter();

  const searchParams = useSearchParams();

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const widgetsSchemaIds = useAppSelector(
    SettingsSelectors.selectWidgetsSchemaIds,
  );

  const filteredEntities = useMemo(() => {
    const filtered = allEntities.filter(
      (e) =>
        getGroupModelKey(entity) === getGroupModelKey(e) &&
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

  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa="marketplace-agent-details"
      overlayClassName="!z-40"
      containerClassName="flex w-full flex-col divide-y divide-tertiary xl:max-w-[720px] max-w-[700px]"
      onClose={onClose}
    >
      <ApplicationDetailsHeader entity={entity} />
      <ApplicationDetailsContent entity={entity} />
      <ApplicationDetailsFooter
        onUseEntity={handleUseEntity}
        onChangeVersion={onChangeVersion}
        entity={entity}
        allVersions={filteredEntities}
        onBookmarkClick={onBookmarkClick}
      />
    </Modal>
  );
};
