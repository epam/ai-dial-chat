import { IconEye, IconEyeOff } from '@tabler/icons-react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { Tooltip } from '@/src/components/Common/Tooltip';

import FolderPlus from '@/public/images/icons/folder-plus.svg';

interface Props {
  onCreateNewFolder: () => void;
  onSelectFolderClick: () => void;
  onToggleHiddenFolders?: () => void;
  areHiddenFoldersVisible?: boolean;
  disableSelect?: boolean;
  selectBtnText?: string;
}

export const SelectFolderFooter = ({
  onCreateNewFolder,
  onSelectFolderClick,
  onToggleHiddenFolders,
  areHiddenFoldersVisible = false,
  disableSelect,
  selectBtnText = 'Select folder',
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex items-center justify-between border-t border-tertiary px-3 py-4 md:px-6">
      <div className="flex items-center justify-center">
        <button
          onClick={() => onCreateNewFolder()}
          className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
          data-qa="new-folder"
        >
          <FolderPlus height={24} width={24} />
        </button>

        {!!onToggleHiddenFolders && (
          <button
            onClick={onToggleHiddenFolders}
            className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
            data-qa="new-folder"
          >
            <Tooltip
              tooltip={
                areHiddenFoldersVisible
                  ? t('Hide technical items')
                  : t('Show technical items')
              }
              isTriggerClickable
            >
              {areHiddenFoldersVisible ? (
                <IconEyeOff height={24} width={24} />
              ) : (
                <IconEye height={24} width={24} />
              )}
            </Tooltip>
          </button>
        )}
      </div>
      <div>
        <button
          onClick={onSelectFolderClick}
          className="button button-primary"
          data-qa="select-folder"
          disabled={disableSelect}
        >
          {t(selectBtnText)}
        </button>
      </div>
    </div>
  );
};
