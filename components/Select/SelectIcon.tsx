import { ReactNode, useContext } from 'react';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { useAppSelector } from '@/store/hooks';
import { selectThemeState } from '@/store/ui-store/ui.reducers';

export interface SelectIconProps {
  modelId: string;
  children: ReactNode;
}
export const SelectIcon = ({ modelId, children }: SelectIconProps) => {
  const {
    state: { modelsMap },
  } = useContext(HomeContext);

  //New Redux state
  const theme = useAppSelector(selectThemeState);

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
