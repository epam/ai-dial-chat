import { IconFileArrowRight, IconTrashX } from '@tabler/icons-react';
import { MouseEventHandler, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { FeatureType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';
import { PublicVersionGroups, PublishActions } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';

import { NotFoundEntity } from '@/src/components/Common/NotFoundEntity';
import Tooltip from '@/src/components/Common/Tooltip';

import { PublicationControls } from '../../Chat/Publish/PublicationChatControls';
import { VersionSelector } from '../../Chat/Publish/VersionSelector';
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

  const dispatch = useAppDispatch();

  const isLoading = useAppSelector(PromptsSelectors.isPromptLoading);
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewUrl(state, prompt.id),
  );

  const handleChangeSelectedVersion = useCallback(
    (
      versionGroupId: string,
      newVersion: NonNullable<PublicVersionGroups[string]>['selectedVersion'],
      oldVersion: NonNullable<PublicVersionGroups[string]>['selectedVersion'],
    ) =>
      dispatch(
        PromptsActions.setNewVersionForPublicVersionGroup({
          versionGroupId,
          newVersion,
          oldVersion,
        }),
      ),
    [dispatch],
  );

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
      headingClassName={classNames(
        'px-3 md:p-6',
        prompt.publicationInfo?.action === PublishActions.DELETE &&
          'text-error',
      )}
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
              <p className="line-clamp-2 break-all">{prompt.name}</p>
            </li>
            {!!prompt.description && (
              <li className="flex gap-2.5">
                <p className="mb-1 flex min-w-28 text-secondary">
                  {t('Description: ')}
                </p>
                <p className="break-all">{prompt.description}</p>
              </li>
            )}
            {!!prompt.content && (
              <li className="flex gap-2.5">
                <p className="mb-1 flex min-w-28 text-secondary">
                  {t('Prompt: ')}
                </p>
                <p className="break-all">{prompt.content}</p>
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
                <div className="flex items-center gap-4">
                  <VersionSelector
                    entity={prompt}
                    onChangeSelectedVersion={handleChangeSelectedVersion}
                    featureType={FeatureType.Prompt}
                  />
                  <button
                    className="button button-secondary"
                    data-qa="save-prompt"
                    onClick={onDuplicate}
                  >
                    {t('Duplicate prompt')}
                  </button>
                </div>
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
