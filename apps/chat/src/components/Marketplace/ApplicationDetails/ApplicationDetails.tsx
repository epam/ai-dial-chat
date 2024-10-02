import { useCallback, useEffect, useMemo } from 'react';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

import { getConversationModelParams } from '@/src/utils/app/conversation';

import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { MarketplaceQueryParams } from '@/src/constants/marketplace';

import Modal from '../../Common/Modal';
import { ApplicationDetailsContent } from './ApplicationContent';
import { ApplicationDetailsFooter } from './ApplicationFooter';
import { ApplicationDetailsHeader } from './ApplicationHeader';

import { PublishActions } from '@epam/ai-dial-shared';

interface Props {
  isMobileView: boolean;
  entity: DialAIEntityModel;
  allEntities: DialAIEntityModel[];
  onlyInstalledVersions: boolean;
  onClose: () => void;
  onPublish: (entity: DialAIEntityModel, action: PublishActions) => void;
  onEdit: (entity: DialAIEntityModel) => void;
  onChangeVersion: (entity: DialAIEntityModel) => void;
}

const ApplicationDetails = ({
  entity,
  isMobileView,
  allEntities,
  onlyInstalledVersions,
  onClose,
  onPublish,
  onEdit,
  onChangeVersion,
}: Props) => {
  const dispatch = useAppDispatch();

  const router = useRouter();
  const searchParams = useSearchParams();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);
  const installedModels = useAppSelector(ModelsSelectors.selectInstalledModels);
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );

  const filteredEntities = useMemo(() => {
    return allEntities.filter(
      (e) =>
        entity.name === e.name &&
        (!onlyInstalledVersions || installedModelIds.has(e.reference)),
    );
  }, [allEntities, entity.name, installedModelIds, onlyInstalledVersions]);

  const handleUseEntity = useCallback(() => {
    const queryParamId = searchParams.get(
      MarketplaceQueryParams.fromConversation,
    );
    const conversationToApplyModel = selectedConversations.find(
      (conv) => conv.id === queryParamId,
    );

    if (conversationToApplyModel) {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversationToApplyModel.id,
          values: {
            ...getConversationModelParams(
              conversationToApplyModel,
              entity.reference,
              modelsMap,
              addonsMap,
            ),
          },
        }),
      );
    } else {
      dispatch(
        ConversationsActions.createNewConversations({
          names: [DEFAULT_CONVERSATION_NAME],
          modelReference: entity.reference,
        }),
      );
    }

    dispatch(
      ModelsActions.updateRecentModels({
        modelId: entity.reference,
        rearrange: true,
      }),
    );

    if (!installedModelIds.has(entity.reference)) {
      dispatch(
        ModelsActions.updateInstalledModels([
          ...installedModels,
          { id: entity.reference },
        ]),
      );
    }

    router.push('/');
  }, [
    addonsMap,
    dispatch,
    entity.reference,
    installedModelIds,
    installedModels,
    modelsMap,
    router,
    searchParams,
    selectedConversations,
  ]);

  useEffect(() => {
    onChangeVersion(entity);
  }, [entity, onChangeVersion]);

  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa="marketplace-application-details"
      overlayClassName="!z-40"
      containerClassName="flex w-full flex-col divide-y divide-tertiary divide-tertiary xl:max-w-[720px] max-w-[700px]"
      onClose={onClose}
    >
      <ApplicationDetailsHeader isMobileView={isMobileView} entity={entity} />
      <ApplicationDetailsContent entity={entity} />
      <ApplicationDetailsFooter
        onPublish={onPublish}
        onUseEntity={handleUseEntity}
        onChangeVersion={onChangeVersion}
        entity={entity}
        allVersions={filteredEntities}
        onEdit={onEdit}
      />
    </Modal>
  );
};

export default ApplicationDetails;
