import { ToolsetModel } from '@/src/types/toolsets';

import { EntityDetailsContent } from '../EntityDetailsContent';

interface Props {
  entity: ToolsetModel;
}

export function ToolsetDetailsContent({ entity }: Props) {
  return <EntityDetailsContent entity={entity} />;
}
