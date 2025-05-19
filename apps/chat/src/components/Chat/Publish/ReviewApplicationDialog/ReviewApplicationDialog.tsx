import { ModalState } from '@/src/types/modal';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors } from '@/src/store/selectors';

import { MOUSE_OUTSIDE_PRESS_EVENT } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';
import { Spinner } from '@/src/components/Common/Spinner';

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
      containerClassName="flex flex-col gap-4 sm:w-[600px] md:w-[800px] w-full"
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
