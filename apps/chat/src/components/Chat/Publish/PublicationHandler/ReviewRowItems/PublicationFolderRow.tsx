import { IconFolder } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import {
  getSelectedEntitiesByFolderId,
  isFolderPartialSelected,
  isParentFolderSelected,
  sortByName,
} from '@/src/utils/app/folders';

import { PublicationReviewItem } from '@/src/types/publication';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/selectors';

import { Checkbox } from '@/src/components/Common/Checkbox';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { FolderInterface } from '@epam/ai-dial-shared';

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

const isEditMode = false;

export const PublicationFolderRow = <T extends PublicationReviewItem>({
  currentFolder,
  allFolders,
  allItems,
  level,
  ItemComponent,
}: Props<T>) => {
  const dispatch = useAppDispatch();
  const {
    fullyChosenFolderIds: selectedFolderIds,
    partialChosenFolderIds: partialSelectedFolderIds,
  } = useAppSelector((state) =>
    PublicationSelectors.selectChosenFolderIds(state, allFolders, allItems),
  );
  const chosenItemsIds = useAppSelector(
    PublicationSelectors.selectSelectedItemsToPublish,
  );

  const [isFocused, setIsFocused] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isPartialSelected, setIsPartialSelected] = useState(false);

  const { folders, items } = useMemo(() => {
    return {
      folders: filteredItems(allFolders, currentFolder.id),
      items: filteredItems(allItems, currentFolder.id),
    };
  }, [allFolders, allItems, currentFolder.id]);

  const handleSelectFolder = useCallback(() => {
    const entitiesToSelect = getSelectedEntitiesByFolderId({
      entities: allItems,
      folderId: `${currentFolder.id}/`,
      partialChosenFolderIds: partialSelectedFolderIds,
      chosenItemsIds,
    });

    dispatch(
      PublicationActions.selectItemsToPublish({
        ids: entitiesToSelect,
      }),
    );
  }, [
    allItems,
    chosenItemsIds,
    currentFolder.id,
    dispatch,
    partialSelectedFolderIds,
  ]);

  useEffect(() => {
    const isParentSelected = isParentFolderSelected({
      currentFolderId: currentFolder.id,
      selectedFolderIds: selectedFolderIds,
    });

    setIsSelected(isParentSelected);
  }, [currentFolder.id, selectedFolderIds]);

  useEffect(() => {
    setIsPartialSelected(
      isFolderPartialSelected({
        currentFolderId: currentFolder.id,
        partialSelectedFolderIds,
        isSelected,
      }),
    );
  }, [currentFolder.id, isSelected, partialSelectedFolderIds]);

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
          <Checkbox
            isSelected={isSelected}
            isPartialSelected={isPartialSelected}
            onChange={handleSelectFolder}
            className="mr-0"
          />
          <IconFolder size={18} className="mr-1 text-secondary" />
          <div
            className="relative flex-1 select-none truncate text-left"
            data-qa="folder-name"
          >
            {isEditMode ? (
              <div className="block flex-1 truncate whitespace-pre break-all text-left text-primary">
                <input
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="h-[24px] w-full border-b border-primary bg-layer-2 px-1 py-[2px] text-sm text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
                  value={currentFolder.name}
                />
              </div>
            ) : (
              <Tooltip
                tooltip={currentFolder.name}
                contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
                isTriggerClickable
                triggerClassName="block max-h-5 flex-1 truncate whitespace-pre break-all text-left text-primary"
              >
                {currentFolder.name}
              </Tooltip>
            )}
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
