import { ReactNode } from 'react';

import { useAppSelector } from '@/src/store/hooks';

import { RootState } from '@/src/store';

interface RenderWhenProps {
  children: ReactNode;
  selector: (state: RootState) => unknown;
}

export function RenderWhen({ selector, children }: RenderWhenProps) {
  const shouldRender = useAppSelector(selector);
  return shouldRender ? children : null;
}
