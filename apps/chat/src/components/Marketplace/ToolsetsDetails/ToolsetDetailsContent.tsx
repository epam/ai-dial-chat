import { useMemo } from 'react';

import { isMyApplication } from '@/src/utils/app/id';

import { ToolsetModel } from '@/src/types/toolsets';

import { useAppSelector } from '@/src/store/hooks';
import { AuthSelectors } from '@/src/store/selectors';

import { EntityDetailsContent } from '../EntityDetailsContent';

interface Props {
  entity: ToolsetModel;
}

export function ToolsetDetailsContent({ entity }: Props) {
  const userName = useAppSelector(AuthSelectors.selectUserName);
  const content = useMemo(
    () => ({
      ...entity,
      author: !isMyApplication(entity) ? entity?.author : userName,
    }),
    [entity, userName],
  );
  return <EntityDetailsContent entity={content} />;
}
