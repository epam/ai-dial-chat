import { useTranslation } from '@/src/hooks/useTranslation';

import { extractNameFromEmail } from '@/src/utils/app/common';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ChatActions } from '@/src/store/chat/chat.reducer';
import { ChatSelectors } from '@/src/store/chat/chat.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import { Modal } from './Modal';
import { withRenderWhen } from './RenderWhen';

interface infoRowProps {
  dataQa: string;
  infoLabel: string;
  info: string;
}

function InfoRow({ dataQa, infoLabel, info }: infoRowProps) {
  return (
    <div className="grid grid-cols-3 gap-4" data-qa={dataQa}>
      <span className="col-span-1 whitespace-pre-wrap break-words text-secondary">
        {infoLabel}:
      </span>
      <span className="col-span-2 whitespace-pre-wrap break-words">{info}</span>
    </div>
  );
}

export function InfoModalView() {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const modalState = useAppSelector(ChatSelectors.selectInfoModalState);
  const entityInfo = useAppSelector(ChatSelectors.selectSelectedEntityInfo);

  const handleClose = () => {
    dispatch(ChatActions.setInfoModalState(ModalState.CLOSED));
  };
  return (
    <Modal
      portalId="theme-main"
      state={modalState}
      onClose={handleClose}
      dataQa="info-modal"
      containerClassName="inline-block w-full min-w-[90%] px-3 py-4 md:p-6 md:min-w-[300px] md:max-w-[400px]"
      dismissProps={OUTSIDE_PRESS_AND_MOUSE_EVENT}
      heading={t('Information')}
      headingClassName="mb-4"
      loaderClassName="min-h-[80px]"
    >
      <div className="flex flex-col justify-between gap-4">
        {entityInfo?.updatedAt && (
          <InfoRow
            infoLabel={t('Last updated')}
            info={entityInfo.updatedAt}
            dataQa="updated-at"
          />
        )}

        {entityInfo?.createdAt && (
          <InfoRow
            infoLabel={t('Creation date')}
            info={entityInfo.createdAt}
            dataQa="created-at"
          />
        )}

        {(entityInfo?.isPublic || entityInfo?.sharedWithMe) && (
          <InfoRow
            infoLabel={t('Author')}
            info={extractNameFromEmail(entityInfo.author) ?? t('Unknown')}
            dataQa="author"
          />
        )}
      </div>
    </Modal>
  );
}

export const InfoModal = withRenderWhen(ChatSelectors.selectInfoModalOpened)(
  InfoModalView,
);
