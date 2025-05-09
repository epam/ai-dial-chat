import { useCallback } from 'react';

import { SharingType } from '@/src/types/share';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import { PublishModal } from '../Chat/Publish/PublishWizard';
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
