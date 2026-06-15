import { ReactNode } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdExternal } from '@/src/utils/app/id';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ChatActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ChatSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import { DateRenderer } from './DateRenderer';
import { Modal } from './Modal';
import { withRenderWhen } from './RenderWhen';

interface infoRowProps {
  dataQa: string;
  infoLabel: string;
  children: ReactNode;
}

const view = withRenderWhen(ChatSelectors.selectInfoModalOpened)(() => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const renderInfoRow = ({ dataQa, infoLabel, children }: infoRowProps) => {
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
  };

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
      heading={t(ChatI18nKeys.Information)}
      headingClassName="mb-4"
      loaderClassName="min-h-[80px]"
    >
      <div className="flex flex-col justify-between gap-4">
        {!entityInfo?.isPublic &&
          entityInfo?.updatedAt &&
          renderInfoRow({
            infoLabel: t(ChatI18nKeys.LastUpdated),
            dataQa: 'updated-at',
            children: <DateRenderer dateValue={entityInfo.updatedAt} />,
          })}

        {entityInfo?.createdAt &&
          renderInfoRow({
            infoLabel: t(ChatI18nKeys.CreationDate),
            dataQa: 'created-at',
            children: <DateRenderer dateValue={entityInfo.createdAt} />,
          })}

        {entityInfo &&
          isEntityIdExternal({ id: entityInfo.id }) &&
          renderInfoRow({
            infoLabel: t(ChatI18nKeys.Author),
            dataQa: 'author',
            children: entityInfo.author ?? t(ChatI18nKeys.Unknown),
          })}
      </div>
    </Modal>
  );
});

export const InfoModal = view;
