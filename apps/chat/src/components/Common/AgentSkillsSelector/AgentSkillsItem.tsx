import {
  IconAlertCircleFilled,
  IconChevronDown,
  IconPencilMinus,
  IconTrashX,
} from '@tabler/icons-react';
import { FC, useEffect, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getPathToFolderById } from '@/src/utils/app/folders';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { constructPath, isMyEntity } from '@/src/utils/app/shared-utils';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { PromptsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.selectors';
import { SkillValidationStatus } from '@/src/store/prompts/prompts.types';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import {
  ORGANIZATION_SECTION_NAME,
  PINNED_PROMPTS_SECTION_NAME,
  RECENT_PROMPTS_SECTION_NAME,
  SHARED_WITH_ME_SECTION_NAME,
} from '@/src/constants/sections';

import { IconButton } from '../IconButton';
import { Spinner } from '../Spinner';

import { UploadStatus } from '@epam/ai-dial-shared';
import { DialIconButton } from '@epam/ai-dial-ui-kit';

interface AgentSkillsItemProps {
  promptId: string;
  readonly?: boolean;
  onDelete: (promptId: string) => void;
  onEdit: (promptId: string) => void;
}

export const AgentSkillsItem: FC<AgentSkillsItemProps> = ({
  promptId,
  readonly,
  onDelete,
  onEdit,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const [isExpanded, setIsExpanded] = useState(false);

  const prompt = useAppSelector((state) =>
    PromptsSelectors.selectPrompt(state, promptId),
  ) as Prompt | undefined;
  const isPromptLoading = useAppSelector(PromptsSelectors.isPromptLoading);
  const arePromptsUploaded = useAppSelector(
    PromptsSelectors.arePromptsUploaded,
  );
  const folders = useAppSelector(PromptsSelectors.selectFolders);
  const skillValidation = useAppSelector((state) =>
    PromptsSelectors.selectSkillValidation(state, promptId),
  );
  const validationStatus =
    skillValidation?.status ?? SkillValidationStatus.Unknown;
  const validationMessage = skillValidation?.message;

  useEffect(() => {
    if (
      arePromptsUploaded &&
      prompt &&
      (prompt.status !== UploadStatus.LOADED || skillValidation === undefined)
    ) {
      dispatch(PromptsActions.uploadPrompt({ promptId }));
    }
  }, [dispatch, prompt, promptId, arePromptsUploaded, skillValidation]);

  if (!arePromptsUploaded) {
    return (
      <div
        className="flex items-center justify-center py-4"
        data-qa="agent-skill"
      >
        <Spinner />
      </div>
    );
  }

  const { path: folderPath } = getPathToFolderById(folders, prompt?.folderId);
  const isMyPrompt = isMyEntity({ id: promptId });
  const resultFolderPath = isEntityIdPublic({ id: promptId })
    ? constructPath(ORGANIZATION_SECTION_NAME, folderPath)
    : isMyPrompt
      ? promptId.split('/').length > 3
        ? constructPath(PINNED_PROMPTS_SECTION_NAME, folderPath)
        : RECENT_PROMPTS_SECTION_NAME
      : constructPath(SHARED_WITH_ME_SECTION_NAME, folderPath);
  const displayName = prompt?.name ?? promptId.split('/').pop();
  const isPromptLoaded = prompt?.status === UploadStatus.LOADED;
  const hasInvalidError =
    isPromptLoaded && validationStatus === SkillValidationStatus.Invalid;
  const isValidating =
    isPromptLoaded && validationStatus === SkillValidationStatus.Validating;

  return (
    <div
      className="flex flex-col divide-y divide-tertiary bg-layer-3 py-2"
      data-qa="agent-skill"
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <DialIconButton
            className="left-0 top-0 flex size-5 h-full items-start"
            icon={
              <IconChevronDown
                className={classNames(
                  'transition-transform',
                  isExpanded && 'rotate-180',
                )}
                size={20}
              />
            }
            onClick={() => setIsExpanded((prev) => !prev)}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-primary">
              {displayName}
            </span>
            {resultFolderPath && (
              <span className="truncate text-xs text-secondary">
                {resultFolderPath}
              </span>
            )}
          </div>

          {!readonly && (
            <div className="flex gap-2 text-secondary">
              {isMyPrompt && prompt && (
                <IconButton
                  className="size-6"
                  Icon={IconPencilMinus}
                  name={MarketplaceI18nKeys.EditMarketplace}
                  dataQa="edit-skill"
                  size={16}
                  onClick={() => onEdit(promptId)}
                />
              )}
              <IconButton
                className="size-6"
                Icon={IconTrashX}
                onClick={() => onDelete(promptId)}
                name={MarketplaceI18nKeys.DeleteMarketplace}
                dataQa="delete-skill"
                size={16}
              />
            </div>
          )}
        </div>

        {((isPromptLoading && !isPromptLoaded) || isValidating) && (
          <Spinner className="mx-auto my-4" size={16} />
        )}

        {hasInvalidError && (
          <div
            className="mt-2 flex items-center gap-1 px-7 text-error"
            data-qa="error-message"
          >
            <IconAlertCircleFilled size={16} className="shrink-0" />
            <span className="break-words text-xs">
              {validationMessage ||
                t(MarketplaceI18nKeys.AgentSkillsInvalidError)}
            </span>
          </div>
        )}
      </div>
      {isExpanded && (
        <div className="max-h-[160px] overflow-auto whitespace-pre-wrap break-words px-10 py-3 font-mono text-xs text-primary">
          {prompt?.content}
        </div>
      )}
    </div>
  );
};
