import { ModalState } from '@/src/types/modal';
import { ToolsetModel } from '@/src/types/toolsets';

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
  // allEntities,
  // isMyWorkspaceTab,
  // isSuggested,
  onClose,
  onChangeVersion,
  onBookmarkClick,
}: Props) {
  // const installedToolsetsIds = useAppSelector(
  //   ToolsetSelectors.selectInstalledToolsetsReferences,
  // );

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
        allVersions={[]}
        onBookmarkClick={onBookmarkClick}
      />
    </Modal>
  );
}
