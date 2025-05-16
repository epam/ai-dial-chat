import { useCallback } from 'react';

import { SharingType } from '@/src/types/share';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';

const PromptPublishDialogView = () => {
  const dispatch = useAppDispatch();

  const publishModel = useAppSelector(PublicationSelectors.selectPublishModel)!;

  const handlePublishClose = useCallback(() => {
    dispatch(PublicationActions.setPublishModel());
  }, [dispatch]);

  return (
    <PublishModal
      entity={publishModel.entity}
      type={SharingType.Prompt}
      isOpen
      onClose={handlePublishClose}
      publishAction={publishModel.action}
    />
  );
};

export const PromptPublishDialog = withRenderWhen(
  PublicationSelectors.selectPublishModel,
)(PromptPublishDialogView);
