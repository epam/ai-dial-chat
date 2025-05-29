import { IconFile } from '@tabler/icons-react';

import { DialFile } from '@/src/types/files';

import { PublicationItemRow } from './PublicationItemRow';

interface Props {
  file: DialFile;
  level: number;
}

export const PublicationFileRow: React.FC<Props> = ({ file, level }) => {
  return (
    <PublicationItemRow
      level={level}
      name={file.name}
      Icon={<IconFile size={18} className="text-secondary" />}
      publicationInfo={file.publicationInfo}
      dataQa="file"
      editedName={file.name}
      isEditMode={false}
    />
  );
};
