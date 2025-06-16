import { useCallback, useMemo, useState } from 'react';

import { getParentFolderIdsFromEntityId } from '@/src/utils/app/folders';

import { uniq, xor } from 'lodash';

export const useEntitiesSelectState = <
  T extends {
    id: string;
    folderId: string;
  },
>(
  entities: T[],
  initiallySelectedIds: string[] = [],
) => {
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>(
    entities
      .filter(
        ({ id }) =>
          initiallySelectedIds?.some((selectedId) =>
            id.startsWith(selectedId),
          ) ?? false,
      )
      .map(({ id }) => id),
  );

  const { selectedFolderIds, partiallySelectedFolderIds } = useMemo(() => {
    const folderIds = uniq(
      selectedEntityIds.flatMap(getParentFolderIdsFromEntityId),
    ).map((folderId) => `${folderId}/`);

    const fullySelected = folderIds
      .filter((folderId) =>
        entities.some((entity) => entity.id.startsWith(folderId)),
      )
      .filter((folderId) =>
        entities
          .filter((entity) => entity.id.startsWith(folderId))
          .every((entity) => selectedEntityIds.includes(entity.id)),
      );

    const partiallySelected = folderIds.filter(
      (folderId) =>
        !selectedEntityIds.some((selectedId) =>
          folderId.startsWith(selectedId),
        ) &&
        (selectedEntityIds.some((selectedId) =>
          selectedId.startsWith(folderId),
        ) ||
          fullySelected.some((fullySelectedFolderId) =>
            fullySelectedFolderId.startsWith(folderId),
          )) &&
        !fullySelected.includes(folderId),
    );

    return {
      selectedFolderIds: fullySelected,
      partiallySelectedFolderIds: partiallySelected,
    };
  }, [entities, selectedEntityIds]);

  const handleSelectEntities = useCallback((ids: string[]) => {
    setSelectedEntityIds((prev) => xor(prev, ids));
  }, []);

  const handleSelectFolder = useCallback(
    (folderId: string) => {
      handleSelectEntities(
        entities
          .filter(
            (entity) =>
              entity.id.startsWith(folderId) &&
              (!partiallySelectedFolderIds.includes(folderId) ||
                !selectedEntityIds.includes(entity.id)),
          )
          .map((entity) => entity.id),
      );
    },
    [
      entities,
      partiallySelectedFolderIds,
      handleSelectEntities,
      selectedEntityIds,
    ],
  );

  return {
    selectedEntityIds,
    selectedFolderIds,
    partiallySelectedFolderIds,

    handleSelectEntities,
    setSelectedEntityIds,
    handleSelectFolder,
  };
};
