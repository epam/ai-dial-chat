import { ReactNode } from 'react';

import { useAppSelector } from '@/store/hooks';
import { ModelsSelectors } from '@/store/models/models.reducers';
import { UISelectors } from '@/store/ui-store/ui.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

export interface SelectIconProps {
  modelId: string;
  children: ReactNode;
}
export const SelectIcon = ({ modelId, children }: SelectIconProps) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const theme = useAppSelector(UISelectors.selectThemeState);

  return (
    <span className="flex max-w-full !shrink-0 flex-row items-center gap-2">
      <ModelIcon
        size={18}
        entityId={modelId}
        entity={modelsMap[modelId]}
        inverted={theme === 'dark'}
      />
      <span className="truncate break-all">{children}</span>
    </span>
  );
};
