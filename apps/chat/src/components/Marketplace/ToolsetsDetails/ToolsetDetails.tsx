import { FC, useMemo } from 'react';

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

export interface ToolsetDetailsFooterProps {
  entity: ToolsetModel;
  allVersions: ToolsetModel[];
  onChangeVersion: (entity: ToolsetModel) => void;
  onBookmarkClick?: (entity: ToolsetModel) => void;
  onRemove?: (entity: ToolsetModel) => void;
}

interface Props {
  entity: ToolsetModel;
  allEntities: ToolsetModel[];
  isMyWorkspaceTab?: boolean;
  isSuggested?: boolean;
  onClose: () => void;
  onChangeVersion: (entity: ToolsetModel) => void;
  onBookmarkClick?: (entity: ToolsetModel) => void;
  onRemove?: (entity: ToolsetModel) => void;
  FooterComponent?: FC<ToolsetDetailsFooterProps>;
  isPreview?: boolean;
}

export function ToolsetDetails({
  entity,
  allEntities,
  isMyWorkspaceTab,
  isSuggested,
  onClose,
  onChangeVersion,
  onBookmarkClick,
  onRemove,
  FooterComponent = ToolsetDetailsFooter,
  isPreview,
}: Props) {
  const installedToolsetsIds = useAppSelector(
    ToolsetSelectors.selectInstalledToolsetsSet,
  );
  const isSuggestedEntity =
    isSuggested ||
    (isMyWorkspaceTab && !installedToolsetsIds.has(entity.reference));

  const filteredEntities = useMemo(() => {
    const filtered = allEntities.filter(
      (e) =>
        getGroupMarketplaceEntityKey(entity) ===
          getGroupMarketplaceEntityKey(e) &&
        (!isMyWorkspaceTab ||
          isSuggestedEntity ||
          installedToolsetsIds.has(e.reference)),
    );

    return isMyToolset(entity) ? sortItemsVersions(filtered) : filtered;
  }, [
    allEntities,
    entity,
    installedToolsetsIds,
    isMyWorkspaceTab,
    isSuggestedEntity,
  ]);

  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa="marketplace-entity-details"
      overlayClassName="!z-40"
      containerClassName="flex w-full flex-col divide-y divide-tertiary xl:max-w-[720px] max-w-[700px]"
      onClose={onClose}
    >
      <ToolsetDetailsHeader entity={entity} isPreview={isPreview} />
      <ToolsetDetailsContent entity={entity} />
      <FooterComponent
        onChangeVersion={onChangeVersion}
        entity={entity}
        allVersions={filteredEntities}
        onBookmarkClick={onBookmarkClick}
        onRemove={onRemove}
      />
    </Modal>
  );
}
