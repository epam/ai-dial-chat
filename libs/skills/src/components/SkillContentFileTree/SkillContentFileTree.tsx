import type { CatalogContentFileTreeRenderProps } from '@epam/ai-dial-catalog';
import {
  DialFileNodeType,
  DialFoldersTree,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { type FC, useMemo } from 'react';
import { mapCatalogContentTreeToDialFiles } from '../../utils/catalog-content-dial-files';

/**
 * The skill details panel's Content-tab file tree, drawn with the file
 * manager's `DialFoldersTree` so it matches the skill editor's tree. It is
 * read-only — no context menu, no rename — and fully controlled by the
 * catalog's `DetailsPanel`: expansion changes are reported back one folder
 * at a time through `onToggleFolder`.
 */
export const SkillContentFileTree: FC<CatalogContentFileTreeRenderProps> = ({
  nodes,
  selectedFileId,
  expandedFolderIds,
  onToggleFolder,
  onSelectFile,
  onClose,
  ariaLabel,
}) => {
  const items = useMemo(() => mapCatalogContentTreeToDialFiles(nodes), [nodes]);
  const expandedPaths = useMemo(
    () => new Set(expandedFolderIds),
    [expandedFolderIds],
  );

  const handleExpandedPathsChange = (next: Set<string>) => {
    for (const id of next) {
      if (!expandedFolderIds.has(id)) onToggleFolder(id);
    }
    for (const id of expandedFolderIds) {
      if (!next.has(id)) onToggleFolder(id);
    }
  };

  /* A folder click only toggles, which `onExpandedPathsChange` already reports. */
  const handleItemClick = (item: DialFile) => {
    if (item.nodeType === DialFileNodeType.ITEM) onSelectFile(item.path);
  };

  return (
    <DialFoldersTree
      items={items}
      showFiles
      areHiddenFilesVisible
      selectedPath={selectedFileId}
      expandedPaths={expandedPaths}
      onExpandedPathsChange={handleExpandedPathsChange}
      onItemClick={handleItemClick}
      ariaLabel={ariaLabel}
      autoFocus
      onEscape={onClose}
    />
  );
};
