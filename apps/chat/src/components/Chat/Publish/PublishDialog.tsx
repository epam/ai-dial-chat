import { useCallback } from 'react';

import { SharingType } from '@/src/types/share';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/selectors';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';

interface Props {
  type: SharingType;
}

const PublishDialogView = ({ type }: Props) => {
  const dispatch = useAppDispatch();

  const publishModel = useAppSelector(PublicationSelectors.selectPublishModel)!;

  const handlePublishClose = useCallback(() => {
    dispatch(PublicationActions.setPublishModel());
  }, [dispatch]);

  return (
    <PublishModal
      entity={publishModel.entity}
      type={type}
      isOpen
      onClose={handlePublishClose}
      publishAction={publishModel.action}
    />
  );
};

export const PublishDialog = withRenderWhen(
  PublicationSelectors.selectPublishModel,
)(PublishDialogView);
