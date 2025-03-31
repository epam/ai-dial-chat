import { useCallback, useMemo } from 'react';

import { useSearchParams } from 'next/navigation';

import { sortItemsVersions } from '@/src/utils/app/common';
import { isMyApplication } from '@/src/utils/app/id';
import { getGroupModelKey } from '@/src/utils/app/models';

import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { MarketplaceQueryParams } from '@/src/constants/marketplace';

import { Modal } from '../../Common/Modal';
import { ApplicationDetailsContent } from './ApplicationContent';
import { ApplicationDetailsFooter } from './ApplicationFooter';
import { ApplicationDetailsHeader } from './ApplicationHeader';

import { PublishActions } from '@epam/ai-dial-shared';

interface Props {
  entity: DialAIEntityModel;
  allEntities: DialAIEntityModel[];
  isMyAppsTab: boolean;
  isSuggested?: boolean;
  onClose: () => void;
  onPublish: (entity: DialAIEntityModel, action: PublishActions) => void;
  onEdit: (entity: DialAIEntityModel) => void;
  onDelete: (entity: DialAIEntityModel) => void;
  onChangeVersion: (entity: DialAIEntityModel) => void;
  onBookmarkClick: (entity: DialAIEntityModel) => void;
}

export const ApplicationDetails = ({
  entity,
  allEntities,
  isMyAppsTab,
  isSuggested,
  onClose,
  onPublish,
  onEdit,
  onDelete,
  onChangeVersion,
  onBookmarkClick,
}: Props) => {
  const dispatch = useAppDispatch();

  const searchParams = useSearchParams();

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
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
    dispatch(
      ConversationsActions.applyMarketplaceModel({
        targetConversationId:
          searchParams.get(MarketplaceQueryParams.fromConversation) ??
          undefined,
        selectedModelId: entity.reference,
      }),
    );
    dispatch(ConversationsActions.setIsStartedCustomViewerConversation(true));
  }, [dispatch, entity.reference, searchParams]);

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
        onPublish={onPublish}
        onUseEntity={handleUseEntity}
        onChangeVersion={onChangeVersion}
        entity={entity}
        allVersions={filteredEntities}
        onEdit={onEdit}
        onDelete={onDelete}
        onBookmarkClick={onBookmarkClick}
      />
    </Modal>
  );
};
