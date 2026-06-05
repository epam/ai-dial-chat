import { useCallback } from 'react';

import { ModalState } from '@/src/types/modal';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { MOUSE_OUTSIDE_PRESS_EVENT } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';
import { Spinner } from '@/src/components/Common/Spinner';

import { ReviewToolsetDialogView } from './ReviewToolsetDialogView';

export function ReviewToolsetDialog() {
  const dispatch = useAppDispatch();

  const isLoading = useAppSelector(
    ToolsetSelectors.selectIsToolsetDetailsLoading,
  );

  const handleClose = useCallback(() => {
    dispatch(PublicationActions.setIsToolsetReview(false));
  }, [dispatch]);

  return (
    <Modal
      dataQa="review-entity-dialog"
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
        <ReviewToolsetDialogView />
      )}
    </Modal>
  );
}
