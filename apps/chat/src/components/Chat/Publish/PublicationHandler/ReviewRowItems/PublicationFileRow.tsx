import { IconFile } from '@tabler/icons-react';

import { EnumMapper } from '@/src/utils/app/mappers';

import { BackendResourceTypeName } from '@/src/types/common';
import { DialFile } from '@/src/types/files';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import { PublicationItemRow } from './PublicationItemRow';

import { FeatureType } from '@epam/ai-dial-shared';

interface Props {
  item: DialFile;
  level: number;
}

export const PublicationFileRow: React.FC<Props> = ({ item, level }) => {
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );

  return (
    <PublicationItemRow
      level={level}
      Icon={<IconFile size={18} className="text-secondary" />}
      item={item}
      itemTypeName={BackendResourceTypeName.FILE}
      dataQa="file"
      isEditDisabled={selectedPublication?.resourceTypes.includes(
        EnumMapper.getBackendResourceTypeByFeatureType(FeatureType.Application),
      )}
    />
  );
};
