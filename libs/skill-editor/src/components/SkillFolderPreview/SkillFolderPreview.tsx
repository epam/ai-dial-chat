import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Breadcrumbs,
  DialItemType,
  FileName,
  NoDataContent,
} from '@epam/ai-dial-ui-kit';
import type { BreadcrumbsItem } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import type { SkillFolderPreviewProps } from '../../models/skill-folder-preview-props';
import { SkillFileNodeKind } from '../../types/skill-file-node-kind';
import styles from './SkillFolderPreview.module.scss';

const defaultItemCountLabel = (count: number): string =>
  count === 1 ? '1 item' : `${count} items`;

/** Breadcrumb trail plus the direct children of the selected skill folder, or an empty state. */
export const SkillFolderPreview: FC<SkillFolderPreviewProps> = ({
  folderPath,
  entries,
  onOpen,
  rootLabel = 'Skill',
  breadcrumbAriaLabel = 'Folder path',
  overflowAriaLabel = 'Show hidden path segments',
  listAriaLabel = 'Folder content',
  emptyTitle = 'This folder is empty',
  emptyDescription = 'Use Add to upload files or create a subfolder.',
  itemCountLabel = defaultItemCountLabel,
  itemCountClassName = 'dial-tiny-text',
}) => {
  const segments = folderPath.split('/');
  const crumbs: BreadcrumbsItem[] = [
    {
      label: rootLabel,
      onClick: () => onOpen('', SkillFileNodeKind.Folder),
    },
    ...segments.map((segment, index) => {
      const path = segments.slice(0, index + 1).join('/');
      return index === segments.length - 1
        ? { label: segment }
        : {
            label: segment,
            onClick: () => onOpen(path, SkillFileNodeKind.Folder),
          };
    }),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Breadcrumbs
        items={crumbs}
        ariaLabel={breadcrumbAriaLabel}
        overflowAriaLabel={overflowAriaLabel}
      />
      {entries.length === 0 ? (
        <NoDataContent title={emptyTitle} description={emptyDescription} live />
      ) : (
        <ul
          aria-label={listAriaLabel}
          className={mergeClasses(
            'm-0 flex list-none flex-col overflow-hidden rounded-lg border p-0',
            styles.list,
          )}
        >
          {entries.map((entry) => {
            const isFolder = entry.kind === SkillFileNodeKind.Folder;
            return (
              <li key={entry.path} className="m-0 p-0">
                <button
                  type="button"
                  onClick={() => onOpen(entry.path, entry.kind)}
                  className={mergeClasses(
                    'flex w-full cursor-pointer items-center justify-between gap-4 border-b bg-transparent px-3 py-2 text-start last:border-b-0',
                    styles.row,
                  )}
                >
                  <FileName
                    name={entry.name}
                    type={isFolder ? DialItemType.Folder : DialItemType.File}
                    className="min-w-0 flex-1"
                  />
                  {isFolder && (
                    <span
                      className={mergeClasses(
                        'shrink-0',
                        styles.count,
                        itemCountClassName,
                      )}
                    >
                      {itemCountLabel(entry.childCount)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
