import { IconFolder } from '@tabler/icons-react';
import { FC, MouseEvent, useMemo } from 'react';

import classNames from 'classnames';

import { FolderInterface } from '@/src/types/folder';

import { CaretIconComponent } from './CaretIconComponent';
import { Checkbox } from './Checkbox';

interface FolderRowItem {
  id: string;
  folderId: string;
}

export interface FolderRowItemComponentProps<T extends FolderRowItem> {
  item: T;
  level: number;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export interface FolderRowProps<T extends FolderRowItem> {
  folder: FolderInterface;
  allFolders: FolderInterface[];
  allItems: T[];
  level: number;
  selectedItemIds: string[];
  openedFoldersIds: string[];
  itemComponent: FC<FolderRowItemComponentProps<T>>;
  onToggleItem: (id: string) => void;
  onToggleFolder: (descendantIds: string[]) => void;
  onClickFolder: (folderId: string) => void;
}

export const FolderRow = <T extends FolderRowItem>({
  folder,
  allFolders,
  allItems,
  level,
  selectedItemIds,
  openedFoldersIds,
  itemComponent: ItemComponent,
  onToggleItem,
  onToggleFolder,
  onClickFolder,
}: FolderRowProps<T>) => {
  const childFolders = useMemo(
    () => allFolders.filter((f) => f.folderId === folder.id),
    [allFolders, folder.id],
  );
  const folderItems = useMemo(
    () => allItems.filter((it) => it.folderId === folder.id),
    [allItems, folder.id],
  );
  const hasChildren = childFolders.length > 0 || folderItems.length > 0;
  const isOpen = openedFoldersIds.includes(folder.id);

  const descendantIds = useMemo(
    () =>
      allItems
        .filter((it) => it.id.startsWith(`${folder.id}/`))
        .map((it) => it.id),
    [allItems, folder.id],
  );

  const { isFullySelected, isPartiallySelected } = useMemo(() => {
    if (descendantIds.length === 0) {
      return { isFullySelected: false, isPartiallySelected: false };
    }

    const selectedCount = descendantIds.filter((id) =>
      selectedItemIds.includes(id),
    ).length;

    return {
      isFullySelected: selectedCount === descendantIds.length,
      isPartiallySelected:
        selectedCount > 0 && selectedCount < descendantIds.length,
    };
  }, [descendantIds, selectedItemIds]);

  const isHighlighted = isFullySelected || isPartiallySelected;

  const handleCheckboxClick = (e: MouseEvent) => {
    e.stopPropagation();
    onToggleFolder(descendantIds);
  };

  return (
    <>
      <div
        className={classNames(
          'group/folder-item group relative flex h-[32px] cursor-pointer select-none items-center rounded border-l-2 border-transparent pr-3 hover:bg-accent-primary-alpha',
          isHighlighted && 'bg-accent-primary-alpha',
        )}
        style={{ paddingLeft: `${level * 24 + 16}px` }}
        onClick={() => onClickFolder(folder.id)}
        data-qa="folder"
      >
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: `${level * 24 + 2}px` }}
        >
          <CaretIconComponent isOpen={isOpen} size={10} hidden={!hasChildren} />
        </div>
        <div className="flex max-w-full items-center gap-1">
          <div
            className="relative mr-1 flex size-[18px] shrink-0 items-center justify-center"
            onClick={handleCheckboxClick}
          >
            <IconFolder
              size={18}
              strokeWidth={1.5}
              className={classNames(
                'shrink-0 text-secondary',
                isHighlighted
                  ? 'opacity-0'
                  : 'group-hover/folder-item:opacity-0',
              )}
            />
            <div
              className={classNames(
                'absolute inset-0 flex items-center justify-center',
                !isHighlighted &&
                  'opacity-0 group-hover/folder-item:opacity-100',
              )}
            >
              <Checkbox
                checked={isFullySelected}
                isPartialChecked={isPartiallySelected}
                onChange={() => undefined}
                className="mr-0"
              />
            </div>
          </div>
          <span className="relative max-h-5 flex-1 select-none truncate text-start text-sm">
            {folder.name}
          </span>
        </div>
      </div>
      {isOpen && (
        <>
          {childFolders.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              allFolders={allFolders}
              allItems={allItems}
              level={level + 1}
              selectedItemIds={selectedItemIds}
              openedFoldersIds={openedFoldersIds}
              itemComponent={ItemComponent}
              onToggleItem={onToggleItem}
              onToggleFolder={onToggleFolder}
              onClickFolder={onClickFolder}
            />
          ))}
          {folderItems.map((item) => (
            <ItemComponent
              key={item.id}
              item={item}
              level={level + 1}
              isSelected={selectedItemIds.includes(item.id)}
              onToggle={onToggleItem}
            />
          ))}
        </>
      )}
    </>
  );
};
