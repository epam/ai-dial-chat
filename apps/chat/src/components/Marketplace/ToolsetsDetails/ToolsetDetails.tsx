import { useMemo } from 'react';

import { sortItemsVersions } from '@/src/utils/app/common';
import { isMyToolset } from '@/src/utils/app/id';
import { getGroupMarketplaceEntityKey } from '@/src/utils/app/marketplace';

import { ModalState } from '@/src/types/modal';
import { ToolsetModel } from '@/src/types/toolsets';

import { useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { Modal } from '@/src/components/Common/Modal';

import { ToolsetDetailsContent } from './ToolsetDetailsContent';
import { ToolsetDetailsFooter } from './ToolsetDetailsFooter';
import { ToolsetDetailsHeader } from './ToolsetDetailsHeader';

interface Props {
  entity: ToolsetModel;
  allEntities: ToolsetModel[];
  isMyWorkspaceTab: boolean;
  isSuggested?: boolean;
  onClose: () => void;
  onChangeVersion: (entity: ToolsetModel) => void;
  onBookmarkClick: (entity: ToolsetModel) => void;
}

export function ToolsetDetails({
  entity,
  allEntities,
  isMyWorkspaceTab,
  isSuggested,
  onClose,
  onChangeVersion,
  onBookmarkClick,
}: Props) {
  const installedToolsetsIds = useAppSelector(
    ToolsetSelectors.selectInstalledToolsetsSet,
  );
  const filteredEntities = useMemo(() => {
    const filtered = allEntities.filter(
      (e) =>
        getGroupMarketplaceEntityKey(entity) ===
          getGroupMarketplaceEntityKey(e) &&
        (!isMyWorkspaceTab ||
          installedToolsetsIds.has(e.reference) ||
          isSuggested),
    );

    return isMyToolset(entity) ? sortItemsVersions(filtered) : filtered;
  }, [
    allEntities,
    entity,
    installedToolsetsIds,
    isMyWorkspaceTab,
    isSuggested,
  ]);

  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa="marketplace-toolset-details"
      overlayClassName="!z-40"
      containerClassName="flex w-full flex-col divide-y divide-tertiary xl:max-w-[720px] max-w-[700px]"
      onClose={onClose}
    >
      <ToolsetDetailsHeader entity={entity} />
      <ToolsetDetailsContent entity={entity} />
      <ToolsetDetailsFooter
        onChangeVersion={onChangeVersion}
        entity={entity}
        allVersions={filteredEntities}
        onBookmarkClick={onBookmarkClick}
      />
    </Modal>
  );
}
