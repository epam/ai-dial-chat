import type { AvatarPickerFileManagerModalProps } from '@epam/ai-dial-builder-form';
import { memo, type FC } from 'react';
import DialFileManagerModal from '../DialFileManagerModal/DialFileManagerModal';
import FileDeleteConfirmContent from '../FileDeleteConfirmContent/FileDeleteConfirmContent';

type Props = AvatarPickerFileManagerModalProps;

/**
 * File manager modal for the entity editors' avatar picker.
 *
 * `AvatarPickerModal` hands its host modal a delete confirmation built from
 * its own plain labels ("Delete item", a quoted name). Deleting a file or
 * folder must look the same wherever the file manager appears (issue #9118),
 * so the picker's title and body are replaced by the ones the attachment
 * modal shows: "Delete file"/"Delete folder" by node type, and the shared
 * confirmation block.
 */
const AvatarFileManagerModal: FC<Props> = (props) => (
  <DialFileManagerModal
    {...props}
    deleteConfirmTitle={undefined}
    deleteConfirmBody={(names) => <FileDeleteConfirmContent names={names} />}
  />
);

export default memo(AvatarFileManagerModal);
