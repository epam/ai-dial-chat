import { ClipboardEvent, MouseEvent, useCallback, useRef } from 'react';

import { useTranslation } from 'next-i18next';

import { getUnpublishActionByType } from '@/src/utils/app/share';

import { Entity } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';

import Modal from '../Common/Modal';

import { v4 as uuidv4 } from 'uuid';

interface Props {
  entity: Entity;
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
}

export default function UnpublishModal({
  entity,
  isOpen,
  onClose,
  type,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();
  const unpublishAction = getUnpublishActionByType(type);
  const shareId = useRef(uuidv4());

  const handleClose = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      onClose();
    },
    [onClose],
  );

  const handleUnpublish = useCallback(
    (e: MouseEvent<HTMLButtonElement> | ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      dispatch(unpublishAction({ id: entity.id }));
      onClose();
    },
    [dispatch, entity.id, onClose, unpublishAction],
  );

  return (
    <Modal
      portalId="theme-main"
      containerClassName="inline-block h-[434px] sm:w-[424px] p-6 w-full"
      dataQa="unpublish-modal"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose}
    >
      <div className="flex h-full flex-col justify-between gap-2">
        <h4 className=" max-h-[50px] text-base font-semibold">
          <span className="line-clamp-2 break-words">
            {`${t('Unpublish')}: ${entity.name.trim()}`}
          </span>
        </h4>
        <div className="flex justify-end gap-3">
          <button
            className="button button-secondary"
            onClick={handleClose}
            data-qa="cancel"
          >
            {t('Cancel')}
          </button>
          <button
            className="button button-primary"
            onClick={handleUnpublish}
            data-qa="unpublish"
            autoFocus
          >
            {t('Unpublish')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
