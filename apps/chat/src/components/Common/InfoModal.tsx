import { ReactNode } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdExternal } from '@/src/utils/app/id';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ChatActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ChatSelectors } from '@/src/store/selectors';

import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import { DateRenderer } from './DateRenderer';
import { Modal } from './Modal';
import { withRenderWhen } from './RenderWhen';

interface infoRowProps {
  dataQa: string;
  infoLabel: string;
  children: ReactNode;
}

function InfoRow({ dataQa, infoLabel, children }: infoRowProps) {
  return (
    <div className="grid grid-cols-3 gap-4" data-qa={dataQa}>
      <span
        className="col-span-1 whitespace-pre-wrap break-words text-secondary"
        data-qa={dataQa.concat('-label')}
      >
        {infoLabel}:
      </span>
      <span
        className="col-span-2 whitespace-pre-wrap break-words"
        data-qa={dataQa.concat('-value')}
      >
        {children}
      </span>
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
        {!entityInfo?.isPublic && entityInfo?.updatedAt && (
          <InfoRow infoLabel={t('Last updated')} dataQa="updated-at">
            <DateRenderer dateValue={entityInfo.updatedAt} />
          </InfoRow>
        )}

        {entityInfo?.createdAt && (
          <InfoRow infoLabel={t('Creation date')} dataQa="created-at">
            <DateRenderer dateValue={entityInfo.createdAt} />
          </InfoRow>
        )}

        {entityInfo && isEntityIdExternal({ id: entityInfo.id }) && (
          <InfoRow infoLabel={t('Author')} dataQa="author">
            {entityInfo.author ?? t('Unknown')}
          </InfoRow>
        )}
      </div>
    </Modal>
  );
}

export const InfoModal = withRenderWhen(ChatSelectors.selectInfoModalOpened)(
  InfoModalView,
);
