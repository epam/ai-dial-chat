import { IconFolder } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { replaceSpacesFromString } from '@/src/utils/app/common';
import {
  getSelectedEntitiesByFolderId,
  isFolderPartialSelected,
  isParentFolderSelected,
  sortByName,
} from '@/src/utils/app/folders';
import { getStringValidationErrors } from '@/src/utils/app/forms';
import { isFileId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { isFolderNameNotUniq } from '@/src/utils/app/publications';

import { PublicationReviewItem } from '@/src/types/publication';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import { Checkbox } from '@/src/components/Common/Checkbox';
import { EditableField } from '@/src/components/Common/EditableField';

import {
  FeatureType,
  FolderInterface,
  PublishActions,
} from '@epam/ai-dial-shared';

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
  const dispatch = useAppDispatch();

  const [inputName, setInputName] = useState(currentFolder.name);
  const [isFocused, setIsFocused] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isPartialSelected, setIsPartialSelected] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );

  const chosenFoldersSelector = useMemo(
    () =>
      PublicationSelectors.selectChosenFolderIdsToApprove(allFolders, allItems),
    [allFolders, allItems],
  );
  const {
    fullyChosenFolderIds: selectedFolderIds,
    partialChosenFolderIds: partialSelectedFolderIds,
  } = useAppSelector(chosenFoldersSelector);

  const chosenItemsIds = useAppSelector(
    PublicationSelectors.selectSelectedItemsToApprove,
  );

  const folderEditState = useAppSelector(
    PublicationSelectors.selectFoldersEditState,
  );

  useEffect(() => {
    const cleanName = replaceSpacesFromString(currentFolder.name);
    setInputName(cleanName);
  }, [currentFolder.name, isEditMode]);

  useEffect(() => {
    const isNotUniqName = isFolderNameNotUniq(
      inputName,
      currentFolder,
      folderEditState,
    );

    const nameErrors = getStringValidationErrors({
      value: inputName,
      label: 'Folder name',
      checkDotsInTheEnd: true,
      isNotUniqName,
    });
    setErrors(nameErrors);
  }, [currentFolder, folderEditState, inputName]);

  const handleChangeName = useCallback(
    (name: string) => {
      setInputName(name);

      dispatch(
        PublicationActions.setEditFolderStateByFolderId({
          folderId: currentFolder.id,
          name,
        }),
      );
    },
    [dispatch, currentFolder.id],
  );

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
      PublicationActions.selectItemsToApprove({
        publicationUrl: selectedPublication?.url ?? '',
        ids: entitiesToSelect,
      }),
    );
  }, [
    allItems,
    chosenItemsIds,
    currentFolder.id,
    dispatch,
    partialSelectedFolderIds,
    selectedPublication?.url,
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

  const isAllChildResourcesForUnpublish = selectedPublication?.resources
    .filter((resource) => `${resource.reviewUrl.startsWith(currentFolder.id)}/`)
    .every((resource) => resource.action === PublishActions.DELETE);
  const isFileFolderAndApplicationResourceExists =
    selectedPublication?.resourceTypes.includes(
      EnumMapper.getBackendResourceTypeByFeatureType(FeatureType.Application),
    ) && isFileId(currentFolder.id);
  const isEditDisabled =
    isFileFolderAndApplicationResourceExists || isAllChildResourcesForUnpublish;

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
            checked={isSelected}
            isPartialChecked={isPartialSelected}
            onChange={handleSelectFolder}
            className="mr-0"
          />
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
              onChange={handleChangeName}
              inputClassName={classNames(
                'w-full',
                errors.length && '!border-b-error pr-5',
              )}
              tooltipIconClassName="right-1"
              errors={errors}
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
