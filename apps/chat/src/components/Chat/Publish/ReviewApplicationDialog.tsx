import { ModalState } from '@/src/types/modal';

import { ApplicationSelectors } from '@/src/store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';

import { MOUSE_OUTSIDE_PRESS_EVENT } from '@/src/constants/modal';

import { Modal } from '../../Common/Modal';
import { Spinner } from '../../Common/Spinner';
import { ReviewApplicationDialogView } from './ReviewApplicationDialogView';

export function ReviewApplicationDialog() {
  const isLoading = useAppSelector(
    ApplicationSelectors.selectIsApplicationLoading,
  );
  const dispatch = useAppDispatch();

  const handleClose = () => {
    dispatch(PublicationActions.setIsApplicationReview(false));
  };

  return (
    <Modal
      dataQa="models-dialog"
      portalId="chat"
      onClose={handleClose}
      overlayClassName="fixed inset-0 top-[48px]"
      state={ModalState.OPENED}
      containerClassName="flex flex-col gap-4 sm:w-[600px] w-full"
      dismissProps={MOUSE_OUTSIDE_PRESS_EVENT}
    >
      {isLoading ? (
        <div className="flex h-[250px] flex-col justify-center">
          <Spinner className="mx-auto" size={30} />
        </div>
      ) : (
        <ReviewApplicationDialogView />
      )}
    </Modal>
  );
}
