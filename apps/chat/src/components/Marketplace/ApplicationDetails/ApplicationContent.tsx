import { useMemo } from 'react';

import { isMyApplication } from '@/src/utils/app/id';

import { DialAIEntityModel } from '@/src/types/models';

import { useAppSelector } from '@/src/store/hooks';
import { AuthSelectors } from '@/src/store/selectors';

import { EntityDetailsContent } from '../EntityDetailsContent';

interface Props {
  entity: DialAIEntityModel;
}

export const ApplicationDetailsContent = ({ entity }: Props) => {
  const userName = useAppSelector(AuthSelectors.selectUserName);

  const content = useMemo(
    () => ({
      ...entity,
      author: !isMyApplication(entity) ? entity?.owner : userName,
    }),
    [entity, userName],
  );

  return <EntityDetailsContent entity={content} />;
};
