import { isMyApplication } from '@/src/utils/app/id';

import { DialAIEntityModel } from '@/src/types/models';

import { EntityDetailsContent } from '../EntityDetailsContent';

interface Props {
  entity: DialAIEntityModel;
}

export const ApplicationDetailsContent = ({ entity }: Props) => {
  return (
    <EntityDetailsContent
      entity={{
        ...entity,
        author: !isMyApplication(entity) ? entity?.owner : undefined,
      }}
    />
  );
};
