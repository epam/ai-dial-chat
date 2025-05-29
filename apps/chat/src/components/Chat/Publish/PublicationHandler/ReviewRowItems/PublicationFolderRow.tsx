import { IconFolder } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

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
  const [isFocused, setIsFocused] = useState(false);

  const filteredChildFolders = useMemo(() => {
    return filteredItems(allFolders, currentFolder.id);
  }, [allFolders, currentFolder.id]);

  const filteredChildItems = useMemo(() => {
    return filteredItems(allItems, currentFolder.id);
  }, [allItems, currentFolder.id]);

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
          >
            {isEditMode ? (
              <div className="block flex-1 truncate whitespace-pre break-all text-left text-primary">
                <input
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="h-[24px] w-full border-b border-primary bg-layer-2 px-1 py-[2px] text-sm text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
                  value={currentFolder.name}
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
                  onChange={(e) => {}}
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
        {ItemComponent &&
          filteredChildItems.map((item: T) => (
            <div key={item.id}>
              <ItemComponent item={item} level={level + 1} />
            </div>
          ))}
      </div>
    </>
  );
};
