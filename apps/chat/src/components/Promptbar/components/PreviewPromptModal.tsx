import { IconFileArrowRight, IconTrashX } from '@tabler/icons-react';
import { MouseEventHandler } from 'react';

import { useTranslation } from 'next-i18next';

import { ModalState } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';

import { NotFoundEntity } from '@/src/components/Common/NotFoundEntity';
import Tooltip from '@/src/components/Common/Tooltip';

import { PublicationControls } from '../../Chat/Publish/PublicationChatControls';
import Modal from '../../Common/Modal';

interface Props {
  isOpen: boolean;
  onDuplicate?: MouseEventHandler<HTMLButtonElement>;
  onClose: () => void;
  onDelete?: MouseEventHandler<HTMLButtonElement>;
  isPublicationPreview?: boolean;
  prompt: Prompt;
}

export const PreviewPromptModal = ({
  isOpen,
  onDuplicate,
  onDelete,
  onClose,
  isPublicationPreview,
  prompt,
}: Props) => {
  const { t } = useTranslation(Translation.PromptBar);

  const isLoading = useAppSelector(PromptsSelectors.isPromptLoading);
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewUrl(state, prompt.id),
  );

  const dispatch = useAppDispatch();

  const exportButton = (
    <Tooltip placement="top" isTriggerClickable tooltip={t('Export prompt')}>
      <button
        onClick={() => {
          dispatch(
            ImportExportActions.exportPrompt({
              id: prompt?.id,
            }),
          );
        }}
        className="flex cursor-pointer items-center justify-center rounded p-[5px] text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
      >
        <IconFileArrowRight size={24} strokeWidth="1.5" />
      </button>
    </Tooltip>
  );

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
      heading={prompt?.name}
      onClose={onClose}
    >
      {prompt ? (
        <>
          <ul className="mb-4 flex max-h-[435px] flex-col gap-4 overflow-auto px-3 md:p-6">
            <li className="flex gap-2.5">
              <p className="mb-1 flex min-w-28 text-secondary">{t('Name: ')}</p>
              <p className="line-clamp-2 w-full break-words">{prompt.name}</p>
            </li>
            {!!prompt.description && (
              <li className="flex gap-2.5">
                <p className="mb-1 flex min-w-28 text-secondary">
                  {t('Description: ')}
                </p>
                <p className="w-full break-words">{prompt.description}</p>
              </li>
            )}
            {!!prompt.content && (
              <li className="flex gap-2.5">
                <p className="mb-1 flex min-w-28 text-secondary">
                  {t('Prompt: ')}
                </p>
                <p className="w-full break-words">{prompt.content}</p>
              </li>
            )}
          </ul>
          <div className="flex items-center justify-between px-3 md:p-6">
            {!isPublicationPreview || !resourceToReview ? (
              <>
                <div className="flex h-[34px] gap-2">
                  {exportButton}
                  {(!selectedPublication ||
                    (selectedPublication &&
                      selectedPublication.resources.some((r) =>
                        prompt.id.startsWith(
                          r.sourceUrl ? r.sourceUrl : r.targetUrl,
                        ),
                      ))) && (
                    <Tooltip
                      placement="top"
                      isTriggerClickable
                      tooltip={t('Delete prompt')}
                    >
                      <button
                        onClick={onDelete}
                        className="flex cursor-pointer items-center justify-center rounded p-[5px] text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
                      >
                        <IconTrashX size={24} strokeWidth="1.5" />
                      </button>
                    </Tooltip>
                  )}
                </div>
                <button
                  className="button button-secondary"
                  data-qa="save-prompt"
                  onClick={onDuplicate}
                >
                  {t('Duplicate prompt')}
                </button>
              </>
            ) : (
              <div className="flex w-full items-center justify-between">
                {exportButton}
                <PublicationControls entity={prompt} />
              </div>
            )}
          </div>
        </>
      ) : (
        <NotFoundEntity entity={t('Prompt')} />
      )}
    </Modal>
  );
};
