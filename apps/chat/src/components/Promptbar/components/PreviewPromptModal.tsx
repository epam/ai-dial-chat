import { IconFileArrowRight, IconTrashX } from '@tabler/icons-react';
import { MouseEventHandler } from 'react';

import { useTranslation } from 'next-i18next';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import { NotFoundEntity } from '@/src/components/Common/NotFoundEntity';

import Modal from '../../Common/Modal';

interface Props {
  isOpen: boolean;
  onDuplicate: MouseEventHandler<HTMLButtonElement>;
  onClose: () => void;
  onUnshare: MouseEventHandler<HTMLButtonElement>;
}

export const PreviewPromptModal = ({
  isOpen,
  onDuplicate,
  onUnshare,
  onClose,
}: Props) => {
  const { t } = useTranslation(Translation.PromptBar);

  const isLoading = useAppSelector(PromptsSelectors.isPromptLoading);
  const selectedPrompt = useAppSelector(PromptsSelectors.selectSelectedPrompt);

  const dispatch = useAppDispatch();

  return (
    <Modal
      portalId="theme-main"
      containerClassName="inline-block w-full overflow-y-auto py-4 md:p-0 align-bottom transition-all xl:max-h-[800px] xl:max-w-[720px] 2xl:max-w-[1000px]"
      dataQa="prompt-modal"
      headingClassName="px-3 md:p-6"
      state={
        isOpen
          ? isLoading
            ? ModalState.LOADING
            : ModalState.OPENED
          : ModalState.CLOSED
      }
      heading={selectedPrompt?.name}
      onClose={onClose}
    >
      {selectedPrompt ? (
        <>
          <ul className="mb-4 max-h-[500px] overflow-auto px-3 md:p-6">
            <li className="mb-4 flex gap-2.5">
              <p className="mb-1 flex min-w-28 text-secondary">{t('Name: ')}</p>
              <p>{selectedPrompt.name}</p>
            </li>
            <li className="mb-4 flex gap-2.5">
              <p className="mb-1 flex min-w-28 text-secondary">
                {t('Description: ')}
              </p>
              <p>{selectedPrompt.description}</p>
            </li>
            <li className="flex gap-2.5">
              <p className="mb-1 flex min-w-28 text-secondary">
                {t('Prompt: ')}
              </p>
              <p>{selectedPrompt.content}</p>
            </li>
          </ul>
          <div className="flex items-center justify-between px-3 md:p-6">
            <div className="flex h-[34px] gap-2">
              <button
                onClick={() => {
                  dispatch(
                    PromptsActions.exportPrompt({ id: selectedPrompt?.id }),
                  );
                }}
                className="flex cursor-pointer items-center justify-center rounded p-[5px] hover:bg-accent-tertiary-alpha hover:text-accent-tertiary"
              >
                <IconFileArrowRight size={24} strokeWidth="1.5" />
              </button>
              <button
                onClick={onUnshare}
                className="flex cursor-pointer items-center justify-center rounded p-[5px] hover:bg-accent-tertiary-alpha hover:text-accent-tertiary"
              >
                <IconTrashX size={24} strokeWidth="1.5" />
              </button>
            </div>
            <button
              className="button button-primary"
              data-qa="save-prompt"
              onClick={onDuplicate}
            >
              {t('Duplicate prompt')}
            </button>
          </div>
        </>
      ) : (
        <NotFoundEntity entity={t('Prompt')} />
      )}
    </Modal>
  );
};
