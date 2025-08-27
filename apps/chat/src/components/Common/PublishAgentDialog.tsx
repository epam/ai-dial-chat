import { useCallback } from 'react';

import { SharingType } from '@/src/types/share';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/selectors';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';

import { withRenderWhen } from './RenderWhen';

const PublishAgentDialogView = () => {
  const dispatch = useAppDispatch();

  const publishModel = useAppSelector(PublicationSelectors.selectPublishModel)!;

  const handlePublishClose = useCallback(() => {
    dispatch(PublicationActions.setPublishModel());
  }, [dispatch]);

  return (
    <PublishModal
      entity={publishModel.entity}
      type={SharingType.Application}
      isOpen
      onClose={handlePublishClose}
      publishAction={publishModel.action}
    />
  );
};

export const PublishAgentDialog = withRenderWhen(
  PublicationSelectors.selectPublishModel,
)(PublishAgentDialogView);
