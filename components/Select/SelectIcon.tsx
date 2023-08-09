import { ReactNode, useContext } from 'react';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

export interface SelectIconProps {
  modelId: string;
  children: ReactNode;
}
export const SelectIcon = ({ modelId, children }: SelectIconProps) => {
  const {
    state: { modelsMap, lightMode },
  } = useContext(HomeContext);

  return (
    <span className="flex max-w-full !shrink-0 flex-row items-center gap-2">
      <ModelIcon
        size={18}
        entityId={modelId}
        entity={modelsMap[modelId]}
        inverted={lightMode === 'dark'}
      />
      <span className="truncate break-all">{children}</span>
    </span>
  );
};
