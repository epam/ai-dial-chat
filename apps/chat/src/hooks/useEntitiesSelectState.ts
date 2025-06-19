import { useCallback, useEffect, useMemo, useState } from 'react';

import { getParentFolderIdsFromEntityId } from '@/src/utils/app/folders';
import { isFolderId } from '@/src/utils/app/id';

import { groupBy, uniq, xor } from 'lodash';

const getInitiallySelectedIds = <T extends { id: string }>(
  ids: string[],
  entities: T[],
) => {
  const { folderIds = [], fileIds = [] } = groupBy(ids, (id) =>
    isFolderId(id) ? 'folderIds' : 'fileIds',
  );

  return uniq([
    ...fileIds,
    ...entities
      .filter(
        ({ id }) =>
          folderIds?.some((selectedId) => id.startsWith(selectedId)) ?? false,
      )
      .map(({ id }) => id),
  ]);
};

const getInitialSelectedEmptyFolderIds = <T extends { id: string }>(
  ids: string[],
  entities: T[],
) => {
  const folderIds = ids.filter(isFolderId);

  return folderIds.filter(
    (folderId) => !entities.some((entity) => entity.id.startsWith(folderId)),
  );
};

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
    getInitiallySelectedIds(initiallySelectedIds, entities),
  );
  const [selectedEmptyFolderIds, setSelectedEmptyFolderIds] = useState<
    string[]
  >(getInitialSelectedEmptyFolderIds(initiallySelectedIds, entities));

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
      selectedFolderIds: [...fullySelected, ...selectedEmptyFolderIds],
      partiallySelectedFolderIds: partiallySelected,
    };
  }, [entities, selectedEmptyFolderIds, selectedEntityIds]);

  const handleSelectEntities = useCallback(
    (ids: string[]) => {
      const selectedEmptyFolderIdsToRemove = selectedEmptyFolderIds.filter(
        (folderId) => ids.some((id) => id.startsWith(folderId)),
      );

      if (selectedEmptyFolderIdsToRemove.length) {
        setSelectedEmptyFolderIds((prev) =>
          xor(prev, selectedEmptyFolderIdsToRemove),
        );
      }
      setSelectedEntityIds((prev) => xor(prev, ids));
    },
    [selectedEmptyFolderIds],
  );

  const handleSelectFolder = useCallback(
    (folderId: string) => {
      const isFolderEmpty = !entities.some((entity) =>
        entity.id.startsWith(folderId),
      );

      if (isFolderEmpty) {
        setSelectedEmptyFolderIds((prev) => xor(prev, [folderId]));
        return;
      }

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
      handleSelectEntities,
      partiallySelectedFolderIds,
      selectedEntityIds,
    ],
  );

  // If entities of selected empty folder were uploaded -> select all entities by folderId and remove selected empty folderId
  useEffect(() => {
    if (selectedEmptyFolderIds.length) {
      const emptyFolderIdsToRemove = selectedEmptyFolderIds.filter((folderId) =>
        entities.some((entity) => entity.id.startsWith(folderId)),
      );
      const entityIdsToSelect = !emptyFolderIdsToRemove.length
        ? []
        : entities
            .filter((entity) =>
              emptyFolderIdsToRemove.some((folderId) =>
                entity.id.startsWith(folderId),
              ),
            )
            .map((entity) => entity.id);

      if (emptyFolderIdsToRemove.length) {
        setSelectedEmptyFolderIds((prev) => xor(prev, emptyFolderIdsToRemove));
        setSelectedEntityIds((prev) => xor(prev, entityIdsToSelect));
      }
    }
  }, [entities, selectedEmptyFolderIds]);

  return {
    selectedEntityIds,
    selectedFolderIds,
    partiallySelectedFolderIds,

    handleSelectEntities,
    setSelectedEntityIds,
    handleSelectFolder,
  };
};
