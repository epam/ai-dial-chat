import { IconFolder } from '@tabler/icons-react';
import { Fragment, createElement, useMemo } from 'react';

import { sortByName } from '@/src/utils/app/folders';

import { DialFile } from '@/src/types/files';

import { Tooltip } from './Tooltip';

import {
  ConversationInfo,
  FeatureType,
  FolderInterface,
  PromptInfo,
} from '@epam/ai-dial-shared';

interface Props<T> {
  currentFolder: FolderInterface;
  allFolders: FolderInterface[];
  openedFoldersIds: string[];
  allItems: T[];
  level: number;
  itemComponent?: React.FC<{
    item: T;
    level: number;
  }>;
  featureType: FeatureType;
}

export const FolderRow = <T extends ConversationInfo | PromptInfo | DialFile>({
  currentFolder,
  allFolders,
  openedFoldersIds,
  allItems,
  level,
  itemComponent,
  featureType,
}: Props<T>) => {
  const filteredChildFolders = useMemo(() => {
    return sortByName(
      allFolders.filter((folder) => folder.folderId === currentFolder.id),
    );
  }, [currentFolder, allFolders]);

  const filteredChildItems = useMemo(() => {
    return sortByName(
      allItems.filter((item) => item.folderId === currentFolder.id),
    );
  }, [allItems, currentFolder.id]);

  return (
    <>
      <div className="group/button group/folder-item group relative flex h-[38px] cursor-pointer items-center rounded pl-4 hover:bg-accent-primary-alpha">
        <div
          className="group/folder-item flex max-w-full items-center gap-1 py-2 pr-3"
          style={{
            paddingLeft: `${level * 24}px`,
          }}
        >
          <IconFolder size={18} className="mr-1 text-secondary" />
          <div
            className="relative max-h-5 flex-1 select-none truncate text-left"
            data-qa="folder-name"
          >
            <Tooltip
              tooltip={currentFolder.name}
              contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
              isTriggerClickable
              triggerClassName="block max-h-5 flex-1 truncate whitespace-pre break-all text-left text-primary"
            >
              {currentFolder.name}
            </Tooltip>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex flex-col">
          {filteredChildFolders.map((item) => {
            return (
              <Fragment key={item.id}>
                <div className="h-1"></div>
                <FolderRow
                  level={level + 1}
                  currentFolder={item}
                  itemComponent={itemComponent}
                  allItems={allItems}
                  allFolders={allFolders}
                  openedFoldersIds={openedFoldersIds}
                  featureType={featureType}
                />
              </Fragment>
            );
          })}
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
