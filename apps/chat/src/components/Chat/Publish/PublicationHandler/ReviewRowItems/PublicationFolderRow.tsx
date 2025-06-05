import { IconFolder } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useDebouncedInput } from '@/src/hooks/useDebounceInput';

import { sortByName } from '@/src/utils/app/folders';
import { isFileId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';

import { PublicationReviewItem } from '@/src/types/publication';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import { PUBLICATION_REVIEW_UPDATING_DELAY } from '@/src/constants/publication';

import { EditableField } from '@/src/components/Common/EditableField';

import { FeatureType, FolderInterface } from '@epam/ai-dial-shared';

interface Props<T extends PublicationReviewItem> {
  currentFolder: FolderInterface;
  allFolders: FolderInterface[];
  allItems: T[];
  level: number;
  ItemComponent: React.FC<{
    item: T;
    level: number;
  }>;
}

const filteredItems = <T extends PublicationReviewItem | FolderInterface>(
  allItems: T[],
  currentFolderId: string,
) => sortByName(allItems.filter((item) => item.folderId === currentFolderId));

export const PublicationFolderRow = <T extends PublicationReviewItem>({
  currentFolder,
  allFolders,
  allItems,
  level,
  ItemComponent,
}: Props<T>) => {
  const [isFocused, setIsFocused] = useState(false);

  const dispatch = useAppDispatch();

  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );

  const handleChangeName = useCallback(
    (name: string) => {
      dispatch(
        PublicationActions.setEditFolderStateByFolderId({
          folderId: currentFolder.id,
          name,
        }),
      );
    },
    [dispatch, currentFolder.id],
  );

  const [inputName, handleDebouncedChangeName] = useDebouncedInput(
    currentFolder.name,
    handleChangeName,
    PUBLICATION_REVIEW_UPDATING_DELAY,
  );

  useEffect(() => {
    handleDebouncedChangeName(currentFolder.name);
  }, [handleDebouncedChangeName, isEditMode, currentFolder.name]);

  const { folders, items } = useMemo(() => {
    return {
      folders: filteredItems(allFolders, currentFolder.id),
      items: filteredItems(allItems, currentFolder.id),
    };
  }, [allFolders, allItems, currentFolder.id]);

  const isEditDisabled =
    selectedPublication?.resourceTypes.includes(
      EnumMapper.getBackendResourceTypeByFeatureType(FeatureType.Application),
    ) && isFileId(currentFolder.id);

  return (
    <>
      <div
        className={classNames(
          'relative flex min-h-[34px] w-full flex-1 cursor-pointer items-center rounded pl-4 hover:bg-accent-primary-alpha',
          isFocused && 'bg-accent-primary-alpha',
        )}
        data-qa="folder"
      >
        <div
          className="flex h-[34px] w-full items-center gap-2 py-[5px] pr-3"
          style={{
            paddingLeft: `${level * 24}px`,
          }}
        >
          <IconFolder size={18} className="mr-1 text-secondary" />
          <div
            className="relative flex-1 select-none truncate text-left"
            data-qa="folder-name"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          >
            <EditableField
              value={inputName}
              isEditMode={isEditDisabled ? false : isEditMode}
              onChange={handleDebouncedChangeName}
              inputClassName={classNames(
                'w-full',
                !inputName && '!border-b-error',
              )}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex flex-col">
          {folders.map((item) => (
            <PublicationFolderRow
              key={item.id}
              level={level + 1}
              currentFolder={item}
              ItemComponent={ItemComponent}
              allItems={allItems}
              allFolders={allFolders}
            />
          ))}
        </div>
        {items.map((item: T) => (
          <div key={item.id}>
            <ItemComponent item={item} level={level + 1} />
          </div>
        ))}
      </div>
    </>
  );
};
