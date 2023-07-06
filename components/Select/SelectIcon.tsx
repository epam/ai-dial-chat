import { ReactNode, useContext } from 'react';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

export interface SelectIconProps {
  modelId: string;
  children: ReactNode;
}
export const SelectIcon = ({ modelId, children }: SelectIconProps) => {
  const {
    state: { modelIconMapping, lightMode },
  } = useContext(HomeContext);
  return (
    <span className="flex flex-row items-center gap-2">
      <ModelIcon
        size={18}
        modelIconMapping={modelIconMapping}
        modelId={modelId}
        inverted={lightMode === 'dark'}
      />
      {children}
    </span>
  );
};
