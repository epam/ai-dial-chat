import { IconFolder } from '@tabler/icons-react';
import { createElement, useMemo, useState } from 'react';

import classNames from 'classnames';

import { sortByName } from '@/src/utils/app/folders';

import { PublicationReviewItem } from '@/src/types/publication';

import { Tooltip } from '@/src/components/Common/Tooltip';

import { FolderInterface } from '@epam/ai-dial-shared';

interface Props<T extends PublicationReviewItem> {
  currentFolder: FolderInterface;
  allFolders: FolderInterface[];
  allItems: T[];
  level: number;
  itemComponent?: React.FC<{
    item: T;
    level: number;
  }>;

  isEditable: boolean;
  editedName: string;
  onEdit: (oldId: string, newId: string) => void;
}

export const FolderRow = <T extends PublicationReviewItem>({
  currentFolder,
  allFolders,
  allItems,
  level,
  itemComponent,
  isEditable,
  editedName,
  onEdit,
}: Props<T>) => {
  const [isFocused, setIsFocused] = useState(false);

  const filteredChildFolders = useMemo(() => {
    return sortByName(
      allFolders.filter((folder) => folder.folderId === currentFolder.id),
    );
  }, [currentFolder.id, allFolders]);

  const filteredChildItems = useMemo(() => {
    return sortByName(
      allItems.filter((item) => item.folderId === currentFolder.id),
    );
  }, [allItems, currentFolder.id]);

  return (
    <>
      <div
        className={classNames(
          'group/button group/folder-item group relative flex min-h-[34px] w-full flex-1 cursor-pointer items-center rounded pl-4 hover:bg-accent-primary-alpha',
          isFocused && 'bg-accent-primary-alpha',
        )}
      >
        <div
          className="group/folder-item flex h-[34px] w-full items-center gap-1 py-[5px] pr-3"
          style={{
            paddingLeft: `${level * 24}px`,
          }}
        >
          <IconFolder size={18} className="mr-1 text-secondary" />
          <div
            className="relative flex-1 select-none truncate text-left"
            data-qa="folder-name"
          >
            {isEditable ? (
              <div className="block flex-1 truncate whitespace-pre break-all text-left text-primary">
                <input
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="h-[24px] w-full border-b border-primary bg-layer-2 px-1 py-[2px] text-sm text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
                  value={editedName}
                  onChange={(e) => onEdit(currentFolder.id, e.target.value)}
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
          {filteredChildFolders.map((item) => (
            <FolderRow
              key={item.id}
              level={level + 1}
              currentFolder={item}
              itemComponent={itemComponent}
              allItems={allItems}
              allFolders={allFolders}
              isEditable={isEditable}
              editedName={editedName}
              onEdit={onEdit}
            />
          ))}
        </div>
        {itemComponent &&
          filteredChildItems.map((item) => (
            <div key={item.id}>
              {createElement(itemComponent, {
                item,
                level: level + 1,
              })}
            </div>
          ))}
      </div>
    </>
  );
};
